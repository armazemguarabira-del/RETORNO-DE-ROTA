import React, { useState, useRef, useMemo } from 'react';
import { 
  Download, 
  Database, 
  FileJson, 
  FileSpreadsheet, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles, 
  Server, 
  HardDrive, 
  Layers, 
  Table, 
  FolderDown, 
  Box, 
  Truck, 
  Users, 
  Ticket, 
  AlertTriangle,
  Upload,
  FolderUp,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  UserPlus,
  Calendar,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Filter,
  CheckCircle,
  Shield,
  ArrowDownToLine,
  Share2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  User, 
  Driver, 
  Vehicle, 
  Product, 
  ActiveAsset, 
  AuditSession, 
  ImportedRoute, 
  Vale, 
  CarregamentoProcess, 
  FiscalAlert 
} from '../types';
import { getActiveFirebaseConfig, getClientFirestore } from '../clientFirebase';
import { doc, setDoc, collection } from 'firebase/firestore';
import { parseAndProcessFile, ProcessImportResult } from '../utils/excelImportHelper';

interface ExportDataViewProps {
  currentUser: User;
  drivers: Driver[];
  vehicles: Vehicle[];
  products: Product[];
  activeAssets: ActiveAsset[];
  audits: AuditSession[];
  users: User[];
  importedRoutes: ImportedRoute[];
  vales: Vale[];
  auditLogs?: any[];
  customManualHTML?: string;
  carregamentos?: CarregamentoProcess[];
  fiscalAlerts?: FiscalAlert[];
}

