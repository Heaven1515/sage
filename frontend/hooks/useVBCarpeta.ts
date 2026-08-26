/*
  Hook: useVBCarpeta
  Controller del frontend para la gestión de carpeta de descargas (Tab 2 — Words).

  Responsabilidades:
    - Consultar el estado de la carpeta al montar el componente
    - Inicializar la carpeta (primera vez — dispara diálogo nativo en el backend)
    - Activar el vigilador + crear carpeta del día
    - Desactivar el vigilador
*/

import { useState, useCallback, useEffect } from "react"

const URL_BASE = "http://localhost:8000/vb/carpeta"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface EstadoCarpeta {
  configurada: boolean
  activa: boolean
  rutaBase: string | null
  carpetaHoy: string | null
  rutaCompleta: string | null
  vigiladorCorriendo: boolean
}

// ── Mapeo snake_case (backend) → camelCase (frontend) ────────────────────────

function mapearEstado(datos: Record<string, unknown>): EstadoCarpeta {
  return {
    configurada: datos.configurada as boolean,
    activa: datos.activa as boolean,
    rutaBase: datos.ruta_base as string | null,
    carpetaHoy: datos.carpeta_hoy as string | null,
    rutaCompleta: datos.ruta_completa as string | null,
    vigiladorCorriendo: datos.vigilador_corriendo as boolean,
  }
}

// ── Helper para llamadas POST simples ────────────────────────────────────────

async function llamarEndpoint(ruta: string, cuerpo?: object): Promise<EstadoCarpeta> {
  const opciones: RequestInit = { method: "POST" }
  if (cuerpo !== undefined) {
    opciones.headers = { "Content-Type": "application/json" }
    opciones.body = JSON.stringify(cuerpo)
  }
  const respuesta = await fetch(`${URL_BASE}/${ruta}`, opciones)
  if (!respuesta.ok) {
    const detalle = await respuesta.json()
    throw new Error(detalle.detail ?? `Error al ejecutar ${ruta}`)
  }
  return mapearEstado(await respuesta.json())
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useVBCarpeta() {
  const [estado, setEstado] = useState<EstadoCarpeta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Carga el estado desde el backend al montar el hook
  const cargarEstado = useCallback(async () => {
    try {
      const respuesta = await fetch(`${URL_BASE}/estado`)
      if (!respuesta.ok) throw new Error("No se pudo obtener el estado de la carpeta")
      setEstado(mapearEstado(await respuesta.json()))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }, [])

  useEffect(() => { cargarEstado() }, [cargarEstado])

  // ── Inicializa la carpeta — abre el diálogo nativo de Windows ────────────
  // Nota: el backend puede tardar varios segundos mientras el usuario elige
  const inicializar = useCallback(async (): Promise<void> => {
    setCargando(true)
    setError(null)
    try {
      setEstado(await llamarEndpoint("inicializar"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al inicializar")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Activa el vigilador apuntando a la carpeta indicada (o a la de hoy) ───
  const activar = useCallback(async (nombreCarpeta?: string): Promise<void> => {
    setCargando(true)
    setError(null)
    try {
      setEstado(await llamarEndpoint("activar", { nombre_carpeta: nombreCarpeta ?? null }))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al activar")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Desactiva el vigilador — las descargas vuelven al destino por defecto ─
  const desactivar = useCallback(async (): Promise<void> => {
    setCargando(true)
    setError(null)
    try {
      setEstado(await llamarEndpoint("desactivar"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al desactivar")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Cambia la carpeta base — detiene vigilador y abre diálogo de selección ─
  const reinicializar = useCallback(async (): Promise<void> => {
    setCargando(true)
    setError(null)
    try {
      setEstado(await llamarEndpoint("reinicializar"))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar carpeta")
    } finally {
      setCargando(false)
    }
  }, [])

  return { estado, cargando, error, inicializar, activar, desactivar, reinicializar }
}
