"use client"

import { useState } from "react"
import { AppShell } from "@/components/dashboard/app-shell"
import { cn } from "@/lib/utils"
import { CheckSquare } from "lucide-react"
import { useVBCarpeta } from "@/hooks/useVBCarpeta"
import { ListaVBTab } from "@/components/vb/ListaVBTab"
import { WordsTab } from "@/components/vb/WordsTab"

const TABS = [
  { id: 1, label: "Vistos Buenos" },
  { id: 2, label: "Finalización" },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function VBPage() {
  const [activeTab, setActiveTab] = useState<TabId>(1)

  const {
    estado: estadoCarpeta,
    cargando: cargandoCarpeta,
    error: errorCarpeta,
    inicializar,
    activar,
    desactivar,
    reinicializar,
  } = useVBCarpeta()

  return (
    <AppShell activeItem="Registro">
      <div className="p-6">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <CheckSquare size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827]">Registro</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Revisión y Gestión de Escrituras</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all",
                activeTab === id
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "bg-white text-[#6B7280] border border-gray-200 hover:border-[var(--accent)]/30 hover:text-[var(--accent)]"
              )}
            >
              <span className={cn(
                "w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center",
                activeTab === id ? "bg-white/20 text-white" : "bg-gray-100 text-[#6B7280]"
              )}>
                {id}
              </span>
              {label}
            </button>
          ))}
        </div>

        <div className={activeTab !== 1 ? "hidden" : ""}>
          <ListaVBTab
            estadoCarpeta={estadoCarpeta}
            cargandoCarpeta={cargandoCarpeta}
            errorCarpeta={errorCarpeta}
            inicializar={inicializar}
            activar={activar}
            desactivar={desactivar}
            reinicializar={reinicializar}
          />
        </div>
        <div className={activeTab !== 2 ? "hidden" : ""}>
          <WordsTab estadoCarpeta={estadoCarpeta} />
        </div>

      </div>
    </AppShell>
  )
}
