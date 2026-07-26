"use client"

/*
  Guarda de sesión: auto-login silencioso.
  Si no hay sesión, crea una automáticamente con el usuario por defecto
  y guarda en localStorage para que el resto de la app funcione normal.
*/

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { obtenerSesion, guardarSesion } from "@/hooks/useAuth"

const API = "http://localhost:8000"

export default function SesionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [listo, setListo] = useState(false)

  useEffect(() => {
    /* Si ya hay sesión, seguir directo */
    if (obtenerSesion()) {
      setListo(true)
      return
    }

    /* Auto-login silencioso con usuario por defecto */
    fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: "Jespina", contrasena: "" }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.id) guardarSesion(data)
        setListo(true)
      })
      .catch(() => {
        /* Si el backend no responde, dejar pasar igual */
        setListo(true)
      })
  }, [pathname])

  if (!listo) return null
  return <>{children}</>
}
