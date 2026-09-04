/*
  Hook: useVBRegistro
  Controller del frontend para el Tab 4 — Registro de Datos.

  Responsabilidades:
    - Indexar una sesión (carpeta + planilla cargada) en el repositorio permanente
    - Listar el repositorio completo con filtros por texto y año
    - Exponer estado de carga y errores a los componentes
*/

import { useState, useCallback } from "react"
import { obtenerSesion } from "@/hooks/useAuth"

const URL_BASE = "http://localhost:8000/registro"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RegistroItem {
  id: number
  wf: string
  rut: string | null
  nombreCliente: string
  comuna: string
  materia: string
  repertorio: string | null
  anio: number | null
  fechaEscritura: string | null
  fechaIndexado: string
  numeroCaratula: string | null
  firmaElectronica: string | null
}

export interface ResultadoIndexar {
  indexados: number
  actualizados: number
  sinRepertorio: number
  sinWord: number
  total: number
}

// Item de la planilla que viene del hook useVBRepertorios
export interface ItemRepertorioParaIndexar {
  wf: string
  repertorio: string
  anio: number
  dia: number
  mes: number
  nombreCliente: string
  materia: string
  rut: string | null
  clienteNotaria: string | null
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useVBRegistro() {
  const [registros, setRegistros] = useState<RegistroItem[]>([])
  const [cargando, setCargando] = useState(false)
  const [indexando, setIndexando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultadoIndexar, setResultadoIndexar] = useState<ResultadoIndexar | null>(null)

  // ── Mapea snake_case del backend a camelCase del frontend ──────────────────
  function mapearRegistro(item: Record<string, unknown>): RegistroItem {
    return {
      id: item.id as number,
      wf: item.wf as string,
      rut: item.rut as string | null,
      nombreCliente: item.nombre_cliente as string,
      comuna: item.comuna as string,
      materia: item.materia as string,
      repertorio: item.repertorio as string | null,
      anio: item.anio as number | null,
      fechaEscritura: item.fecha_escritura as string | null,
      fechaIndexado: item.fecha_indexado as string,
      numeroCaratula: item.numero_caratula as string | null,
      firmaElectronica: item.firma_electronica as string | null,
    }
  }

  // ── Indexa la sesión activa en el repositorio permanente ───────────────────
  // Recibe el nombre de la carpeta y los items ya parseados de la planilla.
  // Si la planilla no se cargó aún, items puede ir vacío: igual se guardan
  // los datos del Word (sin repertorio).
  const indexarSesion = useCallback(async (
    nombreCarpeta: string,
    itemsRepertorio: ItemRepertorioParaIndexar[],
  ): Promise<void> => {
    setIndexando(true)
    setError(null)
    setResultadoIndexar(null)

    try {
      // Convierte camelCase del frontend a snake_case que espera el backend
      const itemsSnake = itemsRepertorio.map((item) => ({
        wf: item.wf,
        repertorio: item.repertorio,
        anio: item.anio,
        dia: item.dia,
        mes: item.mes,
        nombre_cliente: item.nombreCliente,
        materia: item.materia,
        rut: item.rut,
        cliente_notaria: item.clienteNotaria,
        numero_ot: item.numeroOt,
      }))

      const sesion = obtenerSesion()

      const respuesta = await fetch(`${URL_BASE}/indexar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_carpeta:   nombreCarpeta,
          items_repertorio: itemsSnake,
          usuario_id:       sesion?.id ?? null,
        }),
      })

      if (!respuesta.ok) {
        const detalle = await respuesta.json()
        throw new Error(detalle.detail ?? "Error al indexar la sesión")
      }

      const resultado = await respuesta.json()
      setResultadoIndexar({
        indexados: resultado.indexados,
        actualizados: resultado.actualizados,
        sinRepertorio: resultado.sin_repertorio,
        sinWord: resultado.sin_word,
        total: resultado.total,
      })

      // Refresca la tabla del repositorio tras indexar
      await cargarRegistros()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido al indexar")
    } finally {
      setIndexando(false)
    }
  }, [])

  // ── Carga el repositorio completo con filtros opcionales ───────────────────
  const cargarRegistros = useCallback(async (
    busqueda?: string,
    anio?: number,
  ): Promise<void> => {
    setCargando(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (busqueda) params.set("busqueda", busqueda)
      if (anio) params.set("anio", String(anio))

      const url = params.size > 0 ? `${URL_BASE}/?${params}` : `${URL_BASE}/`
      const respuesta = await fetch(url)

      if (!respuesta.ok) throw new Error("Error al obtener el repositorio")

      const datos = await respuesta.json()
      setRegistros(datos.map(mapearRegistro))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido al cargar")
    } finally {
      setCargando(false)
    }
  }, [])

  const limpiarRegistros = useCallback(() => {
    setRegistros([])
    setResultadoIndexar(null)
    setError(null)
  }, [])

  return {
    registros,
    cargando,
    indexando,
    error,
    resultadoIndexar,
    indexarSesion,
    cargarRegistros,
    limpiarRegistros,
  }
}
