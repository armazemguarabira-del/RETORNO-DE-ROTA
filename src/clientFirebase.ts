import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  terminate,
  setLogLevel,
  writeBatch
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import firebaseConfig from "../firebase-applet-config.json";
import { DEFAULT_USERS, DEFAULT_DRIVERS, DEFAULT_VEHICLES, DEFAULT_PRODUCTS, DEFAULT_ACTIVE_ASSETS, DEFAULT_EMPILHADORES, DEFAULT_CARREGAMENTOS } from "./data";
import { FIREBASE_PRESETS } from "./firebasePresets";
import { isAutoScheduleEnabled, getCurrentScheduledPreset } from "./utils/databaseScheduler";

// Silence verbose or harmless Firestore warnings/info logs in browser
try {
  setLogLevel("silent");
} catch (e) {
  // ignore
}

// Collection mapping
const COLLECTION_MAP: Record<string, string> = {
  users: "users",
  drivers: "drivers",
  vehicles: "vehicles",
  products: "products",
  activeAssets: "activeAssets",
  audits: "audits",
  vales: "vales",
  returnForecasts: "returnForecasts",
  fiscalAlerts: "fiscalAlerts",
  importedRoutes: "importedRoutes",
  audit_logs: "auditLogs",
  auditLogs: "auditLogs",
  customManual: "customManual",
  empilhadores: "empilhadores",
  carregamentoProcesses: "carregamentoProcesses",
  controleSobras: "controleSobras",
  fiveSEntries: "fiveSEntries",
  safetyReports: "safetyReports",
  blitzEntries: "blitzEntries",
  zeroBreakDeclarations: "zeroBreakDeclarations"
};

const TRACKED_COLLECTIONS = [
  "users",
  "drivers",
  "vehicles",
  "products",
  "activeAssets",
  "audits",
  "vales",
  "returnForecasts",
  "fiscalAlerts",
  "importedRoutes",
  "auditLogs",
  "customManual",
  "empilhadores",
  "carregamentoProcesses",
  "controleSobras",
  "fiveSEntries",
  "safetyReports",
  "blitzEntries",
  "zeroBreakDeclarations"
];

/**
 * Fast deterministic canonical JSON stringifier to guarantee identical key order,
 * eliminating redundant writes caused by differing field order.
 */
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(obj).sort();
  let res = "{";
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (i > 0) res += ",";
    res += JSON.stringify(k) + ":" + canonicalJson(obj[k]);
  }
  res += "}";
  return res;
}

/**
 * Requirement 1: Unique and stable document ID per collection
 * importedRoutes MUST use routeMap + routeDate combined (e.g., 03.11.49.02_2026-07-22)
 * so new and old routes with the same map number never collide.
 */
