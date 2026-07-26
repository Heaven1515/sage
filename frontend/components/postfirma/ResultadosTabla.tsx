/**
 * Tabla de resultados del procesamiento Postfirma.
 * Muestra cada PDF como tarjeta grande con todos los datos claramente etiquetados.
 */

import { CheckCircle, AlertCircle, HelpCircle, FileText } from "lucide-react"
import type { ResultadoPDF, ResultadoProcesamiento } from "@/hooks/usePostfirma"

interface Props {
  resultado: ResultadoProcesamiento
}

export function ResultadosTabla({ resultado }: Props) {
  return (
    <div className="flex flex-col gap-4">

      {/* Resumen numérico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 grid grid-cols-5 divide-x divide-gray-100">
        <Contador label="Total" valor={resultado.total} color="text-[#111827]" />
        <Contador label="Procesados" valor={resultado.procesados} color="text-green-600" />
        <Contador label="Banlegal" valor={resultado.banlegal_count} color="text-orange-600" />
        <Contador label="Sin datos en BD" valor={resultado.sin_datos} color="text-amber-600" />
        <Contador label="Con error" valor={resultado.con_error} color="text-red-600" />
      </div>

      {/* Información del JSON generado */}
      {resultado.json_guardado_en && (
        <div className="px-5 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-[var(--accent)]">
          <span className="font-semibold">JSON Santiago ({resultado.santiago_count} escrituras):</span>{" "}
          <span className="tabular-nums text-xs break-all">{resultado.json_guardado_en}</span>
        </div>
      )}

      {/* Tarjetas de resultados — una por PDF */}
      <div className="flex flex-col gap-3">
        {resultado.resultados.map((r, i) => (
          <TarjetaResultado key={i} fila={r} numero={i + 1} />
        ))}
      </div>

    </div>
  )
}

// ── Tarjeta individual ────────────────────────────────────────────────────────

function TarjetaResultado({ fila, numero }: { fila: ResultadoPDF; numero: number }) {
  const esOk       = fila.estado === "ok"
  const esSinDatos = fila.estado === "sin_datos"
  const esError    = fila.estado === "error"

  const bordeCls = esOk
    ? "border-green-200 bg-white"
    : esSinDatos
    ? "border-amber-200 bg-amber-50/30"
    : "border-red-200 bg-red-50/30"

  return (
    <div className={`rounded-xl border-2 ${bordeCls} p-5 shadow-sm`}>

      {/* Cabecera: número + estado + nombre archivo */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xs font-bold text-[#9CA3AF] tabular-nums mt-0.5 w-6 shrink-0 text-right">
          {numero}
        </span>

        {/* Ícono de estado grande */}
        <div className="shrink-0 mt-0.5">
          {esOk       && <CheckCircle  size={20} className="text-green-500" />}
          {esSinDatos && <HelpCircle   size={20} className="text-amber-500" />}
          {esError    && <AlertCircle  size={20} className="text-red-500"   />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Nombre archivo nuevo (prominente) */}
          {fila.nombre_nuevo && (
            <p className="tabular-nums text-sm font-semibold text-[#111827] break-all leading-snug">
              {fila.nombre_nuevo}
            </p>
          )}
          {/* Nombre original siempre visible debajo */}
          <p className="tabular-nums text-xs text-[#9CA3AF] mt-0.5 break-all">
            <FileText size={11} className="inline mr-1" />
            {fila.nombre_original}
          </p>
          {/* Mensaje de error si aplica */}
          {fila.error && (
            <p className="text-sm text-red-600 italic mt-1">{fila.error}</p>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col gap-1 shrink-0 items-end">
          {fila.en_json && (
            <span className="text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] rounded-full px-3 py-1 whitespace-nowrap">
              JSON ✓
            </span>
          )}
          {fila.es_banlegal && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 rounded-full px-3 py-1 whitespace-nowrap">
              BANLEGAL
            </span>
          )}
        </div>
      </div>

      {/* Grid de datos */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 pl-9 sm:grid-cols-3">

        <Dato etiqueta="WF"          valor={fila.wf} mono />
        <Dato etiqueta="Certificado" valor={fila.certificado} mono />
        <Dato etiqueta="RUT"         valor={fila.rut} mono />

        <Dato
          etiqueta="Cliente"
          valor={fila.nombre_cliente}
          clase="sm:col-span-2"
        />

        <Dato
          etiqueta="Repertorio"
          valor={fila.repertorio && fila.anio ? `${fila.repertorio}-${fila.anio}` : fila.repertorio}
          mono
        />

        <DatoComuna comuna={fila.comuna} />

      </div>

    </div>
  )
}

// ── Átomo: campo etiqueta + valor ─────────────────────────────────────────────

function Dato({
  etiqueta,
  valor,
  mono = false,
  clase = "",
}: {
  etiqueta: string
  valor: string | null | undefined
  mono?: boolean
  clase?: string
}) {
  return (
    <div className={clase}>
      <p className="text-xs text-[#9CA3AF] font-medium mb-0.5">{etiqueta}</p>
      <p className={`text-sm font-semibold text-[#111827] ${mono ? "tabular-nums" : ""}`}>
        {valor ?? <span className="text-[#D1D5DB] font-normal">—</span>}
      </p>
    </div>
  )
}

function DatoComuna({ comuna }: { comuna: string | null }) {
  return (
    <div>
      <p className="text-xs text-[#9CA3AF] font-medium mb-0.5">Comuna</p>
      {comuna
        ? (
          <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
            comuna.toUpperCase() === "SANTIAGO"
              ? "bg-blue-100 text-blue-700"
              : "bg-purple-100 text-purple-700"
          }`}>
            {comuna}
          </span>
        )
        : <span className="text-sm text-[#D1D5DB]">—</span>
      }
    </div>
  )
}

// ── Contador del resumen ──────────────────────────────────────────────────────

function Contador({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="px-5 py-4 text-center">
      <div className={`text-2xl font-black ${color}`}>{valor}</div>
      <div className="text-xs text-[#9CA3AF] mt-0.5">{label}</div>
    </div>
  )
}
