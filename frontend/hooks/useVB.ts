/*
  Hook: useVB
  Módulo 02 — Tab 1 Lista de Trabajo.

  Responsabilidades:
    - Subir el Excel del banco y devolver todas las filas tal como vienen
    - Recuperar filas guardadas por fecha desde la BD
    - NO filtra, NO transforma — el componente maneja el filtro de actividades
*/

import { useState, useCallback } from "react"

const API = "http://localhost:8000/vb"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface FilaVB {
  id: number
  numeroCarpeta: string
  rut: string
  nombreCliente: string
  actividad: string
  fechaEsperada: string | null
  fechaCarga: string
}

export interface ResultadoCargaVB {
  totalEnExcel: number
  insertados: number
  duplicados: number
}

// ── Helper de mapeo snake_case → camelCase ────────────────────────────────────
function mapear(raw: Record<string, unknown>): FilaVB {
  return {
    id:             raw.id as number,
    numeroCarpeta:  raw.numero_carpeta as string,
    rut:            raw.rut as string,
    nombreCliente:  raw.nombre_cliente as string,
    actividad:      raw.actividad_actual as string,
    fechaEsperada:  raw.fecha_esperada as string | null,
    fechaCarga:     raw.fecha_carga as string,
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useVB() {
  const [filas, setFilas]           = useState<FilaVB[]>([])
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [resultado, setResultado]   = useState<ResultadoCargaVB | null>(null)

  // Sube el Excel y devuelve TODAS las filas del archivo tal como vienen
  const subirExcel = useCallback(async (archivo: File): Promise<void> => {
    setCargando(true)
    setError(null)
    setResultado(null)
    try {
      const form = new FormData()
      form.append("archivo", archivo)
      const res = await fetch(`${API}/subir-excel`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al subir el archivo")
      const items = (data.wfs_excel as Record<string, unknown>[]).map(mapear)
      if (items.length === 0) throw new Error("El archivo no contiene filas válidas")
      setFilas(items)
      setResultado({
        totalEnExcel: data.total_en_excel as number,
        insertados:   data.insertados as number,
        duplicados:   data.duplicados as number,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  const limpiar = useCallback(() => {
    setFilas([])
    setResultado(null)
    setError(null)
  }, [])

  const copiarWF = useCallback(async (numero: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(numero)
      return true
    } catch {
      return false
    }
  }, [])

  return { filas, cargando, error, resultado, subirExcel, limpiar, copiarWF }
}
