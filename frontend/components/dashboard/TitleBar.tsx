"use client"

/*
  TitleBar — barra de título personalizada para la ventana Tauri.
  Reemplaza el titlebar nativo (decorations: false) con una barra
  que toma el color del tema activo y expone los controles de ventana.

  Solo activa los controles de ventana cuando corre dentro de Tauri.
  En el navegador de desarrollo los botones se renderizan pero no hacen nada.
*/

import { Minus, X } from "lucide-react"

interface Props {
  gradient: string   // gradiente del tema actual
}

async function getWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")
    return getCurrentWindow()
  } catch {
    return null
  }
}

export function TitleBar({ gradient }: Props) {
  const handleMinimize = async () => {
    const win = await getWindow()
    win?.minimize()
  }

  const handleClose = async () => {
    const win = await getWindow()
    win?.close()
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 h-8 z-50 flex items-center justify-end select-none"
      style={{ background: "var(--titlebar-bg)" }}
      data-tauri-drag-region
    >
      {/* Botones de ventana */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Minimizar"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleClose}
          className="h-full w-12 flex items-center justify-center text-white/60 hover:text-white hover:bg-red-500 transition-colors"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
