/*
  Hook: useConfecciones
  Controller del frontend para el módulo 01 — Confecciones de Borradores.

  Responsabilidades:
    - Subir el Excel del banco al backend
    - Extraer actividades únicas para mostrar en el selector
    - Filtrar localmente la lista del Excel actual (no toda la BD histórica)
    - Exponer estado de carga y errores a los componentes
*/

import { useState, useCallback, useEffect } from "react"

const URL_BASE = "http://localhost:8000/confecciones"

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ConfeccionItem {
  id: number
  numeroCarpeta: string
  rut: string
  nombreCliente: string
  actividadActual: string
  fechaEsperada: string | null
  fechaCarga: string
}

export interface ResultadoCarga {
  totalEnExcel: number
  insertados: number
  duplicados: number
  errores: number
}

// ── Persistencia en sessionStorage — sobrevive navegación entre módulos ──────

const SS_CONFECCIONES   = "sage_confecciones"
const SS_WFS_EXCEL      = "sage_confecciones_wfs"
const SS_ACTIVIDADES    = "sage_confecciones_actividades"
const SS_RESULTADO      = "sage_confecciones_resultado"

function leerSS<T>(clave: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function guardarSS<T>(clave: string, valor: T): void {
  try { sessionStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin espacio */ }
}

// ── Hook principal ───────────────────────────────────────────────────────────

export function useConfecciones() {
  const [confecciones, setConfecciones] = useState<ConfeccionItem[]>(() => leerSS(SS_CONFECCIONES, []))
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultadoCarga, setResultadoCarga] = useState<ResultadoCarga | null>(() => leerSS(SS_RESULTADO, null))

  // Actividades únicas disponibles en el Excel actual
  const [actividadesDisponibles, setActividadesDisponibles] = useState<string[]>(() => leerSS(SS_ACTIVIDADES, []))
  const [mostrarSelectorActividades, setMostrarSelectorActividades] = useState(false)

  // Lista completa del Excel actual — se filtra localmente al confirmar actividades
  const [wfsExcel, setWfsExcel] = useState<ConfeccionItem[]>(() => leerSS(SS_WFS_EXCEL, []))

  // ── Sincronizar estado → sessionStorage al cambiar ─────────────────────────
  useEffect(() => { guardarSS(SS_CONFECCIONES, confecciones) }, [confecciones])
  useEffect(() => { guardarSS(SS_WFS_EXCEL, wfsExcel) }, [wfsExcel])
  useEffect(() => { guardarSS(SS_ACTIVIDADES, actividadesDisponibles) }, [actividadesDisponibles])
  useEffect(() => { guardarSS(SS_RESULTADO, resultadoCarga) }, [resultadoCarga])

  // ── Mapea la respuesta del backend (snake_case) a camelCase del frontend ───
  function mapearItem(item: Record<string, unknown>): ConfeccionItem {
    return {
      id: item.id as number,
      numeroCarpeta: item.numero_carpeta as string,
      rut: item.rut as string,
      nombreCliente: item.nombre_cliente as string,
      actividadActual: item.actividad_actual as string,
      fechaEsperada: item.fecha_esperada as string | null,
      fechaCarga: item.fecha_carga as string,
    }
  }

  // ── Sube el Excel — usa los WFs retornados en la respuesta para el selector ──
  // No hace fetch adicional a la BD completa: solo muestra lo del Excel actual
  const subirExcel = useCallback(async (archivo: File): Promise<void> => {
    setCargando(true)
    setError(null)
    setResultadoCarga(null)

    try {
      const formulario = new FormData()
      formulario.append("archivo", archivo)

      const respuesta = await fetch(`${URL_BASE}/subir-excel`, {
        method: "POST",
        body: formulario,
      })

      if (!respuesta.ok) {
        const detalle = await respuesta.json()
        throw new Error(detalle.detail ?? "Error al subir el archivo")
      }

      const resultado = await respuesta.json()
      setResultadoCarga({
        totalEnExcel: resultado.total_en_excel,
        insertados:   resultado.insertados,
        duplicados:   resultado.duplicados,
        errores:      resultado.errores,
      })

      // Usar directamente los WFs del Excel (no traer toda la BD)
      const wfs = (resultado.wfs_excel as Record<string, unknown>[]).map(mapearItem)
      setWfsExcel(wfs)

      const actividades = [
        ...new Set<string>(wfs.map((i) => i.actividadActual)),
      ].sort()
      setActividadesDisponibles(actividades)
      setMostrarSelectorActividades(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido al subir el Excel")
    } finally {
      setCargando(false)
    }
  }, [])

  // ── Confirma las actividades elegidas — filtra y ordena por fecha esperada ──
  const confirmarActividades = useCallback((seleccionadas: string[]): void => {
    setMostrarSelectorActividades(false)
    const filtradas = seleccionadas.length > 0
      ? wfsExcel.filter((item) => seleccionadas.includes(item.actividadActual))
      : wfsExcel
    // Ordena por fecha esperada: más próxima primero, sin fecha al final
    const ordenadas = [...filtradas].sort((a, b) => {
      if (!a.fechaEsperada && !b.fechaEsperada) return 0
      if (!a.fechaEsperada) return 1
      if (!b.fechaEsperada) return -1
      return new Date(a.fechaEsperada).getTime() - new Date(b.fechaEsperada).getTime()
    })
    setConfecciones(ordenadas)
  }, [wfsExcel])

  // ── Cierra el selector sin aplicar filtro ────────────────────────────────
  const cerrarSelector = useCallback(() => {
    setMostrarSelectorActividades(false)
  }, [])

  // ── Borra la lista de pantalla sin tocar la BD ───────────────────────────
  const limpiarLista = useCallback(() => {
    setConfecciones([])
    setWfsExcel([])
    setResultadoCarga(null)
    setError(null)
    setActividadesDisponibles([])
    // Limpiar sessionStorage para que no reaparezca al volver
    sessionStorage.removeItem(SS_CONFECCIONES)
    sessionStorage.removeItem(SS_WFS_EXCEL)
    sessionStorage.removeItem(SS_ACTIVIDADES)
    sessionStorage.removeItem(SS_RESULTADO)
    sessionStorage.removeItem("sage_confecciones_copias")
  }, [])

  // ── Copia el N° Carpeta (WF) al portapapeles ──────────────────────────────
  const copiarWf = useCallback(async (numeroCarpeta: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(numeroCarpeta)
      return true
    } catch {
      setError("No se pudo copiar al portapapeles")
      return false
    }
  }, [])

  return {
    confecciones,
    cargando,
    error,
    resultadoCarga,
    actividadesDisponibles,
    mostrarSelectorActividades,
    subirExcel,
    confirmarActividades,
    cerrarSelector,
    limpiarLista,
    copiarWf,
  }
}
