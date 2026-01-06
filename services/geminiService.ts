
import { GoogleGenAI, Type } from "@google/genai";
import { OutlineItem, SEOResult, Language, StoryMetadata, StoryMode } from '../types';

/**
 * Execute a Google GenAI operation using provided apiKey or process.env.API_KEY.
 */
const executeGenAIRequest = async <T>(
    operation: (ai: GoogleGenAI) => Promise<T>,
    apiKey?: string
): Promise<T> => {
    let rawKey = apiKey;

    // Fallback to env key safely
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

// --- PROMPT HELPERS ---

const getModeInstructions = (mode: StoryMode, genre: string, isVi: boolean) => {
    const isAuto = genre.includes("Tự động") || genre.includes("Auto");

    if (mode === 'romance') {
        const genreText = isAuto 
            ? (isVi 
                ? "Tự do lựa chọn thể loại con (Sub-genre) phù hợp nhất với Tiêu đề và Ý tưởng của sách (VD: Tổng tài, Cổ đại, Điền văn, Xuyên không...)" 
                : "Freely select the best sub-genre based on Book Title and Idea") 
            : genre;

        return isVi ? 
            `THỂ LOẠI: NGÔN TÌNH - ${genreText}.
             TRỌNG TÂM: Cảm xúc, chemistry giữa cặp đôi chính, xung đột tình cảm, và sự phát triển mối quan hệ.
             YÊU CẦU NHÂN VẬT:
             - Nữ chính (char1): Tên hay, có cá tính riêng (Nữ cường/Tiểu bạch/Hắc hóa tùy genre tự chọn).
             - Nam chính (char2): Tên hay, thâm tình/quyền lực/bảo vệ.
             - Phản diện/Tiểu tam (char3): Gây ức chế, thử thách tình yêu.` 
            : 
            `GENRE: ROMANCE - ${genreText}.
             FOCUS: Emotions, chemistry, relationship arc.
             CHARACTERS:
             - Female Lead (char1): Unique personality.
             - Male Lead (char2): Deep love/Powerful.
             - Villain (char3): Creates conflict.`;
    } else {
        const genreText = isAuto 
            ? (isVi 
                ? "Tự do lựa chọn thể loại con (Sub-genre) phù hợp nhất với Tiêu đề và Ý tưởng của sách (VD: Tiên hiệp, Trinh thám, Mạt thế, Khoa huyễn...)" 
                : "Freely select the best sub-genre based on Book Title and Idea") 
            : genre;

        return isVi ?
            `THỂ LOẠI: PHI NGÔN TÌNH - ${genreText}.
             TRỌNG TÂM: Cốt truyện, hành động, bí ẩn, xây dựng thế giới (World-building), hoặc logic tư duy. Tình cảm chỉ là yếu tố phụ hoặc không có.
             YÊU CẦU NHÂN VẬT:
             - Nhân vật chính (char1): Tên hay, có kỹ năng/trí tuệ/sức mạnh đặc biệt phù hợp thể loại tự chọn.
             - Đồng minh/Hỗ trợ quan trọng (char2): Người đồng hành tin cậy.
             - Đối thủ/Trùm cuối (char3): Kẻ thù nguy hiểm, thông minh, tạo ra mối đe dọa thực sự.`
            :
            `GENRE: NON-ROMANCE - ${genreText}.
             FOCUS: Plot, action, mystery, world-building. Romance is secondary or non-existent.
             CHARACTERS:
             - Protagonist (char1): Unique skills/intelligence.
             - Ally/Sidekick (char2): Trustworthy companion.
             - Antagonist (char3): Dangerous, smart threat.`;
    }
}

export const generateOutline = async (
    bookTitle: string, 
    idea: string, 
    channelName: string, 
    mcName: string, 
    chaptersCount: number, 
    durationMin: number, 
    language: Language, 
    mode: StoryMode,
    genre: string,
    isAutoDuration: boolean = false, 
    model: string = 'gemini-3-pro-preview', 
    apiKey?: string
): Promise<{ chapters: Omit<OutlineItem, 'index'>[], metadata: StoryMetadata }> => {
    const isVi = language === 'vi';
    
    let structurePrompt = "";
    if (isAutoDuration) {
        structurePrompt = isVi
            ? `Mục tiêu: Tiểu thuyết dài 40-60 phút đọc. Tự quyết định số chương (15-20) để đảm bảo chiều sâu.`
            : `Goal: 40-60 mins reading time. 15-20 chapters.`;
    } else {
        structurePrompt = isVi
            ? `Mục tiêu: Video dài ${durationMin} phút. Chia thành ${chaptersCount} chương chính.`
            : `Goal: ${durationMin} minutes video. ${chaptersCount} chapters.`;
    }

    const modeInstructions = getModeInstructions(mode, genre, isVi);

    const prompt = isVi 
        ? `Bạn là một biên kịch tiểu thuyết chuyên nghiệp (Best-selling Author). 
           Nhiệm vụ: Xây dựng hệ thống nhân vật và Dàn ý chi tiết cho tác phẩm "${bookTitle}".
           Ý tưởng/Bối cảnh: "${idea || 'Tự sáng tạo theo thể loại'}".
           
           ${modeInstructions}

           YÊU CẦU CẤU TRÚC:
           1. Cốt truyện phải có trục xung đột xuyên suốt (Main Conflict Arc) và cao trào (Climax).
           2. ${structurePrompt}
           3. Trả về JSON bao gồm metadata nhân vật (char1, char2, char3) và danh sách chương.`
        : `You are a professional novelist. 
           Task: Create Character System and Detailed Outline for "${bookTitle}".
           Idea: "${idea || 'Creative based on genre'}".
           
           ${modeInstructions}

           REQUIREMENTS:
           1. Plot must have a central conflict arc and climax.
           2. ${structurePrompt}
           3. Return JSON with character metadata (char1, char2, char3) and chapters.`;

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
                                char1: { type: Type.STRING, description: "Main Character / Female Lead Name" },
                                char2: { type: Type.STRING, description: "Ally / Male Lead Name" },
                                char3: { type: Type.STRING, description: "Villain / Antagonist Name" }
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
        const result = JSON.parse(jsonText);
        
        // Post-process to add labels for UI
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
    }, apiKey);
};

