import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || ''
};

export const firebaseReady = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId
);

const app = firebaseReady
  ? getApps().length > 0 ? getApp() : initializeApp(config)
  : null;

let initializedAuth: Auth | null = null;
if (app) {
  initializedAuth = Capacitor.isNativePlatform()
    ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
    : getAuth(app);
}

export const auth = initializedAuth;
export const firestore = app ? getFirestore(app) : null;

export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Firebase 설정이 아직 완료되지 않았습니다.');

  if (Capacitor.isNativePlatform()) {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error('Google 로그인 토큰을 받지 못했습니다.');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return;
  }

  const provider = new GoogleAuthProvider();
  const mobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobileBrowser) {
    await signInWithRedirect(auth, provider);
  } else {
    await signInWithPopup(auth, provider);
  }
}

export async function signOutAgentZ(): Promise<void> {
  if (!auth) return;
  if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
  await firebaseSignOut(auth);
}
