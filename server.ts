import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { sanitizeExperimentParameters } from './src/utils/experimentMath.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);

const ALLOWED_TUTOR_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-neon',
  'gemini-4-carbon',
]);

const TUTOR_ROLE_INSTRUCTIONS: Record<string, string> = {
  socratic:
    'You are the STUDYBRIDGE Socratic Coach. Guide the student step by step with probing questions and conceptual hints instead of handing over the final answer immediately. Celebrate sound reasoning and gently diagnose misconceptions.',
  'stem-solver':
    'You are the STUDYBRIDGE STEM Problem Solver. Walk through math, physics, chemistry, and computer science problems clearly with units, formulas, intermediate steps, and sanity checks.',
  'deep-mentor':
    'You are the STUDYBRIDGE Deep Research Mentor. Provide rigorous first-principles explanations, edge cases, theoretical proofs, and cross-disciplinary insights for advanced understanding.',
  'quick-explainer':
    'You are the STUDYBRIDGE Quick Flash Explainer. Deliver crisp, high-yield explanations using short structured takeaways and memorable analogies without unnecessary fluff.',
};

export interface GeminiClientLike {
  models: {
    generateContent: (params: Record<string, unknown>) => Promise<{
      text?: string;
      candidates?: Array<{
        groundingMetadata?: {
          groundingChunks?: Array<{
            web?: { uri?: string; title?: string };
          }>;
        };
      }>;
    }>;
  };
}

export interface ServerOptions {
  getAiClient?: () => GeminiClientLike;
  retryBaseDelayMs?: number;
  maxRetries?: number;
}

function toTrimmedString(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function toStringArray(val: unknown, maxItems: number, maxItemLen = 600): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => toTrimmedString(typeof item === 'string' ? item : String(item ?? ''), maxItemLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.round(num), min), max);
}

export function isGeminiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.trim().length > 0 && apiKey !== 'MY_GEMINI_API_KEY');
}

function defaultGetGeminiClient(): GeminiClientLike {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your key in the Settings > Secrets panel to enable live AI generation.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) as unknown as GeminiClientLike;
}

export function formatApiError(err: unknown): { status: number; message: string; code: string } {
  const obj = (err && typeof err === 'object' ? err : {}) as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  const raw = err instanceof Error ? err.message : String(obj.message || err);
  const numericStatus = typeof obj.status === 'number' ? obj.status : undefined;

  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, code: 'MISSING_API_KEY', message: raw };
  }
  if (numericStatus === 403 || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'API permission denied. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (
    numericStatus === 400 ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('INVALID_ARGUMENT')
  ) {
    return {
      status: 400,
      code: 'INVALID_REQUEST',
      message: 'Invalid API key or request parameters. Please check Settings > Secrets.',
    };
  }
  if (numericStatus === 404 || raw.includes('NOT_FOUND')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message: 'Requested AI model was not found or is unsupported.',
    };
  }
  if (
    numericStatus === 429 ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('429') ||
    /quota|rate limit/i.test(raw)
  ) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Rate limit or quota reached. Wait a moment and retry, or verify a billing-enabled key in Settings > Secrets if using a paid reasoning model.',
    };
  }
  if (
    numericStatus === 503 ||
    raw.includes('UNAVAILABLE') ||
    /overloaded|timed out|ECONNRESET|ETIMEDOUT/i.test(raw)
  ) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Gemini AI service is temporarily busy. Please try again in a few seconds.',
    };
  }
  if (err instanceof SyntaxError || raw.includes('Unexpected JSON')) {
    return {
      status: 502,
      code: 'INVALID_AI_JSON',
      message: 'AI returned an unexpected response format. Please try generating again.',
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: raw || 'Unable to reach AI service. Please try again.',
  };
}

function isTransientError(err: unknown): boolean {
  const formatted = formatApiError(err);
  return formatted.status === 429 || formatted.status === 503;
}

