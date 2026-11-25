import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, X } from 'lucide-react';
import { DerivadoRow } from '../types/dashboard';
import { downloadXlsx } from '../utils/analytics';
import { formatIsoToDisplay } from '../services/sheets';

interface RecordsTableProps {
  rows: DerivadoRow[];
  lecturaFechaIso?: string;
}

type SortKey =
  | 'dpto'
  | 'caps'
  | 'especialidad'
  | 'profesional'
  | 'fechaTurIso'
  | 'hora'
  | 'paciente'
  | 'estadoTurno'
  | 'usuario'
  | 'fechaRegIso'
  | 'anotador';

type EstadoTurnoFilterValue = 'No Asistió' | 'Asistió' | 'Asignado';

const ESTADO_TURNO_FILTER_OPTIONS: EstadoTurnoFilterValue[] = [
  'No Asistió',
  'Asistió',
  'Asignado',
];

function normalizeHoraForSort(hora: string): string {
  const trimmed = hora.trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?$/i);
  if (!m) return trimmed;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const sec = m[3] ?? '00';
  const mer = m[4]?.toLowerCase();
  if (mer === 'p' && h < 12) h += 12;
  if (mer === 'a' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}:${sec}`;
}

function truncateChars(text: string, maxChars = 20): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}…`;
}

function getDisplayEstadoTurno(
  row: DerivadoRow,
  lecturaFechaIso?: string
): { label: string; isPastAsignado: boolean; isAdmisionadoColor: boolean } {
  const rawNorm = row.estadoTurno.trim().toLowerCase();
  const isPastLectura =
    Boolean(lecturaFechaIso) &&
    Boolean(row.fechaTurIso) &&
    row.fechaTurIso < lecturaFechaIso!;

  if (isPastLectura && rawNorm === 'asignado') {
    return {
      label: 'No Asistió',
      isPastAsignado: true,
      isAdmisionadoColor: false,
    };
  }

  if (isPastLectura && rawNorm === 'admisionado') {
    return {
      label: 'Asistió',
      isPastAsignado: false,
      isAdmisionadoColor: true,
    };
  }

  return {
    label: row.estadoTurno,
    isPastAsignado: false,
    isAdmisionadoColor: rawNorm === 'admisionado',
  };
}

