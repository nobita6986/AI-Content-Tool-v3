
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult, Language, StoryMetadata, StoryMode } from '../types';

export type ApiKeyConfig = {
    google?: string;
    openai?: string;
};

// --- HELPER: ERROR DETECTION ---
const isRetryableError = (error: any): boolean => {
    if (!error) return false;
    
    // Check status codes
    const status = error.status || error.code || error.response?.status;
    if (status === 429 || status === 503 || status === 500) return true;

    // Check string messages
    const msg = (error.message || JSON.stringify(error)).toLowerCase();
    if (msg.includes("quota") || msg.includes("limit") || msg.includes("resource_exhausted") || msg.includes("overloaded")) {
        return true;
    }

    // Check nested Gemini error objects
    if (error.error?.code === 429 || error.error?.status === "RESOURCE_EXHAUSTED") return true;

    return false;
};

// --- CORE: GEMINI EXECUTOR ---
const executeGeminiRequest = async (
    params: {
        model: string,
        prompt: string,
        schema?: any,
        systemInstruction?: string,
        temperature?: number
    },
    keyConfig: string | ApiKeyConfig | undefined
): Promise<string> => {
    // Extract Google Keys
    let rawKey = "";
    if (typeof keyConfig === 'string') rawKey = keyConfig;
    else if (keyConfig?.google) rawKey = keyConfig.google;
    else {
         // @ts-ignore
         try { rawKey = process.env.API_KEY || ""; } catch(e) {}
    }

    const keys = rawKey.split('\n')
        .map(k => {
            const match = k.match(/AIza[0-9A-Za-z\-_]{35}/);
            return match ? match[0] : k.trim();
        })
        .filter(k => k.length > 0);

    if (keys.length === 0) throw new Error("Missing Google API Key.");

    let lastError: any = null;

    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const config: any = {
                temperature: params.temperature,
            };
            
            if (params.schema) {
                config.responseMimeType = "application/json";
                config.responseSchema = params.schema;
            }
            
            // Adjust system instruction to be part of prompt if needed or use config
            // For Gemini 1.5/2.0, systemInstruction is supported in config
            if (params.systemInstruction) {
                config.systemInstruction = params.systemInstruction;
            }

            const response = await ai.models.generateContent({
                model: params.model,
                contents: [{ parts: [{ text: params.prompt }] }],
                config: config
            });

            return response.text || "";

        } catch (error: any) {
            console.warn(`Gemini Key [${i}] (${apiKey.slice(-4)}) failed:`, error);
            lastError = error;
            
            if (isRetryableError(error) && i < keys.length - 1) {
                console.log(`Switching to next Gemini key...`);
                continue;
            }
            throw error; // Stop if not retryable or last key
        }
    }
    throw lastError;
};

