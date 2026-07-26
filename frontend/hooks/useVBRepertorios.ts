/*
  Hook: useVBRepertorios
  Controller del frontend para la sección Repertorios (Tab 3).

  Responsabilidades:
    - Cargar y parsear la planilla de repertorios (Excel del banco)
    - Llenar los Words de la carpeta activa con datos de repertorio y fecha
    - Iniciar y cancelar la impresión en segundo plano
    - Hacer polling del estado de impresión mientras hay un trabajo en curso
*/

import { useState, useCallback, useRef } from "react"

const URL_BASE = "http://localhost:8000/repertorios"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ItemRepertorio {
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

export interface ResultadoItem {
  wf: string
  nombreCliente: string
  repertorio: string
  estado: "OK" | "SIN_WORD" | "ERROR"
  nombreArchivo: string | null
}

export interface RespuestaLlenar {
  resultados: ResultadoItem[]
  totalOk: number
  totalSinWord: number
  totalError: number
  rutaCompletos: string
  wordResumen: string
}

export interface EstadoImpresion {
  enCurso: boolean
  cancelar: boolean
  procesados: number
  total: number
  mensaje: string
}

// ── Mapeo snake_case → camelCase ─────────────────────────────────────────────

function mapearItem(d: Record<string, unknown>): ItemRepertorio {
  return {
    wf: d.wf as string,
    repertorio: d.repertorio as string,
    anio: d.anio as number,
    dia: d.dia as number,
    mes: d.mes as number,
    nombreCliente: d.nombre_cliente as string,
    materia: d.materia as string,
    rut: (d.rut as string | null) ?? null,
    clienteNotaria: (d.cliente_notaria as string | null) ?? null,
  }
}

function mapearResultado(d: Record<string, unknown>): ResultadoItem {
  return {
    wf: d.wf as string,
    nombreCliente: d.nombre_cliente as string,
    repertorio: d.repertorio as string,
    estado: d.estado as "OK" | "SIN_WORD" | "ERROR",
    nombreArchivo: d.nombre_archivo as string | null,
  }
}

function mapearRespuesta(d: Record<string, unknown>): RespuestaLlenar {
  return {
    resultados: (d.resultados as Record<string, unknown>[]).map(mapearResultado),
    totalOk: d.total_ok as number,
    totalSinWord: d.total_sin_word as number,
    totalError: d.total_error as number,
    rutaCompletos: d.ruta_completos as string,
    wordResumen: d.word_resumen as string,
  }
}

function mapearEstado(d: Record<string, unknown>): EstadoImpresion {
  return {
    enCurso: d.en_curso as boolean,
    cancelar: d.cancelar as boolean,
    procesados: d.procesados as number,
    total: d.total as number,
    mensaje: d.mensaje as string,
  }
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useVBRepertorios() {
  const [items, setItems] = useState<ItemRepertorio[]>([])
  const [respuesta, setRespuesta] = useState<RespuestaLlenar | null>(null)
  const [estadoImpresion, setEstadoImpresion] = useState<EstadoImpresion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [llenando, setLlenando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anio, setAnio] = useState<number>(new Date().getFullYear())
  const [guardandoAnio, setGuardandoAnio] = useState(false)

  // Referencia al intervalo de polling para poder cancelarlo
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Año activo para llenar Words ─────────────────────────────────────────
  const cargarAnio = useCallback(async () => {
    try {
      const r = await fetch(`${URL_BASE}/anio`)
      if (!r.ok) return
      const datos = await r.json() as { anio: number }
      setAnio(datos.anio)
    } catch {
      // Sin conexión — mantiene el año local
    }
  }, [])

  const guardarAnio = useCallback(async (nuevoAnio: number) => {
    setGuardandoAnio(true)
    try {
      const r = await fetch(`${URL_BASE}/anio?anio=${nuevoAnio}`, { method: "PUT" })
      if (!r.ok) throw new Error("Error al guardar el año")
      setAnio(nuevoAnio)
    } catch {
      // Error silencioso — el año local queda igual
    } finally {
      setGuardandoAnio(false)
    }
  }, [])

  // ── Polling del estado de impresión ──────────────────────────────────────
  function iniciarPolling() {
    if (pollingRef.current) return   // ya hay un polling activo
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${URL_BASE}/estado-impresion`)
        if (!r.ok) return
        const datos = await r.json() as Record<string, unknown>
        const estado = mapearEstado(datos)
        setEstadoImpresion(estado)
        // Detener polling cuando el trabajo termine
        if (!estado.enCurso) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
        }
      } catch {
        // Error de red — el polling sigue intentando
      }
    }, 1000)
  }

  function detenerPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // ── Cargar planilla Excel del banco ───────────────────────────────────────
  const cargarPlanilla = useCallback(async (archivo: File): Promise<void> => {
    setCargando(true)
    setError(null)
    setItems([])
    setRespuesta(null)
    try {
      const formData = new FormData()
      formData.append("archivo", archivo)
      const r = await fetch(`${URL_BASE}/cargar-planilla`, {
        method: "POST",
        body: formData,
      })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al cargar la planilla")
      }
      const datos = await r.json() as Record<string, unknown>[]
      setItems(datos.map(mapearItem))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Llenar Words con los datos de la planilla cargada ─────────────────────
  const llenarWords = useCallback(async (nombreCarpeta?: string): Promise<void> => {
    if (items.length === 0) {
      setError("Carga una planilla primero")
      return
    }
    setLlenando(true)
    setError(null)
    setRespuesta(null)
    try {
      const payload = items.map((item) => ({
        wf: item.wf,
        repertorio: item.repertorio,
        anio: item.anio,
        dia: item.dia,
        mes: item.mes,
        nombre_cliente: item.nombreCliente,
        materia: item.materia,
      }))
      // Si se indica carpeta, enviarla como query param para que el backend busque ahí
      const params = nombreCarpeta ? `?nombre_carpeta=${encodeURIComponent(nombreCarpeta)}` : ""
      const r = await fetch(`${URL_BASE}/llenar-words${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al llenar los Words")
      }
      const datos = await r.json() as Record<string, unknown>
      setRespuesta(mapearRespuesta(datos))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLlenando(false)
    }
  }, [items])

  // ── Iniciar impresión ─────────────────────────────────────────────────────
  const imprimir = useCallback(async (nombreCarpeta?: string): Promise<void> => {
    setError(null)
    try {
      const params = nombreCarpeta ? `?nombre_carpeta=${encodeURIComponent(nombreCarpeta)}` : ""
      const r = await fetch(`${URL_BASE}/imprimir${params}`, { method: "POST" })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al iniciar la impresión")
      }
      const datos = await r.json() as Record<string, unknown>
      setEstadoImpresion({
        enCurso: true,
        cancelar: false,
        procesados: 0,
        total: datos.total as number,
        mensaje: datos.mensaje as string,
      })
      iniciarPolling()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }, [])

  // ── Limpiar resultados de pantalla ───────────────────────────────────────
  const limpiar = useCallback(() => {
    setItems([])
    setRespuesta(null)
    setError(null)
    detenerPolling()
    setEstadoImpresion(null)
  }, [])

  // ── Cancelar impresión ────────────────────────────────────────────────────
  const cancelar = useCallback(async (): Promise<void> => {
    detenerPolling()
    setError(null)
    try {
      const r = await fetch(`${URL_BASE}/cancelar`, { method: "POST" })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al cancelar")
      }
      const datos = await r.json() as Record<string, unknown>
      setEstadoImpresion((prev) =>
        prev ? { ...prev, enCurso: false, mensaje: datos.mensaje as string } : null
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    }
  }, [])

  return {
    items,
    respuesta,
    estadoImpresion,
    cargando,
    llenando,
    error,
    anio,
    guardandoAnio,
    cargarAnio,
    guardarAnio,
    cargarPlanilla,
    llenarWords,
    imprimir,
    cancelar,
    limpiar,
  }
}