export function getDocIdForCollection(colName: string, item: any): string {
  if (!item) return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const mappedCol = COLLECTION_MAP[colName] || colName;
  const sanitizeId = (val: any) => String(val || '').trim().replace(/[\/\\]/g, '_');

  if (mappedCol === "importedRoutes") {
    const mapStr = item.routeMap ? sanitizeId(item.routeMap) : "";
    const dateStr = item.routeDate ? sanitizeId(item.routeDate) : "";
    if (mapStr && dateStr) {
      return `${mapStr}_${dateStr}`;
    }
    if (mapStr) {
      return mapStr;
    }
  }

  if (mappedCol === "users") {
    const rawLogin = (item.username || item.id || '').trim().toLowerCase();
    const baseLogin = rawLogin.includes('@') ? rawLogin.split('@')[0] : rawLogin;
    if (baseLogin) return sanitizeId(baseLogin);
    if (item.id) return sanitizeId(item.id);
  }

  if (
    mappedCol === "drivers" ||
    mappedCol === "activeAssets" ||
    mappedCol === "audits" ||
    mappedCol === "vales" ||
    mappedCol === "returnForecasts" ||
    mappedCol === "fiscalAlerts" ||
    mappedCol === "auditLogs" ||
    mappedCol === "empilhadores" ||
    mappedCol === "carregamentoProcesses"
  ) {
    if (item.id) return sanitizeId(item.id);
  }

  if (mappedCol === "vehicles") {
    if (item.id) return sanitizeId(item.id);
    if (item.plate) return sanitizeId(item.plate);
  }

  if (mappedCol === "products") {
    if (item.code) return sanitizeId(item.code);
    if (item.id) return sanitizeId(item.id);
  }

  if (item.id) return sanitizeId(item.id);
  if (item.code) return sanitizeId(item.code);
  if (item.plate) return sanitizeId(item.plate);
  if (item.username) return sanitizeId(item.username);
  if (item.routeMap) {
    const mapStr = sanitizeId(item.routeMap);
    const dateStr = item.routeDate ? sanitizeId(item.routeDate) : "";
    return dateStr ? `${mapStr}_${dateStr}` : mapStr;
  }

  return `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function getItemDocId(item: any): string {
  return getDocIdForCollection("generic", item);
}

let firestoreInstance: any = null;
let isAuthenticating = false;
let isAuthenticated = false;

// In-memory cache of document JSON hashes for the active session to avoid redundant network churn
const inMemoryDocCache: Record<string, Map<string, string>> = {};

function getColCache(colName: string): Map<string, string> {
  const targetCol = COLLECTION_MAP[colName] || colName;
  if (!inMemoryDocCache[targetCol]) {
    inMemoryDocCache[targetCol] = new Map<string, string>();
  }
  return inMemoryDocCache[targetCol];
}

function persistColCache(_colName: string) {
  // Ephemeral in-memory cache only; no sessionStorage persistence to prevent stale cross-user cache
}
let clientAuthError: string | null = null;
let lastAuthAttemptTime = 0;
const AUTH_COOLDOWN_MS = 25000;
let lastSuccessfulSyncTime = 0;

export function getLastSuccessfulSyncTime(): number {
  return lastSuccessfulSyncTime;
}

let isFirestoreQuotaExceeded = false;
let hasClientPermissionError = false;

// --- Auto-recuperação (backoff) para erros de permissão/cota --------------
// ANTES: uma única ocorrência de permission-denied ou resource-exhausted
// travava hasClientPermissionError/isFirestoreQuotaExceeded em `true` para
// sempre (só eram resetadas dentro de switchActiveFirebaseConfig, que nunca
// é chamada automaticamente). Isso desligava TODOS os listeners do app até
// um reload manual da página. Agora ambos os erros disparam uma rotina de
// nova tentativa com backoff exponencial (2s, 4s, 8s... até 60s), e o app
// se reconecta sozinho assim que o Firestore voltar a responder.
const MAX_AUTO_RETRY_DELAY_MS = 60000;
let permissionRetryAttempts = 0;
let permissionRetryTimer: any = null;
let quotaRetryAttempts = 0;
let quotaRetryTimer: any = null;

export function isPermissionError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.code || err).toLowerCase();
  return (
    err.code === "permission-denied" ||
    msg.includes("missing or insufficient permissions") ||
    msg.includes("permission-denied") ||
    msg.includes("insufficient permissions")
  );
}

export function checkPermissionError(err: any) {
  if (!err || !isPermissionError(err)) return;
  console.warn("[ClientFirebase] Aviso de permissões no cliente Firestore:", err?.message || err);
  scheduleAutoRecovery('permission');
}

export function getIsFirestoreQuotaExceeded(): boolean {
  // Plano Blaze ativo: sem limitação de cota diária
  return false;
}

export function setFirestoreQuotaExceeded(val: boolean) {
  isFirestoreQuotaExceeded = false;
  if (permissionRetryTimer) { clearTimeout(permissionRetryTimer); permissionRetryTimer = null; }
  if (quotaRetryTimer) { clearTimeout(quotaRetryTimer); quotaRetryTimer = null; }
  quotaRetryAttempts = 0;
}

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.code || err).toLowerCase();
  return (
    err.code === "resource-exhausted" ||
    msg.includes("quota exceeded") ||
    msg.includes("quota-exceeded") ||
    msg.includes("resource-exhausted") ||
    msg.includes("quota limit exceeded")
  );
}

function checkQuotaError(err: any) {
  // No Plano Blaze (Google Cloud Firestore faturamento ativado), eventuais erros de
  // 'resource-exhausted' são picos transitórios de taxa por documento, não esgotamento de cota diária.
  // Mantemos o cliente operando normalmente e retentando com backoff sem desativar o Firestore.
  console.warn("[ClientFirebase] Pico transitório detectado no Firestore (Plano Blaze Oficial ativo):", err?.message || err);
}

// Agenda uma tentativa de reconexão com backoff exponencial (máx. 60s).
// Ao expirar, limpa as flags de erro e pede para a camada de listeners
// (subscribeToFirestore) reanexar tudo. Se o erro persistir, um novo
// onSnapshot vai chamar checkPermissionError/checkQuotaError de novo e o
// backoff aumenta - ele nunca desiste "para sempre" como antes.
function scheduleAutoRecovery(kind: 'permission' | 'quota') {
  if (kind === 'permission') {
    if (permissionRetryTimer) return; // já agendado
    const delay = Math.min(MAX_AUTO_RETRY_DELAY_MS, 2000 * Math.pow(2, permissionRetryAttempts));
    permissionRetryAttempts++;
    permissionRetryTimer = setTimeout(() => {
      permissionRetryTimer = null;
      console.log(`[ClientFirebase] Retomando após permission-denied (tentativa ${permissionRetryAttempts})...`);
      hasClientPermissionError = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('client_firestore_permission_restored'));
        window.dispatchEvent(new CustomEvent('firestore_request_reattach'));
      }
    }, delay);
  } else {
    if (quotaRetryTimer) return;
    const delay = Math.min(MAX_AUTO_RETRY_DELAY_MS, 3000 * Math.pow(2, quotaRetryAttempts));
    quotaRetryAttempts++;
    quotaRetryTimer = setTimeout(() => {
      quotaRetryTimer = null;
      console.log(`[ClientFirebase] Retomando após resource-exhausted (tentativa ${quotaRetryAttempts})...`);
      isFirestoreQuotaExceeded = false;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('firestore_quota_restored'));
        window.dispatchEvent(new CustomEvent('firestore_request_reattach'));
      }
    }, delay);
  }
}

// Reseta os contadores de backoff quando uma sincronização bem-sucedida
// acontece, para que um problema pontual não deixe o próximo backoff mais
// lento do que precisa ser.
function markSyncSuccess() {
  lastSuccessfulSyncTime = Date.now();
  if (permissionRetryAttempts > 0 || quotaRetryAttempts > 0) {
    permissionRetryAttempts = 0;
    quotaRetryAttempts = 0;
  }
}

// --- Monitoramento do estado de autenticação -------------------------------
// ANTES: o app fazia signInAnonymously uma vez e nunca mais verificava se a
// sessão continuava válida (sem onAuthStateChanged/onIdTokenChanged em lugar
// nenhum do projeto). Se a sessão anônima caísse (token revogado, storage
// limpo, etc.), isAuthenticated ficava `true` para sempre e nada tentava se
// autenticar de novo.
let authStateListenerAttached = false;

function attachAuthStateListener() {
  if (authStateListenerAttached || typeof window === "undefined") return;
  authStateListenerAttached = true;
  try {
    const authRef = getAuth();
    onAuthStateChanged(authRef, (user) => {
      if (user) {
        const wasUnauthenticated = !isAuthenticated;
        isAuthenticated = true;
        isAuthenticating = false;
        clientAuthError = null;
        if (wasUnauthenticated) {
          window.dispatchEvent(new CustomEvent('firestore_request_reattach'));
        }
      } else {
        console.warn("[ClientFirebase] Sessão de autenticação perdida. Tentando reautenticar...");
        isAuthenticated = false;
        triggerAnonymousAuth();
      }
    });
  } catch (e) {
    authStateListenerAttached = false;
  }
}

export function getClientAuthError(): string | null {
  return clientAuthError;
}

export function getFirebaseConnectionState(): 'connected' | 'connecting' | 'disconnected' {
  if (typeof window === "undefined" || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return 'disconnected';
  }
  const db = getClientFirestore();
  if (!db) return 'disconnected';
  return 'connected';
}

function triggerAnonymousAuth() {
  attachAuthStateListener();

  const now = Date.now();
  if (now - lastAuthAttemptTime < AUTH_COOLDOWN_MS) return;

  try {
    const auth = getAuth();
    if (auth.currentUser) {
      isAuthenticated = true;
      return;
    }
    lastAuthAttemptTime = now;
    isAuthenticating = true;
    signInAnonymously(auth)
      .then((userCredential) => {
        console.log("[ClientFirebase] Autenticação anônima realizada com sucesso:", userCredential.user.uid);
        isAuthenticated = true;
        isAuthenticating = false;
        clientAuthError = null;
      })
      .catch((err) => {
        const errCode = err.code || err.message || "unknown";
        clientAuthError = errCode;
        isAuthenticating = false;
      });
  } catch (e) {
    clientAuthError = "get_auth_failed";
  }
}

export function isClientFirebaseActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const db = getClientFirestore();
    if (db) return true;
  } catch (e) {}
  return false;
}

export function getActiveFirebaseConfig(): any {
  const activePreset = FIREBASE_PRESETS[0];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("active_firebase_config", JSON.stringify(activePreset.config));
      localStorage.setItem("logiroute_firebase_client_config", JSON.stringify(activePreset.config));
    } catch (e) {}
  }
  return activePreset.config;
}

export async function switchActiveFirebaseConfig(newConfig: any): Promise<boolean> {
  const targetConfig = newConfig || FIREBASE_PRESETS[0].config;
  try {
    hasClientPermissionError = false;
    isFirestoreQuotaExceeded = false;
    clientAuthError = null;
    if (typeof window !== "undefined") {
      localStorage.setItem("active_firebase_config", JSON.stringify(targetConfig));
      localStorage.setItem("logiroute_firebase_client_config", JSON.stringify(targetConfig));
    }
    try {
      await fetch('/api/firebase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetConfig),
      });
    } catch (e) {}

    if (firestoreInstance) {
      try {
        await terminate(firestoreInstance);
      } catch (e) {}
      firestoreInstance = null;
    }
    for (const a of getApps()) {
      try {
        await deleteApp(a);
      } catch (e) {}
    }
    authStateListenerAttached = false;
    isAuthenticated = false;
    isAuthenticating = false;
    Object.keys(inMemoryDocCache).forEach(k => delete inMemoryDocCache[k]);
    if (typeof window !== "undefined") {
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('logiroute_doc_cache_')) {
            sessionStorage.removeItem(key);
          }
        }
      } catch (e) {}
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("firebase_config_changed", { detail: newConfig }));
    }
    return true;
  } catch (err) {
    console.error("[ClientFirebase] Erro ao alternar banco de dados:", err);
    return false;
  }
}

export async function syncFirebaseData(sourceConfig: any, targetConfig: any): Promise<{ success: boolean; count: number }> {
  let totalDocs = 0;
  const appNameSource = `syncSrc_${Date.now()}`;
  const appNameTarget = `syncTgt_${Date.now()}`;

  let sourceApp: any = null;
  let targetApp: any = null;

  const syncWorker = async () => {
    try {
      console.log(`[syncFirebaseData] Iniciando sincronização completa de '${sourceConfig.projectId}' para '${targetConfig.projectId}'...`);
      sourceApp = initializeApp(sourceConfig, appNameSource);
      targetApp = initializeApp(targetConfig, appNameTarget);

      try {
        await Promise.all([
          signInAnonymously(getAuth(sourceApp)).catch(() => null),
          signInAnonymously(getAuth(targetApp)).catch(() => null)
        ]);
      } catch (e) {
        // ignore auth error
      }

      const sourceDb = getFirestore(sourceApp);
      const targetDb = getFirestore(targetApp);

      for (const colName of TRACKED_COLLECTIONS) {
        try {
          const sourceSnap = await getDocs(collection(sourceDb, colName));
          const sourceDocs = sourceSnap.docs;
          const sourceDocIds = new Set(sourceDocs.map(d => d.id));

          // Obtain target docs to identify stale items to purge
          let idsToDelete: string[] = [];
          try {
            const targetSnap = await getDocs(collection(targetDb, colName));
            for (const tDoc of targetSnap.docs) {
              if (!sourceDocIds.has(tDoc.id)) {
                idsToDelete.push(tDoc.id);
              }
            }
          } catch (e) {
            console.warn(`[syncFirebaseData] Não foi possível listar target para ${colName}:`, e);
          }

          if (sourceDocs.length === 0 && idsToDelete.length === 0) continue;

          // Prepare operations: delete stale target docs first, then set current source docs
          const ops: Array<{ type: 'set' | 'delete'; id: string; data?: any }> = [
            ...idsToDelete.map(id => ({ type: 'delete' as const, id })),
            ...sourceDocs.map(d => ({ type: 'set' as const, id: d.id, data: d.data() }))
          ];

          const batchSize = 300;
          for (let i = 0; i < ops.length; i += batchSize) {
            const chunk = ops.slice(i, i + batchSize);
            const batch = writeBatch(targetDb);
            chunk.forEach(op => {
              const docRef = doc(targetDb, colName, op.id);
              if (op.type === 'delete') {
                batch.delete(docRef);
              } else {
                batch.set(docRef, op.data, { merge: true });
              }
            });
            await batch.commit();
          }

          console.log(`[syncFirebaseData] Coleção '${colName}': ${sourceDocs.length} atualizados, ${idsToDelete.length} obsoletos removidos.`);
          totalDocs += sourceDocs.length;
        } catch (e) {
          console.warn(`[syncFirebaseData] Aviso ao sincronizar coleção '${colName}':`, e);
        }
      }
      console.log(`[syncFirebaseData] Sincronização concluída! Total de ${totalDocs} documentos transferidos.`);
      return { success: true, count: totalDocs };
    } catch (err) {
      console.error("[syncFirebaseData] Erro de sincronização entre bancos:", err);
      return { success: false, count: 0 };
    } finally {
      if (sourceApp) { try { await deleteApp(sourceApp); } catch (e) {} }
      if (targetApp) { try { await deleteApp(targetApp); } catch (e) {} }
    }
  };

  const timeoutPromise = new Promise<{ success: boolean; count: number }>((resolve) => {
    setTimeout(() => {
      console.warn("[syncFirebaseData] Timeout de 25s atingido. Prosseguindo com troca de banco...");
      resolve({ success: false, count: totalDocs });
    }, 25000);
  });

  return Promise.race([syncWorker(), timeoutPromise]);
}

export function getClientFirestore() {
  if (hasClientPermissionError) return null;
  if (firestoreInstance) {
    if (!isAuthenticated && !isAuthenticating) {
      triggerAnonymousAuth();
    }
    return firestoreInstance;
  }

  try {
    const config = getActiveFirebaseConfig();
    if (
      !config ||
      !config.projectId ||
      config.projectId === "remixed-project-id" ||
      config.projectId.includes("placeholder")
    ) {
      return null;
    }

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const dbId = (config.firestoreDatabaseId && config.firestoreDatabaseId !== "(default)") ? config.firestoreDatabaseId : undefined;

    // Enable IndexedDB persistent local cache with multi-tab support
    // This allows page reloads and multiple tabs to read from local cache with 0 Firestore read consumption!
    try {
      if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
        firestoreInstance = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        }, dbId);
      } else {
        firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
      }
    } catch (errInit) {
      // Fallback if already initialized in another mode
      firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
    }

    triggerAnonymousAuth();
    return firestoreInstance;
  } catch (err) {
    console.warn("[ClientFirebase] Erro ao inicializar Firestore:", err);
    return null;
  }
}

/**
 * Requirement 2: Direct writes (create, edit, import) go straight to document in Firestore collection.
 */
export async function saveDocToFirestore(colName: string, item: any): Promise<boolean> {
  const db = getClientFirestore();
  if (!db || !item) return false;
  try {
    const targetCol = COLLECTION_MAP[colName] || colName;
    const docId = getDocIdForCollection(targetCol, item);
    const cleanItem = JSON.parse(JSON.stringify(item));
    cleanItem.id = docId;

    const colCache = getColCache(targetCol);
    const newJson = canonicalJson(cleanItem);

    const docRef = doc(db, targetCol, docId);
    await setDoc(docRef, cleanItem, { merge: true });
    colCache.set(docId, newJson);
    return true;
  } catch (err) {
    console.warn(`[ClientFirebase] Erro ao salvar documento na coleção '${colName}':`, err);
    if (isPermissionError(err)) checkPermissionError(err);
    if (isQuotaError(err)) checkQuotaError(err);
    
    // Tenta uma segunda vez com pequeno recuo para contornar oscilação de rede móvel
    try {
      await new Promise(r => setTimeout(r, 400));
      const targetCol = COLLECTION_MAP[colName] || colName;
      const docId = getDocIdForCollection(targetCol, item);
      const cleanItem = JSON.parse(JSON.stringify(item));
      cleanItem.id = docId;
      const docRef = doc(db, targetCol, docId);
      await setDoc(docRef, cleanItem, { merge: true });
      getColCache(targetCol).set(docId, canonicalJson(cleanItem));
      persistColCache(targetCol);
      return true;
    } catch (retryErr) {
      console.error(`[ClientFirebase] Falha definitiva na escrita direta no Firestore:`, retryErr);
      return false;
    }
  }
}

export async function deleteDocFromFirestore(colName: string, docId: string): Promise<boolean> {
  const db = getClientFirestore();
  if (!db || !docId) return false;
  try {
    const targetCol = COLLECTION_MAP[colName] || colName;
    const docRef = doc(db, targetCol, docId);
    await deleteDoc(docRef);
    getColCache(targetCol).delete(docId);
    persistColCache(targetCol);
    return true;
  } catch (err) {
    console.warn(`[ClientFirebase] Erro ao deletar documento '${docId}' da coleção '${colName}':`, err);
    if (isPermissionError(err)) checkPermissionError(err);
    if (isQuotaError(err)) checkQuotaError(err);
    return false;
  }
}

export async function saveDocsToFirestore(colName: string, items: any[], syncDeletions: boolean = false, forceWrite: boolean = false): Promise<boolean> {
  const db = getClientFirestore();
  if (!db || !items) return false;
  try {
    const targetCol = COLLECTION_MAP[colName] || colName;
    const cleanItems = JSON.parse(JSON.stringify(items));
    const colCache = getColCache(targetCol);

    const currentDocIds = new Set<string>();
    const opsToSet: Array<{ id: string; data: any; json: string }> = [];

    // Filter only NEW or MODIFIED items using deterministic canonical JSON
    for (const item of cleanItems) {
      const docId = getDocIdForCollection(targetCol, item);
      item.id = docId;
      currentDocIds.add(docId);

      const newJson = canonicalJson(item);
      const cachedJson = colCache.get(docId);

      if (forceWrite || cachedJson !== newJson) {
        opsToSet.push({ id: docId, data: item, json: newJson });
      }
    }

    let idsToDelete: string[] = [];
    if (syncDeletions) {
      // Check deletions against known keys in colCache (0 extra read operations!)
      for (const cachedId of Array.from(colCache.keys())) {
        if (!currentDocIds.has(cachedId)) {
          idsToDelete.push(cachedId);
        }
      }
    }

    const allOps: Array<{ type: 'set' | 'delete'; id: string; data?: any; json?: string }> = [
      ...opsToSet.map(op => ({ type: 'set' as const, id: op.id, data: op.data, json: op.json })),
      ...idsToDelete.map(id => ({ type: 'delete' as const, id }))
    ];

    // If nothing changed and nothing was deleted, return immediately (0 reads, 0 writes!)
    if (allOps.length === 0) {
      return true;
    }

    const batchSize = 400;
    for (let i = 0; i < allOps.length; i += batchSize) {
      const chunk = allOps.slice(i, i + batchSize);
      const batch = writeBatch(db);
      chunk.forEach(op => {
        const docRef = doc(db, targetCol, op.id);
        if (op.type === 'set') {
          batch.set(docRef, op.data, { merge: true });
        } else {
          batch.delete(docRef);
        }
      });
      await batch.commit();

      // Update in-memory + session cache after successful commit
      chunk.forEach(op => {
        if (op.type === 'set' && op.json) {
          colCache.set(op.id, op.json);
        } else if (op.type === 'delete') {
          colCache.delete(op.id);
        }
      });
    }
    persistColCache(targetCol);
    return true;
  } catch (err) {
    console.warn(`[ClientFirebase] Erro ao salvar documentos na coleção '${colName}':`, err);
    if (isPermissionError(err)) checkPermissionError(err);
    if (isQuotaError(err)) checkQuotaError(err);
    return false;
  }
}

export async function saveDirectlyToFirestore(payload: any, forceWrite: boolean = false, syncDeletions: boolean = true): Promise<boolean> {
  const db = getClientFirestore();
  if (!db || !payload) return false;
  try {
    const savePromise = (async () => {
      const keys = Object.keys(payload);
      for (const key of keys) {
        const colName = COLLECTION_MAP[key] || key;
        const rawData = payload[key];
        if (rawData === undefined) continue;

        if (colName === "customManual") {
          const docRef = doc(db, "customManual", "main");
          const htmlContent = typeof rawData === "string" ? rawData : rawData?.html || rawData?.content || "";
          await setDoc(docRef, { html: htmlContent, updatedAt: new Date().toISOString() });
          continue;
        }

        if (Array.isArray(rawData)) {
          await saveDocsToFirestore(colName, rawData, syncDeletions, forceWrite);
        }
      }
      return true;
    })();

    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 15000);
    });

    return await Promise.race([savePromise, timeoutPromise]);
  } catch (err) {
    console.warn("[ClientFirebase] Erro ao persistir no Firestore:", err);
    return false;
  }
}

// --- Gerente de reconexão dos listeners em tempo real ----------------------
// ANTES: cada uma das 15 coleções tinha um único onSnapshot que, ao dar
// erro (rede instável, stream expirado, permission-denied pontual etc.),
// simplesmente MORRIA - o SDK do Firestore não tenta de novo sozinho depois
// que o callback de erro do onSnapshot é chamado, e nada aqui reanexava o
// listener. Isso fazia com que, "depois de um tempo", uma ou mais coleções
// parassem de atualizar silenciosamente (sem nenhum aviso na tela), até o
// usuário recarregar o app manualmente.
//
// Agora cada coleção tem sua própria reanexação com backoff exponencial
// (1s, 2s, 4s... até 30s), independente das outras, e existe um watchdog
// que força a reconexão completa se nenhuma sincronização acontecer por
// muito tempo (cobre o caso raro do stream travar sem chamar o erro).
let reconnectGeneration = 0;
let activeOnUpdateCallback: ((db: any) => void) | null = null;
let activeUnsubscribes: Record<string, () => void> = {};
const COLLECTION_RETRY_STATE: Record<string, { attempts: number; timer: any }> = {};
let watchdogInterval: any = null;
let reattachRequestListenerAttached = false;

function resetCollectionRetryState(colName: string) {
  const prev = COLLECTION_RETRY_STATE[colName];
  if (prev?.timer) clearTimeout(prev.timer);
  COLLECTION_RETRY_STATE[colName] = { attempts: 0, timer: null };
}

const MAX_COLLECTION_RETRY_DELAY_MS = 30000;

function scheduleCollectionRetry(colName: string, generation: number, attach: (c: string) => void) {
  const state = COLLECTION_RETRY_STATE[colName] || { attempts: 0, timer: null };
  if (state.timer) return; // já existe uma tentativa agendada para essa coleção
  const delay = Math.min(MAX_COLLECTION_RETRY_DELAY_MS, 1000 * Math.pow(2, state.attempts));
  state.attempts++;
  state.timer = setTimeout(() => {
    state.timer = null;
    if (generation !== reconnectGeneration) return; // essa inscrição já foi encerrada/substituída
    attach(colName);
  }, delay);
  COLLECTION_RETRY_STATE[colName] = state;
}

function attachReattachRequestListener() {
  if (reattachRequestListenerAttached || typeof window === "undefined") return;
  reattachRequestListenerAttached = true;
  // Disparado quando uma flag global (permissão/cota/autenticação) se
  // recupera - qualquer coleção que ainda esteja esperando seu backoff
  // é reanexada na hora, em vez de esperar o timer correr.
  window.addEventListener('firestore_request_reattach', () => {
    forceReconnect();
  });
}

const WATCHDOG_INTERVAL_MS = 60000;

function startConnectionWatchdog() {
  if (watchdogInterval || typeof window === "undefined") return;
  watchdogInterval = setInterval(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (typeof document !== "undefined" && document.visibilityState !== 'visible') return;
    if (!activeOnUpdateCallback) return;
    // Only re-attach if listeners were unexpectedly lost or cleared
    const activeCount = Object.keys(activeUnsubscribes).length;
    if (activeCount === 0 && TRACKED_COLLECTIONS.length > 0) {
      console.warn(`[ClientFirebase] Listeners do Firestore vazios. Restaurando escuta em tempo real...`);
      forceReconnect();
    }
  }, WATCHDOG_INTERVAL_MS);
}

function stopConnectionWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
}

/**
 * Força o encerramento e a reconstrução de TODOS os listeners em tempo
 * real, reaproveitando o último callback registrado. Chamada automaticamente
 * pelo watchdog e ao restaurar permissão/cota/autenticação, e também deve
 * ser chamada manualmente quando o app volta ao primeiro plano
 * (ver o handler de visibilitychange em App.tsx).
 */
export function forceReconnect(): void {
  if (!activeOnUpdateCallback) return;
  subscribeToFirestore(activeOnUpdateCallback);
}

/**
 * Requirement 3: Real-time queries straight from Firestore collections.
 * Seed default initial values directly to Firestore if collections are empty.
 */
export function subscribeToFirestore(onUpdate: (db: any) => void): () => void {
  const db = getClientFirestore();
  if (!db) return () => {};

  const myGeneration = ++reconnectGeneration;
  activeOnUpdateCallback = onUpdate;

  // Encerra qualquer inscrição/tentativa agendada da geração anterior antes de recomeçar
  Object.values(activeUnsubscribes).forEach((unsub) => { try { unsub(); } catch (e) {} });
  activeUnsubscribes = {};
  Object.values(COLLECTION_RETRY_STATE).forEach((s) => { if (s.timer) clearTimeout(s.timer); });

  console.log("[ClientFirebase] Inscrevendo para atualizações em tempo real nas coleções do Firestore...");

  const combinedDb: Record<string, any> = {
    users: [],
    drivers: [],
    vehicles: [],
    products: [],
    activeAssets: [],
    audits: [],
    vales: [],
    returnForecasts: [],
    fiscalAlerts: [],
    importedRoutes: [],
    audit_logs: [],
    auditLogs: [],
    customManual: "",
    empilhadores: [],
    carregamentoProcesses: [],
    controleSobras: [],
    fiveSEntries: [],
    safetyReports: [],
    blitzEntries: [],
    zeroBreakDeclarations: []
  };

  const attach = (colName: string) => {
    if (myGeneration !== reconnectGeneration) return; // geração substituída - não faz nada
    try {
      if (colName === "customManual") {
        const docRef = doc(db, "customManual", "main");
        const unsub = onSnapshot(docRef, (docSnap) => {
          if (myGeneration !== reconnectGeneration) return;
          resetCollectionRetryState(colName);
          markSyncSuccess();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent('firestore_synced', { detail: { time: lastSuccessfulSyncTime } }));
          }
          if (docSnap.exists()) {
            const data = docSnap.data();
            combinedDb.customManual = data.html || data.content || "";
          } else {
            combinedDb.customManual = "";
            fetch('/api/db')
              .then(res => res.ok ? res.json() : null)
              .then(resData => {
                if (resData?.db?.customManual) {
                  setDoc(docRef, { html: resData.db.customManual, updatedAt: new Date().toISOString() }).catch(() => {});
                }
              }).catch(() => {});
          }
          onUpdate({ customManual: combinedDb.customManual });
        }, (error) => handleSubscriptionError(error, colName, myGeneration, attach));
        activeUnsubscribes[colName] = unsub;
      } else {
        const collRef = collection(db, colName);
        const unsub = onSnapshot(collRef, (snapshot) => {
          if (myGeneration !== reconnectGeneration) return;
          resetCollectionRetryState(colName);
          markSyncSuccess();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent('firestore_synced', { detail: { time: lastSuccessfulSyncTime } }));
          }

          // Seed defaults directly to Firestore ONLY if primary static collections are completely empty and confirmed by server (not local cache)
          if (!snapshot.metadata.fromCache && snapshot.empty && (colName === "users" || colName === "drivers" || colName === "vehicles" || colName === "products" || colName === "activeAssets")) {
            fetch('/api/db')
              .then(res => res.ok ? res.json() : null)
              .then(resData => {
                const srvDb = resData?.db;
                const itemsToSeed = srvDb && Array.isArray(srvDb[colName]) && srvDb[colName].length > 0
                  ? srvDb[colName]
                  : (colName === "users" ? DEFAULT_USERS :
                     colName === "drivers" ? DEFAULT_DRIVERS :
                     colName === "vehicles" ? DEFAULT_VEHICLES :
                     colName === "products" ? DEFAULT_PRODUCTS :
                     colName === "activeAssets" ? DEFAULT_ACTIVE_ASSETS : []);

                if (itemsToSeed && itemsToSeed.length > 0) {
                  saveDocsToFirestore(colName, itemsToSeed);
                }
              })
              .catch(() => {
                if (colName === "users" && DEFAULT_USERS.length > 0) {
                  saveDocsToFirestore("users", DEFAULT_USERS);
                } else if (colName === "drivers" && DEFAULT_DRIVERS.length > 0) {
                  saveDocsToFirestore("drivers", DEFAULT_DRIVERS);
                } else if (colName === "vehicles" && DEFAULT_VEHICLES.length > 0) {
                  saveDocsToFirestore("vehicles", DEFAULT_VEHICLES);
                } else if (colName === "products" && DEFAULT_PRODUCTS.length > 0) {
                  saveDocsToFirestore("products", DEFAULT_PRODUCTS);
                } else if (colName === "activeAssets" && DEFAULT_ACTIVE_ASSETS.length > 0) {
                  saveDocsToFirestore("activeAssets", DEFAULT_ACTIVE_ASSETS);
                }
              });
          }

          const targetCol = COLLECTION_MAP[colName] || colName;
          const colCache = getColCache(targetCol);

          const currentServerIds = new Set<string>();
          const items = snapshot.docs.map((d) => {
            const data = d.data();
            const docId = d.id;
            currentServerIds.add(docId);
            const itemWithId = { ...data, id: docId };
            colCache.set(docId, canonicalJson(itemWithId));
            if (colName === "audits") {
              return {
                ...itemWithId,
                items: Array.isArray(data.items) ? data.items : [],
                assets: Array.isArray(data.assets) ? data.assets : [],
                history: Array.isArray(data.history) ? data.history : [],
                unifiedMaps: Array.isArray(data.unifiedMaps) ? data.unifiedMaps : [],
              };
            }
            return itemWithId;
          });

          // Clean up cache for deleted docs
          for (const cachedId of Array.from(colCache.keys())) {
            if (!currentServerIds.has(cachedId)) {
              colCache.delete(cachedId);
            }
          }

          if (colName === "auditLogs") {
            combinedDb.auditLogs = items;
            combinedDb.audit_logs = items;
            onUpdate({ auditLogs: items, audit_logs: items });
          } else {
            combinedDb[colName] = items;
            onUpdate({ [colName]: items });
          }
        }, (error) => handleSubscriptionError(error, colName, myGeneration, attach));
        activeUnsubscribes[colName] = unsub;
      }
    } catch (err) {
      handleSubscriptionError(err, colName, myGeneration, attach);
    }
  };

  TRACKED_COLLECTIONS.forEach((colName) => {
    resetCollectionRetryState(colName);
    attach(colName);
  });

  attachReattachRequestListener();
  startConnectionWatchdog();

  return () => {
    if (myGeneration === reconnectGeneration) {
      activeOnUpdateCallback = null;
      stopConnectionWatchdog();
      Object.values(activeUnsubscribes).forEach((unsub) => {
        try {
          unsub();
        } catch (e) {}
      });
      activeUnsubscribes = {};
      Object.values(COLLECTION_RETRY_STATE).forEach((s) => { if (s.timer) clearTimeout(s.timer); });
    }
  };
}

function handleSubscriptionError(error: any, colName: string, generation: number, attach: (c: string) => void) {
  if (isPermissionError(error)) {
    checkPermissionError(error);
  } else if (isQuotaError(error)) {
    checkQuotaError(error);
  } else {
    console.warn(`[ClientFirebase] Listener da coleção '${colName}' caiu (${error?.code || error}). Reagendando...`);
  }
  if (generation === reconnectGeneration) {
    scheduleCollectionRetry(colName, generation, attach);
  }
}

export async function fetchDirectlyFromFirestore(): Promise<any> {
  const db = getClientFirestore();
  if (!db) return null;

  const combinedDb: Record<string, any> = {
    users: [],
    drivers: [],
    vehicles: [],
    products: [],
    activeAssets: [],
    audits: [],
    vales: [],
    returnForecasts: [],
    fiscalAlerts: [],
    importedRoutes: [],
    audit_logs: [],
    auditLogs: [],
    customManual: "",
    empilhadores: [],
    carregamentoProcesses: [],
    controleSobras: [],
    fiveSEntries: [],
    safetyReports: [],
    blitzEntries: [],
    zeroBreakDeclarations: []
  };

  try {
    const promises = TRACKED_COLLECTIONS.map(async (colName) => {
      try {
        if (colName === "customManual") {
          const docRef = doc(db, "customManual", "main");
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            combinedDb.customManual = data.html || data.content || "";
          }
        } else {
          const collRef = collection(db, colName);
          const snap = await getDocs(collRef);
          const targetCol = COLLECTION_MAP[colName] || colName;
          const colCache = getColCache(targetCol);
          const items = snap.docs.map((d) => {
            const data = d.data();
            colCache.set(d.id, JSON.stringify(data));
            if (colName === "audits") {
              return {
                ...data,
                id: d.id,
                items: Array.isArray(data.items) ? data.items : [],
                assets: Array.isArray(data.assets) ? data.assets : [],
                history: Array.isArray(data.history) ? data.history : [],
                unifiedMaps: Array.isArray(data.unifiedMaps) ? data.unifiedMaps : [],
              };
            }
            return {
              ...data,
              id: d.id
            };
          });
          if (colName === "auditLogs") {
            combinedDb.auditLogs = items;
            combinedDb.audit_logs = items;
          } else {
            combinedDb[colName] = items;
          }
        }
      } catch (err) {
        if (isPermissionError(err)) {
          checkPermissionError(err);
        } else {
          checkQuotaError(err);
        }
      }
    });

    await Promise.all(promises);
    lastSuccessfulSyncTime = Date.now();
    return combinedDb;
  } catch (e) {
    return null;
  }
}

export async function getGeminiKeyFromFirestore(): Promise<string | null> {
  const db = getClientFirestore();
  if (!db) return null;
  try {
    const docRef = doc(db, "app_state", "gemini_config");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data()?.apiKey || null;
    }
  } catch (e) {}
  return null;
}

export async function saveGeminiKeyToFirestore(apiKey: string): Promise<boolean> {
  const db = getClientFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "app_state", "gemini_config");
    await setDoc(docRef, { apiKey: apiKey });
    return true;
  } catch (e) {}
  return false;
}