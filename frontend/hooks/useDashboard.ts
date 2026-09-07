/*
  Hook: useDashboard
  Carga las métricas del panel principal desde el backend.
  Se refresca cada vez que el componente monta.
*/

"use client"

import { useState, useEffect, useCallback } from "react"

const API = "http://localhost:8000/dashboard/resumen"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MetricasDiarias {
  confecciones_hoy:  number
  confecciones_ayer: number
  conf_pct:          number | null
  firmas_mes:        number
  firmas_mes_ant:    number
  firmas_pct:        number | null
  boveda_hoy:        number
  boveda_ayer:       number
  boveda_pct:        number | null
}

export interface TotalesMes {
  total:  number
  romero: number
  bdc:    number
}

export interface MetricasMensuales {
  actual:        TotalesMes
  anterior:      TotalesMes
  pct_total:     number | null
  pct_romero:    number | null
  pct_bdc:       number | null
  mes_anterior:  number
  anio_anterior: number
}

export interface PuntoGrafico {
  mes:   string
  num:   number
  total: number
}


export interface ResumenDashboard {
  diario:      MetricasDiarias
  mensual:     MetricasMensuales
  grafico:     PuntoGrafico[]
  notario_dia: string
  mes_actual:  number
  anio_actual: number
}

export interface ResultadoImportarOT {
  actualizados: number
  creados:      number
  omitidos:     number
  total_filas:  number
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDashboard() {
  const [resumen,         setResumen]         = useState<ResumenDashboard | null>(null)
  const [cargando,        setCargando]        = useState(true)
  const [error,           setError]           = useState<string | null>(null)
  const [importandoOT,    setImportandoOT]    = useState(false)
  const [resultadoOT,     setResultadoOT]     = useState<ResultadoImportarOT | null>(null)
  const [errorOT,         setErrorOT]         = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res  = await fetch(API)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al cargar el dashboard")
      setResumen(data as ResumenDashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setCargando(false)
    }
  }, [])

  // Sube el Excel 'Consulta OT' y actualiza numero_ot en vb_registro por repertorio
  const importarOT = useCallback(async (archivo: File): Promise<void> => {
    setImportandoOT(true)
    setErrorOT(null)
    setResultadoOT(null)
    try {
      const form = new FormData()
      form.append("archivo", archivo)
      const res  = await fetch("http://localhost:8000/dashboard/importar-ot", {
        method: "POST",
        body:   form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? "Error al importar OT")
      setResultadoOT(data as ResultadoImportarOT)
    } catch (e) {
      setErrorOT(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setImportandoOT(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return {
    resumen, cargando, error, recargar: cargar,
    importarOT, importandoOT, resultadoOT, errorOT,
  }
}
