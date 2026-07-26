"use client"

/*
  Página: Postfirma
  Módulo 04 — Renombrado de escrituras firmadas electrónicamente y generación de JSON para el CBR de Santiago.

  Flujo:
    1. Seleccionar carpeta origen (PDFs firmados electrónicamente)
    2. Seleccionar carpeta destino (base donde se crea subcarpeta DD-MM-YYYY)
    3. Clic en "Procesar" → renombra, mueve y genera JSON para Santiago
    4. (Alternativo) Ingreso Manual → ingresa N° Certificado + WF a mano y descarga JSON
*/

import { useState, useCallback } from "react"
import { Stamp, FolderInput, FolderOutput, Play, FilePlus2, X, Trash2 } from "lucide-react"
import { AppShell }         from "@/components/dashboard/app-shell"
import { ResultadosTabla }  from "@/components/postfirma/ResultadosTabla"
import { usePostfirma }     from "@/hooks/usePostfirma"

// Lista fija de notificaciones — igual que en el backend (controller.py)
const NOTIFICACIONES = [
  "gestoriabca@romeroyasociados.cl",
  "alzamientos_bch@notariatorrealba.cl",
  "cfaundezr@bancochile.cl",
  "gvpintob@bancochile.cl",
  "sinostro@bancochile.cl",
  "ylagos@bancochile.cl",
]

interface EntradaManual {
  certificado: string
  wf:          string
}

