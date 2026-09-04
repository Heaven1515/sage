"use client"

import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { cerrarSesion, obtenerSesion, type SesionUsuario } from "@/hooks/useAuth"
import Link from "next/link"
import { Search, Calendar, Clock, User, LayoutDashboard, FileEdit, CheckSquare, BookOpen, FileSignature, Stamp, Archive, Settings, LogOut } from "lucide-react"
import { useBuscador } from "@/hooks/useBuscador"
import { BuscadorModal } from "@/components/dashboard/BuscadorModal"
import { TitleBar } from "@/components/dashboard/TitleBar"

const navItems = [
  { label: "Panel de Control",              icon: LayoutDashboard, href: "/" },
  { label: "Redacción de Escrituras",       icon: FileEdit,        href: "/confecciones" },
  { label: "Registro",                      icon: CheckSquare,     href: "/vb" },
  { label: "Toma de Repertorios",           icon: BookOpen,        href: "/repertorios" },
  { label: "Renombrado para Firma",          icon: FileSignature,   href: "/prefirma" },
  { label: "Postfirma",                     icon: Stamp,           href: "/postfirma" },
  { label: "Custodia de Documentos",        icon: Archive,         href: "/boveda" },
]

type TemaId = "azul-oscuro" | "azul-claro" | "negro"

const TEMAS: Record<TemaId, {
  gradient:    string
  captionColor:string   // color sólido para la barra DWM de Windows
  activeText:  string
  dot:         string
  label:       string
  accent:      string
  accentHover: string
}> = {
  "azul-oscuro": {
    gradient:     "linear-gradient(to bottom, #1a3a7a 0%, #0f2d6b 50%, #091f4f 100%)",
    captionColor: "#1a3a7a",
    activeText:   "#0f2d6b",
    dot:          "#0f2d6b",
    label:        "Azul oscuro",
    accent:       "#1565c0",
    accentHover:  "#1250a3",
  },
  "azul-claro": {
    gradient:     "linear-gradient(to bottom, #4a9edd 0%, #2a7bbf 40%, #1560a8 100%)",
    captionColor: "#4a9edd",
    activeText:   "#1560a8",
    dot:          "#2a7bbf",
    label:        "Azul claro",
    accent:       "#2a7bbf",
    accentHover:  "#1560a8",
  },
  "negro": {
    gradient:     "linear-gradient(to bottom, #2c2c2e 0%, #1c1c1e 40%, #0a0a0a 100%)",
    captionColor: "#2c2c2e",
    activeText:   "#111827",
    dot:          "#1c1c1e",
    label:        "Negro",
    accent:       "#374151",
    accentHover:  "#1f2937",
  },
}

function getTema(): TemaId {
  if (typeof window === "undefined") return "azul-oscuro"
  return (localStorage.getItem("sage-tema") as TemaId) || "azul-oscuro"
}

async function _aplicarTema(t: typeof TEMAS[TemaId]) {
  document.body.style.background = t.gradient
  const r = document.documentElement.style
  r.setProperty("--accent",       t.accent)
  r.setProperty("--accent-hover", t.accentHover)
  r.setProperty("--accent-ring",  t.accent + "20")
  // Actualizar CSS var del TitleBar de forma síncrona — no depende del re-render de React
  r.setProperty("--titlebar-bg",  t.gradient)
  // Pintar el borde DWM de Windows con el color del tema
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    await invoke("set_titlebar_color", { color: t.captionColor })
  } catch {
    // Fuera de Tauri (navegador dev) — ignorar silenciosamente
  }
}

interface AppShellProps {
  activeItem?: string
  children: React.ReactNode
}