const getGenreWritingStyle = (genre: string, isVi: boolean): string => {
    // Handle Auto Genre
    if (genre.includes("Tự động") || genre.includes("Auto")) {
        return isVi 
            ? "Văn phong: Tự điều chỉnh linh hoạt để phù hợp nhất với bối cảnh và thể loại con (sub-genre) mà bạn đã xác định cho câu chuyện (VD: Nếu là Cổ đại thì văn phong hoa mỹ, nếu là Hiện đại thì gãy gọn/sắc sảo, nếu là Kinh dị thì u tối...)."
            : "Style: Adaptive. Automatically adjust tone and style to match the specific sub-genre and setting identified from the context.";
    }

    // ROMANCE STYLES
    if (genre.includes('Cổ đại') || genre.includes('Ancient')) return isVi 
        ? "Văn phong: Cổ trang, hoa mỹ, dùng từ Hán Việt hợp lý. Tả cảnh ngụ tình." 
        : "Style: Historical, poetic, atmospheric.";
    if (genre.includes('Hiện đại') || genre.includes('Modern')) return isVi 
        ? "Văn phong: Hiện đại, sắc sảo, thực tế. Thoại đời thường nhưng sâu cay." 
        : "Style: Modern, sharp, realistic dialogue.";
    if (genre.includes('Sảng văn') || genre.includes('Face-slapping')) return isVi
        ? "Văn phong: Kịch tính, tiết tấu nhanh, tập trung vào cảm giác thỏa mãn (sảng) khi nhân vật chính chiến thắng."
        : "Style: Fast-paced, dramatic, satisfying payback.";
    if (genre.includes('Ngược') || genre.includes('Angst')) return isVi
        ? "Văn phong: Day dứt, bi thương, tập trung miêu tả nội tâm giằng xé."
        : "Style: Melancholic, heartbreaking, internal conflict focus.";
    
    // NON-ROMANCE STYLES
    if (genre.includes('Tiên hiệp') || genre.includes('Tu tiên') || genre.includes('Xianxia')) return isVi
        ? "Văn phong: Tiên khí, hào hùng. Tập trung mô tả chiêu thức, cảnh giới, sự hùng vĩ của thế giới tu chân."
        : "Style: Epic, mystical. Focus on cultivation levels, skills, and vast world.";
    if (genre.includes('Trinh thám') || genre.includes('Kinh dị') || genre.includes('Horror')) return isVi
        ? "Văn phong: Lạnh lùng, hồi hộp, logic chặt chẽ. Tạo không khí rùng rợn hoặc căng thẳng qua từng câu chữ."
        : "Style: Cold, suspenseful, logical. Build tension and atmosphere.";
    if (genre.includes('Khoa huyễn') || genre.includes('Sci-Fi')) return isVi
        ? "Văn phong: Chính xác, lý tính. Mô tả công nghệ và bối cảnh tương lai chi tiết."
        : "Style: Precise, analytical. Detailed sci-fi setting descriptions.";
    
    return isVi ? "Văn phong: Giàu cảm xúc, tả cảnh ngụ tình (Show, don't tell)." : "Style: Evocative, Show don't tell.";
};

