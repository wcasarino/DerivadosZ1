import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { DerivadoRow, FilterState } from '../types/dashboard';
import { FacetOption, getFacetOptions } from '../utils/analytics';

interface FilterSidebarProps {
  allRows: DerivadoRow[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  activeFilterCount: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface FacetSectionProps {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClearSection: () => void;
  searchable?: boolean;
  defaultOpen?: boolean;
}

function FacetSection({
  title,
  options,
  selected,
  onToggle,
  onClearSection,
  searchable = false,
  defaultOpen = false,
}: FacetSectionProps) {
  const [open, setOpen] = useState(defaultOpen || selected.length > 0);
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.value.toLowerCase().includes(q));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <div className="border-b border-slate-200 py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-left text-xs font-semibold text-slate-800 hover:text-teal-700 transition-colors min-w-0 flex-1 py-1"
        >
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate">{title}</span>
          {selected.length > 0 && (
            <span className="ml-1 font-mono text-[11px] text-teal-700 tabular-nums shrink-0">
              ({selected.length})
            </span>
          )}
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClearSection}
            className="text-[11px] text-slate-500 hover:text-slate-900 whitespace-nowrap shrink-0 px-1 py-0.5"
          >
            Limpiar
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-1.5">
          {searchable && options.length > 6 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filtrar ${title.toLowerCase()}...`}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-teal-600 focus:bg-white text-slate-800"
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {filteredOptions.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 px-1">
                Sin coincidencias
              </p>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center justify-between gap-2 px-1.5 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                      checked
                        ? 'bg-teal-50/70 text-teal-900 font-medium'
                        : 'text-slate-700 hover:bg-slate-100/80'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(opt.value)}
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600 shrink-0"
                      />
                      <span className="truncate" title={opt.value}>
                        {opt.value}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      {opt.count.toLocaleString('es-AR')}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterSidebar({
  allRows,
  filters,
  onChange,
  onReset,
  activeFilterCount,
  mobileOpen = false,
  onCloseMobile,
}: FilterSidebarProps) {
  const facets = useMemo(() => {
    return {
      dpto: getFacetOptions(allRows, 'dpto'),
      caps: getFacetOptions(allRows, 'caps'),
      especialidad: getFacetOptions(allRows, 'especialidad'),
      profesional: getFacetOptions(allRows, 'profesional'),
    };
  }, [allRows]);

  const toggleItem = (
    field: keyof Pick<
      FilterState,
      'dptos' | 'caps' | 'especialidades' | 'profesionales'
    >,
    value: string
  ) => {
    const current = filters[field];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [field]: next });
  };

  const content = (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Filtros</h2>
          {activeFilterCount > 0 && (
            <span className="font-mono text-xs text-teal-700 tabular-nums">
              · {activeFilterCount} activos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Limpiar
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Cerrar panel de filtros"
              className="lg:hidden p-1 text-slate-500 hover:text-slate-900 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <FacetSection
          title="Departamento (DPTO)"
          options={facets.dpto}
          selected={filters.dptos}
          onToggle={(v) => toggleItem('dptos', v)}
          onClearSection={() => onChange({ ...filters, dptos: [] })}
          defaultOpen={true}
        />

        <FacetSection
          title="CAPS"
          options={facets.caps}
          selected={filters.caps}
          onToggle={(v) => toggleItem('caps', v)}
          onClearSection={() => onChange({ ...filters, caps: [] })}
          searchable
        />

        <FacetSection
          title="Especialidad"
          options={facets.especialidad}
          selected={filters.especialidades}
          onToggle={(v) => toggleItem('especialidades', v)}
          onClearSection={() => onChange({ ...filters, especialidades: [] })}
          searchable
        />

        <FacetSection
          title="Profesional"
          options={facets.profesional}
          selected={filters.profesionales}
          onToggle={(v) => toggleItem('profesionales', v)}
          onClearSection={() => onChange({ ...filters, profesionales: [] })}
          searchable
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-[276px] shrink-0 border-r border-slate-200 bg-white">
        <div className="sticky top-0 h-[calc(100vh-57px)]">{content}</div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
          />
          <aside className="relative w-80 max-w-[85vw] h-full bg-white border-r border-slate-200 z-10 shadow-xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
