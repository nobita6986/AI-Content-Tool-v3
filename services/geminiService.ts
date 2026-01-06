
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult, Language, StoryMetadata } from '../types';

/**
 * Execute a Google GenAI operation using provided apiKey or process.env.API_KEY.
 */
const executeGenAIRequest = async <T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
    apiKey?: string
): Promise<T> => {
    let rawKey = apiKey;

    // Fallback to env key safely (handle cases where process is not defined in browser)
    if (!rawKey) {
        try {
            // @ts-ignore
            rawKey = process.env.API_KEY || "";
        } catch (e) {
            rawKey = "";
        }
    }
    rawKey = rawKey || "";

    const googleKeyMatch = rawKey.match(/AIza[0-9A-Za-z\-_]{35}/);
    let key = googleKeyMatch ? googleKeyMatch[0] : "";

    if (!key) {
        const cleaned = rawKey.replace(/[\s"'\r\n]/g, '').replace(/[^\x21-\x7E]/g, '');
        if (cleaned.length > 0) key = cleaned;
    }

    if (!key) {
        throw new Error("Missing API Key: Please configure your Gemini API Key in Settings.");
    }

    const ai = new GoogleGenAI({ apiKey: key });
    return await operation(ai);
};

export const slugify = (s: string): string => {
    return (s || "ndgroup").toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

// Updated return type to include metadata
export const generateOutline = async (bookTitle: string, idea: string, channelName: string, mcName: string, chaptersCount: number, durationMin: number, language: Language, isAutoDuration: boolean = false, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<{ chapters: Omit<OutlineItem, 'index'>[], metadata: StoryMetadata }> => {
    const isVi = language === 'vi';
    const langContext = isVi 
        ? "Ngôn ngữ đầu ra: Tiếng Việt." 
        : "Output Language: English (US). Tone: Professional, Engaging.";
    
    // Logic cho Prompt dựa trên chế độ Auto hoặc Manual
    let structurePrompt = "";
    if (isAutoDuration) {
        structurePrompt = isVi
            ? `Mục tiêu: Tạo ra một tiểu thuyết dài khoảng 40-60 phút đọc. Hãy tự quyết định số lượng chương phù hợp (thường từ 15 đến 20 chương) để đảm bảo chiều sâu cốt truyện.`
            : `Goal: Create a novel script for 40-60 mins reading time. Decide appropriate chapter count (15-20) for plot depth.`;
    } else {
        structurePrompt = isVi
            ? `Mục tiêu: Video dài ${durationMin} phút. Chia nội dung thành ${chaptersCount} chương chính.`
            : `Goal: Video strictly ${durationMin} minutes long. Structure into ${chaptersCount} main chapters.`;
    }

    const prompt = isVi 
        ? `Bạn là một biên kịch tiểu thuyết chuyên nghiệp. Nhiệm vụ: Xây dựng hệ thống nhân vật và Dàn ý chi tiết cho tác phẩm "${bookTitle}".
           Bối cảnh/Ý tưởng bổ sung: "${idea || 'Tự sáng tạo theo motif Trọng sinh/Trả thù/Ngôn tình kịch tính'}".
           
           YÊU CẦU QUAN TRỌNG:
           1. Thiết lập 3 nhân vật cốt lõi với TÊN CỐ ĐỊNH (Không thay đổi tên trong suốt tác phẩm):
              - Nữ chính: Tên hay, tính cách kiên cường, thông minh sau khi trọng sinh.
              - Nam chính (Chân ái): Tên hay, thâm tình, bảo vệ thầm lặng, quyền lực.
              - Phản diện (Tra nam/Tiểu tam): Tên hay, ích kỷ, đạo đức giả nhưng có chiều sâu tâm lý (không chỉ xấu một màu).
           2. Cốt truyện phải có một trục xung đột chính xuyên suốt (ví dụ: Dự án tranh đấu, Bí mật tai nạn kiếp trước, v.v) chứ không chỉ là các cảnh vả mặt rời rạc.
           3. ${structurePrompt}
           4. Cấu trúc JSON trả về phải bao gồm thông tin nhân vật và danh sách các chương.
           ${langContext}`
        : `You are a professional novel screenwriter. Task: Establish characters and detailed Outline for "${bookTitle}".
           Context/Idea: "${idea || 'Creative Rewrite/Revenge/Romance'}".
           
           CRITICAL REQUIREMENTS:
           1. Define 3 core characters with FIXED NAMES:
              - Female Lead: Strong, smart after rebirth.
              - Male Lead: Deeply in love, silent protector, powerful.
              - Villain: Selfish, hypocritical but psychologically complex.
           2. Plot must have a central conflict arc, not just disjointed scenes.
           3. ${structurePrompt}
           4. JSON output must include character metadata and chapter list.
           ${langContext}`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        metadata: {
                            type: Type.OBJECT,
                            properties: {
                                femaleLead: { type: Type.STRING, description: "Name of Female Lead" },
                                maleLead: { type: Type.STRING, description: "Name of Male Lead" },
                                villain: { type: Type.STRING, description: "Name of Villain" }
                            },
                            required: ["femaleLead", "maleLead", "villain"]
                        },
                        chapters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    focus: { type: Type.STRING },
                                    actions: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING }
                                    }
                                },
                                required: ["title", "focus", "actions"]
                            }
                        }
                    },
                    required: ["metadata", "chapters"]
                }
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }, apiKey);
};

