import React from 'react';
import { WeeklyStudyDay } from '../types/study';

interface MasteryRingProps {
  percentage: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  accentColor?: string;
}

export function MasteryRing({
  percentage,
  size = 136,
  strokeWidth = 12,
  label = 'Overall Mastery',
  accentColor = '#6366f1',
}: MasteryRingProps) {
  const safeVal = percentage ?? 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeVal / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#d5d9e3"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono-tabular text-2xl font-semibold text-[#1e2436]">
          {percentage !== null ? `${percentage}%` : '—'}
        </span>
        <span className="mt-0.5 text-[11px] text-[#5a6378]">{label}</span>
      </div>
    </div>
  );
}

export function WeeklyActivityChart({ days }: { days: WeeklyStudyDay[] }) {
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 60);

  return (
    <div className="flex h-44 items-end justify-between gap-3 pt-4">
      {days.map((day) => {
        const heightPct = Math.max(12, Math.round((day.minutes / maxMinutes) * 100));
        return (
          <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
            <span className="font-mono-tabular text-[11px] text-[#5a6378]">
              {day.minutes}m
            </span>
            <div className="neu-inset-sm flex h-28 w-full max-w-[34px] items-end p-1">
              <div
                className="w-full rounded-lg transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: day.quizzes > 0 ? '#6366f1' : '#9aa3b8',
                }}
                title={`${day.day}: ${day.minutes} mins, ${day.quizzes} quiz(zes)`}
              />
            </div>
            <span className="text-xs text-[#3d4558]">{day.day}</span>
          </div>
        );
      })}
    </div>
  );
}
