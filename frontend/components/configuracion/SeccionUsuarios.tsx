"use client"

/*
  Componente: SeccionUsuarios
  Muestra la lista de usuarios del sistema y permite agregar, editar y eliminar.
  Solo visible para el usuario administrador (Jespina).
*/

import { useState } from "react"
import { UserPlus, Pencil, Trash2, Shield, ShieldOff, X, Check } from "lucide-react"
import type { UsuarioItem, CrearUsuarioDatos } from "@/hooks/useConfiguracion"

interface Props {
  usuarios:       UsuarioItem[]
  onCrear:        (datos: CrearUsuarioDatos) => Promise<void>
  onEditar:       (id: number, datos: Partial<CrearUsuarioDatos & { activo: boolean }>) => Promise<void>
  onEliminar:     (id: number) => Promise<void>
}

// ── Formulario vacío ──────────────────────────────────────────────────────────

const FORM_VACIO: CrearUsuarioDatos & { contrasena_antigua: string } = {
  nombre:            "",
  usuario:           "",
  cargo:             "",
  contrasena:        "",
  contrasena_antigua: "",
  es_admin:          false,
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SeccionUsuarios({ usuarios, onCrear, onEditar, onEliminar }: Props) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [editandoId,        setEditandoId]        = useState<number | null>(null)
  const [form,              setForm]              = useState<CrearUsuarioDatos & { contrasena_antigua: string }>(FORM_VACIO)
  const [guardando,         setGuardando]         = useState(false)
  const [errorForm,         setErrorForm]         = useState<string | null>(null)

  function set(campo: keyof CrearUsuarioDatos) {
    return (valor: string | boolean) =>
      setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function abrirNuevo() {
    setForm(FORM_VACIO)
    setEditandoId(null)
    setErrorForm(null)
    setMostrarFormulario(true)
  }

  function abrirEditar(u: UsuarioItem) {
    setForm({ nombre: u.nombre, usuario: u.usuario, cargo: u.cargo, contrasena: "", contrasena_antigua: "", es_admin: u.es_admin })
    setEditandoId(u.id)
    setErrorForm(null)
    setMostrarFormulario(true)
  }

  function cancelar() {
    setMostrarFormulario(false)
    setEditandoId(null)
    setForm(FORM_VACIO)
    setErrorForm(null)
  }

  async function handleGuardar() {
    if (!form.nombre.trim() || !form.usuario.trim() || !form.cargo.trim()) {
      setErrorForm("Nombre, usuario y cargo son obligatorios.")
      return
    }
    setGuardando(true)
    setErrorForm(null)
    try {
      if (editandoId !== null) {
        const datos: Parameters<typeof onEditar>[1] = {
          nombre: form.nombre,
          cargo:  form.cargo,
        }
        // Solo envía contraseña si se escribió algo (vacío = no tocar)
        if (form.contrasena !== "") {
          datos.contrasena         = form.contrasena
          datos.contrasena_antigua = form.contrasena_antigua
        }
        await onEditar(editandoId, datos)
      } else {
        await onCrear(form)
      }
      cancelar()
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "Error al guardar")
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: number, nombre: string) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await onEliminar(id)
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al eliminar")
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#111827]">Usuarios del sistema</h2>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl h-9 px-4 text-sm font-semibold transition-colors"
        >
          <UserPlus size={14} />
          Agregar usuario
        </button>
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F6F8]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Usuario</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Cargo</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Rol</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Estado</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <tr
                key={u.id}
                className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#F4F6F8]/40"}`}
              >
                <td className="px-4 py-3 font-medium text-[#111827]">{u.nombre}</td>
                <td className="px-4 py-3 tabular-nums text-[var(--accent)]">{u.usuario}</td>
                <td className="px-4 py-3 text-[#6B7280]">{u.cargo}</td>
                <td className="px-4 py-3 text-center">
                  {u.es_admin ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-[var(--accent)] border border-blue-100 rounded-full px-2 py-0.5 font-medium">
                      <Shield size={10} /> Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-[#6B7280] border border-gray-200 rounded-full px-2 py-0.5">
                      <ShieldOff size={10} /> Usuario
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${u.activo ? "bg-green-500" : "bg-gray-300"}`} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => abrirEditar(u)}
                      className="text-[#6B7280] hover:text-[var(--accent)] transition-colors"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    {u.usuario !== "Jespina" && (
                      <button
                        onClick={() => handleEliminar(u.id, u.nombre)}
                        className="text-[#6B7280] hover:text-red-500 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulario agregar/editar */}
      {mostrarFormulario && (
        <div className="mt-4 bg-white border border-[var(--accent)]/20 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[#111827]">
              {editandoId !== null ? "Editar usuario" : "Nuevo usuario"}
            </p>
            <button onClick={cancelar} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => set("nombre")(e.target.value)}
                placeholder="Ej: Ana García López"
                className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                Usuario (login)
              </label>
              <input
                type="text"
                value={form.usuario}
                onChange={e => set("usuario")(e.target.value)}
                placeholder="Ej: AGarcia"
                disabled={editandoId !== null}
                className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                Cargo / Motivo
              </label>
              <input
                type="text"
                value={form.cargo}
                onChange={e => set("cargo")(e.target.value)}
                placeholder="Ej: Reemplazo — Vacaciones Diciembre"
                className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                {editandoId !== null ? "Nueva contraseña" : "Contraseña"}
                {editandoId !== null && <span className="normal-case font-normal text-gray-400 ml-1">(vacío = no cambiar)</span>}
              </label>
              <input
                type="password"
                value={form.contrasena}
                onChange={e => set("contrasena")(e.target.value)}
                placeholder={editandoId !== null ? "Dejar vacío para no cambiar" : "Contraseña (opcional)"}
                className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40"
              />
            </div>

            {/* Campo contraseña antigua — visible solo al editar y si escribió nueva contraseña */}
            {editandoId !== null && form.contrasena !== "" && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-1">
                  Contraseña actual <span className="normal-case font-normal text-red-400">(requerida para confirmar el cambio)</span>
                </label>
                <input
                  type="password"
                  value={form.contrasena_antigua}
                  onChange={e => set("contrasena_antigua")(e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40"
                  autoFocus
                />
              </div>
            )}
          </div>

          {errorForm && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorForm}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={cancelar}
              className="border border-gray-200 text-[#6B7280] hover:border-gray-300 rounded-xl h-9 px-4 text-sm transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-60 text-white rounded-xl h-9 px-5 text-sm font-semibold transition-colors"
            >
              <Check size={14} />
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