export const generateStoryBlock = async (item: OutlineItem, metadata: StoryMetadata, bookTitle: string, idea: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const ideaContext = idea ? (isVi ? `Lưu ý ý tưởng chủ đạo: "${idea}".` : `Note the core idea: "${idea}".`) : "";
    
    // Enforce consistency using metadata
    const characterContext = isVi
        ? `HỆ THỐNG NHÂN VẬT (BẮT BUỘC DÙNG ĐÚNG TÊN):
           - Nữ chính: ${metadata.femaleLead}
           - Nam chính: ${metadata.maleLead}
           - Phản diện: ${metadata.villain}
           TUYỆT ĐỐI KHÔNG ĐỔI TÊN NHÂN VẬT.`
        : `CHARACTER SYSTEM (MUST USE EXACT NAMES):
           - Female Lead: ${metadata.femaleLead}
           - Male Lead: ${metadata.maleLead}
           - Villain: ${metadata.villain}
           DO NOT CHANGE NAMES.`;

    const prompt = isVi
        ? `Bạn là một tiểu thuyết gia tài ba. Hãy viết nội dung chi tiết cho chương "${item.title}" của tác phẩm "${bookTitle}".
           ${characterContext}
           ${ideaContext}
           Mục tiêu chương: "${item.focus}". Tình tiết chính: ${item.actions.join(', ')}.
           
           YÊU CẦU KỸ THUẬT VIẾT:
           1. Show, don't tell (Tả cảnh ngụ tình, dùng hành động, ánh mắt, chi tiết nhỏ để bộc lộ cảm xúc thay vì kể lể).
           2. Chỉ viết nội dung truyện thuần túy (văn xuôi). TUYỆT ĐỐI KHÔNG chèn lời dẫn MC, không chèn "Xin chào khán giả", không kêu gọi Subscribe.
           3. Tâm lý nhân vật phải sâu sắc. Phản diện không chỉ xấu xa mà phải có lý do/tham vọng riêng.
           4. Độ dài: 500-700 từ. Ngôn ngữ: Tiếng Việt giàu cảm xúc.`
        : `You are a best-selling novelist. Write detailed content for chapter "${item.title}" of "${bookTitle}".
           ${characterContext}
           ${ideaContext}
           Goal: "${item.focus}". Plot points: ${item.actions.join(', ')}.
           
           WRITING RULES:
           1. Show, don't tell. Use evocative details.
           2. PURE STORY CONTENT ONLY. NO Radio Host/MC intro/outro inside the story text.
           3. Deep psychology. Villains should be complex.
           4. Length: 500-700 words. English.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    }, apiKey);
};

export const generateReviewBlock = async (storyContent: string, chapterTitle: string, bookTitle: string, channelName: string, mcName: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string> => {
    const isVi = language === 'vi';
    const identityInfo = isVi 
        ? `Tên Kênh: "${channelName || 'Kênh của bạn'}", Tên MC: "${mcName || 'Mình'}".`
        : `Channel Name: "${channelName || 'Your Channel'}", Host Name: "${mcName || 'Me'}".`;

    const prompt = isVi
        ? `Bạn là một Reviewer/MC kênh AudioBook nổi tiếng (giọng đọc trầm ấm, sâu sắc).
           Thông tin định danh: ${identityInfo}. 
           Nhiệm vụ: Chuyển thể nội dung truyện sau thành kịch bản đọc (lời dẫn).
           
           Nội dung truyện gốc: "${storyContent}"
           
           YÊU CẦU:
           - Đây là lúc MC xuất hiện. Hãy phân tích tâm lý nhân vật, bình luận về tình tiết, và dẫn dắt người nghe.
           - Giọng văn tự nhiên, như đang kể chuyện cho bạn bè.
           - Đan xen giữa kể chuyện và bình luận sâu sắc.`
        : `You are a famous Audiobook Narrator/Reviewer.
           Identity Info: ${identityInfo}.
           Task: Adapt the following story content into a narration script.
           
           Original Story: "${storyContent}"
           
           REQUIREMENTS:
           - Analyze psychology, comment on the plot, guide the listener.
           - Natural, conversational tone.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    }, apiKey);
};

