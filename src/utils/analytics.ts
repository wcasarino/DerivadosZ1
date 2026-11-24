import * as XLSX from 'xlsx';
import {
  DerivadoRow,
  FilterState,
  KpiMetrics,
  PivotConfig,
  PivotDimension,
  PivotGroupRow,
  PivotMeasure,
  PivotResult,
  PivotSubRow,
} from '../types/dashboard';
import { formatIsoToDisplay, formatMonthToDisplay } from '../services/sheets';

export const INITIAL_FILTERS: FilterState = {
  search: '',
  fechaDesde: '',
  fechaHasta: '',
  dptos: [],
  caps: [],
  especialidades: [],
  profesionales: [],
  estadosSlot: [],
  estadosTurno: [],
  anotadores: [],
};

export const DIMENSION_LABELS: Record<PivotDimension, string> = {
  dpto: 'Departamento',
  caps: 'CAPS',
  especialidad: 'Especialidad',
  profesional: 'Profesional',
  fechaTurIso: 'Fecha de Turno (Día)',
  fechaTurMes: 'Mes de Turno',
  estadoSlot: 'Estado de Slot',
  estadoTurno: 'Estado de Turno',
  anotador: 'Anotador',
};

export const MEASURE_LABELS: Record<PivotMeasure, string> = {
  count: 'Cantidad de registros',
  pctRow: '% por fila',
  pctCol: '% por columna',
  pctTotal: '% del total general',
  uniqueProfesionales: 'Profesionales únicos',
  uniqueCaps: 'CAPS únicos',
};

export function getDimensionRawValue(row: DerivadoRow, dim: PivotDimension): string {
  switch (dim) {
    case 'dpto':
      return row.dpto;
    case 'caps':
      return row.caps;
    case 'especialidad':
      return row.especialidad;
    case 'profesional':
      return row.profesional;
    case 'fechaTurIso':
      return row.fechaTurIso || 'Sin fecha';
    case 'fechaTurMes':
      return row.fechaTurMes || 'Sin mes';
    case 'estadoSlot':
      return row.estadoSlot;
    case 'estadoTurno':
      return row.estadoTurno;
    case 'anotador':
      return row.anotador;
  }
}

export function formatDimensionValue(dim: PivotDimension, rawKey: string): string {
  if (dim === 'fechaTurIso') return formatIsoToDisplay(rawKey);
  if (dim === 'fechaTurMes') return formatMonthToDisplay(rawKey);
  return rawKey;
}

export function filterRows(rows: DerivadoRow[], filters: FilterState): DerivadoRow[] {
  const searchLower = filters.search.trim().toLowerCase();
  const hasDpto = filters.dptos.length > 0;
  const hasCaps = filters.caps.length > 0;
  const hasEsp = filters.especialidades.length > 0;
  const hasProf = filters.profesionales.length > 0;
  const hasSlot = filters.estadosSlot.length > 0;
  const hasTurno = filters.estadosTurno.length > 0;
  const hasAnot = filters.anotadores.length > 0;

  const dptoSet = hasDpto ? new Set(filters.dptos) : null;
  const capsSet = hasCaps ? new Set(filters.caps) : null;
  const espSet = hasEsp ? new Set(filters.especialidades) : null;
  const profSet = hasProf ? new Set(filters.profesionales) : null;
  const slotSet = hasSlot ? new Set(filters.estadosSlot) : null;
  const turnoSet = hasTurno ? new Set(filters.estadosTurno) : null;
  const anotSet = hasAnot ? new Set(filters.anotadores) : null;

  return rows.filter((row) => {
    if (dptoSet && !dptoSet.has(row.dpto)) return false;
    if (capsSet && !capsSet.has(row.caps)) return false;
    if (espSet && !espSet.has(row.especialidad)) return false;
    if (profSet && !profSet.has(row.profesional)) return false;
    if (slotSet && !slotSet.has(row.estadoSlot)) return false;
    if (turnoSet && !turnoSet.has(row.estadoTurno)) return false;
    if (anotSet && !anotSet.has(row.anotador)) return false;

    if (filters.fechaDesde && row.fechaTurIso && row.fechaTurIso < filters.fechaDesde) {
      return false;
    }
    if (filters.fechaHasta && row.fechaTurIso && row.fechaTurIso > filters.fechaHasta) {
      return false;
    }
    if ((filters.fechaDesde || filters.fechaHasta) && !row.fechaTurIso) {
      return false;
    }

    if (searchLower) {
      const hay =
        row.profesional.toLowerCase().includes(searchLower) ||
        row.caps.toLowerCase().includes(searchLower) ||
        row.especialidad.toLowerCase().includes(searchLower) ||
        row.dpto.toLowerCase().includes(searchLower) ||
        row.anotador.toLowerCase().includes(searchLower);
      if (!hay) return false;
    }

    return true;
  });
}

