import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './firebase';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 text-amber-500">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Ops! Ocorreu um erro na aplicação</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Falha de execução capturada</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 font-mono overflow-auto max-h-40 leading-relaxed">
              {this.state.error?.message || "Erro desconhecido na execução."}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition duration-150 text-center cursor-pointer"
              >
                Recarregar Aplicação
              </button>
              <button
                onClick={() => {
                  try { localStorage.clear(); sessionStorage.clear(); } catch (e) { console.error(e); }
                  window.location.reload();
                }}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition duration-150 text-center cursor-pointer"
              >
                Limpar Cache Local e Reiniciar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global safety handler for ambient/unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event: ErrorEvent) => {
    if (!event || event.message === 'Script error.' || !event.error) {
      console.warn("Ambient non-fatal script error intercepted:", event?.message);
      return;
    }
    console.error("Global Error Caught:", event.error);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.warn("Unhandled Promise Rejection captured (non-fatal):", event.reason);
    try {
      event.preventDefault();
    } catch (e) {}
  });

  // Global custom window.alert override with safe DOM event listeners
  window.alert = (message: string) => {
    const existing = document.getElementById('custom-global-alert');
    if (existing) {
      existing.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.id = 'custom-global-alert';
    alertDiv.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800/90 p-4 flex items-start gap-3 animate-slide-in';
    
    if (!document.getElementById('custom-alert-style')) {
      const style = document.createElement('style');
      style.id = 'custom-alert-style';
      style.innerHTML = `
        @keyframes alertSlideIn {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes alertFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-slide-in {
          animation: alertSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-out {
          animation: alertFadeOut 0.2s ease-out forwards;
        }
      `;
      document.head.appendChild(style);
    }

    const iconDiv = document.createElement('div');
    iconDiv.className = 'p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20 shrink-0 mt-0.5';
    iconDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    const textDiv = document.createElement('div');
    textDiv.className = 'flex-1 min-w-0';

    const titleEl = document.createElement('h5');
    titleEl.className = 'text-[10px] font-black text-amber-400 uppercase tracking-widest font-mono';
    titleEl.textContent = 'Notificação do Sistema';

    const descEl = document.createElement('p');
    descEl.className = 'text-xs text-slate-200 font-medium leading-relaxed mt-1 whitespace-pre-line font-sans';
    descEl.textContent = String(message);

    textDiv.appendChild(titleEl);
    textDiv.appendChild(descEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-slate-400 hover:text-white transition duration-150 p-1.5 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer';
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    closeBtn.addEventListener('click', () => {
      alertDiv.classList.add('animate-fade-out');
      setTimeout(() => alertDiv.remove(), 200);
    });

    alertDiv.appendChild(iconDiv);
    alertDiv.appendChild(textDiv);
    alertDiv.appendChild(closeBtn);

    document.body.appendChild(alertDiv);

    const duration = Math.max(5000, Math.min(12000, String(message).length * 80));
    setTimeout(() => {
      if (document.body.contains(alertDiv)) {
        alertDiv.classList.add('animate-fade-out');
        setTimeout(() => alertDiv.remove(), 200);
      }
    }, duration);
  };
}

// Global custom Date formatting override to guarantee all dates across the app use dia-mês-ano (dd-mm-yyyy) with dashes
try {
  const originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
    try {
      const result = originalToLocaleDateString.call(this, locales, options);
      if (typeof result === 'string' && result.includes('/')) {
        return result.replace(/\//g, '-');
      }
      return result;
    } catch {
      return '';
    }
  };
} catch (e) {
  console.warn("Date prototype toLocaleDateString override skipped:", e);
}

// Auto-purge all platform caches on startup (Service Workers, Cache Storage, Local Cache)
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister().catch(() => {});
        }
      }).catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name).catch(() => {});
        }
      }).catch(() => {});
    }
    localStorage.removeItem('logiroute_cached_app_db');
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('logiroute_doc_cache_')) {
        sessionStorage.removeItem(k);
      }
    }
  } catch (e) {
    console.warn("Auto cache purge encountered error:", e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


