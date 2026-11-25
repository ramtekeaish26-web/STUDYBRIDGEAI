import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// We test postJson by running it against a real local HTTP server
// rather than mocking fetch, ensuring true integration coverage.

async function startMiniServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}

test('postJson sends POST with JSON body and returns parsed response', async () => {
  // Dynamic import so tsx resolves the client-side module
  const { postJson } = await import('../src/utils/apiClient');

  const srv = await startMiniServer((req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ echo: parsed.topic, ok: true }));
    });
  });

  try {
    const result = await postJson<{ echo: string; ok: boolean }>(srv.url, { topic: 'DNA' });
    assert.equal(result.echo, 'DNA');
    assert.equal(result.ok, true);
  } finally {
    await srv.close();
  }
});

test('postJson throws with error message from non-OK response body', async () => {
  const { postJson } = await import('../src/utils/apiClient');

  const srv = await startMiniServer((_req, res) => {
    res.writeHead(422, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Topic is required.' }));
  });

  try {
    await assert.rejects(
      () => postJson(srv.url, {}),
      (err: Error) => {
        assert.ok(err.message.includes('Topic is required'), `got: ${err.message}`);
        return true;
      }
    );
  } finally {
    await srv.close();
  }
});

test('postJson throws generic message when non-OK body has no error field', async () => {
  const { postJson } = await import('../src/utils/apiClient');

  const srv = await startMiniServer((_req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'internal' }));
  });

  try {
    await assert.rejects(
      () => postJson(srv.url, {}),
      (err: Error) => {
        assert.ok(err.message.includes('500'), `should contain status: ${err.message}`);
        return true;
      }
    );
  } finally {
    await srv.close();
  }
});

test('postJson handles AbortController cancellation', async () => {
  const { postJson } = await import('../src/utils/apiClient');

  const srv = await startMiniServer((_req, res) => {
    // Intentionally delay response — the client should abort before receiving it
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: 'too late' }));
    }, 5000);
  });

  try {
    const controller = new AbortController();
    // Abort almost immediately
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      () => postJson(srv.url, { topic: 'test' }, { signal: controller.signal }),
      (err: Error) => {
        // Node fetch throws AbortError with 'abort' in name or message
        assert.ok(
          err.name === 'AbortError' || err.message.toLowerCase().includes('abort'),
          `Expected abort error, got: ${err.name}: ${err.message}`
        );
        return true;
      }
    );
  } finally {
    await srv.close();
  }
});
