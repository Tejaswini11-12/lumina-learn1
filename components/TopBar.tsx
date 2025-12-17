
import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Clock, Calendar } from 'lucide-react';
import { View, ScheduleItem } from '../types';

interface TopBarProps {
  onProfileClick: () => void;
  activeView: View;
  schedules?: ScheduleItem[];
  onNotificationClick?: (date: string) => void;
  onNavigate: (view: View) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onProfileClick, activeView, schedules = [], onNotificationClick, onNavigate }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter and sort upcoming schedules
  const upcomingSchedules = schedules
    .filter(item => {
      const itemDate = new Date(`${item.date}T${item.startTime}`);
      return itemDate > new Date();
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5); // Limit to top 5

  const handleNotificationItemClick = (date: string) => {
    if (onNotificationClick) {
      onNotificationClick(date);
      setShowNotifications(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const searchTerm = e.currentTarget.value.trim().toLowerCase();
      
      const routeMap: Record<string, View> = {
        'home': View.DASHBOARD,
        'smart study': View.SMART_STUDY,
        'practice': View.PRACTICE,
        'progress': View.PROGRESS,
        'schedule': View.SCHEDULE,
        'profile': View.PROFILE,
        'settings': View.PROFILE
      };

      const targetView = routeMap[searchTerm];

      if (targetView) {
        onNavigate(targetView);
      } else {
        alert("No matching page found");
      }
    }
  };

  return (
    <div className="h-20 w-full flex justify-between items-center px-8 mb-4 relative z-40">
       {(activeView === View.DASHBOARD || activeView === View.PROFILE) ? (
         <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-full text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mint-100 shadow-sm"
              onKeyDown={handleSearchKeyDown}
            />
         </div>
       ) : (
         <div className="flex-1" />
       )}

       <div className="flex items-center gap-4">
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2 transition-colors relative ${showNotifications ? 'text-gray-600 bg-gray-100 rounded-full' : 'text-gray-400 hover:text-gray-600'}`}
            >
               <Bell size={20} />
               {upcomingSchedules.length > 0 && (
                 <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-400 rounded-full border border-white"></span>
               )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 text-sm">Upcoming Schedules</h3>
                  <span className="text-[10px] bg-mint-50 text-mint-600 px-2 py-0.5 rounded-full font-medium">{upcomingSchedules.length} New</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {upcomingSchedules.length > 0 ? (
                    upcomingSchedules.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleNotificationItemClick(item.date)}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0 group"
                      >
                        <div className="flex items-start gap-3">
                           <div className="p-2 bg-mint-50 text-mint-500 rounded-lg shrink-0 group-hover:bg-mint-100 transition-colors">
                             <Calendar size={16} />
                           </div>
                           <div>
                             <h4 className="text-sm font-semibold text-gray-800 leading-tight">{item.title}</h4>
                             <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                               <span>{item.date}</span> • <span>{item.startTime}</span>
                             </p>
                           </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-400">No upcoming schedules.</p>
                    </div>
                  )}
                </div>
                {upcomingSchedules.length > 0 && (
                   <div className="p-2 bg-gray-50 text-center border-t border-gray-100">
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700"
                      >
                        Close
                      </button>
                   </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={onProfileClick}
            className="w-10 h-10 rounded-full bg-yellow-100 border-2 border-white shadow-sm overflow-hidden hover:scale-105 transition-transform"
          >
            <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
          </button>
       </div>
    </div>
  );
};

export default TopBar;
