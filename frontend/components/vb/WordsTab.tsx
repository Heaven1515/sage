"use client"

/*
  Componente: WordsTab
  Tab 2 del módulo VB — lectura de Words y generación de planillas.

  La gestión de carpeta (seleccionar, activar, desactivar) vive en Tab 1.
  Este tab recibe el estado de carpeta como prop y solo lo usa para
  mostrar u ocultar el selector de subcarpeta.

  Sección 1: Selector de subcarpeta + botón "Leer Words"
  Sección 2: Tabla de resultados + botón "Generar Planilla"
*/

import { FileText, FolderOpen, RefreshCw, TableProperties, Printer, XCircle, ChevronRight } from "lucide-react"
import type { EstadoCarpeta } from "@/hooks/useVBCarpeta"
import { useVBWords } from "@/hooks/useVBWords"
import { cn } from "@/lib/utils"

// ── Helpers locales ───────────────────────────────────────────────────────────

function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
      {children}
    </p>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface PropsWordsTab {
  estadoCarpeta: EstadoCarpeta | null
}

export function WordsTab({ estadoCarpeta }: PropsWordsTab) {
  const {
    carpetasDisponibles, carpetaSeleccionada, setCarpetaSeleccionada,
    words, cargando: cargandoWords, generando, archivosGenerados,
    error: errorWords, leerWords, generarPlanillas, recargarCarpetas,
    estadoImpresion, imprimir, cancelarImpresion,
  } = useVBWords()

  return (
    <div className="flex flex-col gap-5">

      {/* ── Sección 1: Selector de carpeta + botón Leer Words ──────────────── */}
      {estadoCarpeta?.configurada ? (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <EtiquetaSeccion>Leer Documentos Word</EtiquetaSeccion>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Dropdown con subcarpetas disponibles */}
            {carpetasDisponibles.carpetas.length > 0 ? (
              <select
                value={carpetaSeleccionada}
                onChange={(e) => setCarpetaSeleccionada(e.target.value)}
                className="border border-gray-200 rounded-xl h-10 px-3 text-sm text-[#374151] bg-white focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 min-w-[180px]"
              >
                {carpetasDisponibles.carpetas.map((carpeta) => (
                  <option key={carpeta} value={carpeta}>
                    {carpeta}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-[#9CA3AF]">
                Sin carpetas disponibles — activa el vigilador en la pestaña Vistos Buenos
              </span>
            )}

            {/* Botón leer */}
            <button
              onClick={leerWords}
              disabled={cargandoWords || !carpetaSeleccionada}
              className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-5 h-10 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderOpen size={15} />
              {cargandoWords ? "Leyendo..." : "Leer Documentos"}
            </button>

            {/* Recargar lista de carpetas */}
            <button
              onClick={recargarCarpetas}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-[var(--accent)]/40 hover:text-[var(--accent)] text-[#6B7280] rounded-xl h-10 px-3 text-xs transition-all"
              title="Recargar lista de carpetas"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {errorWords && (
            <p className="mt-3 text-xs text-red-500 font-medium">{errorWords}</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p className="text-sm text-[#9CA3AF]">
            Configura y activa la carpeta de descargas en la pestaña <strong className="text-[#6B7280]">Vistos Buenos</strong> para leer los documentos.
          </p>
        </div>
      )}

      {/* ── Sección 2: Tabla de resultados + botón Generar Planillas ──────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
            Documentos Detectados
            {words.length > 0 && (
              <span className="ml-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-2 py-0.5 text-xs font-bold">
                {words.length}
              </span>
            )}
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            {words.length > 0 && (
              <p className="text-xs text-[#9CA3AF]">
                {words.filter((w) => w.enBd).length} con RUT de la lista · {words.filter((w) => !w.enBd).length} sin cruzar
              </p>
            )}

            {/* Botón Generar Planillas — activo solo cuando hay words cargados */}
            <button
              onClick={generarPlanillas}
              disabled={generando || words.length === 0}
              className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-4 h-9 text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TableProperties size={14} />
              {generando ? "Generando..." : "Generar Planilla de Registro"}
            </button>
          </div>
        </div>

        {/* Aviso de planillas generadas con éxito */}
        {archivosGenerados.length > 0 && (
          <div className="px-5 py-3 bg-[#22c55e]/5 border-b border-[#22c55e]/20">
            <p className="text-xs font-semibold text-[#16a34a] mb-1">
              {archivosGenerados.length} planilla{archivosGenerados.length > 1 ? "s" : ""} guardada{archivosGenerados.length > 1 ? "s" : ""} en Descargas
            </p>
            <ul className="flex flex-col gap-0.5">
              {archivosGenerados.map((nombre) => (
                <li key={nombre} className="text-xs tabular-nums text-[#374151]">
                  {nombre}
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--accent)]">
              {["N°", "WF", "RUT", "Nombre Cliente", "Materia", "Comuna"].map((col) => (
                <th key={col} className="text-left text-white font-semibold text-xs tracking-wide px-5 py-3">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {words.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-4 text-[#9CA3AF]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4F6F8] border border-gray-100 flex items-center justify-center">
                      <FileText size={26} className="text-gray-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#6B7280]">Sin archivos detectados</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">
                        Selecciona una carpeta y presiona Leer Documentos
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              words.map((item, index) => (
                <tr
                  key={item.archivo}
                  className={cn(
                    "border-b border-gray-50 transition-colors hover:bg-[#F4F6F8]/60",
                    index % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30"
                  )}
                >
                  <td className="px-5 py-3 text-[#9CA3AF] tabular-nums text-xs">{index + 1}</td>
                  <td className="px-5 py-3 font-semibold text-[#111827] tabular-nums">{item.wf}</td>
                  <td className="px-5 py-3 font-semibold text-[#111827] tabular-nums">
                    {item.rut ?? <span className="text-[#9CA3AF] font-normal">—</span>}
                  </td>
                  <td className="px-5 py-3 text-[#374151]">{item.nombreCliente}</td>
                  <td className="px-5 py-3">
                    <span className="bg-[#9CA3AF]/10 text-[#6B7280] text-xs font-medium rounded-full px-2.5 py-1">
                      {item.materia}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium rounded-full px-2.5 py-1">
                      {item.comuna}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Sección 3: Imprimir documentos de la carpeta ─────────────────────── */}
      {words.length > 0 && (
        <div className="flex flex-col gap-3">

          {/* Botón Imprimir */}
          <button
            onClick={imprimir}
            disabled={estadoImpresion?.enCurso}
            className="w-full bg-white border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--accent)] rounded-xl px-5 h-16 flex items-center gap-4 shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Printer size={16} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-[var(--accent)]">Imprimir Documentos</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                Envía todos los documentos de la carpeta del día a la impresora en segundo plano
              </p>
            </div>
            {estadoImpresion?.enCurso
              ? <div className="w-4 h-4 border-2 border-[var(--accent)]/30 border-t-[#1565c0] rounded-full animate-spin shrink-0" />
              : <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
            }
          </button>

          {/* Botón Cancelar */}
          <button
            onClick={cancelarImpresion}
            disabled={!estadoImpresion?.enCurso}
            className="w-full bg-white border-2 border-red-200 hover:border-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-5 h-16 flex items-center gap-4 shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <XCircle size={16} className="text-red-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-red-500">Cancelar Impresión</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Detiene el envío y limpia la cola de la impresora</p>
            </div>
          </button>
        </div>
      )}

      {/* ── Progreso de impresión ──────────────────────────────────────────── */}
      {estadoImpresion && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <EtiquetaSeccion>
            {estadoImpresion.enCurso ? "Imprimiendo..." : "Impresión"}
          </EtiquetaSeccion>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#374151] font-medium">{estadoImpresion.mensaje}</span>
              <span className="text-[#6B7280] tabular-nums">{estadoImpresion.procesados} / {estadoImpresion.total}</span>
            </div>
            <div className="w-full bg-[#F4F6F8] rounded-full h-2">
              <div
                className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500"
                style={{ width: `${estadoImpresion.total > 0 ? Math.round((estadoImpresion.procesados / estadoImpresion.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
