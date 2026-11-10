import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface UnifiedCalendarPickerProps {
  startDate: string; // 'YYYY-MM-DD' or ''
  endDate: string;   // 'YYYY-MM-DD' or ''
  onChange: (startDate: string, endDate: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  variant?: 'amber' | 'indigo' | 'slate';
}

export const UnifiedCalendarPicker: React.FC<UnifiedCalendarPickerProps> = ({
  startDate,
  endDate,
  onChange,
  label,
  placeholder = 'Selecionar data ou período...',
  className = '',
  variant = 'amber'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current view month
  const initialDate = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Internal selection state during picker interaction
  const [pendingStart, setPendingStart] = useState<string>(startDate);
  const [pendingEnd, setPendingEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string>('');

  // Sync state when props change externally
  useEffect(() => {
    setPendingStart(startDate);
    setPendingEnd(endDate);
  }, [startDate, endDate]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Format date helper: YYYY-MM-DD
  const formatDateString = (year: number, month: number, day: number) => {
    const y = String(year);
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Format Brazilian date: DD/MM/YYYY
  const formatBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Handle clicking a day on the calendar grid
  const handleDayClick = (dateStr: string) => {
    // Single Day Selection (Clicking the same day twice)
    if (pendingStart === dateStr && (!pendingEnd || pendingEnd === dateStr)) {
      onChange(dateStr, dateStr);
      setPendingStart(dateStr);
      setPendingEnd(dateStr);
      setIsOpen(false);
      return;
    }

    if (!pendingStart || (pendingStart && pendingEnd)) {
      // First click: Start a new selection
      setPendingStart(dateStr);
      setPendingEnd('');
    } else {
      // Second click: Complete a date range
      if (dateStr < pendingStart) {
        onChange(dateStr, pendingStart);
        setPendingStart(dateStr);
        setPendingEnd(pendingStart);
      } else {
        onChange(pendingStart, dateStr);
        setPendingEnd(dateStr);
      }
      setIsOpen(false);
    }
  };

  // Double click handler on day grid
  const handleDayDoubleClick = (dateStr: string) => {
    onChange(dateStr, dateStr);
    setPendingStart(dateStr);
    setPendingEnd(dateStr);
    setIsOpen(false);
  };

  // Quick Preset Actions
  const handleSelectToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onChange(today, today);
    setPendingStart(today);
    setPendingEnd(today);
    setIsOpen(false);
  };

  const handleSelectYesterday = () => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];
    onChange(yestStr, yestStr);
    setPendingStart(yestStr);
    setPendingEnd(yestStr);
    setIsOpen(false);
  };

  const handleSelectLast7Days = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    const d7Str = d7.toISOString().split('T')[0];
    onChange(d7Str, todayStr);
    setPendingStart(d7Str);
    setPendingEnd(todayStr);
    setIsOpen(false);
  };

  const handleSelectThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];
    onChange(firstDay, todayStr);
    setPendingStart(firstDay);
    setPendingEnd(todayStr);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('', '');
    setPendingStart('');
    setPendingEnd('');
    setIsOpen(false);
  };

  // Generate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sunday

  const daysGrid = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    daysGrid.push(formatDateString(currentYear, currentMonth, day));
  }

  // Display text in field
  let displayText = placeholder;
  let isFiltered = false;

  if (startDate && endDate) {
    isFiltered = true;
    if (startDate === endDate) {
      displayText = `📅 ${formatBR(startDate)} (Dia Único)`;
    } else {
      displayText = `📅 ${formatBR(startDate)} até ${formatBR(endDate)}`;
    }
  } else if (startDate) {
    isFiltered = true;
    displayText = `📅 ${formatBR(startDate)}`;
  } else if (pendingStart) {
    displayText = `📅 Selecionando a partir de ${formatBR(pendingStart)}...`;
  }

  const themeClasses = {
    amber: {
      activeRing: 'focus:ring-amber-500 border-amber-300',
      daySelected: 'bg-amber-600 text-white font-bold',
      dayRange: 'bg-amber-100 text-amber-900 font-medium'
    },
    indigo: {
      activeRing: 'focus:ring-indigo-500 border-indigo-300',
      daySelected: 'bg-indigo-600 text-white font-bold',
      dayRange: 'bg-indigo-100 text-indigo-900 font-medium'
    },
    slate: {
      activeRing: 'focus:ring-slate-500 border-slate-300',
      daySelected: 'bg-slate-800 text-white font-bold',
      dayRange: 'bg-slate-200 text-slate-900 font-medium'
    }
  }[variant];

  return (
    <div className={`relative inline-block w-full font-sans ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[10px] font-bold text-slate-600 uppercase font-sans mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between text-xs px-3 py-2 bg-white border rounded-xl shadow-2xs hover:border-slate-400 transition-all font-mono cursor-pointer ${
            isFiltered 
              ? 'border-amber-400 text-amber-950 font-semibold bg-amber-50/40 ring-1 ring-amber-400/50' 
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span className="truncate pr-2">{displayText}</span>
          <div className="flex items-center space-x-1 shrink-0">
            {isFiltered && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 hover:bg-rose-100 text-rose-600 rounded-full transition cursor-pointer"
                title="Limpar Filtro de Data"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <Calendar className={`h-4 w-4 ${isFiltered ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
        </button>

        {/* Popover Calendar Grid */}
        {isOpen && (
          <div className="absolute left-0 right-0 sm:right-auto sm:w-80 mt-1.5 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
            
            {/* Header: Presets */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-md transition cursor-pointer"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={handleSelectYesterday}
                className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-md transition cursor-pointer"
              >
                Ontem
              </button>
              <button
                type="button"
                onClick={handleSelectLast7Days}
                className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-md transition cursor-pointer"
              >
                Últimos 7 Dias
              </button>
              <button
                type="button"
                onClick={handleSelectThisMonth}
                className="text-[10px] font-bold px-2 py-1 bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 rounded-md transition cursor-pointer"
              >
                Este Mês
              </button>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md transition cursor-pointer ml-auto"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Navigation: Month / Year */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">
                {monthNames[currentMonth]} {currentYear}
              </span>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar Grid Header (Days of week) */}
            <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 uppercase font-mono">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Calendar Grid Body */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono">
              {daysGrid.map((dateStr, idx) => {
                if (!dateStr) {
                  return <div key={`empty_${idx}`} className="h-7" />;
                }

                const dayNum = parseInt(dateStr.split('-')[2], 10);
                const isStart = dateStr === pendingStart;
                const isEnd = dateStr === pendingEnd;

                const effectiveEnd = pendingEnd || hoverDate;
                const isInRange = pendingStart && effectiveEnd && (
                  (dateStr > pendingStart && dateStr < effectiveEnd) ||
                  (dateStr < pendingStart && dateStr > effectiveEnd)
                );

                let dayBg = 'hover:bg-amber-100 hover:text-amber-900 text-slate-700';
                if (isStart || isEnd) {
                  dayBg = themeClasses.daySelected;
                } else if (isInRange) {
                  dayBg = themeClasses.dayRange;
                }

                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => handleDayClick(dateStr)}
                    onDoubleClick={() => handleDayDoubleClick(dateStr)}
                    onMouseEnter={() => {
                      if (pendingStart && !pendingEnd) setHoverDate(dateStr);
                    }}
                    onMouseLeave={() => setHoverDate('')}
                    title="Clique 1x para selecionar inicial ou 2x para dia único"
                    className={`h-7 w-full flex items-center justify-center text-xs rounded-lg transition-all cursor-pointer select-none font-bold ${dayBg}`}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>

            {/* Manual Native Inputs Fallback / Custom Date Fields */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-[9px] font-bold uppercase text-slate-400 block font-sans">
                Ou digite/selecione manualmente:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Data Inicial</label>
                  <input
                    type="date"
                    value={pendingStart}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingStart(val);
                      onChange(val, pendingEnd || val);
                    }}
                    className="w-full text-xxs p-1.5 border border-slate-200 rounded-md font-mono focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 font-bold block mb-0.5">Data Final</label>
                  <input
                    type="date"
                    value={pendingEnd}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingEnd(val);
                      onChange(pendingStart || val, val);
                    }}
                    className="w-full text-xxs p-1.5 border border-slate-200 rounded-md font-mono focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div className="text-[9px] text-slate-400 italic text-center font-sans">
                💡 Dica: Dê dois cliques em um dia no calendário para filtrar apenas aquele dia.
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
