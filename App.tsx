
import React, { useEffect, useMemo, useState, useRef } from "react";
import { OutlineItem, ScriptBlock, StoryBlock, SEOResult, LoadingStates, Language, SavedSession, StoryMetadata, StoryMode } from './types';
import * as geminiService from './services/geminiService';
import { Card, Empty, LoadingOverlay, Modal, Toast, Tooltip } from './components/ui';

// ... (KEEP THEME_PRESETS and AVAILABLE_MODELS as they are in the previous response)
// Re-declaring for clarity in this partial update context, but in real code, keep the existing lists.
type ThemeColor = 'sky' | 'rose' | 'violet' | 'amber' | 'emerald' | 'cyan' | 'orange' | 'fuchsia' | 'indigo' | 'teal' | 'lime' | 'pink';

const THEME_PRESETS: Record<ThemeColor, { name: string; labelEn: string; hex: string; bgGradient: string }> = {
  sky: { 
    name: 'Xanh Dương', labelEn: 'Blue', hex: '#0ea5e9', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#082f49_0%,#020617_60%,#000000_100%)]" 
  },
  emerald: { 
    name: 'Xanh Lá', labelEn: 'Green', hex: '#10b981', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#022c22_0%,#020617_60%,#000000_100%)]" 
  },
  rose: { 
    name: 'Đỏ', labelEn: 'Red', hex: '#f43f5e', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#4c0519_0%,#020617_60%,#000000_100%)]" 
  },
  violet: { 
    name: 'Tím', labelEn: 'Purple', hex: '#8b5cf6', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#2e1065_0%,#020617_60%,#000000_100%)]" 
  },
  amber: { 
    name: 'Vàng', labelEn: 'Gold', hex: '#f59e0b', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#451a03_0%,#020617_60%,#000000_100%)]" 
  },
  cyan: { 
    name: 'Lam', labelEn: 'Cyan', hex: '#06b6d4', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#164e63_0%,#020617_60%,#000000_100%)]" 
  },
  orange: { 
    name: 'Cam', labelEn: 'Orange', hex: '#f97316', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#431407_0%,#020617_60%,#000000_100%)]" 
  },
  fuchsia: { 
    name: 'Hồng Tím', labelEn: 'Fuchsia', hex: '#d946ef', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#4a044e_0%,#020617_60%,#000000_100%)]" 
  },
  indigo: { 
    name: 'Chàm', labelEn: 'Indigo', hex: '#6366f1', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#1e1b4b_0%,#020617_60%,#000000_100%)]" 
  },
  teal: { 
    name: 'Xanh Mòng Két', labelEn: 'Teal', hex: '#14b8a6', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#134e4a_0%,#020617_60%,#000000_100%)]" 
  },
  lime: { 
    name: 'Xanh Chuối', labelEn: 'Lime', hex: '#84cc16', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#365314_0%,#020617_60%,#000000_100%)]" 
  },
  pink: { 
    name: 'Hồng', labelEn: 'Pink', hex: '#ec4899', 
    bgGradient: "bg-[radial-gradient(1200px_700px_at_50%_0%,#500724_0%,#020617_60%,#000000_100%)]" 
  },
};

const AVAILABLE_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', desc: 'Trí thông minh phục vụ nghiên cứu sâu', group: 'Pro' },
  { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', desc: 'Suy nghĩ lâu hơn để cho câu trả lời tốt hơn (Recommended)', group: 'Thinking' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', desc: 'Tốc độ nhanh, phản hồi tức thì', group: 'Instant' },
  { id: 'gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', desc: 'Mô hình Pro thế hệ 2.5 cân bằng', group: 'Pro' },
  { id: 'gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', desc: 'Mô hình Flash thế hệ 2.5 nhanh và rẻ', group: 'Instant' },
  { id: 'gpt-5.2-auto', name: 'GPT-5.2 Auto', desc: 'Quyết định thời gian suy nghĩ (GPT-4o)', group: 'Auto' },
  { id: 'gpt-5.2-instant', name: 'GPT-5.2 Instant', desc: 'Trả lời ngay lập tức (GPT-4o Mini)', group: 'Instant' },
  { id: 'gpt-5.2-thinking', name: 'GPT-5.2 Thinking', desc: 'Suy nghĩ lâu hơn (o1-preview hoặc GPT-4o CoT)', group: 'Thinking' },
  { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', desc: 'Trí thông minh phục vụ nghiên cứu (GPT-4o)', group: 'Pro' },
];

const getThemeStyles = (color: ThemeColor) => {
  const preset = THEME_PRESETS[color];
  const getGradientTo = () => {
      switch(color) {
          case 'sky': return 'blue-500';
          case 'emerald': return 'teal-500';
          case 'rose': return 'red-500';
          case 'violet': return 'purple-500';
          case 'amber': return 'yellow-500';
          case 'cyan': return 'blue-400';
          case 'orange': return 'red-500';
          case 'fuchsia': return 'pink-500';
          case 'indigo': return 'blue-600';
          case 'teal': return 'emerald-500';
          case 'lime': return 'green-500';
          case 'pink': return 'rose-500';
          default: return 'blue-500';
      }
  };

  return {
    bg: preset.bgGradient,
    textMain: `text-${color}-50`,
    textAccent: `text-${color}-300`,
    textHighlight: `text-${color}-100`,
    border: `border-${color}-900`,
    borderLight: `border-${color}-800`,
    bgCard: "bg-slate-950",
    bgButton: `bg-${color}-900/40`,
    bgButtonHover: `hover:bg-${color}-900/60`,
    ring: `ring-${color}-500`,
    gradientTitle: `from-${color}-400 to-${getGradientTo()}`,
    iconColor: `text-${color}-300`,
    buttonPrimary: `bg-${color}-700/50 hover:bg-${color}-600/50`,
    subtleBg: `bg-${color}-900/20`,
    badge: `bg-${color}-600 shadow-[0_0_10px_rgba(var(--color-${color}-500),0.5)]`
  };
};

const GENRES_ROMANCE = [
  "Tự động (AI tự do sáng tác)",
  "Hiện đại (Đô thị, Tổng tài)", "Cổ đại (Cung đấu, Gia đấu)", "Dân Quốc", "Xuyên không", "Trọng sinh (Báo thù)", "Điền văn (Làm ruộng)", 
  "Ngọt sủng (Sweet)", "Ngược tâm (Angst)", "Sảng văn (Face-slapping)", "Cẩu huyết (Drama)", "Huyền huyễn (Fantasy Romance)"
];

const GENRES_NON_ROMANCE = [
  "Tự động (AI tự do sáng tác)",
  "Tiên hiệp / Tu tiên", "Huyền huyễn (Fantasy)", "Võ hiệp / Kiếm hiệp", "Khoa huyễn (Sci-Fi / Cyberpunk)", "Mạt thế (Zombie / Sinh tồn)",
  "Trinh thám / Hình sự", "Kinh dị / Linh dị", "Lịch sử / Quân sự", "Đô thị (Sự nghiệp / Thương chiến)", "Võng du (Game)"
];

const INITIAL_LOADING_STATES: LoadingStates = {
  outline: false,
  story: false,
  seo: false,
  script: false,
  prompts: false,
  evaluation: false,
};