export default function PostfirmaPage() {
  const {
    rutaOrigen,  seleccionarCarpetaOrigen,
    rutaDestino, seleccionarCarpetaDestino,
    procesando,  procesar, puedeProcesar,
    resultado,   error,
  } = usePostfirma()

  // ── Estado modal ingreso manual ───────────────────────────────────────────
  const [modalAbierto,     setModalAbierto]     = useState(false)
  const [entradasManuales, setEntradasManuales] = useState<EntradaManual[]>([
    { certificado: "", wf: "" },
  ])

  const agregarFila = useCallback(() => {
    setEntradasManuales(prev => [...prev, { certificado: "", wf: "" }])
  }, [])

  const quitarFila = useCallback((i: number) => {
    setEntradasManuales(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }, [])

  const actualizarFila = useCallback((i: number, campo: keyof EntradaManual, valor: string) => {
    setEntradasManuales(prev => prev.map((e, idx) => idx === i ? { ...e, [campo]: valor } : e))
  }, [])

  const abrirModal = useCallback(() => {
    setEntradasManuales([{ certificado: "", wf: "" }])
    setModalAbierto(true)
  }, [])

  const cerrarModal = useCallback(() => setModalAbierto(false), [])

  const generarJsonManual = useCallback(() => {
    const validas = entradasManuales.filter(e => e.certificado.trim() && e.wf.trim())
    if (!validas.length) return

    const payload = validas.map(e => ({
      tipo:              7,
      codDocElectronico: e.certificado.trim(),
      observacion:       e.wf.trim(),
      notificaciones:    NOTIFICACIONES,
    }))

    const ahora  = new Date()
    const pad    = (n: number) => String(n).padStart(2, "0")
    const nombre = `ALZAMIENTOS-Banco_de_Chile-${pad(ahora.getDate())}-${pad(ahora.getMonth() + 1)}-${String(ahora.getFullYear()).slice(2)}-${pad(ahora.getHours())}-${pad(ahora.getMinutes())}.json`

    const blob   = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url    = URL.createObjectURL(blob)
    const enlace = document.createElement("a")
    enlace.href     = url
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(url)
    cerrarModal()
  }, [entradasManuales, cerrarModal])

  const puedeGenerar = entradasManuales.some(e => e.certificado.trim() && e.wf.trim())

  return (
    <AppShell activeItem="Postfirma">
      <div className="p-6">

          {/* Título */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
              <Stamp size={20} className="text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#111827]">Postfirma</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                Renombrado de escrituras firmadas y JSON para el CBR de Santiago
              </p>
            </div>
          </div>

          {/* Configuración de carpetas */}
          <div className="grid grid-cols-2 gap-4 mb-4">

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FolderInput size={18} className="text-[var(--accent)]" />
                <span className="font-semibold text-[#111827] text-sm">Carpeta origen</span>
              </div>
              {rutaOrigen
                ? <p className="tabular-nums text-xs text-[#6B7280] mb-3 truncate" title={rutaOrigen}>{rutaOrigen}</p>
                : <p className="text-xs text-[#9CA3AF] mb-3 italic">Sin carpeta seleccionada</p>
              }
              <button
                onClick={seleccionarCarpetaOrigen}
                className="flex items-center gap-1.5 border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--accent)] rounded-xl h-8 px-3 text-xs font-semibold transition-all"
              >
                {rutaOrigen ? "Cambiar carpeta" : "Seleccionar carpeta"}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FolderOutput size={18} className="text-[var(--accent)]" />
                <span className="font-semibold text-[#111827] text-sm">Carpeta destino</span>
              </div>
              {rutaDestino
                ? <p className="tabular-nums text-xs text-[#6B7280] mb-3 truncate" title={rutaDestino}>{rutaDestino}</p>
                : <p className="text-xs text-[#9CA3AF] mb-3 italic">Sin carpeta seleccionada</p>
              }
              <button
                onClick={seleccionarCarpetaDestino}
                className="flex items-center gap-1.5 border-2 border-[var(--accent)]/20 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/5 text-[var(--accent)] rounded-xl h-8 px-3 text-xs font-semibold transition-all"
              >
                {rutaDestino ? "Cambiar carpeta" : "Seleccionar carpeta"}
              </button>
            </div>

          </div>

          {/* Botones de acción */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              onClick={procesar}
              disabled={!puedeProcesar || procesando}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold text-sm
                         hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              {procesando ? "Procesando..." : "Procesar PDFs"}
            </button>

            <button
              onClick={abrirModal}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-[var(--accent)]/30
                         hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/5 text-[var(--accent)]
                         font-semibold text-sm transition-all"
            >
              <FilePlus2 size={16} />
              Ingreso Manual
            </button>

            {!puedeProcesar && !procesando && (
              <p className="text-xs text-[#9CA3AF]">
                Selecciona ambas carpetas para procesar PDFs
              </p>
            )}
          </div>

          {/* Spinner de carga mientras procesa */}
          {procesando && (
            <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin shrink-0" />
              <span className="text-sm text-[#6B7280]">Procesando PDFs firmados...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Tabla de resultados */}
          {resultado && <ResultadosTabla resultado={resultado} />}

      </div>

      {/* ── Modal: Ingreso Manual ──────────────────────────────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6">

            {/* Encabezado */}
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-[#111827]">Ingreso Manual — JSON Santiago</h2>
              <button onClick={cerrarModal} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[#6B7280] mb-5">
              Escrituras que no pasaron por el procesamiento automático. Se descargará un JSON listo para el CBR.
            </p>

            {/* Cabecera de la tabla */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 px-1">
              <span className="text-xs font-semibold text-[#374151]">N° Certificado</span>
              <span className="text-xs font-semibold text-[#374151]">N° Carpeta (WF)</span>
              <span className="w-7" />
            </div>

            {/* Filas de entrada */}
            <div className="flex flex-col gap-2 mb-4">
              {entradasManuales.map((entrada, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={entrada.certificado}
                    onChange={e => actualizarFila(i, "certificado", e.target.value)}
                    placeholder="Ej: 1234567"
                    className="px-3 h-9 border border-gray-200 rounded-xl text-sm tabular-nums
                               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                  <input
                    type="text"
                    value={entrada.wf}
                    onChange={e => actualizarFila(i, "wf", e.target.value)}
                    placeholder="Ej: 2025-12345"
                    className="px-3 h-9 border border-gray-200 rounded-xl text-sm tabular-nums
                               focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  />
                  <button
                    onClick={() => quitarFila(i)}
                    disabled={entradasManuales.length === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF]
                               hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Agregar fila */}
            <button
              onClick={agregarFila}
              className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:text-[var(--accent-hover)]
                         font-semibold mb-6 transition-colors"
            >
              <FilePlus2 size={14} />
              Agregar otra escritura
            </button>

            {/* Acciones */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={cerrarModal}
                className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generarJsonManual}
                disabled={!puedeGenerar}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--accent)] text-white text-sm font-semibold
                           rounded-xl hover:bg-[var(--accent-hover)] transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generar JSON
              </button>
            </div>

          </div>
        </div>
      )}

    </AppShell>
  )
}
