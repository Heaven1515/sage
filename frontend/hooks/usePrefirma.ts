/**
 * Hook del módulo Renombrado para Firma (ex-Prefirma).
 * Gestiona: carpeta del escáner, modo automático y log de renombrados.
 */

"use client"

import { useState, useCallback, useEffect } from "react"

const API = "http://localhost:8000/prefirma"

export interface EstadoSesion {
  activo:            boolean
  total_renombrados: number
  total_errores:     number
}

export interface LogItem {
  id:              number
  nombre_archivo:  string
  repertorio:      string | null
  anho_repertorio: string | null
  estado:          string           // 'ok' | 'error' | 'sin_datos'
  mensaje_error:   string | null
  fecha_procesado: string
  nombre_nuevo:    string | null    // nombre resultante tras renombrar
}

export function usePrefirma() {
  // ── Carpeta ──────────────────────────────────────────────────────────────
  const [rutaCarpeta, setRutaCarpeta] = useState<string | null>(null)

  // ── Modo automático ──────────────────────────────────────────────────────
  const [modoAuto, setModoAuto]         = useState(false)
  const [estadoAuto, setEstadoAuto]     = useState<EstadoSesion | null>(null)
  const [cargandoAuto, setCargandoAuto] = useState(false)

  // ── Logs ─────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<LogItem[]>([])

  // ── Error ─────────────────────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null)

  const cargarLogs = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/logs`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      // silencioso
    }
  }, [])

  const cargarEstadoAuto = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/auto/estado`)
      const data = await res.json()
      setModoAuto(data.activo ?? false)
      setEstadoAuto({
        activo:            data.activo            ?? false,
        total_renombrados: data.total_renombrados ?? 0,
        total_errores:     data.total_errores     ?? 0,
      })
    } catch {
      // silencioso
    }
  }, [])

  // ── Al montar: cargar carpeta, logs y estado ─────────────────────────────
  useEffect(() => {
    fetch(`${API}/carpeta`)
      .then(r => r.json())
      .then(d => { if (d.ruta_carpeta) setRutaCarpeta(d.ruta_carpeta) })
      .catch(() => {})

    cargarEstadoAuto()
    cargarLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Polling cuando el modo auto está activo ──────────────────────────────
  useEffect(() => {
    if (!modoAuto) return
    const intervalo = setInterval(() => {
      cargarLogs()
      cargarEstadoAuto()
    }, 5000)
    return () => clearInterval(intervalo)
  }, [modoAuto, cargarLogs, cargarEstadoAuto])

  // ── Acciones ─────────────────────────────────────────────────────────────

  const seleccionarCarpeta = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch(`${API}/seleccionar-carpeta`, { method: "POST" })
      const data = await res.json()
      if (data.ruta_carpeta) setRutaCarpeta(data.ruta_carpeta)
    } catch {
      setError("No se pudo abrir el diálogo de carpeta")
    }
  }, [])

  const iniciarAuto = useCallback(async () => {
    setCargandoAuto(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/auto/iniciar`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error")
      setModoAuto(true)
      setEstadoAuto({ activo: true, total_renombrados: 0, total_errores: 0 })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar modo automático")
    } finally {
      setCargandoAuto(false)
    }
  }, [])

  const detenerAuto = useCallback(async () => {
    setCargandoAuto(true)
    setError(null)
    try {
      await fetch(`${API}/auto/detener`, { method: "POST" })
      setModoAuto(false)
      setEstadoAuto(prev => prev ? { ...prev, activo: false } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al detener modo automático")
    } finally {
      setCargandoAuto(false)
    }
  }, [])

  return {
    rutaCarpeta, seleccionarCarpeta,
    estadoAuto, cargandoAuto, iniciarAuto, detenerAuto,
    logs, error,
  }
}