export function AppShell({ activeItem = "Panel de Control", children }: AppShellProps) {
  const router  = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [sesion,        setSesion]        = useState<SesionUsuario | null>(null)
  const [fechaHoy,      setFechaHoy]      = useState("")
  const [horaActual,    setHoraActual]    = useState("")
  const [terminoBuscar, setTerminoBuscar] = useState("")

  const { resultado, buscando, abierto, buscar, cerrar } = useBuscador()
  const [temaId, setTemaId] = useState<TemaId>("azul-oscuro")

  useEffect(() => {
    const t = getTema()
    setTemaId(t)
    _aplicarTema(TEMAS[t])
  }, [])

  function cambiarTema(id: TemaId) {
    setTemaId(id)
    localStorage.setItem("sage-tema", id)
    _aplicarTema(TEMAS[id])
  }

  const tema = TEMAS[temaId]

  useEffect(() => {
    setSesion(obtenerSesion())

    // Actualiza fecha y hora cada minuto para mantenerse sincronizado con la hora real
    function actualizarFechaHora() {
      const ahora = new Date()
      const texto = ahora.toLocaleDateString("es-CL", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
      setFechaHoy(texto.charAt(0).toUpperCase() + texto.slice(1))
      setHoraActual(ahora.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }))
    }

    actualizarFechaHora()
    const intervalo = setInterval(actualizarFechaHora, 60_000)
    return () => clearInterval(intervalo)
  }, [])

  function handleBuscarKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && terminoBuscar.trim()) {
      buscar(terminoBuscar.trim())
      inputRef.current?.blur()
    }
  }

  function handleCerrarModal() {
    cerrar()
    setTerminoBuscar("")
  }

  function handleLogout() {
    cerrarSesion()
    router.replace("/login")
  }

  return (
    <div className="fixed inset-0 overflow-hidden">

      {/* ── Barra de título custom (reemplaza el titlebar nativo de Tauri) ── */}
      <TitleBar gradient={tema.gradient} />

      {/* ── Fondo del chrome — cambia según el tema ──────────────────────── */}
      <div className="absolute inset-0 z-0" style={{ background: tema.gradient }} />

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="absolute left-0 top-8 w-64 h-[calc(100%-2rem)] flex flex-col z-20 overflow-hidden">

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
          <p className="text-white font-bold text-sm leading-snug">33ª Notaría de Santiago</p>
          <p className="text-white font-bold text-xs mt-0.5 leading-snug">Carolina Elizabeth Piña Cuevas</p>
          <p className="text-white font-bold text-xs mt-0.5">Notario Interino</p>
        </div>

        <div className="mx-5 mt-4 border-t border-white/10" />

        {/* Navegación */}
        <nav className="flex flex-col gap-1 px-3 mt-4 flex-1">
          {navItems.map(({ label, icon: Icon, href }) => {
            const isActive = activeItem === label
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl h-11 px-3 text-sm font-medium w-full transition-colors",
                  isActive
                    ? "bg-white font-bold"
                    : "text-blue-100 hover:bg-white/10"
                )}
                style={isActive ? { color: tema.activeText } : undefined}
              >
                <Icon size={18} style={isActive ? { color: tema.activeText } : undefined}
                  className={isActive ? "" : "text-blue-300"} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 mt-4">
          <div className="mx-2 mb-3 border-t border-white/10" />

          {/* Selector de tema */}
          <div className="flex items-center gap-2 px-3 mb-2">
            <span className="text-[11px] text-white/40 font-medium">Tema</span>
            <div className="flex gap-1.5 ml-1">
              {(Object.entries(TEMAS) as [TemaId, typeof TEMAS[TemaId]][]).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => cambiarTema(id)}
                  title={t.label}
                  className="w-5 h-5 rounded-full border-2 transition-all duration-200"
                  style={{
                    background:   t.gradient,
                    borderColor:  temaId === id ? "white" : "transparent",
                    transform:    temaId === id ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
          <Link
            href="/configuracion"
            className={cn(
              "flex items-center gap-3 rounded-xl h-11 px-3 text-sm w-full transition-colors",
              activeItem === "Configuración"
                ? "bg-white font-bold"
                : "text-blue-200 hover:bg-white/10"
            )}
            style={activeItem === "Configuración" ? { color: tema.activeText } : undefined}
          >
            <Settings size={18}
              style={activeItem === "Configuración" ? { color: tema.activeText } : undefined}
              className={activeItem === "Configuración" ? "" : "text-blue-300"} />
            Configuración
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl h-11 px-3 text-sm w-full transition-colors hover:bg-white/10"
          >
            <LogOut size={18} className="text-[#f87171]" />
            <span className="text-[#f87171]">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="absolute left-64 top-8 right-0 h-[72px] z-20 flex items-center gap-4 px-6">

        {/* Búsqueda global — Enter para buscar */}
        <div className="relative w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            ref={inputRef}
            type="text"
            value={terminoBuscar}
            onChange={e => setTerminoBuscar(e.target.value)}
            onKeyDown={handleBuscarKeyDown}
            placeholder="Ingrese N° de repertorio"
            className="w-full bg-white/10 border border-white/20 rounded-full h-10 pl-10 pr-4 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/30"
          />
        </div>

        {/* Modal de resultados */}
        {abierto && (
          <BuscadorModal
            resultado={resultado}
            buscando={buscando}
            repertorio={terminoBuscar}
            onCerrar={handleCerrarModal}
          />
        )}

        <div className="flex-1" />

        {/* Fecha y hora en tiempo real */}
        <div className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
          <Calendar size={15} className="text-white shrink-0" />
          <span className="text-white text-sm font-medium whitespace-nowrap">{fechaHoy}</span>
          <div className="w-px h-4 bg-white/20" />
          <Clock size={15} className="text-white shrink-0" />
          <span className="text-white text-sm font-medium tabular-nums">{horaActual}</span>
        </div>

        {/* Usuario */}
        <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2">
          <User size={15} className="text-white shrink-0" />
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{sesion?.nombre ?? "—"}</p>
            <p className="text-white/60 text-xs leading-tight">{sesion?.cargo ?? ""}</p>
          </div>
        </div>
      </header>

      {/* ── Panel de contenido ───────────────────────────────────────────── */}
      <main
        className="absolute left-64 top-[104px] right-0 bottom-0 z-10 bg-[#F4F6F8] overflow-y-auto"
        style={{ borderTopLeftRadius: "40px" }}
      >
        {children}
      </main>

    </div>
  )
}
