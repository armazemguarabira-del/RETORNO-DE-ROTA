export type UserRole = 'conferente' | 'auxiliar_logistica' | 'gestor' | 'monitoramento' | 'financeiro' | 'empilhador';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  username: string;
  password?: string;
}

export interface Driver {
  id: string;
  name: string;
  role: 'MOTORISTA' | 'AJUDANTE';
  cpf: string;
  isTemporary?: boolean;
}

export interface Product {
  code: string;
  description: string;
  group: string;
  unit: string;
  palletFactor: number;
  skuFactor: number;
  hectoFactor: number;
  cost: number;
  curve: string;
  photoUrl?: string;
}

export interface Vehicle {
  plate: string;
  capacityPallets: number;
  isTemporary?: boolean;
}

export interface ActiveAsset {
  id: string;
  name: string;
  category: 'GARRAFEIRA' | 'GARRAFA' | 'PALETE' | 'OUTRO';
  cost: number;
}

// A return audit represents a vehicle arrival, physical counting, and fiscal comparison
export type AuditStatus = 
  | 'em_aberto'             // Registered, awaiting or currently undergoing physical audit
  | 'conferido_fisico'      // Physical audit done, awaiting fiscal verification
  | 'reconferencia'         // Fiscal checker flagged discrepancies, returned to physical count
  | 'recontagem_finalizada'  // Re-audit completed by physical checker, awaiting final fiscal decision
  | 'finalizado_ok'         // Fiscal check completed, counts matched perfectly
  | 'finalizado_divergente'; // Fiscal check completed, counts had discrepancies, finalized anyway

export interface AuditItem {
  productCode: string;
  productDescription: string;
  cost: number;
  // Blind physical counts
  physicalQty: number;
  // Fiscal target counts (only entered/visible by fiscal user)
  fiscalQty?: number;
  // Second physical count if re-audit was requested
  rePhysicalQty?: number;
  // Original expected spreadsheet quantity
  expectedQty?: number;
  comodatoQty?: number;
  recolhaQty?: number;
}

export interface AuditAssetItem {
  assetId: string;
  assetName: string;
  cost: number;
  physicalQty: number;
  fiscalQty?: number;
  rePhysicalQty?: number;
  comodatoQty?: number;
  recolhaQty?: number;
}

export interface AuditRefugo {
  id: string;
  assetId: string;
  assetName: string;
  qty: number;
  reason: string;
  photoUrl?: string;
  photoId?: string;
}

export interface AuditSession {
  id: string;
  routeMap: string;         // Mapa da rota
  unifiedMaps?: string[];   // Lista de mapas unificados
  plate: string;            // Placa do veículo
  exchangePlate?: string;   // Placa substituta (Troca de veículo se houver)
  driverId: string;         // Motorista principal
  helperId?: string;        // Ajudante
  arrivalKm?: number;       // KM de chegada
  arrivalDate: string;      // YYYY-MM-DD
  
  // Timing productivity metrics
  startTime?: string;       // ISO string when physical count starts
  endTime?: string;         // ISO string when physical count is completed
  
  status: AuditStatus;
  conferenteId?: string;    // Who did physical audit
  auxiliarId?: string;      // Who did fiscal audit
  
  items: AuditItem[];       // Finished products
  assets: AuditAssetItem[]; // Active assets (Ativos de giro)
  refugos?: AuditRefugo[];  // Refugos dos ativos de giro (Garrafas / Garrafeiras danificadas)
  exchanges?: AuditExchangeItem[]; // Trocas e Reposições de PA
  
  history: {
    timestamp: string;
    action: string;
    user: string;
    details?: string;
  }[];
  
  reconciliationNotes?: string;
  pdfDownloaded?: boolean;
  financeiroCiente?: boolean; // Financeiro ciente do fechamento para Promax
  isEstimated?: boolean;      // Marcar se a auditoria possui dados estimados/retroativos

  // Discrepancy Action Tracker Fields (Sobras & Faltas)
  surplusActionStatus?: 'prazo_envio_ok' | 'fora_do_prazo' | 'enviado_cliente' | 'baixado_direto'; // for Sobras
  deficitActionStatus?: 'pendente_baixa' | 'baixado' | 'baixado_direto'; // for Faltas
  correctiveActionNotes?: string; // Observation about what action was taken

