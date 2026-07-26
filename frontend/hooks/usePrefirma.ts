/**
 * Hook del módulo Prefirma — flujo manual asistido.
 * Gestiona: carpeta, lista de archivos, preview, búsqueda en BD y envío del formulario.
 */

"use client"

import { useState, useCallback, useEffect } from "react"
import type { DatosManual } from "@/components/prefirma/ModalRegistroManual"

const API = "http://localhost:8000/prefirma"

/** Elimina tildes y acentos para evitar corrupción en el formulario del CBR. */
function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export interface FechaOtorgamiento {
  dia:  string
  mes:  string
  anio: string
}

export interface EstadoSesion {
  activo:        boolean
  total_ok:      number
  total_errores: number
}

export interface LogItem {
  id:              number
  nombre_archivo:  string
  repertorio:      string | null
  anho_repertorio: string | null
  tipo_contrato:   string | null
  estado:          string
  mensaje_error:   string | null
  fecha_procesado: string
}

export interface DatosRepertorio {
  encontrado:      boolean
  materia:         string | null
  fecha_escritura: string | null   // "DD-MM-YYYY"
  nombre_cliente:  string | null
  advertencia:     string | null   // aviso cuando el WF ya existía
}

const FECHA_VACIA: FechaOtorgamiento = { dia: "", mes: "", anio: "" }