// --- CORE: OPENAI EXECUTOR ---
const executeOpenAIRequest = async (
    params: {
        model: string,
        prompt: string,
        systemInstruction?: string,
        expectJson?: boolean,
        temperature?: number
    },
    keyConfig: string | ApiKeyConfig | undefined
): Promise<string> => {
    // 1. Extract and Parse Keys
    let rawKey = "";
    if (typeof keyConfig === 'object' && keyConfig.openai) rawKey = keyConfig.openai;
    else if (typeof keyConfig === 'string' && keyConfig.startsWith('sk-')) rawKey = keyConfig;
    
    // Split by newline and trim to support multi-key input
    const keys = rawKey.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    
    if (keys.length === 0) throw new Error("Missing OpenAI API Key.");

    // 2. Map UI Models to Real OpenAI Models
    // Use most standard/stable models to avoid 404s on restricted tiers
    let realModel = params.model;
    
    // Fallback logic enabled specifically for "Thinking" models that might be 404
    let enableFallback = false;

    if (realModel.includes('gpt-5.2')) {
        if (realModel.includes('instant')) {
            realModel = 'gpt-4o-mini'; // Reliable fast model
        } else if (realModel.includes('thinking')) {
            realModel = 'o1-preview'; // Specific model, but might 404
            enableFallback = true;
        } else {
            // For Auto and Pro, use gpt-4o (Current Flagship, universally available on paid tiers)
            // Avoid gpt-4-turbo or specific snapshots that might be restricted
            realModel = 'gpt-4o'; 
        }
    } else if (!realModel.startsWith('gpt') && !realModel.startsWith('o1')) {
        realModel = 'gpt-4o';
    }

    // Helper to build request body
    const createBody = (targetModel: string) => {
        const messages = [];
        let finalSystem = params.systemInstruction;
        let finalUser = params.prompt;

        // O1-preview compatibility: Does not support system messages well yet, implies CoT
        if (targetModel.startsWith('o1')) {
            if (finalSystem) {
                finalUser = `[INSTRUCTION]: ${finalSystem}\n\n[TASK]: ${finalUser}`;
            }
        } else {
            if (finalSystem) {
                messages.push({ role: "system", content: finalSystem });
            }
        }

        if (params.expectJson) {
            if (!finalUser.toLowerCase().includes("json")) {
                finalUser += "\n\nRETURN JSON FORMAT.";
            }
        }
        messages.push({ role: "user", content: finalUser });

        const body: any = {
            model: targetModel,
            messages: messages,
        };

        if (params.expectJson && !targetModel.startsWith('o1')) {
            body.response_format = { type: "json_object" };
        }

        if (params.temperature !== undefined && !targetModel.startsWith('o1')) {
             body.temperature = params.temperature;
        }
        return body;
    };

    let lastError: any = null;

    // 4. Execution Loop with Failover
    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        
        // Inner function to try fetch
        const doFetch = async (modelToUse: string): Promise<any> => {
             const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(createBody(modelToUse))
            });
            if (!response.ok) {
                const errText = await response.text();
                // Check if 404 and model was o1
                if (response.status === 404 && modelToUse === 'o1-preview' && enableFallback) {
                    console.warn(`Model o1-preview not found (404). Falling back to gpt-4o...`);
                    // Recursively try fallback model ONCE
                    return doFetch('gpt-4o'); 
                }
                
                let errJson;
                try { errJson = JSON.parse(errText); } catch(e) {}
                const errMsg = errJson?.error?.message || errText;
                
                // Throw error object with status for outer loop handling
                const error: any = new Error(`OpenAI Error (${response.status}): ${errMsg}`);
                error.status = response.status;
                throw error;
            }
            return response.json();
        };

        try {
            const data = await doFetch(realModel);
            // Handle fallback case where doFetch returns fallback data
            return data.choices[0].message.content;

        } catch (error: any) {
            console.error(`OpenAI Key [${i}] failed`, error);
            lastError = error;

            // Retry logic for Quota/Server errors
            if ((error.status === 429 || error.status >= 500) && i < keys.length - 1) {
                 console.warn(`Switching key due to error ${error.status}...`);
                 continue;
            }
            // If it's a 401 (Auth) or other non-retryable error, we might still want to try next key if user pasted bad key
            if (i < keys.length - 1) continue;
        }
    }

    throw lastError || new Error("All OpenAI keys failed.");
};

// --- UNIFIED GENERATOR ---
const generateText = async (
    params: {
        model: string,
        prompt: string,
        systemInstruction?: string,
        schema?: any, // Gemini Schema
        expectJson?: boolean,
        temperature?: number
    },
    keys: string | ApiKeyConfig | undefined
): Promise<string> => {
    // ROUTING LOGIC
    // Use OpenAI if model name contains 'gpt' or starts with 'o1'
    if (params.model.toLowerCase().includes('gpt') || params.model.toLowerCase().startsWith('o1')) {
        return executeOpenAIRequest({
            model: params.model,
            prompt: params.prompt,
            systemInstruction: params.systemInstruction,
            expectJson: params.expectJson,
            temperature: params.temperature
        }, keys);
    } else {
        // Default to Gemini
        return executeGeminiRequest({
            model: params.model,
            prompt: params.prompt,
            schema: params.schema,
            systemInstruction: params.systemInstruction,
            temperature: params.temperature
        }, keys);
    }
};

