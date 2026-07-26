"use client"

/*
  Componente: TablaLogs
  Historial de PDFs procesados durante la sesión.
  Código de color por estado: verde (ok), rojo (error), amarillo (procesando).
*/

import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import type { LogItem } from "@/hooks/usePrefirma"

interface Props {
  logs: LogItem[]
}

function IconoEstado({ estado }: { estado: string }) {
  if (estado === "ok")    return <CheckCircle size={14} className="text-green-500 shrink-0" />
  if (estado === "error") return <XCircle     size={14} className="text-red-500 shrink-0"   />
  return <Loader2 size={14} className="text-yellow-500 animate-spin shrink-0" />
}

function formatearHora(fechaStr: string): string {
  return new Date(fechaStr).toLocaleTimeString("es-CL", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function FilaLog({ log }: { log: LogItem }) {
  const colorFila =
    log.estado === "ok"    ? "hover:bg-green-50"  :
    log.estado === "error" ? "bg-red-50 hover:bg-red-100" :
                             "bg-yellow-50 hover:bg-yellow-100"

  const repertorio = log.repertorio && log.anho_repertorio
    ? `${log.repertorio}-${log.anho_repertorio}`
    : log.repertorio ?? "—"

  return (
    <tr className={`${colorFila} transition-colors border-b border-gray-50`}>
      <td className="px-3 py-2 text-xs text-[#374151]">{log.nombre_archivo}</td>
      <td className="px-3 py-2 text-xs text-[#374151] text-center tabular-nums">{repertorio}</td>
      <td className="px-3 py-2 text-xs text-[#374151]">{log.tipo_contrato ?? "—"}</td>
      <td className="px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <IconoEstado estado={log.estado} />
          {log.estado === "error" && log.mensaje_error && (
            <span className="text-red-600 truncate max-w-[220px]" title={log.mensaje_error}>
              {log.mensaje_error}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-[#6B7280] text-center tabular-nums">
        {formatearHora(log.fecha_procesado)}
      </td>
    </tr>
  )
}

export function TablaLogs({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-8 text-center shadow-sm">
        <p className="text-sm text-[#9CA3AF]">Ningún PDF procesado aún en esta sesión.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase px-5 pt-4 pb-3">
        Historial de Procesamiento
      </p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F4F6F8]">
              <th className="px-3 py-2 text-xs font-semibold text-[#6B7280] text-left">Archivo</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#6B7280] text-center">Repertorio</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#6B7280] text-left">Tipo de Contrato</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#6B7280] text-left">Estado</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#6B7280] text-center">Hora</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => <FilaLog key={log.id} log={log} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
