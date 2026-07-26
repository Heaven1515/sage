"use client"

/*
  Página: Bóveda
  Módulo 05 — Registro de escrituras entregadas al archivo físico de la notaría.

  Flujo principal del día:
    1. Ingresar N° de repertorio → Enter
    2. Si ya existe ese año → popup obligatorio con motivo de reingreso
    3. Registro queda en la tabla agrupado por entrega
    4. Clic en fila → opciones editar / eliminar (con contraseña si es día anterior)
    5. "Nueva Entrega" → incrementa el contador para la próxima tanda
    6. "Generar Word" → descarga el Word de la entrega actual
*/

import { useState, useRef, useEffect, useCallback } from "react"
import { Archive, Search, FilePlus, FileDown, AlertTriangle, Trash2 } from "lucide-react"
import { AppShell }       from "@/components/dashboard/app-shell"
import { TablaRegistros } from "@/components/boveda/TablaRegistros"
import { useBoveda }      from "@/hooks/useBoveda"
import type { RegistroItem, VerificacionRepertorio } from "@/hooks/useBoveda"

// ── Tipos de modales ──────────────────────────────────────────────────────────

interface ModalReingreso {
  tipo:       "reingreso"
  repertorio: number
  previos:    RegistroItem[]
}

interface ModalEditar {
  tipo:       "editar"
  registro:   RegistroItem
}

interface ModalEliminar {
  tipo:       "eliminar"
  registro:   RegistroItem
}

type ModalActivo = ModalReingreso | ModalEditar | ModalEliminar | null

// ── Componente principal ──────────────────────────────────────────────────────

