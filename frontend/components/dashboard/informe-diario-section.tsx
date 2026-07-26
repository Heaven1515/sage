"use client"

/*
  InformeDiarioSection — tabla con todas las operaciones de Prefirma del día.
  Fuente: prefirma_log (estado=ok, fecha=hoy) + join vb_registro + carátula para Santiago.
*/

import { useState, useEffect, useCallback } from "react"
import { FileDown, RefreshCw, Loader2, Trash2, Mail, Upload, X, Send } from "lucide-react"

const API          = "http://localhost:8000/dashboard"
const API_PREFIRMA = "http://localhost:8000/prefirma"

/* Asunto por defecto para el correo del informe diario */
function asuntoPorDefecto(fecha: string): string {
  const partes = fecha.split("-").reverse().join("/")
  return `Informe Diario de Operaciones — ${partes}`
}

/* Cuerpo por defecto para el correo del informe diario */
function cuerpoPorDefecto(fecha: string, total: number): string {
  const partes = fecha.split("-").reverse().join("/")
  return `Estimado/a,\n\nAdjunto el informe diario de operaciones correspondiente al ${partes}.\nTotal de operaciones: ${total}.\n\nSaludos cordiales,\n33ª Notaría de Santiago`
}

interface OperacionDiaria {
  repertorio:      string | null
  anho:            string | null
  tipo_contrato:   string | null
  nombre_cliente:  string | null
  rut:             string | null
  comuna:          string | null
  wf:              string | null
  numero_caratula: string | null
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function InformeDiarioSection() {
  const [items,       setItems]       = useState<OperacionDiaria[]>([])
  const [cargando,    setCargando]    = useState(true)
  const [descargando, setDescargando] = useState(false)
  const [limpiando,   setLimpiando]   = useState(false)
  const [confirmar,   setConfirmar]   = useState(false)
  const [fechaSel,    setFechaSel]    = useState(hoyISO)

  /* Estado del modal de correo */
  const [modalCorreo,    setModalCorreo]    = useState(false)
  const [destinatario,   setDestinatario]   = useState("")
  const [asuntoCorreo,   setAsuntoCorreo]   = useState("")
  const [cuerpoCorreo,   setCuerpoCorreo]   = useState("")
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)
  const [msgCorreo,      setMsgCorreo]      = useState<{ ok: boolean; texto: string } | null>(null)

  /* Estado de subida a Drive (2 pasos: seleccionar → confirmar) */
  const [subiendoDrive,   setSubiendoDrive]   = useState(false)
  const [msgDrive,        setMsgDrive]        = useState<{ ok: boolean; texto: string } | null>(null)
  const [carpetaDrive,    setCarpetaDrive]    = useState<{ ruta: string; total: number } | null>(null)
  const [seleccionando,   setSeleccionando]   = useState(false)
  const [progresoDrive,   setProgresoDrive]   = useState<{ actual: number; total: number; archivo: string } | null>(null)

  /* Datos editados: null = sin cambios (usa items original) */
  const [editados, setEditados] = useState<OperacionDiaria[] | null>(null)
  const datosActuales = editados ?? items

  const editarCampo = (indice: number, campo: keyof OperacionDiaria, valor: string) => {
    const copia = [...(editados ?? items.map(i => ({ ...i })))]
    ;(copia[indice] as any)[campo] = valor
    setEditados(copia)
  }