export const generateStoryBlock = async (
    item: OutlineItem, 
    metadata: StoryMetadata, 
    bookTitle: string, 
    idea: string, 
    language: Language, 
    mode: StoryMode,
    genre: string,
    model: string = 'gemini-3-flash-preview', 
    apiKey?: string
): Promise<string> => {
    const isVi = language === 'vi';
    const ideaContext = idea ? (isVi ? `Lưu ý ý tưởng chủ đạo: "${idea}".` : `Note core idea: "${idea}".`) : "";
    const styleInstruction = getGenreWritingStyle(genre, isVi);
    
    const characterContext = isVi
        ? `HỆ THỐNG NHÂN VẬT (BẮT BUỘC DÙNG ĐÚNG TÊN):
           - ${metadata.label1 || 'NV Chính'}: ${metadata.char1}
           - ${metadata.label2 || 'NV Phụ'}: ${metadata.char2}
           - ${metadata.label3 || 'Đối thủ'}: ${metadata.char3}
           TUYỆT ĐỐI KHÔNG ĐỔI TÊN NHÂN VẬT.`
        : `CHARACTERS (USE EXACT NAMES):
           - ${metadata.label1 || 'Protagonist'}: ${metadata.char1}
           - ${metadata.label2 || 'Ally'}: ${metadata.char2}
           - ${metadata.label3 || 'Antagonist'}: ${metadata.char3}
           DO NOT CHANGE NAMES.`;

    let genreIntro = "";
    if (genre.includes("Tự động") || genre.includes("Auto")) {
        genreIntro = isVi 
           ? `Bạn là một tiểu thuyết gia xuất sắc, có khả năng viết đa dạng thể loại. Hãy tự xác định thể loại con (sub-genre) phù hợp nhất cho tác phẩm "${bookTitle}" dựa trên ý tưởng đã có.`
           : `You are a versatile best-selling novelist. Identify the best sub-genre for "${bookTitle}" based on the idea.`;
    } else {
        genreIntro = isVi
           ? `Bạn là một tiểu thuyết gia chuyên viết thể loại [${genre}].`
           : `You are a specialized [${genre}] novelist.`;
    }

    const prompt = isVi
        ? `${genreIntro} Hãy viết nội dung chi tiết cho chương "${item.title}" của tác phẩm "${bookTitle}".
           ${characterContext}
           ${ideaContext}
           Mục tiêu chương: "${item.focus}". Tình tiết chính: ${item.actions.join(', ')}.
           
           YÊU CẦU KỸ THUẬT VIẾT:
           1. ${styleInstruction}
           2. Show, don't tell. Dùng hành động để bộc lộ tính cách/cảm xúc.
           3. Chỉ viết nội dung truyện thuần túy (văn xuôi). TUYỆT ĐỐI KHÔNG chèn lời dẫn MC/Radio.
           4. Độ dài: 600-800 từ.`
        : `${genreIntro} Write chapter "${item.title}" for "${bookTitle}".
           ${characterContext}
           ${ideaContext}
           Goal: "${item.focus}". Plot points: ${item.actions.join(', ')}.
           
           WRITING RULES:
           1. ${styleInstruction}
           2. Show, don't tell.
           3. PURE STORY CONTENT ONLY.
           4. Length: 600-800 words.`;
    
    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-flash-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
    }, apiKey);
};

