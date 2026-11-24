import { MasteryClassification, TopicMasteryRecord } from '../types/study';

export const MIN_QUESTIONS_FOR_MASTERY = 2;

/**
 * Calculates mastery percentage using:
 * (correct answers / attempted questions) * 100
 * Returns null when topic has not been tested or has too few questions.
 */
export function calculateMasteryPercentage(
  correctAnswers: number,
  attemptedQuestions: number
): number | null {
  if (attemptedQuestions < MIN_QUESTIONS_FOR_MASTERY) {
    return null;
  }
  return Math.round((correctAnswers / attemptedQuestions) * 100);
}

/**
 * Classifies mastery score strictly using required thresholds:
 * - 0–49%: Needs Improvement
 * - 50–69%: Developing
 * - 70–84%: Good Understanding
 * - 85–100%: Strong Understanding
 * - Insufficient questions: Insufficient Data
 */
export function classifyMastery(
  scorePercent: number | null,
  attemptedQuestions: number
): MasteryClassification {
  if (scorePercent === null || attemptedQuestions < MIN_QUESTIONS_FOR_MASTERY) {
    return 'Insufficient Data';
  }
  if (scorePercent >= 85) {
    return 'Strong Understanding';
  }
  if (scorePercent >= 70) {
    return 'Good Understanding';
  }
  if (scorePercent >= 50) {
    return 'Developing';
  }
  return 'Needs Improvement';
}

export function getClassificationTheme(classification: MasteryClassification): {
  textColor: string;
  barColor: string;
  shortTag: string;
} {
  switch (classification) {
    case 'Strong Understanding':
      return {
        textColor: 'text-[#047857]',
        barColor: '#059669',
        shortTag: 'Strong',
      };
    case 'Good Understanding':
      return {
        textColor: 'text-[#4338ca]',
        barColor: '#6366f1',
        shortTag: 'Good',
      };
    case 'Developing':
      return {
        textColor: 'text-[#b45309]',
        barColor: '#d97706',
        shortTag: 'Developing',
      };
    case 'Needs Improvement':
      return {
        textColor: 'text-[#b91c1c]',
        barColor: '#dc2626',
        shortTag: 'Needs Focus',
      };
    default:
      return {
        textColor: 'text-[#5a6378]',
        barColor: '#94a3b8',
        shortTag: 'Untested',
      };
  }
}

export function calculateOverallMastery(records: TopicMasteryRecord[]): number | null {
  const tested = records.filter((r) => r.attemptedQuestions >= MIN_QUESTIONS_FOR_MASTERY);
  if (tested.length === 0) {
    return null;
  }
  const totalCorrect = tested.reduce((sum, r) => sum + r.correctAnswers, 0);
  const totalAttempted = tested.reduce((sum, r) => sum + r.attemptedQuestions, 0);
  return calculateMasteryPercentage(totalCorrect, totalAttempted);
}
