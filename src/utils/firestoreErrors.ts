import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const currentUser = auth?.currentUser;
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function formatFirestoreErrorMessage(
  error: unknown,
  operationType: OperationType,
  path: string | null
): string {
  const raw = error instanceof Error ? error.message : String(error);
  console.error('Firestore Error: ', JSON.stringify(buildFirestoreErrorInfo(error, operationType, path)));
  if (raw.includes('permission-denied') || raw.includes('PERMISSION_DENIED')) {
    return 'Cloud sync permission denied. Make sure your Google account email is verified and you have access to this workspace.';
  }
  return `Cloud sync failed (${operationType} ${path || 'workspace'}): ${raw}`;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  throw new Error(serialized);
}

export function toSafeDocId(raw: string, fallbackPrefix = 'doc'): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 110);
  if (!cleaned) {
    return `${fallbackPrefix}-${Date.now()}`;
  }
  return cleaned;
}
