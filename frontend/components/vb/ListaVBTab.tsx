"use client"

/*
  Componente: ListaVBTab
  Módulo 02 — Tab 1: Lista de Trabajo (Vistos Buenos)

  Flujo:
    1. Usuario sube el .xls del banco → se muestran TODAS las filas del archivo
    2. Panel izquierdo: actividades con conteos y checkboxes (VB marcadas por defecto)
    3. La tabla muestra las filas cuya actividad esté marcada, SIN repetir N° Carpeta
*/

import { useState, useRef, useEffect } from "react"
import { Upload, Trash2, Copy, CheckCircle2, FileText, XCircle, FolderPlus, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVB, type FilaVB } from "@/hooks/useVB"
import { useVBCarpeta, type EstadoCarpeta } from "@/hooks/useVBCarpeta"

// ── Helpers ───────────────────────────────────────────────────────────────────

function esVB(actividad: string): boolean {
  return actividad.toUpperCase().includes("VB")
}

function nombreCarpetaHoy(): string {
  const hoy = new Date()
  const dd  = String(hoy.getDate()).padStart(2, "0")
  const mm  = String(hoy.getMonth() + 1).padStart(2, "0")
  return `VB ${dd}-${mm}-${hoy.getFullYear()}`
}

// ── Sección carpeta de descargas ──────────────────────────────────────────────

interface PropsCarpeta {
  estado: EstadoCarpeta | null
  cargando: boolean
  error: string | null
  inicializar: () => Promise<void>
  activar: (nombre?: string) => Promise<void>
  desactivar: () => Promise<void>
}

