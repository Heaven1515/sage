"""
Dashboard — Routes
Métricas del panel principal y buscador global de escrituras.

GET  /dashboard/resumen
GET  /dashboard/buscar?q={repertorio}
GET  /dashboard/informe-diario
GET  /dashboard/informe-diario/excel
"""

import importlib
import logging
from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import obtener_db
from dashboard_controller import (
    generar_excel_informe_diario,
    informe_diario_prefirma,
    obtener_resumen,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/buscar")
def buscar_repertorio(q: str = Query(..., min_length=1), db: Session = Depends(obtener_db)):
    """
    Busca una escritura por número de repertorio y retorna toda la información disponible:
    datos del registro VB, si está en bóveda, y si tiene carátula (para Santiago).
    """
    try:
        VBRegistro      = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro
        BovedaRegistro  = importlib.import_module("modules.05_boveda.model").BovedaRegistro


        # Buscar en vb_registro por repertorio (puede haber varios años)
        registros_vb = (
            db.query(VBRegistro)
            .filter(VBRegistro.repertorio == q.strip())
            .order_by(VBRegistro.anio.desc())
            .all()
        )

        if not registros_vb:
            # Buscar en bóveda: escrituras que solo pasaron por esa etapa sin pasar por VB
            try:
                q_int = int(q.strip())
                BovedaRegistro = importlib.import_module("modules.05_boveda.model").BovedaRegistro
                entrada_boveda = (
                    db.query(BovedaRegistro)
                    .filter(BovedaRegistro.repertorio == q_int)
                    .order_by(BovedaRegistro.fecha.desc())
                    .first()
                )
                if entrada_boveda:
                    return {
                        "encontrado":       True,
                        "repertorio":       q.strip(),
                        "wf":               None,
                        "nombre_cliente":   None,
                        "rut":              None,
                        "comuna":           None,
                        "materia":          None,
                        "anio":             entrada_boveda.anio,
                        "fecha_escritura":  None,
                        "firma_electronica": None,
                        "numero_caratula":  None,
                        "es_santiago":      False,
                        "en_boveda":        True,
                        "boveda_fecha":     str(entrada_boveda.fecha),
                        "boveda_entrega":   entrada_boveda.numero_entrega,
                        "es_reingreso":     entrada_boveda.es_reingreso,
                    }
            except (ValueError, Exception):
                pass
            return {"encontrado": False, "repertorio": q.strip()}

        # Tomar el más reciente
        reg = registros_vb[0]

        # Verificar si está en bóveda
        entrada_boveda = (
            db.query(BovedaRegistro)
            .filter(BovedaRegistro.repertorio == q.strip())
            .order_by(BovedaRegistro.fecha.desc())
            .first()
        )

        es_santiago = (reg.comuna or "").upper() == "SANTIAGO"

        return {
            "encontrado":       True,
            "wf":               reg.wf,
            "nombre_cliente":   reg.nombre_cliente,
            "rut":              reg.rut,
            "comuna":           reg.comuna,
            "materia":          reg.materia,
            "repertorio":       reg.repertorio,
            "anio":             reg.anio,
            "fecha_escritura":  reg.fecha_escritura,
            "firma_electronica": reg.firma_electronica,
            "numero_caratula":  reg.numero_caratula,
            "es_santiago":      es_santiago,
            "en_boveda":        entrada_boveda is not None,
            "boveda_fecha":     str(entrada_boveda.fecha) if entrada_boveda else None,
            "boveda_entrega":   entrada_boveda.numero_entrega if entrada_boveda else None,
            "es_reingreso":     entrada_boveda.es_reingreso if entrada_boveda else False,
        }
    except Exception as exc:
        logger.error("Error en dashboard/buscar: %s", exc)
        return {"encontrado": False, "repertorio": q, "error": str(exc)}


@router.get("/informe-diario")
def get_informe_diario(
    fecha: str = Query(default=None, description="Fecha en formato YYYY-MM-DD. Por defecto: hoy."),
    db: Session = Depends(obtener_db),
):
    """Lista de operaciones procesadas en Prefirma para la fecha indicada (sin RECs)."""
    try:
        dia   = date.fromisoformat(fecha) if fecha else date.today()
        todos = informe_diario_prefirma(db, dia)
        return [i for i in todos if not i.get("es_rec")]
    except Exception as exc:
        logger.error("Error en dashboard/informe-diario: %s", exc)
        return []


@router.get("/informe-diario/excel")
def get_informe_diario_excel(
    fecha: str = Query(default=None, description="Fecha en formato YYYY-MM-DD. Por defecto: hoy."),
    db: Session = Depends(obtener_db),
):
    """Descarga el Excel del informe diario (2 hojas: Comunas y Santiago)."""
    try:
        dia     = date.fromisoformat(fecha) if fecha else date.today()
        datos   = generar_excel_informe_diario(db, dia)
        nombre  = f"OPERACIONES_{dia.strftime('%d-%m-%Y')}.xlsx"
        return Response(
            content=datos,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except Exception as exc:
        logger.error("Error en dashboard/informe-diario/excel: %s", exc)
        return Response(content=b"", status_code=500)


class ExcelDesdeEditadosInput(BaseModel):
    """Datos editados por el usuario para generar el Excel."""
    fecha: str | None = None
    items: list[dict]


@router.post("/informe-diario/excel-editado")
def post_excel_editado(body: ExcelDesdeEditadosInput):
    """Genera el Excel del informe diario a partir de datos editados por el usuario."""
    try:
        dia = date.fromisoformat(body.fecha) if body.fecha else date.today()
        from dashboard_controller import generar_excel_desde_items
        datos  = generar_excel_desde_items(body.items, dia)
        nombre = f"OPERACIONES_{dia.strftime('%d-%m-%Y')}.xlsx"
        return Response(
            content=datos,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
        )
    except Exception as exc:
        logger.error("Error generando Excel editado: %s", exc)
        return Response(content=b"", status_code=500)


@router.get("/resumen")
def resumen(db: Session = Depends(obtener_db)):
    """
    Retorna métricas del dashboard: diarias, mensuales, gráfico anual
    y escrituras pendientes de firma electrónica.
    """
    try:
        return obtener_resumen(db)
    except Exception as exc:
        logger.error("Error en dashboard/resumen: %s", exc)
        return {
            "diario":     {},
            "mensual":    {},
            "grafico":    [],
            "pendientes": [],
        }

