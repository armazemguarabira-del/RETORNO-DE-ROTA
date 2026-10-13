import React, { useState, useMemo } from 'react';
import { User, Product, AuditSession, ControleSobraItem } from '../types';
import { 
  PackageCheck, Search, Plus, Filter, Download, FileSpreadsheet, 
  FileText, Calendar, Clock, AlertTriangle, CheckCircle, ArrowRight,
  RotateCcw, Trash2, Edit3, X, Building, Truck, ShieldAlert, Check, RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ControleSobrasViewProps {
  currentUser: User;
  audits: AuditSession[];
  onSaveAudits?: (audits: AuditSession[]) => void;
  products: Product[];
  controleSobras: ControleSobraItem[];
  onSaveControleSobras: (sobras: ControleSobraItem[]) => void;
}

export default function ControleSobrasView({
  currentUser,
  audits = [],
  onSaveAudits,
  products = [],
  controleSobras = [],
  onSaveControleSobras
}: ControleSobrasViewProps) {
  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDENTE' | 'ENVIADO' | 'DEVOLVIDO'>('TODOS');
  const [prazoFilter, setPrazoFilter] = useState<'TODOS' | 'DENTRO_PRAZO' | 'CRITICO_7D' | 'VENCIDO'>('TODOS');
  const [sortField, setSortField] = useState<keyof ControleSobraItem>('mapDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [selectedItemForBaixa, setSelectedItemForBaixa] = useState<ControleSobraItem | null>(null);

  // Manual Item Form
  const [manualForm, setManualForm] = useState({
    productCode: '',
    productDescription: '',
    quantity: 1,
    routeMap: '',
    mapDate: new Date().toISOString().split('T')[0],
    notes: '',
    clientCodeNB: ''
  });

  // Baixa Form
  const [baixaForm, setBaixaForm] = useState<{
    status: 'ENVIADO' | 'DEVOLVIDO';
    destination: 'CLIENTE' | 'ESTOQUE';
    clientCodeNB: string;
    clientName: string;
    deliveryDate: string;
    notes: string;
  }>({
    status: 'DEVOLVIDO',
    destination: 'ESTOQUE',
    clientCodeNB: '',
    clientName: '',
    deliveryDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // Calculate 30-day deadline date from map date (YYYY-MM-DD)
  const calculateDeadline = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + 30);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // Fallback
    }
    return dateStr;
  };

  // Format date YYYY-MM-DD -> DD/MM/YYYY
  const formatDateBR = (dateStr: string): string => {
    if (!dateStr) return '-';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Calculate days remaining or expired
  const getDaysDiff = (deadlineDateStr: string): number => {
    if (!deadlineDateStr) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = deadlineDateStr.split('-');
    if (parts.length !== 3) return 0;
    const deadline = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Harmonize automatic surplus items from audits with existing controleSobras
  const allSobras = useMemo(() => {
    const list: ControleSobraItem[] = [...controleSobras];
    const existingAuditProductKeys = new Set(
      list.map(s => `${s.auditId || ''}_${s.routeMap}_${s.productCode}`)
    );

    // Scan audits for P.A. surplus items
    audits.forEach(audit => {
      if (!audit.items || audit.items.length === 0) return;
      const mapDate = audit.arrivalDate || new Date().toISOString().split('T')[0];
      const deadlineDate = calculateDeadline(mapDate);

      audit.items.forEach(item => {
        const phys = item.rePhysicalQty !== undefined ? item.rePhysicalQty : item.physicalQty;
        const fisc = item.fiscalQty ?? 0;
        const comodato = item.comodatoQty ?? 0;
        const recolha = item.recolhaQty ?? 0;
        const fiscExpected = fisc - comodato + recolha;
        const surplusQty = phys - fiscExpected;

        if (surplusQty > 0) {
          const key = `${audit.id}_${audit.routeMap}_${item.productCode}`;
          if (!existingAuditProductKeys.has(key)) {
            // Determine initial status based on audit fields
            let status: 'PENDENTE' | 'ENVIADO' | 'DEVOLVIDO' = 'PENDENTE';
            if (audit.surplusFlowStatus === 'ENVIADO') {
              status = 'ENVIADO';
            } else if (audit.surplusFlowStatus === 'BAIXADO') {
              status = 'DEVOLVIDO';
            }

            list.push({
              id: `auto_${audit.id}_${item.productCode}`,
              productCode: item.productCode,
              productDescription: item.productDescription || products.find(p => p.code === item.productCode)?.description || `Produto ${item.productCode}`,
              quantity: surplusQty,
              routeMap: audit.routeMap || 'S/M',
              mapDate,
              deadlineDate,
              status,
              destination: status === 'ENVIADO' ? 'CLIENTE' : status === 'DEVOLVIDO' ? 'ESTOQUE' : undefined,
              auditId: audit.id,
              isManual: false,
              clientCodeNB: audit.clientCodeNB || '',
              driverName: audit.driverId || '',
              plate: audit.plate || '',
              notes: audit.correctiveActionNotes || '',
              createdAt: audit.startTime || new Date().toISOString()
            });
            existingAuditProductKeys.add(key);
          }
        }
      });
    });

    return list;
  }, [audits, controleSobras, products]);

  // Filtered and Sorted list
  const filteredSobras = useMemo(() => {
    return allSobras.filter(item => {
      // Search
      const search = searchTerm.toLowerCase().trim();
      if (search) {
        const matchesCode = item.productCode.toLowerCase().includes(search);
        const matchesDesc = item.productDescription.toLowerCase().includes(search);
        const matchesMap = item.routeMap.toLowerCase().includes(search);
        const matchesClient = (item.clientCodeNB || '').toLowerCase().includes(search);
        if (!matchesCode && !matchesDesc && !matchesMap && !matchesClient) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'TODOS' && item.status !== statusFilter) {
        return false;
      }

      // Prazo
      if (prazoFilter !== 'TODOS') {
        const diff = getDaysDiff(item.deadlineDate);
        if (prazoFilter === 'DENTRO_PRAZO' && (diff < 0 || diff <= 7)) return false;
        if (prazoFilter === 'CRITICO_7D' && (diff < 0 || diff > 7)) return false;
        if (prazoFilter === 'VENCIDO' && diff >= 0) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'quantity') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [allSobras, searchTerm, statusFilter, prazoFilter, sortField, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    let totalPendentes = 0;
    let totalEnviados = 0;
    let totalDevolvidos = 0;
    let criticos7d = 0;
    let vencidos = 0;

    allSobras.forEach(item => {
      if (item.status === 'PENDENTE') {
        totalPendentes += item.quantity;
        const diff = getDaysDiff(item.deadlineDate);
        if (diff < 0) {
          vencidos++;
        } else if (diff <= 7) {
          criticos7d++;
        }
      } else if (item.status === 'ENVIADO') {
        totalEnviados += item.quantity;
      } else if (item.status === 'DEVOLVIDO') {
        totalDevolvidos += item.quantity;
      }
    });

    return {
      totalSobras: allSobras.length,
      totalPendentes,
      totalEnviados,
      totalDevolvidos,
      criticos7d,
      vencidos
    };
  }, [allSobras]);

  // Sort toggle handler
  const handleSort = (field: keyof ControleSobraItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Direct status update handler
  const handleDirectStatusChange = (item: ControleSobraItem, newStatus: 'PENDENTE' | 'ENVIADO' | 'DEVOLVIDO') => {
    if (newStatus === 'PENDENTE') {
      const updated = allSobras.map(s => s.id === item.id ? {
        ...s,
        status: newStatus,
        destination: undefined,
        resolvedAt: undefined,
        resolvedBy: undefined,
        updatedAt: new Date().toISOString()
      } : s);
      onSaveControleSobras(updated);
      return;
    }

    // If changing to ENVIADO or DEVOLVIDO, open modal for complete recording
    setSelectedItemForBaixa(item);
    setBaixaForm({
      status: newStatus,
      destination: newStatus === 'ENVIADO' ? 'CLIENTE' : 'ESTOQUE',
      clientCodeNB: item.clientCodeNB || '',
      clientName: item.clientName || '',
      deliveryDate: new Date().toISOString().split('T')[0],
      notes: item.notes || ''
    });
    setShowBaixaModal(true);
  };

  // Confirm Baixa / Resolution
  const handleConfirmBaixa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForBaixa) return;

    const timestamp = new Date().toISOString();
    const updatedList = allSobras.map(item => {
      if (item.id === selectedItemForBaixa.id) {
        return {
          ...item,
          status: baixaForm.status,
          destination: baixaForm.destination,
          clientCodeNB: baixaForm.clientCodeNB,
          clientName: baixaForm.clientName,
          notes: baixaForm.notes,
          resolvedAt: timestamp,
          resolvedBy: currentUser.name,
          updatedAt: timestamp
        };
      }
      return item;
    });

    onSaveControleSobras(updatedList);

    // If item was tied to an audit, update audit surplus status as well
    if (selectedItemForBaixa.auditId && onSaveAudits) {
      const updatedAudits = audits.map(audit => {
        if (audit.id === selectedItemForBaixa.auditId) {
          return {
            ...audit,
            surplusFlowStatus: (baixaForm.status === 'ENVIADO' ? 'ENVIADO' : 'BAIXADO') as any,
            clientCodeNB: baixaForm.clientCodeNB || audit.clientCodeNB,
            correctiveActionNotes: baixaForm.notes || audit.correctiveActionNotes,
            updatedAt: timestamp,
            lastUpdatedBy: currentUser.name
          };
        }
        return audit;
      });
      onSaveAudits(updatedAudits);
    }

    setShowBaixaModal(false);
    setSelectedItemForBaixa(null);
  };

  // Add Manual Item
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.productCode || !manualForm.routeMap || manualForm.quantity <= 0) {
      alert('Por favor, preencha o código do produto, mapa e quantidade válida.');
      return;
    }

    const mapDate = manualForm.mapDate || new Date().toISOString().split('T')[0];
    const deadlineDate = calculateDeadline(mapDate);
    const desc = manualForm.productDescription || products.find(p => p.code === manualForm.productCode)?.description || `Produto ${manualForm.productCode}`;

    const newItem: ControleSobraItem = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      productCode: manualForm.productCode.trim(),
      productDescription: desc.trim(),
      quantity: Number(manualForm.quantity),
      routeMap: manualForm.routeMap.trim(),
      mapDate,
      deadlineDate,
      status: 'PENDENTE',
      isManual: true,
      clientCodeNB: manualForm.clientCodeNB.trim(),
      notes: manualForm.notes.trim(),
      registeredBy: currentUser.name,
      createdAt: new Date().toISOString()
    };

    onSaveControleSobras([newItem, ...allSobras]);
    setShowManualModal(false);
    setManualForm({
      productCode: '',
      productDescription: '',
      quantity: 1,
      routeMap: '',
      mapDate: new Date().toISOString().split('T')[0],
      notes: '',
      clientCodeNB: ''
    });
  };

  // Delete manual item
  const handleDeleteManualItem = (id: string) => {
    if (confirm('Deseja realmente remover esta sobra lançada manualmente?')) {
      const updated = allSobras.filter(s => s.id !== id);
      onSaveControleSobras(updated);
    }
  };

  // Export to Excel with exact table format, colors, headers, and model
  const handleExportExcel = () => {
    const totalQtd = filteredSobras.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const currentDateStr = new Date().toLocaleString('pt-BR');

    let rowsHtml = '';
    filteredSobras.forEach((item, idx) => {
      const daysDiff = getDaysDiff(item.deadlineDate);
      const isExpired = daysDiff < 0;
      const isCritical = daysDiff >= 0 && daysDiff <= 7;
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

      let prazoBg = '#dcfce7';
      let prazoColor = '#064e3b';
      let prazoBorder = '#86efac';
      let prazoStatusText = `${daysDiff}d restantes`;
      if (isExpired) {
        prazoBg = '#fee2e2';
        prazoColor = '#991b1b';
        prazoBorder = '#f87171';
        prazoStatusText = `Vencido há ${Math.abs(daysDiff)}d`;
      } else if (isCritical) {
        prazoBg = '#fef3c7';
        prazoColor = '#92400e';
        prazoBorder = '#fcd34d';
        prazoStatusText = `Crítico (${daysDiff}d)`;
      }

      let statusBg = '#fef3c7';
      let statusColor = '#b45309';
      let statusBorder = '#fcd34d';
      if (item.status === 'ENVIADO') {
        statusBg = '#d1fae5';
        statusColor = '#065f46';
        statusBorder = '#6ee7b7';
      } else if (item.status === 'DEVOLVIDO') {
        statusBg = '#dbeafe';
        statusColor = '#1e40af';
        statusBorder = '#93c5fd';
      }

      rowsHtml += `
        <tr style="background-color: ${rowBg}; height: 26px;">
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-family: Consolas, monospace;">${item.productCode}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-weight: 600;">${item.productDescription}${item.isManual ? ' [Manual]' : ''}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-family: Consolas, monospace;">${item.quantity}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace;">${item.routeMap}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${formatDateBR(item.mapDate)}</td>
          <td style="border: 1px solid ${prazoBorder}; background-color: ${prazoBg}; color: ${prazoColor}; text-align: center; font-weight: bold;">
            ${formatDateBR(item.deadlineDate)} <span style="font-size: 8pt;">(${prazoStatusText})</span>
          </td>
          <td style="border: 1px solid ${statusBorder}; background-color: ${statusBg}; color: ${statusColor}; text-align: center; font-weight: bold;">
            ${item.status}
          </td>
          <td style="border: 1px solid #cbd5e1; text-align: center;">${item.destination || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: center; font-family: Consolas, monospace;">${item.clientCodeNB || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left;">${item.registeredBy || 'Sistema'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left;">${item.resolvedBy || '-'}</td>
          <td style="border: 1px solid #cbd5e1; text-align: left; font-style: italic;">${item.notes || ''}</td>
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
                  <x:Name>Controle de Sobras</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; width: 100%; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
            th { background-color: #f59e0b; color: #000000; font-weight: bold; border: 1px solid #d97706; padding: 8px 6px; text-align: center; text-transform: uppercase; font-size: 9.5pt; }
            td { padding: 6px 8px; vertical-align: middle; }
          </style>
        </head>
        <body>
          <table>
            <!-- Title Header -->
            <tr>
              <th colspan="12" style="background-color: #0f172a; color: #f59e0b; font-size: 13pt; font-weight: bold; text-align: center; height: 35px; border: 1px solid #0f172a;">
                PAU BRASIL DISTRIBUIDORA AMBEV - CONTROLE E GESTÃO DE SOBRAS DE P.A.
              </th>
            </tr>
            <tr>
              <td colspan="12" style="background-color: #1e293b; color: #e2e8f0; font-size: 8.5pt; text-align: center; height: 22px; border: 1px solid #1e293b;">
                Exportação Gerada em: <b>${currentDateStr}</b> | Usuário: <b>${currentUser.name}</b> | Filtro Status: <b>${statusFilter}</b> | Total de Registros: <b>${filteredSobras.length}</b>
              </td>
            </tr>
            <tr style="height: 10px;"><td colspan="12" style="border: none;"></td></tr>

            <!-- Table Columns matching Platform View -->
            <tr>
              <th style="width: 90px;">CÓDIGO</th>
              <th style="width: 280px; text-align: left;">PRODUTO</th>
              <th style="width: 85px;">QUANTIDADE</th>
              <th style="width: 90px;">MAPA</th>
              <th style="width: 95px;">DATA</th>
              <th style="width: 170px;">PRAZO DE ENVIO</th>
              <th style="width: 120px;">STATUS DE ENVIO</th>
              <th style="width: 100px;">DESTINO</th>
              <th style="width: 100px;">CLIENTE (NB)</th>
              <th style="width: 130px; text-align: left;">REGISTRADO POR</th>
              <th style="width: 130px; text-align: left;">BAIXADO POR</th>
              <th style="width: 220px; text-align: left;">OBSERVAÇÕES</th>
            </tr>

            <!-- Data Rows -->
            ${rowsHtml}

            <!-- Summary / Footer Row -->
            <tr style="background-color: #f1f5f9; height: 30px; font-weight: bold; border-top: 2px solid #0f172a;">
              <td colspan="2" style="border: 1px solid #94a3b8; text-align: right; font-weight: bold; padding-right: 12px;">
                TOTAL GERAL:
              </td>
              <td style="border: 1px solid #94a3b8; text-align: center; font-weight: bold; font-family: Consolas, monospace; background-color: #fef3c7; color: #b45309; font-size: 11pt;">
                ${totalQtd}
              </td>
              <td colspan="9" style="border: 1px solid #94a3b8; text-align: left; font-size: 8.5pt; color: #64748b;">
                ${filteredSobras.length} linhas filtradas
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob(["\uFEFF" + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `controle_de_sobras_${new Date().toISOString().split('T')[0]}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('PAU BRASIL DISTRIBUIDORA AMBEV - CONTROLE DE SOBRAS DE P.A.', 14, 14);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Relatório emitido em: ${new Date().toLocaleString('pt-BR')} • Responsável: ${currentUser.name} • Total de Itens: ${filteredSobras.length}`, 14, 20);

    // Table Header
    let startY = 26;
    doc.setFillColor(245, 158, 11);
    doc.rect(14, startY, 269, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('CÓDIGO', 16, startY + 4.8);
    doc.text('PRODUTO', 36, startY + 4.8);
    doc.text('QTD', 135, startY + 4.8);
    doc.text('MAPA', 150, startY + 4.8);
    doc.text('DATA', 170, startY + 4.8);
    doc.text('PRAZO (30D)', 195, startY + 4.8);
    doc.text('STATUS', 225, startY + 4.8);
    doc.text('DESTINO / NB', 250, startY + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    startY += 7;

    filteredSobras.forEach((item, index) => {
      if (startY > 185) {
        doc.addPage();
        startY = 20;
        // Repeat header on new page
        doc.setFillColor(245, 158, 11);
        doc.rect(14, startY, 269, 7, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('CÓDIGO', 16, startY + 4.8);
        doc.text('PRODUTO', 36, startY + 4.8);
        doc.text('QTD', 135, startY + 4.8);
        doc.text('MAPA', 150, startY + 4.8);
        doc.text('DATA', 170, startY + 4.8);
        doc.text('PRAZO (30D)', 195, startY + 4.8);
        doc.text('STATUS', 225, startY + 4.8);
        doc.text('DESTINO / NB', 250, startY + 4.8);
        startY += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, startY, 269, 6.5, 'F');
      }

      const truncDesc = item.productDescription.length > 50 
        ? item.productDescription.substring(0, 48) + '...' 
        : item.productDescription;

      doc.text(item.productCode, 16, startY + 4.5);
      doc.text(truncDesc, 36, startY + 4.5);
      doc.text(item.quantity.toString(), 135, startY + 4.5);
      doc.text(item.routeMap, 150, startY + 4.5);
      doc.text(formatDateBR(item.mapDate), 170, startY + 4.5);
      doc.text(formatDateBR(item.deadlineDate), 195, startY + 4.5);
      doc.text(item.status, 225, startY + 4.5);
      doc.text(`${item.destination || '-'} ${item.clientCodeNB ? `(${item.clientCodeNB})` : ''}`, 250, startY + 4.5);

      startY += 6.5;
    });

    doc.save(`controle_sobras_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-6 space-y-6 animate-fade-in" id="controle_sobras_view">
      
      {/* Top Banner & Title Area Faithful to Image 1 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-150">
          
          {/* Left: Date Badge & Title */}
          <div className="flex items-center gap-4">
            <div className="bg-black text-white font-mono font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-md tracking-wider shadow-sm flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              <span>{formatDateBR(new Date().toISOString().split('T')[0])}</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-sans uppercase flex items-center gap-2">
                <span>CONTROLE DE SOBRAS</span>
                <span className="text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full lowercase font-mono">
                  validade 30 dias
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Mapeamento definitivo das sobras físicas de P.A. da operação até a baixa (devolução ao estoque ou envio ao cliente).
              </p>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowManualModal(true)}
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl border border-amber-600 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nova Sobra Manual</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-2 rounded-xl border border-emerald-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Exportar dados para Excel (.CSV)"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs px-3 py-2 rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Exportar relatório em PDF"
            >
              <FileText className="h-4 w-4 text-red-600" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Logistics Analyst KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
            <div className="flex items-center justify-between text-amber-800 text-xxs font-extrabold uppercase">
              <span>Sobras Pendentes</span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-2xl font-black text-amber-950 font-mono">
              {stats.totalPendentes} <span className="text-xs font-normal text-amber-800">un</span>
            </div>
            <div className="text-[10px] text-amber-700 font-medium">Aguardando baixa no pátio</div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3">
            <div className="flex items-center justify-between text-rose-800 text-xxs font-extrabold uppercase">
              <span>Alerta Crítico (≤ 7 dias)</span>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-2xl font-black text-rose-950 font-mono">
              {stats.criticos7d} <span className="text-xs font-normal text-rose-800">itens</span>
            </div>
            <div className="text-[10px] text-rose-700 font-medium">Próximos de expirar o prazo</div>
          </div>

          <div className="bg-red-50/80 border border-red-300 rounded-xl p-3">
            <div className="flex items-center justify-between text-red-800 text-xxs font-extrabold uppercase">
              <span>Vencidos (&gt; 30 dias)</span>
              <ShieldAlert className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-2xl font-black text-red-900 font-mono">
              {stats.vencidos} <span className="text-xs font-normal text-red-700">itens</span>
            </div>
            <div className="text-[10px] text-red-700 font-medium">Urgência de baixa imediata</div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center justify-between text-blue-800 text-xxs font-extrabold uppercase">
              <span>Devolvido ao Estoque</span>
              <RotateCcw className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-2xl font-black text-blue-950 font-mono">
              {stats.totalDevolvidos} <span className="text-xs font-normal text-blue-800">un</span>
            </div>
            <div className="text-[10px] text-blue-700 font-medium">Reintegradas ao armazém</div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
            <div className="flex items-center justify-between text-emerald-800 text-xxs font-extrabold uppercase">
              <span>Enviado ao Cliente</span>
              <Truck className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 text-2xl font-black text-emerald-950 font-mono">
              {stats.totalEnviados} <span className="text-xs font-normal text-emerald-800">un</span>
            </div>
            <div className="text-[10px] text-emerald-700 font-medium">Reencaminhadas em rota</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, produto, mapa ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            {(['TODOS', 'PENDENTE', 'ENVIADO', 'DEVOLVIDO'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xxs tracking-wider uppercase cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'TODOS' ? 'Todos' : st === 'PENDENTE' ? 'Pendentes' : st === 'ENVIADO' ? 'Enviados' : 'Devolvidos'}
              </button>
            ))}
          </div>

          {/* Prazo Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 text-xxs font-bold uppercase">Prazo:</span>
            <select
              value={prazoFilter}
              onChange={(e) => setPrazoFilter(e.target.value as any)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="TODOS">Todos os Prazos</option>
              <option value="DENTRO_PRAZO">Dentro do Prazo (&gt;7 dias)</option>
              <option value="CRITICO_7D">⚠️ Crítico (≤ 7 dias)</option>
              <option value="VENCIDO">🚨 Vencidos (&gt;30 dias)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Styled Exactly as Image 1 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* Table Header: Golden/Amber styled like Image 1 */}
            <thead>
              <tr className="bg-[#f59e0b] text-slate-950 font-black tracking-wider text-xs border-b border-amber-600 select-none">
                <th 
                  onClick={() => handleSort('productCode')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-amber-600/20 transition text-center whitespace-nowrap"
                  title="Ordenar por Código"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>CODIGO</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('productDescription')} 
                  className="py-3 px-3.5 cursor-pointer hover:bg-amber-600/20 transition whitespace-nowrap min-w-[280px]"
                  title="Ordenar por Descrição do Produto"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>PRODUTO</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('quantity')} 
                  className="py-3 px-3 text-center cursor-pointer hover:bg-amber-600/20 transition whitespace-nowrap"
                  title="Ordenar por Quantidade"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>QUANTIDADE</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('routeMap')} 
                  className="py-3 px-3 text-center cursor-pointer hover:bg-amber-600/20 transition whitespace-nowrap"
                  title="Ordenar por Mapa"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>MAPA</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('mapDate')} 
                  className="py-3 px-3 text-center cursor-pointer hover:bg-amber-600/20 transition whitespace-nowrap"
                  title="Ordenar por Data do Mapa"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>DATA</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('deadlineDate')} 
                  className="py-3 px-3 text-center cursor-pointer hover:bg-amber-600/20 transition whitespace-nowrap"
                  title="Ordenar por Prazo de Envio (30 dias)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>PRAZO DE ENVIO</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th 
                  className="py-3 px-3 text-center whitespace-nowrap min-w-[140px]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>STATUS DE ENVIO</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap min-w-[130px]">
                  <span>AÇÃO</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-150">
              {filteredSobras.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <PackageCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-sm text-slate-600">Nenhuma sobra encontrada</p>
                    <p className="text-xs text-slate-400 mt-0.5">Nenhum item corresponde aos filtros aplicados.</p>
                  </td>
                </tr>
              ) : (
                filteredSobras.map((item, idx) => {
                  const daysDiff = getDaysDiff(item.deadlineDate);
                  const isExpired = daysDiff < 0;
                  const isCritical = daysDiff >= 0 && daysDiff <= 7;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      {/* CÓDIGO */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-150">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {item.productCode}
                        </span>
                      </td>

                      {/* PRODUTO */}
                      <td className="py-2.5 px-3.5 font-sans font-semibold text-slate-800 border-r border-slate-150">
                        <div className="flex flex-col">
                          <span>{item.productDescription}</span>
                          {item.isManual && (
                            <span className="text-[10px] font-mono font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                              • Lançamento Manual {item.registeredBy ? `(${item.registeredBy})` : ''}
                            </span>
                          )}
                          {item.notes && (
                            <span className="text-[10px] text-slate-400 italic">
                              Obs: {item.notes}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* QUANTIDADE */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 text-sm border-r border-slate-150">
                        {item.quantity}
                      </td>

                      {/* MAPA */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 border-r border-slate-150">
                        {item.routeMap}
                      </td>

                      {/* DATA */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-700 border-r border-slate-150">
                        {formatDateBR(item.mapDate)}
                      </td>

                      {/* PRAZO DE ENVIO: Pastel green background matching Image 1 */}
                      <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-950 bg-[#dcfce7] border-r border-emerald-200">
                        <div className="flex flex-col items-center">
                          <span>{formatDateBR(item.deadlineDate)}</span>
                          {item.status === 'PENDENTE' && (
                            <span className={`text-[10px] font-sans font-extrabold ${
                              isExpired 
                                ? 'text-red-700 bg-red-100 px-1.5 py-0.2 rounded border border-red-300' 
                                : isCritical 
                                ? 'text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300' 
                                : 'text-emerald-700'
                            }`}>
                              {isExpired ? `Vencido há ${Math.abs(daysDiff)}d` : `${daysDiff}d restantes`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* STATUS DE ENVIO: Warm yellow cell matching Image 1 with Dropdown */}
                      <td className={`py-2 px-3 text-center border-r border-slate-150 ${
                        item.status === 'PENDENTE' 
                          ? 'bg-[#fef3c7] text-[#b45309]' 
                          : item.status === 'ENVIADO' 
                          ? 'bg-emerald-50 text-emerald-800' 
                          : 'bg-blue-50 text-blue-800'
                      }`}>
                        <div className="relative inline-block w-full">
                          <select
                            value={item.status}
                            onChange={(e) => handleDirectStatusChange(item, e.target.value as any)}
                            className="w-full text-xs font-black tracking-wider uppercase bg-transparent py-1 px-2 rounded cursor-pointer text-center focus:outline-none focus:ring-1 focus:ring-amber-500 border border-transparent hover:border-amber-400"
                          >
                            <option value="PENDENTE" className="bg-white text-amber-800 font-bold">PENDENTE</option>
                            <option value="ENVIADO" className="bg-white text-emerald-800 font-bold">ENVIADO</option>
                            <option value="DEVOLVIDO" className="bg-white text-blue-800 font-bold">DEVOLVIDO</option>
                          </select>
                        </div>
                      </td>

                      {/* AÇÃO: Action buttons */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.status === 'PENDENTE' ? (
                            <button
                              onClick={() => {
                                setSelectedItemForBaixa(item);
                                setBaixaForm({
                                  status: 'DEVOLVIDO',
                                  destination: 'ESTOQUE',
                                  clientCodeNB: item.clientCodeNB || '',
                                  clientName: item.clientName || '',
                                  deliveryDate: new Date().toISOString().split('T')[0],
                                  notes: item.notes || ''
                                });
                                setShowBaixaModal(true);
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xxs uppercase px-2.5 py-1.5 rounded-lg border border-amber-600 shadow-xs transition cursor-pointer flex items-center gap-1"
                              title="Dar baixa no item (devolver ao estoque ou encaminhar ao cliente)"
                            >
                              <CheckCircle className="h-3 w-3" />
                              <span>Dar Baixa</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedItemForBaixa(item);
                                setBaixaForm({
                                  status: item.status as any,
                                  destination: item.destination || 'ESTOQUE',
                                  clientCodeNB: item.clientCodeNB || '',
                                  clientName: item.clientName || '',
                                  deliveryDate: item.resolvedAt ? item.resolvedAt.split('T')[0] : new Date().toISOString().split('T')[0],
                                  notes: item.notes || ''
                                });
                                setShowBaixaModal(true);
                              }}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xxs px-2 py-1 rounded-lg border border-slate-300 transition cursor-pointer flex items-center gap-1"
                              title="Ver detalhes da baixa / alterar"
                            >
                              <Edit3 className="h-3 w-3 text-slate-600" />
                              <span>Detalhes</span>
                            </button>
                          )}

                          {item.isManual && (
                            <button
                              onClick={() => handleDeleteManualItem(item.id)}
                              className="p-1 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition cursor-pointer"
                              title="Excluir sobra manual"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Summary & Legend */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-700">
              Total listado: {filteredSobras.length} itens ({filteredSobras.reduce((acc, i) => acc + i.quantity, 0)} unidades)
            </span>
            <div className="flex items-center gap-2 text-xxs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-[#fef3c7] border border-amber-400"></span>
                <span>Pendente</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-100 border border-emerald-400"></span>
                <span>Enviado ao Cliente</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-100 border border-blue-400"></span>
                <span>Devolvido ao Estoque</span>
              </span>
            </div>
          </div>
          <div className="text-xxs text-slate-400 font-medium">
            Prazo de validade legal de 30 dias contados a partir da data de fechamento do mapa.
          </div>
        </div>
      </div>

      {/* Modal: Nova Sobra Manual */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="bg-amber-500 p-3.5 sm:p-4 text-slate-950 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 stroke-[3]" />
                <h3 className="font-black text-sm sm:text-base uppercase font-sans">Cadastrar Sobra Manual de P.A.</h3>
              </div>
              <button 
                onClick={() => setShowManualModal(false)}
                className="text-slate-950 hover:bg-amber-600 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualItem} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                      Código do Produto *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 19164"
                      value={manualForm.productCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const found = products.find(p => p.code === code.trim());
                        setManualForm(prev => ({
                          ...prev,
                          productCode: code,
                          productDescription: found ? found.description : prev.productDescription
                        }));
                      }}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                      Quantidade (Unidades) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={manualForm.quantity}
                      onChange={(e) => setManualForm(prev => ({ ...prev, quantity: Number(e.target.value) || 1 }))}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                    Descrição do Produto
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: GUARANA CHP ANTARCTICA PET 1L PACK C/2 MULTIPACK"
                    value={manualForm.productDescription}
                    onChange={(e) => setManualForm(prev => ({ ...prev, productDescription: e.target.value }))}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                      Mapa da Rota *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 17501"
                      value={manualForm.routeMap}
                      onChange={(e) => setManualForm(prev => ({ ...prev, routeMap: e.target.value }))}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                      Data do Fechamento *
                    </label>
                    <input
                      type="date"
                      required
                      value={manualForm.mapDate}
                      onChange={(e) => setManualForm(prev => ({ ...prev, mapDate: e.target.value }))}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                    Prazo Calculado (30 Dias)
                  </label>
                  <div className="bg-[#dcfce7] border border-emerald-300 rounded-xl p-2.5 text-xs font-mono font-black text-emerald-950 flex items-center justify-between">
                    <span>Data Limite de Baixa:</span>
                    <span>{formatDateBR(calculateDeadline(manualForm.mapDate))}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                    Observações / Motivo da Sobra
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Identificado no baú após descarga física da rota..."
                    value={manualForm.notes}
                    onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-150 shrink-0 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="w-1/3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-xl transition shadow-md border border-amber-600 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Salvar Sobra</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Baixa / Encaminhamento */}
      {showBaixaModal && selectedItemForBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col max-h-[92dvh] sm:max-h-[90vh] my-auto overflow-hidden">
            <div className="bg-slate-900 p-3.5 sm:p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-amber-400" />
                <h3 className="font-black text-sm sm:text-base uppercase font-sans">Dar Baixa na Sobra de P.A.</h3>
              </div>
              <button 
                onClick={() => setShowBaixaModal(false)}
                className="text-white/80 hover:bg-slate-800 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmBaixa} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 flex-1 overscroll-contain">
                {/* Item Info Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-500">{selectedItemForBaixa.productCode}</span>
                    <span className="font-mono font-black text-amber-700">{selectedItemForBaixa.quantity} unidades</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">{selectedItemForBaixa.productDescription}</div>
                  <div className="text-slate-500 flex items-center gap-3 pt-1">
                    <span>Mapa: <strong>{selectedItemForBaixa.routeMap}</strong></span>
                    <span>Data: <strong>{formatDateBR(selectedItemForBaixa.mapDate)}</strong></span>
                  </div>
                </div>

                {/* Destination Selector */}
                <div>
                  <label className="block text-xxs font-bold uppercase text-slate-600 mb-1.5">
                    Destino da Sobra *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setBaixaForm(prev => ({ ...prev, status: 'DEVOLVIDO', destination: 'ESTOQUE' }))}
                      className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                        baixaForm.destination === 'ESTOQUE'
                          ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs ring-2 ring-blue-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Building className="h-5 w-5 text-blue-600" />
                      <span>Devolver ao Estoque</span>
                      <span className="text-[10px] font-normal text-slate-400">Reintegração física no armazém</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBaixaForm(prev => ({ ...prev, status: 'ENVIADO', destination: 'CLIENTE' }))}
                      className={`p-3 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                        baixaForm.destination === 'CLIENTE'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Truck className="h-5 w-5 text-emerald-600" />
                      <span>Encaminhar ao Cliente</span>
                      <span className="text-[10px] font-normal text-slate-400">Reenvio em rota / entrega</span>
                    </button>
                  </div>
                </div>

                {/* Client Fields if ENVIADO */}
                {baixaForm.destination === 'CLIENTE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 animate-fade-in">
                    <div>
                      <label className="block text-xxs font-bold uppercase text-emerald-900 mb-1">
                        Código do Cliente (NB)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 849204"
                        value={baixaForm.clientCodeNB}
                        onChange={(e) => setBaixaForm(prev => ({ ...prev, clientCodeNB: e.target.value }))}
                        className="w-full text-xs font-mono font-bold bg-white border border-emerald-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xxs font-bold uppercase text-emerald-900 mb-1">
                        Data do Reenvio
                      </label>
                      <input
                        type="date"
                        value={baixaForm.deliveryDate}
                        onChange={(e) => setBaixaForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                        className="w-full text-xs font-semibold bg-white border border-emerald-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xxs font-bold uppercase text-slate-600 mb-1">
                    Observações da Baixa / Comprovante
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Baixado no estoque e alinhado com a supervisão de logística..."
                    value={baixaForm.notes}
                    onChange={(e) => setBaixaForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-150 shrink-0 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowBaixaModal(false)}
                  className="w-1/3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 active:bg-slate-950 rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span>Confirmar Baixa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
