"""
Endpoints FastAPI del módulo Renombrado para Firma (ex-Prefirma).
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import obtener_db
from . import controller
from .schema import (
    ArchivoItem,
    CarpetaRespuesta,
    DatosRepertorio,
    LogItem,
    PreviewRespuesta,
    RegistroManualRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prefirma", tags=["Prefirma"])


@router.post("/seleccionar-carpeta", response_model=CarpetaRespuesta)
def seleccionar_carpeta(db: Session = Depends(obtener_db)):
    """Abre diálogo tkinter para elegir la carpeta del escáner y guarda la ruta."""
    return controller.seleccionar_carpeta(db)


@router.get("/carpeta", response_model=CarpetaRespuesta)
def obtener_carpeta(db: Session = Depends(obtener_db)):
    """Retorna la carpeta configurada actualmente (sin abrir diálogo)."""
    return controller.obtener_carpeta(db)


@router.get("/archivos", response_model=list[ArchivoItem])
def listar_archivos(db: Session = Depends(obtener_db)):
    """Lista todos los PDFs disponibles en la carpeta del escáner."""
    return controller.listar_archivos(db)


@router.get("/leer/{nombre_archivo}")
def leer_pdf(nombre_archivo: str, db: Session = Depends(obtener_db)):
    """Lee la primera página con OCR y retorna repertorio, año y tipo de contrato."""
    try:
        return controller.leer_pdf(nombre_archivo, db)
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/preview/{nombre_archivo}", response_model=PreviewRespuesta)
def obtener_preview(nombre_archivo: str, db: Session = Depends(obtener_db)):
    """Renderiza las primeras 2 páginas del PDF como imágenes base64 JPEG."""
    try:
        return controller.obtener_preview(nombre_archivo, db)
    except (FileNotFoundError, RuntimeError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get("/repertorio/{numero}/{anio}", response_model=DatosRepertorio)
def buscar_repertorio(numero: str, anio: str, db: Session = Depends(obtener_db)):
    """Busca un repertorio en vb_registro y retorna materia + fecha_escritura."""
    return controller.buscar_repertorio(numero, anio, db)


@router.post("/registro-manual", response_model=DatosRepertorio)
def registro_manual(req: RegistroManualRequest, db: Session = Depends(obtener_db)):
    """
    Guarda manualmente una escritura en vb_registro cuando no pasó por el módulo VB.
    Permite que aparezca en el informe diario y en la planilla de carátulas CBR.
    """
    try:
        return controller.registrar_manual(req, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))



@router.get("/logs", response_model=list[LogItem])
def obtener_logs(db: Session = Depends(obtener_db)):
    """Historial completo de PDFs procesados, más recientes primero."""
    return controller.obtener_logs(db)


@router.post("/auto/iniciar")
def iniciar_auto(db: Session = Depends(obtener_db)):
    """Activa el modo automático: vigila la carpeta y procesa PDFs al detectarlos."""
    try:
        return controller.iniciar_modo_auto(db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/auto/detener")
def detener_auto(db: Session = Depends(obtener_db)):
    """Desactiva el modo automático."""
    return controller.detener_modo_auto(db)


@router.get("/auto/estado")
def estado_auto(db: Session = Depends(obtener_db)):
    """Retorna si el modo automático está activo."""
    return controller.estado_modo_auto(db)


@router.delete("/logs/hoy")
def limpiar_logs_hoy(db: Session = Depends(obtener_db)):
    """Elimina todas las entradas de prefirma_log del día actual."""
    hoy = date.today().isoformat()
    result = db.execute(
        text("DELETE FROM prefirma_log WHERE DATE(fecha_procesado) = :hoy"),
        {"hoy": hoy},
    )
    db.commit()
    return {"eliminados": result.rowcount}
