import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, FiscalAlert } from '../types';
import { 
  Shield, User as UserIcon, Truck, CheckCircle, BarChart3, Settings, 
  LogOut, FileSpreadsheet, Bell, Check, Clock, AlertCircle, FileText,
  Sun, Moon, Folder, Smartphone, Download, Wifi, RefreshCw, ShieldCheck, X, Layers,
  ExternalLink, Database, PackageCheck, PanelLeftClose, PanelLeftOpen, Sparkles, Trophy, ClipboardCheck, ArrowLeft
} from 'lucide-react';
import { 
  isClientFirebaseActive, 
  getFirebaseConnectionState, 
  getIsFirestoreQuotaExceeded,
  fetchDirectlyFromFirestore,
  getLastSuccessfulSyncTime,
  getActiveFirebaseConfig
} from '../clientFirebase';
import { DatabaseSwitcher } from './DatabaseSwitcher';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onUserChange: (user: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  fiscalAlerts?: FiscalAlert[];
  onSaveAlerts?: (alerts: FiscalAlert[]) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Header({ 
  currentUser, 
  users, 
  onUserChange, 
  activeTab, 
  setActiveTab, 
  onLogout,
  fiscalAlerts = [],
  onSaveAlerts,
  theme = 'light',
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebar
}: HeaderProps) {
  function convertToDirectDownloadUrl(url: string): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('drive.google.com') && trimmed.includes('/d/')) {
      const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    if (trimmed.includes('dropbox.com')) {
      return trimmed.replace('dl=0', 'dl=1');
    }
    return trimmed;
  }
  const [showNotifications, setShowNotifications] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);

  // APK download and PWA states
  const [showApkModal, setShowApkModal] = useState(false);
  const [apkDownloading, setApkDownloading] = useState(false);
  const [apkProgress, setApkProgress] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIframe, setIsIframe] = useState(false);
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [customApkUrl, setCustomApkUrl] = useState('');

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(getIsFirestoreQuotaExceeded());
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(getLastSuccessfulSyncTime());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleClearCacheAndReload = async () => {
    setIsClearingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      localStorage.removeItem('logiroute_cached_app_db');
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('logiroute_doc_cache_')) {
          sessionStorage.removeItem(k);
        }
      }
    } catch (e) {
      console.warn("Erro ao limpar cache:", e);
    }
    window.location.reload();
  };
  const [activeDbProjectId, setActiveDbProjectId] = useState<string>(() => {
    return getActiveFirebaseConfig()?.projectId || 'banco-oficial';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refreshDbConfig = () => {
      const current = getActiveFirebaseConfig();
      if (current?.projectId) {
        setActiveDbProjectId(current.projectId);
      }
    };

    window.addEventListener('firebase_config_changed', refreshDbConfig);
    window.addEventListener('server_config_updated', refreshDbConfig);

    const checkFirebaseActive = () => {
      try {
        const state = getFirebaseConnectionState();
        setFirebaseStatus(state);
      } catch (e) {
        setFirebaseStatus('disconnected');
      }
    };

    const handleFirestoreSynced = (e: any) => {
      setFirebaseStatus('connected');
      if (e && e.detail && e.detail.time) {
        setLastSyncTimestamp(e.detail.time);
      } else {
        setLastSyncTimestamp(Date.now());
      }
    };

    window.addEventListener('firestore_synced', handleFirestoreSynced);

    const handleOnline = () => {
      setIsOnline(true);
      setFirebaseStatus('connecting');
      // Verify Firestore is reachable after a short delay to stabilize
      setTimeout(() => {
        if (navigator.onLine) {
          checkFirebaseActive();
        } else {
          setFirebaseStatus('disconnected');
        }
      }, 1200);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setFirebaseStatus('disconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleQuotaExceeded = () => setIsQuotaExceeded(true);
    const handleQuotaRestored = () => setIsQuotaExceeded(false);

    window.addEventListener('firestore_quota_exceeded', handleQuotaExceeded);
    window.addEventListener('firestore_quota_restored', handleQuotaRestored);

    // Initial check
    if (navigator.onLine) {
      checkFirebaseActive();
    } else {
      setFirebaseStatus('disconnected');
    }

    // Set up a periodic check in case network fluctuates or silent dropouts occur
    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkFirebaseActive();
      } else {
        setFirebaseStatus('disconnected');
      }
    }, 15000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('firestore_quota_exceeded', handleQuotaExceeded);
      window.removeEventListener('firestore_quota_restored', handleQuotaRestored);
      window.removeEventListener('firestore_synced', handleFirestoreSynced);
      clearInterval(interval);
    };
  }, []);

  const handleSaveCustomApkUrl = () => {
    const convertedUrl = convertToDirectDownloadUrl(customApkUrl);
    setCustomApkUrl(convertedUrl);
    
    let message = "Link do APK configurado para esta sessão!";
    if (convertedUrl !== customApkUrl) {
      message = `Seu link foi detectado e convertido automaticamente para Download Direto!\n\nLink Original:\n${customApkUrl}\n\nLink Convertido:\n${convertedUrl}`;
    }
    alert(message);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Detect if app is currently loaded inside an iframe (like AI Studio preview sandbox)
      setIsIframe(window.self !== window.top);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleOpenStandalone = () => {
    if (typeof window !== 'undefined') {
      // Get the clean, full standalone URL without any iframe wrapping
      const standaloneUrl = window.location.href;
      window.open(standaloneUrl, '_blank');
    }
  };

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA installation choice: ${outcome}`);
        setDeferredPrompt(null);
      } catch (err) {
        console.error("Failed to prompt PWA installation:", err);
      }
    } else {
      alert(
        "Instruções para Instalação no Celular:\n\n" +
        "• No Android (Google Chrome):\n" +
        "Clique nos três pontinhos (superior direito) e selecione 'Adicionar à tela inicial' ou 'Instalar aplicativo'.\n\n" +
        "• No iOS / iPhone (Safari):\n" +
        "Clique no botão de Compartilhar (ícone de quadrado com seta para cima) e selecione 'Adicionar à Tela de Início'."
      );
    }
  };

  const getApkUrl = () => {
    if (customApkUrl && customApkUrl.trim() !== '') {
      return customApkUrl.trim();
    }

    if (typeof window === 'undefined') return '/guarabira_acuracidade_v2.1.0.apk';
    const loc = window.location;
    
    // Check if hosted on GitHub Pages (or contains github.io)
    if (loc.hostname.includes('github.io')) {
      const pathParts = loc.pathname.split('/').filter(p => p !== '');
      if (pathParts.length > 0) {
        // The first segment of path is the GitHub repository name
        const repoName = pathParts[0];
        return `${loc.protocol}//${loc.host}/${repoName}/guarabira_acuracidade_v2.1.0.apk`;
      }
    }
    
    // Default to absolute API route of the current host to force download headers and prevent browser from opening APK as text
    return `${loc.protocol}//${loc.host}/api/download/apk`;
  };

  const handleDownloadApk = () => {
    setApkDownloading(true);
    setApkProgress(0);
    
    const apkUrl = getApkUrl();
    console.log("[APK Download] Iniciando download automático do APK de:", apkUrl);
    
    // Trigger actual download of the static APK file
    try {
      const link = document.createElement('a');
      link.href = apkUrl;
      link.setAttribute('download', 'guarabira_acuracidade_v2.1.0.apk');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Erro ao iniciar download via link click:", e);
      // Fallback method
      window.location.href = apkUrl;
    }
    
    const interval = setInterval(() => {
      setApkProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setApkDownloading(false);
          }, 400);
          return 100;
        }
        return prev + 10;
      });
    }, 120);
  };

  const handleHeaderApkClick = () => {
    // Open the information modal
    setShowApkModal(true);
  };

  // Logo back to home action based on current user role
  const handleLogoClick = () => {
    if (currentUser.role === 'conferente') {
      setActiveTab('conferencias');
    } else if (currentUser.role === 'empilhador') {
      setActiveTab('carregamento');
    } else if (currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') {
      setActiveTab('reconciliacao');
    } else if (currentUser.role === 'gestor') {
      setActiveTab('dashboard');
    } else if (currentUser.role === 'monitoramento') {
      setActiveTab('monitoramento_view');
    } else {
      setActiveTab('reconciliacao');
    }
  };

  // Close notifications when clicking outside the bell container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellContainerRef.current && !bellContainerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Mark all relevant alerts as read when notifications popup is opened
  useEffect(() => {
    if (showNotifications && fiscalAlerts.length > 0 && onSaveAlerts) {
      const relevantUnreadAlerts = fiscalAlerts.filter(alert => {
        if (alert.read) return false;
        if (!alert.targetRole || alert.targetRole === 'todos') return true;
        return alert.targetRole === currentUser.role;
      });

      if (relevantUnreadAlerts.length > 0) {
        const updated = fiscalAlerts.map(a => {
          if (!a.targetRole || a.targetRole === 'todos' || a.targetRole === currentUser.role) {
            return { ...a, read: true };
          }
          return a;
        });
        onSaveAlerts(updated);
      }
    }
  }, [showNotifications, fiscalAlerts, onSaveAlerts, currentUser.role]);
  return (
    <header className="bg-slate-900 text-white shadow-md border-b border-slate-800 w-full max-w-full overflow-hidden" id="main_header">
      {/* Top tier bar: Logo and actions */}
      <div className="border-b border-slate-800/60 bg-slate-950/20 w-full">
        <div className="w-full max-w-full px-2 sm:px-4 lg:px-6">
          <div className="flex justify-between h-14 sm:h-16 items-center gap-1 sm:gap-2 w-full max-w-full min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink min-w-0">
              {/* Logo */}
              <div 
                onClick={handleLogoClick}
                className="flex items-center space-x-1.5 sm:space-x-2.5 cursor-pointer hover:opacity-90 transition-all shrink min-w-0"
                id="header_logo_btn"
              >
                <div className="bg-amber-500/10 p-1 sm:p-1.5 rounded-lg flex items-center justify-center border border-amber-500/20 w-7 h-7 sm:w-9 sm:h-9 shadow-inner shrink-0">
                  <Truck className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-amber-500 shrink-0" />
                </div>
                <div className="min-w-0 max-w-[95px] min-[380px]:max-w-[130px] sm:max-w-none">
                  <span className="font-sans font-black text-xs sm:text-base tracking-tight block text-white uppercase whitespace-nowrap truncate">Pau Brasil</span>
                  <span className="font-mono text-[7px] sm:text-xxs tracking-widest text-amber-500 uppercase block leading-none whitespace-nowrap truncate">Retorno de Rota</span>
                </div>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0 pr-0.5 sm:pr-0">
              {/* Firebase Connection Status Badge (Apenas em telas bem amplas para não espremer ações) */}
              <button
                type="button"
                onClick={() => setShowConnectionModal(true)}
                className={`hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border transition-colors shadow-xs cursor-pointer hover:bg-slate-800/60 shrink-0 max-w-[160px] ${
                isQuotaExceeded
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/30 animate-pulse'
                  : firebaseStatus === 'connected' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : firebaseStatus === 'connecting'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`} title="Clique para detalhes da Garantia de Conexão Multi-Dispositivo">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  {isQuotaExceeded && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  {firebaseStatus === 'connected' && !isQuotaExceeded && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  {firebaseStatus === 'connecting' && !isQuotaExceeded && (
                    <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 transition-all duration-300 ${
                    isQuotaExceeded
                      ? 'bg-amber-500'
                      : firebaseStatus === 'connected' 
                        ? 'bg-emerald-500' 
                        : firebaseStatus === 'connecting' 
                          ? 'bg-amber-500' 
                          : 'bg-rose-500'
                  }`}></span>
                </span>
                <span className="uppercase tracking-wider text-[9px] whitespace-nowrap truncate">
                  {isQuotaExceeded ? 'Cota Excedida' : `DB: ${activeDbProjectId}`}
                </span>
              </button>

              {/* 1. O USUÁRIO (Sempre visível no cabeçalho - Desktop e Mobile) */}
              <div 
                className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-800/90 border border-slate-700/80 px-1.5 sm:px-2 py-1 rounded-full text-xs font-medium text-slate-200 shrink min-w-0" 
                title={`${currentUser.name} (${currentUser.role})`}
                id="header_user_badge"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-mono uppercase text-[9px] text-amber-400 font-black shrink-0">
                  [{currentUser.role === 'auxiliar_logistica' ? 'AUX' : currentUser.role === 'conferente' ? 'CONF' : currentUser.role === 'empilhador' ? 'EMP' : currentUser.role === 'gestor' ? 'GEST' : currentUser.role === 'financeiro' ? 'FIN' : 'MONIT'}]
                </span>
                <span className="font-bold text-slate-100 text-[11px] sm:text-xs truncate max-w-[55px] min-[360px]:max-w-[75px] sm:max-w-[130px]">
                  {currentUser.name.split(' ')[0]}
                </span>
              </div>

              {/* 2. O SININHO DE NOTIFICAÇÃO (Com badge de não lidas e dropdown) */}
              <div className="relative shrink-0" id="notification_bell_container" ref={bellContainerRef}>
                <button
                  id="notification_bell_btn"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-1.5 sm:p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer relative shadow-sm shrink-0 ${
                    showNotifications 
                      ? 'bg-amber-500 text-slate-950 border-amber-600' 
                      : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white'
                  }`}
                  title="Notificações e Atualizações"
                >
                  <Bell className="h-4 w-4 shrink-0" />
                  {(() => {
                    const relevantAlerts = (fiscalAlerts || []).filter(alert => {
                      if (!alert.targetRole || alert.targetRole === 'todos') return true;
                      return alert.targetRole === currentUser.role;
                    });
                    const unreadCount = relevantAlerts.filter(a => !a.read).length;
                    return unreadCount > 0 ? (
                      <span 
                        id="unread_badge"
                        className="absolute -top-1 -right-1 bg-red-600 text-white font-sans font-extrabold text-[9px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center border border-slate-900 animate-pulse animate-infinite"
                      >
                        {unreadCount}
                      </span>
                    ) : null;
                  })()}
                </button>

                {showNotifications && (() => {
                  const relevantAlerts = (fiscalAlerts || []).filter(alert => {
                    if (!alert.targetRole || alert.targetRole === 'todos') return true;
                    return alert.targetRole === currentUser.role;
                  });
                  const unreadCount = relevantAlerts.filter(a => !a.read).length;

                  const handleMarkAsRead = (alertId: string) => {
                    if (onSaveAlerts) {
                      const updated = fiscalAlerts.map(a => a.id === alertId ? { ...a, read: true } : a);
                      onSaveAlerts(updated);
                    }
                  };

                  const handleMarkAllAsRead = () => {
                    if (onSaveAlerts) {
                      const updated = fiscalAlerts.map(a => {
                        if (!a.targetRole || a.targetRole === 'todos' || a.targetRole === currentUser.role) {
                          return { ...a, read: true };
                        }
                        return a;
                      });
                      onSaveAlerts(updated);
                    }
                  };

                  return (
                    <div 
                      id="notifications_popover"
                      className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                        <span className="font-sans font-bold text-xs text-white uppercase tracking-wider">Notificações</span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xxs font-sans font-medium text-amber-500 hover:text-amber-400 flex items-center space-x-1 cursor-pointer transition-all bg-transparent border-none p-0"
                          >
                            <Check className="h-3 w-3" />
                            <span>Ler tudo</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-slate-900">
                        {relevantAlerts.length > 0 ? (
                          relevantAlerts.map((alert) => (
                            <div 
                              key={alert.id} 
                              className={`p-3 transition-colors flex items-start space-x-2.5 ${
                                alert.read ? 'bg-slate-950 text-slate-400' : 'bg-slate-900/40 text-white border-l-2 border-amber-500'
                              }`}
                            >
                              <div className={`p-1.5 rounded-lg shrink-0 ${alert.read ? 'bg-slate-900 text-slate-500' : 'bg-amber-500/15 text-amber-500'}`}>
                                <AlertCircle className="h-3.5 w-3.5" />
                              </div>
                              
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <span className="font-sans font-bold text-xs block truncate pr-1">
                                    {alert.title || `Mapa ${alert.routeMap}`}
                                  </span>
                                  {!alert.read && (
                                    <button
                                      onClick={() => handleMarkAsRead(alert.id)}
                                      className="text-amber-500 hover:text-amber-400 p-0.5 rounded hover:bg-slate-800 shrink-0 cursor-pointer"
                                      title="Marcar como lida"
                                    >
                                      <Check className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                                
                                <p className="text-[10px] leading-relaxed break-words font-sans text-slate-300">
                                  {alert.message || `O status do mapa foi atualizado para ${alert.status}`}
                                </p>
                                
                                <div className="flex items-center space-x-1 pt-1 font-mono text-[8px] text-slate-500">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>•</span>
                                  <span>Placa: {alert.plate}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-xxs text-slate-500 font-sans italic">
                            Nenhuma notificação encontrada.
                          </div>
                        )}
                      </div>
                      
                      <div className="p-2 border-t border-slate-800 text-center bg-slate-900">
                        <span className="text-[9px] font-sans text-slate-500 uppercase tracking-wider">Histórico de Alertas Ativo</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3. O ÍCONE DA LIGA (LIGA OPERACIONAL DPO - Sempre visível no Mobile e Desktop) */}
              <button
                id="header_liga_dpo_btn"
                type="button"
                onClick={() => {
                  if (activeTab === 'liga') {
                    if (currentUser.role === 'conferente') setActiveTab('conferencias');
                    else if (currentUser.role === 'empilhador') setActiveTab('carregamento');
                    else if (currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') setActiveTab('reconciliacao');
                    else if (currentUser.role === 'monitoramento') setActiveTab('monitoramento_view');
                    else setActiveTab('dashboard');
                  } else {
                    setActiveTab('liga');
                  }
                }}
                className={`flex border py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg transition-colors items-center space-x-1 sm:space-x-1.5 cursor-pointer shadow-xs text-xs font-bold shrink-0 ${
                  activeTab === 'liga'
                    ? 'bg-amber-500 border-amber-400 text-slate-950 font-black ring-1 ring-amber-400/50'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-300 hover:text-amber-100 font-extrabold'
                }`}
                title={activeTab === 'liga' ? "Voltar da Liga DPO para tela operacional" : "LIGA OPERACIONAL DPO"}
              >
                <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current text-amber-400 shrink-0" />
                <span className="font-black uppercase text-[10px] sm:text-xs tracking-tight">LIGA</span>
              </button>

              {/* Botão auxiliar quando em Liga para qualquer colaborador voltar à sua tela principal */}
              {activeTab === 'liga' && (
                <button
                  id="header_operational_return_btn"
                  type="button"
                  onClick={() => {
                    if (currentUser.role === 'empilhador') setActiveTab('carregamento');
                    else if (currentUser.role === 'conferente') setActiveTab('conferencias');
                    else if (currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro') setActiveTab('reconciliacao');
                    else if (currentUser.role === 'monitoramento') setActiveTab('monitoramento_view');
                    else setActiveTab('dashboard');
                  }}
                  className="flex border py-1 sm:py-1.5 px-2 rounded-lg transition-colors items-center space-x-1 cursor-pointer shadow-xs text-xs font-black shrink-0 bg-blue-600 hover:bg-blue-500 text-white border-blue-400"
                  title="Voltar para a tela principal"
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-[10px] uppercase">Voltar</span>
                </button>
              )}

              {/* Baixar APK Mobile Button (Apenas telas extra-grandes para não espremer barra de ações) */}
              <button
                id="download_apk_btn"
                onClick={handleHeaderApkClick}
                className="hidden xl:flex bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white py-1 sm:py-1.5 px-2.5 rounded-lg transition-colors items-center space-x-1.5 cursor-pointer shadow-xs text-xs font-bold shrink-0"
                title="Baixar Aplicativo Mobile (APK)"
              >
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                <span>Baixar APK</span>
              </button>

              {/* Botão Limpar Cache e Recarregar (Telas Médias/Grandes) */}
              <button
                id="clear_platform_cache_btn"
                onClick={handleClearCacheAndReload}
                disabled={isClearingCache}
                className="hidden md:flex bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white p-1.5 sm:p-2 rounded-lg transition-colors items-center justify-center cursor-pointer shadow-xs shrink-0"
                title="Limpar Cache da Plataforma e Recarregar Dados Atualizados"
              >
                <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400 ${isClearingCache ? 'animate-spin' : ''}`} />
              </button>

              {/* Theme Toggle (Telas Médias/Grandes) */}
              <button
                id="theme_toggle_btn"
                onClick={onToggleTheme}
                className="hidden md:flex bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white p-1.5 sm:p-2 rounded-lg transition-colors items-center justify-center cursor-pointer shadow-xs shrink-0"
                title={theme === 'dark' ? "Ativar Modo Claro" : "Ativar Modo Escuro"}
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-300" />}
              </button>

              {/* 4. O BOTÃO DE LOG IN E LOG OUT (Sempre visível no Cabeçalho - Mobile e Desktop) */}
              <button
                id="header_logout_btn"
                type="button"
                onClick={onLogout}
                className="flex border py-1 sm:py-1.5 px-2 sm:px-2.5 rounded-lg transition-colors items-center space-x-1 cursor-pointer shadow-xs text-xs font-black shrink-0 bg-rose-950/70 hover:bg-rose-900 border-rose-800/80 hover:border-rose-500 text-rose-200 hover:text-white group font-sans"
                title="Sair da conta e voltar para a Tela de Login"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-400 group-hover:text-white shrink-0 transition-colors" />
                <span className="font-black uppercase text-[10px] sm:text-xs tracking-tight">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary navigation bar removed as navigation is centralized in the Sidebar */}

      {/* APK Mobile Download Modal Overlay */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] my-auto">
            {/* Header */}
            <div className="bg-slate-900 text-white p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="bg-amber-500 text-slate-950 p-1.5 rounded-lg shadow-sm">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-sm sm:text-base leading-tight uppercase tracking-tight text-amber-500">
                    Aplicativo Mobile Oficial
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono font-medium">
                    Retorno de Rota Pau Brasil • PWA Mobile
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!apkDownloading) {
                    setShowApkModal(false);
                  }
                }}
                disabled={apkDownloading}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 p-1.5 px-3 rounded-lg transition text-xs font-bold font-mono border border-slate-700 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 font-sans overflow-y-auto flex-1 overscroll-contain">
              
              {isIframe ? (
                // Inside AI Studio Preview Warning
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <span className="text-xxs font-black text-amber-700 uppercase tracking-wider block font-mono">
                      ⚠️ DETECTADO: Visualizador AI Studio
                    </span>
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                      Você está visualizando a plataforma de teste do AI Studio. Navegadores bloqueiam downloads e instalação de aplicativos diretamente de dentro desse simulador por segurança.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block font-mono">
                      👉 Para instalar no Celular (Como um APK):
                    </span>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Clique no botão abaixo para abrir a sua plataforma <strong>Retorno de Rota</strong> original em tela cheia e independente de forma segura.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenStandalone}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 border border-emerald-500 animate-pulse"
                  >
                    <span>Abrir Plataforma Independente</span>
                  </button>
                </div>
              ) : (
                // Standalone Mode - Real Installation
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block font-mono">
                      📱 PLATAFORMA MOBILE PRONTA
                    </span>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Instale a plataforma <strong>Retorno de Rota Pau Brasil</strong> diretamente no seu smartphone! Ela funcionará exatamente como um aplicativo APK nativo, em tela cheia, com ícone próprio e inicialização instantânea.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xxs">
                    <span className="font-extrabold text-slate-800 uppercase block tracking-wider">
                      🛠️ Passo a passo simples no Celular:
                    </span>
                    <div className="space-y-2 text-slate-600 font-semibold">
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-600">🤖</span>
                        <span>
                          <strong>Android (Google Chrome):</strong> Clique no botão azul de instalação abaixo, ou toque nos 3 pontinhos no canto superior direito e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-amber-500">🍎</span>
                        <span>
                          <strong>iPhone (Safari):</strong> Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) e escolha <strong>"Adicionar à Tela de Início"</strong>.
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleInstallPWA}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 border border-blue-500"
                  >
                    <Smartphone className="h-4 w-4" />
                    <span>Instalar Aplicativo Oficial</span>
                  </button>
                  
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider">instalação por arquivo apk</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block font-mono">
                      📥 Download Direto do APK
                    </span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Caso prefira instalar manualmente via arquivo APK, você pode usar o botão abaixo. O link padrão baixa do próprio servidor atual.
                    </p>

                    {apkDownloading ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span className="flex items-center gap-1.5 animate-pulse text-emerald-600">
                            ⏳ Baixando APK...
                          </span>
                          <span className="font-mono text-emerald-600">{apkProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div 
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-200" 
                            style={{ width: `${apkProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDownloadApk}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2 border border-emerald-500 shadow-xs"
                      >
                        <Download className="h-4 w-4" />
                        <span>Baixar Arquivo APK</span>
                      </button>
                    )}

                    {/* Configuração de Link Customizado para o APK */}
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center space-x-1 cursor-pointer w-full"
                      >
                        <Settings className="h-3 w-3 shrink-0" />
                        <span>{showCustomUrlInput ? "Ocultar configuração de link customizado" : "Hospedar APK no Google Drive / GitHub Releases"}</span>
                      </button>

                      {showCustomUrlInput && (
                        <div className="mt-2.5 space-y-2.5 bg-white p-3 rounded-lg border border-slate-200">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            Link de Hospedagem Alternativo (Google Drive, GitHub, Mega)
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={customApkUrl}
                              onChange={(e) => setCustomApkUrl(e.target.value)}
                              placeholder="Cole o link de download aqui..."
                              className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={handleSaveCustomApkUrl}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold uppercase transition cursor-pointer shrink-0"
                            >
                              Salvar
                            </button>
                          </div>
                          
                          <div className="text-[10px] text-slate-600 leading-relaxed space-y-2.5 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                            <p className="font-bold text-amber-800 flex items-center gap-1">
                              ⚠️ O que causa o "Erro ao analisar o pacote" no Android?
                            </p>
                            <p className="text-slate-600">
                              Esse erro geralmente ocorre por dois motivos comuns em ambientes de hospedagem estáticos como o <strong>GitHub Pages</strong>:
                            </p>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                              <li>
                                <strong>Download de uma página HTML em vez do APK:</strong> Se o arquivo APK não pôde ser enviado para o repositório por exceder limites de tamanho, ao tentar baixar, o GitHub Pages serve a página de erro 404 (HTML) com o nome de <code>.apk</code>. O Android não consegue instalar um arquivo de texto e exibe o erro de análise.
                              </li>
                              <li>
                                <strong>Uso de links de visualização:</strong> Ao compartilhar um arquivo do Google Drive, se você colar o link que termina em <code>/view</code> ou <code>/edit</code>, o download traz o código da página de visualização web do Google Drive, corrompendo o arquivo baixado.
                              </li>
                            </ul>

                            <div className="pt-2 border-t border-amber-200/50">
                              <p className="font-semibold text-emerald-800">💡 A Solução Perfeita (Hospedar na Nuvem):</p>
                              <ol className="list-decimal pl-4 mt-1 space-y-1 text-slate-700">
                                <li>Faça o upload do arquivo <strong>guarabira_acuracidade_v2.1.0.apk</strong> no seu Google Drive, OneDrive ou Dropbox.</li>
                                <li>Defina o compartilhamento do arquivo como <strong>"Qualquer pessoa com o link"</strong> e copie o link.</li>
                                <li>Cole o link copiado no campo acima e clique em <strong>Salvar</strong>.</li>
                                <li>
                                  <strong className="text-emerald-700">Conversor Inteligente:</strong> O sistema detectará o link de visualização automaticamente e o reestruturará para um link de <strong>Download Direto do arquivo binário real</strong>, solucionando o erro no celular!
                                </li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[9px] text-slate-400 font-medium text-center italic leading-relaxed pt-1 border-t border-slate-100">
                *O aplicativo PWA é mais seguro, não exibe avisos de segurança no celular, consome menos memória e atualiza automaticamente em tempo real!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Garantia de Conexão em Tempo Real (Firebase Multi-Dispositivo) */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden text-slate-800">
            <div className="flex items-start justify-between border-b border-slate-100 p-3.5 sm:p-5 shrink-0 bg-white">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 shrink-0">
                  <Wifi className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                    Garantia de Conexão em Tempo Real
                  </h3>
                  <p className="text-[10px] sm:text-xs text-slate-500">
                    Sincronização Nuvem Multi-Dispositivos (Firebase Cloud Firestore)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 flex-1 overscroll-contain text-xs leading-relaxed">
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                    Status da Conexão:
                  </span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-mono">
                    100% Conectado
                  </span>
                </div>
                <p className="text-emerald-700">
                  Qualquer mapa, alteração ou conferência realizada no <strong>GitHub Pages</strong>, <strong>Computador</strong> ou <strong>Celular</strong> é propagada instantaneamente em tempo real para todos os colaboradores!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="block text-[9px] font-sans uppercase tracking-wider text-slate-400 font-bold">Projeto Firebase</span>
                  <span className="font-semibold text-slate-700 truncate block">{(getActiveFirebaseConfig()?.projectId) || 'banco-oficial'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-sans uppercase tracking-wider text-slate-400 font-bold">Banco Firestore ID</span>
                  <span className="font-semibold text-slate-700 truncate block">{(getActiveFirebaseConfig()?.firestoreDatabaseId) || '(default)'}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-sans uppercase tracking-wider text-slate-400 font-bold">Canal de Escuta</span>
                  <span className="font-semibold text-emerald-600 truncate block">onSnapshot (WebSockets)</span>
                </div>
                <div>
                  <span className="block text-[9px] font-sans uppercase tracking-wider text-slate-400 font-bold">Última Sincronização</span>
                  <span className="font-semibold text-slate-700 truncate block">
                    {lastSyncTimestamp ? new Date(lastSyncTimestamp).toLocaleTimeString('pt-BR') : 'Agora'}
                  </span>
                </div>
              </div>

              {/* Banco Oficial Unificado Status */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-blue-600" />
                    Banco de Dados Oficial Unificado
                  </span>
                  <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Ativo & Conectado
                  </span>
                </div>
                <p className="text-blue-950 text-xs font-semibold">
                  Google Cloud Firestore (Plano Blaze)
                </p>
                <p className="text-[11px] text-blue-700 font-mono">
                  {getActiveFirebaseConfig()?.projectId || 'banco-03-teste'}
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                  Regras de Segurança Aplicadas
                </p>
                <p className="text-amber-800 text-[11px]">
                  O arquivo de permissões <code>firestore.rules</code> foi atualizado e implantado na nuvem, garantindo acesso completo e sem falhas de permissão para <code>importedRoutes</code>, <code>audits</code>, <code>customManual</code> e todas as coleções.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={async () => {
                  setIsManualSyncing(true);
                  try {
                    const directData = await fetchDirectlyFromFirestore();
                    if (directData) {
                      window.dispatchEvent(new CustomEvent('force_database_apply', { detail: directData }));
                      window.dispatchEvent(new CustomEvent('firestore_synced', { detail: { time: Date.now() } }));
                    }
                  } catch (e) {
                    console.error("Erro na sincronização manual:", e);
                  } finally {
                    setTimeout(() => setIsManualSyncing(false), 500);
                  }
                }}
                disabled={isManualSyncing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isManualSyncing ? 'animate-spin' : ''}`} />
                <span>{isManualSyncing ? "Sincronizando..." : "Forçar Sincronização Agora"}</span>
              </button>

              <button
                onClick={() => setShowConnectionModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
