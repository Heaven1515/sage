"use client"

/*
  Componente: FormatearTab
  Tab 2 del módulo 01 — Confecciones de Borradores.
  Solo renderiza la UI y delega toda la lógica a useFormatear.
*/

import { useRef, useState } from "react"
import { FolderOpen, Play, Trash2, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFormatear } from "@/hooks/useFormatear"

// ── Apoderados BDC — clave de backend → etiqueta corta para la UI ────────────
const APO_BDC: { key: string; label: string }[] = [
  { key: "nathalie",   label: "Nathalie Villalobos" },
  { key: "andrea",     label: "Andrea Sanz" },
  { key: "jonatan",    label: "Jonatan Gutiérrez" },
  { key: "carolina_v", label: "Carolina Vilches" },
  { key: "maria_ines", label: "María Inés Asenjo" },
  { key: "jacqueline", label: "Jacqueline Miranda" },
]

// ── Apoderados Banlegal — sección independiente ───────────────────────────────
const APO_BANLEGAL: { key: string; label: string }[] = [
  { key: "ronnie", label: "Ronnie Palma" },
  { key: "felix",  label: "Félix Morales" },
]

const NOTARIOS = [
  "Carolina Piña Cuevas",
  "Notario Suplente Brenda Pérez",
  "Notario Suplente 2",
] as const

// ── Icono de estado por archivo ───────────────────────────────────────────────
function IconoEstado({ estado }: { estado: string }) {
  if (estado === "ok")         return <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" />
  if (estado === "error")      return <XCircle size={14} className="text-[#ef4444] shrink-0" />
  if (estado === "procesando") return <Loader2 size={14} className="text-[var(--accent)] shrink-0 animate-spin" />
  return <FileText size={14} className="text-[#9CA3AF] shrink-0" />
}

