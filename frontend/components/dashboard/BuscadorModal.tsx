"use client"

import { useEffect } from "react"
import { X, CheckCircle2, Archive, MapPin, FileText, Hash, User, Fingerprint, BookOpen } from "lucide-react"
import type { ResultadoBusqueda } from "@/hooks/useBuscador"

interface Props {
  resultado:  ResultadoBusqueda | null
  buscando:   boolean
  repertorio: string
  onCerrar:   () => void
}

export function BuscadorModal({ resultado, buscando, repertorio, onCerrar }: Props) {
  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCerrar])

  // Bloquear scroll del fondo
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--accent)] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-base">Repertorio {repertorio}</h2>
            <p className="text-white/60 text-xs mt-0.5">Información completa de la escritura</p>
          </div>
          <button onClick={onCerrar} className="text-white/60 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div className="px-6 py-5">
          {buscando && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[var(--accent)]/20 border-t-[#1565c0] rounded-full animate-spin" />
            </div>
          )}

          {!buscando && resultado && !resultado.encontrado && (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <FileText size={22} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Sin resultados</p>
              <p className="text-xs text-gray-400 mt-1">
                No se encontró el repertorio {repertorio} en el sistema
              </p>
            </div>
          )}

          {!buscando && resultado?.encontrado && (
            <div className="space-y-4">

              {/* Nombre + RUT */}
              <div className="flex items-start gap-3">
                <User size={15} className="text-[var(--accent)] mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">{resultado.nombre_cliente}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{resultado.rut ?? "Sin RUT"}</p>
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Grid de datos */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Dato icono={<Hash size={13} />} label="WF" valor={resultado.wf} />
                <Dato icono={<MapPin size={13} />} label="Comuna"
                  valor={resultado.comuna}
                  colorValor={resultado.es_santiago ? "text-[var(--accent)] font-semibold" : "text-purple-600 font-semibold"}
                />
                <Dato icono={<FileText size={13} />} label="Materia" valor={resultado.materia} cols={2} />
                <Dato icono={<BookOpen size={13} />} label="Fecha escritura" valor={resultado.fecha_escritura ?? "—"} />
                <Dato icono={<Hash size={13} />} label="Año" valor={resultado.anio ? String(resultado.anio) : "—"} />
              </div>

              <div className="border-t border-gray-100" />

              {/* Estados: Bóveda + Carátula */}
              <div className="space-y-2">
                <EstadoBoveda resultado={resultado} />
                {resultado.es_santiago && <EstadoCaratula resultado={resultado} />}
                {resultado.firma_electronica && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    <Fingerprint size={13} className="text-teal-500 shrink-0" />
                    <span className="font-medium text-teal-700">Firma electrónica:</span>
                    <span className="tabular-nums">{resultado.firma_electronica}</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function Dato({ icono, label, valor, cols = 1, colorValor = "text-gray-800" }: {
  icono: React.ReactNode; label: string; valor?: string | null; cols?: number; colorValor?: string
}) {
  return (
    <div className={cols === 2 ? "col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-gray-400 mb-0.5">
        {icono}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-sm ${colorValor}`}>{valor ?? "—"}</p>
    </div>
  )
}

function EstadoBoveda({ resultado }: { resultado: ResultadoBusqueda }) {
  if (resultado.en_boveda) {
    return (
      <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 text-sm">
        <Archive size={14} className="text-violet-500 shrink-0" />
        <span className="text-violet-700 font-medium">
          Entregado en custodia
          {resultado.boveda_entrega ? ` · Entrega N° ${resultado.boveda_entrega}` : ""}
          {resultado.boveda_fecha ? ` · ${resultado.boveda_fecha}` : ""}
        </span>
        {resultado.es_reingreso && (
          <span className="ml-auto text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">
            Reingreso
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-400">
      <Archive size={14} className="shrink-0" />
      <span>Aún no entregado en custodia</span>
    </div>
  )
}

function EstadoCaratula({ resultado }: { resultado: ResultadoBusqueda }) {
  if (resultado.numero_caratula) {
    return (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
        <span className="text-green-700 font-medium">
          Carátula {resultado.numero_caratula} · CBR Santiago
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-600">
      <CheckCircle2 size={14} className="shrink-0" />
      <span>Sin carátula — pendiente CBR Santiago</span>
    </div>
  )
}