  // Monitoramento and Gestor fields for Sobras flow
  clientCodeNB?: string;                // Código do Cliente (NB)
  deliveryDate?: string;                // Data de Entrega
  gestorAlignedDeliveryDate?: boolean;  // Se o Gestor alinhou a data de entrega do produto que sobrou
  surplusFlowStatus?: 'PENDENTE' | 'ENCAMINHADO' | 'ENVIADO' | 'BAIXADO' | 'REPROVADO'; // Status do fluxo de sobras
  gestorAcknowledgedSurplus?: boolean;  // Se o gestor marcou ciente no card de ação do auxiliar de sobras

  // Suspension & time tracking fields
  isSuspended?: boolean;
  suspensionNotes?: string;
  lastTimerStart?: string;
  totalCountingDurationMs?: number;
  routeObservations?: RouteObservation[];
  
  // Blitz results
  isBlitz?: boolean;
  blitzBoxesChecked?: number;
  blitzAvariasFound?: number;

  // Descarregamento tracking fields
  descarregamentoStatus?: 'AGUARDANDO_DESCARGA' | 'EM_DESCARGA' | 'DESCARREGADO' | 'PERNOITE';
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  isPernoite?: boolean;
  dock?: string;
  empilhadorId?: string;
  empilhadorName?: string;
  totalPallets?: number;
  loadedPallets?: number;
  unloadingNote?: string;
  unloadingChecklist?: {
    giro360: boolean;
    calcoSeguranca: boolean;
    aberturaBaias: boolean;
    completedAt: string;
    completedBy: string;
  };

  // Concurrency metadata fields
  updatedAt?: string;
  lastUpdatedBy?: string;

  // Reopening request and execution fields
  reopeningRequested?: boolean;
  reopeningJustification?: string;
  reopeningRequestDate?: string;
  reopeningRequestUser?: string;
  reopened?: boolean;
  reopenedAt?: string;
  reopenedBy?: string;
}

export interface RouteObservation {
  id: string;
  author: string; // e.g. "Monitoramento", "Financeiro", "Gestor", etc.
  text: string;
  timestamp: string;
  type?: 'sobra' | 'falta' | 'todos';
}

export interface ReturnForecast {
  id: string;
  plate: string;
  driverName: string;
  helperName?: string;
  routeMap: string;
  eta: string;             // Expected time of arrival (e.g. "15:30")
  status: 'em_rota' | 'chegando' | 'no_patio';
  tripStatus?: 'retornam' | 'pernoitam'; // 'retornam' or 'pernoitam'
  updatedAt: string;
}

export interface FiscalAlert {
  id: string;
  routeMap: string;
  plate: string;
  status: 'finalizado_ok' | 'finalizado_divergente' | 'recontagem_solicitada' | 'conferido_fisico' | 'recontagem_finalizada' | 'sobra_alinhada' | 'outros';
  timestamp: string;
  read: boolean;
  title?: string;
  message?: string;
  targetRole?: UserRole | 'todos';
}

export interface AuditExchangeItem {
  productCode: string;
  productDescription: string;
  qty: number;
  type: 'TROCA' | 'REPOSICAO'; // TROCA = avariado em rota, REPOSICAO = faltas em rota
}

export interface ImportedRouteItem {
  productCode: string;
  productDescription: string;
  qty: number;
  unit: string;
}

export interface ImportedRoute {
  id: string;
  routeMap: string;
  plate: string;
  driverId: string;
  driverName?: string;
  helperName?: string;
  helperId?: string;
  routeDate: string; // The date of the route requested during import
  status: 'pendente' | 'conferindo' | 'fechado' | 'em_analise' | 'reconferir';
  importedAt: string;
  itemsCount: number;
  justification?: string;
  discrepancyObservation?: string; // Observação de divergência de ativos de giro ou P.A
  exchanges?: AuditExchangeItem[]; // Trocas e Reposições de PA
  items?: ImportedRouteItem[];
  routeObservations?: RouteObservation[];
  isBlitz?: boolean; // Flag indicando se este veículo foi selecionado para Blitz de Refugo do dia
  updatedAt?: string;

  // Descarregamento Real-Time Fields
  descarregamentoStatus?: 'AGUARDANDO_DESCARGA' | 'EM_DESCARGA' | 'DESCARREGADO' | 'PERNOITE';
  unloadingStartTime?: string;
  unloadingEndTime?: string;
  isPernoite?: boolean;
  dock?: string;
  empilhadorId?: string;
  empilhadorName?: string;
  totalPallets?: number;
  loadedPallets?: number;
  vehicleType?: string;
  unloadingNote?: string;
  unloadingChecklist?: {
    giro360: boolean;
    calcoSeguranca: boolean;
    aberturaBaias: boolean;
    completedAt: string;
    completedBy: string;
  };
}

