import React, { useState, useEffect, useRef } from 'react';
import { User, Driver, Vehicle, Product, ActiveAsset, AuditSession, ReturnForecast, FiscalAlert, ImportedRoute, Vale, Empilhador, CarregamentoProcess, ControleSobraItem, FiveSEntry, SafetyReport, BlitzRefugoEntry, ZeroBreakDeclaration } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_USERS, DEFAULT_EMPILHADORES, DEFAULT_CARREGAMENTOS, deduplicateUsersComprehensive } from './data';
import { ImageDB } from './imageDb';
import { isClientFirebaseActive, fetchDirectlyFromFirestore, saveDirectlyToFirestore, deleteDocFromFirestore, subscribeToFirestore, getClientAuthError, getIsFirestoreQuotaExceeded, setFirestoreQuotaExceeded, getActiveFirebaseConfig, switchActiveFirebaseConfig, forceReconnect } from './clientFirebase';
import Header from './components/Header';
import ConferenteView from './components/ConferenteView';
import FiscalView from './components/FiscalView';
import GestorDashboard from './components/GestorDashboard';
import LoginView from './components/LoginView';
import MonitoramentoView from './components/MonitoramentoView';
import EmpilhadorView from './components/EmpilhadorView';
import ExportDataView from './components/ExportDataView';
import PlatformManual from './components/PlatformManual';
import AIAgentChat from './components/AIAgentChat';
import ControleSobrasView from './components/ControleSobrasView';
import LigaView from './components/LigaView';
import Sidebar from './components/Sidebar';
import { DatabaseScheduleBanner } from './components/DatabaseScheduleBanner';
import { ClipboardCheck, ShieldCheck, BarChart3, AlertCircle, Bell, CheckCircle2, Settings, RefreshCw, Layers } from 'lucide-react';