export const rewriteStoryBlock = async (
    originalContent: string, 
    feedback: string, 
    metadata: StoryMetadata | undefined, 
    language: Language, 
    model: string = 'gemini-3-flash-preview', 
    apiKey?: string
): Promise<string> => {
    const isVi = language === 'vi';
    const characterContext = metadata ? (isVi
        ? `Giữ đúng tên: ${metadata.label1}: ${metadata.char1}, ${metadata.label2}: ${metadata.char2}, ${metadata.label3}: ${metadata.char3}.`
        : `Keep names: ${metadata.char1}, ${metadata.char2}, ${metadata.char3}.`) : "";

    const prompt = isVi
        ? `Bạn là một biên tập viên xuất sắc. Nhiệm vụ: Viết lại đoạn văn dưới đây dựa trên yêu cầu sửa đổi.
           
           VĂN BẢN GỐC:
           "${originalContent}"

           YÊU CẦU SỬA ĐỔI (FEEDBACK):
           "${feedback}"

           YÊU CẦU:
           1. Thay đổi nội dung/văn phong theo đúng feedback.
           2. Giữ nguyên bối cảnh/mạch truyện chính nếu không bị yêu cầu đổi.
           3. ${characterContext}
           4. Chỉ trả về nội dung truyện mới.`
        : `Rewrite text based on feedback.

           ORIGINAL:
           "${originalContent}"

           FEEDBACK:
           "${feedback}"

           REQUIREMENTS:
           1. Apply feedback strictly.
           2. ${characterContext}
           3. Return ONLY new story text.`;

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

export const evaluateStory = async (
    fullStoryText: string,
    mode: 'romance' | 'general',
    bookTitle: string,
    model: string = 'gemini-3-pro-preview',
    apiKey?: string
): Promise<string> => {
    // Simple pass-through for brevity as the logic is identical to previous version, just re-declaring for context
    const criteria = mode === 'romance' 
        ? `## ✅ TIÊU CHÍ NGÔN TÌNH\n1. Hook & Lời hứa (0-10)\n2. Chemistry CP (0-10)\n3. Tiến trình cảm xúc (0-10)\n4. Logic bối cảnh (0-10)\n5. Cao trào & Điểm sảng (0-10)\n6. Văn phong (0-10)`
        : `## ✅ TIÊU CHÍ KỊCH BẢN CHUNG\n1. Kết cấu & Mạch (0-10)\n2. Độ chính xác/Logic (0-10)\n3. Giọng văn & Phong cách (0-10)\n4. Ý tưởng & Chiều sâu (0-10)\n5. Nhịp điệu & Hình ảnh (0-10)`;

    const systemInstruction = "Bạn là chuyên gia thẩm định tiểu thuyết.";

    const prompt = `
    ${systemInstruction}
    Đánh giá tác phẩm "${bookTitle}".
    NỘI DUNG:
    """
    ${fullStoryText}
    """
    TIÊU CHÍ:
    ${criteria}

    YÊU CẦU: Trả về Markdown. Chấm điểm chi tiết. Nhận xét thẳng thắn.`;

    return executeGenAIRequest(async (ai) => {
        const response = await ai.models.generateContent({
            model: model.includes('gpt') ? 'gemini-3-pro-preview' : model,
            contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text;
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
