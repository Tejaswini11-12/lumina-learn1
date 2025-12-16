
export enum View {
  DASHBOARD = 'dashboard',
  SMART_STUDY = 'smart_study',
  PRACTICE = 'practice',
  PROGRESS = 'progress',
  SCHEDULE = 'schedule',
  PROFILE = 'profile',
  LUMA_LEARN = 'luma_learn'
}

export enum ProfileTab {
  ACCOUNT = 'account'
}

export interface VideoGenerationState {
  isGenerating: boolean;
  progress: string;
  videoUri: string | null;
  error: string | null;
}

export interface UserProfileData {
  displayName: string;
  email: string;
  region: string;
  educationLevel: string;
  subjects: string[];
  goals: string[];
}

export interface ScheduleItem {
  id?: string;
  date: string; // YYYY-MM-DD
  title: string;
  startTime: string;
  endTime: string;
  type: 'reading' | 'practice' | 'assignment' | 'lecture';
  createdAt?: any;
  expiresAt?: any;
}

// Global declaration for the AI Studio key selection
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
