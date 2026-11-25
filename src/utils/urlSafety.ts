export function isSafeHttpUrl(rawUrl: string | undefined | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeCitations<T extends { title: string; uri: string }>(
  items: unknown
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is T =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as { uri?: unknown }).uri === 'string' &&
      isSafeHttpUrl((item as { uri: string }).uri)
  );
}
