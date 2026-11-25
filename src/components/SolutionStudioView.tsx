import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  Globe,
  Hammer,
  Layers,
  Lightbulb,
  Loader2,
  LogIn,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { useStudy } from '../context/StudyContext';
import {
  SolutionBuildPhase,
  SolutionImpactMetric,
  SolutionProject,
  SolutionRisk,
  SolutionTask,
} from '../types/study';
import { postJson } from '../utils/apiClient';
import { classifyMastery } from '../utils/mastery';
import { createUniqueId, generateRoomCode } from '../utils/studyState';

const SOLUTION_TEMPLATES = [
  {
    label: 'Urban Heat Cooling',
    problem:
      'Dense urban bus stops reach dangerous heat-index spikes in summer afternoons, especially in shaded-tree deserts.',
    community: 'Municipal commuters & outdoor campus walkways',
    constraints: 'Passive cooling + solar-powered misting under $120 per shelter',
    linkedTopic: 'Thermodynamics & Heat Transfer',
  },
  {
    label: 'Classroom Water Sensor',
    problem:
      'School science labs lack affordable continuous turbidity and dissolved oxygen monitoring for local stream ecology projects.',
    community: 'Middle & high school environmental clubs',
    constraints: 'Open hardware under $35 with student-built calibration guide',
    linkedTopic: 'Cellular Respiration & ATP',
  },
  {
    label: 'Peer Study Matching',
    problem:
      'Students struggle to find study partners who complement their strong and weak syllabus topics before midterms.',
    community: 'University & high school study cohorts',
    constraints: 'Privacy-preserving matching using mastery scores without sharing grades publicly',
    linkedTopic: 'Supply & Demand Equilibrium',
  },
];

function removeUnusedPlaceholder() {}

