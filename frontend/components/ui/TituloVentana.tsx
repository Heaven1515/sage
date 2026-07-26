"use client"

/*
  Barra de título personalizada — reemplaza la decoración nativa de Windows.
  Integrada visualmente en el gradiente azul de la app.
  Usa data-tauri-drag-region para que el área izquierda sirva de agarre.
*/

import { Minus, X } from "lucide-react"

async function minimizar() {
  if (typeof window === "undefined") return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  await getCurrentWindow().minimize()
}

async function cerrar() {
  if (typeof window === "undefined") return
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  await getCurrentWindow().close()
}

export default function TituloVentana() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 z-50 flex items-center select-none"
      style={{ background: "linear-gradient(to bottom, #1e418a 0%, #1a3a7a 100%)" }}
    >
      {/* Zona de arrastre — ocupa todo el espacio disponible */}
      <div className="flex-1 h-full" data-tauri-drag-region="" />

      {/* Botón minimizar */}
      <button
        onClick={minimizar}
        className="h-8 w-12 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        title="Minimizar"
      >
        <Minus size={13} />
      </button>

      {/* Botón cerrar */}
      <button
        onClick={cerrar}
        className="h-8 w-12 flex items-center justify-center text-white/50 hover:text-white hover:bg-red-600 transition-colors"
        title="Cerrar"
      >
        <X size={13} />
      </button>
    </div>
  )
}
