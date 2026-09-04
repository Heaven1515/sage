"use client"

/*
  Página: Renombrado para Firma
  Módulo 03 — Renombra automáticamente los PDFs escaneados usando OCR.

  Flujo:
    1. Configurar carpeta del escáner (misma de siempre)
    2. Activar modo automático
    3. Cada PDF que llega al escáner → OCR extrae repertorio → busca OT en BD
       → renombra a REPERTORIOZZZZ-OTXXXX.pdf
    4. Log en pantalla muestra resultado de cada archivo
*/

import { FileSignature } from "lucide-react"
import { AppShell }      from "@/components/dashboard/app-shell"
import { PanelControl }  from "@/components/prefirma/PanelControl"
import { PanelLogs }     from "@/components/prefirma/PanelLogs"
import { usePrefirma }   from "@/hooks/usePrefirma"

export default function PrefirmaPage() {
  const {
    rutaCarpeta, seleccionarCarpeta,
    estadoAuto, cargandoAuto, iniciarAuto, detenerAuto,
    logs, error,
  } = usePrefirma()

  return (
    <AppShell activeItem="Renombrado para Firma">
      <div className="p-6">

        {/* Título */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <FileSignature size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827]">Renombrado para Firma</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {rutaCarpeta
                ? <span className="font-mono text-xs">{rutaCarpeta}</span>
                : "Configura la carpeta del escáner para comenzar"}
            </p>
          </div>
        </div>

        {/* Panel modo automático */}
        <PanelControl
          estado    = {estadoAuto}
          cargando  = {cargandoAuto}
          error     = {error}
          onIniciar = {iniciarAuto}
          onDetener = {detenerAuto}
        />

        {/* Botón cambiar carpeta */}
        <div className="mb-5">
          <button
            onClick={seleccionarCarpeta}
            className="text-xs text-[#6B7280] hover:text-[var(--accent)] underline underline-offset-2 transition-colors"
          >
            {rutaCarpeta ? "Cambiar carpeta del escáner" : "Seleccionar carpeta del escáner"}
          </button>
        </div>

        {/* Log de operaciones */}
        <PanelLogs logs={logs} />

      </div>
    </AppShell>
  )
}
