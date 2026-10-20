import React, { useState } from 'react';
import { User, Driver, Vehicle, Product, ActiveAsset, AuditSession, AuditItem, AuditAssetItem, AuditExchangeItem, FiscalAlert, ImportedRoute, RouteObservation, Vale, ValeCollaborator, ReturnForecast, getAssetCode, getAssetCanonicalName } from '../types';
import { isClientFirebaseActive, saveDirectlyToFirestore } from '../clientFirebase';
import { ClipboardCheck, ShieldAlert, ArrowRight, ShieldCheck, CheckSquare, AlertTriangle, HelpCircle, Search, RefreshCw, XCircle, DollarSign, Calendar, SlidersHorizontal, FileSpreadsheet, Clock, CheckCircle2, Shield, Trash2, Camera, BarChart3, AlertCircle, Plus, PlusCircle, FileText, Check, Award, Eye, Calculator, Folder, Copy, X, ArrowUpCircle, ArrowDownCircle, Sparkles, FolderOpen, Download, FileCheck, PackageCheck, UserPlus, FileJson, Archive, Moon, Info, Edit3, Users } from 'lucide-react';
import { ImageDB, PhotoRecord } from '../imageDb';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { DEFAULT_USERS } from '../data';
import { getSkuClosedPrice } from '../utils/prices';
import { parseAndProcessFile, ProcessImportResult } from '../utils/excelImportHelper';
import * as XLSX from 'xlsx';

const normalizeMapCode = (mapCode: any): string => {
  if (mapCode === undefined || mapCode === null) return '';
  return String(mapCode).trim().replace(/^0+/, '');
};

function AuditPhotoViewer({ auditId }: { auditId: string }) {
  const [photos, setPhotos] = React.useState<PhotoRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [previewPhoto, setPreviewPhoto] = React.useState<PhotoRecord | null>(null);
  const [scale, setScale] = React.useState(1);

  const reloadPhotos = React.useCallback((forceCloud: boolean = false) => {
    if (forceCloud) setIsRefreshing(true);
    ImageDB.getPhotosByAudit(auditId, forceCloud)
      .then(res => {
        setPhotos(res);
        setLoading(false);
        setIsRefreshing(false);
      })
      .catch(() => {
        setLoading(false);
        setIsRefreshing(false);
      });
  }, [auditId]);

  React.useEffect(() => {
    reloadPhotos(false);

    const handlePhotosUpdated = () => {
      reloadPhotos(false);
    };
    window.addEventListener('logiroute_photos_updated', handlePhotosUpdated);

    return () => {
      window.removeEventListener('logiroute_photos_updated', handlePhotosUpdated);
    };
  }, [auditId, reloadPhotos]);

  if (loading) {
    return <div className="text-xxs text-slate-400 animate-pulse py-1">Carregando fotos dos PA e AG...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-xxs text-slate-400 italic py-1">
        <span>Nenhuma foto de evidência cadastrada.</span>
        <button
          type="button"
          onClick={() => reloadPhotos(true)}
          disabled={isRefreshing}
          className="text-[9px] font-medium text-indigo-600 hover:text-indigo-800 not-italic underline cursor-pointer"
        >
          {isRefreshing ? 'Buscando...' : 'Buscar fotos na nuvem'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <span>Evidências Fotográficas (PA / AG / Refugos):</span>
        <button
          type="button"
          onClick={() => reloadPhotos(true)}
          disabled={isRefreshing}
          className="text-[9px] font-semibold text-indigo-500 hover:text-indigo-700 normal-case flex items-center space-x-1 cursor-pointer"
        >
          <span>{isRefreshing ? 'Atualizando...' : '↻ Recarregar fotos'}</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {photos.map(p => (
          <div 
            key={p.id} 
            onClick={() => { setPreviewPhoto(p); setScale(1); }}
            className="relative group bg-slate-100 rounded-lg overflow-hidden border border-slate-200 w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 cursor-pointer hover:border-amber-500 transition-all"
          >
            <img 
              src={p.photoUrl} 
              alt={p.itemName} 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1 text-[8px] text-white">
              <span className="font-semibold truncate text-[7px]">{p.itemName}</span>
              <span className="opacity-75 text-[7px]">
                {p.type === 'produto' ? 'PA' : 
                 p.type === 'refugo' ? 'REFUGO' : 
                 p.type === 'troca_reposicao' ? 'TROCA/REP' : 'AG'}
              </span>
              <span className="text-amber-400 text-[6px] font-bold block mt-0.5">Clique para Zoom</span>
            </div>
          </div>
        ))}
      </div>

      {previewPhoto && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-50">
            <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-1 flex items-center space-x-1 shadow-lg text-white">
              <button
                type="button"
                onClick={() => setScale(s => Math.max(s - 0.25, 0.5))}
                className="p-1.5 hover:bg-slate-800 rounded font-bold text-sm h-8 w-8 flex items-center justify-center cursor-pointer transition"
                title="Zoom Out"
              >
                -
              </button>
              <span className="px-2 font-mono text-xs font-bold w-12 text-center">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                onClick={() => setScale(s => Math.min(s + 0.25, 4))}
                className="p-1.5 hover:bg-slate-800 rounded font-bold text-sm h-8 w-8 flex items-center justify-center cursor-pointer transition"
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setScale(1)}
                className="px-2 py-1 hover:bg-slate-800 rounded font-bold text-xs cursor-pointer transition"
                title="Reset Zoom"
              >
                1x
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setPreviewPhoto(null); setScale(1); }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition cursor-pointer font-sans"
            >
              Fechar [X]
            </button>
          </div>

          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 cursor-zoom-in">
            <div 
              className="transition-transform duration-100 ease-out flex items-center justify-center"
              style={{ transform: `scale(${scale})` }}
            >
              <img
                src={previewPhoto.photoUrl}
                alt={previewPhoto.itemName}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-slate-800 bg-slate-950"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 border border-slate-800 text-white p-3 rounded-xl max-w-2xl mx-auto flex flex-col space-y-1 text-center font-sans">
            <div className="font-bold text-xs uppercase tracking-wider">{previewPhoto.itemName || 'Sem descrição'}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Código / Ativo: {previewPhoto.itemCode} • Categoria: {
                previewPhoto.type === 'produto' ? 'PA' : 
                previewPhoto.type === 'refugo' ? 'REFUGO/AVARIA' : 
                previewPhoto.type === 'troca_reposicao' ? 'TROCA/REPOSIÇÃO' : 'AG'
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditHistoryDetails({ audit }: { audit: AuditSession }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="mt-4 border-t border-slate-150/50 pt-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xxs font-bold text-slate-700 hover:text-indigo-600 flex items-center space-x-1 uppercase focus:outline-none cursor-pointer"
      >
        <span>{isOpen ? '▲ Ocultar Detalhes da Conciliação' : '▼ Visualizar Detalhes e Itens Reconciliados'}</span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4">
          {/* PA Products Table */}
          {audit.items && audit.items.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">Produtos Acabados (PA)</span>
              <div className="border border-slate-200 rounded-lg overflow-x-auto bg-slate-50/30">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-center">Físico</th>
                      <th className="p-2 text-center">Fiscal</th>
                      <th className="p-2 text-center">Como.</th>
                      <th className="p-2 text-center">Rec.</th>
                      <th className="p-2 text-right">Divergência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {audit.items.map(item => {
                      const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                      const fisc = item.fiscalQty ?? 0;
                      const comodato = item.comodatoQty ?? 0;
                      const recolha = item.recolhaQty ?? 0;
                      const diff = (phys + comodato - recolha) - fisc;
                      return (
                        <tr key={item.productCode} className="hover:bg-slate-100/30">
                          <td className="p-2 font-medium">{item.productDescription || item.productCode}</td>
                          <td className="p-2 text-center font-mono">{phys}</td>
                          <td className="p-2 text-center font-mono">{fisc}</td>
                          <td className="p-2 text-center font-mono text-slate-500">{comodato || '-'}</td>
                          <td className="p-2 text-center font-mono text-slate-500">{recolha || '-'}</td>
                          <td className={`p-2 text-right font-bold font-mono ${
                            diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : `${diff}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AG Assets Table */}
          {audit.assets && audit.assets.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">Ativos de Giro (AG)</span>
              <div className="border border-slate-200 rounded-lg overflow-x-auto bg-slate-50/30">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2">Ativo</th>
                      <th className="p-2 text-center">Físico</th>
                      <th className="p-2 text-center">Fiscal</th>
                      <th className="p-2 text-center">Como.</th>
                      <th className="p-2 text-center">Rec.</th>
                      <th className="p-2 text-right">Divergência</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {audit.assets.map(asset => {
                      const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
                      const fisc = asset.fiscalQty ?? 0;
                      const comodato = asset.comodatoQty ?? 0;
                      const recolha = asset.recolhaQty ?? 0;
                      const diff = phys - fisc + comodato - recolha;
                      return (
                        <tr key={asset.assetId} className="hover:bg-slate-100/30">
                          <td className="p-2 font-medium">{asset.assetName || asset.assetId}</td>
                          <td className="p-2 text-center font-mono">{phys}</td>
                          <td className="p-2 text-center font-mono">{fisc}</td>
                          <td className="p-2 text-center font-mono text-slate-500">{comodato || '-'}</td>
                          <td className="p-2 text-center font-mono text-slate-500">{recolha || '-'}</td>
                          <td className={`p-2 text-right font-bold font-mono ${
                            diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : `${diff}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Photo viewer component */}
          <AuditPhotoViewer auditId={audit.id} />
        </div>
      )}
    </div>
  );
}

interface FiscalViewProps {
  currentUser: User;
  users?: User[];
  drivers: Driver[];
  onSaveDrivers?: (drivers: Driver[]) => void;
  vehicles: Vehicle[];
  products: Product[];
  onSaveProducts?: (products: Product[]) => void;
  activeAssets: ActiveAsset[];
  audits: AuditSession[];
  onSaveAudits: (audits: AuditSession[]) => void;
  fiscalAlerts?: FiscalAlert[];
  onSaveAlerts?: (alerts: FiscalAlert[]) => void;
  importedRoutes?: ImportedRoute[];
  onSaveImportedRoutes?: (routes: ImportedRoute[]) => void;
  vales?: Vale[];
  onSaveVales?: (vales: Vale[]) => void;
  activeTab?: string;
  onResetPlatformData?: (skipConfirmation?: boolean) => void;
  returnForecasts?: ReturnForecast[];
  onSaveForecasts?: (forecasts: ReturnForecast[]) => void;
  carregamentos?: any[];
  onSaveCarregamentos?: (carregamentos: any[]) => void;
}

function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function matchDriverFromColumnValue(val: string, currentDrivers: Driver[]): string {
  if (!val) return '';
  const rawValUpper = val.trim().toUpperCase();
  if (!rawValUpper) return '';

  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const normalizeId = (id: string) => id.toUpperCase().replace(/^G/, '').replace(/^0+/, '').trim();
  const toNumericOnly = (str: string) => str.replace(/\D/g, '').replace(/^0+/, '');

  // 1. Numeric-only match (highest priority for matrícula codes like 1053 matching G1053)
  const inputNumeric = toNumericOnly(rawValUpper);
  if (inputNumeric) {
    const foundByNumeric = currentDrivers.find(d => toNumericOnly(d.id) === inputNumeric || (d.cpf && toNumericOnly(d.cpf) === inputNumeric));
    if (foundByNumeric) return foundByNumeric.id;
  }

  // 2. Exact match on ID (case-insensitive)
  let found = currentDrivers.find(d => d.id.toUpperCase() === rawValUpper);
  if (found) return found.id;

  // 3. Normalize the spreadsheet value (remove G prefix and leading zeros)
  const cleanVal = rawValUpper.replace(/^G/, '').replace(/^0+/, '').trim();
  if (cleanVal) {
    found = currentDrivers.find(d => normalizeId(d.id) === cleanVal);
    if (found) return found.id;
  }

  // 4. Extract any numbers in the string that could represent a driver ID
  const digitSequences = rawValUpper.match(/\d+/g);
  if (digitSequences) {
    for (const seq of digitSequences) {
      const cleanSeq = seq.replace(/^0+/, ''); // strip leading zeros
      if (cleanSeq) {
        found = currentDrivers.find(d => {
          const dbCleanId = normalizeId(d.id);
          const dbNumericOnly = toNumericOnly(d.id);
          return dbCleanId === cleanSeq || dbNumericOnly === cleanSeq;
        });
        if (found) return found.id;
      }
    }
  }

  // 5. Exact name matching with accent stripping
  const normalizedVal = removeAccents(rawValUpper);
  found = currentDrivers.find(d => removeAccents(d.name.toUpperCase()) === normalizedVal);
  if (found) return found.id;

  // 6. Partial / contains name matching (fuzzy match)
  found = currentDrivers.find(d => {
    const dbName = removeAccents(d.name.toUpperCase());
    return dbName.includes(normalizedVal) || normalizedVal.includes(dbName);
  });
  if (found) return found.id;

  // 7. Token-based matching (e.g. "EDENILSON SILVA" matches "EDENILSON DE SOUSA SILVA")
  const valTokens = normalizedVal.split(/\s+/).filter(t => t.length > 2);
  if (valTokens.length >= 2) {
    found = currentDrivers.find(d => {
      const dbTokens = removeAccents(d.name.toUpperCase()).split(/\s+/);
      const matchCount = valTokens.filter(vt => dbTokens.includes(vt)).length;
      return matchCount >= Math.min(2, valTokens.length);
    });
    if (found) return found.id;
  }

  // 8. Split by delimiters and match parts
  const parts = rawValUpper.split(/[\s\-;(),]+/);
  for (const part of parts) {
    const cleanPart = part.replace(/^G/, '').replace(/^0+/, '').trim();
    if (cleanPart) {
      found = currentDrivers.find(d => normalizeId(d.id) === cleanPart);
      if (found) return found.id;
    }
  }

  return '';
}

function isForecastActivePernoite(
  f: ReturnForecast,
  audits: AuditSession[] = [],
  importedRoutes: ImportedRoute[] = []
): boolean {
  if (f.tripStatus !== 'pernoitam') return false;
  if (f.status === 'no_patio') return false;

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Date rollover: if pernoite was registered on a previous day, it is no longer active today
  if (f.updatedAt) {
    const fDate = f.updatedAt.split('T')[0];
    if (fDate < todayStr) return false;
  }

  // 2. Audit check: if map is downloaded/finalized
  const normFMap = normalizeMapCode(f.routeMap).toUpperCase();
  const matchingAudit = audits.find(a => {
    const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
    return aNorm === normFMap || (a.unifiedMaps && a.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === normFMap));
  });
  if (matchingAudit && (
    matchingAudit.status === 'finalizado_ok' || 
    matchingAudit.status === 'finalizado_divergente' || 
    matchingAudit.surplusFlowStatus === 'BAIXADO' ||
    (matchingAudit as any).pdfDownloaded === true
  )) {
    return false;
  }

  // 3. Route check: if closed
  const matchingRoute = importedRoutes.find(r => normalizeMapCode(r.routeMap).toUpperCase() === normFMap);
  if (matchingRoute && matchingRoute.status === 'fechado') {
    return false;
  }

  return true;
}

function selectCircularBlitzRoutes(
  importedRoutesForDate: ImportedRoute[], 
  returnForecasts: ReturnForecast[] = [],
  currentBlitzRoutes: ImportedRoute[] = [],
  audits: AuditSession[] = []
): string[] {
  if (importedRoutesForDate.length === 0) return [];

  // Identify distinct pernoite plates (tripStatus === 'pernoitam')
  const pernoitePlates = new Set(
    returnForecasts
      .filter(f => isForecastActivePernoite(f, audits, importedRoutesForDate))
      .map(f => f.plate.trim().toUpperCase())
  );

  // A blitz route is valid if it is currently marked as blitz, belongs to the active date,
  // has a valid plate, and that plate is not pernoitando.
  const validBlitzRoutes = currentBlitzRoutes.filter(r => 
    r.plate && r.plate.trim() !== "" && !pernoitePlates.has(r.plate.trim().toUpperCase())
  );

  // Keep up to 2 valid ones
  const keptMaps = validBlitzRoutes.slice(0, 2).map(r => r.routeMap);

  if (keptMaps.length >= 2) {
    // Already have 2 valid blitzes, don't draw any more!
    return keptMaps;
  }

  // How many more do we need to draw?
  const neededCount = 2 - keptMaps.length;

  // Gather plates that have ALREADY been audited or drawn for blitz previously across historical audits
  const checkedPlatesSet = new Set(
    (audits || [])
      .filter(a => a.blitzBoxesChecked !== undefined || a.isBlitz)
      .map(a => (a.plate || '').trim().toUpperCase())
      .filter(Boolean)
  );

  // Find candidate routes that can be drawn
  // Candidates must:
  // - Not be already kept as blitz
  // - Have a non-empty plate
  // - Not be pernoitando
  const candidates = importedRoutesForDate.filter(r => {
    if (!r.plate || r.plate.trim() === "") return false;
    if (keptMaps.includes(r.routeMap)) return false;
    if (pernoitePlates.has(r.plate.trim().toUpperCase())) return false;
    return true;
  });

  // Split candidates into unchecked (never blitzed in audits) and checked
  const uncheckedCandidates = candidates.filter(r => !checkedPlatesSet.has(r.plate.trim().toUpperCase()));

  // Helper to shuffle candidates randomly for drawing
  function shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const shuffledUnchecked = shuffle(uncheckedCandidates);
  const shuffledCandidates = shuffle(candidates);

  const selectedNewMaps: string[] = [];

  // Pick from unchecked candidates first (vehicles that have NEVER had a Blitz)
  shuffledUnchecked.forEach(r => {
    if (selectedNewMaps.length < neededCount) {
      selectedNewMaps.push(r.routeMap);
    }
  });

  // If still need more, pick from any candidates (circular fallback)
  if (selectedNewMaps.length < neededCount) {
    shuffledCandidates.forEach(r => {
      if (selectedNewMaps.length < neededCount && !selectedNewMaps.includes(r.routeMap)) {
        selectedNewMaps.push(r.routeMap);
      }
    });
  }

  const result = [...keptMaps, ...selectedNewMaps];

  // If we couldn't get exactly 2 maps, pad with first available non-pernoite maps
  while (result.length < 2 && importedRoutesForDate.length > result.length) {
    const nextMap = importedRoutesForDate.find(r => 
      !result.includes(r.routeMap) && 
      (!r.plate || !pernoitePlates.has(r.plate.trim().toUpperCase()))
    );
    if (nextMap) {
      result.push(nextMap.routeMap);
    } else {
      break;
    }
  }

  return result.slice(0, 2);
}

interface ReopeningInfo {
  requestedAt?: string;
  requestedBy?: string;
  justification?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  closedAgainAt?: string;
  closedAgainBy?: string;
  isReopened: boolean;
}

const getReopeningInfo = (audit: AuditSession): ReopeningInfo => {
  const info: ReopeningInfo = { isReopened: false };
  if (!audit || !audit.history) return info;

  const approvedLog = audit.history.find(h => h.action.includes('Reabertura Aprovada') || h.action.includes('Reaberto'));
  if (approvedLog) {
    info.isReopened = true;
    info.reopenedAt = approvedLog.timestamp;
    info.reopenedBy = approvedLog.user;
  }

  const requestLog = audit.history.find(h => h.action.includes('Solicitou Reabertura') || h.action.includes('Solicitação de Reabertura'));
  if (requestLog) {
    info.requestedAt = requestLog.timestamp;
    info.requestedBy = requestLog.user;
    if (requestLog.details) {
      const match = requestLog.details.match(/Justificativa:\s*(.*)/);
      info.justification = match ? match[1] : requestLog.details;
    } else if (audit.reopeningJustification) {
      info.justification = audit.reopeningJustification;
    }
  }

  if (info.reopenedAt) {
    const closedLog = audit.history.find(h => 
      (h.action.includes('Baixa Concluída') || h.action.includes('Finalizado') || h.action.includes('Concluída')) && 
      new Date(h.timestamp) > new Date(info.reopenedAt)
    );
    if (closedLog) {
      info.closedAgainAt = closedLog.timestamp;
      info.closedAgainBy = closedLog.user;
    }
  }

  return info;
};

interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  details: string;
  type: 'action' | 'observation' | 'reopening' | 'delay' | 'alignment';
}

const getUnifiedTimeline = (audit: AuditSession, importedRoutes: ImportedRoute[] = []): TimelineEvent[] => {
  if (!audit) return [];
  
  const events: TimelineEvent[] = [];

  // 1. Audit Session History Events
  if (audit.history) {
    audit.history.forEach((h, index) => {
      let evType: 'action' | 'reopening' = 'action';
      if (h.action.includes('Reabert') || h.action.includes('Reabertura')) {
        evType = 'reopening';
      }
      events.push({
        id: `hist_${index}_${h.timestamp}`,
        timestamp: h.timestamp,
        action: h.action,
        user: h.user,
        details: h.details || '',
        type: evType
      });
    });
  }

  // Find matching imported route
  const matchingRoute = importedRoutes.find(
    r => r.routeMap.toUpperCase() === audit.routeMap.toUpperCase()
  );

  // 2. Observations from AuditSession
  if (audit.routeObservations) {
    audit.routeObservations.forEach((o, index) => {
      let ts = o.timestamp || new Date().toISOString();
      if (ts.includes('/')) {
        try {
          const parts = ts.split(' ');
          const dateParts = parts[0].split('/');
          const timeParts = parts[1] || '12:00';
          ts = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timeParts}:00`;
        } catch(e) {}
      }
      events.push({
        id: `obs_audit_${o.id || index}`,
        timestamp: ts,
        action: `Anotação de Campo [${(o.type || 'geral').toUpperCase()}]`,
        user: o.author || 'Sistema',
        details: o.text,
        type: 'observation'
      });
    });
  }

  // 3. Observations from matching ImportedRoute (de-duplicate by text)
  if (matchingRoute && matchingRoute.routeObservations) {
    matchingRoute.routeObservations.forEach((o, index) => {
      const isDuplicate = events.some(e => e.details === o.text);
      if (!isDuplicate) {
        let ts = o.timestamp || new Date().toISOString();
        if (ts.includes('/')) {
          try {
            const parts = ts.split(' ');
            const dateParts = parts[0].split('/');
            const timeParts = parts[1] || '12:00';
            ts = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timeParts}:00`;
          } catch(e) {}
        }
        events.push({
          id: `obs_route_${o.id || index}`,
          timestamp: ts,
          action: `Observação do Monitoramento/Balança [${(o.type || 'geral').toUpperCase()}]`,
          user: o.author || 'Monitoramento',
          details: o.text,
          type: 'observation'
        });
      }
    });
  }

  // 4. Delay Justifications (Justificativas de Atraso)
  if (matchingRoute && matchingRoute.justification) {
    events.push({
      id: `delay_${matchingRoute.id}`,
      timestamp: audit.arrivalDate ? `${audit.arrivalDate}T18:00:00.000Z` : new Date().toISOString(),
      action: `Justificativa de Atraso no Fechamento`,
      user: 'Monitoramento / Logística',
      details: matchingRoute.justification,
      type: 'delay'
    });
  }

  // 5. Surplus alignment info (Alinhamento de Sobras/Reposição)
  if (audit.clientCodeNB || audit.deliveryDate) {
    events.push({
      id: `align_${audit.id}`,
      timestamp: audit.updatedAt || new Date().toISOString(),
      action: `Alinhamento de Reposição / Sobras de P.A.`,
      user: audit.lastUpdatedBy || 'Monitoramento/Gestor',
      details: `Código NB do Cliente: ${audit.clientCodeNB || 'Não informado'} | Data Agendada para Entrega da Sobra: ${audit.deliveryDate ? new Date(audit.deliveryDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Não alinhada'}. Status do Fluxo: ${audit.surplusFlowStatus || 'PENDENTE'}.`,
      type: 'alignment'
    });
  }

  // Sort chronologically (ascending)
  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export default function FiscalView({
  currentUser,
  users = DEFAULT_USERS,
  drivers,
  onSaveDrivers,
  vehicles,
  products,
  onSaveProducts,
  activeAssets,
  audits,
  onSaveAudits,
  fiscalAlerts,
  onSaveAlerts,
  importedRoutes = [],
  onSaveImportedRoutes,
  vales = [],
  onSaveVales,
  activeTab = 'reconciliacao',
  onResetPlatformData,
  returnForecasts = [],
  onSaveForecasts,
  carregamentos = [],
  onSaveCarregamentos
}: FiscalViewProps) {
  // Navigation / Workspace selection
  const [activeSession, setActiveSession] = useState<AuditSession | null>(null);

  // Toggle Pernoite across all modules (Imported Routes, Audits, Forecasts, Carregamentos)
  const handleTogglePernoite = (target: { routeMap?: string; plate?: string; isPernoite?: boolean }) => {
    const targetMap = (target.routeMap || '').trim().toUpperCase();
    const targetPlate = (target.plate || '').trim().toUpperCase();
    const nextPernoite = !target.isPernoite;

    // 1. Update importedRoutes
    let updatedRoutes = importedRoutes;
    if (onSaveImportedRoutes && importedRoutes.length > 0) {
      updatedRoutes = importedRoutes.map(r => {
        const match = (targetMap && r.routeMap && r.routeMap.toUpperCase() === targetMap) ||
                      (targetPlate && r.plate && r.plate.toUpperCase() === targetPlate);
        if (match) {
          return {
            ...r,
            isPernoite: nextPernoite,
            descarregamentoStatus: (nextPernoite ? 'PERNOITE' : (r.unloadingEndTime ? 'DESCARREGADO' : (r.unloadingStartTime ? 'EM_DESCARGA' : 'AGUARDANDO_DESCARGA'))) as any,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser.name
          };
        }
        return r;
      });
      onSaveImportedRoutes(updatedRoutes);
    }

    // 2. Update audits
    let updatedAudits = audits;
    if (onSaveAudits && audits.length > 0) {
      updatedAudits = audits.map(a => {
        const match = (targetMap && a.routeMap && a.routeMap.toUpperCase() === targetMap) ||
                      (targetPlate && a.plate && a.plate.toUpperCase() === targetPlate);
        if (match) {
          return {
            ...a,
            isPernoite: nextPernoite,
            descarregamentoStatus: (nextPernoite ? 'PERNOITE' : (a.unloadingEndTime ? 'DESCARREGADO' : (a.unloadingStartTime ? 'EM_DESCARGA' : 'AGUARDANDO_DESCARGA'))) as any,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser.name
          };
        }
        return a;
      });
      onSaveAudits(updatedAudits);
    }

    // 3. Update returnForecasts
    let updatedForecasts = returnForecasts;
    if (onSaveForecasts && returnForecasts.length > 0) {
      updatedForecasts = returnForecasts.map(f => {
        const match = (targetMap && f.routeMap && f.routeMap.toUpperCase() === targetMap) ||
                      (targetPlate && f.plate && f.plate.toUpperCase() === targetPlate);
        if (match) {
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
    let updatedCarreg = carregamentos;
    if (onSaveCarregamentos && carregamentos && carregamentos.length > 0) {
      updatedCarreg = carregamentos.map(c => {
        const match = (targetMap && c.routeMap && c.routeMap.toUpperCase() === targetMap) ||
                      (targetPlate && c.plate && c.plate.toUpperCase() === targetPlate);
        if (match) {
          return {
            ...c,
            isPernoite: nextPernoite
          };
        }
        return c;
      });
      onSaveCarregamentos(updatedCarreg);
    }

    // 5. Direct Firestore persistence if active
    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        returnForecasts: updatedForecasts,
        carregamentoProcesses: updatedCarreg
      }).catch(err => console.error("Error saving pernoite:", err));
    }

    // 6. Dispatch custom event for real-time local sync
    window.dispatchEvent(new CustomEvent('logiroute_pernoite_updated', {
      detail: { routeMap: targetMap, plate: targetPlate, isPernoite: nextPernoite }
    }));
  };

  // Concurrency tracking state
  const [loadedSessionTime, setLoadedSessionTime] = useState<string | undefined>(undefined);

  // Prevent accidental tab closing or reload during active fiscal reconciliation
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = 'Você possui uma reconciliação fiscal em andamento. Para evitar perda de dados, conclua ou feche o painel antes de sair.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeSession]);

  // Automatically reset loadedSessionTime if session is closed
  React.useEffect(() => {
    if (!activeSession) {
      setLoadedSessionTime(undefined);
    }
  }, [activeSession]);

  // Helper to determine if a route is closed based on audits
  const isRouteClosed = (routeMap: string) => {
    const norm = normalizeMapCode(routeMap).toUpperCase();
    const upper = routeMap.trim().toUpperCase();
    return audits.some(a => {
      if (a.reopeningRequested || a.reopened || a.status === 'conferido_fisico' || a.status === 'recontagem_finalizada' || a.status === 'em_aberto' || a.status === 'reconferencia') return false;
      const aNorm = normalizeMapCode(a.routeMap).toUpperCase();
      const aUpper = a.routeMap.trim().toUpperCase();
      const isMatch = aNorm === norm || aUpper === upper ||
        (a.unifiedMaps && a.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === norm || m.trim().toUpperCase() === upper));
      const isFinished = (a.status === 'finalizado_ok' || a.status === 'finalizado_divergente') && !a.reopened;
      return isMatch && isFinished;
    });
  };

  // States for shared PDFs explorer
  const [sharedPdfs, setSharedPdfs] = useState<any[]>([]);
  const [loadingSharedPdfs, setLoadingSharedPdfs] = useState<boolean>(false);

  // State for Retroactive Refugo & Avaria Import inside Sincronizador
  const [retroImportResult, setRetroImportResult] = useState<ProcessImportResult | null>(null);
  const [isProcessingRetro, setIsProcessingRetro] = useState(false);
  const [isSavingRetro, setIsSavingRetro] = useState(false);
  const retroRefugoFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleRetroRefugoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingRetro(true);
    try {
      const result = await parseAndProcessFile(file, audits, drivers);
      setRetroImportResult(result);
    } catch (err: any) {
      console.error('Erro ao analisar arquivo de refugo:', err);
      alert('Erro ao analisar planilha ou JSON de refugo: ' + (err?.message || 'Arquivo inválido'));
    } finally {
      setIsProcessingRetro(false);
      if (retroRefugoFileInputRef.current) retroRefugoFileInputRef.current.value = '';
    }
  };

  const handleImportPreloadedRetroJson = async () => {
    setIsProcessingRetro(true);
    try {
      const res = await fetch('/audits_retroativos_import.json');
      if (!res.ok) throw new Error('Arquivo audits_retroativos_import.json não encontrado no servidor');
      const json = await res.json();

      let auditsList: any[] = json.collections?.audits || json.audits || [];
      const blob = new Blob([JSON.stringify(auditsList)], { type: 'application/json' });
      const file = new File([blob], 'audits_retroativos_import.json', { type: 'application/json' });

      const result = await parseAndProcessFile(file, audits, drivers);
      setRetroImportResult(result);
    } catch (err: any) {
      console.error('Erro ao carregar JSON pré-gerado:', err);
      alert('Erro ao carregar arquivo oficial: ' + err.message);
    } finally {
      setIsProcessingRetro(false);
    }
  };

  const handleConfirmSaveRetroAudits = async () => {
    if (!retroImportResult || retroImportResult.auditsToSave.length === 0) return;

    setIsSavingRetro(true);
    try {
      let updatedAudits = [...audits];

      for (const newAudit of retroImportResult.auditsToSave) {
        const existingIdx = updatedAudits.findIndex(a =>
          a.routeMap.toUpperCase() === newAudit.routeMap.toUpperCase() ||
          a.id === newAudit.id
        );

        if (existingIdx >= 0) {
          const existing = updatedAudits[existingIdx];
          if (!existing.isEstimated) {
            // Protection: Real physical audits conducted by conferente are kept intact
            continue;
          }
          updatedAudits[existingIdx] = { ...existing, ...newAudit };
        } else {
          updatedAudits.push(newAudit);
        }
      }

      let updatedDrivers = [...drivers];
      if (retroImportResult.newDriversToSave.length > 0) {
        for (const newDrv of retroImportResult.newDriversToSave) {
          if (!updatedDrivers.some(d => d.id === newDrv.id)) {
            updatedDrivers.push(newDrv);
          }
        }
        if (onSaveDrivers) {
          onSaveDrivers(updatedDrivers);
        }
      }

      onSaveAudits(updatedAudits);

      if (isClientFirebaseActive()) {
        await saveDirectlyToFirestore({
          audits: updatedAudits,
          drivers: updatedDrivers
        });
      }

      alert(`Sincronização realizada com sucesso!\n\n${retroImportResult.auditsToSave.length} auditorias retroativas e ${retroImportResult.unregisteredDriversCount} motoristas integrados na plataforma.`);
      setRetroImportResult(null);
    } catch (err: any) {
      console.error('Erro ao salvar auditorias retroativas:', err);
      alert('Falha ao salvar auditorias retroativas: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsSavingRetro(false);
    }
  };

  const fetchSharedPdfs = async () => {
    if (isClientFirebaseActive()) {
      console.log("[ClientFirebase] Ignorando carregamento de PDFs de rede locais (GitHub Pages).");
      setSharedPdfs([]);
      return;
    }
    setLoadingSharedPdfs(true);
    try {
      const res = await fetch("/api/shared-pdfs");
      const data = await res.json();
      if (data.success && data.files) {
        setSharedPdfs(data.files);
      }
    } catch (err) {
      console.error("Erro ao obter PDFs compartilhados:", err);
    } finally {
      setLoadingSharedPdfs(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'pasta_evidencias') {
      fetchSharedPdfs();
    }
  }, [activeTab]);

  // Monitoramento alerts overlay toggle state
  const [showMonitorAlerts, setShowMonitorAlerts] = useState(false);

  // Bottle Calculator states
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [calc600, setCalc600] = useState<number | ''>('');
  const [calc1L, setCalc1L] = useState<number | ''>('');
  const [calc300, setCalc300] = useState<number | ''>('');

  // States for adding products manually in Reconciliation Screen (FiscalView)
  const [recProductSearch, setRecProductSearch] = useState('');
  const [recSelectedProductCode, setRecSelectedProductCode] = useState('');
  const [recProductQtyToAdd, setRecProductQtyToAdd] = useState<number | ''>('');
  const [recProductFiscalQtyToAdd, setRecProductFiscalQtyToAdd] = useState<number | ''>('');

  // Observation Type tracking for each discrepancy card
  const [cardObsTypes, setCardObsTypes] = useState<Record<string, 'sobra' | 'falta' | 'todos'>>({});

  // Filter states for Sobras & Faltas
  const [filterNB, setFilterNB] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sobra' | 'falta'>('all');
  const [subTabDivergencias, setSubTabDivergencias] = useState<'all' | 'pa' | 'ag'>('all');
  const [sobrasViewMode, setSobrasViewMode] = useState<'operacional' | 'master'>('operacional');
  const [reprovingAuditId, setReprovingAuditId] = useState<string | null>(null);
  const [reprovalObservation, setReprovalObservation] = useState('');
  const [dismissedPopupAuditIds, setDismissedPopupAuditIds] = useState<string[]>([]);

  // Calculate pending surpluses aligned by Monitoramento/Gestor awaiting Auxiliar launch/reproval (1 day before delivery date)
  const pendingSurplusesForAuxiliary = React.useMemo(() => {
    return audits.filter(audit => {
      if (audit.status !== 'finalizado_ok' && audit.status !== 'finalizado_divergente') return false;
      
      // Must have NB and Delivery Date aligned
      if (!audit.clientCodeNB || !audit.deliveryDate) return false;
      
      // Must NOT be already sent, launched, closed, or reproved
      if (
        audit.surplusFlowStatus === 'ENVIADO' || 
        audit.surplusFlowStatus === 'BAIXADO' || 
        audit.surplusFlowStatus === 'REPROVADO' ||
        audit.surplusActionStatus === 'enviado_cliente' ||
        audit.surplusActionStatus === 'baixado_direto'
      ) {
        return false;
      }

      // Must not be dismissed in current local session
      if (dismissedPopupAuditIds.includes(audit.id)) return false;

      // Must have surplus items (PA or AG)
      const hasProductSurplus = (audit.items || []).some(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        return (phys + comodato - recolha) > fisc;
      });
      const hasAssetSurplus = (audit.assets || []).some(a => {
        const idLower = (a.assetId || '').toLowerCase();
        const nameUpper = (a.assetName || '').toUpperCase();
        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
        if (isChapatex) return false;

        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        return (phys + comodato - recolha) > fisc;
      });

      if (!hasProductSurplus && !hasAssetSurplus) return false;

      // Delivery date rule: Pop-up triggers 1 day before delivery date or on/after delivery date
      try {
        const [year, month, day] = audit.deliveryDate.split('-').map(Number);
        const deliveryDateVal = new Date(year, month - 1, day).getTime();

        const now = new Date();
        const todayVal = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const oneDayMs = 24 * 60 * 60 * 1000;
        const triggerTimeStart = deliveryDateVal - oneDayMs; // 1 day before

        return todayVal >= triggerTimeStart;
      } catch (err) {
        return false;
      }
    });
  }, [audits, dismissedPopupAuditIds]);
  
  // Vales State and Form States
  const [viewingVale, setViewingVale] = useState<Vale | null>(null);
  const [editingVale, setEditingVale] = useState<Vale | null>(null);
  const [valeColaboradorId, setValeColaboradorId] = useState('');
  const [valeColaboradorName, setValeColaboradorName] = useState('');
  const [valeColaboradorRole, setValeColaboradorRole] = useState('MOTORISTA');
  const [valeColaboradorValor, setValeColaboradorValor] = useState<number | undefined>(undefined);
  const [valeQuantidadeColaboradores, setValeQuantidadeColaboradores] = useState<number>(1);
  const [valeRouteMap, setValeRouteMap] = useState('');
  const [valeValeValor, setValeValeValor] = useState('');
  const [valeQuantidade, setValeQuantidade] = useState('');
  const [valeDescricao, setValeDescricao] = useState('');
  const [valeObservacao, setValeObservacao] = useState('');
  const [valeColaboradoresAdicionais, setValeColaboradoresAdicionais] = useState<ValeCollaborator[]>([]);
  const [uploadingValeId, setUploadingValeId] = useState<string | null>(null);

  // Rateio utility: splits total value evenly among count people, distributing remainder cents exactly
  const calculateRateioShares = (totalValue: number, count: number): number[] => {
    if (count <= 0) return [totalValue];
    if (!totalValue || totalValue <= 0) return Array(count).fill(0);
    const totalCents = Math.round(totalValue * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents % count;
    const shares: number[] = [];
    for (let i = 0; i < count; i++) {
      const cents = baseCents + (i < remainderCents ? 1 : 0);
      shares.push(cents / 100);
    }
    return shares;
  };

  // Adjust number of collaborators in Emission Form and automatically calculate rateio
  const handleSetEmissionNumColaboradores = (count: number) => {
    const targetCount = Math.max(1, count);
    setValeQuantidadeColaboradores(targetCount);
    const totalVal = Number(valeValeValor) || 0;
    const shares = calculateRateioShares(totalVal, targetCount);
    setValeColaboradorValor(shares[0]);

    const currentAdicionais = [...valeColaboradoresAdicionais];
    const newAdicionais: ValeCollaborator[] = [];
    for (let i = 0; i < targetCount - 1; i++) {
      const existing = currentAdicionais[i];
      newAdicionais.push({
        id: existing?.id || 'colab_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
        name: existing?.name || '',
        role: existing?.role || 'AJUDANTE',
        valor: shares[i + 1]
      });
    }
    setValeColaboradoresAdicionais(newAdicionais);
  };

  // When discount value changes in Emission Form, recalculate rateio shares immediately
  const handleEmissionValorChange = (newValStr: string) => {
    setValeValeValor(newValStr);
    const totalVal = Number(newValStr) || 0;
    const targetCount = Math.max(1, valeQuantidadeColaboradores);
    const shares = calculateRateioShares(totalVal, targetCount);
    setValeColaboradorValor(shares[0]);

    const updatedAdicionais = valeColaboradoresAdicionais.map((c, idx) => ({
      ...c,
      valor: shares[idx + 1]
    }));
    setValeColaboradoresAdicionais(updatedAdicionais);
  };

  const handleUpdateEmissionHelper = (index: number, updates: Partial<ValeCollaborator>) => {
    const next = [...valeColaboradoresAdicionais];
    while (next.length <= index) {
      next.push({
        id: 'colab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: '',
        role: 'AJUDANTE'
      });
    }
    next[index] = {
      ...next[index],
      ...updates
    };
    setValeColaboradoresAdicionais(next);
  };

  const handleClearEmissionHelper = (index: number) => {
    const next = valeColaboradoresAdicionais.filter((_, i) => i !== index);
    setValeColaboradoresAdicionais(next);
    const newCount = Math.max(1, 1 + next.length);
    setValeQuantidadeColaboradores(newCount);
    const totalVal = Number(valeValeValor) || 0;
    const shares = calculateRateioShares(totalVal, newCount);
    setValeColaboradorValor(shares[0]);
  };

  // Adjust number of collaborators in Editing Modal and automatically recalculate rateio
  const handleSetEditingNumColaboradores = (count: number) => {
    if (!editingVale) return;
    const targetCount = Math.max(1, count);
    const totalVal = Number(editingVale.valor) || 0;
    const shares = calculateRateioShares(totalVal, targetCount);

    const currentAdicionais = editingVale.colaboradoresAdicionais || [];
    const newAdicionais: ValeCollaborator[] = [];
    for (let i = 0; i < targetCount - 1; i++) {
      const existing = currentAdicionais[i];
      newAdicionais.push({
        id: existing?.id || 'colab_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5),
        name: existing?.name || '',
        role: existing?.role || 'AJUDANTE',
        valor: shares[i + 1]
      });
    }

    setEditingVale({
      ...editingVale,
      colaboradorValor: shares[0],
      colaboradoresAdicionais: newAdicionais
    });
  };

  // When discount value changes in Editing Modal, recalculate rateio shares immediately
  const handleEditingValorChange = (newVal: number) => {
    if (!editingVale) return;
    const currentCount = 1 + (editingVale.colaboradoresAdicionais?.length || 0);
    const shares = calculateRateioShares(newVal, currentCount);

    const updatedAdicionais = (editingVale.colaboradoresAdicionais || []).map((c, idx) => ({
      ...c,
      valor: shares[idx + 1]
    }));

    setEditingVale({
      ...editingVale,
      valor: newVal,
      colaboradorValor: shares[0],
      colaboradoresAdicionais: updatedAdicionais
    });
  };

  const handleUpdateEditingHelper = (index: number, updates: Partial<ValeCollaborator>) => {
    if (!editingVale) return;
    const next = [...(editingVale.colaboradoresAdicionais || [])];
    while (next.length <= index) {
      next.push({
        id: 'colab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        name: '',
        role: 'AJUDANTE'
      });
    }
    next[index] = {
      ...next[index],
      ...updates
    };
    setEditingVale({
      ...editingVale,
      colaboradoresAdicionais: next
    });
  };

  const handleClearEditingHelper = (index: number) => {
    if (!editingVale) return;
    const next = (editingVale.colaboradoresAdicionais || []).filter((_, i) => i !== index);
    const newCount = Math.max(1, 1 + next.length);
    const shares = calculateRateioShares(Number(editingVale.valor) || 0, newCount);
    setEditingVale({
      ...editingVale,
      colaboradorValor: shares[0],
      colaboradoresAdicionais: next.map((c, idx) => ({
        ...c,
        valor: shares[idx + 1]
      }))
    });
  };

  // Generate printable document strictly formatted to fit exactly 1 single A4 page
  const generatePrintableValeDocument = (valeToPrint: Vale) => {
    const associatedAudit = (audits || []).find(a => a.id === valeToPrint.auditId || a.routeMap === valeToPrint.routeMap);
    const vehiclePlate = associatedAudit?.plate || 'Não cadastrada';
    const arrivalDateFormatted = associatedAudit?.arrivalDate 
      ? new Date(associatedAudit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR') 
      : new Date(valeToPrint.dataGeracao + 'T00:00:00').toLocaleDateString('pt-BR');
    const helperName = associatedAudit?.helperId ? getHelperName(associatedAudit.helperId) : 'N/A';
    const usersList = users || DEFAULT_USERS;
    const foundUser = usersList.find(u => u.id === associatedAudit?.conferenteId || u.username === associatedAudit?.conferenteId);
    const conferenteName = foundUser 
      ? foundUser.name 
      : (associatedAudit?.conferenteId 
          ? (associatedAudit.conferenteId === 'conferente_01' ? 'João Conferente' : associatedAudit.conferenteId === 'conferente_02' ? 'Pedro Ajudante' : associatedAudit.conferenteId) 
          : 'Conferente de Pátio');

    const detailedShortages: Array<{ code: string; name: string; expected: number; found: number; comodato: number; recolha: number; diff: number; cost: number; totalCost: number }> = [];

    if (associatedAudit) {
      associatedAudit.items.forEach(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : (i.physicalQty ?? 0);
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = getSkuClosedPrice(i.productCode, i.cost ?? 45.0);
          detailedShortages.push({
            code: i.productCode,
            name: i.productDescription || 'Produto',
            expected: fisc,
            found: phys,
            comodato,
            recolha,
            diff,
            cost: unitCost,
            totalCost: diff * unitCost
          });
        }
      });

      associatedAudit.assets.forEach(a => {
        const idLower = (a.assetId || '').toLowerCase();
        const nameUpper = (a.assetName || '').toUpperCase();
        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
        if (isChapatex) return;

        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : (a.physicalQty ?? 0);
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = a.cost ?? 18.0;
          detailedShortages.push({
            code: a.assetId,
            name: a.assetName || 'Ativo',
            expected: fisc,
            found: phys,
            comodato,
            recolha,
            diff,
            cost: unitCost,
            totalCost: diff * unitCost
          });
        }
      });
    }

    const additionalColabs = valeToPrint.colaboradoresAdicionais || [];
    const totalInvolvedColabs = 1 + additionalColabs.length;
    const printCalculatedShares = calculateRateioShares(Number(valeToPrint.valor) || 0, totalInvolvedColabs);
    const principalPrintShare = valeToPrint.colaboradorValor !== undefined && valeToPrint.colaboradorValor > 0
      ? valeToPrint.colaboradorValor
      : printCalculatedShares[0];

    const additionalColabsStatement = additionalColabs.length > 0 
      ? ` em conjunto com o(s) colaborador(es) co-responsável(is) ${additionalColabs.map((c, i) => `<strong>${c.name}</strong> (${c.role} - R$ ${(c.valor !== undefined && c.valor > 0 ? c.valor : (printCalculatedShares[i + 1] ?? 0)).toFixed(2)})`).join(', ')},` 
      : '';

    const totalQty = valeToPrint.quantidade !== undefined 
      ? valeToPrint.quantidade 
      : (detailedShortages.length > 0 ? detailedShortages.reduce((sum, d) => sum + d.diff, 0) : null);

    // Limit shortage items to top 5 rows + consolidated row to strictly guarantee 1 page
    const maxItemsToShow = 5;
    const itemsToShow = detailedShortages.slice(0, maxItemsToShow);
    const hiddenItemsCount = detailedShortages.length - maxItemsToShow;
    const hiddenItemsTotalCost = hiddenItemsCount > 0 
      ? detailedShortages.slice(maxItemsToShow).reduce((s, it) => s + it.totalCost, 0) 
      : 0;
    const hiddenItemsTotalDiff = hiddenItemsCount > 0 
      ? detailedShortages.slice(maxItemsToShow).reduce((s, it) => s + it.diff, 0) 
      : 0;

    const shortageRowsHtml = itemsToShow.map(item => `
      <tr>
        <td style="padding: 7px 9px; font-family: monospace; font-weight: bold; color: #475569;">${item.code}</td>
        <td style="padding: 7px 9px; font-weight: 600;">${item.name}</td>
        <td style="padding: 7px 9px; text-align: center; font-family: monospace;">${item.expected}</td>
        <td style="padding: 7px 9px; text-align: center; font-family: monospace;">${item.found}</td>
        <td style="padding: 7px 9px; text-align: center; font-family: monospace; font-weight: bold; color: #d97706;">${item.comodato > 0 ? item.comodato : '-'}</td>
        <td style="padding: 7px 9px; text-align: center; font-family: monospace; font-weight: bold; color: #dc2626;">-${item.diff}</td>
        <td style="padding: 7px 9px; text-align: right; font-family: monospace;">R$ ${item.cost.toFixed(2)}</td>
        <td style="padding: 7px 9px; text-align: right; font-family: monospace; font-weight: bold; color: #0f172a;">R$ ${item.totalCost.toFixed(2)}</td>
      </tr>
    `).join('');

    const hiddenRowHtml = hiddenItemsCount > 0 ? `
      <tr style="background: #f8fafc; font-style: italic; color: #64748b;">
        <td colspan="5" style="padding: 6px 9px;">+ ${hiddenItemsCount} outros itens detalhados no laudo de retorno físico</td>
        <td style="padding: 6px 9px; text-align: center; font-family: monospace; font-weight: bold; color: #dc2626;">-${hiddenItemsTotalDiff}</td>
        <td style="padding: 6px 9px; text-align: right;">---</td>
        <td style="padding: 6px 9px; text-align: right; font-family: monospace; font-weight: bold;">R$ ${hiddenItemsTotalCost.toFixed(2)}</td>
      </tr>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Termo de Vale ${valeToPrint.id}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    .print-card {
      width: 100%;
      min-height: calc(297mm - 16mm);
      height: 100%;
      padding: 4px 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .company-title {
      font-size: 19px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.01em;
      color: #0f172a;
    }
    .company-sub {
      font-size: 10.5px;
      color: #475569;
      font-family: monospace;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .company-tag {
      font-size: 10px;
      font-weight: bold;
      color: #b45309;
      text-transform: uppercase;
      margin-top: 3px;
      display: block;
    }
    .badge-vale {
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 12px;
      text-align: right;
    }
    .badge-vale-label {
      font-size: 9px;
      color: #64748b;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-vale-id {
      font-family: monospace;
      font-size: 16px;
      font-weight: 900;
      color: #dc2626;
      line-height: 1.2;
    }
    .badge-vale-date {
      font-size: 9.5px;
      color: #475569;
      font-family: monospace;
    }
    .title-banner {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      text-align: center;
      padding: 9px 12px;
      margin-bottom: 10px;
    }
    .title-banner h2 {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .title-banner span {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      display: block;
      margin-top: 3px;
    }
    .declaration {
      background: #fffbeb;
      border: 1.5px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 11px 15px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.55;
      text-align: justify;
      color: #78350f;
      margin-bottom: 10px;
    }
    .declaration strong {
      color: #0f172a;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      padding: 11px 15px;
      font-size: 11.5px;
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .info-col-title {
      font-weight: 900;
      font-size: 10px;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.04em;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-bottom: 5px;
    }
    .info-grid strong {
      color: #0f172a;
    }
    .table-container {
      margin-bottom: 10px;
    }
    .table-title {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      margin-bottom: 5px;
      letter-spacing: 0.02em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
    }
    th {
      background: #f1f5f9;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      color: #334155;
      letter-spacing: 0.03em;
    }
    .obs-box {
      background: #f8fafc;
      border: 1.5px solid #e2e8f0;
      border-radius: 6px;
      padding: 9px 13px;
      font-size: 11px;
      color: #475569;
      font-style: italic;
      margin-bottom: 10px;
    }
    .legal-notice {
      font-size: 9.5px;
      color: #64748b;
      text-align: justify;
      line-height: 1.45;
      margin-bottom: 15px;
      padding: 0 2px;
    }
    .signatures-area {
      margin-top: auto;
      padding-top: 10px;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(${additionalColabs.length > 2 ? 4 : (additionalColabs.length > 0 ? 3 + additionalColabs.length : 3)}, 1fr);
      gap: 12px 14px;
      text-align: center;
    }
    .sig-line {
      border-top: 1.5px solid #475569;
      padding-top: 6px;
      margin-top: 36px;
    }
    .sig-name {
      font-weight: 800;
      font-size: 11px;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
    }
    .sig-role {
      font-size: 9.5px;
      color: #64748b;
      text-transform: uppercase;
      font-family: monospace;
      font-weight: 600;
      display: block;
      margin-top: 1px;
    }
    .sig-cota {
      font-size: 10px;
      font-weight: 900;
      font-family: monospace;
      color: #065f46;
      background: #ecfdf5;
      border: 1.5px solid #a7f3d0;
      border-radius: 4px;
      padding: 2px 6px;
      display: inline-block;
      margin-top: 5px;
      letter-spacing: 0.02em;
    }
    .sig-auth {
      font-size: 9px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 2px 6px;
      display: inline-block;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="print-card">
    <div>
      <!-- Header -->
      <div class="header">
        <div>
          <div class="company-title">PAU BRASIL DISTRIBUIDORA LTDA</div>
          <div class="company-sub">Logística de Retorno & Aferição Física • Unidade Guarabira/PB</div>
          <div class="company-tag">
            Documento Oficial de Termo de Responsabilidade e Desconto
          </div>
        </div>
        <div class="badge-vale">
          <div class="badge-vale-label">Vale Financeiro Nº</div>
          <div class="badge-vale-id">${valeToPrint.id}</div>
          <div class="badge-vale-date">Emissão: ${new Date(valeToPrint.dataGeracao + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <!-- Title Banner -->
      <div class="title-banner">
        <h2>Autorização de Desconto em Folha de Pagamento</h2>
        <span>Fundamentação Legal: Artigo 462, § 1º da Consolidação das Leis do Trabalho (CLT)</span>
      </div>

      <!-- Main Declaration -->
      <div class="declaration">
        Eu, <strong>${valeToPrint.colaboradorName}</strong>, registrado na função de <strong>${valeToPrint.colaboradorRole}</strong>,${additionalColabsStatement} autorizo(amos) expressamente a empresa <strong>PAU BRASIL DISTRIBUIDORA LTDA</strong> a proceder com o desconto em folha de pagamento da importância líquida de <strong>R$ ${valeToPrint.valor.toFixed(2)}</strong> (${valeToPrint.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}), referente a desvios físicos de estoque, faltas ou avarias constatadas no encerramento logístico do <strong>${valeToPrint.routeMap !== 'AVULSO' ? `Mapa de Carga nº ${valeToPrint.routeMap}` : 'Mapa de Carga Avulso'}</strong>.
      </div>

      <!-- Info Grid -->
      <div class="info-grid">
        <div>
          <div class="info-col-title">Informações da Rota / Transporte</div>
          <div><strong>Mapa de Carga:</strong> <span style="font-family: monospace; font-weight: bold;">${valeToPrint.routeMap}</span></div>
          <div><strong>Placa do Veículo:</strong> <span style="font-family: monospace; text-transform: uppercase; font-weight: bold;">${vehiclePlate}</span></div>
          <div><strong>Data da Viagem:</strong> ${arrivalDateFormatted}</div>
          <div><strong>Volumes / Quantidade:</strong> <span style="font-weight: bold;">${totalQty !== null ? `${totalQty} volumes/itens` : 'Conforme laudo'}</span></div>
        </div>
        <div>
          <div class="info-col-title">Equipe da Operação & Aferição</div>
          <div><strong>Responsável:</strong> ${valeToPrint.colaboradorName} (${valeToPrint.colaboradorRole}${valeToPrint.colaboradorValor ? ` - Cota: R$ ${valeToPrint.colaboradorValor.toFixed(2)}` : ''})</div>
          ${additionalColabs.length > 0 ? `<div><strong>Ajudantes / Co-responsáveis:</strong> ${additionalColabs.map(c => `${c.name} (${c.role}${c.valor ? ` - Cota: R$ ${c.valor.toFixed(2)}` : ''})`).join(', ')}</div>` : `<div><strong>Ajudante da Rota:</strong> ${helperName}</div>`}
          <div><strong>Conferente de Pátio:</strong> ${conferenteName}</div>
          <div><strong>Fiscal / Emissor:</strong> ${currentUser.name}</div>
        </div>
      </div>

      <!-- Shortage Details -->
      <div class="table-container">
        <div class="table-title">
          Demonstrativo de Itens em Falta / Desvios Constatados:
        </div>
        ${detailedShortages.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descrição do Produto / Vasilhame</th>
                <th style="text-align: center;">Faturado</th>
                <th style="text-align: center;">Conferido</th>
                <th style="text-align: center; color: #d97706;">Comodato</th>
                <th style="text-align: center; color: #dc2626;">Falta</th>
                <th style="text-align: right;">Custo Unit.</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${shortageRowsHtml}
              ${hiddenRowHtml}
              <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="5" style="text-align: right; text-transform: uppercase; padding: 7px 9px;">Total do Desconto Autorizado:</td>
                <td style="text-align: center; font-family: monospace; color: #dc2626; font-weight: bold; padding: 7px 9px;">-${detailedShortages.reduce((s, d) => s + d.diff, 0)} vol</td>
                <td colspan="2" style="text-align: right; font-family: monospace; font-size: 13px; font-weight: 900; color: #dc2626; padding: 7px 9px;">R$ ${(Number(valeToPrint.valor) || 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        ` : `
          <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; font-size: 12px;">
            <div><strong>Descrição da Falta:</strong> ${valeToPrint.descricao}</div>
            <div style="margin-top: 5px; font-weight: bold; color: #dc2626; font-size: 13px;">Valor Total Autorizado: R$ ${(Number(valeToPrint.valor) || 0).toFixed(2)}</div>
          </div>
        `}
      </div>

      ${valeToPrint.observacao ? `
        <div class="obs-box">
          <strong>Observações do Emissor:</strong> ${valeToPrint.observacao}
        </div>
      ` : ''}

      <div class="legal-notice">
        O presente termo decorre de procedimento de aferição física no retorno de rota e expressa a concordância do colaborador com a reposição do prejuízo constatado, em estrita conformidade com o Artigo 462, § 1º da CLT e com as normas regulamentares internas de guarda e responsabilidade patrimonial da Pau Brasil Distribuidora Ltda.
      </div>
    </div>

    <!-- Signatures -->
    <div class="signatures-area">
      <div class="signatures">
        <div class="sig-block">
          <div class="sig-line">
            <span class="sig-name">${valeToPrint.colaboradorName}</span>
            <span class="sig-role">${valeToPrint.colaboradorRole} (Principal)</span>
            <div class="sig-cota">Valor Rateado: R$ ${principalPrintShare.toFixed(2)}</div>
          </div>
        </div>
        ${additionalColabs.map((c, i) => {
          const helperShare = c.valor !== undefined && c.valor > 0 ? c.valor : (printCalculatedShares[i + 1] ?? 0);
          return `
            <div class="sig-block">
              <div class="sig-line">
                <span class="sig-name">${c.name}</span>
                <span class="sig-role">${c.role} ${additionalColabs.length > 1 ? `(${i + 1}º Ajudante)` : ''}</span>
                <div class="sig-cota">Valor Rateado: R$ ${helperShare.toFixed(2)}</div>
              </div>
            </div>
          `;
        }).join('')}
        <div class="sig-block">
          <div class="sig-line">
            <span class="sig-name">${currentUser.name}</span>
            <span class="sig-role">Fiscal de Logística</span>
            <div class="sig-auth">Emissor / Aferição</div>
          </div>
        </div>
        <div class="sig-block">
          <div class="sig-line">
            <span class="sig-name">Elisson Minervino</span>
            <span class="sig-role">Gestor de Logística</span>
            <div class="sig-auth">Autorização Gerencial</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  const handlePrintVale = (valeToPrint: Vale) => {
    let iframe = document.getElementById('vale-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'vale-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const html = generatePrintableValeDocument(valeToPrint);
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  };

  // Vale Map mode: 'lista' (from maps with shortage) or 'manual' (type any map number)
  const [valeMapMode, setValeMapMode] = useState<'lista' | 'manual'>('lista');
  const [valeAssociatedInfo, setValeAssociatedInfo] = useState<{
    found: boolean;
    hasShortage: boolean;
    map: string;
    auditId?: string;
    driverName?: string;
    driverId?: string;
    plate?: string;
    totalValue?: number;
    description?: string;
    alreadyHasVale?: boolean;
    items?: Array<{ name: string; qty: number; unitCost: number; totalCost: number; isAsset: boolean }>;
  } | null>(null);

  // Dynamic helper to inspect and associate any map (manual or list) with audits and missing items
  const inspectAndAssociateMap = (mapCode: string, autoFill = true) => {
    const raw = (mapCode || '').trim();
    if (!raw) {
      setValeAssociatedInfo(null);
      return null;
    }

    const norm = raw.toUpperCase();
    const cleanNum = normalizeMapCode(raw);

    // Look in audits first
    const matchingAudit = (audits || []).find(a => {
      const aMap = (a.routeMap || '').trim();
      return aMap.toUpperCase() === norm || (cleanNum && normalizeMapCode(aMap) === cleanNum);
    });

    if (matchingAudit) {
      let totalVal = 0;
      const parts: string[] = [];
      const itemDetails: Array<{ name: string; qty: number; unitCost: number; totalCost: number; isAsset: boolean }> = [];

      (matchingAudit.items || []).forEach(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : (i.physicalQty ?? 0);
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = getSkuClosedPrice(i.productCode, i.cost ?? 45.0);
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          const comodatoText = comodato > 0 ? ` (${comodato} em comodato deduzido)` : '';
          parts.push(`Falta de ${diff} cx de ${i.productDescription || 'Produto'}${comodatoText}`);
          itemDetails.push({
            name: i.productDescription || `Produto ${i.productCode}`,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: false
          });
        }
      });

      (matchingAudit.assets || []).forEach(a => {
        const idLower = (a.assetId || '').toLowerCase();
        const nameUpper = (a.assetName || '').toUpperCase();
        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
        if (isChapatex) return;

        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : (a.physicalQty ?? 0);
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = a.cost ?? 18.0;
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          const comodatoText = comodato > 0 ? ` (${comodato} em comodato deduzido)` : '';
          parts.push(`Falta de ${diff}x ${a.assetName || 'Ativo'}${comodatoText}`);
          itemDetails.push({
            name: a.assetName || (a as any).assetCode || a.assetId,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: true
          });
        }
      });

      const matchedDriver = drivers.find(d => d.id === matchingAudit.driverId);
      const matchedRoute = (importedRoutes || []).find(r => (r.routeMap || '').trim().toUpperCase() === norm || (cleanNum && normalizeMapCode(r.routeMap) === cleanNum));
      const driverName = matchedDriver?.name || matchedRoute?.driverName || (matchingAudit.driverId ? `Motorista (${matchingAudit.driverId})` : 'Motorista não vinculado');
      const plate = matchingAudit.plate || matchedRoute?.plate || '---';
      const alreadyHasVale = (vales || []).some(v => (v.routeMap || '').trim().toUpperCase() === norm || (cleanNum && normalizeMapCode(v.routeMap) === cleanNum));

      const info = {
        found: true,
        auditId: matchingAudit.id,
        hasShortage: totalVal > 0 || itemDetails.length > 0,
        map: matchingAudit.routeMap || raw,
        driverName,
        driverId: matchingAudit.driverId || matchedRoute?.driverId,
        plate,
        totalValue: totalVal,
        description: parts.join(' e ') || `Conferência do mapa ${matchingAudit.routeMap || raw} sem divergências de falta.`,
        alreadyHasVale,
        items: itemDetails
      };

      setValeAssociatedInfo(info);

      if (autoFill) {
        if (info.driverId) {
          setValeColaboradorId(info.driverId);
          setValeColaboradorName(info.driverName || '');
          setValeColaboradorRole('MOTORISTA');
        }
        if (info.hasShortage) {
          setValeValeValor(totalVal.toFixed(2));
          setValeDescricao(info.description);
          const totalQty = itemDetails.reduce((sum, it) => sum + it.qty, 0);
          setValeQuantidade(totalQty > 0 ? String(totalQty) : '');
        }

        // Pre-fill Helper 1 if present in audit session or route and calculate rateio
        const matchedHelperId = matchingAudit.helperId || matchedRoute?.helperId;
        const matchedHelper = drivers.find(d => d.id === matchedHelperId);
        if (matchedHelper) {
          setValeQuantidadeColaboradores(2);
          const shares = calculateRateioShares(totalVal, 2);
          setValeColaboradorValor(shares[0]);
          setValeColaboradoresAdicionais([{
            id: matchedHelper.id,
            name: matchedHelper.name,
            role: 'AJUDANTE',
            valor: shares[1]
          }]);
        } else {
          setValeQuantidadeColaboradores(1);
          setValeColaboradorValor(totalVal > 0 ? totalVal : undefined);
          setValeColaboradoresAdicionais([]);
        }
      }
      return info;
    }

    // Check importedRoutes
    const matchedRoute = (importedRoutes || []).find(r => (r.routeMap || '').trim().toUpperCase() === norm || (cleanNum && normalizeMapCode(r.routeMap) === cleanNum));
    if (matchedRoute) {
      const matchedDriver = drivers.find(d => d.id === matchedRoute.driverId || d.name?.toUpperCase() === matchedRoute.driverName?.toUpperCase());
      const alreadyHasVale = (vales || []).some(v => (v.routeMap || '').trim().toUpperCase() === norm || (cleanNum && normalizeMapCode(v.routeMap) === cleanNum));
      const info = {
        found: true,
        hasShortage: false,
        map: matchedRoute.routeMap || raw,
        driverName: matchedDriver?.name || matchedRoute.driverName || 'Motorista da rota',
        driverId: matchedDriver?.id || matchedRoute.driverId,
        plate: matchedRoute.plate || '---',
        totalValue: 0,
        description: `Mapa ${raw} localizado na grade de rotas (sem divergência cadastrada).`,
        alreadyHasVale,
        items: []
      };
      setValeAssociatedInfo(info);
      if (autoFill && info.driverId) {
        setValeColaboradorId(info.driverId);
        setValeColaboradorName(info.driverName || '');
        setValeColaboradorRole('MOTORISTA');
        const matchedHelperId = matchedRoute.helperId;
        const matchedHelper = drivers.find(d => d.id === matchedHelperId);
        if (matchedHelper) {
          setValeQuantidadeColaboradores(2);
          const shares = calculateRateioShares(0, 2);
          setValeColaboradorValor(shares[0]);
          setValeColaboradoresAdicionais([{
            id: matchedHelper.id,
            name: matchedHelper.name,
            role: 'AJUDANTE',
            valor: shares[1]
          }]);
        } else {
          setValeQuantidadeColaboradores(1);
          setValeColaboradorValor(undefined);
          setValeColaboradoresAdicionais([]);
        }
      }
      return info;
    }

    // Completely manual / unlisted map
    const info = {
      found: false,
      hasShortage: false,
      map: raw,
      driverName: undefined,
      driverId: undefined,
      plate: undefined,
      totalValue: 0,
      description: `Mapa ${raw} manual (avulso). Preencha o colaborador, valor e motivo.`,
      alreadyHasVale: (vales || []).some(v => (v.routeMap || '').trim().toUpperCase() === norm || (cleanNum && normalizeMapCode(v.routeMap) === cleanNum)),
      items: []
    };
    setValeAssociatedInfo(info);
    return info;
  };

  // Comprehensive list of maps with registered shortages
  const mapsWithShortagesList = React.useMemo(() => {
    const list: Array<{
      routeMap: string;
      driverId?: string;
      driverName: string;
      plate: string;
      totalShortageValue: number;
      description: string;
      missingCount: number;
      alreadyHasVale: boolean;
      items: Array<{ name: string; qty: number; unitCost: number; totalCost: number; isAsset: boolean }>;
    }> = [];

    const seen = new Set<string>();

    (audits || []).forEach(audit => {
      const rawMap = (audit.routeMap || '').trim();
      if (!rawMap) return;
      const key = rawMap.toUpperCase();
      if (seen.has(key)) return;

      let totalVal = 0;
      const parts: string[] = [];
      const itemDetails: Array<{ name: string; qty: number; unitCost: number; totalCost: number; isAsset: boolean }> = [];

      (audit.items || []).forEach(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : (i.physicalQty ?? 0);
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = getSkuClosedPrice(i.productCode, i.cost ?? 45.0);
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          parts.push(`Falta de ${diff} cx de ${i.productDescription || 'Produto'}`);
          itemDetails.push({
            name: i.productDescription || `SKU ${i.productCode}`,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: false
          });
        }
      });

      (audit.assets || []).forEach(a => {
        const idLower = (a.assetId || '').toLowerCase();
        const nameUpper = (a.assetName || '').toUpperCase();
        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
        if (isChapatex) return;

        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : (a.physicalQty ?? 0);
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = a.cost ?? 18.0;
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          parts.push(`Falta de ${diff}x ${a.assetName || 'Ativo'}`);
          itemDetails.push({
            name: a.assetName || (a as any).assetCode || a.assetId,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: true
          });
        }
      });

      if (totalVal > 0 || itemDetails.length > 0) {
        seen.add(key);
        const matchedDriver = drivers.find(d => d.id === audit.driverId);
        const matchedRoute = (importedRoutes || []).find(r => (r.routeMap || '').trim().toUpperCase() === key);
        const driverName = matchedDriver?.name || matchedRoute?.driverName || (audit.driverId ? `Motorista (${audit.driverId})` : 'Motorista não vinculado');
        const plate = audit.plate || matchedRoute?.plate || '---';
        const alreadyHasVale = (vales || []).some(v => (v.routeMap || '').trim().toUpperCase() === key);

        list.push({
          routeMap: audit.routeMap,
          driverId: audit.driverId || matchedRoute?.driverId,
          driverName,
          plate,
          totalShortageValue: totalVal,
          description: parts.join(' e ') || `Faltas encontradas no mapa ${rawMap}`,
          missingCount: itemDetails.length,
          alreadyHasVale,
          items: itemDetails
        });
      }
    });

    (importedRoutes || []).forEach(r => {
      const rawMap = (r.routeMap || '').trim();
      if (!rawMap) return;
      const key = rawMap.toUpperCase();
      if (seen.has(key)) return;

      const audit = (audits || []).find(a => (a.routeMap || '').trim().toUpperCase() === key);
      if (!audit) return;

      let totalVal = 0;
      const parts: string[] = [];
      const itemDetails: Array<{ name: string; qty: number; unitCost: number; totalCost: number; isAsset: boolean }> = [];

      (audit.items || []).forEach(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : (i.physicalQty ?? 0);
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = getSkuClosedPrice(i.productCode, i.cost ?? 45.0);
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          parts.push(`Falta de ${diff} cx de ${i.productDescription || 'Produto'}`);
          itemDetails.push({
            name: i.productDescription || `SKU ${i.productCode}`,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: false
          });
        }
      });

      (audit.assets || []).forEach(a => {
        const idLower = (a.assetId || '').toLowerCase();
        const nameUpper = (a.assetName || '').toUpperCase();
        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
        if (isChapatex) return;

        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : (a.physicalQty ?? 0);
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        const netDiff = (phys + comodato - recolha) - fisc;
        if (netDiff < 0) {
          const diff = Math.abs(netDiff);
          const unitCost = a.cost ?? 18.0;
          const subtotal = diff * unitCost;
          totalVal += subtotal;
          parts.push(`Falta de ${diff}x ${a.assetName || 'Ativo'}`);
          itemDetails.push({
            name: a.assetName || (a as any).assetCode || a.assetId,
            qty: diff,
            unitCost,
            totalCost: subtotal,
            isAsset: true
          });
        }
      });

      if (totalVal > 0) {
        seen.add(key);
        const matchedDriver = drivers.find(d => d.id === r.driverId || d.name?.toUpperCase() === r.driverName?.toUpperCase());
        const driverName = matchedDriver?.name || r.driverName || 'Motorista da rota';
        const alreadyHasVale = (vales || []).some(v => (v.routeMap || '').trim().toUpperCase() === key);

        list.push({
          routeMap: r.routeMap,
          driverId: r.driverId,
          driverName,
          plate: r.plate || '---',
          totalShortageValue: totalVal,
          description: parts.join(' e ') || `Faltas encontradas no mapa ${rawMap}`,
          missingCount: itemDetails.length,
          alreadyHasVale,
          items: itemDetails
        });
      }
    });

    return list.sort((a, b) => {
      if (a.alreadyHasVale !== b.alreadyHasVale) return a.alreadyHasVale ? 1 : -1;
      return b.totalShortageValue - a.totalShortageValue;
    });
  }, [audits, drivers, importedRoutes, vales]);

  // Custom Confirmation Modal state
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
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [activeSessionPhotos, setActiveSessionPhotos] = useState<PhotoRecord[]>([]);
  const [selectedPhotoForPreview, setSelectedPhotoForPreview] = useState<PhotoRecord | null>(null);
  const [selectedPhotoScale, setSelectedPhotoScale] = useState(1);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Daily Production & Simulated Memory States
  const [dailyProductionDate, setDailyProductionDate] = useState('2026-07-05');
  const [exportingDailyProduction, setExportingDailyProduction] = useState(false);
  const [showMemoryWarning, setShowMemoryWarning] = useState(false);
  const [isBatchDownloadingHistory, setIsBatchDownloadingHistory] = useState(false);
  const [batchDownloadProgress, setBatchDownloadProgress] = useState<{ current: number; total: number; map: string } | null>(null);
  const [isExportingHistoryExcel, setIsExportingHistoryExcel] = useState(false);
  const [isExportingHistoryPDF, setIsExportingHistoryPDF] = useState(false);
  const [isExportingHistoryJSON, setIsExportingHistoryJSON] = useState(false);

  React.useEffect(() => {
    let active = true;
    let interval: any = null;

    const load = () => {
      if (activeSession?.id) {
        ImageDB.getPhotosByAudit(activeSession.id)
          .then(res => {
            if (active) setActiveSessionPhotos(res);
          })
          .catch(err => console.error("Erro ao carregar fotos da sessão ativa:", err));
      }
    };

    if (activeSession?.id) {
      load();
    } else {
      setActiveSessionPhotos([]);
    }

    const handlePhotosUpdated = () => {
      load();
    };
    window.addEventListener('logiroute_photos_updated', handlePhotosUpdated);

    return () => {
      active = false;
      window.removeEventListener('logiroute_photos_updated', handlePhotosUpdated);
    };
  }, [activeSession?.id, activeSession?.status, activeSession?.refugos?.length, activeSession?.history?.length]);

  // Synchronize activeSession with updates from parent audits (real-time sync, checking for conflicts)
  React.useEffect(() => {
    if (activeSession) {
      const currentInAudits = audits.find(a => a.id === activeSession.id);
      if (currentInAudits) {
        // Construct a merged version that preserves locally typed fiscal quantities to avoid overwrites
        const mergedItems = currentInAudits.items.map(item => {
          const localItem = activeSession.items.find(i => i.productCode === item.productCode);
          return {
            ...item,
            fiscalQty: localItem && localItem.fiscalQty !== undefined ? localItem.fiscalQty : item.fiscalQty,
            comodatoQty: localItem && localItem.comodatoQty !== undefined ? localItem.comodatoQty : item.comodatoQty,
            recolhaQty: localItem && localItem.recolhaQty !== undefined ? localItem.recolhaQty : item.recolhaQty
          };
        });

        const mergedAssets = currentInAudits.assets.map(asset => {
          const localAsset = activeSession.assets.find(a => a.assetId === asset.assetId);
          return {
            ...asset,
            fiscalQty: localAsset && localAsset.fiscalQty !== undefined ? localAsset.fiscalQty : asset.fiscalQty,
            comodatoQty: localAsset && localAsset.comodatoQty !== undefined ? localAsset.comodatoQty : asset.comodatoQty,
            recolhaQty: localAsset && localAsset.recolhaQty !== undefined ? localAsset.recolhaQty : asset.recolhaQty
          };
        });

        const mergedSession: AuditSession = {
          ...currentInAudits,
          items: mergedItems,
          assets: mergedAssets
        };

        if (JSON.stringify(mergedSession) !== JSON.stringify(activeSession)) {
          const hasConflict = currentInAudits.updatedAt && 
                              loadedSessionTime && 
                              currentInAudits.updatedAt !== loadedSessionTime && 
                              currentInAudits.lastUpdatedBy !== currentUser.name;

          if (!hasConflict) {
            setActiveSession(mergedSession);
            // Also keep loadedSessionTime updated if seamlessly merged
            setLoadedSessionTime(currentInAudits.updatedAt);
          }
        }
      }
    }
  }, [audits, activeSession?.id, loadedSessionTime, currentUser.name]);
  
  // Helper to get local date in YYYY-MM-DD format
  const getTodayLocalDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date and state for Route Import - ALWAYS starts on today's local date, fully controllable by the user
  const [routeImportDate, setRouteImportDate] = useState<string>(() => getTodayLocalDateStr());

  // Auto-assign and balance circular blitz routes (exactly 2 per day, swapping out pernoite vehicles)
  React.useEffect(() => {
    if (!importedRoutes || importedRoutes.length === 0 || !onSaveImportedRoutes) return;
    
    // Find routes of the active date
    const routesForActiveDate = importedRoutes.filter(r => 
      r.routeDate === routeImportDate || 
      (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate))
    );
    if (routesForActiveDate.length === 0) return;

    // Identify distinct pernoite plates (tripStatus === 'pernoitam')
    const pernoitePlates = new Set(
      (returnForecasts || [])
        .filter(f => isForecastActivePernoite(f, audits, importedRoutes))
        .map(f => f.plate.trim().toUpperCase())
    );

    // Find routes that are currently marked as blitz
    const currentBlitzRoutes = routesForActiveDate.filter(r => r.isBlitz);
    
    // Check if any current blitz route is on a pernoite vehicle, or if we don't match the target blitz count
    const hasPernoiteInBlitz = currentBlitzRoutes.some(r => r.plate && pernoitePlates.has(r.plate.trim().toUpperCase()));
    const targetBlitzCount = Math.min(2, routesForActiveDate.length);
    const needsRecalculation = (currentBlitzRoutes.length !== targetBlitzCount && routesForActiveDate.length > 0) || hasPernoiteInBlitz;

    if (needsRecalculation) {
      // Choose exactly 2 circular blitz routes, avoiding pernoite plates
      const blitzMaps = selectCircularBlitzRoutes(routesForActiveDate, returnForecasts, currentBlitzRoutes, audits);
      const updated = importedRoutes.map(r => {
        const isThisDate = r.routeDate === routeImportDate || (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate));
        if (isThisDate) {
          const shouldBeBlitz = blitzMaps.includes(r.routeMap);
          if (r.isBlitz !== shouldBeBlitz) {
            return { ...r, isBlitz: shouldBeBlitz };
          }
        }
        return r;
      });

      // Avoid infinite update loops by checking if there is any actual difference in isBlitz flags
      const isDifferent = updated.some((r, idx) => r.isBlitz !== importedRoutes[idx].isBlitz);
      if (isDifferent) {
        onSaveImportedRoutes(updated);
      }
    }
  }, [importedRoutes, routeImportDate, returnForecasts, audits, onSaveImportedRoutes]);

  // Retroactively align driverIds of imported routes with the registered drivers on the platform
  React.useEffect(() => {
    if (!importedRoutes || importedRoutes.length === 0 || !onSaveImportedRoutes || !drivers || drivers.length === 0) return;

    let hasChanges = false;
    const updatedRoutes = importedRoutes.map(route => {
      // If the route has a driverId, but it is NOT an exact match of any driver.id and is not 'temporario'
      if (route.driverId && route.driverId !== 'temporario') {
        const exactDriver = drivers.find(d => d.id === route.driverId);
        if (!exactDriver) {
          // Try to match it using our robust matching logic
          const matchedId = matchDriverFromColumnValue(route.driverId, drivers);
          if (matchedId && matchedId !== route.driverId) {
            hasChanges = true;
            return { ...route, driverId: matchedId };
          }
        }
      }
      return route;
    });

    if (hasChanges) {
      onSaveImportedRoutes(updatedRoutes);
    }
  }, [importedRoutes, drivers, onSaveImportedRoutes]);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(true);

  // States for manual map insertion
  const [manualMap, setManualMap] = useState('');
  const [manualPlate, setManualPlate] = useState('');
  const [manualDate, setManualDate] = useState(routeImportDate);
  const [manualDriverId, setManualDriverId] = useState('');

  React.useEffect(() => {
    setManualDate(routeImportDate);
  }, [routeImportDate]);

  // States for History dashboard & search
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [selectedHistoryAudit, setSelectedHistoryAudit] = useState<AuditSession | null>(null);
  const [reopeningJustificationText, setReopeningJustificationText] = useState('');

  const handleDeleteRouteComplete = (route: ImportedRoute) => {
    const routeMapNorm = normalizeMapCode(route.routeMap).toUpperCase();
    const routeMapUpper = (route.routeMap || '').toUpperCase().trim();
    const plateUpper = (route.plate || '').toUpperCase().trim();

    // 1. Remove from imported routes
    const updatedRoutes = (importedRoutes || []).filter(r => {
      const rMapNorm = normalizeMapCode(r.routeMap).toUpperCase();
      const rMapUpper = (r.routeMap || '').toUpperCase().trim();
      if (r.id === route.id) return false;
      if (routeMapUpper && (rMapUpper === routeMapUpper || rMapNorm === routeMapNorm)) return false;
      return true;
    });
    if (onSaveImportedRoutes) {
      onSaveImportedRoutes(updatedRoutes);
    }

    // 2. Remove from audits
    let updatedAudits = audits || [];
    if (onSaveAudits && audits) {
      updatedAudits = audits.filter(a => {
        const aMapNorm = normalizeMapCode(a.routeMap).toUpperCase();
        const aMapUpper = (a.routeMap || '').toUpperCase().trim();
        const aPlateUpper = (a.plate || '').toUpperCase().trim();
        const isMapMatch = routeMapUpper && (aMapUpper === routeMapUpper || aMapNorm === routeMapNorm);
        const isPlateMatch = plateUpper && aPlateUpper === plateUpper && (isMapMatch || !a.routeMap);
        return !isMapMatch && !isPlateMatch;
      });
      onSaveAudits(updatedAudits);
    }

    // 3. Remove from carregamentos
    let updatedCarreg = carregamentos || [];
    if (onSaveCarregamentos && carregamentos) {
      updatedCarreg = carregamentos.filter(c => {
        const cMapNorm = normalizeMapCode(c.routeMap).toUpperCase();
        const cMapUpper = (c.routeMap || '').toUpperCase().trim();
        const cPlateUpper = (c.plate || '').toUpperCase().trim();
        const isMapMatch = routeMapUpper && (cMapUpper === routeMapUpper || cMapNorm === routeMapNorm);
        const isPlateMatch = plateUpper && cPlateUpper === plateUpper && (isMapMatch || !c.routeMap);
        return !isMapMatch && !isPlateMatch;
      });
      onSaveCarregamentos(updatedCarreg);
    }

    // 4. Remove from vales
    let updatedVales = vales || [];
    if (onSaveVales && vales) {
      updatedVales = vales.filter(v => {
        const vMapNorm = normalizeMapCode(v.routeMap).toUpperCase();
        const vMapUpper = (v.routeMap || '').toUpperCase().trim();
        return !routeMapUpper || (vMapUpper !== routeMapUpper && vMapNorm !== routeMapNorm);
      });
      onSaveVales(updatedVales);
    }

    // 5. Remove from alerts
    let updatedAlerts = fiscalAlerts || [];
    if (onSaveAlerts && fiscalAlerts) {
      updatedAlerts = fiscalAlerts.filter(al => {
        const alMapNorm = normalizeMapCode(al.routeMap).toUpperCase();
        const alMapUpper = (al.routeMap || '').toUpperCase().trim();
        return !routeMapUpper || (alMapUpper !== routeMapUpper && alMapNorm !== routeMapNorm);
      });
      onSaveAlerts(updatedAlerts);
    }

    // 6. Direct Firestore sync
    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({
        importedRoutes: updatedRoutes,
        audits: updatedAudits,
        carregamentos: updatedCarreg,
        carregamentoProcesses: updatedCarreg,
        vales: updatedVales,
        fiscalAlerts: updatedAlerts
      });
    }
  };

  // Custom platform reset modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Backup PDF states
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPhotos, setBackupPhotos] = useState<any[]>([]);
  const [loadingBackupPhotos, setLoadingBackupPhotos] = useState(false);
  const [backupMonthFilter, setBackupMonthFilter] = useState('all');
  const [backupStatusFilter, setBackupStatusFilter] = useState('all');

  const handleFileImport = (file: File, isMerge: boolean = false) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert("O arquivo importado está vazio ou não possui cabeçalhos.");
        return;
      }

      // Detect separator and parse headers
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      
      let mapIndex = headers.findIndex(h => h.includes('mapa') || h.includes('nro do mapa') || h.includes('nro. do mapa') || h.includes('número do mapa') || h.includes('numero do mapa') || h.includes('cod.mapa') || h.includes('cód.mapa'));
      let plateIndex = headers.findIndex(h => h.includes('placa') || h.includes('veiculo') || h.includes('veículo') || h.includes('cod.veiculo') || h.includes('placa do veículo'));
      let driverIndex = headers.findIndex(h => h.includes('motorista') || h.includes('condutor') || h.includes('matricula') || h.includes('matr') || h.includes('nome do motorista') || h.includes('cód.motorista') || h.includes('cod.motorista'));

      // Fallback index-based coordinates (G, M, O) if headers not found
      if (mapIndex === -1) mapIndex = 6;
      if (plateIndex === -1) plateIndex = 12;
      if (driverIndex === -1) driverIndex = 14;

      const parsedRoutes: ImportedRoute[] = [];
      const currentDrivers = [...drivers];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        const cols = splitCsvLine(row, sep).map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length <= Math.max(mapIndex, plateIndex)) continue;

        const rawMapCode = cols[mapIndex] || '';
        const mapCode = rawMapCode.trim().replace(/^0+/, '');
        const rawPlate = cols[plateIndex] || '';
        const plateClean = rawPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        if (!mapCode) continue;

        // Discard route map if both Column L (index 11) and Column M (index 12 / plateIndex) are empty.
        // ONLY perform this check if we are using the fallback 15-column Pau Brasil spreadsheet format (where mapIndex is 6, plateIndex is 12)
        // and columns 11 and 12 actually exist in the parsed row.
        if (mapIndex === 6 && plateIndex === 12 && cols.length > 12) {
          const colL = cols[11] ? cols[11].trim() : '';
          const colM = cols[12] ? cols[12].trim() : '';
          if (!colL && !colM) {
            continue;
          }
        }

        // Gather candidate values for driver matching (O is Column 14, driverIndex is matched header)
        const candidateValues: string[] = [];
        const colOVal = cols[14] ? cols[14].trim() : '';
        if (colOVal) candidateValues.push(colOVal);
        const colDriverVal = (driverIndex !== -1 && cols[driverIndex]) ? cols[driverIndex].trim() : '';
        if (colDriverVal && !candidateValues.includes(colDriverVal)) {
          candidateValues.push(colDriverVal);
        }
        // Also check columns 13, 15, 16 if available
        [13, 15, 16].forEach(idx => {
          if (cols[idx] && cols[idx].trim() && !candidateValues.includes(cols[idx].trim())) {
            candidateValues.push(cols[idx].trim());
          }
        });

        let matchedDriverId = '';
        let matchedDriverName = '';

        for (const val of candidateValues) {
          const matched = matchDriverFromColumnValue(val, currentDrivers);
          if (matched) {
            matchedDriverId = matched;
            const dObj = currentDrivers.find(d => d.id === matched);
            if (dObj) matchedDriverName = dObj.name;
            break;
          }
        }

        // If no driver found by column value, check if any column in the row matches a registered driver
        if (!matchedDriverId) {
          for (const col of cols) {
            if (col && col.length > 2) {
              const matched = matchDriverFromColumnValue(col, currentDrivers);
              if (matched) {
                matchedDriverId = matched;
                const dObj = currentDrivers.find(d => d.id === matched);
                if (dObj) matchedDriverName = dObj.name;
                break;
              }
            }
          }
        }

        if (!matchedDriverName && candidateValues[0]) {
          matchedDriverName = candidateValues[0];
        }

        // Avoid duplicate route maps in this file import
        if (parsedRoutes.some(r => r.routeMap.trim().toUpperCase() === mapCode.trim().toUpperCase())) {
          continue;
        }

        const nowISO = new Date().toISOString();
        parsedRoutes.push({
          id: `imp_${Date.now()}_csv_${i}_${Math.floor(Math.random() * 1000)}`,
          routeMap: mapCode,
          plate: plateClean,
          driverId: matchedDriverId,
          driverName: matchedDriverName,
          routeDate: routeImportDate,
          status: 'pendente' as const,
          importedAt: nowISO,
          updatedAt: nowISO,
          itemsCount: 0,
          items: []
        });
      }

      if (parsedRoutes.length === 0) {
        alert("Não foi possível identificar nenhuma rota ou mapa válido no arquivo. Verifique as colunas de Mapa (G) e Placa (M).");
        return;
      }

      const nowISO = new Date().toISOString();
      let mergedRoutes = [...importedRoutes];
      if (isMerge) {
        // Merge mode
        parsedRoutes.forEach(newR => {
          const existingIdx = mergedRoutes.findIndex(r => r.routeMap.trim().toUpperCase() === newR.routeMap.trim().toUpperCase() && (r.routeDate || '') === (newR.routeDate || ''));
          if (existingIdx >= 0) {
            const currentRoute = mergedRoutes[existingIdx];
            const isPendente = currentRoute.status === 'pendente';
            mergedRoutes[existingIdx] = {
              ...currentRoute,
              plate: newR.plate || currentRoute.plate,
              driverId: newR.driverId || currentRoute.driverId,
              driverName: newR.driverName || (currentRoute as any).driverName,
              itemsCount: isPendente ? 0 : currentRoute.itemsCount,
              items: isPendente ? [] : currentRoute.items,
              updatedAt: nowISO
            };
          } else {
            mergedRoutes.push(newR);
          }
        });
      } else {
        // Standard overwrite if same routeMap and routeDate
        parsedRoutes.forEach(newR => {
          const duplicateIdx = mergedRoutes.findIndex(r => r.routeMap.trim().toUpperCase() === newR.routeMap.trim().toUpperCase() && r.routeDate === newR.routeDate);
          if (duplicateIdx >= 0) {
            const currentRoute = mergedRoutes[duplicateIdx];
            const isPendente = currentRoute.status === 'pendente';
            mergedRoutes[duplicateIdx] = {
              ...currentRoute,
              plate: newR.plate || currentRoute.plate,
              driverId: newR.driverId || currentRoute.driverId,
              driverName: newR.driverName || (currentRoute as any).driverName,
              itemsCount: isPendente ? 0 : currentRoute.itemsCount,
              items: isPendente ? [] : currentRoute.items,
              updatedAt: nowISO
            };
          } else {
            mergedRoutes.push(newR);
          }
        });
      }

      // Automatically assign circular Blitz de Refugo (2x) to imported routes for active date
      const activeDateRoutes = mergedRoutes.filter(r => 
        r.routeDate === routeImportDate || 
        (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate))
      );
      const currentBlitz = activeDateRoutes.filter(r => r.isBlitz);
      const drawnBlitzMaps = selectCircularBlitzRoutes(activeDateRoutes, returnForecasts, currentBlitz, audits);

      mergedRoutes = mergedRoutes.map(r => {
        const isThisDate = r.routeDate === routeImportDate || (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate));
        if (isThisDate) {
          return { ...r, isBlitz: drawnBlitzMaps.includes(r.routeMap) };
        }
        return r;
      });

      if (onSaveImportedRoutes) {
        onSaveImportedRoutes(mergedRoutes);
      }
      if (isClientFirebaseActive()) {
        saveDirectlyToFirestore({ importedRoutes: mergedRoutes });
      }

      // Sync forecast driver names
      if (onSaveForecasts && returnForecasts.length > 0) {
        const updatedForecasts = returnForecasts.map(f => {
          const matchedRoute = mergedRoutes.find(r => r.routeMap.toUpperCase() === f.routeMap.toUpperCase());
          if (matchedRoute) {
            const dObj = currentDrivers.find(d => d.id === matchedRoute.driverId);
            return dObj ? { ...f, driverName: dObj.name } : f;
          }
          return f;
        });
        onSaveForecasts(updatedForecasts);
      }

      alert(`Sucesso! ${isMerge ? 'Mesclados' : 'Importados'} ${parsedRoutes.length} mapas para a data ${new Date(routeImportDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
    };
    reader.readAsText(file);
  };

  const handleForceRecalculateBlitz = () => {
    const routesForActiveDate = importedRoutes.filter(r => 
      r.routeDate === routeImportDate || 
      (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate))
    );
    if (routesForActiveDate.length === 0) {
      alert(`Nenhum mapa importado para a data ${routeImportDate}. Importe os mapas via arquivo 03.11.49.02 primeiro.`);
      return;
    }

    // Run circular blitz selection ignoring current selections
    const blitzMaps = selectCircularBlitzRoutes(routesForActiveDate, returnForecasts, [], audits);
    const updated = importedRoutes.map(r => {
      const isThisDate = r.routeDate === routeImportDate || (!r.routeDate && r.importedAt && r.importedAt.startsWith(routeImportDate));
      if (isThisDate) {
        return { ...r, isBlitz: blitzMaps.includes(r.routeMap) };
      }
      return r;
    });

    if (onSaveImportedRoutes) {
      onSaveImportedRoutes(updated);
    }
    if (isClientFirebaseActive()) {
      saveDirectlyToFirestore({ importedRoutes: updated });
    }

    const blitzDetails = routesForActiveDate
      .filter(r => blitzMaps.includes(r.routeMap))
      .map(r => `• Mapa: ${r.routeMap} - Placa: ${r.plate || 'S/P'}`)
      .join('\n');

    alert(`⚡ Sorteio Circular de Blitz de Refugo Realizado com Sucesso!\n\nVeículos sorteados para Blitz (${blitzMaps.length} de 2):\n${blitzDetails || 'Nenhum'}`);
  };

  const handleManualMapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMap.trim()) {
      alert("Por favor, insira o número do mapa.");
      return;
    }
    if (!manualPlate.trim()) {
      alert("Por favor, insira a placa do veículo.");
      return;
    }
    if (!manualDate) {
      alert("Por favor, insira a data do mapa.");
      return;
    }

    const mapClean = manualMap.trim().replace(/^0+/, '');
    const plateClean = manualPlate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Check if map already exists
    const mapExists = importedRoutes.some(r => r.routeMap.toUpperCase() === mapClean.toUpperCase() && r.routeDate === manualDate);
    if (mapExists) {
      alert(`O mapa ${mapClean} já está cadastrado para a data ${new Date(manualDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
      return;
    }

    const initialRouteItems = (products || []).map(prod => ({
      productCode: prod.code,
      productDescription: prod.description,
      qty: 0,
      unit: 'UN' as const
    }));

    const nowISO = new Date().toISOString();
    const newRoute: ImportedRoute = {
      id: `imp_manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      routeMap: mapClean,
      plate: plateClean,
      driverId: manualDriverId || '',
      routeDate: manualDate,
      status: 'pendente' as const,
      importedAt: nowISO,
      updatedAt: nowISO,
      itemsCount: initialRouteItems.length,
      items: initialRouteItems
    };

    if (onSaveImportedRoutes) {
      onSaveImportedRoutes([...importedRoutes, newRoute]);
    }

    alert(`Sucesso! Mapa ${mapClean} inserido manualmente.`);
    setManualMap('');
    setManualPlate('');
    setManualDriverId('');
  };

  const handleDriverImport = (file: File) => {
    // Legacy support, deprecated since we import maps, plates and drivers simultaneously.
    alert("Para importar os motoristas, por favor use o campo unificado de Importação de Rotas.");
  };

  const handleImportRoutesClick = () => {
    const userDate = prompt("Qual a data da rota? (Atenção para fins de semana)", routeImportDate);
    if (!userDate) return;

    // Create 3 new imported routes for that date
    const suffix = Math.floor(Math.random() * 900 + 100);
    const newRoutes: ImportedRoute[] = [
      {
        id: `imp_${Date.now()}_1`,
        routeMap: `MAPA-ROTA-${suffix}A`,
        plate: 'BRA2E19',
        driverId: 'drv_1',
        routeDate: userDate,
        status: 'pendente',
        importedAt: new Date().toISOString(),
        itemsCount: 8,
        items: [
          { productCode: 'P01', productDescription: 'Spaten 350ml', qty: 24, unit: 'UN' },
          { productCode: 'P02', productDescription: 'Corona Extra 330ml', qty: 12, unit: 'UN' },
          { productCode: 'P03', productDescription: 'Stella Artois 330ml', qty: 48, unit: 'UN' }
        ]
      },
      {
        id: `imp_${Date.now()}_2`,
        routeMap: `MAPA-ROTA-${suffix}B`,
        plate: 'AMB9X42',
        driverId: 'drv_2',
        routeDate: userDate,
        status: 'pendente',
        importedAt: new Date().toISOString(),
        itemsCount: 12,
        items: [
          { productCode: 'P04', productDescription: 'Budweiser 330ml', qty: 36, unit: 'UN' },
          { productCode: 'P05', productDescription: 'Becks LN 275ml', qty: 24, unit: 'UN' }
        ]
      },
      {
        id: `imp_${Date.now()}_3`,
        routeMap: `MAPA-ROTA-${suffix}C`,
        plate: 'LOG4K88',
        driverId: 'drv_3',
        routeDate: userDate,
        status: 'pendente',
        importedAt: new Date().toISOString(),
        itemsCount: 6,
        items: [
          { productCode: 'P06', productDescription: 'Spaten Lata 350ml', qty: 120, unit: 'UN' },
          { productCode: 'P07', productDescription: 'Budweiser Lata 350ml', qty: 72, unit: 'UN' }
        ]
      }
    ];

    if (onSaveImportedRoutes) {
      onSaveImportedRoutes([...importedRoutes, ...newRoutes]);
      alert(`Sucesso! 3 novos mapas de rota foram importados para a data ${new Date(userDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
    }
  };
  
  // History search / filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'divergentes' | 'reabertos'>('all');

  // Pending for fiscal verification (filtering out maps that are already closed or downloaded)
  const pendingAudits = audits.filter(a => {
    // If reopening was requested by fiscal/conferente/auxiliar, keep in pending so fiscal can re-reconcile
    if (a.reopeningRequested) return true;

    // If audit was reopened, and status is conferido_fisico or recontagem_finalizada, ALWAYS show in pending!
    const wasReopened = a.reopened === true || (a.history && a.history.some(h => h.action.includes('Reabert') || h.action.includes('Reabertura')));
    if (wasReopened && (a.status === 'conferido_fisico' || a.status === 'recontagem_finalizada')) {
      return true;
    }

    // If PDF was downloaded or status is already finalized or surplus status is BAIXADO
    if (a.pdfDownloaded || a.surplusFlowStatus === 'BAIXADO') return false;
    if (a.status === 'finalizado_ok' || a.status === 'finalizado_divergente') return false;

    // Must be in conferido_fisico or recontagem_finalizada
    if (a.status !== 'conferido_fisico' && a.status !== 'recontagem_finalizada') return false;

    // Check if matching route or another audit for this map is already closed/finalized
    const normMap = normalizeMapCode(a.routeMap).toUpperCase();
    const upperMap = a.routeMap.trim().toUpperCase();

    // Check if importedRoute is already closed (only applies if audit is not actively in conferido_fisico/recontagem_finalizada)
    const isRouteClosedInImports = importedRoutes.some(r => {
      const normR = normalizeMapCode(r.routeMap).toUpperCase();
      return (normR === normMap || r.routeMap.trim().toUpperCase() === upperMap) && r.status === 'fechado';
    });
    if (isRouteClosedInImports && !wasReopened) return false;

    // Check if another audit session for the same map is already finished
    const isAuditClosedInOthers = audits.some(other => {
      if (other.id === a.id || other.reopeningRequested || other.reopened) return false;
      const otherNorm = normalizeMapCode(other.routeMap).toUpperCase();
      const isMapMatch = otherNorm === normMap || (other.unifiedMaps && other.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === normMap));
      const isFinished = (other.status === 'finalizado_ok' || other.status === 'finalizado_divergente') && !other.reopened;
      return isMapMatch && isFinished;
    });
    if (isAuditClosedInOthers) return false;

    return true;
  });

  // History audits (finished today or reopened)
  const historyAudits = audits.filter(a => 
    a.status === 'finalizado_ok' || 
    a.status === 'finalizado_divergente' ||
    a.reopened === true ||
    a.history?.some(h => h.action.includes('Reabertura Aprovada') || h.action.includes('Reaberto') || h.action.includes('Mapa Reaberto'))
  );

  // Unacknowledged baixas for financeiro (Aguardando Fechamento Promax)
  const unacknowledgedBaixas = audits.filter(a => 
    (a.status === 'finalizado_ok' || a.status === 'finalizado_divergente') && 
    a.financeiroCiente !== true
  );

  // Memoized process metrics for "Monitoramento Integrado de Processos"
  const processProgressMetrics = React.useMemo(() => {
    const totalWorking = importedRoutes.filter(r => (r.status === 'conferindo' || r.status === 'reconferir') && !isRouteClosed(r.routeMap)).length;
    const totalPending = importedRoutes.filter(r => (r.status === 'pendente' || !r.status) && (r.status as string) !== 'fechado' && !isRouteClosed(r.routeMap)).length;
    const totalWaiting = pendingAudits.length;
    const totalReconciled = audits.filter(a => a.status === 'finalizado_ok' || a.status === 'finalizado_divergente').length;

    const totalCalculated = totalWorking + totalPending + totalWaiting + totalReconciled;
    const pendingPct = totalCalculated > 0 ? (totalPending / totalCalculated) * 100 : 0;
    const workingPct = totalCalculated > 0 ? (totalWorking / totalCalculated) * 100 : 0;
    const waitingPct = totalCalculated > 0 ? (totalWaiting / totalCalculated) * 100 : 0;
    const reconciledPct = totalCalculated > 0 ? (totalReconciled / totalCalculated) * 100 : 0;

    return {
      totalWorking,
      totalPending,
      totalWaiting,
      totalReconciled,
      totalCalculated,
      pendingPct,
      workingPct,
      waitingPct,
      reconciledPct
    };
  }, [importedRoutes, audits, pendingAudits]);

  const getDriverName = (id: string) => id === 'temporario' ? 'Temporário' : (drivers.find(d => d.id === id)?.name || id);
  const getHelperName = (id?: string) => id ? drivers.find(d => d.id === id)?.name || id : 'Sem ajudante';

  const getDaysOnRoute = (audit: AuditSession) => {
    const allMaps = [audit.routeMap, ...(audit.unifiedMaps || [])];
    let earliestRouteDate: string | null = null;

    allMaps.forEach(mapStr => {
      const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === mapStr.trim().toUpperCase());
      if (matchingRoute && matchingRoute.routeDate) {
        if (!earliestRouteDate || matchingRoute.routeDate < earliestRouteDate) {
          earliestRouteDate = matchingRoute.routeDate;
        }
      }
    });

    if (!earliestRouteDate || !audit.arrivalDate) return null;

    try {
      const startDate = new Date(earliestRouteDate + 'T00:00:00');
      const endDate = new Date(audit.arrivalDate + 'T00:00:00');
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays : 0;
    } catch (e) {
      return null;
    }
  };

  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch (e) {
      return dateStr;
    }
  };

  interface ExportRecord {
    map: string;
    plate: string;
    driverName: string;
    arrivalDate: string;
    type: 'PA' | 'AG';
    itemCode?: string;
    itemDescription: string;
    deviationType: 'SOBRA' | 'FALTA';
    fiscalQty: number;
    physicalQty: number;
    divergence: number;
    prazoStatus?: string;
    isWithin30Days?: boolean;
    daysElapsed?: number;
    surplusFlowStatus?: string;
    clientCodeNB?: string;
    deliveryDate?: string;
    destination?: string;
    valeEmitido?: string;
    status: string;
  }

  const getUnresolvedDiscrepancyRecords = (): ExportRecord[] => {
    const discrepantAudits = (audits || []).filter(audit => {
      if (!audit) return false;
      const hasProductDiff = (audit.items || []).some(item => {
        const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
        const fisc = item.fiscalQty ?? 0;
        const comodato = item.comodatoQty ?? 0;
        const recolha = item.recolhaQty ?? 0;
        return (phys + comodato - recolha) !== fisc;
      });
      const hasAssetDiff = (audit.assets || []).some(asset => {
        const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
        const fisc = asset.fiscalQty ?? 0;
        const comodato = asset.comodatoQty ?? 0;
        const recolha = asset.recolhaQty ?? 0;
        return phys !== (fisc - comodato + recolha);
      });

      const hasProductSurplus = (audit.items || []).some(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        return (phys + comodato - recolha) > fisc;
      });
      const hasAssetSurplus = (audit.assets || []).some(a => {
        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) > 0;
      });
      const hasSurplus = hasProductSurplus || hasAssetSurplus;

      const hasProductDeficit = (audit.items || []).some(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        return (phys + comodato - recolha) < fisc;
      });
      const hasAssetDeficit = (audit.assets || []).some(a => {
        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) < 0;
      });
      const hasDeficit = hasProductDeficit || hasAssetDeficit;

      const unresolvedSurplus = hasSurplus && !(
        audit.surplusFlowStatus === 'ENVIADO' || 
        audit.surplusFlowStatus === 'BAIXADO' || 
        audit.surplusActionStatus === 'baixado_direto' ||
        audit.surplusActionStatus === 'enviado_cliente'
      );

      const unresolvedDeficit = hasDeficit && !(
        audit.deficitActionStatus === 'baixado_direto' ||
        (vales || []).some(v => v.auditId === audit.id)
      );

      if (!unresolvedSurplus && !unresolvedDeficit) {
        return false;
      }
      
      if (subTabDivergencias === 'pa') return hasProductDiff;
      if (subTabDivergencias === 'ag') return hasAssetDiff;
      return hasProductDiff || hasAssetDiff;
    });

    const filteredAudits = discrepantAudits.filter(audit => {
      if (filterNB.trim()) {
        const nbQuery = filterNB.trim().toLowerCase();
        const hasMatchedNB = (audit.clientCodeNB || '').toLowerCase().includes(nbQuery) ||
          (audit.routeMap || '').toLowerCase().includes(nbQuery) ||
          (audit.plate || '').toLowerCase().includes(nbQuery);
        if (!hasMatchedNB) return false;
      }

      if (filterDate) {
        const matchesDate = audit.arrivalDate === filterDate || audit.deliveryDate === filterDate;
        if (!matchesDate) return false;
      }

      if (filterType !== 'all') {
        const hasSurplus = (audit.items || []).some(i => {
          const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
          const fisc = i.fiscalQty ?? 0;
          const comodato = i.comodatoQty ?? 0;
          const recolha = i.recolhaQty ?? 0;
          return (phys - fisc + comodato - recolha) > 0;
        }) || (audit.assets || []).some(a => {
          const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
          const fisc = a.fiscalQty ?? 0;
          const comodato = a.comodatoQty ?? 0;
          const recolha = a.recolhaQty ?? 0;
          return (phys - fisc + comodato - recolha) > 0;
        });

        const hasDeficit = (audit.items || []).some(i => {
          const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
          const fisc = i.fiscalQty ?? 0;
          const comodato = i.comodatoQty ?? 0;
          const recolha = i.recolhaQty ?? 0;
          return (phys - fisc + comodato - recolha) < 0;
        }) || (audit.assets || []).some(a => {
          const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
          const fisc = a.fiscalQty ?? 0;
          const comodato = a.comodatoQty ?? 0;
          const recolha = a.recolhaQty ?? 0;
          return (phys - fisc + comodato - recolha) < 0;
        });

        if (filterType === 'sobra' && !hasSurplus) return false;
        if (filterType === 'falta' && !hasDeficit) return false;
      }

      return true;
    });

    const records: ExportRecord[] = [];

    filteredAudits.forEach(audit => {
      const driverName = getDriverName(audit.driverId);
      
      const arrivalDateObj = new Date((audit.arrivalDate || new Date().toISOString().split('T')[0]) + 'T00:00:00');
      const daysElapsed = Math.floor((new Date().getTime() - arrivalDateObj.getTime()) / (1000 * 60 * 60 * 24));
      const isWithin30Days = daysElapsed <= 30;
      const prazoStatus = audit.surplusFlowStatus === 'ENVIADO' 
        ? 'ENVIADO' 
        : isWithin30Days 
          ? `ENVIO NO PRAZO (${daysElapsed}d)` 
          : `FORA DO PRAZO (${daysElapsed}d)`;

      const associatedVale = (vales || []).find(v => v.auditId === audit.id);
      const valeEmitido = associatedVale 
        ? `SIM (${associatedVale.colaboradorRole === 'CONFERENTE' ? 'Conferente' : 'Motorista'}: R$ ${associatedVale.valor.toFixed(2)})`
        : audit.deficitActionStatus === 'baixado_direto' ? 'Baixado Direto' : 'Pendente de Regularização';

      const clientNB = audit.clientCodeNB || '-';
      const alinhadaData = audit.deliveryDate ? formatDateBR(audit.deliveryDate) : '-';
      const destinoOp = audit.surplusActionStatus === 'baixado_direto' ? 'Estoque' : 'Cliente';
      const flowStatus = audit.surplusFlowStatus === 'ENVIADO' 
        ? 'ENVIADO' 
        : (audit.gestorAlignedDeliveryDate 
          ? 'DATA ALINHADA' 
          : (audit.surplusFlowStatus === 'ENCAMINHADO' ? 'AGUARDANDO GESTOR' : 'PENDENTE'));

      const hasProductSurplus = (audit.items || []).some(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) > 0;
      });
      const hasAssetSurplus = (audit.assets || []).some(a => {
        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) > 0;
      });
      const hasSurplus = hasProductSurplus || hasAssetSurplus;

      const hasProductDeficit = (audit.items || []).some(i => {
        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
        const fisc = i.fiscalQty ?? 0;
        const comodato = i.comodatoQty ?? 0;
        const recolha = i.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) < 0;
      });
      const hasAssetDeficit = (audit.assets || []).some(a => {
        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
        const fisc = a.fiscalQty ?? 0;
        const comodato = a.comodatoQty ?? 0;
        const recolha = a.recolhaQty ?? 0;
        return (phys - fisc + comodato - recolha) < 0;
      });
      const hasDeficit = hasProductDeficit || hasAssetDeficit;

      const unresolvedSurplus = hasSurplus && !(
        audit.surplusFlowStatus === 'ENVIADO' || 
        audit.surplusFlowStatus === 'BAIXADO' || 
        audit.surplusActionStatus === 'baixado_direto' ||
        audit.surplusActionStatus === 'enviado_cliente'
      );

      const unresolvedDeficit = hasDeficit && !(
        audit.deficitActionStatus === 'baixado_direto' ||
        (vales || []).some(v => v.auditId === audit.id)
      );

      if (subTabDivergencias === 'pa' || subTabDivergencias === 'all') {
        (audit.items || []).forEach(item => {
          const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fisc = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const fiscExpected = fisc - comodato + recolha;
          const diff = phys - fiscExpected;

          if (diff > 0 && unresolvedSurplus && (filterType === 'all' || filterType === 'sobra')) {
            records.push({
              map: audit.routeMap,
              plate: audit.plate,
              driverName,
              arrivalDate: audit.arrivalDate,
              type: 'PA',
              itemCode: item.productCode || '',
              itemDescription: item.productDescription,
              deviationType: 'SOBRA',
              fiscalQty: fiscExpected,
              physicalQty: phys,
              divergence: diff,
              prazoStatus,
              isWithin30Days,
              daysElapsed,
              surplusFlowStatus: flowStatus,
              clientCodeNB: clientNB,
              deliveryDate: alinhadaData,
              destination: destinoOp,
              valeEmitido,
              status: 'Sobra não tratada'
            });
          } else if (diff < 0 && unresolvedDeficit && (filterType === 'all' || filterType === 'falta')) {
            records.push({
              map: audit.routeMap,
              plate: audit.plate,
              driverName,
              arrivalDate: audit.arrivalDate,
              type: 'PA',
              itemCode: item.productCode || '',
              itemDescription: item.productDescription,
              deviationType: 'FALTA',
              fiscalQty: fisc,
              physicalQty: phys,
              divergence: diff,
              prazoStatus,
              isWithin30Days,
              daysElapsed,
              surplusFlowStatus: flowStatus,
              clientCodeNB: clientNB,
              deliveryDate: alinhadaData,
              destination: destinoOp,
              valeEmitido,
              status: 'Falta não tratada'
            });
          }
        });
      }

      if (subTabDivergencias === 'ag' || subTabDivergencias === 'all') {
        audit.assets.forEach(asset => {
          const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fisc = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const fiscExpected = fisc - comodato + recolha;
          const diff = phys - fiscExpected;

          if (diff > 0 && unresolvedSurplus && (filterType === 'all' || filterType === 'sobra')) {
            records.push({
              map: audit.routeMap,
              plate: audit.plate,
              driverName,
              arrivalDate: audit.arrivalDate,
              type: 'AG',
              itemCode: asset.assetId || '',
              itemDescription: asset.assetName,
              deviationType: 'SOBRA',
              fiscalQty: fiscExpected,
              physicalQty: phys,
              divergence: diff,
              prazoStatus,
              isWithin30Days,
              daysElapsed,
              surplusFlowStatus: flowStatus,
              clientCodeNB: clientNB,
              deliveryDate: alinhadaData,
              destination: destinoOp,
              valeEmitido,
              status: 'Sobra não tratada'
            });
          } else if (diff < 0 && unresolvedDeficit && (filterType === 'all' || filterType === 'falta')) {
            records.push({
              map: audit.routeMap,
              plate: audit.plate,
              driverName,
              arrivalDate: audit.arrivalDate,
              type: 'AG',
              itemCode: asset.assetId || '',
              itemDescription: asset.assetName,
              deviationType: 'FALTA',
              fiscalQty: fiscExpected,
              physicalQty: phys,
              divergence: diff,
              prazoStatus,
              isWithin30Days,
              daysElapsed,
              surplusFlowStatus: flowStatus,
              clientCodeNB: clientNB,
              deliveryDate: alinhadaData,
              destination: destinoOp,
              valeEmitido,
              status: 'Falta não tratada'
            });
          }
        });
      }
    });

    return records;
  };

  interface GroupedSummary {
    itemCode: string;
    itemDescription: string;
    type: 'PA' | 'AG';
    fiscalQtySum: number;
    physicalQtySum: number;
    divergenceSum: number;
  }

  const exportToExcel = () => {
    const records = getUnresolvedDiscrepancyRecords();
    if (records.length === 0) {
      alert("Nenhum item com sobras ou faltas pendentes encontrado para exportação.");
      return;
    }

    // Prepare grouped summary data (tabela dinâmica de itens)
    const groupedMap: { [key: string]: GroupedSummary } = {};
    let totalSobrasQtd = 0;
    let totalFaltasQtd = 0;

    records.forEach(r => {
      const key = `${r.type}_${r.itemCode || ''}_${r.itemDescription}`;
      if (!groupedMap[key]) {
        groupedMap[key] = {
          itemCode: r.itemCode || '',
          itemDescription: r.itemDescription,
          type: r.type,
          fiscalQtySum: 0,
          physicalQtySum: 0,
          divergenceSum: 0
        };
      }
      groupedMap[key].fiscalQtySum += r.fiscalQty;
      groupedMap[key].physicalQtySum += r.physicalQty;
      groupedMap[key].divergenceSum += r.divergence;

      if (r.deviationType === 'SOBRA') {
        totalSobrasQtd += Math.abs(r.divergence);
      } else {
        totalFaltasQtd += Math.abs(r.divergence);
      }
    });
    const summaryRows = Object.values(groupedMap);

    const now = new Date();
    const currentDateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');
    const filterDesc = subTabDivergencias === 'all' ? 'Geral (PA e AG)' : subTabDivergencias === 'pa' ? 'Produtos (PA)' : 'Ativos (AG)';

    // Build rows matching exact platform table model and colors
    let rowsHtml = '';
    records.forEach((r, idx) => {
      const isSobra = r.deviationType === 'SOBRA';
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const formattedDate = r.arrivalDate ? formatDateBR(r.arrivalDate) : '-';

      const devBadgeBg = isSobra ? '#dcfce7' : '#fee2e2';
      const devBadgeColor = isSobra ? '#15803d' : '#b91c1c';
      const devBadgeBorder = isSobra ? '#86efac' : '#fca5a5';
      const devSignal = isSobra ? '+' : '';

      const prazoBg = r.isWithin30Days ? '#d1fae5' : '#fee2e2';
      const prazoColor = r.isWithin30Days ? '#065f46' : '#991b1b';
      const prazoBorder = r.isWithin30Days ? '#6ee7b7' : '#f87171';

      rowsHtml += `
        <tr style="background-color: ${rowBg}; height: 28px;">
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; font-weight: bold; background-color: #f1f5f9;">${r.map}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; font-weight: bold;">${r.plate}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-weight: 500;">${r.driverName}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${formattedDate}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${r.type === 'PA' ? '#1e40af' : '#7c3aed'};">${r.type}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; font-weight: bold;">${r.itemCode || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">${r.itemDescription}</td>
          <td style="border: 1px solid ${devBadgeBorder}; background-color: ${devBadgeBg}; color: ${devBadgeColor}; text-align: center; font-weight: 900; font-size: 10pt;">
            ${r.deviationType}
          </td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; color: #475569;">${r.fiscalQty}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; color: #475569;">${r.physicalQty}</td>
          <td style="border: 1px solid ${devBadgeBorder}; background-color: ${devBadgeBg}; color: ${devBadgeColor}; text-align: center; font-weight: 900; font-family: Consolas, monospace; font-size: 10.5pt;">
            ${devSignal}${r.divergence}
          </td>
          <td style="border: 1px solid ${prazoBorder}; background-color: ${prazoBg}; color: ${prazoColor}; text-align: center; font-weight: bold; font-size: 8.5pt;">
            ${r.prazoStatus || '-'}
          </td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-size: 8.5pt; color: #1e293b;">
            ${r.surplusFlowStatus || '-'}
          </td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace;">${r.clientCodeNB || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${r.deliveryDate || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-size: 9pt;">${r.destination || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-size: 8.5pt; font-weight: 500;">${r.valeEmitido || '-'}</td>
        </tr>
      `;
    });

    // Build consolidated summary rows HTML
    let summaryRowsHtml = '';
    summaryRows.forEach((sr, idx) => {
      const isSobra = sr.divergenceSum > 0;
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const badgeBg = isSobra ? '#dcfce7' : '#fee2e2';
      const badgeColor = isSobra ? '#15803d' : '#b91c1c';
      const signal = isSobra ? '+' : '';

      summaryRowsHtml += `
        <tr style="background-color: ${rowBg}; height: 26px;">
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace; font-weight: bold;">${sr.itemCode || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">${sr.itemDescription}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${sr.type === 'PA' ? '#1e40af' : '#7c3aed'};">${sr.type}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace;">${sr.fiscalQtySum}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace;">${sr.physicalQtySum}</td>
          <td style="border: 1px solid #cbd5e1; background-color: ${badgeBg}; color: ${badgeColor}; text-align: center; font-weight: 900; font-family: Consolas, monospace; font-size: 10.5pt;">
            ${signal}${sr.divergenceSum}
          </td>
          <td style="border: 1px solid #cbd5e1; background-color: ${badgeBg}; color: ${badgeColor}; text-align: center; font-weight: bold; font-size: 9pt;">
            ${isSobra ? 'SOBRA CONSOLIDADA' : 'FALTA CONSOLIDADA'}
          </td>
        </tr>
      `;
    });

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Acompanhamento de Divergências</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; }
            th { background-color: #f59e0b; color: #0f172a; font-weight: bold; border: 1px solid #d97706; padding: 8px 6px; text-align: center; text-transform: uppercase; font-size: 9pt; }
            td { padding: 6px 8px; vertical-align: middle; }
          </style>
        </head>
        <body>
          <table>
            <!-- Title Header identical to Platform -->
            <tr>
              <th colspan="17" style="background-color: #0f172a; color: #f59e0b; font-size: 13pt; font-weight: 900; text-align: center; height: 38px; border: 1px solid #0f172a;">
                PAU BRASIL DISTRIBUIDORA AMBEV • PAINEL DE ACOMPANHAMENTO DE SOBRAS E FALTAS
              </th>
            </tr>
            <tr>
              <td colspan="17" style="background-color: #1e293b; color: #e2e8f0; font-size: 8.5pt; text-align: center; height: 24px; border: 1px solid #1e293b;">
                Exportação Gerada em: <b>${currentDateStr}</b> | Usuário: <b>${currentUser.name}</b> | Visão: <b>${filterDesc}</b> | Modo: <b>${sobrasViewMode === 'operacional' ? 'Painel Operacional' : 'Visão Master'}</b> | Total de Ocorrências: <b>${records.length}</b>
              </td>
            </tr>
            <tr style="height: 10px;"><td colspan="17" style="border: none;"></td></tr>

            <!-- Table Columns matching Platform View Exactly -->
            <tr>
              <th style="width: 85px;">MAPA</th>
              <th style="width: 90px;">PLACA</th>
              <th style="width: 190px; text-align: left;">MOTORISTA</th>
              <th style="width: 95px;">DATA CHEGADA</th>
              <th style="width: 55px;">TIPO</th>
              <th style="width: 85px;">CÓDIGO SKU</th>
              <th style="width: 250px; text-align: left;">PRODUTO / ATIVO</th>
              <th style="width: 85px;">DESVIO</th>
              <th style="width: 80px;">SALDO FISCAL</th>
              <th style="width: 80px;">SALDO FÍSICO</th>
              <th style="width: 90px;">DIVERGÊNCIA</th>
              <th style="width: 140px;">PRAZO (30 DIAS)</th>
              <th style="width: 120px;">FLUXO DPO</th>
              <th style="width: 95px;">CLIENTE (NB)</th>
              <th style="width: 95px;">DATA ALINHADA</th>
              <th style="width: 130px; text-align: left;">DESTINO</th>
              <th style="width: 160px; text-align: left;">VALE / REGULARIZAÇÃO</th>
            </tr>

            <!-- Data Rows -->
            ${rowsHtml}

            <!-- Summary / Footer Row -->
            <tr style="background-color: #f1f5f9; height: 32px; font-weight: bold; border-top: 2px solid #0f172a;">
              <td colspan="7" style="border: 1px solid #94a3b8; text-align: right; font-weight: 900; padding-right: 12px; font-size: 10pt;">
                TOTAIS CONSOLIDADOS:
              </td>
              <td style="border: 1px solid #94a3b8; text-align: center; font-size: 8pt; color: #475569;">
                ${records.length} itens
              </td>
              <td colspan="2" style="border: 1px solid #94a3b8; text-align: right; font-weight: bold; font-size: 8.5pt;">
                Total Sobras: <span style="color: #15803d; font-weight: 900;">+${totalSobrasQtd}</span> | Faltas: <span style="color: #b91c1c; font-weight: 900;">-${totalFaltasQtd}</span>
              </td>
              <td style="border: 1px solid #94a3b8; text-align: center; font-weight: 900; font-family: Consolas, monospace; background-color: #fef3c7; color: #b45309; font-size: 11pt;">
                ${totalSobrasQtd - totalFaltasQtd > 0 ? '+' : ''}${totalSobrasQtd - totalFaltasQtd}
              </td>
              <td colspan="6" style="border: 1px solid #94a3b8; text-align: left; font-size: 8.5pt; color: #64748b;">
                Saldo Líquido da Operação
              </td>
            </tr>

            <!-- Separator -->
            <tr style="height: 25px;"><td colspan="17" style="border: none;"></td></tr>

            <!-- Secondary Dynamic Pivot Table: Consolidado por Item -->
            <tr>
              <th colspan="7" style="background-color: #1e293b; color: #f59e0b; font-size: 11pt; font-weight: bold; text-align: center; height: 30px; border: 1px solid #1e293b;">
                RESUMO CONSOLIDADO POR ITEM (TABELA DINÂMICA DE PRODUTOS E ATIVOS)
              </th>
            </tr>
            <tr>
              <th style="width: 85px;">CÓDIGO SKU</th>
              <th style="width: 250px; text-align: left;">DESCRIÇÃO DO ITEM</th>
              <th style="width: 55px;">TIPO</th>
              <th style="width: 90px;">SOMA FISCAL</th>
              <th style="width: 90px;">SOMA FÍSICO</th>
              <th style="width: 100px;">DIVERGÊNCIA LÍQUIDA</th>
              <th style="width: 150px;">STATUS CONSOLIDADO</th>
            </tr>
            ${summaryRowsHtml}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\uFEFF" + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const dateFileStr = new Date().toISOString().split('T')[0];
    const filename = `acompanhamento_sobras_e_faltas_${filterDesc.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dateFileStr}.xls`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const records = getUnresolvedDiscrepancyRecords();
    if (records.length === 0) {
      alert("Nenhum item com sobras ou faltas pendentes encontrado para exportação.");
      return;
    }

    const doc = new jsPDF();
    let currentY = 15;

    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > 275) {
        doc.addPage();
        currentY = 15;
        drawPageHeader();
        return true;
      }
      return false;
    };

    const drawPageHeader = () => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("PAU BRASIL DISTRIBUIDORA DE BEBIDAS LTDA", 14, currentY);
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Guarabira / PB - CEP: 58200-000 | Fone: (83) 3271-1000", 120, currentY);
      currentY += 4;
      
      doc.text("RELATÓRIO OPERACIONAL DE SOBRAS E FALTAS NÃO TRATADAS", 14, currentY);
      currentY += 4;
      
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(14, currentY, 196, currentY);
      currentY += 6;
    };

    drawPageHeader();

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const filterLabel = subTabDivergencias === 'all' ? 'PRODUTOS E ATIVOS (P.A. / A.G.)' : subTabDivergencias === 'pa' ? 'PRODUTOS ACABADOS (P.A.)' : 'ATIVOS DE GIRO (A.G.)';
    doc.text(`SOBRAS & FALTAS PENDENTES - ${filterLabel}`, 14, currentY);
    currentY += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const filterInfo = `Filtros: Busca: "${filterNB || 'Nenhum'}" | Data: ${filterDate || 'Todas'} | Desvio: ${filterType === 'all' ? 'Todos' : filterType === 'sobra' ? 'Apenas Sobras' : 'Apenas Faltas'}`;
    doc.text(filterInfo, 14, currentY);
    currentY += 8;

    doc.setFillColor(15, 23, 42);
    doc.rect(14, currentY, 182, 7, "F");
    
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    
    const colX = {
      map: 16,
      driver: 34,
      item: 69,
      type: 124,
      deviation: 136,
      fiscal: 151,
      physical: 166,
      diverg: 181
    };

    doc.text("MAPA", colX.map, currentY + 5);
    doc.text("MOTORISTA", colX.driver, currentY + 5);
    doc.text("PRODUTO / ATIVO", colX.item, currentY + 5);
    doc.text("TIPO", colX.type, currentY + 5);
    doc.text("DESVIO", colX.deviation, currentY + 5);
    doc.text("FISC", colX.fiscal, currentY + 5);
    doc.text("FÍS", colX.physical, currentY + 5);
    doc.text("DIV", colX.diverg, currentY + 5);
    currentY += 7;

    let alternate = false;
    records.forEach(r => {
      checkPageBreak(7);
      
      if (alternate) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, currentY, 182, 6.5, "F");
      }
      alternate = !alternate;

      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.25);
      doc.line(14, currentY + 6.5, 196, currentY + 6.5);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      let desc = r.itemDescription;
      if (desc.length > 32) {
        desc = desc.substring(0, 30) + "...";
      }

      let dName = r.driverName;
      if (dName.length > 20) {
        dName = dName.substring(0, 18) + "..";
      }

      doc.text(r.map, colX.map, currentY + 4.5);
      doc.text(dName, colX.driver, currentY + 4.5);
      doc.text(desc, colX.item, currentY + 4.5);
      
      doc.setFont("Helvetica", "bold");
      doc.text(r.type, colX.type, currentY + 4.5);

      if (r.deviationType === 'SOBRA') {
        doc.setTextColor(16, 124, 65);
        doc.text("SOBRA", colX.deviation, currentY + 4.5);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text("FALTA", colX.deviation, currentY + 4.5);
      }
      doc.setTextColor(30, 41, 59);
      doc.setFont("Helvetica", "normal");

      doc.text(String(r.fiscalQty), colX.fiscal, currentY + 4.5);
      doc.text(String(r.physicalQty), colX.physical, currentY + 4.5);

      doc.setFont("Helvetica", "bold");
      if (r.divergence > 0) {
        doc.setTextColor(16, 124, 65);
        doc.text(`+${r.divergence}`, colX.diverg, currentY + 4.5);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text(String(r.divergence), colX.diverg, currentY + 4.5);
      }

      currentY += 6.5;
    });

    checkPageBreak(30);
    currentY += 5;
    
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, currentY, 182, 18, "FD");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text("RESUMO DE DIVERGÊNCIAS NÃO TRATADAS", 18, currentY + 5.5);

    const totalSobras = records.filter(r => r.deviationType === 'SOBRA').length;
    const totalFaltas = records.filter(r => r.deviationType === 'FALTA').length;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total de ocorrências: ${records.length} itens.`, 18, currentY + 11.5);
    doc.text(`Sobras pendentes: ${totalSobras} itens  |  Faltas pendentes: ${totalFaltas} itens`, 18, currentY + 15.5);

    const filterDesc = subTabDivergencias === 'all' ? 'geral' : subTabDivergencias === 'pa' ? 'pa' : 'ag';
    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`sobras_e_faltas_pendentes_${filterDesc}_${dateStr}.pdf`);
  };

  // Reopening handlers for Auxiliar de Logística, Gestor and Financeiro
  const handleExecuteReopening = (auditId: string, customJustification?: string) => {
    const targetAudit = audits.find(a => a.id === auditId);
    if (!targetAudit) return;

    if (currentUser.role !== 'auxiliar_logistica' && currentUser.role !== 'financeiro' && currentUser.role !== 'gestor') {
      alert("Você não tem permissão para reabrir mapas.");
      return;
    }

    const note = (customJustification || reopeningJustificationText).trim() || targetAudit.reopeningJustification || 'Reabertura de mapa solicitada para conciliação fiscal';

    requestConfirm(
      "🔓 Confirmar Reabertura do Mapa?",
      `Tem certeza que deseja reabrir o mapa ${targetAudit.routeMap}? Ele retornará imediatamente para a coluna "Aguardando Conciliação" para conferência e conciliação fiscal.`,
      () => {
        const userRoleTitle = currentUser.role === 'auxiliar_logistica' 
          ? 'Auxiliar de Logística' 
          : currentUser.role === 'gestor' 
            ? 'Gestor' 
            : 'Financeiro';

        const updatedAudits = audits.map(audit => {
          if (audit.id === auditId) {
            const updatedHistory = [
              ...(audit.history || []),
              {
                timestamp: new Date().toISOString(),
                action: `Mapa Reaberto por ${currentUser.name} (${userRoleTitle})`,
                user: currentUser.name,
                details: `Motivo da Reabertura: ${note}`
              }
            ];
            return {
              ...audit,
              status: 'conferido_fisico' as const,
              reopeningRequested: false,
              reopened: true,
              reopenedAt: new Date().toISOString(),
              reopenedBy: currentUser.name,
              reopeningJustification: note,
              pdfDownloaded: false,
              surplusFlowStatus: undefined,
              financeiroCiente: false,
              closedAt: undefined,
              baixaConcluida: false,
              history: updatedHistory,
              updatedAt: new Date().toISOString(),
              lastUpdatedBy: currentUser.name
            };
          }
          return audit;
        });

        let updatedAlerts = [...fiscalAlerts];
        const newAlert: FiscalAlert = {
          id: 'al_reopen_done_' + Date.now(),
          routeMap: targetAudit.routeMap,
          plate: targetAudit.plate,
          status: 'conferido_fisico',
          timestamp: new Date().toISOString(),
          read: false,
          title: `🔓 Mapa ${targetAudit.routeMap} Reaberto`,
          message: `O mapa ${targetAudit.routeMap} foi reaberto por ${currentUser.name} (${userRoleTitle}) e retornou para "Aguardando Conciliação".`,
          targetRole: 'auxiliar_logistica'
        };
        updatedAlerts = [newAlert, ...updatedAlerts];

        onSaveAudits(updatedAudits);

        if (onSaveImportedRoutes && importedRoutes) {
          const targetNorm = normalizeMapCode(targetAudit.routeMap).toUpperCase();
          const targetUpper = targetAudit.routeMap.trim().toUpperCase();
          const updatedRoutes = importedRoutes.map(r => {
            const rNorm = normalizeMapCode(r.routeMap).toUpperCase();
            const rUpper = r.routeMap.trim().toUpperCase();
            const isMatched = rNorm === targetNorm || rUpper === targetUpper ||
              (targetAudit.unifiedMaps && targetAudit.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === rNorm || m.trim().toUpperCase() === rUpper));
            if (isMatched) {
              return { ...r, status: 'em_analise' as const };
            }
            return r;
          });
          onSaveImportedRoutes(updatedRoutes);
        }

        if (onSaveAlerts) {
          onSaveAlerts(updatedAlerts);
        }

        const currentSelected = updatedAudits.find(a => a.id === auditId);
        if (currentSelected) {
          setSelectedHistoryAudit(currentSelected);
        }

        setReopeningJustificationText('');
        alert(`O mapa ${targetAudit.routeMap} foi reaberto com sucesso e retornou para "Aguardando Conciliação"!`);
      }
    );
  };

  const handleRequestReopening = (auditId: string) => {
    if (!reopeningJustificationText.trim()) {
      alert("Por favor, preencha a justificativa para solicitar a reabertura.");
      return;
    }

    const updatedAudits = audits.map(audit => {
      if (audit.id === auditId) {
        const updatedHistory = [
          ...(audit.history || []),
          {
            timestamp: new Date().toISOString(),
            action: `Solicitou Reabertura do Mapa`,
            user: currentUser.name,
            details: `Justificativa: ${reopeningJustificationText.trim()}`
          }
        ];
        return {
          ...audit,
          reopeningRequested: true,
          reopeningJustification: reopeningJustificationText.trim(),
          reopeningRequestDate: new Date().toISOString(),
          reopeningRequestUser: currentUser.name,
          history: updatedHistory,
          updatedAt: new Date().toISOString(),
          lastUpdatedBy: currentUser.name
        };
      }
      return audit;
    });

    let updatedAlerts = [...fiscalAlerts];
    const targetAudit = audits.find(a => a.id === auditId);
    if (targetAudit) {
      const newAlert: FiscalAlert = {
        id: 'al_reopen_' + Date.now(),
        routeMap: targetAudit.routeMap,
        plate: targetAudit.plate,
        status: 'outros',
        timestamp: new Date().toISOString(),
        read: false,
        title: `🔓 Solicitação de Reabertura`,
        message: `${currentUser.name} solicitou a reabertura do mapa ${targetAudit.routeMap}. Justificativa: ${reopeningJustificationText.trim()}`,
        targetRole: 'financeiro'
      };
      updatedAlerts = [newAlert, ...updatedAlerts];
    }

    onSaveAudits(updatedAudits);
    if (onSaveAlerts) {
      onSaveAlerts(updatedAlerts);
    }

    const currentSelected = updatedAudits.find(a => a.id === auditId);
    if (currentSelected) {
      setSelectedHistoryAudit(currentSelected);
    }

    setReopeningJustificationText('');
    alert("Solicitação de reabertura registrada com sucesso!");
  };

  const handleApproveReopening = (auditId: string) => {
    const targetAudit = audits.find(a => a.id === auditId);
    if (!targetAudit) return;

    if (currentUser.role !== 'auxiliar_logistica' && currentUser.role !== 'financeiro' && currentUser.role !== 'gestor') {
      alert("Você não tem permissão para reabrir mapas.");
      return;
    }

    handleExecuteReopening(auditId, targetAudit.reopeningJustification);
  };

  const handleRejectReopening = (auditId: string) => {
    const targetAudit = audits.find(a => a.id === auditId);
    if (!targetAudit) return;

    if (currentUser.role !== 'auxiliar_logistica' && currentUser.role !== 'financeiro' && currentUser.role !== 'gestor') {
      alert("Você não tem permissão para recusar reaberturas.");
      return;
    }

    requestConfirm(
      "❌ Recusar Reabertura?",
      `Deseja recusar o pedido de reabertura do mapa ${targetAudit.routeMap}?`,
      () => {
        const userRoleTitle = currentUser.role === 'auxiliar_logistica' 
          ? 'Auxiliar de Logística' 
          : currentUser.role === 'gestor' 
            ? 'Gestor' 
            : 'Financeiro';

        const updatedAudits = audits.map(audit => {
          if (audit.id === auditId) {
            const updatedHistory = [
              ...(audit.history || []),
              {
                timestamp: new Date().toISOString(),
                action: `Reabertura Recusada por ${currentUser.name} (${userRoleTitle})`,
                user: currentUser.name,
                details: `Recusado`
              }
            ];
            return {
              ...audit,
              reopeningRequested: false,
              history: updatedHistory,
              updatedAt: new Date().toISOString(),
              lastUpdatedBy: currentUser.name
            };
          }
          return audit;
        });

        onSaveAudits(updatedAudits);

        const currentSelected = updatedAudits.find(a => a.id === auditId);
        if (currentSelected) {
          setSelectedHistoryAudit(currentSelected);
        }

        alert(`A solicitação de reabertura do mapa ${targetAudit.routeMap} foi recusada.`);
      }
    );
  };

  const handleAcknowledgePromax = (auditId: string) => {
    const targetAudit = audits.find(a => a.id === auditId);
    if (!targetAudit) return;

    const updatedAudits = audits.map(audit => {
      if (audit.id === auditId) {
        const updatedHistory = [
          ...(audit.history || []),
          {
            timestamp: new Date().toISOString(),
            action: `Ciente Fechamento Promax`,
            user: currentUser.name,
            details: `Financeiro marcou o mapa ${audit.routeMap} como ciente do fechamento no Promax.`
          }
        ];
        return {
          ...audit,
          financeiroCiente: true,
          history: updatedHistory,
          updatedAt: new Date().toISOString(),
          lastUpdatedBy: currentUser.name
        };
      }
      return audit;
    });

    onSaveAudits(updatedAudits);
    
    if (selectedHistoryAudit && selectedHistoryAudit.id === auditId) {
      const updatedSelected = updatedAudits.find(a => a.id === auditId);
      if (updatedSelected) {
        setSelectedHistoryAudit(updatedSelected);
      }
    }

    alert(`Sucesso! Mapa ${targetAudit.routeMap} marcado como ciente de fechamento no Promax.`);
  };

  const getPhotoBase64 = async (photoUrl: string): Promise<string | null> => {
    if (!photoUrl) return null;
    if (photoUrl.startsWith('data:')) {
      return photoUrl;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(photoUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn(`Error converting URL to base64: ${photoUrl}`, err);
      return null;
    }
  };

  const downloadSingleAuditPDF = async (audit: AuditSession, returnDoc: boolean = false): Promise<any> => {
    try {
      // Load photos from ImageDB
      const photos = await ImageDB.getPhotosByAudit(audit.id);
      
      const arrivalDateStr = audit.arrivalDate || new Date().toISOString().split('T')[0];
      const [year, month, day] = arrivalDateStr.split('-');
      const formattedDate = `${day}-${month}-${year}`;
      
      // Naming convention: 11111 - OXO0542 - 05-07-2026.pdf
      const filename = `${audit.routeMap} - ${audit.plate} - ${formattedDate}.pdf`;
      
      const doc = new jsPDF();
      
      let currentY = 15;
      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > 275) {
          doc.addPage();
          currentY = 15;
          return true;
        }
        return false;
      };

      // 1. BRANDED HEADER
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("PAU BRASIL DISTRIBUIDORA DE BEBIDAS LTDA", 14, currentY);
      currentY += 5;
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("Guarabira / PB - CEP: 58200-000 | Fone: (83) 3271-1000", 14, currentY);
      currentY += 4;
      doc.text("CONTROLE DE ACURACIDADE - PACOTE PREJUÍZO (LOGÍSTICA)", 14, currentY);
      currentY += 4;
      
      // Line divider
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;
      
      // Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`RELATÓRIO OPERACIONAL DE RETORNO DE ROTA`, 14, currentY);
      currentY += 6;
      
      // Metadata Box
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, currentY, 182, 34, "FD");
      
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      
      // Metadata lines inside the box
      doc.text(`Mapa de Rota:`, 18, currentY + 6);
      doc.text(`Placa do Carro:`, 18, currentY + 12);
      doc.text(`Motorista:`, 18, currentY + 18);
      doc.text(`Ajudante:`, 18, currentY + 24);
      doc.text(`Período Auditoria:`, 18, currentY + 30);
      
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${audit.routeMap}`, 48, currentY + 6);
      doc.text(`${audit.plate}`, 48, currentY + 12);
      doc.text(`${getDriverName(audit.driverId)}`, 48, currentY + 18);
      doc.text(`${getHelperName(audit.helperId)}`, 48, currentY + 24);
      
      const formatTime = (t?: string) => t ? new Date(t).toLocaleTimeString('pt-BR') : 'N/A';
      doc.text(`${formatTime(audit.startTime)} até ${formatTime(audit.endTime)} (${getDurationText(audit.startTime, audit.endTime)})`, 48, currentY + 30);
      
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Data Chegada:`, 110, currentY + 6);
      doc.text(`Status Fechamento:`, 110, currentY + 12);
      doc.text(`Conferente Físico:`, 110, currentY + 18);
      doc.text(`Auxiliar Fiscal:`, 110, currentY + 24);
      doc.text(`Divergência Total:`, 110, currentY + 30);
      
      doc.setFont("Helvetica", "bold");
      doc.text(`${formattedDate}`, 142, currentY + 6);
      
      const isOk = audit.status === 'finalizado_ok';
      doc.setTextColor(isOk ? 16 : 220, isOk ? 124 : 38, isOk ? 65 : 38); // green-600 or red-600
      doc.text(isOk ? "100% OK" : "CONCILIADO DIVERGENTE", 142, currentY + 12);
      
      doc.setTextColor(15, 23, 42);
      doc.text(`${audit.conferenteId || 'N/A'}`, 142, currentY + 18);
      doc.text(`${audit.auxiliarId || 'N/A'}`, 142, currentY + 24);
      
      // Calculate stats for diff
      let missingQty = 0;
      let surplusQty = 0;
      let missingVal = 0;
      let surplusVal = 0;
      
      audit.items?.forEach(item => {
        const p = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
        const f = item.fiscalQty ?? 0;
        const comodato = item.comodatoQty ?? 0;
        const recolha = item.recolhaQty ?? 0;
        const diff = (p + comodato - recolha) - f;
        if (diff < 0) {
          missingQty += Math.abs(diff);
          missingVal += Math.abs(diff) * getSkuClosedPrice(item.productCode, 45.0);
        } else if (diff > 0) {
          surplusQty += diff;
          surplusVal += diff * getSkuClosedPrice(item.productCode, 45.0);
        }
      });

      // Do NOT count chapatex as discrepancy for closing status, but keep in statistics
      audit.assets?.forEach(asset => {
        const code = getAssetCode(asset.assetId, asset.assetName);
        const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
        const p = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
        const f = asset.fiscalQty ?? 0;
        const comodato = asset.comodatoQty ?? 0;
        const recolha = asset.recolhaQty ?? 0;
        const diff = (p + comodato - recolha) - f;
        if (diff < 0) {
          if (!isChapatex) missingQty += Math.abs(diff);
        } else if (diff > 0) {
          if (!isChapatex) surplusQty += diff;
        }
      });
      
      doc.setTextColor(isOk ? 16 : 220, isOk ? 124 : 38, isOk ? 65 : 38);
      doc.text(isOk ? "Sem Divergências" : `Faltas: ${missingQty} | Sobras: ${surplusQty}`, 142, currentY + 30);
      
      currentY += 44;
      
      // 2. CONCILIAÇÃO DE PRODUTOS ACABADOS (PA)
      if (audit.items && audit.items.length > 0) {
        checkPageBreak(30);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("1. FECHAMENTO DE PRODUTOS ACABADOS (PA)", 14, currentY);
        currentY += 5;
        
        // Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 182, 6, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("Código", 16, currentY + 4.5);
        doc.text("Descrição do Produto", 32, currentY + 4.5);
        doc.text("Físico", 125, currentY + 4.5);
        doc.text("Fiscal", 145, currentY + 4.5);
        doc.text("Diferença", 168, currentY + 4.5);
        currentY += 6;
        
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        audit.items.forEach(item => {
          checkPageBreak(8);
          const physicalVal = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fiscalVal = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const diff = (physicalVal + comodato - recolha) - fiscalVal;
          const diffText = diff > 0 ? `+${diff}` : `${diff}`;
          
          doc.setFontSize(7.5);
          doc.text(`${item.productCode}`, 16, currentY + 4.5);
          doc.text(`${(item.productDescription || '').substring(0, 48)}`, 32, currentY + 4.5);
          doc.text(`${physicalVal} SKU`, 125, currentY + 4.5);
          doc.text(`${fiscalVal} SKU`, 145, currentY + 4.5);
          
          if (diff !== 0) {
            doc.setFont("Helvetica", "bold");
            doc.setTextColor(diff < 0 ? 220 : 217, diff < 0 ? 38 : 119, diff < 0 ? 38 : 6);
          }
          doc.text(`${diffText} SKU`, 168, currentY + 4.5);
          doc.setFont("Helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(14, currentY + 6, 196, currentY + 6);
          currentY += 6;
        });
        currentY += 6;
      }
      
      // 3. CONCILIAÇÃO DE ATIVOS DE GIRO (AG)
      if (audit.assets && audit.assets.length > 0) {
        checkPageBreak(30);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("2. FECHAMENTO DE ATIVOS DE GIRO (AG)", 14, currentY);
        currentY += 5;
        
        // Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 182, 6, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("Código Ativo", 16, currentY + 4.5);
        doc.text("Descrição do Ativo", 36, currentY + 4.5);
        doc.text("Físico", 125, currentY + 4.5);
        doc.text("Fiscal", 145, currentY + 4.5);
        doc.text("Diferença", 168, currentY + 4.5);
        currentY += 6;
        
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        audit.assets.forEach(asset => {
          checkPageBreak(8);
          const code = getAssetCode(asset.assetId, asset.assetName);
          const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
          const physicalVal = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fiscalVal = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const diff = (physicalVal + comodato - recolha) - fiscalVal;
          let diffText = diff > 0 ? `+${diff}` : `${diff}`;
          
          if (isChapatex) {
            diffText += " (Isento)";
          }
          
          doc.setFontSize(7.5);
          doc.text(`${code}`, 16, currentY + 4.5);
          doc.text(`${asset.assetName}`, 36, currentY + 4.5);
          doc.text(`${physicalVal} cx/un`, 125, currentY + 4.5);
          doc.text(`${fiscalVal} cx/un`, 145, currentY + 4.5);
          
          if (diff !== 0) {
            doc.setFont("Helvetica", "bold");
            if (isChapatex) {
              doc.setTextColor(71, 85, 105);
            } else {
              doc.setTextColor(diff < 0 ? 220 : 217, diff < 0 ? 38 : 119, diff < 0 ? 38 : 6);
            }
          }
          doc.text(`${diffText}`, 168, currentY + 4.5);
          doc.setFont("Helvetica", "normal");
          doc.setTextColor(51, 65, 85);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(14, currentY + 6, 196, currentY + 6);
          currentY += 6;
        });
        currentY += 6;
      }
      
      // 4. CONTROLE DE REFUGO / AVARIAS
      if (audit.refugos && audit.refugos.length > 0) {
        checkPageBreak(30);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("3. BLITZ DE REFUGO & AVARIAS DE ATIVOS DE GIRO", 14, currentY);
        currentY += 5;
        
        // Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 182, 6, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("Ativo Danificado", 16, currentY + 4.5);
        doc.text("Motivo do Descarte / Blitz", 75, currentY + 4.5);
        doc.text("Qtd Descartada", 160, currentY + 4.5);
        currentY += 6;
        
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        audit.refugos.forEach(ref => {
          checkPageBreak(8);
          doc.setFontSize(7.5);
          doc.text(`${ref.assetName}`, 16, currentY + 4.5);
          doc.text(`${ref.reason}`, 75, currentY + 4.5);
          doc.text(`${ref.qty} un`, 160, currentY + 4.5);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(14, currentY + 6, 196, currentY + 6);
          currentY += 6;
        });
        currentY += 6;
      }
      
      // 5. HISTÓRICO DE AUDITORIA COMPLETO
      if (audit.history && audit.history.length > 0) {
        checkPageBreak(35);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        doc.text("4. HISTÓRICO COMPLETO DA AUDITORIA (LOG DE EVENTOS)", 14, currentY);
        currentY += 5;
        
        // Header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 182, 6, "F");
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text("Horário / Data", 16, currentY + 4.5);
        doc.text("Responsável", 50, currentY + 4.5);
        doc.text("Ação Operacional Executada", 85, currentY + 4.5);
        currentY += 6;
        
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        audit.history.forEach(hist => {
          const timeText = new Date(hist.timestamp).toLocaleString('pt-BR');
          const details = hist.details ? `: ${hist.details}` : "";
          const actionText = `${hist.action}${details}`;
          
          const splitAction = doc.splitTextToSize(actionText, 105);
          const heightNeeded = (splitAction.length * 4) + 4;
          
          checkPageBreak(heightNeeded);
          
          doc.setFontSize(7.2);
          doc.text(`${timeText}`, 16, currentY + 4.5);
          doc.text(`${hist.user}`, 50, currentY + 4.5);
          doc.text(splitAction, 85, currentY + 4.5);
          
          currentY += heightNeeded;
          doc.setDrawColor(241, 245, 249);
          doc.line(14, currentY, 196, currentY);
        });
        currentY += 6;
      }
      
      // Local Rede info and signatures
      checkPageBreak(45);
      
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(14, currentY, 182, 14, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text("DIRETÓRIO DA REDE INTERNA PARA ARQUIVAMENTO DEFINITIVO:", 16, currentY + 5);
      doc.setFont("Helvetica", "normal");
      doc.text("P:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA", 16, currentY + 10);
      currentY += 22;
      
      doc.setDrawColor(203, 213, 225);
      doc.line(14, currentY, 65, currentY);
      doc.line(78, currentY, 129, currentY);
      doc.line(142, currentY, 193, currentY);
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("CONFERENTE OPERACIONAL", 14, currentY + 4);
      doc.text("FISCAL DE RETORNO", 78, currentY + 4);
      doc.text("COORDENADOR / GESTOR", 142, currentY + 4);
      currentY += 12;
      
      // 6. PHOTO EVIDENCE PAGES (Using highly-polished 2-column grid layout requested by user)
      if (photos && photos.length > 0) {
        doc.addPage();
        currentY = 15;
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("5. EVIDÊNCIAS FOTOGRÁFICAS OPERACIONAIS", 14, currentY);
        currentY += 10;
        
        const colWidth = 86;
        const colHeight = 65;
        const spaceBetweenX = 10;
        const spaceBetweenY = 18;
        
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          const colIndex = i % 2;
          const rowIndex = Math.floor(i / 2) % 3;
          
          if (i > 0 && colIndex === 0 && rowIndex === 0) {
            doc.addPage();
            currentY = 15;
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text("5. EVIDÊNCIAS FOTOGRÁFICAS OPERACIONAIS (CONT.)", 14, currentY);
            currentY += 10;
          }
          
          const xPos = 14 + colIndex * (colWidth + spaceBetweenX);
          const yPos = currentY + rowIndex * (colHeight + spaceBetweenY);
          
          doc.setDrawColor(226, 232, 240);
          doc.setFillColor(255, 255, 255);
          doc.rect(xPos, yPos, colWidth, colHeight + 12, "FD");
          
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          const labelText = `Foto ${i + 1}: ${(photo.itemName || '').substring(0, 24)}`;
          doc.text(labelText, xPos + 3, yPos + 5);
          
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          const sublabelText = `Ref/ID: ${photo.itemCode || 'N/A'} | ${(photo.type || '').toUpperCase()}`;
          doc.text(sublabelText, xPos + 3, yPos + 9);
          
          try {
            const imgBase64 = await getPhotoBase64(photo.photoUrl);
            if (imgBase64) {
              doc.addImage(imgBase64, 'JPEG', xPos + 3, yPos + 11, colWidth - 6, colHeight - 11);
            } else {
              throw new Error("No image data");
            }
          } catch (imgErr) {
            console.error("Erro ao inserir imagem no PDF:", imgErr);
            doc.setFillColor(241, 245, 249);
            doc.rect(xPos + 3, yPos + 11, colWidth - 6, colHeight - 11, "F");
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(239, 68, 68);
            doc.text("[Imagem não disponível]", xPos + colWidth/2 - 15, yPos + colHeight/2 + 5);
          }
          
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(6);
          doc.setTextColor(148, 163, 184);
          const photoTime = photo.timestamp ? new Date(photo.timestamp).toLocaleString('pt-BR') : 'N/A';
          const timestampText = `Por ${photo.conferenteId || 'N/A'} em ${photoTime}`;
          doc.text(timestampText, xPos + 3, yPos + colHeight + 9);
        }
      }

      if (returnDoc) {
        const base64Data = doc.output('datauristring').split(',')[1];
        return { success: true, doc, filename, base64: base64Data };
      }

      // Mark audit as PDF downloaded and finalize process cycle for this map
      const normAuditMap = normalizeMapCode(audit.routeMap).toUpperCase();
      const isDivergent = audit.items && audit.items.some(i => i.physicalQty !== undefined && i.fiscalQty !== undefined && i.physicalQty !== i.fiscalQty);
      const updatedAudit: AuditSession = {
        ...audit,
        pdfDownloaded: true,
        status: (audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente')
          ? audit.status
          : (isDivergent ? 'finalizado_divergente' : 'finalizado_ok')
      };

      let nextRoutes = importedRoutes;
      if (importedRoutes && importedRoutes.length > 0) {
        nextRoutes = importedRoutes.map(r => {
          const normR = normalizeMapCode(r.routeMap).toUpperCase();
          const isMatch = normR === normAuditMap || 
            (audit.unifiedMaps && audit.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === normR));
          if (isMatch) {
            return { ...r, status: 'fechado' as const };
          }
          return r;
        });
        if (onSaveImportedRoutes) {
          onSaveImportedRoutes(nextRoutes);
        }
      }

      const nextAudits = audits.map(a => a.id === audit.id ? updatedAudit : a);
      if (!audits.some(a => a.id === audit.id)) {
        nextAudits.push(updatedAudit);
      }
      onSaveAudits(nextAudits);

      if (isClientFirebaseActive()) {
        saveDirectlyToFirestore({
          audits: nextAudits,
          importedRoutes: nextRoutes
        }).catch(() => {});
      }
      
      // Standard robust download supported in all browsers and iframe contexts
      doc.save(filename);
      return true;
    } catch (e: any) {
      console.error("Erro ao gerar PDF da auditoria unica:", e);
      alert("Erro ao gerar o PDF da auditoria: " + e.message);
      return false;
    }
  };

  const handleDownloadDailyProduction = async (targetDate: string) => {
    setExportingDailyProduction(true);
    try {
      // Find all audits of that date (both ok and divergent final status)
      const auditsOfDate = audits.filter(a => 
        a.arrivalDate === targetDate && 
        (a.status === 'finalizado_ok' || a.status === 'finalizado_divergente')
      );
      
      if (auditsOfDate.length === 0) {
        alert(`Nenhum mapa de retorno de rota finalizado foi encontrado para a data ${new Date(targetDate + 'T00:00:00').toLocaleDateString('pt-BR')}.`);
        setExportingDailyProduction(false);
        return;
      }

      let successCount = 0;
      for (const audit of auditsOfDate) {
        try {
          await downloadSingleAuditPDF(audit);
          successCount++;
        } catch (singleAuditErr) {
          console.error(`Erro ao exportar mapa ${audit.routeMap}:`, singleAuditErr);
        }
      }
      
      alert(`Exportação concluída! Foram gerados e baixados ${successCount} arquivo(s) de produtividade diária em seu computador.\n\nPor favor, salve os arquivos na pasta da rede correspondente:\nP:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA`);
    } catch (err) {
      console.error("Erro no processo de exportação diária:", err);
      alert("Ocorreu um erro ao gerar os PDFs da produção diária.");
    } finally {
      setExportingDailyProduction(false);
    }
  };

  // Helper to calculate audit duration
  const getDurationText = (start?: string, end?: string) => {
    if (!start || !end) return 'N/A';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  // Live reconciliation item helpers
  const handleUpdateFiscalQty = (productCode: string, val: number | undefined) => {
    if (!activeSession) return;
    const updatedItems = activeSession.items.map(item => {
      if (item.productCode === productCode) {
        return { ...item, fiscalQty: val };
      }
      return item;
    });
    setActiveSession({ ...activeSession, items: updatedItems });
  };

  const recFilteredProducts = recProductSearch.trim() === ''
    ? []
    : products.filter(p => 
        p.code.toLowerCase().includes(recProductSearch.toLowerCase()) || 
        p.description.toLowerCase().includes(recProductSearch.toLowerCase())
      ).slice(0, 10);

  const handleSelectRecProduct = (prod: Product) => {
    setRecSelectedProductCode(prod.code);
    setRecProductSearch(`[${prod.code}] ${prod.description}`);
    
    // Look up default fiscal qty from the imported route map
    if (activeSession) {
      const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === activeSession.routeMap.toUpperCase());
      const matchingRouteItem = matchingRoute?.items?.find(item => item.productCode === prod.code);
      if (matchingRouteItem) {
        setRecProductFiscalQtyToAdd(matchingRouteItem.qty);
      } else {
        setRecProductFiscalQtyToAdd(0);
      }
    }
    setRecProductQtyToAdd(0); // Physical qty default 0
  };

  const handleManualAddProductToReconciliation = () => {
    if (!activeSession) return;
    if (!recSelectedProductCode) {
      alert('Por favor, selecione um produto.');
      return;
    }
    const fiscalQty = Number(recProductFiscalQtyToAdd) || 0;

    const prod = products.find(p => p.code === recSelectedProductCode);
    if (!prod) return;

    const existingIndex = activeSession.items.findIndex(i => i.productCode === recSelectedProductCode);
    let updatedItems = [...activeSession.items];

    if (existingIndex > -1) {
      const currentItem = updatedItems[existingIndex];
      updatedItems[existingIndex] = {
        ...currentItem,
        fiscalQty: fiscalQty
      };
    } else {
      const newItem: AuditItem = {
        productCode: prod.code,
        productDescription: prod.description,
        cost: prod.cost,
        physicalQty: 0,
        rePhysicalQty: undefined,
        fiscalQty: fiscalQty
      };
      updatedItems.push(newItem);
    }

    const updatedSession = { ...activeSession, items: updatedItems };
    setActiveSession(updatedSession);

    // Save update to database so other views stay in sync
    const updatedAudits = audits.map(a => a.id === activeSession.id ? updatedSession : a);
    onSaveAudits(updatedAudits);

    // Reset form states
    setRecProductSearch('');
    setRecSelectedProductCode('');
    setRecProductQtyToAdd('');
    setRecProductFiscalQtyToAdd('');
    alert('Produto inserido com sucesso na conciliação! Se for necessária uma nova conferência física, ela aparecerá para o conferente realizar.');
  };

  const handleUpdateAssetFiscalQty = (assetId: string, val: number | undefined) => {
    if (!activeSession) return;
    
    const updatedAssets = activeSession.assets.map(asset => {
      if (asset.assetId === assetId) {
        return { ...asset, fiscalQty: val };
      }
      return asset;
    });
    setActiveSession({ ...activeSession, assets: updatedAssets });
  };

  const handleUpdateAssetComodatoQty = (assetId: string, val: number) => {
    if (!activeSession) return;
    
    const updatedAssets = activeSession.assets.map(asset => {
      if (asset.assetId === assetId) {
        return { ...asset, comodatoQty: val };
      }
      return asset;
    });
    setActiveSession({ ...activeSession, assets: updatedAssets });
  };

  const handleUpdateAssetRecolhaQty = (assetId: string, val: number) => {
    if (!activeSession) return;
    
    const updatedAssets = activeSession.assets.map(asset => {
      if (asset.assetId === assetId) {
        return { ...asset, recolhaQty: val };
      }
      return asset;
    });
    setActiveSession({ ...activeSession, assets: updatedAssets });
  };

  const handleUpdateItemComodatoQty = (productCode: string, val: number) => {
    if (!activeSession) return;
    const updatedItems = activeSession.items.map(item => {
      if (item.productCode === productCode) {
        return { ...item, comodatoQty: val };
      }
      return item;
    });
    setActiveSession({ ...activeSession, items: updatedItems });
  };

  const handleUpdateItemRecolhaQty = (productCode: string, val: number) => {
    if (!activeSession) return;
    const updatedItems = activeSession.items.map(item => {
      if (item.productCode === productCode) {
        return { ...item, recolhaQty: val };
      }
      return item;
    });
    setActiveSession({ ...activeSession, items: updatedItems });
  };

  // Action: Request physical recount (Reconferência)
  const handleRequestReconferencia = () => {
    if (!activeSession) return;
    if (!reconciliationNotes.trim()) {
      alert('Por favor, informe no campo de observações o motivo da reconferência (quais produtos apresentaram divergência).');
      return;
    }

    const now = new Date().toISOString();
    const updatedSession: AuditSession = {
      ...activeSession,
      status: 'reconferencia',
      reconciliationNotes: reconciliationNotes.trim(),
      history: [
        ...activeSession.history,
        {
          timestamp: now,
          action: 'Reconferência Solicitada',
          user: currentUser.name,
          details: reconciliationNotes.trim()
        }
      ]
    };

    const updatedAudits = audits.map(a => a.id === activeSession.id ? updatedSession : a);
    onSaveAudits(updatedAudits);

    // Trigger alert for the Conferente that a recount has been requested
    if (onSaveAlerts && fiscalAlerts) {
      const newAlert: FiscalAlert = {
        id: 'al_' + Date.now(),
        routeMap: activeSession.routeMap,
        plate: activeSession.plate,
        status: 'recontagem_solicitada' as const,
        timestamp: now,
        read: false,
        title: 'Reconferência Solicitada',
        message: `O auxiliar de logística ${currentUser.name} solicitou recontagem para o mapa ${activeSession.routeMap} (${activeSession.plate}). Motivo: ${reconciliationNotes.trim()}`,
        targetRole: 'conferente'
      };
      onSaveAlerts([newAlert, ...fiscalAlerts]);
    }

    // Also set corresponding imported route's status to 'reconferir'
    if (onSaveImportedRoutes && importedRoutes) {
      const updatedRoutes = importedRoutes.map(r => {
        const isMatched = r.routeMap.toUpperCase() === activeSession.routeMap.toUpperCase() ||
          (activeSession.unifiedMaps && activeSession.unifiedMaps.some(m => m.toUpperCase() === r.routeMap.toUpperCase()));
        if (isMatched) {
          return { ...r, status: 'reconferir' as const };
        }
        return r;
      });
      onSaveImportedRoutes(updatedRoutes);
    }

    alert('Reconferência enviada com sucesso!');
    setActiveSession(null);
    setReconciliationNotes('');
  };

  // Action: Finalize and log audit return (Dar Baixa)
  const handleFinalizeReconciliation = () => {
    if (!activeSession || isFinalizing) return;

    // Check if monitoramento reported a discrepancy
    const matchedRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === activeSession.routeMap.toUpperCase());

    const executeFinalization = async () => {
      setIsFinalizing(true);
      try {
        // Check if there are differences
        let hasDiscrepancy = false;
        
        // Verify products
        const itemsWithUpdatedFiscal = activeSession.items.map(item => {
          const physical = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fiscal = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const diff = physical - fiscal + comodato - recolha;
          if (diff !== 0) hasDiscrepancy = true;
          return { ...item, fiscalQty: fiscal, comodatoQty: comodato, recolhaQty: recolha }; // Ensure it has fiscal quantity defined
        });

        // Verify assets
        const assetsWithUpdatedFiscal = activeSession.assets.map(asset => {
          const physical = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fiscal = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const diff = physical - fiscal + comodato - recolha;
          
          // Exclude chapatex from being considered a discrepancy
          const isChapatex = asset.assetId === 'chapatex' || 
                             asset.assetId?.toLowerCase() === 'chapatex' || 
                             asset.assetName?.toUpperCase().includes('CHAPATEX');
                             
          if (diff !== 0 && !isChapatex) hasDiscrepancy = true;
          return { ...asset, fiscalQty: fiscal, comodatoQty: comodato, recolhaQty: recolha }; // Ensure properties are preserved
        });

        const finalStatus = hasDiscrepancy ? 'finalizado_divergente' : 'finalizado_ok';
        const now = new Date().toISOString();

        const updatedSession: AuditSession = {
          ...activeSession,
          items: itemsWithUpdatedFiscal,
          assets: assetsWithUpdatedFiscal,
          status: finalStatus,
          auxiliarId: currentUser.id,
          reconciliationNotes: reconciliationNotes.trim() || undefined,
          financeiroCiente: false, // Força a notificação no painel do Financeiro
          history: [
            ...activeSession.history,
            {
              timestamp: now,
              action: finalStatus === 'finalizado_ok' ? 'Baixa Concluída - OK' : 'Baixa Concluída com Divergências',
              user: currentUser.name,
              details: reconciliationNotes.trim() || 'Aferição concluída'
            }
          ]
        };

        // 1. GERAR O PDF E EXTRAIR BASE64 EM SEGUNDO PLANO (EM MEMÓRIA)
        const pdfRes = await downloadSingleAuditPDF(updatedSession, true);
        if (!pdfRes || !pdfRes.success || !pdfRes.base64) {
          alert("Erro ao gerar o relatório PDF em memória. A baixa foi cancelada.");
          setIsFinalizing(false);
          return;
        }

        const { base64, filename, doc } = pdfRes;

        // Prepare payload data
        const updatedAudits = audits.map(a => a.id === activeSession.id ? updatedSession : a);
        
        let updatedRoutes = importedRoutes;
        if (onSaveImportedRoutes && importedRoutes) {
          updatedRoutes = importedRoutes.map(r => {
            const normR = normalizeMapCode(r.routeMap).toUpperCase();
            const normActive = normalizeMapCode(activeSession.routeMap).toUpperCase();
            const isMatched = normR === normActive || r.routeMap.trim().toUpperCase() === activeSession.routeMap.trim().toUpperCase() ||
              (activeSession.unifiedMaps && activeSession.unifiedMaps.some(m => normalizeMapCode(m).toUpperCase() === normR || m.trim().toUpperCase() === r.routeMap.trim().toUpperCase()));
            if (isMatched) {
              return { ...r, status: 'fechado' as const };
            }
            return r;
          });
        }

        let updatedAlerts = fiscalAlerts;
        if (onSaveAlerts && fiscalAlerts) {
          const newAlert: FiscalAlert = {
            id: 'al_' + Date.now(),
            routeMap: activeSession.routeMap,
            plate: activeSession.plate,
            status: finalStatus,
            timestamp: now,
            read: false,
            title: finalStatus === 'finalizado_ok' ? 'Mapa Baixado (Saldo OK)' : 'Mapa Baixado com Divergências',
            message: `O mapa ${activeSession.routeMap} (${activeSession.plate}) foi finalizado e baixado por ${currentUser.name}.`,
            targetRole: 'todos'
          };
          updatedAlerts = [newAlert, ...fiscalAlerts];
        }

        // 2. DISPARAR A SAGA DE BAIXA NO BACKEND E NO FIRESTORE
        let result: any = { success: true, durableBackup: { cloudStorage: false, firestore: false } };
        try {
          const response = await fetch('/api/concluir-baixa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auditId: activeSession.id,
              pdfBase64: base64,
              filename: filename,
              updatedAuditSession: updatedSession,
              updatedImportedRoutes: updatedRoutes,
              updatedAlerts: updatedAlerts,
              user: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null
            })
          });

          if (response.ok) {
            const serverResult = await response.json();
            if (serverResult && serverResult.success) {
              result = serverResult;
            }
          }
        } catch (srvErr) {
          console.warn("[Baixa Saga] Aviso ao gravar baixa no servidor de retaguarda:", srvErr);
        }

        if (isClientFirebaseActive()) {
          try {
            await saveDirectlyToFirestore({
              audits: updatedAudits,
              importedRoutes: updatedRoutes,
              fiscalAlerts: updatedAlerts
            });
            if (result.durableBackup) {
              result.durableBackup.firestore = true;
            }
          } catch (fsErr) {
            console.warn("[Baixa Saga] Aviso ao sincronizar baixa com Firestore:", fsErr);
          }
        }

        console.log("[Baixa Saga] Sucesso na execução da saga de baixa:", result);

        // 3. CICLO DE VIDA DAS FOTOS: Excluídas no momento do fechamento/exportação para otimização e prevenção de corrupção
        console.log("[Baixa Saga] Excluindo fotos de evidência locais e do servidor para este mapa...");
        try {
          await ImageDB.clearPhotosByAudit(activeSession.id);
          console.log("[Baixa Saga] Fotos excluídas com sucesso.");
        } catch (photoClearErr) {
          console.error("Erro ao excluir fotos de evidência:", photoClearErr);
        }

        // 4. ATUALIZAR OS ESTADOS DE MEMÓRIA DA PLATAFORMA PARA SINC NO CLIENT
        onSaveAudits(updatedAudits);
        if (onSaveImportedRoutes) onSaveImportedRoutes(updatedRoutes);
        if (onSaveAlerts) onSaveAlerts(updatedAlerts);

        // 5. EFETUAR DOWNLOAD DE CONVENIÊNCIA NO NAVEGADOR DO USUÁRIO
        try {
          doc.save(filename);
        } catch (downErr) {
          console.warn("Erro ao iniciar download de backup no navegador:", downErr);
        }

        const isSavedOnServer = result.success === true || !!result.filePath;
        
        let alertMessage = "";
        if (!isSavedOnServer) {
          alertMessage = `Atenção: Houve um atraso na gravação do servidor. O PDF foi baixado no seu computador. O sistema continuará tentando sincronizar em segundo plano.`;
        } else {
          alertMessage = finalStatus === 'finalizado_ok' 
            ? 'Retorno baixado com sucesso! Relatório PDF salvo no servidor de arquivos (pasta compartilhada) e baixado no seu computador.' 
            : 'Retorno baixado com divergências registradas. PDF arquivado no servidor de arquivos e no seu computador com sucesso.';
        }
        alert(alertMessage);
        setActiveSession(null);
        setReconciliationNotes('');

      } catch (sagaErr: any) {
        console.error("[Baixa Saga] Falha crítica na execução:", sagaErr);
        alert(`FALHA CRÍTICA NA BAIXA:\n\n${sagaErr.message || sagaErr}\n\nA operação foi cancelada e o mapa continua pendente de fechamento.`);
      } finally {
        setIsFinalizing(false);
      }
    };

    if (matchedRoute && matchedRoute.discrepancyObservation) {
      requestConfirm(
        "⚠️ Divergência do Monitoramento",
        `ATENÇÃO: O Monitoramento reportou a seguinte divergência de ativos de giro ou P.A para esta rota:\n\n"${matchedRoute.discrepancyObservation}"\n\nDeseja fechar o mapa mesmo assim? Certifique-se de que a divergência foi tratada.`,
        executeFinalization
      );
    } else {
      executeFinalization();
    }
  };

  // Filtering history lists
  const filteredHistory = historyAudits.filter(a => {
    const q = (searchTerm || '').toLowerCase();
    const matchesSearch = !q ||
      (a.routeMap || '').toLowerCase().includes(q) ||
      (a.plate || '').toLowerCase().includes(q) ||
      getDriverName(a.driverId).toLowerCase().includes(q);
    
    // Check date bounds if configured
    let matchesDate = true;
    if (historyStartDate) {
      matchesDate = matchesDate && (a.arrivalDate >= historyStartDate);
    }
    if (historyEndDate) {
      matchesDate = matchesDate && (a.arrivalDate <= historyEndDate);
    }

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'ok' && a.status === 'finalizado_ok') ||
      (statusFilter === 'divergentes' && a.status === 'finalizado_divergente') ||
      (statusFilter === 'reabertos' && (
        a.history?.some(h => h.action.includes('Reabertura Aprovada') || h.action.includes('Reaberto'))
      ));

    return matchesSearch && matchesDate && matchesStatus;
  });

  // Calculate stats for selected active session
  const getDiscrepancyTotals = (session: AuditSession) => {
    let missingCost = 0;
    let surplusCost = 0;
    let missingCount = 0;
    let surplusCount = 0;

    session.items.forEach(item => {
      const physical = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
      const fiscal = item.fiscalQty ?? 0;
      const comodato = item.comodatoQty ?? 0;
      const recolha = item.recolhaQty ?? 0;
      const diff = physical - fiscal + comodato - recolha;
      if (diff < 0) {
        missingCount += Math.abs(diff);
        missingCost += Math.abs(diff) * item.cost;
      } else if (diff > 0) {
        surplusCount += diff;
        surplusCost += diff * item.cost;
      }
    });

    session.assets.forEach(asset => {
      const physical = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
      const fiscal = asset.fiscalQty ?? 0;
      const comodato = asset.comodatoQty ?? 0;
      const recolha = asset.recolhaQty ?? 0;
      const diff = physical - fiscal + comodato - recolha;
      if (diff < 0) {
        missingCount += Math.abs(diff);
        missingCost += Math.abs(diff) * asset.cost;
      } else if (diff > 0) {
        surplusCount += diff;
        surplusCost += diff * asset.cost;
      }
    });

    return { missingCost, surplusCost, missingCount, surplusCount };
  };

  // Download single audit as Excel spreadsheet
  const downloadSingleAuditExcel = (audit: AuditSession) => {
    try {
      const arrivalDateStr = audit.arrivalDate || new Date().toISOString().split('T')[0];
      const [year, month, day] = arrivalDateStr.split('-');
      const formattedDate = `${day}-${month}-${year}`;
      const filename = `Mapa_${audit.routeMap}_${audit.plate}_${formattedDate}.xlsx`;

      const wb = XLSX.utils.book_new();

      const disc = getDiscrepancyTotals(audit);
      const isOk = audit.status === 'finalizado_ok';
      const daysOnRoute = getDaysOnRoute(audit);

      // Sheet 1: Resumo do Mapa
      const summaryData: (string | number)[][] = [
        ['PAU BRASIL DISTRIBUIDORA DE BEBIDAS LTDA'],
        ['RELATÓRIO DE AUDITORIA E CONCILIAÇÃO DE RETORNO DE ROTA'],
        [''],
        ['CAMPO', 'VALOR'],
        ['Mapa de Rota', audit.routeMap],
        ['Placa do Veículo', audit.plate],
        ['Motorista', getDriverName(audit.driverId)],
        ['Ajudante', getHelperName(audit.helperId)],
        ['Data de Chegada', formattedDate],
        ['Tempo em Rota (dias)', daysOnRoute !== null ? `${daysOnRoute} dia(s)` : 'N/A'],
        ['Início Auditoria', audit.startTime ? new Date(audit.startTime).toLocaleString('pt-BR') : 'N/A'],
        ['Término Auditoria', audit.endTime ? new Date(audit.endTime).toLocaleString('pt-BR') : 'N/A'],
        ['Duração da Auditoria', getDurationText(audit.startTime, audit.endTime)],
        ['Status Fiscal', isOk ? '100% OK' : 'CONCILIADO DIVERGENTE'],
        ['Conferente Físico', audit.conferenteId || 'N/A'],
        ['Auxiliar Fiscal', audit.auxiliarId || 'N/A'],
        ['Total Itens Faltantes (Qtd)', disc.missingCount],
        ['Total Itens Sobrando (Qtd)', disc.surplusCount],
        ['Custo Prejuízo Faltas (R$)', disc.missingCost],
        ['Valor Sobras (R$)', disc.surplusCost],
        ['Observações Operacionais', audit.reconciliationNotes || audit.correctiveActionNotes || 'Sem observações']
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo_Geral');

      // Sheet 2: Produtos Acabados (PA)
      if (audit.items && audit.items.length > 0) {
        const paRows: (string | number)[][] = [
          ['Código SKU', 'Descrição do Produto', 'Contagem Física', 'Saldo Fiscal', 'Comodato', 'Recolha', 'Diferença', 'Status', 'Preço Unitário (R$)', 'Impacto Financeiro (R$)']
        ];
        audit.items.forEach(item => {
          const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fisc = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          const unitPrice = getSkuClosedPrice(item.productCode, item.cost || 45.0);
          const impact = diff * unitPrice;
          paRows.push([
            item.productCode,
            item.productDescription || '',
            phys,
            fisc,
            comodato,
            recolha,
            diff,
            diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'),
            unitPrice,
            impact
          ]);
        });
        const wsPA = XLSX.utils.aoa_to_sheet(paRows);
        XLSX.utils.book_append_sheet(wb, wsPA, 'Produtos_PA');
      }

      // Sheet 3: Ativos de Giro (AG)
      if (audit.assets && audit.assets.length > 0) {
        const agRows: (string | number)[][] = [
          ['Código Ativo', 'Descrição do Ativo', 'Contagem Física', 'Saldo Fiscal', 'Comodato', 'Recolha', 'Diferença', 'Status']
        ];
        audit.assets.forEach(asset => {
          const code = getAssetCode(asset.assetId, asset.assetName);
          const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
          const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fisc = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          agRows.push([
            code,
            asset.assetName,
            phys,
            fisc,
            comodato,
            recolha,
            diff,
            isChapatex ? 'ISENTO' : (diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'))
          ]);
        });
        const wsAG = XLSX.utils.aoa_to_sheet(agRows);
        XLSX.utils.book_append_sheet(wb, wsAG, 'Ativos_AG');
      }

      // Sheet 4: Avarias / Refugos
      if (audit.refugos && audit.refugos.length > 0) {
        const refRows: (string | number)[][] = [
          ['Ativo Danificado', 'Motivo do Descarte / Blitz', 'Quantidade']
        ];
        audit.refugos.forEach(ref => {
          refRows.push([ref.assetName, ref.reason, ref.qty]);
        });
        const wsRef = XLSX.utils.aoa_to_sheet(refRows);
        XLSX.utils.book_append_sheet(wb, wsRef, 'Avarias_Refugos');
      }

      // Sheet 5: Linha do Tempo / Log de Auditoria
      if (audit.history && audit.history.length > 0) {
        const histRows: (string | number)[][] = [
          ['Data/Hora', 'Responsável', 'Ação Realizada', 'Detalhes']
        ];
        audit.history.forEach(h => {
          histRows.push([
            new Date(h.timestamp).toLocaleString('pt-BR'),
            h.user,
            h.action,
            h.details || ''
          ]);
        });
        const wsHist = XLSX.utils.aoa_to_sheet(histRows);
        XLSX.utils.book_append_sheet(wb, wsHist, 'Linha_do_Tempo');
      }

      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error("Erro ao gerar Excel do mapa individual:", err);
      alert("Erro ao gerar a planilha Excel do mapa: " + err.message);
    }
  };

  // Download all history audits in a complete multi-sheet Excel file
  const downloadAllHistoryExcel = (auditsToExport: AuditSession[]) => {
    setIsExportingHistoryExcel(true);
    try {
      if (auditsToExport.length === 0) {
        alert("Nenhum mapa finalizado encontrado no histórico para exportar.");
        setIsExportingHistoryExcel(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `Historico_Completo_Mapas_${todayStr}.xlsx`;
      const wb = XLSX.utils.book_new();

      // Sheet 1: Todos os Mapas (Resumo Consolidado)
      const mapsHeaders = [
        'Mapa de Rota', 'Placa', 'Motorista', 'Ajudante', 'Data Chegada', 'Data Cadastro Rota',
        'Dias em Rota', 'Início Auditoria', 'Término Auditoria', 'Duração', 'Status Fiscal',
        'Conferente', 'Auxiliar Fiscal', 'Qtd Faltas (PA+AG)', 'Qtd Sobras (PA+AG)',
        'Custo Faltas (R$)', 'Valor Sobras (R$)', 'Reaberto?', 'Observações'
      ];
      const mapsData: any[][] = [mapsHeaders];

      // Sheet 2: Todos os Itens PA de todos os mapas
      const paHeaders = [
        'Mapa', 'Placa', 'Motorista', 'Data Chegada', 'Código SKU', 'Descrição do Produto',
        'Qtd Física', 'Qtd Fiscal', 'Diferença', 'Status', 'Preço Unitário (R$)', 'Impacto Financeiro (R$)'
      ];
      const paData: any[][] = [paHeaders];

      // Sheet 3: Todos os Ativos AG de todos os mapas
      const agHeaders = [
        'Mapa', 'Placa', 'Motorista', 'Data Chegada', 'Código Ativo', 'Descrição Ativo',
        'Qtd Física', 'Qtd Fiscal', 'Diferença', 'Status'
      ];
      const agData: any[][] = [agHeaders];

      // Sheet 4: Avarias / Refugos
      const avariasHeaders = [
        'Mapa', 'Placa', 'Motorista', 'Data Chegada', 'Ativo Danificado', 'Motivo Descarte', 'Quantidade'
      ];
      const avariasData: any[][] = [avariasHeaders];

      // Sheet 5: Histórico de Eventos
      const eventsHeaders = [
        'Mapa', 'Placa', 'Data/Hora', 'Responsável', 'Ação', 'Detalhes'
      ];
      const eventsData: any[][] = [eventsHeaders];

      auditsToExport.forEach(audit => {
        const disc = getDiscrepancyTotals(audit);
        const isOk = audit.status === 'finalizado_ok';
        const daysOnRoute = getDaysOnRoute(audit);
        const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.trim().toUpperCase());
        const cadastroDate = matchingRoute?.routeDate || 'N/A';
        const reopenInfo = getReopeningInfo(audit);

        mapsData.push([
          audit.routeMap,
          audit.plate,
          getDriverName(audit.driverId),
          getHelperName(audit.helperId),
          audit.arrivalDate,
          cadastroDate,
          daysOnRoute !== null ? daysOnRoute : 'N/A',
          audit.startTime ? new Date(audit.startTime).toLocaleString('pt-BR') : 'N/A',
          audit.endTime ? new Date(audit.endTime).toLocaleString('pt-BR') : 'N/A',
          getDurationText(audit.startTime, audit.endTime),
          isOk ? '100% OK' : 'DIVERGENTE',
          audit.conferenteId || 'N/A',
          audit.auxiliarId || 'N/A',
          disc.missingCount,
          disc.surplusCount,
          disc.missingCost,
          disc.surplusCost,
          reopenInfo.isReopened ? 'SIM' : 'NÃO',
          audit.reconciliationNotes || audit.correctiveActionNotes || ''
        ]);

        audit.items?.forEach(item => {
          const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fisc = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          const unitPrice = getSkuClosedPrice(item.productCode, item.cost || 45.0);
          paData.push([
            audit.routeMap,
            audit.plate,
            getDriverName(audit.driverId),
            audit.arrivalDate,
            item.productCode,
            item.productDescription || '',
            phys,
            fisc,
            diff,
            diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'),
            unitPrice,
            diff * unitPrice
          ]);
        });

        audit.assets?.forEach(asset => {
          const code = getAssetCode(asset.assetId, asset.assetName);
          const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
          const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fisc = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          agData.push([
            audit.routeMap,
            audit.plate,
            getDriverName(audit.driverId),
            audit.arrivalDate,
            code,
            asset.assetName,
            phys,
            fisc,
            diff,
            isChapatex ? 'ISENTO' : (diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'))
          ]);
        });

        audit.refugos?.forEach(ref => {
          avariasData.push([
            audit.routeMap,
            audit.plate,
            getDriverName(audit.driverId),
            audit.arrivalDate,
            ref.assetName,
            ref.reason,
            ref.qty
          ]);
        });

        audit.history?.forEach(h => {
          eventsData.push([
            audit.routeMap,
            audit.plate,
            new Date(h.timestamp).toLocaleString('pt-BR'),
            h.user,
            h.action,
            h.details || ''
          ]);
        });
      });

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mapsData), 'Todos_Mapas');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paData), 'Itens_PA_Geral');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(agData), 'Ativos_AG_Geral');
      if (avariasData.length > 1) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(avariasData), 'Avarias_Refugos');
      }
      if (eventsData.length > 1) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(eventsData), 'Linha_do_Tempo');
      }

      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error("Erro ao exportar histórico completo em Excel:", err);
      alert("Erro ao gerar o arquivo Excel do histórico: " + err.message);
    } finally {
      setIsExportingHistoryExcel(false);
    }
  };

  // Download executive consolidated history report in PDF
  const downloadHistoryConsolidatedPDF = (auditsToExport: AuditSession[]) => {
    setIsExportingHistoryPDF(true);
    try {
      if (auditsToExport.length === 0) {
        alert("Nenhum mapa finalizado encontrado no histórico para exportar.");
        setIsExportingHistoryPDF(false);
        return;
      }

      const doc = new jsPDF();
      let currentY = 15;

      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > 275) {
          doc.addPage();
          currentY = 15;
          return true;
        }
        return false;
      };

      // Header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("PAU BRASIL DISTRIBUIDORA DE BEBIDAS LTDA", 14, currentY);
      currentY += 5;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Guarabira / PB - CEP: 58200-000 | Fone: (83) 3271-1000", 14, currentY);
      currentY += 4;
      doc.text("CONTROLE DE ACURACIDADE - PACOTE PREJUÍZO (LOGÍSTICA)", 14, currentY);
      currentY += 4;

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(14, currentY, 196, currentY);
      currentY += 8;

      // Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("RELATÓRIO CONSOLIDADO DO HISTÓRICO DE AUDITORIAS DE RETORNO", 14, currentY);
      currentY += 6;

      // Summary Dashboard in PDF
      const totalMaps = auditsToExport.length;
      const okMaps = auditsToExport.filter(a => a.status === 'finalizado_ok').length;
      const divMaps = auditsToExport.filter(a => a.status === 'finalizado_divergente').length;

      let missingQtyTotal = 0;
      let surplusQtyTotal = 0;
      let lossValueTotal = 0;
      let surplusValueTotal = 0;

      auditsToExport.forEach(audit => {
        const disc = getDiscrepancyTotals(audit);
        missingQtyTotal += disc.missingCount;
        surplusQtyTotal += disc.surplusCount;
        lossValueTotal += disc.missingCost;
        surplusValueTotal += disc.surplusCost;
      });

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, currentY, 182, 22, "FD");

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Total de Mapas:`, 18, currentY + 6);
      doc.text(`Mapas 100% OK:`, 65, currentY + 6);
      doc.text(`Mapas Divergentes:`, 115, currentY + 6);
      doc.text(`Data de Emissão:`, 160, currentY + 6);

      doc.text(`Faltas Totais:`, 18, currentY + 16);
      doc.text(`Prejuízo Faltas:`, 65, currentY + 16);
      doc.text(`Sobras Totais:`, 115, currentY + 16);
      doc.text(`Valor Sobras:`, 160, currentY + 16);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalMaps} mapas`, 18, currentY + 10);
      doc.setTextColor(16, 124, 65);
      doc.text(`${okMaps} mapas`, 65, currentY + 10);
      doc.setTextColor(220, 38, 38);
      doc.text(`${divMaps} mapas`, 115, currentY + 10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${new Date().toLocaleDateString('pt-BR')}`, 160, currentY + 10);

      doc.setTextColor(220, 38, 38);
      doc.text(`${missingQtyTotal} itens`, 18, currentY + 20);
      doc.text(`R$ ${lossValueTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 65, currentY + 20);
      doc.setTextColor(217, 119, 6);
      doc.text(`${surplusQtyTotal} itens`, 115, currentY + 20);
      doc.text(`R$ ${surplusValueTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 160, currentY + 20);

      currentY += 28;

      // Table Header
      doc.setFillColor(30, 41, 59);
      doc.rect(14, currentY, 182, 6.5, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Mapa", 16, currentY + 4.5);
      doc.text("Placa", 36, currentY + 4.5);
      doc.text("Motorista", 56, currentY + 4.5);
      doc.text("Chegada", 108, currentY + 4.5);
      doc.text("Duração", 126, currentY + 4.5);
      doc.text("Status", 146, currentY + 4.5);
      doc.text("Faltas/Sobras", 170, currentY + 4.5);
      currentY += 6.5;

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(51, 65, 85);

      auditsToExport.forEach(audit => {
        checkPageBreak(7.5);
        const disc = getDiscrepancyTotals(audit);
        const isOk = audit.status === 'finalizado_ok';
        const formattedArrival = audit.arrivalDate ? new Date(audit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
        const driver = getDriverName(audit.driverId).substring(0, 24);

        doc.setFontSize(7);
        doc.text(`${audit.routeMap}`, 16, currentY + 4.5);
        doc.text(`${audit.plate}`, 36, currentY + 4.5);
        doc.text(`${driver}`, 56, currentY + 4.5);
        doc.text(`${formattedArrival}`, 108, currentY + 4.5);
        doc.text(`${getDurationText(audit.startTime, audit.endTime)}`, 126, currentY + 4.5);

        doc.setFont("Helvetica", "bold");
        if (isOk) {
          doc.setTextColor(16, 124, 65);
          doc.text("100% OK", 146, currentY + 4.5);
        } else {
          doc.setTextColor(220, 38, 38);
          doc.text("DIVERGENTE", 146, currentY + 4.5);
        }

        doc.setFont("Helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        if (isOk) {
          doc.text("-", 170, currentY + 4.5);
        } else {
          doc.text(`F:${disc.missingCount} | S:${disc.surplusCount}`, 170, currentY + 4.5);
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY + 6, 196, currentY + 6);
        currentY += 6;
      });

      // Signatures
      checkPageBreak(35);
      currentY += 10;
      doc.setDrawColor(203, 213, 225);
      doc.line(14, currentY, 65, currentY);
      doc.line(78, currentY, 129, currentY);
      doc.line(142, currentY, 193, currentY);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("CONFERENTE RESPONSÁVEL", 14, currentY + 4);
      doc.text("FISCAL DE RETORNO", 78, currentY + 4);
      doc.text("COORDENADOR LOGÍSTICA", 142, currentY + 4);

      const todayStr = new Date().toISOString().split('T')[0];
      doc.save(`Relatorio_Consolidado_Historico_${todayStr}.pdf`);
    } catch (err: any) {
      console.error("Erro ao gerar PDF consolidado do histórico:", err);
      alert("Erro ao gerar o PDF consolidado do histórico: " + err.message);
    } finally {
      setIsExportingHistoryPDF(false);
    }
  };

  // Download all individual PDFs packaged in a single ZIP file
  const downloadBatchHistoryPDFs = async (auditsToExport: AuditSession[]) => {
    if (auditsToExport.length === 0) {
      alert("Nenhum mapa finalizado encontrado no histórico para exportação.");
      return;
    }
    
    setIsBatchDownloadingHistory(true);
    let success = 0;
    try {
      const zip = new JSZip();
      const folderName = `Auditorias_PDFs_${auditsToExport.length}_Mapas`;
      const zipFolder = zip.folder(folderName) || zip;

      for (let i = 0; i < auditsToExport.length; i++) {
        const audit = auditsToExport[i];
        setBatchDownloadProgress({ current: i + 1, total: auditsToExport.length, map: audit.routeMap });
        try {
          const res: any = await downloadSingleAuditPDF(audit, true);
          if (res && res.success && res.doc) {
            const pdfBlob = res.doc.output('blob');
            zipFolder.file(res.filename, pdfBlob);
            success++;
          }
        } catch (e) {
          console.error(`Erro ao gerar PDF do mapa ${audit.routeMap}:`, e);
        }
      }

      if (success === 0) {
        alert("Não foi possível gerar os arquivos PDF dos mapas.");
        return;
      }

      setBatchDownloadProgress({ current: auditsToExport.length, total: auditsToExport.length, map: 'Compactando arquivo ZIP...' });
      const content = await zip.generateAsync({ type: 'blob' });

      const todayStr = new Date().toISOString().split('T')[0];
      const zipFilename = `Auditorias_PDFs_${auditsToExport.length}_Mapas_${todayStr}.zip`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = zipFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      alert(`Download de todos os ${success} PDFs concluído com sucesso em arquivo ZIP único!\n\nArquivo: ${zipFilename}\n\nBasta extrair no diretório da rede:\nP:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA`);
    } catch (err: any) {
      console.error("Erro durante a geração do pacote ZIP de PDFs:", err);
      alert("Ocorreu um erro ao gerar o arquivo ZIP: " + err.message);
    } finally {
      setIsBatchDownloadingHistory(false);
      setBatchDownloadProgress(null);
    }
  };

  // Download single audit as JSON format
  const downloadSingleAuditJSON = async (audit: AuditSession) => {
    try {
      // Fetch associated photos from ImageDB
      const photos = await ImageDB.getPhotosByAudit(audit.id);

      const arrivalDateStr = audit.arrivalDate || new Date().toISOString().split('T')[0];
      const [year, month, day] = arrivalDateStr.split('-');
      const formattedDate = `${day}-${month}-${year}`;
      const filename = `Mapa_${audit.routeMap}_${audit.plate}_${formattedDate}.json`;

      const disc = getDiscrepancyTotals(audit);
      const isOk = audit.status === 'finalizado_ok';
      const daysOnRoute = getDaysOnRoute(audit);
      const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.trim().toUpperCase());
      const reopenInfo = getReopeningInfo(audit);

      const auditPayload = {
        id: audit.id,
        routeMap: audit.routeMap,
        unifiedMaps: audit.unifiedMaps || [],
        plate: audit.plate,
        driverId: audit.driverId,
        driverName: getDriverName(audit.driverId),
        helperId: audit.helperId || null,
        helperName: getHelperName(audit.helperId),
        arrivalDate: audit.arrivalDate,
        routeDate: matchingRoute?.routeDate || null,
        daysOnRoute: daysOnRoute,
        startTime: audit.startTime,
        endTime: audit.endTime,
        duration: getDurationText(audit.startTime, audit.endTime),
        status: audit.status,
        statusDescription: isOk ? '100% OK' : 'DIVERGENTE',
        conferenteId: audit.conferenteId || null,
        auxiliarId: audit.auxiliarId || null,
        reopened: reopenInfo.isReopened,
        reopenedAt: reopenInfo.reopenedAt || null,
        observations: audit.reconciliationNotes || audit.correctiveActionNotes || null,
        totals: {
          missingItemsCount: disc.missingCount,
          surplusItemsCount: disc.surplusCount,
          missingCostBRL: disc.missingCost,
          surplusValueBRL: disc.surplusCost,
          photosCount: photos.length
        },
        itemsPA: (audit.items || []).map(item => {
          const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
          const fisc = item.fiscalQty ?? 0;
          const comodato = item.comodatoQty ?? 0;
          const recolha = item.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          const unitPrice = getSkuClosedPrice(item.productCode, item.cost || 45.0);
          return {
            productCode: item.productCode,
            productDescription: item.productDescription || '',
            physicalQty: phys,
            fiscalQty: fisc,
            comodatoQty: comodato,
            recolhaQty: recolha,
            difference: diff,
            status: diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'),
            unitPriceBRL: unitPrice,
            financialImpactBRL: diff * unitPrice
          };
        }),
        assetsAG: (audit.assets || []).map(asset => {
          const code = getAssetCode(asset.assetId, asset.assetName);
          const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
          const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
          const fisc = asset.fiscalQty ?? 0;
          const comodato = asset.comodatoQty ?? 0;
          const recolha = asset.recolhaQty ?? 0;
          const diff = (phys + comodato - recolha) - fisc;
          return {
            assetCode: code,
            assetName: asset.assetName,
            physicalQty: phys,
            fiscalQty: fisc,
            comodatoQty: comodato,
            recolhaQty: recolha,
            difference: diff,
            status: isChapatex ? 'ISENTO' : (diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'))
          };
        }),
        refugosAvarias: (audit.refugos || []).map(ref => ({
          assetName: ref.assetName,
          reason: ref.reason,
          quantity: ref.qty
        })),
        photos: photos.map(p => ({
          id: p.id,
          itemCode: p.itemCode,
          itemName: p.itemName,
          type: p.type,
          timestamp: p.timestamp,
          conferenteId: p.conferenteId,
          photoUrl: p.photoUrl
        })),
        historyTimeline: (audit.history || []).map(h => ({
          timestamp: h.timestamp,
          user: h.user,
          action: h.action,
          details: h.details || ''
        }))
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      console.error("Erro ao gerar JSON do mapa individual:", err);
      alert("Erro ao gerar o arquivo JSON do mapa: " + err.message);
    }
  };

  // Download all history audits as a JSON file
  const downloadAllHistoryJSON = async (auditsToExport: AuditSession[]) => {
    setIsExportingHistoryJSON(true);
    try {
      if (auditsToExport.length === 0) {
        alert("Nenhum mapa finalizado encontrado no histórico para exportar.");
        setIsExportingHistoryJSON(false);
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const filename = `Historico_Completo_Mapas_${todayStr}.json`;

      const formattedAudits = await Promise.all(auditsToExport.map(async (audit) => {
        const photos = await ImageDB.getPhotosByAudit(audit.id);
        const disc = getDiscrepancyTotals(audit);
        const isOk = audit.status === 'finalizado_ok';
        const daysOnRoute = getDaysOnRoute(audit);
        const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.trim().toUpperCase());
        const reopenInfo = getReopeningInfo(audit);

        return {
          id: audit.id,
          routeMap: audit.routeMap,
          unifiedMaps: audit.unifiedMaps || [],
          plate: audit.plate,
          driverId: audit.driverId,
          driverName: getDriverName(audit.driverId),
          helperId: audit.helperId || null,
          helperName: getHelperName(audit.helperId),
          arrivalDate: audit.arrivalDate,
          routeDate: matchingRoute?.routeDate || null,
          daysOnRoute: daysOnRoute,
          startTime: audit.startTime,
          endTime: audit.endTime,
          duration: getDurationText(audit.startTime, audit.endTime),
          status: audit.status,
          statusDescription: isOk ? '100% OK' : 'DIVERGENTE',
          conferenteId: audit.conferenteId || null,
          auxiliarId: audit.auxiliarId || null,
          reopened: reopenInfo.isReopened,
          reopenedAt: reopenInfo.reopenedAt || null,
          observations: audit.reconciliationNotes || audit.correctiveActionNotes || null,
          totals: {
            missingItemsCount: disc.missingCount,
            surplusItemsCount: disc.surplusCount,
            missingCostBRL: disc.missingCost,
            surplusValueBRL: disc.surplusCost,
            photosCount: photos.length
          },
          itemsPA: (audit.items || []).map(item => {
            const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
            const fisc = item.fiscalQty ?? 0;
            const comodato = item.comodatoQty ?? 0;
            const recolha = item.recolhaQty ?? 0;
            const diff = (phys + comodato - recolha) - fisc;
            const unitPrice = getSkuClosedPrice(item.productCode, item.cost || 45.0);
            return {
              productCode: item.productCode,
              productDescription: item.productDescription || '',
              physicalQty: phys,
              fiscalQty: fisc,
              comodatoQty: comodato,
              recolhaQty: recolha,
              difference: diff,
              status: diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'),
              unitPriceBRL: unitPrice,
              financialImpactBRL: diff * unitPrice
            };
          }),
          assetsAG: (audit.assets || []).map(asset => {
            const code = getAssetCode(asset.assetId, asset.assetName);
            const isChapatex = code === '899599' || (asset.assetName || '').toLowerCase().includes('chapatex');
            const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
            const fisc = asset.fiscalQty ?? 0;
            const comodato = asset.comodatoQty ?? 0;
            const recolha = asset.recolhaQty ?? 0;
            const diff = (phys + comodato - recolha) - fisc;
            return {
              assetCode: code,
              assetName: asset.assetName,
              physicalQty: phys,
              fiscalQty: fisc,
              comodatoQty: comodato,
              recolhaQty: recolha,
              difference: diff,
              status: isChapatex ? 'ISENTO' : (diff === 0 ? 'OK' : (diff < 0 ? 'FALTA' : 'SOBRA'))
            };
          }),
          refugosAvarias: (audit.refugos || []).map(ref => ({
            assetName: ref.assetName,
            reason: ref.reason,
            quantity: ref.qty
          })),
          photos: photos.map(p => ({
            id: p.id,
            itemCode: p.itemCode,
            itemName: p.itemName,
            type: p.type,
            timestamp: p.timestamp,
            conferenteId: p.conferenteId,
            photoUrl: p.photoUrl
          })),
          historyTimeline: (audit.history || []).map(h => ({
            timestamp: h.timestamp,
            user: h.user,
            action: h.action,
            details: h.details || ''
          }))
        };
      }));

      const exportPayload = {
        metadata: {
          company: "PAU BRASIL DISTRIBUIDORA DE BEBIDAS LTDA",
          title: "Histórico Consolidado de Auditorias de Retorno de Rota",
          exportDate: new Date().toISOString(),
          totalAudits: auditsToExport.length,
          generatedBy: currentUser.name,
          userRole: currentUser.role
        },
        audits: formattedAudits
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      console.error("Erro ao exportar histórico completo em JSON:", err);
      alert("Erro ao gerar o arquivo JSON do histórico: " + err.message);
    } finally {
      setIsExportingHistoryJSON(false);
    }
  };

  const handleOpenBackupModal = async () => {
    setLoadingBackupPhotos(true);
    try {
      const photos = await ImageDB.getAllPhotos();
      setBackupPhotos(photos || []);
    } catch (e) {
      console.error("Error loading photos for backup:", e);
    } finally {
      setLoadingBackupPhotos(false);
      setShowBackupModal(true);
    }
  };

  return (
    <div className="w-full px-2 sm:px-6 lg:px-8 py-4 sm:py-8" id="fiscal_view">
      {/* ALERTA DE MAPAS BAIXADOS PARA O FINANCEIRO (FECHAMENTO NO PROMAX) */}
      {currentUser.role === 'financeiro' && unacknowledgedBaixas.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-5 shadow-lg animate-fade-in">
          <div className="flex items-start space-x-4">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-md shrink-0">
              <ShieldAlert className="h-6 w-6 animate-pulse" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-sans font-black text-sm sm:text-base text-indigo-900 uppercase tracking-tight flex items-center gap-1.5">
                    🚨 Mapas Aguardando Fechamento no Promax
                  </h3>
                  <p className="text-xs text-indigo-700 font-medium">
                    As colaboradoras realizaram a baixa fiscal dos mapas abaixo. É necessário efetuar o fechamento definitivo correspondente no sistema <strong>Promax</strong>.
                  </p>
                </div>
                <span className="bg-indigo-200/80 text-indigo-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase font-mono shadow-3xs border border-indigo-300 animate-pulse shrink-0">
                  {unacknowledgedBaixas.length} Pendente{unacknowledgedBaixas.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
                {unacknowledgedBaixas.map((audit) => {
                  const isOk = audit.status === 'finalizado_ok';
                  const fechamentoLog = audit.history?.find(h => h.action.includes('Baixa Concluída')) || audit.history?.[audit.history.length - 1];
                  const fechamentoTime = fechamentoLog ? new Date(fechamentoLog.timestamp).toLocaleString('pt-BR') : 'N/A';
                  
                  return (
                    <div key={audit.id} className="bg-white border border-indigo-150 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-black text-sm text-slate-800">{audit.routeMap}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isOk ? 'Saldo OK' : 'Divergente'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono space-y-0.5 leading-relaxed">
                          <div>🚗 <strong>Placa:</strong> {audit.plate}</div>
                          <div>👤 <strong>Motorista:</strong> {getDriverName(audit.driverId)}</div>
                          <div>🕒 <strong>Baixado em:</strong> {fechamentoTime}</div>
                          <div>👩‍💻 <strong>Por:</strong> {fechamentoLog?.user || 'Colaboradora'}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAcknowledgePromax(audit.id)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-sans font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-1 border border-indigo-500"
                      >
                        <Check className="h-4 w-4" />
                        <span>Marcar como Ciente / Fechado no Promax</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upper Navigation Header */}
      <div className="bg-slate-800 rounded-2xl p-6 mb-8 text-white shadow-xl border border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-amber-500 text-slate-950 font-mono text-xxs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
            Painel Fiscal (Reconciliação & Baixas)
          </span>
          <h1 className="text-3xl font-sans font-bold tracking-tight text-white mt-3">
            Confronto de Saldo Físico vs Fiscal
          </h1>
          <p className="text-slate-300 mt-1 text-sm max-w-2xl">
            Verifique as aferições do Conferente Física, compare com o Saldo Fiscal de Retorno e aprove os retornos de rota. Lance reconferências caso encontre divergências inexplicáveis.
          </p>
        </div>
        
        <div className="flex items-center space-x-3 shrink-0 relative">
          {/* NOTIFICATION BUBBLE FROM MONITORAMENTO */}
          {(() => {
            const pernoiteForecasts = returnForecasts.filter(f => isForecastActivePernoite(f, audits, importedRoutes));
            const emRotaWithEta = returnForecasts.filter(f => f.tripStatus !== 'pernoitam' && f.eta && f.status !== 'no_patio');
            const totalNotifications = pernoiteForecasts.length + emRotaWithEta.length;

            return (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMonitorAlerts(!showMonitorAlerts)}
                  className={`relative p-2.5 rounded-xl border transition-all duration-300 flex items-center space-x-2 cursor-pointer ${
                    totalNotifications > 0 
                      ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25 text-amber-400 animate-pulse-slow' 
                      : 'bg-slate-700 border-slate-600 hover:bg-slate-650 text-slate-400'
                  }`}
                  title="Alertas de Rastreamento (Pernoites e Previsões)"
                >
                  <Clock className="h-4.5 w-4.5" />
                  <span className="font-sans font-bold text-xs text-white">Pernoites & Chegadas</span>
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white font-mono text-[9px] font-extrabold h-4.5 w-4.5 rounded-full flex items-center justify-center animate-bounce shadow-md border border-slate-800">
                      {totalNotifications}
                    </span>
                  )}
                </button>

                {showMonitorAlerts && (
                  <div className="absolute right-0 top-12 mt-2 w-80 md:w-96 bg-white border border-slate-200 text-slate-900 rounded-2xl shadow-2xl p-4 z-50 animate-fade-in space-y-4 font-sans">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="font-sans font-black text-xs text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-amber-500" />
                        Alertas do Rastreamento
                      </span>
                      <button 
                        type="button"
                        onClick={() => setShowMonitorAlerts(false)}
                        className="text-slate-400 hover:text-slate-600 font-bold text-xs px-2 py-0.5 rounded hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>

                    {/* SECTION 1: PERNOITE */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">
                        <span>🌙 IRÃO PERNOITAR ({pernoiteForecasts.length})</span>
                      </div>
                      {pernoiteForecasts.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Nenhum veículo em pernoite cadastrado.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {pernoiteForecasts.map((f) => (
                            <div key={f.id} className="bg-amber-50/70 p-2 rounded-lg border border-amber-200 space-y-1 text-xxs">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-950 font-mono">MAPA {f.routeMap}</span>
                                <span className="bg-amber-100 text-amber-800 font-black text-[8px] uppercase px-1.5 py-0.2 rounded font-mono">🌙 Pernoitar</span>
                              </div>
                              <div className="text-slate-600 font-sans">
                                <div><strong>Placa:</strong> {f.plate} | <strong>Motorista:</strong> {f.driverName}</div>
                                <div><strong>Previsão de Retorno:</strong> {f.eta}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: ETA PREVISOES */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                        <span>⏰ PREVISÕES DE CHEGADA ({emRotaWithEta.length})</span>
                      </div>
                      {emRotaWithEta.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Nenhuma nova previsão de chegada.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {emRotaWithEta.map((f) => (
                            <div key={f.id} className="bg-indigo-50/40 p-2 rounded-lg border border-indigo-150 space-y-1 text-xxs">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-slate-950 font-mono">MAPA {f.routeMap}</span>
                                <span className="bg-indigo-100 text-indigo-800 font-bold text-[8px] uppercase px-1.5 py-0.2 rounded font-mono">⏰ Em Rota</span>
                              </div>
                              <div className="text-slate-600 font-sans">
                                <div><strong>Placa:</strong> {f.plate} | <strong>Motorista:</strong> {f.driverName}</div>
                                <div className="text-indigo-900 font-bold"><strong>Previsão ETA:</strong> {f.eta}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {activeSession && (
            <button
              onClick={() => {
                setActiveSession(null);
                setReconciliationNotes('');
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-600 transition"
            >
              Voltar para Listagem
            </button>
          )}
        </div>
      </div>

      {!activeSession ? (
        <div className="space-y-8">
          
          {/* Section: Sincronizador de Liberação Diária (Spreadsheet Route Import) */}
          {activeTab === 'sincronizador' && (currentUser.role === 'gestor' || currentUser.role === 'auxiliar_logistica') && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-100 gap-4">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-xl">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-sans font-bold text-lg text-slate-900 uppercase">Sincronizador & Importador de Rotas</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Importe a planilha diária para prever as rotas e placas de amanhã.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-150 text-[11px] font-semibold">
                    <span>Rotina do Promax para exportar rotas:</span>
                    <strong className="text-emerald-900 font-mono bg-white px-1.5 py-0.2 rounded border border-emerald-200">03.11.49.02</strong>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 px-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Data da Rota:</span>
                  <input
                    type="date"
                    value={routeImportDate}
                    onChange={(e) => setRouteImportDate(e.target.value)}
                    className="text-xs bg-transparent border-none text-slate-900 focus:outline-none font-semibold font-mono cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setRouteImportDate(getTodayLocalDateStr())}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    routeImportDate === getTodayLocalDateStr()
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                  title="Voltar para a data de hoje"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Hoje</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const activeDateRoutes = (importedRoutes || []).filter(r => r.routeDate === routeImportDate);
                    if (activeDateRoutes.length === 0) {
                      alert('Nenhum mapa importado para esta data.');
                      return;
                    }
                    requestConfirm(
                      "⚠️ Apagar Mapas do Dia?",
                      `Tem certeza que deseja apagar TODOS os ${activeDateRoutes.length} mapas importados, descarregamentos e auditorias para a data ${new Date(routeImportDate + 'T00:00:00').toLocaleDateString('pt-BR')}?`,
                      () => {
                        const mapsNormToDelete = new Set(
                          activeDateRoutes.map(r => normalizeMapCode(r.routeMap).toUpperCase())
                        );
                        const mapsUpperToDelete = new Set(
                          activeDateRoutes.map(r => (r.routeMap || '').toUpperCase().trim())
                        );
                        const platesToDelete = new Set(
                          activeDateRoutes.map(r => (r.plate || '').toUpperCase().trim()).filter(Boolean)
                        );

                        // Also include any audits or carregamentos for this date
                        (audits || []).forEach(a => {
                          if (a.arrivalDate === routeImportDate) {
                            if (a.routeMap) {
                              mapsNormToDelete.add(normalizeMapCode(a.routeMap).toUpperCase());
                              mapsUpperToDelete.add(a.routeMap.toUpperCase().trim());
                            }
                            if (a.plate) platesToDelete.add(a.plate.toUpperCase().trim());
                          }
                        });

                        (carregamentos || []).forEach(c => {
                          if (c.routeDate === routeImportDate || c.createdAt?.startsWith(routeImportDate)) {
                            if (c.routeMap) {
                              mapsNormToDelete.add(normalizeMapCode(c.routeMap).toUpperCase());
                              mapsUpperToDelete.add(c.routeMap.toUpperCase().trim());
                            }
                            if (c.plate) platesToDelete.add(c.plate.toUpperCase().trim());
                          }
                        });

                        // 1. Update imported routes
                        const updatedRoutes = (importedRoutes || []).filter(r => {
                          const rMapNorm = normalizeMapCode(r.routeMap).toUpperCase();
                          const rMapUpper = (r.routeMap || '').toUpperCase().trim();
                          return r.routeDate !== routeImportDate && !mapsNormToDelete.has(rMapNorm) && !mapsUpperToDelete.has(rMapUpper);
                        });
                        if (onSaveImportedRoutes) {
                          onSaveImportedRoutes(updatedRoutes);
                        }

                        // 2. Update audits
                        let updatedAudits = audits || [];
                        if (onSaveAudits && audits) {
                          updatedAudits = audits.filter(a => {
                            const aMapNorm = normalizeMapCode(a.routeMap).toUpperCase();
                            const aMapUpper = (a.routeMap || '').toUpperCase().trim();
                            const aPlateUpper = (a.plate || '').toUpperCase().trim();
                            const isDateMatch = a.arrivalDate === routeImportDate;
                            const isMapMatch = mapsNormToDelete.has(aMapNorm) || mapsUpperToDelete.has(aMapUpper);
                            const isPlateMatch = aPlateUpper && platesToDelete.has(aPlateUpper);
                            return !isDateMatch && !isMapMatch && !isPlateMatch;
                          });
                          onSaveAudits(updatedAudits);
                        }

                        // 3. Update carregamentos
                        let updatedCarreg = carregamentos || [];
                        if (onSaveCarregamentos && carregamentos) {
                          updatedCarreg = carregamentos.filter(c => {
                            const cMapNorm = normalizeMapCode(c.routeMap).toUpperCase();
                            const cMapUpper = (c.routeMap || '').toUpperCase().trim();
                            const cPlateUpper = (c.plate || '').toUpperCase().trim();
                            const isDateMatch = c.routeDate === routeImportDate || c.createdAt?.startsWith(routeImportDate);
                            const isMapMatch = mapsNormToDelete.has(cMapNorm) || mapsUpperToDelete.has(cMapUpper);
                            const isPlateMatch = cPlateUpper && platesToDelete.has(cPlateUpper);
                            return !isDateMatch && !isMapMatch && !isPlateMatch;
                          });
                          onSaveCarregamentos(updatedCarreg);
                        }

                        // 4. Update vales
                        let updatedVales = vales || [];
                        if (onSaveVales && vales) {
                          updatedVales = vales.filter(v => {
                            const vMapNorm = normalizeMapCode(v.routeMap).toUpperCase();
                            const vMapUpper = (v.routeMap || '').toUpperCase().trim();
                            return !mapsNormToDelete.has(vMapNorm) && !mapsUpperToDelete.has(vMapUpper);
                          });
                          onSaveVales(updatedVales);
                        }

                        // 5. Update fiscalAlerts
                        let updatedAlerts = fiscalAlerts || [];
                        if (onSaveAlerts && fiscalAlerts) {
                          updatedAlerts = fiscalAlerts.filter(al => {
                            const alMapNorm = normalizeMapCode(al.routeMap).toUpperCase();
                            const alMapUpper = (al.routeMap || '').toUpperCase().trim();
                            return !mapsNormToDelete.has(alMapNorm) && !mapsUpperToDelete.has(alMapUpper);
                          });
                          onSaveAlerts(updatedAlerts);
                        }

                        // 6. Direct Firestore sync
                        if (isClientFirebaseActive()) {
                          saveDirectlyToFirestore({
                            importedRoutes: updatedRoutes,
                            audits: updatedAudits,
                            carregamentos: updatedCarreg,
                            carregamentoProcesses: updatedCarreg,
                            vales: updatedVales,
                            fiscalAlerts: updatedAlerts
                          });
                        }

                        alert(`Todos os mapas, descarregamentos e auditorias da data selecionada foram excluídos.`);
                      }
                    );
                  }}
                  className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[10px] font-bold uppercase rounded-lg transition shadow-sm flex items-center space-x-1 cursor-pointer"
                  title="Apagar todos os mapas importados para esta data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpar Mapas do Dia</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenBackupModal}
                  disabled={loadingBackupPhotos}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-[10px] font-bold uppercase rounded-lg transition shadow-sm flex items-center space-x-1 cursor-pointer hover:shadow-md"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{loadingBackupPhotos ? 'Carregando...' : 'Exportar PDF de Backup'}</span>
                </button>

                {onResetPlatformData && (
                  <button
                    type="button"
                    onClick={() => {
                      setResetPassword('');
                      setResetError('');
                      setResetConfirmText('');
                      setShowResetModal(true);
                    }}
                    className="px-3 py-2 bg-red-600 hover:bg-red-750 text-white text-[10px] font-bold uppercase rounded-lg transition shadow-sm flex items-center space-x-1 cursor-pointer hover:shadow-md"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Resetar Plataforma</span>
                  </button>
                )}
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200/50">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase font-mono">
                    <span className="h-2 w-2 bg-amber-500 rounded-full animate-pulse"></span>
                    Configuração de Sincronização (Mesclagem Ativa)
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed max-w-xl">
                    Os mapas são importados quase que diariamente. Ativando o <strong>Modo de Mesclagem</strong>, todas as informações de mapas anteriores que ainda estão em aberto permanecem na plataforma até o fechamento e baixa total.
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-lg shadow-3xs border border-slate-200 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Modo Mesclar:</span>
                  <button
                    type="button"
                    onClick={() => setIsMergeMode(!isMergeMode)}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isMergeMode ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isMergeMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-[10px] font-extrabold uppercase font-mono ${isMergeMode ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {isMergeMode ? 'Ativado' : 'Inativo'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
                {/* Unified Route File Import */}
                <div className="lg:col-span-7 flex flex-col h-full">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileImport(e.dataTransfer.files[0], isMergeMode);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 flex-grow ${
                      isDragOver
                        ? 'border-emerald-500 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                    onClick={() => document.getElementById('route-file-input')?.click()}
                    id="unified-route-import-dropzone"
                  >
                    <input
                      id="route-file-input"
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileImport(e.target.files[0], isMergeMode);
                        }
                      }}
                      className="hidden"
                    />

                    <div className={`p-3 rounded-full ${isDragOver ? 'bg-emerald-100 text-emerald-800 animate-bounce' : 'bg-slate-100 text-slate-500'}`}>
                      <FileSpreadsheet className="h-8 w-8" />
                    </div>

                    <div className="max-w-md">
                      <p className="text-sm font-bold text-slate-800">
                        Arraste e solte a planilha aqui ou <span className="text-emerald-600 underline">procure nos arquivos</span>
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Suporta arquivos delimitados por ponto e vírgula (.csv, .txt).
                      </p>
                    </div>

                    <div className="bg-emerald-50/60 border border-emerald-150 rounded-lg p-3 w-full text-left text-[11px] text-emerald-850 space-y-1">
                      <span className="font-sans font-bold text-emerald-900 block uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                        Rotina Promax Necessária:
                      </span>
                      <p className="leading-relaxed text-slate-600 font-sans text-[10px]">
                        Acesse no Promax a rotina de exportação <strong className="text-emerald-950 font-mono bg-white px-1.5 py-0.2 rounded border border-emerald-250 font-extrabold text-[10px]">03.11.49.02</strong> (Controle de Mapas). O arquivo de texto (.csv ou .txt) deve conter Mapas, Veículos e Motoristas.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Manual Insertion Form */}
                <div className="lg:col-span-5 bg-slate-50/50 rounded-xl border border-slate-200 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center space-x-2 pb-2.5 mb-3.5 border-b border-slate-200">
                      <PlusCircle className="h-5 w-5 text-indigo-600" />
                      <h3 className="font-sans font-bold text-xs text-slate-900 uppercase tracking-wider">Inserir Mapa Manualmente</h3>
                    </div>

                    <form onSubmit={handleManualMapSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Número do Mapa</label>
                        <input
                          type="text"
                          value={manualMap}
                          onChange={(e) => setManualMap(e.target.value)}
                          placeholder="Ex: 54321"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Placa do Veículo</label>
                        <input
                          type="text"
                          value={manualPlate}
                          onChange={(e) => setManualPlate(e.target.value)}
                          placeholder="Ex: ABC1D23"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Data do Mapa</label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Motorista (Opcional)</label>
                        <select
                          value={manualDriverId}
                          onChange={(e) => setManualDriverId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">-- Não Selecionado --</option>
                          {drivers.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.id} - {d.name} ({d.role})
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="w-full mt-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xxs uppercase rounded-lg shadow-sm transition hover:shadow-md cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Cadastrar Mapa Manual</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Progress Metrics */}
            {(() => {
              const selectedRoutes = importedRoutes.filter(r => {
                const isToday = r.routeDate === routeImportDate;
                const isOpen = r.status !== 'fechado' && !isRouteClosed(r.routeMap);
                return isToday || isOpen;
              });
              const total = selectedRoutes.length;
              const closed = selectedRoutes.filter(r => r.status === 'fechado' || isRouteClosed(r.routeMap)).length;
              const open = total - closed;
              const pct = total > 0 ? (closed / total) * 100 : 0;

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Mapas na Data</span>
                      <span className="text-xl font-sans font-bold text-slate-900 mt-1 block font-mono">{total} mapas</span>
                    </div>

                    <div className="bg-amber-50/45 p-3.5 rounded-lg border border-amber-100">
                      <span className="text-[10px] text-amber-500 font-bold uppercase block">Pendente / Conferindo</span>
                      <span className="text-xl font-sans font-bold text-amber-700 mt-1 block font-mono">{open} mapas</span>
                    </div>

                    <div className="bg-emerald-50/45 p-3.5 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-emerald-500 font-bold uppercase block">Liberado & Fechado</span>
                      <span className="text-xl font-sans font-bold text-emerald-700 mt-1 block font-mono">{closed} mapas</span>
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xxs font-mono font-bold text-slate-400 uppercase">
                        <span>Progresso de Fechamento de Cargas</span>
                        <span>{pct.toFixed(0)}% Fechado</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div className="bg-emerald-500 h-2 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Circular Blitz Banner & Quick Draw Trigger */}
                  {(() => {
                    const blitzesToday = selectedRoutes.filter(r => r.isBlitz);
                    return (
                      <div className="bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 border border-red-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-black">⚡ BLITZ</span>
                            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                              Veículos Sorteados para Blitz de Refugo (2x por Dia)
                            </h4>
                          </div>
                          {blitzesToday.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {blitzesToday.map(b => (
                                <span key={b.id} className="bg-white border border-red-300 text-red-900 font-extrabold text-[11px] px-2.5 py-1 rounded-lg shadow-xs flex items-center space-x-1 font-mono">
                                  <span>Mapa {b.routeMap}</span>
                                  <span className="text-slate-300 font-normal">|</span>
                                  <span className="text-slate-700">Placa: {b.plate}</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-600 font-medium">
                              {total > 0 
                                ? "Nenhuma blitz atribuída ainda. Clique ao lado para realizar o sorteio circular das 2 blitzes de refugo do dia."
                                : "Importe os mapas do dia via rotina 03.11.49.02 para sortear as blitzes."}
                            </p>
                          )}
                        </div>

                        {total > 0 && (
                          <button
                            type="button"
                            onClick={handleForceRecalculateBlitz}
                            className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer uppercase tracking-wider"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span>Redistribuir Blitz Hoje (2x)</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* List of imported route cards for Auxiliar */}
                  {selectedRoutes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {selectedRoutes.map(route => {
                        const isClosed = route.status === 'fechado';
                        const isConferindo = route.status === 'conferindo';

                        return (
                          <div key={route.id} className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2.5 transition-all ${
                            route.isPernoite
                              ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-200'
                              : isClosed 
                                ? 'bg-emerald-50/5 border-emerald-200/60' 
                                : isConferindo 
                                  ? 'bg-amber-50/10 border-amber-300' 
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-sm text-slate-900 block">{route.routeMap}</span>
                                  {route.isPernoite && (
                                    <span className="bg-purple-100 text-purple-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-purple-300 flex items-center space-x-0.5">
                                      <Moon className="h-2.5 w-2.5 text-purple-600 fill-purple-600" />
                                      <span>PERNOITE</span>
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-slate-400">Placa: {route.plate}</span>
                                    {route.isBlitz && (
                                      <span className="bg-red-100 text-red-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse">
                                        ⚡ Blitz de Refugo (2x Dia)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-600 font-medium">
                                    Motorista: <strong className="text-slate-800">{getDriverName(route.driverId) || 'Não Selecionado'}</strong>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-slate-500 font-mono pt-1">
                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 font-semibold">
                                      Data Rota: {route.routeDate ? new Date(route.routeDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                                    </span>
                                    {route.importedAt && (
                                      <span className="text-slate-400">
                                        Imp: {new Date(route.importedAt).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTogglePernoite({ routeMap: route.routeMap, plate: route.plate, isPernoite: route.isPernoite });
                                  }}
                                  className={`text-[9px] font-bold px-2 py-1 rounded transition-all flex items-center space-x-1 cursor-pointer border ${
                                    route.isPernoite
                                      ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-xs'
                                      : 'bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200 hover:border-purple-300'
                                  }`}
                                  title={route.isPernoite ? "Desmarcar pernoite (veículo volta para o indicador normal)" : "Marcar veículo como Pernoite"}
                                >
                                  <Moon className={`h-3 w-3 ${route.isPernoite ? 'text-white fill-white' : 'text-slate-400'}`} />
                                  <span>{route.isPernoite ? 'Pernoite' : '+ Pernoite'}</span>
                                </button>
                                <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                  isClosed 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : isConferindo 
                                      ? 'bg-amber-100 text-amber-800 animate-pulse' 
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {isClosed ? 'Fechado' : isConferindo ? 'Conferindo' : 'Pendente'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestConfirm(
                                      "❌ Excluir Mapa?",
                                      `Tem certeza que deseja excluir permanentemente o mapa ${route.routeMap} (${route.plate}) e todos os seus registros de descarregamento e auditoria?`,
                                      () => {
                                        handleDeleteRouteComplete(route);
                                        alert(`Mapa ${route.routeMap} excluído com sucesso.`);
                                      }
                                    );
                                  }}
                                  className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                                  title="Excluir este mapa"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Driver Selection Dropdown */}
                            <div className="text-xxs text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100 space-y-1">
                              <span className="font-bold text-slate-500 uppercase tracking-wider block text-[8px]">Selecione o Motorista:</span>
                              <select
                                value={route.driverId || ''}
                                onChange={(e) => {
                                  const selectedId = e.target.value;
                                  const updated = importedRoutes.map(r => {
                                    if (r.id === route.id) {
                                      return { ...r, driverId: selectedId };
                                    }
                                    return r;
                                  });
                                  if (onSaveImportedRoutes) {
                                    onSaveImportedRoutes(updated);
                                  }

                                  // Update forecast driver name too
                                  const dObj = drivers.find(d => d.id === selectedId);
                                  const dName = selectedId === 'temporario' ? 'Temporário' : (dObj ? dObj.name : '');
                                  if (dName) {
                                    const updatedForecasts = returnForecasts.map(f => {
                                      if (f.routeMap.toUpperCase() === route.routeMap.toUpperCase()) {
                                        return { ...f, driverName: dName };
                                      }
                                      return f;
                                    });
                                    if (onSaveForecasts) {
                                      onSaveForecasts(updatedForecasts);
                                    }
                                  }
                                }}
                                className="w-full text-xxs bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-800"
                                disabled={isClosed}
                              >
                                <option value="">-- Selecione o Motorista --</option>
                                <option value="temporario">Temporário</option>
                                {drivers.map(d => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {route.discrepancyObservation && (
                              <div className="bg-red-50 border border-red-200 text-red-950 text-xxs p-2 rounded-lg font-sans space-y-1">
                                <span className="font-extrabold text-[9px] text-red-700 uppercase block">⚠️ ALERTA DO MONITORAMENTO:</span>
                                <p className="italic leading-relaxed">"{route.discrepancyObservation}"</p>
                              </div>
                            )}

                            {!isClosed && (
                              <button
                                type="button"
                                onClick={() => {
                                  const confirmMsg = route.discrepancyObservation
                                    ? `ATENÇÃO CRÍTICA: O Monitoramento reportou uma divergência para este mapa:\n\n"${route.discrepancyObservation}"\n\nTem certeza absoluta de que deseja dar BAIXA DIRETA e FECHAR o mapa ${route.routeMap} mesmo assim?`
                                    : `Você tem certeza de que deseja realizar a BAIXA DIRETA no mapa ${route.routeMap}?\n\nEsta ação encerrará o mapa imediatamente no sistema sem exigir conferência de pátio ou auditoria física. Confirma?`;

                                  const confirmTitle = route.discrepancyObservation
                                    ? "⚠️ Alerta de Divergência Pendente"
                                    : "❓ Confirmar Baixa Direta?";

                                  requestConfirm(
                                    confirmTitle,
                                    confirmMsg,
                                    () => {
                                      const updated = importedRoutes.map(r => r.id === route.id ? { ...r, status: 'fechado' as const } : r);
                                      if (onSaveImportedRoutes) {
                                        onSaveImportedRoutes(updated);
                                        alert(`Mapa ${route.routeMap} baixado diretamente com sucesso.`);
                                      }
                                    }
                                  );
                                }}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] py-1.5 rounded uppercase cursor-pointer"
                              >
                                Dar Baixa Direta
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xxs text-slate-400 italic font-medium py-3 text-center border border-dashed border-slate-100 rounded">
                      Nenhuma rota importada para esta data. Altere a data acima ou clique em "Importar Planilha" para simular.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Section: Importador de Índices de Refugo & Avaria Retroativo */}
            <div className="bg-white rounded-xl border-2 border-amber-500/40 shadow-sm p-6 space-y-5" id="sincronizador_import_refugo_retroativo">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-slate-100 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-amber-100 text-amber-900 p-2.5 rounded-xl border border-amber-300 shrink-0">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-sans font-bold text-base text-slate-900 uppercase tracking-tight">
                        Importador de Índices de Refugo Retroativo
                      </h3>
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                        Excel / CSV / JSON
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Importe dados históricos de refugos e avarias de planilhas (aba <strong className="text-slate-700 font-bold">Import_Refugo_Rota</strong>) ou arquivos JSON para alimentar os relatórios do sistema.
                    </p>
                  </div>
                </div>
              </div>

              {/* Protection & Processing Rules Badges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex items-start space-x-2.5">
                  <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">Proteção de Conferência Real</span>
                    <span className="text-[10px] text-amber-800/80 leading-tight block mt-0.5">
                      Mapas com conferência física real realizada no pátio NÃO são sobrescritos.
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 flex items-start space-x-2.5">
                  <UserPlus className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">Cadastro Automático de Condutores</span>
                    <span className="text-[10px] text-blue-800/80 leading-tight block mt-0.5">
                      Motoristas não cadastrados (ex: G50, G30) são salvos automaticamente.
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-start space-x-2.5">
                  <FileCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Identificação Média Histórica</span>
                    <span className="text-[10px] text-emerald-800/80 leading-tight block mt-0.5">
                      Auditorias importadas recebem <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">isEstimated: true</code>.
                    </span>
                  </div>
                </div>
              </div>

              {/* Import Trigger Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <input
                  type="file"
                  ref={retroRefugoFileInputRef}
                  onChange={handleRetroRefugoFileChange}
                  accept=".xlsx,.xls,.csv,.json"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={handleImportPreloadedRetroJson}
                  disabled={isProcessingRetro || isSavingRetro}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs px-5 py-3 rounded-xl flex items-center space-x-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
                >
                  {isProcessingRetro ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-slate-950" />
                  )}
                  <span>1. Carregar Dataset Oficial de Refugos Retroativos</span>
                </button>

                <button
                  type="button"
                  onClick={() => retroRefugoFileInputRef.current?.click()}
                  disabled={isProcessingRetro || isSavingRetro}
                  className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center space-x-2 border border-slate-900 shadow-xs transition cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                  <span>2. Selecionar Planilha Excel (.xlsx, .csv) ou Arquivo JSON</span>
                </button>
              </div>

              {/* Dataset Analysis Preview Panel */}
              {retroImportResult && (
                <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 border border-slate-800 animate-fade-in shadow-inner">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <h5 className="font-bold text-sm text-white">Análise Prévia do Dataset de Refugos</h5>
                    </div>
                    <span className="text-xxs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                      Pronto para Gravação
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Mapas no Arquivo</span>
                      <span className="text-lg font-mono font-black text-white mt-0.5 block">{retroImportResult.totalMapsProcessed}</span>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <span className="text-[10px] font-bold text-emerald-400 block uppercase">Auditorias a Gravar</span>
                      <span className="text-lg font-mono font-black text-emerald-400 mt-0.5 block">{retroImportResult.auditsToSave.length}</span>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <span className="text-[10px] font-bold text-amber-400 block uppercase">Ignoradas (Conferência Real)</span>
                      <span className="text-lg font-mono font-black text-amber-400 mt-0.5 block">{retroImportResult.skippedAuditsCount}</span>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                      <span className="text-[10px] font-bold text-blue-400 block uppercase">Novos Motoristas</span>
                      <span className="text-lg font-mono font-black text-blue-400 mt-0.5 block">{retroImportResult.unregisteredDriversCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setRetroImportResult(null)}
                      className="text-xs text-slate-400 hover:text-white underline font-medium cursor-pointer"
                    >
                      Cancelar Análise
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSaveRetroAudits}
                      disabled={isSavingRetro}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-6 py-3 rounded-xl flex items-center space-x-2 shadow-md shadow-emerald-500/20 transition cursor-pointer"
                    >
                      {isSavingRetro ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-slate-950" />
                      )}
                      <span>CONFIRMAR E SINK COM A PLATAFORMA</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
          
          {/* Section: Real-time Progress Charts & Three-Column Process Tracker */}
          {activeTab === 'reconciliacao' && (
            <div className="space-y-6">
            
            {/* Seção de Alertas e Solicitações de Reabertura de Mapas */}
            {(() => {
              const requestedAudits = audits.filter(a => a.reopeningRequested === true);
              if (requestedAudits.length === 0) return null;

              return (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4 shadow-xs animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🔓</span>
                      <div>
                        <h4 className="font-sans font-extrabold text-xs sm:text-sm text-amber-900 uppercase">
                          Solicitações de Reabertura de Mapas ({requestedAudits.length})
                        </h4>
                        <p className="text-[10px] text-amber-700 font-mono">
                          As solicitações listadas abaixo podem ser reabertas pelo Auxiliar de Logística, Gestor ou Financeiro
                        </p>
                      </div>
                    </div>
                    <span className="bg-amber-200/60 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                      Pendente de Reabertura
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {requestedAudits.map((audit) => (
                      <div key={audit.id} className="bg-white border border-amber-200/80 rounded-lg p-3.5 space-y-2.5 shadow-2xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-slate-900 block text-xs sm:text-sm">{audit.routeMap}</span>
                            <span className="font-mono text-[9px] text-slate-400 block">Placa: {audit.plate} | Motorista: {getDriverName(audit.driverId)}</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            {audit.reopeningRequestDate ? new Date(audit.reopeningRequestDate).toLocaleDateString('pt-BR') : ''}
                          </span>
                        </div>

                        <div className="text-xs bg-amber-50/40 p-2.5 rounded border border-amber-100 italic text-slate-700">
                          <strong className="text-[10px] uppercase text-amber-800 block not-italic font-sans mb-1">
                            Justificativa de {audit.reopeningRequestUser || 'Solicitante'}:
                          </strong>
                          "{audit.reopeningJustification}"
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setSelectedHistoryAudit(audit)}
                            className="text-[10px] text-slate-500 hover:text-slate-800 font-bold uppercase underline cursor-pointer font-sans"
                          >
                            Ver Detalhes do Mapa
                          </button>

                          {(currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro' || currentUser.role === 'gestor') && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleApproveReopening(audit.id)}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition shadow-2xs cursor-pointer flex items-center space-x-1 font-sans"
                              >
                                <span>Aprovar e Reabrir</span>
                              </button>
                              <button
                                onClick={() => handleRejectReopening(audit.id)}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer font-sans"
                              >
                                <span>Recusar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Process Progress Chart */}
            {(() => {
              const {
                totalWorking,
                totalPending,
                totalWaiting,
                totalReconciled,
                pendingPct,
                workingPct,
                waitingPct,
                reconciledPct
              } = processProgressMetrics;

              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <h3 className="font-sans font-bold text-slate-900 text-sm uppercase flex items-center space-x-2">
                      <SlidersHorizontal className="h-5 w-5 text-indigo-600 animate-spin-slow" />
                      <span>Monitoramento Integrado de Processos</span>
                    </h3>
                    <span className="text-xxs font-mono text-slate-400 font-bold uppercase">Tempo Real</span>
                  </div>

                  <div className="space-y-4">
                    {/* Progress Bar Chart */}
                    <div className="h-7 rounded-xl overflow-hidden flex border border-slate-100 shadow-3xs bg-slate-150">
                      {pendingPct > 0 && (
                        <div 
                          className="bg-red-500 h-full flex items-center justify-center text-white text-[10px] font-bold font-mono transition-all"
                          style={{ width: `${pendingPct}%` }}
                          title={`Pendente: ${totalPending}`}
                        >
                          {pendingPct > 12 && `PENDENTE (${totalPending})`}
                        </div>
                      )}
                      {workingPct > 0 && (
                        <div 
                          className="bg-amber-500 h-full flex items-center justify-center text-slate-950 text-[10px] font-bold font-mono transition-all animate-pulse"
                          style={{ width: `${workingPct}%` }}
                          title={`Conferindo: ${totalWorking}`}
                        >
                          {workingPct > 12 && `CONFERINDO (${totalWorking})`}
                        </div>
                      )}
                      {waitingPct > 0 && (
                        <div 
                          className="bg-indigo-500 h-full flex items-center justify-center text-white text-[10px] font-bold font-mono transition-all"
                          style={{ width: `${waitingPct}%` }}
                          title={`Aguardando Conciliação: ${totalWaiting}`}
                        >
                          {waitingPct > 12 && `CONCILIAR (${totalWaiting})`}
                        </div>
                      )}
                      {reconciledPct > 0 && (
                        <div 
                          className="bg-emerald-600 h-full flex items-center justify-center text-white text-[10px] font-bold font-mono transition-all"
                          style={{ width: `${reconciledPct}%` }}
                          title={`Baixados: ${totalReconciled}`}
                        >
                          {reconciledPct > 12 && `BAIXADOS (${totalReconciled})`}
                        </div>
                      )}
                    </div>

                    {/* Legend Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="p-2.5 bg-red-50/50 rounded-xl border border-red-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">1. Pendente</span>
                        <span className="text-base font-extrabold font-sans text-red-600 block mt-0.5">{totalPending}</span>
                      </div>
                      <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">2. Conferindo</span>
                        <span className="text-base font-extrabold font-sans text-amber-600 block mt-0.5">{totalWorking}</span>
                      </div>
                      <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">3. Conciliar</span>
                        <span className="text-base font-extrabold font-sans text-indigo-600 block mt-0.5">{totalWaiting}</span>
                      </div>
                      <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block font-mono">4. Baixados</span>
                        <span className="text-base font-extrabold font-sans text-emerald-600 block mt-0.5">{totalReconciled}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Three-Column Board */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Sendo Trabalhados / Em Aberto */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-sans font-bold text-slate-900 text-sm uppercase flex items-center space-x-1.5">
                    <Clock className="h-4.5 w-4.5 text-amber-500" />
                    <span>Sendo Trabalhados</span>
                  </h3>
                  <span className="bg-amber-100 text-amber-800 text-xxs font-extrabold px-2 py-0.5 rounded-full font-mono">
                    {importedRoutes.filter(r => r.status !== 'fechado' && r.status !== 'em_analise' && !isRouteClosed(r.routeMap)).length} mapas
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {importedRoutes.filter(r => r.status !== 'fechado' && r.status !== 'em_analise' && !isRouteClosed(r.routeMap)).length === 0 ? (
                    <div className="text-center py-8 text-xxs italic text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                      Nenhum mapa sendo trabalhado.
                    </div>
                  ) : (
                    importedRoutes.filter(r => r.status !== 'fechado' && r.status !== 'em_analise' && !isRouteClosed(r.routeMap)).map(route => {
                      const isPendente = route.status === 'pendente' || !route.status;
                      const isConferindo = route.status === 'conferindo';
                      const isEmAnalise = route.status === 'em_analise';
                      const isReconferir = route.status === 'reconferir';

                      let badgeColor = "bg-red-100 text-red-800 border-red-200";
                      let statusText = "Pendente";
                      if (isConferindo) {
                        badgeColor = "bg-amber-100 text-amber-800 border-amber-200 animate-pulse";
                        statusText = "Conferindo";
                      } else if (isEmAnalise) {
                        badgeColor = "bg-emerald-100 text-emerald-800 border-emerald-200";
                        statusText = "Em Análise";
                      } else if (isReconferir) {
                        badgeColor = "bg-purple-100 text-purple-800 border-purple-200 animate-pulse";
                        statusText = "Pedida Recontagem";
                      }

                      return (
                        <div key={route.id} className={`p-3 rounded-xl border space-y-2 text-xxs transition-all ${
                          route.isPernoite 
                            ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-200' 
                            : 'bg-slate-50/60 border-slate-200'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-extrabold text-slate-900 font-sans block text-sm">{route.routeMap}</span>
                                {route.isPernoite && (
                                  <span className="bg-purple-100 text-purple-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-purple-300 flex items-center space-x-0.5">
                                    <Moon className="h-2.5 w-2.5 text-purple-600 fill-purple-600" />
                                    <span>PERNOITE</span>
                                  </span>
                                )}
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-mono text-[9px] text-slate-400 block">Placa: {route.plate}</span>
                                <span className="text-[9px] text-slate-500 font-mono block">Data Rota: {route.routeDate ? new Date(route.routeDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${badgeColor}`}>
                                {statusText}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePernoite({ routeMap: route.routeMap, plate: route.plate, isPernoite: route.isPernoite });
                                }}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all flex items-center space-x-1 cursor-pointer border ${
                                  route.isPernoite
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700 shadow-xs'
                                    : 'bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200 hover:border-purple-300'
                                }`}
                                title={route.isPernoite ? "Desmarcar pernoite (veículo volta para o indicador normal)" : "Marcar veículo como Pernoite"}
                              >
                                <Moon className={`h-3 w-3 ${route.isPernoite ? 'text-white fill-white' : 'text-slate-400'}`} />
                                <span>{route.isPernoite ? 'Pernoite' : '+ Pernoite'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestConfirm(
                                    "❌ Excluir Mapa?",
                                    `Tem certeza que deseja excluir permanentemente o mapa ${route.routeMap} (${route.plate}) e todos os seus registros de descarregamento e auditoria?`,
                                    () => {
                                      handleDeleteRouteComplete(route);
                                      alert(`Mapa ${route.routeMap} excluído com sucesso.`);
                                    }
                                  );
                                }}
                                className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                title="Excluir este mapa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                            <div><strong>Motorista:</strong> {getDriverName(route.driverId)}</div>
                            <div className="text-[9px]">Importado: {new Date(route.importedAt).toLocaleTimeString('pt-BR')}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Column 2: Aguardando Reconciliação (Pendentes) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-sans font-bold text-slate-900 text-sm uppercase flex items-center space-x-1.5">
                    <ShieldAlert className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
                    <span>Aguardando Conciliação</span>
                  </h3>
                  <span className="bg-indigo-100 text-indigo-800 text-xxs font-extrabold px-2 py-0.5 rounded-full font-mono">
                    {pendingAudits.length} rotas
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {pendingAudits.length === 0 ? (
                    <div className="text-center py-8 text-xxs italic text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                      Nenhuma conferência física aguardando conciliação.
                    </div>
                  ) : (
                    pendingAudits.map((audit) => {
                      const wasReaudited = (audit.history || []).some(h => h.action.includes('Reconferência'));
                      return (
                        <div key={audit.id} className={`p-3 rounded-xl border hover:border-indigo-300 transition-all space-y-2.5 text-xxs flex flex-col justify-between ${
                          audit.isPernoite 
                            ? 'bg-purple-50/50 border-purple-300 ring-1 ring-purple-200' 
                            : 'bg-slate-50/60 border-slate-200'
                        }`}>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-slate-900 font-sans block text-sm">{audit.routeMap}</span>
                                  {audit.isPernoite && (
                                    <span className="bg-purple-100 text-purple-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-purple-300 flex items-center space-x-0.5">
                                      <Moon className="h-2.5 w-2.5 text-purple-600 fill-purple-600" />
                                      <span>PERNOITE</span>
                                    </span>
                                  )}
                                </div>
                                <span className="font-mono text-[9px] text-slate-400">Placa: {audit.plate}</span>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePernoite({ routeMap: audit.routeMap, plate: audit.plate, isPernoite: audit.isPernoite });
                                    }}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-all flex items-center space-x-1 cursor-pointer border ${
                                      audit.isPernoite
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-700'
                                        : 'bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 border-slate-200 hover:border-purple-300'
                                    }`}
                                    title={audit.isPernoite ? "Desmarcar pernoite (veículo volta para o indicador normal)" : "Marcar veículo como Pernoite"}
                                  >
                                    <Moon className={`h-2.5 w-2.5 ${audit.isPernoite ? 'text-white fill-white' : 'text-slate-400'}`} />
                                    <span>{audit.isPernoite ? 'Pernoite' : '+ Pernoite'}</span>
                                  </button>
                                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                    wasReaudited 
                                      ? 'bg-purple-100 text-purple-800 border-purple-200' 
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  }`}>
                                    {wasReaudited ? '♻️ Reconferido' : 'Conferido'}
                                  </span>
                                </div>
                                {(() => {
                                  const dateToUse = audit.startTime ? new Date(audit.startTime) : (audit.arrivalDate ? new Date(audit.arrivalDate) : null);
                                  if (!dateToUse) return null;
                                  const diffDays = (Date.now() - dateToUse.getTime()) / (1000 * 60 * 60 * 24);
                                  if (diffDays > 2) {
                                    return (
                                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded border bg-rose-100 text-rose-800 border-rose-300 animate-pulse flex items-center space-x-1">
                                        <AlertTriangle className="h-2 w-2 text-rose-600 shrink-0" />
                                        <span>ATRASADO &gt; 48H</span>
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>

                            <div className="text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                              <div><strong>Motorista:</strong> {getDriverName(audit.driverId)}</div>
                              <div><strong>Duração:</strong> {getDurationText(audit.startTime, audit.endTime)}</div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              // Initialize fiscal quantities to empty (undefined) by default until manually entered
                              const initializedSession = {
                                ...audit,
                                items: audit.items.map(i => {
                                  // Remain empty/undefined unless already set
                                  const fQty = i.fiscalQty !== undefined ? i.fiscalQty : undefined;
                                  return { ...i, fiscalQty: fQty };
                                }),
                                assets: audit.assets.map(a => ({
                                  ...a,
                                  fiscalQty: a.fiscalQty !== undefined ? a.fiscalQty : undefined
                                })),
                                exchanges: audit.exchanges && audit.exchanges.length > 0 ? audit.exchanges : (() => {
                                  if (audit.unifiedMaps && audit.unifiedMaps.length > 0) {
                                    const combinedExchangesMap: { [key: string]: AuditExchangeItem } = {};
                                    audit.unifiedMaps.forEach(mapCode => {
                                      const r = importedRoutes.find(route => route.routeMap.toUpperCase() === mapCode.toUpperCase());
                                      if (r && r.exchanges) {
                                        r.exchanges.forEach(ex => {
                                          const key = `${ex.productCode}_${ex.type}`;
                                          if (combinedExchangesMap[key]) {
                                            combinedExchangesMap[key].qty += ex.qty;
                                          } else {
                                            combinedExchangesMap[key] = { ...ex };
                                          }
                                        });
                                      }
                                    });
                                    return Object.values(combinedExchangesMap);
                                  } else {
                                    const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.trim().toUpperCase());
                                    return (matchingRoute && matchingRoute.exchanges && matchingRoute.exchanges.length > 0)
                                      ? matchingRoute.exchanges
                                      : [];
                                  }
                                })()
                              };
                              
                              let combinedNotes = initializedSession.reconciliationNotes || '';
                              if (!combinedNotes) {
                                const mapsToSearch = (initializedSession.unifiedMaps && initializedSession.unifiedMaps.length > 0)
                                  ? initializedSession.unifiedMaps
                                  : [initializedSession.routeMap];
                                
                                const obsList: string[] = [];
                                mapsToSearch.forEach(m => {
                                  const r = importedRoutes.find(route => route.routeMap.toUpperCase() === m.toUpperCase());
                                  if (r) {
                                    if (r.routeObservations && r.routeObservations.length > 0) {
                                      r.routeObservations.forEach(o => {
                                        obsList.push(`[${o.author}]: ${o.text}`);
                                      });
                                    } else if (r.discrepancyObservation) {
                                      obsList.push(`[Monitoramento/Obs]: ${r.discrepancyObservation}`);
                                    }
                                  }
                                });
                                combinedNotes = obsList.join('\n');
                              }
                              setReconciliationNotes(combinedNotes);
                              setLoadedSessionTime(initializedSession.updatedAt);
                              setActiveSession(initializedSession);
                            }}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1.5 px-2.5 rounded-lg flex items-center justify-center space-x-1 shadow-2xs transition-all cursor-pointer"
                          >
                            <span>Conciliar</span>
                            <ArrowRight className="h-3 w-3 text-amber-500" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Column 3: Dados Baixa Hoje (Reconciliados / Fechados) */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-sans font-bold text-slate-900 text-sm uppercase flex items-center space-x-1.5">
                    <CheckSquare className="h-4.5 w-4.5 text-emerald-600" />
                    <span>Dados Baixa Hoje</span>
                  </h3>
                  <span className="bg-emerald-100 text-emerald-800 text-xxs font-extrabold px-2 py-0.5 rounded-full font-mono">
                    {audits.filter(a => a.status === 'finalizado_ok' || a.status === 'finalizado_divergente').length} rotas
                  </span>
                </div>

                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                  {(() => {
                    const reconciledToday = audits.filter(a => a.status === 'finalizado_ok' || a.status === 'finalizado_divergente');
                    if (reconciledToday.length === 0) {
                      return (
                        <div className="text-center py-8 text-xxs italic text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                          Nenhuma rota baixada hoje.
                        </div>
                      );
                    }

                    return reconciledToday.map((audit) => {
                      const isOk = audit.status === 'finalizado_ok';
                      const discrepancyStats = getDiscrepancyTotals(audit);
                      return (
                        <div key={audit.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2 text-xxs">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-extrabold text-slate-900 font-sans block text-sm">{audit.routeMap}</span>
                              <span className="font-mono text-[9px] text-slate-400">Placa: {audit.plate}</span>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              isOk 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : 'bg-red-100 text-red-800 border-red-200'
                            }`}>
                              {isOk ? '100% OK' : 'Divergente'}
                            </span>
                          </div>

                          <div className="text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                            <div><strong>Motorista:</strong> {getDriverName(audit.driverId)}</div>
                            {!isOk && (
                              <div className="font-bold text-red-600 text-[9px]">
                                {discrepancyStats.missingCount > 0 && `Faltas: ${discrepancyStats.missingCount} | `}
                                {discrepancyStats.surplusCount > 0 && `Sobras: ${discrepancyStats.surplusCount}`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>
          </div>
          )}

          {/* Section: Today's History */}
          {activeTab === 'historico' && (
            <div className="space-y-8 animate-fade-in" id="tab_historico">
              
              {/* 1. DASHBOARD COM STATUS E QUANTIDADES */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-md border border-slate-750">
                <h3 className="font-sans font-bold text-xs text-amber-500 uppercase tracking-widest mb-4">
                  Dashboard de Status & Quantidades do Histórico
                </h3>
                
                {(() => {
                  const totalMaps = filteredHistory.length;
                  const okMaps = filteredHistory.filter(a => a.status === 'finalizado_ok').length;
                  const divMaps = filteredHistory.filter(a => a.status === 'finalizado_divergente').length;

                  let missingQtyTotal = 0;
                  let surplusQtyTotal = 0;
                  let lossValueTotal = 0;
                  let surplusValueTotal = 0;

                  filteredHistory.forEach(audit => {
                    const disc = getDiscrepancyTotals(audit);
                    missingQtyTotal += disc.missingCount;
                    surplusQtyTotal += disc.surplusCount;
                    lossValueTotal += disc.missingCost;
                    surplusValueTotal += disc.surplusCost;
                  });

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Baixas</span>
                        <span className="text-xl font-bold text-white block mt-1">{totalMaps} mapas</span>
                      </div>

                      <div className="bg-emerald-950/40 p-3 rounded-lg border border-emerald-900/40 text-center">
                        <span className="text-[10px] text-emerald-400 font-mono uppercase block">Status 100% OK</span>
                        <span className="text-xl font-bold text-emerald-300 block mt-1">{okMaps} mapas</span>
                      </div>

                      <div className="bg-red-950/40 p-3 rounded-lg border border-red-900/40 text-center">
                        <span className="text-[10px] text-red-400 font-mono uppercase block">Com Divergência</span>
                        <span className="text-xl font-bold text-red-300 block mt-1">{divMaps} mapas</span>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Faltas (Qtd)</span>
                        <span className="text-xl font-bold text-red-400 block mt-1">{missingQtyTotal} itens</span>
                        <span className="text-[9px] text-red-500 block">-R$ {(Number(lossValueTotal) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700/60 text-center">
                        <span className="text-[10px] text-slate-400 font-mono uppercase block">Total Sobras (Qtd)</span>
                        <span className="text-xl font-bold text-amber-400 block mt-1">{surplusQtyTotal} itens</span>
                        <span className="text-[9px] text-amber-500 block">+R$ {(Number(surplusValueTotal) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* CENTRAL DE EXPORTAÇÃO & DOWNLOAD DO HISTÓRICO */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-xl border border-slate-700/80 p-5 sm:p-6 space-y-4 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-750 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-500 text-slate-950 rounded-lg shadow-sm">
                      <Download className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-sans font-bold text-sm sm:text-base text-white uppercase tracking-tight">
                        Central de Download & Exportação do Histórico
                      </h4>
                      <p className="text-xs text-slate-300">
                        Baixe todos os mapas finalizados em formato <strong className="text-emerald-400">Excel (.xlsx)</strong>, <strong className="text-indigo-400">JSON (.json)</strong>, gere o <strong className="text-sky-400">Relatório Consolidado (PDF)</strong> ou baixe todos os <strong className="text-amber-400">PDFs em um único arquivo (.zip)</strong>.
                      </p>
                    </div>
                  </div>
                  <span className="bg-slate-800 text-amber-400 border border-slate-700 px-3 py-1 rounded-full text-xs font-mono font-bold whitespace-nowrap">
                    {filteredHistory.length} mapa(s) selecionado(s)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {/* Botão 1: Baixar Tudo em Excel */}
                  <button
                    type="button"
                    disabled={filteredHistory.length === 0 || isExportingHistoryExcel}
                    onClick={() => downloadAllHistoryExcel(filteredHistory)}
                    className="flex items-center justify-center space-x-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border border-emerald-500/50 hover:shadow-emerald-500/20"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-white" />
                    <span>{isExportingHistoryExcel ? "Gerando Planilha..." : "Baixar Tudo em Excel (.xlsx)"}</span>
                  </button>

                  {/* Botão 2: Baixar Relatório Geral Consolidado em PDF */}
                  <button
                    type="button"
                    disabled={filteredHistory.length === 0 || isExportingHistoryPDF}
                    onClick={() => downloadHistoryConsolidatedPDF(filteredHistory)}
                    className="flex items-center justify-center space-x-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border border-sky-500/50 hover:shadow-sky-500/20"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-white" />
                    <span>{isExportingHistoryPDF ? "Gerando PDF Geral..." : "Baixar Relatório Geral (PDF)"}</span>
                  </button>

                  {/* Botão 3: Baixar Todos os PDFs em Pacote Único ZIP */}
                  <button
                    type="button"
                    disabled={filteredHistory.length === 0 || isBatchDownloadingHistory}
                    onClick={() => downloadBatchHistoryPDFs(filteredHistory)}
                    className="flex items-center justify-center space-x-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer border border-amber-400 hover:shadow-amber-500/20"
                  >
                    <Archive className="h-4 w-4 shrink-0 text-slate-950" />
                    <span>{isBatchDownloadingHistory ? `Gerando ZIP (${batchDownloadProgress?.current || 0}/${batchDownloadProgress?.total || 0})...` : `Baixar Todos os ${filteredHistory.length} PDFs (.zip)`}</span>
                  </button>

                  {/* Botão 4: Baixar Tudo em JSON */}
                  <button
                    type="button"
                    disabled={filteredHistory.length === 0 || isExportingHistoryJSON}
                    onClick={() => downloadAllHistoryJSON(filteredHistory)}
                    className="flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer border border-indigo-500/50 hover:shadow-indigo-500/20"
                  >
                    <FileJson className="h-4 w-4 shrink-0 text-white" />
                    <span>{isExportingHistoryJSON ? "Gerando JSON..." : "Baixar Tudo em JSON (.json)"}</span>
                  </button>
                </div>

                {/* Batch Progress Bar if active */}
                {isBatchDownloadingHistory && batchDownloadProgress && (
                  <div className="bg-slate-800/90 border border-amber-500/40 rounded-lg p-3 space-y-2 animate-pulse">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-amber-400 font-bold">
                        Gerando PDF {batchDownloadProgress.current} de {batchDownloadProgress.total} (Mapa: {batchDownloadProgress.map})...
                      </span>
                      <span className="text-slate-300">
                        {Math.round((batchDownloadProgress.current / batchDownloadProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-amber-400 h-full transition-all duration-300"
                        style={{ width: `${(batchDownloadProgress.current / batchDownloadProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* DIRETÓRIO LOCAL DE ARQUIVAMENTO - EXIBIÇÃO EM CIMA DO FILTRO */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-5 space-y-3 shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="font-sans font-bold text-sm text-slate-900 uppercase">Caminho da Rede para Salvar os PDFs de Conciliação</h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      O arquivo gerado automaticamente ao dar baixa no mapa de retorno deve ser mantido e organizado no diretório abaixo no servidor de arquivos (P:) para fins de auditoria e controle de acuracidade:
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                  <div className="font-mono text-xs text-slate-800 break-all select-all font-bold">
                    P:\Guarabira\2026\04.LOGISTICA\ARMAZÉM\3.0 ACURACIDADE\3.1 PACOTE PREJUIZO\FALTAS EM ROTA\RETORNO DE ROTA
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("P:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA");
                      alert("Caminho copiado para a área de transferência!");
                    }}
                    className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-150 text-slate-700 font-semibold text-[10px] rounded-md transition cursor-pointer border border-slate-200"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copiar Caminho</span>
                  </button>
                </div>
              </div>

              {/* 2. FILTROS DE PESQUISA */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <span className="text-xxs font-mono font-bold text-slate-400 uppercase block mb-3">
                  Filtros Avançados de Busca
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date Start */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">De (Data de Chegada):</label>
                    <input
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Date End */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">Até (Data de Chegada):</label>
                    <input
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Search bar */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">Buscar Mapa/Placa/Motorista:</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: MAPA-ROTA-142..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 pl-8 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                      <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>

                  {/* Status switcher */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">Status da Conciliação:</label>
                    <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 gap-1.5 items-center">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`text-center py-1.5 px-1.5 text-[11px] sm:text-xs rounded-lg font-bold transition-all cursor-pointer ${
                          statusFilter === 'all' ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/50 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ok')}
                        className={`text-center py-1.5 px-1.5 text-[11px] sm:text-xs rounded-lg font-bold transition-all cursor-pointer ${
                          statusFilter === 'ok' ? 'bg-white text-emerald-950 shadow-sm border border-slate-200/50 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('divergentes')}
                        className={`text-center py-1.5 px-1.5 text-[11px] sm:text-xs rounded-lg font-bold transition-all cursor-pointer ${
                          statusFilter === 'divergentes' ? 'bg-white text-rose-950 shadow-sm border border-slate-200/50 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Divergentes
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('reabertos')}
                        className={`text-center py-1.5 px-1.5 text-[11px] sm:text-xs rounded-lg font-bold transition-all cursor-pointer ${
                          statusFilter === 'reabertos' ? 'bg-white text-amber-950 shadow-sm border border-slate-200/50 font-extrabold' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        Reabertos
                      </button>
                    </div>
                  </div>
                </div>

                {(historyStartDate || historyEndDate || searchTerm || statusFilter !== 'all') && (
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => {
                        setHistoryStartDate('');
                        setHistoryEndDate('');
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                      className="text-xxs font-bold text-red-600 hover:text-red-700 flex items-center space-x-1 cursor-pointer"
                    >
                      <XCircle className="h-3 w-3" />
                      <span>Limpar Filtros</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 3. GRID DE CARTÕES DE MAPAS BAIXADOS */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="pb-3 border-b border-slate-100 mb-6 flex justify-between items-center">
                  <h2 className="font-sans font-bold text-sm text-slate-900 uppercase">
                    Registros Baixados ({filteredHistory.length})
                  </h2>
                  <span className="text-xxs text-slate-400">Clique em qualquer mapa para visualizar todo o detalhamento</span>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                    Nenhum mapa baixado coincide com os filtros aplicados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHistory.map((audit) => {
                      const stats = getDiscrepancyTotals(audit);
                      const isOk = audit.status === 'finalizado_ok';
                      const reopenInfo = getReopeningInfo(audit);
                      return (
                        <div 
                          key={audit.id} 
                          onClick={() => setSelectedHistoryAudit(audit)}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-amber-400 hover:shadow-sm cursor-pointer transition-all space-y-3 flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                            <div className="flex items-center space-x-2">
                              <div className={`p-1.5 rounded-lg ${isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                <FileSpreadsheet className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block text-xs sm:text-sm">{audit.routeMap}</span>
                                <span className="font-mono text-[9px] text-slate-400">Placa: {audit.plate}</span>
                              </div>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              isOk 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {isOk ? '100% OK' : 'Divergente'}
                            </span>
                          </div>

                          <div className="text-xxs text-slate-500 space-y-1">
                            <div><strong>Motorista:</strong> {getDriverName(audit.driverId)}</div>
                            {(() => {
                              const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.trim().toUpperCase());
                              const cadastroDate = matchingRoute?.routeDate 
                                ? new Date(matchingRoute.routeDate + 'T00:00:00').toLocaleDateString('pt-BR')
                                : null;
                              const daysOnRoute = getDaysOnRoute(audit);
                              return (
                                <>
                                  {cadastroDate && (
                                    <div><strong>Data Cadastro:</strong> {cadastroDate}</div>
                                  )}
                                  <div><strong>Data Chegada:</strong> {new Date(audit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
                                  {daysOnRoute !== null && (
                                    <div className="flex items-center space-x-1.5 py-0.5">
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-amber-200 inline-flex items-center">
                                        ⏱️ {daysOnRoute} {daysOnRoute === 1 ? 'dia' : 'dias'} em rota
                                      </span>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                            <div><strong>Tempo de Auditoria:</strong> {getDurationText(audit.startTime, audit.endTime)}</div>
                            
                            {!isOk && (
                              <div className="bg-red-50 text-red-700 border border-red-100 p-1.5 rounded font-semibold mt-2 text-[9px] flex justify-between items-center">
                                <span>Faltas: {stats.missingCount} | Sobras: {stats.surplusCount}</span>
                                <span>Impacto: R$ {(Number((stats.missingCost || 0) + (stats.surplusCost || 0)) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                              </div>
                            )}
                            {isOk && (
                              <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 p-1.5 rounded font-semibold mt-2 text-[9px] text-center">
                                Conformidade Fiscal Aprovada (OK)
                              </div>
                            )}

                            {reopenInfo.isReopened && (
                              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 mt-2 space-y-1 text-[10px]">
                                <div className="text-amber-800 font-extrabold flex items-center space-x-1 uppercase text-[9px] tracking-wider font-sans">
                                  <span>🔓 Mapa Reaberto</span>
                                </div>
                                {reopenInfo.justification && (
                                  <div className="text-slate-600 italic leading-relaxed text-xxs">
                                    "<strong>Motivo:</strong> {reopenInfo.justification}"
                                  </div>
                                )}
                                <div className="grid grid-cols-1 gap-0.5 text-slate-500 font-mono text-[8px] border-t border-amber-200/50 pt-1 mt-1 leading-snug">
                                  {reopenInfo.requestedAt && (
                                    <div>• <strong>Solicitado:</strong> {new Date(reopenInfo.requestedAt).toLocaleString('pt-BR')} {reopenInfo.requestedBy ? `por ${reopenInfo.requestedBy}` : ''}</div>
                                  )}
                                  {reopenInfo.reopenedAt && (
                                    <div>• <strong>Reaberto:</strong> {new Date(reopenInfo.reopenedAt).toLocaleString('pt-BR')} {reopenInfo.reopenedBy ? `por ${reopenInfo.reopenedBy}` : ''}</div>
                                  )}
                                  {reopenInfo.closedAgainAt ? (
                                    <div className="text-emerald-700 font-bold">• <strong>Fechado Novamente:</strong> {new Date(reopenInfo.closedAgainAt).toLocaleString('pt-BR')} {reopenInfo.closedAgainBy ? `por ${reopenInfo.closedAgainBy}` : ''}</div>
                                  ) : (
                                    <div className="text-rose-600 font-bold">• <strong>Fechado Novamente:</strong> Pendente</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => downloadSingleAuditPDF(audit)}
                              className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[10px] font-bold transition-all border border-slate-200 cursor-pointer"
                              title="Baixar Relatório PDF Oficial deste Mapa"
                            >
                              <FileText className="h-3 w-3 text-red-600 shrink-0" />
                              <span>PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadSingleAuditExcel(audit)}
                              className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition-all border border-emerald-200 cursor-pointer"
                              title="Baixar Planilha Excel (.xlsx) deste Mapa"
                            >
                              <FileSpreadsheet className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span>Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadSingleAuditJSON(audit)}
                              className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold transition-all border border-indigo-200 cursor-pointer"
                              title="Baixar Arquivo JSON (.json) deste Mapa"
                            >
                              <FileJson className="h-3 w-3 text-indigo-600 shrink-0" />
                              <span>JSON</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedHistoryAudit(audit)}
                              className="flex items-center justify-center px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-bold transition-all border border-amber-200 cursor-pointer"
                              title="Visualizar Detalhes Completos da Auditoria"
                            >
                              <Eye className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Section: Sobras & Faltas PA/AG (Divergências) */}
          {activeTab === 'divergencias' && (
            <div className="space-y-6 animate-fade-in" id="tab_divergencias">
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-slate-900">
                      <Shield className="h-6 w-6 text-amber-500 animate-pulse" />
                      <h2 className="font-sans font-bold text-lg uppercase">Controle de Sobras & Faltas</h2>
                    </div>
                    <p className="text-xs text-slate-500">
                      Gerenciamento e acompanhamento de divergências de produtos acabados (PA) e ativos de giro (AG). Sobras requerem dados de cliente (NB) e alinhamento de data de entrega.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 self-start lg:self-auto w-full lg:w-auto">
                    {/* Gestão Separada de PA e AG */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 grow sm:grow-0">
                      <button
                        type="button"
                        onClick={() => setSubTabDivergencias('all')}
                        className={`px-3 py-1.5 text-xxs font-black uppercase rounded-lg transition-all cursor-pointer ${
                          subTabDivergencias === 'all'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ver Tudo
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTabDivergencias('pa')}
                        className={`px-3 py-1.5 text-xxs font-black uppercase rounded-lg transition-all cursor-pointer ${
                          subTabDivergencias === 'pa'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gestão P.A. (Produtos)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTabDivergencias('ag')}
                        className={`px-3 py-1.5 text-xxs font-black uppercase rounded-lg transition-all cursor-pointer ${
                          subTabDivergencias === 'ag'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Gestão A.G. (Ativos)
                      </button>
                    </div>

                    {/* Botões de Exportação */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={exportToExcel}
                        className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xxs uppercase rounded-xl border border-emerald-200 transition-all shadow-xs cursor-pointer grow sm:grow-0"
                        title="Exportar Visão Resumida Editável em Excel"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                        <span>Exportar Excel</span>
                      </button>
                      <button
                        type="button"
                        onClick={exportToPDF}
                        className="flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xxs uppercase rounded-xl border border-red-200 transition-all shadow-xs cursor-pointer grow sm:grow-0"
                        title="Exportar Relatório PDF"
                      >
                        <FileText className="h-4 w-4 text-red-600" />
                        <span>Exportar PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SELETOR DE MODALIDADE: PAINEL OPERACIONAL VS VISÃO MASTER */}
              <div className="flex bg-white rounded-2xl p-2 border border-slate-200 shadow-sm gap-2">
                <button
                  type="button"
                  onClick={() => setSobrasViewMode('operacional')}
                  className={`flex-1 py-3 px-4 font-sans font-extrabold text-xs tracking-tight rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    sobrasViewMode === 'operacional'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Painel Operacional (Sobras e Faltas)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSobrasViewMode('master')}
                  className={`flex-1 py-3 px-4 font-sans font-extrabold text-xs tracking-tight rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                    sobrasViewMode === 'master'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FileCheck className="h-4 w-4 text-slate-950" />
                  <span className="flex items-center space-x-2">
                    <span>Sobras & Faltas (Visão Master)</span>
                    <span className="text-[10px] bg-red-100 text-red-900 px-2 py-0.5 rounded-full font-sans font-extrabold border border-red-200">
                      Analista Master / Baixa Definitiva
                    </span>
                  </span>
                </button>
              </div>

              {/* DIRETÓRIO LOCAL DE ARQUIVAMENTO - EXIBIÇÃO EM CIMA DO FILTRO DE SOBRAS & FALTAS */}
              <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-5 space-y-3 shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <h4 className="font-sans font-bold text-sm text-slate-900 uppercase">Caminho da Rede para Salvar os PDFs de Conciliação</h4>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Para fins de auditoria, conciliação definitiva, e manutenção do histórico físico de sobras/faltas, salve as vias impressas ou digitais dos relatórios no seguinte caminho de rede mapeado:
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                  <div className="font-mono text-xs text-slate-800 break-all select-all font-bold">
                    P:\Guarabira\2026\04.LOGISTICA\ARMAZÉM\3.0 ACURACIDADE\3.1 PACOTE PREJUIZO\FALTAS EM ROTA\RETORNO DE ROTA
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("P:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA");
                      alert("Caminho copiado para a área de transferência!");
                    }}
                    className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-150 text-slate-700 font-semibold text-[10px] rounded-md transition cursor-pointer border border-slate-200"
                  >
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                    <span>Copiar Caminho</span>
                  </button>
                </div>
              </div>

              {/* Filter controls */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Buscar NB, Mapa ou Placa</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Pesquisar..."
                      value={filterNB}
                      onChange={(e) => setFilterNB(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Filtrar por Data</label>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-semibold font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Tipo de Desvio</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                  >
                    <option value="all">Mostrar Todos</option>
                    <option value="sobra">Apenas Sobras (+)</option>
                    <option value="falta">Apenas Faltas (-)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterNB('');
                      setFilterDate('');
                      setFilterType('all');
                    }}
                    disabled={!filterNB && !filterDate && filterType === 'all'}
                    className="w-full py-2 bg-slate-150 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold uppercase rounded-lg transition cursor-pointer"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>

              {/* Grid of discrepant maps */}
              <div className="grid grid-cols-1 gap-6">
                {(() => {
                  // Find all audits that have discrepancies
                  const discrepantAudits = (audits || []).filter(audit => {
                    if (!audit) return false;
                    const hasProductDiff = (audit.items || []).some(item => {
                      const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                      const fisc = item.fiscalQty ?? 0;
                      const comodato = item.comodatoQty ?? 0;
                      const recolha = item.recolhaQty ?? 0;
                      return (phys + comodato - recolha) !== fisc;
                    });
                    const hasAssetDiff = (audit.assets || []).some(asset => {
                      const idLower = (asset.assetId || '').toLowerCase();
                      const nameUpper = (asset.assetName || '').toUpperCase();
                      const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                      if (isChapatex) return false;

                      const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
                      const fisc = asset.fiscalQty ?? 0;
                      const comodato = asset.comodatoQty ?? 0;
                      const recolha = asset.recolhaQty ?? 0;
                      return (phys + comodato - recolha) !== fisc;
                    });

                    const hasProductSurplus = (audit.items || []).some(i => {
                      const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                      const fisc = i.fiscalQty ?? 0;
                      const comodato = i.comodatoQty ?? 0;
                      const recolha = i.recolhaQty ?? 0;
                      return (phys + comodato - recolha) > fisc;
                    });
                    const hasAssetSurplus = (audit.assets || []).some(a => {
                      const idLower = (a.assetId || '').toLowerCase();
                      const nameUpper = (a.assetName || '').toUpperCase();
                      const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                      if (isChapatex) return false;

                      const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                      const fisc = a.fiscalQty ?? 0;
                      const comodato = a.comodatoQty ?? 0;
                      const recolha = a.recolhaQty ?? 0;
                      return (phys - fisc + comodato - recolha) > 0;
                    });
                    const hasSurplus = hasProductSurplus || hasAssetSurplus;

                    const hasProductDeficit = (audit.items || []).some(i => {
                      const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                      const fisc = i.fiscalQty ?? 0;
                      const comodato = i.comodatoQty ?? 0;
                      const recolha = i.recolhaQty ?? 0;
                      return (phys + comodato - recolha) < fisc;
                    });
                    const hasAssetDeficit = (audit.assets || []).some(a => {
                      const idLower = (a.assetId || '').toLowerCase();
                      const nameUpper = (a.assetName || '').toUpperCase();
                      const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                      if (isChapatex) return false;

                      const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                      const fisc = a.fiscalQty ?? 0;
                      const comodato = a.comodatoQty ?? 0;
                      const recolha = a.recolhaQty ?? 0;
                      return (phys - fisc + comodato - recolha) < 0;
                    });
                    const hasDeficit = hasProductDeficit || hasAssetDeficit;

                    const unresolvedSurplus = hasSurplus && !(
                      audit.surplusFlowStatus === 'ENVIADO' || 
                      audit.surplusFlowStatus === 'BAIXADO' || 
                      audit.surplusActionStatus === 'baixado_direto' ||
                      audit.surplusActionStatus === 'enviado_cliente'
                    );

                    const unresolvedDeficit = hasDeficit && !(
                      audit.deficitActionStatus === 'baixado_direto' ||
                      (vales || []).some(v => v.auditId === audit.id)
                    );

                    // Filter based on selected view mode (operacional vs master)
                    if (sobrasViewMode === 'operacional') {
                      // If it has no unresolved surplus or deficit in operational mode, then it should disappear
                      if (!unresolvedSurplus && !unresolvedDeficit) {
                        return false;
                      }
                    } else {
                      // In Visão Master mode, show all audits that have discrepancies (including launched surpluses and closed ones)
                      if (!hasProductDiff && !hasAssetDiff) {
                        return false;
                      }
                    }
                    
                    if (subTabDivergencias === 'pa') return hasProductDiff;
                    if (subTabDivergencias === 'ag') return hasAssetDiff;
                    return hasProductDiff || hasAssetDiff;
                  });

                  // Apply filter controls
                  const filteredAudits = discrepantAudits.filter(audit => {
                    // Filter by NB
                    if (filterNB.trim()) {
                      const nbQuery = filterNB.trim().toLowerCase();
                      const hasMatchedNB = (audit.clientCodeNB || '').toLowerCase().includes(nbQuery) ||
                        (audit.routeMap || '').toLowerCase().includes(nbQuery) ||
                        (audit.plate || '').toLowerCase().includes(nbQuery);
                      if (!hasMatchedNB) return false;
                    }

                    // Filter by Date
                    if (filterDate) {
                      const matchesDate = audit.arrivalDate === filterDate || audit.deliveryDate === filterDate;
                      if (!matchesDate) return false;
                    }

                    // Filter by Type
                    if (filterType !== 'all') {
                      const hasSurplus = (audit.items || []).some(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) > 0;
                      }) || (audit.assets || []).some(a => {
                        const idLower = (a.assetId || '').toLowerCase();
                        const nameUpper = (a.assetName || '').toUpperCase();
                        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                        if (isChapatex) return false;

                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) > 0;
                      });

                      const hasDeficit = (audit.items || []).some(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) < 0;
                      }) || (audit.assets || []).some(a => {
                        const idLower = (a.assetId || '').toLowerCase();
                        const nameUpper = (a.assetName || '').toUpperCase();
                        const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                        if (isChapatex) return false;

                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) < 0;
                      });

                      if (filterType === 'sobra' && !hasSurplus) return false;
                      if (filterType === 'falta' && !hasDeficit) return false;
                    }

                    return true;
                  });

                  if (filteredAudits.length === 0) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
                        {discrepantAudits.length === 0 
                          ? "Nenhum mapa com sobras ou faltas registrado até o momento."
                          : "Nenhum resultado corresponde aos filtros aplicados."}
                      </div>
                    );
                  }

                  return filteredAudits.map(audit => {
                    // Check the 30-day "ENVIO NO PRAZO" status
                    const arrivalDateObj = new Date(audit.arrivalDate + 'T00:00:00');
                    const daysElapsed = Math.floor((new Date().getTime() - arrivalDateObj.getTime()) / (1000 * 60 * 60 * 24));
                    const isWithin30Days = daysElapsed <= 30;

                    // Get list of surpluses
                    const surpluses = [
                      ...audit.items.filter(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) > 0;
                      }).map(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return {
                          code: i.productCode,
                          description: i.productDescription,
                          qty: phys - fisc + comodato - recolha,
                          unit: 'cx',
                          type: 'PA'
                        };
                      }),
                      ...audit.assets.filter(a => {
                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) > 0;
                      }).map(a => {
                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return {
                          code: a.assetId,
                          description: a.assetName,
                          qty: phys - fisc + comodato - recolha,
                          unit: 'un',
                          type: 'AG'
                        };
                      })
                    ].filter(s => {
                      if (subTabDivergencias === 'pa') return s.type === 'PA';
                      if (subTabDivergencias === 'ag') return s.type === 'AG';
                      return true;
                    });

                    // Get list of deficits
                    const deficits = [
                      ...audit.items.filter(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) < 0;
                      }).map(i => {
                        const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                        const fisc = i.fiscalQty ?? 0;
                        const comodato = i.comodatoQty ?? 0;
                        const recolha = i.recolhaQty ?? 0;
                        return {
                          code: i.productCode,
                          description: i.productDescription,
                          qty: Math.abs(phys - fisc + comodato - recolha),
                          unit: 'cx',
                          type: 'PA'
                        };
                      }),
                      ...audit.assets.filter(a => {
                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return (phys - fisc + comodato - recolha) < 0;
                      }).map(a => {
                        const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                        const fisc = a.fiscalQty ?? 0;
                        const comodato = a.comodatoQty ?? 0;
                        const recolha = a.recolhaQty ?? 0;
                        return {
                          code: a.assetId,
                          description: a.assetName,
                          qty: Math.abs(phys - fisc + comodato - recolha),
                          unit: 'un',
                          type: 'AG'
                        };
                      })
                    ].filter(d => {
                      if (subTabDivergencias === 'pa') return d.type === 'PA';
                      if (subTabDivergencias === 'ag') return d.type === 'AG';
                      return true;
                    });

                    const currentObsType = cardObsTypes[audit.id] || (surpluses.length > 0 && deficits.length > 0 ? 'todos' : surpluses.length > 0 ? 'sobra' : deficits.length > 0 ? 'falta' : 'todos');

                    return (
                      <div key={audit.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 hover:border-slate-300 transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-sans font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded font-mono">Mapa {audit.routeMap}</span>
                              <span className="font-mono text-xs text-slate-500">{audit.plate}</span>
                              <span className="text-xxs text-slate-400 font-mono">Data: {new Date(audit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="text-xxs text-slate-400 mt-1">
                              Motorista: <strong>{getDriverName(audit.driverId)}</strong>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {/* 30 Days Status Badge */}
                            {audit.surplusFlowStatus === 'ENVIADO' ? (
                              <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                ENVIADO
                              </span>
                            ) : isWithin30Days ? (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                ENVIO NO PRAZO
                              </span>
                            ) : (
                              <span className="text-[10px] bg-red-100 text-red-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                FORA DO PRAZO ({daysElapsed} dias)
                              </span>
                            )}

                            {audit.surplusFlowStatus === 'ENCAMINHADO' && !audit.gestorAlignedDeliveryDate && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                                AGUARDANDO GESTOR
                              </span>
                            )}
                            {audit.gestorAlignedDeliveryDate && audit.surplusFlowStatus !== 'ENVIADO' && (
                              <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                DATA ALINHADA PELO GESTOR
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Surpluses & Deficits Lists */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Sobras */}
                          <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-black text-amber-900 uppercase flex items-center space-x-1.5">
                              <span className="h-1.5 w-1.5 bg-amber-500 rounded-full" />
                              <span>Sobra Detectada</span>
                            </h4>
                            {surpluses.length === 0 ? (
                              <p className="text-slate-400 italic text-[11px]">Nenhuma sobra identificada.</p>
                            ) : (
                              <div className="space-y-1">
                                {surpluses.map((s, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs text-amber-950 font-medium">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-[9px] bg-amber-200 text-amber-900 font-black px-1 rounded font-mono">{s.type}</span>
                                      <span>
                                        {s.code && <span className="font-mono text-amber-900 font-bold mr-1">[{s.code}]</span>}
                                        {s.description}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold">+{s.qty} {s.unit}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {audit.reconciliationNotes && (
                              <div className="mt-2.5 p-2 bg-amber-100/40 border border-amber-200 rounded-lg text-xxs text-amber-950">
                                <div className="flex items-center space-x-1.5 mb-1.5 border-b border-amber-200/50 pb-1">
                                  {surpluses.length > 0 && deficits.length > 0 ? (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                      <span className="font-bold uppercase tracking-wider font-sans text-[9px] text-indigo-900">
                                        Observação de Ambas Ocorrências (Todos)
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowUpCircle className="h-3.5 w-3.5 text-amber-600" />
                                      <span className="font-bold uppercase tracking-wider font-sans text-[9px] text-amber-900">
                                        Observação de Sobras
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="font-medium whitespace-pre-wrap">{audit.reconciliationNotes}</p>
                              </div>
                            )}
                          </div>

                          {/* Faltas */}
                          <div className="bg-red-50/20 border border-red-100 rounded-xl p-4 space-y-2">
                            <h4 className="text-xs font-black text-red-950 uppercase flex items-center space-x-1.5">
                              <span className="h-1.5 w-1.5 bg-red-500 rounded-full" />
                              <span>Falta Detectada</span>
                            </h4>
                            {deficits.length === 0 ? (
                              <p className="text-slate-400 italic text-[11px]">Nenhuma falta identificada.</p>
                            ) : (
                              <div className="space-y-1">
                                {deficits.map((d, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-xs text-red-950 font-medium">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-[9px] bg-red-200 text-red-900 font-black px-1 rounded font-mono">{d.type}</span>
                                      <span>
                                        {d.code && <span className="font-mono text-red-900 font-bold mr-1">[{d.code}]</span>}
                                        {d.description}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold font-bold">-{d.qty} {d.unit}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {audit.reconciliationNotes && (
                              <div className="mt-2.5 p-2 bg-red-100/30 border border-red-200 rounded-lg text-xxs text-red-950">
                                <div className="flex items-center space-x-1.5 mb-1.5 border-b border-red-200/40 pb-1">
                                  {surpluses.length > 0 && deficits.length > 0 ? (
                                    <>
                                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                      <span className="font-bold uppercase tracking-wider font-sans text-[9px] text-indigo-900">
                                        Observação de Ambas Ocorrências (Todos)
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />
                                      <span className="font-bold uppercase tracking-wider font-sans text-[9px] text-red-900">
                                        Observação de Faltas
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="font-medium whitespace-pre-wrap">{audit.reconciliationNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Monitoramento Form or Display */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-150 space-y-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">
                            Fluxo de Roteamento de Sobra (Ações e Registro)
                          </span>

                          {/* Interactive Section */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">NB (Código Cliente)</label>
                              <input
                                type="text"
                                placeholder="NB do Cliente..."
                                disabled={currentUser.role !== 'monitoramento' && currentUser.role !== 'gestor'}
                                defaultValue={audit.clientCodeNB || ''}
                                id={`nb_input_${audit.id}`}
                                className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 font-sans">Data de Entrega</label>
                              <input
                                type="date"
                                disabled={currentUser.role !== 'monitoramento' && currentUser.role !== 'gestor'}
                                defaultValue={audit.deliveryDate || ''}
                                id={`date_input_${audit.id}`}
                                className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none"
                              />
                            </div>

                            <div className="flex gap-2">
                              {/* Monitoramento or Gestor Save Button */}
                              {(currentUser.role === 'monitoramento' || currentUser.role === 'gestor') && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nbVal = (document.getElementById(`nb_input_${audit.id}`) as HTMLInputElement)?.value || '';
                                      const dateVal = (document.getElementById(`date_input_${audit.id}`) as HTMLInputElement)?.value || '';
                                      if (!nbVal || !dateVal) {
                                        alert('Por favor, informe o código NB do cliente e a data de entrega.');
                                        return;
                                      }
                                      const isGestor = currentUser.role === 'gestor';
                                      const commentVal = (document.getElementById(`action_comment_${audit.id}`) as HTMLTextAreaElement)?.value || '';
                                      const updated = audits.map(a => {
                                        if (a.id === audit.id) {
                                          return {
                                            ...a,
                                            clientCodeNB: nbVal,
                                            deliveryDate: dateVal,
                                            surplusFlowStatus: 'ENCAMINHADO' as const,
                                            gestorAlignedDeliveryDate: isGestor ? true : false,
                                            reconciliationNotes: commentVal || a.reconciliationNotes,
                                            history: [
                                              ...a.history,
                                              {
                                                timestamp: new Date().toISOString(),
                                                action: isGestor ? 'Sobra Alinhada e Registrada pelo Gestor' : 'Previsão de Entrega da Sobra Informada',
                                                user: currentUser.name,
                                                details: isGestor 
                                                  ? `NB: ${nbVal} | Data de Entrega: ${dateVal}. Alinhamento automático efetuado pelo Gestor.`
                                                  : `NB: ${nbVal} | Data de Entrega: ${dateVal}. Encaminhado ao gestor para alinhamento.`
                                              }
                                            ]
                                          };
                                        }
                                        return a;
                                      });
                                      onSaveAudits(updated);
                                      if (isGestor) {
                                        alert('Dados salvos e data de entrega alinhada pelo Gestor!');
                                      } else {
                                        alert('Dados salvos! Uma notificação foi enviada ao gestor para alinhamento da data.');
                                      }
                                    }}
                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition cursor-pointer shadow-sm text-center font-sans"
                                  >
                                    {currentUser.role === 'gestor' ? 'Salvar e Alinhar' : 'Salvar e Encaminhar'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const commentVal = (document.getElementById(`action_comment_${audit.id}`) as HTMLTextAreaElement)?.value || '';
                                      requestConfirm(
                                        '❓ Confirmar Baixa Direta',
                                        'Tem certeza que deseja realizar a Baixa Direta desta ocorrência (sobra/falta)?\n\nEsta ação arquiva a ocorrência diretamente sem exigir mais alinhamentos ou vales financeiros.',
                                        () => {
                                          const updated = audits.map(a => {
                                            if (a.id === audit.id) {
                                              const isSobra = surpluses.length > 0;
                                              return {
                                                ...a,
                                                surplusFlowStatus: 'BAIXADO' as const,
                                                surplusActionStatus: 'baixado_direto' as const,
                                                deficitActionStatus: 'baixado_direto' as const,
                                                reconciliationNotes: commentVal || a.reconciliationNotes,
                                                correctiveActionNotes: commentVal 
                                                  ? `Baixa direta efetuada com observações: ${commentVal}`
                                                  : (isSobra 
                                                      ? 'Baixa direta efetuada pelo painel operacional (sobra).'
                                                      : 'Baixa direta efetuada pelo painel operacional (falta).'),
                                                history: [
                                                  ...a.history,
                                                  {
                                                    timestamp: new Date().toISOString(),
                                                    action: isSobra ? 'Baixa Direta de Sobras Realizada' : 'Baixa Direta de Faltas Realizada',
                                                    user: currentUser.name,
                                                    details: commentVal 
                                                      ? `Baixa direta efetuada pelo Gestor/Monitoramento. Observação: ${commentVal}`
                                                      : (isSobra 
                                                          ? 'Baixa direta efetuada pelo Gestor/Monitoramento no painel operacional (Sobra).'
                                                          : 'Baixa direta efetuada pelo Gestor/Monitoramento no painel operacional (Falta).')
                                                  }
                                                ]
                                              };
                                            }
                                            return a;
                                          });
                                          onSaveAudits(updated);
                                          alert('Baixa direta realizada com sucesso!');
                                        }
                                      );
                                    }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-3 rounded-lg transition cursor-pointer shadow-sm text-center flex items-center justify-center space-x-1.5 font-sans"
                                  >
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    <span>Baixa Direta</span>
                                  </button>
                                </>
                              )}

                              {/* Gestor Aligned Notification Button */}
                              {currentUser.role === 'gestor' && audit.surplusFlowStatus === 'ENCAMINHADO' && !audit.gestorAlignedDeliveryDate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const commentVal = (document.getElementById(`action_comment_${audit.id}`) as HTMLTextAreaElement)?.value || '';
                                    const updated = audits.map(a => {
                                      if (a.id === audit.id) {
                                        return {
                                          ...a,
                                          gestorAlignedDeliveryDate: true,
                                          reconciliationNotes: commentVal || a.reconciliationNotes,
                                          history: [
                                            ...a.history,
                                            {
                                              timestamp: new Date().toISOString(),
                                              action: 'Data de Entrega Alinhada pelo Gestor',
                                              user: currentUser.name,
                                              details: `Data de Entrega alinhada: ${a.deliveryDate}`
                                            }
                                          ]
                                        };
                                      }
                                      return a;
                                    });
                                    onSaveAudits(updated);
                                    alert('Data de entrega alinhada com sucesso!');
                                  }}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-lg transition cursor-pointer shadow-sm text-center font-sans"
                                >
                                  Alinhar Data de Entrega
                                </button>
                              )}

                              {/* Dar Baixa (Resolvido) button for Auxiliar or anyone after encaminhado */}
                              {audit.surplusFlowStatus === 'ENCAMINHADO' && (
                                <button
                                  type="button"
                                  disabled={!audit.gestorAlignedDeliveryDate && currentUser.role === 'auxiliar_logistica'}
                                  onClick={() => {
                                    const commentVal = (document.getElementById(`action_comment_${audit.id}`) as HTMLTextAreaElement)?.value || '';
                                    const updated = audits.map(a => {
                                      if (a.id === audit.id) {
                                        return {
                                          ...a,
                                          surplusFlowStatus: 'ENVIADO' as const,
                                          surplusActionStatus: 'enviado_cliente' as const,
                                          reconciliationNotes: commentVal || a.reconciliationNotes,
                                          history: [
                                            ...a.history,
                                            {
                                              timestamp: new Date().toISOString(),
                                              action: 'Baixa de Sobras Realizada - Enviado',
                                              user: currentUser.name,
                                              details: `Status de fluxo finalizado como ENVIADO.`
                                            }
                                          ]
                                        };
                                      }
                                      return a;
                                    });
                                    onSaveAudits(updated);
                                    alert('Baixa efetuada! O status foi alterado para ENVIADO.');
                                  }}
                                  className={`flex-1 font-bold text-xs py-2 px-3 rounded-lg transition shadow-sm text-center cursor-pointer font-sans ${
                                    audit.gestorAlignedDeliveryDate || currentUser.role === 'gestor'
                                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  }`}
                                  title={!audit.gestorAlignedDeliveryDate && currentUser.role !== 'gestor' ? 'Aguardando o gestor alinhar a data de entrega para permitir a baixa' : 'Dar baixa e marcar como enviado'}
                                >
                                  Dar Baixa (Enviado)
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Show saved values */}
                          {(audit.clientCodeNB || audit.deliveryDate) && (
                            <div className="flex flex-wrap gap-4 pt-2 text-xs border-t border-slate-200 text-slate-600">
                              <div><strong>Código NB:</strong> <span className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-slate-800">{audit.clientCodeNB || 'N/A'}</span></div>
                              <div><strong>Previsão de Entrega:</strong> <span className="font-mono bg-white border border-slate-200 px-1 py-0.5 rounded text-slate-800">{audit.deliveryDate ? new Date(audit.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                              {audit.gestorAlignedDeliveryDate && (
                                <div className="text-emerald-600 font-bold flex items-center space-x-1">
                                  <span>✓ Alinhado pelo Gestor</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Ações Sugeridas & Seção de Observações Salvas */}
                          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mt-3 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="flex items-center space-x-1.5 text-amber-800">
                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider font-sans font-bold">Ação Sugerida do Sistema</span>
                              </div>
                              {/* Botão de gerar vale financeiro se houver faltas */}
                              {deficits.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const valorFalta = audit.items.reduce((acc, i) => {
                                      const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                                      const fQty = i.fiscalQty ?? 0;
                                      const comodato = i.comodatoQty ?? 0;
                                      const recolha = i.recolhaQty ?? 0;
                                      const netDiff = (phys + comodato - recolha) - fQty;
                                      if (netDiff < 0) return acc + (Math.abs(netDiff) * getSkuClosedPrice(i.productCode, i.cost ?? 45.0));
                                      return acc;
                                    }, 0) + audit.assets.reduce((acc, a) => {
                                      const idLower = (a.assetId || '').toLowerCase();
                                      const nameUpper = (a.assetName || '').toUpperCase();
                                      const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                                      if (isChapatex) return acc;

                                      const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                                      const fQty = a.fiscalQty ?? 0;
                                      const comodato = a.comodatoQty ?? 0;
                                      const recolha = a.recolhaQty ?? 0;
                                      const netDiff = (phys + comodato - recolha) - fQty;
                                      if (netDiff < 0) return acc + (Math.abs(netDiff) * (a.cost ?? 18.0));
                                      return acc;
                                    }, 0);

                                    const descFalta = deficits.map(d => `${d.qty}x ${d.code ? `[${d.code}] ` : ''}${d.description}`).join(', ');
                                    const motoristaNome = getDriverName(audit.driverId);

                                    const novoVale = {
                                      id: 'val_' + Date.now(),
                                      auditId: audit.id,
                                      routeMap: audit.routeMap,
                                      colaboradorId: audit.driverId,
                                      colaboradorName: motoristaNome,
                                      colaboradorRole: 'MOTORISTA',
                                      valor: Number(valorFalta.toFixed(2)) || 80.0,
                                      descricao: `Falta de: ${descFalta}. Mapa: ${audit.routeMap}`,
                                      dataGeracao: new Date().toISOString().split('T')[0],
                                      status: 'PENDENTE_ASSINATURA' as const,
                                      observacao: 'Gerado automaticamente por desvios identificados na aferição física.'
                                    };

                                    const updatedAudits = audits.map(a => {
                                      if (a.id === audit.id) {
                                        return {
                                          ...a,
                                          history: [
                                            ...a.history,
                                            {
                                              timestamp: new Date().toISOString(),
                                              action: 'Vale Financeiro Gerado',
                                              user: currentUser.name,
                                              details: `Vale de R$ ${valorFalta.toFixed(2)} gerado para o colaborador ${motoristaNome}. Descrição: ${descFalta}.`
                                            }
                                          ]
                                        };
                                      }
                                      return a;
                                    });

                                    onSaveVales([...vales, novoVale]);
                                    onSaveAudits(updatedAudits);
                                    alert(`Sucesso! Vale financeiro autogerado no valor de R$ ${novoVale.valor.toFixed(2)} para ${novoVale.colaboradorName}.`);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase py-1 px-2.5 rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1 shrink-0"
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>Gerar Vale Financeiro</span>
                                </button>
                              )}
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {deficits.length > 0 
                                ? `Detectada Falta Física de ${deficits.map(d => `${d.qty} ${d.unit} de ${d.code ? `[${d.code}] ` : ''}${d.description}`).join(', ')}. Ação sugerida: Gerar e emitir Vale de Desconto para o motorista/ajudante responsável ou coletar justificativa assinada pelo fiscal de expedição.`
                                : `Detectada Sobra Física de ${surpluses.map(s => `${s.qty} ${s.unit} de ${s.code ? `[${s.code}] ` : ''}${s.description}`).join(', ')}. Ação sugerida: Identificar e inserir o código NB do cliente, alinhar data estimada de entrega e encaminhar ao gestor para efetivar baixa física.`
                              }
                            </p>

                            {/* Caixa de Comentário / Observação de Ação */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Comentários e Observações da Ação Executada</label>
                                <div className="flex items-center space-x-1">
                                  {currentObsType === 'todos' ? (
                                    <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full uppercase tracking-wider font-sans animate-pulse">
                                      <Sparkles className="h-3 w-3 text-indigo-600" />
                                      <span>AMBOS (SOBRA & FALTA)</span>
                                    </span>
                                  ) : currentObsType === 'sobra' ? (
                                    <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">
                                      <ArrowUpCircle className="h-3 w-3 text-amber-600" />
                                      <span>APLICA-SE A SOBRA</span>
                                    </span>
                                  ) : currentObsType === 'falta' ? (
                                    <span className="inline-flex items-center space-x-1 text-[9px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">
                                      <ArrowDownCircle className="h-3 w-3 text-red-600" />
                                      <span>APLICA-SE A FALTA</span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Classificação do comentário (Sobra / Falta / Todos) */}
                              <div className="flex items-center space-x-2 pt-0.5 pb-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase font-sans">Classificar como:</span>
                                <button
                                  type="button"
                                  onClick={() => setCardObsTypes(prev => ({ ...prev, [audit.id]: 'sobra' }))}
                                  className={`flex items-center space-x-1 text-[8px] font-extrabold px-2 py-0.5 rounded transition border cursor-pointer ${
                                    currentObsType === 'sobra'
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-3xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <ArrowUpCircle className="h-2.5 w-2.5" />
                                  <span>Sobra</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCardObsTypes(prev => ({ ...prev, [audit.id]: 'falta' }))}
                                  className={`flex items-center space-x-1 text-[8px] font-extrabold px-2 py-0.5 rounded transition border cursor-pointer ${
                                    currentObsType === 'falta'
                                      ? 'bg-rose-600 text-white border-rose-700 shadow-3xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <ArrowDownCircle className="h-2.5 w-2.5" />
                                  <span>Falta</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCardObsTypes(prev => ({ ...prev, [audit.id]: 'todos' }))}
                                  className={`flex items-center space-x-1 text-[8px] font-extrabold px-2 py-0.5 rounded transition border cursor-pointer ${
                                    currentObsType === 'todos'
                                      ? 'bg-slate-600 text-white border-slate-700 shadow-3xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <AlertCircle className="h-2.5 w-2.5" />
                                  <span>Todos</span>
                                </button>
                              </div>

                              <textarea
                                id={`action_comment_${audit.id}`}
                                key={audit.reconciliationNotes || ''}
                                rows={2}
                                placeholder="Coloque observações, observações de recontagem, decisões de vales ou andamento da reentrega..."
                                defaultValue={audit.reconciliationNotes || ''}
                                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition leading-normal font-sans"
                              />
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] text-slate-400 font-medium">Os comentários salvos aparecem diretamente neste card e no histórico.</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const valInput = (document.getElementById(`action_comment_${audit.id}`) as HTMLTextAreaElement)?.value || '';
                                    const currentObsType = cardObsTypes[audit.id] || (surpluses.length > 0 && deficits.length > 0 ? 'todos' : surpluses.length > 0 ? 'sobra' : deficits.length > 0 ? 'falta' : 'todos');
                                    
                                    // 1. Save in the audit session
                                    const updated = audits.map(a => {
                                      if (a.id === audit.id) {
                                        return {
                                          ...a,
                                          reconciliationNotes: valInput,
                                          history: [
                                            ...a.history,
                                            {
                                              timestamp: new Date().toISOString(),
                                              action: 'Observação da Ação Salva no Card',
                                              user: currentUser.name,
                                              details: `[Classificação: ${currentObsType.toUpperCase()}] ${valInput}`
                                            }
                                          ]
                                        };
                                      }
                                      return a;
                                    });
                                    onSaveAudits(updated);

                                    // 2. Sync to the matching ImportedRoute so it's beautifully visual in Monitoramento
                                    const matchingRoute = importedRoutes.find(r => r.routeMap.toUpperCase() === audit.routeMap.toUpperCase());
                                    if (matchingRoute && onSaveImportedRoutes) {
                                      const newObs: RouteObservation = {
                                        id: `obs_${Date.now()}`,
                                        author: 'Logística',
                                        text: valInput.trim(),
                                        timestamp: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                                        type: currentObsType
                                      };
                                      const currentObsList = matchingRoute.routeObservations || [];
                                      const updatedObsList = [...currentObsList, newObs];
                                      const combinedString = updatedObsList.map(o => `[${o.author} - ${o.timestamp}]: ${o.text}`).join('\n');
                                      
                                      const updatedRoutes = importedRoutes.map(r => {
                                        if (r.id === matchingRoute.id) {
                                          return {
                                            ...r,
                                            routeObservations: updatedObsList,
                                            discrepancyObservation: combinedString
                                          };
                                        }
                                        return r;
                                      });
                                      onSaveImportedRoutes(updatedRoutes);
                                    }

                                    alert('Comentário e observação do card salvos e classificados com sucesso!');
                                  }}
                                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase py-1 px-3 rounded-lg transition cursor-pointer"
                                >
                                  Salvar Comentário
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Section: Gestão de Vales (Vales View) */}
          {activeTab === 'vales_view' && (
            <div className="space-y-6 animate-fade-in" id="tab_vales_view">
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900">
                  <FileText className="h-6 w-6 text-red-500 animate-pulse" />
                  <h2 className="font-sans font-bold text-lg uppercase">Controle & Emissão de Vales de Desvio</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Registro, controle e assinatura de termos de responsabilidade de vales para desvios de conferência (produtos faltantes ou ativos de giro danificados).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 w-full min-w-0">
                {/* Form to Issue Vale (Left) */}
                <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs h-fit min-w-0">
                  <h3 className="font-sans font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center space-x-1.5 font-bold">
                    <Plus className="h-4 w-4 text-amber-500" />
                    <span>Emitir Novo Vale de Desconto</span>
                  </h3>

                  <div className="space-y-3">
                    {/* Seleção ou Inserção Manual de Mapa com Falta */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">
                          Mapa / Rota Relacionado
                        </label>
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setValeMapMode('lista')}
                            className={`px-2 py-0.5 font-bold rounded-md transition ${
                              valeMapMode === 'lista'
                                ? 'bg-white text-amber-700 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            📋 Lista de Faltas ({mapsWithShortagesList.filter(m => !m.alreadyHasVale).length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setValeMapMode('manual')}
                            className={`px-2 py-0.5 font-bold rounded-md transition ${
                              valeMapMode === 'manual'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            ✍️ Inserir Manual
                          </button>
                        </div>
                      </div>

                      {valeMapMode === 'lista' ? (
                        <div className="space-y-1">
                          <select
                            value={valeRouteMap}
                            onChange={(e) => {
                              const selectedMap = e.target.value;
                              setValeRouteMap(selectedMap);
                              if (!selectedMap) {
                                setValeColaboradorId('');
                                setValeValeValor('');
                                setValeDescricao('');
                                setValeAssociatedInfo(null);
                                return;
                              }
                              inspectAndAssociateMap(selectedMap, true);
                            }}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono"
                          >
                            <option value="">Selecione um mapa com divergência de falta...</option>
                            {mapsWithShortagesList.length === 0 && (
                              <option value="" disabled>Nenhum mapa com faltas registrado no momento</option>
                            )}
                            {mapsWithShortagesList.filter(m => !m.alreadyHasVale).length > 0 && (
                              <optgroup label={`Mapas com Faltas Pendentes de Vale (${mapsWithShortagesList.filter(m => !m.alreadyHasVale).length})`}>
                                {mapsWithShortagesList.filter(m => !m.alreadyHasVale).map(m => (
                                  <option key={`pend_${m.routeMap}`} value={m.routeMap}>
                                    Mapa {m.routeMap} • {m.driverName} • Placa {m.plate} • R$ {m.totalShortageValue.toFixed(2)} ({m.missingCount} divergência{m.missingCount > 1 ? 's' : ''})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {mapsWithShortagesList.filter(m => m.alreadyHasVale).length > 0 && (
                              <optgroup label={`Mapas com Vale Já Emitido (${mapsWithShortagesList.filter(m => m.alreadyHasVale).length})`}>
                                {mapsWithShortagesList.filter(m => m.alreadyHasVale).map(m => (
                                  <option key={`emit_${m.routeMap}`} value={m.routeMap}>
                                    [JÁ EMITIDO] Mapa {m.routeMap} • {m.driverName} • R$ {m.totalShortageValue.toFixed(2)}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <p className="text-[10px] text-slate-400">
                            A lista carrega automaticamente todos os mapas com faltas registradas nas conferências físicas.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={valeRouteMap}
                              onChange={(e) => {
                                const val = e.target.value;
                                setValeRouteMap(val);
                                inspectAndAssociateMap(val, true);
                              }}
                              placeholder="Digite o número do mapa (ex: 108, 1029, ROTA-04)..."
                              className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-mono uppercase font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!valeRouteMap.trim()) {
                                  alert('Informe o número ou código do mapa para buscar.');
                                  return;
                                }
                                inspectAndAssociateMap(valeRouteMap, true);
                              }}
                              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1 shrink-0"
                            >
                              <Search className="h-3.5 w-3.5" />
                              <span>Buscar Falta</span>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            O colaborador pode colocar o mapa manualmente. O sistema identifica e associa a falta automaticamente caso exista histórico no sistema.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card de Associação Automática da Falta do Mapa */}
                    {valeAssociatedInfo && (
                      <div className={`p-3 rounded-xl border text-xs transition-all ${
                        valeAssociatedInfo.hasShortage
                          ? 'bg-amber-50/70 border-amber-300 text-amber-950 shadow-xs'
                          : valeAssociatedInfo.found
                            ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-black/5">
                          <div className="flex items-center gap-1.5">
                            {valeAssociatedInfo.hasShortage ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : valeAssociatedInfo.found ? (
                              <Info className="h-4 w-4 text-blue-600 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <span className="font-bold text-[11px] uppercase tracking-wide">
                              {valeAssociatedInfo.hasShortage
                                ? `✓ Falta Associada Automaticamente: Mapa ${valeAssociatedInfo.map}`
                                : valeAssociatedInfo.found
                                  ? `Mapa ${valeAssociatedInfo.map} Localizado (Sem Faltas)`
                                  : `Mapa ${valeAssociatedInfo.map} Inserido Manualmente`}
                            </span>
                          </div>

                          {valeAssociatedInfo.alreadyHasVale && (
                            <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-red-200">
                              Vale já emitido
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[10px]">
                          <div>
                            <span className="text-slate-500 font-sans block text-[9px] uppercase font-bold">Motorista Vinculado</span>
                            <span className="font-bold truncate block">{valeAssociatedInfo.driverName || 'Não identificado'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-sans block text-[9px] uppercase font-bold">Placa do Veículo</span>
                            <span className="font-bold truncate block">{valeAssociatedInfo.plate || '---'}</span>
                          </div>
                          {valeAssociatedInfo.hasShortage && (
                            <div className="col-span-2 bg-white/80 p-2 rounded-lg border border-amber-200/70 mt-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-sans text-[9px] uppercase font-bold text-amber-800">
                                  Itens em Falta ({valeAssociatedInfo.items?.length || 0} divergências)
                                </span>
                                <span className="font-extrabold text-xs text-amber-900">
                                  Total: R$ {valeAssociatedInfo.totalValue?.toFixed(2)}
                                </span>
                              </div>
                              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                {valeAssociatedInfo.items?.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-[10px] text-slate-700 bg-amber-50/50 px-1.5 py-0.5 rounded">
                                    <span className="truncate max-w-[200px] font-medium">{it.qty}x {it.name}</span>
                                    <span className="font-bold shrink-0 text-slate-900">R$ {it.totalCost.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {valeAssociatedInfo.hasShortage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (valeAssociatedInfo.driverId) setValeColaboradorId(valeAssociatedInfo.driverId);
                              if (valeAssociatedInfo.totalValue) setValeValeValor(valeAssociatedInfo.totalValue.toFixed(2));
                              if (valeAssociatedInfo.description) setValeDescricao(valeAssociatedInfo.description);
                            }}
                            className="mt-2 w-full text-center py-1 bg-amber-600/10 hover:bg-amber-600/20 text-amber-900 rounded font-bold text-[10px] border border-amber-300 transition cursor-pointer"
                          >
                            ↻ Reaplicar Valores e Descrição da Falta no Formulário
                          </button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Valor do Desconto (R$) *</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={valeValeValor}
                            onChange={(e) => handleEmissionValorChange(e.target.value)}
                            className="w-full text-xs pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Qtd. Volumes / Itens</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Ex: 3"
                          value={valeQuantidade}
                          onChange={(e) => setValeQuantidade(e.target.value)}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono"
                        />
                      </div>
                    </div>

                    {/* Seção: Equipe Envolvida no Desvio & Rateio Automático */}
                    <div className="space-y-2.5 pt-2.5 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-800 uppercase font-sans flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-amber-600" />
                            <span>Quantidade de Colaboradores Envolvidos:</span>
                          </label>
                          <p className="text-[9px] text-slate-500">
                            Quantas pessoas compartilham o desvio. Os campos e o rateio do valor abrem automaticamente.
                          </p>
                        </div>

                        {/* Botoes rápidos de quantidade */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {[1, 2, 3, 4, 5, 6].map((num) => {
                            const isSelected = valeQuantidadeColaboradores === num;
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => handleSetEmissionNumColaboradores(num)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-0.5 ${
                                  isSelected
                                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400 font-black'
                                    : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
                                }`}
                              >
                                <span>{num} {num === 1 ? 'Pessoa' : 'Pessoas'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Banner Informativo de Rateio do Valor em Tempo Real */}
                      {Number(valeValeValor) > 0 && (() => {
                        const totalVal = Number(valeValeValor);
                        const shares = calculateRateioShares(totalVal, valeQuantidadeColaboradores);
                        const percent = (100 / valeQuantidadeColaboradores).toFixed(1);
                        return (
                          <div className="bg-amber-100/70 border border-amber-300 rounded-lg p-2 flex flex-wrap items-center justify-between gap-1 text-xxs text-amber-950 font-sans">
                            <div className="flex items-center gap-1.5">
                              <Calculator className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <div>
                                <span className="font-bold">Rateio Automático: </span>
                                <span className="font-mono font-black text-amber-900">
                                  R$ {totalVal.toFixed(2)}
                                </span>
                                <span className="text-slate-600"> ÷ </span>
                                <span className="font-bold">
                                  {valeQuantidadeColaboradores} {valeQuantidadeColaboradores === 1 ? 'colaborador' : 'colaboradores'}
                                </span>
                                <span className="text-slate-600"> = </span>
                                <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300">
                                  R$ {shares[0].toFixed(2)}
                                </span>
                                <span className="text-[9.5px] text-slate-600 ml-1">
                                  ({percent}% para cada)
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetEmissionNumColaboradores(valeQuantidadeColaboradores)}
                              className="text-[9px] bg-amber-200/80 hover:bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded border border-amber-400 font-bold cursor-pointer transition shadow-3xs"
                              title="Recalcular divisão igualitária"
                            >
                              ↻ Recalcular Divisão
                            </button>
                          </div>
                        );
                      })()}

                      {/* Slots de Colaboradores: Abertos exatamente conforme a quantidade selecionada */}
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {/* 1º Colaborador (Responsável Principal) */}
                        {(() => {
                          const totalVal = Number(valeValeValor) || 0;
                          const shares = calculateRateioShares(totalVal, valeQuantidadeColaboradores);
                          const colab1Cota = valeColaboradorValor !== undefined ? valeColaboradorValor : shares[0];
                          return (
                            <div className="p-2.5 rounded-lg border-2 border-amber-300 bg-white text-xxs transition-all shadow-3xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[9.5px] uppercase tracking-wide flex items-center gap-1 text-slate-800">
                                  <span>👤 1º Colaborador (Responsável Principal)</span>
                                  <span className="bg-amber-100 text-amber-900 text-[8px] font-bold px-1 rounded">Principal</span>
                                </span>
                                <span className="text-emerald-800 text-[9px] font-mono font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">
                                  Cota: R$ {colab1Cota.toFixed(2)}
                                </span>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[8px] font-bold text-slate-500 uppercase">Buscar Cadastrado</label>
                                <select
                                  value={valeColaboradorId}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    setValeColaboradorId(selectedId);
                                    if (!selectedId) return;
                                    const d = drivers.find(drv => drv.id === selectedId);
                                    if (d) {
                                      setValeColaboradorName(d.name);
                                      setValeColaboradorRole(d.role === 'AJUDANTE' ? 'AJUDANTE' : 'MOTORISTA');
                                    } else {
                                      const u = (users || DEFAULT_USERS).find(usr => usr.id === selectedId);
                                      if (u) {
                                        setValeColaboradorName(u.name);
                                        setValeColaboradorRole(u.role === 'conferente' ? 'CONFERENTE' : 'AUXILIAR');
                                      }
                                    }
                                  }}
                                  className="w-full text-xxs p-1.5 bg-slate-50 border border-slate-200 rounded font-medium"
                                >
                                  <option value="">Selecione da lista cadastrada...</option>
                                  <optgroup label="Motoristas">
                                    {drivers.filter(d => d.role === 'MOTORISTA').map(d => (
                                      <option key={d.id} value={d.id}>{d.name} (Motorista)</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Ajudantes Cadastrados">
                                    {drivers.filter(d => d.role === 'AJUDANTE').map(d => (
                                      <option key={d.id} value={d.id}>{d.name} (Ajudante)</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Equipe Operacional">
                                    {(users || DEFAULT_USERS).map(u => (
                                      <option key={u.id} value={u.id}>{u.name} ({u.role.toUpperCase()})</option>
                                    ))}
                                  </optgroup>
                                </select>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-0.5">
                                  <div className="sm:col-span-5">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Nome *</label>
                                    <input
                                      type="text"
                                      placeholder="Nome do colaborador principal..."
                                      value={valeColaboradorName}
                                      onChange={(e) => setValeColaboradorName(e.target.value)}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                    />
                                  </div>
                                  <div className="sm:col-span-4">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Cargo / Função *</label>
                                    <select
                                      value={valeColaboradorRole}
                                      onChange={(e) => setValeColaboradorRole(e.target.value)}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                    >
                                      <option value="MOTORISTA">🚚 Motorista</option>
                                      <option value="AJUDANTE">📦 Ajudante</option>
                                      <option value="CONFERENTE">📋 Conferente</option>
                                      <option value="AUXILIAR">⚙️ Auxiliar</option>
                                      <option value="OUTRO">Outro</option>
                                    </select>
                                  </div>
                                  <div className="sm:col-span-3">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Cota (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={colab1Cota}
                                      onChange={(e) => setValeColaboradorValor(e.target.value === '' ? undefined : Number(e.target.value))}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-mono font-bold text-emerald-800"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Colaboradores Adicionais (2º, 3º, etc. exatamente conforme a quantidade selecionada) */}
                        {valeColaboradoresAdicionais.map((helper, idx) => {
                          const helperNumber = idx + 2;
                          const totalVal = Number(valeValeValor) || 0;
                          const shares = calculateRateioShares(totalVal, valeQuantidadeColaboradores);
                          const currentCota = helper.valor !== undefined ? helper.valor : shares[idx + 1];
                          return (
                            <div 
                              key={helper.id || idx}
                              className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/60 text-xxs transition-all shadow-3xs space-y-1.5 animate-fade-in"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[9.5px] uppercase tracking-wide flex items-center gap-1 text-slate-800">
                                  <span>👤 {helperNumber}º Colaborador (Co-responsável)</span>
                                  <span className="bg-amber-200/80 text-amber-900 text-[8px] font-bold px-1 rounded">Rateio Ativo</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-emerald-800 text-[9px] font-mono font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">
                                    Cota: R$ {currentCota.toFixed(2)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleClearEmissionHelper(idx)}
                                    className="text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[8.5px]"
                                    title={`Remover ${helperNumber}º Colaborador`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Remover</span>
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-[8px] font-bold text-slate-500 uppercase">Buscar Cadastrado</label>
                                <select
                                  value={helper?.id && drivers.some(d => d.id === helper.id) ? helper.id : ''}
                                  onChange={(e) => {
                                    const selectedId = e.target.value;
                                    if (!selectedId) return;
                                    const d = drivers.find(drv => drv.id === selectedId);
                                    if (d) {
                                      handleUpdateEmissionHelper(idx, {
                                        id: d.id,
                                        name: d.name,
                                        role: d.role === 'MOTORISTA' ? 'MOTORISTA' : 'AJUDANTE'
                                      });
                                    } else {
                                      const u = (users || DEFAULT_USERS).find(usr => usr.id === selectedId);
                                      if (u) {
                                        handleUpdateEmissionHelper(idx, {
                                          id: u.id,
                                          name: u.name,
                                          role: u.role === 'conferente' ? 'CONFERENTE' : 'AUXILIAR'
                                        });
                                      }
                                    }
                                  }}
                                  className="w-full text-xxs p-1.5 bg-white border border-slate-200 rounded font-medium"
                                >
                                  <option value="">Selecione da lista cadastrada...</option>
                                  <optgroup label="Ajudantes Cadastrados">
                                    {drivers.filter(d => d.role === 'AJUDANTE').map(d => (
                                      <option key={d.id} value={d.id}>{d.name} (Ajudante)</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Motoristas">
                                    {drivers.filter(d => d.role === 'MOTORISTA').map(d => (
                                      <option key={d.id} value={d.id}>{d.name} (Motorista)</option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Equipe Operacional">
                                    {(users || DEFAULT_USERS).map(u => (
                                      <option key={u.id} value={u.id}>{u.name} ({u.role.toUpperCase()})</option>
                                    ))}
                                  </optgroup>
                                </select>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-0.5">
                                  <div className="sm:col-span-5">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Nome *</label>
                                    <input
                                      type="text"
                                      placeholder={`Nome do ${helperNumber}º colaborador...`}
                                      value={helper?.name || ''}
                                      onChange={(e) => handleUpdateEmissionHelper(idx, { name: e.target.value })}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                    />
                                  </div>
                                  <div className="sm:col-span-4">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Cargo / Função *</label>
                                    <select
                                      value={helper?.role || 'AJUDANTE'}
                                      onChange={(e) => handleUpdateEmissionHelper(idx, { role: e.target.value })}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                    >
                                      <option value="AJUDANTE">📦 Ajudante</option>
                                      <option value="MOTORISTA">🚚 Motorista</option>
                                      <option value="CONFERENTE">📋 Conferente</option>
                                      <option value="AUXILIAR">⚙️ Auxiliar</option>
                                      <option value="OUTRO">Outro</option>
                                    </select>
                                  </div>
                                  <div className="sm:col-span-3">
                                    <label className="block text-[8px] font-bold text-slate-500 uppercase">Cota (R$)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={currentCota}
                                      onChange={(e) => handleUpdateEmissionHelper(idx, { valor: e.target.value === '' ? undefined : Number(e.target.value) })}
                                      className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-mono font-bold text-emerald-800"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Motivo / Descrição da Falta</label>
                      <input
                        type="text"
                        placeholder="Ex: Falta de 2 caixas de Spaten 350ml"
                        value={valeDescricao}
                        onChange={(e) => setValeDescricao(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase font-sans">Observações Gerais</label>
                      <textarea
                        rows={2}
                        placeholder="Insira detalhes sobre as circunstâncias da falta ou processo de aferição..."
                        value={valeObservacao}
                        onChange={(e) => setValeObservacao(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition leading-normal"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        let colabName = (valeColaboradorName || '').trim();
                        let colabRole = valeColaboradorRole || 'MOTORISTA';

                        if (!colabName) {
                          if (!valeColaboradorId) {
                            alert('Erro: Informe o nome do 1º colaborador responsável.');
                            return;
                          }
                          const foundDriver = drivers.find(d => d.id === valeColaboradorId);
                          if (foundDriver) {
                            colabName = foundDriver.name;
                          } else {
                            const foundSysUser = (users || DEFAULT_USERS).find(u => u.id === valeColaboradorId);
                            if (foundSysUser) {
                              colabName = foundSysUser.name;
                              colabRole = foundSysUser.role === 'conferente' ? 'CONFERENTE' : 'AUXILIAR';
                            } else {
                              colabName = 'Colaborador Responsável';
                            }
                          }
                        }

                        if (!valeValeValor || Number(valeValeValor) <= 0) {
                          alert('Erro: Insira um valor válido maior que zero.');
                          return;
                        }
                        if (!valeDescricao.trim()) {
                          alert('Erro: Insira o motivo/descrição do desvio.');
                          return;
                        }

                        const validColabs = valeColaboradoresAdicionais
                          .filter(c => c && c.name && c.name.trim().length > 0)
                          .map(c => ({
                            id: c.id || 'colab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                            name: c.name.trim(),
                            role: c.role || 'AJUDANTE',
                            valor: c.valor && Number(c.valor) > 0 ? Number(c.valor) : undefined,
                            cpf: c.cpf
                          }));

                        const totalVal = Number(valeValeValor);
                        const totalColabs = 1 + validColabs.length;
                        const shares = calculateRateioShares(totalVal, totalColabs);

                        const colab1FinalValor = valeColaboradorValor !== undefined && valeColaboradorValor > 0
                          ? valeColaboradorValor
                          : shares[0];

                        const finalAdicionais = validColabs.map((c, i) => ({
                          ...c,
                          valor: c.valor !== undefined && c.valor > 0 ? c.valor : shares[i + 1]
                        }));

                        const matchedAuditForNew = (audits || []).find(a => 
                          (valeAssociatedInfo?.auditId && a.id === valeAssociatedInfo.auditId) ||
                          (valeRouteMap && (a.routeMap || '').trim().toUpperCase() === valeRouteMap.trim().toUpperCase())
                        );

                        const novo: Vale = {
                          id: 'val_' + Date.now(),
                          auditId: valeAssociatedInfo?.auditId || matchedAuditForNew?.id,
                          routeMap: valeRouteMap || 'AVULSO',
                          colaboradorId: valeColaboradorId || 'colab_principal',
                          colaboradorName: colabName,
                          colaboradorRole: colabRole,
                          colaboradorValor: colab1FinalValor,
                          valor: totalVal,
                          quantidade: valeQuantidade ? Number(valeQuantidade) : undefined,
                          colaboradoresAdicionais: finalAdicionais.length > 0 ? finalAdicionais : undefined,
                          descricao: valeDescricao.trim(),
                          dataGeracao: new Date().toISOString().split('T')[0],
                          status: 'PENDENTE_ASSINATURA' as const,
                          observacao: valeObservacao.trim() || 'Sem observações adicionais.'
                        };

                        onSaveVales([...vales, novo]);
                        setViewingVale(novo);
                        
                        // Limpar form
                        setValeColaboradorId('');
                        setValeColaboradorName('');
                        setValeColaboradorRole('MOTORISTA');
                        setValeColaboradorValor(undefined);
                        setValeQuantidadeColaboradores(1);
                        setValeRouteMap('');
                        setValeValeValor('');
                        setValeQuantidade('');
                        setValeDescricao('');
                        setValeObservacao('');
                        setValeColaboradoresAdicionais([]);
                        setValeAssociatedInfo(null);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2.5 rounded-lg transition shadow-xs cursor-pointer text-center uppercase"
                    >
                      Registrar e Emitir Vale
                    </button>
                  </div>
                </div>

                {/* List of generated vales (Right) */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
                  {/* Mapas com Falta Identificada na Auditoria Aguardando Emissão */}
                  {mapsWithShortagesList.filter(m => !m.alreadyHasVale).length > 0 && (
                    <div className="bg-amber-50/60 rounded-xl border border-amber-200 p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <h4 className="font-sans font-bold text-xs text-amber-950 uppercase tracking-wide">
                            Mapas com Falta Identificada ({mapsWithShortagesList.filter(m => !m.alreadyHasVale).length} Pendente{mapsWithShortagesList.filter(m => !m.alreadyHasVale).length > 1 ? 's' : ''})
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-amber-700 font-mono">
                          Informações carregadas automaticamente
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                        {mapsWithShortagesList.filter(m => !m.alreadyHasVale).map((m) => (
                          <div
                            key={`card_${m.routeMap}`}
                            className="bg-white p-3 rounded-lg border border-amber-200/80 shadow-2xs hover:border-amber-400 transition flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-slate-900">
                                  Mapa {m.routeMap}
                                </span>
                                <span className="text-[10px] font-extrabold text-amber-800 font-mono">
                                  R$ {m.totalShortageValue.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-700 font-medium truncate mt-0.5">
                                {m.driverName} • Placa {m.plate}
                              </p>
                              <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                {m.description}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setValeMapMode('lista');
                                setValeRouteMap(m.routeMap);
                                inspectAndAssociateMap(m.routeMap, true);
                              }}
                              className="w-full text-center py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Emitir Vale Deste Mapa</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs min-w-0">
                    <h3 className="font-sans font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between font-bold">
                      <span className="flex items-center space-x-1.5">
                        <FileText className="h-4 w-4 text-slate-600" />
                        <span>Histórico Geral de Vales Emitidos</span>
                      </span>
                      <span className="text-xxs bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded font-black">
                        Total: {vales.length} Vales
                      </span>
                    </h3>

                  {vales.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs italic">
                      Nenhum vale emitido no sistema até o momento.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-150 text-[10px] text-slate-400 font-bold uppercase tracking-wider font-sans bg-slate-50/55">
                            <th className="py-2.5 px-3">Responsável</th>
                            <th className="py-2.5 px-3">Descrição / Motivo</th>
                            <th className="py-2.5 px-3">Mapa</th>
                            <th className="py-2.5 px-3 text-right">Valor</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {vales.map((vale) => (
                            <tr key={vale.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 px-3 font-medium">
                                <span className="block font-bold text-slate-900">{vale.colaboradorName}</span>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="text-[9px] text-slate-400 font-mono block uppercase">{vale.colaboradorRole}</span>
                                  {vale.colaboradoresAdicionais && vale.colaboradoresAdicionais.length > 0 && (
                                    <span className="bg-amber-100 text-amber-800 text-[8.5px] font-bold px-1.5 py-0.2 rounded border border-amber-200" title={vale.colaboradoresAdicionais.map(c => `${c.name} (${c.role})`).join(', ')}>
                                      +{vale.colaboradoresAdicionais.length} co-responsável{vale.colaboradoresAdicionais.length > 1 ? 'is' : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-800 font-medium line-clamp-1">{vale.descricao}</span>
                                  {vale.quantidade !== undefined && vale.quantidade > 0 && (
                                    <span className="bg-slate-100 text-slate-700 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border border-slate-200">
                                      {vale.quantidade} vol.
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block">Emitido: {new Date(vale.dataGeracao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                              </td>
                              <td className="py-3 px-3 font-mono text-[10px]">
                                {vale.routeMap !== 'AVULSO' ? `Mapa ${vale.routeMap}` : 'AVULSO'}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                                R$ {(Number(vale.valor) || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                                  vale.status === 'COMPENSADO'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : vale.status === 'ASSINADO'
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                }`}>
                                  {vale.status === 'PENDENTE_ASSINATURA' ? 'Pendente Assinatura' : vale.status === 'ASSINADO' ? 'Termo Assinado' : 'Compensado Fin.'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex justify-center items-center gap-1.5">
                                  {/* Botão de Visualizar Termo */}
                                  <button
                                    type="button"
                                    onClick={() => setViewingVale(vale)}
                                    className="p-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer transition"
                                    title="Visualizar Termo de Autorização de Desconto"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Botão de Editar Vale */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const count = 1 + (vale.colaboradoresAdicionais?.length || 0);
                                      const shares = calculateRateioShares(Number(vale.valor) || 0, count);
                                      setEditingVale({
                                        ...vale,
                                        colaboradorValor: vale.colaboradorValor !== undefined ? vale.colaboradorValor : shares[0],
                                        colaboradoresAdicionais: (vale.colaboradoresAdicionais || []).map((c, i) => ({
                                          ...c,
                                          valor: c.valor !== undefined ? c.valor : shares[i + 1]
                                        }))
                                      });
                                    }}
                                    className="p-1 text-amber-600 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded cursor-pointer transition"
                                    title="Editar Vale (Alterar quantidade, valor, colaboradores ou descrição)"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  {vale.status === 'PENDENTE_ASSINATURA' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUploadingValeId(vale.id);
                                      }}
                                      className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[9px] rounded transition uppercase cursor-pointer"
                                      title="Importar vale assinado manualmente (PDF ou JPG)"
                                    >
                                      Assinar
                                    </button>
                                  )}

                                  {/* O gestor pode compensar qualquer vale ativo (pendente ou assinado) ao faturar no fim do mês */}
                                  {(vale.status === 'ASSINADO' || (vale.status === 'PENDENTE_ASSINATURA' && currentUser.role === 'gestor')) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        requestConfirm(
                                          'Confirmar Compensação',
                                          `Tem certeza de que deseja faturar e marcar este vale no valor de R$ ${(Number(vale.valor) || 0).toFixed(2)} para ${vale.colaboradorName} como COMPENSADO?`,
                                          () => {
                                            const updated = vales.map(v => v.id === vale.id ? { ...v, status: 'COMPENSADO' as const } : v);
                                            onSaveVales?.(updated);
                                          }
                                        );
                                      }}
                                      className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[9px] rounded transition uppercase cursor-pointer"
                                      title="Marcar como Compensado no Financeiro"
                                    >
                                      Compensar
                                    </button>
                                  )}

                                  {/* Botão de download do PDF assinado */}
                                  {(vale.status === 'ASSINADO' || vale.status === 'COMPENSADO') && vale.signedPdfUrl && (
                                    <a
                                      href={vale.signedPdfUrl}
                                      download={vale.signedPdfName || `vale_assinado_${vale.id}.pdf`}
                                      className="p-1 text-emerald-600 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded cursor-pointer transition flex items-center justify-center"
                                      title={`Baixar PDF Assinado: ${vale.signedPdfName || 'PDF'}`}
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </a>
                                  )}

                                  {/* Deletar Vale */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      requestConfirm(
                                        'Excluir Vale',
                                        `Deseja realmente excluir este vale no valor de R$ ${(Number(vale.valor) || 0).toFixed(2)} para ${vale.colaboradorName}?`,
                                        () => {
                                          const updated = vales.filter(v => v.id !== vale.id);
                                          onSaveVales(updated);
                                        }
                                      );
                                    }}
                                    className="p-1 text-red-600 hover:text-red-950 hover:bg-red-50 rounded cursor-pointer transition"
                                    title="Excluir Vale"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Modal de Importação de PDF Assinado */}
              {uploadingValeId && (() => {
                const valeToUpload = vales.find(v => v.id === uploadingValeId);
                if (!valeToUpload) return null;

                return (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h4 className="font-sans font-black text-sm text-slate-900 uppercase tracking-wide">Importar Vale Assinado (PDF/Imagem)</h4>
                        <button
                          type="button"
                          onClick={() => setUploadingValeId(null)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xxs space-y-1.5 text-slate-700">
                          <div><strong>Colaborador:</strong> {valeToUpload.colaboradorName}</div>
                          <div><strong>Valor:</strong> R$ {valeToUpload.valor.toFixed(2)}</div>
                          <div><strong>Descrição:</strong> {valeToUpload.descricao}</div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Selecionar Arquivo PDF ou Imagem Escaneada</label>
                          <div className="border-2 border-dashed border-slate-250 hover:border-amber-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50 transition relative">
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                const reader = new FileReader();
                                reader.onload = () => {
                                  const dataUrl = reader.result as string;
                                  // Update the vale status to ASSINADO and save the file data
                                  const updated = vales.map(v => 
                                    v.id === valeToUpload.id 
                                      ? { ...v, status: 'ASSINADO' as const, signedPdfUrl: dataUrl, signedPdfName: file.name } 
                                      : v
                                  );
                                  onSaveVales(updated);
                                  setUploadingValeId(null);
                                  alert('Vale assinado com sucesso! O arquivo PDF foi anexado.');
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <div className="space-y-2 text-slate-600">
                              <Plus className="h-8 w-8 text-slate-400 mx-auto" />
                              <div className="text-xxs font-semibold">
                                <span className="text-amber-600 font-bold underline">Clique para selecionar</span> ou arraste o arquivo aqui
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">Suporta PDF, PNG, JPG (Max 15MB)</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setUploadingValeId(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-lg cursor-pointer transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* PDF Recibo Timbrado Termo de Vale Modal */}
              {viewingVale && (() => {
                const associatedAudit = audits.find(a => a.id === viewingVale.auditId || a.routeMap === viewingVale.routeMap);
                const vehiclePlate = associatedAudit?.plate || 'Não cadastrada';
                const arrivalDateFormatted = associatedAudit?.arrivalDate 
                  ? new Date(associatedAudit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR') 
                  : new Date(viewingVale.dataGeracao + 'T00:00:00').toLocaleDateString('pt-BR');
                const helperName = associatedAudit?.helperId ? getHelperName(associatedAudit.helperId) : 'N/A';
                const usersList = DEFAULT_USERS;
                const foundUser = usersList.find(u => u.id === associatedAudit?.conferenteId || u.username === associatedAudit?.conferenteId);
                const conferenteName = foundUser 
                  ? foundUser.name 
                  : (associatedAudit?.conferenteId 
                      ? (associatedAudit.conferenteId === 'conferente_01' ? 'João Conferente' : associatedAudit.conferenteId === 'conferente_02' ? 'Pedro Ajudante' : associatedAudit.conferenteId) 
                      : 'N/A');

                // Calculate detailed shortages/deficits for this audit (PA/AG)
                const detailedShortages: Array<{ code: string; name: string; expected: number; found: number; comodato: number; recolha: number; diff: number; cost: number; totalCost: number }> = [];

                if (associatedAudit) {
                  associatedAudit.items.forEach(i => {
                    const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : (i.physicalQty ?? 0);
                    const fisc = i.fiscalQty ?? 0;
                    const comodato = i.comodatoQty ?? 0;
                    const recolha = i.recolhaQty ?? 0;
                    const netDiff = (phys + comodato - recolha) - fisc;
                    if (netDiff < 0) {
                      const diff = Math.abs(netDiff);
                      const unitCost = getSkuClosedPrice(i.productCode, i.cost ?? 45.0);
                      detailedShortages.push({
                        code: i.productCode,
                        name: i.productDescription || 'Produto Sem Descrição',
                        expected: fisc,
                        found: phys,
                        comodato,
                        recolha,
                        diff,
                        cost: unitCost,
                        totalCost: diff * unitCost
                      });
                    }
                  });

                  associatedAudit.assets.forEach(a => {
                    const idLower = (a.assetId || '').toLowerCase();
                    const nameUpper = (a.assetName || '').toUpperCase();
                    const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                    if (isChapatex) return;

                    const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : (a.physicalQty ?? 0);
                    const fisc = a.fiscalQty ?? 0;
                    const comodato = a.comodatoQty ?? 0;
                    const recolha = a.recolhaQty ?? 0;
                    const netDiff = (phys + comodato - recolha) - fisc;
                    if (netDiff < 0) {
                      const diff = Math.abs(netDiff);
                      const unitCost = a.cost ?? 18.0;
                      detailedShortages.push({
                        code: a.assetId,
                        name: a.assetName || 'Ativo Sem Descrição',
                        expected: fisc,
                        found: phys,
                        comodato,
                        recolha,
                        diff,
                        cost: unitCost,
                        totalCost: diff * unitCost
                      });
                    }
                  });
                }

                return (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-250 max-w-4xl w-full max-h-[95vh] overflow-y-auto flex flex-col">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-950 text-white">
                        <span className="font-sans font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Recibo Termo de Autorização de Desconto (Modelo Oficial Ampliado)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewingVale(null)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Printable Receipt Sheet */}
                      <div className="p-6 md:p-8 space-y-5 flex-1 text-slate-800 bg-white" id="print-area">
                        {/* Logo & Timbre */}
                        <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-3 gap-3">
                          <div>
                            <span className="font-sans font-black text-xl text-slate-900 uppercase tracking-tight block">PAU BRASIL DISTRIBUIDORA LTDA</span>
                            <span className="text-xs text-slate-500 block uppercase font-mono tracking-wider mt-0.5">Logística de Retorno & Aferição Física • Unidade Guarabira/PB</span>
                            <span className="text-xs text-amber-700 block font-bold uppercase mt-1">Termo Oficial de Autorização de Desconto em Folha</span>
                          </div>
                          <div className="bg-slate-50 px-4 py-2 rounded-lg border border-slate-200 text-right shrink-0">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">VALE FINANCEIRO Nº</span>
                            <span className="font-mono text-lg font-black text-red-600 block">{viewingVale.id}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">Emissão: {new Date(viewingVale.dataGeracao + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        {/* Title Banner */}
                        <div className="text-center py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <h4 className="font-sans font-black text-sm uppercase tracking-wider text-slate-900">AUTORIZAÇÃO DE DESCONTO EM FOLHA DE PAGAMENTO</h4>
                          <span className="text-xxs font-mono text-slate-500 font-semibold block mt-0.5">Fundamentação Legal: Artigo 462, § 1º da CLT</span>
                        </div>

                        {/* Main Statement */}
                        <p className="text-xs sm:text-sm leading-relaxed text-justify bg-amber-50/60 p-4 rounded-xl border border-amber-200 text-slate-900">
                          Eu, <strong>{viewingVale.colaboradorName}</strong>, registrado sob o papel de <strong>{viewingVale.colaboradorRole}</strong>
                          {viewingVale.colaboradoresAdicionais && viewingVale.colaboradoresAdicionais.length > 0 && (
                            <span> em conjunto com o(s) colaborador(es) co-responsável(is) {(viewingVale.colaboradoresAdicionais || []).map((c, i) => (
                              <strong key={i}> {c.name} ({c.role}{c.valor ? ` - R$ ${(Number(c.valor) || 0).toFixed(2)}` : ''})</strong>
                            ))}</span>
                          )}, autorizo(amos) expressamente a empresa <strong>PAU BRASIL DISTRIBUIDORA LTDA</strong> a descontar em folha de pagamento a importância líquida de <strong>R$ {(Number(viewingVale.valor) || 0).toFixed(2)}</strong> ({Number(viewingVale.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}), referente aos desvios físicos ou avarias constatados no retorno do <strong>{viewingVale.routeMap !== 'AVULSO' ? `Mapa de Carga nº ${viewingVale.routeMap}` : 'Mapa de Carga Avulso'}</strong>.
                        </p>

                        {/* Informações sobre a Rota e Equipe (Colaboradores Envolvidos) */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6 text-xs sm:text-sm">
                          <div className="space-y-1.5">
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block border-b border-slate-200 pb-1">Informações da Rota / Transporte</span>
                            <div><strong>Mapa de Carga:</strong> <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold ml-1">{viewingVale.routeMap}</span></div>
                            <div><strong>Placa do Veículo:</strong> <span className="font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded font-bold uppercase ml-1">{vehiclePlate}</span></div>
                            <div><strong>Data da Viagem:</strong> <span className="text-slate-700 ml-1">{arrivalDateFormatted}</span></div>
                            <div><strong>Volumes / Quantidade:</strong> <span className="font-bold text-slate-900 ml-1">{viewingVale.quantidade !== undefined ? `${viewingVale.quantidade} volumes/itens` : (detailedShortages.length > 0 ? `${detailedShortages.reduce((s, d) => s + d.diff, 0)} volumes/itens` : 'Conforme laudo')}</span></div>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block border-b border-slate-200 pb-1">Colaboradores da Operação & Aferição</span>
                            <div><strong>Responsável Principal:</strong> <span className="font-semibold text-slate-900 ml-1">{viewingVale.colaboradorName} ({viewingVale.colaboradorRole}{viewingVale.colaboradorValor ? ` - Cota: R$ ${(Number(viewingVale.colaboradorValor) || 0).toFixed(2)}` : ''})</span></div>
                            {viewingVale.colaboradoresAdicionais && viewingVale.colaboradoresAdicionais.length > 0 ? (
                              <div><strong>Co-responsáveis:</strong> <span className="text-slate-700 ml-1">{viewingVale.colaboradoresAdicionais.map(c => `${c.name} (${c.role}${c.valor ? ` - Cota: R$ ${(Number(c.valor) || 0).toFixed(2)}` : ''})`).join(', ')}</span></div>
                            ) : (
                              <div><strong>Ajudante de Rota:</strong> <span className="text-slate-700 ml-1">{helperName}</span></div>
                            )}
                            <div><strong>Conferente de Pátio:</strong> <span className="text-slate-700 ml-1">{conferenteName}</span></div>
                            <div><strong>Fiscal de Logística:</strong> <span className="font-semibold text-slate-900 ml-1">{currentUser.name}</span></div>
                          </div>
                        </div>

                        {/* Detail Table of Involved Assets & Shortages */}
                        <div className="space-y-2">
                          <span className="text-slate-900 font-bold text-xs uppercase tracking-wider block">Divergências de Inventário Constatadas (Faltas de P.A / A.G):</span>
                          
                          {detailedShortages.length > 0 ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs font-sans shadow-2xs">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Cód.</th>
                                    <th className="py-2 px-3">Descrição</th>
                                    <th className="py-2 px-3 text-center">Faturado</th>
                                    <th className="py-2 px-3 text-center">Conferido</th>
                                    <th className="py-2 px-3 text-center text-amber-600">Comodato</th>
                                    <th className="py-2 px-3 text-center text-red-600">Falta</th>
                                    <th className="py-2 px-3 text-right">Unit.</th>
                                    <th className="py-2 px-3 text-right">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-800 text-xs">
                                  {detailedShortages.slice(0, 5).map(item => (
                                    <tr key={item.code} className="hover:bg-slate-50">
                                      <td className="py-2 px-3 font-mono font-bold text-slate-600">{item.code}</td>
                                      <td className="py-2 px-3 font-medium truncate max-w-[200px]">{item.name}</td>
                                      <td className="py-2 px-3 text-center font-mono">{item.expected}</td>
                                      <td className="py-2 px-3 text-center font-mono">{item.found}</td>
                                      <td className="py-2 px-3 text-center font-mono font-bold text-amber-600">{item.comodato > 0 ? item.comodato : '-'}</td>
                                      <td className="py-2 px-3 text-center font-mono text-red-600 font-bold">-{item.diff}</td>
                                      <td className="py-2 px-3 text-right font-mono">R$ {(Number(item.cost) || 0).toFixed(2)}</td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">R$ {(Number(item.totalCost) || 0).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                  {detailedShortages.length > 5 && (
                                    <tr className="bg-slate-50 text-[10px] italic text-slate-500">
                                      <td colSpan={5} className="py-2 px-3">+ {detailedShortages.length - 5} outros itens detalhados no sistema de conferência</td>
                                      <td className="py-2 px-3 text-center font-mono font-bold text-red-600">-{detailedShortages.slice(5).reduce((s, d) => s + d.diff, 0)}</td>
                                      <td className="py-2 px-3 text-right">---</td>
                                      <td className="py-2 px-3 text-right font-mono font-bold">R$ {detailedShortages.slice(5).reduce((s, d) => s + (Number(d.totalCost) || 0), 0).toFixed(2)}</td>
                                    </tr>
                                  )}
                                  <tr className="bg-slate-100 font-bold text-slate-900 text-xs border-t-2 border-slate-300">
                                    <td colSpan={5} className="py-2 px-3 text-right uppercase">Total Descontado:</td>
                                    <td className="py-2 px-3 text-center font-mono text-red-600 font-black">-{detailedShortages.reduce((sum, d) => sum + d.diff, 0)} vol</td>
                                    <td colSpan={2} className="py-2 px-3 text-right font-mono font-black text-red-600 text-sm">R$ {(Number(viewingVale.valor) || 0).toFixed(2)}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl p-4 text-xs sm:text-sm text-slate-700 space-y-1.5 bg-slate-50 leading-relaxed">
                              <div><strong>Detalhamento dos Itens / Avarias:</strong> <span className="font-semibold text-slate-900 ml-1">{viewingVale.descricao}</span></div>
                              <div className="text-xs text-slate-500 font-mono">Valor Total de Desconto: <strong className="text-slate-900">R$ {(Number(viewingVale.valor) || 0).toFixed(2)}</strong></div>
                            </div>
                          )}
                        </div>

                        {viewingVale.observacao && (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs italic text-slate-600 font-sans">
                            <strong>Observações e Notas:</strong> {viewingVale.observacao}
                          </div>
                        )}

                        <p className="text-[10px] text-slate-500 leading-relaxed text-justify font-sans">
                          O desconto acima autorizado decorre de procedimento de aferição física no retorno de rota e expressa a concordância do colaborador com a reposição do prejuízo constatado, em estrita conformidade com o Artigo 462, § 1º da CLT e com as normas regulamentares internas de guarda e responsabilidade patrimonial da Pau Brasil Distribuidora Ltda.
                        </p>

                        {/* Signatures */}
                        {(() => {
                          const additional = viewingVale.colaboradoresAdicionais || [];
                          const totalCount = 1 + additional.length;
                          const calculatedShares = calculateRateioShares(Number(viewingVale.valor) || 0, totalCount);
                          const principalShare = viewingVale.colaboradorValor !== undefined && viewingVale.colaboradorValor > 0 
                            ? viewingVale.colaboradorValor 
                            : calculatedShares[0];

                          return (
                            <div className={`grid ${additional.length > 0 ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' : 'grid-cols-3'} gap-6 pt-6 text-center text-xs`}>
                              <div className="space-y-1.5 flex flex-col items-center">
                                <div className="border-b-2 border-slate-400 w-11/12 mt-6" />
                                <span className="font-bold text-slate-900 block truncate max-w-full">{viewingVale.colaboradorName}</span>
                                <span className="text-[9.5px] text-slate-500 block uppercase font-mono">{viewingVale.colaboradorRole} (Principal)</span>
                                <div className="mt-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded px-2.5 py-1 text-[11px] font-mono font-black shadow-3xs">
                                  Valor Rateado: R$ {principalShare.toFixed(2)}
                                </div>
                              </div>
                              {additional.map((c, i) => {
                                const helperShare = c.valor !== undefined && c.valor > 0 ? c.valor : (calculatedShares[i + 1] ?? 0);
                                return (
                                  <div key={i} className="space-y-1.5 flex flex-col items-center">
                                    <div className="border-b-2 border-slate-400 w-11/12 mt-6" />
                                    <span className="font-bold text-slate-900 block truncate max-w-full">{c.name}</span>
                                    <span className="text-[9.5px] text-slate-500 block uppercase font-mono">
                                      {c.role} {additional.length > 1 ? `(${i + 1}º Ajudante)` : ''}
                                    </span>
                                    <div className="mt-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded px-2.5 py-1 text-[11px] font-mono font-black shadow-3xs">
                                      Valor Rateado: R$ {helperShare.toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })}
                              <div className="space-y-1.5 flex flex-col items-center">
                                <div className="border-b-2 border-slate-400 w-11/12 mt-6" />
                                <span className="font-bold text-slate-900 block truncate max-w-full">{currentUser.name}</span>
                                <span className="text-[9.5px] text-slate-500 block uppercase font-mono font-bold">Fiscal de Logística</span>
                                <div className="mt-1 bg-slate-100 text-slate-600 border border-slate-200 rounded px-2 py-0.5 text-[10px] font-sans font-medium">
                                  Emissor / Aferição
                                </div>
                              </div>
                              <div className="space-y-1.5 flex flex-col items-center">
                                <div className="border-b-2 border-slate-400 w-11/12 mt-6" />
                                <span className="font-bold text-slate-900 block truncate max-w-full">Elisson Minervino</span>
                                <span className="text-[9.5px] text-slate-500 block uppercase font-mono font-bold">Gestor de Logística</span>
                                <div className="mt-1 bg-slate-100 text-slate-600 border border-slate-200 rounded px-2 py-0.5 text-[10px] font-sans font-medium">
                                  Autorização Gerencial
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Modal Footer buttons */}
                      <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap justify-between items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const count = 1 + (viewingVale.colaboradoresAdicionais?.length || 0);
                            const shares = calculateRateioShares(Number(viewingVale.valor) || 0, count);
                            setEditingVale({
                              ...viewingVale,
                              colaboradorValor: viewingVale.colaboradorValor !== undefined ? viewingVale.colaboradorValor : shares[0],
                              colaboradoresAdicionais: (viewingVale.colaboradoresAdicionais || []).map((c, i) => ({
                                ...c,
                                valor: c.valor !== undefined ? c.valor : shares[i + 1]
                              }))
                            });
                          }}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs py-2 px-3.5 rounded-lg cursor-pointer transition shadow-xs flex items-center gap-1.5"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-amber-700" />
                          <span>Editar Este Vale</span>
                        </button>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handlePrintVale(viewingVale)}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs py-2 px-4 rounded-lg cursor-pointer transition shadow-xs font-bold flex items-center gap-1.5"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Imprimir / Salvar PDF (1 Página)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewingVale(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-lg cursor-pointer transition"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Modal de Edição de Vale Emitido */}
              {editingVale && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-2">
                        <Edit3 className="h-5 w-5 text-amber-600" />
                        <div>
                          <h4 className="font-sans font-black text-sm text-slate-900 uppercase tracking-wide">
                            Editar Vale de Desconto #{editingVale.id}
                          </h4>
                          <p className="text-[10px] text-slate-400">
                            Modifique quantidades, valores, informações de mapa ou adicione colaboradores co-responsáveis.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingVale(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Linha 1: Status, Rota/Mapa e Data */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Status do Vale</label>
                          <select
                            value={editingVale.status}
                            onChange={(e) => setEditingVale({ ...editingVale, status: e.target.value as any })}
                            className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-bold"
                          >
                            <option value="PENDENTE_ASSINATURA">Pendente Assinatura</option>
                            <option value="ASSINADO">Termo Assinado</option>
                            <option value="COMPENSADO">Compensado Financeiro</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Mapa / Rota</label>
                          <input
                            type="text"
                            value={editingVale.routeMap || ''}
                            onChange={(e) => setEditingVale({ ...editingVale, routeMap: e.target.value.toUpperCase() })}
                            placeholder="Ex: 108, ROTA-04"
                            className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-mono uppercase font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase">Data de Emissão</label>
                          <input
                            type="date"
                            value={editingVale.dataGeracao}
                            onChange={(e) => setEditingVale({ ...editingVale, dataGeracao: e.target.value })}
                            className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg font-mono"
                          />
                        </div>
                      </div>

                      {/* Linha 2: Quantidade e Valor */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-amber-900 uppercase">
                            Valor Total do Desconto (R$) *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editingVale.valor}
                              onChange={(e) => handleEditingValorChange(Number(e.target.value))}
                              className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-amber-900 uppercase">
                            Quantidade de Volumes / Itens em Falta
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Ex: 3 volumes"
                            value={editingVale.quantidade ?? ''}
                            onChange={(e) => setEditingVale({ ...editingVale, quantidade: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg font-mono font-bold text-slate-900"
                          />
                        </div>
                      </div>

                      {/* Seção: Equipe Envolvida no Vale & Rateio Automático */}
                      <div className="space-y-2.5 pt-2.5 border-t border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <label className="text-[10px] font-bold text-slate-800 uppercase font-sans flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-amber-600" />
                              <span>Quantidade de Colaboradores Envolvidos:</span>
                            </label>
                            <p className="text-[9px] text-slate-500">
                              Quantas pessoas compartilham o desvio. Os campos e o rateio do valor abrem automaticamente.
                            </p>
                          </div>

                          {/* Botoes rápidos de quantidade */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {[1, 2, 3, 4, 5, 6].map((num) => {
                              const currentCount = 1 + (editingVale.colaboradoresAdicionais || []).length;
                              const isSelected = currentCount === num;
                              return (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => handleSetEditingNumColaboradores(num)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-0.5 ${
                                    isSelected
                                      ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400 font-black'
                                      : 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <span>{num} {num === 1 ? 'Pessoa' : 'Pessoas'}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Banner Informativo de Rateio do Valor em Tempo Real */}
                        {Number(editingVale.valor) > 0 && (() => {
                          const totalVal = Number(editingVale.valor);
                          const currentCount = 1 + (editingVale.colaboradoresAdicionais || []).length;
                          const shares = calculateRateioShares(totalVal, currentCount);
                          const percent = (100 / currentCount).toFixed(1);
                          return (
                            <div className="bg-amber-100/70 border border-amber-300 rounded-lg p-2 flex flex-wrap items-center justify-between gap-1 text-xxs text-amber-950 font-sans">
                              <div className="flex items-center gap-1.5">
                                <Calculator className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                <div>
                                  <span className="font-bold">Rateio Automático: </span>
                                  <span className="font-mono font-black text-amber-900">
                                    R$ {totalVal.toFixed(2)}
                                  </span>
                                  <span className="text-slate-600"> ÷ </span>
                                  <span className="font-bold">
                                    {currentCount} {currentCount === 1 ? 'colaborador' : 'colaboradores'}
                                  </span>
                                  <span className="text-slate-600"> = </span>
                                  <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-300">
                                    R$ {shares[0].toFixed(2)}
                                  </span>
                                  <span className="text-[9.5px] text-slate-600 ml-1">
                                    ({percent}% para cada)
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSetEditingNumColaboradores(currentCount)}
                                className="text-[9px] bg-amber-200/80 hover:bg-amber-300 text-amber-900 px-1.5 py-0.5 rounded border border-amber-400 font-bold cursor-pointer transition shadow-3xs"
                                title="Recalcular divisão igualitária"
                              >
                                ↻ Recalcular Divisão
                              </button>
                            </div>
                          );
                        })()}

                        {/* Slots de Colaboradores: Abertos exatamente conforme a quantidade selecionada */}
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {/* 1º Colaborador (Responsável Principal) */}
                          {(() => {
                            const totalVal = Number(editingVale.valor) || 0;
                            const currentCount = 1 + (editingVale.colaboradoresAdicionais || []).length;
                            const shares = calculateRateioShares(totalVal, currentCount);
                            const colab1Cota = editingVale.colaboradorValor !== undefined ? editingVale.colaboradorValor : shares[0];
                            return (
                              <div className="p-2.5 rounded-lg border-2 border-amber-300 bg-white text-xxs transition-all shadow-3xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[9.5px] uppercase tracking-wide flex items-center gap-1 text-slate-800">
                                    <span>👤 1º Colaborador (Responsável Principal)</span>
                                    <span className="bg-amber-100 text-amber-900 text-[8px] font-bold px-1 rounded">Principal</span>
                                  </span>
                                  <span className="text-emerald-800 text-[9px] font-mono font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">
                                    Cota: R$ {colab1Cota.toFixed(2)}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[8px] font-bold text-slate-500 uppercase">Buscar Cadastrado</label>
                                  <select
                                    value={editingVale.colaboradorId && (drivers.some(d => d.id === editingVale.colaboradorId) || (users || DEFAULT_USERS).some(u => u.id === editingVale.colaboradorId)) ? editingVale.colaboradorId : ''}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      if (!id) return;
                                      const d = drivers.find(drv => drv.id === id);
                                      if (d) {
                                        setEditingVale({
                                          ...editingVale,
                                          colaboradorId: d.id,
                                          colaboradorName: d.name,
                                          colaboradorRole: d.role === 'AJUDANTE' ? 'AJUDANTE' : 'MOTORISTA'
                                        });
                                      } else {
                                        const u = (users || DEFAULT_USERS).find(usr => usr.id === id);
                                        if (u) {
                                          setEditingVale({
                                            ...editingVale,
                                            colaboradorId: u.id,
                                            colaboradorName: u.name,
                                            colaboradorRole: u.role === 'conferente' ? 'CONFERENTE' : 'AUXILIAR'
                                          });
                                        }
                                      }
                                    }}
                                    className="w-full text-xxs p-1.5 bg-slate-50 border border-slate-200 rounded font-medium"
                                  >
                                    <option value="">Selecione da lista cadastrada...</option>
                                    <optgroup label="Motoristas">
                                      {drivers.filter(d => d.role === 'MOTORISTA').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} (Motorista)</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Ajudantes Cadastrados">
                                      {drivers.filter(d => d.role === 'AJUDANTE').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} (Ajudante)</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Equipe Operacional">
                                      {(users || DEFAULT_USERS).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role.toUpperCase()})</option>
                                      ))}
                                    </optgroup>
                                  </select>

                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-0.5">
                                    <div className="sm:col-span-5">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Nome *</label>
                                      <input
                                        type="text"
                                        placeholder="Nome do colaborador principal..."
                                        value={editingVale.colaboradorName}
                                        onChange={(e) => setEditingVale({ ...editingVale, colaboradorName: e.target.value })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                      />
                                    </div>
                                    <div className="sm:col-span-4">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Cargo / Função *</label>
                                      <select
                                        value={editingVale.colaboradorRole}
                                        onChange={(e) => setEditingVale({ ...editingVale, colaboradorRole: e.target.value })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                      >
                                        <option value="MOTORISTA">🚚 Motorista</option>
                                        <option value="AJUDANTE">📦 Ajudante</option>
                                        <option value="CONFERENTE">📋 Conferente</option>
                                        <option value="AUXILIAR">⚙️ Auxiliar</option>
                                        <option value="OUTRO">Outro</option>
                                      </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Cota (R$)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={colab1Cota}
                                        onChange={(e) => setEditingVale({ ...editingVale, colaboradorValor: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-mono font-bold text-emerald-800"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Colaboradores Adicionais (2º, 3º, etc. exatamente conforme a quantidade selecionada) */}
                          {(editingVale.colaboradoresAdicionais || []).map((helper, idx) => {
                            const helperNumber = idx + 2;
                            const totalVal = Number(editingVale.valor) || 0;
                            const currentCount = 1 + (editingVale.colaboradoresAdicionais || []).length;
                            const shares = calculateRateioShares(totalVal, currentCount);
                            const currentCota = helper.valor !== undefined ? helper.valor : shares[idx + 1];
                            return (
                              <div
                                key={helper.id || idx}
                                className="p-2.5 rounded-lg border border-amber-300 bg-amber-50/60 text-xxs transition-all shadow-3xs space-y-1.5 animate-fade-in"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[9.5px] uppercase tracking-wide flex items-center gap-1 text-slate-800">
                                    <span>👤 {helperNumber}º Colaborador (Co-responsável)</span>
                                    <span className="bg-amber-200/80 text-amber-900 text-[8px] font-bold px-1 rounded">Rateio Ativo</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-800 text-[9px] font-mono font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-300">
                                      Cota: R$ {currentCota.toFixed(2)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleClearEditingHelper(idx)}
                                      className="text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[8.5px]"
                                      title={`Remover ${helperNumber}º Colaborador`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>Remover</span>
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[8px] font-bold text-slate-500 uppercase">Buscar Cadastrado</label>
                                  <select
                                    value={helper?.id && drivers.some(d => d.id === helper.id) ? helper.id : ''}
                                    onChange={(e) => {
                                      const selectedId = e.target.value;
                                      if (!selectedId) return;
                                      const d = drivers.find(drv => drv.id === selectedId);
                                      if (d) {
                                        handleUpdateEditingHelper(idx, {
                                          id: d.id,
                                          name: d.name,
                                          role: d.role === 'MOTORISTA' ? 'MOTORISTA' : 'AJUDANTE'
                                        });
                                      } else {
                                        const u = (users || DEFAULT_USERS).find(usr => usr.id === selectedId);
                                        if (u) {
                                          handleUpdateEditingHelper(idx, {
                                            id: u.id,
                                            name: u.name,
                                            role: u.role === 'conferente' ? 'CONFERENTE' : 'AUXILIAR'
                                          });
                                        }
                                      }
                                    }}
                                    className="w-full text-xxs p-1.5 bg-white border border-slate-200 rounded font-medium"
                                  >
                                    <option value="">Selecione da lista cadastrada...</option>
                                    <optgroup label="Ajudantes Cadastrados">
                                      {drivers.filter(d => d.role === 'AJUDANTE').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} (Ajudante)</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Motoristas">
                                      {drivers.filter(d => d.role === 'MOTORISTA').map(d => (
                                        <option key={d.id} value={d.id}>{d.name} (Motorista)</option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Equipe Operacional">
                                      {(users || DEFAULT_USERS).map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role.toUpperCase()})</option>
                                      ))}
                                    </optgroup>
                                  </select>

                                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 pt-0.5">
                                    <div className="sm:col-span-5">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Nome *</label>
                                      <input
                                        type="text"
                                        placeholder={`Nome do ${helperNumber}º colaborador...`}
                                        value={helper?.name || ''}
                                        onChange={(e) => handleUpdateEditingHelper(idx, { name: e.target.value })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                      />
                                    </div>
                                    <div className="sm:col-span-4">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Cargo / Função *</label>
                                      <select
                                        value={helper?.role || 'AJUDANTE'}
                                        onChange={(e) => handleUpdateEditingHelper(idx, { role: e.target.value })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-bold text-slate-900"
                                      >
                                        <option value="AJUDANTE">📦 Ajudante</option>
                                        <option value="MOTORISTA">🚚 Motorista</option>
                                        <option value="CONFERENTE">📋 Conferente</option>
                                        <option value="AUXILIAR">⚙️ Auxiliar</option>
                                        <option value="OUTRO">Outro</option>
                                      </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                      <label className="block text-[8px] font-bold text-slate-500 uppercase">Cota (R$)</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={currentCota}
                                        onChange={(e) => handleUpdateEditingHelper(idx, { valor: e.target.value === '' ? undefined : Number(e.target.value) })}
                                        className="w-full text-xxs p-1 bg-white border border-slate-300 rounded font-mono font-bold text-emerald-800"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Linha 5: Descrição e Observação */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Motivo / Descrição da Falta *</label>
                        <input
                          type="text"
                          value={editingVale.descricao}
                          onChange={(e) => setEditingVale({ ...editingVale, descricao: e.target.value })}
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase">Observações Gerais</label>
                        <textarea
                          rows={2}
                          value={editingVale.observacao || ''}
                          onChange={(e) => setEditingVale({ ...editingVale, observacao: e.target.value })}
                          className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg leading-normal"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditingVale(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg cursor-pointer transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingVale.colaboradorName.trim()) {
                            alert('Erro: O nome do colaborador principal não pode ficar vazio.');
                            return;
                          }
                          if (!editingVale.valor || editingVale.valor <= 0) {
                            alert('Erro: O valor do vale deve ser maior que zero.');
                            return;
                          }
                          if (!editingVale.descricao.trim()) {
                            alert('Erro: A descrição da falta não pode ficar vazia.');
                            return;
                          }

                          const validColabs = (editingVale.colaboradoresAdicionais || [])
                            .filter(c => c && c.name && c.name.trim().length > 0)
                            .map(c => ({
                              id: c.id || 'colab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                              name: c.name.trim(),
                              role: c.role || 'AJUDANTE',
                              valor: c.valor && Number(c.valor) > 0 ? Number(c.valor) : undefined,
                              cpf: c.cpf
                            }));

                          const totalColabs = 1 + validColabs.length;
                          const totalVal = Number(editingVale.valor) || 0;
                          const shares = calculateRateioShares(totalVal, totalColabs);

                          const colab1FinalValor = editingVale.colaboradorValor !== undefined && editingVale.colaboradorValor > 0
                            ? editingVale.colaboradorValor
                            : shares[0];

                          const finalAdicionais = validColabs.map((c, i) => ({
                            ...c,
                            valor: c.valor !== undefined && c.valor > 0 ? c.valor : shares[i + 1]
                          }));

                          const sanitizedVale: Vale = {
                            ...editingVale,
                            colaboradorValor: colab1FinalValor,
                            colaboradoresAdicionais: finalAdicionais.length > 0 ? finalAdicionais : undefined
                          };

                          const updated = vales.map(v => v.id === sanitizedVale.id ? sanitizedVale : v);
                          onSaveVales(updated);

                          if (viewingVale && viewingVale.id === sanitizedVale.id) {
                            setViewingVale(sanitizedVale);
                          }

                          setEditingVale(null);
                          alert('Vale de desconto atualizado com sucesso!');
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2 px-5 rounded-lg cursor-pointer transition shadow-xs uppercase"
                      >
                        Salvar Alterações do Vale
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section: Local de Evidências & Salvar Produção Diária */}
          {activeTab === 'pasta_evidencias' && (
            <div className="space-y-6 animate-fade-in" id="tab_pasta_evidencias">
              
              {/* Branded Header */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-slate-900">
                  <Folder className="h-6 w-6 text-amber-500" />
                  <h2 className="font-sans font-bold text-lg uppercase">Central de Arquivamento & Produção Diária</h2>
                </div>
                <p className="text-xs text-slate-500">
                  Gestão de arquivos físicos de auditoria, exportação de relatórios diários em PDF consolidando dados e evidências fotográficas, e orientações de diretório de rede.
                </p>
              </div>

              {/* Directory display container */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-sans font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center space-x-2">
                  <Folder className="h-4 w-4 text-slate-400" />
                  <span>Diretório da Rede Local para Arquivamento</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Todos os arquivos de produtividade gerados abaixo contendo os relatórios operacionais e as fotos de evidência devem ser copiados e armazenados nesta pasta do servidor da distribuidora (P:):
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="font-mono text-xs text-slate-800 break-all select-all font-bold">
                    P:\Guarabira\2026\04.LOGISTICA\ARMAZÉM\3.0 ACURACIDADE\3.1 PACOTE PREJUIZO\FALTAS EM ROTA\RETORNO DE ROTA
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText("P:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA");
                      alert("Caminho copiado para a área de transferência!");
                    }}
                    className="shrink-0 flex items-center space-x-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xxs rounded-lg transition cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copiar Caminho</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PDF Production Generation (Left) */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
                  <div className="space-y-1">
                    <h3 className="font-sans font-bold text-sm text-slate-900 flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <span>Salvar Produção Diária (Gerar PDFs Individuais por Mapa)</span>
                    </h3>
                    <p className="text-xxs text-slate-400">
                      Escolha uma data e clique para gerar PDFs com relatórios de conciliação, logs de histórico e fotos de evidências de todos os mapas finalizados no dia selecionado.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-end gap-4 p-4 bg-slate-50 border border-slate-150 rounded-xl">
                    <div className="space-y-1 w-full sm:w-auto">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Data da Produção</label>
                      <input
                        type="date"
                        value={dailyProductionDate}
                        onChange={(e) => setDailyProductionDate(e.target.value)}
                        className="w-full sm:w-48 text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-mono font-bold"
                      />
                    </div>
                    
                    <button
                      type="button"
                      disabled={exportingDailyProduction}
                      onClick={() => handleDownloadDailyProduction(dailyProductionDate)}
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs py-3 px-6 rounded-lg transition uppercase flex items-center justify-center space-x-2 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {exportingDailyProduction ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Gerando PDFs...</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" />
                          <span>Salvar Produção Diária</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2 text-xxs text-slate-700 leading-relaxed">
                    <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>COMO UTILIZAR A EXPORTAÇÃO DIÁRIA:</span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 font-medium">
                      <li>Selecione a data correspondente ao fechamento das rotas (ex: <strong className="font-mono">2026-07-05</strong>).</li>
                      <li>Clique em <strong className="text-amber-950">"Salvar Produção Diária"</strong> para rodar o script local de agregação de evidências.</li>
                      <li>A plataforma localizará todas as auditorias finalizadas naquela data, recuperará do IndexedDB/API as fotos, e gerará arquivos no padrão <strong className="font-mono">11111 - PLACA - DATA.pdf</strong>.</li>
                      <li>Copie os arquivos prontos e transfira para o diretório de rede mapeado acima.</li>
                    </ol>
                  </div>
                </div>

                {/* Firebase Storage Alert (Right Panel) */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs h-fit">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                    <h3 className="font-sans font-bold text-sm text-slate-900 uppercase">Alertas & Manutenção</h3>
                  </div>
                  
                  {/* Simulated Alert based on showMemoryWarning state */}
                  {showMemoryWarning && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3 animate-pulse">
                      <div className="flex items-start space-x-2.5">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="block text-xxs font-black text-red-800 uppercase font-sans tracking-wide">
                            AVISO DE CAPACIDADE DO BANCO
                          </span>
                          <span className="block text-xxs font-black text-slate-900 leading-normal uppercase text-red-700">
                            SALVAR PRODUTIVIDADE
                          </span>
                        </div>
                      </div>
                      <p className="text-xxs text-slate-700 leading-relaxed font-medium">
                        Atenção <strong>Auxiliar de Armazém / Logística</strong>: O armazenamento de evidências fotográficas no Firebase/IndexedDB atingiu <strong className="text-red-700 font-bold">94% da capacidade</strong>. Existe risco iminente de perda de dados.
                      </p>
                      <div className="pt-1 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadDailyProduction(dailyProductionDate)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] py-1.5 rounded-lg text-center uppercase transition cursor-pointer"
                        >
                          Salvar Agora
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowMemoryWarning(false)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] py-1.5 px-3 rounded-lg transition cursor-pointer"
                        >
                          Dispensar
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xxs text-slate-600 leading-normal">
                    <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>Status do Servidor:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xxs pt-1">
                      <div>Imagens Salvas:</div>
                      <div className="font-mono font-bold text-right text-slate-900">
                        {audits.reduce((sum, a) => sum + (a.refugos?.length || 0), 12)} fotos
                      </div>
                      <div>Uso de Disco:</div>
                      <div className={`font-mono font-bold text-right ${showMemoryWarning ? 'text-red-650' : 'text-slate-800'}`}>
                        {showMemoryWarning ? '94.2% (Crítico)' : '35.4% (Normal)'}
                      </div>
                    </div>
                    {!showMemoryWarning && (
                      <button
                        type="button"
                        onClick={() => setShowMemoryWarning(true)}
                        className="mt-2 w-full border border-slate-300 hover:border-slate-400 text-slate-600 font-bold py-1 px-2 rounded text-[9px] uppercase transition cursor-pointer text-center"
                      >
                        Simular Alerta de Armazenamento
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pasta Compartilhada Explorer */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs mt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <FolderOpen className="h-5 w-5 text-amber-600" />
                      <h3 className="font-sans font-bold text-sm text-slate-900 uppercase">
                        Pasta Compartilhada de Rede (Mapas Arquivados)
                      </h3>
                    </div>
                    <p className="text-xxs text-slate-500">
                      Diretório físico mapeado do servidor central para arquivamento dos relatórios PDF de conciliação.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSharedPdfs}
                    disabled={loadingSharedPdfs}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xxs uppercase rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingSharedPdfs ? 'animate-spin' : ''}`} />
                    <span>Atualizar Lista</span>
                  </button>
                </div>

                {loadingSharedPdfs ? (
                  <div className="py-8 text-center text-xs text-slate-500 font-medium">
                    Carregando arquivos da rede...
                  </div>
                ) : sharedPdfs.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-medium">
                    Nenhum arquivo PDF de conciliação foi encontrado na pasta de rede ainda.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 text-xxs uppercase font-bold border-b border-slate-200">
                          <th className="py-2 px-3">Nome do Arquivo</th>
                          <th className="py-2 px-3">Diretório (Ano/Mês)</th>
                          <th className="py-2 px-3">Tamanho</th>
                          <th className="py-2 px-3">Gravado Em</th>
                          <th className="py-2 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-600">
                        {sharedPdfs.map((file, idx) => {
                          const sizeKb = (file.size / 1024).toFixed(1);
                          const mtimeStr = new Date(file.mtime).toLocaleString('pt-BR');
                          const dirName = file.path.substring(0, file.path.lastIndexOf('/')) || 'Raiz';
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 font-bold text-slate-800 flex items-center space-x-1.5">
                                <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                <span>{file.name}</span>
                              </td>
                              <td className="py-2 px-3">{dirName}</td>
                              <td className="py-2 px-3">{sizeKb} KB</td>
                              <td className="py-2 px-3">{mtimeStr}</td>
                              <td className="py-2 px-3 text-right">
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-md text-[10px] uppercase transition"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Ver / Baixar</span>
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* WORKSPACE MODE: ACTIVE RECONCILIATION FOR SELECTED SESSION */
        <div className="space-y-6" id="workspace_fiscal_panel">
          
          {(() => {
            const currentInAudits = audits.find(a => a.id === activeSession.id);
            const hasConflict = currentInAudits &&
                                currentInAudits.updatedAt &&
                                loadedSessionTime &&
                                currentInAudits.updatedAt !== loadedSessionTime &&
                                currentInAudits.lastUpdatedBy !== currentUser.name;

            if (hasConflict) {
              return (
                <div className="bg-amber-500/15 border-l-4 border-amber-500 rounded-xl p-4 text-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md animate-fade-in animate-pulse-slow" id="concurrency_conflict_banner_fiscal">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0 animate-bounce" />
                    <div>
                      <strong className="text-amber-900 block font-bold text-xs uppercase tracking-wide">⚠️ Atenção: Conflito de Edição de Rede</strong>
                      <p className="text-xxs text-slate-700 mt-0.5 font-sans leading-relaxed">
                        Este mapa de rota foi atualizado por <strong>{currentInAudits.lastUpdatedBy || 'outro usuário'}</strong> às <strong>{new Date(currentInAudits.updatedAt!).toLocaleTimeString()}</strong>. Para evitar que suas alterações locais de conciliação apaguem as dele, clique em "Sincronizar com a Rede" para carregar os dados mais recentes.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      // Construct a merged version with currentInAudits, preserving local values if possible
                      const mergedItems = currentInAudits.items.map(item => {
                        const localItem = activeSession.items.find(i => i.productCode === item.productCode);
                        return {
                          ...item,
                          fiscalQty: localItem && localItem.fiscalQty !== undefined ? localItem.fiscalQty : item.fiscalQty,
                          comodatoQty: localItem && localItem.comodatoQty !== undefined ? localItem.comodatoQty : item.comodatoQty,
                          recolhaQty: localItem && localItem.recolhaQty !== undefined ? localItem.recolhaQty : item.recolhaQty
                        };
                      });

                      const mergedAssets = currentInAudits.assets.map(asset => {
                        const localAsset = activeSession.assets.find(a => a.assetId === asset.assetId);
                        return {
                          ...asset,
                          fiscalQty: localAsset && localAsset.fiscalQty !== undefined ? localAsset.fiscalQty : asset.fiscalQty,
                          comodatoQty: localAsset && localAsset.comodatoQty !== undefined ? localAsset.comodatoQty : asset.comodatoQty,
                          recolhaQty: localAsset && localAsset.recolhaQty !== undefined ? localAsset.recolhaQty : asset.recolhaQty
                        };
                      });

                      const mergedSession: AuditSession = {
                        ...currentInAudits,
                        items: mergedItems,
                        assets: mergedAssets
                      };

                      setActiveSession(mergedSession);
                      setLoadedSessionTime(currentInAudits.updatedAt);
                    }}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase rounded-lg transition shrink-0 shadow-sm"
                  >
                    Sincronizar com a Rede
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Active Session Info */}
          <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center shadow-lg gap-4">
            <div className="space-y-1">
              <span className="text-xs text-amber-500 font-mono tracking-widest uppercase font-bold">
                ÁREA DE CONCILIAÇÃO FISCAL ATIVA
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-sans font-bold tracking-tight">
                  {activeSession.routeMap}
                </h2>
                <span className="bg-slate-800 text-slate-300 font-mono text-xs px-2.5 py-0.5 rounded border border-slate-700">
                  {activeSession.plate} {activeSession.exchangePlate ? `🔄 ${activeSession.exchangePlate}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleTogglePernoite({ routeMap: activeSession.routeMap, plate: activeSession.plate, isPernoite: activeSession.isPernoite });
                    setActiveSession(prev => prev ? ({ ...prev, isPernoite: !prev.isPernoite }) : null);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 border cursor-pointer ${
                    activeSession.isPernoite
                      ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-200 border-slate-700 hover:border-purple-500'
                  }`}
                  title={activeSession.isPernoite ? "Desmarcar pernoite (veículo volta para o indicador normal)" : "Marcar este veículo como pernoite"}
                >
                  <Moon className={`h-3.5 w-3.5 ${activeSession.isPernoite ? 'text-white fill-white' : 'text-slate-400'}`} />
                  <span>{activeSession.isPernoite ? '🌙 Pernoite Ativo' : '🌙 Marcar Pernoite'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4">
                <span><strong>Motorista:</strong> {getDriverName(activeSession.driverId)}</span>
                <span>•</span>
                <span><strong>Ajudante:</strong> {getHelperName(activeSession.helperId)}</span>
                <span>•</span>
                <span><strong>KM Chegada:</strong> {activeSession.arrivalKm}</span>
              </div>
            </div>

            <div className="bg-slate-800 px-4 py-2.5 rounded border border-slate-750 text-right">
              <span className="text-xxs text-slate-400 block uppercase">Tempo de Auditoria Física</span>
              <span className="font-mono text-sm font-bold text-amber-400">
                {getDurationText(activeSession.startTime, activeSession.endTime)}
              </span>
            </div>
          </div>

          {/* WARNING BANNER ABOUT MONITORAMENTO DISCREPANCY OBSERVATION */}
          {(() => {
            const observations: { map: string; obs: string }[] = [];
            if (activeSession.unifiedMaps && activeSession.unifiedMaps.length > 0) {
              activeSession.unifiedMaps.forEach(mapCode => {
                const r = importedRoutes.find(x => x.routeMap.toUpperCase() === mapCode.toUpperCase());
                if (r && r.discrepancyObservation) {
                  observations.push({ map: r.routeMap, obs: r.discrepancyObservation });
                }
              });
            } else {
              const r = importedRoutes.find(x => x.routeMap.toUpperCase() === activeSession.routeMap.toUpperCase());
              if (r && r.discrepancyObservation) {
                observations.push({ map: r.routeMap, obs: r.discrepancyObservation });
              }
            }

            if (observations.length > 0) {
              return (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 flex items-start space-x-3 text-red-950 animate-pulse shadow-md w-full">
                  <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 w-full">
                    <h4 className="font-sans font-black text-xs uppercase tracking-wide text-red-800 flex items-center space-x-1.5">
                      <span>⚠️ ALERTA DO MONITORAMENTO (GUIA DE OBSERVAÇÃO)</span>
                    </h4>
                    <p className="text-xs font-semibold">
                      O setor de Monitoramento mapeou e reportou divergências para as rotas unificadas:
                    </p>
                    <div className="space-y-1.5 mt-1.5">
                      {observations.map((item, idx) => {
                        const r = importedRoutes.find(x => x.routeMap.toUpperCase() === item.map.toUpperCase());
                        const routeObs = r?.routeObservations;
                        return (
                          <div key={idx} className="bg-white/95 p-3 rounded-xl border border-red-200 text-slate-800 space-y-2">
                            <div className="font-sans font-bold text-xs text-red-900 border-b border-red-100 pb-1 flex justify-between">
                              <span>Mapa {item.map}</span>
                            </div>
                            {routeObs && routeObs.length > 0 ? (
                              <div className="space-y-1.5">
                                {routeObs.map((o) => {
                                  const t = o.type || 'todos';
                                  return (
                                    <div key={o.id} className="bg-slate-50 p-2 rounded-lg border border-slate-150 flex items-start space-x-2 text-xxs">
                                      <div className="shrink-0 mt-0.5">
                                        {t === 'sobra' && <ArrowUpCircle className="h-4 w-4 text-emerald-600" />}
                                        {t === 'falta' && <ArrowDownCircle className="h-4 w-4 text-rose-600" />}
                                        {t === 'todos' && <AlertCircle className="h-4 w-4 text-slate-500" />}
                                      </div>
                                      <div className="space-y-0.5 flex-1">
                                        <div className="flex items-center space-x-1.5 font-sans font-extrabold text-[9px] text-slate-600 uppercase">
                                          <span>{o.author}</span>
                                          <span>•</span>
                                          <span>{o.timestamp}</span>
                                          {t === 'sobra' && <span className="text-[8px] px-1 bg-emerald-100 text-emerald-800 rounded font-bold">SOBRA</span>}
                                          {t === 'falta' && <span className="text-[8px] px-1 bg-rose-100 text-rose-800 rounded font-bold">FALTA</span>}
                                          {t === 'todos' && <span className="text-[8px] px-1 bg-slate-150 text-slate-700 rounded font-bold">GERAL</span>}
                                        </div>
                                        <p className="text-xxs font-medium font-sans text-slate-800 whitespace-pre-wrap leading-relaxed">{o.text}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="font-mono text-xs font-bold text-red-900 leading-normal pl-1">
                                "{item.obs}"
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-red-700 font-extrabold uppercase mt-1">
                      ATENÇÃO AUXILIAR DE LOGÍSTICA: Verifique se essas divergências de saldo foram tratadas antes de concluir e dar baixa!
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 w-full min-w-0">
            
            {/* Reconciliation Forms: Finished Products (PA) & Active Assets (AG) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6 min-w-0">
              
              {/* Finished Products Reconciliation */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-sans font-bold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center space-x-2">
                  <span className="bg-emerald-500 text-white text-xxs font-bold uppercase px-2 py-0.5 rounded-full">PA</span>
                  <span>Produtos Acabados - Conferência Cega vs Saldo Fiscal</span>
                </h3>

                {/* Formulário de Inserção Manual de Item de Saldo Fiscal */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 space-y-3" id="manual_rec_item_form">
                  <span className="text-xxs font-extrabold text-[#0f35a9] uppercase tracking-wider block">Inserir Item Manualmente na Conciliação</span>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-8 relative">
                      <label className="block text-xxs font-semibold text-slate-600 mb-1">Pesquisar por Código ou Descrição</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Digite o código ou nome do produto..."
                          value={recProductSearch}
                          onChange={(e) => {
                            setRecProductSearch(e.target.value);
                            setRecSelectedProductCode('');
                          }}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 pl-8 focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-950"
                        />
                        <Search className="absolute left-2.5 top-3.5 h-3.5 w-3.5 text-slate-400" />
                      </div>

                      {/* Autocomplete dropdown */}
                      {recProductSearch && !recSelectedProductCode && (
                        <div className="absolute z-20 left-0 right-0 bg-white border border-slate-200 rounded-b-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                          {recFilteredProducts.length === 0 ? (
                            <div className="p-3 text-xxs text-slate-400 text-center">Nenhum produto encontrado</div>
                          ) : (
                            recFilteredProducts.map(p => (
                              <button
                                type="button"
                                key={p.code}
                                onClick={() => handleSelectRecProduct(p)}
                                className="w-full text-left px-3 py-2 text-xxs hover:bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer text-slate-800 font-medium"
                              >
                                <span>{p.description}</span>
                                <span className="font-mono text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{p.code}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xxs font-semibold text-slate-600 mb-1">Saldo Fiscal</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={recProductFiscalQtyToAdd}
                        onChange={(e) => setRecProductFiscalQtyToAdd(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 text-center font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-950"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleManualAddProductToReconciliation}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center space-x-1 text-xs cursor-pointer shadow-sm transition"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  </div>
                </div>

                {(() => {
                  const visibleItems = activeSession.items.filter(item => {
                    const physical = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                    const hasPhysicalEntry = (physical > 0) || (item.rePhysicalQty !== undefined);
                    const hasFiscalEntry = (item.fiscalQty ?? 0) > 0;
                    return hasPhysicalEntry || hasFiscalEntry;
                  });

                  if (visibleItems.length === 0) {
                    return (
                      <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-400 text-xs">
                        Nenhum produto acabado lançado pelo conferente ou cadastrado no fiscal.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {[...visibleItems].sort((a, b) => {
                        const numA = Number(a.productCode);
                        const numB = Number(b.productCode);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.productCode.localeCompare(b.productCode);
                      }).map((item) => {
                      const physical = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                      const fiscal = item.fiscalQty ?? 0;
                      const comodato = item.comodatoQty ?? 0;
                      const recolha = item.recolhaQty ?? 0;
                      const diff = (physical + comodato - recolha) - fiscal;

                      let diffColor = 'text-emerald-800 bg-emerald-50 border-emerald-200';
                      let diffLabel = 'OK';
                      if (diff > 0) {
                        diffColor = 'text-amber-800 bg-amber-50 border-amber-200';
                        diffLabel = `+${diff} (Sobra)`;
                      } else if (diff < 0) {
                        diffColor = 'text-red-800 bg-red-50 border-red-200';
                        diffLabel = `${diff} (Falta)`;
                      }

                      const prodInfo = products.find(p => p.code === item.productCode);
                      const costValue = Number(prodInfo ? prodInfo.cost : item.cost) || 0;
                      const hectoValue = Number(prodInfo ? prodInfo.hectoFactor : 0.01) || 0.01;

                      return (
                        <div key={item.productCode} className="p-4 rounded-lg border border-slate-150 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-4 hover:bg-slate-50 transition">
                          <div className="space-y-1 sm:col-span-4">
                            <div>
                              <span className="font-mono text-xxs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-bold mr-1.5">{item.productCode}</span>
                              <span className="font-sans font-semibold text-slate-800 text-xs">{item.productDescription}</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-500 bg-slate-100/80 border border-slate-200/60 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                Custo: R$ {(costValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-slate-500 bg-slate-100/80 border border-slate-200/60 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                Hecto: {(hectoValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4 })} HL
                              </span>
                              {diff !== 0 && (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-150 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                  Custo Desvio: R$ {(Number(Math.abs(diff * costValue)) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              {diff !== 0 && (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                  Vol. Desvio: {(Number(Math.abs(diff) * hectoValue) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4 })} HL
                                </span>
                              )}
                            </div>

                            {item.rePhysicalQty !== undefined && (
                              <div className="text-xxs text-slate-400 pt-1">
                                Contagem original: <span className="line-through">{item.physicalQty}</span> • Recontado: <span className="font-semibold text-purple-600">{item.rePhysicalQty}</span>
                              </div>
                            )}

                            {/* Evidence Photos for this product */}
                            {activeSessionPhotos.filter(p => p.itemCode === item.productCode || p.itemCode === item.productDescription).length > 0 && (
                              <div className="mt-2 space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Fotos do Conferente:</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {activeSessionPhotos.filter(p => p.itemCode === item.productCode || p.itemCode === item.productDescription).map(p => (
                                    <div 
                                      key={p.id} 
                                      className="relative group bg-slate-100 rounded border border-slate-200 overflow-hidden w-12 h-12 flex-shrink-0 cursor-pointer" 
                                      onClick={() => setSelectedPhotoForPreview(p)}
                                    >
                                      <img src={p.photoUrl} alt={p.itemName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[7px] text-white">Ver</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-5 gap-2 sm:col-span-8 items-center text-center">
                            {/* Physical Display */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-400 block uppercase mb-1">FÍSICO</span>
                              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-200 px-2.5 py-1 rounded block w-full max-w-[80px] text-center">
                                {physical}
                              </span>
                            </div>

                            {/* Fiscal Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-500 block uppercase mb-1">SALDO FISCAL *</span>
                              <input
                                type="number"
                                min="0"
                                value={item.fiscalQty ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                  handleUpdateFiscalQty(item.productCode, val);
                                }}
                                className="w-16 text-xs text-center font-bold bg-white border border-slate-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Comodato Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-amber-600 block uppercase mb-1">COMODATO</span>
                              <input
                                type="number"
                                min="0"
                                value={item.comodatoQty ?? ''}
                                placeholder="0"
                                onChange={(e) => handleUpdateItemComodatoQty(item.productCode, Number(e.target.value) || 0)}
                                className="w-16 text-xs text-center font-bold bg-white border border-amber-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Recolha Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-blue-600 block uppercase mb-1">RECOLHA</span>
                              <input
                                type="number"
                                min="0"
                                value={item.recolhaQty ?? ''}
                                placeholder="0"
                                onChange={(e) => handleUpdateItemRecolhaQty(item.productCode, Number(e.target.value) || 0)}
                                className="w-16 text-xs text-center font-bold bg-white border border-blue-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Discrepancy Display */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-400 block uppercase mb-1">DIVERG.</span>
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border block leading-normal w-full max-w-[110px] text-center ${diffColor}`}>
                                {diffLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>

              {/* Active Circulation Assets Reconciliation */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-sans font-bold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center space-x-2">
                  <span className="bg-amber-500 text-slate-950 text-xxs font-bold uppercase px-2 py-0.5 rounded-full">AG</span>
                  <span>Ativos de Giro (Garrafeiras, Garrafas, Paletes)</span>
                </h3>

                <div className="space-y-4">
                  {(() => {
                    const sortedAssets = [...activeSession.assets].sort((a, b) => {
                      const codeA = getAssetCode(a.assetId, a.assetName);
                      const codeB = getAssetCode(b.assetId, b.assetName);
                      const numA = Number(codeA);
                      const numB = Number(codeB);
                      const isNumA = !isNaN(numA);
                      const isNumB = !isNaN(numB);
                      if (isNumA && isNumB) return numA - numB;
                      if (isNumA) return -1;
                      if (isNumB) return 1;
                      return codeA.localeCompare(codeB);
                    });
                    return sortedAssets.map((asset) => {
                      const physical = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
                      const fiscal = asset.fiscalQty ?? 0;
                      const comodato = asset.comodatoQty ?? 0;
                      const recolha = asset.recolhaQty ?? 0;
                      const diff = (physical + comodato - recolha) - fiscal;

                      let diffColor = 'text-emerald-800 bg-emerald-50 border-emerald-200';
                      let diffLabel = 'OK';
                      if (diff > 0) {
                        diffColor = 'text-amber-800 bg-amber-50 border-amber-200';
                        diffLabel = `+${diff} (Sobra)`;
                      } else if (diff < 0) {
                        diffColor = 'text-red-800 bg-red-50 border-red-200';
                        diffLabel = `${diff} (Falta)`;
                      }

                      const mappedCode = getAssetCode(asset.assetId, asset.assetName);
                      const canonicalName = getAssetCanonicalName(mappedCode) || asset.assetName;

                      return (
                        <div key={asset.assetId} className="p-4 rounded-lg border border-slate-150 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-12 sm:items-center gap-4 hover:bg-slate-50 transition">
                          <div className="space-y-1 sm:col-span-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {mappedCode && (
                                <span className="font-mono text-xxs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold">{mappedCode}</span>
                              )}
                              <span className="font-sans font-semibold text-slate-800 text-xs">{canonicalName}</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-500 bg-slate-100/80 border border-slate-200/60 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                Custo: R$ {(Number(asset.cost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              {diff !== 0 && (
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-150 px-1.5 py-0.5 rounded-md font-mono flex items-center">
                                  Custo Desvio: R$ {(Number(Math.abs(diff * (Number(asset.cost) || 0))) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>

                            {asset.rePhysicalQty !== undefined && (
                              <div className="text-xxs text-slate-400 pt-1">
                                Contagem original: <span className="line-through">{asset.physicalQty}</span> • Recontado: <span className="font-semibold text-purple-600">{asset.rePhysicalQty}</span>
                              </div>
                            )}

                            {/* Evidence Photos for this asset */}
                            {activeSessionPhotos.filter(p => p.itemCode === asset.assetId || p.itemCode === asset.assetName).length > 0 && (
                              <div className="mt-2 space-y-1 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="text-[9px] font-bold text-slate-500 uppercase block tracking-wider font-mono">Fotos do Conferente:</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {activeSessionPhotos.filter(p => p.itemCode === asset.assetId || p.itemCode === asset.assetName).map(p => (
                                    <div 
                                      key={p.id} 
                                      className="relative group bg-slate-100 rounded border border-slate-200 overflow-hidden w-12 h-12 flex-shrink-0 cursor-pointer" 
                                      onClick={() => setSelectedPhotoForPreview(p)}
                                    >
                                      <img src={p.photoUrl} alt={p.itemName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[7px] text-white">Ver</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-5 gap-2 sm:col-span-8 items-center text-center">
                            {/* Physical Display */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-400 block uppercase mb-1">FÍSICO</span>
                              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-200 px-2.5 py-1 rounded block w-full max-w-[80px] text-center">
                                {physical}
                              </span>
                            </div>

                            {/* Fiscal Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-500 block uppercase mb-1">SALDO FISCAL</span>
                              <input
                                type="number"
                                min="0"
                                value={asset.fiscalQty ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                  handleUpdateAssetFiscalQty(asset.assetId, val);
                                }}
                                className="w-16 text-xs text-center font-bold bg-white border border-slate-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Comodato Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-amber-600 block uppercase mb-1">COMODATO</span>
                              <input
                                type="number"
                                min="0"
                                value={asset.comodatoQty ?? ''}
                                placeholder="0"
                                onChange={(e) => handleUpdateAssetComodatoQty(asset.assetId, Number(e.target.value) || 0)}
                                className="w-16 text-xs text-center font-bold bg-white border border-amber-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Recolha Input */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-blue-600 block uppercase mb-1">RECOLHA</span>
                              <input
                                type="number"
                                min="0"
                                value={asset.recolhaQty ?? ''}
                                placeholder="0"
                                onChange={(e) => handleUpdateAssetRecolhaQty(asset.assetId, Number(e.target.value) || 0)}
                                className="w-16 text-xs text-center font-bold bg-white border border-blue-300 rounded p-1 focus:outline-none focus:ring-1 focus:ring-amber-500 mx-auto block"
                              />
                            </div>

                            {/* Discrepancy Display */}
                            <div className="flex flex-col items-center">
                              <span className="text-xxs font-bold text-slate-400 block uppercase mb-1">DIVERG.</span>
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border block leading-normal w-full max-w-[110px] text-center ${diffColor}`}>
                                {diffLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                  });
                })()}
                </div>
              </div>

              {/* Refugos dos Ativos de Giro Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-sans font-bold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center space-x-2">
                  <span className="bg-red-500 text-white text-xxs font-bold uppercase px-2 py-0.5 rounded-full">REFUGO</span>
                  <span>Refugos dos Ativos de Giro (Avariados em Rota)</span>
                </h3>

                {!activeSession.refugos || activeSession.refugos.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-400 text-xs">
                    Nenhum item de refugo lançado pelo conferente.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      O conferente registrou os seguintes refugos/avarias. Faça a aferição dos itens por imagem utilizando a foto em tempo real abaixo:
                    </p>
                    <div className="border border-slate-100 rounded-lg overflow-x-auto shadow-xs">
                      <table className="min-w-full divide-y divide-slate-100 text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider">Ativo</th>
                            <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider text-center">Quantidade</th>
                            <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider">Motivo da Avaria</th>
                            <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider text-center">Foto (Tempo Real)</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {activeSession.refugos.map((refugo) => (
                            <tr key={refugo.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5">
                                <span className="font-sans font-semibold text-slate-800 text-xs block">{refugo.assetName}</span>
                                <span className="font-mono text-[10px] text-slate-400">ID: {refugo.assetId}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center font-mono text-xs font-bold text-red-600 bg-red-50/20">
                                {refugo.qty}
                              </td>
                              <td className="px-4 py-2.5 text-xs font-medium text-slate-700">
                                <span className="inline-block bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-200">
                                  {refugo.reason}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {(() => {
                                  const displayPhotoUrl = refugo.photoId
                                    ? activeSessionPhotos.find(p => p.id === refugo.photoId)?.photoUrl
                                    : (refugo.photoUrl || activeSessionPhotos.find(p => p.itemCode === refugo.id || p.itemCode === refugo.assetId)?.photoUrl);
                                  return displayPhotoUrl ? (
                                    <div 
                                      className="relative inline-block w-12 h-12 rounded border border-slate-200 overflow-hidden bg-slate-100 shadow-3xs cursor-pointer group"
                                      onClick={() => setSelectedPhotoForPreview({
                                        id: refugo.id,
                                        auditId: activeSession.id,
                                        itemCode: refugo.assetId,
                                        itemName: `Refugo: ${refugo.assetName} (${refugo.reason})`,
                                        photoUrl: displayPhotoUrl,
                                        conferenteId: activeSession.conferenteId,
                                        driverId: activeSession.driverId,
                                        driverName: '',
                                        timestamp: new Date().toISOString(),
                                        type: 'refugo'
                                      })}
                                    >
                                      <img src={displayPhotoUrl} alt="Refugo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                      <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white">
                                        Ver
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Sem foto</span>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Trocas e Reposições de PA Card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-sans font-bold text-base text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center space-x-2">
                  <span className="bg-purple-600 text-white text-xxs font-bold uppercase px-2 py-0.5 rounded-full">TROCA</span>
                  <span>Trocas de PA</span>
                </h3>

                {!activeSession.exchanges || activeSession.exchanges.filter(e => e.type === 'TROCA').length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-400 text-xs">
                    Nenhuma troca registrada para esta rota.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Itens de troca (avariados que retornaram na rota) registrados pelo conferente:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2 border border-slate-100 rounded-lg overflow-x-auto shadow-xs bg-white">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider">PA Produto</th>
                              <th className="px-4 py-2 font-sans font-bold text-xxs text-slate-500 uppercase tracking-wider text-center w-24">Qtd</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-100">
                            {activeSession.exchanges
                              .filter(e => e.type === 'TROCA')
                              .map((item) => {
                                return (
                                  <tr key={item.productCode} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2.5">
                                      <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-1 py-0.5 rounded font-bold mr-2">{item.productCode}</span>
                                      <span className="font-sans font-semibold text-slate-800 text-xs">{item.productDescription}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-mono text-xs font-bold text-slate-700">
                                      {item.qty}
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>

                      <div className="border border-purple-100 rounded-xl bg-purple-50/20 p-4 space-y-2 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Evidência Fotográfica</span>
                          <h5 className="font-sans font-bold text-slate-800 text-xs mt-2">Trocas Reunidas</h5>
                          <p className="text-[10px] text-slate-500 mt-1">Foto única com todos os itens de troca agrupados juntos.</p>
                        </div>

                        {(() => {
                          // Try unified photo first, fallback to any troca_reposicao photo
                          const exPhoto = activeSessionPhotos.find(p => p.itemCode === 'TROCAS_REUNIDAS' && p.type === 'troca_reposicao') ||
                                          activeSessionPhotos.find(p => p.type === 'troca_reposicao');
                          return exPhoto ? (
                            <div className="mt-2 text-center">
                              <div 
                                className="relative inline-block w-full h-32 rounded-lg border border-purple-200 overflow-hidden bg-slate-100 shadow-sm cursor-pointer group mx-auto"
                                onClick={() => setSelectedPhotoForPreview(exPhoto)}
                                title="Clique para ampliar"
                              >
                                <img src={exPhoto.photoUrl} alt="Trocas Reunidas" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] text-white">
                                  <span>Visualizar Foto</span>
                                  <span className="text-[8px] opacity-75 mt-0.5">(Clique para ampliar)</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="border border-dashed border-purple-200 rounded-lg p-4 text-center text-slate-400 text-xs bg-white/50">
                              Sem foto de evidência
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT SIDEBAR: Actions & Impact Summary */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6 min-w-0">
              
              {/* Financial Balance Summary */}
              <div className="bg-slate-900 text-white rounded-xl shadow-md border border-slate-800 p-6">
                <h4 className="font-sans font-bold text-sm text-slate-200 border-b border-slate-800 pb-3 mb-4">
                  Resumo de Divergências
                </h4>

                {(() => {
                  const stats = getDiscrepancyTotals(activeSession);
                  const totalDiff = stats.missingCount + stats.surplusCount;
                  
                  return (
                    <div className="space-y-4">
                      {totalDiff === 0 ? (
                        <div className="bg-emerald-950/40 text-emerald-400 p-4 rounded-lg border border-emerald-800/50 text-center">
                          <ShieldCheck className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm font-semibold">Tudo em Perfeita Ordem!</p>
                          <p className="text-xxs text-slate-400 mt-1">Nenhuma divergência de saldo físico vs fiscal.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stats.missingCount > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Total Faltas (Perdas):</span>
                              <span className="text-red-400 font-bold font-mono">
                                {stats.missingCount} itens
                              </span>
                            </div>
                          )}

                          {stats.surplusCount > 0 && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-slate-400">Total Sobras (Sobrantes):</span>
                              <span className="text-amber-400 font-bold font-mono">
                                {stats.surplusCount} itens
                              </span>
                            </div>
                          )}

                          <div className="border-t border-slate-800 pt-3 mt-1 space-y-1">
                            {stats.missingCost > 0 && (
                              <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-slate-400">Impacto (Prejuízo):</span>
                                <span className="text-red-400 font-mono">
                                  -R$ {(Number(stats.missingCost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            {stats.surplusCost > 0 && (
                              <div className="flex justify-between items-center text-sm font-semibold">
                                <span className="text-slate-400">Sobrantes (Ajuste):</span>
                                <span className="text-amber-400 font-mono">
                                  +R$ {(Number(stats.surplusCost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ALL EVIDENCE PHOTOS BLOCK */}
              <div className="bg-slate-900 text-white rounded-xl shadow-md border border-slate-800 p-6 space-y-4">
                <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
                  <h4 className="font-sans font-bold text-sm text-slate-200">
                    Todas as Provas do Mapa
                  </h4>
                  <span className="text-[10px] bg-[#0f35a9] text-sky-200 px-2 py-0.5 rounded-full font-mono font-bold font-sans">
                    {activeSessionPhotos.length} fotos
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {activeSessionPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setSelectedPhotoForPreview(photo)}
                      className="relative group aspect-square bg-slate-800 border border-slate-700 rounded overflow-hidden cursor-pointer hover:border-amber-500 transition-all shadow-2xs"
                      title={`${photo.itemName || 'Sem descrição'}`}
                    >
                      <img src={photo.photoUrl} alt={photo.itemName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-sans text-center px-1">
                        Ver Prova
                      </div>
                    </div>
                  ))}
                  {activeSessionPhotos.length === 0 && (
                    <div className="col-span-4 text-center py-6 text-[10px] text-slate-500 italic">
                      Nenhuma foto vinculada a este mapa ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Operations */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
                <h4 className="font-sans font-bold text-sm text-slate-800">
                  Operações e Observações
                </h4>

                <div>
                  <label className="block text-xxs font-bold text-slate-500 uppercase mb-1">
                    Parecer de Conciliação / Notas *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Descreva observações ou razões para divergências/reconferência..."
                    value={reconciliationNotes}
                    onChange={(e) => setReconciliationNotes(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={isFinalizing}
                    onClick={handleFinalizeReconciliation}
                    className={`w-full text-white font-bold py-3 px-4 rounded-lg text-xs shadow-xs transition flex items-center justify-center space-x-2 ${
                      isFinalizing 
                        ? 'bg-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {isFinalizing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Processando Baixa & Gerando PDF...</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-4 w-4" />
                        <span>Concluir e Dar Baixa</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isFinalizing}
                    onClick={handleRequestReconferencia}
                    className={`w-full text-red-700 font-bold py-2.5 px-4 rounded-lg text-xs border border-red-200 transition flex items-center justify-center space-x-2 ${
                      isFinalizing 
                        ? 'bg-slate-100/50 text-slate-400 border-slate-200 cursor-not-allowed' 
                        : 'bg-red-50 hover:bg-red-100 cursor-pointer'
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
                    <span>Solicitar Reconferência Física</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Botão Flutuante da Calculadora de Garrafas */}
      <div className="fixed bottom-24 right-6 z-40 font-sans" id="bottle_calculator_fab_wrapper">
        <button
          type="button"
          id="btn_toggle_calculator"
          onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
          className={`flex items-center justify-center p-3.5 rounded-full shadow-lg border text-white transition-all hover:scale-105 active:scale-95 ${
            isCalculatorOpen
              ? 'bg-amber-600 border-amber-700 ring-2 ring-amber-500'
              : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700'
          }`}
          title="Calculadora de Garrafas"
        >
          <Calculator className="h-5 w-5" />
        </button>
      </div>

      {/* Janela Flutuante da Calculadora */}
      {isCalculatorOpen && (
        <div 
          id="bottle_calculator_window"
          className="fixed bottom-36 right-6 z-50 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl w-80 p-5 text-white animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center space-x-2 text-amber-400">
              <Calculator className="h-5 w-5" />
              <span className="font-sans font-bold text-sm uppercase tracking-wider">Calculadora de Garrafas</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCalculatorOpen(false)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Digite a quantidade de garrafeiras de cada tipo para obter a multiplicação automática por garrafas (600ml x24, 1L x12, 300ml x23).
            </p>

            {/* Garrafeira 600ml */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase block font-sans">Garrafeira 600ML (x24)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Qtd"
                  value={calc600}
                  onChange={(e) => setCalc600(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-bold shrink-0">➔</span>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-extrabold w-28 text-center shrink-0">
                  {calc600 !== '' ? calc600 * 24 : 0} <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">gf</span>
                </div>
              </div>
            </div>

            {/* Garrafeira 1L */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase block font-sans">Garrafeira 1 Litro (x12)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Qtd"
                  value={calc1L}
                  onChange={(e) => setCalc1L(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-bold shrink-0">➔</span>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-extrabold w-28 text-center shrink-0">
                  {calc1L !== '' ? calc1L * 12 : 0} <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">gf</span>
                </div>
              </div>
            </div>

            {/* Garrafeira 300ml */}
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase block font-sans">Garrafeira 300ML (x23)</label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Qtd"
                  value={calc300}
                  onChange={(e) => setCalc300(e.target.value === '' ? '' : Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-mono font-bold"
                />
                <span className="text-xs text-slate-400 font-bold shrink-0">➔</span>
                <div className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-amber-400 font-mono font-extrabold w-28 text-center shrink-0">
                  {calc300 !== '' ? calc300 * 23 : 0} <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">gf</span>
                </div>
              </div>
            </div>

            {/* Apply & Reset Buttons */}
            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setCalc600('');
                  setCalc1L('');
                  setCalc300('');
                }}
                className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 py-1.5 rounded-lg text-[10px] font-bold uppercase transition"
              >
                Limpar
              </button>
              {activeSession ? (
                <button
                  type="button"
                  onClick={() => {
                    const updatedAssets = activeSession.assets.map(asset => {
                      const code = getAssetCode(asset.assetId, asset.assetName);
                      let updatedFiscal = asset.fiscalQty;

                      // Apply 600ml calculations
                      if (calc600 !== '') {
                        if (code === '899599') {
                          updatedFiscal = Number(calc600);
                        } else if (code === '786238' || code === '27983') {
                          updatedFiscal = Number(calc600) * 24;
                        }
                      }

                      // Apply 1L calculations
                      if (calc1L !== '') {
                        if (code === '188005') {
                          updatedFiscal = Number(calc1L);
                        } else if (code === '188006') {
                          updatedFiscal = Number(calc1L) * 12;
                        }
                      }

                      // Apply 300ml calculations
                      if (calc300 !== '') {
                        if (code === '863059') {
                          updatedFiscal = Number(calc300);
                        } else if (code === '198214') {
                          updatedFiscal = Number(calc300) * 23;
                        }
                      }

                      return { ...asset, fiscalQty: updatedFiscal };
                    });
                    setActiveSession({ ...activeSession, assets: updatedAssets });
                    alert('Quantidades de todas as garrafeiras aplicadas com sucesso no saldo fiscal!');
                  }}
                  className="w-1/2 bg-amber-500 hover:bg-amber-600 text-slate-950 py-1.5 rounded-lg text-[10px] font-bold uppercase transition"
                >
                  Aplicar Saldo
                </button>
              ) : (
                <div className="w-1/2 text-center text-[9px] text-slate-500 py-1.5 font-sans">
                  Abra uma rota para aplicar
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal with Premium Zoom Controls */}
      {selectedPhotoForPreview && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="absolute top-4 right-4 flex items-center space-x-3 z-50">
            {/* Zoom controls */}
            <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-1 flex items-center space-x-1 shadow-lg text-white">
              <button
                type="button"
                onClick={() => setSelectedPhotoScale(s => Math.max(s - 0.25, 0.5))}
                className="p-1.5 hover:bg-slate-800 rounded font-bold text-sm h-8 w-8 flex items-center justify-center cursor-pointer transition"
                title="Zoom Out"
              >
                -
              </button>
              <span className="px-2 font-mono text-xs font-bold w-12 text-center">{Math.round(selectedPhotoScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setSelectedPhotoScale(s => Math.min(s + 0.25, 4))}
                className="p-1.5 hover:bg-slate-800 rounded font-bold text-sm h-8 w-8 flex items-center justify-center cursor-pointer transition"
                title="Zoom In"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setSelectedPhotoScale(1)}
                className="px-2 py-1 hover:bg-slate-800 rounded font-bold text-xs cursor-pointer transition"
                title="Reset Zoom"
              >
                1x
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPhotoForPreview(null); setSelectedPhotoScale(1); }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition cursor-pointer font-sans"
            >
              Fechar [X]
            </button>
          </div>

          {/* Zoomable Container */}
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 cursor-zoom-in">
            <div 
              className="transition-transform duration-100 ease-out flex items-center justify-center"
              style={{ transform: `scale(${selectedPhotoScale})` }}
            >
              <img
                src={selectedPhotoForPreview.photoUrl}
                alt={selectedPhotoForPreview.itemName}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-slate-800 bg-slate-950"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Bottom Metabar */}
          <div className="absolute bottom-4 left-4 right-4 bg-slate-950/85 border border-slate-800 text-white p-3.5 rounded-xl max-w-2xl mx-auto flex flex-col space-y-1.5 text-center font-sans">
            <div className="font-bold text-xs uppercase tracking-wider">{selectedPhotoForPreview.itemName || 'Evidência de Retorno'}</div>
            <div className="text-[10px] text-slate-400 font-mono">
              Código / Ativo: <span className="bg-slate-800 px-1.5 py-0.5 rounded font-bold text-white border border-slate-700">{selectedPhotoForPreview.itemCode}</span> 
              <span className="mx-2">|</span> 
              Categoria: <span className="uppercase text-slate-300">
                {selectedPhotoForPreview.type === 'produto' ? 'PA' : 
                 selectedPhotoForPreview.type === 'refugo' ? 'Refugo/Avaria' : 
                 selectedPhotoForPreview.type === 'troca_reposicao' ? 'Troca/Reposição' : 'AG'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" id="custom_confirm_modal_fiscal">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 animate-bounce" />
              </div>
              <h3 className="font-sans font-bold text-slate-950 text-sm">{confirmModal.title}</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.message}
            </p>
            
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xxs font-bold rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmCallbackRef.current) {
                    confirmCallbackRef.current();
                  }
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-[#0f35a9] hover:bg-[#0c2a86] text-white text-xxs font-bold rounded-lg transition shadow-3xs"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Reset Platform Modal (Avoids native prompt blocks in iframe) */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in" id="custom_reset_platform_modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-lg">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-slate-950 text-sm uppercase tracking-wide">Zerar Todos os Dados</h3>
                <p className="text-[10px] text-slate-400 font-medium">Ação de Segurança de Alta Categoria</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta ação irá deletar permanentemente todos os mapas importados, históricos de conferência, previsões de chegada, alertas e fotos registradas de sobras e avarias. <strong>Esta ação não pode ser desfeita.</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha Master de Segurança:</label>
                <input
                  type="password"
                  placeholder="Digite a senha master (ex: !Bud0102)"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetError('');
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
                />
              </div>

              {resetError && (
                <div className="text-[10px] text-red-600 font-bold bg-red-50 p-2 rounded border border-red-100 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xxs font-bold rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (resetPassword !== '!Bud0102') {
                    setResetError("Senha de segurança incorreta! Acesso não autorizado.");
                    return;
                  }
                  
                  // Run actual reset
                  onResetPlatformData(true);
                  setShowResetModal(false);
                  
                  // Show custom toast alert or custom dialog, here we use our alert framework or state
                  alert("Todos os dados operacionais foram reiniciados com sucesso!");
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-750 text-white text-xxs font-bold rounded-lg transition shadow-3xs hover:shadow-sm"
              >
                Autorizar e Zerar Banco
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup PDF Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 no-print" id="backup_pdf_modal">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-sans font-extrabold text-slate-900 text-lg uppercase tracking-tight">Exportação de Relatório & Backup de Histórico</h3>
                <p className="text-xs text-slate-500 mt-0.5">Filtre os dados por mês para exportar o arquivo em PDF com todas as evidências fotográficas antes do reset.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            {/* Filters bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-4 items-center">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Período (Mês):</span>
                <select
                  value={backupMonthFilter}
                  onChange={(e) => setBackupMonthFilter(e.target.value)}
                  className="text-xs p-1.5 bg-white border border-slate-200 rounded-md font-sans focus:outline-none"
                >
                  <option value="all">Todos os meses</option>
                  <option value="0">Janeiro</option>
                  <option value="1">Fevereiro</option>
                  <option value="2">Março</option>
                  <option value="3">Abril</option>
                  <option value="4">Maio</option>
                  <option value="5">Junho</option>
                  <option value="6">Julho</option>
                  <option value="7">Agosto</option>
                  <option value="8">Setembro</option>
                  <option value="9">Outubro</option>
                  <option value="10">Novembro</option>
                  <option value="11">Dezembro</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status:</span>
                <select
                  value={backupStatusFilter}
                  onChange={(e) => setBackupStatusFilter(e.target.value)}
                  className="text-xs p-1.5 bg-white border border-slate-200 rounded-md font-sans focus:outline-none"
                >
                  <option value="all">Todos os status</option>
                  <option value="ok">100% OK</option>
                  <option value="divergente">Divergentes</option>
                </select>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold uppercase rounded-lg transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>Gerar PDF / Imprimir</span>
                </button>
              </div>
            </div>

            {/* Scrollable Preview Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100" id="backup_preview_area">
              <p className="text-xxs text-slate-400 font-mono uppercase mb-3 text-center">Pré-visualização do Relatório Oficial (Estilo de Impressão A4)</p>

              {/* REPORT CONTAINER FOR PRINT */}
              <div id="backup-print-report" className="bg-white p-8 md:p-12 shadow-md max-w-4xl mx-auto space-y-12 text-slate-900 border border-slate-200">
                
                {/* CSS Injected specifically for print layout overrides */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #backup-print-report, #backup-print-report * {
                      visibility: visible;
                    }
                    #backup-print-report {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      box-shadow: none !important;
                      border: none !important;
                      padding: 0 !important;
                      margin: 0 !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                    .page-break {
                      page-break-before: always;
                      break-inside: avoid;
                    }
                    .break-inside-avoid {
                      break-inside: avoid;
                    }
                  }
                `}</style>

                {/* COVER PAGE */}
                <div className="border-4 border-slate-900 p-8 space-y-10 flex flex-col justify-between min-h-[650px]">
                  <div className="text-center space-y-4">
                    <span className="text-xs font-mono uppercase tracking-widest text-slate-500 block">Pau Brasil Distribuidora de Bebidas Ltda</span>
                    <h1 className="text-3xl font-sans font-extrabold tracking-tight text-slate-900 uppercase">Relatório Consolidado de Fechamento de Mapas</h1>
                    <div className="h-1 w-24 bg-red-600 mx-auto"></div>
                    <p className="text-xs text-slate-500 font-sans max-w-md mx-auto">
                      Backup oficial de auditoria, conciliação de ativos de giro, controles de refugo e evidências fotográficas.
                    </p>
                  </div>

                  {/* Summary Stats Table */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 text-center border-b border-slate-200 pb-2">Metadados e Estatísticas do Período</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Filtro de Período</span>
                        <strong className="text-slate-800 text-sm">
                          {backupMonthFilter === 'all' ? 'Todos os meses' : [
                            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                          ][parseInt(backupMonthFilter)]}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Status de Baixa</span>
                        <strong className="text-slate-800 text-sm">
                          {backupStatusFilter === 'all' ? 'Todos os status' : backupStatusFilter === 'ok' ? '100% OK' : 'Apenas Divergentes'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Total de Mapas Finalizados</span>
                        <strong className="text-slate-900 text-base font-mono">
                          {audits.filter(audit => {
                            const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                            if (!isCompleted) return false;
                            if (backupMonthFilter !== 'all') {
                              const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                              if (dateObj.getMonth().toString() !== backupMonthFilter) return false;
                            }
                            if (backupStatusFilter !== 'all') {
                              if (backupStatusFilter === 'ok' && audit.status !== 'finalizado_ok') return false;
                              if (backupStatusFilter === 'divergente' && audit.status !== 'finalizado_divergente') return false;
                            }
                            return true;
                          }).length} mapas
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Saldo OK / Divergente</span>
                        <strong className="text-slate-900 text-base font-mono">
                          {audits.filter(audit => {
                            const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                            if (!isCompleted) return false;
                            if (backupMonthFilter !== 'all') {
                              const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                              if (dateObj.getMonth().toString() !== backupMonthFilter) return false;
                            }
                            return audit.status === 'finalizado_ok';
                          }).length} OK / {audits.filter(audit => {
                            const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                            if (!isCompleted) return false;
                            if (backupMonthFilter !== 'all') {
                              const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                              if (dateObj.getMonth().toString() !== backupMonthFilter) return false;
                            }
                            return audit.status === 'finalizado_divergente';
                          }).length} DIV
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Apurado em</span>
                        <strong className="text-slate-700 font-mono">{new Date().toLocaleString('pt-BR')}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase font-mono text-[9px]">Responsável</span>
                        <strong className="text-slate-700">{currentUser.name} ({currentUser.role.toUpperCase()})</strong>
                      </div>
                    </div>
                  </div>

                  {/* Certificate Footer */}
                  <div className="space-y-6 pt-6 border-t border-slate-200 text-center">
                    <p className="text-[10px] text-slate-500 italic">
                      Este documento certifica a exportação completa de todo o banco de dados antes da rotina de limpeza e manutenção programada da plataforma. As assinaturas abaixo conferem autenticidade ao processo de acerto.
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="space-y-1">
                        <div className="border-t border-slate-300 pt-1.5 text-[9px] font-bold text-slate-600 uppercase">Conferente / Auxiliar</div>
                      </div>
                      <div className="space-y-1">
                        <div className="border-t border-slate-300 pt-1.5 text-[9px] font-bold text-slate-600 uppercase">Fiscal de Retorno</div>
                      </div>
                      <div className="space-y-1">
                        <div className="border-t border-slate-300 pt-1.5 text-[9px] font-bold text-slate-600 uppercase">Gestor de Logística</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* INDIVIDUAL MAP DETAILS */}
                {audits.filter(audit => {
                  const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                  if (!isCompleted) return false;

                  if (backupMonthFilter !== 'all') {
                    const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                    if (dateObj.getMonth().toString() !== backupMonthFilter) {
                      return false;
                    }
                  }

                  if (backupStatusFilter !== 'all') {
                    if (backupStatusFilter === 'ok' && audit.status !== 'finalizado_ok') return false;
                    if (backupStatusFilter === 'divergente' && audit.status !== 'finalizado_divergente') return false;
                  }

                  return true;
                }).map((audit, index) => {
                  const auditPhotos = backupPhotos.filter(p => p.auditId === audit.id);
                  const isOk = audit.status === 'finalizado_ok';
                  
                  const fmtDate = (iso?: string) => {
                    if (!iso) return 'N/A';
                    try {
                      const d = new Date(iso);
                      return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    } catch {
                      return iso;
                    }
                  };

                  return (
                    <div key={audit.id} className="page-break space-y-6 border-t-2 border-slate-300 pt-8">
                      {/* Map Header Block */}
                      <div className="flex justify-between items-start bg-slate-50 p-4 border border-slate-200 rounded-xl">
                        <div>
                          <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded font-mono">REGISTRO #{index + 1}</span>
                          <h2 className="font-sans font-extrabold text-xl tracking-tight text-slate-900 mt-1 uppercase">Mapa de Rota: {audit.routeMap}</h2>
                          <p className="text-xxs font-mono text-slate-500 mt-0.5">ID Único: {audit.id} • Placa: {audit.plate}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block text-[10px] font-bold uppercase px-3 py-1 rounded-full ${isOk ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                            {isOk ? '● 100% OK' : '● DIVERGENTE'}
                          </span>
                          <span className="block text-[10px] text-slate-500 mt-1">Status da Baixa</span>
                        </div>
                      </div>

                      {/* Map info grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-slate-100 pb-4">
                        <div>
                          <span className="text-slate-400 block uppercase font-mono text-[8px]">Condutor (Motorista)</span>
                          <strong className="text-slate-800">{drivers.find(d => d.id === audit.driverId)?.name || audit.driverId}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block uppercase font-mono text-[8px]">Ajudante</span>
                          <strong className="text-slate-800">{audit.helperId ? (drivers.find(d => d.id === audit.helperId)?.name || audit.helperId) : 'N/A'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block uppercase font-mono text-[8px]">Data de Entrada</span>
                          <strong className="text-slate-800 font-mono">{fmtDate(audit.arrivalDate)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 block uppercase font-mono text-[8px]">Data da Baixa</span>
                          <strong className="text-slate-800 font-mono">{fmtDate(audit.endTime)}</strong>
                        </div>
                      </div>

                      {/* Reconciliation Notes */}
                      {audit.reconciliationNotes && (
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-150 text-xs text-slate-800">
                          <span className="font-bold text-amber-900 block font-mono text-[10px] uppercase">Observações da Conciliação Fiscal:</span>
                          <p className="mt-0.5">{audit.reconciliationNotes}</p>
                        </div>
                      )}

                      {/* Product discrepancies table */}
                      <div className="space-y-2 break-inside-avoid">
                        <span className="text-[10px] font-bold text-slate-600 uppercase font-mono block font-sans">Detalhamento de Produtos (PAs)</span>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase border-b border-slate-200">
                                <th className="p-2">Código</th>
                                <th className="p-2">Produto</th>
                                <th className="p-2 text-right">Físico</th>
                                <th className="p-2 text-right">Fiscal</th>
                                <th className="p-2 text-right">Comodato</th>
                                <th className="p-2 text-right">Recolha</th>
                                <th className="p-2 text-right">Divergência</th>
                              </tr>
                            </thead>
                            <tbody>
                              {audit.items.map(item => {
                                const physical = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                                const fiscal = item.fiscalQty ?? 0;
                                const comodato = item.comodatoQty ?? 0;
                                const recolha = item.recolhaQty ?? 0;
                                const diff = (physical + comodato - recolha) - fiscal;
                                
                                return (
                                  <tr key={item.productCode} className="border-b border-slate-100 last:border-0">
                                    <td className="p-2 font-mono text-[10px] text-slate-500">{item.productCode}</td>
                                    <td className="p-2 font-medium text-slate-800">{products.find(p => p.code === item.productCode)?.description || item.productCode}</td>
                                    <td className="p-2 text-right font-mono">{physical}</td>
                                    <td className="p-2 text-right font-mono">{fiscal}</td>
                                    <td className="p-2 text-right font-mono">{comodato || '-'}</td>
                                    <td className="p-2 text-right font-mono">{recolha || '-'}</td>
                                    <td className={`p-2 text-right font-mono font-bold ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {diff === 0 ? '-' : diff > 0 ? `+${diff}` : diff}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Asset discrepancies table */}
                      <div className="space-y-2 break-inside-avoid">
                        <span className="text-[10px] font-bold text-slate-600 uppercase font-mono block font-sans">Conciliação de Ativos de Giro</span>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-mono text-[9px] uppercase border-b border-slate-200">
                              <th className="p-2">Ativo</th>
                              <th className="p-2 text-right">Físico</th>
                              <th className="p-2 text-right">Fiscal</th>
                              <th className="p-2 text-right">Comodato</th>
                              <th className="p-2 text-right">Recolha</th>
                              <th className="p-2 text-right">Saldo Final</th>
                            </tr>
                          </thead>
                          <tbody>
                            {audit.assets.map(asset => {
                              const physical = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
                              const fiscal = asset.fiscalQty ?? 0;
                              const comodato = asset.comodatoQty ?? 0;
                              const recolha = asset.recolhaQty ?? 0;
                              const diff = physical - fiscal + comodato - recolha;

                              const isChapatex = asset.assetId === 'chapatex' || 
                                                 asset.assetId?.toLowerCase() === 'chapatex' || 
                                                 asset.assetName?.toUpperCase().includes('CHAPATEX');

                              return (
                                <tr key={asset.assetId} className="border-b border-slate-100 last:border-0">
                                  <td className="p-2">
                                    <div className="font-medium text-slate-800 uppercase text-[11px]">{asset.assetName}</div>
                                    <div className="font-mono text-[9px] text-slate-400">{asset.assetId}</div>
                                  </td>
                                  <td className="p-2 text-right font-mono">{physical}</td>
                                  <td className="p-2 text-right font-mono">{fiscal}</td>
                                  <td className="p-2 text-right font-mono">{comodato}</td>
                                  <td className="p-2 text-right font-mono">{recolha}</td>
                                  <td className={`p-2 text-right font-mono font-bold ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {diff === 0 ? 'OK' : diff > 0 ? `Sobra +${diff}` : `Falta ${diff}`}
                                    {isChapatex && diff !== 0 && (
                                      <span className="block text-[8px] text-indigo-500 font-sans uppercase font-normal">* Tolerado (Chapatex)</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        </div>
                      </div>

                      {/* Blitz and Refugos Block */}
                      {(audit.blitzBoxesChecked !== undefined || (audit.refugos && audit.refugos.length > 0)) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 break-inside-avoid">
                          {/* Blitz info */}
                          {audit.blitzBoxesChecked !== undefined && (
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">⚡ Resultados da Blitz de Refugo</span>
                              <div className="text-xs space-y-1 font-sans">
                                <div>Status: <strong>Realizada com Sucesso</strong></div>
                                <div>Caixas vistoriadas: <strong className="font-mono">{audit.blitzBoxesChecked} cx</strong></div>
                                <div>Avarias / Refugos encontrados: <strong className="font-mono text-red-600">{audit.blitzAvariasFound || 0} un</strong></div>
                              </div>
                            </div>
                          )}

                          {/* Refugos list */}
                          {audit.refugos && audit.refugos.length > 0 && (
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-2">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono block">📋 Motivos de Refugos Registrados</span>
                              <div className="text-xs space-y-1 max-h-[120px] overflow-y-auto font-sans">
                                {audit.refugos.map((ref, idx) => (
                                  <div key={idx} className="flex justify-between border-b border-slate-100 last:border-0 pb-1 pt-1">
                                    <span className="text-slate-700">{ref.assetName} - <span className="font-bold uppercase text-[9px] text-slate-500">{ref.reason}</span></span>
                                    <strong className="font-mono text-red-600">{ref.qty} un</strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Photo evidence render */}
                      {auditPhotos.length > 0 ? (
                        <div className="space-y-3 break-inside-avoid">
                          <span className="text-[10px] font-bold text-slate-600 uppercase font-mono block">Evidências Fotográficas do Mapa ({auditPhotos.length})</span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {auditPhotos.map((photo) => (
                              <div key={photo.id} className="border border-slate-200 rounded-xl p-2 bg-white flex flex-col justify-between space-y-2">
                                <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative border border-slate-100">
                                  <img src={photo.photoUrl} alt="Evidência" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                </div>
                                <div className="text-[9px] leading-tight space-y-0.5 font-sans">
                                  <div className="font-bold text-slate-800 truncate">{photo.itemName}</div>
                                  <div className="text-slate-500 truncate">Categoria: {photo.type.toUpperCase()}</div>
                                  <div className="text-slate-400 font-mono text-[8px]">{fmtDate(photo.timestamp)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 break-inside-avoid border border-slate-200 rounded-xl p-4 bg-slate-50">
                          <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">Evidências Fotográficas (PA / AG / Refugos):</span>
                          <div className="flex items-start space-x-2.5">
                            <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg shrink-0 mt-0.5">
                              <Folder className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-slate-700 uppercase block font-sans">
                                Fotos Arquivadas no PDF Oficial
                              </span>
                              <p className="text-xxs text-slate-500 font-medium">
                                Para otimizar o banco de dados da plataforma, as evidências fotográficas foram limpas e estão consolidadas diretamente no PDF de controle gerado no momento do fechamento. O relatório contendo as fotos está salvo no diretório de rede compartilhado:
                              </p>
                              <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2.5 mt-1">
                                <span className="font-mono text-[9px] text-slate-600 select-all font-semibold">
                                  P:\Guarabira\2026\04.LOGISTICA\ARMAZÉM\3.0 ACURACIDADE\3.1 PACOTE PREJUIZO\FALTAS EM ROTA\RETORNO DE ROTA
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {audits.filter(audit => {
                  const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                  if (!isCompleted) return false;

                  if (backupMonthFilter !== 'all') {
                    const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                    if (dateObj.getMonth().toString() !== backupMonthFilter) {
                      return false;
                    }
                  }

                  if (backupStatusFilter !== 'all') {
                    if (backupStatusFilter === 'ok' && audit.status !== 'finalizado_ok') return false;
                    if (backupStatusFilter === 'divergente' && audit.status !== 'finalizado_divergente') return false;
                  }

                  return true;
                }).length === 0 && (
                  <div className="text-center py-20 text-slate-400 italic border border-dashed border-slate-200 rounded-2xl">
                    Nenhum registro de mapa encontrado para os filtros selecionados.
                  </div>
                )}

              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Total de mapas selecionados: <strong className="text-slate-900 font-mono">
                  {audits.filter(audit => {
                    const isCompleted = audit.status === 'finalizado_ok' || audit.status === 'finalizado_divergente';
                    if (!isCompleted) return false;

                    if (backupMonthFilter !== 'all') {
                      const dateObj = new Date(audit.arrivalDate || audit.endTime || Date.now());
                      if (dateObj.getMonth().toString() !== backupMonthFilter) {
                        return false;
                      }
                    }

                    if (backupStatusFilter !== 'all') {
                      if (backupStatusFilter === 'ok' && audit.status !== 'finalizado_ok') return false;
                      if (backupStatusFilter === 'divergente' && audit.status !== 'finalizado_divergente') return false;
                    }

                    return true;
                  }).length}
                </strong>
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBackupModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase rounded-lg transition"
                >
                  Fechar Visualização
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold uppercase rounded-lg transition shadow-sm flex items-center space-x-1 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL DIALOG COMPACTO PARA DETALHES DO PROCESSO */}
      {selectedHistoryAudit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="bg-amber-500 text-slate-950 p-1.5 rounded">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-sans font-extrabold text-sm sm:text-base leading-tight">
                    Detalhamento do Mapa {selectedHistoryAudit.routeMap}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Placa: {selectedHistoryAudit.plate} • Chegada: {new Date(selectedHistoryAudit.arrivalDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadSingleAuditPDF(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border border-red-500"
                  title="Baixar Relatório PDF Oficial deste Mapa"
                >
                  <FileText className="h-3.5 w-3.5 text-white" />
                  <span>Baixar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadSingleAuditExcel(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border border-emerald-500"
                  title="Baixar Planilha Excel deste Mapa"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
                  <span>Baixar Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadSingleAuditJSON(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer border border-indigo-500"
                  title="Baixar Arquivo JSON deste Mapa"
                >
                  <FileJson className="h-3.5 w-3.5 text-white" />
                  <span>Baixar JSON</span>
                </button>
                <button 
                  onClick={() => setSelectedHistoryAudit(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-1 px-2.5 rounded-lg transition text-xs font-bold font-mono border border-slate-700 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Motorista</span>
                  <span className="text-xs font-semibold text-slate-800 block truncate">{getDriverName(selectedHistoryAudit.driverId)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Ajudante</span>
                  <span className="text-xs font-semibold text-slate-800 block truncate">{getHelperName(selectedHistoryAudit.helperId)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Duração</span>
                  <span className="text-xs font-semibold text-slate-800 block font-mono">{getDurationText(selectedHistoryAudit.startTime, selectedHistoryAudit.endTime)}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Tempo em Rota</span>
                  {(() => {
                    const daysOnRoute = getDaysOnRoute(selectedHistoryAudit);
                    return (
                      <span className="text-xs font-bold text-amber-700 block font-sans">
                        {daysOnRoute !== null ? `${daysOnRoute} ${daysOnRoute === 1 ? 'dia' : 'dias'}` : 'N/A'}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase">Status Fiscal</span>
                  <span className={`text-[9px] font-bold uppercase block ${selectedHistoryAudit.status === 'finalizado_ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {selectedHistoryAudit.status === 'finalizado_ok' ? '● 100% OK' : '● Divergente'}
                  </span>
                </div>
              </div>

              {/* Products */}
              {selectedHistoryAudit.items && selectedHistoryAudit.items.filter(item => item.physicalQty > 0 || (item.rePhysicalQty !== undefined && item.rePhysicalQty > 0)).length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase block font-sans">
                    Produtos Acabados (PA)
                  </span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 font-mono text-[10px]">
                        <tr>
                          <th className="p-2.5">Código / Item</th>
                          <th className="p-2.5 text-center">Contagem Física</th>
                          <th className="p-2.5 text-center">Saldo Fiscal</th>
                          <th className="p-2.5 text-center">Comodato</th>
                          <th className="p-2.5 text-center">Recolha</th>
                          <th className="p-2.5 text-right">Divergência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {selectedHistoryAudit.items
                          .filter(item => item.physicalQty > 0 || (item.rePhysicalQty !== undefined && item.rePhysicalQty > 0))
                          .map(item => {
                          const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
                          const fisc = item.fiscalQty ?? 0;
                          const comodato = item.comodatoQty ?? 0;
                          const recolha = item.recolhaQty ?? 0;
                          const diff = (phys + comodato - recolha) - fisc;
                          return (
                            <tr key={item.productCode} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-medium">
                                <span className="font-mono text-[10px] bg-slate-100 p-0.5 px-1 rounded mr-1.5">{item.productCode}</span>
                                {item.productDescription}
                              </td>
                              <td className="p-2.5 text-center font-mono">{phys}</td>
                              <td className="p-2.5 text-center font-mono">{fisc}</td>
                              <td className="p-2.5 text-center font-mono">{comodato || '-'}</td>
                              <td className="p-2.5 text-center font-mono">{recolha || '-'}</td>
                              <td className={`p-2.5 text-right font-bold font-mono ${
                                diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : `${diff}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Assets */}
              {selectedHistoryAudit.assets && selectedHistoryAudit.assets.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 uppercase block font-sans">
                    Ativos de Giro (AG)
                  </span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200 font-mono text-[10px]">
                        <tr>
                          <th className="p-2.5">Ativo</th>
                          <th className="p-2.5 text-center">Contagem Física</th>
                          <th className="p-2.5 text-center">Saldo Fiscal</th>
                          <th className="p-2.5 text-center">Comodato</th>
                          <th className="p-2.5 text-center">Recolha</th>
                          <th className="p-2.5 text-right">Divergência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {selectedHistoryAudit.assets.map(asset => {
                          const phys = asset.rePhysicalQty !== undefined ? asset.rePhysicalQty : asset.physicalQty;
                          const fisc = asset.fiscalQty ?? 0;
                          const comodato = asset.comodatoQty ?? 0;
                          const recolha = asset.recolhaQty ?? 0;
                          const diff = phys - fisc + comodato - recolha;
                          return (
                            <tr key={asset.assetId} className="hover:bg-slate-50/50">
                              <td className="p-2.5 font-medium">{asset.assetName || asset.assetId}</td>
                              <td className="p-2.5 text-center font-mono">{phys}</td>
                              <td className="p-2.5 text-center font-mono">{fisc}</td>
                              <td className="p-2.5 text-center font-mono text-slate-500">{comodato || '-'}</td>
                              <td className="p-2.5 text-center font-mono text-slate-500">{recolha || '-'}</td>
                              <td className={`p-2.5 text-right font-bold font-mono ${
                                diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : `${diff}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Photo Evidences - Archived in network folder PDF */}
              <div className="border-t border-slate-150 pt-4 space-y-2">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Evidências Fotográficas (PA / AG / Refugos):</div>
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-start space-x-2.5">
                    <div className="p-1.5 bg-amber-500/15 text-amber-600 rounded-lg shrink-0 mt-0.5">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-amber-800 uppercase block font-sans">
                        Fotos Arquivadas no PDF do Mapa
                      </span>
                      <p className="text-xxs text-slate-600 font-medium">
                        As imagens originais foram removidas do armazenamento local da plataforma para prevenir lentidão e corrupção de dados. O arquivo PDF oficial baixado já contém todas as evidências fotográficas anexadas e pode ser localizado no diretório compartilhado de rede correspondente:
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-xs">
                    <span className="font-mono text-[10px] text-slate-700 break-all select-all font-semibold leading-relaxed">
                      P:\Guarabira\2026\04.LOGISTICA\ARMAZÉM\3.0 ACURACIDADE\3.1 PACOTE PREJUIZO\FALTAS EM ROTA\RETORNO DE ROTA
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText("P:\\Guarabira\\2026\\04.LOGISTICA\\ARMAZÉM\\3.0 ACURACIDADE\\3.1 PACOTE PREJUIZO\\FALTAS EM ROTA\\RETORNO DE ROTA");
                        alert("Caminho da rede copiado para a área de transferência!");
                      }}
                      className="shrink-0 flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[9px] rounded transition-all cursor-pointer border border-slate-200/80 uppercase font-mono"
                    >
                      <Copy className="h-3 w-3 text-slate-500" />
                      <span>Copiar Caminho</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedHistoryAudit.reconciliationNotes && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <strong className="block text-slate-700 uppercase mb-1">Parecer de Conciliação / Notas:</strong>
                  <p className="text-slate-600 italic">"{selectedHistoryAudit.reconciliationNotes}"</p>
                </div>
              )}

              {/* Seção de Reabertura de Mapa (Solicitação / Ações) */}
              <div className="border-t border-slate-150 pt-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                  Controle de Reabertura de Mapa:
                </span>

                {(() => {
                  const mReopenInfo = getReopeningInfo(selectedHistoryAudit);
                  if (!mReopenInfo.isReopened) return null;
                  return (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5">
                      <span className="text-xs font-black text-amber-900 uppercase block font-sans">
                        🔄 Histórico Detalhado de Reabertura
                      </span>
                      {mReopenInfo.justification && (
                        <div className="text-xs text-slate-700 bg-white border border-amber-100 p-3 rounded-lg italic">
                          <strong>Justificativa registrada:</strong> "{mReopenInfo.justification}"
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-2 text-xxs text-slate-600 font-mono leading-relaxed bg-amber-100/30 p-2.5 rounded-lg border border-amber-200/40">
                        {mReopenInfo.requestedAt && (
                          <div className="flex items-center space-x-2">
                            <span className="text-amber-600 font-bold">1. Solicitado em:</span>
                            <span className="font-semibold text-slate-800">{new Date(mReopenInfo.requestedAt).toLocaleString('pt-BR')} {mReopenInfo.requestedBy ? `por ${mReopenInfo.requestedBy}` : ''}</span>
                          </div>
                        )}
                        {mReopenInfo.reopenedAt && (
                          <div className="flex items-center space-x-2">
                            <span className="text-amber-600 font-bold">2. Reaberto em:</span>
                            <span className="font-semibold text-slate-800">{new Date(mReopenInfo.reopenedAt).toLocaleString('pt-BR')} {mReopenInfo.reopenedBy ? `por ${mReopenInfo.reopenedBy}` : ''}</span>
                          </div>
                        )}
                        {mReopenInfo.closedAgainAt ? (
                          <div className="flex items-center space-x-2 bg-emerald-100/50 p-1.5 rounded border border-emerald-200/50">
                            <span className="text-emerald-700 font-bold">3. Fechado Novamente:</span>
                            <span className="font-bold text-emerald-800">{new Date(mReopenInfo.closedAgainAt).toLocaleString('pt-BR')} {mReopenInfo.closedAgainBy ? `por ${mReopenInfo.closedAgainBy}` : ''}</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 bg-rose-100/50 p-1.5 rounded border border-rose-200/50">
                            <span className="text-rose-700 font-bold">3. Fechado Novamente:</span>
                            <span className="font-bold text-rose-800">Ainda pendente de conclusão</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {selectedHistoryAudit.reopeningRequested ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">🔓</span>
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-amber-800 uppercase block">
                          Solicitação de Reabertura Pendente
                        </span>
                        <p className="text-xxs text-slate-500 font-mono">
                          Solicitado por: <strong>{selectedHistoryAudit.reopeningRequestUser || 'Auxiliar'}</strong> em {selectedHistoryAudit.reopeningRequestDate ? new Date(selectedHistoryAudit.reopeningRequestDate).toLocaleString('pt-BR') : ''}
                        </p>
                        <p className="text-xs text-slate-700 italic bg-white p-2.5 rounded-lg border border-amber-100 mt-1">
                          "{selectedHistoryAudit.reopeningJustification}"
                        </p>
                      </div>
                    </div>

                    {/* Se o usuário atual for Auxiliar de Logística, Financeiro ou Gestor, ele pode aprovar ou recusar */}
                    {(currentUser.role === 'auxiliar_logistica' || currentUser.role === 'financeiro' || currentUser.role === 'gestor') && (
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          onClick={() => handleApproveReopening(selectedHistoryAudit.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-xs cursor-pointer flex items-center space-x-1"
                        >
                          <span>Aprovar e Reabrir para Conciliação</span>
                        </button>
                        <button
                          onClick={() => handleRejectReopening(selectedHistoryAudit.id)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                        >
                          <span>Recusar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Auxiliar de logística, Gestor ou Financeiro pode reabrir diretamente */}
                    {(currentUser.role === 'auxiliar_logistica' || currentUser.role === 'gestor' || currentUser.role === 'financeiro') && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-700 font-bold uppercase block">
                            Observação / Motivo da Reabertura:
                          </label>
                          <span className="text-[9px] text-amber-700 font-mono font-bold bg-amber-100 px-2 py-0.5 rounded">
                            Permissão: {currentUser.role === 'auxiliar_logistica' ? 'Auxiliar de Logística' : currentUser.role}
                          </span>
                        </div>
                        <textarea
                          placeholder="Digite aqui a observação/motivo detalhado pelo qual este mapa está sendo reaberto para conciliação..."
                          value={reopeningJustificationText}
                          onChange={(e) => setReopeningJustificationText(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2.5 h-16 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <div className="flex justify-end items-center space-x-2">
                          <button
                            onClick={() => handleExecuteReopening(selectedHistoryAudit.id, reopeningJustificationText)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
                          >
                            <span className="text-sm">🔓</span>
                            <span>Reabrir Mapa para Conciliação</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Consolidated Unified Timeline */}
              <div className="space-y-3 border-t border-slate-100 pt-5">
                <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider block font-sans">
                  📑 Registro de Atividades e Histórico Unificado
                </span>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed pb-1">
                  Todos os apontamentos, observações da fiscalia/monitoramento, solicitações de reconferência, alinhamento de sobras e justificativas de atraso estão consolidados na linha do tempo abaixo:
                </p>

                <div className="relative pl-5 border-l-2 border-slate-200 space-y-4 pt-1 ml-2">
                  {(() => {
                    const timeline = getUnifiedTimeline(selectedHistoryAudit, importedRoutes);
                    if (timeline.length === 0) {
                      return (
                        <div className="text-xxs italic text-slate-400">
                          Nenhum evento registrado para este mapa.
                        </div>
                      );
                    }

                    return timeline.map((ev, idx) => {
                      // Determine styling and icon based on type and content
                      let bgColor = 'bg-slate-50/70 border-slate-200 text-slate-700';
                      let iconText = '📝';
                      let labelText = ev.action;

                      if (ev.type === 'reopening') {
                        bgColor = 'bg-amber-50/80 border-amber-200 text-amber-900';
                        iconText = '🔓';
                      } else if (ev.type === 'delay') {
                        bgColor = 'bg-rose-50/80 border-rose-200 text-rose-900 font-bold';
                        iconText = '⏰';
                      } else if (ev.type === 'alignment') {
                        bgColor = 'bg-indigo-50/80 border-indigo-200 text-indigo-900';
                        iconText = '🤝';
                      } else if (ev.type === 'observation') {
                        bgColor = 'bg-sky-50/80 border-sky-200 text-sky-950';
                        iconText = '💬';
                      } else if (ev.action.includes('Concluída') || ev.action.includes('Sucesso') || ev.action.includes('OK') || ev.action.includes('Fechado')) {
                        bgColor = 'bg-emerald-50/80 border-emerald-200 text-emerald-900 font-semibold';
                        iconText = '✅';
                      } else if (ev.action.includes('Reconferência') || ev.action.includes('Recontagem')) {
                        bgColor = 'bg-blue-50/80 border-blue-200 text-blue-900 font-semibold';
                        iconText = '🔍';
                      }

                      return (
                        <div key={ev.id} className="relative group">
                          {/* Dot/Icon on the left border */}
                          <div className={`absolute -left-[27px] top-1.5 h-4 w-4 rounded-full border-2 flex items-center justify-center text-[9px] shadow-3xs ${
                            ev.type === 'delay' ? 'bg-rose-600 border-rose-700 text-white animate-pulse' :
                            ev.type === 'reopening' ? 'bg-amber-500 border-amber-600 text-white' :
                            ev.type === 'alignment' ? 'bg-indigo-600 border-indigo-700 text-white' :
                            ev.type === 'observation' ? 'bg-sky-500 border-sky-600 text-white' :
                            'bg-slate-400 border-slate-500 text-white'
                          }`}>
                            <span className="text-[9px] leading-none">{iconText}</span>
                          </div>

                          <div className={`p-3.5 rounded-xl border ${bgColor} shadow-3xs transition-all duration-200 hover:shadow-2xs`}>
                            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                              <span className="text-xxs font-black uppercase tracking-wide font-sans">{labelText}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-medium">
                                📅 {new Date(ev.timestamp).toLocaleDateString('pt-BR')} às {new Date(ev.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div className="text-xxs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                              <span>👤 Realizado por:</span> 
                              <span className="text-slate-800 font-bold">{ev.user}</span>
                            </div>

                            {ev.details && (
                              <div className="text-xxs text-slate-700 font-semibold bg-white/80 border border-slate-100 p-2.5 rounded-lg mt-1.5 leading-relaxed break-words font-mono">
                                {ev.details}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={() => downloadSingleAuditPDF(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>Baixar Relatório PDF (com Fotos)</span>
                </button>
                <button 
                  type="button"
                  onClick={() => downloadSingleAuditExcel(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Baixar Planilha Excel (.xlsx)</span>
                </button>
                <button 
                  type="button"
                  onClick={() => downloadSingleAuditJSON(selectedHistoryAudit)}
                  className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg transition shadow-xs cursor-pointer"
                >
                  <FileJson className="h-4 w-4" />
                  <span>Baixar JSON (.json)</span>
                </button>
              </div>
              <button 
                onClick={() => setSelectedHistoryAudit(null)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs py-2 px-5 rounded-lg transition cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP DE CONFIRMAÇÃO DE SOBRA PARA AUXILIAR DE ARMAZÉM (1 DIA ANTES DA DATA DE ENTREGA) */}
      {pendingSurplusesForAuxiliary.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 border-b border-amber-500/40 flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
                  <PackageCheck className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono">
                      Aviso do Armazém
                    </span>
                    <span className="text-xs text-amber-300 font-semibold font-mono">
                      1 dia antes da entrega
                    </span>
                  </div>
                  <h3 className="font-sans font-extrabold text-base text-white uppercase tracking-tight mt-0.5">
                    Confirmação de Envio de Sobra ({pendingSurplusesForAuxiliary.length})
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    O Monitoramento/Gestão alinhou o código NB e a data de entrega. Confirme o lançamento do envio ou reprove informando o motivo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDismissedPopupAuditIds(prev => [...prev, ...pendingSurplusesForAuxiliary.map(a => a.id)]);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Fechar por enquanto"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content / Cards */}
            <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50 grow">
              {pendingSurplusesForAuxiliary.map(audit => {
                const driverName = drivers.find(d => d.id === audit.driverId)?.name || audit.driverId;
                const surplusProds = audit.items.filter(i => {
                  const phys = i.rePhysicalQty !== undefined ? i.rePhysicalQty : i.physicalQty;
                  const fisc = i.fiscalQty ?? 0;
                  const comodato = i.comodatoQty ?? 0;
                  const recolha = i.recolhaQty ?? 0;
                  return (phys + comodato - recolha) > fisc;
                });
                const surplusAssets = audit.assets.filter(a => {
                  const idLower = (a.assetId || '').toLowerCase();
                  const nameUpper = (a.assetName || '').toUpperCase();
                  const isChapatex = idLower === 'chapatex' || idLower === '899599' || nameUpper.includes('CHAPATEX');
                  if (isChapatex) return false;

                  const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                  const fisc = a.fiscalQty ?? 0;
                  const comodato = a.comodatoQty ?? 0;
                  const recolha = a.recolhaQty ?? 0;
                  return (phys + comodato - recolha) > fisc;
                });

                const isReprovingThis = reprovingAuditId === audit.id;

                return (
                  <div key={audit.id} className="bg-white rounded-xl border border-amber-200 p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-slate-900 font-sans">Mapa {audit.routeMap}</span>
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-bold">{audit.plate}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-sans">
                          <strong>Motorista:</strong> {driverName}
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="text-xs font-mono font-extrabold text-slate-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg inline-block">
                          NB Cliente: {audit.clientCodeNB}
                        </div>
                        <div className="text-[11px] text-emerald-800 font-bold font-sans block">
                          Entrega Prevista: {audit.deliveryDate ? new Date(audit.deliveryDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Surplus items detail */}
                    <div className="bg-amber-50/40 border border-amber-100/80 rounded-lg p-3 space-y-2">
                      <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider font-sans">
                        Itens em Sobra Alinhados para Envio:
                      </div>
                      <div className="space-y-1">
                        {surplusProds.map(p => {
                          const phys = p.rePhysicalQty !== undefined ? p.rePhysicalQty : p.physicalQty;
                          const fisc = p.fiscalQty ?? 0;
                          const comodato = p.comodatoQty ?? 0;
                          const recolha = p.recolhaQty ?? 0;
                          const diff = (phys + comodato - recolha) - fisc;
                          return (
                            <div key={p.productCode} className="flex justify-between text-xs text-slate-800 font-medium">
                              <span>
                                {p.productCode && <span className="font-mono text-amber-900 font-bold mr-1">[{p.productCode}]</span>}
                                {p.productDescription}
                              </span>
                              <span className="font-mono font-bold text-emerald-700">+{diff} cx (P.A.)</span>
                            </div>
                          );
                        })}
                        {surplusAssets.map(a => {
                          const phys = a.rePhysicalQty !== undefined ? a.rePhysicalQty : a.physicalQty;
                          const fisc = a.fiscalQty ?? 0;
                          const comodato = a.comodatoQty ?? 0;
                          const recolha = a.recolhaQty ?? 0;
                          const diff = (phys + comodato - recolha) - fisc;
                          return (
                            <div key={a.assetId} className="flex justify-between text-xs text-slate-800 font-medium">
                              <span>
                                {a.assetId && <span className="font-mono text-blue-900 font-bold mr-1">[{a.assetId}]</span>}
                                {a.assetName}
                              </span>
                              <span className="font-mono font-bold text-emerald-700">+{diff} un (A.G.)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reproval observation area if reproving */}
                    {isReprovingThis && (
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200 space-y-2 animate-fade-in">
                        <label className="block text-xs font-bold text-red-900 font-sans">
                          Motivo da Reprova do Envio (Obrigatório):
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Informe a observação detalhando o motivo da reprova..."
                          value={reprovalObservation}
                          onChange={e => setReprovalObservation(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 font-sans"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setReprovingAuditId(null);
                              setReprovalObservation('');
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition cursor-pointer font-sans"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!reprovalObservation.trim()) {
                                alert('É obrigatório preencher a observação em caso de reprova!');
                                return;
                              }
                              const updated = audits.map(a => {
                                if (a.id === audit.id) {
                                  return {
                                    ...a,
                                    surplusFlowStatus: 'REPROVADO' as const,
                                    reconciliationNotes: `Reprovado pela Auxiliar de Armazém: ${reprovalObservation.trim()}`,
                                    history: [
                                      ...a.history,
                                      {
                                        timestamp: new Date().toISOString(),
                                        action: 'Envio de Sobra Reprovado pela Auxiliar de Armazém',
                                        user: currentUser.name,
                                        details: `Motivo da Reprova: ${reprovalObservation.trim()}`
                                      }
                                    ]
                                  };
                                }
                                return a;
                              });
                              onSaveAudits(updated);
                              setReprovingAuditId(null);
                              setReprovalObservation('');
                              alert('Envio reprovado e observação registrada no histórico com sucesso!');
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition cursor-pointer font-sans"
                          >
                            Confirmar Reprova
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons if not currently open for reproval input */}
                    {!isReprovingThis && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = audits.map(a => {
                              if (a.id === audit.id) {
                                return {
                                  ...a,
                                  surplusFlowStatus: 'ENVIADO' as const,
                                  surplusActionStatus: 'enviado_cliente' as const,
                                  history: [
                                    ...a.history,
                                    {
                                      timestamp: new Date().toISOString(),
                                      action: 'Sobra Lançada pela Auxiliar de Armazém',
                                      user: currentUser.name,
                                      details: `Sobra confirmada e lançada pela Auxiliar de Armazém. NB: ${audit.clientCodeNB} | Data Entrega: ${audit.deliveryDate}. Removido da tela operacional e disponível na Visão Master.`
                                    }
                                  ]
                                };
                              }
                              return a;
                            });
                            onSaveAudits(updated);
                            alert(`Sobra do Mapa ${audit.routeMap} lançada com sucesso!\n\nO item foi removido da tela operacional de Sobras e Faltas e agora está visível apenas na Visão Master.`);
                          }}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer font-sans uppercase tracking-tight"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Lançar Envio (Confirmar)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReprovingAuditId(audit.id);
                            setReprovalObservation('');
                          }}
                          className="bg-red-100 hover:bg-red-200 text-red-900 font-extrabold text-xs py-2.5 px-4 rounded-xl border border-red-200 transition flex items-center justify-center space-x-2 cursor-pointer font-sans uppercase tracking-tight"
                        >
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span>Reprovar Envio</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
