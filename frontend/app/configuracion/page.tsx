"use client"

import { useState, useEffect } from "react"
import { AppShell }   from "@/components/dashboard/app-shell"
import SeccionUsuarios from "@/components/configuracion/SeccionUsuarios"
import SeccionNombres  from "@/components/configuracion/SeccionNombres"
import { useConfiguracion, type ConfiguracionData } from "@/hooks/useConfiguracion"
import { obtenerSesion } from "@/hooks/useAuth"
import {
  Settings, FileEdit, CheckSquare, FileSignature,
  Stamp, Archive, RotateCcw, Save, Lock,
} from "lucide-react"

// ── Field ─────────────────────────────────────────────────────────────────────

function ConfigField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm tabular-nums text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}

// ── SelectField ───────────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  opciones,
  disabled = false,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  opciones: string[]
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {value && !opciones.includes(value) && (
          <option value={value}>{value}</option>
        )}
        {opciones.length === 0 && !value && (
          <option value="">Cargando impresoras...</option>
        )}
        {opciones.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
    </div>
  )
}

// ── Module card ───────────────────────────────────────────────────────────────

function ModuleCard({
  icon: Icon,
  label,
  children,
}: {
  icon:     React.ElementType
  label:    string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[var(--accent)]" />
        </div>
        <p className="text-sm font-semibold text-[#111827]">{label}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const {
    configuracion, usuarios, impresoras, cargando, guardando, guardado, error,
    guardarConfiguracion, crearUsuario, editarUsuario, eliminarUsuario,
  } = useConfiguracion()

  const [cfg,     setCfg]     = useState<ConfiguracionData | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)

  // Sincroniza el estado local con el valor cargado del backend
  useEffect(() => {
    if (configuracion) setCfg({ ...configuracion })
  }, [configuracion])

  useEffect(() => {
    const sesion = obtenerSesion()
    setEsAdmin(sesion?.esAdmin ?? false)
  }, [])

  function set(campo: keyof ConfiguracionData) {
    return (v: string) => setCfg(prev => prev ? { ...prev, [campo]: v } : prev)
  }

  function handleReset() {
    if (configuracion) setCfg({ ...configuracion })
  }

  function handleGuardar() {
    if (cfg) guardarConfiguracion(cfg)
  }

  if (cargando || !cfg) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[#1565c0] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AppShell activeItem="Configuración">
      <div className="p-6">

          {/* Título */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Settings size={20} className="text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#111827]">Configuración</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">Rutas, parámetros y usuarios del sistema</p>
              </div>
            </div>
            {guardado && (
              <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Cambios guardados
              </span>
            )}
            {error && (
              <span className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-full px-4 py-1.5">
                {error}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-8">

            {/* ── SECCIÓN 1: Rutas del sistema (solo admin) ── */}
            {esAdmin ? (
              <div>
                <h2 className="text-base font-bold text-[#111827] mb-4">Rutas del sistema</h2>
                <div className="grid grid-cols-2 gap-4">

                  <ModuleCard icon={FileEdit} label="Redacción de Escrituras">
                    <ConfigField label="Carpeta escaneados" value={cfg.conf_escaneados ?? ""} onChange={set("conf_escaneados")} />
                  </ModuleCard>

                  <ModuleCard icon={CheckSquare} label="Revisión y Escrituras">
                    <ConfigField label="Carpeta base Escrituras" value={cfg.vb_carpeta ?? ""} onChange={set("vb_carpeta")} />
                    <ConfigField label="Carpeta salida planillas" value={cfg.vb_salida ?? ""} onChange={set("vb_salida")} />
                    <ConfigField label="IP de la impresora en red (ej: 192.168.1.100)" value={cfg.ip_impresora ?? ""} onChange={set("ip_impresora")} />
                    <SelectField
                      label="Impresora"
                      value={cfg.nombre_impresora ?? ""}
                      onChange={set("nombre_impresora")}
                      opciones={impresoras}
                    />
                  </ModuleCard>

                  <ModuleCard icon={FileSignature} label="Envío Firma Electrónica">
                    <ConfigField label="Carpeta escaneados" value={cfg.pre_escaneados ?? ""} onChange={set("pre_escaneados")} />
                    <ConfigField label="Ruta escáner de red (ej: \\\\Equipo\\Carpeta)" value={cfg.escaner_red ?? ""} onChange={set("escaner_red")} />
                    <ConfigField label="URL formulario interno" value={cfg.pre_url ?? ""} onChange={set("pre_url")} />
                  </ModuleCard>

                  <ModuleCard icon={Stamp} label="Postfirma">
                    <ConfigField label="Carpeta entrada (documentos firmados)" value={cfg.post_entrada ?? ""} onChange={set("post_entrada")} />
                    <ConfigField label="Carpeta salida" value={cfg.post_salida ?? ""} onChange={set("post_salida")} />
                    <ConfigField label="URL portal CBR" value={cfg.post_url ?? ""} onChange={set("post_url")} />
                  </ModuleCard>

                  <ModuleCard icon={Archive} label="Custodia de Documentos">
                    <ConfigField label="Carpeta custodia" value={cfg.vb_carpeta ?? ""} onChange={set("vb_carpeta")} disabled />
                    <p className="text-xs text-[#6B7280]">Usa la misma carpeta base que Revisión y Escrituras</p>
                  </ModuleCard>

                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex items-center gap-3 text-[#6B7280]">
                <Lock size={16} />
                <p className="text-sm">Las rutas del sistema solo pueden ser modificadas por el administrador.</p>
              </div>
            )}

            {/* ── SECCIÓN 2: Parámetros generales ── */}
            <div>
              <h2 className="text-base font-bold text-[#111827] mb-4">Parámetros generales</h2>
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <ConfigField
                    label="Notaría"
                    value={cfg.notaria ?? ""}
                    onChange={set("notaria")}
                    disabled={!esAdmin}
                  />
                  <ConfigField
                    label="Notario titular"
                    value={cfg.notario_titular ?? ""}
                    onChange={set("notario_titular")}
                    disabled={!esAdmin}
                  />
                  <ConfigField
                    label="Notario del día (aparece en el dashboard)"
                    value={cfg.notario_dia ?? ""}
                    onChange={set("notario_dia")}
                    disabled={!esAdmin}
                  />
                  <ConfigField
                    label="Valor por operación — Cobranza ($)"
                    value={String(cfg.valor_operacion)}
                    onChange={v => set("valor_operacion")(v)}
                    disabled={!esAdmin}
                  />
                  <ConfigField
                    label="Red interna (IP)"
                    value={cfg.red_interna ?? ""}
                    onChange={set("red_interna")}
                    disabled={!esAdmin}
                  />
                </div>
              </div>
            </div>

            {/* ── SECCIÓN 3: Nombres don/doña ── */}
            <SeccionNombres />

            {/* ── SECCIÓN 4: Usuarios (solo admin) ── */}
            {esAdmin && (
              <SeccionUsuarios
                usuarios={usuarios}
                onCrear={crearUsuario}
                onEditar={editarUsuario}
                onEliminar={eliminarUsuario}
              />
            )}

            {/* ── SECCIÓN 5: Acciones (solo admin) ── */}
            {esAdmin && (
              <div className="flex justify-end gap-3 pb-6">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 border-2 border-gray-200 hover:border-red-200 text-[#6B7280] hover:text-red-400 rounded-xl h-10 px-5 text-sm transition-all"
                >
                  <RotateCcw size={14} />
                  Descartar cambios
                </button>
                <button
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white rounded-xl h-10 px-6 text-sm font-semibold shadow-sm transition-colors"
                >
                  <Save size={14} />
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            )}

          </div>
      </div>
    </AppShell>
  )
}