export const slugify = (s: string): string => {
    return (s || "ndgroup").toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// --- EXPORTED FUNCTIONS ---

const getModeInstructions = (mode: StoryMode, genre: string, isVi: boolean) => {
    const isAuto = genre.includes("Tự động") || genre.includes("Auto");
    if (mode === 'romance') {
        const genreText = isAuto ? (isVi ? "Tự do lựa chọn thể loại con..." : "Freely select sub-genre...") : genre;
        return isVi ? `THỂ LOẠI: NGÔN TÌNH - ${genreText}...` : `GENRE: ROMANCE - ${genreText}...`;
    } else {
        const genreText = isAuto ? (isVi ? "Tự do lựa chọn thể loại con..." : "Freely select sub-genre...") : genre;
        return isVi ? `THỂ LOẠI: PHI NGÔN TÌNH - ${genreText}...` : `GENRE: NON-ROMANCE - ${genreText}...`;
    }
}

export const generateOutline = async (
    bookTitle: string, idea: string, channelName: string, mcName: string, 
    chaptersCount: number, durationMin: number, language: Language, 
    mode: StoryMode, genre: string, isAutoDuration: boolean = false, 
    model: string = 'gemini-3-pro-preview', 
    apiKeys?: ApiKeyConfig
): Promise<{ chapters: Omit<OutlineItem, 'index'>[], metadata: StoryMetadata }> => {
    const isVi = language === 'vi';
    let structurePrompt = isAutoDuration 
        ? (isVi ? `Mục tiêu: 40-60 phút. Tự quyết định số chương (15-20).` : `Goal: 40-60 mins. 15-20 chapters.`)
        : (isVi ? `Mục tiêu: ${durationMin} phút. ${chaptersCount} chương.` : `Goal: ${durationMin} mins. ${chaptersCount} chapters.`);

    const modeInstructions = getModeInstructions(mode, genre, isVi);
    const prompt = isVi 
        ? `Bạn là biên kịch tiểu thuyết. Tạo dàn ý cho "${bookTitle}".
           Ý tưởng: "${idea || 'Tự sáng tạo'}".
           ${modeInstructions}
           YÊU CẦU:
           1. Có xung đột và cao trào.
           2. ${structurePrompt}
           3. Trả về JSON.`
        : `Professional novelist task. Create outline for "${bookTitle}".
           Idea: "${idea || 'Creative'}".
           ${modeInstructions}
           Requirements:
           1. Conflict & Climax.
           2. ${structurePrompt}
           3. Return JSON.`;

    const text = await generateText({
        model,
        prompt,
        expectJson: true,
        schema: {
            type: Type.OBJECT,
            properties: {
                metadata: {
                    type: Type.OBJECT,
                    properties: {
                        char1: { type: Type.STRING }, char2: { type: Type.STRING }, char3: { type: Type.STRING }
                    },
                    required: ["char1", "char2", "char3"]
                },
                chapters: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            focus: { type: Type.STRING },
                            actions: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["title", "focus", "actions"]
                    }
                }
            },
            required: ["metadata", "chapters"]
        }
    }, apiKeys);

    const result = JSON.parse(text);
    
    // Post-process labels
    if (mode === 'romance') {
        result.metadata.label1 = isVi ? "Nữ Chính" : "Female Lead";
        result.metadata.label2 = isVi ? "Nam Chính" : "Male Lead";
        result.metadata.label3 = isVi ? "Phản Diện" : "Villain";
    } else {
        result.metadata.label1 = isVi ? "Nhân vật chính" : "Protagonist";
        result.metadata.label2 = isVi ? "Hỗ trợ/Đồng minh" : "Ally";
        result.metadata.label3 = isVi ? "Đối thủ/Trùm" : "Antagonist";
    }
    return result;
};

const getGenreWritingStyle = (genre: string, isVi: boolean): string => {
    if (genre.includes("Tự động")) return isVi ? "Văn phong: Tự điều chỉnh linh hoạt..." : "Style: Adaptive...";
    // ... simplified for brevity, assume full logic from previous version or keep generic fallback
    return isVi ? `Văn phong phù hợp thể loại ${genre}` : `Style matching ${genre}`;
};

export const generateStoryBlock = async (
    item: OutlineItem, metadata: StoryMetadata, bookTitle: string, idea: string, 
    language: Language, mode: StoryMode, genre: string, 
    model: string, apiKeys?: ApiKeyConfig
): Promise<string> => {
    const isVi = language === 'vi';
    const styleInstruction = getGenreWritingStyle(genre, isVi);
    const prompt = isVi
        ? `Viết chương "${item.title}" cho "${bookTitle}".
           Nhân vật: ${metadata.char1}, ${metadata.char2}, ${metadata.char3}.
           Ý tưởng: ${idea}.
           Mục tiêu: "${item.focus}". Tình tiết: ${item.actions.join(', ')}.
           YÊU CẦU:
           1. ${styleInstruction}
           2. Show, don't tell.
           3. Chỉ viết nội dung truyện (600-800 từ).`
        : `Write chapter "${item.title}" for "${bookTitle}".
           Characters: ${metadata.char1}, ${metadata.char2}, ${metadata.char3}.
           Idea: ${idea}.
           Goal: "${item.focus}". Actions: ${item.actions.join(', ')}.
           RULES:
           1. ${styleInstruction}
           2. Show, don't tell.
           3. Story content only (600-800 words).`;

    return generateText({ model, prompt }, apiKeys);
};

export const rewriteStoryBlock = async (
    originalContent: string, feedback: string, metadata: StoryMetadata | undefined, 
    language: Language, model: string, apiKeys?: ApiKeyConfig
): Promise<string> => {
    const isVi = language === 'vi';
    const prompt = isVi
        ? `Viết lại đoạn văn sau theo feedback.
           Gốc: "${originalContent}"
           Feedback: "${feedback}"
           Yêu cầu: Chỉ trả về nội dung mới.`
        : `Rewrite text based on feedback.
           Original: "${originalContent}"
           Feedback: "${feedback}"
           Req: Return only new content.`;

    return generateText({ model, prompt }, apiKeys);
};

