import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

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

export async function createApp(options: ServerOptions = {}) {
  const app = express();
  const getAiClient = options.getAiClient ?? defaultGetGeminiClient;
  const maxRetries = options.maxRetries ?? 2;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 400;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      aiConfigured: options.getAiClient ? true : isGeminiConfigured(),
    });
  });

  app.post('/api/simplify', async (req, res) => {
    try {
      const { topic, level, language, notes, useSearchGrounding } = (req.body ?? {}) as {
        topic?: string;
        level?: string;
        language?: string;
        notes?: string;
        useSearchGrounding?: boolean;
      };

      const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
      const cleanNotes = typeof notes === 'string' ? notes.trim() : '';
      if (!cleanTopic && !cleanNotes) {
        return res.status(400).json({ error: 'Please enter a topic or upload study notes.' });
      }

      const ai = getAiClient();
      const targetLevel = level || 'Intermediate';
      const targetLanguage = language || 'English';

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
${cleanNotes ? `\nReference Notes / Document Excerpt:\n${cleanNotes.slice(0, 6000)}` : ''}
${groundedContext ? `\nUp-to-Date Web Context (integrate accurate facts where helpful):\n${groundedContext.slice(0, 2500)}` : ''}

Requirements:
- Tailor vocabulary and depth strictly to ${targetLevel} level.
- Write all content fields in ${targetLanguage}.
- Provide a concise definition, a clear step-by-step core mechanism, 2 concrete real-world examples, 2 intuitive analogies, and 4 actionable key takeaways.`;

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
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
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const parsed = safeParseJson<Record<string, unknown>>(response.text);
      return res.json({
        lesson: {
          ...parsed,
          groundedSources,
        },
      });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/quiz', async (req, res) => {
    try {
      const { topic, level, count, focusContext } = (req.body ?? {}) as {
        topic?: string;
        level?: string;
        count?: number;
        focusContext?: string;
      };

      const cleanTopic = typeof topic === 'string' ? topic.trim() : '';
      if (!cleanTopic) {
        return res.status(400).json({ error: 'Please specify a topic for the quiz.' });
      }

      const questionCount = Math.min(Math.max(Number(count) || 5, 3), 8);
      const targetLevel = level || 'Intermediate';
      const ai = getAiClient();

      const prompt = `Generate ${questionCount} rigorous multiple-choice questions on "${cleanTopic}" at the ${targetLevel} level.
${focusContext ? `Additional context to test: ${focusContext.slice(0, 2000)}` : ''}
Each question must have exactly 4 distinct answer options, one correct index (0 to 3), and a concise educational explanation clarifying why the correct option works and why distractors fail.`;

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
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
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const parsed = safeParseJson<{
        subject?: string;
        questions?: Array<{
          prompt?: string;
          options?: string[];
          correctIndex?: number;
          explanation?: string;
        }>;
      }>(response.text);

      const normalizedQuestions = (Array.isArray(parsed.questions) ? parsed.questions : [])
        .filter((q) => q && typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length >= 2)
        .map((q) => {
          const opts = (q.options || []).slice(0, 4).map((o) => String(o));
          while (opts.length < 4) {
            opts.push(`Option ${opts.length + 1}`);
          }
          const correctIndex = Math.min(
            Math.max(Number.isFinite(Number(q.correctIndex)) ? Number(q.correctIndex) : 0, 0),
            opts.length - 1
          );
          return {
            prompt: String(q.prompt),
            options: opts,
            correctIndex,
            explanation: String(q.explanation || 'Review the concept explanation for details.'),
          };
        });

      return res.json({
        subject: parsed.subject || 'General Study',
        questions: normalizedQuestions,
      });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/experiment', async (req, res) => {
    try {
      const { question, assumptions } = (req.body ?? {}) as {
        question?: string;
        assumptions?: Array<{ label: string; value: number; unit: string }>;
      };

      const cleanQuestion = typeof question === 'string' ? question.trim() : '';
      if (!cleanQuestion) {
        return res.status(400).json({ error: 'Please enter a what-if question to explore.' });
      }

      const ai = getAiClient();
      const assumptionSummary =
        Array.isArray(assumptions) && assumptions.length > 0
          ? assumptions.map((a) => `${a.label}: ${a.value} ${a.unit}`).join('; ')
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

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
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
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const parsed = safeParseJson<Record<string, unknown>>(response.text);
      return res.json({ experiment: parsed });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/solution', async (req, res) => {
    try {
      const {
        problemStatement,
        targetCommunity,
        constraints,
        linkedTopic,
        linkedContext,
      } = (req.body ?? {}) as {
        problemStatement?: string;
        targetCommunity?: string;
        constraints?: string;
        linkedTopic?: string;
        linkedContext?: string;
      };

      const cleanProblem = typeof problemStatement === 'string' ? problemStatement.trim() : '';
      if (!cleanProblem) {
        return res
          .status(400)
          .json({ error: 'Describe a real-world problem or solution goal to build a blueprint.' });
      }

      const ai = getAiClient();
      const prompt = `Design an actionable, student-buildable real-world solution blueprint.
Problem Statement: ${cleanProblem.slice(0, 1200)}
Target Community: ${(targetCommunity || 'Students & local community').slice(0, 240)}
Constraints & Resources: ${(constraints || 'Accessible student budget and open tools').slice(0, 600)}
${linkedTopic ? `Linked Academic Concept: ${linkedTopic.slice(0, 160)}` : ''}
${linkedContext ? `Context from Experiments / Notes: ${linkedContext.slice(0, 1000)}` : ''}

Requirements:
- Ground the solution in real scientific, mathematical, or economic principles.
- Include a feasibilityScore (integer 40-98), an aiIntegrationPlan explaining how AI supports sensing/modeling/decision-making, 3 concrete buildPhases, 3 measurable impactMetrics, 4 collaborative tasks teammates can split and check off, and 2 realistic risks with mitigations.`;

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
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
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const parsed = safeParseJson<Record<string, unknown>>(response.text);
      return res.json({ solution: parsed });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/solution/iterate', async (req, res) => {
    try {
      const { solution, feedback } = (req.body ?? {}) as {
        solution?: {
          title?: string;
          problemStatement?: string;
          solutionSummary?: string;
          aiIntegrationPlan?: string;
          constraints?: string;
          feasibilityScore?: number;
        };
        feedback?: string;
      };

      const cleanFeedback = typeof feedback === 'string' ? feedback.trim() : '';
      if (!cleanFeedback || !solution?.title) {
        return res
          .status(400)
          .json({ error: 'Provide peer feedback or a new constraint to iterate the solution.' });
      }

      const ai = getAiClient();
      const prompt = `Refine this student solution blueprint based on peer/mentor feedback.
Current Solution Title: ${solution.title}
Problem: ${solution.problemStatement || ''}
Current Summary: ${solution.solutionSummary || ''}
Current AI Integration: ${solution.aiIntegrationPlan || ''}
Constraints: ${solution.constraints || ''}
Peer / Constraint Feedback: ${cleanFeedback.slice(0, 1000)}

Return an improved solutionSummary, updated feasibilityScore (integer 0-100), improved aiIntegrationPlan, 3 updated buildPhases, 3 impactMetrics, 3-4 updated tasks, 2 risks, and a concise iterationNote summarizing the concrete improvements made.`;

      const response = await withGeminiRetry(
        () =>
          ai.models.generateContent({
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
          }),
        maxRetries,
        retryBaseDelayMs
      );

      const parsed = safeParseJson<Record<string, unknown>>(response.text);
      return res.json({ iteration: parsed });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  app.post('/api/tutor', async (req, res) => {
    try {
      const { messages, roleId, modelId, useSearchGrounding, learnerContext } = (req.body ?? {}) as {
        messages?: Array<{ role: 'user' | 'model'; text: string }>;
        roleId?: string;
        modelId?: string;
        useSearchGrounding?: boolean;
        learnerContext?: string;
      };

      const history = Array.isArray(messages) ? messages.filter((m) => m.text?.trim()) : [];
      if (history.length === 0) {
        return res.status(400).json({ error: 'Please enter a message for the Study Tutor.' });
      }

      const ai = getAiClient();
      const chosenRole =
        TUTOR_ROLE_INSTRUCTIONS[roleId || 'socratic'] || TUTOR_ROLE_INSTRUCTIONS.socratic;

      const requestedModel = ALLOWED_TUTOR_MODELS.has(modelId || '')
        ? (modelId as string)
        : 'gemini-4-hydrogen';
      const activeModel = useSearchGrounding ? 'gemini-4-hydrogen' : requestedModel;

      const systemInstruction = `${chosenRole}
${learnerContext ? `Student Context: ${learnerContext}` : ''}
${useSearchGrounding ? 'Use live Google Search results to verify facts, current events, recent scientific updates, and dates.' : ''}`;

      const contents = history.slice(-24).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
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
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
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