export function SolutionStudioView() {
  const {
    solutions,
    solutionContributions,
    activeSolutionId,
    setActiveSolutionId,
    solutionDraftTopic,
    setSolutionDraftTopic,
    lessons,
    masteryRecords,
    experiments,
    settings,
    user,
    signInWithGoogle,
    createSolution,
    publishSolutionToRoom,
    toggleRoomVisibility,
    joinStudyRoomByCode,
    toggleSolutionTask,
    endorseSolution,
    applySolutionIteration,
    addSolutionContribution,
    navigateToSimplifier,
  } = useStudy();

  const [problemStatement, setProblemStatement] = useState<string>('');
  const [targetCommunity, setTargetCommunity] = useState<string>('');
  const [constraints, setConstraints] = useState<string>('');
  const [linkedTopic, setLinkedTopic] = useState<string>(solutionDraftTopic || '');
  const [visibility, setVisibility] = useState<'open' | 'invite'>('open');
  const [publishOnCreate, setPublishOnCreate] = useState<boolean>(Boolean(user));

  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [roomFeedback, setRoomFeedback] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const [iterationInput, setIterationInput] = useState<string>('');
  const [peerNoteInput, setPeerNoteInput] = useState<string>('');
  const [peerNoteKind, setPeerNoteKind] = useState<'peer-idea' | 'milestone'>('peer-idea');

  const [generating, setGenerating] = useState<boolean>(false);
  const [iterating, setIterating] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const iterateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      generateAbortRef.current?.abort();
      iterateAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (solutionDraftTopic) {
      setLinkedTopic(solutionDraftTopic);
      if (!problemStatement.trim()) {
        setProblemStatement(
          `Design a practical community or educational solution applying principles from ${solutionDraftTopic}.`
        );
      }
      setSolutionDraftTopic('');
    }
  }, [solutionDraftTopic, problemStatement, setSolutionDraftTopic]);

  const activeSolution: SolutionProject | undefined =
    solutions.find((s) => s.id === activeSolutionId) ?? solutions[0];

  const activeContributions = activeSolution
    ? solutionContributions[activeSolution.id] ?? []
    : [];

  const topicOptions = Array.from(
    new Set([
      ...masteryRecords.map((m) => m.topic),
      ...lessons.map((l) => l.topic),
      ...experiments.map((e) => e.title),
    ])
  );

  const handleGenerateBlueprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problemStatement.trim()) {
      setError('Describe a real-world problem or goal before generating a solution blueprint.');
      return;
    }

    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setGenerating(true);
    setError(null);
    setRoomFeedback(null);

    const matchingLesson = lessons.find(
      (l) => l.topic.toLowerCase() === linkedTopic.toLowerCase()
    );
    const matchingExp = experiments.find(
      (ex) => ex.title.toLowerCase() === linkedTopic.toLowerCase()
    );
    const linkedContext = matchingLesson
      ? `Lesson summary: ${matchingLesson.summary}`
      : matchingExp
      ? `Experiment outcome: ${matchingExp.summary}`
      : undefined;

    try {
      const data = await postJson<{
        solution?: {
          title?: string;
          domain?: string;
          solutionSummary?: string;
          feasibilityScore?: number;
          aiIntegrationPlan?: string;
          buildPhases?: SolutionBuildPhase[];
          impactMetrics?: SolutionImpactMetric[];
          tasks?: Array<{ title?: string }>;
          risks?: SolutionRisk[];
        };
      }>(
        '/api/solution',
        {
          problemStatement: problemStatement.trim(),
          targetCommunity: targetCommunity.trim(),
          constraints: constraints.trim(),
          linkedTopic: linkedTopic.trim() || undefined,
          linkedContext,
        },
        { signal: controller.signal }
      );

      const raw = data.solution || {};
      const now = new Date().toISOString();
      const rawTasks: Array<{ title?: string }> = Array.isArray(raw.tasks) ? raw.tasks : [];
      const tasks: SolutionTask[] =
        rawTasks.length > 0
          ? rawTasks.slice(0, 8).map((t, idx) => ({
              id: createUniqueId(`task-${idx}`),
              title: String(t?.title || `Implementation step ${idx + 1}`),
              completed: false,
              assigneeName: 'Open for peer',
            }))
          : [
              {
                id: createUniqueId('task-0'),
                title: 'Validate baseline assumptions with target users',
                completed: false,
                assigneeName: 'Open for peer',
              },
            ];

      const buildPhases: SolutionBuildPhase[] = Array.isArray(raw.buildPhases)
        ? raw.buildPhases
        : [];
      const impactMetrics: SolutionImpactMetric[] = Array.isArray(raw.impactMetrics)
        ? raw.impactMetrics
        : [];
      const risks: SolutionRisk[] = Array.isArray(raw.risks) ? raw.risks : [];

      const created: SolutionProject = {
        id: createUniqueId('room'),
        roomCode: generateRoomCode(),
        ownerUid: user?.uid || 'guest',
        ownerName: user?.displayName || settings.studentName || 'Learner',
        title: String(raw.title || 'AI Solution Blueprint'),
        domain: String(raw.domain || 'Interdisciplinary Innovation'),
        problemStatement: problemStatement.trim(),
        targetCommunity: targetCommunity.trim() || 'Students & local community',
        constraints: constraints.trim() || 'Accessible open tools',
        linkedTopic: linkedTopic.trim() || undefined,
        solutionSummary: String(raw.solutionSummary || ''),
        feasibilityScore: Math.max(
          40,
          Math.min(99, Math.round(Number(raw.feasibilityScore) || 80))
        ),
        aiIntegrationPlan: String(raw.aiIntegrationPlan || ''),
        buildPhases,
        impactMetrics,
        tasks,
        risks,
        visibility,
        memberUids: [],
        endorseUids: [],
        isPublished: false,
        isAiGenerated: true,
        createdAt: now,
        updatedAt: now,
      };

      await createSolution(created, Boolean(user && publishOnCreate));
      setProblemStatement('');
      setTargetCommunity('');
      setConstraints('');
      setRoomFeedback(
        user && publishOnCreate
          ? `Created and published live Study Room ${created.roomCode}.`
          : `Created local Solution Blueprint (${created.roomCode}).`
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error ? err.message : 'Unable to generate solution blueprint right now.'
      );
    } finally {
      if (generateAbortRef.current === controller) {
        setGenerating(false);
      }
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await joinStudyRoomByCode(roomCodeInput);
    setRoomFeedback(result.message);
    if (result.ok) {
      setRoomCodeInput('');
    }
  };

  const handlePublishActive = async () => {
    if (!activeSolution) return;
    setError(null);
    setPublishing(true);
    try {
      await publishSolutionToRoom(activeSolution.id);
      setRoomFeedback(
        `Published "${activeSolution.title}" live to Firestore Study Rooms (Code: ${activeSolution.roomCode}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish Study Room.');
    } finally {
      setPublishing(false);
    }
  };

  const handleIterateWithAi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSolution || !iterationInput.trim()) return;
    iterateAbortRef.current?.abort();
    const controller = new AbortController();
    iterateAbortRef.current = controller;

    setIterating(true);
    setError(null);

    try {
      const data = await postJson<{
        iteration?: {
          solutionSummary?: string;
          feasibilityScore?: number;
          aiIntegrationPlan?: string;
          iterationNote?: string;
          buildPhases?: SolutionBuildPhase[];
          impactMetrics?: SolutionImpactMetric[];
          tasks?: Array<{ title?: string }>;
          risks?: SolutionRisk[];
        };
      }>(
        '/api/solution/iterate',
        {
          solution: {
            title: activeSolution.title,
            problemStatement: activeSolution.problemStatement,
            solutionSummary: activeSolution.solutionSummary,
            aiIntegrationPlan: activeSolution.aiIntegrationPlan,
            constraints: activeSolution.constraints,
            feasibilityScore: activeSolution.feasibilityScore,
          },
          feedback: iterationInput.trim(),
        },
        { signal: controller.signal }
      );

      const iter = data.iteration || {};
      const nextTasks: SolutionTask[] = Array.isArray(iter.tasks)
        ? iter.tasks.slice(0, 8).map((t, idx) => ({
            id: createUniqueId(`task-iter-${idx}`),
            title: String(t?.title || `Updated task ${idx + 1}`),
            completed: false,
            assigneeName: 'Open for peer',
          }))
        : activeSolution.tasks;

      await applySolutionIteration(
        activeSolution.id,
        {
          solutionSummary:
            typeof iter.solutionSummary === 'string' && iter.solutionSummary
              ? iter.solutionSummary
              : activeSolution.solutionSummary,
          feasibilityScore: Number.isFinite(Number(iter.feasibilityScore))
            ? Math.max(0, Math.min(100, Math.round(Number(iter.feasibilityScore))))
            : activeSolution.feasibilityScore,
          aiIntegrationPlan:
            typeof iter.aiIntegrationPlan === 'string' && iter.aiIntegrationPlan
              ? iter.aiIntegrationPlan
              : activeSolution.aiIntegrationPlan,
          buildPhases: Array.isArray(iter.buildPhases)
            ? iter.buildPhases
            : activeSolution.buildPhases,
          impactMetrics: Array.isArray(iter.impactMetrics)
            ? iter.impactMetrics
            : activeSolution.impactMetrics,
          tasks: nextTasks,
          risks: Array.isArray(iter.risks) ? iter.risks : activeSolution.risks,
        },
        String(iter.iterationNote || `Refined solution from prompt: "${iterationInput.trim()}"`)
      );

      setIterationInput('');
      setRoomFeedback('AI critique applied and logged to the build feed.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unable to refine solution right now.');
    } finally {
      if (iterateAbortRef.current === controller) {
        setIterating(false);
      }
    }
  };

  const handlePostContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSolution || !peerNoteInput.trim()) return;
    await addSolutionContribution(activeSolution.id, peerNoteKind, peerNoteInput.trim());
    setPeerNoteInput('');
  };

  const handleCopyInvite = async () => {
    if (!activeSolution) return;
    const summaryText = `STUDYBRIDGE Solution Room: ${activeSolution.title} | Room Code: ${activeSolution.roomCode}`;
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setRoomFeedback(`Share Room Code manually: ${activeSolution.roomCode}`);
    }
  };

  const actorKey = user?.uid || 'guest';
  const hasEndorsed = activeSolution ? activeSolution.endorseUids.includes(actorKey) : false;
  const completedTaskCount = activeSolution
    ? activeSolution.tasks.filter((t) => t.completed).length
    : 0;
  const weakTopics = masteryRecords.filter((m) => {
    const cls = classifyMastery(m.latestScorePercent, m.attemptedQuestions);
    return cls === 'Needs Improvement' || cls === 'Developing';
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1e2436]">
            Solution Studio & Study Rooms
          </h1>
          <p className="mt-1 text-sm text-[#5a6378]">
            Turn concepts and experiments into meaningful real-world solutions with AI co-design and collaborative study rooms.
          </p>
        </div>

        {/* Cloud vs. Local Collaboration Status */}
        <div className="neu-inset-sm flex items-center gap-2.5 px-4 py-2 text-xs">
          {user ? (
            <>
              <Cloud className="h-4 w-4 text-[#047857]" />
              <span className="font-medium text-[#047857]">
                Live Firestore Study Rooms Active
              </span>
            </>
          ) : (
            <>
              <Users className="h-4 w-4 text-[#6366f1]" />
              <span className="text-[#3d4558]">Local Sandbox ·</span>
              <button
                type="button"
                onClick={() => signInWithGoogle().catch(() => {})}
                className="font-semibold text-[#6366f1] hover:underline"
              >
                Sign in to Collaborate Live
              </button>
            </>
          )}
        </div>
      </header>

      {/* Top Row: Join Study Room by Code & Room Switcher */}
      <section className="neu-raised p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-[#5a6378]">
              Active & Open Solution Study Rooms ({solutions.length})
            </span>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {solutions.map((sol) => {
                const isActive = activeSolution?.id === sol.id;
                return (
                  <button
                    key={sol.id}
                    type="button"
                    onClick={() => {
                      setActiveSolutionId(sol.id);
                      setRoomFeedback(null);
                    }}
                    className={`flex min-h-[40px] items-center gap-2 px-3.5 py-2 text-left text-xs ${
                      isActive
                        ? 'neu-btn-active font-semibold text-[#6366f1]'
                        : 'neu-btn font-medium text-[#3d4558]'
                    }`}
                  >
                    <span className="truncate max-w-[200px]">{sol.title}</span>
                    <span className="font-mono-tabular text-[11px] text-[#5a6378]">
                      #{sol.roomCode}
                    </span>
                    {sol.isPublished && (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-[#059669]" aria-label="Live cloud room" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleJoinByCode}
            className="flex flex-wrap items-center gap-2.5 border-t border-[#d4d8e2] pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5"
          >
            <label htmlFor="join-room-code" className="sr-only">
              Join Study Room by Code
            </label>
            <input
              id="join-room-code"
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="Room code (e.g. BIO4821)"
              maxLength={12}
              className="neu-input font-mono-tabular w-44 px-3.5 py-2 text-xs uppercase"
            />
            <button
              type="submit"
              className="neu-btn flex min-h-[40px] items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Join Room</span>
            </button>
          </form>
        </div>

        {roomFeedback && (
          <div
            role="status"
            aria-live="polite"
            className="neu-inset-sm flex items-center gap-2 px-4 py-2.5 text-xs text-[#047857]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{roomFeedback}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="neu-inset-sm flex items-start gap-2 px-4 py-2.5 text-xs text-[#b91c1c]"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Column (5 cols): Build a Solution with AI */}
        <section className="neu-raised p-6 xl:col-span-5">
          <div className="flex items-center gap-2">
            <Hammer className="h-4 w-4 text-[#7c3aed]" />
            <h2 className="text-base font-semibold text-[#1e2436]">
              Build a Meaningful Solution with AI
            </h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5a6378]">
            Apply concepts from your lessons, gaps, or experiments to design a concrete prototype teammates can build together.
          </p>

          {weakTopics.length > 0 && (
            <div className="mt-4 neu-inset-sm p-3.5">
              <p className="text-[11px] font-semibold text-[#6366f1]">
                Apply a Learning Gap Topic to Practice Deeper:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {weakTopics.slice(0, 3).map((wt) => (
                  <button
                    key={wt.topic}
                    type="button"
                    onClick={() => {
                      setLinkedTopic(wt.topic);
                      if (!problemStatement.trim()) {
                        setProblemStatement(
                          `Create a practical, low-cost student project applying ${wt.topic} to solve a measurable local problem.`
                        );
                      }
                    }}
                    className="neu-btn px-2.5 py-1 text-[11px] font-medium text-[#3d4558]"
                  >
                    + {wt.topic}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleGenerateBlueprint} className="mt-5 space-y-4">
            <div>
              <span className="block text-xs font-semibold text-[#5a6378]">
                Starter Challenge Prompts
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {SOLUTION_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => {
                      setProblemStatement(tpl.problem);
                      setTargetCommunity(tpl.community);
                      setConstraints(tpl.constraints);
                      setLinkedTopic(tpl.linkedTopic);
                    }}
                    className="neu-btn px-3 py-1.5 text-xs font-medium text-[#3d4558]"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="solution-problem"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Real-World Problem Statement
              </label>
              <textarea
                id="solution-problem"
                rows={3}
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="What problem are you solving, and why does it matter?"
                className="neu-input mt-2 w-full resize-y px-4 py-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="solution-community"
                  className="block text-xs font-semibold text-[#3d4558]"
                >
                  Target Community
                </label>
                <input
                  id="solution-community"
                  type="text"
                  value={targetCommunity}
                  onChange={(e) => setTargetCommunity(e.target.value)}
                  placeholder="e.g. Local high school labs"
                  className="neu-input mt-1.5 w-full px-3.5 py-2.5 text-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="solution-topic"
                  className="block text-xs font-semibold text-[#3d4558]"
                >
                  Linked Concept / Experiment
                </label>
                <input
                  id="solution-topic"
                  list="studybridge-topics-list"
                  type="text"
                  value={linkedTopic}
                  onChange={(e) => setLinkedTopic(e.target.value)}
                  placeholder="Optional topic link"
                  className="neu-input mt-1.5 w-full px-3.5 py-2.5 text-xs"
                />
                <datalist id="studybridge-topics-list">
                  {topicOptions.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label
                htmlFor="solution-constraints"
                className="block text-xs font-semibold text-[#3d4558]"
              >
                Budget, Hardware & Safety Constraints
              </label>
              <input
                id="solution-constraints"
                type="text"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="e.g. Under $50 budget, open-source tools only"
                className="neu-input mt-1.5 w-full px-3.5 py-2.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                aria-pressed={visibility === 'open'}
                onClick={() => setVisibility('open')}
                className={`min-h-[40px] px-3 py-2 text-xs font-semibold ${
                  visibility === 'open'
                    ? 'neu-btn-active text-[#6366f1]'
                    : 'neu-btn text-[#3d4558]'
                }`}
              >
                Open Study Room
              </button>
              <button
                type="button"
                aria-pressed={visibility === 'invite'}
                onClick={() => setVisibility('invite')}
                className={`min-h-[40px] px-3 py-2 text-xs font-semibold ${
                  visibility === 'invite'
                    ? 'neu-btn-active text-[#6366f1]'
                    : 'neu-btn text-[#3d4558]'
                }`}
              >
                Private (Owner Only)
              </button>
            </div>

            {user && (
              <label className="neu-inset-sm flex cursor-pointer items-center justify-between gap-3 p-3">
                <span className="text-xs font-medium text-[#1e2436]">
                  Publish immediately to live Firestore Study Rooms
                </span>
                <input
                  type="checkbox"
                  checked={publishOnCreate}
                  onChange={(e) => setPublishOnCreate(e.target.checked)}
                  className="h-4 w-4 accent-[#6366f1]"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={generating}
              className="neu-btn flex min-h-[46px] w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#7c3aed] disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Designing Solution Blueprint...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate AI Solution Blueprint</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right Column (7 cols): Interactive Solution Blueprint & Collaboration Room */}
        <section className="space-y-6 xl:col-span-7">
          {generating ? (
            <div className="neu-raised p-10 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#7c3aed]" />
              <p className="mt-3 text-sm font-semibold text-[#1e2436]">
                Synthesizing build phases, AI integration plan, and peer tasks...
              </p>
            </div>
          ) : activeSolution ? (
            <>
              <article className="neu-raised p-6 sm:p-7 space-y-6">
                {/* Room Header & Collaboration Controls */}
                <div className="flex flex-col gap-4 border-b border-[#d4d8e2] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5a6378]">
                      <span className="font-semibold text-[#7c3aed]">
                        {activeSolution.domain}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-[#1e2436]">
                        Room #{activeSolution.roomCode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Host: {activeSolution.ownerName}</span>
                    </div>
                    <h2 className="mt-1.5 text-xl sm:text-2xl font-semibold text-[#1e2436]">
                      {activeSolution.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#3d4558]">
                      {activeSolution.solutionSummary}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#3d4558] whitespace-nowrap"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#047857]" />
                          <span className="text-[#047857]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#6366f1]" />
                          <span>Copy Room Code</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      aria-pressed={hasEndorsed}
                      onClick={() => endorseSolution(activeSolution.id)}
                      className={`flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
                        hasEndorsed
                          ? 'neu-btn-active text-[#6366f1]'
                          : 'neu-btn text-[#3d4558]'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span className="font-mono-tabular">
                        Endorse ({activeSolution.endorseUids.length})
                      </span>
                    </button>

                    {(!activeSolution.isPublished ||
                      activeSolution.ownerUid === (user?.uid || 'guest')) && (
                      <button
                        type="button"
                        onClick={() => toggleRoomVisibility(activeSolution.id)}
                        className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#3d4558] whitespace-nowrap"
                      >
                        <Globe className="h-3.5 w-3.5 text-[#6366f1]" />
                        <span>
                          {activeSolution.visibility === 'open' ? 'Open Room' : 'Private Room'}
                        </span>
                      </button>
                    )}

                    {!activeSolution.isPublished && (
                      user ? (
                        <button
                          type="button"
                          disabled={publishing}
                          onClick={handlePublishActive}
                          className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#047857] whitespace-nowrap disabled:opacity-60"
                        >
                          {publishing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Cloud className="h-3.5 w-3.5" />
                          )}
                          <span>Publish Live</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => signInWithGoogle().catch(() => {})}
                          className="neu-btn flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#6366f1] whitespace-nowrap"
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          <span>Sign in to Publish</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Problem Context + Feasibility Meter */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className="neu-inset p-4 space-y-2 md:col-span-8">
                    <p className="text-xs font-semibold text-[#3d4558]">
                      Problem & Community Scope
                    </p>
                    <p className="text-xs leading-relaxed text-[#3d4558]">
                      {activeSolution.problemStatement}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-[#5a6378]">
                      <span>Community: {activeSolution.targetCommunity}</span>
                      <span>Constraints: {activeSolution.constraints}</span>
                      {activeSolution.linkedTopic && (
                        <button
                          type="button"
                          onClick={() => navigateToSimplifier(activeSolution.linkedTopic!)}
                          className="inline-flex items-center gap-1 font-semibold text-[#6366f1] hover:underline"
                        >
                          <BookOpen className="h-3 w-3" />
                          <span>{activeSolution.linkedTopic}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="neu-inset p-4 flex flex-col justify-between md:col-span-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#3d4558]">Feasibility</span>
                      <span className="font-mono-tabular text-base font-semibold text-[#6366f1]">
                        {activeSolution.feasibilityScore}%
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Solution feasibility score"
                      aria-valuenow={activeSolution.feasibilityScore}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 h-2.5 w-full overflow-hidden rounded-xl bg-[#dfe2ea]"
                    >
                      <div
                        className="h-full rounded-xl bg-[#6366f1] transition-all duration-300"
                        style={{ width: `${activeSolution.feasibilityScore}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[#5a6378] tabular-nums">
                      Tasks complete: {completedTaskCount} / {activeSolution.tasks.length}
                      {activeSolution.isPublished && (
                        <> · {activeSolution.memberUids.length + 1} collaborators</>
                      )}
                    </p>
                  </div>
                </div>

                {/* AI Integration Plan */}
                <div className="neu-inset p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#7c3aed]">
                    <Lightbulb className="h-4 w-4" />
                    <span>How AI Powers This Solution</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#1e2436]">
                    {activeSolution.aiIntegrationPlan}
                  </p>
                </div>

                {/* Build Phases & Impact Metrics */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#1e2436]">
                      <Layers className="h-4 w-4 text-[#6366f1]" />
                      <span>Build Roadmap</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {activeSolution.buildPhases.map((bp, idx) => (
                        <div key={idx} className="neu-inset-sm p-3.5">
                          <p className="text-xs font-semibold text-[#6366f1]">{bp.phase}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[#3d4558]">
                            {bp.action}
                          </p>
                          <p className="mt-1.5 text-[11px] font-medium text-[#047857]">
                            Deliverable: {bp.deliverable}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-[#1e2436]">
                        Measurable Impact Targets
                      </p>
                      <div className="mt-3 space-y-2.5">
                        {activeSolution.impactMetrics.map((im, idx) => (
                          <div key={idx} className="neu-inset-sm p-3.5">
                            <p className="text-xs font-semibold text-[#1e2436]">
                              {im.metric}
                            </p>
                            <p className="mt-0.5 text-xs text-[#5a6378]">{im.target}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {activeSolution.risks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#b45309]">
                          <ShieldAlert className="h-4 w-4" />
                          <span>Risks & Mitigations</span>
                        </div>
                        <div className="mt-2.5 space-y-2">
                          {activeSolution.risks.map((risk, idx) => (
                            <div key={idx} className="neu-inset-sm p-3 text-xs">
                              <p className="font-semibold text-[#1e2436]">{risk.challenge}</p>
                              <p className="mt-0.5 text-[#5a6378]">{risk.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collaborative Task Board */}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1e2436]">
                      Collaborative Build Checklist
                    </h3>
                    <span className="font-mono-tabular text-xs text-[#5a6378]">
                      {completedTaskCount}/{activeSolution.tasks.length} done
                    </span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {activeSolution.tasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        aria-pressed={task.completed}
                        onClick={() => toggleSolutionTask(activeSolution.id, task.id)}
                        className={`flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                          task.completed ? 'neu-inset-sm' : 'neu-btn'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              task.completed
                                ? 'border-[#059669] bg-[#059669] text-white'
                                : 'border-[#9aa3b8] bg-transparent'
                            }`}
                          >
                            {task.completed && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              task.completed
                                ? 'line-through text-[#5a6378]'
                                : 'text-[#1e2436]'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-[#5a6378]">
                          {task.assigneeName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </article>

              {/* AI Critique Iteration + Peer Discussion Feed */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Iterate Blueprint with AI */}
                <section className="neu-raised p-6 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#1e2436]">
                    <Sparkles className="h-4 w-4 text-[#7c3aed]" />
                    <span>Iterate Solution with AI</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#5a6378]">
                    Ask AI to stress-test your prototype against a new constraint, lower costs, or add peer feedback.
                  </p>
                  <form onSubmit={handleIterateWithAi} className="space-y-3">
                    <textarea
                      rows={3}
                      value={iterationInput}
                      onChange={(e) => setIterationInput(e.target.value)}
                      placeholder="e.g. Cut hardware budget by 40% or add offline rural school support..."
                      className="neu-input w-full resize-y px-3.5 py-2.5 text-xs"
                    />
                    <button
                      type="submit"
                      disabled={iterating || !iterationInput.trim()}
                      className="neu-btn flex min-h-[42px] w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-[#7c3aed] disabled:opacity-50"
                    >
                      {iterating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Refining Blueprint...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Run AI Critique & Refine</span>
                        </>
                      )}
                    </button>
                  </form>
                </section>

                {/* Peer Contributions & Build Log */}
                <section className="neu-raised p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#1e2436]">
                      <MessageSquarePlus className="h-4 w-4 text-[#6366f1]" />
                      <span>Team Ideas & Build Log</span>
                    </div>
                    <span className="text-[11px] text-[#5a6378]">
                      {activeSolution.isPublished ? 'Firestore Live' : 'Local Feed'}
                    </span>
                  </div>

                  <div className="max-h-52 space-y-2.5 overflow-y-auto pr-1">
                    {activeContributions.length > 0 ? (
                      activeContributions.map((entry) => (
                        <div key={entry.id} className="neu-inset-sm p-3 text-xs">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#5a6378]">
                            <span className="font-semibold text-[#6366f1]">
                              {entry.authorName}
                            </span>
                            <span>
                              {entry.kind === 'ai-critique'
                                ? 'AI Iteration'
                                : entry.kind === 'milestone'
                                ? 'Milestone'
                                : 'Peer Idea'}
                            </span>
                          </div>
                          <p className="mt-1 leading-relaxed text-[#3d4558]">{entry.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="neu-inset-sm p-3.5 text-xs text-[#5a6378]">
                        No team notes yet. Share an idea, lab result, or milestone update below.
                      </p>
                    )}
                  </div>

                  <form onSubmit={handlePostContribution} className="space-y-2.5">
                    <div className="flex gap-2">
                      <select
                        aria-label="Note category"
                        value={peerNoteKind}
                        onChange={(e) =>
                          setPeerNoteKind(e.target.value as 'peer-idea' | 'milestone')
                        }
                        className="neu-input px-3 py-2 text-xs font-medium"
                      >
                        <option value="peer-idea">Peer Idea</option>
                        <option value="milestone">Milestone</option>
                      </select>
                      <input
                        type="text"
                        value={peerNoteInput}
                        onChange={(e) => setPeerNoteInput(e.target.value)}
                        placeholder="Add peer feedback or experiment finding..."
                        className="neu-input flex-1 px-3.5 py-2 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={!peerNoteInput.trim()}
                        aria-label="Post contribution"
                        className="neu-btn flex h-10 w-10 shrink-0 items-center justify-center text-[#6366f1] disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            </>
          ) : (
            <div className="neu-raised flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <Hammer className="h-8 w-8 text-[#6366f1]" />
              <h2 className="mt-3 text-lg font-semibold text-[#1e2436]">
                No Solution Blueprint Selected
              </h2>
              <p className="mt-1 max-w-sm text-sm text-[#5a6378]">
                Describe a real-world problem on the left or join a teammate&apos;s Study Room by code.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
