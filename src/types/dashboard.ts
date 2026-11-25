export interface DerivadoRow {
  id: number;
  dpto: string;
  caps: string;
  especialidad: string;
  profesional: string;
  fechaTurRaw: string;
  fechaTurIso: string; // YYYY-MM-DD for sorting and date range filtering
  fechaTurMes: string; // YYYY-MM for monthly grouping
  hora: string;
  estadoSlot: string;
  estadoTurno: string; // Normalized: "Sin estado" when blank in sheet
  usuario: string;
  anotador: string; // Normalized: "Sin anotador" when blank in sheet
}

export interface LecturaInfo {
  fechaRaw: string;
  fechaIso: string;
  extraFields: Array<{ label: string; value: string }>;
}

export interface FilterState {
  search: string;
  fechaDesde: string;
  fechaHasta: string;
  dptos: string[];
  caps: string[];
  especialidades: string[];
  profesionales: string[];
  estadosSlot: string[];
  estadosTurno: string[];
  anotadores: string[];
}

export type PivotDimension =
  | 'dpto'
  | 'caps'
  | 'especialidad'
  | 'profesional'
  | 'fechaTurIso'
  | 'fechaTurMes'
  | 'estadoSlot'
  | 'estadoTurno'
  | 'anotador';

export type PivotColumnDimension = PivotDimension | 'none';

export type PivotMeasure =
  | 'count'
  | 'pctTotal'
  | 'pctRow'
  | 'pctCol'
  | 'uniqueProfesionales'
  | 'uniqueCaps';

export type PivotSortBy = 'rowLabelAsc' | 'rowLabelDesc' | 'totalDesc' | 'totalAsc';

export interface PivotConfig {
  id: string;
  name: string;
  rowDim1: PivotDimension;
  rowDim2: PivotDimension | 'none';
  colDim: PivotColumnDimension;
  measure: PivotMeasure;
  sortBy: PivotSortBy;
  showHeatmap: boolean;
}

export interface PivotSubRow {
  key: string;
  label: string;
  cells: Record<string, number>;
  total: number;
}

export interface PivotGroupRow {
  key: string;
  label: string;
  cells: Record<string, number>;
  total: number;
  subRows: PivotSubRow[];
}

export interface PivotResult {
  colKeys: string[];
  rows: PivotGroupRow[];
  colTotals: Record<string, number>;
  grandTotal: number;
  maxCellValue: number;
}

export interface KpiMetrics {
  totalTurnos: number;
  sinUsar: number;
  pctSinUsar: number;
  local: number;
  pctLocal: number;
  pctLocalAnotados: number;
  otroCaps: number;
  pctOtroCaps: number;
  pctOtroCapsAnotados: number;
  asistenciaPct: number;
  asistenciaAdmisionados: number;
  asistenciaAsignados: number;
}
