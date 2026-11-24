import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { DerivadoRow, PivotDimension } from '../types/dashboard';
import { downloadXlsx } from '../utils/analytics';

interface SpecialtyTableProps {
  rows: DerivadoRow[];
  onDrillDown?: (dim: PivotDimension, rawKey: string) => void;
}

type SpecialtySortCol = 'especialidad' | 'sinUsar' | 'local' | 'otroCaps';

interface SpecialtyStats {
  total: number;
  libre: number;
  local: number;
  otroCaps: number;
}

interface SpecialtyRow extends SpecialtyStats {
  key: string;
  label: string;
  pctSinUsar: number;
}

function createStats(): SpecialtyStats {
  return {
    total: 0,
    libre: 0,
    local: 0,
    otroCaps: 0,
  };
}

function accumulateRow(stats: SpecialtyStats, r: DerivadoRow) {
  const slotNorm = r.estadoSlot.trim().toLowerCase();
  const capsNorm = r.caps.trim().toLowerCase();
  const anotNorm = r.anotador.trim().toLowerCase();
  const hasCapsAndAnotador =
    r.caps !== 'Sin CAPS' && r.anotador !== 'Sin anotador';
  const isSameCaps = hasCapsAndAnotador && anotNorm === capsNorm;

  stats.total++;
  if (slotNorm === 'libre') {
    stats.libre++;
  }
  if (isSameCaps) {
    stats.local++;
  }
  if (slotNorm === 'asignado' && !isSameCaps) {
    stats.otroCaps++;
  }
}

