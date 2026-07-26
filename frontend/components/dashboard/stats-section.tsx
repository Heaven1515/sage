"use client"

/*
  StatsSection — métricas diarias y mensuales del dashboard.
  Recibe los datos ya cargados por el hook useDashboard (no hace fetch propio).
*/

import { FileText, Archive, TrendingUp, TrendingDown, Minus, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MetricasDiarias, MetricasMensuales } from "@/hooks/useDashboard"

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

// ── Badge de % comparativo ────────────────────────────────────────────────────

function PctBadge({ pct, etiqueta }: { pct: number | null; etiqueta: string }) {
  if (pct === null) return <span className="text-xs text-[#9CA3AF]">Sin datos {etiqueta}</span>

  const positivo = pct >= 0
  const Icon = pct === 0 ? Minus : positivo ? TrendingUp : TrendingDown

  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
      positivo ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50",
    )}>
      <Icon size={11} />
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  )
}

// ── Tarjeta diaria ────────────────────────────────────────────────────────────

function TarjetaDiaria({
  label, valor, pct, etiquetaPct, icon, iconBg,
}: {
  label:       string
  valor:       number
  pct:         number | null
  etiquetaPct: string
  icon:        React.ReactNode
  iconBg:      string
}) {
  return (
    <div className="bg-[#F4F6F8] rounded-xl p-4 border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-[#6B7280] font-medium leading-tight pr-2">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-black text-[#111827] tabular-nums">{valor}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <PctBadge pct={pct} etiqueta={etiquetaPct} />
        <span className="text-xs text-[#9CA3AF]">{etiquetaPct}</span>
      </div>
    </div>
  )
}

// ── Tarjeta mensual grande ────────────────────────────────────────────────────

function TarjetaMensual({
  label, valor, pct, etiquetaPct, icon, iconBg,
}: {
  label:       string
  valor:       number
  pct:         number | null
  etiquetaPct: string
  icon:        React.ReactNode
  iconBg:      string
}) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-[0_1px_4px_0_rgba(0,0,0,0.06)] border border-gray-100">
      <div className="flex items-start justify-between">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", iconBg)}>
          {icon}
        </div>
        <PctBadge pct={pct} etiqueta={etiquetaPct} />
      </div>
      <div className="mt-4">
        <p className="text-xs text-[#9CA3AF] uppercase tracking-wider font-medium">{label}</p>
        <p className="text-3xl font-black text-[#111827] mt-1.5 tabular-nums">{valor}</p>
      </div>
    </div>
  )
}

// ── Desglose Romero / BdC ─────────────────────────────────────────────────────

function FilaDesglose({
  label, valor, pct, color,
}: {
  label: string
  valor: number
  pct:   number | null
  color: "blue" | "teal"
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0",
          color === "blue" ? "bg-[var(--accent)]" : "bg-teal-500",
        )} />
        <span className="text-sm text-[#374151]">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-[#111827] tabular-nums">{valor}</span>
        <PctBadge pct={pct} etiqueta="vs mes ant." />
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  diario:      MetricasDiarias
  mensual:     MetricasMensuales
  mes:         number
  anio:        number
  notarioDia:  string
}

export function StatsSection({ diario, mensual, mes, anio, notarioDia }: Props) {
  const nombreMes     = MESES[mes - 1]
  const nombreMesAnt  = MESES[mensual.mes_anterior - 1]

  return (
    <div>

      {/* ── Resumen del mes ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-[#111827]">Resumen Mensual</h2>
          <p className="text-sm text-[#6B7280] mt-0.5">{nombreMes} {anio}</p>
        </div>
        <span className="text-xs text-[#6B7280] bg-[#F4F6F8] border border-gray-200 rounded-full px-3 py-1">
          vs {nombreMesAnt} {mensual.anio_anterior}
        </span>
      </div>

      {/* Tarjetas mensuales */}
      <div className="grid grid-cols-3 gap-4 mb-2">
        <TarjetaMensual
          icon={<FileText size={18} className="text-[var(--accent)]" />}
          iconBg="bg-blue-50"
          label="Repertorios Registrados"
          valor={mensual.actual.total}
          pct={mensual.pct_total}
          etiquetaPct="vs mes ant."
        />
        <TarjetaMensual
          icon={<FileText size={18} className="text-teal-600" />}
          iconBg="bg-teal-50"
          label="Romero y Asociados"
          valor={mensual.actual.romero}
          pct={mensual.pct_romero}
          etiquetaPct="vs mes ant."
        />
        <TarjetaMensual
          icon={<FileText size={18} className="text-violet-600" />}
          iconBg="bg-violet-50"
          label="Banco de Chile"
          valor={mensual.actual.bdc}
          pct={mensual.pct_bdc}
          etiquetaPct="vs mes ant."
        />
      </div>

      {/* Desglose inline debajo si hay datos */}
      {(mensual.actual.total > 0) && (
        <div className="bg-[#F4F6F8] rounded-xl px-4 py-1 mb-6 border border-gray-100">
          <FilaDesglose
            label="Romero y Asociados"
            valor={mensual.actual.romero}
            pct={mensual.pct_romero}
            color="teal"
          />
          <FilaDesglose
            label="Banco de Chile"
            valor={mensual.actual.bdc}
            pct={mensual.pct_bdc}
            color="blue"
          />
        </div>
      )}

      {/* ── Resumen del día ── */}
      <div className="mb-4">
        <h2 className="text-base font-bold text-[#111827]">Resumen Diario</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">Comparado con ayer</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TarjetaDiaria
          label="Escrituras confeccionadas"
          valor={diario.confecciones_hoy}
          pct={diario.conf_pct}
          etiquetaPct="vs ayer"
          icon={<FileText size={16} className="text-[var(--accent)]" />}
          iconBg="bg-blue-100"
        />
        <TarjetaDiaria
          label="Documentos en Custodia Hoy"
          valor={diario.boveda_hoy}
          pct={diario.boveda_pct}
          etiquetaPct="vs ayer"
          icon={<Archive size={16} className="text-violet-600" />}
          iconBg="bg-violet-100"
        />

        {/* Tarjeta Notario del Día — no numérica, diseño adaptado */}
        <div className="bg-[#F4F6F8] rounded-xl p-4 border border-gray-100">
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs text-[#6B7280] font-medium leading-tight pr-2">Notario Responsable del Día</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-100">
              <UserCheck size={16} className="text-[var(--accent)]" />
            </div>
          </div>
          <p className="text-sm font-bold text-[#111827] leading-snug">{notarioDia}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">Configurable en Ajustes</p>
        </div>
      </div>

    </div>
  )
}
