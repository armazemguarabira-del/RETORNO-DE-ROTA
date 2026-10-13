import React, { useState, useMemo } from 'react';
import { User, AuditSession, Vale } from '../types';
import { 
  BarChart3, 
  Layers, 
  CheckCircle, 
  Shield, 
  PackageCheck, 
  Truck, 
  FileSpreadsheet, 
  FileText, 
  Settings, 
  Database, 
  Search, 
  PanelLeftClose, 
  PanelLeftOpen,
  ChevronRight,
  Trophy,
  Sparkles,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  audits?: AuditSession[];
  vales?: Vale[];
  pendingSobrasCount?: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout?: () => void;
}

export default function Sidebar({
  currentUser,
  activeTab,
  setActiveTab,
  audits = [],
  vales = [],
  pendingSobrasCount = 0,
  collapsed,
  onToggleCollapse,
  onLogout
}: SidebarProps) {
  // Conferente e Empilhador não utilizam barra lateral para economizar 100% do espaço no celular e tela
  if (currentUser.role === 'conferente' || currentUser.role === 'empilhador') {
    return null;
  }

  const [filterSearch, setFilterSearch] = useState('');

  // Format initials for avatar
  const userInitials = useMemo(() => {
    if (!currentUser.name) return 'PB';
    const parts = currentUser.name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [currentUser.name]);

  // Format role label
  const roleLabel = useMemo(() => {
    switch (currentUser.role) {
      case 'gestor': return 'COORDENADOR / GESTOR';
      case 'auxiliar_logistica': return 'AUXILIAR DE LOGÍSTICA';
      case 'conferente': return 'CONFERENTE DE ROTA';
      case 'financeiro': return 'ANALISTA FINANCEIRO';
      case 'monitoramento': return 'MONITORAMENTO';
      case 'empilhador': return 'OPERADOR EMPILHADEIRA';
      default: return 'COLABORADOR';
    }
  }, [currentUser.role]);

  // Count pending items for badges
  const pendingAuditsCount = useMemo(() => {
    return audits.filter(a => a.status === 'em_aberto' || a.status === 'conferido_fisico' || a.status === 'reconferencia').length;
  }, [audits]);

  const pendingValesCount = useMemo(() => {
    return vales.filter(v => v.status === 'PENDENTE_ASSINATURA').length;
  }, [vales]);

  // Navigation Items matching the exact items and icons from the Header with distinctive colors
  const navItems = [
    {
      id: 'dashboard',
      tabKey: 'dashboard',
      title: 'PAINEL GERENCIAL',
      icon: BarChart3,
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/15 border-blue-500/30 group-hover:bg-blue-500/25',
      activeIconClass: 'bg-slate-950 text-blue-400',
      roles: ['gestor', 'financeiro']
    },
    {
      id: 'liga',
      tabKey: 'liga',
      title: 'LIGA OPERACIONAL DPO',
      icon: Trophy,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30 group-hover:bg-amber-500/25',
      activeIconClass: 'bg-slate-950 text-amber-400',
      roles: ['conferente', 'empilhador', 'gestor', 'auxiliar_logistica', 'financeiro', 'monitoramento']
    },
    {
      id: 'carregamento',
      tabKey: 'carregamento',
      title: 'DESCARREGAMENTO',
      icon: Layers,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/15 border-amber-500/30 group-hover:bg-amber-500/25',
      activeIconClass: 'bg-slate-950 text-amber-400',
      roles: ['empilhador', 'conferente', 'auxiliar_logistica', 'financeiro', 'monitoramento', 'gestor']
    },
    {
      id: 'conferencias',
      tabKey: 'conferencias',
      title: 'CONTAGEM FÍSICA',
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15 border-emerald-500/30 group-hover:bg-emerald-500/25',
      activeIconClass: 'bg-slate-950 text-emerald-400',
      roles: ['conferente', 'gestor']
    },
    {
      id: 'reconciliacao',
      tabKey: 'reconciliacao',
      title: 'CONCILIAÇÃO FISCAL',
      icon: Shield,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/15 border-indigo-500/30 group-hover:bg-indigo-500/25',
      activeIconClass: 'bg-slate-950 text-indigo-400',
      roles: ['auxiliar_logistica', 'financeiro', 'gestor']
    },
    {
      id: 'sobras',
      tabKey: 'sobras',
      title: 'CONTROLE DE SOBRAS',
      icon: PackageCheck,
      iconColor: 'text-teal-400',
      iconBg: 'bg-teal-500/15 border-teal-500/30 group-hover:bg-teal-500/25',
      activeIconClass: 'bg-slate-950 text-teal-400',
      badge: pendingSobrasCount > 0 ? pendingSobrasCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-950',
      roles: ['auxiliar_logistica', 'gestor', 'financeiro', 'monitoramento']
    },
    {
      id: 'monitoramento',
      tabKey: 'monitoramento_view',
      title: 'MONITORAMENTO',
      icon: Truck,
      iconColor: 'text-sky-400',
      iconBg: 'bg-sky-500/15 border-sky-500/30 group-hover:bg-sky-500/25',
      activeIconClass: 'bg-slate-950 text-sky-400',
      roles: ['monitoramento', 'gestor', 'auxiliar_logistica', 'financeiro']
    },
    {
      id: 'sincronizador',
      tabKey: 'sincronizador',
      title: 'SINCRONIZADOR',
      icon: FileSpreadsheet,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/15 border-violet-500/30 group-hover:bg-violet-500/25',
      activeIconClass: 'bg-slate-950 text-violet-400',
      roles: ['auxiliar_logistica', 'gestor', 'financeiro']
    },
    {
      id: 'divergencias',
      tabKey: 'divergencias',
      title: 'SOBRAS & FALTAS PA/AG',
      icon: Shield,
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/15 border-orange-500/30 group-hover:bg-orange-500/25',
      activeIconClass: 'bg-slate-950 text-orange-400',
      roles: ['auxiliar_logistica', 'gestor', 'financeiro', 'monitoramento']
    },
    {
      id: 'vales',
      tabKey: 'vales_view',
      title: 'GESTÃO DE VALES',
      icon: FileText,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/15 border-rose-500/30 group-hover:bg-rose-500/25',
      activeIconClass: 'bg-slate-950 text-rose-400',
      badge: pendingValesCount > 0 ? pendingValesCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
      roles: ['auxiliar_logistica', 'gestor', 'financeiro']
    },
    {
      id: 'historico',
      tabKey: 'historico',
      title: 'HISTÓRICO',
      icon: CheckCircle,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/15 border-cyan-500/30 group-hover:bg-cyan-500/25',
      activeIconClass: 'bg-slate-950 text-cyan-400',
      badge: pendingAuditsCount > 0 ? pendingAuditsCount : undefined,
      badgeColor: 'bg-amber-500 text-slate-950',
      roles: ['auxiliar_logistica', 'monitoramento', 'gestor', 'financeiro']
    },
    {
      id: 'efd_historico',
      tabKey: 'efd_histograma',
      title: 'EFD HISTÓRICO',
      icon: Sparkles,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/15 border-indigo-500/30 group-hover:bg-indigo-500/25',
      activeIconClass: 'bg-slate-950 text-indigo-400',
      badge: '100% Meta',
      badgeColor: 'bg-emerald-500 text-slate-950',
      roles: ['gestor', 'auxiliar_logistica']
    },
    {
      id: 'cadastros',
      tabKey: 'cadastros',
      title: 'CADASTROS',
      icon: Settings,
      iconColor: 'text-fuchsia-400',
      iconBg: 'bg-fuchsia-500/15 border-fuchsia-500/30 group-hover:bg-fuchsia-500/25',
      activeIconClass: 'bg-slate-950 text-fuchsia-400',
      roles: ['gestor', 'auxiliar_logistica', 'financeiro']
    },
    {
      id: 'backup',
      tabKey: 'backup',
      title: 'BACKUP DIÁRIO',
      icon: Database,
      iconColor: 'text-blue-300',
      iconBg: 'bg-blue-600/25 border-blue-500/40 group-hover:bg-blue-600/35',
      activeIconClass: 'bg-white text-blue-700',
      isSpecial: true,
      roles: ['auxiliar_logistica', 'gestor', 'financeiro']
    }
  ];

  // Filter items based on user role and optional search
  const visibleItems = useMemo(() => {
    return navItems.filter(item => {
      // Role check
      if (!item.roles.includes(currentUser.role)) return false;
      // Search filter
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase().trim();
        return item.title.toLowerCase().includes(query);
      }
      return true;
    });
  }, [currentUser.role, filterSearch, navItems]);

  return (
    <aside 
      className={`bg-[#0b1324] border-r border-slate-800/90 text-white flex flex-col shrink-0 transition-all duration-300 select-none z-30 ${
        collapsed ? 'w-[72px]' : 'w-[280px]'
      }`}
      id="app_sidebar"
    >
      {/* Sidebar Header: Logo & Collapse Button */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between gap-2 min-h-[64px]">
        {/* Pau Brasil Logo & Brand */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Pau Brasil Circular Badge */}
          <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md p-1 border border-slate-200">
            <span className="font-black text-blue-700 text-lg leading-none font-sans tracking-tighter">P</span>
          </div>

          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="font-black text-sm text-white tracking-wider font-sans leading-tight">
                PAU <span className="text-amber-400">BRASIL</span>
              </span>
              <span className="text-[9px] font-extrabold text-blue-400 tracking-wider uppercase">
                DISTRIBUIDORA <span className="text-white">AMBEV</span>
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 transition-all cursor-pointer shrink-0 shadow-xs"
          title={collapsed ? "Expandir barra lateral" : "Ocultar / Recolher barra lateral"}
          id="sidebar_collapse_toggle_btn"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* User Info Card (Visible when expanded) */}
      {!collapsed && (
        <div className="p-3 border-b border-slate-800/80">
          <div className="bg-[#101b33] rounded-2xl p-3 border border-slate-800 shadow-inner flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {/* Avatar initials circle */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs flex items-center justify-center border-2 border-blue-400 shadow-sm shrink-0">
                {userInitials}
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider leading-none">
                  COLABORADOR
                </div>
                <div className="font-extrabold text-xs text-white truncate mt-0.5" title={currentUser.name}>
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  • {roleLabel}
                </div>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-[10px]">
              <span className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ATIVO
              </span>
              <span className="bg-slate-900 border border-slate-700/70 text-slate-300 px-2 py-0.5 rounded-md font-mono font-bold">
                CDD PB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search Filter (Expanded only) */}
      {!collapsed && (
        <div className="p-3 pb-1">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar guia ou módulo..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full bg-[#101b33] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* Navigation Menu Items List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {visibleItems.map(item => {
          const isActive = 
            item.tabKey === activeTab ||
            (item.tabKey === 'carregamento' && activeTab === 'descarregamento') ||
            (item.tabKey === 'backup' && activeTab === 'exportar');
          const IconComponent = item.icon;

          if (collapsed) {
            // Collapsed View: Icon-only button with larger container, distinctive color badge and tooltip
            return (
              <div key={item.id} className="relative group flex justify-center">
                <button
                  id={`sidebar_nav_collapsed_${item.id}`}
                  onClick={() => setActiveTab(item.tabKey)}
                  className={`relative p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer border ${
                    isActive 
                      ? item.isSpecial
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md ring-2 ring-blue-400/40'
                        : 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/40 font-black'
                      : item.isSpecial
                        ? 'text-blue-300 bg-blue-950/50 border-blue-900/60 hover:text-white hover:bg-blue-900/60'
                        : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/80'
                  }`}
                  title={item.title}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                    isActive 
                      ? item.activeIconClass 
                      : `${item.iconBg} ${item.iconColor}`
                  }`}>
                    <IconComponent className="h-5 w-5 shrink-0" />
                  </div>

                  {item.badge !== undefined && (
                    <span className={`absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full text-[9px] font-mono font-black flex items-center justify-center border border-[#0b1324] ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </div>
            );
          }

          // Expanded View: Symmetrical button matching the original header items with colorful icon badge
          return (
            <button
              key={item.id}
              id={`sidebar_nav_${item.id}`}
              onClick={() => setActiveTab(item.tabKey)}
              className={`w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer border text-xs tracking-wider uppercase font-sans group ${
                isActive
                  ? item.isSpecial
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md font-black scale-[1.01]'
                    : 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-black scale-[1.01]'
                  : item.isSpecial
                    ? 'text-blue-300 bg-blue-950/40 border-blue-900/60 hover:text-white hover:bg-blue-900/60 font-extrabold'
                    : 'text-slate-300 bg-slate-900/30 border-transparent hover:text-white hover:bg-slate-800/80 hover:border-slate-700/60 font-bold'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Colorful larger icon container */}
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 border ${
                  isActive 
                    ? item.activeIconClass 
                    : `${item.iconBg} ${item.iconColor}`
                }`}>
                  <IconComponent className="h-4.5 w-4.5 shrink-0" />
                </div>
                <span className="truncate">{item.title}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black shrink-0 ${
                    isActive ? 'bg-slate-950 text-white' : item.badgeColor
                  }`}>
                    {item.badge}
                  </span>
                )}
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                  isActive 
                    ? item.isSpecial ? 'text-white' : 'text-slate-950 translate-x-0.5' 
                    : 'text-slate-500 group-hover:translate-x-0.5 group-hover:text-slate-300'
                }`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer / Status Indicator */}
      <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
        {!collapsed ? (
          <>
            <span className="font-mono text-slate-500">v2026.09 Ambev</span>
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              Sincronizado
            </span>
          </>
        ) : (
          <div className="mx-auto h-2 w-2 rounded-full bg-emerald-400 animate-ping" title="Sincronizado em tempo real"></div>
        )}
      </div>
    </aside>
  );
}