export default function BovedaPage() {
  const {
    registros, config, fechaSeleccionada, cargando, error,
    resultadosBusqueda, esHoy,
    verificarRepertorio, registrar, editarRegistro, eliminarRegistro,
    nuevaEntrega, buscarRepertorio, limpiarBusqueda, limpiarLista, generarWord, cambiarFecha,
  } = useBoveda()

  const [inputRepertorio, setInputRepertorio] = useState("")
  const [inputBusqueda,   setInputBusqueda]   = useState("")
  const [modal,           setModal]           = useState<ModalActivo>(null)
  const [errorModal,      setErrorModal]      = useState<string | null>(null)
  const [procesando,      setProcesando]      = useState(false)

  // Campos de los modales
  const [motivoReingreso, setMotivoReingreso] = useState("")
  const [nuevoRepertorio, setNuevoRepertorio] = useState("")
  const [contrasenaModal, setContrasenaModal] = useState("")

  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const cerrarModal = useCallback(() => {
    setModal(null)
    setErrorModal(null)
    setMotivoReingreso("")
    setNuevoRepertorio("")
    setContrasenaModal("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  // ── Ingreso de repertorio ─────────────────────────────────────────────────

  const manejarIngreso = useCallback(async () => {
    const valor = parseInt(inputRepertorio.trim(), 10)
    if (!valor || valor <= 0) return
    setProcesando(true)
    try {
      const verificacion: VerificacionRepertorio = await verificarRepertorio(valor)
      if (verificacion.es_reingreso) {
        setModal({ tipo: "reingreso", repertorio: valor, previos: verificacion.registros_previos })
      } else {
        await registrar(valor)
        setInputRepertorio("")
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    } catch {
      // El error queda en el estado global del hook
    } finally {
      setProcesando(false)
    }
  }, [inputRepertorio, verificarRepertorio, registrar])

  // ── Confirmar reingreso ───────────────────────────────────────────────────

  const confirmarReingreso = useCallback(async () => {
    if (!modal || modal.tipo !== "reingreso") return
    if (!motivoReingreso.trim()) {
      setErrorModal("El motivo es obligatorio para registrar un reingreso.")
      return
    }
    setProcesando(true)
    setErrorModal(null)
    try {
      await registrar(modal.repertorio, motivoReingreso.trim())
      setInputRepertorio("")
      cerrarModal()
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : "Error al registrar")
    } finally {
      setProcesando(false)
    }
  }, [modal, motivoReingreso, registrar, cerrarModal])

  // ── Confirmar edición ─────────────────────────────────────────────────────

  const confirmarEdicion = useCallback(async () => {
    if (!modal || modal.tipo !== "editar") return
    const valor = parseInt(nuevoRepertorio.trim(), 10)
    if (!valor || valor <= 0) { setErrorModal("Ingresa un número de repertorio válido."); return }
    setProcesando(true)
    setErrorModal(null)
    try {
      const esHoyReg = modal.registro.fecha === new Date().toISOString().split("T")[0]
      await editarRegistro(modal.registro.id, valor, esHoyReg ? undefined : contrasenaModal)
      cerrarModal()
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : "Error al editar")
    } finally {
      setProcesando(false)
    }
  }, [modal, nuevoRepertorio, contrasenaModal, editarRegistro, cerrarModal])

  // ── Confirmar eliminación ─────────────────────────────────────────────────

  const confirmarEliminacion = useCallback(async () => {
    if (!modal || modal.tipo !== "eliminar") return
    setProcesando(true)
    setErrorModal(null)
    try {
      const esHoyReg = modal.registro.fecha === new Date().toISOString().split("T")[0]
      await eliminarRegistro(modal.registro.id, esHoyReg ? undefined : contrasenaModal)
      cerrarModal()
    } catch (err) {
      setErrorModal(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setProcesando(false)
    }
  }, [modal, contrasenaModal, eliminarRegistro, cerrarModal])

  // ── Abrir modales desde la tabla ──────────────────────────────────────────

  const abrirEditar = useCallback((registro: RegistroItem) => {
    setNuevoRepertorio(String(registro.repertorio))
    setModal({ tipo: "editar", registro })
  }, [])

  const abrirEliminar = useCallback((registro: RegistroItem) => {
    setModal({ tipo: "eliminar", registro })
  }, [])

  // ── Búsqueda ──────────────────────────────────────────────────────────────

  const manejarBusqueda = useCallback(async () => {
    const valor = parseInt(inputBusqueda.trim(), 10)
    if (!valor || valor <= 0) return
    await buscarRepertorio(valor)
  }, [inputBusqueda, buscarRepertorio])

  const esHoyFecha = (fecha: string) => fecha === new Date().toISOString().split("T")[0]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell activeItem="Custodia de Documentos">
      <>
      <div className="p-6">

          {/* Título */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Archive size={20} className="text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#111827]">Custodia de Documentos</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                Registro de escrituras físicas entregadas al archivo de la notaría
              </p>
            </div>
          </div>

          {/* Panel de ingreso + controles */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex flex-wrap items-end gap-4">

              {/* Input repertorio */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#374151]">N° Repertorio</label>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="number"
                    min={1}
                    value={inputRepertorio}
                    onChange={e => setInputRepertorio(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !procesando && manejarIngreso()}
                    placeholder="Ej: 3113"
                    disabled={procesando || !esHoy}
                    className="w-36 px-3 h-9 border border-gray-200 rounded-xl text-sm tabular-nums
                               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30
                               disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={manejarIngreso}
                    disabled={procesando || !inputRepertorio || !esHoy}
                    className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl
                               hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {procesando ? "..." : "Ingresar"}
                  </button>
                </div>
                {!esHoy && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Modo historial — ingresa en la fecha de hoy
                  </p>
                )}
              </div>

              <div className="h-10 w-px bg-gray-100 self-center hidden sm:block" />

              {/* Selector de fecha */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#374151]">Ver registros del día</label>
                <input
                  type="date"
                  value={fechaSeleccionada}
                  onChange={e => cambiarFecha(e.target.value)}
                  className="px-3 h-9 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>

              {/* Entrega + botones (solo si se está viendo hoy) */}
              {esHoy && config && (
                <div className="flex items-end gap-3 ml-auto">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold text-[#6B7280] mb-1">Entrega actual</span>
                    <span className="text-2xl font-black text-[var(--accent)]">{config.entrega_actual}</span>
                  </div>
                  <button
                    onClick={nuevaEntrega}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 text-[var(--accent)]
                               text-sm font-semibold hover:bg-[var(--accent)]/5 transition-all"
                  >
                    <FilePlus size={16} />
                    Nueva entrega
                  </button>
                  <button
                    onClick={generarWord}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white
                               text-sm font-semibold hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    <FileDown size={16} />
                    Generar Word
                  </button>
                  {registros.length > 0 && (
                    <button
                      onClick={limpiarLista}
                      title="Borra la lista de pantalla"
                      className="flex items-center gap-1.5 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-500 text-[#9CA3AF] rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                    >
                      <Trash2 size={14} />
                      Borrar lista
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Error global */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Tabla principal */}
          {cargando
            ? <div className="text-sm text-[#9CA3AF] py-8 text-center">Cargando...</div>
            : (
              <TablaRegistros
                registros={registros}
                esHoy={esHoy}
                onEditar={abrirEditar}
                onEliminar={abrirEliminar}
              />
            )
          }

          {/* Buscador de historial */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <Search size={16} className="text-[var(--accent)]" />
              <span className="font-semibold text-[#111827] text-sm">Consultar repertorio en historial</span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={inputBusqueda}
                onChange={e => setInputBusqueda(e.target.value)}
                onKeyDown={e => e.key === "Enter" && manejarBusqueda()}
                placeholder="Ej: 3113"
                className="w-36 px-3 h-9 border border-gray-200 rounded-xl text-sm tabular-nums
                           focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
              <button
                onClick={manejarBusqueda}
                disabled={!inputBusqueda}
                suppressHydrationWarning
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl
                           hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buscar
              </button>
            </div>

            {resultadosBusqueda && (
              <div className="mt-4">
                {resultadosBusqueda.total === 0
                  ? (
                    <p className="text-sm text-[#9CA3AF]">
                      El repertorio {resultadosBusqueda.repertorio} no tiene registros en bóveda.
                    </p>
                  )
                  : (
                    <>
                      <p className="text-sm font-semibold text-[#374151] mb-2">
                        Repertorio {resultadosBusqueda.repertorio} —{" "}
                        {resultadosBusqueda.total} registro{resultadosBusqueda.total !== 1 ? "s" : ""}
                      </p>
                      <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                        <thead>
                          <tr className="bg-[#F4F6F8] text-[#6B7280] text-xs">
                            <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                            <th className="px-3 py-2 text-center font-semibold">Hora</th>
                            <th className="px-3 py-2 text-left font-semibold">Comentario</th>
                            <th className="px-3 py-2 text-center font-semibold">Entrega</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadosBusqueda.registros.map((r, i) => (
                            <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                              <td className="px-3 py-2 tabular-nums text-xs text-[#374151]">{r.fecha}</td>
                              <td className="px-3 py-2 text-center text-xs tabular-nums text-[#6B7280]">
                                {r.hora_ingreso}
                              </td>
                              <td className="px-3 py-2 text-xs text-[#374151]">
                                {r.es_reingreso && (
                                  <span className="inline-flex items-center gap-1 mr-2 text-amber-600 font-semibold text-xs">
                                    <AlertTriangle size={11} />
                                    REINGRESO
                                  </span>
                                )}
                                {r.motivo}
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-[#6B7280]">
                                {r.numero_entrega}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )
                }
              </div>
            )}
          </div>

      </div>

      {/* ── Modal reingreso ───────────────────────────────────────────────────── */}
      {modal?.tipo === "reingreso" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-amber-500" />
              <h2 className="text-base font-bold text-[#111827]">
                Reingreso — Repertorio {modal.repertorio}
              </h2>
            </div>
            <p className="text-sm text-[#6B7280] mb-3">
              Este repertorio ya fue ingresado a bóveda:
            </p>
            <ul className="text-xs text-[#374151] mb-4 space-y-1 bg-[#F4F6F8] rounded-xl p-3">
              {modal.previos.map(r => (
                <li key={r.id}>
                  {r.fecha} {r.hora_ingreso} — {r.motivo}
                </li>
              ))}
            </ul>
            <label className="text-xs font-semibold text-[#374151] block mb-1">
              Motivo del reingreso <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={motivoReingreso}
              onChange={e => setMotivoReingreso(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmarReingreso()}
              placeholder="Ej: Corrección de firma"
              className="w-full px-3 h-9 border border-gray-200 rounded-xl text-sm mb-3
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            {errorModal && <p className="text-xs text-red-500 mb-3">{errorModal}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-[#6B7280]">
                Cancelar
              </button>
              <button
                onClick={confirmarReingreso}
                disabled={procesando || !motivoReingreso.trim()}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl
                           hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {procesando ? "Registrando..." : "Registrar reingreso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar ──────────────────────────────────────────────────────── */}
      {modal?.tipo === "editar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-[#111827] mb-4">Editar registro</h2>
            <label className="text-xs font-semibold text-[#374151] block mb-1">N° Repertorio</label>
            <input
              autoFocus
              type="number"
              min={1}
              value={nuevoRepertorio}
              onChange={e => setNuevoRepertorio(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmarEdicion()}
              className="w-full px-3 h-9 border border-gray-200 rounded-xl text-sm tabular-nums mb-3
                         focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            />
            {!esHoyFecha(modal.registro.fecha) && (
              <>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Contraseña de administrador
                </label>
                <input
                  type="password"
                  value={contrasenaModal}
                  onChange={e => setContrasenaModal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmarEdicion()}
                  placeholder="••••••••"
                  className="w-full px-3 h-9 border border-gray-200 rounded-xl text-sm mb-3
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </>
            )}
            {errorModal && <p className="text-xs text-red-500 mb-3">{errorModal}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-[#6B7280]">Cancelar</button>
              <button
                onClick={confirmarEdicion}
                disabled={procesando || !nuevoRepertorio}
                className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-xl
                           hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {procesando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal eliminar ────────────────────────────────────────────────────── */}
      {modal?.tipo === "eliminar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-[#111827] mb-2">¿Eliminar registro?</h2>
            <p className="text-sm text-[#6B7280] mb-4">
              Se eliminará el registro del repertorio{" "}
              <span className="tabular-nums font-semibold text-[#111827]">{modal.registro.repertorio}</span>
              {" "}({modal.registro.fecha} {modal.registro.hora_ingreso}).
            </p>
            {!esHoyFecha(modal.registro.fecha) && (
              <>
                <label className="text-xs font-semibold text-[#374151] block mb-1">
                  Contraseña de administrador
                </label>
                <input
                  autoFocus
                  type="password"
                  value={contrasenaModal}
                  onChange={e => setContrasenaModal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && confirmarEliminacion()}
                  placeholder="••••••••"
                  className="w-full px-3 h-9 border border-gray-200 rounded-xl text-sm mb-3
                             focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </>
            )}
            {errorModal && <p className="text-xs text-red-500 mb-3">{errorModal}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={cerrarModal} className="px-4 py-2 text-sm text-[#6B7280]">Cancelar</button>
              <button
                onClick={confirmarEliminacion}
                disabled={procesando}
                className="px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-xl
                           hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {procesando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      </>
    </AppShell>
  )
}
