"""
Endpoints FastAPI del módulo Bóveda.
"""

import importlib
import logging
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import obtener_db
from . import controller
from .schema import (
    ConfigBoveda,
    EditarRequest,
    EliminarRequest,
    RegistrarRequest,
    RegistroItem,
    RespuestaBusqueda,
    VerificacionRepertorio,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/boveda", tags=["Bóveda"])


@router.get("/config", response_model=ConfigBoveda)
def obtener_config(db: Session = Depends(obtener_db)):
    """Retorna la configuración actual: número de entrega activo para hoy."""
    controller.obtener_entrega_actual(db)   # Sincroniza el contador si cambió el día
    config = controller.obtener_config(db)
    return config


@router.get("/verificar/{repertorio}", response_model=VerificacionRepertorio)
def verificar(repertorio: int, db: Session = Depends(obtener_db)):
    """Verifica si el repertorio ya fue ingresado a bóveda en el año actual."""
    return controller.verificar_reingreso(repertorio, db)


@router.post("/registro", response_model=RegistroItem)
def registrar(req: RegistrarRequest, db: Session = Depends(obtener_db)):
    """Registra la entrega de una escritura a la bóveda."""
    try:
        registro = controller.registrar(req.repertorio, req.motivo, db, req.usuario_id)
        return RegistroItem.model_validate(registro)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/registros", response_model=list[RegistroItem])
def obtener_registros(
    fecha: date = Query(default=None),
    db: Session = Depends(obtener_db),
):
    """Retorna los registros de una fecha (por defecto: hoy)."""
    fecha_consulta = fecha or date.today()
    registros = controller.obtener_registros(fecha_consulta, db)
    return [RegistroItem.model_validate(r) for r in registros]


@router.put("/registro/{registro_id}", response_model=RegistroItem)
def editar(registro_id: int, req: EditarRequest, db: Session = Depends(obtener_db)):
    """Edita el N° de repertorio. Exige contraseña si el registro es de un día anterior."""
    try:
        registro = controller.editar_registro(registro_id, req.repertorio, req.contrasena, db)
        return RegistroItem.model_validate(registro)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/registro/{registro_id}")
def eliminar(registro_id: int, req: EliminarRequest, db: Session = Depends(obtener_db)):
    """Elimina un registro. Exige contraseña si el registro es de un día anterior."""
    try:
        controller.eliminar_registro(registro_id, req.contrasena, db)
        return {"ok": True}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/nueva-entrega")
def nueva_entrega(db: Session = Depends(obtener_db)):
    """Incrementa el contador de entrega del día en 1."""
    numero = controller.nueva_entrega(db)
    return {"entrega_actual": numero}


@router.get("/buscar/{repertorio}", response_model=RespuestaBusqueda)
def buscar(repertorio: int, db: Session = Depends(obtener_db)):
    """Busca un repertorio en todo el historial de bóveda."""
    return controller.buscar_repertorio(repertorio, db)


@router.post("/generar-word")
def generar_word(db: Session = Depends(obtener_db)):
    """
    Genera el Word de la entrega actual del día.
    Retorna el archivo .docx como descarga directa y lo guarda
    en la carpeta del día activa de VB si está configurada.
    """
    entrega = controller.obtener_entrega_actual(db)
    try:
        contenido, nombre = controller.generar_word(entrega, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Guardar también en la carpeta del día de VB si está activa
    try:
        VBCarpetaConfig = importlib.import_module("modules.02_vb.carpeta_model").VBCarpetaConfig
        config_vb = db.query(VBCarpetaConfig).filter(VBCarpetaConfig.id == 1).first()
        if config_vb and config_vb.activa and config_vb.ruta_base and config_vb.carpeta_hoy:
            ruta_dia = Path(config_vb.ruta_base) / "Vistos Buenos de Abogados" / config_vb.carpeta_hoy
            if ruta_dia.exists():
                (ruta_dia / nombre).write_bytes(contenido)
                logger.info("Word bóveda guardado en carpeta del día: %s", ruta_dia / nombre)
    except Exception as e:
        logger.warning("No se pudo guardar Word bóveda en carpeta del día: %s", e)

    return Response(
        content=contenido,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