export const generateSEO = async (bookTitle: string, channelName: string, durationMin: number, language: Language, model: string = 'gemini-3-pro-preview', apiKey?: string): Promise<SEOResult> => {
    const isVi = language === 'vi';
    const channelContext = channelName ? (isVi ? `Tên kênh là "${channelName}".` : `Channel name is "${channelName}".`) : "";

    const prompt = isVi
        ? `Tạo nội dung SEO cho video YouTube về "${bookTitle}". ${channelContext} Dạng Review/Kể chuyện dài ${durationMin} phút. Cung cấp: 8 tiêu đề clickbait, hashtags, keywords (bao gồm tên kênh), và mô tả video chuẩn SEO (nhắc đến tên kênh). JSON format. Ngôn ngữ: Tiếng Việt.`
        : `Generate SEO content for a YouTube video about "${bookTitle}". ${channelContext} Format: Audiobook/Review, ${durationMin} minutes long. Provide: 8 clickbait titles, hashtags, keywords (include channel name), and a SEO-optimized video description (mention channel name). JSON format. Language: English.`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        titles: { type: Type.ARRAY, items: { type: Type.STRING } },
                        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        description: { type: Type.STRING }
                    },
                    required: ["titles", "hashtags", "keywords", "description"]
                }
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }, apiKey);
};

export const generateVideoPrompts = async (bookTitle: string, frameRatio: string, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const prompt = `Generate 5 cinematic, photorealistic video prompts for background visuals in a YouTube video about "${bookTitle}". Visuals should match the story's mood. Aspect ratio: ${frameRatio}. No text/logos. JSON array of strings.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }, apiKey);
};

export const generateThumbIdeas = async (bookTitle: string, durationMin: number, language: Language, model: string = 'gemini-3-flash-preview', apiKey?: string): Promise<string[]> => {
    const isVi = language === 'vi';
    const durationStr = `${Math.floor(durationMin / 60)}H${(durationMin % 60).toString().padStart(2, "0")}M`;
    const prompt = isVi
        ? `Cho video YouTube về "${bookTitle}", đề xuất 5 text thumbnail ngắn gọn, gây tò mò, tiếng Việt. Một ý phải chứa thời lượng: ${durationStr}. JSON array.`
        : `For a YouTube video about "${bookTitle}", suggest 5 short, curiosity-inducing thumbnail texts in English. One idea must include duration: ${durationStr}. JSON array.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }, apiKey);
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
