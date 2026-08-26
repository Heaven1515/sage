/*
  Hook: useConfiguracion
  Controller del frontend para el Módulo 07 — Configuración.

  Responsabilidades:
    - Cargar y guardar la configuración global del sistema
    - CRUD de usuarios del sistema
*/

"use client"

import { useState, useCallback, useEffect } from "react"

const API = "http://localhost:8000"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ConfiguracionData {
  conf_escaneados:  string | null
  vb_carpeta:       string | null
  vb_salida:        string | null
  pre_escaneados:   string | null
  pre_url:          string | null
  post_entrada:     string | null
  post_salida:      string | null
  post_url:         string | null
  notaria:          string | null
  notario_titular:  string | null
  notario_dia:      string | null
  valor_operacion:  number
  red_interna:      string | null
  ip_impresora:     string | null
  nombre_impresora: string | null
  escaner_red:      string | null
  modo_demo:        boolean
}

export interface UsuarioItem {
  id:       number
  nombre:   string
  usuario:  string
  cargo:    string
  es_admin: boolean
  activo:   boolean
}

export interface CrearUsuarioDatos {
  nombre:     string
  usuario:    string
  cargo:      string
  contrasena: string
  es_admin:   boolean
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useConfiguracion() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionData | null>(null)
  const [usuarios,      setUsuarios]      = useState<UsuarioItem[]>([])
  const [impresoras,    setImpresoras]    = useState<string[]>([])
  const [cargando,      setCargando]      = useState(false)
  const [guardando,     setGuardando]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [guardado,      setGuardado]      = useState(false)

  // ── Carga la configuración global desde el backend ─────────────────────────
  const cargarConfiguracion = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/configuracion/`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al cargar configuración")
      setConfiguracion(data as ConfiguracionData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Guarda la configuración actualizada ───────────────────────────────────
  const guardarConfiguracion = useCallback(async (datos: ConfiguracionData) => {
    setGuardando(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/configuracion/`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(datos),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al guardar")
      setConfiguracion(data as ConfiguracionData)
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setGuardando(false)
    }
  }, [])

  // ── Carga la lista de usuarios ─────────────────────────────────────────────
  const cargarUsuarios = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/configuracion/usuarios`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al cargar usuarios")
      setUsuarios(data as UsuarioItem[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios")
    }
  }, [])

  // ── Crea un usuario nuevo ──────────────────────────────────────────────────
  const crearUsuario = useCallback(async (datos: CrearUsuarioDatos): Promise<void> => {
    const res  = await fetch(`${API}/configuracion/usuarios`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(datos),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? "Error al crear usuario")
    setUsuarios(prev => [...prev, data as UsuarioItem])
  }, [])

  // ── Edita un usuario existente ─────────────────────────────────────────────
  const editarUsuario = useCallback(async (
    id: number,
    datos: Partial<CrearUsuarioDatos & { activo: boolean; contrasena_antigua: string }>,
  ): Promise<void> => {
    const res  = await fetch(`${API}/configuracion/usuarios/${id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(datos),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? "Error al editar usuario")
    setUsuarios(prev => prev.map(u => u.id === id ? (data as UsuarioItem) : u))
  }, [])

  // ── Elimina un usuario ─────────────────────────────────────────────────────
  const eliminarUsuario = useCallback(async (id: number): Promise<void> => {
    const res = await fetch(`${API}/configuracion/usuarios/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.detail ?? "Error al eliminar usuario")
    }
    setUsuarios(prev => prev.filter(u => u.id !== id))
  }, [])

  // ── Carga la lista de impresoras instaladas en Windows ───────────────────
  const cargarImpresoras = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/configuracion/impresoras`)
      const data = await res.json()
      if (res.ok) setImpresoras(data.impresoras as string[])
    } catch {
      // Si falla, el dropdown queda vacío — no es crítico
    }
  }, [])

  // ── Toggle Modo Demo ────────────────────────────────────────────────────────
  const toggleModoDemo = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API}/configuracion/modo-demo`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al cambiar modo demo")
      setConfiguracion(prev => prev ? { ...prev, modo_demo: data.modo_demo } : prev)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cambiar modo demo")
    }
  }, [])

  useEffect(() => {
    cargarConfiguracion()
    cargarUsuarios()
    cargarImpresoras()
  }, [cargarConfiguracion, cargarUsuarios, cargarImpresoras])

  return {
    configuracion,
    usuarios,
    impresoras,
    cargando,
    guardando,
    guardado,
    error,
    guardarConfiguracion,
    cargarUsuarios,
    crearUsuario,
    editarUsuario,
    eliminarUsuario,
    toggleModoDemo,
  }
}