export function RecordsTable({ rows, lecturaFechaIso }: RecordsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('fechaTurIso');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [selectedEstadosTurno, setSelectedEstadosTurno] = useState<
    EstadoTurnoFilterValue[]
  >([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const sortedRows = useMemo(() => {
    const selectedSet =
      selectedEstadosTurno.length > 0 ? new Set<string>(selectedEstadosTurno) : null;

    const filtered = rows.filter((r) => {
      const slotNorm = r.estadoSlot.trim().toLowerCase();
      const capsNorm = r.caps.trim().toLowerCase();
      const anotNorm = r.anotador.trim().toLowerCase();
      const isSameCaps =
        r.caps !== 'Sin CAPS' &&
        r.anotador !== 'Sin anotador' &&
        anotNorm === capsNorm;

      if (slotNorm === 'libre') return false;
      if (isSameCaps) return false;

      if (fechaDesde && (!r.fechaTurIso || r.fechaTurIso < fechaDesde)) {
        return false;
      }
      if (fechaHasta && (!r.fechaTurIso || r.fechaTurIso > fechaHasta)) {
        return false;
      }

      if (selectedSet) {
        const displayEstado = getDisplayEstadoTurno(r, lecturaFechaIso).label;
        if (!selectedSet.has(displayEstado)) return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (sortKey === 'fechaTurIso') {
        const fa = a.fechaTurIso || '';
        const fb = b.fechaTurIso || '';
        let cmp = fa.localeCompare(fb, 'es');
        if (cmp === 0) {
          const ha = normalizeHoraForSort(a.hora);
          const hb = normalizeHoraForSort(b.hora);
          cmp = ha.localeCompare(hb, 'es');
        }
        return sortDir === 'asc' ? cmp : -cmp;
      }

      if (sortKey === 'hora') {
        const ha = normalizeHoraForSort(a.hora);
        const hb = normalizeHoraForSort(b.hora);
        const cmp = ha.localeCompare(hb, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      }

      if (sortKey === 'estadoTurno') {
        const ea = getDisplayEstadoTurno(a, lecturaFechaIso).label;
        const eb = getDisplayEstadoTurno(b, lecturaFechaIso).label;
        const cmp = ea.localeCompare(eb, 'es');
        return sortDir === 'asc' ? cmp : -cmp;
      }

      const va = a[sortKey] || '';
      const vb = b[sortKey] || '';
      const cmp = va.localeCompare(vb, 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [
    rows,
    sortKey,
    sortDir,
    fechaDesde,
    fechaHasta,
    selectedEstadosTurno,
    lecturaFechaIso,
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const toggleEstadoFilter = (val: EstadoTurnoFilterValue) => {
    setSelectedEstadosTurno((prev) =>
      prev.includes(val) ? prev.filter((item) => item !== val) : [...prev, val]
    );
    setPage(1);
  };

  const handleExport = () => {
    const headers = [
      'DPTO',
      'CAPS',
      'Especialidad',
      'Profesional',
      'FechaTur',
      'Hora',
      'Paciente',
      'EstadoTurno',
      'Usuario',
      'FechaReg',
      'Anotador',
    ];
    const data = sortedRows.map((r) => [
      r.dpto,
      r.caps,
      r.especialidad,
      r.profesional,
      r.fechaTurIso ? formatIsoToDisplay(r.fechaTurIso) : r.fechaTurRaw,
      r.hora,
      r.paciente,
      getDisplayEstadoTurno(r, lecturaFechaIso).label,
      r.usuario,
      r.fechaRegIso ? formatIsoToDisplay(r.fechaRegIso) : r.fechaRegRaw,
      r.anotador,
    ]);
    downloadXlsx(
      'derivados-filtrados.xlsx',
      'Registros de Derivados',
      headers,
      data
    );
  };

  const columns: Array<{ key: SortKey; label: string }> = [
    { key: 'dpto', label: 'DPTO' },
    { key: 'caps', label: 'CAPS' },
    { key: 'especialidad', label: 'Especialidad' },
    { key: 'profesional', label: 'Profesional' },
    { key: 'fechaTurIso', label: 'FechaTur' },
    { key: 'hora', label: 'Hora' },
    { key: 'paciente', label: 'Paciente' },
    { key: 'estadoTurno', label: 'EstadoTurno' },
    { key: 'usuario', label: 'Usuario' },
    { key: 'fechaRegIso', label: 'FechaReg' },
    { key: 'anotador', label: 'Anotador' },
  ];

  const hasDateFilter = Boolean(fechaDesde || fechaHasta);
  const hasEstadoFilter = selectedEstadosTurno.length > 0;

  return (
    <section
      aria-label="Explorador de registros de la hoja Derivados"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">
          Registros de Derivados
        </h2>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-700">EstadoTurno:</span>
            <div
              role="group"
              aria-label="Filtrar por EstadoTurno"
              className="inline-flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 rounded p-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedEstadosTurno([]);
                  setPage(1);
                }}
                className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                  !hasEstadoFilter
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              {ESTADO_TURNO_FILTER_OPTIONS.map((opt) => {
                const active = selectedEstadosTurno.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleEstadoFilter(opt)}
                    className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                      active
                        ? opt === 'No Asistió'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : opt === 'Asistió'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-sky-100 text-sky-800 border border-sky-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-700">FechaTur:</span>
            <label className="flex items-center gap-1">
              <span className="sr-only">FechaTur desde</span>
              <input
                type="date"
                aria-label="FechaTur desde"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </label>
            <span className="text-slate-400">–</span>
            <label className="flex items-center gap-1">
              <span className="sr-only">FechaTur hasta</span>
              <input
                type="date"
                aria-label="FechaTur hasta"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </label>
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => {
                  setFechaDesde('');
                  setFechaHasta('');
                  setPage(1);
                }}
                title="Limpiar filtro FechaTur"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </div>

          <label className="text-xs text-slate-600 flex items-center gap-1.5">
            <span>Filas:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-800"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleExport}
            disabled={sortedRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLSX
          </button>
        </div>
      </div>

      {pageRows.length === 0 ? (
        <div className="py-16 px-4 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Sin registros que coincidan con los filtros.
          </p>
          {(hasDateFilter || hasEstadoFilter) && (
            <button
              type="button"
              onClick={() => {
                setFechaDesde('');
                setFechaHasta('');
                setSelectedEstadosTurno([]);
                setPage(1);
              }}
              className="text-xs font-medium text-teal-700 hover:text-teal-900"
            >
              Limpiar filtros de la tabla
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {columns.map((col) => {
                  const active = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-teal-700 transition-colors"
                      >
                        <span>{col.label}</span>
                        {active &&
                          (sortDir === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-teal-700" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-teal-700" />
                          ))}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {pageRows.map((row) => {
                const estadoInfo = getDisplayEstadoTurno(row, lecturaFechaIso);

                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 h-9">
                    <td className="px-3.5 py-2 text-slate-700 whitespace-nowrap">
                      {row.dpto}
                    </td>
                    <td className="px-3.5 py-2 font-medium text-slate-900 whitespace-nowrap">
                      {row.caps}
                    </td>
                    <td className="px-3.5 py-2 text-slate-700 whitespace-nowrap">
                      {row.especialidad}
                    </td>
                    <td className="px-3.5 py-2 text-slate-800 whitespace-nowrap">
                      {row.profesional}
                    </td>
                    <td className="px-3.5 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.fechaTurIso
                        ? formatIsoToDisplay(row.fechaTurIso)
                        : row.fechaTurRaw || '—'}
                    </td>
                    <td className="px-3.5 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.hora || '—'}
                    </td>
                    <td
                      title={row.paciente || undefined}
                      className="px-3.5 py-2 text-slate-800 whitespace-nowrap"
                    >
                      {row.paciente ? truncateChars(row.paciente, 20) : '—'}
                    </td>
                    <td
                      className={`px-3.5 py-2 whitespace-nowrap ${
                        estadoInfo.isPastAsignado
                          ? 'bg-rose-100 text-rose-800 font-semibold'
                          : estadoInfo.isAdmisionadoColor
                            ? 'text-emerald-700 font-medium'
                            : row.estadoTurno.trim().toLowerCase() === 'asignado'
                              ? 'text-sky-700'
                              : 'text-slate-400'
                      }`}
                    >
                      {estadoInfo.label}
                    </td>
                    <td
                      title={row.usuario || undefined}
                      className="px-3.5 py-2 text-slate-700 whitespace-nowrap"
                    >
                      {row.usuario ? truncateChars(row.usuario, 20) : '—'}
                    </td>
                    <td className="px-3.5 py-2 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {row.fechaRegIso
                        ? formatIsoToDisplay(row.fechaRegIso)
                        : row.fechaRegRaw || '—'}
                    </td>
                    <td className="px-3.5 py-2 text-slate-600 whitespace-nowrap">
                      {row.anotador}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono tabular-nums">
            Mostrando {((safePage - 1) * pageSize + 1).toLocaleString('es-AR')}–
            {Math.min(safePage * pageSize, sortedRows.length).toLocaleString('es-AR')}{' '}
            de {sortedRows.length.toLocaleString('es-AR')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