function SeccionCarpeta({ estado, cargando, error, inicializar, activar, desactivar }: PropsCarpeta) {
  const [carpetaDestino, setCarpetaDestino] = useState<string>(nombreCarpetaHoy())
  const [carpetasDisponibles, setCarpetasDisponibles] = useState<string[]>([])

  useEffect(() => {
    fetch("http://localhost:8000/vb/words/carpetas")
      .then((r) => r.json())
      .then((d) => setCarpetasDisponibles(d.carpetas as string[]))
      .catch(() => {})
  }, [])

  async function manejarActivar() {
    await activar(carpetaDestino)
    fetch("http://localhost:8000/vb/words/carpetas")
      .then((r) => r.json())
      .then((d) => setCarpetasDisponibles(d.carpetas as string[]))
      .catch(() => {})
  }

  if (!estado) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase mb-3">
        Carpeta de Descargas de Vistos Buenos
      </p>
      {!estado.configurada ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#6B7280]">
            Selecciona dónde crear la carpeta{" "}
            <strong className="text-[#111827]">Vistos Buenos de Abogados</strong>.
          </p>
          <button
            onClick={inicializar} disabled={cargando}
            className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-5 h-10 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 w-fit"
          >
            <FolderPlus size={15} />
            {cargando ? "Abriendo diálogo..." : "Seleccionar carpeta"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-xs text-[#9CA3AF] mb-1.5">Carpeta matriz</p>
            <span className="text-xs text-[#9CA3AF] bg-[#F4F6F8] rounded-lg px-3 py-2 inline-block border border-gray-100">
              {estado.rutaBase}\Vistos Buenos de Abogados
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {estado.activa ? (
              <>
                <span className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm tabular-nums border bg-[#22c55e]/10 border-[#22c55e]/20 text-[#16a34a]">
                  <span className="w-2 h-2 rounded-full inline-block bg-[#22c55e] animate-pulse" />
                  {estado.carpetaHoy}
                </span>
                <button
                  onClick={desactivar} disabled={cargando}
                  className="flex items-center gap-2 border-2 border-red-200 hover:border-red-400 hover:bg-red-50 text-red-500 rounded-xl px-4 h-9 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <XCircle size={14} />
                  {cargando ? "Desactivando..." : "Desactivar"}
                </button>
              </>
            ) : (
              <>
                <select
                  value={carpetaDestino}
                  onChange={(e) => setCarpetaDestino(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm tabular-nums border bg-[#F4F6F8] border-gray-200 text-[#9CA3AF] focus:outline-none focus:border-[var(--accent)] focus:text-[#374151]"
                >
                  <option value={nombreCarpetaHoy()}>Hoy — {nombreCarpetaHoy()}</option>
                  {carpetasDisponibles
                    .filter((c) => c !== nombreCarpetaHoy())
                    .map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button
                  onClick={manejarActivar} disabled={cargando}
                  className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-4 h-9 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  <FolderOpen size={14} />
                  {cargando ? "Activando..." : "Activar"}
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF]">
            {estado.activa
              ? "Vigilando Descargas — los .docx nuevos se mueven automáticamente"
              : "Inactivo — las descargas van a la carpeta predeterminada del navegador"}
          </p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  estadoCarpeta: EstadoCarpeta | null
  cargandoCarpeta: boolean
  errorCarpeta: string | null
  inicializar: () => Promise<void>
  activar: (nombre?: string) => Promise<void>
  desactivar: () => Promise<void>
}

export function ListaVBTab({
  estadoCarpeta, cargandoCarpeta, errorCarpeta,
  inicializar, activar, desactivar,
}: Props) {
  const { filas, cargando, error, resultado, subirExcel, limpiar, copiarWF } = useVB()

  // Actividades marcadas — se recalcula cuando cambia la lista de filas
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (filas.length === 0) { setMarcadas(new Set()); return }
    const vb = new Set(filas.map((f) => f.actividad).filter(esVB))
    setMarcadas(vb.size > 0 ? vb : new Set(filas.map((f) => f.actividad)))
  }, [filas])

  const [copiados, setCopiados] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    await subirExcel(archivo)
    e.target.value = ""
  }

  async function manejarCopiar(numero: string) {
    const ok = await copiarWF(numero)
    if (ok) setCopiados((prev) => ({ ...prev, [numero]: true }))
  }

  // Actividades únicas con conteo de cuántas filas tienen esa actividad
  const actividadesUnicas: Array<{ nombre: string; total: number }> = (() => {
    const mapa = new Map<string, number>()
    for (const f of filas) mapa.set(f.actividad, (mapa.get(f.actividad) ?? 0) + 1)
    return [...mapa.entries()]
      .map(([nombre, total]) => ({ nombre, total }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  })()

  // Filas visibles: actividad marcada + sin repetir N° Carpeta
  // Si la misma carpeta aparece con VB y con CIERRE COPIAS, se muestra una sola vez
  const filasVisibles: FilaVB[] = (() => {
    const carpetasYaMostradas = new Set<string>()
    const resultado: FilaVB[] = []
    for (const fila of filas) {
      if (!marcadas.has(fila.actividad)) continue
      if (carpetasYaMostradas.has(fila.numeroCarpeta)) continue
      carpetasYaMostradas.add(fila.numeroCarpeta)
      resultado.push(fila)
    }
    return resultado
  })()

  function alternar(actividad: string) {
    setMarcadas((prev) => {
      const s = new Set(prev)
      s.has(actividad) ? s.delete(actividad) : s.add(actividad)
      return s
    })
  }

  return (
    <div className="flex flex-col gap-5">

      <input ref={inputRef} type="file" accept=".xls" className="hidden" onChange={manejarArchivo} />

      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={cargando}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-5 h-10 text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={15} />
          {cargando ? "Cargando..." : "Cargar Excel"}
        </button>

        {resultado && (
          <span className="flex items-center gap-2 text-xs text-[#6B7280]">
            <CheckCircle2 size={14} className="text-[#22c55e]" />
            <strong>{resultado.totalEnExcel}</strong> filas en el Excel —{" "}
            <strong>{resultado.insertados}</strong> nuevas en BD
          </span>
        )}

        {filas.length > 0 && (
          <button
            onClick={limpiar}
            className="flex items-center gap-1.5 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-[#9CA3AF] rounded-xl h-10 px-3 text-sm font-semibold transition-all"
          >
            <Trash2 size={14} />
            Borrar lista
          </button>
        )}

        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      </div>

      {/* Cuerpo: panel actividades + tabla */}
      {filas.length > 0 ? (
        <div className="flex gap-4 items-start">

          {/* Panel de actividades */}
          <div className="w-72 shrink-0 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[var(--accent)] px-4 py-3">
              <p className="text-white font-bold text-sm">Actividades</p>
              <p className="text-white/70 text-xs mt-0.5">
                Marca las que quieres ver
              </p>
            </div>
            <div className="flex gap-3 px-4 py-2 border-b border-gray-100">
              <button
                onClick={() => setMarcadas(new Set(actividadesUnicas.map((a) => a.nombre)))}
                className="text-xs text-[var(--accent)] font-semibold hover:underline"
              >
                Todas
              </button>
              <span className="text-gray-200">|</span>
              <button
                onClick={() => setMarcadas(new Set())}
                className="text-xs text-[#6B7280] font-semibold hover:underline"
              >
                Ninguna
              </button>
            </div>
            <div className="flex flex-col divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {actividadesUnicas.map(({ nombre, total }) => (
                <label
                  key={nombre}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                    marcadas.has(nombre) ? "bg-[var(--accent)]/5" : "hover:bg-gray-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcadas.has(nombre)}
                    onChange={() => alternar(nombre)}
                    className="w-4 h-4 accent-[#1565c0] shrink-0"
                  />
                  <span className={cn(
                    "flex-1 text-xs leading-tight",
                    marcadas.has(nombre) ? "text-[#111827] font-semibold" : "text-[#9CA3AF]"
                  )}>
                    {nombre}
                  </span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums shrink-0 rounded-full px-2 py-0.5",
                    marcadas.has(nombre) ? "bg-[var(--accent)] text-white" : "bg-gray-100 text-[#9CA3AF]"
                  )}>
                    {total}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tabla */}
          <div className="flex-1 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
                Expedientes
                <span className="ml-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-2 py-0.5 text-xs font-bold">
                  {filasVisibles.length}
                </span>
                <span className="ml-2 text-[#9CA3AF] font-normal normal-case">
                  de {filas.length} en el Excel
                </span>
              </p>
              <p className="text-xs text-[#9CA3AF]">Copia el WF para buscarlo en el banco</p>
            </div>

            {filasVisibles.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-[#9CA3AF]">
                <FileText size={28} className="text-gray-200" />
                <p className="text-sm">Marca actividades en el panel para ver expedientes</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--accent)]">
                    {["N°", "WF", "Nombre Cliente", "Actividad", "Copiar"].map((col) => (
                      <th key={col} className="text-left text-white font-semibold text-xs tracking-wide px-5 py-3">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasVisibles.map((fila, idx) => (
                    <tr
                      key={`${fila.numeroCarpeta}-${idx}`}
                      className={cn(
                        "border-b border-gray-50 transition-colors hover:bg-[#F4F6F8]/60",
                        idx % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30"
                      )}
                    >
                      <td className="px-5 py-3 text-[#9CA3AF] tabular-nums text-xs">{idx + 1}</td>
                      <td className="px-5 py-3 font-semibold text-[#111827] tabular-nums">{fila.numeroCarpeta}</td>
                      <td className="px-5 py-3 text-[#374151]">{fila.nombreCliente}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          "text-xs font-medium rounded-full px-2.5 py-1",
                          esVB(fila.actividad) ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "bg-gray-100 text-[#6B7280]"
                        )}>
                          {fila.actividad}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => manejarCopiar(fila.numeroCarpeta)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                            copiados[fila.numeroCarpeta]
                              ? "bg-[#22c55e]/10 text-[#22c55e]"
                              : "bg-[#F4F6F8] text-[#6B7280] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                          )}
                        >
                          {copiados[fila.numeroCarpeta]
                            ? <><CheckCircle2 size={13} /> Copiado</>
                            : <><Copy size={13} /> Copiar</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl py-24 flex flex-col items-center gap-4 text-[#9CA3AF] shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#F4F6F8] border border-gray-100 flex items-center justify-center">
            <FileText size={26} className="text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-[#6B7280]">Sin expedientes cargados</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Carga el Excel del banco para ver los expedientes</p>
          </div>
        </div>
      )}

      <SeccionCarpeta
        estado={estadoCarpeta}
        cargando={cargandoCarpeta}
        error={errorCarpeta}
        inicializar={inicializar}
        activar={activar}
        desactivar={desactivar}
      />
    </div>
  )
}
