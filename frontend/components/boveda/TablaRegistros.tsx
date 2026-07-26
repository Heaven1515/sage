/**
 * Tabla principal del módulo Bóveda.
 * Muestra los registros del día agrupados por número de entrega.
 * Permite editar el repertorio y eliminar filas al hacer clic en la fila.
 */

"use client"

import React, { useState } from "react"
import { Pencil, Trash2, AlertTriangle } from "lucide-react"
import type { RegistroItem } from "@/hooks/useBoveda"

interface Props {
  registros:      RegistroItem[]
  esHoy:          boolean
  onEditar:       (registro: RegistroItem) => void
  onEliminar:     (registro: RegistroItem) => void
}

export function TablaRegistros({ registros, esHoy, onEditar, onEliminar }: Props) {
  const [filaActiva, setFilaActiva] = useState<number | null>(null)

  if (registros.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-sm text-[#9CA3AF]">
          {esHoy ? "Sin registros por ahora. Ingresa el primer repertorio." : "No hay registros para esta fecha."}
        </p>
      </div>
    )
  }

  // Agrupar por numero_entrega para mostrar separadores
  const entregas = Array.from(new Set(registros.map(r => r.numero_entrega))).sort((a, b) => a - b)

  let contadorGlobal = 0

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--accent)] text-white">
            <th className="px-4 py-3 text-center font-semibold w-12">N°</th>
            <th className="px-4 py-3 text-center font-semibold w-28">Repertorio</th>
            <th className="px-4 py-3 text-center font-semibold w-24">Hora</th>
            <th className="px-4 py-3 text-left font-semibold">Comentario</th>
            <th className="px-4 py-3 text-center font-semibold w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map(numeroEntrega => {
            const filas = registros.filter(r => r.numero_entrega === numeroEntrega)

            return (
              <React.Fragment key={`entrega-${numeroEntrega}`}>
                {/* Separador de entrega */}
                <tr className="bg-[#EEF2FF]">
                  <td colSpan={5} className="px-4 py-1.5 text-xs font-bold text-[var(--accent)] tracking-wide uppercase">
                    Entrega N° {numeroEntrega}
                  </td>
                </tr>

                {filas.map(reg => {
                  contadorGlobal++
                  const n        = contadorGlobal
                  const activa   = filaActiva === reg.id

                  return (
                    <tr
                      key={reg.id}
                      onClick={() => setFilaActiva(activa ? null : reg.id)}
                      className={`
                        border-b border-gray-50 cursor-pointer transition-colors
                        ${n % 2 === 0 ? "bg-[#F4F6F8]" : "bg-white"}
                        ${activa ? "ring-2 ring-inset ring-[var(--accent)]" : "hover:bg-blue-50/40"}
                      `}
                    >
                      <td className="px-4 py-2.5 text-center text-[#6B7280] tabular-nums">{n}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-[#111827]">
                        {reg.repertorio}
                      </td>
                      <td className="px-4 py-2.5 text-center text-[#6B7280] tabular-nums">{reg.hora_ingreso}</td>
                      <td className="px-4 py-2.5 text-left text-[#374151]">
                        {reg.es_reingreso && (
                          <span className="inline-flex items-center gap-1 mr-2 text-amber-600 font-semibold text-xs">
                            <AlertTriangle size={12} />
                            REINGRESO
                          </span>
                        )}
                        {reg.motivo}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {activa && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); onEditar(reg) }}
                              title="Editar"
                              className="p-1 rounded-lg hover:bg-blue-100 text-[var(--accent)] transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); onEliminar(reg) }}
                              title="Eliminar"
                              className="p-1 rounded-lg hover:bg-red-100 text-red-500 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>

      <div className="px-4 py-2 border-t border-gray-100 bg-[#F4F6F8]">
        <p className="text-xs text-[#9CA3AF]">
          Total: {registros.length} escritura{registros.length !== 1 ? "s" : ""}
          {entregas.length > 1 && ` · ${entregas.length} entregas`}
        </p>
      </div>
    </div>
  )
}
