"""
Endpoints FastAPI del módulo Postfirma.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import obtener_db
from . import controller
from .schema import PostfirmaConfigSchema, ResultadoProcesamiento

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/postfirma", tags=["Postfirma"])


@router.get("/config", response_model=PostfirmaConfigSchema)
def obtener_config(db: Session = Depends(obtener_db)):
    """Retorna la configuración de carpetas guardada."""
    return controller.obtener_config(db)


@router.post("/seleccionar-carpeta-origen", response_model=PostfirmaConfigSchema)
def seleccionar_carpeta_origen(db: Session = Depends(obtener_db)):
    """Abre diálogo para elegir la carpeta con PDFs firmados electrónicamente."""
    return controller.seleccionar_carpeta_origen(db)


@router.post("/seleccionar-carpeta-destino", response_model=PostfirmaConfigSchema)
def seleccionar_carpeta_destino(db: Session = Depends(obtener_db)):
    """Abre diálogo para elegir la carpeta base de destino."""
    return controller.seleccionar_carpeta_destino(db)


@router.post("/procesar", response_model=ResultadoProcesamiento)
def procesar(db: Session = Depends(obtener_db)):
    """
    Procesa todos los PDFs de la carpeta origen:
    los renombra, mueve a la subcarpeta del día y genera el JSON para Santiago.
    """
    try:
        return controller.procesar_pdfs(db)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
