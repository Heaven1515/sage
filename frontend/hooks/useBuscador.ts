"use client"

import { useCallback, useState } from "react"

const API = "http://localhost:8000/dashboard/buscar"

export interface ResultadoBusqueda {
  encontrado:        boolean
  repertorio:        string
  wf?:               string
  nombre_cliente?:   string
  rut?:              string
  comuna?:           string
  materia?:          string
  anio?:             number
  fecha_escritura?:  string
  firma_electronica?: string
  numero_caratula?:  string
  es_santiago?:      boolean
  en_boveda?:        boolean
  boveda_fecha?:     string
  boveda_entrega?:   number
  es_reingreso?:     boolean
  error?:            string
}

export function useBuscador() {
  const [resultado,  setResultado]  = useState<ResultadoBusqueda | null>(null)
  const [buscando,   setBuscando]   = useState(false)
  const [abierto,    setAbierto]    = useState(false)

  const buscar = useCallback(async (q: string) => {
    const termino = q.trim()
    if (!termino) return

    setBuscando(true)
    setAbierto(true)
    setResultado(null)

    try {
      const res = await fetch(`${API}?q=${encodeURIComponent(termino)}`)
      const datos: ResultadoBusqueda = await res.json()
      setResultado(datos)
    } catch {
      setResultado({ encontrado: false, repertorio: termino, error: "Error de conexión" })
    } finally {
      setBuscando(false)
    }
  }, [])

  const cerrar = useCallback(() => {
    setAbierto(false)
    setResultado(null)
  }, [])

  return { resultado, buscando, abierto, buscar, cerrar }
}
