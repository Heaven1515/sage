"use client"

/*
  Componente: PanelControl
  Panel de control del modo automático en el módulo Prefirma.
  Muestra estado activo/detenido y los contadores de PDFs procesados hoy.
*/

import { Loader2, Play, Square } from "lucide-react"
import type { EstadoSesion } from "@/hooks/usePrefirma"

interface Props {
  estado:    EstadoSesion | null
  cargando:  boolean
  error:     string | null
  onIniciar: () => void
  onDetener: () => void
}

export function PanelControl({ estado, cargando, error, onIniciar, onDetener }: Props) {
  const activo = estado?.activo ?? false

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm mb-5">
      <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-4">
        Modo Automático
      </p>

      <div className="flex flex-wrap items-center gap-4">

        {/* Botón principal */}
        {!activo ? (
          <button
            onClick={onIniciar}
            disabled={cargando}
            className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {cargando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            Iniciar modo automático
          </button>
        ) : (
          <button
            onClick={onDetener}
            disabled={cargando}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {cargando ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} />}
            Detener
          </button>
        )}

        {/* Badge de estado */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
          activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          <span className={`w-2 h-2 rounded-full ${activo ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {activo ? "Activo" : "Detenido"}
        </div>

        {/* Contadores del día */}
        {estado && (
          <div className="flex gap-6 ml-auto">
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{estado.total_renombrados}</p>
              <p className="text-xs text-[#6B7280]">Renombrados hoy</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-red-500">{estado.total_errores}</p>
              <p className="text-xs text-[#6B7280]">Errores hoy</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>
      )}
    </div>
  )
}
