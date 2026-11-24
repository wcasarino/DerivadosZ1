import { KpiMetrics } from '../types/dashboard';

interface KpiStripProps {
  kpis: KpiMetrics;
  loading?: boolean;
}

function fmtInt(n: number): string {
  return n.toLocaleString('es-AR');
}

function fmtPct(n: number): string {
  return `${n.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

export function KpiStrip({ kpis, loading = false }: KpiStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-lg p-4 h-[108px] animate-pulse"
          >
            <div className="h-3 w-24 bg-slate-200 rounded mb-4" />
            <div className="h-7 w-28 bg-slate-200 rounded mb-3" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      aria-label="Indicadores clave de rendimiento"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-500">
          Total de Turnos
        </span>
        <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {fmtInt(kpis.totalTurnos)}
        </div>
        <div className="mt-2 h-4" aria-hidden="true" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-500">
          Sin Usar
        </span>
        <div className="mt-2 font-mono text-2xl font-semibold text-amber-700 tabular-nums tracking-tight">
          {fmtInt(kpis.sinUsar)}
        </div>
        <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums truncate">
          {fmtPct(kpis.pctSinUsar)} del Total
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-500">
          Local
        </span>
        <div className="mt-2 font-mono text-2xl font-semibold text-teal-700 tabular-nums tracking-tight">
          {fmtInt(kpis.local)}
        </div>
        <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums leading-relaxed">
          <div>{fmtPct(kpis.pctLocal)} del Total</div>
          <div>{fmtPct(kpis.pctLocalAnotados)} de Anotados</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-500">
          Otro CAPS
        </span>
        <div className="mt-2 font-mono text-2xl font-semibold text-sky-700 tabular-nums tracking-tight">
          {fmtInt(kpis.otroCaps)}
        </div>
        <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums leading-relaxed">
          <div>{fmtPct(kpis.pctOtroCaps)} del Total</div>
          <div>{fmtPct(kpis.pctOtroCapsAnotados)} de Anotados</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between">
        <span className="text-xs font-medium text-slate-500">
          Asistencia
        </span>
        <div className="mt-2 font-mono text-2xl font-semibold text-emerald-700 tabular-nums tracking-tight">
          {kpis.asistenciaPct}%
        </div>
        <div className="mt-2 text-xs text-slate-600 font-mono tabular-nums truncate">
          {fmtInt(kpis.asistenciaAdmisionados)} de {fmtInt(kpis.asistenciaAsignados)} asignados (&lt; lectura)
        </div>
      </div>
    </section>
  );
}
