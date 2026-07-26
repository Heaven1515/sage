"use client"

import { useEffect, useState } from "react"
import { Search, Calendar, User } from "lucide-react"
import { obtenerSesion, type SesionUsuario } from "@/hooks/useAuth"

export function Header() {
  const [sesion,   setSesion]   = useState<SesionUsuario | null>(null)
  const [fechaHoy, setFechaHoy] = useState("")

  useEffect(() => {
    setSesion(obtenerSesion())

    // Formatea la fecha actual en español
    const fecha = new Date()
    const texto = fecha.toLocaleDateString("es-CL", {
      weekday: "long",
      day:     "numeric",
      month:   "long",
      year:    "numeric",
    })
    // Primera letra mayúscula
    setFechaHoy(texto.charAt(0).toUpperCase() + texto.slice(1))
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 h-[72px] z-[15] flex items-center gap-4 pl-64 pr-6"
      style={{ background: "linear-gradient(to bottom, #1e6fd9 0%, #1565c0 30%, #0f3d8c 100%)" }}
    >
      {/* Búsqueda */}
      <div className="relative w-72">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
        <input
          type="text"
          placeholder="Buscar repertorio..."
          className="w-full bg-white/10 border border-white/20 rounded-full h-10 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      <div className="flex-1" />

      {/* Fecha actual */}
      <div className="flex items-center gap-2 bg-[#1a3a7a] border border-white/20 rounded-xl px-4 py-2">
        <Calendar size={15} className="text-white shrink-0" />
        <span className="text-white text-sm font-medium whitespace-nowrap">
          {fechaHoy}
        </span>
      </div>

      {/* Usuario activo */}
      <div className="flex items-center gap-2 bg-[#1a3a7a] border border-white/20 rounded-xl px-4 py-2">
        <User size={15} className="text-white shrink-0" />
        <div>
          <p className="text-white font-semibold text-sm leading-tight">
            {sesion?.nombre ?? "—"}
          </p>
          <p className="text-white/60 text-xs leading-tight">
            {sesion?.cargo ?? ""}
          </p>
        </div>
      </div>
    </header>
  )
}
