import React, { useState, useMemo, useEffect } from 'react';
import { 
  User, 
  Empilhador, 
  CarregamentoProcess, 
  CarregamentoItem, 
  CarregamentoStatus,
  CarregamentoPriority,
  ImportedRoute, 
  AuditSession,
  ReturnForecast,
  FiscalAlert,
  Vehicle, 
  Driver, 
  Product,
  ActiveAsset
} from '../types';
import { 
  Layers, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Search, 
  UserCheck, 
  Play, 
  Pause,
  Check, 
  ArrowRight, 
  MapPin, 
  Boxes, 
  Filter, 
  FileText, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  ChevronRight, 
  Zap, 
  BarChart2, 
  X,
  Printer,
  RefreshCw,
  Phone,
  User as UserIcon,
  PackageCheck,
  Moon,
  Sun,
  Timer,
  CheckCheck,
  AlertCircle,
  HelpCircle,
  Calendar,
  Warehouse,
  Flame,
  TrendingUp,
  Activity,
  HardHat,
  Glasses,
  Headphones,
  Footprints,
  Shield,
  LayoutGrid,
  List,
  Trophy
} from 'lucide-react';
import { isClientFirebaseActive, saveDirectlyToFirestore } from '../clientFirebase';

export interface EmpilhadorViewProps {
  currentUser: User;
  empilhadores: Empilhador[];
  onSaveEmpilhadores: (empilhadores: Empilhador[]) => void;
  carregamentos: CarregamentoProcess[];
  onSaveCarregamentos: (carregamentos: CarregamentoProcess[]) => void;
  importedRoutes?: ImportedRoute[];
  onSaveImportedRoutes?: (routes: ImportedRoute[]) => void;
  audits?: AuditSession[];
  onSaveAudits?: (audits: AuditSession[]) => void;
  returnForecasts?: ReturnForecast[];
  onSaveForecasts?: (forecasts: ReturnForecast[]) => void;
  fiscalAlerts?: FiscalAlert[];
  onSaveAlerts?: (alerts: FiscalAlert[]) => void;
  vehicles?: Vehicle[];
  drivers?: Driver[];
  products?: Product[];
  activeAssets?: ActiveAsset[];
  onNavigateTab?: (tab: string) => void;
}

export const DOCAS_LIST = [
  'DOCA 01',
  'DOCA 02',
  'DOCA 03',
  'DOCA 04',
  'DOCA 05',
  'DOCA 06',
  'DOCA 07',
  'DOCA 08',
  'PATIO EXTERNO'
];

export interface ConnectedVehicle {
  id: string;
  source: 'imported_route' | 'audit' | 'carregamento' | 'forecast';
  routeMap: string;
  plate: string;
  driverName: string;
  driverId?: string;
  vehicleType?: string;
  dock: string;
  empilhadorId?: string;
  empilhadorName?: string;
  forkliftCode?: string;
  routeDate: string; // YYYY-MM-DD
  importedAt?: string;
  
  // Descarregamento tracking
  descarregamentoStatus: 'AGUARDANDO_DESCARGA' | 'EM_DESCARGA' | 'DESCARREGADO' | 'PERNOITE';
  unloadingStartTime?: string; // HH:mm or ISO
  unloadingEndTime?: string; // HH:mm or ISO
  isPernoite: boolean;
  totalPallets: number;
  loadedPallets: number;
  unloadingNote?: string;
  unloadingChecklist?: {
    giro360: boolean;
    calcoSeguranca: boolean;
    aberturaBaias: boolean;
    completedAt: string;
    completedBy: string;
  };
  
  // Conferência and Fiscal Status
  auditStatus?: string;
  conferenteName?: string;
  isBlitz?: boolean;
  
  // Calculated Metrics
  durationMinutes?: number;
  diasCiclo: 'D0' | 'D1' | 'D2' | 'D3' | 'D4+';
  isEfficiencyOnTime: boolean; // Finished until 22:00
  efficiencyPercentage: number;
  
  // Original references
  routeRef?: ImportedRoute;
  auditRef?: AuditSession;
  carregamentoRef?: CarregamentoProcess;
  forecastRef?: ReturnForecast;
}