export default function App() {
  const [language, setLanguage] = useState<Language>('vi'); 
  const [themeColor, setThemeColor] = useState<ThemeColor>('sky');
  
  // -- Content State --
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookIdea, setBookIdea] = useState("");
  const [bookImage, setBookImage] = useState<string | null>(null);

  // -- NEW MODE STATE --
  const [storyMode, setStoryMode] = useState<StoryMode>('romance');
  const [storyGenre, setStoryGenre] = useState<string>(GENRES_ROMANCE[0]);
  
  // -- Config State --
  const [channelNameVi, setChannelNameVi] = useState("");
  const [mcNameVi, setMcNameVi] = useState("");
  const [channelNameEn, setChannelNameEn] = useState("");
  const [mcNameEn, setMcNameEn] = useState("");

  const [frameRatio, setFrameRatio] = useState("16:9"); 
  const [durationMin, setDurationMin] = useState(240);
  const [isAutoDuration, setIsAutoDuration] = useState(false);
  
  const calculatedChapters = useMemo(() => {
     if (isAutoDuration) return 18; 
     return Math.max(3, Math.ceil(durationMin / 2.5));
  }, [durationMin, isAutoDuration]);

  // DEFAULT MODEL CHANGED TO GEMINI 3 PRO PREVIEW
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  // -- Modals --
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'strengths' | 'guide'>('strengths');
  const [isExtraConfigModalOpen, setIsExtraConfigModalOpen] = useState(false);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  
  // -- Rewrite Modal State --
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [rewriteFeedback, setRewriteFeedback] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteScope, setRewriteScope] = useState<'single' | 'all'>('single');
  const [rewriteProgress, setRewriteProgress] = useState<{current: number, total: number} | null>(null);
  const [rewrittenIndices, setRewrittenIndices] = useState<Set<number>>(new Set());

  // -- Evaluation State --
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);

  // -- API Keys --
  const [apiKeyGemini, setApiKeyGemini] = useState("");
  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("");

  // -- Output Data --
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [storyMetadata, setStoryMetadata] = useState<StoryMetadata | undefined>(undefined);
  const [storyBlocks, setStoryBlocks] = useState<StoryBlock[]>([]);
  const [seo, setSeo] = useState<SEOResult | null>(null);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<string[]>([]);
  const [thumbTextIdeas, setThumbTextIdeas] = useState<string[]>([]);

  const [loading, setLoading] = useState<LoadingStates>(INITIAL_LOADING_STATES);
  const [progressText, setProgressText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  const [isStoryUploaded, setIsStoryUploaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  const isGlobalLoading = Object.values(loading).some(Boolean) || isRewriting;
  const theme = useMemo(() => getThemeStyles(themeColor), [themeColor]);
  
  const totalCharsTargetStr = useMemo(() => {
      if (isAutoDuration) return "40,000 - 60,000";
      return (durationMin * 1000).toLocaleString(language === 'vi' ? "vi-VN" : "en-US");
  }, [durationMin, isAutoDuration, language]);
  
  const currentChannelName = language === 'vi' ? channelNameVi : channelNameEn;
  const currentMcName = language === 'vi' ? mcNameVi : mcNameEn;

  const currentModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // (Helper function unchanged)
  const handleModeChange = (mode: StoryMode) => {
    setStoryMode(mode);
    setStoryGenre(mode === 'romance' ? GENRES_ROMANCE[0] : GENRES_NON_ROMANCE[0]);
  };

  // ... (useEffect for initial load and auto-save remain unchanged) ...
  useEffect(() => {
    // API Keys
    const storedGeminiKey = localStorage.getItem("nd_gemini_api_key");
    const storedOpenAIKey = localStorage.getItem("nd_openai_api_key");
    const storedModel = localStorage.getItem("nd_selected_model");

    if (storedGeminiKey) setApiKeyGemini(storedGeminiKey);
    if (storedOpenAIKey) setApiKeyOpenAI(storedOpenAIKey);
    if (storedModel && AVAILABLE_MODELS.some(m => m.id === storedModel)) setSelectedModel(storedModel);
    
    // Theme
    const storedTheme = localStorage.getItem("nd_theme_color");
    if (storedTheme && THEME_PRESETS[storedTheme as ThemeColor]) {
      setThemeColor(storedTheme as ThemeColor);
    }

    // Configs
    const storedChannelVi = localStorage.getItem("nd_channel_name_vi");
    const storedMcVi = localStorage.getItem("nd_mc_name_vi");
    if (storedChannelVi) setChannelNameVi(storedChannelVi);
    if (storedMcVi) setMcNameVi(storedMcVi);

    const storedChannelEn = localStorage.getItem("nd_channel_name_en");
    const storedMcEn = localStorage.getItem("nd_mc_name_en");
    if (storedChannelEn) setChannelNameEn(storedChannelEn);
    if (storedMcEn) setMcNameEn(storedMcEn);
    
    // Load Sessions
    try {
        const storedSessions = localStorage.getItem("nd_sessions");
        if (storedSessions) {
            setSessions(JSON.parse(storedSessions));
        }
    } catch (e) { console.error("Error loading sessions", e); }
  }, []);

  const handleSaveKeys = () => {
    const trimmedGemini = apiKeyGemini.split('\n').map(k => k.trim()).filter(k => k).join('\n');
    // Ensure OpenAI keys are also newline separated and trimmed properly for multi-key support
    const trimmedOpenAI = apiKeyOpenAI.split('\n').map(k => k.trim()).filter(k => k).join('\n');

    setApiKeyGemini(trimmedGemini);
    setApiKeyOpenAI(trimmedOpenAI);
    
    localStorage.setItem("nd_gemini_api_key", trimmedGemini);
    localStorage.setItem("nd_openai_api_key", trimmedOpenAI);
    localStorage.setItem("nd_selected_model", selectedModel);

    setIsApiModalOpen(false);
    setToastMessage("Đã lưu API Key & Cấu hình Model.");
  };

  // ... (Other handlers unchanged) ...
  const handleSaveExtraConfig = () => {
    localStorage.setItem("nd_channel_name_vi", channelNameVi);
    localStorage.setItem("nd_mc_name_vi", mcNameVi);
    localStorage.setItem("nd_channel_name_en", channelNameEn);
    localStorage.setItem("nd_mc_name_en", mcNameEn);
    setIsExtraConfigModalOpen(false);
  };
  
  const handleSelectTheme = (color: ThemeColor) => {
    setThemeColor(color);
    localStorage.setItem("nd_theme_color", color);
    setIsThemeDropdownOpen(false);
  };

  const toggleLanguage = () => {
    setLanguage(prev => {
        const newLang = prev === 'vi' ? 'en' : 'vi';
        const allColors = Object.keys(THEME_PRESETS) as ThemeColor[];
        const availableColors = allColors.filter(c => c !== themeColor);
        const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
        setThemeColor(randomColor);
        localStorage.setItem("nd_theme_color", randomColor);
        return newLang;
    });
  };

  // ... (Session save handlers unchanged) ...
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bookTitle) return; // Don't save empty sessions
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        const currentId = sessionId || crypto.randomUUID();
        if (!sessionId) setSessionId(currentId);
        const newSession: SavedSession = {
            id: currentId,
            lastModified: Date.now(),
            bookTitle, language, storyMode, genre: storyGenre, bookIdea, bookImage, durationMin, isAutoDuration,
            chaptersCount: calculatedChapters, frameRatio, storyMetadata, outline, storyBlocks, scriptBlocks, seo,
            videoPrompts, thumbTextIdeas, evaluationResult,
        };
        setSessions(prev => {
            const filtered = prev.filter(s => s.id !== currentId);
            const updated = [newSession, ...filtered];
            localStorage.setItem("nd_sessions", JSON.stringify(updated));
            return updated;
        });
    }, 2000); 
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [bookTitle, bookIdea, bookImage, durationMin, isAutoDuration, calculatedChapters, frameRatio, outline, storyMetadata, storyBlocks, scriptBlocks, seo, videoPrompts, thumbTextIdeas, language, sessionId, evaluationResult, storyMode, storyGenre]);

  const saveSessionImmediate = (overrides?: Partial<SavedSession>) => {
      const currentId = sessionId || crypto.randomUUID();
      if (!sessionId) setSessionId(currentId);
      const newSession: SavedSession = {
          id: currentId,
          lastModified: Date.now(),
          bookTitle, language, storyMode, genre: storyGenre, bookIdea, bookImage, durationMin, isAutoDuration,
          chaptersCount: calculatedChapters, frameRatio, storyMetadata, outline, storyBlocks, scriptBlocks, seo,
          videoPrompts, thumbTextIdeas, evaluationResult, ...overrides
      };
      setSessions(prev => {
          const filtered = prev.filter(s => s.id !== currentId);
          const updated = [newSession, ...filtered];
          localStorage.setItem("nd_sessions", JSON.stringify(updated));
          return updated;
      });
  };

  const handleLoadSession = (s: SavedSession) => {
      setSessionId(s.id); setBookTitle(s.bookTitle); setLanguage(s.language);
      setStoryMode(s.storyMode || 'romance'); setStoryGenre(s.genre || (s.storyMode === 'non-romance' ? GENRES_NON_ROMANCE[0] : GENRES_ROMANCE[0]));
      setBookIdea(s.bookIdea); setBookImage(s.bookImage); setDurationMin(s.durationMin); setIsAutoDuration(!!s.isAutoDuration);
      setFrameRatio(s.frameRatio || "16:9"); setStoryMetadata(s.storyMetadata); setOutline(s.outline || []);
      setStoryBlocks(s.storyBlocks || []); setScriptBlocks(s.scriptBlocks || []); setSeo(s.seo);
      setVideoPrompts(s.videoPrompts || []); setThumbTextIdeas(s.thumbTextIdeas || []); setRewrittenIndices(new Set()); 
      setEvaluationResult(s.evaluationResult || null);
      setIsLibraryModalOpen(false); setToastMessage(`Đã tải lại phiên làm việc: "${s.bookTitle}"`);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Bạn có chắc chắn muốn xóa phiên làm việc này?")) {
          const updated = sessions.filter(s => s.id !== id);
          setSessions(updated);
          localStorage.setItem("nd_sessions", JSON.stringify(updated));
          if (sessionId === id) setSessionId(null);
      }
  };

  const createNewSession = () => {
      setSessionId(null); setBookTitle(""); setBookIdea(""); setOutline([]); setStoryMetadata(undefined);
      setStoryBlocks([]); setScriptBlocks([]); setSeo(null); setVideoPrompts([]); setThumbTextIdeas([]);
      setIsAutoDuration(false); setRewrittenIndices(new Set()); setEvaluationResult(null); 
      setStoryMode('romance'); setStoryGenre(GENRES_ROMANCE[0]); setToastMessage("Đã tạo phiên làm việc mới.");
  }
  
  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    setBookTitle(fileName);
    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
            // Updated to use Smart Split by Chapters/Parts regex
            const chapters = geminiService.splitStoryByChapters(text);
            
            // If the smart split failed to find distinct chapters (e.g. just one big block) 
            // AND the text is very long, fall back to chunking.
            // Otherwise, use the smart split results.
            let newBlocks: StoryBlock[] = [];
            
            if (chapters.length === 1 && chapters[0].content.length > 10000) {
                 const chunks = geminiService.chunkText(text, 3000);
                 newBlocks = chunks.map((chunk, idx) => ({
                    index: idx + 1, 
                    title: `${language === 'vi' ? 'Phần' : 'Part'} ${idx + 1} (Upload)`, 
                    content: chunk
                }));
            } else {
                newBlocks = chapters.map((chap, idx) => ({
                    index: idx + 1,
                    title: chap.title,
                    content: chap.content
                }));
            }

            setStoryBlocks(newBlocks); setOutline([]); setStoryMetadata(undefined); setScriptBlocks([]); 
            setRewrittenIndices(new Set()); setIsStoryUploaded(true); setToastMessage(`Đã upload truyện "${fileName}" thành công.`);
            e.target.value = ''; 
        }
    };
    reader.readAsText(file);
  };

  const withErrorHandling = <T extends any[], R>(fn: (...args: T) => Promise<R>, key: keyof LoadingStates) => {
    return async (...args: T): Promise<R | void> => {
      if (!bookTitle) {
        setError("Vui lòng nhập tên sách trước.");
        return;
      }
      
      setError(null);
      setLoading(prev => ({ ...prev, [key]: true }));
      setProgressText(""); 
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`Error in ${key}:`, err);
        setError(`Lỗi khi tạo ${key}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
        setProgressText("");
      }
    };
  };

  // --- UPDATED HANDLERS WITH KEY OBJECT ---

  const handleGenerateOutline = withErrorHandling(async () => {
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };
    const result = await geminiService.generateOutline(
        bookTitle, bookIdea, currentChannelName, currentMcName, calculatedChapters, durationMin, 
        language, storyMode, storyGenre, isAutoDuration, selectedModel, keys
    );
    const indexedChapters = result.chapters.map((item, index) => ({ ...item, index }));
    setOutline(indexedChapters);
    setStoryMetadata(result.metadata);
    setStoryBlocks([]);
    setScriptBlocks([]);
    setRewrittenIndices(new Set());
    setIsStoryUploaded(false);
  }, 'outline');

  const handleGenerateStory = withErrorHandling(async () => {
    if (outline.length === 0) {
        setError("Cần có Kịch bản khung (outline) trước khi viết truyện.");
        setLoading(prev => ({ ...prev, story: false }));
        return;
    }
    const defaultMeta: StoryMetadata = storyMode === 'romance' 
        ? { char1: "Nữ chính", char2: "Nam chính", char3: "Phản diện", label1: "Nữ chính", label2: "Nam chính", label3: "Phản diện" }
        : { char1: "Nhân vật chính", char2: "Đồng minh", char3: "Đối thủ", label1: "NV Chính", label2: "Đồng minh", label3: "Đối thủ" };

    const safeMetadata = storyMetadata || defaultMeta;
    setStoryBlocks([]); setRewrittenIndices(new Set()); 
    const runningBlocks: StoryBlock[] = [];
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };

    for (let i = 0; i < outline.length; i++) {
        const item = outline[i];
        setProgressText(`Đang viết chương ${i + 1}/${outline.length}...`);
        
        const content = await geminiService.generateStoryBlock(
            item, safeMetadata, bookTitle, bookIdea, language, storyMode, storyGenre, selectedModel, keys
        );
        
        const newBlock = { index: item.index, title: item.title, content: content };
        runningBlocks.push(newBlock);
        setStoryBlocks([...runningBlocks]);
    }
  }, 'story');

  const handleGenerateReviewScript = withErrorHandling(async () => {
    if (storyBlocks.length === 0) {
        setError("Chưa có nội dung truyện.");
        setLoading(prev => ({ ...prev, script: false }));
        return;
    }
    setScriptBlocks([]);
    const runningScripts: ScriptBlock[] = [];
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };

    for (let i = 0; i < storyBlocks.length; i++) {
      const block = storyBlocks[i];
      setProgressText(`Đang tạo kịch bản review ${i + 1}/${storyBlocks.length}...`);
      const text = await geminiService.generateReviewBlock(
          block.content, block.title, bookTitle, currentChannelName, currentMcName, language, selectedModel, keys
      );
      const newBlock: ScriptBlock = { index: block.index, chapter: block.title, text: text, chars: text.length };
      runningScripts.push(newBlock);
      setScriptBlocks([...runningScripts]);
    }
  }, 'script');

  const handleGenerateSEO = withErrorHandling(async () => {
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };
    const result = await geminiService.generateSEO(
        bookTitle, currentChannelName, durationMin, language, selectedModel, keys
    );
    setSeo(result);
  }, 'seo');
  
  const handleGeneratePrompts = withErrorHandling(async () => {
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };
    const [prompts, thumbs] = await Promise.all([
      geminiService.generateVideoPrompts(bookTitle, frameRatio, language, selectedModel, keys),
      geminiService.generateThumbIdeas(bookTitle, durationMin, language, selectedModel, keys)
    ]);
    setVideoPrompts(prompts);
    setThumbTextIdeas(thumbs);
  }, 'prompts');

  const handleEvaluateStory = withErrorHandling(async (mode: 'romance' | 'general') => {
      if (storyBlocks.length === 0) throw new Error("Chưa có nội dung truyện để đánh giá.");
      const fullText = storyBlocks.map(b => `### ${b.title}\n${b.content}`).join("\n\n");
      const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };
      const result = await geminiService.evaluateStory(fullText, mode, bookTitle, selectedModel, keys);
      setEvaluationResult(result);
      saveSessionImmediate({ evaluationResult: result });
      setToastMessage("Đã hoàn tất đánh giá và lưu vào thư viện.");
  }, 'evaluation');

  // ... (Rewrite logic similar, just pass keys)
  const openRewriteModal = (index: number) => { setRewriteScope('single'); setEditingBlockIndex(index); setRewriteFeedback(""); setIsRewriteModalOpen(true); };
  const openRewriteAllModal = () => { setRewriteScope('all'); setEditingBlockIndex(null); setRewriteFeedback(""); setIsRewriteModalOpen(true); };
  const handleRewriteFromEvaluation = () => {
     if (!evaluationResult) return;
     let cleanedResult = evaluationResult;
     const markers = ["BẢNG ĐÁNH GIÁ", "TIÊU CHÍ", "## 1", "### 1"];
     let cutIndex = -1;
     for (const marker of markers) { const idx = cleanedResult.toUpperCase().indexOf(marker); if (idx !== -1) { cutIndex = idx; break; } }
     if (cutIndex === -1) { const headerIdx = cleanedResult.indexOf("## "); if (headerIdx !== -1) cutIndex = headerIdx; }
     if (cutIndex !== -1) cleanedResult = cleanedResult.substring(cutIndex);
     setRewriteFeedback(`Dựa trên kết quả đánh giá dưới đây, hãy viết lại toàn bộ truyện để khắc phục các điểm yếu:\n\n${cleanedResult}`);
     setRewriteScope('all'); setEditingBlockIndex(null); setIsEvaluationModalOpen(false); setIsRewriteModalOpen(true); 
  };
  const openEvaluationModal = () => setIsEvaluationModalOpen(true);

  const handleRewriteSubmit = async () => {
    if (!rewriteFeedback.trim()) return;
    setIsRewriteModalOpen(false); setIsRewriting(true); setToastMessage("Đang tiến hành viết lại nội dung..."); setError(null);
    const keys = { google: apiKeyGemini, openai: apiKeyOpenAI };

    try {
        if (rewriteScope === 'single' && editingBlockIndex !== null) {
            const originalBlock = storyBlocks[editingBlockIndex];
            const newContent = await geminiService.rewriteStoryBlock(
                originalBlock.content, rewriteFeedback, storyMetadata, language, selectedModel, keys
            );
            setStoryBlocks(prev => {
                const updated = [...prev]; updated[editingBlockIndex] = { ...updated[editingBlockIndex], content: newContent };
                saveSessionImmediate({ storyBlocks: updated }); return updated;
            });
            setRewrittenIndices(prev => new Set(prev).add(editingBlockIndex));
            setToastMessage("Đã viết lại đoạn truyện thành công!");
        } else if (rewriteScope === 'all') {
             setRewriteProgress({ current: 0, total: storyBlocks.length }); setRewrittenIndices(new Set()); 
             const runningBlocks = [...storyBlocks];
             for (let i = 0; i < storyBlocks.length; i++) {
                 try {
                    const block = storyBlocks[i];
                    setProgressText(`Đang sửa chương ${i + 1}/${storyBlocks.length}...`);
                    const newContent = await geminiService.rewriteStoryBlock(
                        block.content, rewriteFeedback, storyMetadata, language, selectedModel, keys
                    );
                    runningBlocks[i] = { ...runningBlocks[i], content: newContent };
                    setStoryBlocks([...runningBlocks]);
                    saveSessionImmediate({ storyBlocks: runningBlocks });
                    setRewrittenIndices(prev => new Set(prev).add(i));
                    setRewriteProgress({ current: i + 1, total: storyBlocks.length });
                 } catch (e) { console.error(`Error rewriting block ${i}`, e); }
             }
             setToastMessage("Đã hoàn tất viết lại toàn bộ truyện.");
             setRewriteProgress(null);
        }
    } catch (err) {
        console.error("Rewrite error", err);
        setError(`Lỗi khi viết lại: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setIsRewriting(false); setProgressText(""); }
  };

  // ... (Helper functions for download CSV/TXT and ThemedButton remain the same) ...
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const downloadCSV = (filename: string, rows: (string[])[]) => {
    const processRow = (row: string[]) => row.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(",");
    const csvContent = "\uFEFF" + rows.map(processRow).join("\r\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  };
  const downloadTXT = (filename: string, content: string) => {
      const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8;' }));
      link.download = filename; link.click(); URL.revokeObjectURL(link.href);
  };

  const exportScriptCSV = () => { if (!scriptBlocks.length) return; const rows = [["STT", "Chương", "Review Script"], ...scriptBlocks.map(b => [String(b.index), b.chapter, b.text])]; downloadCSV(`review_${geminiService.slugify(bookTitle)}.csv`, rows); };
  const exportScriptTXT = () => { if (!scriptBlocks.length) return; const content = scriptBlocks.map(b => `${b.chapter.toUpperCase()} [${b.chars} chars]\n\n${b.text}`).join("\n\n" + "-".repeat(40) + "\n\n"); downloadTXT(`review_${geminiService.slugify(bookTitle)}.txt`, content); };
  const exportStoryCSV = () => { if (!storyBlocks.length) return; const rows = [["STT", "Chương", "Nội dung Truyện"], ...storyBlocks.map(b => [String(b.index), b.title, b.content])]; downloadCSV(`truyen_${geminiService.slugify(bookTitle)}.csv`, rows); };
  const exportStoryTXT = () => { if (!storyBlocks.length) return; const content = storyBlocks.map(b => `${b.title.toUpperCase()}\n\n${b.content}`).join("\n\n" + "-".repeat(40) + "\n\n"); downloadTXT(`truyen_${geminiService.slugify(bookTitle)}.txt`, content); };
  const exportPromptCSV = () => { if (!videoPrompts.length) return; const rows = [["STT", "Prompt"], ...videoPrompts.map((p, i) => [String(i + 1), p])]; downloadCSV(`prompts_${geminiService.slugify(bookTitle)}.csv`, rows); };

  const ThemedButton: React.FC<{ children: React.ReactNode, onClick: () => void, disabled?: boolean, className?: string, title?: string }> = ({ children, onClick, disabled, className, title }) => (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border ${theme.borderLight} ${theme.bgButton} px-3 py-2 text-sm font-semibold transition ${theme.bgButtonHover} disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      onClick={onClick} disabled={disabled} title={title}
    >
      {children}
    </button>
  );

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-500 ${theme.bg} ${theme.textMain}`}>
        <header className={`px-6 py-8 border-b ${theme.border} sticky top-0 backdrop-blur bg-black/30 z-20`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="group transition-transform hover:scale-105 ml-4" onClick={(e) => { e.preventDefault(); createNewSession(); }}>
            <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${theme.gradientTitle}`}>
              AI Content Tool
            </h1>
          </a>
          
          <div className="flex items-center gap-3">
              <button
                onClick={toggleLanguage}
                className={`relative w-16 h-8 rounded-full border ${theme.borderLight} ${theme.bgCard} flex items-center transition-all hover:opacity-90 shadow-inner`}
                title="Click để đổi ngôn ngữ / Click to switch language"
              >
                  <span className={`absolute left-2 text-[9px] font-bold ${language === 'vi' ? 'opacity-0' : 'opacity-60 text-slate-400'}`}>VN</span>
                  <span className={`absolute right-2 text-[9px] font-bold ${language === 'en' ? 'opacity-0' : 'opacity-60 text-slate-400'}`}>US</span>
                  <div className={`absolute left-1 w-6 h-6 rounded-full shadow-lg flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300 transform ${
                      language === 'en' ? 'translate-x-8' : 'translate-x-0'
                  } ${language === 'vi' ? 'bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.6)]' : 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.6)]'}`}>
                    {language === 'vi' ? 'VN' : 'US'}
                  </div>
              </button>
              
               <div className="relative">
                 <button 
                  onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
                  title="Đổi giao diện / Change Theme"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                </button>
                {isThemeDropdownOpen && (
                  <div className={`absolute top-full right-0 mt-2 w-48 rounded-xl border ${theme.borderLight} bg-slate-900 shadow-2xl z-50 overflow-hidden`}>
                     <div className="p-1 max-h-80 overflow-y-auto space-y-1">
                        {(Object.keys(THEME_PRESETS) as ThemeColor[]).map((color) => {
                            const preset = THEME_PRESETS[color];
                            const isSelected = themeColor === color;
                            return (
                                <button
                                    key={color}
                                    onClick={() => handleSelectTheme(color)}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition ${isSelected ? `${theme.bgButton} text-white` : 'text-slate-300 hover:bg-slate-800'}`}
                                >
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.hex }}></div>
                                    <span className="flex-1">{preset.name}</span>
                                    {isSelected && <svg className="w-3 h-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                </button>
                            );
                        })}
                     </div>
                  </div>
                )}
               </div>

              <button 
                onClick={() => setIsLibraryModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg relative`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>Thư viện</span>
                {sessions.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">{sessions.length}</span>}
              </button>

              <button 
                onClick={() => setIsApiModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
              >
                <span className={`w-2 h-2 rounded-full ${apiKeyGemini ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                <span>API</span>
              </button>

               <button 
                onClick={() => setIsGuideModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${theme.bgCard}/80 border ${theme.borderLight} ${theme.textAccent} text-sm font-medium hover:${theme.bgButton} hover:text-white transition shadow-lg`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
              </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <Card title="1) Thông tin sách & Cài đặt">
            {/* ... (CONTENT INSIDE CARD REMAINS SAME) ... */}
            <div className="space-y-4">
               <div className={`p-3 rounded-lg border ${theme.borderLight} bg-slate-900/40 space-y-3`}>
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 relative">
                     <div 
                        className={`absolute top-1 bottom-1 w-[50%] rounded transition-all duration-300 ${theme.bgButton} border border-white/10`}
                        style={{ left: storyMode === 'romance' ? '4px' : 'calc(50% - 4px)' }}
                     ></div>
                     <button 
                        onClick={() => handleModeChange('romance')}
                        className={`flex-1 relative z-10 text-xs font-bold py-1.5 text-center transition-colors ${storyMode === 'romance' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                        NGÔN TÌNH (Romance)
                     </button>
                     <button 
                        onClick={() => handleModeChange('non-romance')}
                        className={`flex-1 relative z-10 text-xs font-bold py-1.5 text-center transition-colors ${storyMode === 'non-romance' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                        PHI NGÔN TÌNH
                     </button>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>
                      Thể loại cụ thể (Phong cách viết sẽ thay đổi theo)
                    </label>
                    <select 
                        value={storyGenre} 
                        onChange={(e) => setStoryGenre(e.target.value)}
                        className={`w-full rounded bg-slate-950 border ${theme.border} text-sm text-slate-200 px-3 py-2 outline-none focus:ring-1 ${theme.ring}`}
                    >
                        {(storyMode === 'romance' ? GENRES_ROMANCE : GENRES_NON_ROMANCE).map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                  </div>
               </div>

              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                  Tên sách / Chủ đề
                  <Tooltip text="Nhập tên sách, chủ đề hoặc từ khóa chính. AI sẽ phát triển nội dung dựa trên thông tin này." />
                </label>
                <input value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} placeholder="Nhập tên sách hoặc chủ đề..." className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none transition-colors`} />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                  Ý tưởng / Bối cảnh (Tùy chọn)
                  <Tooltip text="Cung cấp thêm ngữ cảnh, phong cách kể chuyện (vd: hài hước, kinh dị) hoặc ý đồ riêng để AI hiểu rõ hơn." />
                </label>
                <textarea 
                    value={bookIdea} 
                    onChange={(e) => setBookIdea(e.target.value)} 
                    placeholder="Mô tả ý tưởng, bối cảnh, hoặc phong cách bạn muốn..." 
                    className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 focus:ring-2 ${theme.ring} outline-none min-h-[80px] text-sm transition-colors`} 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                    <label className={`block text-sm font-medium ${theme.textAccent} flex items-center`}>
                      Upload Truyện (để Review hoặc Viết lại)
                      <Tooltip text="Nếu bạn đã có sẵn nội dung truyện (file .txt), hãy tải lên đây. Bạn có thể dùng tính năng 'Sửa' để yêu cầu AI viết lại." />
                    </label>
                    <span className="text-[10px] opacity-70 italic">.txt</span>
                </div>
                <input type="file" accept=".txt" onChange={handleStoryUpload} className={`w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-${themeColor}-800 file:text-sm file:font-semibold file:${theme.bgButton} file:${theme.textHighlight} hover:file:border-${themeColor}-400 file:transition-colors cursor-pointer`} />
              </div>

              <div className="pt-1">
                 <button onClick={() => setIsExtraConfigModalOpen(true)} className={`w-full py-2 rounded-lg ${theme.bgCard} border border-dashed ${theme.border} ${theme.textAccent} hover:${theme.bgButton} transition text-sm flex items-center justify-center gap-2`}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                   Cấu hình thêm
                 </button>
                 {(currentChannelName || currentMcName) && <div className="text-[10px] mt-1 text-center opacity-60">Đã cấu hình cho {language === 'vi' ? 'Việt Nam' : 'English (US)'}</div>}
              </div>

              <div className="space-y-3 pt-2 border-t border-dashed border-gray-800">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="autoDuration" 
                      checked={isAutoDuration} 
                      onChange={(e) => setIsAutoDuration(e.target.checked)}
                      className="accent-sky-500 w-4 h-4"
                    />
                    <label htmlFor="autoDuration" className={`text-sm font-medium ${theme.textAccent} cursor-pointer select-none`}>
                      Tự động (40-60 phút / 40-60k ký tự)
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                          Thời lượng (phút)
                          <Tooltip text="Ước lượng thời gian của video thành phẩm. AI sẽ căn chỉnh độ dài nội dung cho phù hợp." />
                        </label>
                        <input 
                          type={isAutoDuration ? "text" : "number"}
                          value={isAutoDuration ? "40-60" : durationMin} 
                          min={5} 
                          max={240} 
                          disabled={isAutoDuration}
                          onChange={(e)=>setDurationMin(clamp(parseInt(e.target.value||'0'),5,240))} 
                          className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors ${isAutoDuration ? 'opacity-50 cursor-not-allowed bg-slate-950/30' : ''}`} 
                        />
                      </div>
                      <div>
                        <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                          Số chương (Auto)
                          <Tooltip text="Số chương được tính toán tự động dựa trên thời lượng để đảm bảo độ sâu nội dung." />
                        </label>
                        <input 
                          type="text" 
                          value={isAutoDuration ? "Auto" : calculatedChapters} 
                          readOnly
                          className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 transition-colors opacity-50 cursor-not-allowed bg-slate-950/30 font-medium`} 
                        />
                      </div>
                  </div>
              </div>
              <div className={`p-3 rounded-lg ${theme.bgCard}/50 border ${theme.border} text-sm flex justify-between items-center`}>
                <div>Tổng ký tự mục tiêu: <b>{totalCharsTargetStr}</b></div>
                <Tooltip text="Số lượng ký tự ước tính dựa trên thời lượng (tốc độ đọc trung bình)." />
              </div>
            </div>
          </Card>
          
          <Card title="2) Tạo Nội Dung">
            <div className="flex flex-col space-y-2">
              <ThemedButton onClick={handleGenerateOutline} disabled={isGlobalLoading || isStoryUploaded}>Phân tích & Tạo Kịch bản khung</ThemedButton>
              <ThemedButton onClick={handleGenerateStory} disabled={isGlobalLoading || isStoryUploaded}>Viết Truyện (Theo Kịch bản khung)</ThemedButton>
              <ThemedButton onClick={handleGenerateReviewScript} disabled={isGlobalLoading}>Review Truyện (Kịch bản Audio)</ThemedButton>
              <ThemedButton onClick={handleGenerateSEO} disabled={isGlobalLoading}>Tạo Tiêu đề & Mô tả SEO</ThemedButton>
              <ThemedButton onClick={handleGeneratePrompts} disabled={isGlobalLoading}>Tạo Prompt Video & Thumbnail</ThemedButton>
              {error && <p className="text-sm text-red-400 mt-2 bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
          </Card>
        </section>

        {/* ... (RIGHT COLUMN SECTIONS UNCHANGED) ... */}
        {/* Render for Kịch bản khung, Nội dung Truyện, Review Script, SEO, Prompts remains identical */}
        <section className="lg:col-span-2 space-y-6">
          <Card title="3) Kịch bản khung" actions={
              <ThemedButton onClick={handleGenerateOutline} disabled={isGlobalLoading || isStoryUploaded} className="text-xs px-2 py-1 h-8">Tạo Kịch bản khung</ThemedButton>
          }>
            <div className="relative">
             {loading.outline && <LoadingOverlay message="Đang tạo Kịch bản khung..." />}
             {outline.length === 0 ? <Empty text="Chưa có Kịch bản khung. Nhấn ‘Phân tích & Tạo Kịch bản khung’." /> : (
              <div>
                {/* Character Metadata Display - DYNAMIC BASED ON MODE */}
                {storyMetadata && (
                   <div className={`mb-4 p-3 rounded-lg ${theme.subtleBg} border border-dashed ${theme.border} text-sm grid grid-cols-1 md:grid-cols-3 gap-2`}>
                      <div><span className="opacity-60 text-xs uppercase block">{storyMetadata.label1 || 'NV 1'}</span><span className="font-semibold text-sky-200">{storyMetadata.char1}</span></div>
                      <div><span className="opacity-60 text-xs uppercase block">{storyMetadata.label2 || 'NV 2'}</span><span className="font-semibold text-emerald-200">{storyMetadata.char2}</span></div>
                      <div><span className="opacity-60 text-xs uppercase block">{storyMetadata.label3 || 'NV 3'}</span><span className="font-semibold text-red-300">{storyMetadata.char3}</span></div>
                   </div>
                )}
                <ol className="space-y-3 list-decimal ml-5">
                  {outline.map((o) => (
                    <li key={o.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                      <div className={`font-semibold ${theme.textHighlight}`}>{o.title}</div>
                      <div className={`${theme.textAccent} text-sm mt-1`}>{o.focus}</div>
                      <ul className="mt-2 text-sm grid md:grid-cols-2 gap-2">
                        {o.actions.map((a,idx)=>(<li key={idx} className={`px-2 py-1 rounded ${theme.bgCard} border ${theme.border} opacity-80`}>• {a}</li>))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            </div>
          </Card>

          <Card title="4) Nội dung Truyện" actions={
            <div className="flex gap-2">
               {storyBlocks.length === 0 && (
                  <ThemedButton onClick={handleGenerateStory} disabled={isGlobalLoading || isStoryUploaded} className="text-xs px-2 py-1 h-8">Viết Truyện</ThemedButton>
               )}
               <ThemedButton 
                  onClick={openRewriteAllModal} 
                  disabled={isGlobalLoading || storyBlocks.length === 0} 
                  className="text-xs px-2 py-1 h-8 bg-sky-700/40 border-sky-600/50 hover:bg-sky-600/60 min-w-[120px]"
               >
                 {isRewriting ? (
                   <span className="flex items-center gap-1.5">
                     <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     {rewriteScope === 'all' && rewriteProgress 
                        ? `Đã sửa ${rewriteProgress.current}/${rewriteProgress.total}` 
                        : "Đang xử lý..."}
                   </span>
                 ) : "Sửa / Viết lại"}
               </ThemedButton>
               
               <ThemedButton 
                  onClick={() => {
                      setIsEvaluationModalOpen(true);
                      if (!evaluationResult && !isStoryUploaded) {
                         handleEvaluateStory(storyMode === 'romance' ? 'romance' : 'general');
                      }
                  }}
                  disabled={(isGlobalLoading && !loading.evaluation) || storyBlocks.length === 0}
                  className="text-xs px-2 py-1 h-8 bg-purple-700/40 border-purple-600/50 hover:bg-purple-600/60"
                  title="Chấm điểm và nhận xét truyện"
               >
                  {loading.evaluation ? (
                      <span className="flex items-center gap-1.5">
                         <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         Đang chấm...
                      </span>
                  ) : "Đánh giá"}
               </ThemedButton>

               <ThemedButton onClick={exportStoryCSV} disabled={storyBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
               <ThemedButton onClick={exportStoryTXT} disabled={storyBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải TXT</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.story && <LoadingOverlay message={progressText || "Đang viết truyện..."} />}
                {storyBlocks.length === 0 ? <Empty text="Chưa có nội dung truyện. Nhấn 'Viết Truyện' hoặc Upload file." /> : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {storyBlocks.map((b, index) => {
                      const isRewritten = rewrittenIndices.has(index);
                      const cardStyle = isRewritten 
                          ? "bg-emerald-900/30 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                          : `${theme.bgCard}/50 border ${theme.border}`;
                      
                      return (
                      <div key={b.index} className={`p-3 rounded-xl border transition-all duration-500 ${cardStyle}`}>
                         <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                                <div className={`font-semibold ${theme.textHighlight}`}>{b.title}</div>
                                {isRewritten && <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">NEW</span>}
                             </div>
                             <button 
                                onClick={() => openRewriteModal(index)}
                                disabled={isGlobalLoading}
                                className={`text-xs px-2 py-1 rounded border ${theme.borderLight} ${theme.bgButton} hover:text-white transition flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Viết lại đoạn này"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Sửa
                             </button>
                         </div>
                         <p className="whitespace-pre-wrap leading-relaxed opacity-90 text-sm">{b.content}</p>
                      </div>
                    )})}
                  </div>
                )}
            </div>
          </Card>
          
          <Card title="5) Review Script (Kịch bản Audio)" actions={
             <div className="flex gap-2">
               <ThemedButton onClick={exportScriptCSV} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
               <ThemedButton onClick={exportScriptTXT} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải TXT</ThemedButton>
             </div>
          }>
            <div className="relative">
                {loading.script && <LoadingOverlay message={progressText || "Đang tạo kịch bản..."} />}
                {scriptBlocks.length === 0 ? <Empty text="Chưa có kịch bản review." /> : (
                   <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                     {scriptBlocks.map((b) => (
                       <div key={b.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                         <div className="font-semibold text-sky-200 mb-1">{b.chapter} <span className="text-xs opacity-50 font-normal">({b.chars} chars)</span></div>
                         <p className="whitespace-pre-wrap leading-relaxed opacity-90 text-sm">{b.text}</p>
                       </div>
                     ))}
                   </div>
                )}
            </div>
          </Card>

          <Card title="6) SEO Metadata">
            <div className="relative">
              {loading.seo && <LoadingOverlay message="Đang tối ưu SEO..." />}
              {!seo ? <Empty text="Chưa có thông tin SEO." /> : (
                <div className="space-y-4 text-sm">
                  <div>
                     <div className="font-semibold text-sky-200 mb-1">Tiêu đề đề xuất:</div>
                     <ul className="list-disc ml-5 space-y-1 opacity-90">{seo.titles.map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </div>
                  <div>
                     <div className="font-semibold text-sky-200 mb-1">Mô tả video:</div>
                     <p className="whitespace-pre-wrap opacity-90 p-2 rounded bg-black/20">{seo.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                       <div className="font-semibold text-sky-200 mb-1">Hashtags:</div>
                       <div className="opacity-90">{seo.hashtags.join(", ")}</div>
                     </div>
                     <div>
                       <div className="font-semibold text-sky-200 mb-1">Keywords:</div>
                       <div className="opacity-90">{seo.keywords.join(", ")}</div>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="7) Prompts & Thumbnails" actions={
              <ThemedButton onClick={exportPromptCSV} disabled={videoPrompts.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
          }>
             <div className="relative">
                 {loading.prompts && <LoadingOverlay message="Đang tạo ý tưởng hình ảnh..." />}
                 {videoPrompts.length === 0 ? <Empty text="Chưa có prompt video/thumbnail." /> : (
                   <div className="space-y-4 text-sm max-h-[400px] overflow-y-auto pr-2">
                     <div>
                        <div className="font-semibold text-sky-200 mb-2 sticky top-0 bg-slate-900/90 py-1">Video Prompts (Midjourney/Leonardo):</div>
                        <ul className="space-y-2">
                          {videoPrompts.map((p,i) => (
                            <li key={i} className={`p-2 rounded border ${theme.border} ${theme.bgCard}/30`}>
                               <span className="font-bold text-sky-500 mr-2">#{i+1}</span>{p}
                            </li>
                          ))}
                        </ul>
                     </div>
                     <div>
                        <div className="font-semibold text-sky-200 mb-2 sticky top-0 bg-slate-900/90 py-1">Thumbnail Text Ideas:</div>
                        <ul className="list-disc ml-5 space-y-1 opacity-90">
                          {thumbTextIdeas.map((t,i) => <li key={i}>{t}</li>)}
                        </ul>
                     </div>
                   </div>
                 )}
             </div>
          </Card>
        </section>
      </main>

      <Modal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} title="API Configuration">
        <div className="space-y-4">
            <div className={`p-3 rounded-lg border ${theme.borderLight} bg-blue-900/10 text-sm`}>
                <p className="font-medium text-blue-200 mb-1">Hướng dẫn lấy API Key:</p>
                <ul className="list-disc ml-4 space-y-1 text-slate-300">
                    <li><b>Google Gemini:</b> Truy cập <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:underline">Google AI Studio</a>.</li>
                    <li><b>OpenAI (Optional):</b> Truy cập <a href="https://platform.openai.com/api-keys" target="_blank" className="text-blue-400 hover:underline">OpenAI Platform</a>.</li>
                </ul>
            </div>

            {/* --- MODEL SELECTION DROPDOWN --- */}
            <div className="relative z-50">
                <label className="block text-sm font-medium text-slate-300 mb-1">Chọn AI Model</label>
                <button 
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`w-full text-left rounded border ${theme.border} bg-slate-950 px-3 py-2 text-white focus:ring-2 ${theme.ring} flex justify-between items-center transition`}
                >
                  <div className="flex flex-col">
                      <span className="font-medium text-sm">{currentModelInfo.name}</span>
                      <span className="text-[10px] text-slate-400">{currentModelInfo.desc}</span>
                  </div>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                {isModelDropdownOpen && (
                   <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg border ${theme.border} bg-slate-900 shadow-2xl overflow-hidden max-h-64 overflow-y-auto`}>
                       {AVAILABLE_MODELS.map((model) => (
                          <div 
                             key={model.id} 
                             onClick={() => { setSelectedModel(model.id); setIsModelDropdownOpen(false); }}
                             className={`px-3 py-2 cursor-pointer hover:bg-slate-800 border-b border-slate-800 last:border-0 ${selectedModel === model.id ? 'bg-slate-800' : ''}`}
                          >
                             <div className="flex justify-between items-center">
                                <div>
                                    <div className={`font-medium text-sm ${selectedModel === model.id ? 'text-sky-400' : 'text-slate-200'}`}>{model.name}</div>
                                    <div className="text-[10px] text-slate-400">{model.desc}</div>
                                </div>
                                {selectedModel === model.id && <svg className="w-4 h-4 text-sky-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                             </div>
                          </div>
                       ))}
                   </div>
                )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex justify-between">
                 <span>Google Gemini API Keys (Required)</span>
                 <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">Multi-key Auto-switch Supported</span>
              </label>
              <textarea 
                  value={apiKeyGemini} 
                  onChange={(e) => setApiKeyGemini(e.target.value)} 
                  className={`w-full h-32 rounded border ${theme.border} bg-slate-950 px-3 py-2 text-white focus:ring-2 ${theme.ring} text-xs font-mono`} 
                  placeholder={`AIza...\nAIza...\n(Mỗi dòng 1 key, tự động chuyển khi hết quota)`} 
              />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-300 mb-1 flex justify-between">
                 <span>OpenAI API Keys (Optional)</span>
                 <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">Multi-key Auto-switch Supported</span>
              </label>
              <textarea 
                  value={apiKeyOpenAI} 
                  onChange={(e) => setApiKeyOpenAI(e.target.value)} 
                  className={`w-full h-32 rounded border ${theme.border} bg-slate-950 px-3 py-2 text-white focus:ring-2 ${theme.ring} text-xs font-mono`} 
                  placeholder={`sk-...\nsk-...\n(Mỗi dòng 1 key, tự động chuyển khi lỗi)`} 
              />
            </div>
            <div className="pt-2 flex justify-end">
                <ThemedButton onClick={handleSaveKeys} className={`${theme.buttonPrimary} text-white`}>Lưu API Key</ThemedButton>
            </div>
        </div>
      </Modal>

      {/* ... (OTHER MODALS: Guide, ExtraConfig, Library, Rewrite, Evaluation UNCHANGED) ... */}
      <Modal isOpen={isGuideModalOpen} onClose={() => setIsGuideModalOpen(false)} title="Hướng dẫn & Mẹo">
        <div className="flex gap-4 border-b border-gray-700 mb-4">
           <button onClick={() => setActiveGuideTab('strengths')} className={`pb-2 px-1 text-sm font-medium transition-colors ${activeGuideTab === 'strengths' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}>Điểm mạnh Tool</button>
           <button onClick={() => setActiveGuideTab('guide')} className={`pb-2 px-1 text-sm font-medium transition-colors ${activeGuideTab === 'guide' ? 'text-sky-400 border-b-2 border-sky-400' : 'text-slate-400 hover:text-slate-200'}`}>Quy trình chuẩn</button>
        </div>
        
        {activeGuideTab === 'strengths' ? (
             <div className="space-y-4 text-sm text-slate-300">
               <p>Tool này được thiết kế tối ưu cho việc làm content YouTube số lượng lớn (Industrial Scale) nhưng vẫn giữ chất lượng cao:</p>
               <ul className="list-disc ml-5 space-y-2">
                   <li><b>Multi-Key Auto Switch:</b> Nhập nhiều API Key Gemini cùng lúc. Tool tự động chuyển key khi hết quota (Lỗi 429).</li>
                   <li><b>Đa dạng Thể loại:</b> Hỗ trợ cả Ngôn tình (tình cảm) và Phi ngôn tình (hành động, kinh dị, tiên hiệp) với phong cách viết được tùy biến riêng.</li>
                   <li><b>Consistency (Nhất quán):</b> Metadata nhân vật được lưu và truyền xuyên suốt qua các prompt.</li>
                   <li><b>Deep Content:</b> Thay vì viết một lèo, tool chia nhỏ outline và viết từng chương chi tiết.</li>
                   <li><b>Review Automation:</b> Tự động đóng vai MC để viết lời dẫn cho Audio.</li>
                   <li><b>Thẩm định chất lượng:</b> Chế độ "Đánh giá" và "Sửa lại" thông minh.</li>
               </ul>
            </div>
        ) : (
             <div className="space-y-4 text-sm text-slate-300">
                <ol className="list-decimal ml-5 space-y-3">
                   <li><b>Cài đặt:</b> Nhập API Key (Nên nhập 3-5 key để chạy mượt). Chọn Model AI mong muốn.</li>
                   <li><b>Lên ý tưởng:</b> Chọn Chế độ (Ngôn tình/Phi ngôn tình) và Thể loại cụ thể. Nhập tên sách/chủ đề. Nhấn "Tạo Kịch bản khung".</li>
                   <li><b>Viết truyện:</b> Nhấn "Viết Truyện". AI sẽ viết lần lượt từng chương với văn phong phù hợp thể loại đã chọn.</li>
                   <li><b>Kiểm định & Tối ưu:</b> Dùng tính năng "Đánh giá" để chấm điểm, sau đó "Viết lại".</li>
                   <li><b>Thư viện & Xuất file:</b> Truyện được tự động lưu. Tải CSV/TXT.</li>
                </ol>
             </div>
        )}
      </Modal>

      <Modal isOpen={isExtraConfigModalOpen} onClose={() => setIsExtraConfigModalOpen(false)} title="Cấu hình nâng cao">
         <div className="space-y-6">
            <div className="p-3 rounded bg-slate-950/50 border border-slate-800">
               <h4 className="text-sm font-semibold text-blue-300 mb-3 border-b border-slate-800 pb-1">Cấu hình cho Tiếng Việt (VN Mode)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tên Kênh YouTube</label>
                    <input type="text" value={channelNameVi} onChange={(e) => setChannelNameVi(e.target.value)} className={`w-full rounded border ${theme.border} bg-slate-900 px-3 py-2 text-sm focus:ring-1 ${theme.ring}`} placeholder="VD: Gấu Kể Chuyện" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tên MC / Người dẫn</label>
                    <input type="text" value={mcNameVi} onChange={(e) => setMcNameVi(e.target.value)} className={`w-full rounded border ${theme.border} bg-slate-900 px-3 py-2 text-sm focus:ring-1 ${theme.ring}`} placeholder="VD: Admin" />
                  </div>
               </div>
            </div>
             <div className="p-3 rounded bg-slate-950/50 border border-slate-800">
               <h4 className="text-sm font-semibold text-emerald-300 mb-3 border-b border-slate-800 pb-1">Configuration for English (US Mode)</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Channel Name</label>
                    <input type="text" value={channelNameEn} onChange={(e) => setChannelNameEn(e.target.value)} className={`w-full rounded border ${theme.border} bg-slate-900 px-3 py-2 text-sm focus:ring-1 ${theme.ring}`} placeholder="Ex: Daily Tales" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Host Name</label>
                    <input type="text" value={mcNameEn} onChange={(e) => setMcNameEn(e.target.value)} className={`w-full rounded border ${theme.border} bg-slate-900 px-3 py-2 text-sm focus:ring-1 ${theme.ring}`} placeholder="Ex: John" />
                  </div>
               </div>
            </div>
            <div className="pt-2 flex justify-end">
                <ThemedButton onClick={handleSaveExtraConfig} className={`${theme.buttonPrimary} text-white`}>Lưu Cấu Hình</ThemedButton>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isLibraryModalOpen} onClose={() => setIsLibraryModalOpen(false)} title="Thư viện phiên làm việc">
         {sessions.length === 0 ? (
             <div className="text-center py-8 text-slate-500">Chưa có phiên làm việc nào được lưu.</div>
         ) : (
             <div className="space-y-3">
                 {sessions.map(s => (
                     <div key={s.id} onClick={() => handleLoadSession(s)} className={`p-3 rounded-lg border ${theme.borderLight} bg-slate-900/50 hover:bg-slate-800 cursor-pointer transition flex justify-between items-center group`}>
                         <div>
                             <div className="font-medium text-sky-100">{s.bookTitle || "Không tên"}</div>
                             <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                 <span>{new Date(s.lastModified).toLocaleDateString()}</span>
                                 <span>• {s.genre || (s.storyMode === 'romance' ? 'Ngôn tình' : 'Phi ngôn tình')}</span>
                                 <span>• {s.chaptersCount} chương</span>
                                 {s.evaluationResult && <span className="text-purple-400">• Đã chấm</span>}
                             </div>
                         </div>
                         <button onClick={(e) => handleDeleteSession(s.id, e)} className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                         </button>
                     </div>
                 ))}
             </div>
         )}
      </Modal>

      <Modal isOpen={isRewriteModalOpen} onClose={() => setIsRewriteModalOpen(false)} title="Sửa nội dung">
         <div className="space-y-4">
             <div className="text-sm text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
                {rewriteScope === 'single' ? (
                   <span>Bạn đang sửa đoạn: <b>{editingBlockIndex !== null ? storyBlocks[editingBlockIndex]?.title : ""}</b></span>
                ) : (
                   <span className="text-amber-300">Bạn đang sửa TOÀN BỘ truyện cùng lúc. Hãy nhập chỉ dẫn chung (ví dụ: "Đổi giọng văn sang hài hước hơn", "Thêm thoại cho nhân vật nam").</span>
                )}
             </div>
             
             <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Yêu cầu sửa đổi (Feedback):</label>
                <textarea 
                    value={rewriteFeedback} 
                    onChange={(e) => setRewriteFeedback(e.target.value)} 
                    placeholder="VD: Viết lại đoạn này kịch tính hơn. Thêm miêu tả nội tâm nhân vật..." 
                    className={`w-full h-32 rounded border ${theme.border} bg-slate-950 px-3 py-2 text-white focus:ring-2 ${theme.ring}`} 
                />
             </div>
             <div className="flex justify-end gap-2 pt-2">
                 <button onClick={() => setIsRewriteModalOpen(false)} className="px-4 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">Hủy</button>
                 <ThemedButton onClick={handleRewriteSubmit} className={`${theme.buttonPrimary} text-white`}>
                    {rewriteScope === 'single' ? 'Sửa đoạn này' : 'Sửa toàn bộ'}
                 </ThemedButton>
             </div>
         </div>
      </Modal>

      <Modal isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} title="Đánh giá & Chấm điểm truyện">
          {!evaluationResult ? (
              <div className="space-y-4 text-center py-6">
                  {loading.evaluation ? (
                      <div className="flex flex-col items-center gap-4 text-sky-400">
                          <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span className="animate-pulse">Đang thẩm định tác phẩm... (Có thể mất 30-60s)</span>
                      </div>
                  ) : (
                      isStoryUploaded ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                           <button 
                               onClick={() => handleEvaluateStory('romance')}
                               className="p-6 rounded-xl bg-pink-900/30 border border-pink-700/50 hover:bg-pink-900/50 hover:border-pink-500 transition group flex flex-col items-center gap-3"
                           >
                               <div className="w-12 h-12 rounded-full bg-pink-600/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                               </div>
                               <div className="font-bold text-pink-200">Chấm điểm Ngôn Tình</div>
                               <div className="text-xs text-pink-300/60">Tiêu chí: Hook, Chemistry, Cẩu huyết, Sảng văn...</div>
                           </button>

                           <button 
                               onClick={() => handleEvaluateStory('general')}
                               className="p-6 rounded-xl bg-blue-900/30 border border-blue-700/50 hover:bg-blue-900/50 hover:border-blue-500 transition group flex flex-col items-center gap-3"
                           >
                                <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                               </div>
                               <div className="font-bold text-blue-200">Chấm điểm Kịch bản</div>
                               <div className="text-xs text-blue-300/60">Tiêu chí: Cấu trúc, Logic, Giọng văn, Ý tưởng...</div>
                           </button>
                        </div>
                      ) : (
                        <div className="flex justify-center px-4">
                            <button 
                                onClick={() => handleEvaluateStory(storyMode === 'romance' ? 'romance' : 'general')}
                                className={`p-6 rounded-xl w-full border transition group flex flex-col items-center gap-3 ${
                                    storyMode === 'romance' 
                                    ? 'bg-pink-900/30 border-pink-700/50 hover:bg-pink-900/50 hover:border-pink-500' 
                                    : 'bg-blue-900/30 border-blue-700/50 hover:bg-blue-900/50 hover:border-blue-500'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition group-hover:scale-110 ${
                                    storyMode === 'romance' ? 'bg-pink-600/20 text-pink-400' : 'bg-blue-600/20 text-blue-400'
                                }`}>
                                  {storyMode === 'romance' ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                  ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                                  )}
                                </div>
                                <div className={`font-bold ${storyMode === 'romance' ? 'text-pink-200' : 'text-blue-200'}`}>
                                    {storyMode === 'romance' ? 'Bắt đầu chấm điểm Ngôn Tình' : 'Bắt đầu chấm điểm Kịch bản'}
                                </div>
                                <div className={`text-xs ${storyMode === 'romance' ? 'text-pink-300/60' : 'text-blue-300/60'}`}>
                                    {storyMode === 'romance' ? 'Tiêu chí: Hook, Chemistry, Cẩu huyết, Sảng văn...' : 'Tiêu chí: Cấu trúc, Logic, Giọng văn, Ý tưởng...'}
                                </div>
                            </button>
                        </div>
                      )
                  )}
              </div>
          ) : (
              <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 max-h-[60vh] overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
                      {evaluationResult}
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button 
                        onClick={() => setEvaluationResult(null)}
                        className="px-4 py-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      >
                        Đánh giá lại
                      </button>
                      <ThemedButton onClick={handleRewriteFromEvaluation} className={`${theme.buttonPrimary} text-white`}>
                        Viết lại theo đánh giá
                      </ThemedButton>
                      <ThemedButton onClick={() => downloadTXT(`danh_gia_${geminiService.slugify(bookTitle)}.txt`, evaluationResult)} className={`${theme.buttonPrimary} text-white`}>
                        Tải kết quả (.txt)
                      </ThemedButton>
                  </div>
              </div>
          )}
      </Modal>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
