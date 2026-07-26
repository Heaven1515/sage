"use client"

import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { cerrarSesion } from "@/hooks/useAuth"
import {
  LayoutDashboard,
  FileEdit,
  CheckSquare,
  BookOpen,
  FileSignature,
  Stamp,
  Archive,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { label: "Panel de Control",              icon: LayoutDashboard, href: "/" },
  { label: "Redacción de Escrituras",       icon: FileEdit,        href: "/confecciones" },
  { label: "Registro",                      icon: CheckSquare,     href: "/vb" },
  { label: "Toma de Repertorios",           icon: BookOpen,        href: "/repertorios" },
  { label: "Envío Firma Electrónica",       icon: FileSignature,   href: "/prefirma" },
  { label: "Postfirma",                     icon: Stamp,           href: "/postfirma" },
  { label: "Custodia de Documentos",        icon: Archive,         href: "/boveda" },
]

interface SidebarProps {
  activeItem?: string
}

export function Sidebar({ activeItem = "Dashboard" }: SidebarProps) {
  const router = useRouter()

  function handleLogout() {
    cerrarSesion()
    router.replace("/login")
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40 overflow-hidden"
      style={{ background: "linear-gradient(to bottom, #1e6fd9 0%, #1565c0 30%, #0f3d8c 100%)" }}
    >
      {/* Logo */}
      <div className="px-5 py-6">
        <img
          src="/banco-de-chile-logo.png"
          alt="Banco de Chile"
          className="h-10 w-auto object-contain"
        />
      </div>

      <div className="mx-5 border-t border-white/10" />

      {/* Notaría info */}
      <div className="px-5 mt-4 mb-2">
        <p className="text-xs tracking-widest text-white font-bold uppercase mb-1">Alzamientos</p>
        <p className="text-white font-bold text-sm leading-snug">33 Notaría de Santiago</p>
        <p className="text-white font-bold text-xs mt-0.5 leading-snug">Carolina Elizabeth Piña Cuevas</p>
        <p className="text-white font-bold text-xs mt-0.5">Notario Interino</p>
      </div>

      <div className="mx-5 mt-4 border-t border-white/10" />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 mt-4 flex-1">
        {navItems.map(({ label, icon: Icon, href }) => {
          const isActive = activeItem === label
          return (
            <a
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl h-11 px-3 text-sm font-medium w-full transition-colors text-left",
                isActive
                  ? "bg-white text-[#0f2d6b] font-bold"
                  : "text-blue-100 hover:bg-white/10"
              )}
            >
              <Icon size={18} className={isActive ? "text-[#0f2d6b]" : "text-blue-300"} />
              {label}
            </a>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 mt-4">
        <div className="mx-2 mb-3 border-t border-white/10" />
        <a
          href="/configuracion"
          className={cn(
            "flex items-center gap-3 rounded-xl h-11 px-3 text-sm w-full transition-colors",
            activeItem === "Configuración"
              ? "bg-white text-[#0f2d6b] font-bold"
              : "text-blue-200 hover:bg-white/10"
          )}
        >
          <Settings size={18} className={activeItem === "Configuración" ? "text-[#0f2d6b]" : "text-blue-300"} />
          Configuración
        </a>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-xl h-11 px-3 text-sm w-full transition-colors hover:bg-white/10"
        >
          <LogOut size={18} className="text-[#f87171]" />
          <span className="text-[#f87171]">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
