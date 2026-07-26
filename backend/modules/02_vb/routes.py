"""
Módulo 02 — VB / Escrituras
Routes: endpoints FastAPI.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  POST /vb/subir-excel  → carga un Excel del banco
  GET  /vb/             → retorna WFs del día (o fecha indicada), con filtro opcional por actividad
"""

import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from database import obtener_db
from .controller import cargar_escrituras, obtener_lista, parsear_excel
from .schema import ResultadoCargaVB, VBEscrituraRespuesta

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vb", tags=["VB / Escrituras"])


# ── POST /vb/subir-excel ─────────────────────────────────────────────────────

@router.post(
    "/subir-excel",
    response_model=ResultadoCargaVB,
    summary="Sube el Excel del Banco de Chile y carga los WFs en la BD de VB",
)
async def subir_excel(
    archivo: Annotated[UploadFile, File(description="Archivo .xls exportado del sistema del banco")],
    db: Session = Depends(obtener_db),
):
    """
    Recibe el .xls del banco, lo parsea y guarda los WFs nuevos en la BD.
    Los WFs duplicados (mismo N° Carpeta) se omiten sin error.
    """
    if not archivo.filename or not archivo.filename.lower().endswith(".xls"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .xls")

    try:
        contenido = await archivo.read()
        escrituras = parsear_excel(contenido)
        resultado = cargar_escrituras(db, escrituras)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Error inesperado al subir Excel VB: %s", e)
        raise HTTPException(status_code=500, detail="Error interno al procesar el archivo")

    return resultado


# ── GET /vb/ ─────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[VBEscrituraRespuesta],
    summary="Retorna los WFs del día indicado (o hoy por defecto), con filtro opcional por actividad",
)
def listar_escrituras(
    actividades: Annotated[
        list[str] | None,
        Query(description="Actividades a filtrar. Se pueden enviar múltiples: ?actividades=X&actividades=Y"),
    ] = None,
    fecha: Annotated[
        date | None,
        Query(description="Fecha de carga a recuperar (YYYY-MM-DD). Si no se indica, usa hoy."),
    ] = None,
    db: Session = Depends(obtener_db),
):
    """
    Retorna los WFs cargados en la fecha indicada (por defecto hoy).
    Permite recuperar la lista del día sin necesitar el archivo Excel original.
    """
    try:
        return obtener_lista(db, actividades, fecha or date.today())
    except Exception as e:
        logger.error("Error al obtener lista de VB: %s", e)
        raise HTTPException(status_code=500, detail="Error interno al obtener los datos")
