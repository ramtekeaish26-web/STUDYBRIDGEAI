import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, Download, LogIn, LogOut, RotateCcw } from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import { LearningLevel } from '../types/study';

export function SettingsView() {
  const {
    settings,
    updateSettings,
    resetAllData,
    lessons,
    masteryRecords,
    quizAttempts,
    focusSessions,
    user,
    syncStatus,
    authError,
    signInWithGoogle,
    signOutUser,
  } = useStudy();

  const [nameDraft, setNameDraft] = useState<string>(settings.studentName);
  const [focusDraft, setFocusDraft] = useState<string>(settings.academicFocus);
  const [goalDraft, setGoalDraft] = useState<number>(settings.weeklyQuizGoal);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setNameDraft(settings.studentName);
    setFocusDraft(settings.academicFocus);
    setGoalDraft(settings.weeklyQuizGoal);
  }, [settings.studentName, settings.academicFocus, settings.weeklyQuizGoal]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showNotice = (msg: string) => {
    setSavedNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setSavedNotice(null), 2500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = nameDraft.trim() || 'Learner';
    const safeFocus = focusDraft.trim() || 'STEM Foundations';
    const safeGoal = Math.min(30, Math.max(1, Math.round(goalDraft || 1)));
    setNameDraft(safeName);
    setFocusDraft(safeFocus);
    setGoalDraft(safeGoal);
    updateSettings({
      studentName: safeName,
      academicFocus: safeFocus,
      weeklyQuizGoal: safeGoal,
    });
    showNotice('Preferences saved.');
  };

  const handleExportReport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      student: settings.studentName,
      academicFocus: settings.academicFocus,
      masteryRecords,
      quizAttempts,
      savedLessonsCount: lessons.length,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `studybridge-progress-${settings.studentName.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-[#1e2436]">Settings</h1>
        <p className="mt-1 text-sm text-[#5a6378]">
          Personalize your default learning level, language, study goals, and local progress data.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form onSubmit={handleSave} className="neu-raised p-6 space-y-5 lg:col-span-7">
          <h2 className="text-base font-semibold text-[#1e2436]">
            Learner Profile & Study Defaults
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="settings-name"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Student Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="neu-input mt-2 w-full px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="settings-focus"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Academic Focus
              </label>
              <input
                id="settings-focus"
                type="text"
                value={focusDraft}
                onChange={(e) => setFocusDraft(e.target.value)}
                className="neu-input mt-2 w-full px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="settings-level"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Default Level
              </label>
              <select
                id="settings-level"
                value={settings.defaultLevel}
                onChange={(e) =>
                  updateSettings({ defaultLevel: e.target.value as LearningLevel })
                }
                className="neu-input mt-2 w-full px-3.5 py-2.5 text-sm"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-language"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Default Language
              </label>
              <select
                id="settings-language"
                value={settings.defaultLanguage}
                onChange={(e) =>
                  updateSettings({ defaultLanguage: e.target.value })
                }
                className="neu-input mt-2 w-full px-3.5 py-2.5 text-sm"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Hindi">Hindi</option>
                <option value="Japanese">Japanese</option>
                <option value="Portuguese">Portuguese</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="settings-goal"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Weekly Quiz Goal
              </label>
              <input
                id="settings-goal"
                type="number"
                min={1}
                max={30}
                value={goalDraft}
                onChange={(e) =>
                  setGoalDraft(Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1))))
                }
                className="neu-input font-mono-tabular mt-2 w-full px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-2">
            <label className="neu-inset-sm flex cursor-pointer items-center justify-between gap-4 p-4">
              <div>
                <span className="block text-sm font-semibold text-[#1e2436]">
                  Show Instant Quiz Explanations
                </span>
                <span className="block text-xs text-[#5a6378]">
                  Reveal answer explanations immediately after submitting each question.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.showInstantFeedback}
                onChange={(e) =>
                  updateSettings({ showInstantFeedback: e.target.checked })
                }
                className="h-5 w-5 accent-[#6366f1]"
              />
            </label>

            <label className="neu-inset-sm flex cursor-pointer items-center justify-between gap-4 p-4">
              <div>
                <span className="block text-sm font-semibold text-[#1e2436]">
                  Auto-Save Generated Lessons
                </span>
                <span className="block text-xs text-[#5a6378]">
                  Automatically add newly simplified topics to Recent Topics and Gap Detector.
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSaveLessons}
                onChange={(e) =>
                  updateSettings({ autoSaveLessons: e.target.checked })
                }
                className="h-5 w-5 accent-[#6366f1]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="submit"
              className="neu-btn min-h-[42px] px-5 py-2 text-sm font-semibold text-[#6366f1]"
            >
              Save Preferences
            </button>
            {savedNotice && (
              <span
                role="status"
                aria-live="polite"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#047857]"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{savedNotice}</span>
              </span>
            )}
          </div>
        </form>

        {/* Cloud Sync & Data Management */}
        <section className="neu-raised p-6 space-y-5 lg:col-span-5">
          <div className="space-y-3 border-b border-[#d4d8e2] pb-5">
            <h2 className="text-base font-semibold text-[#1e2436]">
              Cloud Account & Firestore Sync
            </h2>
            {user ? (
              <div className="neu-inset p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1e2436]">
                      {user.displayName || settings.studentName}
                    </p>
                    <p className="truncate text-xs text-[#5a6378]">{user.email}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-[#047857]">
                    <Cloud className="h-3.5 w-3.5" />
                    <span>{syncStatus === 'syncing' ? 'Syncing' : 'Synced'}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOutUser()}
                  className="neu-btn flex min-h-[40px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#3d4558]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="neu-inset p-4 space-y-3">
                <p className="text-xs leading-relaxed text-[#5a6378]">
                  You are exploring in Guest mode. Sign in with Google to persist lessons, quiz mastery, focus sprints, and tutor threads to Firestore.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle().catch(() => {})}
                  className="neu-btn flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#6366f1]"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            )}
            {authError && (
              <p className="text-xs text-[#b91c1c]">{authError}</p>
            )}
          </div>

          <h2 className="text-base font-semibold text-[#1e2436]">
            Learning Data & Backup
          </h2>

          <div className="neu-inset p-4 space-y-2 text-xs text-[#3d4558] tabular-nums">
            <div className="flex justify-between">
              <span>Saved Lessons</span>
              <span className="font-mono-tabular font-semibold">{lessons.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracked Topics</span>
              <span className="font-mono-tabular font-semibold">
                {masteryRecords.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Completed Quizzes</span>
              <span className="font-mono-tabular font-semibold">
                {quizAttempts.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Focus Timer Sprints</span>
              <span className="font-mono-tabular font-semibold">
                {focusSessions.length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleExportReport}
              className="neu-btn flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#6366f1]"
            >
              <Download className="h-4 w-4" />
              <span>Export Learning Progress (JSON)</span>
            </button>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="neu-btn flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#b91c1c]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset to Sample Data</span>
              </button>
            ) : (
              <div className="neu-inset p-4 space-y-3">
                <p className="text-xs text-[#b91c1c]">
                  Restore initial sample lessons, quizzes, and mastery metrics?
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      resetAllData();
                      setConfirmReset(false);
                      setSavedNotice('Sample data restored.');
                    }}
                    className="neu-btn flex-1 px-3 py-2 text-xs font-semibold text-[#b91c1c]"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="neu-btn flex-1 px-3 py-2 text-xs font-medium text-[#3d4558]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
