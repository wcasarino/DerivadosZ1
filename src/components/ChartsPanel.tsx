import { useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { DerivadoRow, KpiMetrics, PivotDimension } from '../types/dashboard';
import { exportElementToPdf } from '../utils/pdfExport';

interface ChartsPanelProps {
  rows: DerivadoRow[];
  kpis: KpiMetrics;
  lecturaFechaIso?: string;
  onDrillDown?: (dim: PivotDimension, rawKey: string) => void;
}

interface PieSlice {
  key: string;
  label: string;
  value: number;
  pctRounded: number;
  color: string;
  textColor: string;
}

interface StackedSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface GroupedBarData {
  groupKey: string;
  total: number;
  segments: StackedSegment[];
}

interface LegendItem {
  key: string;
  label: string;
  color: string;
}

const ANOTADOR_PALETTE = [
  '#0284c7', // sky-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#e11d48', // rose-600
  '#2563eb', // blue-600
  '#ea580c', // orange-600
  '#059669', // emerald-600
  '#9333ea', // purple-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#4f46e5', // indigo-600
  '#65a30d', // lime-600
  '#b45309', // amber-700
  '#0369a1', // sky-700
];

function fmtInt(n: number): string {
  return n.toLocaleString('es-AR');
}

function shortenLabel(label: string, max = 14): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1).trimEnd()}…`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArcSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const p1 = polarToCartesian(cx, cy, rOuter, 0);
    const p2 = polarToCartesian(cx, cy, rOuter, 180);
    const i1 = polarToCartesian(cx, cy, rInner, 0);
    const i2 = polarToCartesian(cx, cy, rInner, 180);
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${p2.x} ${p2.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${p1.x} ${p1.y}`,
      `M ${i1.x} ${i1.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i2.x} ${i2.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${i1.x} ${i1.y}`,
      'Z',
    ].join(' ');
  }

  const startOuter = polarToCartesian(cx, cy, rOuter, endAngle);
  const endOuter = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');
}

interface CircularChartCardProps {
  title: string;
  subtitle: string;
  slices: PieSlice[];
  displayMode: 'pct-and-qty' | 'qty-only';
  emptyMessage: string;
  pdfFilename: string;
}

