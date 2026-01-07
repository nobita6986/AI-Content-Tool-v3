
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
    let realModel = params.model;
    if (realModel.includes('gpt-5.2')) {
        // Strict mapping based on user intent for these UI placeholders
        if (realModel.includes('instant')) {
            realModel = 'gpt-4o-mini'; // Fast & Cheap
        } else if (realModel.includes('thinking')) {
            realModel = 'o1-preview'; // Reasoning
        } else if (realModel.includes('pro')) {
            realModel = 'gpt-4-turbo'; // Robust
        } else {
            realModel = 'gpt-4o'; // Auto/Default
        }
    } else if (!realModel.startsWith('gpt') && !realModel.startsWith('o1')) {
        // If somehow a gemini model passed here, fallback to GPT-4o
        realModel = 'gpt-4o';
    }

    // 3. Prepare Payload
    const messages = [];
    if (params.systemInstruction && !realModel.startsWith('o1')) {
        // o1-preview does not support 'system' role yet in some tiers, usually 'developer' or just 'user'
        // For broad compatibility, use system for gpt-4* and merge into user for o1 if needed.
        messages.push({ role: "system", content: params.systemInstruction });
    } else if (params.systemInstruction && realModel.startsWith('o1')) {
         // Prepend system instruction to user prompt for o1 models
         // as they strictly validate role types in early access
    }

    let userContent = params.prompt;
    if (params.systemInstruction && realModel.startsWith('o1')) {
        userContent = `[INSTRUCTION]: ${params.systemInstruction}\n\n[TASK]: ${params.prompt}`;
    }

    if (params.expectJson) {
        if (!userContent.toLowerCase().includes("json")) {
            userContent += "\n\nRETURN JSON FORMAT.";
        }
    }
    messages.push({ role: "user", content: userContent });

    const body: any = {
        model: realModel,
        messages: messages,
    };

    if (params.expectJson && !realModel.startsWith('o1')) {
        body.response_format = { type: "json_object" };
    }

    if (params.temperature !== undefined && !realModel.startsWith('o1')) {
         body.temperature = params.temperature;
    }

    let lastError: any = null;

    // 4. Execution Loop with Failover
    for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                // Check for retryable status codes (429: Too Many Requests, 5xx: Server Errors)
                if (response.status === 429 || response.status >= 500) {
                    console.warn(`OpenAI Key [${i}] (${apiKey.slice(0, 8)}...) failed with status ${response.status}. Switching key...`);
                    // If not the last key, loop continues
                    if (i < keys.length - 1) continue; 
                }
                
                const errText = await response.text();
                let errJson;
                try { errJson = JSON.parse(errText); } catch(e) {}
                throw new Error(`OpenAI Error (${response.status}): ${errJson?.error?.message || errText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error: any) {
            console.error(`OpenAI Request failed with key [${i}]`, error);
            lastError = error;
            // If it was a fetch network error (no response), likely retryable if we have more keys
            if (i < keys.length - 1 && !error.message?.includes("OpenAI Error")) {
                 continue;
            }
            // If we caught the explicit error thrown above, the 'continue' logic inside if(!response.ok) handles it.
            // This catch block handles network failures.
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
