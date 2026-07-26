"""
Módulo 02 — VB / Generación de Planillas
Routes: endpoint FastAPI para generar las planillas Excel desde la lista de Words.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  POST /vb/planillas/generar → genera un Excel por materia y lo guarda en Descargas
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import obtener_db
from .planilla_controller import generar_planillas
from .words_schema import WordItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vb/planillas", tags=["VB / Planillas"])


# ── POST /vb/planillas/generar ────────────────────────────────────────────────

@router.post(
    "/generar",
    response_model=list[str],
    summary="Genera un Excel por materia y lo guarda en Descargas",
)
def generar(items: list[WordItem], db: Session = Depends(obtener_db)):
    """
    Recibe la lista de WordItem ya leídos del frontend y genera una planilla
    Excel por cada materia distinta detectada. Los archivos se guardan en
    la carpeta del día activa (configurada en Tab 2).
    Retorna la lista de nombres de archivos generados.
    """
    try:
        return generar_planillas(items, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error generando planillas: %s", e)
        raise HTTPException(status_code=500, detail="Error al generar las planillas")
