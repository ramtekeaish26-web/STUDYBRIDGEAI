import React from 'react';
import {
  Activity,
  BookOpen,
  Cloud,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Settings,
  X,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { NavScreen } from '../types/study';
import { calculateOverallMastery } from '../utils/mastery';
import { FocusTimerWidget } from './FocusTimerWidget';

interface NavItem {
  id: NavScreen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'simplifier', label: 'Concept Simplifier', icon: BookOpen },
  { id: 'quiz', label: 'Quiz Arena', icon: HelpCircle },
  { id: 'gaps', label: 'Learning Gap Detector', icon: Activity },
  { id: 'experiment', label: 'Experiment Lab', icon: FlaskConical },
  { id: 'tutor', label: 'Study Tutor', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const {
    activeScreen,
    setActiveScreen,
    masteryRecords,
    settings,
    user,
    syncStatus,
    authError,
    signInWithGoogle,
    signOutUser,
  } = useStudy();

  const overallMastery = calculateOverallMastery(masteryRecords);

  const handleSelect = (screen: NavScreen) => {
    setActiveScreen(screen);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-[#e8eaf0] p-5 space-y-5">
      <div className="space-y-5">
        {/* Brand Identity */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="neu-raised-sm flex h-10 w-10 shrink-0 items-center justify-center text-[#6366f1]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 17V7l8-4 8 4v10" />
                <path d="M4 17c2.5-1.8 5.5-1.8 8 0 2.5-1.8 5.5-1.8 8 0" />
                <path d="M12 3v14" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="block text-[17px] font-semibold tracking-tight text-[#1e2436]">
                STUDYBRIDGE
              </span>
              <span className="block text-[11px] text-[#5a6378]">
                Learn smarter. Grow faster.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="neu-btn flex h-10 w-10 items-center justify-center text-[#5a6378] lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary navigation" className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex w-full min-h-[42px] items-center gap-3 px-4 py-2 text-left text-[13.5px] whitespace-nowrap transition-all ${
                  isActive
                    ? 'neu-btn-active text-[#6366f1] font-semibold'
                    : 'neu-btn text-[#3d4558] hover:text-[#1e2436] font-medium'
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] shrink-0 ${
                    isActive ? 'text-[#6366f1]' : 'text-[#5a6378]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Global Focus Timer */}
        <FocusTimerWidget />
      </div>

      {/* Learner Mastery & Google Cloud Sync Footer */}
      <div className="space-y-3">
        <div className="neu-inset p-3.5">
          <div className="flex items-center justify-between text-xs text-[#5a6378]">
            <span>{settings.studentName}'s Mastery</span>
            <span className="font-mono-tabular font-semibold text-[#6366f1]">
              {overallMastery !== null ? `${overallMastery}%` : '—'}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-xl bg-[#dfe2ea] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08)]">
            <div
              className="h-full rounded-xl bg-[#6366f1] transition-all duration-300"
              style={{ width: `${overallMastery ?? 0}%` }}
            />
          </div>
        </div>

        <div className="neu-raised-sm p-3.5">
          {user ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Learner avatar'}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="neu-inset-sm flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-[#6366f1]">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#1e2436]">
                    {user.displayName || settings.studentName}
                  </p>
                  <p className="flex items-center gap-1 text-[11px] text-[#047857]">
                    <Cloud className="h-3 w-3 shrink-0" />
                    <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Cloud Synced'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOutUser()}
                aria-label="Sign out"
                title="Sign out"
                className="neu-btn flex h-9 w-9 shrink-0 items-center justify-center text-[#5a6378]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[#5a6378]">
                <span>Guest Workspace</span>
                <span>Local Cache</span>
              </div>
              <button
                type="button"
                onClick={() => signInWithGoogle().catch(() => {})}
                className="neu-btn flex min-h-[38px] w-full items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in with Google</span>
              </button>
            </div>
          )}

          {authError && (
            <p className="mt-2 text-[11px] text-[#b91c1c] leading-snug">
              {authError}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block lg:w-[288px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1e2436]/25 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-[296px] max-w-[88vw] bg-[#e8eaf0] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