export async function withGeminiRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 400
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const formatted = formatApiError(err);
      if (formatted.code === 'MISSING_API_KEY' || !isTransientError(err) || attempt === maxRetries) {
        throw err;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt += 1;
    }
  }

  throw lastError;
}

export function safeParseJson<T>(rawText: string | undefined): T {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) {
    throw new SyntaxError('Unexpected JSON: empty response');
  }
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(unfenced) as T;
}

function extractGroundingCitations(response: unknown): Array<{ title: string; uri: string }> {
  const r = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = r?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const citations: Array<{ title: string; uri: string }> = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    const title = chunk?.web?.title;
    if (uri && (uri.startsWith('https://') || uri.startsWith('http://')) && !seen.has(uri)) {
      seen.add(uri);
      citations.push({
        title: title || uri,
        uri,
      });
    }
    if (citations.length >= 6) break;
  }
  return citations;
}

async function generateStructuredJson<T>(
  ai: GeminiClientLike,
  params: Record<string, unknown>,
  maxRetries: number,
  retryBaseDelayMs: number
): Promise<T> {
  const response = await withGeminiRetry(
    () => ai.models.generateContent(params),
    maxRetries,
    retryBaseDelayMs
  );
  return safeParseJson<T>(response.text);
}

function sendApiError(res: express.Response, error: unknown) {
  const formatted = formatApiError(error);
  return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
}

