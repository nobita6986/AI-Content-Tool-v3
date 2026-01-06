
import React, { useEffect, useMemo, useState, useRef } from "react";
import { OutlineItem, ScriptBlock, StoryBlock, SEOResult, LoadingStates, Language, SavedSession, StoryMetadata } from './types';
import * as geminiService from './services/geminiService';
import { Card, Empty, LoadingOverlay, Modal, Toast, Tooltip } from './components/ui';

// --- CONFIGURATION & THEMES ---

const THEMES = {
  vi: {
    bg: "bg-[radial-gradient(1200px_700px_at_50%_0%,#0b1a22_0%,#07141b_45%,#031017_85%)]",
    textMain: "text-sky-50",
    textAccent: "text-sky-300",
    textHighlight: "text-sky-100",
    border: "border-sky-900",
    borderLight: "border-sky-800",
    bgCard: "bg-slate-900",
    bgButton: "bg-sky-900/40",
    bgButtonHover: "hover:bg-sky-900/60",
    ring: "ring-sky-500",
    gradientTitle: "from-sky-400 to-blue-500",
    iconColor: "text-sky-300",
    buttonPrimary: "bg-sky-700/50 hover:bg-sky-600/50",
    subtleBg: "bg-sky-900/20",
    badge: "bg-sky-600 shadow-[0_0_10px_rgba(2,132,199,0.5)]"
  },
  en: {
    // English theme: Emerald / Teal / Slate
    bg: "bg-[radial-gradient(1200px_700px_at_50%_0%,#022c22_0%,#064e3b_45%,#020617_85%)]",
    textMain: "text-emerald-50",
    textAccent: "text-emerald-300",
    textHighlight: "text-emerald-100",
    border: "border-emerald-900",
    borderLight: "border-emerald-800",
    bgCard: "bg-slate-950",
    bgButton: "bg-emerald-900/40",
    bgButtonHover: "hover:bg-emerald-900/60",
    ring: "ring-emerald-500",
    gradientTitle: "from-emerald-400 to-teal-500",
    iconColor: "text-emerald-300",
    buttonPrimary: "bg-emerald-700/50 hover:bg-emerald-600/50",
    subtleBg: "bg-emerald-900/20",
    badge: "bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.5)]"
  }
};

const INITIAL_LOADING_STATES: LoadingStates = {
  outline: false,
  story: false,
  seo: false,
  script: false,
  prompts: false,
};

