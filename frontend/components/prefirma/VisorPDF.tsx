"use client"

/*
  Componente: VisorPDF
  Layout: izquierda = páginas del PDF a ancho completo
          derecha   = formulario arriba + panel inferior (lista de archivos) abajo
*/

import { useRef, useEffect, useCallback } from "react"
import { Loader2, Search, Send, ClipboardEdit } from "lucide-react"
import type { DatosRepertorio } from "@/hooks/usePrefirma"
import { ModalRegistroManual } from "@/components/prefirma/ModalRegistroManual"
import type { DatosManual } from "@/components/prefirma/ModalRegistroManual"

interface FechaOtorgamiento {
  dia:  string
  mes:  string
  anio: string
}

interface Props {
  archivoActual:      string | null
  imagenes:           string[]
  cargandoPreview:    boolean
  fecha:              FechaOtorgamiento
  setFecha:           (f: FechaOtorgamiento) => void
  repertorio:         string
  setRepertorio:      (v: string) => void
  anho:               string
  setAnho:            (v: string) => void
  tipoContrato:       string
  setTipoContrato:    (v: string) => void
  datosRep:           DatosRepertorio | null
  buscandoRep:        boolean
  onBuscarRep:        () => void
  enviando:              boolean
  onEnviar:              () => void
  error:                 string | null
  mostrarModalManual:    boolean
  setMostrarModalManual: (v: boolean) => void
  onRegistrarManual:     (datos: DatosManual) => Promise<void>
  panelInferior?:        React.ReactNode
}

export function VisorPDF({
  archivoActual, imagenes, cargandoPreview,
  fecha, setFecha,
  repertorio, setRepertorio,
  anho, setAnho,
  tipoContrato, setTipoContrato,
  datosRep, buscandoRep, onBuscarRep,
  enviando, onEnviar, error,
  mostrarModalManual, setMostrarModalManual, onRegistrarManual,
  panelInferior,
}: Props) {

  const refRepertorio = useRef<HTMLInputElement>(null)

  const handleTipoContrato = useCallback((valor: string) => {
    setTipoContrato(valor.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  }, [setTipoContrato])

  // Foco automático en el input de repertorio cada vez que se selecciona un archivo
  useEffect(() => {
    if (archivoActual) refRepertorio.current?.focus()
  }, [archivoActual])

  const fechaDesdeDB  = !!(datosRep?.encontrado && datosRep.fecha_escritura)
  const fechaCompleta = fechaDesdeDB || (fecha.dia !== "" && fecha.mes !== "" && fecha.anio !== "")
  const puedeEnviar   = repertorio.trim() !== "" && anho.trim() !== "" && tipoContrato.trim() !== "" && fechaCompleta

  return (
    <>
    {mostrarModalManual && (
      <ModalRegistroManual
        repertorio = {repertorio}
        anio       = {anho}
        materia    = {tipoContrato}
        onGuardar  = {onRegistrarManual}
        onCerrar   = {() => setMostrarModalManual(false)}
      />
    )}
    <div className="flex gap-5 items-start">

      {/* ── IZQUIERDA: páginas del PDF — se expande libremente ─────────── */}
      <div className="flex-1 bg-[#F4F6F8] border border-gray-100 rounded-xl p-4 flex flex-col gap-4">
        {!archivoActual && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-[#9CA3AF]">Selecciona un PDF de la lista para ver las páginas</p>
          </div>
        )}
        {archivoActual && cargandoPreview && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="text-[var(--accent)] animate-spin" />
          </div>
        )}
        {archivoActual && !cargandoPreview && imagenes.length === 0 && (
          <p className="text-xs text-[#9CA3AF] text-center py-16">No se pudo generar la vista previa</p>
        )}
        {archivoActual && !cargandoPreview && imagenes.length > 0 && (
          <>
            <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              {archivoActual} — {imagenes.length} página{imagenes.length !== 1 ? "s" : ""}
            </p>
            {imagenes.map((b64, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <p className="text-[10px] font-semibold text-[#9CA3AF] px-3 py-1.5 border-b border-gray-100">
                  Página {i + 1} de {imagenes.length}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${b64}`}
                  alt={`Página ${i + 1}`}
                  className="w-full"
                />
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── DERECHA: sticky — se queda fija mientras scrolleas el PDF ──── */}
      <div className="w-80 shrink-0 flex flex-col gap-4 sticky top-6">

        {/* Formulario */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-4">

          {/* Repertorio + Año */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 block">
              Repertorio
            </label>
            <div className="flex gap-2">
              <input
                ref={refRepertorio}
                type="text"
                value={repertorio}
                onChange={e => setRepertorio(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") onBuscarRep() }}
                placeholder="N° repertorio"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] flex-1 min-w-0"
              />
              <input
                type="text"
                value={anho}
                onChange={e => setAnho(e.target.value)}
                placeholder="Año"
                maxLength={4}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] w-16 text-center"
              />
              <button
                onClick={onBuscarRep}
                disabled={buscandoRep}
                title="Buscar en base de datos"
                className="px-2.5 py-1.5 rounded-lg bg-[#F4F6F8] hover:bg-[#E5E7EB] text-[#374151] transition-colors shrink-0"
              >
                {buscandoRep
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Search size={14} />
                }
              </button>
            </div>

            {datosRep && datosRep.encontrado && (
              <div className="mt-1.5 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                <p className="text-[11px] text-green-700 font-semibold">{datosRep.nombre_cliente}</p>
                {datosRep.fecha_escritura && (
                  <p className="text-[10px] text-green-600 mt-0.5">Escritura: {datosRep.fecha_escritura}</p>
                )}
              </div>
            )}
            {datosRep?.advertencia && (
              <div className="mt-1.5 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-[11px] text-amber-700 font-semibold">{datosRep.advertencia}</p>
              </div>
            )}
            {datosRep && !datosRep.encontrado && (
              <div className="mt-1.5 flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[11px] text-amber-700">No encontrado en el sistema</p>
                <button
                  onClick={() => setMostrarModalManual(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline shrink-0"
                >
                  <ClipboardEdit size={12} />
                  Registrar
                </button>
              </div>
            )}
          </div>

          {/* Fecha de otorgamiento — solo cuando la BD no la tiene */}
          {datosRep && !fechaDesdeDB && (
            <div>
              <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 block">
                Fecha de otorgamiento
              </label>
              <div className="flex gap-2">
                {(["dia", "mes", "anio"] as const).map(campo => (
                  <input
                    key={campo}
                    type="text"
                    value={fecha[campo]}
                    onChange={e => setFecha({ ...fecha, [campo]: e.target.value })}
                    placeholder={campo === "anio" ? "AAAA" : campo === "mes" ? "MM" : "DD"}
                    maxLength={campo === "anio" ? 4 : 2}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center tabular-nums text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] w-full"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tipo de contrato */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 block">
              Tipo de contrato / Materia
            </label>
            <input
              type="text"
              value={tipoContrato}
              onChange={e => handleTipoContrato(e.target.value)}
              placeholder="Ej: ALZAMIENTO DE HIPOTECA"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* Botón enviar */}
          <button
            onClick={onEnviar}
            disabled={!puedeEnviar || enviando || !archivoActual}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
              bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando
              ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
              : <><Send size={15} /> Ingresar copia de escritura</>
            }
          </button>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              {error}
            </p>
          )}

        </div>

        {/* Panel inferior — lista de archivos */}
        {panelInferior}

      </div>
    </div>
    </>
  )
}
