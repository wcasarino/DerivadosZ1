import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Flame } from 'lucide-react';
import { DerivadoRow, PivotDimension } from '../types/dashboard';
import { downloadXlsx } from '../utils/analytics';

interface PivotTableBuilderProps {
  rows: DerivadoRow[];
  onDrillDown?: (dim: PivotDimension, rawKey: string) => void;
}

type PivotSortCol =
  | { kind: 'caps' }
  | { kind: 'sinUsar' }
  | { kind: 'local' }
  | { kind: 'otroCaps' }
  | { kind: 'anotador'; key: string };

interface RowStats {
  total: number;
  libre: number;
  local: number;
  otroCaps: number;
  cells: Record<string, number>;
}

interface PivotCapsRow extends RowStats {
  key: string;
  label: string;
  pctSinUsar: number;
}

function createStats(): RowStats {
  return {
    total: 0,
    libre: 0,
    local: 0,
    otroCaps: 0,
    cells: {},
  };
}

function accumulateRow(stats: RowStats, r: DerivadoRow) {
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

  if (r.anotador !== 'Sin anotador' && !isSameCaps) {
    stats.cells[r.anotador] = (stats.cells[r.anotador] ?? 0) + 1;
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

export function PivotTableBuilder({
  rows,
  onDrillDown,
}: PivotTableBuilderProps) {
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [sortCol, setSortCol] = useState<PivotSortCol>({ kind: 'caps' });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const pivot = useMemo(() => {
    const colKeySet = new Set<string>();
    const grand = createStats();
    const capsMap = new Map<string, RowStats>();

    for (const r of rows) {
      if (r.anotador !== 'Sin anotador') {
        colKeySet.add(r.anotador);
      }

      accumulateRow(grand, r);

      let s = capsMap.get(r.caps);
      if (!s) {
        s = createStats();
        capsMap.set(r.caps, s);
      }
      accumulateRow(s, r);
    }

    const colKeys = Array.from(colKeySet).sort((a, b) => a.localeCompare(b, 'es'));

    let maxCellValue = 0;
    const builtRows: PivotCapsRow[] = [];

    for (const [caps, s] of capsMap.entries()) {
      for (const ck of colKeys) {
        const val = s.cells[ck] ?? 0;
        if (val > maxCellValue) maxCellValue = val;
      }

      builtRows.push({
        ...s,
        key: caps,
        label: caps,
        pctSinUsar: s.total > 0 ? (s.libre / s.total) * 100 : 0,
      });
    }

    const grandPctSinUsar =
      grand.total > 0 ? (grand.libre / grand.total) * 100 : 0;

    return {
      colKeys,
      rows: builtRows,
      grand,
      grandPctSinUsar,
      maxCellValue,
    };
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...pivot.rows];
    copy.sort((a, b) => {
      if (sortCol.kind === 'caps') {
        const cmp = a.label.localeCompare(b.label, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      }

      if (sortCol.kind === 'anotador') {
        const targetNorm = sortCol.key.trim().toLowerCase();
        const isSelfA = a.label.trim().toLowerCase() === targetNorm;
        const isSelfB = b.label.trim().toLowerCase() === targetNorm;
        if (isSelfA && !isSelfB) return 1;
        if (!isSelfA && isSelfB) return -1;

        const va = a.cells[sortCol.key] ?? 0;
        const vb = b.cells[sortCol.key] ?? 0;
        if (va !== vb) return sortDir === 'asc' ? va - vb : vb - va;
        return a.label.localeCompare(b.label, 'es');
      }

      let va = 0;
      let vb = 0;
      if (sortCol.kind === 'sinUsar') {
        va = a.pctSinUsar;
        vb = b.pctSinUsar;
      } else if (sortCol.kind === 'local') {
        va = a.local;
        vb = b.local;
      } else if (sortCol.kind === 'otroCaps') {
        va = a.otroCaps;
        vb = b.otroCaps;
      }

      if (va !== vb) return sortDir === 'asc' ? va - vb : vb - va;
      return a.label.localeCompare(b.label, 'es');
    });
    return copy;
  }, [pivot.rows, sortCol, sortDir]);

  const isSameSortCol = (a: PivotSortCol, b: PivotSortCol) => {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'anotador' && b.kind === 'anotador') {
      return a.key === b.key;
    }
    return true;
  };

  const toggleSort = (target: PivotSortCol) => {
    if (isSameSortCol(sortCol, target)) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(target);
      setSortDir(target.kind === 'caps' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (target: PivotSortCol) => {
    if (isSameSortCol(sortCol, target)) {
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
    const headers = [
      'CAPS',
      'Sin Usar',
      'Local',
      'Otro CAPS',
      ...pivot.colKeys,
    ];

    const exportRows: (string | number)[][] = [];
    for (const row of sortedRows) {
      const rowNorm = row.label.trim().toLowerCase();
      const rowAnotados = row.local + row.otroCaps;
      exportRows.push([
        row.label,
        fmtPct(row.pctSinUsar),
        `${row.local} (${fmtRoundedPct(row.local, rowAnotados)})`,
        `${row.otroCaps} (${fmtRoundedPct(row.otroCaps, rowAnotados)})`,
        ...pivot.colKeys.map((ck) =>
          ck.trim().toLowerCase() === rowNorm ? '' : row.cells[ck] ?? 0
        ),
      ]);
    }

    const grandAnotados = pivot.grand.local + pivot.grand.otroCaps;
    exportRows.push([
      'Total General',
      fmtPct(pivot.grandPctSinUsar),
      `${pivot.grand.local} (${fmtRoundedPct(pivot.grand.local, grandAnotados)})`,
      `${pivot.grand.otroCaps} (${fmtRoundedPct(pivot.grand.otroCaps, grandAnotados)})`,
      ...pivot.colKeys.map((ck) => pivot.grand.cells[ck] ?? 0),
    ]);

    downloadXlsx(
      'por-caps.xlsx',
      'Por CAPS',
      headers,
      exportRows
    );
  };

  const getHeatBg = (val: number) => {
    if (!showHeatmap || pivot.maxCellValue <= 0 || val <= 0) {
      return undefined;
    }
    const ratio = Math.min(1, val / pivot.maxCellValue);
    const alpha = (0.05 + ratio * 0.22).toFixed(3);
    return `rgba(13, 148, 136, ${alpha})`;
  };

  return (
    <section
      aria-label="Por CAPS"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Por CAPS
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            CAPS · Sin Usar, Local, Otro CAPS y Anotador
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowHeatmap((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              showHeatmap
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Mapa de calor
          </button>

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

      {/* Pivot Table Matrix */}
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
                <th className="sticky left-0 z-30 bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 border-r border-slate-200 min-w-[200px]">
                  <button
                    type="button"
                    onClick={() => toggleSort({ kind: 'caps' })}
                    className="group inline-flex items-center gap-1 hover:text-teal-700 transition-colors"
                  >
                    <span>CAPS</span>
                    {renderSortIcon({ kind: 'caps' })}
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-amber-800 bg-amber-50/60 whitespace-nowrap min-w-[96px]">
                  <button
                    type="button"
                    onClick={() => toggleSort({ kind: 'sinUsar' })}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-amber-950 transition-colors"
                  >
                    {renderSortIcon({ kind: 'sinUsar' })}
                    <span>Sin Usar</span>
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-teal-800 bg-teal-50/60 whitespace-nowrap min-w-[116px]">
                  <button
                    type="button"
                    onClick={() => toggleSort({ kind: 'local' })}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-teal-950 transition-colors"
                  >
                    {renderSortIcon({ kind: 'local' })}
                    <span>Local</span>
                  </button>
                </th>
                <th className="px-3.5 py-2.5 text-right text-xs font-semibold text-sky-800 bg-sky-50/60 border-r border-slate-200 whitespace-nowrap min-w-[116px]">
                  <button
                    type="button"
                    onClick={() => toggleSort({ kind: 'otroCaps' })}
                    className="group inline-flex items-center justify-end gap-1 w-full hover:text-sky-950 transition-colors"
                  >
                    {renderSortIcon({ kind: 'otroCaps' })}
                    <span>Otro CAPS</span>
                  </button>
                </th>
                {pivot.colKeys.map((ck) => (
                  <th
                    key={ck}
                    className="px-3.5 py-2.5 text-right text-xs font-semibold text-slate-700 whitespace-nowrap min-w-[105px]"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort({ kind: 'anotador', key: ck })}
                      className="group inline-flex items-center justify-end gap-1 w-full hover:text-teal-700 transition-colors"
                    >
                      {renderSortIcon({ kind: 'anotador', key: ck })}
                      <span>{ck}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedRows.map((row) => {
                const rowNorm = row.label.trim().toLowerCase();
                return (
                  <tr
                    key={row.key}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 border-r border-slate-200 font-medium text-slate-900">
                      {onDrillDown ? (
                        <button
                          type="button"
                          onClick={() => onDrillDown('caps', row.key)}
                          title="Filtrar tablero por este CAPS"
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
                    <td className="px-3.5 py-2 text-right font-mono tabular-nums font-medium text-sky-800 bg-sky-50/30 border-r border-slate-200 whitespace-nowrap">
                      <span>{fmtInt(row.otroCaps)}</span>{' '}
                      <span className="text-[11px] font-normal text-sky-700/80">
                        ({fmtRoundedPct(row.otroCaps, row.local + row.otroCaps)})
                      </span>
                    </td>
                    {pivot.colKeys.map((ck) => {
                      const isSelfCol = ck.trim().toLowerCase() === rowNorm;
                      const val = row.cells[ck] ?? 0;
                      return (
                        <td
                          key={ck}
                          style={isSelfCol ? undefined : { backgroundColor: getHeatBg(val) }}
                          className={`px-3.5 py-2 text-right font-mono tabular-nums whitespace-nowrap ${
                            isSelfCol
                              ? 'bg-slate-100/50'
                              : val === 0
                                ? 'text-slate-300'
                                : 'text-slate-800 font-medium'
                          }`}
                        >
                          {isSelfCol ? '' : val === 0 ? '—' : fmtInt(val)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-20 bg-slate-100 border-t-2 border-slate-300 text-xs font-semibold text-slate-900">
              <tr>
                <td className="sticky left-0 z-30 bg-slate-100 px-4 py-2.5 border-r border-slate-200">
                  Total General ({pivot.rows.length.toLocaleString('es-AR')} CAPS)
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-amber-800 bg-amber-50/40 whitespace-nowrap">
                  {fmtPct(pivot.grandPctSinUsar)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-teal-800 bg-teal-50/40 whitespace-nowrap">
                  <span>{fmtInt(pivot.grand.local)}</span>{' '}
                  <span className="text-[11px] font-medium text-teal-700/80">
                    ({fmtRoundedPct(pivot.grand.local, pivot.grand.local + pivot.grand.otroCaps)})
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-sky-800 bg-sky-50/40 border-r border-slate-200 whitespace-nowrap">
                  <span>{fmtInt(pivot.grand.otroCaps)}</span>{' '}
                  <span className="text-[11px] font-medium text-sky-700/80">
                    ({fmtRoundedPct(pivot.grand.otroCaps, pivot.grand.local + pivot.grand.otroCaps)})
                  </span>
                </td>
                {pivot.colKeys.map((ck) => (
                  <td
                    key={ck}
                    className="px-3.5 py-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                  >
                    {fmtInt(pivot.grand.cells[ck] ?? 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
