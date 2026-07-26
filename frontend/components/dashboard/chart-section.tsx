"use client"

/*
  ChartSection — gráfico de área con el total de repertorios por mes del año.
  Recibe los datos ya cargados (no hace fetch propio).
*/

import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts"
import { TrendingUp } from "lucide-react"
import type { PuntoGrafico } from "@/hooks/useDashboard"

interface CustomTooltipProps {
  active?:  boolean
  payload?: Array<{ value: number }>
  label?:   string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || payload[0].value == null) return null
  return (
    <div className="bg-white shadow-lg rounded-xl border border-gray-100 p-3 text-sm">
      <p className="font-semibold text-[#6B7280] mb-1">{label}</p>
      <p className="text-[var(--accent)] font-black text-lg tabular-nums">{payload[0].value}</p>
      <p className="text-xs text-[#9CA3AF]">repertorios</p>
    </div>
  )
}

interface Props {
  datos:  PuntoGrafico[]
  anio:   number
  mesActual: number
}

export function ChartSection({ datos, anio, mesActual }: Props) {
  // Solo muestra valor real hasta el mes actual; los futuros aparecen como null
  const datosGrafico = datos.map(p => ({
    ...p,
    valor: p.num <= mesActual ? p.total : null,
  }))

  // Punto actual: el último mes con datos
  const puntoActual = [...datosGrafico].reverse().find(p => p.valor !== null && p.valor > 0)

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_4px_0_rgba(0,0,0,0.06)] border border-gray-100">
      <div className="flex items-start mb-5">
        <TrendingUp size={18} className="text-[var(--accent)] mt-0.5 shrink-0 mr-2" />
        <div>
          <h3 className="text-base font-bold text-[#111827]">Evolución Anual de Repertorios</h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Total de repertorios indexados por mes · {anio}
          </p>
        </div>

        {/* Resumen numérico a la derecha */}
        <div className="ml-auto flex items-center gap-6">
          {datos.slice(0, mesActual).map(p => (
            p.total > 0 ? (
              <div key={p.mes} className="text-center">
                <p className="text-xs text-[#9CA3AF]">{p.mes}</p>
                <p className="text-sm font-bold text-[#111827] tabular-nums">{p.total}</p>
              </div>
            ) : null
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={datosGrafico} margin={{ top: 28, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#1565c0" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#1565c0" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="mes"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e2e8f0", strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="#1565c0"
            strokeWidth={2.5}
            fill="url(#areaGradient)"
            dot={false}
            activeDot={{ r: 5, fill: "#1565c0", strokeWidth: 0 }}
            connectNulls={false}
          />
          {/* Punto del mes más reciente con datos */}
          {puntoActual && puntoActual.valor !== null && puntoActual.valor > 0 && (
            <ReferenceDot
              x={puntoActual.mes}
              y={puntoActual.valor}
              r={5}
              fill="#1565c0"
              stroke="white"
              strokeWidth={2}
              label={{
                value: String(puntoActual.valor),
                position: "top",
                fontSize: 11,
                fontWeight: 700,
                fill: "#1565c0",
                dy: -6,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
