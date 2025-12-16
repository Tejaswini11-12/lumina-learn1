
import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Calendar, TrendingUp, Zap, BookOpen, ChevronRight, 
  MoreHorizontal, Star, Award, Target, Settings, Shield, LogOut,
  Bell, Layout, CheckCircle, Circle, ArrowRight, Lightbulb, PlayCircle, User, Key, Save,
  ArrowUp, X, Lock, Mail, Globe, AlertTriangle, Loader2, Edit2, Plus, Check, Send, Sparkles,
  Flame, BarChart2, Activity as ActivityIcon, Book, Beaker, PenTool, Monitor, MessageCircle, Video, Paperclip
} from 'lucide-react';
import { ProfileTab, View, UserProfileData, ScheduleItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { auth, db } from '../firebaseConfig';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { 
  updateEmail, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  deleteUser,
  User as FirebaseUser,
  verifyBeforeUpdateEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  addDoc 
} from 'firebase/firestore';
import { Activity } from '../App';
import VeoCreator from './VeoCreator';
import { fileToGenerativePart } from '../services/geminiService';

// --- Shared Components ---

const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }> = ({ children, className = "", ...props }) => (
  <div className={`bg-white rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] border border-gray-100 ${className}`} {...props}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">{title}</h2>
    {subtitle && <p className="text-gray-500 mt-1 font-light">{subtitle}</p>}
  </div>
);

