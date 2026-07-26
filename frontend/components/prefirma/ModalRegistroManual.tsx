"use client"

/*
  Componente: ModalRegistroManual
  Permite ingresar manualmente los datos de una escritura que no pasó por VB,
  para registrarla en vb_registro y que aparezca en el informe diario.
*/

import { useState } from "react"
import { Loader2, X } from "lucide-react"

export interface DatosManual {
  wf:              string
  nombre_cliente:  string
  rut:             string
  comuna:          string
  materia:         string
  repertorio:      string
  anio:            string
  fecha_escritura: string   // "DD-MM-YYYY"
  cliente_notaria: string
  es_banlegal:     boolean
}

interface Props {
  repertorio:  string
  anio:        string
  materia:     string       // pre-rellena desde el campo tipoContrato si ya fue ingresado
  onGuardar:   (datos: DatosManual) => Promise<void>
  onCerrar:    () => void
}

const COMUNAS_FRECUENTES = [
  "SANTIAGO", "PROVIDENCIA", "LAS CONDES", "MAIPÚ", "LA FLORIDA",
  "PUDAHUEL", "QUILICURA", "PEÑALOLÉN", "SAN BERNARDO", "PUENTE ALTO",
  "RANCAGUA", "VALPARAÍSO", "VIÑA DEL MAR", "CONCEPCIÓN", "TEMUCO",
]

export function ModalRegistroManual({ repertorio, anio, materia, onGuardar, onCerrar }: Props) {
  const [form, setForm] = useState<DatosManual>({
    wf:              "",
    nombre_cliente:  "",
    rut:             "",
    comuna:          "SANTIAGO",
    materia:         materia || "",
    repertorio,
    anio,
    fecha_escritura: "",
    cliente_notaria: "BDC",
    es_banlegal:     false,
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const set = (campo: keyof DatosManual, valor: string) =>
    setForm(prev => ({ ...prev, [campo]: valor }))

  const puedeGuardar =
    form.wf.trim() !== "" &&
    form.nombre_cliente.trim() !== "" &&
    form.comuna.trim() !== "" &&
    form.materia.trim() !== "" &&
    form.fecha_escritura.trim() !== ""

  const handleGuardar = async () => {
    setError(null)
    setGuardando(true)
    try {
      await onGuardar(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Fondo semitransparente solo en la mitad izquierda — el PDF sigue visible */}
      <div className="flex-1 bg-black/20" onClick={onCerrar} />
      {/* Panel lateral derecho */}
      <div className="w-[400px] bg-white shadow-2xl overflow-y-auto flex flex-col gap-4 p-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-[#111827]">Registrar escritura manualmente</h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Repertorio {repertorio}/{anio} · no encontrado en la base de datos
            </p>
          </div>
          <button onClick={onCerrar} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-3">

          {/* WF */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
              WF <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={form.wf}
              onChange={e => set("wf", e.target.value)}
              placeholder="Ej: 123456"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* Nombre */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
              Nombre cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre_cliente}
              onChange={e => set("nombre_cliente", e.target.value.toUpperCase())}
              placeholder="Ej: PÉREZ MUÑOZ JUAN"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* RUT */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
              RUT <span className="text-[#9CA3AF] font-normal normal-case">(opcional)</span>
            </label>
            <input
              type="text"
              value={form.rut}
              onChange={e => set("rut", e.target.value)}
              placeholder="Ej: 12.345.678-9"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* Comuna + Cliente en fila */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
                Comuna CBR <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                list="comunas-list"
                value={form.comuna}
                onChange={e => set("comuna", e.target.value.toUpperCase())}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
              />
              <datalist id="comunas-list">
                {COMUNAS_FRECUENTES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="w-32">
              <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
                Cliente
              </label>
              <select
                value={form.cliente_notaria}
                onChange={e => set("cliente_notaria", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] bg-white"
              >
                <option value="BDC">BDC</option>
                <option value="Romero">Romero</option>
              </select>
            </div>
          </div>

          {/* Materia */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
              Materia <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.materia}
              onChange={e => set("materia", e.target.value.toUpperCase())}
              placeholder="Ej: ALZAMIENTO DE HIPOTECA Y PROHIBICION"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* Fecha escritura */}
          <div>
            <label className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1 block">
              Fecha de escritura <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fecha_escritura}
              onChange={e => set("fecha_escritura", e.target.value)}
              placeholder="DD-MM-AAAA"
              maxLength={10}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
            />
          </div>

          {/* Banlegal */}
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, es_banlegal: !prev.es_banlegal }))}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              form.es_banlegal
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-[#F4F6F8] border-gray-200 text-[#6B7280]"
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
              form.es_banlegal ? "border-amber-500 bg-amber-500" : "border-gray-300"
            }`}>
              {form.es_banlegal && <span className="text-white text-[10px] font-black">✓</span>}
            </span>
            Es Banlegal
            {form.es_banlegal && (
              <span className="ml-auto text-[10px] font-normal text-amber-600">
                No aparecerá en el informe del día
              </span>
            )}
          </button>

        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            {error}
          </p>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCerrar}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold text-[#374151] bg-[#F4F6F8] hover:bg-[#E5E7EB] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={!puedeGuardar || guardando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando
              ? <><Loader2 size={14} className="animate-spin" /> Guardando…</>
              : "Registrar en sistema"
            }
          </button>
        </div>

      </div>
    </div>
  )
}

