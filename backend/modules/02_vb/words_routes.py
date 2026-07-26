"""
Módulo 02 — VB / Lectura de Words
Routes: endpoints FastAPI para listar y leer los archivos Word de la carpeta VB.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  GET  /vb/words/carpetas  → lista subcarpetas VB disponibles para seleccionar
  POST /vb/words/leer      → lee todos los .docx de la subcarpeta indicada
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import obtener_db
from .words_controller import listar_carpetas_disponibles, leer_words_carpeta
from .words_schema import CarpetasDisponibles, SolicitudLeerWords, WordItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vb/words", tags=["VB / Words"])


# ── GET /vb/words/carpetas ───────────────────────────────────────────────────

@router.get(
    "/carpetas",
    response_model=CarpetasDisponibles,
    summary="Lista las subcarpetas VB disponibles para leer",
)
def carpetas_disponibles(db: Session = Depends(obtener_db)):
    try:
        return listar_carpetas_disponibles(db)
    except Exception as e:
        logger.error("Error listando carpetas VB: %s", e)
        raise HTTPException(status_code=500, detail="Error al listar carpetas disponibles")


# ── POST /vb/words/leer ──────────────────────────────────────────────────────

@router.post(
    "/leer",
    response_model=list[WordItem],
    summary="Lee los .docx de la subcarpeta VB indicada y retorna la lista de datos",
)
def leer_words(solicitud: SolicitudLeerWords, db: Session = Depends(obtener_db)):
    try:
        return leer_words_carpeta(solicitud.nombre_carpeta, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error leyendo Words VB: %s", e)
        raise HTTPException(status_code=500, detail="Error al procesar los archivos")