export function usePrefirma() {
  // ── Carpeta ──────────────────────────────────────────────────────────────
  const [rutaCarpeta, setRutaCarpeta]     = useState<string | null>(null)
  const [archivos, setArchivos]           = useState<string[]>([])
  const [cargandoArchivos, setCargandoArchivos] = useState(false)

  // ── Archivo seleccionado ─────────────────────────────────────────────────
  const [archivoActual, setArchivoActual] = useState<string | null>(null)
  const [imagenes, setImagenes]           = useState<string[]>([])
  const [cargandoPreview, setCargandoPreview] = useState(false)

  // ── Formulario ───────────────────────────────────────────────────────────
  const [fecha, setFecha]               = useState(FECHA_VACIA)
  const [repertorio, setRepertorio]     = useState("")
  const [anho, setAnho]                 = useState(String(new Date().getFullYear()))
  const [tipoContrato, setTipoContrato] = useState("")
  const [buscandoRep, setBuscandoRep]   = useState(false)
  const [datosRep, setDatosRep]         = useState<DatosRepertorio | null>(null)

  // ── Registro manual ──────────────────────────────────────────────────────
  const [mostrarModalManual, setMostrarModalManual] = useState(false)

  // ── Modo automático ──────────────────────────────────────────────────────
  const [modoAuto, setModoAuto]         = useState(false)
  const [estadoAuto, setEstadoAuto]     = useState<EstadoSesion | null>(null)
  const [cargandoAuto, setCargandoAuto] = useState(false)

  // ── Envío ────────────────────────────────────────────────────────────────
  const [enviando, setEnviando]         = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // ── Logs ─────────────────────────────────────────────────────────────────
  const [logs, setLogs]                 = useState<LogItem[]>([])

  const cargarLogs = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/logs`)
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch {
      // silencioso
    }
  }, [])

  // cargarArchivos declarado aquí (antes de los useEffects que lo usan en sus
  // dependency arrays) para evitar TDZ — acceder a un const en la dep array
  // antes de su declaración lanza ReferenceError en runtime.
  const cargarArchivos = useCallback(async (): Promise<string[]> => {
    setCargandoArchivos(true)
    setError(null)
    try {
      const res    = await fetch(`${API}/archivos`)
      const data: { nombre: string }[] = await res.json()
      const nombres = data.map(a => a.nombre)
      setArchivos(nombres)
      return nombres
    } catch {
      setError("No se pudo cargar la lista de archivos")
      return []
    } finally {
      setCargandoArchivos(false)
    }
  }, [])

  // ── Al montar: cargar carpeta, logs y estado del modo automático ─────────
  useEffect(() => {
    fetch(`${API}/carpeta`)
      .then(r => r.json())
      .then(d => { if (d.ruta_carpeta) setRutaCarpeta(d.ruta_carpeta) })
      .catch(() => {})

    fetch(`${API}/auto/estado`)
      .then(r => r.json())
      .then(d => {
        setModoAuto(d.activo ?? false)
        setEstadoAuto({ activo: d.activo ?? false, total_ok: d.total_ok ?? 0, total_errores: d.total_errores ?? 0 })
      })
      .catch(() => {})

    cargarLogs()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Polling de logs, archivos y contadores cuando modo auto activo ────────
  useEffect(() => {
    if (!modoAuto) return
    const intervalo = setInterval(() => {
      cargarLogs()
      cargarArchivos()
      fetch(`${API}/auto/estado`)
        .then(r => r.json())
        .then(d => setEstadoAuto(prev => prev
          ? { ...prev, total_ok: d.total_ok ?? 0, total_errores: d.total_errores ?? 0 }
          : null))
        .catch(() => {})
    }, 5000)
    return () => clearInterval(intervalo)
  }, [modoAuto, cargarLogs, cargarArchivos])

  // ── Al cambiar carpeta: cargar archivos automáticamente ──────────────────
  useEffect(() => {
    if (rutaCarpeta) cargarArchivos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaCarpeta])

  // ── Acciones ─────────────────────────────────────────────────────────────

  const seleccionarCarpeta = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch(`${API}/seleccionar-carpeta`, { method: "POST" })
      const data = await res.json()
      if (data.ruta_carpeta) {
        setRutaCarpeta(data.ruta_carpeta)
      }
    } catch {
      setError("No se pudo abrir el diálogo de carpeta")
    }
  }, [])

  const seleccionarArchivo = useCallback(async (nombre: string) => {
    setArchivoActual(nombre)
    setImagenes([])
    setRepertorio("")
    setTipoContrato("")
    setFecha(FECHA_VACIA)
    setDatosRep(null)
    setError(null)
    setCargandoPreview(true)
    try {
      const res  = await fetch(`${API}/preview/${encodeURIComponent(nombre)}`)
      const data = await res.json()
      if (data.imagenes) setImagenes(data.imagenes)
    } catch {
      setError("No se pudo generar la preview del PDF")
    } finally {
      setCargandoPreview(false)
    }
  }, [])

  const buscarRepertorio = useCallback(async () => {
    if (!repertorio.trim() || !anho.trim()) return
    setBuscandoRep(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/repertorio/${repertorio.trim()}/${anho.trim()}`)
      const data: DatosRepertorio = await res.json()
      setDatosRep(data)
      if (data.encontrado) {
        // Auto-rellenar materia desde BD sin tildes (el CBR no acepta acentos)
        if (data.materia) setTipoContrato(sinTildes(data.materia))
        // Auto-rellenar fecha desde BD (formato "DD-MM-YYYY")
        if (data.fecha_escritura) {
          const [dia, mes, anio] = data.fecha_escritura.split("-")
          setFecha({ dia, mes, anio })
        }
      }
    } catch {
      setError("Error al buscar el repertorio")
    } finally {
      setBuscandoRep(false)
    }
  }, [repertorio, anho])

  const enviar = useCallback(async () => {
    if (!archivoActual) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(`${API}/enviar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_archivo: archivoActual,
          repertorio:     repertorio.trim(),
          anho:           anho.trim(),
          tipo_contrato:  tipoContrato.trim(),
          fecha_dia:      parseInt(fecha.dia),
          fecha_mes:      parseInt(fecha.mes),
          fecha_anio:     parseInt(fecha.anio),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.detail || "Error al enviar")
      }
      const log: LogItem = await res.json()
      setLogs(prev => [log, ...prev])
      if (log.estado === "error") {
        throw new Error(log.mensaje_error || "Error al enviar al servidor SIGN+")
      }
      // Limpiar selección, recargar lista y auto-seleccionar el primero
      setArchivoActual(null)
      setImagenes([])
      setRepertorio("")
      setTipoContrato("")
      setDatosRep(null)
      const siguientes = await cargarArchivos()
      if (siguientes.length > 0) await seleccionarArchivo(siguientes[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setEnviando(false)
    }
  }, [archivoActual, repertorio, anho, tipoContrato, fecha, cargarArchivos])

  const registrarManual = useCallback(async (datos: DatosManual) => {
    const res = await fetch(`${API}/registro-manual`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.detail || "Error al registrar")
    }
    const datosGuardados: DatosRepertorio = await res.json()
    setDatosRep(datosGuardados)
    if (datosGuardados.materia)         setTipoContrato(sinTildes(datosGuardados.materia))
    if (datosGuardados.fecha_escritura) {
      const [dia, mes, anio] = datosGuardados.fecha_escritura.split("-")
      setFecha({ dia, mes, anio })
    }
    setMostrarModalManual(false)
  }, [])

  const iniciarAuto = useCallback(async () => {
    setCargandoAuto(true)
    setError(null)
    try {
      const res  = await fetch(`${API}/auto/iniciar`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error")
      setModoAuto(true)
      setEstadoAuto({ activo: true, total_ok: 0, total_errores: 0 })
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

  const pendientesManuales = logs.filter(l => l.estado === "sin_datos").length

  return {
    // carpeta
    rutaCarpeta, seleccionarCarpeta, cargarArchivos,
    // lista
    archivos, cargandoArchivos, archivoActual, seleccionarArchivo,
    // preview
    imagenes, cargandoPreview,
    // formulario
    fecha, setFecha,
    repertorio, setRepertorio,
    anho, setAnho,
    tipoContrato, setTipoContrato,
    datosRep, buscandoRep, buscarRepertorio,
    // registro manual
    mostrarModalManual, setMostrarModalManual, registrarManual,
    // envío
    enviando, enviar, error,
    // historial
    logs,
    // modo automático
    modoAuto, estadoAuto, cargandoAuto, iniciarAuto, detenerAuto, pendientesManuales,
  }
}
