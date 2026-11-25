import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, formatApiError, GeminiClientLike, safeParseJson } from '../server';

async function startTestServer(
  generateContentImpl: GeminiClientLike['models']['generateContent'],
  options?: { maxRetries?: number; retryBaseDelayMs?: number }
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = await createApp({
    getAiClient: () => ({
      models: {
        generateContent: generateContentImpl,
      },
    }),
    maxRetries: options?.maxRetries ?? 2,
    retryBaseDelayMs: options?.retryBaseDelayMs ?? 5,
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}

test('formatApiError classifies missing key, 403, 404, 429 quota, and 503 overload', () => {
  assert.equal(formatApiError(new Error('GEMINI_API_KEY is not configured')).status, 503);
  assert.equal(formatApiError({ status: 403, message: 'PERMISSION_DENIED' }).status, 403);
  assert.equal(formatApiError({ status: 404, message: 'NOT_FOUND' }).status, 404);
  assert.equal(formatApiError({ status: 429, message: 'RESOURCE_EXHAUSTED quota' }).status, 429);
  assert.equal(formatApiError({ status: 503, message: 'UNAVAILABLE' }).status, 503);
});

test('safeParseJson strips markdown fences and rejects empty payloads', () => {
  assert.deepEqual(safeParseJson<{ a: number }>('```json\n{"a":42}\n```'), { a: 42 });
  assert.throws(() => safeParseJson('   '), SyntaxError);
});

test('API health check and input validation errors return expected HTTP statuses', async () => {
  const srv = await startTestServer(async () => ({ text: '{}' }));
  try {
    const health = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(health.status, 200);
    const healthBody = (await health.json()) as { status: string; aiConfigured: boolean };
    assert.equal(healthBody.status, 'ok');

    const badSimplify = await fetch(`${srv.baseUrl}/api/simplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: '   ', notes: '' }),
    });
    assert.equal(badSimplify.status, 400);

    const badQuiz = await fetch(`${srv.baseUrl}/api/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(badQuiz.status, 400);

    const badExp = await fetch(`${srv.baseUrl}/api/experiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    });
    assert.equal(badExp.status, 400);

    const badTutor = await fetch(`${srv.baseUrl}/api/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    assert.equal(badTutor.status, 400);

    const badSolution = await fetch(`${srv.baseUrl}/api/solution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problemStatement: '' }),
    });
    assert.equal(badSolution.status, 400);
  } finally {
    await srv.close();
  }
});

test('API handles quota exceeded (429) with retry exhaustion and transient 503 recovery', async () => {
  let quotaCalls = 0;
  const quotaSrv = await startTestServer(
    async () => {
      quotaCalls += 1;
      const err = new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
      (err as unknown as { status: number }).status = 429;
      throw err;
    },
    { maxRetries: 2, retryBaseDelayMs: 5 }
  );

  try {
    const res = await fetch(`${quotaSrv.baseUrl}/api/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Thermodynamics', count: 4 }),
    });
    assert.equal(res.status, 429);
    const body = (await res.json()) as { code: string; error: string };
    assert.equal(body.code, 'QUOTA_EXCEEDED');
    assert.match(body.error, /Rate limit or quota reached/i);
    assert.equal(quotaCalls, 3); // initial + 2 retries
  } finally {
    await quotaSrv.close();
  }

  let transientCalls = 0;
  const recoverySrv = await startTestServer(
    async () => {
      transientCalls += 1;
      if (transientCalls === 1) {
        const err = new Error('503 UNAVAILABLE');
        (err as unknown as { status: number }).status = 503;
        throw err;
      }
      return {
        text: JSON.stringify({
          title: 'Entropy Explained',
          subject: 'Physics',
          readMinutes: 4,
          summary: 'Summary',
          definition: 'Definition',
          coreMechanism: ['Step 1'],
          examples: [],
          analogies: [],
          keyTakeaways: ['Takeaway'],
        }),
      };
    },
    { maxRetries: 2, retryBaseDelayMs: 5 }
  );

  try {
    const res = await fetch(`${recoverySrv.baseUrl}/api/simplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Entropy', level: 'Beginner', language: 'English' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { lesson: { title: string } };
    assert.equal(body.lesson.title, 'Entropy Explained');
    assert.equal(transientCalls, 2);
  } finally {
    await recoverySrv.close();
  }
});

test('API missing key returns 503 MISSING_API_KEY without retrying', async () => {
  let calls = 0;
  const srv = await startTestServer(async () => {
    calls += 1;
    throw new Error('GEMINI_API_KEY is not configured. Add your key in Settings > Secrets.');
  });

  try {
    const res = await fetch(`${srv.baseUrl}/api/simplify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Photosynthesis' }),
    });
    assert.equal(res.status, 503);
    const body = (await res.json()) as { code: string };
    assert.equal(body.code, 'MISSING_API_KEY');
    assert.equal(calls, 1);
  } finally {
    await srv.close();
  }
});

test('/api/quiz normalizes option count to 4 and clamps out-of-range correctIndex', async () => {
  const srv = await startTestServer(async () => ({
    text: JSON.stringify({
      subject: 'Biology',
      questions: [
        {
          prompt: 'Which organelle performs cellular respiration?',
          options: ['Mitochondria', 'Golgi apparatus'],
          correctIndex: 9,
          explanation: 'Mitochondria generate ATP.',
        },
      ],
    }),
  }));

  try {
    const res = await fetch(`${srv.baseUrl}/api/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'Cellular Respiration', level: 'Beginner', count: 4 }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      questions: Array<{ options: string[]; correctIndex: number }>;
    };
    assert.equal(data.questions.length, 1);
    assert.equal(data.questions[0].options.length, 4);
    assert.equal(data.questions[0].correctIndex, 3);
  } finally {
    await srv.close();
  }
});

test('/api/tutor enforces Google Search model routing and extracts valid citations', async () => {
  let capturedModel = '';
  const srv = await startTestServer(async (params) => {
    capturedModel = String(params.model);
    return {
      text: 'ATP and NADPH power carbon fixation in the stroma.',
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { title: 'OpenStax Biology', uri: 'https://openstax.org/bio' } },
              { web: { title: 'Bad Link', uri: 'javascript:alert(1)' } },
            ],
          },
        },
      ],
    };
  });

  try {
    const res = await fetch(`${srv.baseUrl}/api/tutor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', text: 'Why does the Calvin cycle stop in darkness?' }],
        roleId: 'socratic',
        modelId: 'gemini-4-carbon',
        useSearchGrounding: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      modelUsed: string;
      citations: Array<{ title: string; uri: string }>;
    };
    assert.equal(capturedModel, 'gemini-4-hydrogen');
    assert.equal(body.modelUsed, 'gemini-4-hydrogen');
    assert.deepEqual(body.citations, [
      { title: 'OpenStax Biology', uri: 'https://openstax.org/bio' },
    ]);
  } finally {
    await srv.close();
  }
});

test('/api/solution and /api/solution/iterate return structured blueprints and revisions', async () => {
  const srv = await startTestServer(async (params) => {
    const content = String(params.contents || '');
    if (content.includes('Refine this student solution blueprint')) {
      return {
        text: JSON.stringify({
          solutionSummary: 'Updated low-cost prototype using passive solar shading.',
          feasibilityScore: 91,
          aiIntegrationPlan: 'TinyML temperature prediction every 5 minutes.',
          iterationNote: 'Reduced BOM below $30 by replacing active cooling.',
          buildPhases: [],
          impactMetrics: [],
          tasks: [{ title: 'Test passive shade canopy' }],
          risks: [],
        }),
      };
    }
    return {
      text: JSON.stringify({
        title: 'Solar Bus Shelter Cooling Kit',
        domain: 'Thermodynamics',
        solutionSummary: 'Reflective phase-change roof panel for commuter shade.',
        feasibilityScore: 86,
        aiIntegrationPlan: 'Predicts peak heat hours and misting schedule.',
        buildPhases: [
          { phase: 'Phase 1', action: 'Assemble frame', deliverable: 'Prototype canopy' },
        ],
        impactMetrics: [{ metric: 'Temperature Drop', target: '-4.5 C peak' }],
        tasks: [{ title: 'Measure ambient vs shaded delta' }],
        risks: [{ challenge: 'Dust buildup', mitigation: 'Hydrophobic coating' }],
      }),
    };
  });

  try {
    const createRes = await fetch(`${srv.baseUrl}/api/solution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemStatement: 'High urban bus stop heat spikes',
        targetCommunity: 'City commuters',
        constraints: 'Under $100',
      }),
    });
    assert.equal(createRes.status, 200);
    const created = (await createRes.json()) as { solution: { title: string; feasibilityScore: number } };
    assert.equal(created.solution.title, 'Solar Bus Shelter Cooling Kit');
    assert.equal(created.solution.feasibilityScore, 86);

    const iterRes = await fetch(`${srv.baseUrl}/api/solution/iterate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        solution: { title: 'Solar Bus Shelter Cooling Kit' },
        feedback: 'Lower budget below $30',
      }),
    });
    assert.equal(iterRes.status, 200);
    const iter = (await iterRes.json()) as { iteration: { feasibilityScore: number; iterationNote: string } };
    assert.equal(iter.iteration.feasibilityScore, 91);
    assert.match(iter.iteration.iterationNote, /\$30/);
  } finally {
    await srv.close();
  }
});
