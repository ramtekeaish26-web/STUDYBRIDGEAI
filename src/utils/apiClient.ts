export interface PostJsonOptions {
  signal?: AbortSignal;
}

export async function postJson<TResponse>(
  url: string,
  payload: unknown,
  options: PostJsonOptions = {}
): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }
    throw new Error('Server returned an unreadable response.');
  }

  if (!response.ok) {
    const errMessage =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}.`;
    throw new Error(errMessage);
  }

  return data as TResponse;
}
