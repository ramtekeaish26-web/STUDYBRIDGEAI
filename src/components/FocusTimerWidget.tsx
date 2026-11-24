import React, { useState } from 'react';
import { Check, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useStudy } from '../context/StudyContext';

const PRESET_MINUTES = [15, 25, 45];

function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const {
    focusDurationMinutes,
    focusRemainingSeconds,
    focusRunning,
    focusTopic,
    focusSessions,
    lastCompletedFocusNotice,
    lessons,
    setFocusDuration,
    setFocusTopic,
    toggleFocusTimer,
    resetFocusTimer,
    logFocusSessionEarly,
    dismissFocusNotice,
  } = useStudy();

  const [customDraft, setCustomDraft] = useState<string>(String(focusDurationMinutes));

  const totalSeconds = focusDurationMinutes * 60;
  const elapsedSeconds = Math.max(0, totalSeconds - focusRemainingSeconds);
  const progressPct = totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;

  const totalLoggedToday = focusSessions
    .slice(0, 6)
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(customDraft, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 120) {
      setFocusDuration(parsed);
    }
  };

  return (
    <div className="neu-raised-sm p-4 space-y-3" aria-label="Focus Timer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1e2436]">
          <Timer className="h-4 w-4 text-[#6366f1]" />
          <span>Focus Timer</span>
        </div>
        <span className="font-mono-tabular text-[11px] text-[#5a6378]">
          {totalLoggedToday}m logged
        </span>
      </div>

      {/* Countdown Readout + Progress Bar */}
      <div className="neu-inset-sm p-3 text-center">
        <div className="font-mono-tabular text-2xl font-semibold tracking-tight text-[#1e2436]">
          {formatClock(focusRemainingSeconds)}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-xl bg-[#dfe2ea]">
          <div
            className="h-full rounded-xl bg-[#6366f1] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Presets + Custom Minutes */}
      <div className="grid grid-cols-3 gap-1.5">
        {PRESET_MINUTES.map((mins) => {
          const isSelected = focusDurationMinutes === mins;
          return (
            <button
              key={mins}
              type="button"
              onClick={() => {
                setFocusDuration(mins);
                setCustomDraft(String(mins));
              }}
              className={`font-mono-tabular min-h-[34px] text-xs font-semibold ${
                isSelected ? 'neu-btn-active text-[#6366f1]' : 'neu-btn text-[#3d4558]'
              }`}
            >
              {mins}m
            </button>
          );
        })}
      </div>

      <form onSubmit={handleApplyCustom} className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={120}
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          aria-label="Custom study minutes"
          className="neu-input font-mono-tabular w-full px-2.5 py-1.5 text-xs"
        />
        <button
          type="submit"
          className="neu-btn min-h-[34px] px-3 text-xs font-semibold text-[#3d4558] whitespace-nowrap"
        >
          Set
        </button>
      </form>

      {/* Study Focus Topic */}
      <select
        value={focusTopic}
        onChange={(e) => setFocusTopic(e.target.value)}
        aria-label="Focus session topic"
        className="neu-input w-full px-2.5 py-1.5 text-xs text-[#3d4558]"
      >
        <option value="General Study">General Study</option>
        {lessons.slice(0, 6).map((l) => (
          <option key={l.id} value={l.topic}>
            {l.topic}
          </option>
        ))}
      </select>

      {/* Start / Pause / Reset / Log Controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleFocusTimer}
          className="neu-btn flex min-h-[38px] flex-1 items-center justify-center gap-1.5 px-3 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
        >
          {focusRunning ? (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              <span>{elapsedSeconds > 0 ? 'Resume' : 'Start'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={resetFocusTimer}
          aria-label="Reset timer"
          className="neu-btn flex h-[38px] w-[38px] shrink-0 items-center justify-center text-[#5a6378]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {elapsedSeconds >= 60 && (
          <button
            type="button"
            onClick={logFocusSessionEarly}
            title="Finish and log elapsed minutes"
            aria-label="Finish and log elapsed minutes"
            className="neu-btn flex h-[38px] w-[38px] shrink-0 items-center justify-center text-[#047857]"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {lastCompletedFocusNotice && (
        <div className="neu-inset-sm flex items-start justify-between gap-2 p-2.5 text-[11px] text-[#047857]">
          <span>{lastCompletedFocusNotice}</span>
          <button
            type="button"
            onClick={dismissFocusNotice}
            aria-label="Dismiss focus notice"
            className="shrink-0 text-[#5a6378]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
