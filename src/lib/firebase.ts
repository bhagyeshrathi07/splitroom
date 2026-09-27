import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import oauthConfig from '../../oauth-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dedicated provider for Google Calendar free/busy incremental consent
export const calendarProvider = new GoogleAuthProvider();
calendarProvider.addScope('https://www.googleapis.com/auth/calendar.freebusy');
calendarProvider.setCustomParameters({ prompt: 'select_account' });

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    // Harmless probe in case network or collection is syncing
    console.debug('Firebase initial sync notice:', error);
    return false;
  }
}

// In-memory access token cache for Google Workspace integrations
let cachedAccessToken: string | null = null;

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Sign-in error:', err);
    throw err;
  }
};

export const getCachedAccessToken = () => cachedAccessToken;
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const requestCalendarToken = async (): Promise<string> => {
  if (cachedAccessToken) return cachedAccessToken;

  // 1. Google Identity Services (GIS) Token Client for Workspace scopes
  if (
    typeof window !== 'undefined' &&
    typeof (window as any).google !== 'undefined' &&
    (window as any).google.accounts?.oauth2
  ) {
    const gsi = (window as any).google;
    const clientId = oauthConfig.client_id || (firebaseConfig as any).oAuthClientId;

    return new Promise((resolve, reject) => {
      try {
        const client = gsi.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/calendar.freebusy',
          hint: auth.currentUser?.email || undefined,
          callback: (response: any) => {
            if (response.error) {
              reject(
                new Error(response.error_description || response.error || 'Google Calendar permission denied')
              );
              return;
            }
            if (response.access_token) {
              cachedAccessToken = response.access_token;
              resolve(response.access_token);
            } else {
              reject(new Error('No access token returned from Google Calendar'));
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || 'Google OAuth prompt error'));
          },
        });
        client.requestAccessToken();
      } catch (err) {
        reject(err);
      }
    });
  }

  // 2. Fallback to Firebase popup provider if GIS is not available
  const result = await signInWithPopup(auth, calendarProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not obtain Google Calendar access token.');
  }
  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