function fmtPct(n: number): string {
  return `${n.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function fmtInt(n: number): string {
  return n.toLocaleString('es-AR');
}

function fmtRoundedPct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function SpecialtyTable({ rows, onDrillDown }: SpecialtyTableProps) {
  const [sortCol, setSortCol] = useState<SpecialtySortCol>('especialidad');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const summary = useMemo(() => {
    const grand = createStats();
    const map = new Map<string, SpecialtyStats>();

    for (const r of rows) {
      accumulateRow(grand, r);

      let s = map.get(r.especialidad);
      if (!s) {
        s = createStats();
        map.set(r.especialidad, s);
      }
      accumulateRow(s, r);
    }

    const builtRows: SpecialtyRow[] = [];
    for (const [especialidad, s] of map.entries()) {
      builtRows.push({
        ...s,
        key: especialidad,
        label: especialidad,
        pctSinUsar: s.total > 0 ? (s.libre / s.total) * 100 : 0,
      });
    }

    const grandPctSinUsar =
      grand.total > 0 ? (grand.libre / grand.total) * 100 : 0;

    return {
      rows: builtRows,
      grand,
      grandPctSinUsar,
    };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...summary.rows];
    copy.sort((a, b) => {
      if (sortCol === 'especialidad') {
        const cmp = a.label.localeCompare(b.label, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      }

      let va = 0;
      let vb = 0;
      if (sortCol === 'sinUsar') {
        va = a.pctSinUsar;
        vb = b.pctSinUsar;
      } else if (sortCol === 'local') {
        va = a.local;
        vb = b.local;
      } else if (sortCol === 'otroCaps') {
        va = a.otroCaps;
        vb = b.otroCaps;
      }

      if (va !== vb) return sortDir === 'asc' ? va - vb : vb - va;
      return a.label.localeCompare(b.label, 'es');
    });
    return copy;
  }, [summary.rows, sortCol, sortDir]);

  const toggleSort = (target: SpecialtySortCol) => {
    if (sortCol === target) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(target);
      setSortDir(target === 'especialidad' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (target: SpecialtySortCol) => {
    if (sortCol === target) {
      return sortDir === 'asc' ? (
        <ArrowUp className="w-3 h-3 text-teal-700 shrink-0" />
      ) : (
        <ArrowDown className="w-3 h-3 text-teal-700 shrink-0" />
      );
    }
    return (
      <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    );
  };

  const handleExportXlsx = () => {
    const headers = ['Especialidad', 'Sin Usar', 'Local', 'Otro CAPS'];

    const exportRows: (string | number)[][] = [];
    for (const row of sortedRows) {
      const rowAnotados = row.local + row.otroCaps;
      exportRows.push([
        row.label,
        fmtPct(row.pctSinUsar),
        `${row.local} (${fmtRoundedPct(row.local, rowAnotados)})`,
        `${row.otroCaps} (${fmtRoundedPct(row.otroCaps, rowAnotados)})`,
      ]);
    }

    const grandAnotados = summary.grand.local + summary.grand.otroCaps;
    exportRows.push([
      'Total General',
      fmtPct(summary.grandPctSinUsar),
      `${summary.grand.local} (${fmtRoundedPct(summary.grand.local, grandAnotados)})`,
      `${summary.grand.otroCaps} (${fmtRoundedPct(summary.grand.otroCaps, grandAnotados)})`,
    ]);

    downloadXlsx(
      'por-especialidad.xlsx',
      'Por Especialidad',
      headers,
      exportRows
    );
  };

  return (
    <section
      aria-label="Por Especialidad"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Por Especialidad
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Especialidad · Sin Usar, Local y Otro CAPS
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportXlsx}
            disabled={sortedRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLSX
          </button>
        </div>
      </div>

      {/* Table */}
      {sortedRows.length === 0 ? (
        <div className="py-16 px-4 text-center">
          <p className="text-sm font-medium text-slate-700">
            No hay registros que coincidan con los filtros seleccionados.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Ajusta o limpia los filtros en el panel lateral para recalcular la tabla.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 border-r border-slate-200 min-w-[160px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('especialidad')}
                    className="group inline-flex items-center gap-1 hover:text-teal-700 transition-colors"
                  >
                    <span>Especialidad</span>
                    {renderSortIcon('especialidad')}
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-amber-800 bg-amber-50/60 whitespace-nowrap min-w-[88px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('sinUsar')}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-amber-950 transition-colors"
                  >
                    {renderSortIcon('sinUsar')}
                    <span>Sin Usar</span>
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-teal-800 bg-teal-50/60 whitespace-nowrap min-w-[105px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('local')}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-teal-950 transition-colors"
                  >
                    {renderSortIcon('local')}
                    <span>Local</span>
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-sky-800 bg-sky-50/60 whitespace-nowrap min-w-[105px]">
                  <button
                    type="button"
                    onClick={() => toggleSort('otroCaps')}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-sky-950 transition-colors"
                  >
                    {renderSortIcon('otroCaps')}
                    <span>Otro CAPS</span>
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedRows.map((row) => (
                <tr
                  key={row.key}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200 font-medium text-slate-900">
                    {onDrillDown ? (
                      <button
                        type="button"
                        onClick={() => onDrillDown('especialidad', row.key)}
                        title="Filtrar tablero por esta especialidad"
                        className="truncate text-left hover:text-teal-700 hover:underline transition-colors max-w-full block"
                      >
                        {row.label}
                      </button>
                    ) : (
                      <span className="truncate block">{row.label}</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono tabular-nums text-amber-800 bg-amber-50/30 whitespace-nowrap">
                    {fmtPct(row.pctSinUsar)}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono tabular-nums font-medium text-teal-800 bg-teal-50/30 whitespace-nowrap">
                    <span>{fmtInt(row.local)}</span>{' '}
                    <span className="text-[11px] font-normal text-teal-700/80">
                      ({fmtRoundedPct(row.local, row.local + row.otroCaps)})
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono tabular-nums font-medium text-sky-800 bg-sky-50/30 whitespace-nowrap">
                    <span>{fmtInt(row.otroCaps)}</span>{' '}
                    <span className="text-[11px] font-normal text-sky-700/80">
                      ({fmtRoundedPct(row.otroCaps, row.local + row.otroCaps)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 text-xs font-semibold text-slate-900">
              <tr>
                <td className="sticky left-0 z-30 bg-slate-100 px-4 py-2.5 border-r border-slate-200">
                  Total General ({sortedRows.length.toLocaleString('es-AR')} especialidades)
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-amber-800 bg-amber-50/40 whitespace-nowrap">
                  {fmtPct(summary.grandPctSinUsar)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-teal-800 bg-teal-50/40 whitespace-nowrap">
                  <span>{fmtInt(summary.grand.local)}</span>{' '}
                  <span className="text-[11px] font-medium text-teal-700/80">
                    ({fmtRoundedPct(summary.grand.local, summary.grand.local + summary.grand.otroCaps)})
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-sky-800 bg-sky-50/40 whitespace-nowrap">
                  <span>{fmtInt(summary.grand.otroCaps)}</span>{' '}
                  <span className="text-[11px] font-medium text-sky-700/80">
                    ({fmtRoundedPct(summary.grand.otroCaps, summary.grand.local + summary.grand.otroCaps)})
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
