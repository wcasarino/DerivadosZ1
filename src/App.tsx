import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { fetchSpreadsheetData } from './services/sheets';
import {
  DerivadoRow,
  FilterState,
  LecturaInfo,
  PivotDimension,
} from './types/dashboard';
import {
  computeKpis,
  filterRows,
  INITIAL_FILTERS,
} from './utils/analytics';
import { FilterSidebar } from './components/FilterSidebar';
import { KpiStrip } from './components/KpiStrip';
import { PivotTableBuilder } from './components/PivotTableBuilder';
import { ProfessionalTable } from './components/ProfessionalTable';
import { RecordsTable } from './components/RecordsTable';
import { SpecialtyTable } from './components/SpecialtyTable';

type ActiveTab = 'resumen' | 'registros';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lectura, setLectura] = useState<LecturaInfo | null>(null);
  const [rows, setRows] = useState<DerivadoRow[]>([]);

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setDataError(null);
    try {
      const result = await fetchSpreadsheetData();
      setLectura(result.lectura);
      setRows(result.derivados);
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al consultar Google Sheets.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(
    () => filterRows(rows, filters),
    [rows, filters]
  );

  const kpis = useMemo(
    () => computeKpis(filteredRows, lectura?.fechaIso),
    [filteredRows, lectura?.fechaIso]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count++;
    if (filters.fechaDesde) count++;
    if (filters.fechaHasta) count++;
    count += filters.dptos.length;
    count += filters.caps.length;
    count += filters.especialidades.length;
    count += filters.profesionales.length;
    count += filters.estadosSlot.length;
    count += filters.estadosTurno.length;
    count += filters.anotadores.length;
    return count;
  }, [filters]);

  const handlePivotDrillDown = useCallback(
    (dim: PivotDimension, rawKey: string) => {
      setFilters((prev) => {
        const toggle = (arr: string[]) =>
          arr.includes(rawKey)
            ? arr.filter((v) => v !== rawKey)
            : [...arr, rawKey];

        switch (dim) {
          case 'dpto':
            return { ...prev, dptos: toggle(prev.dptos) };
          case 'caps':
            return { ...prev, caps: toggle(prev.caps) };
          case 'especialidad':
            return { ...prev, especialidades: toggle(prev.especialidades) };
          case 'profesional':
            return { ...prev, profesionales: toggle(prev.profesionales) };
          case 'estadoSlot':
            return { ...prev, estadosSlot: toggle(prev.estadosSlot) };
          case 'estadoTurno':
            return { ...prev, estadosTurno: toggle(prev.estadosTurno) };
          case 'anotador':
            return { ...prev, anotadores: toggle(prev.anotadores) };
          case 'fechaTurIso':
            return prev.fechaDesde === rawKey && prev.fechaHasta === rawKey
              ? { ...prev, fechaDesde: '', fechaHasta: '' }
              : { ...prev, fechaDesde: rawKey, fechaHasta: rawKey };
          default:
            return prev;
        }
      });
    },
    []
  );

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (filters.search.trim()) {
      chips.push({
        label: `Búsqueda: "${filters.search.trim()}"`,
        onRemove: () => setFilters((f) => ({ ...f, search: '' })),
      });
    }
    if (filters.fechaDesde || filters.fechaHasta) {
      chips.push({
        label: `Fecha: ${filters.fechaDesde || '...'} → ${filters.fechaHasta || '...'}`,
        onRemove: () =>
          setFilters((f) => ({ ...f, fechaDesde: '', fechaHasta: '' })),
      });
    }
    const pushList = (
      prefix: string,
      items: string[],
      key: keyof Pick<
        FilterState,
        | 'dptos'
        | 'caps'
        | 'especialidades'
        | 'profesionales'
        | 'estadosSlot'
        | 'estadosTurno'
        | 'anotadores'
      >
    ) => {
      for (const val of items) {
        chips.push({
          label: `${prefix}: ${val}`,
          onRemove: () =>
            setFilters((f) => ({
              ...f,
              [key]: f[key].filter((x) => x !== val),
            })),
        });
      }
    };

    pushList('DPTO', filters.dptos, 'dptos');
    pushList('CAPS', filters.caps, 'caps');
    pushList('Esp.', filters.especialidades, 'especialidades');
    pushList('Prof.', filters.profesionales, 'profesionales');
    pushList('Slot', filters.estadosSlot, 'estadosSlot');
    pushList('Turno', filters.estadosTurno, 'estadosTurno');
    pushList('Anot.', filters.anotadores, 'anotadores');

    return chips;
  }, [filters]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 h-14 px-4 lg:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="font-mono text-teal-700">
                ({activeFilterCount})
              </span>
            )}
          </button>

          <a
            href="#top"
            className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Tablero Derivados (Lectura al:{' '}
            {lectura?.fechaRaw || (loading ? '...' : '—')})
          </a>
        </div>

        <nav
          aria-label="Vistas principales"
          className="hidden md:flex items-center gap-6 h-full"
        >
          {(
            [
              { id: 'resumen', label: 'Por CAPS' },
              { id: 'registros', label: 'Registros' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-full inline-flex items-center text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-teal-700 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            {loading ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex min-w-0">
        <FilterSidebar
          allRows={rows}
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(INITIAL_FILTERS)}
          activeFilterCount={activeFilterCount}
          mobileOpen={mobileFiltersOpen}
          onCloseMobile={() => setMobileFiltersOpen(false)}
        />

        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-5">
          {/* Mobile view switcher */}
          <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
            {(
              [
                { id: 'resumen', label: 'Por CAPS' },
                { id: 'registros', label: 'Registros' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active Filter Controls */}
          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">
                Filtros aplicados:
              </span>
              {activeFilterChips.map((chip, i) => (
                <button
                  key={`${chip.label}-${i}`}
                  type="button"
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white border border-slate-200 hover:border-slate-300 text-slate-800 rounded-md transition-colors whitespace-nowrap"
                >
                  <span>{chip.label}</span>
                  <X className="w-3 h-3 text-slate-400 hover:text-slate-700" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFilters(INITIAL_FILTERS)}
                className="text-xs font-medium text-teal-700 hover:text-teal-900 px-2 py-1"
              >
                Limpiar todos
              </button>
            </div>
          )}

          {/* Error Banner */}
          {dataError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{dataError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadData()}
                className="px-3 py-1.5 bg-white border border-rose-200 rounded text-rose-800 font-medium hover:bg-rose-100 whitespace-nowrap shrink-0"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* KPI Strip */}
          <KpiStrip kpis={kpis} loading={loading && rows.length === 0} />

          {/* View Content */}
          {activeTab === 'resumen' && (
            <div className="space-y-5">
              <PivotTableBuilder
                rows={filteredRows}
                onDrillDown={handlePivotDrillDown}
              />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                <SpecialtyTable
                  rows={filteredRows}
                  onDrillDown={handlePivotDrillDown}
                />
                <ProfessionalTable
                  rows={filteredRows}
                  onDrillDown={handlePivotDrillDown}
                />
              </div>
            </div>
          )}

          {activeTab === 'registros' && (
            <RecordsTable
              rows={filteredRows}
              lecturaFechaIso={lectura?.fechaIso}
            />
          )}
        </main>
      </div>
    </div>
  );
}
