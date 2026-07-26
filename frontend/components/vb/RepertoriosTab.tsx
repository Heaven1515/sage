"use client"

/*
  Componente: RepertoriosTab
  Tab 3 del módulo VB — Repertorios y Registro de Datos.

  Secciones:
    1. Cargar planilla + tabla preview
    2. Llenar Words / Imprimir / Cancelar
    3. Botón Indexar Repertorios (usa la planilla ya cargada en memoria)
    4. Panel resultado del indexado
    5. Repositorio permanente: tabla con buscador y filtro por año
*/

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Upload, FileEdit, Printer, XCircle,
  CheckCircle2, AlertTriangle, FileText,
  ChevronRight, FolderOpen, Database, Search, RefreshCw, Trash2, Save,
} from "lucide-react"
import { useVBRepertorios, type ResultadoItem, type EstadoImpresion } from "@/hooks/useVBRepertorios"
import { useVBRegistro } from "@/hooks/useVBRegistro"

const URL_CARPETAS = "http://localhost:8000/vb/words/carpetas"

// ── Helpers de UI ─────────────────────────────────────────────────────────────

function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
      {children}
    </p>
  )
}

function BarraProgreso({ estado }: { estado: EstadoImpresion }) {
  const porcentaje = estado.total > 0
    ? Math.round((estado.procesados / estado.total) * 100)
    : 0
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#374151] font-medium">{estado.mensaje}</span>
        <span className="text-[#6B7280] tabular-nums">{estado.procesados} / {estado.total}</span>
      </div>
      <div className="w-full bg-[#F4F6F8] rounded-full h-2">
        <div
          className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

function BadgeEstado({ estado }: { estado: ResultadoItem["estado"] }) {
  const estilos: Record<ResultadoItem["estado"], string> = {
    OK: "bg-[#22c55e]/10 text-[#22c55e]",
    SIN_WORD: "bg-yellow-100 text-yellow-600",
    ERROR: "bg-red-100 text-red-500",
  }
  const etiquetas: Record<ResultadoItem["estado"], string> = {
    OK: "OK", SIN_WORD: "Sin Word", ERROR: "Error",
  }
  return (
    <span className={cn("text-xs font-semibold rounded-full px-2.5 py-1", estilos[estado])}>
      {etiquetas[estado]}
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RepertoriosTab() {
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  const {
    items, respuesta, estadoImpresion,
    cargando, llenando, error,
    anio, guardandoAnio, cargarAnio, guardarAnio,
    cargarPlanilla, llenarWords, imprimir, cancelar, limpiar,
  } = useVBRepertorios()

  const {
    registros, cargando: cargandoRegistros, indexando,
    error: errorRegistro, resultadoIndexar,
    indexarSesion, cargarRegistros, limpiarRegistros,
  } = useVBRegistro()

  // Subcarpeta seleccionada para leer Words al indexar
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<string>("")
  const [carpetas, setCarpetas]                       = useState<string[]>([])
  // Campo editable del año (string para permitir edición libre antes de guardar)
  const [anioInput, setAnioInput] = useState<string>("")
  // Texto de búsqueda y año para la tabla del repositorio
  const [busqueda, setBusqueda] = useState("")
  const [anioFiltro, setAnioFiltro] = useState("")

  useEffect(() => {
    cargarCarpetas()
    cargarAnio()
    // No se carga el repositorio al montar — solo aparece tras indexar o buscar
    // Para buscar una escritura específica usar el buscador global del encabezado
  }, [])

  // Sincronizar el input cuando llega el año desde el backend
  useEffect(() => { setAnioInput(String(anio)) }, [anio])

  async function cargarCarpetas() {
    try {
      const r    = await fetch(URL_CARPETAS)
      if (!r.ok) return
      const datos = await r.json()
      const lista: string[] = datos.carpetas ?? []
      setCarpetas(lista)
      // Preseleccionar la más reciente
      if (lista.length > 0) setCarpetaSeleccionada(lista[0])
    } catch {
      // Sin carpetas configuradas — el dropdown quedará vacío
    }
  }

  async function manejarArchivoExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    await cargarPlanilla(archivo)
    e.target.value = ""
  }

  async function manejarGuardarAnio() {
    const num = parseInt(anioInput, 10)
    if (isNaN(num) || num < 2000 || num > 2100) return
    await guardarAnio(num)
  }

  // Indexa usando la carpeta seleccionada para leer comunas + la planilla en memoria
  async function manejarIndexar() {
    if (!carpetaSeleccionada) return
    await indexarSesion(carpetaSeleccionada, items)
  }

  function manejarBusqueda(e: React.ChangeEvent<HTMLInputElement>) {
    setBusqueda(e.target.value)
    cargarRegistros(e.target.value || undefined)
  }

  function manejarAnio(e: React.ChangeEvent<HTMLInputElement>) {
    setAnioFiltro(e.target.value)
    const num = parseInt(e.target.value, 10)
    cargarRegistros(busqueda || undefined, isNaN(num) ? undefined : num)
  }

  return (
    <div className="flex flex-col gap-5">

      <input
        ref={inputArchivoRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={manejarArchivoExcel}
      />

      {/* ── 1. Cargar planilla ───────────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => inputArchivoRef.current?.click()}
            disabled={cargando}
            className="flex items-center gap-1.5 border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--accent)] rounded-xl h-9 px-4 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Upload size={14} />
            {cargando ? "Cargando..." : "Cargar Planilla"}
          </button>
          <button
            onClick={() => { limpiar(); limpiarRegistros() }}
            disabled={items.length === 0 && !respuesta && !error && registros.length === 0 && !resultadoIndexar}
            title="Limpiar resultados de pantalla"
            className="flex items-center gap-1.5 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-[#9CA3AF] rounded-xl h-9 px-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            <Trash2 size={14} />
            Limpiar Planilla
          </button>
          {items.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-medium rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] inline-block" />
              {items.length} repertorios cargados
            </span>
          ) : (
            <span className="text-xs text-[#9CA3AF]">Sin planilla cargada</span>
          )}

          {/* Control de año — separado visualmente, pegado a la derecha */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-[#6B7280] whitespace-nowrap">Año escrituras</span>
            <input
              type="number"
              value={anioInput}
              onChange={e => setAnioInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && manejarGuardarAnio()}
              className="w-20 h-9 text-sm text-center font-semibold tabular-nums border border-gray-200 rounded-xl px-2 focus:outline-none focus:border-[var(--accent)]/40 bg-[#F4F6F8]"
            />
            <button
              onClick={manejarGuardarAnio}
              disabled={guardandoAnio || anioInput === String(anio)}
              title="Guardar año"
              className="w-9 h-9 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
            >
              <Save size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Tabla preview ─────────────────────────────────────────────── */}
      {items.length > 0 && !respuesta && (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
              Repertorios a completar
              <span className="ml-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-2 py-0.5 text-xs font-bold">
                {items.length}
              </span>
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-[var(--accent)]">
                  {["N°", "WF", "Nombre Cliente", "Repertorio"].map((col) => (
                    <th key={col} className="text-left text-white font-semibold text-xs tracking-wide px-5 py-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={`${item.wf}-${i}`} className={cn("border-b border-gray-50 hover:bg-[#F4F6F8]/60", i % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30")}>
                    <td className="px-5 py-2.5 text-[#9CA3AF] tabular-nums text-xs">{i + 1}</td>
                    <td className="px-5 py-2.5 font-semibold text-[#111827] tabular-nums">{item.wf}</td>
                    <td className="px-5 py-2.5 text-[#374151]">{item.nombreCliente}</td>
                    <td className="px-5 py-2.5 text-[#374151] tabular-nums">{item.repertorio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Error de carga planilla ──────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── 3. Selector de carpeta para leer comunas al indexar ─────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <FolderOpen size={15} className="text-[#7c3aed] shrink-0" />
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide shrink-0">
            Carpeta de Documentos
          </span>
          {carpetas.length > 0 ? (
            <select
              value={carpetaSeleccionada}
              onChange={e => setCarpetaSeleccionada(e.target.value)}
              className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl px-3 h-9 text-sm text-[#111827] focus:outline-none focus:border-[#7c3aed]/40"
            >
              {carpetas.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-[#9CA3AF] italic">
              Sin subcarpetas — configura la carpeta base en Finalización
            </span>
          )}
          <button
            onClick={cargarCarpetas}
            title="Recargar lista de carpetas"
            className="w-9 h-9 bg-[#F4F6F8] border border-gray-200 rounded-xl flex items-center justify-center hover:border-[#7c3aed]/40 hover:text-[#7c3aed] text-[#6B7280] transition-all shrink-0"
          >
            <RefreshCw size={13} />
          </button>
        </div>
        {carpetaSeleccionada && (
          <p className="text-xs text-[#9CA3AF] mt-2 pl-6">
            Al indexar se leerán las comunas de los Words en <span className="font-medium text-[#7c3aed]">{carpetaSeleccionada}</span>
          </p>
        )}
      </div>

      {/* ── 4. Acciones: Llenar Words / Imprimir / Cancelar / Indexar ───── */}
      <div className="flex flex-col gap-3">

        {/* Llenar Words — usa la carpeta seleccionada en el dropdown */}
        <button
          onClick={() => llenarWords(carpetaSeleccionada || undefined)}
          disabled={items.length === 0 || llenando || !carpetaSeleccionada}
          className="w-full bg-white border-2 border-[#0d9488]/30 hover:border-[#0d9488]/60 hover:bg-[#0d9488]/5 disabled:opacity-40 disabled:cursor-not-allowed text-[#0d9488] rounded-xl px-5 h-16 flex items-center gap-4 shadow-sm transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-[#0d9488]/10 flex items-center justify-center shrink-0">
            <FileEdit size={16} className="text-[#0d9488]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[#0d9488]">
              {llenando ? "Procesando..." : "Completar Documentos y Generar Resumen"}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Completa los documentos con N° de repertorio y fecha, genera RESUMEN.docx en Completos/
            </p>
          </div>
          {llenando
            ? <div className="w-4 h-4 border-2 border-[#0d9488]/30 border-t-[#0d9488] rounded-full animate-spin shrink-0" />
            : <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
          }
        </button>

        {/* Imprimir — usa la misma carpeta seleccionada */}
        <button
          onClick={() => imprimir(carpetaSeleccionada || undefined)}
          disabled={!respuesta || estadoImpresion?.enCurso}
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

        {/* Cancelar impresión */}
        <button
          onClick={cancelar}
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

        {/* Indexar Repertorios */}
        <button
          onClick={manejarIndexar}
          disabled={indexando || !carpetaSeleccionada}
          title={!carpetaSeleccionada ? "Selecciona una carpeta de documentos arriba" : ""}
          className="w-full bg-white border-2 border-[#7c3aed]/20 hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 disabled:opacity-40 disabled:cursor-not-allowed text-[#7c3aed] rounded-xl px-5 h-16 flex items-center gap-4 shadow-sm transition-all"
        >
          <div className="w-9 h-9 rounded-full bg-[#7c3aed]/10 flex items-center justify-center shrink-0">
            <Database size={16} className="text-[#7c3aed]" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-[#7c3aed]">
              {indexando ? "Registrando..." : "Registrar Repertorios"}
            </p>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {carpetaSeleccionada
                ? `Lee comunas de ${carpetaSeleccionada}${items.length > 0 ? " · cruza con planilla cargada" : " · sin planilla (solo datos del documento)"}`
                : "Selecciona una carpeta de documentos arriba para continuar"
              }
            </p>
          </div>
          {indexando
            ? <div className="w-4 h-4 border-2 border-[#7c3aed]/30 border-t-[#7c3aed] rounded-full animate-spin shrink-0" />
            : <ChevronRight size={16} className="text-[#9CA3AF] shrink-0" />
          }
        </button>
      </div>

      {/* ── Progreso de impresión ────────────────────────────────────────── */}
      {estadoImpresion && (
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <EtiquetaSeccion>
            {estadoImpresion.enCurso ? "Imprimiendo..." : "Impresión"}
          </EtiquetaSeccion>
          <BarraProgreso estado={estadoImpresion} />
        </div>
      )}

      {/* ── Resultados del Llenar Words ──────────────────────────────────── */}
      {respuesta && (
        <>
          <div className="bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#22c55e] shrink-0" />
              <p className="text-sm font-semibold text-[#166534]">
                {respuesta.totalOk} Word{respuesta.totalOk !== 1 ? "s" : ""} completado{respuesta.totalOk !== 1 ? "s" : ""}
                {respuesta.totalSinWord > 0 && ` — ${respuesta.totalSinWord} sin Word`}
                {respuesta.totalError > 0 && ` — ${respuesta.totalError} con error`}
              </p>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <FolderOpen size={13} className="text-[#16a34a] shrink-0" />
              <p className="text-xs text-[#166534] break-all">
                <span className="font-medium">Completos/</span> — {respuesta.wordResumen}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">Detalle del procesamiento</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--accent)]">
                  {["N°", "WF", "Nombre Cliente", "Repertorio", "Estado"].map((col) => (
                    <th key={col} className="text-left text-white font-semibold text-xs tracking-wide px-5 py-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {respuesta.resultados.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-sm text-[#9CA3AF]">Sin resultados</td></tr>
                ) : (
                  respuesta.resultados.map((item, i) => (
                    <tr key={`${item.wf}-${i}`} className={cn("border-b border-gray-50 hover:bg-[#F4F6F8]/60", i % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30")}>
                      <td className="px-5 py-3 text-[#9CA3AF] tabular-nums text-xs">{i + 1}</td>
                      <td className="px-5 py-3 font-semibold text-[#111827] tabular-nums">{item.wf}</td>
                      <td className="px-5 py-3 text-[#374151]">{item.nombreCliente}</td>
                      <td className="px-5 py-3 text-[#374151] tabular-nums">{item.repertorio}</td>
                      <td className="px-5 py-3"><BadgeEstado estado={item.estado} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Panel resultado del Indexar ──────────────────────────────────── */}
      {resultadoIndexar && (
        <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl p-4 flex flex-wrap gap-5 items-center">
          <CheckCircle2 size={18} className="text-[#7c3aed] shrink-0" />
          <div className="flex flex-wrap gap-5 text-sm">
            <span><strong className="text-[#111827]">{resultadoIndexar.indexados}</strong> <span className="text-[#6B7280]">nuevos</span></span>
            <span><strong className="text-[#111827]">{resultadoIndexar.actualizados}</strong> <span className="text-[#6B7280]">actualizados</span></span>
            {resultadoIndexar.sinRepertorio > 0 && (
              <span><strong className="text-yellow-600">{resultadoIndexar.sinRepertorio}</strong> <span className="text-[#6B7280]">sin repertorio</span></span>
            )}
          </div>
          <span className="ml-auto text-xs text-[#6B7280]">
            Total repositorio: <strong className="text-[#111827]">{resultadoIndexar.total}</strong>
          </span>
        </div>
      )}

      {/* ── Error del indexado ───────────────────────────────────────────── */}
      {errorRegistro && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{errorRegistro}</p>
        </div>
      )}

      {/* ── 5. Repositorio permanente ────────────────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">Archivo Permanente de Repertorios</p>
            {registros.length > 0 && (
              <span className="bg-[#7c3aed]/10 text-[#7c3aed] rounded-full px-2 py-0.5 text-xs font-bold">
                {registros.length}
              </span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="WF, RUT o nombre..."
                value={busqueda}
                onChange={manejarBusqueda}
                className="pl-7 pr-3 h-9 text-xs bg-[#F4F6F8] border border-gray-200 rounded-xl focus:outline-none focus:border-[#7c3aed]/40 w-48"
              />
            </div>
            <input
              type="number"
              placeholder="Año"
              value={anioFiltro}
              onChange={manejarAnio}
              className="w-20 h-9 text-xs text-center bg-[#F4F6F8] border border-gray-200 rounded-xl px-2 focus:outline-none focus:border-[#7c3aed]/40"
            />
            <button
              onClick={() => { setBusqueda(""); setAnioFiltro(""); cargarRegistros() }}
              disabled={cargandoRegistros}
              title="Recargar repositorio"
              className="w-9 h-9 bg-[#F4F6F8] border border-gray-200 rounded-xl flex items-center justify-center hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/5 hover:text-[#7c3aed] text-[#6B7280] transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={cn(cargandoRegistros && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--accent)]">
                {["N°", "WF", "RUT", "Nombre Cliente", "Comuna", "Materia", "Repertorio"].map((col) => (
                  <th key={col} className="text-left text-white font-semibold text-xs tracking-wide px-4 py-3 whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-[#9CA3AF]">
                      <div className="w-12 h-12 rounded-2xl bg-[#F4F6F8] border border-gray-100 flex items-center justify-center">
                        <FileText size={22} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-semibold text-[#6B7280]">Sin registros</p>
                      <p className="text-xs text-[#9CA3AF]">Registra una sesión para ver datos aquí</p>
                    </div>
                  </td>
                </tr>
              ) : (
                registros.map((reg, i) => (
                  <tr key={reg.id} className={cn("border-b border-gray-50 hover:bg-[#F4F6F8]/60", i % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30")}>
                    <td className="px-4 py-3 text-[#9CA3AF] tabular-nums text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-[#111827] tabular-nums">{reg.wf}</td>
                    <td className="px-4 py-3 text-[#374151] tabular-nums text-xs">{reg.rut ?? "—"}</td>
                    <td className="px-4 py-3 text-[#374151]">{reg.nombreCliente}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-medium rounded-full px-2.5 py-1 whitespace-nowrap",
                        reg.comuna.toUpperCase() === "SANTIAGO"
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "bg-purple-100 text-purple-700"
                      )}>
                        {reg.comuna}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#374151] text-xs">{reg.materia}</td>
                    <td className="px-4 py-3 text-[#374151] tabular-nums text-xs">
                      {reg.repertorio ? `${reg.repertorio}-${reg.anio}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
