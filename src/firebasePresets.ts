import firebaseConfig from '../firebase-applet-config.json';

export interface FirebasePreset {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  config: {
    projectId: string;
    appId: string;
    apiKey: string;
    authDomain: string;
    firestoreDatabaseId: string;
    storageBucket: string;
    messagingSenderId: string;
    measurementId?: string;
    oAuthClientId?: string;
  };
}

export const FIREBASE_PRESETS: FirebasePreset[] = [
  {
    id: firebaseConfig.projectId || "banco-03-teste",
    name: "Banco Oficial (Google Cloud Firestore)",
    badge: "Oficial (Plano Blaze)",
    badgeColor: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    description: `Banco de Dados Oficial Unificado (${firebaseConfig.firestoreDatabaseId || "(default)"})`,
    config: {
      projectId: firebaseConfig.projectId || "banco-03-teste",
      appId: firebaseConfig.appId,
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)",
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      measurementId: firebaseConfig.measurementId || "",
      oAuthClientId: firebaseConfig.oAuthClientId || ""
    }
  }
];

export function getActivePresetId(projectId?: string): string {
  if (projectId && FIREBASE_PRESETS.some(p => p.id === projectId || p.config.projectId === projectId)) {
    return projectId;
  }
  return FIREBASE_PRESETS[0].id;
}

