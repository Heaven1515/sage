"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AppShell } from "@/components/dashboard/app-shell"
import {
  FileEdit, Upload, Copy, Trash2,
  X, FileText, CheckCircle2, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useConfecciones } from "@/hooks/useConfecciones"
import { FormatearTab } from "@/components/confecciones/FormatearTab"

// ── Modal: Selector de Actividades ───────────────────────────────────────────
// Aparece tras cargar el Excel — permite elegir qué actividades mostrar

interface PropsSelectorActividades {
  actividades: string[]
  onConfirmar: (seleccionadas: string[]) => void
  onCancelar: () => void
}

function SelectorActividades({ actividades, onConfirmar, onCancelar }: PropsSelectorActividades) {
  // Todas marcadas por defecto — el usuario descarta las que no sirven
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(actividades))

  // Bloquea el scroll del fondo mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  function alternarActividad(actividad: string) {
    setMarcadas((prev) => {
      const siguiente = new Set(prev)
      siguiente.has(actividad) ? siguiente.delete(actividad) : siguiente.add(actividad)
      return siguiente
    })
  }

  function marcarTodas() {
    setMarcadas(new Set(actividades))
  }

  function desmarcarTodas() {
    setMarcadas(new Set())
  }

  return (
    // Fondo oscuro que cubre toda la pantalla — clic fuera cierra el modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancelar}
    >
      {/* Contenedor del modal — detiene el clic para que no cierre al hacer clic adentro */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Encabezado con cruz */}
        <div className="bg-[var(--accent)] px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-base">Seleccionar Actividades</h2>
            <p className="text-white/70 text-xs mt-0.5">
              Elige las actividades que quieres ver en la lista
            </p>
          </div>
          <button
            onClick={onCancelar}
            className="text-white/60 hover:text-white transition-colors mt-0.5 shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Acciones rápidas */}
        <div className="flex gap-3 px-6 pt-4">
          <button
            onClick={marcarTodas}
            className="text-xs text-[var(--accent)] font-semibold hover:underline"
          >
            Marcar todas
          </button>
          <span className="text-[#D1D5DB]">|</span>
          <button
            onClick={desmarcarTodas}
            className="text-xs text-[#6B7280] font-semibold hover:underline"
          >
            Desmarcar todas
          </button>
          <span className="ml-auto text-xs text-[#9CA3AF]">
            {marcadas.size} de {actividades.length}
          </span>
        </div>

        {/* Lista de actividades con checkboxes */}
        <div className="px-6 py-3 flex flex-col gap-2 max-h-72 overflow-y-auto">
          {actividades.map((actividad) => (
            <label
              key={actividad}
              className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-[#F4F6F8] transition-colors group"
            >
              <input
                type="checkbox"
                checked={marcadas.has(actividad)}
                onChange={() => alternarActividad(actividad)}
                className="w-4 h-4 accent-[#1565c0] shrink-0"
              />
              <span className={cn(
                "text-sm transition-colors",
                marcadas.has(actividad) ? "text-[#111827] font-medium" : "text-[#9CA3AF]"
              )}>
                {actividad}
              </span>
            </label>
          ))}
        </div>

        {/* Botón confirmar */}
        <div className="px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => onConfirmar([...marcadas])}
            disabled={marcadas.size === 0}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl h-11 font-bold text-sm transition-colors"
          >
            Ver {marcadas.size} actividad{marcadas.size !== 1 ? "es" : ""}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TAB 1: Lista de Trabajo ──────────────────────────────────────────────────

// Estado de copia por WF: verde = copiado una vez, amarillo = ya revisado/recordado
type EstadoCopia = "verde" | "amarillo"

const SS_COPIAS = "sage_confecciones_copias"

function ListaDeTrabajoTab() {
  const [estadosCopia, setEstadosCopia] = useState<Record<string, EstadoCopia>>(() => {
    try {
      const raw = sessionStorage.getItem(SS_COPIAS)
      return raw ? (JSON.parse(raw) as Record<string, EstadoCopia>) : {}
    } catch { return {} }
  })
  const inputArchivoRef = useRef<HTMLInputElement>(null)

  // Persistir estados de copia al cambiar
  useEffect(() => {
    try { sessionStorage.setItem(SS_COPIAS, JSON.stringify(estadosCopia)) } catch { /* */ }
  }, [estadosCopia])

  const {
    confecciones, cargando, error, resultadoCarga,
    actividadesDisponibles, mostrarSelectorActividades,
    subirExcel, confirmarActividades, cerrarSelector, limpiarLista, copiarWf,
  } = useConfecciones()

  async function manejarArchivoExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    await subirExcel(archivo)
    e.target.value = ""
  }

  async function manejarCopiarWf(numeroCarpeta: string) {
    const exito = await copiarWf(numeroCarpeta)
    if (exito) {
      // Verde → amarillo (ayuda memoria: ya fue copiado antes), nunca vuelve a gris
      setEstadosCopia((prev) => ({
        ...prev,
        [numeroCarpeta]: prev[numeroCarpeta] === "verde" ? "amarillo" : "verde",
      }))
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Modal selector de actividades — aparece tras cargar el Excel */}
      {mostrarSelectorActividades && (
        <SelectorActividades
          actividades={actividadesDisponibles}
          onConfirmar={confirmarActividades}
          onCancelar={cerrarSelector}
        />
      )}

      {/* Input oculto para seleccionar el archivo .xls */}
      <input
        ref={inputArchivoRef}
        type="file"
        accept=".xls"
        className="hidden"
        onChange={manejarArchivoExcel}
      />

      {/* Barra superior — botón Cargar Excel a la izquierda + feedback */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => inputArchivoRef.current?.click()}
          disabled={cargando}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl px-5 h-10 text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Upload size={15} />
          {cargando ? "Cargando..." : "Cargar Excel"}
        </button>

        <button
          onClick={limpiarLista}
          disabled={confecciones.length === 0 && !resultadoCarga}
          title="Borra la lista de pantalla. Los datos siguen guardados en la base de datos."
          className="flex items-center gap-1.5 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-[#9CA3AF] rounded-xl h-10 px-3 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Trash2 size={14} />
          Borrar lista
        </button>

        {/* Resumen de la última carga */}
        {resultadoCarga && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <CheckCircle2 size={14} className="text-[#22c55e] shrink-0" />
            <span>
              <strong>{resultadoCarga.insertados}</strong> nuevos —{" "}
              <strong>{resultadoCarga.duplicados}</strong> duplicados
            </span>
          </div>
        )}

        {/* Error si el backend falla */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-[#ef4444]">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Tabla WFs Filtrados */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#6B7280] tracking-wider uppercase">
            Expedientes Filtrados
            {confecciones.length > 0 && (
              <span className="ml-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-2 py-0.5 text-xs font-bold">
                {confecciones.length}
              </span>
            )}
          </p>
          <p className="text-xs text-[#9CA3AF]">
            Copia el WF, busca el archivo en el banco y descárgalo
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--accent)]">
              {["N°", "WF", "Nombre Cliente", "Etapa", "Fecha Esperada", "Copiar"].map((col) => (
                <th
                  key={col}
                  className="text-left text-white font-semibold text-xs tracking-wide px-5 py-3"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {confecciones.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-24 text-center">
                  <div className="flex flex-col items-center gap-4 text-[#9CA3AF]">
                    <div className="w-14 h-14 rounded-2xl bg-[#F4F6F8] border border-gray-100 flex items-center justify-center">
                      <FileText size={26} className="text-gray-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#6B7280]">Sin resultados</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">
                        Carga un Excel para ver los expedientes
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              confecciones.map((item, index) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-gray-50 transition-colors hover:bg-[#F4F6F8]/60",
                    index % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/30"
                  )}
                >
                  <td className="px-5 py-3 text-[#9CA3AF] tabular-nums text-xs">{index + 1}</td>
                  <td className="px-5 py-3 font-semibold text-[#111827] tabular-nums">{item.numeroCarpeta}</td>
                  <td className="px-5 py-3 text-[#374151]">{item.nombreCliente}</td>
                  <td className="px-5 py-3">
                    <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-medium rounded-full px-2.5 py-1">
                      {item.actividadActual}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs tabular-nums text-[#374151] whitespace-nowrap">
                    {item.fechaEsperada
                      ? new Date(item.fechaEsperada).toLocaleString("es-CL", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : <span className="text-[#9CA3AF]">—</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => manejarCopiarWf(item.numeroCarpeta)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                        estadosCopia[item.numeroCarpeta] === "verde"
                          ? "bg-[#22c55e]/10 text-[#22c55e]"
                          : estadosCopia[item.numeroCarpeta] === "amarillo"
                            ? "bg-yellow-100 text-yellow-600"
                            : "bg-[#F4F6F8] text-[#6B7280] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                      )}
                    >
                      {estadosCopia[item.numeroCarpeta] === "verde"  && <><CheckCircle2 size={13} /> Copiado</>}
                      {estadosCopia[item.numeroCarpeta] === "amarillo" && <><CheckCircle2 size={13} /> Revisado</>}
                      {!estadosCopia[item.numeroCarpeta]              && <><Copy size={13} /> Copiar</>}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ConfeccionesPage() {
  const [activeTab, setActiveTab] = useState<1 | 2>(1)

  return (
    <AppShell activeItem="Redacción de Escrituras">
      <div className="p-6">
          {/* Page title */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <FileEdit size={20} className="text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#111827]">Redacción de Escrituras</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">Alzamientos Banco de Chile</p>
              </div>
            </div>
          </div>

          {/* Pill Tabs */}
          <div className="flex gap-2 mb-6">
            {([
              { id: 1, label: "Lista de Trabajo" },
              { id: 2, label: "Formatear" },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all",
                  activeTab === id
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-white text-[#6B7280] border border-gray-200 hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
                )}
              >
                <span className={cn(
                  "w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center",
                  activeTab === id ? "bg-white/20 text-white" : "bg-gray-100 text-[#6B7280]"
                )}>
                  {id}
                </span>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content — se oculta con CSS para mantener el estado al cambiar de tab */}
          <div className={activeTab !== 1 ? "hidden" : ""}><ListaDeTrabajoTab /></div>
          <div className={activeTab !== 2 ? "hidden" : ""}><FormatearTab /></div>
        </div>
    </AppShell>
  )
}
