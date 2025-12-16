
import React from 'react';
import { Home, BookOpen, PenTool, BarChart2, Calendar, MessageCircle } from 'lucide-react';
import { View } from '../types';

interface SidebarProps {
  activeView: View;
  onNavigate: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Home', icon: Home },
    { id: View.SMART_STUDY, label: 'Smart Study', icon: BookOpen },
    { id: View.PRACTICE, label: 'Practice', icon: PenTool },
    { id: View.PROGRESS, label: 'Progress', icon: BarChart2 },
    { id: View.LUMA_LEARN, label: 'Luma Learn', icon: MessageCircle, isNew: true },
    { id: View.SCHEDULE, label: 'Schedule', icon: Calendar },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-mint-50/80 backdrop-blur-xl border-r border-mint-100/50 p-4 flex flex-col z-50 transition-all">
      <button 
        onClick={() => onNavigate(View.DASHBOARD)} 
        className="mb-10 px-2 flex items-center gap-3 w-full hover:opacity-80 transition-opacity text-left outline-none"
      >
        <div className="w-8 h-8 bg-mint-300 rounded-lg shadow-sm shrink-0"></div>
        <span className="font-bold text-xl text-gray-800 hidden lg:block tracking-tight">Lumina Learn</span>
      </button>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-mint-300 text-white shadow-md shadow-mint-200'
                  : 'text-gray-500 hover:bg-white hover:text-gray-700 hover:shadow-sm'
              }`}
            >
              <item.icon size={22} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'} />
              <span className={`font-medium hidden lg:block ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              {item.isNew && !isActive && (
                <span className="hidden lg:block absolute right-3 w-2 h-2 bg-blue-400 rounded-full"></span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 bg-white/50 rounded-2xl hidden lg:block mb-4">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Daily Goal</p>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
          <div className="bg-mint-300 h-1.5 rounded-full" style={{ width: '65%' }}></div>
        </div>
        <p className="text-xs text-gray-500 text-right">65%</p>
      </div>
    </div>
  );
};

export default Sidebar;
