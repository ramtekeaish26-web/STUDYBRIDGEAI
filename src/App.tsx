import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { StudyProvider, useStudy } from './context/StudyContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ConceptSimplifierView } from './components/ConceptSimplifierView';
import { QuizArenaView } from './components/QuizArenaView';
import { LearningGapDetectorView } from './components/LearningGapDetectorView';
import { ExperimentLabView } from './components/ExperimentLabView';
import { SolutionStudioView } from './components/SolutionStudioView';
import { StudyTutorView } from './components/StudyTutorView';
import { SettingsView } from './components/SettingsView';

const SCREEN_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  simplifier: 'Concept Simplifier',
  quiz: 'Quiz Arena',
  gaps: 'Learning Gap Detector',
  experiment: 'Experiment Lab',
  solutions: 'Solution Studio',
  tutor: 'Study Tutor',
  settings: 'Settings',
};

function StudyBridgeShell() {
  const { activeScreen } = useStudy();
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <DashboardView />;
      case 'simplifier':
        return <ConceptSimplifierView />;
      case 'quiz':
        return <QuizArenaView />;
      case 'gaps':
        return <LearningGapDetectorView />;
      case 'experiment':
        return <ExperimentLabView />;
      case 'solutions':
        return <SolutionStudioView />;
      case 'tutor':
        return <StudyTutorView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#e8eaf0] text-[#1e2436]">
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Mobile / Tablet Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-[#e8eaf0]/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="neu-btn flex h-11 w-11 items-center justify-center text-[#1e2436]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[#1e2436]">
            STUDYBRIDGE · {SCREEN_TITLES[activeScreen]}
          </span>
          <div className="w-11" aria-hidden="true" />
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudyProvider>
        <StudyBridgeShell />
      </StudyProvider>
    </ErrorBoundary>
  );
}
