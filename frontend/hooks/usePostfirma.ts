/**
 * Hook del módulo Postfirma.
 * Gestiona: carpeta origen, carpeta destino, procesamiento de PDFs y resultados.
 */

"use client"

import { useState, useCallback, useEffect } from "react"

const API = "http://localhost:8000/postfirma"

export interface ResultadoPDF {
  nombre_original:  string
  nombre_nuevo:     string | null
  certificado:      string | null
  wf:               string | null
  nombre_cliente:   string | null
  rut:              string | null
  repertorio:       string | null
  anio:             number | null
  comuna:           string | null
  en_json:          boolean
  es_banlegal:      boolean
  estado:           "ok" | "sin_datos" | "error"
  error:            string | null
}

export interface ResultadoProcesamiento {
  total:             number
  procesados:        number
  sin_datos:         number
  con_error:         number
  santiago_count:    number
  banlegal_count:    number
  json_guardado_en:  string | null
  carpeta_dia:       string | null
  resultados:        ResultadoPDF[]
}

export function usePostfirma() {
  const [rutaOrigen,  setRutaOrigen]  = useState<string | null>(null)
  const [rutaDestino, setRutaDestino] = useState<string | null>(null)
  const [procesando,  setProcesando]  = useState(false)
  const [resultado,   setResultado]   = useState<ResultadoProcesamiento | null>(null)
  const [error,       setError]       = useState<string | null>(null)

  // Cargar configuración guardada al montar el hook
  useEffect(() => {
    fetch(`${API}/config`)
      .then(r => r.json())
      .then(d => {
        if (d.ruta_origen)  setRutaOrigen(d.ruta_origen)
        if (d.ruta_destino) setRutaDestino(d.ruta_destino)
      })
      .catch(() => {})
  }, [])

  const seleccionarCarpetaOrigen = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch(`${API}/seleccionar-carpeta-origen`, { method: "POST" })
      const data = await res.json()
      if (data.ruta_origen) setRutaOrigen(data.ruta_origen)
    } catch {
      setError("No se pudo abrir el diálogo de carpeta origen")
    }
  }, [])

  const seleccionarCarpetaDestino = useCallback(async () => {
    setError(null)
    try {
      const res  = await fetch(`${API}/seleccionar-carpeta-destino`, { method: "POST" })
      const data = await res.json()
      if (data.ruta_destino) setRutaDestino(data.ruta_destino)
    } catch {
      setError("No se pudo abrir el diálogo de carpeta destino")
    }
  }, [])

  const procesar = useCallback(async () => {
    setProcesando(true)
    setResultado(null)
    setError(null)

    try {
      const res  = await fetch(`${API}/procesar`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Error al procesar")
      setResultado(data as ResultadoProcesamiento)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setProcesando(false)
    }
  }, [])

  return {
    rutaOrigen,  seleccionarCarpetaOrigen,
    rutaDestino, seleccionarCarpetaDestino,
    procesando,  procesar,
    puedeProcesar: !!rutaOrigen && !!rutaDestino,
    resultado,   error,
  }
}