export default function ExportDataView({
  currentUser,
  drivers,
  vehicles,
  products,
  activeAssets,
  audits,
  users,
  importedRoutes,
  vales,
  auditLogs = [],
  customManualHTML = '',
  carregamentos = [],
  fiscalAlerts = []
}: ExportDataViewProps) {
  // Helper to obtain current date formatted YYYY-MM-DD in Brazilian Timezone
  const getTodayBrazilStr = () => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayBrazilStr);
  const [filterMode, setFilterMode] = useState<'day' | 'all'>('day');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConfig = getActiveFirebaseConfig();
  const activeProjectId = activeConfig?.projectId || 'banco-oficial';

  // Retroactive Refugo state
  const [retroImportResult, setRetroImportResult] = useState<ProcessImportResult | null>(null);
  const [isProcessingRetro, setIsProcessingRetro] = useState(false);
  const refugoFileInputRef = useRef<HTMLInputElement>(null);

  // Quick Date Calculation Helpers
  const getPastDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  };

  // Filtered operational datasets based on selected date or all
  const filteredAudits = useMemo(() => {
    if (filterMode === 'all') return audits;
    return audits.filter(a => {
      if (!a) return false;
      if (a.arrivalDate && a.arrivalDate === selectedDate) return true;
      if (a.startTime && a.startTime.startsWith(selectedDate)) return true;
      if (a.endTime && a.endTime.startsWith(selectedDate)) return true;
      if (Array.isArray(a.history) && a.history.some(h => h.timestamp && h.timestamp.startsWith(selectedDate))) return true;
      return false;
    });
  }, [audits, selectedDate, filterMode]);

  const filteredRoutes = useMemo(() => {
    if (filterMode === 'all') return importedRoutes;
    return importedRoutes.filter(r => {
      if (!r) return false;
      if (r.routeDate && r.routeDate === selectedDate) return true;
      if (r.importedAt && r.importedAt.startsWith(selectedDate)) return true;
      return false;
    });
  }, [importedRoutes, selectedDate, filterMode]);

  const filteredVales = useMemo(() => {
    if (filterMode === 'all') return vales;
    return vales.filter(v => {
      if (!v) return false;
      if (v.dataGeracao && v.dataGeracao === selectedDate) return true;
      if ((v as any).date && (v as any).date === selectedDate) return true;
      if ((v as any).createdAt && String((v as any).createdAt).startsWith(selectedDate)) return true;
      return false;
    });
  }, [vales, selectedDate, filterMode]);

  const filteredCarregamentos = useMemo(() => {
    if (filterMode === 'all') return carregamentos;
    return carregamentos.filter(c => {
      if (!c) return false;
      if (c.createdAt && c.createdAt.startsWith(selectedDate)) return true;
      if (c.startedAt && c.startedAt.startsWith(selectedDate)) return true;
      if (c.completedAt && c.completedAt.startsWith(selectedDate)) return true;
      return false;
    });
  }, [carregamentos, selectedDate, filterMode]);

  const filteredAlerts = useMemo(() => {
    if (filterMode === 'all') return fiscalAlerts;
    return fiscalAlerts.filter(al => {
      if (!al) return false;
      if (al.timestamp && al.timestamp.startsWith(selectedDate)) return true;
      return false;
    });
  }, [fiscalAlerts, selectedDate, filterMode]);

  // Flatten counted products for the day
  const dailyFlattenedItems = useMemo(() => {
    const list: any[] = [];
    filteredAudits.forEach(audit => {
      const drv = drivers.find(d => d.id === audit.driverId);
      const driverName = drv ? drv.name : audit.driverId || 'N/A';
      if (Array.isArray(audit.items)) {
        audit.items.forEach(item => {
          const fiscal = item.fiscalQty ?? item.expectedQty ?? 0;
          const physical = item.physicalQty ?? 0;
          const sobra = physical > fiscal ? physical - fiscal : 0;
          const falta = physical < fiscal ? fiscal - physical : 0;

          list.push({
            dataAuditoria: audit.arrivalDate || selectedDate,
            mapaRota: audit.routeMap || 'S/M',
            placaVeiculo: audit.plate || 'N/A',
            motorista: driverName,
            statusConferencia: audit.status,
            codigoProduto: item.productCode,
            descricaoProduto: item.productDescription,
            qtdFiscal: fiscal,
            qtdFisica: physical,
            qtdSobra: sobra,
            qtdFalta: falta,
            custoUnitario: item.cost || 0
          });
        });
      }
    });
    return list;
  }, [filteredAudits, drivers, selectedDate]);

  // Flatten counted active assets (vasilhames, caixas, pallets)
  const dailyFlattenedAssets = useMemo(() => {
    const list: any[] = [];
    filteredAudits.forEach(audit => {
      const drv = drivers.find(d => d.id === audit.driverId);
      const driverName = drv ? drv.name : audit.driverId || 'N/A';
      if (Array.isArray(audit.assets)) {
        audit.assets.forEach(asset => {
          const fiscal = asset.fiscalQty ?? 0;
          const physical = asset.physicalQty ?? 0;
          const diferenca = physical - fiscal;

          list.push({
            dataAuditoria: audit.arrivalDate || selectedDate,
            mapaRota: audit.routeMap || 'S/M',
            placaVeiculo: audit.plate || 'N/A',
            motorista: driverName,
            statusConferencia: audit.status,
            ativoGiro: asset.assetName,
            qtdFiscal: fiscal,
            qtdFisica: physical,
            diferenca: diferenca,
            custoUnitario: asset.cost || 0
          });
        });
      }
    });
    return list;
  }, [filteredAudits, drivers, selectedDate]);

  // Summary counts
  const totalSobras = useMemo(() => dailyFlattenedItems.reduce((acc, i) => acc + (i.qtdSobra || 0), 0), [dailyFlattenedItems]);
  const totalFaltas = useMemo(() => dailyFlattenedItems.reduce((acc, i) => acc + (i.qtdFalta || 0), 0), [dailyFlattenedItems]);

  // Helper to trigger download in browser
  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to convert JSON array to CSV format
  const jsonToCsv = (items: any[]) => {
    if (!items || !items.length) return '';
    const keys = Object.keys(items[0]).filter(k => typeof items[0][k] !== 'object' && typeof items[0][k] !== 'function');
    const header = keys.join(';');
    const rows = items.map(item => {
      return keys.map(key => {
        let val = item[key];
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""').replace(/;/g, ',');
        return `"${val}"`;
      }).join(';');
    });
    return [header, ...rows].join('\n');
  };

  // Build the complete multiplatform JSON structure for the selected date
  const generateDailyBackupPayload = () => {
    return {
      backupSpecification: {
        format: "LOGIROUTE_DAILY_BACKUP_V2",
        standard: "MULTI_PLATFORM_INTEROPERABLE_JSON",
        unit: "PAU BRASIL DISTRIBUIDORA - CD GUARABIRA",
        clientAccount: "armazemguarabira@gmail.com",
        generatedAt: new Date().toISOString(),
        generatedBy: currentUser.name,
        targetDate: filterMode === 'day' ? selectedDate : 'ALL_HISTORICAL_DATA',
        activeFirebaseProject: activeProjectId,
        purpose: "Custódia de dados diários e exportação para ERPs, WMS ou plataformas externas de logística"
      },
      summary: {
        totalAuditorias: filteredAudits.length,
        totalRotasMapas: filteredRoutes.length,
        totalItensContados: dailyFlattenedItems.length,
        totalAtivosGiroContados: dailyFlattenedAssets.length,
        totalSobrasUnidades: totalSobras,
        totalFaltasUnidades: totalFaltas,
        totalValesEmitidos: filteredVales.length,
        totalDescarregamentos: filteredCarregamentos.length,
        totalAlertasFiscais: filteredAlerts.length
      },
      operationalRecords: {
        audits: filteredAudits,
        importedRoutes: filteredRoutes,
        vales: filteredVales,
        carregamentos: filteredCarregamentos,
        fiscalAlerts: filteredAlerts,
        detailedCountedProducts: dailyFlattenedItems,
        detailedCountedAssets: dailyFlattenedAssets
      },
      masterCatalogs: {
        products,
        activeAssets,
        drivers,
        vehicles
      }
    };
  };

  // 1. Export Daily Backup JSON
  const handleExportDailyBackupJSON = () => {
    setIsExporting(true);
    try {
      const payload = generateDailyBackupPayload();
      const jsonStr = JSON.stringify(payload, null, 2);
      const filename = filterMode === 'day'
        ? `backup_diario_guarabira_${selectedDate}.json`
        : `backup_geral_plataforma_${getTodayBrazilStr()}.json`;
      downloadFile(filename, jsonStr, 'application/json');
      setExportSuccessMsg(`Arquivo '${filename}' gerado e baixado com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao gerar JSON:', err);
      alert('Falha ao gerar backup JSON: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export Daily Multi-Tab Excel (.xlsx)
  const handleExportDailyExcel = () => {
    setIsExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Resumo do Dia
      const resumoRows = [
        { Propriedade: 'Unidade Logística', Valor: 'PAU BRASIL GUARABIRA' },
        { Propriedade: 'Data dos Registros', Valor: filterMode === 'day' ? selectedDate : 'HISTÓRICO COMPLETO' },
        { Propriedade: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
        { Propriedade: 'Exportado por', Valor: currentUser.name },
        { Propriedade: 'Total de Auditorias Físicas', Valor: filteredAudits.length },
        { Propriedade: 'Total de Mapas de Rota Importados', Valor: filteredRoutes.length },
        { Propriedade: 'Total de Linhas de Produtos Conferidas', Valor: dailyFlattenedItems.length },
        { Propriedade: 'Total de Caixas/Unidades em Sobra', Valor: totalSobras },
        { Propriedade: 'Total de Caixas/Unidades em Falta', Valor: totalFaltas },
        { Propriedade: 'Total de Vales Financeiros Emitidos', Valor: filteredVales.length },
        { Propriedade: 'Total de Operações de Descarregamento', Valor: filteredCarregamentos.length },
        { Propriedade: 'Total de Alertas de Divergência', Valor: filteredAlerts.length }
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo_Geral');

      // Sheet 2: Auditorias Físicas
      if (filteredAudits.length > 0) {
        const auditRows = filteredAudits.map(a => {
          const drv = drivers.find(d => d.id === a.driverId);
          return {
            'ID Auditoria': a.id,
            'Data Chegada': a.arrivalDate || 'N/A',
            'Mapa': a.routeMap,
            'Placa': a.plate,
            'Motorista': drv ? drv.name : a.driverId,
            'Status': a.status,
            'Início Conferência': a.startTime ? new Date(a.startTime).toLocaleTimeString('pt-BR') : 'N/A',
            'Término Conferência': a.endTime ? new Date(a.endTime).toLocaleTimeString('pt-BR') : 'N/A',
            'Conferente ID': a.conferenteId || 'N/A',
            'Fiscal ID': a.auxiliarId || 'N/A',
            'Total Itens': a.items ? a.items.length : 0,
            'Observações': a.reconciliationNotes || ''
          };
        });
        const wsAudits = XLSX.utils.json_to_sheet(auditRows);
        XLSX.utils.book_append_sheet(wb, wsAudits, 'Conferencias_Fisicas');
      }

      // Sheet 3: Itens Detalhados de Produtos
      if (dailyFlattenedItems.length > 0) {
        const wsItems = XLSX.utils.json_to_sheet(dailyFlattenedItems);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Produtos_Conferidos');
      }

      // Sheet 4: Ativos de Giro (Vasilhames / Paletes)
      if (dailyFlattenedAssets.length > 0) {
        const wsAssets = XLSX.utils.json_to_sheet(dailyFlattenedAssets);
        XLSX.utils.book_append_sheet(wb, wsAssets, 'Ativos_Vasilhames');
      }

      // Sheet 5: Descarregamentos & Empilhadeira
      if (filteredCarregamentos.length > 0) {
        const carregRows = filteredCarregamentos.map(c => ({
          'Processo': c.processNumber,
          'Mapa': c.routeMap || 'N/A',
          'Placa': c.plate,
          'Motorista': c.driverName || 'N/A',
          'Empilhador': c.empilhadorName || 'N/A',
          'Doca': c.dock,
          'Status': c.status,
          'Total Paletes': c.totalPallets,
          'Paletes Movimentados': c.loadedPallets,
          'Início': c.startedAt ? new Date(c.startedAt).toLocaleTimeString('pt-BR') : 'N/A',
          'Conclusão': c.completedAt ? new Date(c.completedAt).toLocaleTimeString('pt-BR') : 'N/A'
        }));
        const wsCarreg = XLSX.utils.json_to_sheet(carregRows);
        XLSX.utils.book_append_sheet(wb, wsCarreg, 'Descarregamento');
      }

      // Sheet 6: Vales Emitidos
      if (filteredVales.length > 0) {
        const valesRows = filteredVales.map(v => ({
          'ID': v.id,
          'Data': v.dataGeracao || (v as any).date || 'N/A',
          'Mapa': v.routeMap || 'N/A',
          'Colaborador': v.colaboradorName || (v as any).driverName || 'N/A',
          'Cargo': v.colaboradorRole || 'N/A',
          'Valor (R$)': v.valor ?? (v as any).totalValue ?? 0,
          'Status': v.status,
          'Descrição/Motivo': v.descricao || (v as any).reason || '',
          'Observação': v.observacao || ''
        }));
        const wsVales = XLSX.utils.json_to_sheet(valesRows);
        XLSX.utils.book_append_sheet(wb, wsVales, 'Vales_Emitidos');
      }

      // Sheet 7: Alertas Fiscais
      if (filteredAlerts.length > 0) {
        const alertRows = filteredAlerts.map(al => ({
          'ID': al.id,
          'Data/Hora': al.timestamp,
          'Mapa': al.routeMap,
          'Placa': al.plate,
          'Status': al.status,
          'Título': al.title || 'Alerta Fiscal',
          'Mensagem': al.message || '',
          'Lido': al.read ? 'SIM' : 'NÃO',
          'Destino': al.targetRole || 'TODOS'
        }));
        const wsAlerts = XLSX.utils.json_to_sheet(alertRows);
        XLSX.utils.book_append_sheet(wb, wsAlerts, 'Alertas_Fiscais');
      }

      const filename = filterMode === 'day' 
        ? `relatorio_backup_diario_guarabira_${selectedDate}.xlsx`
        : `relatorio_backup_geral_${getTodayBrazilStr()}.xlsx`;

      XLSX.writeFile(wb, filename);
      setExportSuccessMsg(`Planilha Excel '${filename}' baixada com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao gerar Excel:', err);
      alert('Falha ao gerar planilha Excel: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Copy Daily JSON to Clipboard
  const handleCopyDailyJSON = () => {
    try {
      const payload = generateDailyBackupPayload();
      const jsonStr = JSON.stringify(payload, null, 2);
      navigator.clipboard.writeText(jsonStr);
      setCopiedJson(true);
      setExportSuccessMsg('Backup JSON do dia copiado para a área de transferência com sucesso!');
      setTimeout(() => setCopiedJson(false), 3000);
    } catch (e) {
      alert('Não foi possível copiar automaticamente. Use a opção de download.');
    }
  };

  // 4. Download 100% Total Complete System Database JSON
  const handleExportFullDatabaseJSON = async () => {
    setIsExporting(true);
    setExportSuccessMsg('Consolidando 100% da base de dados completa (todas as datas e coleções)...');

    try {
      let serverData: any = null;
      try {
        const res = await fetch('/api/export-database');
        if (res.ok) serverData = await res.json();
      } catch (e) {
        console.warn('Servidor local não respondeu, usando dados em memória do cliente:', e);
      }

      const localStorageDump: Record<string, any> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            try {
              localStorageDump[key] = JSON.parse(localStorage.getItem(key) || '""');
            } catch {
              localStorageDump[key] = localStorage.getItem(key);
            }
          }
        }
      } catch (e) {}

      const fullPayload = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser.name,
        accountEmail: 'armazemguarabira@gmail.com',
        activeFirebaseProject: activeProjectId,
        summaryCounts: {
          importedRoutes: importedRoutes.length,
          audits: audits.length,
          vales: vales.length,
          products: products.length,
          drivers: drivers.length,
          vehicles: vehicles.length,
          users: users.length,
          activeAssets: activeAssets.length,
          carregamentos: carregamentos.length,
          fiscalAlerts: fiscalAlerts.length,
          auditLogs: auditLogs.length
        },
        serverDatabaseDump: serverData || null,
        clientLiveState: {
          importedRoutes,
          audits,
          vales,
          products,
          drivers,
          vehicles,
          users,
          activeAssets,
          carregamentos,
          fiscalAlerts,
          auditLogs,
          customManualHTML
        },
        browserLocalStorage: localStorageDump
      };

      const jsonString = JSON.stringify(fullPayload, null, 2);
      const filename = `backup_completo_100pct_guarabira_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(filename, jsonString, 'application/json');

      setExportSuccessMsg('Backup de 100% da plataforma baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao exportar banco:', err);
      alert('Erro ao exportar arquivo: ' + (err?.message || 'Falha desconhecida'));
    } finally {
      setIsExporting(false);
    }
  };

  // 5. Import / Restore 100% JSON Backup File into Active Platform
  const handleImportFullDatabaseJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Deseja importar e restaurar os dados do arquivo '${file.name}' para a plataforma Pau Brasil Guarabira? Os registros serão mesclados com segurança.`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsImporting(true);
    setExportSuccessMsg(`Lendo e restaurando backup '${file.name}'...`);

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      let totalRestoredDocs = 0;
      const db = getClientFirestore();

      const collectionsToRestore = backupData.clientLiveState || backupData.operationalRecords || backupData.serverDatabaseDump?.collections || backupData.collections;

      if (collectionsToRestore && typeof collectionsToRestore === 'object') {
        const collectionsMap: Record<string, any[]> = {};

        if (backupData.clientLiveState) {
          collectionsMap['users'] = backupData.clientLiveState.users || [];
          collectionsMap['drivers'] = backupData.clientLiveState.drivers || [];
          collectionsMap['vehicles'] = backupData.clientLiveState.vehicles || [];
          collectionsMap['products'] = backupData.clientLiveState.products || [];
          collectionsMap['activeAssets'] = backupData.clientLiveState.activeAssets || [];
          collectionsMap['audits'] = backupData.clientLiveState.audits || [];
          collectionsMap['vales'] = backupData.clientLiveState.vales || [];
          collectionsMap['importedRoutes'] = backupData.clientLiveState.importedRoutes || [];
          collectionsMap['auditLogs'] = backupData.clientLiveState.auditLogs || [];
          collectionsMap['carregamentoProcesses'] = backupData.clientLiveState.carregamentos || [];
          collectionsMap['fiscalAlerts'] = backupData.clientLiveState.fiscalAlerts || [];
        } else if (backupData.operationalRecords) {
          collectionsMap['audits'] = backupData.operationalRecords.audits || [];
          collectionsMap['importedRoutes'] = backupData.operationalRecords.importedRoutes || [];
          collectionsMap['vales'] = backupData.operationalRecords.vales || [];
          collectionsMap['carregamentoProcesses'] = backupData.operationalRecords.carregamentos || [];
          collectionsMap['fiscalAlerts'] = backupData.operationalRecords.fiscalAlerts || [];
          if (backupData.masterCatalogs) {
            collectionsMap['products'] = backupData.masterCatalogs.products || [];
            collectionsMap['drivers'] = backupData.masterCatalogs.drivers || [];
            collectionsMap['vehicles'] = backupData.masterCatalogs.vehicles || [];
            collectionsMap['activeAssets'] = backupData.masterCatalogs.activeAssets || [];
          }
        } else if (backupData.serverDatabaseDump?.collections) {
          Object.assign(collectionsMap, backupData.serverDatabaseDump.collections);
        } else if (backupData.collections) {
          Object.assign(collectionsMap, backupData.collections);
        }

        // Send to server API
        try {
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ db: collectionsMap })
          });
        } catch (e) {
          console.warn('Erro ao salvar no servidor Express:', e);
        }

        // Send to Firestore
        if (db) {
          for (const [colName, items] of Object.entries(collectionsMap)) {
            if (Array.isArray(items)) {
              for (const item of items) {
                if (item && item.id) {
                  const itemCopy = { ...item };
                  const docId = String(itemCopy.id);
                  delete itemCopy.id;
                  const docRef = doc(collection(db, colName), docId);
                  await setDoc(docRef, itemCopy, { merge: true });
                  totalRestoredDocs++;
                }
              }
            }
          }
        }
      }

      // Restore localStorage keys
      if (backupData.browserLocalStorage) {
        for (const [key, value] of Object.entries(backupData.browserLocalStorage)) {
          try {
            localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
          } catch (e) {}
        }
      }

      setExportSuccessMsg(`Backup restaurado com sucesso! ${totalRestoredDocs} documentos sincronizados para '${activeProjectId}'. Atualizando a tela...`);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao importar backup:", err);
      alert("Falha ao importar backup JSON: " + (err?.message || "Arquivo JSON inválido"));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle uploading custom Excel or JSON for Retroactive Refugos
  const handleRetroFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingRetro(true);
    setExportSuccessMsg(`Analisando arquivo '${file.name}'...`);

    try {
      const result = await parseAndProcessFile(file, audits, drivers);
      setRetroImportResult(result);
      setExportSuccessMsg(`Arquivo '${file.name}' analisado! ${result.auditsToSave.length} auditorias prontas para salvar.`);
    } catch (err: any) {
      console.error('Erro ao analisar arquivo:', err);
      alert('Erro ao analisar planilha ou JSON: ' + (err?.message || 'Arquivo inválido'));
    } finally {
      setIsProcessingRetro(false);
      if (refugoFileInputRef.current) refugoFileInputRef.current.value = '';
    }
  };

  // Pre-loaded 1-click import for public/audits_retroativos_import.json
  const handleImportPreloadedRetroJson = async () => {
    setIsProcessingRetro(true);
    setExportSuccessMsg('Buscando dataset oficial "audits_retroativos_import.json"...');

    try {
      const res = await fetch('/audits_retroativos_import.json');
      if (!res.ok) throw new Error('Arquivo audits_retroativos_import.json não encontrado no servidor');
      const json = await res.json();

      let auditsList: any[] = json.collections?.audits || json.audits || [];
      const blob = new Blob([JSON.stringify(auditsList)], { type: 'application/json' });
      const file = new File([blob], 'audits_retroativos_import.json', { type: 'application/json' });

      const result = await parseAndProcessFile(file, audits, drivers);
      setRetroImportResult(result);
      setExportSuccessMsg(`Dataset oficial carregado! ${result.auditsToSave.length} auditorias prontas para salvar.`);
    } catch (err: any) {
      console.error('Erro ao carregar JSON pré-gerado:', err);
      alert('Erro ao carregar arquivo oficial: ' + err.message);
    } finally {
      setIsProcessingRetro(false);
    }
  };

  // Save Retroactive Audit Import to Firestore
  const handleConfirmSaveRetroAudits = async () => {
    if (!retroImportResult || retroImportResult.auditsToSave.length === 0) return;

    setIsImporting(true);
    setExportSuccessMsg(`Gravando ${retroImportResult.auditsToSave.length} auditorias e ${retroImportResult.unregisteredDriversCount} motoristas no banco '${activeProjectId}'...`);

    try {
      const db = getClientFirestore();
      let totalSavedAudits = 0;
      let totalSavedDrivers = 0;

      if (db) {
        for (const drv of retroImportResult.newDriversToSave) {
          const drvRef = doc(collection(db, 'drivers'), drv.id);
          await setDoc(drvRef, drv, { merge: true });
          totalSavedDrivers++;
        }

        for (const audit of retroImportResult.auditsToSave) {
          const auditRef = doc(collection(db, 'audits'), audit.id);
          const auditData = { ...audit };
          await setDoc(auditRef, auditData, { merge: true });
          totalSavedAudits++;
        }
      }

      setExportSuccessMsg(`Importação concluída com sucesso! ${totalSavedAudits} registros gravados. Atualizando...`);
      setRetroImportResult(null);

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao salvar auditorias retroativas:', err);
      alert('Falha ao salvar no Firestore: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsImporting(false);
    }
  };

  // Generic exporter for individual modules
  const exportModuleData = (moduleName: string, data: any[], filenamePrefix: string, format: 'json' | 'csv') => {
    if (!data || data.length === 0) {
      alert(`A base de dados de ${moduleName} está vazia no momento.`);
      return;
    }

    const dateStr = getTodayBrazilStr();
    if (format === 'json') {
      const content = JSON.stringify(data, null, 2);
      downloadFile(`${filenamePrefix}_${dateStr}.json`, content, 'application/json');
    } else {
      const csv = jsonToCsv(data);
      downloadFile(`${filenamePrefix}_${dateStr}.csv`, csv, 'text/csv;charset=utf-8;');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="central_backup_view">
      {/* TOP BANNER: IDENTITY & CONTEXT */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-md shadow-blue-600/20">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                Custódia Total de Dados
              </span>
              <span className="text-xs text-slate-400 font-medium">• CD Guarabira</span>
            </div>
            <h2 className="font-sans font-black text-xl text-slate-900 mt-0.5 tracking-tight">
              Central de Backup Diário & Exportação Multiplataforma
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Gere e baixe cópias completas de todas as informações registradas na plataforma em formatos universais (JSON e Excel), garantindo portabilidade para migração ou integração com outros sistemas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="text-right hidden lg:block">
            <span className="block text-[10px] font-bold text-slate-400 uppercase">Usuário Responsável</span>
            <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-800 px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-blue-600" />
            <span>Banco: <strong className="text-blue-700">{activeProjectId}</strong></span>
          </span>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {exportSuccessMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-xs">{exportSuccessMsg}</span>
          </div>
          <button 
            onClick={() => setExportSuccessMsg(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: HERO - GERADOR DE BACKUP DIÁRIO (O QUE O USUÁRIO MAIS PRECISA) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-blue-800/40">
        <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-0 right-1/4 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 space-y-6">
          {/* Header of the Hero Card */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="bg-emerald-500 text-slate-950 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                  <Sparkles className="h-3.5 w-3.5 text-slate-950" />
                  <span>Gerador de Backup Operacional do Dia</span>
                </span>
                <span className="text-slate-400 text-xs font-medium">Exportação Pronta para Outra Plataforma</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
                Extrair Todas as Informações Registradas no Dia
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Selecione a data para empacotar automaticamente todas as contagens físicas, mapas de retorno, produtos conferidos, vasilhames, descarregamentos de empilhadeira e vales financeiros.
              </p>
            </div>

            {/* Date Filtering Controls */}
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 shrink-0 flex flex-col gap-2.5 shadow-inner">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-400" />
                  <span>Data do Registro:</span>
                </label>
                <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setFilterMode('day')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                      filterMode === 'day' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Por Dia
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                      filterMode === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Histórico Todo
                  </button>
                </div>
              </div>

              {filterMode === 'day' ? (
                <div className="space-y-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white text-xs font-bold px-3 py-2 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => setSelectedDate(getTodayBrazilStr())}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                        selectedDate === getTodayBrazilStr()
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => setSelectedDate(getPastDateStr(1))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                    >
                      Ontem
                    </button>
                    <button
                      onClick={() => setSelectedDate(getPastDateStr(2))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
                    >
                      Anteontem
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-slate-900/80 rounded-xl text-center">
                  <span className="text-xxs text-amber-400 font-bold uppercase tracking-wider block">
                    Modo Histórico Total Ativo
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Todos os registros desde o início da operação
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Real Metrics of the Selected Day */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Registros Identificados {filterMode === 'day' ? `em ${selectedDate}` : '(Histórico Total)'}:
                </span>
              </span>
              <span className="text-xxs text-slate-400 font-mono">
                {filteredAudits.length + filteredRoutes.length + dailyFlattenedItems.length + filteredCarregamentos.length + filteredVales.length} total de ocorrências
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conferências Físicas</span>
                <span className="text-2xl font-black text-white mt-1 block font-mono">{filteredAudits.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Auditorias</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mapas & Rotas</span>
                <span className="text-2xl font-black text-blue-400 mt-1 block font-mono">{filteredRoutes.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Viagens</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Produtos Contados</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block font-mono">{dailyFlattenedItems.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Linhas de PA</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Divergências PA</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-lg font-black text-emerald-400 font-mono" title="Sobras">+{totalSobras}</span>
                  <span className="text-slate-500 font-light">/</span>
                  <span className="text-lg font-black text-red-400 font-mono" title="Faltas">-{totalFaltas}</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Sobras / Faltas</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descarregamentos</span>
                <span className="text-2xl font-black text-amber-400 mt-1 block font-mono">{filteredCarregamentos.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Operações Doca</span>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-center shadow-md">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vales Emitidos</span>
                <span className="text-2xl font-black text-purple-400 mt-1 block font-mono">{filteredVales.length}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Responsabilidades</span>
              </div>
            </div>
          </div>

          {/* Action Export Buttons */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-3">
            {/* Primary JSON Export Button */}
            <button
              onClick={handleExportDailyBackupJSON}
              disabled={isExporting}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-black text-xs px-6 py-3.5 rounded-2xl flex items-center space-x-2.5 shadow-lg shadow-emerald-500/25 transition cursor-pointer"
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
              ) : (
                <FileJson className="h-4 w-4 text-slate-950" />
              )}
              <span>BAIXAR BACKUP DO DIA (.JSON PARA OUTRA PLATAFORMA)</span>
            </button>

            {/* Excel (.xlsx) Multi-tab Export */}
            <button
              onClick={handleExportDailyExcel}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs px-6 py-3.5 rounded-2xl flex items-center space-x-2.5 shadow-lg shadow-blue-600/25 transition cursor-pointer"
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 text-white" />
              )}
              <span>BAIXAR PLANILHA EXCEL DO DIA (.XLSX COM TODAS AS ABAS)</span>
            </button>

            {/* Copy JSON Button */}
            <button
              onClick={handleCopyDailyJSON}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs px-4 py-3.5 rounded-2xl flex items-center space-x-2 border border-slate-700 transition cursor-pointer"
              title="Copiar JSON estruturado para colar diretamente em outra aplicação"
            >
              {copiedJson ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-slate-400" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>

            {/* CSV Quick Exporter */}
            <button
              onClick={() => {
                if (dailyFlattenedItems.length === 0) {
                  alert('Não há itens conferidos registrados na data selecionada.');
                  return;
                }
                const csv = jsonToCsv(dailyFlattenedItems);
                downloadFile(`conferencia_itens_${selectedDate}.csv`, csv, 'text/csv;charset=utf-8;');
              }}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs px-4 py-3.5 rounded-2xl flex items-center space-x-2 border border-slate-700 transition cursor-pointer"
            >
              <Table className="h-4 w-4 text-slate-400" />
              <span>Exportar Itens (CSV)</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
            <span>
              O arquivo JSON gerado contém a estrutura completa de dados normalizados, permitindo importação direta em bancos de dados SQL/NoSQL, scripts Python, planilhas ou em outra instância desta plataforma.
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: BACKUP COMPLETO 100% DA PLATAFORMA (TODOS OS DADOS E HISTÓRICO) */}
      {/* ========================================================================= */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  Snapshot Integral (100% dos Dados)
                </span>
                <span className="text-slate-400 text-xs font-medium">• Histórico Completo</span>
              </div>
              <h4 className="text-xl font-black text-slate-900 mt-1 tracking-tight">
                Exportar e Restaurar Banco de Dados Completo
              </h4>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            Armazenamento Seguro e Portabilidade
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
          Gera um arquivo consolidado contendo a totalidade da base de dados histórica: rotas importadas, todas as auditorias físicas já realizadas, cadastros mestres de motoristas, veículos e produtos, vales, processos de descarregamento e logs. Você também pode restaurar um arquivo de backup previamente exportado.
        </p>

        {/* Global Metric Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Auditorias</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{audits.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Rotas</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{importedRoutes.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Vales</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{vales.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Produtos</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{products.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Motoristas</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{drivers.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Veículos</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{vehicles.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Usuários</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{users.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
            <span className="block text-[9px] text-slate-500 font-bold uppercase">Alertas</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{fiscalAlerts.length}</span>
          </div>
        </div>

        {/* Action Buttons for Full Backup and Restore */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportFullDatabaseJSON}
            disabled={isExporting || isImporting}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs px-6 py-3.5 rounded-xl flex items-center space-x-2.5 shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            {isExporting ? (
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Download className="h-4 w-4 text-white" />
            )}
            <span>BAIXAR BACKUP COMPLETO (100% HISTÓRICO EM JSON)</span>
          </button>

          {/* Import / Restore Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFullDatabaseJSON}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isExporting || isImporting}
            className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-xs px-5 py-3.5 rounded-xl flex items-center space-x-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            {isImporting ? (
              <RefreshCw className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Upload className="h-4 w-4 text-white" />
            )}
            <span>RESTAURAR / IMPORTAR BACKUP JSON</span>
          </button>

          <a
            href="/api/export-database"
            download="backup_completo_plataforma.json"
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3.5 rounded-xl flex items-center space-x-2 border border-slate-900 shadow-xs transition cursor-pointer"
          >
            <FileJson className="h-4 w-4 text-emerald-400" />
            <span>Download Direto Servidor (.json)</span>
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: ESPELHO DE CONTINGÊNCIA EXTERNO (GITHUB PAGES) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
            <ExternalLink className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-blue-900/60 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-700">
                Espelho de Contingência Remoto
              </span>
              <span className="text-slate-400 text-xs font-medium">• GitHub Pages</span>
            </div>
            <h4 className="text-lg font-bold text-white mt-1">
              Plataforma Alternativa de Backup e Acesso Externo
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
              Você pode acessar o ambiente espelho hospedado no GitHub Pages (<code className="font-mono text-blue-300">nhpa-cyber.github.io/Retorno-de/</code>) para consultas ou sincronização remota a qualquer momento.
            </p>
          </div>
        </div>

        <a
          href="https://nhpa-cyber.github.io/Retorno-de/"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-3.5 rounded-xl flex items-center justify-center space-x-2 shrink-0 transition shadow-md shadow-blue-600/30 cursor-pointer"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Acessar Espelho no GitHub</span>
        </a>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: IMPORTAÇÃO RETROATIVA DE REFUGO & AVARIA (FERRAMENTA EXISTENTE) */}
      {/* ========================================================================= */}
      <div className="bg-white border-2 border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5 relative overflow-hidden" id="card_import_refugo_retroativo">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Importação Retroativa de Refugo & Avaria</span>
            </span>
            <span className="text-slate-500 text-xs font-medium">• Planilhas Excel (.xlsx/.xls/.csv) ou JSON</span>
          </div>
          <span className="text-xxs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
            Destino: Collection 'audits' ({activeProjectId})
          </span>
        </div>

        <div>
          <h4 className="text-lg font-black text-slate-900 tracking-tight">
            Importar Registros Históricos de Refugo e Avaria
          </h4>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Importe mapas retroativos da aba <strong className="text-slate-800 font-bold">Import_Refugo_Rota</strong> de planilhas Excel ou do dataset oficial <strong className="text-slate-800 font-bold">audits_retroativos_import.json</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 flex items-start space-x-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-amber-900 block">Proteção de Conferência Real</span>
              <span className="text-[10px] text-amber-800/80 leading-tight block mt-0.5">
                Mapas com contagem física real realizada por conferentes NÃO são sobrescritos.
              </span>
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 flex items-start space-x-2.5">
            <UserPlus className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-blue-900 block">Cadastro Automático de Motoristas</span>
              <span className="text-[10px] text-blue-800/80 leading-tight block mt-0.5">
                Motoristas não encontrados na base são cadastrados automaticamente.
              </span>
            </div>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3 flex items-start space-x-2.5">
            <FileCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-emerald-900 block">Marcação Estimativa Histórica</span>
              <span className="text-[10px] text-emerald-800/80 leading-tight block mt-0.5">
                Cada documento recebe a flag <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">isEstimated: true</code>.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <input
            type="file"
            ref={refugoFileInputRef}
            onChange={handleRetroFileChange}
            accept=".xlsx,.xls,.csv,.json"
            className="hidden"
          />

          <button
            onClick={handleImportPreloadedRetroJson}
            disabled={isProcessingRetro || isImporting}
            className="bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black text-xs px-5 py-3 rounded-xl flex items-center space-x-2 shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            {isProcessingRetro ? (
              <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
            ) : (
              <Sparkles className="h-4 w-4 text-slate-950" />
            )}
            <span>1. Carregar Dataset Oficial (audits_retroativos_import.json)</span>
          </button>

          <button
            onClick={() => refugoFileInputRef.current?.click()}
            disabled={isProcessingRetro || isImporting}
            className="bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center space-x-2 border border-slate-900 shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            <span>2. Selecionar Planilha Excel (.xlsx, .csv) ou JSON</span>
          </button>
        </div>

        {retroImportResult && (
          <div className="bg-slate-900 text-white rounded-xl p-5 space-y-4 border border-slate-800 animate-fade-in shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <h5 className="font-bold text-sm text-white">Análise Prévia do Dataset</h5>
              </div>
              <span className="text-xxs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                Pronto para Gravação
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Mapas</span>
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
                onClick={() => setRetroImportResult(null)}
                className="text-xs text-slate-400 hover:text-white underline font-medium cursor-pointer"
              >
                Cancelar Análise
              </button>
              <button
                onClick={handleConfirmSaveRetroAudits}
                disabled={isImporting}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-6 py-3 rounded-xl flex items-center space-x-2 shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                {isImporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-slate-950" />
                ) : (
                  <Upload className="h-4 w-4 text-slate-950" />
                )}
                <span>CONFIRMAR E SALVAR NO BANCO</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: EXPORTAÇÃO POR MÓDULOS ESPECÍFICOS */}
      {/* ========================================================================= */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-200">
          <Layers className="h-4 w-4 text-blue-600" />
          <h4 className="font-sans font-black text-xs text-slate-900 uppercase tracking-wider">
            Exportar Dados por Módulos Individuais
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rotas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-2xs hover:border-blue-300 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Box className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Rotas e Históricos de Viagens</h5>
                  <p className="text-xxs text-slate-500 mt-0.5">{importedRoutes.length} rotas cadastradas</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporta todas as rotas processadas, placas, motoristas, horários e status.
            </p>
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => exportModuleData('Rotas', importedRoutes, 'rotas_plataforma', 'json')}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <FileJson className="h-4 w-4 text-blue-600" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => exportModuleData('Rotas', importedRoutes, 'rotas_plataforma', 'csv')}
                className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer border border-emerald-200"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Auditorias */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-2xs hover:border-amber-300 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                  <Table className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Contagens Físicas e Conciliação</h5>
                  <p className="text-xxs text-slate-500 mt-0.5">{audits.length} auditorias físicas</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporta conferências físicas, contagens de PA, vasilhames e conferentes.
            </p>
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => exportModuleData('Auditorias', audits, 'auditorias_contagem_fisica', 'json')}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <FileJson className="h-4 w-4 text-amber-600" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => exportModuleData('Auditorias', audits, 'auditorias_contagem_fisica', 'csv')}
                className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer border border-emerald-200"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Vales */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-2xs hover:border-indigo-300 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Ticket className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Gestão de Vales Financeiros</h5>
                  <p className="text-xxs text-slate-500 mt-0.5">{vales.length} vales emitidos</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporta histórico de vales emitidos para motoristas, valores e compensação.
            </p>
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => exportModuleData('Vales', vales, 'vales_financeiros', 'json')}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <FileJson className="h-4 w-4 text-indigo-600" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => exportModuleData('Vales', vales, 'vales_financeiros', 'csv')}
                className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer border border-emerald-200"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Cadastros */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3.5 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Cadastros Mestres da Plataforma</h5>
                  <p className="text-xxs text-slate-500 mt-0.5">{products.length} produtos | {drivers.length} motoristas</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporta tabela de produtos, motoristas, frotas de veículos e usuários.
            </p>
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const masterCadastros = { users, drivers, vehicles, products, activeAssets };
                  downloadFile(`cadastros_mestres_${getTodayBrazilStr()}.json`, JSON.stringify(masterCadastros, null, 2), 'application/json');
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
              >
                <FileJson className="h-4 w-4 text-emerald-600" />
                <span>JSON</span>
              </button>
              <button
                onClick={() => exportModuleData('Produtos', products, 'produtos_cadastrados', 'csv')}
                className="flex-1 py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer border border-emerald-200"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Produtos (CSV)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
