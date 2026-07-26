"use client"

import { useState, useEffect, useRef } from "react"
import { BookUser, Plus, Trash2, Search } from "lucide-react"
const API = "http://localhost:8000"

interface Nombre {
  nombre: string
  genero: "M" | "F"
}

export default function SeccionNombres() {
  const [nombres,    setNombres]    = useState<Nombre[]>([])
  const [filtro,     setFiltro]     = useState("")
  const [nuevo,      setNuevo]      = useState("")
  const [genero,     setGenero]     = useState<"M" | "F">("M")
  const [guardando,  setGuardando]  = useState(false)
  const [error,      setError]      = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    try {
      const res = await fetch(`${API}/configuracion/nombres`)
      if (res.ok) setNombres(await res.json())
    } catch {}
  }

  async function handleAgregar() {
    const nombre = nuevo.trim()
    if (!nombre) return
    setGuardando(true)
    setError("")
    try {
      const res = await fetch(`${API}/configuracion/nombres`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, genero }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail ?? "Error al agregar nombre")
      } else {
        setNuevo("")
        inputRef.current?.focus()
        await cargar()
      }
    } catch {
      setError("Sin conexión con el servidor")
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(nombre: string) {
    try {
      await fetch(`${API}/configuracion/nombres/${encodeURIComponent(nombre)}`, {
        method: "DELETE",
      })
      await cargar()
    } catch {}
  }

  const filtrados = filtro.trim()
    ? nombres.filter(n => n.nombre.includes(filtro.toLowerCase().trim()))
    : nombres

  return (
    <div>
      <h2 className="text-base font-bold text-[#111827] mb-4">Base de datos de nombres</h2>
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col gap-4">

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            <BookUser size={16} className="text-[var(--accent)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Nombres registrados</p>
            <p className="text-xs text-[#6B7280]">
              Se usan para detectar automáticamente don/doña al formatear escrituras.
            </p>
          </div>
        </div>

        {/* Agregar nuevo */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-1">
              Primer nombre
            </label>
            <input
              ref={inputRef}
              type="text"
              value={nuevo}
              onChange={e => { setNuevo(e.target.value); setError("") }}
              onKeyDown={e => e.key === "Enter" && handleAgregar()}
              placeholder="ej: Cyntia"
              className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg px-3 h-9 text-sm tabular-nums text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B7280] font-medium uppercase tracking-wider mb-1">
              Género
            </label>
            <div className="flex h-9 rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setGenero("M")}
                className={`px-4 text-sm font-semibold transition-colors ${
                  genero === "M"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[#F4F6F8] text-[#6B7280] hover:bg-gray-100"
                }`}
              >
                don
              </button>
              <button
                onClick={() => setGenero("F")}
                className={`px-4 text-sm font-semibold transition-colors ${
                  genero === "F"
                    ? "bg-pink-500 text-white"
                    : "bg-[#F4F6F8] text-[#6B7280] hover:bg-gray-100"
                }`}
              >
                doña
              </button>
            </div>
          </div>
          <button
            onClick={handleAgregar}
            disabled={guardando || !nuevo.trim()}
            className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white rounded-lg h-9 px-4 text-sm font-semibold transition-colors"
          >
            <Plus size={14} />
            {guardando ? "Agregando…" : "Agregar"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Buscador */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar nombre…"
            className="w-full bg-[#F4F6F8] border border-gray-200 rounded-lg pl-8 pr-3 h-8 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] focus:border-[var(--accent)]/40 transition-all"
          />
        </div>

        {/* Lista */}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
          {filtrados.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-6">Sin resultados</p>
          ) : (
            filtrados.map(n => (
              <div key={n.nombre} className="flex items-center justify-between px-3 py-2 hover:bg-[#F9FAFB] group">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      n.genero === "M"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-pink-50 text-pink-500"
                    }`}
                  >
                    {n.genero === "M" ? "don" : "doña"}
                  </span>
                  <span className="text-sm tabular-nums text-[#111827]">{n.nombre}</span>
                </div>
                <button
                  onClick={() => handleEliminar(n.nombre)}
                  className="opacity-0 group-hover:opacity-100 text-[#D1D5DB] hover:text-red-400 transition-all"
                  title="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-[#9CA3AF]">
          {nombres.length} nombres registrados · Los cambios se aplican inmediatamente al formatear.
        </p>
      </div>
    </div>
  )
}