export function FormatearTab() {
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Estado de selección de apoderados ──────────────────────────────────────
  // modo indica cuál sección está activa: 'bdc' (2 dropdowns) o 'banlegal' (radio)
  const [modo,        setModo]        = useState<'bdc' | 'banlegal'>('bdc')
  const [apo1,        setApo1]        = useState<string>("")
  const [apo2,        setApo2]        = useState<string>("")
  const [apoBanlegal, setApoBanlegal] = useState<string>("")
  const [notario,     setNotario]     = useState<string>(NOTARIOS[0])

  // Cuando cambia el primer apoderado BDC, limpia el segundo si era igual
  function manejarApo1(valor: string) {
    setApo1(valor)
    setModo('bdc')
    if (apo2 === valor) setApo2("")
  }

  const {
    archivos,
    log,
    progreso,
    procesando,
    seleccionarArchivos,
    limpiar,
    formatear,
    contadores,
  } = useFormatear()

  const manejarSeleccion = (e: React.ChangeEvent<HTMLInputElement>) => {
    seleccionarArchivos(e.target.files)
    // Resetear input para permitir re-seleccionar los mismos archivos
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="grid grid-cols-[320px_1fr] gap-5">

      {/* ── Columna izquierda ── */}
      <div className="flex flex-col gap-4">

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-[var(--accent)] tabular-nums">{contadores.seleccionados}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-medium">Selec.</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-[#22c55e] tabular-nums">{contadores.ok}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-medium">OK</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-black text-[#ef4444] tabular-nums">{contadores.errores}</p>
            <p className="text-xs text-[#6B7280] mt-0.5 font-medium">Error</p>
          </div>
        </div>

        {/* Input de archivos (oculto) */}
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.doc"
          multiple
          className="hidden"
          onChange={manejarSeleccion}
        />

        {/* Botón seleccionar */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={procesando}
          className="w-full bg-white border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--accent)] rounded-xl h-11 text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={16} />
          Seleccionar archivos Word
        </button>

        {/* Apoderados Banco de Chile — selección libre de 2 */}
        <div className={cn(
          "bg-white rounded-xl p-5 shadow-sm border-2 transition-colors",
          modo === 'bdc' ? "border-[var(--accent)]" : "border-gray-100"
        )}>
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
            Banco de Chile
          </p>
          <div className="flex flex-col gap-2">
            <select
              value={apo1}
              onChange={(e) => manejarApo1(e.target.value)}
              disabled={procesando}
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-[#374151] focus:outline-none focus:border-[var(--accent)] bg-white disabled:opacity-50"
            >
              <option value="">— Apoderado 1 —</option>
              {APO_BDC.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
            <select
              value={apo2}
              onChange={(e) => { setApo2(e.target.value); setModo('bdc') }}
              disabled={procesando || !apo1}
              className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm text-[#374151] focus:outline-none focus:border-[var(--accent)] bg-white disabled:opacity-50"
            >
              <option value="">— Apoderado 2 —</option>
              {/* El apoderado 1 no aparece en las opciones del segundo dropdown */}
              {APO_BDC.filter((a) => a.key !== apo1).map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Apoderados Banlegal — sección independiente */}
        <div className={cn(
          "bg-white rounded-xl p-5 shadow-sm border-2 transition-colors",
          modo === 'banlegal' ? "border-[var(--accent)]" : "border-gray-100"
        )}>
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
            Banlegal
          </p>
          <div className="flex flex-col gap-2.5">
            {APO_BANLEGAL.map((a) => (
              <label key={a.key} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="banlegal"
                  value={a.key}
                  checked={apoBanlegal === a.key && modo === 'banlegal'}
                  onChange={() => { setApoBanlegal(a.key); setModo('banlegal') }}
                  disabled={procesando}
                  className="accent-[#1565c0] w-4 h-4"
                />
                <span className={cn(
                  "text-sm transition-colors",
                  apoBanlegal === a.key && modo === 'banlegal'
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[#374151] group-hover:text-[#111827]"
                )}>
                  {a.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notaría */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
            Notaría
          </p>
          <div className="flex flex-col gap-2.5">
            {NOTARIOS.map((n) => (
              <label key={n} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="notaria"
                  value={n}
                  checked={notario === n}
                  onChange={() => setNotario(n)}
                  disabled={procesando}
                  className="accent-[#1565c0] w-4 h-4"
                />
                <span className={cn(
                  "text-sm transition-colors",
                  notario === n
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[#374151] group-hover:text-[#111827]"
                )}>
                  {n}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-3">Selecciona el notario titular del día</p>
        </div>

        {/* Botón FORMATEAR — habilitado solo cuando hay selección válida en el modo activo */}
        <button
          onClick={() => {
            if (modo === 'bdc') formatear('bdc', apo1, notario, apo2)
            else formatear('banlegal', apoBanlegal, notario)
          }}
          disabled={
            procesando ||
            contadores.seleccionados === 0 ||
            (modo === 'bdc' ? (!apo1 || !apo2) : !apoBanlegal)
          }
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl h-12 font-bold text-base flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {procesando
            ? <Loader2 size={17} className="animate-spin" />
            : <Play size={17} fill="white" />
          }
          {procesando ? "Formateando..." : "FORMATEAR"}
        </button>

        {/* Limpiar log */}
        <button
          onClick={limpiar}
          disabled={procesando}
          className="w-full border-2 border-[var(--accent)]/30 hover:border-[var(--accent)]/60 text-[var(--accent)] hover:bg-[var(--accent)]/5 rounded-xl h-9 text-xs font-medium flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 size={13} />
          Limpiar log
        </button>
      </div>

      {/* ── Columna derecha ── */}
      <div className="flex flex-col gap-4">

        {/* Archivos seleccionados */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
            Archivos Seleccionados
          </p>
          {archivos.length === 0 ? (
            <div className="flex items-center gap-3 py-4 text-[#9CA3AF]">
              <FileText size={20} className="text-gray-200 shrink-0" />
              <p className="text-sm">Ningún archivo seleccionado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {archivos.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-[#374151]">
                  <IconoEstado estado={f.estado} />
                  <span className="truncate flex-1">{f.nombre}</span>
                  {f.mensaje && (
                    <span className="text-xs text-[#ef4444] shrink-0">{f.mensaje}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progreso y log */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col flex-1 min-h-[280px]">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
            Progreso
          </p>
          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-52">
            {log.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">Esperando acción...</p>
            ) : (
              log.map((linea, i) => (
                <p key={i} className="text-sm text-[#374151] leading-relaxed">{linea}</p>
              ))
            )}
          </div>

          {/* Barra de progreso */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#6B7280] font-medium">Progreso</span>
              <span className="text-xs text-[#6B7280] tabular-nums">{progreso}%</span>
            </div>
            <div className="bg-[#F4F6F8] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#22c55e] h-2 rounded-full transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
