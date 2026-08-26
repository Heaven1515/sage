"use client"

/*
  Componente: PanelLogs
  Módulo 03 — Prefirma.
  Muestra el historial de PDFs procesados por el modo automático,
  con su estado y mensaje de error para diagnóstico.
*/

import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"
import type { LogItem } from "@/hooks/usePrefirma"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatearFecha(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString("es-CL", {
      day:    "2-digit",
      month:  "2-digit",
      hour:   "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function BadgeEstado({ estado }: { estado: string }) {
  const estilos: Record<string, string> = {
    ok:        "bg-green-100 text-green-700",
    error:     "bg-red-100 text-red-700",
    sin_datos: "bg-yellow-100 text-yellow-700",
  }
  const etiquetas: Record<string, string> = {
    ok:        "Enviado",
    error:     "Error",
    sin_datos: "Sin datos",
  }
  return (
    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${estilos[estado] ?? "bg-gray-100 text-gray-500"}`}>
      {etiquetas[estado] ?? estado}
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  logs: LogItem[]
}

export function PanelLogs({ logs }: Props) {
  const [abierto, setAbierto] = useState(false)

  const errores  = logs.filter(l => l.estado === "error").length
  const sinDatos = logs.filter(l => l.estado === "sin_datos").length

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm">

      {/* Cabecera — siempre visible */}
      <button
        onClick={() => setAbierto(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
            Operaciones de hoy
          </p>
          {logs.length > 0 && (
            <div className="flex gap-2">
              {errores > 0 && (
                <span className="text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                  {errores} error{errores !== 1 ? "es" : ""}
                </span>
              )}
              {sinDatos > 0 && (
                <span className="text-[10px] font-semibold bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5">
                  {sinDatos} sin datos
                </span>
              )}
              {errores === 0 && sinDatos === 0 && (
                <span className="text-[10px] font-semibold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                  Todo OK
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-[#9CA3AF]">
          <span className="text-xs">{logs.length} operacion{logs.length !== 1 ? "es" : ""}</span>
          {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Tabla desplegable */}
      {abierto && (
        <div className="border-t border-gray-100 overflow-x-auto">
          {logs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#9CA3AF] text-center">
              Sin operaciones hoy — aparecen aquí cuando el modo automático procesa archivos
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-gray-100">
                  {["Hora", "Archivo", "Repertorio", "Estado", "Detalle"].map(col => (
                    <th key={col} className="text-left font-semibold text-[#6B7280] px-4 py-2.5 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-[#F4F6F8]/50">
                    <td className="px-4 py-2.5 tabular-nums text-[#9CA3AF] whitespace-nowrap">
                      {formatearFecha(log.fecha_procesado)}
                    </td>
                    <td className="px-4 py-2.5 text-[#374151] max-w-[200px] truncate" title={log.nombre_archivo}>
                      {log.nombre_archivo}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[#374151]">
                      {log.repertorio
                        ? `${log.repertorio}-${log.anho_repertorio}`
                        : <span className="text-[#9CA3AF]">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <BadgeEstado estado={log.estado} />
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280] max-w-[300px]">
                      {log.mensaje_error ?? <span className="text-[#9CA3AF]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
