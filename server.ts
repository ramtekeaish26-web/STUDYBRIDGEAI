import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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

function getGeminiClient(): GoogleGenAI {
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
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, message: raw };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'API permission denied. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('400')) {
    return {
      status: 400,
      message: 'Invalid API key or request parameters. Please check Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit or quota reached. If using a paid-tier reasoning model, verify a billing-enabled key in Settings > Secrets.',
    };
  }
  return {
    status: 500,
    message: raw || 'Unable to reach AI service. Please try again.',
  };
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
    if (uri && !seen.has(uri)) {
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

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/simplify', async (req, res) => {
    try {
      const { topic, level, language, notes, useSearchGrounding } = req.body as {
        topic?: string;
        level?: string;
        language?: string;
        notes?: string;
        useSearchGrounding?: boolean;
      };

      const cleanTopic = (topic || '').trim();
      const cleanNotes = (notes || '').trim();
      if (!cleanTopic && !cleanNotes) {
        return res.status(400).json({ error: 'Please enter a topic or upload study notes.' });
      }

      const ai = getGeminiClient();
      const targetLevel = level || 'Intermediate';
      const targetLanguage = language || 'English';

      let groundedContext = '';
      let groundedSources: Array<{ title: string; uri: string }> = [];

      if (useSearchGrounding && cleanTopic) {
        const searchResp = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Provide concise, up-to-date factual highlights, key discoveries, or modern real-world developments on "${cleanTopic}" suitable for a ${targetLevel} learner.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
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

      const response = await ai.models.generateContent({
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
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({
        lesson: {
          ...parsed,
          groundedSources,
        },
      });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/quiz', async (req, res) => {
    try {
      const { topic, level, count, focusContext } = req.body as {
        topic?: string;
        level?: string;
        count?: number;
        focusContext?: string;
      };

      const cleanTopic = (topic || '').trim();
      if (!cleanTopic) {
        return res.status(400).json({ error: 'Please specify a topic for the quiz.' });
      }

      const questionCount = Math.min(Math.max(Number(count) || 5, 3), 8);
      const targetLevel = level || 'Intermediate';
      const ai = getGeminiClient();

      const prompt = `Generate ${questionCount} rigorous multiple-choice questions on "${cleanTopic}" at the ${targetLevel} level.
${focusContext ? `Additional context to test: ${focusContext.slice(0, 2000)}` : ''}
Each question must have exactly 4 distinct answer options, one correct index (0 to 3), and a concise educational explanation clarifying why the correct option works and why distractors fail.`;

      const response = await ai.models.generateContent({
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
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/experiment', async (req, res) => {
    try {
      const { question, assumptions } = req.body as {
        question?: string;
        assumptions?: Array<{ label: string; value: number; unit: string }>;
      };

      const cleanQuestion = (question || '').trim();
      if (!cleanQuestion) {
        return res.status(400).json({ error: 'Please enter a what-if question to explore.' });
      }

      const ai = getGeminiClient();
      const assumptionSummary =
        assumptions && assumptions.length > 0
          ? assumptions.map((a) => `${a.label}: ${a.value} ${a.unit}`).join('; ')
          : 'Default baseline physical and systemic conditions';

      const prompt = `Analyze this educational "What-If" experiment:
Question: ${cleanQuestion}
Current Adjustable Assumptions: ${assumptionSummary}

Provide:
1. A clear title and domain category.
2. 3 concrete predictions with confidence levels and directional impacts.
3. 3 adjustable numeric parameters (label, min, max, step, unit, currentValue, baselineValue, impactDirection) relevant to this experiment.
4. A thorough explanation of why these outcomes occur step by step.
5. 3 real-world applications or historical/scientific parallels.
6. 5 numeric data points for a before-vs-after comparison chart (label, baseline, simulated).`;

      const response = await ai.models.generateContent({
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
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ experiment: parsed });
    } catch (error) {
      const formatted = formatApiError(error);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/tutor', async (req, res) => {
    try {
      const { messages, roleId, modelId, useSearchGrounding, learnerContext } = req.body as {
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

      const ai = getGeminiClient();
      const chosenRole = TUTOR_ROLE_INSTRUCTIONS[roleId || 'socratic'] || TUTOR_ROLE_INSTRUCTIONS.socratic;

      // When Google Search grounding is enabled, enforce gemini-4-hydrogen with googleSearch tool
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

      const response = await ai.models.generateContent({
        model: activeModel,
        contents,
        config,
      });

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
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`STUDYBRIDGE running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start STUDYBRIDGE server:', err);
  process.exit(1);
});
