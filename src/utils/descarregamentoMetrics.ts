import { CarregamentoProcess, ImportedRoute } from '../types';

export interface DescarregamentoEfficiencyResult {
  targetDate: string;
  totalImported: number;
  pernoiteCount: number;
  totalEligible: number;
  unloadedOnTime: number;
  unloadedLate: number;
  pendingUnload: number;
  efficiencyPercentage: number;
  penaltyPercentage: number;
  isPast22: boolean;
  eligibleVehicles: Array<{
    routeMap: string;
    plate: string;
    driverName?: string;
    isPernoite: boolean;
    unloadingStartTime?: string;
    unloadingEndTime?: string;
    startedAt?: string;
    completedAt?: string;
    status: string;
    isOnTime: boolean;
    isLate: boolean;
    isPending: boolean;
    cycleDays: 'D0' | 'D1' | 'D2' | 'D3' | 'D4+';
  }>;
}

export interface CycleMetricsResult {
  d0Count: number;
  d1Count: number;
  d2Count: number;
  d3Count: number;
  d4PlusCount: number;
  totalUnloaded: number;
  d0Percentage: number;
  d1Percentage: number;
  d2Percentage: number;
  d3Percentage: number;
  d4PlusPercentage: number;
  items: Array<{
    routeMap: string;
    plate: string;
    driverName?: string;
    routeDate: string;
    unloadedDate: string;
    unloadingStartTime?: string;
    unloadingEndTime?: string;
    cycle: 'D0' | 'D1' | 'D2' | 'D3' | 'D4+';
    diffDays: number;
    isPernoite: boolean;
    empilhadorName?: string;
  }>;
}

/**
 * Calculates day difference between import/route date and unloading completion date.
 */
export function getCycleDiffDays(routeDateStr?: string, completedDateStr?: string): { cycle: 'D0' | 'D1' | 'D2' | 'D3' | 'D4+'; diffDays: number } {
  if (!routeDateStr) {
    return { cycle: 'D0', diffDays: 0 };
  }

  try {
    const routeDateOnly = routeDateStr.includes('T') ? routeDateStr.split('T')[0] : routeDateStr.trim();
    const completedDateOnly = completedDateStr 
      ? (completedDateStr.includes('T') ? completedDateStr.split('T')[0] : completedDateStr.trim())
      : new Date().toISOString().split('T')[0];

    const rParts = routeDateOnly.split('-').map(Number);
    const cParts = completedDateOnly.split('-').map(Number);

    if (rParts.length === 3 && cParts.length === 3) {
      const rDate = new Date(rParts[0], rParts[1] - 1, rParts[2]);
      const cDate = new Date(cParts[0], cParts[1] - 1, cParts[2]);
      
      const diffMs = cDate.getTime() - rDate.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (diffDays === 0) return { cycle: 'D0', diffDays: 0 };
      if (diffDays === 1) return { cycle: 'D1', diffDays: 1 };
      if (diffDays === 2) return { cycle: 'D2', diffDays: 2 };
      if (diffDays === 3) return { cycle: 'D3', diffDays: 3 };
      return { cycle: 'D4+', diffDays };
    }
  } catch (e) {
    console.error('Error calculating cycle diff days:', e);
  }

  return { cycle: 'D0', diffDays: 0 };
}

/**
 * Checks if a time is <= 22:00 on the scheduled route date.
 */
export function isUnloadedBefore22(completedAt?: string, unloadingEndTime?: string, routeDate?: string): boolean {
  const targetDate = routeDate ? (routeDate.includes('T') ? routeDate.split('T')[0] : routeDate) : new Date().toISOString().split('T')[0];

  // 1. If unloadingEndTime is a time string like "20:30" or "22:00"
  if (unloadingEndTime && unloadingEndTime.includes(':')) {
    const parts = unloadingEndTime.trim().split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10) || 0;
    if (!isNaN(hours)) {
      return hours < 22 || (hours === 22 && minutes === 0);
    }
  }

  // 2. If completedAt is an ISO string
  if (completedAt) {
    try {
      const compDate = new Date(completedAt);
      const compDateStr = completedAt.split('T')[0];

      // If completed on a subsequent date, it is definitely after 22:00 of the original date
      if (compDateStr > targetDate) {
        return false;
      }

      const hours = compDate.getHours();
      const minutes = compDate.getMinutes();
      return hours < 22 || (hours === 22 && minutes === 0);
    } catch (e) {
      return true;
    }
  }

  return false;
}

/**
 * Computes Unloading Efficiency (Eficiência de Descarregamento) for a given date or all data.
 * Rule:
 * - Vehicles unloaded until 22:00 -> 100% efficiency.
 * - After 22:00, vehicles not unloaded or unloaded late decrease the percentage based on the volume of imported vehicles.
 * - Vehicles listed as PERNOITE are EXCLUDED from the efficiency calculation.
 */