  const cargar = useCallback(async (fecha: string) => {
    setCargando(true)
    try {
      const res  = await fetch(`${API}/informe-diario?fecha=${fecha}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setEditados(null)
    } catch {
      setItems([])
      setEditados(null)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(fechaSel) }, [cargar, fechaSel])

  const limpiarHoy = async () => {
    setLimpiando(true)
    setConfirmar(false)
    try {
      await fetch(`${API_PREFIRMA}/logs/hoy`, { method: "DELETE" })
      await cargar(fechaSel)
    } finally {
      setLimpiando(false)
    }
  }

  const descargarExcel = async () => {
    setDescargando(true)
    try {
      /* Si hay datos editados, enviarlos por POST; si no, GET normal */
      let res: globalThis.Response
      if (editados) {
        res = await fetch(`${API}/informe-diario/excel-editado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fecha: fechaSel, items: editados }),
        })
      } else {
        res = await fetch(`${API}/informe-diario/excel?fecha=${fechaSel}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url
      a.download = `OPERACIONES_${fechaSel.split("-").reverse().join("-")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDescargando(false)
    }
  }

  /* Abrir modal de correo con valores por defecto */
  const abrirModalCorreo = () => {
    setAsuntoCorreo(asuntoPorDefecto(fechaSel))
    setCuerpoCorreo(cuerpoPorDefecto(fechaSel, datosActuales.length))
    setMsgCorreo(null)
    setModalCorreo(true)
  }

  /* Enviar correo con el informe adjunto */
  const enviarCorreo = async () => {
    if (!destinatario.trim()) return
    setEnviandoCorreo(true)
    setMsgCorreo(null)
    try {
      const res  = await fetch(`${API}/informe-diario/enviar-correo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: destinatario.trim(),
          asunto: asuntoCorreo,
          cuerpo: cuerpoCorreo,
          fecha: fechaSel,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgCorreo({ ok: true, texto: `Correo enviado a ${destinatario.trim()}` })
      } else {
        const msg = data.error || data.detail || "Error al enviar"
        setMsgCorreo({ ok: false, texto: typeof msg === "string" ? msg : JSON.stringify(msg) })
      }
    } catch (err) {
      setMsgCorreo({ ok: false, texto: "Error de conexión con el servidor" })
    } finally {
      setEnviandoCorreo(false)
    }
  }

  /* Flujo Drive: seleccionar carpeta → confirmar → subir con polling de progreso */
  const iniciarSubidaDrive = async () => {
    setSeleccionando(true)
    setMsgDrive(null)
    setCarpetaDrive(null)
    setProgresoDrive(null)
    try {
      /* Paso 1: abrir diálogo nativo y obtener ruta + total */
      const res1 = await fetch(`${API}/informe-diario/seleccionar-carpeta-drive`, { method: "POST" })
      const data1 = await res1.json()
      if (data1.cancelado) return
      if (!data1.ok) {
        setMsgDrive({ ok: false, texto: String(data1.error || "Error al seleccionar carpeta") })
        return
      }
      if (data1.total === 0) {
        setMsgDrive({ ok: false, texto: "La carpeta seleccionada está vacía" })
        return
      }

      /* Paso 2: confirmar con el usuario */
      const confirma = window.confirm(
        `La carpeta contiene ${data1.total} archivo(s).\n\n${data1.ruta}\n\n¿Subir a Google Drive?`
      )
      if (!confirma) return

      /* Paso 3: iniciar subida y hacer polling del progreso */
      setSubiendoDrive(true)
      setProgresoDrive({ actual: 0, total: data1.total, archivo: "" })

      const res2 = await fetch(`${API}/informe-diario/subir-drive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruta: data1.ruta }),
      })
      const data2 = await res2.json()
      if (!data2.ok) {
        setMsgDrive({ ok: false, texto: String(data2.error || "Error al iniciar subida") })
        return
      }

      /* Polling cada 500ms hasta que termine */
      const poll = async () => {
        while (true) {
          await new Promise(r => setTimeout(r, 500))
          try {
            const res = await fetch(`${API}/informe-diario/progreso-drive`)
            const p = await res.json()
            if (p.terminado) {
              if (p.error) {
                setMsgDrive({ ok: false, texto: String(p.error) })
              } else {
                setMsgDrive({ ok: true, texto: `${p.subidos} de ${p.total} archivo(s) subido(s) a Drive` })
              }
              break
            }
            setProgresoDrive({ actual: p.actual, total: p.total, archivo: p.archivo })
          } catch {
            setMsgDrive({ ok: false, texto: "Error consultando progreso" })
            break
          }
        }
      }
      await poll()
    } catch {
      setMsgDrive({ ok: false, texto: "Error de conexión con el servidor" })
    } finally {
      setSeleccionando(false)
      setSubiendoDrive(false)
      setCarpetaDrive(null)
      setProgresoDrive(null)
    }
  }

  const fechaLabel = new Date(fechaSel + "T12:00:00").toLocaleDateString("es-CL", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  })

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">

      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-[#111827]">Informe Diario de Operaciones</h2>
          <p className="text-sm text-[#6B7280] mt-0.5 capitalize">{fechaLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fechaSel}
            max={hoyISO()}
            onChange={e => setFechaSel(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-[#374151] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
          />
          <span className="text-xs text-[#6B7280] bg-[#F4F6F8] border border-gray-200 rounded-full px-3 py-1 font-medium">
            {cargando ? "…" : `${datosActuales.length} operación${datosActuales.length !== 1 ? "es" : ""}`}
          </span>
          {editados && (
            <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 font-medium">
              editado
            </span>
          )}
          <button
            onClick={() => cargar(fechaSel)}
            disabled={cargando}
            title="Recargar"
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F4F6F8] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          </button>

          {/* Botón limpiar — pide confirmación */}
          {!confirmar ? (
            <button
              onClick={() => setConfirmar(true)}
              disabled={limpiando || cargando || datosActuales.length === 0}
              title="Limpiar historial de hoy"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6F8] border border-gray-200 text-[#6B7280] text-xs font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={12} /> Limpiar hoy
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-600 font-semibold">¿Confirmar?</span>
              <button
                onClick={limpiarHoy}
                disabled={limpiando}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-40"
              >
                {limpiando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                Sí, borrar
              </button>
              <button
                onClick={() => setConfirmar(false)}
                className="px-2.5 py-1.5 rounded-lg bg-[#F4F6F8] border border-gray-200 text-[#6B7280] text-xs font-semibold hover:bg-[#E5E7EB] transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          <button
            onClick={descargarExcel}
            disabled={descargando || cargando || datosActuales.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {descargando
              ? <><Loader2 size={12} className="animate-spin" /> Exportando…</>
              : <><FileDown size={12} /> Exportar Excel</>
            }
          </button>

          {/* Enviar correo */}
          <button
            onClick={abrirModalCorreo}
            disabled={cargando || datosActuales.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6F8] border border-gray-200 text-[#374151] text-xs font-semibold hover:bg-blue-50 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Mail size={12} /> Enviar correo
          </button>

          {/* Subir a Drive — abre diálogo nativo de carpeta */}
          <button
            onClick={iniciarSubidaDrive}
            disabled={seleccionando || subiendoDrive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F4F6F8] border border-gray-200 text-[#374151] text-xs font-semibold hover:bg-green-50 hover:border-green-500 hover:text-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {seleccionando
              ? <><Loader2 size={12} className="animate-spin" /> Seleccionando…</>
              : subiendoDrive && progresoDrive
              ? <><Loader2 size={12} className="animate-spin" /> Subiendo {progresoDrive.actual} de {progresoDrive.total}…</>
              : subiendoDrive
              ? <><Loader2 size={12} className="animate-spin" /> Subiendo…</>
              : <><Upload size={12} /> Subir a Drive</>
            }
          </button>
        </div>

        {/* Mensajes de estado Drive */}
        {msgDrive && (
          <div className={`mt-2 text-xs font-medium px-3 py-1.5 rounded-lg ${
            msgDrive.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}>
            {msgDrive.texto}
          </div>
        )}
      </div>

      {/* Estado de carga */}
      {cargando && (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="text-[var(--accent)] animate-spin" />
        </div>
      )}

      {/* Sin operaciones */}
      {!cargando && datosActuales.length === 0 && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-[#9CA3AF]">No hay operaciones de Prefirma registradas hoy</p>
        </div>
      )}

      {/* Tabla */}
      {!cargando && datosActuales.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#F4F6F8]">
                {["N° Rep.", "Año", "Materia", "Cliente", "RUT", "Comuna", "WF", "N° Carátula"].map(h => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider px-3 py-2 border-b border-gray-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datosActuales.map((op, i) => {
                const esSantiago = (op.comuna || "").toUpperCase() === "SANTIAGO"
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <CeldaEditable valor={op.repertorio} mono onChange={v => editarCampo(i, "repertorio", v)} />
                    <CeldaEditable valor={op.anho} centro onChange={v => editarCampo(i, "anho", v)} />
                    <CeldaEditable valor={op.tipo_contrato} onChange={v => editarCampo(i, "tipo_contrato", v)} />
                    <CeldaEditable valor={op.nombre_cliente} negrita onChange={v => editarCampo(i, "nombre_cliente", v)} />
                    <CeldaEditable valor={op.rut} mono onChange={v => editarCampo(i, "rut", v)} />
                    <CeldaEditable valor={op.comuna} onChange={v => editarCampo(i, "comuna", v)} badge={esSantiago ? "blue" : "gray"} />
                    <CeldaEditable valor={op.wf} mono onChange={v => editarCampo(i, "wf", v)} />
                    <td className="px-3 py-2 border-b border-gray-100 whitespace-nowrap">
                      {esSantiago && op.numero_caratula ? (
                        <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          {op.numero_caratula}
                        </span>
                      ) : esSantiago ? (
                        <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Sin carátula</span>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal de correo ───────────────────────────────────────────── */}
      {modalCorreo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <Mail size={16} className="text-[var(--accent)]" /> Enviar informe por correo
              </h3>
              <button
                onClick={() => setModalCorreo(false)}
                className="p-1 rounded-lg text-[#6B7280] hover:bg-[#F4F6F8] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Destinatario */}
            <label className="block text-xs font-semibold text-[#374151] mb-1">Destinatario</label>
            <input
              type="email"
              value={destinatario}
              onChange={e => setDestinatario(e.target.value)}
              placeholder="correo@ejemplo.cl"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] mb-3"
            />

            {/* Asunto */}
            <label className="block text-xs font-semibold text-[#374151] mb-1">Asunto</label>
            <input
              type="text"
              value={asuntoCorreo}
              onChange={e => setAsuntoCorreo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] mb-3"
            />

            {/* Cuerpo */}
            <label className="block text-xs font-semibold text-[#374151] mb-1">Mensaje</label>
            <textarea
              value={cuerpoCorreo}
              onChange={e => setCuerpoCorreo(e.target.value)}
              rows={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)] mb-3 resize-y"
            />

            {/* Nota: adjunto automático */}
            <p className="text-xs text-[#6B7280] mb-4">
              Se adjuntará automáticamente el Excel del informe diario ({fechaSel.split("-").reverse().join("/")}).
            </p>

            {/* Mensaje de estado */}
            {msgCorreo && (
              <div className={`text-xs font-medium px-3 py-2 rounded-lg mb-3 ${
                msgCorreo.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
              }`}>
                {msgCorreo.texto}
              </div>
            )}

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModalCorreo(false)}
                className="px-4 py-2 rounded-lg bg-[#F4F6F8] border border-gray-200 text-[#6B7280] text-xs font-semibold hover:bg-[#E5E7EB] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={enviarCorreo}
                disabled={enviandoCorreo || !destinatario.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enviandoCorreo
                  ? <><Loader2 size={12} className="animate-spin" /> Enviando…</>
                  : <><Send size={12} /> Enviar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Celda editable inline ───────────────────────────────────────────────────

function CeldaEditable({
  valor,
  onChange,
  mono = false,
  negrita = false,
  centro = false,
  badge,
}: {
  valor: string | null
  onChange: (v: string) => void
  mono?: boolean
  negrita?: boolean
  centro?: boolean
  badge?: "blue" | "gray"
}) {
  const [editando, setEditando] = useState(false)
  const [tmp, setTmp] = useState(valor || "")

  const iniciar = () => {
    setTmp(valor || "")
    setEditando(true)
  }

  const confirmar = () => {
    setEditando(false)
    if (tmp !== (valor || "")) onChange(tmp)
  }

  if (editando) {
    return (
      <td className="px-1 py-1 border-b border-gray-100">
        <input
          autoFocus
          value={tmp}
          onChange={e => setTmp(e.target.value)}
          onBlur={confirmar}
          onKeyDown={e => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false) }}
          className={`w-full px-2 py-1 text-sm border border-[var(--accent)] rounded bg-blue-50 focus:outline-none ${mono ? "tabular-nums" : ""}`}
        />
      </td>
    )
  }

  const textCls = [
    "px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
    mono ? "tabular-nums" : "",
    negrita ? "font-medium text-[#111827]" : "text-[#374151]",
    centro ? "text-center" : "",
  ].join(" ")

  if (badge) {
    const badgeCls = badge === "blue"
      ? "bg-blue-50 text-[var(--accent)]"
      : "bg-[#F4F6F8] text-[#6B7280]"
    return (
      <td className={textCls} onClick={iniciar}>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>
          {valor || "—"}
        </span>
      </td>
    )
  }

  return (
    <td className={textCls} onClick={iniciar} title={valor || ""}>
      {valor || "—"}
    </td>
  )
}