export function computeKpis(
  filteredRows: DerivadoRow[],
  lecturaFechaIso?: string
): KpiMetrics {
  let sinUsar = 0;
  let local = 0;
  let otroCaps = 0;
  let asistenciaAdmisionados = 0;
  let asistenciaAsignados = 0;

  for (const r of filteredRows) {
    const slotNorm = r.estadoSlot.trim().toLowerCase();
    const turnoNorm = r.estadoTurno.trim().toLowerCase();
    const capsNorm = r.caps.trim().toLowerCase();
    const anotNorm = r.anotador.trim().toLowerCase();
    const hasCapsAndAnotador =
      r.caps !== 'Sin CAPS' && r.anotador !== 'Sin anotador';
    const isSameCaps = hasCapsAndAnotador && anotNorm === capsNorm;
    const isBeforeLectura =
      !lecturaFechaIso ||
      (Boolean(r.fechaTurIso) && r.fechaTurIso < lecturaFechaIso);

    if (slotNorm === 'libre') {
      sinUsar++;
    }
    if (isSameCaps) {
      local++;
    }
    if (slotNorm === 'asignado' && !isSameCaps) {
      otroCaps++;
      if (isBeforeLectura) {
        asistenciaAsignados++;
      }
    }
    if (!isSameCaps && turnoNorm === 'admisionado' && isBeforeLectura) {
      asistenciaAdmisionados++;
    }
  }

  const totalTurnos = filteredRows.length;
  const anotados = local + otroCaps;
  const pctSinUsar = totalTurnos > 0 ? (sinUsar / totalTurnos) * 100 : 0;
  const pctLocal = totalTurnos > 0 ? (local / totalTurnos) * 100 : 0;
  const pctOtroCaps = totalTurnos > 0 ? (otroCaps / totalTurnos) * 100 : 0;
  const pctLocalAnotados = anotados > 0 ? (local / anotados) * 100 : 0;
  const pctOtroCapsAnotados = anotados > 0 ? (otroCaps / anotados) * 100 : 0;
  const asistenciaPct =
    asistenciaAsignados > 0
      ? Math.round((asistenciaAdmisionados / asistenciaAsignados) * 100)
      : 0;

  return {
    totalTurnos,
    sinUsar,
    pctSinUsar,
    local,
    pctLocal,
    pctLocalAnotados,
    otroCaps,
    pctOtroCaps,
    pctOtroCapsAnotados,
    asistenciaPct,
    asistenciaAdmisionados,
    asistenciaAsignados,
  };
}

interface CellAccumulator {
  count: number;
  profs: Set<string>;
  caps: Set<string>;
}

function createAcc(): CellAccumulator {
  return { count: 0, profs: new Set(), caps: new Set() };
}

function addRowToAcc(acc: CellAccumulator, row: DerivadoRow) {
  acc.count++;
  if (row.profesional && row.profesional !== 'Sin profesional') {
    acc.profs.add(row.profesional);
  }
  if (row.caps && row.caps !== 'Sin CAPS') {
    acc.caps.add(row.caps);
  }
}

