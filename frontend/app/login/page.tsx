"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { guardarSesion, obtenerSesion } from "@/hooks/useAuth"
import { Eye, EyeOff, LogIn } from "lucide-react"

const API = "http://localhost:8000"

export default function LoginPage() {
  const router   = useRouter()
  const [usuario,      setUsuario]      = useState("")
  const [contrasena,   setContrasena]   = useState("")
  const [mostrarClave, setMostrarClave] = useState(false)
  const [recordarme,   setRecordarme]   = useState(false)
  const [cargando,     setCargando]     = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Si ya hay sesión activa, ir directo al dashboard.
  // Si hay usuario guardado, prellenar el campo y activar el checkbox.
  useEffect(() => {
    if (obtenerSesion()) router.replace("/")
    const guardado = localStorage.getItem("sage_usuario_recordado")
    if (guardado) {
      setUsuario(guardado)
      setRecordarme(true)
    }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!usuario.trim()) {
      setError("Ingresa tu nombre de usuario.")
      return
    }

    setCargando(true)
    setError(null)

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ usuario: usuario.trim(), contrasena }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail ?? "Error al iniciar sesión.")
        return
      }

      guardarSesion(data)
      // Guardar o borrar el usuario según el checkbox Recuérdame
      if (recordarme) {
        localStorage.setItem("sage_usuario_recordado", usuario.trim())
      } else {
        localStorage.removeItem("sage_usuario_recordado")
      }
      router.replace("/")
    } catch {
      setError("No se pudo conectar con el servidor. Verifica que el backend esté corriendo.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center pt-8"
      style={{ background: "linear-gradient(160deg, #1a3a7a 0%, #0f2d6b 50%, #091f4f 100%)" }}
    >
      {/* Tarjeta — todo el contenido adentro */}
      <div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(175deg, #162e6e 0%, #0f2560 60%, #0b1e52 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.06) inset",
        }}
      >
        <div className="p-8 flex flex-col items-center">

          {/* Logo + identidad */}
          <img
            src="/banco-de-chile-logo.png"
            alt="Banco de Chile"
            className="h-11 w-auto object-contain mb-6"
          />

          <p className="text-[10px] tracking-[0.2em] text-white/45 font-semibold uppercase mb-1">
            Alzamientos
          </p>
          <p className="text-white font-bold text-base leading-snug text-center mb-0.5">
            33ª Notaría de Santiago
          </p>
          <p className="text-white/45 text-xs mb-7">
            Carolina E. Piña Cuevas · Notario Interino
          </p>

          {/* Divisor */}
          <div className="w-full h-px mb-7" style={{ background: "rgba(255,255,255,0.08)" }} />

          {/* Formulario */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">

            {/* Usuario */}
            <div>
              <label className="block text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                placeholder=""
                autoComplete="username"
                autoFocus
                className="w-full rounded-lg px-3 h-10 text-sm text-white placeholder:text-white/25 focus:outline-none transition-all"
                style={{
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.04)" }}
                onBlur={e  => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none" }}
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={mostrarClave ? "text" : "password"}
                  value={contrasena}
                  onChange={e => setContrasena(e.target.value)}
                  placeholder=""
                  autoComplete="current-password"
                  className="w-full rounded-lg px-3 pr-10 h-10 text-sm text-white placeholder:text-white/25 focus:outline-none transition-all"
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.3)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.04)" }}
                  onBlur={e  => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none" }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarClave(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60 transition-colors"
                >
                  {mostrarClave ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Recuérdame */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={e => setRecordarme(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-400"
              />
              <span className="text-white/50 text-xs">Recuérdame</span>
            </label>

            {/* Error */}
            {error && (
              <p
                className="text-sm text-red-300 rounded-lg px-3 py-2"
                style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)" }}
              >
                {error}
              </p>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={cargando}
              className="flex items-center justify-center gap-2 disabled:opacity-50 text-white rounded-xl h-11 text-sm font-semibold transition-all mt-1"
              style={{
                background: "linear-gradient(135deg, #1e4fa8 0%, #1565c0 100%)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
              }}
              onMouseEnter={e => { if (!cargando) e.currentTarget.style.background = "linear-gradient(135deg, #2563c4 0%, #1976d2 100%)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, #1e4fa8 0%, #1565c0 100%)" }}
            >
              {cargando ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {cargando ? "Ingresando…" : "Ingresar"}
            </button>

          </form>

          <p className="text-white/20 text-[10px] mt-7 tracking-widest uppercase">SAGE · Sistema de Gestión Notarial</p>
        </div>
      </div>
    </div>
  )
}
