import { DerivadoRow, LecturaInfo } from '../types/dashboard';

export const SPREADSHEET_ID = '1iNormbynqtutnzwcDTWiQ7Kd0GjG5QfbyWzCZTJOw08';
export const ALLOWED_SHEETS = ['Lectura', 'Derivados'] as const;

interface GvizCell {
  v?: string | number | boolean | null;
  f?: string;
}

interface GvizRow {
  c: Array<GvizCell | null>;
}

interface GvizCol {
  id: string;
  label: string;
  type: string;
}

interface GvizResponse {
  status: string;
  errors?: Array<{ reason?: string; message?: string; detailed_message?: string }>;
  table?: {
    cols: GvizCol[];
    rows: GvizRow[];
  };
}

/**
 * Parses Google Visualization "Date(YYYY,M_zero_based,D)" or DD/MM/YY(YY) strings into YYYY-MM-DD.
 */
export function parseSheetDateToIso(raw: string, gvizValue?: string | number | boolean | null): string {
  if (typeof gvizValue === 'string') {
    const gvizMatch = gvizValue.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
    if (gvizMatch) {
      const y = gvizMatch[1];
      const m = String(parseInt(gvizMatch[2], 10) + 1).padStart(2, '0');
      const d = gvizMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) {
      const num = parseInt(year, 10);
      year = num < 70 ? `20${year}` : `19${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  return '';
}

export function formatIsoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'Sin fecha';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatMonthToDisplay(ym: string): string {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return ym || 'Sin mes';
  const [y, m] = ym.split('-');
  const months = [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ];
  const idx = parseInt(m, 10) - 1;
  return `${months[idx] ?? m} ${y}`;
}

function getCellText(cell: GvizCell | null | undefined): string {
  if (!cell) return '';
  if (cell.f !== undefined && cell.f !== null) return String(cell.f).trim();
  if (Array.isArray(cell.v)) {
    const [h = 0, m = 0] = cell.v as number[];
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (cell.v !== undefined && cell.v !== null) return String(cell.v).trim();
  return '';
}

async function fetchPublicSheet(sheetName: (typeof ALLOWED_SHEETS)[number]): Promise<{
  cols: GvizCol[];
  rows: GvizRow[];
}> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}&_ts=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `No se pudo acceder a la hoja "${sheetName}" (HTTP ${res.status}). Verifica que el enlace compartido siga activo.`
    );
  }

  const text = await res.text();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(
      `Respuesta inesperada al leer la hoja "${sheetName}". Verifica que la planilla sea pública en modo lectura.`
    );
  }

  const parsed: GvizResponse = JSON.parse(text.slice(start, end + 1));
  if (parsed.status === 'error' || !parsed.table) {
    const errMsg =
      parsed.errors?.[0]?.detailed_message ||
      parsed.errors?.[0]?.message ||
      `Error al consultar la hoja "${sheetName}".`;
    throw new Error(errMsg);
  }

  return {
    cols: parsed.table.cols ?? [],
    rows: parsed.table.rows ?? [],
  };
}

/**
 * Fetches ONLY the "Lectura" and "Derivados" sheets from the public read-only Google Sheet link.
 */
export async function fetchSpreadsheetData(): Promise<{
  lectura: LecturaInfo;
  derivados: DerivadoRow[];
  fetchedAt: Date;
}> {
  const [lecturaTable, derivadosTable] = await Promise.all([
    fetchPublicSheet('Lectura'),
    fetchPublicSheet('Derivados'),
  ]);

  const lectura = parseLecturaTable(lecturaTable.cols, lecturaTable.rows);
  const derivados = parseDerivadosTable(derivadosTable.cols, derivadosTable.rows);

  return {
    lectura,
    derivados,
    fetchedAt: new Date(),
  };
}

function parseLecturaTable(cols: GvizCol[], rows: GvizRow[]): LecturaInfo {
  if (rows.length === 0) {
    return { fechaRaw: '', fechaIso: '', extraFields: [] };
  }

  const firstRow = rows[0]?.c ?? [];
  let fechaRaw = '';
  let fechaIso = '';
  const extraFields: Array<{ label: string; value: string }> = [];

  cols.forEach((col, idx) => {
    const cleanHeader = (col.label ?? '').trim();
    const cell = firstRow[idx];
    const val = getCellText(cell);
    if (!cleanHeader && !val) return;

    if (
      (cleanHeader.toLowerCase().includes('fecha') || idx === 0) &&
      !fechaRaw &&
      val
    ) {
      fechaRaw = val;
      fechaIso = parseSheetDateToIso(val, cell?.v);
    } else if (cleanHeader || val) {
      extraFields.push({
        label: cleanHeader || `Columna ${idx + 1}`,
        value: val || '—',
      });
    }
  });

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]?.c ?? [];
    const nonEmpty = cells.map((c) => getCellText(c)).filter(Boolean);
    if (nonEmpty.length >= 2) {
      extraFields.push({ label: nonEmpty[0], value: nonEmpty.slice(1).join(' · ') });
    } else if (nonEmpty.length === 1) {
      extraFields.push({ label: `Nota ${r + 1}`, value: nonEmpty[0] });
    }
  }

  return {
    fechaRaw,
    fechaIso,
    extraFields,
  };
}

function parseDerivadosTable(cols: GvizCol[], rows: GvizRow[]): DerivadoRow[] {
  if (rows.length === 0) return [];

  const rawHeaders = cols.map((c) => (c.label ?? '').trim().toLowerCase());

  const findCol = (candidates: string[], fallbackIdx: number): number => {
    const exactIdx = rawHeaders.findIndex((h) => candidates.some((c) => h === c));
    if (exactIdx >= 0) return exactIdx;
    const partialIdx = rawHeaders.findIndex((h) =>
      candidates.some((c) => h.includes(c))
    );
    return partialIdx >= 0 ? partialIdx : fallbackIdx;
  };

  const iDpto = findCol(['dpto', 'departamento'], 0);
  const iCaps = findCol(['caps', 'efector', 'centro'], 1);
  const iEsp = findCol(['especialidad'], 2);
  const iProf = findCol(['profesional', 'medico'], 3);
  const iFecha = findCol(['fechatur', 'fecha'], 4);
  const iHora = findCol(['hora', 'horatur'], -1);
  const iSlot = findCol(['estadoslot'], 5);
  const iTurno = findCol(['estadoturno'], 6);
  const iUsuario = findCol(['usuario', 'user'], -1);
  const iAnot = findCol(['anotador'], 7);

  const parsed: DerivadoRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i]?.c;
    if (!cells) continue;

    const get = (idx: number) => (idx >= 0 ? getCellText(cells[idx]) : '');
    const fechaCell = iFecha >= 0 ? cells[iFecha] : null;
    const fechaRaw = getCellText(fechaCell);
    const dpto = get(iDpto);
    const caps = get(iCaps);
    const especialidad = get(iEsp);
    const profesional = get(iProf);

    if (!dpto && !caps && !especialidad && !profesional && !fechaRaw) continue;

    const fechaIso = parseSheetDateToIso(fechaRaw, fechaCell?.v);
    const fechaMes = fechaIso ? fechaIso.slice(0, 7) : '';

    const horaRaw = get(iHora);
    const estadoSlotRaw = get(iSlot);
    const estadoTurnoRaw = get(iTurno);
    const usuarioRaw = get(iUsuario);
    const anotadorRaw = get(iAnot);

    parsed.push({
      id: i + 1,
      dpto: dpto || 'Sin departamento',
      caps: caps || 'Sin CAPS',
      especialidad: especialidad || 'Sin especialidad',
      profesional: profesional || 'Sin profesional',
      fechaTurRaw: fechaRaw,
      fechaTurIso: fechaIso,
      fechaTurMes: fechaMes,
      hora: horaRaw,
      estadoSlot: estadoSlotRaw || 'Sin estado',
      estadoTurno: estadoTurnoRaw || 'Sin estado',
      usuario: usuarioRaw,
      anotador: anotadorRaw || 'Sin anotador',
    });
  }

  return parsed;
}
