"use client"

import { AppShell } from "@/components/dashboard/app-shell"
import { BookOpen } from "lucide-react"
import { RepertoriosTab } from "@/components/vb/RepertoriosTab"

export default function RepertoriosPage() {
  return (
    <AppShell activeItem="Toma de Repertorios">
      <div className="p-6">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <BookOpen size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827]">Toma de Repertorios</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Carga planilla, llena documentos e indexa en el registro permanente</p>
          </div>
        </div>

        <RepertoriosTab />

      </div>
    </AppShell>
  )
}