export default function App() {
  const [language, setLanguage] = useState<Language>('vi'); 
  
  // -- Content State --
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookIdea, setBookIdea] = useState("");
  const [bookImage, setBookImage] = useState<string | null>(null);
  
  // -- Config State (Dual Language) --
  const [channelNameVi, setChannelNameVi] = useState("");
  const [mcNameVi, setMcNameVi] = useState("");
  const [channelNameEn, setChannelNameEn] = useState("");
  const [mcNameEn, setMcNameEn] = useState("");

  const [frameRatio, setFrameRatio] = useState("16:9"); 
  const [durationMin, setDurationMin] = useState(240);
  // isAutoDuration state: Determines if we use the Auto (40-60m) mode
  const [isAutoDuration, setIsAutoDuration] = useState(false);
  
  // -- Config State Calculation --
  // Auto-calculate chapters: 1 chapter per ~2.5-3 mins to ensure depth (40-60k chars)
  const calculatedChapters = useMemo(() => {
     if (isAutoDuration) return 18; // Placeholder avg for 50 mins
     return Math.max(3, Math.ceil(durationMin / 2.5));
  }, [durationMin, isAutoDuration]);

  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");
  
  // -- Modals --
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
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

  // -- API Keys --
  const [apiKeyGemini, setApiKeyGemini] = useState("");
  const [apiKeyOpenAI, setApiKeyOpenAI] = useState("");

  // -- Output Data --
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  // Store generated character names here to ensure consistency
  const [storyMetadata, setStoryMetadata] = useState<StoryMetadata | undefined>(undefined);
  
  const [storyBlocks, setStoryBlocks] = useState<StoryBlock[]>([]);
  const [seo, setSeo] = useState<SEOResult | null>(null);
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>([]);
  const [videoPrompts, setVideoPrompts] = useState<string[]>([]);
  const [thumbTextIdeas, setThumbTextIdeas] = useState<string[]>([]);

  const [loading, setLoading] = useState<LoadingStates>(INITIAL_LOADING_STATES);
  const [error, setError] = useState<string | null>(null);
  
  const [isStoryUploaded, setIsStoryUploaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SavedSession[]>([]);

  const theme = THEMES[language];
  
  // Display target chars: If Auto, show range. Else calc based on Duration (1000 chars/min)
  const totalCharsTargetStr = useMemo(() => {
      if (isAutoDuration) return "40,000 - 60,000";
      return (durationMin * 1000).toLocaleString(language === 'vi' ? "vi-VN" : "en-US");
  }, [durationMin, isAutoDuration, language]);
  
  // Derived values based on current language
  const currentChannelName = language === 'vi' ? channelNameVi : channelNameEn;
  const currentMcName = language === 'vi' ? mcNameVi : mcNameEn;

  // --- INITIAL LOAD & GLOBAL CONFIG ---
  useEffect(() => {
    // API Keys
    const storedGeminiKey = localStorage.getItem("nd_gemini_api_key");
    const storedOpenAIKey = localStorage.getItem("nd_openai_api_key");
    if (storedGeminiKey) setApiKeyGemini(storedGeminiKey);
    if (storedOpenAIKey) setApiKeyOpenAI(storedOpenAIKey);

    // Configs (VI)
    const storedChannelVi = localStorage.getItem("nd_channel_name_vi");
    const storedMcVi = localStorage.getItem("nd_mc_name_vi");
    if (storedChannelVi) setChannelNameVi(storedChannelVi);
    if (storedMcVi) setMcNameVi(storedMcVi);

    // Configs (EN) - fallbacks to simple keys if legacy, otherwise specific keys
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
    const trimmedGemini = apiKeyGemini.trim();
    const trimmedOpenAI = apiKeyOpenAI.trim();

    setApiKeyGemini(trimmedGemini);
    setApiKeyOpenAI(trimmedOpenAI);
    
    localStorage.setItem("nd_gemini_api_key", trimmedGemini);
    localStorage.setItem("nd_openai_api_key", trimmedOpenAI);
    setIsApiModalOpen(false);
    setToastMessage("Đã lưu API Key.");
  };

  const handleSaveExtraConfig = () => {
    localStorage.setItem("nd_channel_name_vi", channelNameVi);
    localStorage.setItem("nd_mc_name_vi", mcNameVi);
    localStorage.setItem("nd_channel_name_en", channelNameEn);
    localStorage.setItem("nd_mc_name_en", mcNameEn);
    setIsExtraConfigModalOpen(false);
  };

  // --- SESSION & AUTO-SAVE LOGIC ---
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
            bookTitle,
            language,
            bookIdea,
            bookImage,
            durationMin,
            isAutoDuration,
            chaptersCount: calculatedChapters,
            frameRatio,
            storyMetadata, // Save metadata
            outline,
            storyBlocks,
            scriptBlocks,
            seo,
            videoPrompts,
            thumbTextIdeas
        };

        setSessions(prev => {
            const filtered = prev.filter(s => s.id !== currentId);
            const updated = [newSession, ...filtered];
            localStorage.setItem("nd_sessions", JSON.stringify(updated));
            return updated;
        });
    }, 2000); // Auto-save after 2 seconds

    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [bookTitle, bookIdea, bookImage, durationMin, isAutoDuration, calculatedChapters, frameRatio, outline, storyMetadata, storyBlocks, scriptBlocks, seo, videoPrompts, thumbTextIdeas, language, sessionId]);

  const handleLoadSession = (s: SavedSession) => {
      setSessionId(s.id);
      setBookTitle(s.bookTitle);
      setLanguage(s.language);
      setBookIdea(s.bookIdea);
      setBookImage(s.bookImage);
      setDurationMin(s.durationMin);
      setIsAutoDuration(!!s.isAutoDuration);
      setFrameRatio(s.frameRatio || "16:9");
      setStoryMetadata(s.storyMetadata); // Load metadata
      setOutline(s.outline || []);
      setStoryBlocks(s.storyBlocks || []);
      setScriptBlocks(s.scriptBlocks || []);
      setSeo(s.seo);
      setVideoPrompts(s.videoPrompts || []);
      setThumbTextIdeas(s.thumbTextIdeas || []);
      
      setIsLibraryModalOpen(false);
      setToastMessage(`Đã tải lại phiên làm việc: "${s.bookTitle}"`);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Bạn có chắc chắn muốn xóa phiên làm việc này?")) {
          const updated = sessions.filter(s => s.id !== id);
          setSessions(updated);
          localStorage.setItem("nd_sessions", JSON.stringify(updated));
          if (sessionId === id) {
             setSessionId(null);
          }
      }
  };

  const createNewSession = () => {
      setSessionId(null);
      setBookTitle("");
      setBookIdea("");
      setOutline([]);
      setStoryMetadata(undefined);
      setStoryBlocks([]);
      setScriptBlocks([]);
      setSeo(null);
      setVideoPrompts([]);
      setThumbTextIdeas([]);
      setIsAutoDuration(false);
      setToastMessage("Đã tạo phiên làm việc mới.");
  }


  // --- HANDLERS ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBookImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");
    setBookTitle(fileName);

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
            const chunks = geminiService.chunkText(text, 3000);
            const newBlocks: StoryBlock[] = chunks.map((chunk, idx) => ({
                index: idx + 1,
                title: `${language === 'vi' ? 'Phần' : 'Part'} ${idx + 1} (Upload)`,
                content: chunk
            }));
            setStoryBlocks(newBlocks);
            setOutline([]); 
            setStoryMetadata(undefined); // Reset metadata on upload
            setScriptBlocks([]); 
            setIsStoryUploaded(true);
            setToastMessage(`Đã upload truyện "${fileName}" thành công. Dữ liệu đã được lưu vào thư viện.`);
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
      if (selectedModel.startsWith("gpt") && !apiKeyOpenAI) {
        setError("Vui lòng nhập OpenAI API Key để sử dụng các model ChatGPT.");
        return;
      }
      
      setError(null);
      setLoading(prev => ({ ...prev, [key]: true }));
      try {
        return await fn(...args);
      } catch (err) {
        console.error(`Error in ${key}:`, err);
        setError(`Lỗi khi tạo ${key}: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(prev => ({ ...prev, [key]: false }));
      }
    };
  };

  const handleGenerateOutline = withErrorHandling(async () => {
    const result = await geminiService.generateOutline(bookTitle, bookIdea, currentChannelName, currentMcName, calculatedChapters, durationMin, language, isAutoDuration, selectedModel, apiKeyGemini);
    // Result now returns { chapters: ..., metadata: ... }
    const indexedChapters = result.chapters.map((item, index) => ({ ...item, index }));
    setOutline(indexedChapters);
    setStoryMetadata(result.metadata); // Store the generated characters
    setStoryBlocks([]);
    setScriptBlocks([]);
    setIsStoryUploaded(false);
  }, 'outline');

  const handleGenerateStory = withErrorHandling(async () => {
    if (outline.length === 0) {
        setError("Cần có sườn (outline) trước khi viết truyện.");
        setLoading(prev => ({ ...prev, story: false }));
        return;
    }
    
    // Check if we have metadata. If we uploaded a story or have an old session without metadata, we might need a fallback.
    // However, if outline exists from AI, metadata should exist.
    const safeMetadata = storyMetadata || { femaleLead: "Nữ chính", maleLead: "Nam chính", villain: "Phản diện" };

    setStoryBlocks([]);
    for (const item of outline) {
        const content = await geminiService.generateStoryBlock(item, safeMetadata, bookTitle, bookIdea, language, selectedModel, apiKeyGemini);
        setStoryBlocks(prev => [...prev, {
            index: item.index,
            title: item.title,
            content: content
        }]);
    }
  }, 'story');

  const handleGenerateReviewScript = withErrorHandling(async () => {
    if (storyBlocks.length === 0) {
        setError("Chưa có nội dung truyện. Vui lòng 'Viết Truyện' hoặc Upload file trước.");
        setLoading(prev => ({ ...prev, script: false }));
        return;
    }

    setScriptBlocks([]);
    for (const block of storyBlocks) {
      const text = await geminiService.generateReviewBlock(block.content, block.title, bookTitle, currentChannelName, currentMcName, language, selectedModel, apiKeyGemini);
      const newBlock: ScriptBlock = {
        index: block.index,
        chapter: block.title,
        text: text,
        chars: text.length,
      };
      setScriptBlocks(prev => [...prev, newBlock]);
    }
  }, 'script');

  const handleGenerateSEO = withErrorHandling(async () => {
    const result = await geminiService.generateSEO(bookTitle, currentChannelName, durationMin, language, selectedModel, apiKeyGemini);
    setSeo(result);
  }, 'seo');
  
  const handleGeneratePrompts = withErrorHandling(async () => {
    const [prompts, thumbs] = await Promise.all([
      geminiService.generateVideoPrompts(bookTitle, frameRatio, language, selectedModel, apiKeyGemini),
      geminiService.generateThumbIdeas(bookTitle, durationMin, language, selectedModel, apiKeyGemini)
    ]);
    setVideoPrompts(prompts);
    setThumbTextIdeas(thumbs);
  }, 'prompts');

  // --- REWRITE LOGIC ---
  const openRewriteModal = (index: number) => {
    setRewriteScope('single');
    setEditingBlockIndex(index);
    setRewriteFeedback("");
    setIsRewriteModalOpen(true);
  };

  const openRewriteAllModal = () => {
    setRewriteScope('all');
    setEditingBlockIndex(null);
    setRewriteFeedback("");
    setIsRewriteModalOpen(true);
  };

  const handleRewriteSubmit = async () => {
    if (!rewriteFeedback.trim()) return;
    
    setIsRewriting(true);
    setError(null);

    try {
        if (rewriteScope === 'single' && editingBlockIndex !== null) {
            const originalBlock = storyBlocks[editingBlockIndex];
            const newContent = await geminiService.rewriteStoryBlock(
                originalBlock.content,
                rewriteFeedback,
                storyMetadata,
                language,
                selectedModel,
                apiKeyGemini
            );

            setStoryBlocks(prev => {
                const updated = [...prev];
                updated[editingBlockIndex] = { ...updated[editingBlockIndex], content: newContent };
                return updated;
            });
            setToastMessage("Đã viết lại đoạn truyện thành công!");
        } else if (rewriteScope === 'all') {
             setRewriteProgress({ current: 0, total: storyBlocks.length });
             
             // Process sequentially to ensure stability
             for (let i = 0; i < storyBlocks.length; i++) {
                 try {
                    const block = storyBlocks[i];
                    const newContent = await geminiService.rewriteStoryBlock(
                        block.content,
                        rewriteFeedback,
                        storyMetadata,
                        language,
                        selectedModel,
                        apiKeyGemini
                    );
                    
                    setStoryBlocks(prev => {
                        const updated = [...prev];
                        updated[i] = { ...updated[i], content: newContent };
                        return updated;
                    });
                    
                    setRewriteProgress({ current: i + 1, total: storyBlocks.length });
                 } catch (e) {
                     console.error(`Error rewriting block ${i}`, e);
                     // Continue to next block even if one fails
                 }
             }
             setToastMessage("Đã hoàn tất viết lại toàn bộ truyện.");
             setRewriteProgress(null);
        }
    } catch (err) {
        console.error("Rewrite error", err);
        setError(`Lỗi khi viết lại: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
        setIsRewriting(false);
    }
  };

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const fmtNumber = (n: number) => n.toLocaleString(language === 'vi' ? "vi-VN" : "en-US");

  const downloadCSV = (filename: string, rows: (string[])[]) => {
    const processRow = (row: string[]) => row.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(",");
    const csvContent = "\uFEFF" + rows.map(processRow).join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportScriptCSV = () => {
    if (!scriptBlocks.length) return;
    const rows = [["STT", "Chương", "Review Script"], ...scriptBlocks.map(b => [String(b.index), b.chapter, b.text])];
    downloadCSV(`review_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportStoryCSV = () => {
    if (!storyBlocks.length) return;
    const rows = [["STT", "Chương", "Nội dung Truyện"], ...storyBlocks.map(b => [String(b.index), b.title, b.content])];
    downloadCSV(`truyen_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  const exportPromptCSV = () => {
    if (!videoPrompts.length) return;
    const rows = [["STT", "Prompt"], ...videoPrompts.map((p, i) => [String(i + 1), p])];
    downloadCSV(`prompts_${geminiService.slugify(bookTitle)}.csv`, rows);
  };

  // Reusable themed button
  const ThemedButton: React.FC<{ children: React.ReactNode, onClick: () => void, disabled?: boolean, className?: string, title?: string }> = ({ children, onClick, disabled, className, title }) => (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border ${theme.borderLight} ${theme.bgButton} px-3 py-2 text-sm font-semibold transition ${theme.bgButtonHover} disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-500 ${theme.bg} ${theme.textMain}`}>
      <header className={`px-6 py-8 border-b ${theme.border} sticky top-0 backdrop-blur bg-black/30 z-20`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="group transition-transform hover:scale-105" onClick={(e) => { e.preventDefault(); createNewSession(); }}>
            <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${theme.gradientTitle}`}>
              AI Content Tool
            </h1>
          </a>
          
          <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <div className={`flex items-center p-1 rounded-full ${theme.bgCard} border ${theme.borderLight}`}>
                  <button 
                    onClick={() => setLanguage('vi')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'vi' ? theme.badge + ' text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    VN
                  </button>
                  <button 
                     onClick={() => setLanguage('en')}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${language === 'en' ? theme.badge + ' text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    US
                  </button>
              </div>

              {/* Library Button */}
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
            <div className="space-y-4">
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
                <input type="file" accept=".txt" onChange={handleStoryUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard} cursor-pointer`} />
              </div>

              <div className="pt-1">
                 <button onClick={() => setIsExtraConfigModalOpen(true)} className={`w-full py-2 rounded-lg ${theme.bgCard} border border-dashed ${theme.border} ${theme.textAccent} hover:${theme.bgButton} transition text-sm flex items-center justify-center gap-2`}>
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                   Cấu hình thêm ({language === 'vi' ? 'VN' : 'US'})
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
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline || isStoryUploaded}>Phân tích & Tạo sườn</ThemedButton>
              <ThemedButton onClick={handleGenerateStory} disabled={loading.story || isStoryUploaded}>Viết Truyện (Theo sườn)</ThemedButton>
              <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script}>Review Truyện (Kịch bản Audio)</ThemedButton>
              <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo}>Tạo Tiêu đề & Mô tả SEO</ThemedButton>
              <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts}>Tạo Prompt Video & Thumbnail</ThemedButton>
              {error && <p className="text-sm text-red-400 mt-2 bg-red-900/20 p-2 rounded">{error}</p>}
            </div>
          </Card>
        </section>

        <section className="lg:col-span-2 space-y-6">
          <Card title="3) Sườn kịch bản" actions={
              <ThemedButton onClick={handleGenerateOutline} disabled={loading.outline || isStoryUploaded} className="text-xs px-2 py-1 h-8">Tạo sườn</ThemedButton>
          }>
            <div className="relative">
             {loading.outline && <LoadingOverlay />}
             {outline.length === 0 ? <Empty text="Chưa có sườn. Nhấn ‘Phân tích & Tạo sườn’." /> : (
              <div>
                {/* Character Metadata Display */}
                {storyMetadata && (
                   <div className={`mb-4 p-3 rounded-lg ${theme.subtleBg} border border-dashed ${theme.border} text-sm grid grid-cols-1 md:grid-cols-3 gap-2`}>
                      <div><span className="opacity-60 text-xs uppercase block">Nữ Chính</span><span className="font-semibold text-sky-200">{storyMetadata.femaleLead}</span></div>
                      <div><span className="opacity-60 text-xs uppercase block">Nam Chính</span><span className="font-semibold text-emerald-200">{storyMetadata.maleLead}</span></div>
                      <div><span className="opacity-60 text-xs uppercase block">Phản Diện</span><span className="font-semibold text-red-300">{storyMetadata.villain}</span></div>
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
               <ThemedButton onClick={openRewriteAllModal} disabled={loading.story || storyBlocks.length === 0} className="text-xs px-2 py-1 h-8 bg-sky-700/40 border-sky-600/50 hover:bg-sky-600/60">Sửa / Viết lại</ThemedButton>
               <ThemedButton onClick={handleGenerateStory} disabled={loading.story || isStoryUploaded} className="text-xs px-2 py-1 h-8">Viết Truyện</ThemedButton>
               <ThemedButton onClick={exportStoryCSV} disabled={storyBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.story && <LoadingOverlay />}
                {storyBlocks.length === 0 ? <Empty text="Chưa có nội dung truyện. Nhấn 'Viết Truyện' hoặc Upload file." /> : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {storyBlocks.map((b, index) => (
                      <div key={b.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                         <div className="flex justify-between items-start mb-2">
                             <div className={`font-semibold ${theme.textHighlight}`}>{b.title}</div>
                             <button 
                                onClick={() => openRewriteModal(index)}
                                className={`text-xs px-2 py-1 rounded border ${theme.borderLight} ${theme.bgButton} hover:text-white transition flex items-center gap-1`}
                                title="Viết lại đoạn này"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Sửa
                             </button>
                         </div>
                         <p className="whitespace-pre-wrap leading-relaxed opacity-90 text-sm">{b.content}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </Card>

          <Card title="5) Review Truyện (Kịch bản Audio)" actions={
            <div className="flex gap-2">
               <ThemedButton onClick={handleGenerateReviewScript} disabled={loading.script} className="text-xs px-2 py-1 h-8">Review Truyện</ThemedButton>
               <ThemedButton onClick={exportScriptCSV} disabled={scriptBlocks.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
            </div>
          }>
             <div className="relative">
                {loading.script && <LoadingOverlay />}
                {scriptBlocks.length === 0 ? <Empty text="Chưa có kịch bản review. Nhấn ‘Review Truyện’." /> : (
                  <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                    {scriptBlocks.map((b) => (
                      <div key={b.index} className={`p-3 rounded-xl ${theme.bgCard}/50 border ${theme.border}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">{b.index}. {b.chapter}</div>
                          <div className={`text-xs ${theme.textAccent}`}>{fmtNumber(b.chars)} {language === 'vi' ? 'ký tự' : 'chars'}</div>
                        </div>
                        <p className={`mt-2 whitespace-pre-wrap leading-relaxed ${theme.textHighlight} opacity-90`}>{b.text}</p>
                      </div>
                    ))}
                    <div className={`text-sm ${theme.textAccent} pt-2`}>Tổng ký tự hiện tại: <b>{fmtNumber(scriptBlocks.reduce((s,x)=>s+x.chars,0))}</b></div>
                  </div>
                )}
            </div>
          </Card>

          <Card title="6) Gợi ý SEO" actions={
             <ThemedButton onClick={handleGenerateSEO} disabled={loading.seo} className="text-xs px-2 py-1 h-8">Tạo SEO</ThemedButton>
          }>
            <div className="relative">
              {loading.seo && <LoadingOverlay />}
              {!seo ? <Empty text="Chưa có SEO. Nhấn ‘Tạo Tiêu đề & Mô tả SEO’." /> : (
                <div className="grid md:grid-cols-2 gap-4">
                   <div>
                      <h4 className="font-semibold mb-2">Tiêu đề gợi ý</h4>
                      <ul className="space-y-2 text-sm">{seo.titles.map((t,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{t}</li>)}</ul>
                      <h4 className="font-semibold mt-4 mb-2">Hashtags</h4>
                      <div className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border} text-sm`}>{seo.hashtags.join(' ')}</div>
                   </div>
                   <div>
                      <h4 className="font-semibold mb-2">Mô tả video</h4>
                      <textarea rows={12} readOnly className={`w-full text-sm rounded-lg ${theme.bgCard}/70 border ${theme.border} p-3 outline-none`} value={seo.description}></textarea>
                   </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="7) Prompt Video & Thumbnail" actions={
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-sm">Khung hình:
                  <select value={frameRatio} onChange={(e)=>setFrameRatio(e.target.value)} className={`bg-transparent outline-none ml-1 ${theme.textHighlight} rounded p-1 border border-transparent hover:${theme.border}`}>
                    {['9:16','16:9','1:1','4:5','21:9'].map(r=> <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                </span>
                <ThemedButton onClick={handleGeneratePrompts} disabled={loading.prompts} className="text-xs px-2 py-1 h-8">Tạo Prompt</ThemedButton>
                <ThemedButton onClick={exportPromptCSV} disabled={videoPrompts.length === 0} className="text-xs px-2 py-1 h-8">Tải CSV</ThemedButton>
              </div>
          }>
            <div className="relative">
              {loading.prompts && <LoadingOverlay />}
              {videoPrompts.length === 0 && thumbTextIdeas.length === 0 ? <Empty text="Chưa có prompt." /> : (
                 <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Prompt Video (Không gian/Vũ trụ)</h4>
                    <ul className="space-y-2 text-sm">{videoPrompts.map((p,i)=> <li key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{i+1}. {p}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Gợi ý Text cho Thumbnail</h4>
                    <div className="space-y-2 text-sm">{thumbTextIdeas.map((t,i)=> (<div key={i} className={`p-2 rounded ${theme.bgCard}/50 border ${theme.border}`}>{t}</div>))}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </section>
      </main>
      
      <footer className={`max-w-7xl mx-auto px-6 py-10 opacity-70 text-center text-sm`}>
          Powered by Google Gemini
      </footer>

      {/* API Configuration Modal */}
      <Modal 
        isOpen={isApiModalOpen} 
        onClose={() => setIsApiModalOpen(false)} 
        title="Quản lý API & Model"
      >
        <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-2`}>Dịch vụ & Model đang dùng</label>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`w-full rounded-lg bg-black/40 border ${theme.borderLight} px-3 py-2 focus:ring-2 ${theme.ring} outline-none text-sm font-medium ${theme.textHighlight}`}
              >
                <optgroup label="Google Gemini" className="bg-slate-900 text-sky-200">
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                  <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                </optgroup>
                <optgroup label="ChatGPT 5.2" className="bg-slate-900 text-sky-200">
                  <option value="gpt-5.2-auto">GPT-5.2 Auto</option>
                  <option value="gpt-5.2-instant">GPT-5.2 Instant</option>
                  <option value="gpt-5.2-thinking">GPT-5.2 Thinking</option>
                  <option value="gpt-5.2-pro">GPT-5.2 Pro</option>
                </optgroup>
              </select>
            </div>

            <div className={`p-4 rounded-lg bg-black/40 border ${theme.borderLight} text-sm space-y-4`}>
                <div>
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>Google Gemini API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyGemini}
                    onChange={(e) => setApiKeyGemini(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[100px]`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textAccent} mb-1`}>OpenAI API Keys (Mỗi dòng một key)</label>
                  <textarea 
                    value={apiKeyOpenAI}
                    onChange={(e) => setApiKeyOpenAI(e.target.value)}
                    placeholder="Key..."
                    className={`w-full rounded ${theme.bgCard}/80 border ${theme.borderLight} px-3 py-2 text-xs font-mono focus:border-sky-500 outline-none ${theme.textHighlight} placeholder:opacity-50 min-h-[80px]`}
                  />
                </div>

                <p className="text-[10px] opacity-70 italic whitespace-pre-wrap">
                  * API Key được lưu an toàn trong Local Storage của trình duyệt.{'\n'}
                  * Nhập nhiều key (mỗi dòng 1 key) để tự động chuyển đổi khi key bị giới hạn.
                </p>

                <div className="pt-2">
                  <button onClick={handleSaveKeys} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
                    Lưu Cấu Hình & Đóng
                  </button>
                </div>
            </div>
        </div>
      </Modal>

      {/* Rewrite Modal */}
      <Modal
        isOpen={isRewriteModalOpen}
        onClose={() => setIsRewriteModalOpen(false)}
        title="Phản hồi & Viết lại nội dung"
      >
         <div className="space-y-4">
             {rewriteScope === 'single' && editingBlockIndex !== null && storyBlocks[editingBlockIndex] && (
                 <div className={`p-3 rounded-lg ${theme.subtleBg} border ${theme.border} max-h-[200px] overflow-y-auto text-sm opacity-80`}>
                    <div className="font-bold text-xs mb-1 uppercase opacity-60">Nội dung gốc:</div>
                    {storyBlocks[editingBlockIndex].content}
                 </div>
             )}
             
             {rewriteScope === 'all' && (
                 <div className={`p-3 rounded-lg ${theme.subtleBg} border ${theme.border} text-sm text-sky-200`}>
                    <div className="font-bold text-xs mb-1 uppercase opacity-60">Phạm vi tác động:</div>
                    Bạn đang yêu cầu sửa đổi/viết lại toàn bộ <b>{storyBlocks.length}</b> chương truyện hiện có. 
                    AI sẽ xử lý lần lượt từng chương dựa trên yêu cầu của bạn.
                 </div>
             )}

             <div>
                <label className={`block text-sm font-medium ${theme.textAccent} mb-2`}>
                    Yêu cầu sửa đổi / Viết lại
                    <Tooltip text="Nhập hướng dẫn cụ thể cho AI. Ví dụ: 'Viết buồn hơn', 'Đổi tên A thành B', 'Thêm chi tiết trời mưa'..." />
                </label>
                <textarea
                    value={rewriteFeedback}
                    onChange={(e) => setRewriteFeedback(e.target.value)}
                    placeholder="Nhập yêu cầu của bạn tại đây..."
                    className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} p-3 outline-none focus:ring-2 ${theme.ring} min-h-[120px] text-sm`}
                />
             </div>

             <div className="flex gap-3 pt-2">
                <button 
                    onClick={handleRewriteSubmit}
                    disabled={isRewriting || !rewriteFeedback.trim()}
                    className={`flex-1 py-2 rounded-lg font-semibold ${theme.buttonPrimary} text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                    {isRewriting ? (
                        <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            {rewriteScope === 'all' ? "Đang viết lại toàn bộ..." : "Đang viết lại..."}
                        </>
                    ) : (rewriteScope === 'all' ? "Viết lại toàn bộ truyện" : "Viết lại chương này")}
                </button>
                 <button 
                    onClick={() => setIsRewriteModalOpen(false)}
                    className={`px-4 py-2 rounded-lg font-semibold border ${theme.borderLight} hover:bg-white/10`}
                >
                    Đóng
                </button>
             </div>
             
             {isRewriting && rewriteScope === 'all' && rewriteProgress && (
               <div className="mt-2 text-xs text-center opacity-80 animate-pulse">
                  Đang xử lý chương: <b>{rewriteProgress.current}</b> / {rewriteProgress.total}
               </div>
             )}
         </div>
      </Modal>

      {/* Guide Modal (Two Tabs) */}
      <Modal 
        isOpen={isGuideModalOpen} 
        onClose={() => setIsGuideModalOpen(false)} 
        title="Hướng dẫn sử dụng & Quy trình"
      >
        <div className={`space-y-4 ${theme.textHighlight}`}>
          
          {/* Tabs Header */}
          <div className="flex border-b border-gray-700 mb-4">
            <button 
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${activeGuideTab === 'strengths' ? `${theme.textAccent} border-b-2 ${theme.border}` : 'opacity-50 hover:opacity-100 hover:bg-white/5'}`}
              onClick={() => setActiveGuideTab('strengths')}
            >
              Điểm Mạnh
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${activeGuideTab === 'guide' ? `${theme.textAccent} border-b-2 ${theme.border}` : 'opacity-50 hover:opacity-100 hover:bg-white/5'}`}
              onClick={() => setActiveGuideTab('guide')}
            >
              Hướng dẫn chi tiết
            </button>
          </div>

          {/* Tab Content: Điểm Mạnh */}
          {activeGuideTab === 'strengths' && (
            <div className={`p-4 rounded-lg ${theme.subtleBg} border ${theme.border} text-sm space-y-2 animate-in fade-in zoom-in-95 duration-200`}>
                <h4 className={`font-bold text-lg mb-2 ${theme.textAccent}`}>Tính Năng Nổi Bật</h4>
                <ul className="list-disc list-inside space-y-2 opacity-90">
                  <li><b>Thư viện tự động:</b> Mọi thao tác được tự động lưu sau mỗi thay đổi. Bạn có thể đóng tab trình duyệt và mở lại sau để tiếp tục làm việc mà không sợ mất dữ liệu.</li>
                  <li><b>Tự động hóa toàn diện:</b> Chỉ cần nhập tên sách, AI sẽ lo từ A-Z: Lên sườn ý tưởng &rarr; Viết nội dung chi tiết &rarr; Chuyển thể kịch bản MC &rarr; Tối ưu SEO &rarr; Gợi ý Prompt hình ảnh.</li>
                  <li><b>Linh hoạt đầu vào:</b> 
                    <ul className="list-[circle] list-inside ml-5 mt-1 text-xs opacity-80">
                       <li>Chưa có gì? &rarr; Dùng tính năng <b>Tạo sườn</b>.</li>
                       <li>Đã có file truyện .txt? &rarr; Dùng tính năng <b>Upload</b> để AI viết kịch bản review ngay lập tức.</li>
                    </ul>
                  </li>
                  <li><b>Phản hồi & Viết lại (MỚI):</b> Không ưng ý đoạn nào? Bấm ""Sửa / Viết lại"", nhập ý muốn của bạn, AI sẽ sửa lại ngay lập tức cho đến khi bạn hài lòng.</li>
                  <li><b>Đa thị trường:</b> Hỗ trợ làm content cho cả Việt Nam và Global (US). Cấu hình tên Kênh/MC tự động chuyển đổi theo ngôn ngữ bạn chọn.</li>
                  <li><b>Bảo mật & Ổn định:</b> Sử dụng API Key cá nhân của bạn. Hệ thống hỗ trợ nhập nhiều key dự phòng để tự động chuyển đổi khi hết hạn ngạch (quota).</li>
                </ul>
            </div>
          )}

          {/* Tab Content: Hướng dẫn chi tiết */}
          {activeGuideTab === 'guide' && (
            <div className="space-y-6 text-sm animate-in fade-in slide-in-from-right-4 duration-200 h-[60vh] overflow-y-auto pr-2">
              
              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>1</div>
                <div>
                  <div className="font-semibold text-base mb-1">Cấu hình ban đầu (Quan trọng)</div>
                  <ul className="list-disc list-inside opacity-80 space-y-1">
                    <li>Nhấn nút <b>API</b> trên góc phải để nhập Gemini API Key (bắt buộc).</li>
                    <li>Chọn ngôn ngữ (VN/US) bạn muốn làm video.</li>
                    <li>Nhập <b>Tên sách / Chủ đề</b> vào ô nhập liệu chính.</li>
                    <li>(Tùy chọn) Mở <b>Cấu hình thêm</b> để nhập Tên Kênh và Tên MC. Việc này giúp AI xưng hô tự nhiên hơn trong kịch bản (VD: "Chào mừng các bạn quay trở lại với kênh [Tên Kênh]...").</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>2</div>
                <div>
                  <div className="font-semibold text-base mb-1">Xây dựng khung nội dung</div>
                  <p className="opacity-80 mb-2">Bạn có 2 lựa chọn tại bước này:</p>
                  <div className={`grid grid-cols-2 gap-2 text-xs`}>
                     <div className={`p-2 rounded border ${theme.borderLight} ${theme.bgCard}/50`}>
                        <div className="font-bold text-sky-400 mb-1">Cách 1: AI tự nghĩ (Tạo sườn)</div>
                        Phù hợp khi bạn chỉ có mỗi tên sách. Nhấn nút <b>Phân tích & Tạo sườn</b>. AI sẽ chia nội dung thành các chương hồi logic.
                     </div>
                     <div className={`p-2 rounded border ${theme.borderLight} ${theme.bgCard}/50`}>
                        <div className="font-bold text-emerald-400 mb-1">Cách 2: Upload có sẵn</div>
                        Phù hợp khi bạn đã có file nội dung (.txt). Upload file lên, Tool sẽ tự động bỏ qua bước tạo sườn và bước viết truyện, cho phép bạn nhảy cóc đến bước Review.
                     </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>3</div>
                <div>
                  <div className="font-semibold text-base mb-1">Viết chi tiết & Chỉnh sửa</div>
                  <ul className="list-disc list-inside opacity-80 space-y-1">
                    <li>Nếu dùng Cách 1 (Tạo sườn): Nhấn <b>Viết Truyện (Theo sườn)</b>. AI sẽ viết chi tiết từng chương.</li>
                    <li><b>Tính năng mới:</b> Tại mục ""Nội dung truyện"", bạn có thể bấm nút <b>Sửa / Viết lại</b> để chỉnh sửa toàn bộ hoặc từng chương theo ý muốn.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3">
                <div className={`flex-none w-6 h-6 rounded-full ${theme.badge} text-white flex items-center justify-center font-bold text-xs`}>4</div>
                <div>
                  <div className="font-semibold text-base mb-1">Đóng gói & Xuất bản</div>
                  <ul className="list-disc list-inside opacity-80 space-y-1">
                    <li>Nhấn <b>Review Truyện</b> để AI đóng vai MC, chuyển đổi văn bản đọc thành văn bản nói (kịch bản thu âm).</li>
                    <li>Nhấn <b>Tạo SEO</b> để lấy Tiêu đề giật tít, Mô tả video chuẩn SEO Youtube và Hashtag.</li>
                    <li>Nhấn <b>Tạo Prompt</b> để lấy các câu lệnh vẽ hình.</li>
                  </ul>
                </div>
              </div>

            </div>
          )}

          <div className="pt-2 border-t border-gray-700 mt-4">
            <button onClick={() => setIsGuideModalOpen(false)} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
              Đóng hướng dẫn
            </button>
          </div>

        </div>
      </Modal>

      {/* Advanced Config Modal (Cover, Channel, MC) - Dual Language Aware */}
      <Modal 
        isOpen={isExtraConfigModalOpen} 
        onClose={handleSaveExtraConfig} 
        title={`Cấu hình nâng cao (${language === 'vi' ? 'Việt Nam' : 'English - US'})`}
      >
         <div className="space-y-4">
            <div className={`p-3 rounded-lg ${theme.bgCard}/50 border border-yellow-800/50 text-sm text-yellow-500`}>
              Dữ liệu này được lưu riêng cho chế độ <b>{language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (US)'}</b>. Khi bạn đổi ngôn ngữ ở màn hình chính, hệ thống sẽ tự động dùng cấu hình tương ứng.
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                Tên Kênh ({language === 'vi' ? 'VN' : 'US'})
                <Tooltip text="Tên kênh YouTube của bạn. AI sẽ nhắc đến tên kênh trong phần Chào mừng hoặc Kêu gọi đăng ký." />
              </label>
              <input 
                value={language === 'vi' ? channelNameVi : channelNameEn} 
                onChange={(e) => language === 'vi' ? setChannelNameVi(e.target.value) : setChannelNameEn(e.target.value)} 
                placeholder={language === 'vi' ? "VD: Sách Hay Mỗi Ngày..." : "Ex: Best Books Daily..."} 
                className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 outline-none transition-colors`} 
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                Tên MC / Người dẫn ({language === 'vi' ? 'VN' : 'US'})
                <Tooltip text="Tên người dẫn chuyện. AI sẽ sử dụng để xưng hô thân mật." />
              </label>
              <input 
                value={language === 'vi' ? mcNameVi : mcNameEn} 
                onChange={(e) => language === 'vi' ? setMcNameVi(e.target.value) : setMcNameEn(e.target.value)} 
                placeholder={language === 'vi' ? "VD: Minh Hạnh..." : "Ex: Sarah..."} 
                className={`w-full rounded-lg ${theme.bgCard}/70 border ${theme.border} px-3 py-2 outline-none transition-colors`} 
              />
            </div>

            <div className="border-t border-dashed border-gray-700 pt-4">
               <label className={`block text-sm font-medium ${theme.textAccent} mb-1 flex items-center`}>
                 Tải ảnh bìa (Chung)
                 <Tooltip text="Ảnh bìa sách để tham khảo (dùng chung cho cả 2 ngôn ngữ)." />
               </label>
               <input type="file" accept="image/*" onChange={handleFileUpload} className={`w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold ${theme.bgButton} ${theme.textHighlight} hover:file:${theme.bgCard}`} />
               {bookImage && <img src={bookImage} alt="cover" className={`mt-2 w-full max-w-xs mx-auto rounded-lg border ${theme.border}`} />}
            </div>

            <div className="pt-2">
               <button onClick={handleSaveExtraConfig} className={`w-full py-2 rounded font-semibold ${theme.buttonPrimary} text-white`}>
                 Lưu & Đóng
               </button>
            </div>
         </div>
      </Modal>

      {/* Library Modal */}
      <Modal
        isOpen={isLibraryModalOpen}
        onClose={() => setIsLibraryModalOpen(false)}
        title="Thư viện phiên làm việc"
      >
        <div className="space-y-4">
            {sessions.length === 0 ? (
                <Empty text="Chưa có phiên làm việc nào được lưu." />
            ) : (
                <div className="space-y-3">
                    {sessions.map((s) => (
                        <div key={s.id} onClick={() => handleLoadSession(s)} className={`p-3 rounded-lg border ${theme.border} ${theme.bgCard}/50 hover:${theme.bgButton} cursor-pointer transition flex items-center justify-between group`}>
                            <div>
                                <div className="font-semibold text-sm flex items-center gap-2">
                                    {s.bookTitle || "Chưa đặt tên"}
                                    <span className={`text-[10px] px-1.5 rounded border ${s.language === 'vi' ? 'border-sky-700 bg-sky-900/50 text-sky-200' : 'border-emerald-700 bg-emerald-900/50 text-emerald-200'}`}>
                                        {s.language.toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-xs opacity-60 mt-1">
                                    {new Date(s.lastModified).toLocaleString()} • {s.durationMin} phút
                                </div>
                            </div>
                            <button 
                                onClick={(e) => handleDeleteSession(s.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-full transition"
                                title="Xóa phiên này"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-1 1-1h6c0 0 1 0 1 1v2"/></svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}
             <div className="pt-2 border-t border-gray-800 text-xs opacity-60 text-center italic">
               Các phiên làm việc được lưu tự động trên trình duyệt này.
            </div>
        </div>
      </Modal>

      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
    </div>
  );
}