export function isTreatableAssetId(assetId: string): boolean {
  const id = assetId.toLowerCase();
  // Filter out pallets and chapatex/other non-bottle/crate assets
  return id !== 'pal_pbr' && id !== 'chapatex' && !id.includes('palete') && !id.includes('pallet') && !id.includes('chapatex');
}

export function getAssetCode(assetId: string, assetName: string): string {
  const id = assetId.toLowerCase();
  const normName = assetName.toUpperCase().replace(/\s+/g, '');
  
  if (normName.includes('GARRAFEIRA1L')) return '188005';
  if (normName.includes('GARRAFEIRA600')) return '899599';
  if (normName.includes('GARRAFEIRA300')) return '863059';
  if (normName.includes('VERDE600') || normName.includes('600MLVERDE') || normName.includes('600VERDE')) return '786238';
  if (normName.includes('ÂMBAR') || normName.includes('AMBAR')) return '27983';
  if (normName.includes('GARRAFA1L')) return '188006';
  if (normName.includes('GARRAFA300')) return '198214';
  
  if (['27983', '188006', '198214', '786238', '188005', '863059', '899599'].includes(assetId)) {
    return assetId;
  }
  
  if (id === 'gf_1l') return '188005';
  if (id === 'gf_600') return '899599';
  if (id === 'gf_300') return '863059';
  if (id === 'g_600_v') return '786238';
  if (id === 'g_600_a') return '27983';
  if (id === 'g_1l') return '188006';
  if (id === 'g_300') return '198214';

  return assetId;
}

export function getAssetCanonicalName(code: string): string {
  switch (code) {
    case '188005': return 'GARRAFEIRA 1L';
    case '899599': return 'GARRAFEIRA 600ML';
    case '863059': return 'GARRAFEIRA 300ML';
    case '786238': return 'GARRAFA VERDE 600ML (RET)';
    case '27983': return 'GARRAFA 600 ÂMBAR (RET)';
    case '188006': return 'GARRAFA 1L(RET)';
    case '198214': return 'GARRAFA 300ML (RET)';
    default: return '';
  }
}

export interface ValeCollaborator {
  id: string;
  name: string;
  role: string; // 'MOTORISTA' | 'AJUDANTE' | 'CONFERENTE' | 'AUXILIAR' | 'OUTRO'
  valor?: number;
  cpf?: string;
}

export interface Vale {
  id: string;
  auditId?: string; // mapa de auditoria de onde veio
  routeMap?: string;
  colaboradorId: string; // id do motorista/ajudante/conferente ou nome
  colaboradorName: string;
  colaboradorRole: string; // 'MOTORISTA' | 'AJUDANTE' | 'CONFERENTE' | etc.
  colaboradorValor?: number; // Cota individual rateada do colaborador principal
  valor: number;
  quantidade?: number; // quantidade de volumes ou itens em desvio
  descricao: string; // Ex: "Falta de 3 cx Spaten no mapa MAPA-108"
  dataGeracao: string; // YYYY-MM-DD
  status: 'PENDENTE_ASSINATURA' | 'ASSINADO' | 'COMPENSADO' | 'DESCONTADO_EM_FOLHA';
  observacao?: string;
  signedPdfUrl?: string; // base64 do PDF ou imagem do vale assinado
  signedPdfName?: string; // nome do arquivo PDF
  acknowledgedByGestor?: boolean; // Se o gestor marcou ciente no card do vale
  colaboradoresAdicionais?: ValeCollaborator[]; // Colaboradores adicionais co-responsáveis
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  operation: 'CRIAÇÃO' | 'EDIÇÃO' | 'EXCLUSÃO' | 'OUTROS';
  details: string;
}

export type CarregamentoStatus =
  | 'FILA'                // Na fila / Aguardando Doca ou Distribuição
  | 'DISTRIBUIDO'         // Distribuído para o empilhador, aguardando início
  | 'EM_CARREGAMENTO'     // Em processo de carregamento/puxada ativa
  | 'PAUSADO'             // Pausado (espera produto, troca de palete, etc.)
  | 'CONCLUIDO'           // 100% carregado e liberado
  | 'CANCELADO';          // Cancelado

export type CarregamentoPriority = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface CarregamentoItem {
  id: string;
  productCode: string;
  productDescription: string;
  qtyBoxes: number;
  qtyPallets: number;
  pickingLocation?: string; // ex: 'RUA-A-04', 'BLOCO-02'
  status: 'PENDENTE' | 'PUXADO' | 'CARREGADO';
  loadedAt?: string;
}

