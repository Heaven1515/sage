"""
Módulo 09 — Toma de Repertorios / Registro de Datos
Routes: endpoints FastAPI para el repositorio permanente.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  POST /registro/indexar  → cruza sesión (Words + planilla) y guarda en vb_registro
  GET  /registro/         → lista el repositorio completo con filtros opcionales
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import obtener_db
from .registro_controller import indexar_sesion, listar_registros
from .registro_schema import RegistroItem, ResultadoIndexar

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/registro", tags=["Toma de Repertorios / Registro"])


# ── POST /registro/indexar ───────────────────────────────────────────────────

@router.post(
    "/indexar",
    response_model=ResultadoIndexar,
    summary="Indexar sesión en el repositorio",
)
def indexar(
    cuerpo: dict,
    db: Session = Depends(obtener_db),
):
    """
    Recibe el nombre de la carpeta y la planilla de repertorios en memoria.
    Cruza los Words con la planilla, guarda WF/RUT/nombre/materia/comuna/repertorio
    en vb_registro. Idempotente: si el WF ya existe, lo actualiza.

    Cuerpo esperado:
      {
        "nombre_carpeta": "VB 03-04-2026",
        "items_repertorio": [
          { "wf": "...", "repertorio": "...", "anio": 2026,
            "dia": 3, "mes": 4, "nombre_cliente": "...", "materia": "..." }
        ]
      }
    """
    nombre_carpeta = cuerpo.get("nombre_carpeta", "").strip()
    items_repertorio = cuerpo.get("items_repertorio", [])

    if not nombre_carpeta:
        raise HTTPException(status_code=422, detail="Falta el campo 'nombre_carpeta'")

    usuario_id = cuerpo.get("usuario_id")  # Usuario que está indexando (opcional)

    try:
        resultado = indexar_sesion(
            nombre_carpeta   = nombre_carpeta,
            items_repertorio = items_repertorio,
            db               = db,
            usuario_id       = usuario_id,
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Error al indexar sesión '%s': %s", nombre_carpeta, e)
        raise HTTPException(status_code=500, detail="Error interno al indexar")


# ── GET /registro/ ───────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[RegistroItem],
    summary="Listar repositorio permanente",
)
def listar(
    busqueda: str | None = Query(default=None, description="Filtra por WF, RUT o nombre"),
    anio: int | None = Query(default=None, description="Filtra por año de escritura"),
    db: Session = Depends(obtener_db),
):
    """
    Retorna todos los registros del repositorio permanente.
    Soporta filtro por texto libre (WF, RUT, nombre) y por año.
    """
    try:
        return listar_registros(db=db, busqueda=busqueda, anio=anio)
    except Exception as e:
        logger.error("Error al listar registros: %s", e)
        raise HTTPException(status_code=500, detail="Error interno al listar el repositorio")