export default function App() {
  const lastWriteTime = useRef<number>(0);
  const pendingUpdatesRef = useRef<any>({});
  const pushTimeoutRef = useRef<any>(null);
  const lastSyncAlertTime = useRef<number>(0);

  // Database states loaded from AppStore (direct from live database without stale cache)
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [products, setProducts] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [activeAssets, setActiveAssets] = useState<ActiveAsset[]>([]);
  const [audits, setAudits] = useState<AuditSession[]>([]);
  const [vales, setVales] = useState<Vale[]>([]);
  const [empilhadores, setEmpilhadores] = useState<Empilhador[]>(() => {
    // Deduplicate and sanitize default list on boot
    const seen = new Set<string>();
    return DEFAULT_EMPILHADORES.filter(e => {
      if (!e) return false;
      const k = (e.id || e.matricula || e.name || '').trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  });
  const [carregamentos, setCarregamentos] = useState<CarregamentoProcess[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [customManualHTML, setCustomManualHTML] = useState<string>('');
  const [controleSobras, setControleSobras] = useState<ControleSobraItem[]>(() => {
    try {
      const saved = localStorage.getItem('logiroute_cached_controle_sobras');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('logiroute_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('logiroute_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleSaveControleSobras = (newSobras: ControleSobraItem[]) => {
    setControleSobras(newSobras);
    try {
      localStorage.setItem('logiroute_cached_controle_sobras', JSON.stringify(newSobras));
    } catch {}
    pushDatabaseToServer({ controleSobras: newSobras });
  };

  // Forecasts and Notifications
  const [returnForecasts, setReturnForecasts] = useState<ReturnForecast[]>([]);
  const [fiscalAlerts, setFiscalAlerts] = useState<FiscalAlert[]>([]);
  const [importedRoutes, setImportedRoutes] = useState<ImportedRoute[]>([]);

  // Liga DPO State (5S, Relatos de Segurança, Blitz de Refugo, Declaração de Zero Quebras)
  const [fiveSEntries, setFiveSEntries] = useState<FiveSEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ambev_liga_5s_entries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>(() => {
    try {
      const saved = localStorage.getItem('ambev_liga_safety_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [blitzEntries, setBlitzEntries] = useState<BlitzRefugoEntry[]>(() => {
    try {
      const saved = localStorage.getItem('ambev_liga_blitz_entries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [zeroBreakDeclarations, setZeroBreakDeclarations] = useState<ZeroBreakDeclaration[]>(() => {
    try {
      const saved = localStorage.getItem('ambev_liga_break_declarations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Session & UI Navigation states with robust persistence (never arbitrarily revert to another user)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUserStr = localStorage.getItem('logiroute_authenticated_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.id) return parsed;
      }
      const savedUserId = localStorage.getItem('logiroute_authenticated_user_id');
      if (savedUserId) {
        const found = DEFAULT_USERS.find(u => u.id === savedUserId || (u.username && u.username.toLowerCase() === savedUserId.toLowerCase()));
        if (found) return found;
      }
    } catch (e) {}
    return null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('logiroute_is_authenticated') === 'true';
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      let role = '';
      const savedUserStr = localStorage.getItem('logiroute_authenticated_user');
      if (savedUserStr) {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.role) role = parsed.role;
      }
      if (!role) {
        const savedUserId = localStorage.getItem('logiroute_authenticated_user_id');
        if (savedUserId) {
          const found = DEFAULT_USERS.find(u => u.id === savedUserId || (u.username && u.username.toLowerCase() === savedUserId.toLowerCase()));
          if (found?.role) role = found.role;
        }
      }
      const savedTab = localStorage.getItem('logiroute_active_tab');
      if (savedTab) {
        return savedTab;
      }
      if (role === 'empilhador') return 'carregamento';
      if (role === 'conferente') return 'conferencias';
      if (role === 'auxiliar_logistica' || role === 'financeiro') return 'reconciliacao';
      if (role === 'gestor') return 'dashboard';
      if (role === 'monitoramento') return 'monitoramento_view';
    } catch (e) {}
    return 'reconciliacao';
  });

  // Quota & Permission status state
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(getIsFirestoreQuotaExceeded());
  const [clientPermissionDenied, setClientPermissionDenied] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setIsQuotaExceeded(true);
    const handleQuotaRestored = () => setIsQuotaExceeded(false);
    const handlePermissionDenied = () => setClientPermissionDenied(true);
    // ANTES: não existia handler para este evento, então uma vez que
    // clientPermissionDenied virava true, nada no React o revertia - o
    // useEffect que assina o Firestore (abaixo) ficava travado sem
    // reinscrever para sempre, mesmo depois do clientFirebase.ts se
    // recuperar sozinho internamente. Agora, quando o módulo detecta que a
    // permissão voltou, o estado do React acompanha e o efeito de
    // inscrição roda de novo.
    const handlePermissionRestored = () => setClientPermissionDenied(false);

    window.addEventListener('firestore_quota_exceeded', handleQuotaExceeded);
    window.addEventListener('firestore_quota_restored', handleQuotaRestored);
    window.addEventListener('client_firestore_permission_denied', handlePermissionDenied);
    window.addEventListener('client_firestore_permission_restored', handlePermissionRestored);

    return () => {
      window.removeEventListener('firestore_quota_exceeded', handleQuotaExceeded);
      window.removeEventListener('firestore_quota_restored', handleQuotaRestored);
      window.removeEventListener('client_firestore_permission_denied', handlePermissionDenied);
      window.removeEventListener('client_firestore_permission_restored', handlePermissionRestored);
    };
  }, []);

  // Trata o ciclo de vida do app ao voltar ao primeiro plano (aba visível ou retorno do app minimizado).
  // Usa forceReconnect() para revalidar os ouvintes onSnapshot (que aproveitam o cache local do IndexedDB sem custos extras)
  // e busca apenas do servidor local (/api/db) com custo ZERO no Firestore.
  useEffect(() => {
    let hasMounted = false;
    const handleVisibilityChange = () => {
      // Ignora o primeiro instante da montagem da página
      if (!hasMounted) {
        hasMounted = true;
        return;
      }
      if (document.visibilityState === 'visible') {
        console.log('[App] App voltou ao primeiro plano - verificando conexão em tempo real com Firestore...');
        forceReconnect();
        // Apenas busca do servidor local se o Firestore direto não estiver ativo, evitando conflito de cache
        if (!isClientFirebaseActive()) {
          fetch('/api/db')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data?.success && data?.db) {
                applyDirectDb(data.db);
              }
            })
            .catch(() => {});
        }
      }
    };

    // Marca como montado após o primeiro frame
    const timer = setTimeout(() => { hasMounted = true; }, 1000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('logiroute_theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('logiroute_theme', theme);
  }, [theme]);

  // Warning & Reset States
  const [hasShownDeadlinePopup, setHasShownDeadlinePopup] = useState<boolean>(false);
  const [acknowledgedSent, setAcknowledgedSent] = useState<string[]>(() => {
    const saved = localStorage.getItem('logiroute_acknowledged_sent_audits');
    return saved ? JSON.parse(saved) : [];
  });

  const handleResetPlatformData = async (skipConfirmation: boolean = false) => {
    if (!currentUser || currentUser.role !== 'gestor') {
      alert("Acesso Negado: Apenas usuários com perfil Gestor possuem permissão para redefinir a base de dados da plataforma.");
      return;
    }

    if (!skipConfirmation) {
      const firstConfirm = window.confirm(
        "⚠️ ATENÇÃO: ZERAR BASE DE DADOS DA PLATAFORMA ⚠️\n\n" +
        "Esta ação irá apagar permanentemente todas as rotas importadas, conferências, previsões, alertas e vales de TODOS os dispositivos conectados ao mesmo Firestore.\n\n" +
        "Deseja realmente prosseguir com o reset?"
      );
      if (!firstConfirm) return;

      const secondConfirm = window.confirm(
        "❗ CONFIRMAÇÃO FINAL DE SEGURANÇA ❗\n\n" +
        "Confirma novamente a exclusão completa e irreversível dos dados da plataforma?"
      );
      if (!secondConfirm) return;
    }

    // Clear major functional arrays in state
    setImportedRoutes([]);
    setAudits([]);
    setReturnForecasts([]);
    setFiscalAlerts([]);
    setVales([]);
    setControleSobras([]);

    // Clear IndexedDB photos
    try {
      await ImageDB.clearAllPhotos();
    } catch (e) {
      console.warn("Error clearing photos during platform reset:", e);
    }

    // Clear cached app state from localStorage
    try {
      localStorage.removeItem('logiroute_cached_app_db');
    } catch (e) {}

    // Cancel pending throttled writes
    pendingUpdatesRef.current = {};
    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
      pushTimeoutRef.current = null;
    }
    lastWriteTime.current = Date.now();

    const emptyPayload = {
      importedRoutes: [],
      audits: [],
      returnForecasts: [],
      fiscalAlerts: [],
      vales: [],
      controleSobras: []
    };

    if (isClientFirebaseActive()) {
      await saveDirectlyToFirestore(emptyPayload, true, true);
    }

    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db: emptyPayload })
      });
    } catch (e) {
      console.warn("Reset server push error:", e);
    }

    // Broadcast reset event across browser tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('logiroute_sync');
        channel.postMessage({ type: 'RESET_PLATFORM' });
        channel.close();
      } catch (e) {}
    }

    if (!skipConfirmation) {
      alert("Base de dados da plataforma redefinida com sucesso.");
    }
  };

  const handleSaveCustomManual = (html: string) => {
    setCustomManualHTML(html);
    pushDatabaseToServer({ customManual: html });
  };

  // Push changes to server database with batching/throttling to prevent concurrency race conditions
  const pushDatabaseToServer = (updates: {
    users?: User[];
    drivers?: Driver[];
    vehicles?: Vehicle[];
    products?: Product[];
    activeAssets?: ActiveAsset[];
    audits?: AuditSession[];
    returnForecasts?: ReturnForecast[];
    fiscalAlerts?: FiscalAlert[];
    importedRoutes?: ImportedRoute[];
    vales?: Vale[];
    empilhadores?: Empilhador[];
    carregamentos?: CarregamentoProcess[];
    carregamentoProcesses?: CarregamentoProcess[];
    customManual?: string;
    controleSobras?: ControleSobraItem[];
  }) => {
    lastWriteTime.current = Date.now();
    
    // Accumulate the updates atomically
    pendingUpdatesRef.current = {
      ...pendingUpdatesRef.current,
      ...updates
    };

    // Clear previous timeout to debounce the server call
    if (pushTimeoutRef.current) {
      clearTimeout(pushTimeoutRef.current);
    }

    // Schedule single POST request after a short quiet period (300ms) to ensure fast persistence while bundling rapid keypresses
    pushTimeoutRef.current = setTimeout(async () => {
      const payload = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {}; // Clear accumulator
      pushTimeoutRef.current = null;

      // Extract only keys that have non-empty or updated content
      const payloadKeys = Object.keys(payload);
      if (payloadKeys.length > 0) {
        let success = false;
        
        const saveToServer = async (pld: any) => {
          let attempts = 3;
          let delay = 300;
          let srvSuccess = false;
          
          for (let i = 0; i < attempts; i++) {
            try {
              const res = await fetch('/api/db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  db: pld,
                  user: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null
                }),
              });
              if (res.ok) {
                srvSuccess = true;
                break;
              }
            } catch (err) {
              console.warn(`Tentativa ${i + 1} de salvar banco de dados falhou:`, err);
            }
            if (i < attempts - 1) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            }
          }
          return srvSuccess;
        };

        if (isClientFirebaseActive()) {
          let fsSuccess = false;
          try {
            fsSuccess = await saveDirectlyToFirestore(payload);
          } catch (err) {
            console.warn('[ClientFirebase] Erro ao sincronizar diretamente com o Firestore:', err);
          }

          let srvSuccess = false;
          try {
            srvSuccess = await saveToServer(payload);
          } catch (err) {
            // Expected fallback on static hosts like GitHub Pages
          }

          success = fsSuccess || srvSuccess;
        } else {
          success = await saveToServer(payload);
        }

        if (!success) {
          console.error('Failed to push batched database updates to server after all attempts.');
          // Return payload to the pendingUpdatesRef so they are retried or merged in the next write
          pendingUpdatesRef.current = {
            ...payload,
            ...pendingUpdatesRef.current
          };
          
          // Throttle the intrusive sync warning to maximum once per 60 seconds to avoid spamming the user during flaky network
          if (Date.now() - lastSyncAlertTime.current > 60000) {
            lastSyncAlertTime.current = Date.now();
            console.warn("[AppSync] Falha ao sincronizar alterações com o servidor. Re-agendando no background...");
          }
        }
      }
    }, 300);
  };

  // Helper to repair missing, broken or misaligned product descriptions
  const repairProductsList = (list: Product[]): Product[] => {
    const productMap = new Map<string, Product>();

    // Seed with all DEFAULT_PRODUCTS first
    DEFAULT_PRODUCTS.forEach(dp => {
      productMap.set(dp.code, { ...dp });
    });

    if (Array.isArray(list)) {
      list.filter(Boolean).forEach(p => {
        // Check if this was a misaligned import where code was set to skuFactor (e.g. "100", "12", "15"...)
        const canonicalByDesc = DEFAULT_PRODUCTS.find(dp => 
          dp.description.trim().toUpperCase() === (p.description || '').trim().toUpperCase()
        );

        const realCode = canonicalByDesc ? canonicalByDesc.code : p.code;
        const original = DEFAULT_PRODUCTS.find(dp => dp.code === realCode);

        const numCost = typeof p.cost === 'number' && !isNaN(p.cost) && p.cost > 0
          ? p.cost
          : (original?.cost !== undefined ? original.cost : (parseFloat(String(p.cost || 0)) || 0));

        const numHecto = typeof p.hectoFactor === 'number' && !isNaN(p.hectoFactor) && p.hectoFactor > 0 && p.hectoFactor < 10
          ? p.hectoFactor
          : (original?.hectoFactor !== undefined ? original.hectoFactor : (parseFloat(String(p.hectoFactor || 0)) || 0.01));

        const desc = (p.description === p.code || !p.description || p.description.trim() === '')
          ? (original?.description || p.description || realCode || 'Produto')
          : (canonicalByDesc?.description || p.description);

        const merged: Product = {
          code: realCode,
          description: desc,
          group: original?.group || p.group || 'CERVEJA',
          unit: original?.unit || p.unit || 'cx',
          palletFactor: original?.palletFactor || p.palletFactor || 84,
          skuFactor: original?.skuFactor || p.skuFactor || 1,
          hectoFactor: numHecto,
          cost: numCost,
          curve: original?.curve || p.curve || 'C',
          photoUrl: p.photoUrl || original?.photoUrl
        };

        productMap.set(realCode, merged);
      });
    }

    return Array.from(productMap.values());
  };

  // Normalization helper for Map Codes (strips leading zeros)
  const normalizeMapCode = (mapCode: any): string => {
    if (mapCode === undefined || mapCode === null) return '';
    return String(mapCode).trim().replace(/^0+/, '');
  };

  const cleanAudits = (list: AuditSession[]): AuditSession[] => {
    if (!list || !Array.isArray(list)) return [];
    return list.filter(Boolean).map(a => ({
      ...a,
      items: Array.isArray(a.items) ? a.items : [],
      assets: Array.isArray(a.assets) ? a.assets : [],
      history: Array.isArray(a.history) 
        ? a.history.filter(Boolean).map(h => ({
            ...h,
            action: h.action || 'Ação Registrada',
            user: h.user || 'Sistema',
            details: h.details || ''
          })) 
        : [],
      unifiedMaps: Array.isArray(a.unifiedMaps) ? a.unifiedMaps.map(normalizeMapCode) : [],
      routeMap: normalizeMapCode(a.routeMap),
    }));
  };

  const cleanEmpilhadores = (list: Empilhador[]): Empilhador[] => {
    if (!list || !Array.isArray(list)) return [];
    const seenIds = new Set<string>();
    const seenMatriculas = new Set<string>();
    const seenNames = new Set<string>();
    const result: Empilhador[] = [];

    for (const raw of list) {
      if (!raw) continue;
      const cleanId = (raw.id || '').trim();
      const cleanMatricula = (raw.matricula || '').trim().toUpperCase();
      const cleanName = (raw.name || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Check if duplicate
      if (cleanId && seenIds.has(cleanId)) continue;
      if (cleanMatricula && cleanMatricula !== 'MAT-DPO' && seenMatriculas.has(cleanMatricula)) continue;
      if (cleanName && cleanName.length >= 3 && seenNames.has(cleanName)) continue;

      if (cleanId) seenIds.add(cleanId);
      if (cleanMatricula && cleanMatricula !== 'MAT-DPO') seenMatriculas.add(cleanMatricula);
      if (cleanName && cleanName.length >= 3) seenNames.add(cleanName);

      result.push({
        ...raw,
        id: cleanId || `EMP-${cleanMatricula || Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        name: raw.name || 'Empilhador',
        matricula: raw.matricula || 'MAT-DPO',
        shift: raw.shift || '1_TURNO',
        status: raw.status || 'DISPONIVEL'
      });
    }
    return result;
  };

  const cleanImportedRoutes = (list: ImportedRoute[], currentAudits?: AuditSession[]): ImportedRoute[] => {
    if (!list) return [];
    const now = new Date().toISOString();
    const effectiveAudits = currentAudits || audits || [];
    return list.filter(Boolean).map(r => {
      const normMap = normalizeMapCode(r.routeMap).toUpperCase();
      const isClosedByAudit = effectiveAudits.some(a => {
        if (a.reopeningRequested || a.reopened || a.status === 'conferido_fisico' || a.status === 'recontagem_finalizada' || a.status === 'em_aberto' || a.status === 'reconferencia') return false;
        const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
        const matches = aNorm === normMap || (a.unifiedMaps && a.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === normMap));
        const isCompleted = (a.status === 'finalizado_ok' || a.status === 'finalizado_divergente') && !a.reopened;
        return matches && isCompleted;
      });

      return {
        ...r,
        routeMap: normalizeMapCode(r.routeMap),
        status: isClosedByAudit ? ('fechado' as const) : r.status,
        importedAt: r.importedAt || now,
        updatedAt: r.updatedAt || r.importedAt || now
      };
    });
  };

  const cleanVales = (list: Vale[]): Vale[] => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(v => {
      if (!v) return v;
      const numValor = typeof v.valor === 'number' && !isNaN(v.valor) ? v.valor : (parseFloat(String(v.valor || 0)) || 0);
      const numColabValor = v.colaboradorValor !== undefined ? (typeof v.colaboradorValor === 'number' && !isNaN(v.colaboradorValor) ? v.colaboradorValor : (parseFloat(String(v.colaboradorValor || 0)) || 0)) : undefined;
      return {
        ...v,
        valor: numValor,
        colaboradorValor: numColabValor,
        routeMap: v.routeMap ? normalizeMapCode(v.routeMap) : undefined
      };
    }).filter(Boolean);
  };

  const cleanReturnForecasts = (list: ReturnForecast[]): ReturnForecast[] => {
    if (!list) return [];
    return list.map(f => ({
      ...f,
      routeMap: normalizeMapCode(f.routeMap)
    }));
  };

  const getRouteStatusRank = (status?: string): number => {
    switch (status) {
      case 'fechado': return 4;
      case 'em_analise':
      case 'reconferir': return 3;
      case 'conferindo': return 2;
      case 'pendente':
      default: return 1;
    }
  };

  const getAuditStatusRank = (status?: string): number => {
    switch (status) {
      case 'finalizado_ok':
      case 'finalizado_divergente': return 4;
      case 'recontagem_finalizada':
      case 'sobra_alinhada':
      case 'conferido_fisico': return 3;
      case 'conferindo':
      case 'recontagem_solicitada': return 2;
      case 'pendente':
      default: return 1;
    }
  };

  const applyDirectDb = (db: any) => {
    if (!db) return;

    // Protection: If a local write was performed in the last 1.5 seconds, defer remote override to protect local user inputs/imports
    if (Date.now() - lastWriteTime.current < 1500) {
      console.log("[AppSync] Ignorando atualização remota temporariamente para proteger escrita local recente.");
      return;
    }

    if (db.users !== undefined && Array.isArray(db.users)) {
      const isFictitious = (u: User) => {
        const id = (u.id || '').toLowerCase();
        const name = (u.name || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return id.startsWith('mock_') || id.startsWith('fake_') || id.startsWith('test_') ||
               name.includes('mock') || name.includes('fictício') || name.includes('ficticio') || name.includes('teste 1') ||
               id === 'usr_1' || id === 'usr_2' || id === 'c1' || id === 'e1' || id === 'a1' ||
               username === 'user1' || username === 'user2';
      };
      const cleanedRemote = db.users.filter((u: User) => !isFictitious(u));
      
      // Strict comprehensive deduplication by username, id, and normalized name
      const { cleanedUsers: deduplicated, duplicateIds } = deduplicateUsersComprehensive(cleanedRemote);
      if (duplicateIds.length > 0) {
        duplicateIds.forEach(id => {
          deleteDocFromFirestore('users', id).catch(() => {});
        });
      }

      // If remote database is completely empty (e.g. brand new initialization), use DEFAULT_USERS; otherwise respect the DB
      const activeUsers = deduplicated.length > 0 ? deduplicated : DEFAULT_USERS;
      setUsers(activeUsers);
      setCurrentUser(prevUser => {
        const savedUserId = localStorage.getItem('logiroute_authenticated_user_id');
        const targetId = prevUser?.id || savedUserId;
        if (targetId) {
          const matched = activeUsers.find((u: User) => u.id === targetId || (u.username && u.username.toLowerCase() === targetId.toLowerCase()));
          if (matched) {
            try { localStorage.setItem('logiroute_authenticated_user', JSON.stringify(matched)); } catch (e) {}
            return matched;
          }
          if (prevUser) return prevUser;
        }
        return prevUser;
      });
    }

    if (db.drivers !== undefined && Array.isArray(db.drivers)) {
      setDrivers(db.drivers);
    }

    if (db.vehicles !== undefined && Array.isArray(db.vehicles)) {
      setVehicles(db.vehicles);
    }

    if (db.products !== undefined && Array.isArray(db.products)) {
      const repaired = repairProductsList(db.products);
      setProducts(repaired);
    }

    if (db.activeAssets !== undefined && Array.isArray(db.activeAssets)) {
      setActiveAssets(db.activeAssets);
    }

    if (db.audits !== undefined && Array.isArray(db.audits)) {
      const cleaned = cleanAudits(db.audits);
      setAudits(cleaned);
    }

    if (db.vales !== undefined && Array.isArray(db.vales)) {
      const cleaned = cleanVales(db.vales);
      setVales(cleaned);
    }

    if (db.empilhadores !== undefined && Array.isArray(db.empilhadores)) {
      setEmpilhadores(cleanEmpilhadores(db.empilhadores));
    }

    if (db.carregamentoProcesses !== undefined && Array.isArray(db.carregamentoProcesses)) {
      setCarregamentos(db.carregamentoProcesses);
    } else if (db.carregamentos !== undefined && Array.isArray(db.carregamentos)) {
      setCarregamentos(db.carregamentos);
    }

    if (db.controleSobras !== undefined && Array.isArray(db.controleSobras)) {
      setControleSobras(db.controleSobras);
    }

    if (db.fiveSEntries !== undefined && Array.isArray(db.fiveSEntries)) {
      setFiveSEntries(db.fiveSEntries);
      try { localStorage.setItem('ambev_liga_5s_entries', JSON.stringify(db.fiveSEntries)); } catch (e) {}
    }

    if (db.safetyReports !== undefined && Array.isArray(db.safetyReports)) {
      setSafetyReports(db.safetyReports);
      try { localStorage.setItem('ambev_liga_safety_reports', JSON.stringify(db.safetyReports)); } catch (e) {}
    }

    if (db.blitzEntries !== undefined && Array.isArray(db.blitzEntries)) {
      setBlitzEntries(db.blitzEntries);
      try { localStorage.setItem('ambev_liga_blitz_entries', JSON.stringify(db.blitzEntries)); } catch (e) {}
    }

    if (db.zeroBreakDeclarations !== undefined && Array.isArray(db.zeroBreakDeclarations)) {
      setZeroBreakDeclarations(db.zeroBreakDeclarations);
      try { localStorage.setItem('ambev_liga_break_declarations', JSON.stringify(db.zeroBreakDeclarations)); } catch (e) {}
    }

    if (db.returnForecasts !== undefined && Array.isArray(db.returnForecasts)) {
      const cleaned = cleanReturnForecasts(db.returnForecasts);
      setReturnForecasts(cleaned);
    }

    if (db.fiscalAlerts !== undefined && Array.isArray(db.fiscalAlerts)) {
      setFiscalAlerts(db.fiscalAlerts);
    }

    // Smart Merge Imported Routes
    if (db.importedRoutes !== undefined) {
      const remoteCleaned = cleanImportedRoutes(db.importedRoutes);
      setImportedRoutes(remoteCleaned);
    }

    if (db.audit_logs || db.auditLogs) {
      const logs = db.audit_logs || db.auditLogs;
      setAuditLogs(logs);
    }

    if (db.customManual !== undefined) {
      const manualContent = typeof db.customManual === 'string' ? db.customManual : db.customManual?.html || '';
      setCustomManualHTML(manualContent);
    }
  };

  // Immediate flush of pending database updates on page reload / unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
        pushTimeoutRef.current = null;
      }
      const payload = { ...pendingUpdatesRef.current };
      if (Object.keys(payload).length > 0) {
        pendingUpdatesRef.current = {};
        if (isClientFirebaseActive()) {
          saveDirectlyToFirestore(payload);
        } else {
          try {
            fetch('/api/db', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ db: payload }),
              keepalive: true
            }).catch(() => {});
          } catch (e) {
            // ignore unload fetch error
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Establish direct Firestore / server synchronization on mount
  useEffect(() => {
    // Limpa imediatamente qualquer cache legado de banco local
    try {
      localStorage.removeItem('logiroute_cached_app_db');
    } catch (e) {}

    // 1. Check persistent user ID if authenticated
    const savedUserId = localStorage.getItem('logiroute_authenticated_user_id');
    const savedUserStr = localStorage.getItem('logiroute_authenticated_user');
    let defaultUser: User | null = null;
    if (savedUserStr) {
      try { defaultUser = JSON.parse(savedUserStr); } catch (e) {}
    }
    if (!defaultUser && savedUserId) {
      defaultUser = users.find(u => u.id === savedUserId || (u.username && u.username.toLowerCase() === savedUserId.toLowerCase())) || DEFAULT_USERS.find(u => u.id === savedUserId) || null;
    }
    if (defaultUser) {
      setCurrentUser(defaultUser);
    }

    // 2. Fetch latest online database from server on startup (only if Firebase is not active)
    const fetchLatestServerData = async () => {
      // If Firestore client is active, Cloud Firestore is the authoritative source of truth.
      // Do not fetch /api/db which might contain stale server cache.
      if (isClientFirebaseActive()) {
        return;
      }
      try {
        const res = await fetch('/api/db');
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            console.warn("Expected JSON response from server, but received:", contentType);
            return;
          }
          const data = await res.json();
          if (data.success && data.db) {
            applyDirectDb(data.db);
          } else {
            console.log("Banco de dados do servidor está em branco ou indisponível. Ignorando auto-sobreposição para segurança.");
          }
        }
      } catch (err) {
        console.warn('Error fetching server database:', err);
      }
    };

    fetchLatestServerData();
  }, []);

  // 4a. Setup real-time database updates via Firestore Live Sync if active
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let pendingSnapshotTimeout: any = null;

    const initSubscription = () => {
      if (unsubscribe) {
        try { unsubscribe(); } catch (e) {}
      }
      if (isClientFirebaseActive()) {
        console.log("[ClientFirebase] Inicializando sincronização em tempo real nativa com Firestore (Plano Blaze)...");
        unsubscribe = subscribeToFirestore((db) => {
          // If there was a recent local write on this client, schedule applying the snapshot after the cooldown
          // so concurrent remote changes or server confirmations are never dropped
          if (Date.now() - lastWriteTime.current < 1500) {
            if (pendingSnapshotTimeout) clearTimeout(pendingSnapshotTimeout);
            pendingSnapshotTimeout = setTimeout(() => {
              applyDirectDb(db);
            }, 1600);
            return;
          }
          if (pendingSnapshotTimeout) {
            clearTimeout(pendingSnapshotTimeout);
            pendingSnapshotTimeout = null;
          }
          applyDirectDb(db);
        });
      }
    };

    initSubscription();

    const handleConfigChange = () => {
      console.log("[ClientFirebase] Configuração de banco alterada. Reinicializando inscrição...");
      initSubscription();
    };

    const handleForceApply = (e: any) => {
      if (e.detail) {
        console.log("[AppSync] Forçando aplicação manual de dados do banco...");
        applyDirectDb(e.detail);
      }
    };

    window.addEventListener('firebase_config_changed', handleConfigChange);
    window.addEventListener('force_database_apply', handleForceApply);

    return () => {
      if (pendingSnapshotTimeout) {
        clearTimeout(pendingSnapshotTimeout);
      }
      window.removeEventListener('firebase_config_changed', handleConfigChange);
      window.removeEventListener('force_database_apply', handleForceApply);
      if (unsubscribe) {
        console.log("[ClientFirebase] Cancelando inscrição em tempo real com Firestore...");
        unsubscribe();
      }
    };
  }, [clientPermissionDenied]);

  // 4b. Setup global server events (DB switch countdowns, config changes, schedule rules) via SSE
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      console.log("Conectando ao canal de sincronização de eventos do servidor (SSE)...");
      eventSource = new EventSource('/api/db/events');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data) {
            // Handle pending DB switch broadcast
            if (data.pendingDbSwitch !== undefined) {
              window.dispatchEvent(new CustomEvent('server_pending_switch_updated', { detail: data.pendingDbSwitch }));
            }

            // Handle config update broadcast across all connected devices
            if (data.config && data.config.projectId) {
              window.dispatchEvent(new CustomEvent('server_config_updated', { detail: data.config }));
              const currentLocalConfig = getActiveFirebaseConfig();
              if (currentLocalConfig?.projectId !== data.config.projectId) {
                console.log(`[SSE] Servidor informou troca de banco para ${data.config.projectId}. Atualizando localmente...`);
                switchActiveFirebaseConfig(data.config).then(() => {
                  window.location.reload();
                });
              }
            }

            // Handle custom schedule rules broadcast
            if (data.scheduleRules) {
              window.dispatchEvent(new CustomEvent('server_schedule_rules_updated', { detail: data.scheduleRules }));
            }

            // Synchronize database updates from SSE in real-time across all connected devices
            if (data.db) {
              const db = data.db;
              
              if (db.photos) {
                ImageDB.syncPhotos(db.photos).catch(e => console.error("Error syncing photos from SSE:", e));
              }

              // When Client Firebase is active, all primary collections are synchronized
              // directly and authoritatively via Firestore onSnapshot listeners.
              // We MUST NOT apply stale server db collections here, which would create
              // oscillating conflicts between server file cache and Cloud Firestore.
              if (isClientFirebaseActive()) {
                return;
              }

              // Skip applying updates if there was a recent local write on this client to avoid race conditions
              if (Date.now() - lastWriteTime.current < 1500) {
                return;
              }

              applyDirectDb(db);
            }
          }
        } catch (err) {
          console.error("Error parsing real-time database event:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.log("Canal de sincronização SSE em modo de espera ou reconectando. Tentando reconexão automática em 3s...");
        if (eventSource) {
          eventSource.close();
        }
        reconnectTimeout = setTimeout(() => {
          connectSSE();
        }, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [clientPermissionDenied]);

  // Real-time synchronization across tabs of the SAME browser
  useEffect(() => {
    const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel('logiroute_realtime_sync')
      : null;

    const reloadServerState = async () => {
      if (isClientFirebaseActive()) {
        const directDb = await fetchDirectlyFromFirestore();
        if (directDb) applyDirectDb(directDb);
      } else {
        try {
          const res = await fetch('/api/db');
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.db) applyDirectDb(data.db);
          }
        } catch (e) {}
      }
    };

    if (channel) {
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'RESET_PLATFORM') {
          reloadServerState();
        }
      };
    }

    return () => {
      if (channel) channel.close();
    };
  }, []);

  // Global tab navigation event listener
  useEffect(() => {
    const handleNav = (e: any) => {
      if (e?.detail) {
        setActiveTab(e.detail);
        try { localStorage.setItem('logiroute_active_tab', e.detail); } catch (err) {}
      }
    };
    window.addEventListener('logiroute:navigate-tab', handleNav);
    return () => window.removeEventListener('logiroute:navigate-tab', handleNav);
  }, []);

  // Guardião anti tela branca: valida e normaliza a aba ativa para o perfil logado
  useEffect(() => {
    if (!currentUser) return;
    const role = currentUser.role;

    const allowedTabs: Record<string, string[]> = {
      conferente: ['conferencias', 'carregamento', 'liga'],
      empilhador: ['carregamento', 'descarregamento', 'liga'],
      auxiliar_logistica: [
        'reconciliacao', 'historico', 'divergencias', 'mapas_importados',
        'sincronizador', 'vales_view', 'pasta_evidencias', 'sobras',
        'monitoramento_view', 'dashboard', 'cadastros', 'efd_histograma',
        'liga', 'backup', 'exportar', 'carregamento', 'conferencias'
      ],
      financeiro: [
        'reconciliacao', 'historico', 'divergencias', 'mapas_importados',
        'sincronizador', 'vales_view', 'pasta_evidencias', 'sobras',
        'monitoramento_view', 'dashboard', 'cadastros', 'efd_histograma',
        'liga', 'backup', 'exportar', 'carregamento', 'conferencias'
      ],
      monitoramento: [
        'monitoramento_view', 'historico', 'divergencias', 'sobras',
        'carregamento', 'liga'
      ],
      gestor: [
        'dashboard', 'cadastros', 'efd_histograma', 'reconciliacao',
        'historico', 'divergencias', 'mapas_importados', 'sincronizador',
        'vales_view', 'pasta_evidencias', 'sobras', 'carregamento',
        'conferencias', 'monitoramento_view', 'liga', 'backup', 'exportar'
      ]
    };

    const allowed = allowedTabs[role];
    if (allowed && !allowed.includes(activeTab)) {
      const defaultTab = 
        role === 'empilhador' ? 'carregamento' :
        role === 'conferente' ? 'conferencias' :
        role === 'auxiliar_logistica' ? 'reconciliacao' :
        role === 'financeiro' ? 'reconciliacao' :
        role === 'monitoramento' ? 'monitoramento_view' :
        'dashboard';
      setActiveTab(defaultTab);
      try { localStorage.setItem('logiroute_active_tab', defaultTab); } catch (e) {}
    } else {
      try { localStorage.setItem('logiroute_active_tab', activeTab); } catch (e) {}
    }
  }, [currentUser, activeTab]);

  // Disabled auto-generation of delay alerts to keep database alerts pristine
  /*
  useEffect(() => {
    ...
  }, [importedRoutes, fiscalAlerts]);
  */

  // Sync state changes back to AppStore (localStorage) and Server
  const handleSaveUsers = (newUsers: User[]) => {
    const { cleanedUsers: deduplicated, duplicateIds } = deduplicateUsersComprehensive(newUsers);
    if (duplicateIds.length > 0) {
      duplicateIds.forEach(id => {
        deleteDocFromFirestore('users', id).catch(() => {});
      });
    }
    setUsers(deduplicated);
    pushDatabaseToServer({ users: deduplicated });
  };

  const handleSaveDrivers = (newDrivers: Driver[]) => {
    setDrivers(newDrivers);
    pushDatabaseToServer({ drivers: newDrivers });
  };

  const handleSaveVehicles = (newVehicles: Vehicle[]) => {
    setVehicles(newVehicles);
    pushDatabaseToServer({ vehicles: newVehicles });
  };

  const handleSaveProducts = (newProducts: Product[]) => {
    const repaired = repairProductsList(newProducts);
    setProducts(repaired);
    pushDatabaseToServer({ products: repaired });
  };

  const handleSaveAudits = (newAudits: AuditSession[]) => {
    const timestamp = new Date().toISOString();
    const updatedAudits = newAudits.map(newAudit => {
      const oldAudit = audits.find(a => a.id === newAudit.id);
      const oldFunctional = oldAudit ? { ...oldAudit, updatedAt: undefined, lastUpdatedBy: undefined } : null;
      const newFunctional = { ...newAudit, updatedAt: undefined, lastUpdatedBy: undefined };
      if (!oldFunctional || JSON.stringify(oldFunctional) !== JSON.stringify(newFunctional)) {
        return {
          ...newAudit,
          updatedAt: timestamp,
          lastUpdatedBy: currentUser?.name || 'Sistema'
        };
      }
      return newAudit;
    });

    const cleaned = cleanAudits(updatedAudits);
    setAudits(cleaned);
    pushDatabaseToServer({ audits: cleaned });
  };

  const handleSaveForecasts = (newForecasts: ReturnForecast[]) => {
    const cleaned = cleanReturnForecasts(newForecasts);
    setReturnForecasts(cleaned);
    pushDatabaseToServer({ returnForecasts: cleaned });
  };

  const handleSaveAlerts = (newAlerts: FiscalAlert[]) => {
    setFiscalAlerts(newAlerts);
    pushDatabaseToServer({ fiscalAlerts: newAlerts });
  };

  const handleSaveImportedRoutes = (newRoutes: ImportedRoute[]) => {
    const timestamp = new Date().toISOString();
    const updatedRoutes = newRoutes.map(newRoute => {
      const newMapKey = normalizeMapCode(newRoute.routeMap).toUpperCase();
      const newDate = newRoute.routeDate || '';
      const oldRoute = importedRoutes.find(r => 
        normalizeMapCode(r.routeMap).toUpperCase() === newMapKey &&
        (r.routeDate || '') === newDate
      );
      const oldFunctional = oldRoute ? { ...oldRoute, updatedAt: undefined } : null;
      const newFunctional = { ...newRoute, updatedAt: undefined };
      if (!oldFunctional || JSON.stringify(oldFunctional) !== JSON.stringify(newFunctional)) {
        return {
          ...newRoute,
          updatedAt: timestamp
        };
      }
      return newRoute;
    });

    const cleaned = cleanImportedRoutes(updatedRoutes);
    setImportedRoutes(cleaned);
    pushDatabaseToServer({ importedRoutes: cleaned });
  };

  const handleSaveVales = (newVales: Vale[]) => {
    const cleaned = cleanVales(newVales);
    setVales(cleaned);
    pushDatabaseToServer({ vales: cleaned });
  };

  const handleSaveEmpilhadores = (newEmpilhadores: Empilhador[]) => {
    const cleaned = cleanEmpilhadores(newEmpilhadores);
    setEmpilhadores(cleaned);
    pushDatabaseToServer({ empilhadores: cleaned });
  };

  const handleSaveCarregamentos = (newCarregamentos: CarregamentoProcess[]) => {
    setCarregamentos(newCarregamentos);
    pushDatabaseToServer({ carregamentos: newCarregamentos, carregamentoProcesses: newCarregamentos });
  };

  const handleSaveLigaData = (data: {
    fiveSEntries?: FiveSEntry[];
    safetyReports?: SafetyReport[];
    blitzEntries?: BlitzRefugoEntry[];
    zeroBreakDeclarations?: ZeroBreakDeclaration[];
  }) => {
    const payload: any = {};
    if (data.fiveSEntries !== undefined) {
      setFiveSEntries(data.fiveSEntries);
      try { localStorage.setItem('ambev_liga_5s_entries', JSON.stringify(data.fiveSEntries)); } catch (e) {}
      payload.fiveSEntries = data.fiveSEntries;
    }
    if (data.safetyReports !== undefined) {
      setSafetyReports(data.safetyReports);
      try { localStorage.setItem('ambev_liga_safety_reports', JSON.stringify(data.safetyReports)); } catch (e) {}
      payload.safetyReports = data.safetyReports;
    }
    if (data.blitzEntries !== undefined) {
      setBlitzEntries(data.blitzEntries);
      try { localStorage.setItem('ambev_liga_blitz_entries', JSON.stringify(data.blitzEntries)); } catch (e) {}
      payload.blitzEntries = data.blitzEntries;
    }
    if (data.zeroBreakDeclarations !== undefined) {
      setZeroBreakDeclarations(data.zeroBreakDeclarations);
      try { localStorage.setItem('ambev_liga_break_declarations', JSON.stringify(data.zeroBreakDeclarations)); } catch (e) {}
      payload.zeroBreakDeclarations = data.zeroBreakDeclarations;
    }
    pushDatabaseToServer(payload);
  };

  // Switch tabs when current user role changes
  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('logiroute_authenticated_user_id', user.id);
      localStorage.setItem('logiroute_authenticated_user', JSON.stringify(user));
      localStorage.setItem('logiroute_last_login_username', user.username || user.id);
    } catch (e) {}
    if (user.role === 'empilhador') {
      setActiveTab('carregamento');
    } else if (user.role === 'conferente') {
      setActiveTab('conferencias');
    } else if (user.role === 'auxiliar_logistica' || user.role === 'financeiro') {
      setActiveTab('reconciliacao');
    } else if (user.role === 'gestor') {
      setActiveTab('dashboard');
    } else if (user.role === 'monitoramento') {
      setActiveTab('monitoramento_view');
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('logiroute_is_authenticated', 'true');
      localStorage.setItem('logiroute_authenticated_user_id', user.id);
      localStorage.setItem('logiroute_authenticated_user', JSON.stringify(user));
      localStorage.setItem('logiroute_last_login_username', user.username || user.id);
    } catch (e) {}

    // Route active tabs based on permission roles
    if (user.role === 'empilhador') {
      setActiveTab('carregamento');
    } else if (user.role === 'conferente') {
      setActiveTab('conferencias');
    } else if (user.role === 'auxiliar_logistica' || user.role === 'financeiro') {
      setActiveTab('reconciliacao');
    } else if (user.role === 'gestor') {
      setActiveTab('dashboard');
    } else if (user.role === 'monitoramento') {
      setActiveTab('monitoramento_view');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('logiroute_is_authenticated');
      localStorage.removeItem('logiroute_authenticated_user_id');
      localStorage.removeItem('logiroute_authenticated_user');
    } catch (e) {}
  };

  // Render branded Login View if not authenticated
  if (!isAuthenticated) {
    return <LoginView users={users} onLoginSuccess={handleLoginSuccess} />;
  }

  if (!currentUser) {
    const availableUsers = users.length > 0 ? users : DEFAULT_USERS;
    const savedUserId = localStorage.getItem('logiroute_authenticated_user_id');
    const savedUserStr = localStorage.getItem('logiroute_authenticated_user');
    let fallbackUser: User | null = null;
    if (savedUserStr) {
      try { fallbackUser = JSON.parse(savedUserStr); } catch (e) {}
    }
    if (!fallbackUser && savedUserId) {
      fallbackUser = availableUsers.find(u => u.id === savedUserId || (u.username && u.username.toLowerCase() === savedUserId.toLowerCase())) || null;
    }

    if (fallbackUser) {
      setTimeout(() => setCurrentUser(fallbackUser), 0);
    } else {
      setTimeout(() => {
        setIsAuthenticated(false);
        try { localStorage.removeItem('logiroute_is_authenticated'); } catch (e) {}
      }, 0);
    }

    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-semibold text-lg">Carregando plataforma de retornos...</p>
        </div>
      </div>
    );
  }

  // Tomorrow's date string
  const tomorrowStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  // Filter audits for deadlines
  const pendingDeadlines = (audits || []).filter(audit => {
    if (!audit) return false;
    if (audit.surplusFlowStatus === 'ENVIADO') return false;
    if (!audit.deliveryDate || audit.deliveryDate !== tomorrowStr) return false;
    
    const hasSurplus = (audit.items || []).some(i => {
      const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
      return phys > (i.fiscalQty ?? 0);
    }) || (audit.assets || []).some(a => {
      const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
      return phys > (a.fiscalQty ?? 0);
    });
    
    return hasSurplus;
  });

  const showDeadlineModal = currentUser && (currentUser.role === 'gestor' || currentUser.role === 'auxiliar_logistica') && pendingDeadlines.length > 0 && !hasShownDeadlinePopup;

  // Sent audits to notify monitoramento
  const sentAuditsToNotify = currentUser && currentUser.role === 'monitoramento'
    ? (audits || []).filter(audit => {
        if (!audit) return false;
        if (audit.surplusFlowStatus !== 'ENVIADO') return false;
        
        const hasSurplus = (audit.items || []).some(i => {
          const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
          return phys > (i.fiscalQty ?? 0);
        }) || (audit.assets || []).some(a => {
          const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
          return phys > (a.fiscalQty ?? 0);
        });
        
        return hasSurplus && !acknowledgedSent.includes(audit.id);
      })
    : [];

  const downloadSobrasCSV = (auditsToDownload: AuditSession[]) => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Mapa;Placa;Motorista;Codigo NB;Data de Entrega;Produto/Ativo;Quantidade Sobra\n";
    
    auditsToDownload.forEach(audit => {
      const driver = drivers.find(d => d.id === audit.driverId)?.name || 'Desconhecido';
      
      const surpluses = [
        ...audit.items.filter(i => (i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty) > (i.fiscalQty ?? 0)).map(i => ({
          description: i.productDescription,
          qty: (i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty) - (i.fiscalQty ?? 0)
        })),
        ...audit.assets.filter(a => (a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty) > (a.fiscalQty ?? 0)).map(a => ({
          description: a.assetName,
          qty: (a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty) - (a.fiscalQty ?? 0)
        }))
      ];
      
      surpluses.forEach(s => {
        csvContent += `"${audit.routeMap}";"${audit.plate}";"${driver}";"${audit.clientCodeNB || ''}";"${audit.deliveryDate || ''}";"${s.description}";"${s.qty}"\n`;
      });
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sobras_prazo_amanha_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-row font-sans text-slate-800" id="main_app_wrapper">
      {/* Sidebar with collapse toggle - Oculta para Conferente e Empilhador para liberar 100% de tela no celular */}
      {isAuthenticated && currentUser && currentUser.role !== 'conferente' && currentUser.role !== 'empilhador' && (
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          audits={audits}
          vales={vales}
          pendingSobrasCount={controleSobras.filter(s => s.status === 'PENDENTE').length}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Shared Navigation Header with Profile Switcher */}
        <Header
          currentUser={currentUser}
          users={users}
          onUserChange={handleUserChange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onLogout={handleLogout}
          fiscalAlerts={fiscalAlerts}
          onSaveAlerts={handleSaveAlerts}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />

      {/* Database Schedule Countdown Warning Banner */}
      <DatabaseScheduleBanner currentUser={currentUser} />

      {/* Permission Denied Warning Banner - ANTES não existia nenhum aviso
          para este estado; o app parava de sincronizar em tempo real
          silenciosamente e o usuário não tinha como saber. Agora o app
          tenta se reconectar sozinho em segundo plano (com backoff), e
          este banner só avisa que isso está em andamento. */}
      {clientPermissionDenied && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-800 dark:text-red-200 py-3.5 px-4" id="firestore_permission_warning_banner">
          <div className="w-full px-2 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-sm">Sincronização em tempo real interrompida</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Perdemos a conexão em tempo real com o banco de dados. O app está tentando se reconectar automaticamente. Se isso persistir por mais de um minuto, recarregue a página.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={() => {
                  console.log("[App] Recarregando para forçar reconexão com o Firebase...");
                  window.location.reload();
                }}
                className="bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 text-red-900 dark:text-red-100 text-xs font-semibold py-1.5 px-3 rounded-md border border-red-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recarregar Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Workspace Routing based on Profile & Tab */}
      <main className="flex-grow">
        
        {/* VIEW SOBRAS: CONTROLE DE SOBRAS E VALIDADE 30 DIAS */}
        {activeTab === 'sobras' && (
          <ControleSobrasView
            currentUser={currentUser}
            audits={audits}
            onSaveAudits={handleSaveAudits}
            products={products}
            controleSobras={controleSobras}
            onSaveControleSobras={handleSaveControleSobras}
          />
        )}

        {/* VIEW: DESCARREGAMENTO, CARREGAMENTO & DISTRIBUIÇÃO COM EMPILHADOR */}
        {activeTab === 'carregamento' && (
          <EmpilhadorView
            currentUser={currentUser}
            empilhadores={empilhadores}
            onSaveEmpilhadores={handleSaveEmpilhadores}
            carregamentos={carregamentos}
            onSaveCarregamentos={handleSaveCarregamentos}
            importedRoutes={importedRoutes}
            onSaveImportedRoutes={handleSaveImportedRoutes}
            audits={audits}
            onSaveAudits={handleSaveAudits}
            returnForecasts={returnForecasts}
            onSaveForecasts={handleSaveForecasts}
            fiscalAlerts={fiscalAlerts}
            onSaveAlerts={handleSaveAlerts}
            vehicles={vehicles}
            drivers={drivers}
            products={products}
            activeAssets={activeAssets}
            onNavigateTab={(tab: string) => setActiveTab(tab)}
          />
        )}

        {/* VIEW 1: CONFERENTE (PHYSICAL AUDITOR) */}
        {(currentUser.role === 'conferente' || currentUser.role === 'gestor' || currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') && activeTab === 'conferencias' && (
          <ConferenteView
            currentUser={currentUser}
            drivers={drivers}
            vehicles={vehicles}
            products={products}
            activeAssets={activeAssets}
            audits={audits}
            onSaveAudits={handleSaveAudits}
            onSaveDrivers={handleSaveDrivers}
            onSaveVehicles={handleSaveVehicles}
            returnForecasts={returnForecasts}
            onSaveForecasts={handleSaveForecasts}
            fiscalAlerts={fiscalAlerts}
            onSaveAlerts={handleSaveAlerts}
            importedRoutes={importedRoutes}
            onSaveImportedRoutes={handleSaveImportedRoutes}
            carregamentos={carregamentos}
            onSaveCarregamentos={handleSaveCarregamentos}
            empilhadores={empilhadores}
            onSaveEmpilhadores={handleSaveEmpilhadores}
            onNavigateTab={(tab: string) => setActiveTab(tab)}
          />
        )}

        {/* VIEW 2: AUXILIAR DE LOGÍSTICA & FINANCEIRO (FISCAL WORKSPACE & HISTORY) */}
        {(currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro' || currentUser.role === 'gestor') && (activeTab === 'reconciliacao' || activeTab === 'historico' || activeTab === 'divergencias' || activeTab === 'mapas_importados' || activeTab === 'sincronizador' || activeTab === 'vales_view' || activeTab === 'pasta_evidencias') && (
          <FiscalView
            currentUser={currentUser}
            users={users}
            drivers={drivers}
            onSaveDrivers={handleSaveDrivers}
            vehicles={vehicles}
            products={products}
            onSaveProducts={handleSaveProducts}
            activeAssets={activeAssets}
            audits={audits}
            onSaveAudits={handleSaveAudits}
            fiscalAlerts={fiscalAlerts}
            onSaveAlerts={handleSaveAlerts}
            importedRoutes={importedRoutes}
            onSaveImportedRoutes={handleSaveImportedRoutes}
            vales={vales}
            onSaveVales={handleSaveVales}
            carregamentos={carregamentos}
            onSaveCarregamentos={handleSaveCarregamentos}
            activeTab={activeTab}
            onResetPlatformData={handleResetPlatformData}
            returnForecasts={returnForecasts}
            onSaveForecasts={handleSaveForecasts}
          />
        )}

        {/* VIEW 4: MONITORAMENTO SPECIFIC ROUTING */}
        {(currentUser.role === 'monitoramento' || currentUser.role === 'gestor' || currentUser.role === 'financeiro' || currentUser.role === 'auxiliar_logistica') && activeTab === 'monitoramento_view' && (
          <MonitoramentoView
            currentUser={currentUser}
            importedRoutes={importedRoutes}
            onSaveImportedRoutes={handleSaveImportedRoutes}
            returnForecasts={returnForecasts}
            onSaveForecasts={handleSaveForecasts}
            drivers={drivers}
            onSaveDrivers={handleSaveDrivers}
            vehicles={vehicles}
            audits={audits}
            onSaveAudits={handleSaveAudits}
          />
        )}
        {currentUser.role === 'monitoramento' && (activeTab === 'historico' || activeTab === 'divergencias') && (
          <FiscalView
            currentUser={currentUser}
            users={users}
            drivers={drivers}
            onSaveDrivers={handleSaveDrivers}
            vehicles={vehicles}
            products={products}
            onSaveProducts={handleSaveProducts}
            activeAssets={activeAssets}
            audits={audits}
            onSaveAudits={handleSaveAudits}
            fiscalAlerts={fiscalAlerts}
            onSaveAlerts={handleSaveAlerts}
            importedRoutes={importedRoutes}
            onSaveImportedRoutes={handleSaveImportedRoutes}
            vales={vales}
            onSaveVales={handleSaveVales}
            carregamentos={carregamentos}
            onSaveCarregamentos={handleSaveCarregamentos}
            activeTab={activeTab}
            onResetPlatformData={handleResetPlatformData}
            returnForecasts={returnForecasts}
            onSaveForecasts={handleSaveForecasts}
          />
        )}

        {/* VIEW 3: GESTOR & AUXILIAR DE LOGÍSTICA & FINANCEIRO (CADASTROS & DASHBOARD ACCESS) */}
        {(currentUser.role === 'gestor' || currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') && (
          <>
            {(currentUser.role === 'gestor' || currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') && activeTab === 'dashboard' && (
              <GestorDashboard
                currentUser={currentUser}
                drivers={drivers}
                vehicles={vehicles}
                products={products}
                activeAssets={activeAssets}
                audits={audits}
                users={users}
                onSaveUsers={handleSaveUsers}
                onSaveDrivers={handleSaveDrivers}
                onSaveVehicles={handleSaveVehicles}
                onSaveProducts={handleSaveProducts}
                onSaveAudits={handleSaveAudits}
                importedRoutes={importedRoutes}
                onSaveImportedRoutes={handleSaveImportedRoutes}
                vales={vales}
                onSaveVales={handleSaveVales}
                carregamentos={carregamentos}
                onSaveCarregamentos={handleSaveCarregamentos}
                empilhadores={empilhadores}
                onSaveEmpilhadores={handleSaveEmpilhadores}
                forceTab="dashboard"
                auditLogs={auditLogs}
                customManualHTML={customManualHTML}
                onSaveCustomManual={handleSaveCustomManual}
                onResetPlatformData={handleResetPlatformData}
                onNavigateTab={(tab: string) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'cadastros' && (
              <GestorDashboard
                currentUser={currentUser}
                drivers={drivers}
                vehicles={vehicles}
                products={products}
                activeAssets={activeAssets}
                audits={audits}
                users={users}
                onSaveUsers={handleSaveUsers}
                onSaveDrivers={handleSaveDrivers}
                onSaveVehicles={handleSaveVehicles}
                onSaveProducts={handleSaveProducts}
                onSaveAudits={handleSaveAudits}
                importedRoutes={importedRoutes}
                onSaveImportedRoutes={handleSaveImportedRoutes}
                vales={vales}
                onSaveVales={handleSaveVales}
                carregamentos={carregamentos}
                onSaveCarregamentos={handleSaveCarregamentos}
                empilhadores={empilhadores}
                onSaveEmpilhadores={handleSaveEmpilhadores}
                forceTab="cadastros"
                auditLogs={auditLogs}
                customManualHTML={customManualHTML}
                onSaveCustomManual={handleSaveCustomManual}
                onResetPlatformData={handleResetPlatformData}
                onNavigateTab={(tab: string) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'efd_histograma' && (
              <GestorDashboard
                currentUser={currentUser}
                drivers={drivers}
                vehicles={vehicles}
                products={products}
                activeAssets={activeAssets}
                audits={audits}
                users={users}
                onSaveUsers={handleSaveUsers}
                onSaveDrivers={handleSaveDrivers}
                onSaveVehicles={handleSaveVehicles}
                onSaveProducts={handleSaveProducts}
                onSaveAudits={handleSaveAudits}
                importedRoutes={importedRoutes}
                onSaveImportedRoutes={handleSaveImportedRoutes}
                vales={vales}
                onSaveVales={handleSaveVales}
                carregamentos={carregamentos}
                onSaveCarregamentos={handleSaveCarregamentos}
                empilhadores={empilhadores}
                onSaveEmpilhadores={handleSaveEmpilhadores}
                forceTab="efd_histograma"
                auditLogs={auditLogs}
                customManualHTML={customManualHTML}
                onSaveCustomManual={handleSaveCustomManual}
                onResetPlatformData={handleResetPlatformData}
                onNavigateTab={(tab: string) => setActiveTab(tab)}
              />
            )}
          </>
        )}

        {/* VIEW: LIGA OPERACIONAL DPO (GAMIFICAÇÃO, HISTÓRICO INDIVIDUAL E PONTOS) */}
        {activeTab === 'liga' && (
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            <LigaView
              currentUser={currentUser}
              users={users}
              audits={audits}
              importedRoutes={importedRoutes}
              carregamentos={carregamentos}
              empilhadores={empilhadores}
              fiveSEntries={fiveSEntries}
              safetyReports={safetyReports}
              blitzEntries={blitzEntries}
              zeroBreakDeclarations={zeroBreakDeclarations}
              onSaveLigaData={handleSaveLigaData}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          </div>
        )}

        {/* VIEW: CENTRAL DE BACKUP DIÁRIO & EXPORTAÇÃO MULTIPLATAFORMA */}
        {(activeTab === 'backup' || activeTab === 'exportar') && (
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
            <ExportDataView
              currentUser={currentUser}
              drivers={drivers}
              vehicles={vehicles}
              products={products}
              activeAssets={activeAssets}
              audits={audits}
              users={users}
              importedRoutes={importedRoutes}
              vales={vales}
              auditLogs={auditLogs}
              customManualHTML={customManualHTML}
              carregamentos={carregamentos}
              fiscalAlerts={fiscalAlerts}
            />
          </div>
        )}

        {/* VIEW FALLBACK DE SEGURANÇA TOTAL (ANTI TELA BRANCA): CASO NENHUMA ABA ESPECÍFICA TENHA SIDO ACIONADA */}
        {!['sobras', 'carregamento', 'descarregamento', 'conferencias', 'reconciliacao', 'historico', 'divergencias', 'mapas_importados', 'sincronizador', 'vales_view', 'pasta_evidencias', 'monitoramento_view', 'dashboard', 'cadastros', 'efd_histograma', 'liga', 'backup', 'exportar'].includes(activeTab) && (
          currentUser.role === 'conferente' ? (
            <ConferenteView
              currentUser={currentUser}
              drivers={drivers}
              vehicles={vehicles}
              products={products}
              activeAssets={activeAssets}
              audits={audits}
              onSaveAudits={handleSaveAudits}
              onSaveDrivers={handleSaveDrivers}
              onSaveVehicles={handleSaveVehicles}
              returnForecasts={returnForecasts}
              onSaveForecasts={handleSaveForecasts}
              fiscalAlerts={fiscalAlerts}
              onSaveAlerts={handleSaveAlerts}
              importedRoutes={importedRoutes}
              onSaveImportedRoutes={handleSaveImportedRoutes}
              carregamentos={carregamentos}
              onSaveCarregamentos={handleSaveCarregamentos}
              empilhadores={empilhadores}
              onSaveEmpilhadores={handleSaveEmpilhadores}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          ) : currentUser.role === 'empilhador' ? (
            <EmpilhadorView
              currentUser={currentUser}
              empilhadores={empilhadores}
              onSaveEmpilhadores={handleSaveEmpilhadores}
              carregamentos={carregamentos}
              onSaveCarregamentos={handleSaveCarregamentos}
              importedRoutes={importedRoutes}
              onSaveImportedRoutes={handleSaveImportedRoutes}
              audits={audits}
              onSaveAudits={handleSaveAudits}
              returnForecasts={returnForecasts}
              onSaveForecasts={handleSaveForecasts}
              fiscalAlerts={fiscalAlerts}
              onSaveAlerts={handleSaveAlerts}
              vehicles={vehicles}
              drivers={drivers}
              products={products}
              activeAssets={activeAssets}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          ) : currentUser.role === 'monitoramento' ? (
            <MonitoramentoView
              currentUser={currentUser}
              importedRoutes={importedRoutes}
              onSaveImportedRoutes={handleSaveImportedRoutes}
              returnForecasts={returnForecasts}
              onSaveForecasts={handleSaveForecasts}
              drivers={drivers}
              onSaveDrivers={handleSaveDrivers}
              vehicles={vehicles}
              audits={audits}
              onSaveAudits={handleSaveAudits}
            />
          ) : currentUser.role === 'gestor' ? (
            <GestorDashboard
              currentUser={currentUser}
              drivers={drivers}
              vehicles={vehicles}
              products={products}
              activeAssets={activeAssets}
              audits={audits}
              users={users}
              onSaveUsers={handleSaveUsers}
              onSaveDrivers={handleSaveDrivers}
              onSaveVehicles={handleSaveVehicles}
              onSaveProducts={handleSaveProducts}
              onSaveAudits={handleSaveAudits}
              importedRoutes={importedRoutes}
              onSaveImportedRoutes={handleSaveImportedRoutes}
              vales={vales}
              onSaveVales={handleSaveVales}
              carregamentos={carregamentos}
              onSaveCarregamentos={handleSaveCarregamentos}
              empilhadores={empilhadores}
              onSaveEmpilhadores={handleSaveEmpilhadores}
              forceTab="dashboard"
              auditLogs={auditLogs}
              customManualHTML={customManualHTML}
              onSaveCustomManual={handleSaveCustomManual}
              onResetPlatformData={handleResetPlatformData}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          ) : (
            <FiscalView
              currentUser={currentUser}
              users={users}
              drivers={drivers}
              onSaveDrivers={handleSaveDrivers}
              vehicles={vehicles}
              products={products}
              onSaveProducts={handleSaveProducts}
              activeAssets={activeAssets}
              audits={audits}
              onSaveAudits={handleSaveAudits}
              fiscalAlerts={fiscalAlerts}
              onSaveAlerts={handleSaveAlerts}
              importedRoutes={importedRoutes}
              onSaveImportedRoutes={handleSaveImportedRoutes}
              vales={vales}
              onSaveVales={handleSaveVales}
              carregamentos={carregamentos}
              onSaveCarregamentos={handleSaveCarregamentos}
              activeTab="reconciliacao"
              onResetPlatformData={handleResetPlatformData}
              returnForecasts={returnForecasts}
              onSaveForecasts={handleSaveForecasts}
            />
          )
        )}
      </main>

      {/* Manual de uso da plataforma com exportação para PDF */}
      {isAuthenticated && currentUser && <PlatformManual customManualHTML={customManualHTML} />}

      {/* Sticky footer indicating production-ready definitive system */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xxs text-slate-400 font-medium font-sans">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>RETORNO DE ROTA PAU BRASIL GUARABIRA © 2026 • Sistema de Monitoramento e Máxima Eficiência de Retornos de Rota</span>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 uppercase font-extrabold font-mono flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-600 rounded-full animate-ping"></span>
              Modelo Definitivo Ativo
            </span>
            <span className="text-slate-500 font-medium">Ambiente Operacional Homologado Pau Brasil Distribuidora</span>
          </div>
        </div>
      </footer>

      {/* Agente de I.A flutuante para tirar dúvidas dos usuários */}
      {isAuthenticated && currentUser && (
        <AIAgentChat 
          importedRoutes={importedRoutes}
          audits={audits}
          vales={vales}
          drivers={drivers}
        />
      )}

      {/* MODAL 1: Sobra Deadline Warning for Gestor / Auxiliar Logística */}
      {showDeadlineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
              <div className="bg-amber-100 p-2.5 rounded-full">
                <AlertCircle className="h-6 w-6 text-amber-600 animate-pulse" />
              </div>
              <div>
                <h3 className="font-sans font-black text-slate-900 uppercase text-sm">Prazo de Entrega Amanhã!</h3>
                <span className="text-[10px] text-slate-400 font-semibold font-mono">Alerta de Sobra de Rota</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Identificamos <strong>{pendingDeadlines.length}</strong> mapa(s) de sobras cujas datas de entrega se encerram amanhã (<strong>{new Date(tomorrowStr + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>). Por favor, realize a baixa no sistema para evitar desvios fora do prazo.
            </p>

            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-100 max-h-36 overflow-y-auto">
              {pendingDeadlines.map(d => (
                <div key={d.id} className="flex justify-between items-center text-xxs font-mono text-slate-500 border-b border-slate-100 pb-1 last:border-none last:pb-0">
                  <span>Mapa: <strong>{d.routeMap}</strong> ({d.plate})</span>
                  <span>NB: {d.clientCodeNB || 'Não informado'}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  downloadSobrasCSV(pendingDeadlines);
                  setHasShownDeadlinePopup(true);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xxs py-2.5 px-3 rounded-lg transition uppercase text-center cursor-pointer shadow-sm flex items-center justify-center space-x-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Baixar do Sistema</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('divergencias');
                  setHasShownDeadlinePopup(true);
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xxs py-2.5 px-3 rounded-lg transition uppercase text-center cursor-pointer shadow-sm"
              >
                Ver no Painel
              </button>
              <button
                type="button"
                onClick={() => setHasShownDeadlinePopup(true)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xxs py-2.5 px-3 rounded-lg transition uppercase text-center cursor-pointer"
              >
                Ignorar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Sobra Sent Notice for Monitoramento */}
      {sentAuditsToNotify.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-500">
              <div className="bg-emerald-100 p-2.5 rounded-full">
                <Bell className="h-6 w-6 text-emerald-600 animate-bounce" />
              </div>
              <div>
                <h3 className="font-sans font-black text-slate-900 uppercase text-sm">Item de Sobra Enviado!</h3>
                <span className="text-[10px] text-slate-400 font-semibold font-mono">Notificação de Monitoramento</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O item de sobra referente ao mapa <strong>{sentAuditsToNotify[0].routeMap}</strong> (Placa: <strong>{sentAuditsToNotify[0].plate}</strong>) foi enviado com sucesso para o cliente! O status do fluxo de sobras agora é oficialmente <strong>ENVIADO (Baixado)</strong>.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  const currentId = sentAuditsToNotify[0].id;
                  const updated = [...acknowledgedSent, currentId];
                  setAcknowledgedSent(updated);
                  localStorage.setItem('logiroute_acknowledged_sent_audits', JSON.stringify(updated));
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xxs py-2.5 px-6 rounded-lg transition uppercase cursor-pointer shadow-sm"
              >
                Confirmar Ciente
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
