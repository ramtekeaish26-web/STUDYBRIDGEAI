export type NavScreen =
  | 'dashboard'
  | 'simplifier'
  | 'quiz'
  | 'gaps'
  | 'experiment'
  | 'solutions'
  | 'tutor'
  | 'settings';

export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type MasteryClassification =
  | 'Needs Improvement'
  | 'Developing'
  | 'Good Understanding'
  | 'Strong Understanding'
  | 'Insufficient Data';

export interface GroundedCitation {
  title: string;
  uri: string;
}

export interface LessonExample {
  title: string;
  detail: string;
}

export interface LessonAnalogy {
  concept: string;
  comparison: string;
}

export interface SimplifiedLesson {
  id: string;
  topic: string;
  title: string;
  subject: string;
  level: LearningLevel;
  language: string;
  readMinutes: number;
  summary: string;
  definition: string;
  coreMechanism: string[];
  examples: LessonExample[];
  analogies: LessonAnalogy[];
  keyTakeaways: string[];
  groundedSources?: GroundedCitation[];
  sourceNoteName?: string;
  createdAt: string;
  isAiGenerated?: boolean;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizBank {
  topic: string;
  subject: string;
  level: LearningLevel;
  questions: QuizQuestion[];
  isAiGenerated?: boolean;
}

export interface QuizAttempt {
  id: string;
  topic: string;
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
  timestamp: string;
}

export interface TopicMasteryRecord {
  topic: string;
  subject: string;
  correctAnswers: number;
  attemptedQuestions: number;
  previousScorePercent: number | null;
  latestScorePercent: number | null;
  lastPracticedAt: string | null;
  strongConcepts: string[];
  weakConcepts: string[];
  revisionAdvice: string;
}

export interface ExperimentParameter {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  baseline: number;
  value: number;
  sensitivity: number;
}

export interface ExperimentPrediction {
  metric: string;
  projectedOutcome: string;
  confidence: string;
}

export interface ExperimentChartPoint {
  label: string;
  baseline: number;
  simulated: number;
}

export interface ExperimentScenario {
  id: string;
  question: string;
  title: string;
  domain: string;
  summary: string;
  predictions: ExperimentPrediction[];
  parameters: ExperimentParameter[];
  outcomeExplanation: string[];
  realWorldApplications: Array<{
    title: string;
    description: string;
  }>;
  chartSeries: ExperimentChartPoint[];
  isAiGenerated?: boolean;
}

export type TutorRoleId =
  | 'socratic'
  | 'stem-solver'
  | 'deep-mentor'
  | 'quick-explainer';

export type TutorModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-neon'
  | 'gemini-4-carbon';

export interface TutorMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelId?: TutorModelId;
  citations?: GroundedCitation[];
  createdAt: string;
}

export interface TutorThread {
  id: string;
  title: string;
  roleId: TutorRoleId;
  modelId: TutorModelId;
  useSearchGrounding: boolean;
  messages: TutorMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  durationMinutes: number;
  focusTopic: string;
  createdAt: string;
}

export interface StudentSettings {
  studentName: string;
  academicFocus: string;
  defaultLevel: LearningLevel;
  defaultLanguage: string;
  weeklyQuizGoal: number;
  showInstantFeedback: boolean;
  autoSaveLessons: boolean;
}

export interface WeeklyStudyDay {
  day: string;
  minutes: number;
  quizzes: number;
}

export interface SolutionTask {
  id: string;
  title: string;
  completed: boolean;
  assigneeName: string;
}

export interface SolutionBuildPhase {
  phase: string;
  action: string;
  deliverable: string;
}

export interface SolutionImpactMetric {
  metric: string;
  target: string;
}

export interface SolutionRisk {
  challenge: string;
  mitigation: string;
}

export interface SolutionContribution {
  id: string;
  roomId: string;
  authorUid: string;
  authorName: string;
  kind: 'peer-idea' | 'ai-critique' | 'milestone';
  text: string;
  createdAt: string;
}

export interface SolutionProject {
  id: string;
  roomCode: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  domain: string;
  problemStatement: string;
  targetCommunity: string;
  constraints: string;
  linkedTopic?: string;
  solutionSummary: string;
  feasibilityScore: number;
  aiIntegrationPlan: string;
  buildPhases: SolutionBuildPhase[];
  impactMetrics: SolutionImpactMetric[];
  tasks: SolutionTask[];
  risks: SolutionRisk[];
  visibility: 'open' | 'invite';
  memberUids: string[];
  endorseUids: string[];
  isPublished?: boolean;
  isAiGenerated?: boolean;
  createdAt: string;
  updatedAt: string;
}

