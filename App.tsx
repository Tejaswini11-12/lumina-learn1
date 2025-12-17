
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import { View, UserProfileData, ScheduleItem } from './types';
import { 
  DashboardView, 
  SmartStudyView, 
  PracticeView, 
  ProgressView, 
  ScheduleView, 
  ProfileView,
  LumaLearnView
} from './components/Views';
import AuthView from './components/AuthView';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// Interface for Recent Learning Items
export interface Activity {
  title: string;
  time: string;
}

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
  const [user, setUser] = useState<User | null>(null);
  
  // AUTH READY GATE: Defaults to true. 
  // It effectively blocks the app from rendering until BOTH Auth and Profile Data are ready.
  const [loading, setLoading] = useState(true);
  
  const [initialPrompt, setInitialPrompt] = useState<string>('');
  const isHydrated = useRef(false);

  // Shared state for the topic entered on Dashboard
  const [focusTopic, setFocusTopic] = useState<string>('');
  
  // Centralized User Profile State
  // Initialize with empty strings. Data will be injected via onSnapshot BEFORE loading becomes false.
  const [userProfile, setUserProfile] = useState<UserProfileData>({
    displayName: '',
    email: '',
    region: '',
    educationLevel: '',
    subjects: [],
    goals: []
  });
  
  // Lifted Schedule State
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState<Date>(new Date());

  // Task 2: State for Recent Learning
  const [recentActivity, setRecentActivity] = useState<Activity[]>([
    { title: "Studied: Python Basics", time: "3 minutes ago" },
    { title: "Studied: Essay Structure", time: "1 hour ago" },
    { title: "Studied: Algebra Challenge", time: "Yesterday" }
  ]);

  // ---------------------------------------------------------------------------
  // 1. AUTH LISTENER
  // strictly handles User Authentication state.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // CRITICAL: User is logged in, but we DO NOT set loading to false yet.
        // We must wait for the Profile Listener to fetch data from Firestore.
        // This prevents the "Flash of Unstyled Content" or "Reset to Defaults" bug.
        setLoading(true);
      } else {
        setUser(null);
        // No user, so we are ready to show the AuthView immediately.
        setLoading(false);
        // Reset profile to clean state
        isHydrated.current = false;
        setUserProfile({
          displayName: '',
          email: '',
          region: '',
          educationLevel: '',
          subjects: [],
          goals: []
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // 2. PROFILE DATA LISTENER (Single Source of Truth)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // If no user, we don't need to listen for profile.
    if (!user?.uid) return;

    // HARD TIMEOUT FALLBACK
    // Ensure we don't block the UI forever if Firestore is unreachable/offline
    const safetyTimeout = setTimeout(() => {
        console.warn("Profile load timeout - releasing auth gate.");
        setLoading(false);
    }, 5000);

    const docRef = doc(db, 'users', user.uid);
    
    // Real-time listener for the user's profile document
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      clearTimeout(safetyTimeout);
      
      // HANDLE DATA: If doc exists, use it. If not, use empty object (allows defaults below).
      const data = docSnap.exists() ? docSnap.data() as any : {};
      
      // Legacy support for nested objects
      const p = data.profile || {};
      const lc = p.learningContext || {};
      const sg = p.studyGoals || {};

      // --- ROBUST GOALS PARSING ---
      let loadedGoals: string[] = [];
      const rootGoals = data.studyGoals; 
      const legacyGoals = sg.goals;

      if (rootGoals && typeof rootGoals === 'object' && !Array.isArray(rootGoals)) {
          // Parse Root Object Map -> UI Array
          if (rootGoals.improveUnderstanding) loadedGoals.push('Improve understanding');
          if (rootGoals.stayConsistent) loadedGoals.push('Stay consistent');
          if (rootGoals.learnInShortSessions) loadedGoals.push('Learn in short sessions');
      } else if (Array.isArray(rootGoals)) {
          loadedGoals = rootGoals;
      } else if (Array.isArray(legacyGoals)) {
          loadedGoals = legacyGoals;
      }
      
      // Determine Display Name Priority: Firestore -> Auth -> Empty
      const firestoreName = data.displayName || p.displayName;
      const finalName = (firestoreName && firestoreName.trim() !== '') 
        ? firestoreName 
        : (user.displayName || '');

      // SET STATE AUTHORITATIVELY
      setUserProfile({
        displayName: finalName,
        email: data.email || user.email || '',
        region: data.region || 'English (US)',
        educationLevel: data.educationLevel || lc.educationLevel || '',
        subjects: data.primarySubjects || lc.primarySubjects || [],
        goals: loadedGoals
      });

      // CRITICAL: DATA IS READY. LIFT THE GATE.
      // Only now do we allow the UI to render the dashboard/profile.
      setLoading(false);
      isHydrated.current = true;

    }, (error) => {
       console.error("Profile snapshot error:", error);
       clearTimeout(safetyTimeout);
       // Even on error, we must unblock the UI eventually
       setLoading(false); 
    });

    return () => {
        unsubscribe();
        clearTimeout(safetyTimeout);
    };
    // Re-run only if UID changes (e.g. login/logout)
  }, [user?.uid]);

  // Real-time Schedule Listener
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'users', user.uid, 'schedules'));
    const unsub = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const items = (snapshot as any).docs
        .map((d: any) => ({ id: d.id, ...d.data() } as ScheduleItem))
        .filter((item: ScheduleItem) => {
           if (!item.expiresAt) return true;
           let expiryDate;
           if (typeof item.expiresAt?.toDate === 'function') {
             expiryDate = item.expiresAt.toDate();
           } else {
             expiryDate = new Date(item.expiresAt);
           }
           return expiryDate > now;
        });
      setSchedules(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleProfileUpdate = async (updates: Partial<UserProfileData>) => {
    if (!user) return;
    
    // Snapshot previous state for rollback mechanism
    const previousProfile = { ...userProfile };
    
    // 1. Optimistic UI Update (Safe here because we are already hydrated)
    setUserProfile(prev => ({ ...prev, ...updates }));

    // 2. Prepare Firestore Payload
    const userRef = doc(db, 'users', user.uid);
    const payload: any = {};

    if (updates.displayName !== undefined) payload.displayName = updates.displayName;
    if (updates.educationLevel !== undefined) payload.educationLevel = updates.educationLevel;
    if (updates.subjects !== undefined) payload.primarySubjects = updates.subjects;
    if (updates.region !== undefined) payload.region = updates.region;
    if (updates.email !== undefined) payload.email = updates.email;
    
    if (updates.goals !== undefined) {
      payload.studyGoals = {
        improveUnderstanding: updates.goals.includes('Improve understanding'),
        stayConsistent: updates.goals.includes('Stay consistent'),
        learnInShortSessions: updates.goals.includes('Learn in short sessions')
      };
    }

    // 3. Persist to Firebase with Merge
    try {
      await setDoc(userRef, payload, { merge: true });
    } catch (e) {
      console.error("Failed to save profile changes:", e);
      setUserProfile(previousProfile);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // State reset handled in onAuthStateChanged
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleLaunchSession = (prompt: string) => {
    setInitialPrompt(prompt);
    setActiveView(View.LUMA_LEARN);
  };

  const handleAddActivity = (topic: string) => {
    const cleanTopic = topic.length > 35 ? topic.substring(0, 35) + '...' : topic;
    const newActivity: Activity = {
      title: `Studied: ${cleanTopic}`,
      time: 'Just now'
    };

    setRecentActivity(prev => {
      const updated = [newActivity, ...prev];
      return updated.slice(0, 5); 
    });
  };

  const handleNotificationClick = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    setScheduleSelectedDate(date);
    setActiveView(View.SCHEDULE);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 text-mint-400">
        <Loader2 className="animate-spin w-10 h-10" />
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  const renderView = () => {
    switch (activeView) {
      case View.DASHBOARD:
        return (
          <DashboardView 
            onNavigate={setActiveView} 
            onLaunchSession={handleLaunchSession}
            recentActivity={recentActivity}
            onAddActivity={handleAddActivity}
            focusTopic={focusTopic}
            setFocusTopic={setFocusTopic}
          />
        );
      case View.SMART_STUDY:
        return (
          <SmartStudyView 
            focusTopic={focusTopic}
            onLaunchSession={handleLaunchSession}
          />
        );
      case View.PRACTICE:
        return <PracticeView onLaunchSession={handleLaunchSession} />;
      case View.PROGRESS:
        return <ProgressView onNavigate={setActiveView} />;
      case View.SCHEDULE:
        return (
          <ScheduleView 
            schedules={schedules}
            selectedDate={scheduleSelectedDate}
            onDateSelect={setScheduleSelectedDate}
          />
        );
      case View.PROFILE:
        return (
          <ProfileView 
            onLogout={handleLogout} 
            profile={userProfile} 
            onUpdateProfile={handleProfileUpdate} 
          />
        );
      case View.LUMA_LEARN:
        return (
          <LumaLearnView 
            initialPrompt={initialPrompt} 
            onClearPrompt={() => setInitialPrompt('')}
            onAddActivity={handleAddActivity}
            profile={userProfile}
          />
        );
      default:
        return (
          <DashboardView 
            onNavigate={setActiveView} 
            onLaunchSession={handleLaunchSession} 
            recentActivity={recentActivity}
            onAddActivity={handleAddActivity}
            focusTopic={focusTopic}
            setFocusTopic={setFocusTopic}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 font-sans flex">
      {/* Sidebar Navigation */}
      <Sidebar activeView={activeView} onNavigate={setActiveView} />

      {/* Main Content */}
      <div className="flex-1 ml-20 lg:ml-64 transition-all">
        <TopBar 
          onProfileClick={() => setActiveView(View.PROFILE)} 
          activeView={activeView} 
          schedules={schedules}
          onNotificationClick={handleNotificationClick}
          onNavigate={setActiveView}
        />
        
        <main className="px-6 lg:px-10 pb-12 max-w-7xl mx-auto">
           {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
