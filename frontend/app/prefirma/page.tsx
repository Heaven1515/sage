"use client"

/*
  Página: Prefirma
  Módulo 03 — Envío manual asistido de escrituras escaneadas al formulario interno.

  Flujo:
    1. Seleccionar carpeta del escáner
    2. Clic en un PDF → vista previa + formulario
    3. Ingresar / confirmar repertorio → el sistema busca materia en la BD
    4. Clic en "Ingresar" → envío silencioso al servidor + archivo eliminado
*/

import { FileSignature } from "lucide-react"
import { AppShell }         from "@/components/dashboard/app-shell"
import { ListaArchivos }    from "@/components/prefirma/ListaArchivos"
import { VisorPDF }         from "@/components/prefirma/VisorPDF"
import { PanelControl }     from "@/components/prefirma/PanelControl"
import { PanelLogs }        from "@/components/prefirma/PanelLogs"
import { usePrefirma }      from "@/hooks/usePrefirma"

export default function PrefirmaPage() {
  const {
    rutaCarpeta, seleccionarCarpeta, cargarArchivos,
    archivos, cargandoArchivos, archivoActual, seleccionarArchivo,
    imagenes, cargandoPreview,
    fecha, setFecha,
    repertorio, setRepertorio,
    anho, setAnho,
    tipoContrato, setTipoContrato,
    datosRep, buscandoRep, buscarRepertorio,
    mostrarModalManual, setMostrarModalManual, registrarManual,
    enviando, enviar, error,
    estadoAuto, cargandoAuto, iniciarAuto, detenerAuto,
    logs,
  } = usePrefirma()

  return (
    <AppShell activeItem="Envío Firma Electrónica">
      <div className="p-6">

        {/* Título */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center">
            <FileSignature size={20} className="text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#111827]">Envío Firma Electrónica</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">Generación de Copias para Formulario Interno</p>
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

        {/* Panel de logs del modo automático */}
        <PanelLogs logs={logs} />

        <VisorPDF
          archivoActual    = {archivoActual}
          imagenes         = {imagenes}
          cargandoPreview  = {cargandoPreview}
          fecha            = {fecha}
          setFecha         = {setFecha}
          repertorio       = {repertorio}
          setRepertorio    = {setRepertorio}
          anho             = {anho}
          setAnho          = {setAnho}
          tipoContrato     = {tipoContrato}
          setTipoContrato  = {setTipoContrato}
          datosRep         = {datosRep}
          buscandoRep      = {buscandoRep}
          onBuscarRep      = {buscarRepertorio}
          enviando              = {enviando}
          onEnviar              = {enviar}
          error                 = {error}
          mostrarModalManual    = {mostrarModalManual}
          setMostrarModalManual = {setMostrarModalManual}
          onRegistrarManual     = {registrarManual}
          panelInferior    = {
            <ListaArchivos
              rutaCarpeta      = {rutaCarpeta}
              archivos         = {archivos}
              cargando         = {cargandoArchivos}
              archivoActual    = {archivoActual}
              onSeleccionar    = {seleccionarArchivo}
              onCambiarCarpeta = {seleccionarCarpeta}
              onActualizar     = {cargarArchivos}
            />
          }
        />

      </div>
    </AppShell>
  )
}
