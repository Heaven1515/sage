"""
Módulo 09 — Toma de Repertorios
Routes: endpoints FastAPI para la sección de Repertorios.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  POST /repertorios/cargar-planilla    → parsea el Excel del banco
  POST /repertorios/llenar-words       → llena los Words y genera el Word resumen
  POST /repertorios/imprimir           → imprime solo páginas 1-2 (Toma de Repertorios)
  POST /repertorios/imprimir-completo  → imprime completo + genera detalle (Finalización)
  GET  /repertorios/estado-impresion   → estado actual del hilo de impresión
  POST /repertorios/cancelar           → detiene el hilo y limpia el spooler
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import obtener_db
from .controller import llenar_words, parsear_planilla
from .schema import ItemDetalleEnvio, ItemRepertorio, RespuestaLlenar
from . import impresion_controller

import importlib
Configuracion = importlib.import_module("modules.07_configuracion.model").Configuracion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/repertorios", tags=["Toma de Repertorios"])


# ── GET /repertorios/anio ────────────────────────────────────────────────────

@router.get("/anio", summary="Retorna el año activo para llenar Words de repertorios")
def obtener_anio(db: Session = Depends(obtener_db)):
    config = db.query(Configuracion).filter(Configuracion.id == 1).first()
    anio = config.anio_repertorios if config and config.anio_repertorios else datetime.now().year
    return {"anio": anio}


# ── PUT /repertorios/anio ─────────────────────────────────────────────────────

@router.put("/anio", summary="Guarda el año activo para llenar Words de repertorios")
def guardar_anio(anio: int, db: Session = Depends(obtener_db)):
    config = db.query(Configuracion).filter(Configuracion.id == 1).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    config.anio_repertorios = anio
    db.commit()
    logger.info("Año de repertorios actualizado a %d", anio)
    return {"anio": anio}


# ── POST /repertorios/cargar-planilla ────────────────────────────────────────

@router.post(
    "/cargar-planilla",
    response_model=list[ItemRepertorio],
    summary="Parsea el Excel 'Consulta OT' del banco y retorna la lista de repertorios",
)
async def cargar_planilla(archivo: UploadFile = File(...)):
    try:
        contenido = await archivo.read()
        return parsear_planilla(contenido)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al parsear planilla de repertorios: %s", e)
        raise HTTPException(status_code=500, detail="Error al procesar el archivo")


# ── POST /repertorios/llenar-words ───────────────────────────────────────────

@router.post(
    "/llenar-words",
    response_model=RespuestaLlenar,
    summary="Llena los Words con datos de repertorios y genera el Word resumen en Completos/",
)
def llenar_words_endpoint(
    items: list[ItemRepertorio],
    db: Session = Depends(obtener_db),
    nombre_carpeta: str | None = None,
):
    try:
        return llenar_words(items, db, nombre_carpeta)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al llenar Words de repertorios: %s", e)
        raise HTTPException(status_code=500, detail="Error al llenar los documentos")


# ── POST /repertorios/imprimir ───────────────────────────────────────────────
# Usado por Toma de Repertorios: siempre páginas 1 y 2, sin body.

@router.post(
    "/imprimir",
    summary="Imprime solo páginas 1-2 de los Words (Toma de Repertorios)",
)
def imprimir(
    db: Session = Depends(obtener_db),
    nombre_carpeta: str | None = None,
):
    try:
        return impresion_controller.iniciar_impresion(
            db, paginas="1-2", nombre_carpeta=nombre_carpeta,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al iniciar impresión: %s", e)
        raise HTTPException(status_code=500, detail="Error al iniciar la impresión")


# ── POST /repertorios/imprimir-completo ──────────────────────────────────────
# Usado por Finalización: imprime todo el documento + genera detalle de envío.

@router.post(
    "/imprimir-completo",
    summary="Imprime documentos completos y genera detalle de envío (Finalización)",
)
def imprimir_completo(
    items_detalle: list[ItemDetalleEnvio],
    db: Session = Depends(obtener_db),
    nombre_carpeta: str | None = None,
):
    try:
        return impresion_controller.iniciar_impresion(
            db, items_detalle=items_detalle, nombre_carpeta=nombre_carpeta,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al iniciar impresión completa: %s", e)
        raise HTTPException(status_code=500, detail="Error al iniciar la impresión")


# ── GET /repertorios/estado-impresion ────────────────────────────────────────

@router.get(
    "/estado-impresion",
    summary="Retorna el estado actual del hilo de impresión (para polling del frontend)",
)
def estado_impresion():
    return impresion_controller.obtener_estado()


# ── POST /repertorios/cancelar ───────────────────────────────────────────────

@router.post(
    "/cancelar",
    summary="Detiene el hilo de impresión y cancela los trabajos pendientes en el spooler",
)
def cancelar():
    try:
        return impresion_controller.cancelar_impresion()
    except Exception as e:
        logger.error("Error al cancelar impresión: %s", e)
        raise HTTPException(status_code=500, detail="Error al cancelar la impresión")