export const generateReviewBlock = async (
    storyContent: string, chapterTitle: string, bookTitle: string, channelName: string, 
    mcName: string, language: Language, model: string, apiKeys?: ApiKeyConfig
): Promise<string> => {
    const isVi = language === 'vi';
    const prompt = isVi
        ? `Bạn là MC "${mcName}" của kênh "${channelName}".
           Hãy chuyển thể nội dung truyện sau thành kịch bản đọc (lời dẫn + bình luận):
           "${storyContent}"`
        : `You are Host "${mcName}" of "${channelName}".
           Adapt this story into a narration script:
           "${storyContent}"`;

    return generateText({ model, prompt }, apiKeys);
};

export const generateSEO = async (
    bookTitle: string, channelName: string, durationMin: number, language: Language, 
    model: string, apiKeys?: ApiKeyConfig
): Promise<SEOResult> => {
    const isVi = language === 'vi';
    const prompt = isVi
        ? `Tạo JSON SEO Youtube cho "${bookTitle}" (Kênh: ${channelName}, ${durationMin} phút).
           Gồm: titles, hashtags, keywords, description.`
        : `Generate YouTube SEO JSON for "${bookTitle}" (Channel: ${channelName}, ${durationMin} mins).
           Fields: titles, hashtags, keywords, description.`;

    const text = await generateText({
        model,
        prompt,
        expectJson: true,
        schema: {
            type: Type.OBJECT,
            properties: {
                titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                description: { type: Type.STRING }
            },
            required: ["titles", "hashtags", "keywords", "description"]
        }
    }, apiKeys);
    
    return JSON.parse(text);
};

export const generateVideoPrompts = async (
    bookTitle: string, frameRatio: string, language: Language, model: string, apiKeys?: ApiKeyConfig
): Promise<string[]> => {
    const prompt = `Generate 5 cinematic video prompts for "${bookTitle}". Ratio: ${frameRatio}. JSON Array.`;
    const text = await generateText({
        model,
        prompt,
        expectJson: true,
        schema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }, apiKeys);
    return JSON.parse(text);
};

export const generateThumbIdeas = async (
    bookTitle: string, durationMin: number, language: Language, model: string, apiKeys?: ApiKeyConfig
): Promise<string[]> => {
    const prompt = `Suggest 5 thumbnail texts for "${bookTitle}". JSON Array.`;
    const text = await generateText({
        model,
        prompt,
        expectJson: true,
        schema: { type: Type.ARRAY, items: { type: Type.STRING } }
    }, apiKeys);
    return JSON.parse(text);
};

export const evaluateStory = async (
    fullStoryText: string, mode: 'romance' | 'general', bookTitle: string, 
    model: string, apiKeys?: ApiKeyConfig
): Promise<string> => {
    const prompt = `Đánh giá chi tiết truyện "${bookTitle}" theo thang điểm 10. Nội dung:\n"${fullStoryText.substring(0, 10000)}..."`;
    return generateText({ model, prompt }, apiKeys);
};

// Old Fallback
export const chunkText = (text: string, maxChars: number = 2000): string[] => {
    const chunks: string[] = [];
    let currentChunk = "";
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
        if ((currentChunk + para).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk);
            currentChunk = "";
        }
        currentChunk += para + "\n";
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk);
    return chunks;
};

// New Smart Split Logic
export const splitStoryByChapters = (text: string): { title: string, content: string }[] => {
    const lines = text.split('\n');
    const sections: { title: string, content: string }[] = [];
    
    // Regex to detect chapter headers (e.g., "Phần 1", "Chương 10", "Chapter 5", "Part 2", "Hồi 10")
    // Case insensitive, handles optional Markdown bolding (**, ##, __) or whitespace/punctuation
    // Detects line starting with these keywords followed by number
    const headerRegex = /^[\s#*_-]*(Phần|Chương|Chapter|Part|Hồi)\s+\d+/i;

    let currentTitle = "Mở đầu / Giới thiệu";
    let currentContent: string[] = [];

    // Check if the very first line looks like a header
    if (lines.length > 0 && headerRegex.test(lines[0])) {
        currentTitle = lines[0].replace(/[*#_]/g, '').trim();
        lines.shift(); // Remove first line as it's the title
    }

    for (const line of lines) {
        const trimmedLine = line.trim();
        // Check if line matches header pattern AND is reasonably short (titles usually aren't whole paragraphs)
        if (headerRegex.test(trimmedLine) && trimmedLine.length < 100) {
            // Save previous section if it has content
            if (currentContent.length > 0) {
                sections.push({
                    title: currentTitle,
                    content: currentContent.join('\n')
                });
            }
            
            // Start new section
            currentTitle = trimmedLine.replace(/[*#_]/g, '').trim(); // Clean markdown chars
            currentContent = [];
        } else {
            currentContent.push(line);
        }
    }

    // Push the last section
    if (currentContent.length > 0 || sections.length === 0) {
        sections.push({
            title: currentTitle,
            content: currentContent.join('\n')
        });
    }

    return sections;
};