const Badge: React.FC<{ text: string; color?: string; onDelete?: () => void }> = ({ text, color = "bg-mint-100 text-mint-500", onDelete }) => (
  <span className={`px-3 py-1 rounded-full text-xs font-medium ${color} flex items-center gap-1`}>
    {text}
    {onDelete && (
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="hover:text-red-500 transition-colors ml-1">
        <X size={12} />
      </button>
    )}
  </span>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' }> = ({ 
  children, variant = 'primary', className = '', ...props 
}) => {
  const base = "px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-mint-300 hover:bg-mint-400 text-white shadow-sm shadow-mint-200 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-cream-100 hover:bg-cream-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed",
    outline: "border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "bg-yellow-100 hover:bg-yellow-200 text-yellow-800 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "bg-transparent hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[24px] shadow-2xl p-6 w-full max-w-md animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// --- Dashboard View ---

interface DashboardProps {
  onNavigate: (view: View) => void;
  onLaunchSession: (topic: string) => void;
  recentActivity: Activity[];
  onAddActivity: (topic: string) => void;
  focusTopic: string;
  setFocusTopic: (topic: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ 
  onNavigate, 
  onLaunchSession, 
  recentActivity,
  onAddActivity,
  focusTopic,
  setFocusTopic
}) => {
  const [focusTime, setFocusTime] = useState('15 minutes');

  const focusTimeOptions = [15, 30, 45, 60, 90, 120, 150, 180];

  const handleFocusSubmit = () => {
    if (!focusTopic.trim()) return;
    onAddActivity(focusTopic);
    onLaunchSession(`Create a focused study plan for the topic: ${focusTopic} based on a duration of ${focusTime}. Provide a step-by-step micro-learning schedule that fits within the selected study time.`);
  };

  const handleRecommendedClick = (topic: string) => {
    onAddActivity(topic);
    onLaunchSession(`Explain the topic: "${topic}" in a clear, concise way for a student.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <SectionTitle title="AI Student Dashboard" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold text-lg text-gray-800">Today's Focus Time</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="relative mb-3">
            <select 
              value={focusTime}
              onChange={(e) => setFocusTime(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl appearance-none outline-none focus:border-mint-300 text-gray-700"
            >
              {focusTimeOptions.map(min => (
                <option key={min} value={`${min} minutes`}>{min} minutes</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">▼</div>
          </div>
          
          <div className="relative">
             <input 
               type="text" 
               value={focusTopic}
               onChange={(e) => setFocusTopic(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleFocusSubmit()}
               placeholder="Enter a topic to focus on..."
               className="w-full p-4 pr-12 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-mint-300 text-gray-700 placeholder-gray-400"
             />
             <button 
               onClick={handleFocusSubmit}
               className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full text-mint-400 hover:text-mint-600 transition-colors"
             >
               <Send size={18} />
             </button>
          </div>

          <p className="mt-4 text-gray-500 text-sm">A quick focused session to boost your productivity.</p>
        </Card>

        <Card className="p-6 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-gray-800">Recommended for You</h3>
              <Target className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <div className="space-y-4">
            {[
              { icon: '𝑓x', color: 'bg-yellow-100 text-yellow-700', title: 'Advanced Calculus', sub: 'Priority Topic' },
              { icon: '🧬', color: 'bg-green-100 text-green-700', title: 'Biology: Cell Structure', sub: 'Priority Topic' },
              { icon: '📜', color: 'bg-blue-100 text-blue-700', title: 'History: Post-War Era', sub: 'Priority Topic' },
            ].map((item, i) => (
              <div 
                key={i} 
                onClick={() => handleRecommendedClick(item.title)}
                className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-serif ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">{item.title}</h4>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg text-gray-800">Your Recent Learning</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity.map((item, i) => (
              <div key={i} className="py-4 flex justify-between items-center animate-in fade-in slide-in-from-right-2">
                <span className="text-gray-700">{item.title}</span>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <div className="py-4 text-center text-gray-400 text-sm">No recent activity yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-6 flex flex-col items-center justify-center text-center">
          <h3 className="font-semibold text-xl text-gray-800 mb-2">Start a Smart Session</h3>
          <p className="text-gray-500 text-sm mb-6">AI-tailored to your current needs.</p>
          <Button className="w-full" onClick={() => onNavigate(View.LUMA_LEARN)}>Start Learning</Button>
        </Card>
      </div>
    </div>
  );
};

// --- Smart Study View ---

interface SmartStudyProps {
  focusTopic: string;
  onLaunchSession: (prompt: string) => void;
}

export const SmartStudyView: React.FC<SmartStudyProps> = ({ focusTopic, onLaunchSession }) => {
  const [selectedTime, setSelectedTime] = useState('15m');
  const [selectedLearningStyle, setSelectedLearningStyle] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [localTopic, setLocalTopic] = useState(focusTopic);
  const [selectedPlanStep, setSelectedPlanStep] = useState<number | null>(null);

  useEffect(() => {
    setLocalTopic(focusTopic);
  }, [focusTopic]);
  
  const timeOptions = ['15m', '30m', '45m', '60m', '90m', '120m', '150m', '180m'];
  const styleOptions = ['Step-by-step', 'Example way', 'Story way'];

  const planSteps = [
    { 
      id: 1, 
      title: "1. Quick Concept Recap 💡", 
      subtitle: "Review key formulas for calculus",
      icon: Lightbulb,
      defaultIconBg: "bg-yellow-50",
      defaultIconColor: "text-yellow-600"
    },
    { 
      id: 2, 
      title: "2. Focus on Weak Topic 🎯", 
      subtitle: "Deep dive into cellular respiration",
      icon: Target,
      defaultIconBg: "bg-mint-50",
      defaultIconColor: "text-mint-500"
    },
    { 
      id: 3, 
      title: "3. Short Practice Set ✏️", 
      subtitle: "Attempt 5 practice questions",
      icon: BookOpen,
      defaultIconBg: "bg-blue-50",
      defaultIconColor: "text-blue-500"
    }
  ];

  const handleStartSession = () => {
    if (!selectedLearningStyle || !selectedTime || !localTopic.trim()) {
      setShowError(true);
      return;
    }
    setShowError(false);

    const prompt = `Create a focused study session for the topic: ${localTopic} based on a duration of ${selectedTime}.
Use the user's preferred learning style: ${selectedLearningStyle}.
${selectedPlanStep ? `Focus particularly on step ${selectedPlanStep} of the plan.` : ''}

Follow this fixed structure:
1. Quick Concept Recap 💡 — Review key formulas for calculus  
2. Focus on Weak Topic 🎯 — Deep dive into cellular respiration  
3. Short Practice Set ✏️ — Attempt 5 practice questions  

Make the explanation follow the selected learning style format exactly.`;
    
    onLaunchSession(prompt);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
      <SectionTitle title="Selected Focus Time" subtitle="Optimized for your available time." />
      
      <Card className="p-8">
        <div className="flex justify-center mb-12">
          <div className="bg-gray-50 p-1 rounded-2xl flex gap-1 shadow-inner overflow-x-auto max-w-full">
            {timeOptions.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                  selectedTime === time 
                    ? 'bg-mint-300 text-white shadow-md' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center max-w-2xl mx-auto space-y-10">
           <div className="flex flex-col items-center text-center w-full">
             <h3 className="text-xl font-bold text-gray-800 mb-6">Your Personalized Study Plan</h3>
             <div className="w-full max-w-md mb-8">
               <input
                 type="text"
                 value={localTopic}
                 onChange={(e) => setLocalTopic(e.target.value)}
                 placeholder="Enter the topic you want to focus on..."
                 className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-mint-300 focus:ring-1 focus:ring-mint-300 text-gray-700 placeholder-gray-400 text-center transition-all"
               />
             </div>

             <div className="space-y-4 w-full">
                {planSteps.map((step) => {
                  const isSelected = selectedPlanStep === step.id;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setSelectedPlanStep(step.id)}
                      className={`w-full p-4 rounded-2xl flex flex-col items-center gap-3 transition-all duration-300 border-2 ${
                        isSelected 
                          ? 'bg-mint-300 border-mint-300 shadow-md scale-[1.02]' 
                          : 'bg-transparent border-transparent hover:bg-gray-50 hover:border-gray-100'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-colors ${
                         isSelected 
                           ? 'bg-white text-mint-500' 
                           : `${step.defaultIconBg} ${step.defaultIconColor}`
                      }`}>
                        <step.icon size={24} />
                      </div>
                      <div className="text-center">
                        <h4 className={`font-semibold text-lg transition-colors ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                          {step.title}
                        </h4>
                        <p className={`text-sm transition-colors ${isSelected ? 'text-mint-50' : 'text-gray-500'}`}>
                          {step.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
             </div>
           </div>

           <div className="w-full border-t border-gray-100 pt-8 text-center">
               <h4 className="font-semibold text-gray-800 mb-4">Learning Style: Choose your preferred method</h4>
               <div className="flex flex-wrap justify-center gap-3">
                 {styleOptions.map(style => (
                    <button
                        key={style}
                        onClick={() => { 
                            setSelectedLearningStyle(style); 
                            setShowError(false); 
                        }}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                            selectedLearningStyle === style
                            ? 'bg-mint-300 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                    >
                        {style}
                    </button>
                 ))}
               </div>
           </div>

           <div className="w-full flex flex-col items-center">
              <p className={`text-sm transition-colors duration-300 mb-4 ${showError ? 'text-red-500 font-medium animate-pulse' : 'text-gray-400 opacity-60'}`}>
                 Please select a Topic, Focus Time, and Learning Style before starting.
              </p>
              <Button className="w-full py-4 text-lg" onClick={handleStartSession}>
                Start Session <ArrowRight className="w-5 h-5" />
              </Button>
           </div>
        </div>
      </Card>
    </div>
  );
};

// --- Practice View ---

interface PracticeViewProps {
  onLaunchSession: (prompt: string) => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({ onLaunchSession }) => {
  const [selectedPracticeTime, setSelectedPracticeTime] = useState('15-minute');
  const [selectedLearningMode, setSelectedLearningMode] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setSelectedPracticeTime('15-minute');
  }, []);

  const handleStartSession = () => {
    if (!selectedLearningMode || !selectedPracticeTime) {
      setShowError(true);
      return;
    }
    setShowError(false);
    const prompt = `Start a practice session for the topic: General Adaptive Review, using the duration: ${selectedPracticeTime} and learning mode: ${selectedLearningMode}. \nProvide explanation + guided practice + 3-5 interactive questions.`;
    onLaunchSession(prompt);
  };

  const handleCardClick = (title: string) => {
    onLaunchSession(`Explain and practice questions for: ${title}`);
  };

  const practiceItems = [
    { level: 'Hard', color: 'bg-red-100 text-red-600', title: 'Cellular Respiration Pathways', desc: 'Analyze the net ATP yield from one molecule of glucose...', icon: '⏱️ Based on recent mistakes' },
    { level: 'Medium', color: 'bg-yellow-100 text-yellow-600', title: 'Calculus: Derivatives of Trig Functions', desc: 'Find the derivative of f(x) = sin(x)cos(x)...', icon: '↻ Review needed' },
    { level: 'Easy', color: 'bg-green-100 text-green-600', title: 'Historical Context: The Renaissance', desc: 'Identify the key figures in the Italian Renaissance...', icon: '📈 Warm up' }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <SectionTitle title="Adaptive Practice" subtitle="Questions tailored to your level and weak areas." />
        <Card className="p-6 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-mint-100 rounded-full text-mint-500">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Selected Focus Time</p>
                <h3 className="text-xl font-bold text-gray-800">{selectedPracticeTime} practice session</h3>
              </div>
            </div>
            <span className="px-3 py-1 bg-mint-100 text-mint-600 text-xs font-bold rounded-full">Optimized for you</span>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              Your Practice Set <span className="text-xs font-normal text-mint-500 bg-mint-50 px-2 py-0.5 rounded">AI Generated</span>
            </h3>
          </div>
          {practiceItems.map((item, i) => (
            <Card key={i} className="p-5 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]">
              <div onClick={() => handleCardClick(item.title)}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${item.color}`}>{item.level}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">{item.icon}</span>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-mint-400 transition-colors" size={20} />
                </div>
                <h4 className="font-semibold text-gray-800 mb-1">{item.title}</h4>
                <p className="text-gray-500 text-sm line-clamp-1">{item.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-6 lg:mt-20">
        <Card className="p-6 bg-pastel-blue/30 border-blue-100">
          <div className="flex gap-4">
             <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm h-fit">
               <Lightbulb size={20} />
             </div>
             <div>
               <h4 className="font-bold text-blue-900">Smart Hints</h4>
               <p className="text-sm text-blue-800/80 mt-1 leading-relaxed">Hints and explanations adapt as you practice to match your understanding.</p>
             </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-semibold text-gray-800">Learning Mode</h4>
          </div>
          <div className="space-y-2">
            {['Step-by-step', 'Example way', 'Story way'].map(mode => (
              <button
                key={mode}
                onClick={() => { setSelectedLearningMode(mode); setShowError(false); }}
                className={`w-full p-3 rounded-xl text-sm font-medium transition-all text-left flex items-center gap-3 ${
                  selectedLearningMode === mode 
                    ? 'bg-mint-300 text-white shadow-md' 
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                 <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                   selectedLearningMode === mode ? 'border-white' : 'border-gray-400'
                 }`}>
                    {selectedLearningMode === mode && <div className="w-2 h-2 bg-white rounded-full" />}
                 </div>
                 {mode}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-8 text-center flex flex-col items-center gap-4">
           <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-mint-500 mb-2">
             <PlayCircle size={32} />
           </div>
           <div>
             <h3 className="font-bold text-gray-800 text-lg">Ready to start?</h3>
             <p className="text-gray-500 text-sm">Take a deep breath. You've got this!</p>
           </div>
           {showError && (
             <p className="text-red-500 text-xs animate-pulse">Please select a learning mode first.</p>
           )}
           <Button className="w-full" onClick={handleStartSession}>
             Start Practice Session <ArrowRight size={18} />
           </Button>
        </Card>

        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex gap-3">
           <div className="text-yellow-600 mt-0.5"><Lightbulb size={16} /></div>
           <p className="text-xs text-yellow-800 leading-relaxed">
             <span className="font-semibold">Tip:</span> Consistent short sessions are more effective than long cramming sessions.
           </p>
        </div>
      </div>
    </div>
  );
};

// --- Progress View ---

interface ProgressViewProps {
  onNavigate: (view: View) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ onNavigate }) => {
  const defaultStats = {
    streak: 1,
    sessionsThisWeek: 3,
    totalTime: 45,
    bestDay: 'Today',
    dailyAvg: 15,
    weeklyScores: [
      { name: 'Mon', score: 0 },
      { name: 'Tue', score: 30 },
      { name: 'Wed', score: 45 },
      { name: 'Thu', score: 60 },
      { name: 'Fri', score: 0 },
      { name: 'Sat', score: 0 },
      { name: 'Sun', score: 0 },
    ],
    habitTrend: [
      { name: 'Mon', v: 1 },
      { name: 'Tue', v: 2 },
      { name: 'Wed', v: 4 },
      { name: 'Thu', v: 3 },
      { name: 'Fri', v: 5 },
      { name: 'Sat', v: 2 },
      { name: 'Sun', v: 6 },
    ],
    improvements: [
      { title: 'Momentum Builder', sub: 'Started a new learning streak.', icon: 'Zap', color: 'bg-yellow-100 text-yellow-600' },
      { title: 'Curious Mind', sub: 'Explored 2 new topics.', icon: 'BookOpen', color: 'bg-blue-100 text-blue-600' },
    ],
    recentLogs: [
      { day: 'Today', title: 'Session started', bg: 'bg-mint-50' },
    ]
  };

  const [stats, setStats] = useState<any>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    let msg = "Keep learning!";
    if (hour < 12) msg = "You're a morning learning machine! ☀️";
    else if (hour < 18) msg = "Afternoon power sessions work best for you. ⚡";
    else msg = "Night owl mode activated. 🦉";
    setInsight(msg);

    const safeTimeout = setTimeout(() => {
        if (loading) setLoading(false);
    }, 2500);

    let unsubscribe = () => {};

    if (auth.currentUser) {
      try {
        unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), 
            (docSnap) => {
                const data = docSnap.data() as any;
                if (docSnap.exists() && data?.stats) {
                    setStats(data.stats);
                }
                setLoading(false);
            },
            (error) => {
                console.warn("Firestore snapshot error (offline?):", error);
                setLoading(false);
            }
        );
      } catch (e) {
          console.error(e);
          setLoading(false);
      }
    } else {
        setLoading(false);
    }
    
    return () => {
        unsubscribe();
        clearTimeout(safeTimeout);
    };
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap': return <Zap size={20} />;
      case 'BookOpen': return <BookOpen size={20} />;
      case 'Target': return <Target size={20} />;
      case 'Crown': return <Award size={20} />;
      default: return <Star size={20} />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        <SectionTitle title="Learning Consistency" subtitle='"Consistency is what transforms average into excellence."' />
        
        <Card className="p-6 bg-white border-none shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={120} className="text-orange-300" />
          </div>
          <div className="flex items-center gap-5 relative z-10">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shadow-sm border border-orange-100">
              <Flame size={32} className="animate-pulse" fill="currentColor" />
            </div>
            <div>
              <h3 className="font-bold text-2xl text-gray-800 flex items-center gap-2">
                {stats.streak} Day Streak
              </h3>
              <p className="text-gray-500 text-sm">You're on fire! Keep it up to earn a badge.</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="p-6 bg-mint-50/50 border-mint-100 flex flex-col justify-between">
             <div className="flex items-start gap-3 mb-4">
               <div className="p-2 bg-white rounded-lg text-mint-500 shadow-sm"><Calendar size={20} /></div>
               <div>
                 <h2 className="text-3xl font-bold text-gray-800">{stats.sessionsThisWeek}</h2>
                 <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-semibold">Sessions This Week</p>
               </div>
             </div>
             <div className="space-y-1.5 pt-3 border-t border-mint-200/50">
               <div className="flex justify-between text-xs text-gray-600">
                 <span>Total Time</span>
                 <span className="font-semibold text-mint-700">{stats.totalTime}m</span>
               </div>
               <div className="flex justify-between text-xs text-gray-600">
                 <span>Best Day</span>
                 <span className="font-semibold text-mint-700">{stats.bestDay}</span>
               </div>
               <div className="flex justify-between text-xs text-gray-600">
                 <span>Daily Avg</span>
                 <span className="font-semibold text-mint-700">{stats.dailyAvg}m</span>
               </div>
             </div>
          </Card>
          
          <Card className="p-6 bg-blue-50/50 border-blue-100 overflow-hidden relative flex flex-col">
             <div className="flex items-start gap-3 mb-2 relative z-10">
               <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm"><TrendingUp size={20} /></div>
               <div>
                 <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1">Growing 🌱</h2>
                 <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-semibold">Habit Strength</p>
               </div>
             </div>
             <div className="flex-1 w-full mt-2 min-h-[80px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats.habitTrend}>
                    <Bar dataKey="v" fill="#93C5FD" radius={[3,3,0,0]} animationDuration={1500}>
                      {stats.habitTrend.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fillOpacity={0.6 + (index * 0.1)} />
                      ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </Card>
        </div>

        <div className="h-64 mt-4 bg-white rounded-3xl p-4 border border-gray-100 shadow-sm">
           <div className="mb-4 flex justify-between items-center px-2">
              <h4 className="text-sm font-semibold text-gray-700">Weekly Performance</h4>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-md">Last 7 Days</span>
           </div>
           <ResponsiveContainer width="100%" height="85%">
             <BarChart data={stats.weeklyScores}>
               <XAxis 
                 dataKey="name" 
                 axisLine={false} 
                 tickLine={false} 
                 tick={{fontSize: 11, fill: '#9CA3AF'}} 
                 dy={10}
               />
               <Tooltip 
                 cursor={{fill: '#F3F4F6', radius: 4}} 
                 contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontSize: '12px'}} 
               />
               <Bar dataKey="score" radius={[6, 6, 6, 6]} barSize={32} animationDuration={1000}>
                 {stats.weeklyScores.map((entry: any, index: number) => (
                   <Cell key={`cell-${index}`} fill={entry.score > 70 ? '#A9CEA2' : '#E5E7EB'} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-xl text-gray-800">What's Improving</h3>
          <span className="text-xs font-medium text-mint-600 bg-mint-50 px-3 py-1 rounded-full animate-pulse">Live Analysis</span>
        </div>

        <Card className="p-6 space-y-5">
           {stats.improvements && stats.improvements.map((item: any, i: number) => (
             <div key={i} className="flex gap-4 group cursor-default">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                 {getIcon(item.icon)}
               </div>
               <div>
                 <h4 className="font-semibold text-gray-800 group-hover:text-mint-600 transition-colors">{item.title}</h4>
                 <p className="text-xs text-gray-500 mt-1">{item.sub}</p>
               </div>
             </div>
           ))}
           <div className="pt-4 mt-2 border-t border-gray-50">
             <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 text-xs text-gray-700 flex items-center gap-3 border border-yellow-100/50 shadow-sm">
               <Lightbulb className="text-yellow-500 shrink-0" size={18} />
               <span><strong>Insight:</strong> {insight}</span>
             </div>
           </div>
        </Card>

        <div className="mt-8">
          <h3 className="font-semibold text-xl text-gray-800 mb-4">Recent Progress</h3>
          <div className="grid grid-cols-1 gap-3">
             {stats.recentLogs && stats.recentLogs.map((item: any, i: number) => (
               <div key={i} className={`${item.bg || 'bg-gray-50'} p-4 rounded-2xl flex items-center justify-between group hover:shadow-sm transition-all`}>
                 <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{item.day}</p>
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{item.title}</p>
                 </div>
                 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-300 group-hover:text-mint-500 transition-colors">
                    <CheckCircle size={16} />
                 </div>
               </div>
             ))}
          </div>
        </div>

        <Button 
          className="w-full py-4 text-lg mt-4 bg-mint-300 hover:bg-mint-400 shadow-mint-200 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]" 
          onClick={() => onNavigate(View.LUMA_LEARN)}
        >
          <div className="flex items-center gap-2">
            Continue Learning <ArrowRight size={20} />
          </div>
        </Button>
      </div>
    </div>
  );
};

// --- Schedule View ---

interface ScheduleViewProps {
  schedules: ScheduleItem[];
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ schedules, selectedDate, onDateSelect }) => {
  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  
  // Local state for calendar navigation only
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  // Sync calendar view when selectedDate changes externally (e.g. from notification)
  useEffect(() => {
    setCurrentDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);
  
  // Form State
  const [formSubject, setFormSubject] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formType, setFormType] = useState<'reading' | 'practice' | 'assignment' | 'lecture'>('reading');

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];
    // Pad previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, isPrevMonth: true, fullDate: new Date(year, month - 1, daysInPrevMonth - i) });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isPrevMonth: false, fullDate: new Date(year, month, i) });
    }
    // Pad next month
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, isPrevMonth: true, isNextMonth: true, fullDate: new Date(year, month + 1, i) });
    }
    return days;
  };

  const getVisibleDays = () => {
    const allDays = generateCalendarDays(currentDate);
    if (viewMode === 'month') return allDays;

    const selectedTime = selectedDate.getTime();
    let weekRow = allDays.slice(0, 7);
    
    for (let i = 0; i < allDays.length; i += 7) {
      const chunk = allDays.slice(i, i + 7);
      if (chunk.some(d => d.fullDate.toDateString() === selectedDate.toDateString())) {
        weekRow = chunk;
        break;
      }
    }
    return weekRow;
  };

  const visibleDays = getVisibleDays();

  const handleMonthNav = (dir: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (dir === 'next' ? 1 : -1));
    setCurrentDate(newDate);
    // Optional: Auto-select first day of new month when navigating?
    // Let's stick to just navigating the view, but if user clicks a date it updates.
  };

  const handleDateClick = (day: any) => {
    onDateSelect(day.fullDate);
    if (day.isPrevMonth || day.isNextMonth) {
        setCurrentDate(new Date(day.fullDate.getFullYear(), day.fullDate.getMonth(), 1));
    }
  };

  const handleAddSchedule = () => {
    setEditingItem(null);
    setFormDate(formatDate(selectedDate));
    setFormSubject('');
    setFormStartTime('09:00');
    setFormEndTime('10:00');
    setFormType('reading');
    setIsModalOpen(true);
  };

  const handleEditSchedule = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormDate(item.date);
    setFormSubject(item.title);
    setFormStartTime(item.startTime);
    setFormEndTime(item.endTime);
    setFormType(item.type);
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!auth.currentUser || !formSubject) return;

    // Optimistic Update: Close immediately
    setIsModalOpen(false);

    try {
      // Calculate Expiry (End of selected day)
      // Use parts to avoid UTC shifting
      const [y, m, d] = formDate.split('-').map(Number);
      
      // Update the active selected date to the one being saved so the panel updates immediately
      const newActiveDate = new Date(y, m - 1, d);
      onDateSelect(newActiveDate);

      const expiryDate = new Date(y, m - 1, d);
      expiryDate.setHours(23, 59, 59, 999);

      const scheduleData = {
        date: formDate,
        title: formSubject,
        startTime: formStartTime,
        endTime: formEndTime,
        type: formType,
        createdAt: new Date(),
        expiresAt: expiryDate
      };

      // Background Write
      if (editingItem && editingItem.id) {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'schedules', editingItem.id), scheduleData, { merge: true });
      } else {
        // Use addDoc to generate a unique ID for each new schedule
        // This prevents overwriting existing schedules on the same day
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'schedules'), scheduleData);
      }
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  const handleDeleteSchedule = async () => {
      if (!auth.currentUser || !editingItem || !editingItem.id) return;
      setIsModalOpen(false);
      try {
          await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'schedules', editingItem.id));
      } catch (e) { console.error(e); } 
  }

  // Filter daily schedules based on passed props
  const selectedDateStr = formatDate(selectedDate);
  const dailySchedules = schedules.filter(s => s.date === selectedDateStr);

  const getTypeStyles = (type: string) => {
    switch(type) {
        case 'reading': return { color: "bg-gray-100 text-gray-500", iconBg: "bg-white", icon: Book };
        case 'practice': return { color: "bg-mint-50 border border-mint-100 text-gray-800", iconBg: "bg-mint-100 text-mint-600", icon: Beaker };
        case 'assignment': return { color: "bg-blue-50 border border-blue-100 text-blue-800", iconBg: "bg-blue-100 text-blue-600", icon: PenTool };
        default: return { color: "bg-purple-50 border border-purple-100 text-purple-800", iconBg: "bg-purple-100 text-purple-600", icon: Monitor };
    }
  };

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-start mb-2">
          <SectionTitle title="Schedule" subtitle="Manage your learning sessions and stay on track." />
          <div className="bg-gray-50 p-1 rounded-xl flex">
            <button 
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
                Week
            </button>
            <button 
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
                Month
            </button>
          </div>
        </div>

        <Card className="p-8">
           <div className="flex items-center justify-between mb-8 px-2">
             <button onClick={() => handleMonthNav('prev')} className="p-2 hover:bg-gray-50 rounded-full text-gray-400"><ChevronRight className="rotate-180" size={20} /></button>
             <h3 className="font-semibold text-lg text-gray-800">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
             <button onClick={() => handleMonthNav('next')} className="p-2 hover:bg-gray-50 rounded-full text-gray-400"><ChevronRight size={20} /></button>
           </div>
           
           <div className="grid grid-cols-7 mb-4">
             {weekDays.map(day => (
               <div key={day} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">
                 {day}
               </div>
             ))}
           </div>

           <div className="grid grid-cols-7 gap-y-6 gap-x-2">
              {visibleDays.map((dayObj, index) => {
                const isSelected = dayObj.fullDate.toDateString() === selectedDate.toDateString();
                const isGray = dayObj.isPrevMonth || dayObj.isNextMonth;
                
                return (
                  <div key={index} className="flex justify-center">
                    <div 
                        onClick={() => handleDateClick(dayObj)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all cursor-pointer ${
                        isGray 
                            ? 'text-gray-300' 
                            : isSelected 
                            ? 'bg-mint-300 text-white shadow-md shadow-mint-100' 
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {dayObj.day}
                    </div>
                  </div>
                );
              })}
           </div>
        </Card>

        <Button className="w-full py-4 text-lg" onClick={handleAddSchedule}>Add Schedule</Button>
      </div>

      <div className="space-y-6 mt-20 lg:mt-0">
         <div className="h-[20px] lg:hidden"></div> {/* Spacer for mobile alignment */}
         <h3 className="font-semibold text-lg text-gray-800 mb-4">Daily Schedule</h3>
         
         <div className="space-y-4">
            {dailySchedules.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-gray-100">
                    No schedules for this day.
                </div>
            ) : (
                dailySchedules.map((item, i) => {
                    const style = getTypeStyles(item.type);
                    const Icon = style.icon;
                    return (
                        <Card key={i} className={`p-4 flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity ${style.color}`} onClick={() => handleEditSchedule(item)} >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.iconBg}`}>
                                <Icon size={20} className={item.type === 'reading' ? "text-gray-400" : ""} />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-800 text-sm">{item.title}</h4>
                                <p className="text-xs opacity-70 mt-0.5">{item.startTime} - {item.endTime}</p>
                            </div>
                        </Card>
                    );
                })
            )}
         </div>
      </div>

      {/* Reusing the Modal Component for Add/Edit Schedule */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Schedule" : "Add Schedule"}>
         <div className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Subject / Title</label>
                <input type="text" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700" placeholder="e.g. Math Revision" />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Date</label>
                <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700" />
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Start Time</label>
                    <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">End Time</label>
                    <input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700" />
                </div>
            </div>
            <div>
                 <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Type</label>
                 <select value={formType} onChange={(e) => setFormType(e.target.value as any)} className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700 appearance-none bg-white">
                    <option value="reading">Reading</option>
                    <option value="practice">Practice</option>
                    <option value="assignment">Assignment</option>
                    <option value="lecture">Lecture</option>
                 </select>
            </div>
            
            <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                {editingItem && (
                     <Button variant="danger" onClick={handleDeleteSchedule} className="px-4" title="Delete"><X size={18} /></Button>
                )}
                <Button variant="primary" onClick={handleSaveSchedule} className="flex-1">Save</Button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

// --- Profile View ---

interface ProfileViewProps {
  onLogout: () => void;
  profile: UserProfileData;
  onUpdateProfile: (data: Partial<UserProfileData>) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onLogout, profile, onUpdateProfile }) => {
  const [formData, setFormData] = useState(profile);
  
  // Local state for inline name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Local state for context editing
  const [isEditingEducation, setIsEditingEducation] = useState(false);
  const [isEditingSubjects, setIsEditingSubjects] = useState(false);

  // Email Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  // Region Modal State
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'updating' | 'success' | 'error'>('idle');
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    setFormData(profile);
    if (!isEmailModalOpen) {
       setEmailInput(profile.email);
    }
  }, [profile, isEmailModalOpen]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  const reauthenticateUser = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return false;
    // Using window.prompt since we cannot change the UI structure significantly
    const password = window.prompt("Security check: Please enter your current password to continue.");
    if (!password) return false; 

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      return true;
    } catch (e) {
      console.error("Re-authentication failed", e);
      return false;
    }
  };

  const saveName = async () => {
    setIsEditingName(false);
    const newName = formData.displayName;
    
    // Only save if changed and not empty
    if (newName && newName.trim() !== profile.displayName) {
        // 1. Optimistic Update
        setFormData(prev => ({ ...prev, displayName: newName }));

        try {
            // 2. Auth Update
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: newName });
            }
            // 3. Firestore Update
            onUpdateProfile({ displayName: newName });
        } catch (error) {
            console.error("Name update failed", error);
            // Revert UI on error (rely on parent prop or manual reset)
            setFormData(prev => ({ ...prev, displayName: profile.displayName }));
            alert("Failed to update name. Please try again.");
        }
    } else {
        // Revert if empty or unchanged
         setFormData(prev => ({ ...prev, displayName: profile.displayName }));
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          saveName();
      } else if (e.key === 'Escape') {
          setIsEditingName(false);
          setFormData(prev => ({ ...prev, displayName: profile.displayName }));
      }
  };

  const saveEducation = (newVal: string) => {
    if (newVal !== formData.educationLevel) {
        setFormData(prev => ({ ...prev, educationLevel: newVal }));
        onUpdateProfile({ educationLevel: newVal });
    }
    setIsEditingEducation(false);
  };

  const saveSubjects = (valString: string) => {
    const newArray = valString.split(',').map(s => s.trim()).filter(Boolean);
    const isDifferent = JSON.stringify(newArray) !== JSON.stringify(formData.subjects);
    
    if (isDifferent) {
        setFormData(prev => ({ ...prev, subjects: newArray }));
        onUpdateProfile({ subjects: newArray });
    }
    setIsEditingSubjects(false);
  };

  const handleEdit = async (field: keyof UserProfileData, currentVal: any, label: string) => {
    if (field === 'email') {
        setIsEmailModalOpen(true);
        setEmailStatus('idle');
        setEmailMessage('');
        setEmailInput(formData.email);
        return;
    }

    if (field === 'region') {
        setIsRegionModalOpen(true);
        setSelectedRegion(formData.region || 'English (US)');
        return;
    }

    const newVal = prompt(`Edit ${label}:`, currentVal);
    if (newVal !== null && newVal !== currentVal) {
       // 1. Optimistic Update Local State
       const updated = { ...formData, [field]: newVal };
       setFormData(updated);

       // 2. Auth Updates (Critical for persistence of Name/Email)
       if (auth.currentUser) {
           try {
               if (field === 'displayName') {
                   await updateProfile(auth.currentUser, { displayName: newVal });
               } 
           } catch (e) {
               console.error("Auth update error:", e);
               // We don't revert optimistic update to keep UI responsive, 
               // but in production you might want to show an error.
           }
       }
       
       // 3. Propagate to App State & Firestore (Partial Update)
       onUpdateProfile({ [field]: newVal });
    }
  };

  const handleEmailSubmit = async () => {
    if (!auth.currentUser || !emailInput) return;
    
    if (emailInput === profile.email) {
         setEmailMessage("That is already your current email.");
         setEmailStatus('error'); 
         return;
    }

    setEmailStatus('sending');
    setEmailMessage('');

    try {
       await verifyBeforeUpdateEmail(auth.currentUser, emailInput);
       
       setEmailStatus('sent');
       setEmailMessage("Verification email sent. Please verify to continue.");
       
       onUpdateProfile({ email: emailInput });
       
    } catch (e: any) {
       console.error("Email update failed", e);
       
       if (e.code === 'auth/requires-recent-login') {
           const success = await reauthenticateUser();
           if (success) {
               try {
                   await verifyBeforeUpdateEmail(auth.currentUser, emailInput);
                   setEmailStatus('sent');
                   setEmailMessage("Verification email sent. Please verify to continue.");
                   onUpdateProfile({ email: emailInput });
               } catch (retryErr: any) {
                   setEmailStatus('error');
                   setEmailMessage(retryErr.message || "Failed to send verification email.");
               }
           } else {
               setEmailStatus('error');
               setEmailMessage("Authentication failed. Email not updated.");
           }
       } else {
           setEmailStatus('error');
           setEmailMessage(e.message || "Unable to update email. Please try again.");
       }
    }
  };

  const toggleGoal = (goal: string) => {
      const currentGoals = formData.goals || [];
      let newGoals;
      if (currentGoals.includes(goal)) {
          newGoals = currentGoals.filter(g => g !== goal);
      } else {
          newGoals = [...currentGoals, goal];
      }
      const updated = { ...formData, goals: newGoals };
      setFormData(updated);
      onUpdateProfile({ goals: newGoals });
  };
  
  const handleChangePasswordClick = () => {
      setIsPasswordModalOpen(true);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordStatus('idle');
      setPasswordMessage('');
  };

  const handlePasswordSubmit = async () => {
      if (newPasswordInput !== confirmPasswordInput) {
        setPasswordStatus('error');
        setPasswordMessage("Passwords do not match.");
        return;
      }
      if (newPasswordInput.length < 6) {
        setPasswordStatus('error');
        setPasswordMessage("Password must be at least 6 characters.");
        return;
      }

      setPasswordStatus('updating');
      setPasswordMessage("");

      try {
        if (auth.currentUser) {
           await updatePassword(auth.currentUser, newPasswordInput);
           setPasswordStatus('success');
           setPasswordMessage("Password updated. Logging out in 2s...");
           
           // Force Logout after short delay
           setTimeout(() => {
             onLogout();
           }, 2000);
        }
      } catch (e: any) {
        if (e.code === 'auth/requires-recent-login') {
            const reauthSuccess = await reauthenticateUser();
            if (reauthSuccess && auth.currentUser) {
                // Retry update
                try {
                    await updatePassword(auth.currentUser, newPasswordInput);
                    setPasswordStatus('success');
                    setPasswordMessage("Password updated. Logging out in 2s...");
                    setTimeout(() => onLogout(), 2000);
                } catch (retryErr: any) {
                     setPasswordStatus('error');
                     setPasswordMessage(retryErr.message || "Failed to update password.");
                }
            } else {
                 setPasswordStatus('error');
                 setPasswordMessage("Authentication failed. Password not updated.");
            }
        } else {
            setPasswordStatus('error');
            setPasswordMessage(e.message || "Failed to update password.");
        }
      }
  };

  const saveRegion = () => {
      onUpdateProfile({ region: selectedRegion });
      setFormData(prev => ({ ...prev, region: selectedRegion })); // Optimistic
      setIsRegionModalOpen(false);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <SectionTitle title="Profile & Settings" />

      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 shadow-sm border border-gray-100">
             <img src="https://picsum.photos/200/200" alt="Profile" className="w-full h-full object-cover" />
          </div>
          {/* Green Dot */}
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        </div>
        <div>
          <div className="flex items-center gap-2 h-8">
             {isEditingName ? (
                 <input 
                    ref={nameInputRef}
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    onBlur={saveName}
                    onKeyDown={handleNameKeyDown}
                    className="text-xl font-bold text-gray-900 bg-transparent border-b border-gray-300 focus:border-mint-500 outline-none p-0 w-full max-w-[200px]"
                 />
             ) : (
                 <>
                    <h2 className="text-xl font-bold text-gray-900 truncate max-w-[250px]">
                        {formData.displayName || 'Student'}
                    </h2>
                    <Edit2 
                        size={14} 
                        className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors shrink-0" 
                        onClick={() => setIsEditingName(true)}
                    />
                 </>
             )}
          </div>
          <p className="text-sm text-gray-500 font-normal mt-0.5">University Student</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Learning Context */}
        <Card className="p-6 h-full">
          <div className="flex justify-between items-center mb-6">
             <h3 className="font-bold text-gray-900 text-sm">Learning Context</h3>
             <BookOpen size={18} className="text-gray-400" />
          </div>
          <div className="space-y-6">
             <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">EDUCATION LEVEL</label>
                  <button 
                    onClick={() => setIsEditingEducation(true)}
                    className="text-[10px] font-medium text-mint-500 hover:text-mint-600 uppercase tracking-wider"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-2 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-800">
                   {isEditingEducation ? (
                       <select
                           autoFocus
                           value={formData.educationLevel}
                           onChange={(e) => saveEducation(e.target.value)}
                           onBlur={() => setIsEditingEducation(false)}
                           className="w-full bg-transparent outline-none -ml-1 cursor-pointer"
                       >
                           <option value="">Select Level</option>
                           <option value="High School">High School</option>
                           <option value="Undergraduate">Undergraduate</option>
                           <option value="Postgraduate">Postgraduate</option>
                           <option value="Lifelong Learner">Lifelong Learner</option>
                       </select>
                   ) : (
                       formData.educationLevel || 'Not set'
                   )}
                </div>
             </div>
             <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PRIMARY SUBJECTS</label>
                  <button 
                    onClick={() => setIsEditingSubjects(true)}
                    className="text-[10px] font-medium text-mint-500 hover:text-mint-600 uppercase tracking-wider"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-2 px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium text-gray-800">
                   {isEditingSubjects ? (
                       <input
                           autoFocus
                           type="text"
                           defaultValue={formData.subjects?.join(', ')}
                           onBlur={(e) => saveSubjects(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && saveSubjects(e.currentTarget.value)}
                           className="w-full bg-transparent outline-none"
                           placeholder="e.g. Math, Science"
                       />
                   ) : (
                       (formData.subjects && formData.subjects.length > 0) ? formData.subjects.join(', ') : 'Not set'
                   )}
                </div>
             </div>
          </div>
        </Card>

        {/* Study Goals */}
        <Card className="p-6 h-full">
          <div className="flex justify-between items-center mb-2">
             <h3 className="font-bold text-gray-900 text-sm">Study Goals</h3>
             <Target size={18} className="text-gray-400" />
          </div>
          <p className="text-xs text-gray-400 mb-6 font-normal">Select goals to help our AI tailor your daily lesson plans.</p>
          <div className="space-y-4">
             {['Improve understanding', 'Stay consistent', 'Learn in short sessions'].map(goal => {
                 const isActive = (formData.goals || []).includes(goal);
                 return (
                     <div 
                        key={goal} 
                        onClick={() => toggleGoal(goal)}
                        className="flex items-center gap-3 cursor-pointer group"
                     >
                        <div className={`rounded-full p-0.5 transition-colors ${isActive ? 'text-mint-500 bg-mint-50' : 'text-gray-300 bg-gray-100'}`}>
                           <CheckCircle size={20} className={`transition-colors ${isActive ? 'fill-mint-500 text-white' : 'fill-gray-300 text-white'}`} />
                        </div>
                        <span className={`text-sm font-medium transition-colors ${isActive ? 'text-gray-700' : 'text-gray-400'}`}>{goal}</span>
                     </div>
                 );
             })}
          </div>
        </Card>
      </div>

      {/* Language & Region */}
      <Card className="p-6 flex justify-between items-center">
         <div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">Language & Region</h3>
            <p className="text-xs text-gray-500">Current setting: <span className="text-gray-900 font-medium">{formData.region || 'English (US)'}</span></p>
         </div>
         <button 
            onClick={() => handleEdit('region', formData.region, 'Region')}
            className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
         >
            Change Region
         </button>
      </Card>

      {/* Account Information */}
      <Card className="p-6">
         <h3 className="font-bold text-gray-900 text-sm mb-6">Account Information</h3>
         <div className="space-y-0">
            <div className="flex justify-between items-center">
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
                  <p className="text-sm font-medium text-gray-800">{formData.email}</p>
               </div>
               <button 
                 onClick={() => handleEdit('email', formData.email, 'Email')}
                 className="px-4 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
               >
                 Edit
               </button>
            </div>
         </div>
      </Card>

      {/* Security Settings */}
      <Card className="p-6">
         <h3 className="font-bold text-gray-900 text-sm mb-6">Security Settings</h3>
         <div 
            onClick={handleChangePasswordClick}
            className="flex justify-between items-center cursor-pointer hover:bg-gray-50 -mx-6 px-6 py-2 transition-colors"
         >
            <span className="text-sm font-medium text-gray-700">Change password</span>
            <ChevronRight size={16} className="text-gray-400" />
         </div>
         <div className="mt-6 flex items-center gap-2 text-green-600 text-xs font-medium">
            <Shield size={14} />
            <span>Account security is up to date</span>
         </div>
      </Card>

      {/* Account Actions */}
      <Card className="p-6">
         <h3 className="font-bold text-gray-900 text-sm mb-1">Account Actions</h3>
         <p className="text-xs text-gray-500 mb-6 font-normal">Need to take a break? You can log out of your session.</p>
         <div className="flex gap-3">
            <button onClick={onLogout} className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
               <LogOut size={16} /> Logout
            </button>
         </div>
      </Card>
      
      {/* Email Update Modal */}
      <Modal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} title="Update Email Address">
         <div className="space-y-4">
             <p className="text-gray-500 text-sm">
                To ensure account security, we need to verify your new email address.
             </p>

             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">New Email Address</label>
                <input 
                    type="email" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={emailStatus === 'sent'}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700 disabled:opacity-60"
                    placeholder="new-email@example.com"
                />
                <p className="text-xs text-gray-400 mt-2 ml-1">
                   You’ll need to verify this email before it becomes active.
                </p>
             </div>

             {emailMessage && (
                <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${emailStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-mint-50 text-mint-600'}`}>
                    {emailStatus === 'error' ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
                    <span>{emailMessage}</span>
                </div>
             )}

             <div className="flex gap-3 pt-2">
                 <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} className="flex-1">
                     {emailStatus === 'sent' ? 'Close' : 'Cancel'}
                 </Button>
                 
                 {emailStatus === 'sent' ? (
                     <Button variant="secondary" onClick={handleEmailSubmit} className="flex-1">
                         Resend Link
                     </Button>
                 ) : (
                     <Button variant="primary" onClick={handleEmailSubmit} disabled={emailStatus === 'sending' || !emailInput} className="flex-1">
                         {emailStatus === 'sending' ? <Loader2 className="animate-spin" size={18} /> : (emailStatus === 'sent' ? 'Verification Sent' : 'Save Changes')}
                     </Button>
                 )}
             </div>
         </div>
      </Modal>

      {/* Region Update Modal */}
      <Modal isOpen={isRegionModalOpen} onClose={() => setIsRegionModalOpen(false)} title="Select Language & Region">
         <div className="space-y-6">
             <p className="text-gray-500 text-sm">
               Please select your preferred region and language format.
             </p>

             <div className="space-y-3">
               {['English (US)', 'English (UK)'].map(option => (
                 <div 
                   key={option}
                   onClick={() => setSelectedRegion(option)}
                   className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                     selectedRegion === option 
                       ? 'border-mint-300 bg-mint-50 text-mint-900' 
                       : 'border-gray-200 hover:border-mint-200 hover:bg-gray-50 text-gray-700'
                   }`}
                 >
                    <span className="font-medium">{option}</span>
                    {selectedRegion === option && (
                      <div className="w-5 h-5 bg-mint-400 rounded-full flex items-center justify-center text-white">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                 </div>
               ))}
             </div>

             <div className="flex gap-3 pt-2">
                 <Button variant="outline" onClick={() => setIsRegionModalOpen(false)} className="flex-1">Cancel</Button>
                 <Button variant="primary" onClick={saveRegion} className="flex-1">Save Changes</Button>
             </div>
         </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Change Password">
         <div className="space-y-5">
             <p className="text-gray-500 text-sm">
               Choose a strong password. You will be logged out after a successful update.
             </p>

             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">New Password</label>
                <input 
                    type="password" 
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700"
                    placeholder="Min 6 characters"
                    disabled={passwordStatus === 'success'}
                />
             </div>

             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Confirm New Password</label>
                <input 
                    type="password" 
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-mint-300 outline-none text-gray-700"
                    placeholder="Re-enter password"
                    disabled={passwordStatus === 'success'}
                />
             </div>

             {passwordMessage && (
                <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${passwordStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-mint-50 text-mint-600'}`}>
                    {passwordStatus === 'error' ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle size={16} className="shrink-0 mt-0.5" />}
                    <span>{passwordMessage}</span>
                </div>
             )}

             <div className="flex gap-3 pt-2">
                 <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)} className="flex-1" disabled={passwordStatus === 'success'}>Cancel</Button>
                 <Button variant="primary" onClick={handlePasswordSubmit} disabled={passwordStatus === 'updating' || passwordStatus === 'success' || !newPasswordInput} className="flex-1">
                     {passwordStatus === 'updating' ? <Loader2 className="animate-spin" size={18} /> : (passwordStatus === 'success' ? 'Updated!' : 'Update Password')}
                 </Button>
             </div>
         </div>
      </Modal>
    </div>
  );
};