export interface Empilhador {
  id: string;
  name: string;
  matricula: string;
  cpf?: string;
  shift: '1_TURNO' | '2_TURNO' | '3_TURNO';
  forkliftCode: string; // ex: 'E-01', 'E-02', 'E-03'
  status: 'DISPONIVEL' | 'OPERANDO' | 'INTERVALO' | 'MANUTENCAO' | 'OFFLINE';
  totalPalletsLoadedToday?: number;
  activeTaskId?: string;
  phone?: string;
}

export interface CarregamentoProcess {
  id: string;
  processNumber: string; // Ex: "CARGA-401", "MAPA-108"
  routeMap?: string;
  plate: string;
  driverId?: string;
  driverName?: string;
  vehicleType?: string; // 'TOCO (8 PAL)', 'TRUCK (10 PAL)', 'CARRETA (28 PAL)', 'VUC (6 PAL)', etc.
  dock: string; // 'DOCA 01', 'DOCA 02', ..., 'DOCA 08', 'PATIO EXTERNO'
  empilhadorId?: string;
  empilhadorName?: string;
  forkliftCode?: string;
  shift: '1_TURNO' | '2_TURNO' | '3_TURNO';
  priority: CarregamentoPriority;
  status: CarregamentoStatus;
  
  totalPallets: number;
  loadedPallets: number;
  totalBoxes?: number;
  totalHecto?: number;
  cargoCategory?: 'CERVEJA' | 'REFRIGERANTE_NAB' | 'RETORNAVEL' | 'MISTO' | 'FRACIONADO';

  createdAt: string;
  distributedAt?: string;
  startedAt?: string;
  completedAt?: string;
  slaTargetMinutes?: number; // Ex: 35 min
  totalDurationMinutes?: number;
  
  // Descarregamento Workflow & Eficiência Ambev fields
  isPernoite?: boolean; // Veículo pernoite - não conta para o indicador de eficiência de descarregamento
  routeDate?: string; // Data da rota importada (para cálculo de ciclo D0, D1, D2, D3, D4+)
  unloadingStartTime?: string; // Horário de início do descarregamento (ex: "18:40" ou ISO)
  unloadingEndTime?: string; // Horário de término do descarregamento (ex: "19:15" ou ISO)
  diasCiclo?: 'D0' | 'D1' | 'D2' | 'D3' | 'D4+'; // Indicador de ciclo de retorno
  efficiencyOnTime?: boolean; // Se foi descarregado até 22:00
  unloadingNote?: string;
  unloadingChecklist?: {
    giro360: boolean;
    calcoSeguranca: boolean;
    aberturaBaias: boolean;
    completedAt: string;
    completedBy: string;
  };
  
  items?: CarregamentoItem[];
  observations?: string;
  pauseReason?: string;
  
  conferenteName?: string;
  updatedAt?: string;
  lastUpdatedBy?: string;
}

export interface ControleSobraItem {
  id: string;
  productCode: string;
  productDescription: string;
  quantity: number;
  routeMap: string;
  mapDate: string;           // Data do fechamento/ocorrência (YYYY-MM-DD)
  deadlineDate: string;      // Prazo de envio/baixa (mapDate + 30 dias)
  status: 'PENDENTE' | 'ENVIADO' | 'DEVOLVIDO';
  destination?: 'CLIENTE' | 'ESTOQUE';
  auditId?: string;          // Vinculado a uma conferência existente
  isManual?: boolean;        // Cadastrado manualmente pela Auxiliar de Logística
  clientCodeNB?: string;     // Código do Cliente (NB)
  clientName?: string;       // Nome do Cliente se aplicável
  driverName?: string;
  plate?: string;
  notes?: string;
  registeredBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

// -------------------------------------------------------------
// LIGA OPERACIONAL DPO (GAMIFICAÇÃO & PERFORMANCE LOGÍSTICA AMBEV)
// -------------------------------------------------------------

export interface FiveSEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: 'conferente' | 'empilhador';
  date: string; // YYYY-MM-DD
  photoUrl: string;
  notes?: string;
  createdAt: string;
}

export interface SafetyReport {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  photoUrl: string;
  description: string;
  category: 'SEGURANCA' | 'QUALIDADE' | 'ANOMALIA';
  status: 'REGISTRADO' | 'ANALISADO';
  createdAt: string;
}

export interface BlitzRefugoItem {
  code: string;
  name: string;
  qty: number;
  reason?: string;
}

export interface BlitzRefugoEntry {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  userName: string;
  plate: string;
  routeMap: string;
  items: BlitzRefugoItem[];
  completedAt: string;
}

export interface ZeroBreakDeclaration {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  userName: string;
  hasBreak: boolean; // false = 0 quebras (pontua)
  justification?: string;
  declaredAt: string;
}