function extractRawMetric(acc: CellAccumulator | undefined, measure: PivotMeasure): number {
  if (!acc) return 0;
  if (measure === 'uniqueProfesionales') return acc.profs.size;
  if (measure === 'uniqueCaps') return acc.caps.size;
  return acc.count;
}

export function buildPivotTable(rows: DerivadoRow[], config: PivotConfig): PivotResult {
  const { rowDim1, rowDim2, colDim, measure, sortBy } = config;
  const hasRow2 = rowDim2 !== 'none' && rowDim2 !== rowDim1;
  const hasCol = colDim !== 'none';

  const colKeySet = new Set<string>();
  const grandAcc = createAcc();
  const colAccMap = new Map<string, CellAccumulator>();

  interface GroupBucket {
    rowAcc: CellAccumulator;
    cellAccs: Map<string, CellAccumulator>;
    subBuckets: Map<
      string,
      { rowAcc: CellAccumulator; cellAccs: Map<string, CellAccumulator> }
    >;
  }

  const groupMap = new Map<string, GroupBucket>();

  for (const row of rows) {
    const r1 = getDimensionRawValue(row, rowDim1);
    const r2 = hasRow2 ? getDimensionRawValue(row, rowDim2) : '';
    const cKey = hasCol ? getDimensionRawValue(row, colDim) : 'Total';

    colKeySet.add(cKey);
    addRowToAcc(grandAcc, row);

    let cAcc = colAccMap.get(cKey);
    if (!cAcc) {
      cAcc = createAcc();
      colAccMap.set(cKey, cAcc);
    }
    addRowToAcc(cAcc, row);

    let gBucket = groupMap.get(r1);
    if (!gBucket) {
      gBucket = {
        rowAcc: createAcc(),
        cellAccs: new Map(),
        subBuckets: new Map(),
      };
      groupMap.set(r1, gBucket);
    }
    addRowToAcc(gBucket.rowAcc, row);

    let gCellAcc = gBucket.cellAccs.get(cKey);
    if (!gCellAcc) {
      gCellAcc = createAcc();
      gBucket.cellAccs.set(cKey, gCellAcc);
    }
    addRowToAcc(gCellAcc, row);

    if (hasRow2) {
      let sBucket = gBucket.subBuckets.get(r2);
      if (!sBucket) {
        sBucket = { rowAcc: createAcc(), cellAccs: new Map() };
        gBucket.subBuckets.set(r2, sBucket);
      }
      addRowToAcc(sBucket.rowAcc, row);

      let sCellAcc = sBucket.cellAccs.get(cKey);
      if (!sCellAcc) {
        sCellAcc = createAcc();
        sBucket.cellAccs.set(cKey, sCellAcc);
      }
      addRowToAcc(sCellAcc, row);
    }
  }

  const colKeys = Array.from(colKeySet).sort((a, b) => a.localeCompare(b, 'es'));
  const grandRawTotal = extractRawMetric(grandAcc, measure);

  const colRawTotals: Record<string, number> = {};
  for (const ck of colKeys) {
    colRawTotals[ck] = extractRawMetric(colAccMap.get(ck), measure);
  }

  const formatCellValue = (
    cellAcc: CellAccumulator | undefined,
    rowAcc: CellAccumulator,
    colKey: string
  ): number => {
    const raw = extractRawMetric(cellAcc, measure);
    if (measure === 'pctTotal') {
      return grandRawTotal > 0 ? (raw / grandRawTotal) * 100 : 0;
    }
    if (measure === 'pctRow') {
      const rowTotal = extractRawMetric(rowAcc, measure);
      return rowTotal > 0 ? (raw / rowTotal) * 100 : 0;
    }
    if (measure === 'pctCol') {
      const colTotal = colRawTotals[colKey] ?? 0;
      return colTotal > 0 ? (raw / colTotal) * 100 : 0;
    }
    return raw;
  };

  const formatRowTotal = (rowAcc: CellAccumulator): number => {
    const raw = extractRawMetric(rowAcc, measure);
    if (measure === 'pctTotal') {
      return grandRawTotal > 0 ? (raw / grandRawTotal) * 100 : 0;
    }
    if (measure === 'pctRow') {
      return raw > 0 ? 100 : 0;
    }
    if (measure === 'pctCol') {
      return grandRawTotal > 0 ? (raw / grandRawTotal) * 100 : 0;
    }
    return raw;
  };

  let maxCellValue = 0;

  const builtRows: PivotGroupRow[] = [];
  for (const [r1Key, gBucket] of groupMap.entries()) {
    const cells: Record<string, number> = {};
    for (const ck of colKeys) {
      const val = formatCellValue(gBucket.cellAccs.get(ck), gBucket.rowAcc, ck);
      cells[ck] = val;
      if (val > maxCellValue) maxCellValue = val;
    }

    const subRows: PivotSubRow[] = [];
    if (hasRow2) {
      for (const [r2Key, sBucket] of gBucket.subBuckets.entries()) {
        const sCells: Record<string, number> = {};
        for (const ck of colKeys) {
          sCells[ck] = formatCellValue(sBucket.cellAccs.get(ck), sBucket.rowAcc, ck);
        }
        subRows.push({
          key: r2Key,
          label: formatDimensionValue(rowDim2, r2Key),
          cells: sCells,
          total: formatRowTotal(sBucket.rowAcc),
        });
      }
      subRows.sort((a, b) => {
        if (sortBy === 'rowLabelAsc') return a.label.localeCompare(b.label, 'es');
        if (sortBy === 'rowLabelDesc') return b.label.localeCompare(a.label, 'es');
        if (sortBy === 'totalAsc') return a.total - b.total;
        return b.total - a.total;
      });
    }

    builtRows.push({
      key: r1Key,
      label: formatDimensionValue(rowDim1, r1Key),
      cells,
      total: formatRowTotal(gBucket.rowAcc),
      subRows,
    });
  }

  builtRows.sort((a, b) => {
    if (sortBy === 'rowLabelAsc') return a.label.localeCompare(b.label, 'es');
    if (sortBy === 'rowLabelDesc') return b.label.localeCompare(a.label, 'es');
    if (sortBy === 'totalAsc') return a.total - b.total;
    return b.total - a.total;
  });

  const colTotals: Record<string, number> = {};
  for (const ck of colKeys) {
    const raw = colRawTotals[ck] ?? 0;
    if (measure === 'pctTotal' || measure === 'pctRow') {
      colTotals[ck] = grandRawTotal > 0 ? (raw / grandRawTotal) * 100 : 0;
    } else if (measure === 'pctCol') {
      colTotals[ck] = raw > 0 ? 100 : 0;
    } else {
      colTotals[ck] = raw;
    }
  }

  const grandTotal =
    measure === 'pctTotal' || measure === 'pctRow' || measure === 'pctCol'
      ? grandRawTotal > 0
        ? 100
        : 0
      : grandRawTotal;

  return {
    colKeys,
    rows: builtRows,
    colTotals,
    grandTotal,
    maxCellValue,
  };
}

export function formatMeasureValue(value: number, measure: PivotMeasure): string {
  if (
    measure === 'pctTotal' ||
    measure === 'pctRow' ||
    measure === 'pctCol'
  ) {
    return `${value.toLocaleString('es-AR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }
  return Math.round(value).toLocaleString('es-AR');
}

export interface FacetOption {
  value: string;
  count: number;
}

export function getFacetOptions(
  rows: DerivadoRow[],
  key: keyof Pick<
    DerivadoRow,
    | 'dpto'
    | 'caps'
    | 'especialidad'
    | 'profesional'
    | 'estadoSlot'
    | 'estadoTurno'
    | 'anotador'
  >
): FacetOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const val = r[key];
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
}

export function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const aoa: (string | number)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = headers.map((header, colIdx) => {
    let maxLen = String(header ?? '').length;
    for (const row of rows) {
      const cellLen = String(row[colIdx] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return { wch: Math.min(45, Math.max(10, maxLen + 2)) };
  });

  const wb = XLSX.utils.book_new();
  const safeSheetName = sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Datos';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