export async function createApp(options: ServerOptions = {}) {
  const app = express();
  const getAiClient = options.getAiClient ?? defaultGetGeminiClient;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 400;

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Invalid JSON request body.', code: 'INVALID_JSON' });
    }
    return next(err);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      aiConfigured: options.getAiClient ? true : isGeminiConfigured(),
    });
  });

  app.post('/api/simplify', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cleanTopic = toTrimmedString(body.topic, 160);
      const cleanNotes = toTrimmedString(body.notes, 6000);
      const useSearchGrounding = Boolean(body.useSearchGrounding);

      if (!cleanTopic && !cleanNotes) {
        return res.status(400).json({ error: 'Please enter a topic or upload study notes.' });
      }

      const ai = getAiClient();
      const rawLevel = toTrimmedString(body.level, 30, 'Intermediate');
      const targetLevel = ALLOWED_LEVELS.has(rawLevel) ? rawLevel : 'Intermediate';
      const targetLanguage = toTrimmedString(body.language, 40, 'English');

      let groundedContext = '';
      let groundedSources: Array<{ title: string; uri: string }> = [];

      if (useSearchGrounding && cleanTopic) {
        const searchResp = await withGeminiRetry(
          () =>
            ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: `Provide concise, up-to-date factual highlights, key discoveries, or modern real-world developments on "${cleanTopic}" suitable for a ${targetLevel} learner.`,
              config: {
                tools: [{ googleSearch: {} }],
              },
            }),
          maxRetries,
          retryBaseDelayMs
        );
        groundedContext = (searchResp.text ?? '').trim();
        groundedSources = extractGroundingCitations(searchResp);
      }

      const prompt = `Create a structured, crystal-clear educational lesson in ${targetLanguage} for a ${targetLevel} level student.
Topic: ${cleanTopic || 'Synthesized from attached study notes'}
${cleanNotes ? `\nReference Notes / Document Excerpt:\n${cleanNotes}` : ''}
${groundedContext ? `\nUp-to-Date Web Context (integrate accurate facts where helpful):\n${groundedContext.slice(0, 2500)}` : ''}

Requirements:
- Tailor vocabulary and depth strictly to ${targetLevel} level.
- Write all content fields in ${targetLanguage}.
- Provide a concise definition, a clear step-by-step core mechanism, 2 concrete real-world examples, 2 intuitive analogies, and 4 actionable key takeaways.`;

      const parsed = await generateStructuredJson<Record<string, unknown>>(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are an expert educator for STUDYBRIDGE. Return accurate, structured JSON lessons free of fluff.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                subject: { type: Type.STRING },
                readMinutes: { type: Type.INTEGER },
                summary: { type: Type.STRING },
                definition: { type: Type.STRING },
                coreMechanism: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                examples: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      detail: { type: Type.STRING },
                    },
                  },
                },
                analogies: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      concept: { type: Type.STRING },
                      comparison: { type: Type.STRING },
                    },
                  },
                },
                keyTakeaways: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
        maxRetries,
        retryBaseDelayMs
      );

      const rawExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
      const rawAnalogies = Array.isArray(parsed.analogies) ? parsed.analogies : [];

      return res.json({
        lesson: {
          title: toTrimmedString(parsed.title, 220, cleanTopic || 'Structured Lesson'),
          subject: toTrimmedString(parsed.subject, 80, 'General Study'),
          readMinutes: clampInt(parsed.readMinutes, 1, 120, 5),
          summary: toTrimmedString(parsed.summary, 1500),
          definition: toTrimmedString(parsed.definition, 2500),
          coreMechanism: toStringArray(parsed.coreMechanism, 20),
          examples: rawExamples
            .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === 'object'))
            .slice(0, 10)
            .map((e) => ({
              title: toTrimmedString(e.title, 200, 'Example'),
              detail: toTrimmedString(e.detail, 1000),
            })),
          analogies: rawAnalogies
            .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
            .slice(0, 10)
            .map((a) => ({
              concept: toTrimmedString(a.concept, 200, 'Analogy'),
              comparison: toTrimmedString(a.comparison, 1000),
            })),
          keyTakeaways: toStringArray(parsed.keyTakeaways, 15),
          groundedSources,
        },
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.post('/api/quiz', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cleanTopic = toTrimmedString(body.topic, 160);
      if (!cleanTopic) {
        return res.status(400).json({ error: 'Please specify a topic for the quiz.' });
      }

      const questionCount = clampInt(body.count, 3, 8, 5);
      const rawLevel = toTrimmedString(body.level, 30, 'Intermediate');
      const targetLevel = ALLOWED_LEVELS.has(rawLevel) ? rawLevel : 'Intermediate';
      const focusContext = toTrimmedString(body.focusContext, 2000);
      const ai = getAiClient();

      const prompt = `Generate ${questionCount} rigorous multiple-choice questions on "${cleanTopic}" at the ${targetLevel} level.
${focusContext ? `Additional context to test: ${focusContext}` : ''}
Each question must have exactly 4 distinct answer options, one correct index (0 to 3), and a concise educational explanation clarifying why the correct option works and why distractors fail.`;

      const parsed = await generateStructuredJson<{
        subject?: unknown;
        questions?: Array<{
          prompt?: unknown;
          options?: unknown[];
          correctIndex?: unknown;
          explanation?: unknown;
        }>;
      }>(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are an assessment designer for STUDYBRIDGE. Output strictly valid JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
        maxRetries,
        retryBaseDelayMs
      );

      const normalizedQuestions = (Array.isArray(parsed.questions) ? parsed.questions : [])
        .filter(
          (q) =>
            q &&
            typeof q.prompt === 'string' &&
            q.prompt.trim().length > 0 &&
            Array.isArray(q.options) &&
            q.options.length >= 2
        )
        .slice(0, 12)
        .map((q) => {
          const opts = (q.options || []).slice(0, 4).map((o) => String(o ?? '').trim() || 'Option');
          while (opts.length < 4) {
            opts.push(`Option ${opts.length + 1}`);
          }
          const correctIndex = clampInt(q.correctIndex, 0, opts.length - 1, 0);
          return {
            prompt: String(q.prompt).trim(),
            options: opts,
            correctIndex,
            explanation: toTrimmedString(
              q.explanation,
              1000,
              'Review the concept explanation for details.'
            ),
          };
        });

      return res.json({
        subject: toTrimmedString(parsed.subject, 80, 'General Study'),
        questions: normalizedQuestions,
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.post('/api/experiment', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cleanQuestion = toTrimmedString(body.question, 300);
      if (!cleanQuestion) {
        return res.status(400).json({ error: 'Please enter a what-if question to explore.' });
      }

      const rawAssumptions = Array.isArray(body.assumptions) ? body.assumptions : [];
      const validAssumptions = rawAssumptions
        .filter(
          (a): a is Record<string, unknown> =>
            Boolean(a && typeof a === 'object') &&
            typeof (a as Record<string, unknown>).label === 'string' &&
            Number.isFinite(Number((a as Record<string, unknown>).value))
        )
        .slice(0, 10)
        .map((a) => ({
          label: toTrimmedString(a.label, 80, 'Parameter'),
          value: Number(a.value),
          unit: toTrimmedString(a.unit, 24),
        }));

      const ai = getAiClient();
      const assumptionSummary =
        validAssumptions.length > 0
          ? validAssumptions.map((a) => `${a.label}: ${a.value} ${a.unit}`.trim()).join('; ')
          : 'Default baseline physical and systemic conditions';

      const prompt = `Analyze this educational "What-If" experiment:
Question: ${cleanQuestion}
Current Adjustable Assumptions: ${assumptionSummary}

Provide:
1. A clear title and domain category.
2. 3 concrete predictions with confidence levels and directional impacts.
3. 3 adjustable numeric parameters (id, label, min, max, step, unit, value, baseline, sensitivity) relevant to this experiment.
4. A thorough explanation of why these outcomes occur step by step.
5. 3 real-world applications or historical/scientific parallels.
6. 5 numeric data points for a before-vs-after comparison chart (label, baseline, simulated).`;

      const parsed = await generateStructuredJson<Record<string, unknown>>(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are an interactive science and systems simulation engine for STUDYBRIDGE. Output strictly valid JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                domain: { type: Type.STRING },
                summary: { type: Type.STRING },
                predictions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      metric: { type: Type.STRING },
                      projectedOutcome: { type: Type.STRING },
                      confidence: { type: Type.STRING },
                    },
                  },
                },
                parameters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      label: { type: Type.STRING },
                      unit: { type: Type.STRING },
                      min: { type: Type.NUMBER },
                      max: { type: Type.NUMBER },
                      step: { type: Type.NUMBER },
                      baseline: { type: Type.NUMBER },
                      value: { type: Type.NUMBER },
                      sensitivity: { type: Type.NUMBER },
                    },
                  },
                },
                outcomeExplanation: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                realWorldApplications: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                  },
                },
                chartSeries: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      baseline: { type: Type.NUMBER },
                      simulated: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
          },
        },
        maxRetries,
        retryBaseDelayMs
      );

      const rawPredictions = Array.isArray(parsed.predictions) ? parsed.predictions : [];
      const rawApps = Array.isArray(parsed.realWorldApplications) ? parsed.realWorldApplications : [];
      const rawSeries = Array.isArray(parsed.chartSeries) ? parsed.chartSeries : [];

      return res.json({
        experiment: {
          title: toTrimmedString(parsed.title, 200, cleanQuestion),
          domain: toTrimmedString(parsed.domain, 100, 'Interdisciplinary Systems'),
          summary: toTrimmedString(parsed.summary, 1500),
          predictions: rawPredictions
            .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
            .slice(0, 10)
            .map((p) => ({
              metric: toTrimmedString(p.metric, 120, 'Metric'),
              projectedOutcome: toTrimmedString(p.projectedOutcome, 500),
              confidence: toTrimmedString(p.confidence, 60, 'Moderate'),
            })),
          parameters: sanitizeExperimentParameters(parsed.parameters).slice(0, 10),
          outcomeExplanation: toStringArray(parsed.outcomeExplanation, 15),
          realWorldApplications: rawApps
            .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === 'object'))
            .slice(0, 10)
            .map((a) => ({
              title: toTrimmedString(a.title, 160, 'Application'),
              description: toTrimmedString(a.description, 600),
            })),
          chartSeries: rawSeries
            .filter((pt): pt is Record<string, unknown> => Boolean(pt && typeof pt === 'object'))
            .slice(0, 15)
            .map((pt, idx) => ({
              label: toTrimmedString(pt.label, 80, `Point ${idx + 1}`),
              baseline: Number.isFinite(Number(pt.baseline)) ? Number(pt.baseline) : 0,
              simulated: Number.isFinite(Number(pt.simulated)) ? Number(pt.simulated) : 0,
            })),
        },
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.post('/api/solution', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const cleanProblem = toTrimmedString(body.problemStatement, 1200);
      if (!cleanProblem) {
        return res
          .status(400)
          .json({ error: 'Describe a real-world problem or solution goal to build a blueprint.' });
      }

      const targetCommunity = toTrimmedString(
        body.targetCommunity,
        240,
        'Students & local community'
      );
      const constraints = toTrimmedString(
        body.constraints,
        600,
        'Accessible student budget and open tools'
      );
      const linkedTopic = toTrimmedString(body.linkedTopic, 160);
      const linkedContext = toTrimmedString(body.linkedContext, 1000);

      const ai = getAiClient();
      const prompt = `Design an actionable, student-buildable real-world solution blueprint.
Problem Statement: ${cleanProblem}
Target Community: ${targetCommunity}
Constraints & Resources: ${constraints}
${linkedTopic ? `Linked Academic Concept: ${linkedTopic}` : ''}
${linkedContext ? `Context from Experiments / Notes: ${linkedContext}` : ''}

Requirements:
- Ground the solution in real scientific, mathematical, or economic principles.
- Include a feasibilityScore (integer 40-98), an aiIntegrationPlan explaining how AI supports sensing/modeling/decision-making, 3 concrete buildPhases, 3 measurable impactMetrics, 4 collaborative tasks teammates can split and check off, and 2 realistic risks with mitigations.`;

      const parsed = await generateStructuredJson<Record<string, unknown>>(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a project mentor for STUDYBRIDGE helping student teams build meaningful, grounded real-world solutions using AI. Output strictly valid JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                domain: { type: Type.STRING },
                solutionSummary: { type: Type.STRING },
                feasibilityScore: { type: Type.INTEGER },
                aiIntegrationPlan: { type: Type.STRING },
                buildPhases: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phase: { type: Type.STRING },
                      action: { type: Type.STRING },
                      deliverable: { type: Type.STRING },
                    },
                  },
                },
                impactMetrics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      metric: { type: Type.STRING },
                      target: { type: Type.STRING },
                    },
                  },
                },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                    },
                  },
                },
                risks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      challenge: { type: Type.STRING },
                      mitigation: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
        maxRetries,
        retryBaseDelayMs
      );

      return res.json({
        solution: {
          title: toTrimmedString(parsed.title, 200, 'AI Solution Blueprint'),
          domain: toTrimmedString(parsed.domain, 100, 'Interdisciplinary Innovation'),
          solutionSummary: toTrimmedString(parsed.solutionSummary, 1800),
          feasibilityScore: clampInt(parsed.feasibilityScore, 40, 99, 80),
          aiIntegrationPlan: toTrimmedString(parsed.aiIntegrationPlan, 1500),
          buildPhases: (Array.isArray(parsed.buildPhases) ? parsed.buildPhases : [])
            .filter((bp): bp is Record<string, unknown> => Boolean(bp && typeof bp === 'object'))
            .slice(0, 10)
            .map((bp, idx) => ({
              phase: toTrimmedString(bp.phase, 120, `Phase ${idx + 1}`),
              action: toTrimmedString(bp.action, 500),
              deliverable: toTrimmedString(bp.deliverable, 300),
            })),
          impactMetrics: (Array.isArray(parsed.impactMetrics) ? parsed.impactMetrics : [])
            .filter((im): im is Record<string, unknown> => Boolean(im && typeof im === 'object'))
            .slice(0, 10)
            .map((im) => ({
              metric: toTrimmedString(im.metric, 120, 'Impact Metric'),
              target: toTrimmedString(im.target, 240),
            })),
          tasks: (Array.isArray(parsed.tasks) ? parsed.tasks : [])
            .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
            .slice(0, 20)
            .map((t, idx) => ({
              title: toTrimmedString(t.title, 240, `Task ${idx + 1}`),
            })),
          risks: (Array.isArray(parsed.risks) ? parsed.risks : [])
            .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
            .slice(0, 10)
            .map((r) => ({
              challenge: toTrimmedString(r.challenge, 300),
              mitigation: toTrimmedString(r.mitigation, 400),
            })),
        },
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.post('/api/solution/iterate', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawSolution =
        body.solution && typeof body.solution === 'object'
          ? (body.solution as Record<string, unknown>)
          : null;
      const cleanTitle = toTrimmedString(rawSolution?.title, 200);
      const cleanFeedback = toTrimmedString(body.feedback, 1000);

      if (!cleanFeedback || !cleanTitle) {
        return res
          .status(400)
          .json({ error: 'Provide peer feedback or a new constraint to iterate the solution.' });
      }

      const ai = getAiClient();
      const prompt = `Refine this student solution blueprint based on peer/mentor feedback.
Current Solution Title: ${cleanTitle}
Problem: ${toTrimmedString(rawSolution?.problemStatement, 1200)}
Current Summary: ${toTrimmedString(rawSolution?.solutionSummary, 1800)}
Current AI Integration: ${toTrimmedString(rawSolution?.aiIntegrationPlan, 1500)}
Constraints: ${toTrimmedString(rawSolution?.constraints, 600)}
Peer / Constraint Feedback: ${cleanFeedback}

Return an improved solutionSummary, updated feasibilityScore (integer 0-100), improved aiIntegrationPlan, 3 updated buildPhases, 3 impactMetrics, 3-4 updated tasks, 2 risks, and a concise iterationNote summarizing the concrete improvements made.`;

      const parsed = await generateStructuredJson<Record<string, unknown>>(
        ai,
        {
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are an engineering and design reviewer for STUDYBRIDGE. Refine student prototypes rigorously based on peer feedback. Output strictly valid JSON.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                solutionSummary: { type: Type.STRING },
                feasibilityScore: { type: Type.INTEGER },
                aiIntegrationPlan: { type: Type.STRING },
                iterationNote: { type: Type.STRING },
                buildPhases: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      phase: { type: Type.STRING },
                      action: { type: Type.STRING },
                      deliverable: { type: Type.STRING },
                    },
                  },
                },
                impactMetrics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      metric: { type: Type.STRING },
                      target: { type: Type.STRING },
                    },
                  },
                },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                    },
                  },
                },
                risks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      challenge: { type: Type.STRING },
                      mitigation: { type: Type.STRING },
                    },
                  },
                },
              },
            },
          },
        },
        maxRetries,
        retryBaseDelayMs
      );

      return res.json({
        iteration: {
          solutionSummary: toTrimmedString(parsed.solutionSummary, 1800),
          feasibilityScore: clampInt(parsed.feasibilityScore, 0, 100, 80),
          aiIntegrationPlan: toTrimmedString(parsed.aiIntegrationPlan, 1500),
          iterationNote: toTrimmedString(
            parsed.iterationNote,
            1500,
            `Refined blueprint from feedback: "${cleanFeedback.slice(0, 120)}"`
          ),
          buildPhases: (Array.isArray(parsed.buildPhases) ? parsed.buildPhases : [])
            .filter((bp): bp is Record<string, unknown> => Boolean(bp && typeof bp === 'object'))
            .slice(0, 10)
            .map((bp, idx) => ({
              phase: toTrimmedString(bp.phase, 120, `Phase ${idx + 1}`),
              action: toTrimmedString(bp.action, 500),
              deliverable: toTrimmedString(bp.deliverable, 300),
            })),
          impactMetrics: (Array.isArray(parsed.impactMetrics) ? parsed.impactMetrics : [])
            .filter((im): im is Record<string, unknown> => Boolean(im && typeof im === 'object'))
            .slice(0, 10)
            .map((im) => ({
              metric: toTrimmedString(im.metric, 120, 'Impact Metric'),
              target: toTrimmedString(im.target, 240),
            })),
          tasks: (Array.isArray(parsed.tasks) ? parsed.tasks : [])
            .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
            .slice(0, 20)
            .map((t, idx) => ({
              title: toTrimmedString(t.title, 240, `Updated task ${idx + 1}`),
            })),
          risks: (Array.isArray(parsed.risks) ? parsed.risks : [])
            .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
            .slice(0, 10)
            .map((r) => ({
              challenge: toTrimmedString(r.challenge, 300),
              mitigation: toTrimmedString(r.mitigation, 400),
            })),
        },
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.post('/api/tutor', async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const rawMessages = Array.isArray(body.messages) ? body.messages : [];
      const history = rawMessages
        .filter(
          (m): m is { role?: unknown; text: string } =>
            Boolean(m && typeof m === 'object') &&
            typeof (m as Record<string, unknown>).text === 'string' &&
            (m as { text: string }).text.trim().length > 0
        )
        .map((m) => ({
          role: m.role === 'model' ? ('model' as const) : ('user' as const),
          text: m.text.trim().slice(0, 4000),
        }));

      if (history.length === 0) {
        return res.status(400).json({ error: 'Please enter a message for the Study Tutor.' });
      }

      const ai = getAiClient();
      const roleKey = toTrimmedString(body.roleId, 40, 'socratic');
      const chosenRole = TUTOR_ROLE_INSTRUCTIONS[roleKey] || TUTOR_ROLE_INSTRUCTIONS.socratic;

      const requestedModelId = toTrimmedString(body.modelId, 60);
      const requestedModel = ALLOWED_TUTOR_MODELS.has(requestedModelId)
        ? requestedModelId
        : 'gemini-4-hydrogen';
      const useSearchGrounding = Boolean(body.useSearchGrounding);
      const activeModel = useSearchGrounding ? 'gemini-4-hydrogen' : requestedModel;
      const learnerContext = toTrimmedString(body.learnerContext, 600);

      const systemInstruction = `${chosenRole}
${learnerContext ? `Student Context: ${learnerContext}` : ''}
${useSearchGrounding ? 'Use live Google Search results to verify facts, current events, recent scientific updates, and dates.' : ''}`;

      const contents = history.slice(-24).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const config: {
        systemInstruction: string;
        tools?: Array<{ googleSearch: Record<string, never> }>;
      } = {
        systemInstruction,
      };

      if (useSearchGrounding) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
            model: activeModel,
            contents,
            config,
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const reply = (response.text ?? '').trim();
      if (!reply) {
        throw new Error('The Study Tutor returned an empty response. Please try again.');
      }

      const citations = useSearchGrounding ? extractGroundingCitations(response) : [];

      return res.json({
        reply,
        modelUsed: activeModel,
        citations,
      });
    } catch (error) {
      return sendApiError(res, error);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  if (!options.getAiClient) {
    const distPath = path.resolve(__dirname, 'dist');
    const distIndex = path.join(distPath, 'index.html');
    const isDev =
      process.argv.includes('--dev') ||
      (process.env.NODE_ENV !== 'production' && !fs.existsSync(distIndex));

    if (isDev) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        if (!fs.existsSync(distIndex)) {
          return res.status(500).send('Application build not found.');
        }
        return res.sendFile(distIndex);
      });
    }
  }

  return app;
}

const isMainModule =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`STUDYBRIDGE running on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start STUDYBRIDGE server:', err);
      process.exit(1);
    });
}
