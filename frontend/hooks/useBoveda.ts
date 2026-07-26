/**
 * Hook del módulo Bóveda.
 * Gestiona el registro de escrituras entregadas al archivo físico,
 * detección de reingresos, entregas parciales y generación de Word.
 */

"use client"

import { useState, useCallback, useEffect } from "react"
import { obtenerSesion } from "@/hooks/useAuth"

const API = "http://localhost:8000/boveda"

function fechaHoy(): string {
  return new Date().toISOString().split("T")[0]
}

export interface RegistroItem {
  id:             number
  repertorio:     number
  fecha:          string
  hora_ingreso:   string
  es_reingreso:   boolean
  motivo:         string
  numero_entrega: number
}

export interface VerificacionRepertorio {
  es_reingreso:      boolean
  registros_previos: RegistroItem[]
}

export interface ConfigBoveda {
  entrega_actual: number
  fecha_entrega:  string | null
}

export interface RespuestaBusqueda {
  repertorio: number
  registros:  RegistroItem[]
  total:      number
}

export function useBoveda() {
  const [registros,          setRegistros]          = useState<RegistroItem[]>([])
  const [config,             setConfig]             = useState<ConfigBoveda | null>(null)
  const [fechaSeleccionada,  setFechaSeleccionada]  = useState<string>(fechaHoy())
  const [cargando,           setCargando]           = useState(false)
  const [error,              setError]              = useState<string | null>(null)
  const [resultadosBusqueda, setResultadosBusqueda] = useState<RespuestaBusqueda | null>(null)

  const cargarConfig = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/config`)
      const data = await res.json()
      setConfig(data as ConfigBoveda)
    } catch {
      // Silencioso: no bloquea el flujo principal
    }
  }, [])

  // Carga los registros de una fecha específica
  const cargarRegistros = useCallback(async (fecha: string) => {
    if (!fecha) return
    setCargando(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/registros?fecha=${fecha}`)
      const data = await res.json()
      if (!res.ok) {
        const detalle = typeof data.detail === "string" ? data.detail : "Error al cargar registros"
        throw new Error(detalle)
      }
      setRegistros(data as RegistroItem[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarConfig()
    cargarRegistros(fechaHoy())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Verifica si un repertorio ya existe en el año actual (sin efectos en el estado)
  const verificarRepertorio = useCallback(async (repertorio: number): Promise<VerificacionRepertorio> => {
    const res  = await fetch(`${API}/verificar/${repertorio}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "Error al verificar")
    return data as VerificacionRepertorio
  }, [])

  // Registra una nueva entrega a bóveda y agrega la fila a la tabla si es hoy
  const registrar = useCallback(async (repertorio: number, motivo?: string): Promise<RegistroItem> => {
    setError(null)
    const sesion = obtenerSesion()
    const res  = await fetch(`${API}/registro`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        repertorio,
        motivo:     motivo ?? null,
        usuario_id: sesion?.id ?? null,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "Error al registrar")
    const nuevo = data as RegistroItem
    if (fechaSeleccionada === fechaHoy()) {
      setRegistros(prev => [...prev, nuevo])
    }
    return nuevo
  }, [fechaSeleccionada])

  // Edita el número de repertorio de un registro existente
  const editarRegistro = useCallback(async (id: number, repertorio: number, contrasena?: string) => {
    setError(null)
    const res  = await fetch(`${API}/registro/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ repertorio, contrasena: contrasena ?? null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "Error al editar")
    const actualizado = data as RegistroItem
    setRegistros(prev => prev.map(r => r.id === id ? actualizado : r))
  }, [])

  // Elimina un registro de bóveda
  const eliminarRegistro = useCallback(async (id: number, contrasena?: string) => {
    setError(null)
    const res  = await fetch(`${API}/registro/${id}`, {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ contrasena: contrasena ?? null }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail || "Error al eliminar")
    setRegistros(prev => prev.filter(r => r.id !== id))
  }, [])

  // Activa una nueva entrega del día e incrementa el contador
  const nuevaEntrega = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch(`${API}/nueva-entrega`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al iniciar nueva entrega")
      setConfig(prev => prev ? { ...prev, entrega_actual: data.entrega_actual } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    }
  }, [])

  // Busca un repertorio en todo el historial
  const buscarRepertorio = useCallback(async (repertorio: number) => {
    setError(null)
    try {
      const res  = await fetch(`${API}/buscar/${repertorio}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al buscar")
      setResultadosBusqueda(data as RespuestaBusqueda)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    }
  }, [])

  // Genera el Word de la entrega actual y lo descarga directamente
  const generarWord = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`${API}/generar-word`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || "Error al generar Word")
      }
      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      const header = res.headers.get("Content-Disposition") ?? ""
      const nombre = header.match(/filename="([^"]+)"/)?.[1] ?? "BOVEDA.docx"
      const enlace = document.createElement("a")
      enlace.href     = url
      enlace.download = nombre
      enlace.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    }
  }, [])

  // Cambia la fecha del selector y carga los registros de esa fecha
  const cambiarFecha = useCallback(async (nuevaFecha: string) => {
    if (!nuevaFecha) return
    setFechaSeleccionada(nuevaFecha)
    await cargarRegistros(nuevaFecha)
  }, [cargarRegistros])

  return {
    registros,
    config,
    fechaSeleccionada,
    cargando,
    error,
    resultadosBusqueda,
    esHoy: fechaSeleccionada === fechaHoy(),
    verificarRepertorio,
    registrar,
    editarRegistro,
    eliminarRegistro,
    nuevaEntrega,
    buscarRepertorio,
    limpiarBusqueda: () => setResultadosBusqueda(null),
    limpiarLista: () => setRegistros([]),
    generarWord,
    cambiarFecha,
  }
}