export default function EmpilhadorView({
  currentUser,
  empilhadores = [],
  onSaveEmpilhadores,
  carregamentos = [],
  onSaveCarregamentos,
  importedRoutes = [],
  onSaveImportedRoutes,
  audits = [],
  onSaveAudits,
  returnForecasts = [],
  onSaveForecasts,
  fiscalAlerts = [],
  onSaveAlerts,
  vehicles = [],
  drivers = [],
  products = [],
  activeAssets = [],
  onNavigateTab
}: EmpilhadorViewProps) {
  const isOperatorOnly = currentUser.role === 'empilhador';
  
  // Sub-tabs navigation
  const [activeSubTab, setActiveSubTab] = useState<
    'descarregamento' | 'indicadores_eficiencia'
  >('descarregamento');

  // View style: Cards vs Table
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'PENDENTES' | 'DESCARREGADOS' | 'PERNOITES'>('PENDENTES');
  const [filterDock, setFilterDock] = useState<string>('TODAS');
  const [filterEmpilhador, setFilterEmpilhador] = useState<string>('TODOS');
  const [filterCiclo, setFilterCiclo] = useState<string>('TODOS');
  const [filterDate, setFilterDate] = useState<string>('');

  // Checklist Modal States (DPO Ambev)
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [checklistVehicle, setChecklistVehicle] = useState<ConnectedVehicle | null>(null);
  const [checkGiro360, setCheckGiro360] = useState(false);
  const [checkCalcoSeguranca, setCheckCalcoSeguranca] = useState(false);
  const [checkAberturaBaias, setCheckAberturaBaias] = useState(false);
  const [checklistStartTime, setChecklistStartTime] = useState('');
  const [checklistPallets, setChecklistPallets] = useState<number>(8);
  const [checklistEmpilhadorId, setChecklistEmpilhadorId] = useState('');
  const [checklistDock, setChecklistDock] = useState('DOCA 01');

  // Add Plate Modal States
  const [showAddPlateModal, setShowAddPlateModal] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newRouteMap, setNewRouteMap] = useState('');
  const [newDriverName, setNewDriverName] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('TRUCK (10 PAL)');
  const [newTotalPallets, setNewTotalPallets] = useState<number>(8);
  const [newDock, setNewDock] = useState('DOCA 01');
  const [newIsBlitz, setNewIsBlitz] = useState(false);

  // Edit Time / Details Modal
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<ConnectedVehicle | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDock, setEditDock] = useState('DOCA 01');
  const [editEmpilhadorId, setEditEmpilhadorId] = useState('');
  const [editIsPernoite, setEditIsPernoite] = useState(false);

  // Operator modal states
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [selectedEmpilhador, setSelectedEmpilhador] = useState<Empilhador | null>(null);
  const [opName, setOpName] = useState('');
  const [opMatricula, setOpMatricula] = useState('');
  const [opShift, setOpShift] = useState<'1_TURNO' | '2_TURNO' | '3_TURNO'>('1_TURNO');
  const [opForkliftCode, setOpForkliftCode] = useState('EMP-01 (Yale 2.5T)');
  const [opStatus, setOpStatus] = useState<'DISPONIVEL' | 'OPERANDO' | 'INTERVALO' | 'MANUTENCAO' | 'OFFLINE'>('DISPONIVEL');
  const [opPhone, setOpPhone] = useState('');

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });
  const confirmCallbackRef = React.useRef<(() => void) | null>(null);
  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    confirmCallbackRef.current = onConfirm;
    setConfirmModal({
      isOpen: true,
      title,
      message,
    });
  };

  // Helper date normalization
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const calculateCiclo = (routeDateStr?: string): 'D0' | 'D1' | 'D2' | 'D3' | 'D4+' => {
    if (!routeDateStr) return 'D0';
    try {
      const rDate = new Date(routeDateStr);
      const today = new Date(todayStr);
      const diffTime = today.getTime() - rDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return 'D0';
      if (diffDays === 1) return 'D1';
      if (diffDays === 2) return 'D2';
      if (diffDays === 3) return 'D3';
      return 'D4+';
    } catch {
      return 'D0';
    }
  };

  // Find Current Operator
  const currentOperator = useMemo(() => {
    return empilhadores.find(
      e => e.id === currentUser.id || 
           (e.matricula && currentUser.username && e.matricula.toLowerCase().trim() === currentUser.username.toLowerCase().trim()) ||
           e.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim() ||
           currentUser.name.toLowerCase().includes(e.name.toLowerCase())
    );
  }, [empilhadores, currentUser]);

  const normalizeMapCode = (m?: string) => {
    if (!m) return '';
    return String(m).replace(/^0+/, '').trim();
  };

  const isRouteClosedInAudits = (routeMap: string) => {
    const norm = normalizeMapCode(routeMap).toUpperCase();
    const upper = (routeMap || '').trim().toUpperCase();
    return audits.some(a => {
      const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
      const aUpper = (a.routeMap || '').trim().toUpperCase();
      const isMatch = aNorm === norm || aUpper === upper ||
        (a.unifiedMaps && a.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === norm || m.trim().toUpperCase() === upper));
      const isFinished = a.status === 'finalizado_ok' || a.status === 'finalizado_divergente' || (a.status as string) === 'fechado' || (a as any).pdfDownloaded === true || (a as any).surplusFlowStatus === 'BAIXADO';
      return isMatch && isFinished && !a.reopeningRequested;
    });
  };

  // UNIFIED CONNECTED FLEET STATE
  const connectedVehicles = useMemo(() => {
    const list: ConnectedVehicle[] = [];
    const seenMapAndPlate = new Set<string>();

    const resolveDriverName = (driverId?: string, fallbackName?: string) => {
      if (!driverId && !fallbackName) return 'Não informado';
      const cleanFallback = fallbackName && fallbackName !== 'Motorista Não Informado' && fallbackName !== 'Não informado' ? fallbackName : '';
      
      if (driverId) {
        const dById = drivers.find(drv => 
          drv.id.toUpperCase() === driverId.toUpperCase() ||
          drv.id.toUpperCase().replace(/^G/, '').replace(/^0+/, '') === driverId.toUpperCase().replace(/^G/, '').replace(/^0+/, '') ||
          (driverId.replace(/\D/g, '') && drv.id.replace(/\D/g, '') === driverId.replace(/\D/g, ''))
        );
        if (dById) return dById.name;
      }

      if (cleanFallback) {
        const dByName = drivers.find(drv => 
          drv.name.toLowerCase().trim() === cleanFallback.toLowerCase().trim() ||
          drv.name.toLowerCase().includes(cleanFallback.toLowerCase()) ||
          cleanFallback.toLowerCase().includes(drv.name.toLowerCase())
        );
        if (dByName) return dByName.name;
      }

      return cleanFallback || driverId || 'Não informado';
    };

    const resolveCapacityPallets = (plateStr?: string) => {
      if (!plateStr) return 8;
      const v = vehicles.find(veh => veh.plate.toUpperCase().trim() === plateStr.toUpperCase().trim());
      return v?.capacityPallets || 8;
    };

    // 1. Process imported routes: include open/pending routes of the day, plus any route unloaded today
    (importedRoutes || []).forEach(r => {
      const routeMapUpper = (r.routeMap || '').toUpperCase();
      const routeMapNorm = normalizeMapCode(r.routeMap).toUpperCase();
      const plateUpper = (r.plate || '').toUpperCase().trim();
      const key = `${routeMapUpper}_${plateUpper}`;

      const matchingAudit = audits.find(a => {
        const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
        if (aNorm === routeMapNorm || (a.routeMap || '').toUpperCase() === routeMapUpper) return true;
        if (a.unifiedMaps) {
          return a.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === routeMapNorm || m.toUpperCase() === routeMapUpper);
        }
        return false;
      });

      const matchingCarregamento = carregamentos.find(c => {
        const cNorm = normalizeMapCode(c.routeMap || '').toUpperCase();
        const cUpper = (c.routeMap || '').toUpperCase();
        return (cNorm && cNorm === routeMapNorm) || (cUpper && cUpper === routeMapUpper);
      });

      const isFinalizedInAudit = matchingAudit && (
        matchingAudit.status === 'finalizado_ok' || 
        matchingAudit.status === 'finalizado_divergente' || 
        (matchingAudit.status as string) === 'fechado' ||
        (matchingAudit as any).pdfDownloaded === true || 
        (matchingAudit as any).surplusFlowStatus === 'BAIXADO'
      );
      const isReopeningReq = matchingAudit?.reopeningRequested === true;
      const isSubmittedToFiscal = matchingAudit && (matchingAudit.status === 'conferido_fisico' || matchingAudit.status === 'recontagem_finalizada');
      const isClosed = (isRouteClosedInAudits(r.routeMap) || (r.status as string) === 'fechado' || isFinalizedInAudit) && !isReopeningReq;

      // Descarregado hoje apenas se houver descarregamento registrado para o retorno de rota
      const isUnloadedToday = !!(
        (r.unloadingEndTime && r.unloadingEndTime.trim().length > 0) || 
        (matchingAudit?.unloadingEndTime && matchingAudit.unloadingEndTime.trim().length > 0) || 
        r.descarregamentoStatus === 'DESCARREGADO' ||
        matchingAudit?.descarregamentoStatus === 'DESCARREGADO'
      );

      // Include if route is open/pending OR if unloaded today
      if ((!isClosed && !isSubmittedToFiscal && (r.status as string) !== 'em_analise') || isReopeningReq || isUnloadedToday) {
        seenMapAndPlate.add(key);

        let descarregamentoStatus: ConnectedVehicle['descarregamentoStatus'] = 'AGUARDANDO_DESCARGA';
        if (r.isPernoite || matchingAudit?.isPernoite || matchingCarregamento?.isPernoite) {
          descarregamentoStatus = 'PERNOITE';
        } else if (isUnloadedToday) {
          descarregamentoStatus = 'DESCARREGADO';
        } else if (r.descarregamentoStatus) {
          descarregamentoStatus = r.descarregamentoStatus;
        } else if (r.unloadingStartTime || matchingAudit?.unloadingStartTime || matchingCarregamento?.status === 'EM_CARREGAMENTO') {
          descarregamentoStatus = 'EM_DESCARGA';
        }

        const startTime = r.unloadingStartTime || matchingAudit?.unloadingStartTime || matchingCarregamento?.startedAt;
        const endTime = r.unloadingEndTime || matchingAudit?.unloadingEndTime || matchingCarregamento?.completedAt;

        let durationMinutes: number | undefined;
        if (startTime && endTime) {
          try {
            const s = new Date(startTime).getTime();
            const e = new Date(endTime).getTime();
            if (!isNaN(s) && !isNaN(e) && e >= s) {
              durationMinutes = Math.round((e - s) / 60000);
            }
          } catch {}
        }

        let isEfficiencyOnTime = true;
        if (endTime) {
          try {
            const d = new Date(endTime);
            if (d.getHours() >= 22) isEfficiencyOnTime = false;
          } catch {}
        } else {
          if (new Date().getHours() >= 22) isEfficiencyOnTime = false;
        }

        const totalPal = r.totalPallets || matchingCarregamento?.totalPallets || resolveCapacityPallets(r.plate);
        const loadedPal = r.loadedPallets || matchingCarregamento?.loadedPallets || (descarregamentoStatus === 'DESCARREGADO' ? totalPal : 0);
        const dock = r.dock || matchingAudit?.dock || matchingCarregamento?.dock || 'DOCA 01';
        const empId = r.empilhadorId || matchingCarregamento?.empilhadorId;
        const empName = r.empilhadorName || matchingCarregamento?.empilhadorName;
        const note = r.unloadingNote || matchingAudit?.unloadingNote || matchingCarregamento?.unloadingNote;

        list.push({
          id: `route_${r.id}`,
          source: 'imported_route',
          routeMap: r.routeMap || '—',
          plate: (r.plate || '').toUpperCase().trim(),
          driverName: resolveDriverName(r.driverId, (r as any).driverName),
          driverId: r.driverId,
          vehicleType: r.vehicleType || matchingCarregamento?.vehicleType || 'TRUCK (10 PAL)',
          dock,
          empilhadorId: empId,
          empilhadorName: empName,
          forkliftCode: matchingCarregamento?.forkliftCode,
          routeDate: r.routeDate || todayStr,
          importedAt: r.importedAt,
          descarregamentoStatus,
          unloadingStartTime: startTime,
          unloadingEndTime: endTime,
          isPernoite: !!(r.isPernoite || matchingAudit?.isPernoite || matchingCarregamento?.isPernoite),
          totalPallets: totalPal,
          loadedPallets: loadedPal,
          unloadingNote: note,
          unloadingChecklist: r.unloadingChecklist || matchingAudit?.unloadingChecklist || matchingCarregamento?.unloadingChecklist,
          auditStatus: matchingAudit?.status || r.status,
          conferenteName: matchingAudit?.conferenteId,
          isBlitz: r.isBlitz,
          durationMinutes,
          diasCiclo: calculateCiclo(r.routeDate),
          isEfficiencyOnTime,
          efficiencyPercentage: isEfficiencyOnTime ? 100 : 80,
          routeRef: r,
          auditRef: matchingAudit,
          carregamentoRef: matchingCarregamento
        });
      }
    });

    // 2. Process active audits or audits unloaded today not already in the list
    (audits || []).forEach(a => {
      const aMapUpper = (a.routeMap || '').toUpperCase().trim();
      const aMapNorm = normalizeMapCode(a.routeMap).toUpperCase();
      const aPlateUpper = (a.plate || '').toUpperCase().trim();
      const key = `${aMapUpper}_${aPlateUpper}`;

      const isReopeningReq = a.reopeningRequested === true;
      const isClosedAudit = (a.status as string) === 'fechado' || a.status === 'finalizado_ok' || a.status === 'finalizado_divergente' || (a as any).pdfDownloaded === true || (a as any).surplusFlowStatus === 'BAIXADO';
      const isAuditActive = (a.status === 'em_aberto' || a.status === 'reconferencia') && !isClosedAudit;
      const isUnloadedToday = !!(a.unloadingEndTime || a.descarregamentoStatus === 'DESCARREGADO');

      // Check if this map exists in imported routes
      const existsInImported = (importedRoutes || []).some(r => {
        const rNorm = normalizeMapCode(r.routeMap).toUpperCase();
        const rUpper = (r.routeMap || '').toUpperCase().trim();
        const rPlate = (r.plate || '').toUpperCase().trim();
        return (rNorm && rNorm === aMapNorm) || (rUpper && rUpper === aMapUpper) || (rPlate && rPlate === aPlateUpper);
      });
      const hasActualCountedData = (a.items && a.items.length > 0) || (a.assets && a.assets.length > 0) || (a.exchanges && a.exchanges.length > 0);
      const isAuditDateRelevant = a.arrivalDate === todayStr || a.isPernoite || isUnloadedToday;

      // If this audit was from a deleted imported route and has no physical items counted, skip it
      if (!existsInImported && !hasActualCountedData && !isUnloadedToday) {
        return;
      }

      if (!seenMapAndPlate.has(key) && (isReopeningReq || (isAuditActive && isAuditDateRelevant) || isUnloadedToday)) {
        seenMapAndPlate.add(key);

        const matchingCarregamento = carregamentos.find(c => {
          const cNorm = normalizeMapCode(c.routeMap || '').toUpperCase();
          const cUpper = (c.routeMap || '').toUpperCase();
          return (cNorm && cNorm === aMapNorm) || (cUpper && cUpper === aMapUpper);
        });

        let descarregamentoStatus: ConnectedVehicle['descarregamentoStatus'] = 'AGUARDANDO_DESCARGA';
        if (a.isPernoite) descarregamentoStatus = 'PERNOITE';
        else if (isUnloadedToday) descarregamentoStatus = 'DESCARREGADO';
        else if (a.descarregamentoStatus) descarregamentoStatus = a.descarregamentoStatus;
        else if (a.unloadingStartTime) descarregamentoStatus = 'EM_DESCARGA';

        const startTime = a.unloadingStartTime || matchingCarregamento?.startedAt;
        const endTime = a.unloadingEndTime || matchingCarregamento?.completedAt;

        let durationMinutes: number | undefined;
        if (startTime && endTime) {
          try {
            const s = new Date(startTime).getTime();
            const e = new Date(endTime).getTime();
            if (!isNaN(s) && !isNaN(e) && e >= s) {
              durationMinutes = Math.round((e - s) / 60000);
            }
          } catch {}
        }

        let isEfficiencyOnTime = true;
        if (endTime) {
          try {
            const d = new Date(endTime);
            if (d.getHours() >= 22) isEfficiencyOnTime = false;
          } catch {}
        }

        const totalPal = a.totalPallets || matchingCarregamento?.totalPallets || resolveCapacityPallets(a.plate);
        const loadedPal = a.loadedPallets || matchingCarregamento?.loadedPallets || (descarregamentoStatus === 'DESCARREGADO' ? totalPal : 0);

        list.push({
          id: `audit_${a.id}`,
          source: 'audit',
          routeMap: a.routeMap || '—',
          plate: (a.plate || '').toUpperCase().trim(),
          driverName: resolveDriverName(a.driverId),
          driverId: a.driverId,
          vehicleType: matchingCarregamento?.vehicleType || 'TRUCK (10 PAL)',
          dock: a.dock || matchingCarregamento?.dock || 'DOCA 01',
          empilhadorId: a.empilhadorId || matchingCarregamento?.empilhadorId,
          empilhadorName: a.empilhadorName || matchingCarregamento?.empilhadorName,
          forkliftCode: matchingCarregamento?.forkliftCode,
          routeDate: a.arrivalDate || todayStr,
          descarregamentoStatus,
          unloadingStartTime: startTime,
          unloadingEndTime: endTime,
          isPernoite: !!a.isPernoite,
          totalPallets: totalPal,
          loadedPallets: loadedPal,
          unloadingNote: a.unloadingNote || matchingCarregamento?.unloadingNote,
          unloadingChecklist: a.unloadingChecklist || matchingCarregamento?.unloadingChecklist,
          auditStatus: a.status,
          conferenteName: a.conferenteId,
          durationMinutes,
          diasCiclo: calculateCiclo(a.arrivalDate),
          isEfficiencyOnTime,
          efficiencyPercentage: isEfficiencyOnTime ? 100 : 80,
          auditRef: a,
          carregamentoRef: matchingCarregamento
        });
      }
    });

    return list;
  }, [importedRoutes, audits, carregamentos, drivers, vehicles, todayStr]);

  // Operational KPI Calculations
  const descarregamentoMetrics = useMemo(() => {
    const totalVehicles = connectedVehicles.length;
    const pernoiteCount = connectedVehicles.filter(v => v.isPernoite || v.descarregamentoStatus === 'PERNOITE').length;

    const descarregadosTotal = connectedVehicles.filter(
      v => !v.isPernoite && v.descarregamentoStatus === 'DESCARREGADO'
    ).length;

    const descarregandoNow = connectedVehicles.filter(
      v => !v.isPernoite && v.descarregamentoStatus === 'EM_DESCARGA'
    ).length;

    const aguardandoCount = connectedVehicles.filter(
      v => !v.isPernoite && v.descarregamentoStatus === 'AGUARDANDO_DESCARGA'
    ).length;

    const eligibleCount = descarregadosTotal + descarregandoNow + aguardandoCount;

    const descarregadosOnTime = connectedVehicles.filter(
      v => !v.isPernoite && v.descarregamentoStatus === 'DESCARREGADO' && v.isEfficiencyOnTime
    ).length;

    const descarregadosLate = connectedVehicles.filter(
      v => !v.isPernoite && v.descarregamentoStatus === 'DESCARREGADO' && !v.isEfficiencyOnTime
    ).length;

    const isPast22 = new Date().getHours() >= 22;

    let overallEfficiency = 100;
    if (eligibleCount > 0) {
      if (!isPast22) {
        const lateCount = descarregadosLate;
        overallEfficiency = Math.max(0, Math.round(((eligibleCount - lateCount) / eligibleCount) * 100));
      } else {
        overallEfficiency = Math.max(0, Math.round((descarregadosOnTime / eligibleCount) * 100));
      }
    }

    const totalPalletsUnloaded = connectedVehicles.reduce((acc, v) => acc + (v.loadedPallets || 0), 0);
    const totalPalletsPlanned = connectedVehicles.reduce((acc, v) => acc + (v.totalPallets || 0), 0);

    return {
      totalVehicles,
      pernoiteCount,
      eligibleCount,
      descarregadosTotal,
      descarregandoNow,
      aguardandoCount,
      descarregadosOnTime,
      descarregadosLate,
      overallEfficiency,
      isPast22,
      totalPalletsUnloaded,
      totalPalletsPlanned,
      pendingCount: aguardandoCount + descarregandoNow
    };
  }, [connectedVehicles]);

  // Filtered Connected Vehicles based on Tab and Search
  const filteredConnectedVehicles = useMemo(() => {
    return connectedVehicles.filter(v => {
      // 1. Search filter
      const matchSearch = 
        !searchTerm ||
        v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.routeMap.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.driverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.empilhadorName && v.empilhadorName.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Primary Tab Category Filter
      let matchTab = true;
      if (filterCategory === 'PENDENTES') {
        matchTab = !v.isPernoite && (v.descarregamentoStatus === 'AGUARDANDO_DESCARGA' || v.descarregamentoStatus === 'EM_DESCARGA');
      } else if (filterCategory === 'DESCARREGADOS') {
        matchTab = !v.isPernoite && v.descarregamentoStatus === 'DESCARREGADO';
      } else if (filterCategory === 'PERNOITES') {
        matchTab = v.isPernoite || v.descarregamentoStatus === 'PERNOITE';
      }

      // 3. Secondary Filters (Empilhador, Ciclo, Date)
      const matchEmp = filterEmpilhador === 'TODOS' || v.empilhadorId === filterEmpilhador;
      const matchCiclo = filterCiclo === 'TODOS' || v.diasCiclo === filterCiclo;
      const matchDate = !filterDate || v.routeDate === filterDate;

      return matchSearch && matchTab && matchEmp && matchCiclo && matchDate;
    });
  }, [connectedVehicles, searchTerm, filterCategory, filterEmpilhador, filterCiclo, filterDate]);

  // Tasks for logged in operator
  const myTasks = useMemo(() => {
    if (!currentOperator) return [];
    return connectedVehicles.filter(
      v => (v.empilhadorId === currentOperator.id || v.empilhadorName?.toLowerCase().includes(currentOperator.name.toLowerCase())) &&
           v.descarregamentoStatus !== 'DESCARREGADO'
    );
  }, [connectedVehicles, currentOperator]);

  // ==========================================
  // CHECKLIST MODAL HANDLERS (DPO AMBEV)
  // ==========================================
  const handleOpenChecklist = (vehicle: ConnectedVehicle) => {
    setChecklistVehicle(vehicle);
    setCheckGiro360(false);
    setCheckCalcoSeguranca(false);
    setCheckAberturaBaias(false);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setChecklistStartTime(`${hh}:${mm}`);
    setChecklistPallets(vehicle.totalPallets || 8);
    const initialEmpId = vehicle.empilhadorId || currentOperator?.id || empilhadores[0]?.id || '';
    setChecklistEmpilhadorId(initialEmpId);
    setChecklistDock(vehicle.dock && vehicle.dock !== 'D0' ? vehicle.dock : 'DOCA 01');
    setShowChecklistModal(true);
  };

  const isChecklistComplete = checkGiro360 && checkCalcoSeguranca && checkAberturaBaias;

  const handleConfirmStartWithChecklist = () => {
    if (!checklistVehicle) return;

    // Guarantee checklist completion
    setCheckGiro360(true);
    setCheckCalcoSeguranca(true);
    setCheckAberturaBaias(true);

    const nowIso = new Date().toISOString();
    const selectedEmp = empilhadores.find(e => e.id === checklistEmpilhadorId) || currentOperator;
    const opName = selectedEmp?.name || currentOperator?.name || currentUser.name;
    const opId = selectedEmp?.id || currentOperator?.id || currentUser.id;
    const dockToUse = checklistDock || (checklistVehicle.dock !== 'D0' ? checklistVehicle.dock : 'DOCA 01');
    const note = `Início com Giro 360º e Trava-rodas (${opName})`;
    const startTimeIso = checklistStartTime ? `${todayStr}T${checklistStartTime}:00.000Z` : nowIso;

    const checklistData = {
      giro360: true,
      calcoSeguranca: true,
      aberturaBaias: true,
      completedAt: nowIso,
      completedBy: opName
    };

    // 1. Update importedRoutes
    let updatedRoutes = importedRoutes;
    if (importedRoutes.length > 0) {
      updatedRoutes = importedRoutes.map(r => {
        if (
          (r.routeMap && r.routeMap.toUpperCase() === checklistVehicle.routeMap.toUpperCase()) ||
          (r.plate && r.plate.toUpperCase() === checklistVehicle.plate.toUpperCase())
        ) {
          return {
            ...r,
            descarregamentoStatus: 'EM_DESCARGA' as const,
            unloadingStartTime: startTimeIso,
            dock: dockToUse,
            empilhadorId: opId,
            empilhadorName: opName,
            isPernoite: false,
            totalPallets: checklistPallets,
            unloadingNote: note,
            unloadingChecklist: checklistData
          };
        }
        return r;
      });
      if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);
    }

    // 2. Update audits
    let updatedAudits = audits;
    if (audits.length > 0) {
      updatedAudits = audits.map(a => {
        if (
          (a.routeMap && a.routeMap.toUpperCase() === checklistVehicle.routeMap.toUpperCase()) ||
          (a.plate && a.plate.toUpperCase() === checklistVehicle.plate.toUpperCase())
        ) {
          return {
            ...a,
            descarregamentoStatus: 'EM_DESCARGA' as const,
            unloadingStartTime: startTimeIso,
            dock: dockToUse,
            empilhadorId: opId,
            empilhadorName: opName,
            isPernoite: false,
            totalPallets: checklistPallets,
            unloadingNote: note,
            unloadingChecklist: checklistData
          };
        }
        return a;
      });
      if (onSaveAudits) onSaveAudits(updatedAudits);
    }

    // 3. Update or create CarregamentoProcess
    const existingProc = carregamentos.find(c => 
      (c.routeMap && c.routeMap.toUpperCase() === checklistVehicle.routeMap.toUpperCase()) ||
      (c.plate && c.plate.toUpperCase() === checklistVehicle.plate.toUpperCase())
    );

    let updatedCarregamentos = carregamentos;
    if (existingProc) {
      updatedCarregamentos = carregamentos.map(c => {
        if (c.id === existingProc.id) {
          return {
            ...c,
            status: 'EM_CARREGAMENTO' as const,
            startedAt: startTimeIso,
            unloadingStartTime: startTimeIso,
            dock: dockToUse,
            empilhadorId: opId,
            empilhadorName: opName,
            forkliftCode: currentOperator?.forkliftCode || 'EMP-01',
            isPernoite: false,
            totalPallets: checklistPallets,
            unloadingNote: note,
            unloadingChecklist: checklistData
          };
        }
        return c;
      });
      onSaveCarregamentos(updatedCarregamentos);
    } else {
      const newProc: CarregamentoProcess = {
        id: `proc_descarrega_${Date.now()}`,
        processNumber: `DESCARGA-${checklistVehicle.routeMap || checklistVehicle.plate}`,
        routeMap: checklistVehicle.routeMap,
        plate: checklistVehicle.plate,
        driverName: checklistVehicle.driverName,
        vehicleType: checklistVehicle.vehicleType || 'TRUCK (10 PAL)',
        dock: dockToUse,
        empilhadorId: opId,
        empilhadorName: opName,
        forkliftCode: currentOperator?.forkliftCode || 'EMP-01',
        shift: currentOperator?.shift || '1_TURNO',
        priority: 'MEDIA',
        cargoCategory: 'RETORNAVEL',
        status: 'EM_CARREGAMENTO',
        totalPallets: checklistPallets,
        loadedPallets: 0,
        createdAt: nowIso,
        startedAt: startTimeIso,
        isPernoite: false,
        unloadingStartTime: startTimeIso,
        unloadingNote: note,
        unloadingChecklist: checklistData
      };
      updatedCarregamentos = [newProc, ...carregamentos];
      onSaveCarregamentos(updatedCarregamentos);
    }

    // 4. Update Operator Status
    if (opId) {
      const updatedOps = empilhadores.map(op => {
        if (op.id === opId) {
          return {
            ...op,
            status: 'OPERANDO' as const,
            activeTaskId: checklistVehicle.id
          };
        }
        return op;
      });
      onSaveEmpilhadores(updatedOps);
    }

    // 5. Direct Firestore synchronization
    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        carregamentoProcesses: updatedCarregamentos
      }).catch(err => console.error('Error syncing checklist start:', err));
    }

    setShowChecklistModal(false);
    setChecklistVehicle(null);
  };

  // HANDLER: FINALIZAR DESCARREGAMENTO
  const handleFinishDescarregamento = (vehicle: ConnectedVehicle) => {
    const nowIso = new Date().toISOString();

    // 1. Update importedRoutes
    let updatedRoutes = importedRoutes;
    if (importedRoutes.length > 0) {
      updatedRoutes = importedRoutes.map(r => {
        if (
          (r.routeMap && r.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
          (r.plate && r.plate.toUpperCase() === vehicle.plate.toUpperCase())
        ) {
          return {
            ...r,
            descarregamentoStatus: 'DESCARREGADO' as const,
            unloadingEndTime: nowIso,
            loadedPallets: r.totalPallets || vehicle.totalPallets || 8
          };
        }
        return r;
      });
      if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);
    }

    // 2. Update audits
    let updatedAudits = audits;
    if (audits.length > 0) {
      updatedAudits = audits.map(a => {
        if (
          (a.routeMap && a.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
          (a.plate && a.plate.toUpperCase() === vehicle.plate.toUpperCase())
        ) {
          return {
            ...a,
            descarregamentoStatus: 'DESCARREGADO' as const,
            unloadingEndTime: nowIso,
            loadedPallets: a.totalPallets || vehicle.totalPallets || 8
          };
        }
        return a;
      });
      if (onSaveAudits) onSaveAudits(updatedAudits);
    }

    // 3. Update carregamentos
    const existingProc = carregamentos.find(c => 
      (c.routeMap && c.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
      (c.plate && c.plate.toUpperCase() === vehicle.plate.toUpperCase())
    );

    let updatedCarregamentos = carregamentos;
    if (existingProc) {
      updatedCarregamentos = carregamentos.map(c => {
        if (c.id === existingProc.id) {
          return {
            ...c,
            status: 'CONCLUIDO' as const,
            completedAt: nowIso,
            loadedPallets: c.totalPallets,
            unloadingEndTime: nowIso
          };
        }
        return c;
      });
      onSaveCarregamentos(updatedCarregamentos);
    }

    // 4. Update Operator status
    if (vehicle.empilhadorId) {
      const updatedOps = empilhadores.map(op => {
        if (op.id === vehicle.empilhadorId) {
          return {
            ...op,
            status: 'DISPONIVEL' as const,
            activeTaskId: undefined,
            totalPalletsLoadedToday: (op.totalPalletsLoadedToday || 0) + (vehicle.totalPallets || 8)
          };
        }
        return op;
      });
      onSaveEmpilhadores(updatedOps);
    }

    // 5. Sync Firestore
    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        carregamentoProcesses: updatedCarregamentos
      }).catch(err => console.error('Error syncing finished unloading:', err));
    }
  };

  // HANDLER: TOGGLE PERNOITE
  const handleTogglePernoite = (vehicle: ConnectedVehicle) => {
    const nextPernoite = !vehicle.isPernoite;

    // 1. Update importedRoutes
    let updatedRoutes = importedRoutes;
    if (importedRoutes.length > 0) {
      updatedRoutes = importedRoutes.map(r => {
        if (
          (r.routeMap && r.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
          (r.plate && r.plate.toUpperCase() === vehicle.plate.toUpperCase())
        ) {
          return {
            ...r,
            isPernoite: nextPernoite,
            descarregamentoStatus: (nextPernoite ? 'PERNOITE' : (r.unloadingEndTime ? 'DESCARREGADO' : 'AGUARDANDO_DESCARGA')) as any
          };
        }
        return r;
      });
      if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);
    }

    // 2. Update audits
    let updatedAudits = audits;
    if (audits.length > 0) {
      updatedAudits = audits.map(a => {
        if (
          (a.routeMap && a.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
          (a.plate && a.plate.toUpperCase() === vehicle.plate.toUpperCase())
        ) {
          return {
            ...a,
            isPernoite: nextPernoite,
            descarregamentoStatus: (nextPernoite ? 'PERNOITE' : (a.unloadingEndTime ? 'DESCARREGADO' : 'AGUARDANDO_DESCARGA')) as any
          };
        }
        return a;
      });
      if (onSaveAudits) onSaveAudits(updatedAudits);
    }

    // 3. Update forecasts
    if (onSaveForecasts && returnForecasts.length > 0) {
      const updatedForecasts = returnForecasts.map(f => {
        if (
          (f.routeMap && f.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
          (f.plate && f.plate.toUpperCase() === vehicle.plate.toUpperCase())
        ) {
          return {
            ...f,
            tripStatus: (nextPernoite ? 'pernoitam' : 'retornam') as 'pernoitam' | 'retornam'
          };
        }
        return f;
      });
      onSaveForecasts(updatedForecasts);
    }

    // 4. Update carregamentos
    const updatedCarregamentos = carregamentos.map(c => {
      if (
        (c.routeMap && c.routeMap.toUpperCase() === vehicle.routeMap.toUpperCase()) ||
        (c.plate && c.plate.toUpperCase() === vehicle.plate.toUpperCase())
      ) {
        return {
          ...c,
          isPernoite: nextPernoite
        };
      }
      return c;
    });
    onSaveCarregamentos(updatedCarregamentos);

    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        carregamentoProcesses: updatedCarregamentos
      }).catch(err => console.error('Error syncing pernoite:', err));
    }
  };

  // HANDLER: ADD NEW PLATE MANUALLY
  const handleAddNewPlate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;

    const formattedPlate = newPlate.toUpperCase().trim();
    const mapNum = newRouteMap.trim() || `${Math.floor(10000 + Math.random() * 90000)}`;
    const driver = newDriverName.trim() || 'Não informado';
    const nowIso = new Date().toISOString();

    const newRoute: ImportedRoute = {
      id: `manual_route_${Date.now()}`,
      routeMap: mapNum,
      plate: formattedPlate,
      driverId: driver,
      driverName: driver,
      routeDate: todayStr,
      status: 'pendente',
      importedAt: nowIso,
      itemsCount: 0,
      totalPallets: newTotalPallets || 8,
      loadedPallets: 0,
      dock: newDock || 'D0',
      vehicleType: newVehicleType,
      isBlitz: newIsBlitz,
      descarregamentoStatus: 'AGUARDANDO_DESCARGA',
      isPernoite: false
    };

    const updatedRoutes = [newRoute, ...importedRoutes];
    if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);

    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({ importedRoutes: updatedRoutes }).catch(err => console.error('Error saving new plate:', err));
    }

    setShowAddPlateModal(false);
    setNewPlate('');
    setNewRouteMap('');
    setNewDriverName('');
    setNewTotalPallets(8);
    setNewIsBlitz(false);
  };

  // Open Edit Times Modal
  const handleOpenEditTimes = (vehicle: ConnectedVehicle) => {
    setSelectedVehicle(vehicle);
    setEditStartTime(
      vehicle.unloadingStartTime 
        ? (vehicle.unloadingStartTime.includes('T') ? vehicle.unloadingStartTime.substring(11, 16) : vehicle.unloadingStartTime)
        : '10:59'
    );
    setEditEndTime(
      vehicle.unloadingEndTime 
        ? (vehicle.unloadingEndTime.includes('T') ? vehicle.unloadingEndTime.substring(11, 16) : vehicle.unloadingEndTime)
        : '11:25'
    );
    setEditDock(vehicle.dock || 'DOCA 01');
    setEditEmpilhadorId(vehicle.empilhadorId || '');
    setEditIsPernoite(vehicle.isPernoite || false);
    setShowEditTimeModal(true);
  };

  const handleSaveEditedTimes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;

    const op = empilhadores.find(o => o.id === editEmpilhadorId);
    const startIso = editStartTime ? `${todayStr}T${editStartTime}:00.000Z` : undefined;
    const endIso = editEndTime ? `${todayStr}T${editEndTime}:00.000Z` : undefined;
    const statusVal: ConnectedVehicle['descarregamentoStatus'] = editIsPernoite 
      ? 'PERNOITE' 
      : (endIso ? 'DESCARREGADO' : (startIso ? 'EM_DESCARGA' : 'AGUARDANDO_DESCARGA'));

    // Update routes
    let updatedRoutes = importedRoutes;
    if (importedRoutes.length > 0) {
      updatedRoutes = importedRoutes.map(r => {
        if (
          (r.routeMap && r.routeMap.toUpperCase() === selectedVehicle.routeMap.toUpperCase()) ||
          (r.plate && r.plate.toUpperCase() === selectedVehicle.plate.toUpperCase())
        ) {
          return {
            ...r,
            dock: editDock,
            empilhadorId: editEmpilhadorId || undefined,
            empilhadorName: op?.name,
            unloadingStartTime: startIso,
            unloadingEndTime: endIso,
            isPernoite: editIsPernoite,
            descarregamentoStatus: statusVal
          };
        }
        return r;
      });
      if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);
    }

    // Update audits
    let updatedAudits = audits;
    if (audits.length > 0) {
      updatedAudits = audits.map(a => {
        if (
          (a.routeMap && a.routeMap.toUpperCase() === selectedVehicle.routeMap.toUpperCase()) ||
          (a.plate && a.plate.toUpperCase() === selectedVehicle.plate.toUpperCase())
        ) {
          return {
            ...a,
            dock: editDock,
            empilhadorId: editEmpilhadorId || undefined,
            empilhadorName: op?.name,
            unloadingStartTime: startIso,
            unloadingEndTime: endIso,
            isPernoite: editIsPernoite,
            descarregamentoStatus: statusVal
          };
        }
        return a;
      });
      if (onSaveAudits) onSaveAudits(updatedAudits);
    }

    // Update carregamentos
    const updatedCarreg = carregamentos.map(c => {
      if (
        (c.routeMap && c.routeMap.toUpperCase() === selectedVehicle.routeMap.toUpperCase()) ||
        (c.plate && c.plate.toUpperCase() === selectedVehicle.plate.toUpperCase())
      ) {
        return {
          ...c,
          dock: editDock,
          empilhadorId: editEmpilhadorId || undefined,
          empilhadorName: op?.name,
          forkliftCode: op?.forkliftCode,
          startedAt: startIso,
          completedAt: endIso,
          isPernoite: editIsPernoite,
          status: (endIso ? 'CONCLUIDO' : (startIso ? 'EM_CARREGAMENTO' : 'FILA')) as any
        };
      }
      return c;
    });
    onSaveCarregamentos(updatedCarreg);

    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        carregamentoProcesses: updatedCarreg
      }).catch(err => console.error('Error updating times:', err));
    }

    setShowEditTimeModal(false);
    setSelectedVehicle(null);
  };

  // DELETE VEHICLE FROM UNLOADING QUEUE
  const handleDeleteVehicleFromQueue = (vehicle: ConnectedVehicle) => {
    requestConfirm(
      "❌ Excluir da Fila de Descarregamento?",
      `Tem certeza que deseja remover o mapa ${vehicle.routeMap} (${vehicle.plate}) da fila de descarregamento? Todos os registros vinculados de descarregamento e rota serão excluídos.`,
      () => {
        const vMapNorm = normalizeMapCode(vehicle.routeMap).toUpperCase();
        const vMapUpper = (vehicle.routeMap || '').toUpperCase().trim();
        const vPlateUpper = (vehicle.plate || '').toUpperCase().trim();

        // 1. Remove from importedRoutes
        const updatedRoutes = (importedRoutes || []).filter(r => {
          const rNorm = normalizeMapCode(r.routeMap).toUpperCase();
          const rUpper = (r.routeMap || '').toUpperCase().trim();
          const rPlate = (r.plate || '').toUpperCase().trim();
          const isMatch = (vMapNorm && rNorm === vMapNorm) || (vMapUpper && rUpper === vMapUpper) || (vPlateUpper && rPlate === vPlateUpper);
          return !isMatch;
        });
        if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);

        // 2. Remove from audits
        const updatedAudits = (audits || []).filter(a => {
          const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
          const aUpper = (a.routeMap || '').toUpperCase().trim();
          const aPlate = (a.plate || '').toUpperCase().trim();
          const isMatch = (vMapNorm && aNorm === vMapNorm) || (vMapUpper && aUpper === vMapUpper) || (vPlateUpper && aPlate === vPlateUpper);
          return !isMatch;
        });
        if (onSaveAudits) onSaveAudits(updatedAudits);

        // 3. Remove from carregamentos
        const updatedCarreg = (carregamentos || []).filter(c => {
          const cNorm = normalizeMapCode(c.routeMap).toUpperCase();
          const cUpper = (c.routeMap || '').toUpperCase().trim();
          const cPlate = (c.plate || '').toUpperCase().trim();
          const isMatch = (vMapNorm && cNorm === vMapNorm) || (vMapUpper && cUpper === vMapUpper) || (vPlateUpper && cPlate === vPlateUpper);
          return !isMatch;
        });
        if (onSaveCarregamentos) onSaveCarregamentos(updatedCarreg);

        // 4. Direct Firestore sync
        if (isClientFirebaseActive()) {
          saveDirectlyToFirestore({
            importedRoutes: updatedRoutes,
            audits: updatedAudits,
            carregamentos: updatedCarreg,
            carregamentoProcesses: updatedCarreg
          }).catch(err => console.error('Error deleting from queue:', err));
        }

        alert(`Mapa ${vehicle.routeMap} (${vehicle.plate}) removido da fila de descarregamento com sucesso.`);
      }
    );
  };

  // Operator Handlers
  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName) return;

    if (selectedEmpilhador) {
      const updated = empilhadores.map(op => {
        if (op.id === selectedEmpilhador.id) {
          return {
            ...op,
            name: opName,
            matricula: opMatricula || op.matricula,
            shift: opShift,
            forkliftCode: opForkliftCode,
            status: opStatus,
            phone: opPhone
          };
        }
        return op;
      });
      onSaveEmpilhadores(updated);
    } else {
      const newOp: Empilhador = {
        id: `emp_${Date.now()}`,
        name: opName,
        matricula: opMatricula || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        shift: opShift,
        forkliftCode: opForkliftCode,
        status: opStatus,
        totalPalletsLoadedToday: 0,
        phone: opPhone
      };
      onSaveEmpilhadores([...empilhadores, newOp]);
    }

    setShowOperatorModal(false);
    setSelectedEmpilhador(null);
    setOpName('');
    setOpMatricula('');
    setOpPhone('');
  };

  const handleDeleteOperator = (opId: string) => {
    if (window.confirm('Deseja excluir este operador do cadastro?')) {
      const updated = empilhadores.filter(o => o.id !== opId);
      onSaveEmpilhadores(updated);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 font-sans space-y-4" id="empilhador_workspace">
      
      {/* 1. TOP HEADER BANNER (Centralizado e Organizado) */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col items-center text-center justify-center space-y-3.5" id="empilhador_header_banner">
        <div className="flex flex-col items-center justify-center space-y-2 max-w-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
            <Truck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center space-x-2 flex-wrap gap-y-1">
              <h1 className="text-base sm:text-lg md:text-xl font-black text-white uppercase tracking-tight">
                OPERAÇÃO DE EMPILHADEIRA & DESCARREGAMENTO
              </h1>
              <span className="text-[10px] font-mono uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded font-black tracking-wider">
                EMPILHADOR
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Giro 360°, Calço de segurança, Abertura de baias e Descarregamento de paletes na Red Zone
            </p>
          </div>
        </div>

        {/* Action Controls: Centralizados e Simétricos (Usuário Ativo e Adicionar Placa) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full pt-1">
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-center space-x-2 text-xs text-slate-300 font-bold shadow-inner">
            <UserIcon className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="truncate max-w-[240px] uppercase font-mono">{currentUser.name}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowAddPlateModal(true)}
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md hover:shadow-lg"
            id="btn_adicionar_placa"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>ADICIONAR PLACA</span>
          </button>
        </div>
      </div>

      {/* 2. DPO AMBEV SAFETY & VEHICLE MANEUVER BANNER */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0" />
            <span className="text-xs font-black text-white uppercase tracking-wide">
              DIRETRIZES DE SEGURANÇA & MANOBRA DE VEÍCULOS (DPO AMBEV)
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 rounded font-bold uppercase">
              PROCEDIMENTO PADRÃO
            </span>
          </div>
          <p className="text-xxs md:text-xs text-slate-300 leading-relaxed">
            <strong className="text-amber-400">DIRETRIZ DE LOGÍSTICA:</strong> Após o descarregamento completo na Red Zone e retirada do calço de segurança, <strong className="text-white">É O MOTORISTA QUEM MANOBRA O VEÍCULO</strong> para o bolsão de estacionamento. O operador de empilhadeira é proibido de manobrar caminhões.
          </p>
        </div>

        {/* 6 PPE/EPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5 w-full lg:w-auto shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>⛑️</span>
            <span>Capacete</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>👓</span>
            <span>Óculos</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>🎧</span>
            <span>Protetor</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>🧤</span>
            <span>Luvas</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>🥾</span>
            <span>Calçado</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 flex items-center space-x-1 text-[10px] text-slate-300 font-bold whitespace-nowrap">
            <span>🦺</span>
            <span>Colete</span>
          </div>
        </div>
      </div>

      {/* 3. PRIMARY FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
        {/* Status Category Tabs: Symmetrical 3-column layout fitting on screen without horizontal scroll */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setFilterCategory('PENDENTES')}
            className={`w-full py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
              filterCategory === 'PENDENTES'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">PENDENTES ({descarregamentoMetrics.pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory('DESCARREGADOS')}
            className={`w-full py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
              filterCategory === 'DESCARREGADOS'
                ? 'bg-emerald-600 text-white shadow-md font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              <span className="hidden sm:inline">DESCARREGADOS </span>HOJE ({descarregamentoMetrics.descarregadosTotal})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterCategory('PERNOITES')}
            className={`w-full py-2 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer text-center ${
              filterCategory === 'PERNOITES'
                ? 'bg-purple-600 text-white shadow-md font-black'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            <Moon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">PERNOITES ({descarregamentoMetrics.pernoiteCount})</span>
          </button>
        </div>

        {/* Search Input & View Toggle */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar placa, mapa ou motorista..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-0.5 flex items-center space-x-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cards' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Cartões"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Visualização em Tabela"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. 5 SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Aguardando / Pendentes */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider">AGUARDANDO / PENDENTES</span>
            <Clock className="h-3.5 w-3.5" />
          </div>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
            {descarregamentoMetrics.aguardandoCount}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Na fila de descarregamento</span>
        </div>

        {/* Card 2: Descarregados Hoje */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider">DESCARREGADOS HOJE</span>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-2xl font-black text-emerald-400 font-mono mt-1 block">
            {descarregamentoMetrics.descarregadosTotal}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Liberados para conferência</span>
        </div>

        {/* Card 3: Pernoites */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-[10px] font-black uppercase tracking-wider">PERNOITES</span>
            <Moon className="h-3.5 w-3.5" />
          </div>
          <span className="text-2xl font-black text-purple-400 font-mono mt-1 block">
            {descarregamentoMetrics.pernoiteCount}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Dormindo no pátio</span>
        </div>

        {/* Card 4: Paletes Movimentados */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-[10px] font-black uppercase tracking-wider">PALETES MOVIMENTADOS</span>
            <Boxes className="h-3.5 w-3.5" />
          </div>
          <span className="text-2xl font-black text-blue-400 font-mono mt-1 block">
            {descarregamentoMetrics.totalPalletsUnloaded}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Volume físico hoje</span>
        </div>

        {/* Card 5: Meta EFD */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[10px] font-black uppercase tracking-wider">META EFD (&lt; 22:00)</span>
            <Truck className="h-3.5 w-3.5" />
          </div>
          <span className="text-2xl font-black text-amber-400 font-mono mt-1 block">
            {descarregamentoMetrics.overallEfficiency}%
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Eficiência de descarga</span>
        </div>
      </div>

      {/* SUB-TABS SELECTOR: Symmetrical 2-column layout fitted to screen without sideways scrolling */}
      <div className="grid grid-cols-2 gap-2 border-b border-slate-800 pb-2.5 w-full">
        <button
          type="button"
          onClick={() => setActiveSubTab('descarregamento')}
          className={`w-full py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer text-center ${
            activeSubTab === 'descarregamento'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80 bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Truck className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">Fila de </span>Descarregamento ({descarregamentoMetrics.pendingCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('indicadores_eficiencia')}
          className={`w-full py-2.5 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer text-center ${
            activeSubTab === 'indicadores_eficiencia'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/80 bg-slate-900/60 border border-slate-800'
          }`}
        >
          <BarChart2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            Eficiência<span className="hidden sm:inline"> & Ciclos</span> ({descarregamentoMetrics.overallEfficiency}%)
          </span>
        </button>
      </div>

      {/* VIEW 1: FILA DE DESCARREGAMENTO (CARDS OR TABLE) */}
      {activeSubTab === 'descarregamento' && (
        <div className="space-y-4">
          {filteredConnectedVehicles.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              <Truck className="h-12 w-12 mx-auto opacity-30 mb-3" />
              <p className="font-bold text-slate-300 text-sm">Nenhum veículo localizado nesta categoria.</p>
              <p className="text-xs text-slate-500 mt-1">
                Adicione uma placa com o botão "+ ADICIONAR PLACA" ou aguarde a chegada das rotas importadas.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            /* CARDS GRID VIEW (Matching User Screenshots) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredConnectedVehicles.map(v => {
                const isUnloaded = v.descarregamentoStatus === 'DESCARREGADO';
                const isUnloading = v.descarregamentoStatus === 'EM_DESCARGA';

                return (
                  <div 
                    key={v.id} 
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    {/* Card Header Row */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      {/* Black plate pill with yellow bold text and pencil icon */}
                      <div 
                        onClick={() => handleOpenEditTimes(v)}
                        className="bg-slate-950 text-amber-400 font-mono font-black text-xs px-2.5 py-1 rounded-lg flex items-center space-x-1.5 cursor-pointer hover:bg-slate-900 shadow-xs"
                        title="Editar placa e dados"
                      >
                        <span>{v.plate}</span>
                        <Edit3 className="h-3 w-3 text-slate-400" />
                      </div>

                      {/* Doca / Ciclo Pill */}
                      <div className="bg-slate-100 text-slate-600 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md flex items-center space-x-1 border border-slate-200">
                        <Clock className="h-2.5 w-2.5 text-slate-400" />
                        <span>{v.dock || v.diasCiclo || 'D0'}</span>
                      </div>

                      {/* Pallets Pill */}
                      <div className="bg-slate-100 text-slate-600 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md border border-slate-200">
                        <span>{v.totalPallets} Paletes</span>
                      </div>

                      {/* Status badge */}
                      {v.isPernoite ? (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-purple-200 flex items-center space-x-1">
                          <Moon className="h-2.5 w-2.5 text-purple-600" />
                          <span>Pernoite</span>
                        </span>
                      ) : isUnloading ? (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200 flex items-center space-x-1 animate-pulse">
                          <Play className="h-2.5 w-2.5 text-blue-600 fill-blue-600" />
                          <span>Descarregando</span>
                        </span>
                      ) : isUnloaded ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1">
                          <Check className="h-2.5 w-2.5 text-emerald-600" />
                          <span>Descarregado</span>
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-300 flex items-center space-x-1">
                          <Clock className="h-2.5 w-2.5 text-amber-600" />
                          <span>Aguardando</span>
                        </span>
                      )}

                      {v.isBlitz && (
                        <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded flex items-center space-x-0.5 shadow-xs">
                          <Flame className="h-2.5 w-2.5 fill-white" />
                          <span>BLITZ</span>
                        </span>
                      )}
                    </div>

                    {/* Card Body Information */}
                    <div className="space-y-1 text-xs text-slate-700">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500 text-[11px]">Mapa de Rota:</span>
                        <span className="font-extrabold text-slate-900 font-mono">{v.routeMap}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500 text-[11px]">Motorista:</span>
                        <span className="font-bold text-slate-800 truncate max-w-[160px]">{v.driverName}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500 text-[11px]">Empilhador:</span>
                        <span className="font-extrabold text-amber-600 uppercase tracking-tight truncate max-w-[160px]">
                          {v.empilhadorName || (isUnloading || isUnloaded ? currentUser.name : 'Não informado')}
                        </span>
                      </div>
                    </div>

                    {/* Alert for Blitz */}
                    {v.isBlitz && (
                      <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-[11px] text-rose-800 font-bold flex items-start space-x-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>VEÍCULO EM BLITZ: Levar todas as caixas de vasilhame para a Área de Aferição de Refugo!</span>
                      </div>
                    )}

                    {/* Times info grey box */}
                    <div className="bg-slate-50 rounded-xl border border-slate-100 p-2.5 text-xxs font-mono space-y-1">
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Início:</span>
                        <span className="font-bold text-slate-800">
                          {v.unloadingStartTime ? `${v.unloadingStartTime.includes('T') ? v.unloadingStartTime.substring(11, 16) : v.unloadingStartTime} hrs` : '---'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Término:</span>
                        <span className="font-bold text-slate-800">
                          {v.unloadingEndTime ? `${v.unloadingEndTime.includes('T') ? v.unloadingEndTime.substring(11, 16) : v.unloadingEndTime} hrs` : '---'}
                        </span>
                      </div>
                    </div>

                    {/* Operational Checklist Note Box (When started with checklist) */}
                    {v.unloadingNote && (
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2 text-[10px] text-amber-900 italic">
                        "{v.unloadingNote}"
                      </div>
                    )}

                    {/* Card Bottom Buttons */}
                    <div className="flex items-center space-x-2 pt-1">
                      {!isUnloaded && !isUnloading && (
                        <button
                          type="button"
                          onClick={() => handleOpenChecklist(v)}
                          className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm hover:shadow active:scale-98"
                        >
                          <Play className="h-3.5 w-3.5 fill-slate-950" />
                          <span>Iniciar Descarregamento</span>
                        </button>
                      )}

                      {isUnloading && (
                        <button
                          type="button"
                          onClick={() => handleFinishDescarregamento(v)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm hover:shadow active:scale-98"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Finalizar Descarregamento</span>
                        </button>
                      )}

                      {isUnloaded && (
                        <div className="flex-1 bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-1.5 text-center">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Descarregado</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditTimes(v)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer border border-slate-200 shrink-0"
                        title="Editar horários e detalhes"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteVehicleFromQueue(v)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all cursor-pointer border border-red-200 shrink-0"
                        title="Excluir este mapa da Fila de Descarregamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE VIEW */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-xxs font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Placa / Veículo</th>
                      <th className="py-3 px-4">Mapa / Motorista</th>
                      <th className="py-3 px-4">Doca / Operador</th>
                      <th className="py-3 px-4">Horário Descarga</th>
                      <th className="py-3 px-4">Status Descarga</th>
                      <th className="py-3 px-4">Pernoite?</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium">
                    {filteredConnectedVehicles.map(v => {
                      const isUnloaded = v.descarregamentoStatus === 'DESCARREGADO';
                      const isUnloading = v.descarregamentoStatus === 'EM_DESCARGA';

                      return (
                        <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-black text-amber-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                              {v.plate}
                            </span>
                            {v.isBlitz && (
                              <span className="ml-1.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                                BLITZ
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-white">{v.routeMap}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{v.driverName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-200">{v.dock}</div>
                            <div className="text-[10px] text-amber-400 font-bold truncate max-w-[140px]">
                              {v.empilhadorName || 'Não atribuído'}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xxs">
                            <div>Início: {v.unloadingStartTime ? v.unloadingStartTime.substring(11, 16) || v.unloadingStartTime : '---'}</div>
                            <div>Fim: {v.unloadingEndTime ? v.unloadingEndTime.substring(11, 16) || v.unloadingEndTime : '---'}</div>
                          </td>
                          <td className="py-3 px-4">
                            {v.isPernoite ? (
                              <span className="bg-purple-900/50 text-purple-300 border border-purple-700 text-xxs font-bold px-2 py-0.5 rounded">Pernoite</span>
                            ) : isUnloading ? (
                              <span className="bg-blue-900/50 text-blue-300 border border-blue-700 text-xxs font-bold px-2 py-0.5 rounded animate-pulse">Em Descarga</span>
                            ) : isUnloaded ? (
                              <span className="bg-emerald-900/50 text-emerald-300 border border-emerald-700 text-xxs font-bold px-2 py-0.5 rounded">Descarregado</span>
                            ) : (
                              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xxs font-bold px-2 py-0.5 rounded">Aguardando</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => handleTogglePernoite(v)}
                              className={`px-2 py-0.5 rounded text-xxs font-black transition ${
                                v.isPernoite ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {v.isPernoite ? 'Sim' : 'Não'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {!isUnloaded && !isUnloading && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenChecklist(v)}
                                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xxs px-2.5 py-1.5 rounded-lg flex items-center space-x-1"
                                >
                                  <Play className="h-3 w-3" />
                                  <span>Iniciar</span>
                                </button>
                              )}
                              {isUnloading && (
                                <button
                                  type="button"
                                  onClick={() => handleFinishDescarregamento(v)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xxs px-2.5 py-1.5 rounded-lg flex items-center space-x-1"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Finalizar</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenEditTimes(v)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                                title="Editar horários e detalhes"
                              >
                                <Edit3 className="h-3 w-3 text-amber-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteVehicleFromQueue(v)}
                                className="p-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 rounded-lg border border-red-800/40 cursor-pointer"
                                title="Excluir este mapa da Fila"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: EFICIÊNCIA & CICLOS */}
      {activeSubTab === 'indicadores_eficiencia' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h3 className="text-base font-black text-white uppercase">Indicadores de Eficiência de Descarregamento (EFD)</h3>
            <p className="text-xs text-slate-400">
              Regra DPO Ambev: Veículos que chegam devem ser descarregados até as 22:00 do mesmo dia. Veículos pernoitados são automaticamente isentados.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xxs text-slate-500 font-bold uppercase block">Eficiência Geral</span>
                <span className="text-3xl font-black text-amber-400 font-mono mt-1 block">
                  {descarregamentoMetrics.overallEfficiency}%
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xxs text-slate-500 font-bold uppercase block">Descarregados no Prazo</span>
                <span className="text-3xl font-black text-emerald-400 font-mono mt-1 block">
                  {descarregamentoMetrics.descarregadosOnTime}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-xxs text-slate-500 font-bold uppercase block">Pernoites Isentos</span>
                <span className="text-3xl font-black text-purple-400 font-mono mt-1 block">
                  {descarregamentoMetrics.pernoiteCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CHECKLIST DE SEGURANÇA & DESCARREGAMENTO (DPO AMBEV) - IMAGES 3 & 4 */}
      {/* ========================================================================= */}
      {showChecklistModal && checklistVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-3.5 sm:p-5 shrink-0 bg-white">
              <div className="flex items-center space-x-2.5 sm:space-x-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0">
                  <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-base font-black text-slate-900 uppercase tracking-tight">
                    CHECKLIST DE SEGURANÇA & DESCARGA
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-bold font-mono">
                    Placa: <strong className="text-slate-900">{checklistVehicle.plate}</strong> • Mapa: <strong className="text-slate-900">{checklistVehicle.routeMap}</strong>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowChecklistModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Modal Body (touch-friendly, never cuts off buttons) */}
            <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5 sm:space-y-3.5 flex-1 overscroll-contain">
              {/* Checklist Section Title & Quick Auto-Check Button */}
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 sm:p-2.5">
                <div>
                  <span className="text-[10px] sm:text-xs font-black text-amber-800 uppercase tracking-wider block">
                    Etapas DPO de Segurança:
                  </span>
                  <span className="text-[9px] text-amber-700 block">
                    {isChecklistComplete ? '✅ 3/3 etapas verificadas' : 'Toque abaixo ou clique no botão rápido'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !(checkGiro360 && checkCalcoSeguranca && checkAberturaBaias);
                    setCheckGiro360(nextVal);
                    setCheckCalcoSeguranca(nextVal);
                    setCheckAberturaBaias(nextVal);
                  }}
                  className="text-[11px] font-black bg-amber-500 hover:bg-amber-400 text-slate-950 px-2.5 py-1.5 rounded-lg transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  {isChecklistComplete ? 'Desmarcar' : 'Marcar 100% OK ✓'}
                </button>
              </div>

              {/* Checkbox 1: Giro 360 */}
              <label className={`block p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                checkGiro360 ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/30' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}>
                <div className="flex items-start space-x-2.5 sm:space-x-3">
                  <input 
                    type="checkbox"
                    checked={checkGiro360}
                    onChange={(e) => setCheckGiro360(e.target.checked)}
                    className="h-5 w-5 mt-0.5 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 block">
                      1. Giro 360º de Inspeção Visual no Veículo
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 block leading-tight">
                      Verifiquei se há pedestres, obstáculos, calçamento irregular ou riscos no entorno do caminhão.
                    </span>
                  </div>
                </div>
              </label>

              {/* Checkbox 2: Trava-Rodas / Calço de Segurança */}
              <label className={`block p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                checkCalcoSeguranca ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/30' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}>
                <div className="flex items-start space-x-2.5 sm:space-x-3">
                  <input 
                    type="checkbox"
                    checked={checkCalcoSeguranca}
                    onChange={(e) => setCheckCalcoSeguranca(e.target.checked)}
                    className="h-5 w-5 mt-0.5 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 block">
                      2. Instalação da Trava-Rodas / Calço de Segurança
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 block leading-tight">
                      Calço devidamente fixado nas rodas traseiras do veículo antes de aproximar a empilhadeira.
                    </span>
                  </div>
                </div>
              </label>

              {/* Checkbox 3: Abertura e Elevação Segura das Baias */}
              <label className={`block p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                checkAberturaBaias ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/30' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}>
                <div className="flex items-start space-x-2.5 sm:space-x-3">
                  <input 
                    type="checkbox"
                    checked={checkAberturaBaias}
                    onChange={(e) => setCheckAberturaBaias(e.target.checked)}
                    className="h-5 w-5 mt-0.5 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                  />
                  <div>
                    <span className="text-xs sm:text-sm font-black text-slate-900 block">
                      3. Abertura e Elevação Segura das Baias Laterais
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-600 mt-0.5 block leading-tight">
                      Baias erguidas e travadas com segurança antes da entrada do garfo da empilhadeira.
                    </span>
                  </div>
                </div>
              </label>

              {/* Operational Warning Yellow Card */}
              <div className="bg-amber-50/80 border border-amber-300/80 rounded-xl p-2 sm:p-2.5 text-xs text-amber-950 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[11px] leading-relaxed">
                  <strong>Lembrete:</strong> Ao finalizar a retirada dos paletes, o calço deve ser retirado e o motorista acionado.
                </p>
              </div>

              {/* Selection: Operador Empilhador & Doca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black text-slate-700 uppercase mb-1">
                    EMPILHADOR RESPONSÁVEL:
                  </label>
                  <select
                    value={checklistEmpilhadorId}
                    onChange={(e) => setChecklistEmpilhadorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {empilhadores.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.name} ({op.forkliftCode || 'EMP'})
                      </option>
                    ))}
                    {empilhadores.length === 0 && (
                      <option value="EMP-G1013">PAULO PEREIRA DA SILVA (E-03)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black text-slate-700 uppercase mb-1">
                    DOCA DE DESCARGA:
                  </label>
                  <select
                    value={checklistDock}
                    onChange={(e) => setChecklistDock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {['DOCA 01', 'DOCA 02', 'DOCA 03', 'DOCA 04', 'DOCA 05', 'DOCA 06', 'DOCA 07', 'DOCA 08'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Inputs: Horário de Início & Qtd Paletes */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-1">
                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black text-slate-700 uppercase mb-1">
                    HORÁRIO DE INÍCIO:
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={checklistStartTime}
                      onChange={(e) => setChecklistStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <Clock className="absolute right-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] sm:text-[11px] font-black text-slate-700 uppercase mb-1">
                    QTD. PALETES:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={checklistPallets}
                    onChange={(e) => setChecklistPallets(parseInt(e.target.value) || 8)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Buttons (Fixed / Sticky Footer - Always Visible on Any Phone!) */}
            <div className="flex items-center space-x-2 p-3 sm:p-4 border-t border-slate-100 shrink-0 bg-slate-50/95 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setShowChecklistModal(false)}
                className="w-1/3 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2.5 sm:py-3 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckGiro360(true);
                  setCheckCalcoSeguranca(true);
                  setCheckAberturaBaias(true);
                  handleConfirmStartWithChecklist();
                }}
                className="flex-1 py-2.5 sm:py-3 px-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md cursor-pointer active:scale-98"
              >
                <Play className="h-4 w-4 fill-current shrink-0" />
                <span className="truncate">CONFIRMAR E INICIAR DESCARGA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: + ADICIONAR PLACA (CADASTRO RÁPIDO NA TELA) */}
      {/* ========================================================================= */}
      {showAddPlateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:p-4 shrink-0 bg-slate-900">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-black text-white uppercase">Adicionar Placa para Descarga</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddPlateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewPlate} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs flex-1 overscroll-contain">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Placa do Veículo *</label>
                    <input
                      type="text"
                      required
                      placeholder="ABC1D23"
                      value={newPlate}
                      onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-amber-400 font-mono font-black"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Mapa de Rota</label>
                    <input
                      type="text"
                      placeholder="Ex: 16078"
                      value={newRouteMap}
                      onChange={(e) => setNewRouteMap(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Nome do Motorista</label>
                  <input
                    type="text"
                    placeholder="Nome do motorista..."
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Tipo de Veículo</label>
                    <select
                      value={newVehicleType}
                      onChange={(e) => setNewVehicleType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    >
                      <option value="TOCO (8 PAL)">TOCO (8 Paletes)</option>
                      <option value="TRUCK (10 PAL)">TRUCK (10 Paletes)</option>
                      <option value="CARRETA (28 PAL)">CARRETA (28 Paletes)</option>
                      <option value="VUC (6 PAL)">VUC (6 Paletes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Qtd. Paletes</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={newTotalPallets}
                      onChange={(e) => setNewTotalPallets(parseInt(e.target.value) || 8)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Doca Inicial</label>
                  <select
                    value={newDock}
                    onChange={(e) => setNewDock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    {DOCAS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xxs font-bold text-rose-400 uppercase">Veículo Selecionado para BLITZ?</span>
                  <input
                    type="checkbox"
                    checked={newIsBlitz}
                    onChange={(e) => setNewIsBlitz(e.target.checked)}
                    className="h-4 w-4 rounded text-rose-600 bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center space-x-2 p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setShowAddPlateModal(false)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black uppercase tracking-wider"
                >
                  Adicionar à Fila
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIÇÃO DE HORÁRIOS & DOCA */}
      {/* ========================================================================= */}
      {showEditTimeModal && selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:p-4 shrink-0 bg-slate-900">
              <div>
                <h3 className="text-sm font-black text-white uppercase">Editar Detalhes do Veículo</h3>
                <span className="text-xxs font-mono text-amber-400 font-bold">
                  Placa: {selectedVehicle.plate} • Mapa: {selectedVehicle.routeMap}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setShowEditTimeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTimes} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs flex-1 overscroll-contain">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Início Descarga</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Fim Descarga</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Doca de Descarga</label>
                  <select
                    value={editDock}
                    onChange={(e) => setEditDock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    {DOCAS_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Empilhador Responsável</label>
                  <select
                    value={editEmpilhadorId}
                    onChange={(e) => setEditEmpilhadorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="">Nenhum</option>
                    {empilhadores.map(op => (
                      <option key={op.id} value={op.id}>{op.name} ({op.forkliftCode})</option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Veículo Pernoite?</span>
                    <span className="text-xxs text-slate-400">Isenta da penalidade das 22:00</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsPernoite}
                    onChange={(e) => setEditIsPernoite(e.target.checked)}
                    className="h-4 w-4 rounded text-purple-600 border-slate-700 bg-slate-900"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditTimeModal(false);
                      if (selectedVehicle) {
                        handleDeleteVehicleFromQueue(selectedVehicle);
                      }
                    }}
                    className="w-full bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-200 border border-red-800/50 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Excluir Mapa / Veículo da Fila</span>
                  </button>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center space-x-2 p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setShowEditTimeModal(false)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black uppercase tracking-wider"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CADASTRO / EDIÇÃO DE EMPILHADOR */}
      {/* ========================================================================= */}
      {showOperatorModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 p-3.5 sm:p-4 shrink-0 bg-slate-900">
              <h3 className="text-sm font-black text-white uppercase">
                {selectedEmpilhador ? 'Editar Empilhador' : 'Novo Empilhador'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowOperatorModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 text-xs flex-1 overscroll-contain">
                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Nome do Operador *</label>
                  <input
                    type="text"
                    value={opName}
                    onChange={(e) => setOpName(e.target.value)}
                    placeholder="Nome completo..."
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Matrícula</label>
                    <input
                      type="text"
                      value={opMatricula}
                      onChange={(e) => setOpMatricula(e.target.value)}
                      placeholder="EMP-100"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Turno</label>
                    <select
                      value={opShift}
                      onChange={(e) => setOpShift(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    >
                      <option value="1_TURNO">1º Turno (Manhã)</option>
                      <option value="2_TURNO">2º Turno (Tarde)</option>
                      <option value="3_TURNO">3º Turno (Noite)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Equipamento</label>
                    <input
                      type="text"
                      value={opForkliftCode}
                      onChange={(e) => setOpForkliftCode(e.target.value)}
                      placeholder="EMP-01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xxs font-bold text-slate-400 uppercase mb-1">Status Operacional</label>
                    <select
                      value={opStatus}
                      onChange={(e) => setOpStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                    >
                      <option value="DISPONIVEL">Disponível</option>
                      <option value="OPERANDO">Operando</option>
                      <option value="INTERVALO">Intervalo</option>
                      <option value="MANUTENCAO">Manutenção</option>
                      <option value="OFFLINE">Offline</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center space-x-2 p-3 sm:p-4 border-t border-slate-800 shrink-0 bg-slate-950/90">
                <button
                  type="button"
                  onClick={() => setShowOperatorModal(false)}
                  className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black uppercase tracking-wider"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in" id="confirm_modal_empilhador">
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-800 space-y-4 text-slate-100">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-400 animate-bounce" />
              </div>
              <h3 className="font-bold text-white text-sm">{confirmModal.title}</h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (confirmCallbackRef.current) {
                    confirmCallbackRef.current();
                    confirmCallbackRef.current = null;
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
