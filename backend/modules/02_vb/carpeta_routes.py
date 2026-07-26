"""
Módulo 02 — VB / Carpeta de Descargas
Routes: endpoints FastAPI para gestionar la carpeta de VB.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  GET  /vb/carpeta/estado       → estado actual de la configuración
  POST /vb/carpeta/inicializar  → abre diálogo nativo y crea carpeta matriz
  POST /vb/carpeta/activar      → crea carpeta del día + inicia vigilador
  POST /vb/carpeta/desactivar   → detiene el vigilador
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import obtener_db
from .carpeta_controller import (
    activar_carpeta,
    desactivar_carpeta,
    inicializar_carpeta,
    obtener_estado,
)
from .carpeta_schema import EstadoCarpeta, SolicitudActivar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vb/carpeta", tags=["VB / Carpeta"])


# ── GET /vb/carpeta/estado ───────────────────────────────────────────────────

@router.get(
    "/estado",
    response_model=EstadoCarpeta,
    summary="Retorna el estado actual de la carpeta de VB",
)
def estado_carpeta(db: Session = Depends(obtener_db)):
    try:
        return obtener_estado(db)
    except Exception as e:
        logger.error("Error al obtener estado de carpeta: %s", e)
        raise HTTPException(status_code=500, detail="Error al obtener el estado")


# ── POST /vb/carpeta/inicializar ─────────────────────────────────────────────

@router.post(
    "/inicializar",
    response_model=EstadoCarpeta,
    summary="Abre el diálogo nativo para seleccionar la ruta base y crea la carpeta matriz",
)
def inicializar(db: Session = Depends(obtener_db)):
    try:
        return inicializar_carpeta(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al inicializar carpeta: %s", e)
        raise HTTPException(status_code=500, detail="Error al crear la carpeta")


# ── POST /vb/carpeta/activar ─────────────────────────────────────────────────

@router.post(
    "/activar",
    response_model=EstadoCarpeta,
    summary="Crea la carpeta seleccionada (o la del día) e inicia el vigilador",
)
def activar(solicitud: SolicitudActivar, db: Session = Depends(obtener_db)):
    try:
        return activar_carpeta(db, solicitud.nombre_carpeta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al activar carpeta: %s", e)
        raise HTTPException(status_code=500, detail="Error al activar")


# ── POST /vb/carpeta/desactivar ──────────────────────────────────────────────

@router.post(
    "/desactivar",
    response_model=EstadoCarpeta,
    summary="Detiene el vigilador de descargas",
)
def desactivar(db: Session = Depends(obtener_db)):
    try:
        return desactivar_carpeta(db)
    except Exception as e:
        logger.error("Error al desactivar carpeta: %s", e)
        raise HTTPException(status_code=500, detail="Error al desactivar")
