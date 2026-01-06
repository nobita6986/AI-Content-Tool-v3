
export type Language = 'vi' | 'en';

export interface OutlineItem {
  index: number;
  title: string;
  focus: string;
  actions: string[];
}

export interface StoryMetadata {
  femaleLead: string;
  maleLead: string;
  villain: string;
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
  bookIdea: string;
  bookImage: string | null;
  durationMin: number;
  isAutoDuration?: boolean;
  chaptersCount: number;
  frameRatio: string;
  storyMetadata?: StoryMetadata; // New field to store consistent names
  outline: OutlineItem[];
  storyBlocks: StoryBlock[];
  scriptBlocks: ScriptBlock[];
  seo: SEOResult | null;
  videoPrompts: string[];
  thumbTextIdeas: string[];
  evaluationResult?: string | null; // Store evaluation result
}
