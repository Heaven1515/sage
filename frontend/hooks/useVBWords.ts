/*
  Hook: useVBWords
  Controller del frontend para la lectura de Words de la carpeta VB (Tab 2).

  Responsabilidades:
    - Cargar la lista de subcarpetas VB disponibles al montar
    - Leer los archivos .docx de la subcarpeta seleccionada
    - Mantener los resultados para que la tabla los renderice
*/

import { useState, useCallback, useEffect, useRef } from "react"

const URL_BASE = "http://localhost:8000/vb/words"
const URL_IMPRESION = "http://localhost:8000/repertorios"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface WordItem {
  archivo: string
  wf: string
  nombreCliente: string
  materia: string
  comuna: string
  rut: string | null
  enBd: boolean
}

export interface CarpetasDisponibles {
  carpetas: string[]
  rutaMatriz: string | null
}

export interface EstadoImpresion {
  enCurso: boolean
  cancelar: boolean
  procesados: number
  total: number
  mensaje: string
}

// ── Mapeo snake_case → camelCase ─────────────────────────────────────────────

function mapearWordItem(d: Record<string, unknown>): WordItem {
  return {
    archivo: d.archivo as string,
    wf: d.wf as string,
    nombreCliente: d.nombre_cliente as string,
    materia: d.materia as string,
    comuna: d.comuna as string,
    rut: d.rut as string | null,
    enBd: d.en_bd as boolean,
  }
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useVBWords() {
  const [carpetasDisponibles, setCarpetasDisponibles] = useState<CarpetasDisponibles>({
    carpetas: [],
    rutaMatriz: null,
  })
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<string>("")
  const [words, setWords] = useState<WordItem[]>([])
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [archivosGenerados, setArchivosGenerados] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Carga las subcarpetas disponibles al montar — selecciona la más reciente por defecto
  const cargarCarpetas = useCallback(async () => {
    try {
      const r = await fetch(`${URL_BASE}/carpetas`)
      if (!r.ok) throw new Error("Error al obtener carpetas disponibles")
      const datos = await r.json()
      const info: CarpetasDisponibles = {
        carpetas: datos.carpetas as string[],
        rutaMatriz: datos.ruta_matriz as string | null,
      }
      setCarpetasDisponibles(info)
      // Preseleccionar la más reciente (índice 0, ya vienen ordenadas)
      if (info.carpetas.length > 0) {
        setCarpetaSeleccionada(info.carpetas[0])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar carpetas")
    }
  }, [])

  useEffect(() => { cargarCarpetas() }, [cargarCarpetas])

  // ── Lee todos los .docx de la carpeta seleccionada ────────────────────────
  const leerWords = useCallback(async (): Promise<void> => {
    if (!carpetaSeleccionada) {
      setError("Selecciona una carpeta primero")
      return
    }
    setCargando(true)
    setError(null)
    try {
      const r = await fetch(`${URL_BASE}/leer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_carpeta: carpetaSeleccionada }),
      })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al leer los archivos")
      }
      const datos = await r.json()
      setWords((datos as Record<string, unknown>[]).map(mapearWordItem))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [carpetaSeleccionada])

  // ── Genera una planilla Excel por materia y la guarda en Descargas ───────
  const generarPlanillas = useCallback(async (): Promise<void> => {
    if (words.length === 0) {
      setError("No hay documentos cargados. Lee los Words primero.")
      return
    }
    setGenerando(true)
    setError(null)
    setArchivosGenerados([])
    try {
      // Envía la lista completa de items; el backend agrupa por materia
      const payload = words.map((w) => ({
        archivo: w.archivo,
        wf: w.wf,
        nombre_cliente: w.nombreCliente,
        materia: w.materia,
        comuna: w.comuna,
        rut: w.rut,
        en_bd: w.enBd,
      }))
      const r = await fetch("http://localhost:8000/vb/planillas/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const detalle = await r.json()
        throw new Error(detalle.detail ?? "Error al generar las planillas")
      }
      const archivos = await r.json() as string[]
      setArchivosGenerados(archivos)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setGenerando(false)
    }
  }, [words])

  // ── Impresión de documentos de la carpeta del día ──────────────────────────

  const [estadoImpresion, setEstadoImpresion] = useState<EstadoImpresion | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function iniciarPolling() {
    if (pollingRef.current) return
    pollingRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${URL_IMPRESION}/estado-impresion`)
        if (!r.ok) return
        const datos = await r.json() as Record<string, unknown>
        const estado: EstadoImpresion = {
          enCurso: datos.en_curso as boolean,
          cancelar: datos.cancelar as boolean,
          procesados: datos.procesados as number,
          total: datos.total as number,
          mensaje: datos.mensaje as string,
        }
        setEstadoImpresion(estado)
        if (!estado.enCurso) {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
        }
      } catch { /* error de red — el polling sigue intentando */ }
    }, 1000)
  }

  const imprimir = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      // Envía los items para generar el Word de detalle de envío en la carpeta
      const payload = words.map((w) => ({
        wf: w.wf,
        nombre_cliente: w.nombreCliente,
      }))
      // Usa endpoint separado: imprime completo + genera detalle de envío
      const params = carpetaSeleccionada ? `?nombre_carpeta=${encodeURIComponent(carpetaSeleccionada)}` : ""
      const r = await fetch(`${URL_IMPRESION}/imprimir-completo${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
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
  }, [words, carpetaSeleccionada])

  const cancelarImpresion = useCallback(async (): Promise<void> => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setError(null)
    try {
      const r = await fetch(`${URL_IMPRESION}/cancelar`, { method: "POST" })
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
    carpetasDisponibles,
    carpetaSeleccionada,
    setCarpetaSeleccionada,
    words,
    cargando,
    generando,
    archivosGenerados,
    error,
    leerWords,
    generarPlanillas,
    recargarCarpetas: cargarCarpetas,
    estadoImpresion,
    imprimir,
    cancelarImpresion,
  }
}