function CircularChartCard({
  title,
  subtitle,
  slices,
  displayMode,
  emptyMessage,
  pdfFilename,
}: CircularChartCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const total = useMemo(
    () => slices.reduce((sum, s) => sum + s.value, 0),
    [slices]
  );

  const activeSlices = useMemo(
    () => slices.filter((s) => s.value > 0),
    [slices]
  );

  const geometry = useMemo(() => {
    if (total <= 0) return [];
    let currentAngle = 0;
    return activeSlices.map((slice) => {
      const sweep = (slice.value / total) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      const midAngle = startAngle + sweep / 2;
      currentAngle = endAngle;
      return {
        ...slice,
        startAngle,
        endAngle,
        midAngle,
        sweep,
      };
    });
  }, [activeSlices, total]);

  const hoveredSlice = hoveredKey
    ? slices.find((s) => s.key === hoveredKey) ?? null
    : null;

  const handleDownloadPdf = async () => {
    if (!cardRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportElementToPdf(cardRef.current, pdfFilename, '#ffffff');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <section
      ref={cardRef}
      aria-label={`Gráfico ${title}`}
      className="bg-white border border-slate-200 rounded-lg p-4 lg:p-5 flex flex-col h-full"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          data-pdf-ignore="true"
          onClick={() => void handleDownloadPdf()}
          disabled={total === 0 || exportingPdf}
          title={`Descargar ${title} en PDF`}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3 h-3" />
          <span>{exportingPdf ? '...' : 'PDF'}</span>
        </button>
      </div>

      {total === 0 ? (
        <div className="flex-1 min-h-[220px] flex items-center justify-center text-center px-4">
          <p className="text-xs text-slate-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 flex-1 justify-between">
          <div className="relative w-44 h-44 shrink-0 my-auto">
            <svg
              viewBox="0 0 220 220"
              className="w-full h-full overflow-visible"
              role="img"
              aria-label={`Gráfico circular ${title}`}
            >
              {geometry.map((g) => {
                const isHovered = hoveredKey === g.key;
                const rOuter = isHovered ? 100 : 95;
                const rInner = 48;
                const labelPos = polarToCartesian(110, 110, 72, g.midAngle);
                const showSliceLabel = g.sweep >= 26;

                return (
                  <g
                    key={g.key}
                    onMouseEnter={() => setHoveredKey(g.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    className="cursor-pointer transition-opacity"
                    style={{
                      opacity: hoveredKey && !isHovered ? 0.55 : 1,
                    }}
                  >
                    <path
                      d={describeArcSlice(
                        110,
                        110,
                        rOuter,
                        rInner,
                        g.startAngle,
                        g.endAngle
                      )}
                      fill={g.color}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    {showSliceLabel && (
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        className="font-mono text-[11px] font-semibold pointer-events-none select-none"
                      >
                        {displayMode === 'pct-and-qty'
                          ? `${g.pctRounded}%`
                          : fmtInt(g.value)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Center Summary */}
              <text
                x="110"
                y="102"
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-medium uppercase tracking-wider select-none"
              >
                {hoveredSlice ? hoveredSlice.label : 'Total'}
              </text>
              <text
                x="110"
                y="120"
                textAnchor="middle"
                className="fill-slate-900 font-mono text-sm font-bold select-none tabular-nums"
              >
                {hoveredSlice
                  ? displayMode === 'pct-and-qty'
                    ? `${hoveredSlice.pctRounded}%`
                    : fmtInt(hoveredSlice.value)
                  : fmtInt(total)}
              </text>
            </svg>
          </div>

          <div className="w-full space-y-2">
            {slices.map((s) => {
              const isHovered = hoveredKey === s.key;
              return (
                <div
                  key={s.key}
                  onMouseEnter={() => setHoveredKey(s.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border transition-colors cursor-default ${
                    isHovered
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-white border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {s.label}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 shrink-0 font-mono tabular-nums">
                    {displayMode === 'pct-and-qty' ? (
                      <>
                        <span className={`text-xs font-semibold ${s.textColor}`}>
                          {s.pctRounded}%
                        </span>
                        <span className="text-[11px] text-slate-500">
                          ({fmtInt(s.value)})
                        </span>
                      </>
                    ) : (
                      <span className={`text-xs font-semibold ${s.textColor}`}>
                        {fmtInt(s.value)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

interface StackedBarChartCardProps {
  title: string;
  subtitle: string;
  drillDownDim: PivotDimension;
  bars: GroupedBarData[];
  maxBarTotal: number;
  legendItems: LegendItem[];
  barSort: 'totalDesc' | 'alpha';
  onChangeSort: (sort: 'totalDesc' | 'alpha') => void;
  chartHeightPx: number;
  compact?: boolean;
  pdfFilename: string;
  onDrillDown?: (dim: PivotDimension, rawKey: string) => void;
}

function StackedBarChartCard({
  title,
  subtitle,
  drillDownDim,
  bars,
  maxBarTotal,
  legendItems,
  barSort,
  onChangeSort,
  chartHeightPx,
  compact = false,
  pdfFilename,
  onDrillDown,
}: StackedBarChartCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<{
    groupKey: string;
    label: string;
    value: number;
    pct: number;
    color: string;
  } | null>(null);

  const handleDownloadPdf = async () => {
    if (!cardRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportElementToPdf(cardRef.current, pdfFilename, '#ffffff');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <section
      ref={cardRef}
      aria-label={`Gráfico ${title}`}
      className="bg-white border border-slate-200 rounded-lg p-4 lg:p-5 flex flex-col h-full"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            data-pdf-ignore="true"
            className="inline-flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-[11px]"
          >
            <button
              type="button"
              onClick={() => onChangeSort('totalDesc')}
              className={`px-2 py-0.5 rounded font-medium transition-colors whitespace-nowrap ${
                barSort === 'totalDesc'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mayor volumen
            </button>
            <button
              type="button"
              onClick={() => onChangeSort('alpha')}
              className={`px-2 py-0.5 rounded font-medium transition-colors whitespace-nowrap ${
                barSort === 'alpha'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alfabético
            </button>
          </div>

          <button
            type="button"
            data-pdf-ignore="true"
            onClick={() => void handleDownloadPdf()}
            disabled={bars.length === 0 || exportingPdf}
            title={`Descargar ${title} en PDF`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3 h-3" />
            <span>{exportingPdf ? '...' : 'PDF'}</span>
          </button>
        </div>
      </div>

      {bars.length === 0 ? (
        <div className="flex-1 min-h-[220px] flex items-center justify-center text-center text-xs text-slate-500 px-4">
          No hay turnos de Otro CAPS para los filtros seleccionados.
        </div>
      ) : (
        <>
          {/* Legend + Hover Inspection Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {legendItems.map((item) => (
                <div
                  key={item.key}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-700"
                >
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {hoveredSegment && (
              <div className="text-[11px] font-mono tabular-nums text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 whitespace-nowrap">
                <span className="font-semibold text-slate-900">
                  {hoveredSegment.groupKey}
                </span>{' '}
                ·{' '}
                <span
                  className="inline-block w-2 h-2 rounded-xs mr-1 align-middle"
                  style={{ backgroundColor: hoveredSegment.color }}
                />
                {hoveredSegment.label}:{' '}
                <span className="font-semibold text-slate-900">
                  {fmtInt(hoveredSegment.value)}
                </span>{' '}
                ({hoveredSegment.pct}%)
              </div>
            )}
          </div>

          {/* Stacked Vertical Bars */}
          <div data-pdf-scroll="true" className="overflow-x-auto pb-1 flex-1">
            <div
              className="flex items-start gap-2.5"
              style={{
                minWidth: compact
                  ? bars.length > 3
                    ? `${bars.length * 102}px`
                    : undefined
                  : bars.length > 6
                    ? `${bars.length * 124}px`
                    : undefined,
              }}
            >
              {bars.map((bar) => {
                const totalHeightPx =
                  maxBarTotal > 0
                    ? Math.max(
                        4,
                        Math.round((bar.total / maxBarTotal) * chartHeightPx)
                      )
                    : 0;
                const visualTopToBottom = [...bar.segments].reverse();

                return (
                  <div
                    key={bar.groupKey}
                    className={`flex-1 flex flex-col items-center ${
                      compact ? 'min-w-[92px]' : 'min-w-[112px]'
                    }`}
                  >
                    {/* Plot column */}
                    <div
                      className="w-full flex flex-col justify-end items-center border-b border-slate-200 pb-0"
                      style={{ height: `${chartHeightPx + 24}px` }}
                    >
                      <div className="text-[11px] font-mono font-semibold text-slate-700 tabular-nums mb-1">
                        {fmtInt(bar.total)}
                      </div>

                      <div
                        className={`${
                          compact ? 'w-12 sm:w-14' : 'w-16 sm:w-20'
                        } flex flex-col rounded-t overflow-hidden border border-slate-200/70`}
                        style={{ height: `${totalHeightPx}px` }}
                      >
                        {visualTopToBottom.map((seg) => {
                          const segHeightPx = Math.max(
                            2,
                            (seg.value / bar.total) * totalHeightPx
                          );
                          const pct = Math.round(
                            (seg.value / bar.total) * 100
                          );
                          const canFitText = segHeightPx >= 18;

                          return (
                            <div
                              key={seg.key}
                              onMouseEnter={() =>
                                setHoveredSegment({
                                  groupKey: bar.groupKey,
                                  label: seg.label,
                                  value: seg.value,
                                  pct,
                                  color: seg.color,
                                })
                              }
                              onMouseLeave={() => setHoveredSegment(null)}
                              onClick={() =>
                                onDrillDown?.(drillDownDim, bar.groupKey)
                              }
                              title={`${bar.groupKey} — ${seg.label}: ${fmtInt(seg.value)} (${pct}%)`}
                              style={{
                                height: `${segHeightPx}px`,
                                backgroundColor: seg.color,
                              }}
                              className="w-full flex items-center justify-center px-1 border-b border-white/30 last:border-b-0 cursor-pointer hover:brightness-110 transition-[filter]"
                            >
                              {canFitText && (
                                <span className="text-[10px] leading-none font-mono font-semibold text-white truncate select-none">
                                  {shortenLabel(seg.label, compact ? 7 : 9)}:
                                  {seg.value}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* X-axis group label */}
                    <button
                      type="button"
                      onClick={() => onDrillDown?.(drillDownDim, bar.groupKey)}
                      title={`Filtrar tablero por ${bar.groupKey}`}
                      className="mt-1.5 text-xs font-semibold text-slate-900 hover:text-teal-700 hover:underline text-center leading-tight px-1 break-words"
                    >
                      {bar.groupKey}
                    </button>

                    {/* Complete Label + Quantity Breakdown under each bar */}
                    <div className="mt-1.5 w-full bg-slate-50/80 border border-slate-200/80 rounded px-1.5 py-1 space-y-0.5">
                      {bar.segments.map((seg) => (
                        <div
                          key={seg.key}
                          onMouseEnter={() =>
                            setHoveredSegment({
                              groupKey: bar.groupKey,
                              label: seg.label,
                              value: seg.value,
                              pct: Math.round((seg.value / bar.total) * 100),
                              color: seg.color,
                            })
                          }
                          onMouseLeave={() => setHoveredSegment(null)}
                          className="flex items-center justify-between gap-1 text-[10px] leading-tight"
                        >
                          <span className="inline-flex items-center gap-1 min-w-0 text-slate-700">
                            <span
                              className="w-1.5 h-1.5 rounded-xs shrink-0"
                              style={{ backgroundColor: seg.color }}
                            />
                            <span className="truncate" title={seg.label}>
                              {seg.label}
                            </span>
                          </span>
                          <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                            {fmtInt(seg.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function buildGroupedOtroCapsData(
  rows: DerivadoRow[],
  getGroupKey: (r: DerivadoRow) => string,
  colorMap: Map<string, string>,
  barSort: 'totalDesc' | 'alpha'
): {
  bars: GroupedBarData[];
  maxBarTotal: number;
  legendItems: LegendItem[];
} {
  const map = new Map<string, Map<string, number>>();
  const localAnotadores = new Map<string, number>();

  for (const r of rows) {
    const slotNorm = r.estadoSlot.trim().toLowerCase();
    const capsNorm = r.caps.trim().toLowerCase();
    const anotNorm = r.anotador.trim().toLowerCase();
    const hasCapsAndAnotador =
      r.caps !== 'Sin CAPS' && r.anotador !== 'Sin anotador';
    const isSameCaps = hasCapsAndAnotador && anotNorm === capsNorm;

    if (
      slotNorm !== 'asignado' ||
      r.anotador === 'Sin anotador' ||
      isSameCaps
    ) {
      continue;
    }

    const gKey = getGroupKey(r);
    let anotMap = map.get(gKey);
    if (!anotMap) {
      anotMap = new Map();
      map.set(gKey, anotMap);
    }

    anotMap.set(r.anotador, (anotMap.get(r.anotador) ?? 0) + 1);
    localAnotadores.set(r.anotador, (localAnotadores.get(r.anotador) ?? 0) + 1);
  }

  const builtBars: GroupedBarData[] = [];
  for (const [groupKey, anotMap] of map.entries()) {
    const otherSegs = Array.from(anotMap.entries())
      .filter(([, val]) => val > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));

    const segments: StackedSegment[] = otherSegs.map(([anot, val]) => ({
      key: anot,
      label: anot,
      value: val,
      color: colorMap.get(anot) ?? '#64748b',
    }));

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total > 0) {
      builtBars.push({ groupKey, total, segments });
    }
  }

  builtBars.sort((a, b) =>
    barSort === 'totalDesc'
      ? b.total - a.total || a.groupKey.localeCompare(b.groupKey, 'es')
      : a.groupKey.localeCompare(b.groupKey, 'es')
  );

  const maxTotal = builtBars.reduce((m, b) => Math.max(m, b.total), 0);

  const sortedAnotadores = Array.from(localAnotadores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(([name]) => name);

  const legend = sortedAnotadores.map((name) => ({
    key: name,
    label: name,
    color: colorMap.get(name) ?? '#64748b',
  }));

  return {
    bars: builtBars,
    maxBarTotal: maxTotal,
    legendItems: legend,
  };
}

export function ChartsPanel({
  rows,
  kpis,
  lecturaFechaIso,
  onDrillDown,
}: ChartsPanelProps) {
  const [dptoSort, setDptoSort] = useState<'totalDesc' | 'alpha'>('totalDesc');
  const [capsSort, setCapsSort] = useState<'totalDesc' | 'alpha'>('totalDesc');
  const [espSort, setEspSort] = useState<'totalDesc' | 'alpha'>('totalDesc');

  // 1. Uso slices
  const usoSlices: PieSlice[] = useMemo(() => {
    const total = kpis.sinUsar + kpis.local + kpis.otroCaps;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);
    return [
      {
        key: 'sinUsar',
        label: 'Sin Usar',
        value: kpis.sinUsar,
        pctRounded: pct(kpis.sinUsar),
        color: '#d97706',
        textColor: 'text-amber-700',
      },
      {
        key: 'local',
        label: 'Local',
        value: kpis.local,
        pctRounded: pct(kpis.local),
        color: '#0f766e',
        textColor: 'text-teal-700',
      },
      {
        key: 'otroCaps',
        label: 'Otro CAPS',
        value: kpis.otroCaps,
        pctRounded: pct(kpis.otroCaps),
        color: '#0284c7',
        textColor: 'text-sky-700',
      },
    ];
  }, [kpis]);

  // 2. Asistencia slices (Otro CAPS & FechaTur < Lectura)
  const asistenciaSlices: PieSlice[] = useMemo(() => {
    let asistio = 0;
    let noAsistio = 0;

    for (const r of rows) {
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

      if (isSameCaps || slotNorm === 'libre' || !isBeforeLectura) continue;

      if (turnoNorm === 'admisionado') {
        asistio++;
      } else if (turnoNorm === 'asignado') {
        noAsistio++;
      }
    }

    const total = asistio + noAsistio;
    const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

    return [
      {
        key: 'asistio',
        label: 'Asistió',
        value: asistio,
        pctRounded: pct(asistio),
        color: '#059669',
        textColor: 'text-emerald-700',
      },
      {
        key: 'noAsistio',
        label: 'No Asistió',
        value: noAsistio,
        pctRounded: pct(noAsistio),
        color: '#e11d48',
        textColor: 'text-rose-700',
      },
    ];
  }, [rows, lecturaFechaIso]);

  // Consistent color assignment across both Por DPTO and Por CAPS
  const anotadorColorMap = useMemo(() => {
    const globals = new Map<string, number>();
    for (const r of rows) {
      const slotNorm = r.estadoSlot.trim().toLowerCase();
      const capsNorm = r.caps.trim().toLowerCase();
      const anotNorm = r.anotador.trim().toLowerCase();
      const hasCapsAndAnotador =
        r.caps !== 'Sin CAPS' && r.anotador !== 'Sin anotador';
      const isSameCaps = hasCapsAndAnotador && anotNorm === capsNorm;

      if (
        slotNorm !== 'asignado' ||
        r.anotador === 'Sin anotador' ||
        isSameCaps
      ) {
        continue;
      }
      globals.set(r.anotador, (globals.get(r.anotador) ?? 0) + 1);
    }

    const sorted = Array.from(globals.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([name]) => name);

    const map = new Map<string, string>();
    sorted.forEach((name, idx) => {
      map.set(name, ANOTADOR_PALETTE[idx % ANOTADOR_PALETTE.length]);
    });
    return map;
  }, [rows]);

  // 3. Por DPTO stacked vertical bar data (Otro CAPS only)
  const dptoChart = useMemo(
    () => buildGroupedOtroCapsData(rows, (r) => r.dpto, anotadorColorMap, dptoSort),
    [rows, anotadorColorMap, dptoSort]
  );

  // 4. Por CAPS stacked vertical bar data (Otro CAPS only)
  const capsChart = useMemo(
    () => buildGroupedOtroCapsData(rows, (r) => r.caps, anotadorColorMap, capsSort),
    [rows, anotadorColorMap, capsSort]
  );

  // 5. Por Especialidad stacked vertical bar data (Otro CAPS only)
  const espChart = useMemo(
    () =>
      buildGroupedOtroCapsData(
        rows,
        (r) => r.especialidad,
        anotadorColorMap,
        espSort
      ),
    [rows, anotadorColorMap, espSort]
  );

  return (
    <div className="space-y-5">
      {/* Top Row: 3 evenly distributed charts (Uso, Asistencia, Por DPTO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <CircularChartCard
          title="Uso"
          subtitle="Porcentaje redondeado y cantidad por tipo de uso"
          slices={usoSlices}
          displayMode="pct-and-qty"
          emptyMessage="No hay registros que coincidan con los filtros seleccionados."
          pdfFilename="grafico-uso.pdf"
        />

        <CircularChartCard
          title="Asistencia"
          subtitle="Turnos de Otro CAPS con FechaTur menor a la fecha de Lectura"
          slices={asistenciaSlices}
          displayMode="qty-only"
          emptyMessage="No hay turnos de Otro CAPS anteriores a la fecha de lectura con los filtros actuales."
          pdfFilename="grafico-asistencia.pdf"
        />

        <StackedBarChartCard
          title="Por DPTO"
          subtitle="CAPS anotadores con valores (solo Otro CAPS)"
          drillDownDim="dpto"
          bars={dptoChart.bars}
          maxBarTotal={dptoChart.maxBarTotal}
          legendItems={dptoChart.legendItems}
          barSort={dptoSort}
          onChangeSort={setDptoSort}
          chartHeightPx={185}
          compact
          pdfFilename="grafico-por-dpto.pdf"
          onDrillDown={onDrillDown}
        />
      </div>

      {/* Stacked Vertical Bar Chart: Por CAPS */}
      <StackedBarChartCard
        title="Por CAPS"
        subtitle="Barras verticales apiladas por CAPS: CAPS anotadores con valores (sin Local)"
        drillDownDim="caps"
        bars={capsChart.bars}
        maxBarTotal={capsChart.maxBarTotal}
        legendItems={capsChart.legendItems}
        barSort={capsSort}
        onChangeSort={setCapsSort}
        chartHeightPx={300}
        pdfFilename="grafico-por-caps.pdf"
        onDrillDown={onDrillDown}
      />

      {/* Stacked Vertical Bar Chart: Por Especialidad */}
      <StackedBarChartCard
        title="Por Especialidad"
        subtitle="Barras verticales apiladas por Especialidad: CAPS anotadores con valores (solo Otro CAPS)"
        drillDownDim="especialidad"
        bars={espChart.bars}
        maxBarTotal={espChart.maxBarTotal}
        legendItems={espChart.legendItems}
        barSort={espSort}
        onChangeSort={setEspSort}
        chartHeightPx={300}
        pdfFilename="grafico-por-especialidad.pdf"
        onDrillDown={onDrillDown}
      />
    </div>
  );
}
