/**
 * Hook: useFormatear
 * Módulo 01 — Confecciones de Borradores — Tab 2 "Formatear".
 *
 * Maneja el estado del proceso de formateo:
 * - Selección de archivos .docx sin formato
 * - Envío al backend con combo de apoderados y notario
 * - Seguimiento de progreso por archivo
 * - Descarga automática de cada archivo formateado
 */

"use client"

import { useState, useCallback } from "react"

const API = "http://localhost:8000/confecciones/formatear"

// Mapeo de etiqueta de UI a clave de backend para el notario
const NOTARIO_MAP: Record<string, string> = {
  "Carolina Piña Cuevas": "carolina",
  "Notario Suplente Brenda Pérez": "suplente_1",
  "Notario Suplente 2":   "suplente_2",
}

export interface ArchivoEstado {
  nombre: string
  estado: "pendiente" | "procesando" | "ok" | "error"
  mensaje: string
}

export interface UseFormatearReturn {
  archivos: ArchivoEstado[]
  log: string[]
  progreso: number
  procesando: boolean
  seleccionarArchivos: (lista: FileList | null) => void
  limpiar: () => void
  /** Para BDC: modo='bdc', apo1Key y apo2Key requeridos.
   *  Para Banlegal: modo='banlegal', apo1Key='ronnie'|'felix', apo2Key omitido. */
  formatear: (modo: 'bdc' | 'banlegal', apo1Key: string, notarioLabel: string, apo2Key?: string) => Promise<void>
  contadores: { seleccionados: number; ok: number; errores: number }
}

export function useFormatear(): UseFormatearReturn {
  const [archivos, setArchivos]     = useState<ArchivoEstado[]>([])
  const [archivosRef, setArchivosRef] = useState<File[]>([])
  const [log, setLog]               = useState<string[]>([])
  const [procesando, setProcesando] = useState(false)

  const agregarLog = useCallback((linea: string) => {
    setLog((prev) => [...prev, linea])
  }, [])

  const seleccionarArchivos = useCallback((lista: FileList | null) => {
    if (!lista) return
    const nuevos = Array.from(lista).filter((f) => /\.(docx|doc)$/i.test(f.name))
    setArchivosRef(nuevos)
    setArchivos(
      nuevos.map((f) => ({
        nombre: f.name,
        estado: "pendiente",
        mensaje: "",
      }))
    )
    setLog([`${nuevos.length} archivo(s) seleccionado(s).`])
  }, [])

  const limpiar = useCallback(() => {
    setArchivos([])
    setArchivosRef([])
    setLog([])
  }, [])

  /** Descarga el blob recibido con el nombre indicado. */
  const descargar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob)
    const a   = document.createElement("a")
    a.href     = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Actualiza el estado de un archivo por índice. */
  const actualizarArchivo = (
    indice: number,
    estado: ArchivoEstado["estado"],
    mensaje = ""
  ) => {
    setArchivos((prev) =>
      prev.map((a, i) => (i === indice ? { ...a, estado, mensaje } : a))
    )
  }

  const formatear = useCallback(
    async (modo: 'bdc' | 'banlegal', apo1Key: string, notarioLabel: string, apo2Key?: string) => {
      if (archivosRef.length === 0) {
        agregarLog("⚠ No hay archivos seleccionados.")
        return
      }

      const notarioKey = NOTARIO_MAP[notarioLabel]
      if (!notarioKey) {
        agregarLog("⚠ Notario no válido.")
        return
      }

      setProcesando(true)
      agregarLog("Iniciando proceso de formateo...")

      for (let i = 0; i < archivosRef.length; i++) {
        const archivo = archivosRef[i]
        actualizarArchivo(i, "procesando")
        agregarLog(`Procesando: ${archivo.name}`)

        const form = new FormData()
        form.append("archivo",    archivo)
        form.append("apo1_id",    apo1Key)
        form.append("notario_id", notarioKey)
        // Para BDC se envía el segundo apoderado; para Banlegal se omite
        if (modo === 'bdc' && apo2Key) form.append("apo2_id", apo2Key)

        try {
          const respuesta = await fetch(API, { method: "POST", body: form })

          if (!respuesta.ok) {
            // Intentar leer el detalle de error del backend
            let detalle = `Error ${respuesta.status}`
            try {
              const json = await respuesta.json()
              detalle = json.detail ?? detalle
            } catch (_) { /* el body no era JSON */ }

            actualizarArchivo(i, "error", detalle)
            agregarLog(`✗ ${archivo.name}: ${detalle}`)
            continue
          }

          // Éxito: descargar el archivo formateado
          const blob        = await respuesta.blob()
          const nombreSalida = archivo.name.replace(/\.(docx|doc)$/i, "_FORMATEADO.docx")
          descargar(blob, nombreSalida)

          actualizarArchivo(i, "ok")
          agregarLog(`✓ ${archivo.name} → formateado y descargado.`)

        } catch (error) {
          const msg = error instanceof Error ? error.message : "Error de red"
          actualizarArchivo(i, "error", msg)
          agregarLog(`✗ ${archivo.name}: ${msg}`)
        }
      }

      agregarLog("Proceso finalizado.")
      setProcesando(false)
    },
    [archivosRef, agregarLog]
  )

  // Cálculo de contadores derivados del estado de los archivos
  const contadores = {
    seleccionados: archivos.length,
    ok:            archivos.filter((a) => a.estado === "ok").length,
    errores:       archivos.filter((a) => a.estado === "error").length,
  }

  // Progreso como porcentaje de archivos no pendientes
  const procesados = archivos.filter(
    (a) => a.estado === "ok" || a.estado === "error"
  ).length
  const progreso = archivos.length > 0
    ? Math.round((procesados / archivos.length) * 100)
    : 0

  return {
    archivos,
    log,
    progreso,
    procesando,
    seleccionarArchivos,
    limpiar,
    formatear,
    contadores,
  }
}
