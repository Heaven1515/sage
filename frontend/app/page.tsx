"use client"

import { useRef }                from "react"
import { AppShell }              from "@/components/dashboard/app-shell"
import { StatsSection }          from "@/components/dashboard/stats-section"
import { ChartSection }          from "@/components/dashboard/chart-section"
import { useDashboard }          from "@/hooks/useDashboard"
import { Upload, CheckCircle2 }  from "lucide-react"

export default function DashboardPage() {
  const { resumen, cargando, error, importarOT, importandoOT, resultadoOT, errorOT } = useDashboard()
  const inputOT = useRef<HTMLInputElement>(null)

  function manejarArchivoOT(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) importarOT(archivo)
    // Resetear input para permitir subir el mismo archivo dos veces
    e.target.value = ""
  }

  return (
    <AppShell activeItem="Panel de Control">
      <div className="p-6">

        {/* Título */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#111827]">
              Panel de Operaciones Notariales
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              33° Notaría de Santiago · Carolina Piña Cuevas
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            {/* Botón importar OT */}
            <input
              ref={inputOT}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={manejarArchivoOT}
            />
            <button
              onClick={() => inputOT.current?.click()}
              disabled={importandoOT}
              className="flex items-center gap-2 text-sm bg-white border border-[#D1D5DB] text-[#374151] rounded-full px-4 py-1.5 font-medium hover:bg-[#F4F6F8] transition-colors disabled:opacity-50"
            >
              <Upload size={14} />
              {importandoOT ? "Importando..." : "Importar OT"}
            </button>
            <span className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 font-medium whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              Sistema Activo
            </span>
          </div>
        </div>

        {/* Resultado importación OT */}
        {resultadoOT && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>
              OT importadas: <strong>{resultadoOT.actualizados}</strong> actualizadas,{" "}
              <strong>{resultadoOT.creados}</strong> creadas de {resultadoOT.total_filas} filas leídas.
              {resultadoOT.omitidos > 0 && ` (${resultadoOT.omitidos} omitidas sin WF)`}
            </span>
          </div>
        )}
        {errorOT && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
            Error al importar OT: {errorOT}
          </div>
        )}

        {/* Estado de carga */}
        {cargando && (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
            No se pudieron cargar las métricas: {error}
          </div>
        )}

        {/* Contenido principal */}
        {resumen && !cargando && (
          <div className="flex flex-col gap-6 pb-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <StatsSection
                diario={resumen.diario}
                mensual={resumen.mensual}
                mes={resumen.mes_actual}
                anio={resumen.anio_actual}
                notarioDia={resumen.notario_dia}
              />
            </div>
            <ChartSection
              datos={resumen.grafico}
              anio={resumen.anio_actual}
              mesActual={resumen.mes_actual}
            />
          </div>
        )}

      </div>
    </AppShell>
  )
}
