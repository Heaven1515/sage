"use client"

/*
  Componente: ListaArchivos
  Muestra los PDFs disponibles en la carpeta del escáner.
  El archivo seleccionado se resalta. Botón para actualizar la lista.
*/

import { FileText, RefreshCw, FolderOpen } from "lucide-react"

interface Props {
  rutaCarpeta:       string | null
  archivos:          string[]
  cargando:          boolean
  archivoActual:     string | null
  onSeleccionar:     (nombre: string) => void
  onCambiarCarpeta:  () => void
  onActualizar:      () => void
}

export function ListaArchivos({
  rutaCarpeta,
  archivos,
  cargando,
  archivoActual,
  onSeleccionar,
  onCambiarCarpeta,
  onActualizar,
}: Props) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-full min-h-[400px]">

      {/* Encabezado */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
            Documentos Disponibles
          </p>
          {rutaCarpeta && (
            <p className="text-[10px] text-[#9CA3AF] mt-0.5 tabular-nums truncate max-w-[200px]"
               title={rutaCarpeta}>
              {rutaCarpeta}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onActualizar}
            disabled={cargando}
            title="Actualizar lista"
            className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] text-[#6B7280] transition-colors"
          >
            <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          </button>
          <button
            onClick={onCambiarCarpeta}
            title="Cambiar carpeta"
            className="p-1.5 rounded-lg hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] text-[#6B7280] transition-colors"
          >
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {!rutaCarpeta && (
          <div className="p-6 text-center">
            <FolderOpen size={28} className="mx-auto text-[#D1D5DB] mb-2" />
            <p className="text-sm text-[#9CA3AF]">Selecciona una carpeta para comenzar</p>
            <button
              onClick={onCambiarCarpeta}
              className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              Seleccionar carpeta
            </button>
          </div>
        )}

        {rutaCarpeta && !cargando && archivos.length === 0 && (
          <div className="p-6 text-center">
            <p className="text-sm text-[#9CA3AF]">No hay PDFs en esta carpeta</p>
          </div>
        )}

        {archivos.map(nombre => {
          const seleccionado = nombre === archivoActual
          return (
            <button
              key={nombre}
              onClick={() => onSeleccionar(nombre)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors
                ${seleccionado
                  ? "bg-[var(--accent)]/10 border-l-2 border-[var(--accent)]"
                  : "hover:bg-[#F4F6F8] border-l-2 border-transparent"
                }`}
            >
              <FileText size={14} className={seleccionado ? "text-[var(--accent)] shrink-0" : "text-[#9CA3AF] shrink-0"} />
              <span className={`text-xs truncate ${seleccionado ? "text-[var(--accent)] font-medium" : "text-[#374151]"}`}>
                {nombre}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
