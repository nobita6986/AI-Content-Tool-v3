
export type Language = 'vi' | 'en';
export type StoryMode = 'romance' | 'non-romance';

export interface OutlineItem {
  index: number;
  title: string;
  focus: string;
  actions: string[];
}

export interface StoryMetadata {
  // Dynamic keys based on mode
  char1: string; // Romance: Female Lead, Non-Romance: Protagonist
  char2: string; // Romance: Male Lead, Non-Romance: Sidekick/Ally
  char3: string; // Romance: Villain, Non-Romance: Antagonist
  
  // Display labels for UI
  label1?: string; 
  label2?: string;
  label3?: string;
}

export interface StoryBlock {
  index: number;
  title: string;
  content: string;
}

export interface ScriptBlock {
  index: number;
  chapter: string;
  text: string;
  chars: number;
}

export interface SEOResult {
  titles: string[];
  hashtags: string[];
  keywords: string[];
  description: string;
}

export interface LoadingStates {
  outline: boolean;
  story: boolean;
  seo: boolean;
  script: boolean;
  prompts: boolean;
  evaluation: boolean;
}

export interface SavedSession {
  id: string;
  lastModified: number;
  bookTitle: string;
  language: Language;
  
  // New Configs
  storyMode: StoryMode;
  genre: string;

  bookIdea: string;
  bookImage: string | null;
  durationMin: number;
  isAutoDuration?: boolean;
  chaptersCount: number;
  frameRatio: string;
  storyMetadata?: StoryMetadata; 
  outline: OutlineItem[];
  storyBlocks: StoryBlock[];
  scriptBlocks: ScriptBlock[];
  seo: SEOResult | null;
  videoPrompts: string[];
  thumbTextIdeas: string[];
  evaluationResult?: string | null;
}