export function calculateDescarregamentoEfficiency(
  carregamentos: CarregamentoProcess[] = [],
  importedRoutes: ImportedRoute[] = [],
  filterDate?: string
): DescarregamentoEfficiencyResult {
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = filterDate || todayStr;

  // Build a map of descarregamento processes indexed by routeMap and plate
  const procByMap = new Map<string, CarregamentoProcess>();
  const procByPlate = new Map<string, CarregamentoProcess>();

  carregamentos.forEach(proc => {
    if (proc.routeMap) {
      procByMap.set(proc.routeMap.toUpperCase().trim(), proc);
    }
    if (proc.plate) {
      procByPlate.set(proc.plate.toUpperCase().trim(), proc);
    }
  });

  // Collect all unique imported vehicles / maps for the target date
  const relevantRoutes = importedRoutes.filter(r => {
    const rDate = r.routeDate ? (r.routeDate.includes('T') ? r.routeDate.split('T')[0] : r.routeDate) : (r.importedAt ? r.importedAt.split('T')[0] : todayStr);
    return !filterDate || rDate === targetDate;
  });

  // Also include any processes that were created directly for targetDate if not in importedRoutes
  const allEntries: Array<{
    routeMap: string;
    plate: string;
    driverName?: string;
    routeDate: string;
    proc?: CarregamentoProcess;
  }> = [];

  const processedMapCodes = new Set<string>();

  relevantRoutes.forEach(r => {
    const mapCode = r.routeMap?.toUpperCase().trim() || r.id;
    processedMapCodes.add(mapCode);
    const matchedProc = procByMap.get(mapCode) || procByPlate.get(r.plate?.toUpperCase().trim());
    allEntries.push({
      routeMap: r.routeMap,
      plate: r.plate,
      driverName: (r as any).driverName || (matchedProc ? matchedProc.driverName : undefined),
      routeDate: r.routeDate || (r.importedAt ? r.importedAt.split('T')[0] : targetDate),
      proc: matchedProc
    });
  });

  carregamentos.forEach(proc => {
    const mapCode = proc.routeMap?.toUpperCase().trim() || proc.processNumber;
    const procDate = proc.routeDate || (proc.createdAt ? proc.createdAt.split('T')[0] : targetDate);
    if ((!filterDate || procDate === targetDate) && !processedMapCodes.has(mapCode)) {
      processedMapCodes.add(mapCode);
      allEntries.push({
        routeMap: proc.routeMap || proc.processNumber,
        plate: proc.plate,
        driverName: proc.driverName,
        routeDate: procDate,
        proc: proc
      });
    }
  });

  let totalImported = allEntries.length;
  let pernoiteCount = 0;
  let unloadedOnTime = 0;
  let unloadedLate = 0;
  let pendingUnload = 0;

  const eligibleVehicles: DescarregamentoEfficiencyResult['eligibleVehicles'] = [];

  const currentHour = new Date().getHours();
  const isPast22 = targetDate < todayStr || (targetDate === todayStr && currentHour >= 22);

  allEntries.forEach(entry => {
    const proc = entry.proc;
    const isPernoite = !!(proc?.isPernoite);

    if (isPernoite) {
      pernoiteCount++;
    }

    const isConcluded = proc?.status === 'CONCLUIDO' || !!(proc?.completedAt) || !!(proc?.unloadingEndTime);
    const isOnTime = isConcluded && isUnloadedBefore22(proc?.completedAt, proc?.unloadingEndTime, entry.routeDate);
    const isLate = isConcluded && !isOnTime;
    const isPending = !isConcluded;

    if (!isPernoite) {
      if (isOnTime) {
        unloadedOnTime++;
      } else if (isLate) {
        unloadedLate++;
      } else {
        // Pending
        pendingUnload++;
      }
    }

    const { cycle } = getCycleDiffDays(entry.routeDate, proc?.completedAt);

    eligibleVehicles.push({
      routeMap: entry.routeMap,
      plate: entry.plate,
      driverName: entry.driverName,
      isPernoite,
      unloadingStartTime: proc?.unloadingStartTime || (proc?.startedAt ? new Date(proc.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
      unloadingEndTime: proc?.unloadingEndTime || (proc?.completedAt ? new Date(proc.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
      startedAt: proc?.startedAt,
      completedAt: proc?.completedAt,
      status: proc?.status || 'FILA',
      isOnTime,
      isLate,
      isPending,
      cycleDays: cycle
    });
  });

  const totalEligible = totalImported - pernoiteCount;

  let efficiencyPercentage = 100;
  if (totalEligible > 0) {
    if (isPast22) {
      // Past 22:00, efficiency is strictly proportional to cars unloaded on time vs total eligible volume
      efficiencyPercentage = Math.round((unloadedOnTime / totalEligible) * 100);
    } else {
      // Before 22:00, vehicles currently pending are not yet penalized until 22:00 arrives
      // Only vehicles already completed past 22:00 on earlier days or late are penalized
      const nonPenalized = unloadedOnTime + pendingUnload;
      efficiencyPercentage = Math.round((nonPenalized / totalEligible) * 100);
    }
  }

  efficiencyPercentage = Math.max(0, Math.min(100, efficiencyPercentage));
  const penaltyPercentage = 100 - efficiencyPercentage;

  return {
    targetDate,
    totalImported,
    pernoiteCount,
    totalEligible,
    unloadedOnTime,
    unloadedLate,
    pendingUnload,
    efficiencyPercentage,
    penaltyPercentage,
    isPast22,
    eligibleVehicles
  };
}

/**
 * Computes Cycle Metrics (D0, D1, D2, D3, D4+) across imported routes and descarregamento processes.
 */
export function calculateCycleMetrics(
  carregamentos: CarregamentoProcess[] = [],
  importedRoutes: ImportedRoute[] = []
): CycleMetricsResult {
  const items: CycleMetricsResult['items'] = [];

  const procByMap = new Map<string, CarregamentoProcess>();
  carregamentos.forEach(p => {
    if (p.routeMap) procByMap.set(p.routeMap.toUpperCase().trim(), p);
    if (p.plate) procByMap.set(p.plate.toUpperCase().trim(), p);
  });

  const processedMapCodes = new Set<string>();

  // 1. Process all completed/active descarregamentos
  carregamentos.forEach(proc => {
    const mapCode = (proc.routeMap || proc.processNumber || '').toUpperCase().trim();
    processedMapCodes.add(mapCode);

    const routeDate = proc.routeDate || (proc.createdAt ? proc.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const unloadedDate = proc.completedAt ? proc.completedAt.split('T')[0] : (proc.createdAt ? proc.createdAt.split('T')[0] : routeDate);

    const { cycle, diffDays } = getCycleDiffDays(routeDate, proc.completedAt || unloadedDate);

    items.push({
      routeMap: proc.routeMap || proc.processNumber,
      plate: proc.plate,
      driverName: proc.driverName,
      routeDate,
      unloadedDate,
      unloadingStartTime: proc.unloadingStartTime || (proc.startedAt ? new Date(proc.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
      unloadingEndTime: proc.unloadingEndTime || (proc.completedAt ? new Date(proc.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined),
      cycle,
      diffDays,
      isPernoite: !!proc.isPernoite,
      empilhadorName: proc.empilhadorName
    });
  });

  // 2. Process any imported routes not yet in carregamentos
  importedRoutes.forEach(r => {
    const mapCode = (r.routeMap || r.id).toUpperCase().trim();
    if (!processedMapCodes.has(mapCode)) {
      processedMapCodes.add(mapCode);
      const routeDate = r.routeDate || (r.importedAt ? r.importedAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      const unloadedDate = r.updatedAt ? r.updatedAt.split('T')[0] : routeDate;
      const { cycle, diffDays } = getCycleDiffDays(routeDate, unloadedDate);

      items.push({
        routeMap: r.routeMap,
        plate: r.plate,
        driverName: (r as any).driverName,
        routeDate,
        unloadedDate,
        cycle,
        diffDays,
        isPernoite: false
      });
    }
  });

  const d0Count = items.filter(i => i.cycle === 'D0').length;
  const d1Count = items.filter(i => i.cycle === 'D1').length;
  const d2Count = items.filter(i => i.cycle === 'D2').length;
  const d3Count = items.filter(i => i.cycle === 'D3').length;
  const d4PlusCount = items.filter(i => i.cycle === 'D4+').length;
  const totalUnloaded = items.length;

  const d0Percentage = totalUnloaded > 0 ? Math.round((d0Count / totalUnloaded) * 100) : 0;
  const d1Percentage = totalUnloaded > 0 ? Math.round((d1Count / totalUnloaded) * 100) : 0;
  const d2Percentage = totalUnloaded > 0 ? Math.round((d2Count / totalUnloaded) * 100) : 0;
  const d3Percentage = totalUnloaded > 0 ? Math.round((d3Count / totalUnloaded) * 100) : 0;
  const d4PlusPercentage = totalUnloaded > 0 ? Math.round((d4PlusCount / totalUnloaded) * 100) : 0;

  return {
    d0Count,
    d1Count,
    d2Count,
    d3Count,
    d4PlusCount,
    totalUnloaded,
    d0Percentage,
    d1Percentage,
    d2Percentage,
    d3Percentage,
    d4PlusPercentage,
    items
  };
}