// --- Luma Learn View ---

interface LumaLearnViewProps {
  initialPrompt: string;
  onClearPrompt: () => void;
  onAddActivity: (topic: string) => void;
  profile: UserProfileData;
}

// Define Extended Message Type
interface Message {
    role: 'user' | 'model';
    text: string;
    fileData?: {
        mimeType: string;
        data: string;
    };
}

export const LumaLearnView: React.FC<LumaLearnViewProps> = ({ initialPrompt, onClearPrompt, onAddActivity, profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'video'>('chat');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Use a ref for chat container to scroll to bottom
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) {
        handleSend(initialPrompt);
        onClearPrompt();
    }
  }, [initialPrompt]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Reset input value so same file can be selected again if cleared
      e.target.value = '';
    }
  };

  const handleSend = async (text: string) => {
    if ((!text.trim() && !selectedFile) || isLoading) return;
    
    // Construct user message object
    const userMsg: Message = { role: 'user', text };
    
    if (selectedFile) {
        try {
            if (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf') {
                const base64 = await fileToGenerativePart(selectedFile);
                userMsg.fileData = { mimeType: selectedFile.type, data: base64 };
            } else if (selectedFile.type === 'text/plain') {
                 const textContent = await selectedFile.text();
                 // Append text content to prompt for extraction
                 userMsg.text = `${text}\n\n[File Content of ${selectedFile.name}]:\n${textContent}`;
            } else {
                 // Fallback for DOCX or others: try base64 inline data
                 // Note: Gemini 1.5/2.5 often handles generic files if passed as inlineData,
                 // but text extraction is best. Given constraints, we attempt inlineData.
                 const base64 = await fileToGenerativePart(selectedFile);
                 userMsg.fileData = { mimeType: selectedFile.type, data: base64 };
            }
        } catch (e) {
            console.error("File processing error", e);
        }
    }

    setMessages(prev => [...prev, userMsg]);
    setSelectedFile(null); // Clear after sending
    setInput('');
    setIsLoading(true);
    
    // Log activity
    if (text.length > 10) onAddActivity(text.substring(0, 30));

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Reconstruct history with file data
        const history = messages.map(m => {
            const parts: any[] = [{ text: m.text }];
            if (m.fileData) {
                parts.push({ inlineData: m.fileData });
            }
            return { role: m.role, parts };
        });

        const chatSession = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: {
                systemInstruction: `You are Lumina, a helpful and encouraging AI study assistant. 
                User Profile: ${JSON.stringify(profile)}. 
                Tailor your explanations to their education level and subjects.`,
            }
        });
        
        // Prepare current message payload
        const currentParts: any[] = [{ text: userMsg.text }];
        if (userMsg.fileData) {
            currentParts.push({ inlineData: userMsg.fileData });
        }

        const result = await chatSession.sendMessageStream({ message: currentParts });
        
        let fullText = '';
        setMessages(prev => [...prev, { role: 'model', text: '' }]);
        
        for await (const chunk of result) {
            const chunkText = chunk.text; // Access directly via property
            if (chunkText) {
                fullText += chunkText;
                setMessages(prev => {
                    const newArr = [...prev];
                    newArr[newArr.length - 1].text = fullText;
                    return newArr;
                });
            }
        }
    } catch (error) {
        console.error("Chat error:", error);
        setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good Morning";
    if (hour >= 12 && hour < 17) return "Good Afternoon";
    if (hour >= 17 && hour < 22) return "Good Evening";
    return "Good Night";
  };

  const handleQuickAction = (text: string) => {
    setInput(text);
    if (inputRef.current) {
        inputRef.current.focus();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-in fade-in duration-500">
        <div className="flex items-center justify-between mb-4">
             <div>
                 <h2 className="text-2xl font-semibold text-gray-800 tracking-tight">Luma AI Tutor</h2>
             </div>
        </div>

        {mode === 'video' ? (
            <div className="flex-1 overflow-y-auto pr-2">
                <VeoCreator />
            </div>
        ) : (
            <div className="flex-1 flex flex-col bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden relative">
                {messages.length === 0 ? (
                    <div className="flex-1 w-full flex flex-col items-center justify-center p-8 text-center z-10 overflow-y-auto">
                        <div className="w-16 h-16 bg-mint-50 rounded-full flex items-center justify-center mb-6 text-mint-400">
                            <Sparkles size={28} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">{getGreeting()}, {profile.displayName || 'Scholar'} 👋</h2>
                        <p className="text-gray-400 mb-10">What would you like to work on today?</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                            {[
                                { icon: BookOpen, label: "Explain a topic", action: "Explain the topic: " },
                                { icon: Zap, label: "Revise quickly", action: "Quick revision for: " },
                                { icon: ActivityIcon, label: "Practice questions", action: "Practice questions on: " },
                                { icon: Star, label: "Motivate me", action: "Motivate me about: " }
                            ].map((item, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => handleQuickAction(item.action)}
                                    className="p-4 rounded-2xl border border-gray-100 hover:border-mint-200 hover:bg-mint-50/50 transition-all flex items-center gap-4 text-left group bg-white shadow-sm hover:shadow-md"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-mint-500 flex items-center justify-center transition-colors">
                                        <item.icon size={20} />
                                    </div>
                                    <span className="font-semibold text-gray-700 group-hover:text-gray-900">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 z-10">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-5 rounded-2xl shadow-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-mint-300 text-white rounded-br-none' 
                                    : 'bg-gray-50 text-gray-800 rounded-bl-none border border-gray-100'
                                }`}>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                    {msg.fileData && (
                                        <div className="mt-3 p-2 bg-white/20 rounded-lg text-xs flex items-center gap-2 border border-white/10">
                                            <Paperclip size={12} />
                                            <span>Attached File ({msg.fileData.mimeType.split('/')[1] || 'File'})</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                 <div className="bg-gray-50 p-4 rounded-2xl rounded-bl-none flex gap-3 items-center text-gray-500 border border-gray-100">
                                    <Loader2 className="animate-spin text-mint-400" size={18} /> Thinking...
                                 </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}
                
                {/* Chat Input */}
                <div className="p-6 bg-white border-t border-gray-50 z-20 mt-auto">
                    <div className="relative max-w-4xl mx-auto">
                        {/* File Name Display */}
                        {selectedFile && (
                            <div className="absolute bottom-full left-0 mb-3 ml-1 bg-mint-50 text-mint-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-mint-100 animate-in fade-in slide-in-from-bottom-2">
                                <Paperclip size={12} />
                                <span className="max-w-[200px] truncate font-medium">{selectedFile.name}</span>
                                <button onClick={() => setSelectedFile(null)} className="hover:bg-mint-100 rounded-full p-0.5"><X size={12} /></button>
                            </div>
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                            placeholder="Ask away... I don't judge 👀"
                            className="w-full pl-6 pr-24 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-mint-100 outline-none transition-all text-gray-700 placeholder-gray-400 shadow-inner"
                            disabled={isLoading}
                        />
                        
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                        />

                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="p-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 hover:text-gray-700 transition-all disabled:opacity-50"
                                title="Attach file"
                            >
                                <Plus size={20} />
                            </button>
                            <button 
                                onClick={() => handleSend(input)}
                                disabled={(!input.trim() && !selectedFile) || isLoading}
                                className="p-2.5 bg-white text-gray-400 rounded-xl hover:text-mint-500 hover:shadow-sm disabled:opacity-50 transition-all"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                    {messages.length === 0 && (
                        <p className="text-center text-[10px] text-gray-300 font-medium mt-4 flex justify-center items-center gap-1">
                             Your brain + me = power combo <Zap size={10} className="text-yellow-400 fill-yellow-400" />
                        </p>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
