"""
Módulo 01 — Confecciones de Borradores
Routes: endpoints FastAPI.

Solo recibe la petición HTTP, llama al controller y retorna la respuesta.
Sin lógica de negocio aquí.

Endpoints:
  POST /confecciones/subir-excel  → carga un Excel del banco
  GET  /confecciones/             → retorna lista filtrada por actividades
  POST /confecciones/formatear    → formatea un .docx de borrador
"""

import io
import logging
import os
import re
import tempfile
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import obtener_db
from .controller import cargar_confecciones, obtener_lista, parsear_excel
from .formatear_controller import formatear_documento
from .model import Confeccion
from .schema import ConfeccionRespuesta, ResultadoCarga

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/confecciones", tags=["Confecciones"])


def _doc_a_docx(contenido_doc: bytes) -> bytes:
    """Convierte un .doc binario a .docx usando Word COM (solo Windows)."""
    import win32com.client
    import pythoncom

    pythoncom.CoInitialize()
    try:
        fd_in,  ruta_in  = tempfile.mkstemp(suffix=".doc")
        fd_out, ruta_out = tempfile.mkstemp(suffix=".docx")
        os.close(fd_in)
        os.close(fd_out)
        os.unlink(ruta_out)  # Word exige que el destino no exista

        with open(ruta_in, "wb") as f:
            f.write(contenido_doc)

        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        try:
            doc = word.Documents.Open(ruta_in)
            doc.SaveAs2(ruta_out, FileFormat=16)  # 16 = wdFormatXMLDocument (.docx)
            doc.Close(False)
        finally:
            word.Quit()

        with open(ruta_out, "rb") as f:
            return f.read()
    finally:
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass
        for ruta in (ruta_in, ruta_out):
            try:
                os.unlink(ruta)
            except OSError:
                pass


# ── POST /confecciones/subir-excel ───────────────────────────────────────────

@router.post(
    "/subir-excel",
    response_model=ResultadoCarga,
    summary="Sube el Excel del Banco de Chile y carga los WFs en la BD",
)
async def subir_excel(
    archivo: Annotated[UploadFile, File(description="Archivo .xls exportado del sistema del banco")],
    db: Session = Depends(obtener_db),
):
    """
    Recibe el .xls del banco, lo parsea y guarda los WFs nuevos en la BD.
    Los WFs duplicados (mismo N° Carpeta) se omiten sin error.
    """
    # Valida que sea un archivo .xls antes de procesarlo
    if not archivo.filename or not archivo.filename.lower().endswith(".xls"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .xls")

    try:
        contenido = await archivo.read()
        confecciones = parsear_excel(contenido)
        resultado = cargar_confecciones(db, confecciones)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Error inesperado al subir Excel: %s", e)
        raise HTTPException(status_code=500, detail="Error interno al procesar el archivo")

    return resultado


# ── GET /confecciones/ ───────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=list[ConfeccionRespuesta],
    summary="Retorna los WFs almacenados, con filtro opcional por actividad",
)
def listar_confecciones(
    actividades: Annotated[
        list[str] | None,
        Query(description="Actividades a filtrar. Se pueden enviar múltiples: ?actividades=X&actividades=Y"),
    ] = None,
    db: Session = Depends(obtener_db),
):
    """
    Retorna todos los WFs de la BD.
    Si se pasan actividades como query params, filtra solo los que coincidan.
    """
    try:
        return obtener_lista(db, actividades)
    except Exception as e:
        logger.error("Error al obtener lista de confecciones: %s", e)
        raise HTTPException(status_code=500, detail="Error interno al obtener los datos")


# ── POST /confecciones/formatear ─────────────────────────────────────────────

@router.post(
    "/formatear",
    summary="Formatea un borrador .docx a escritura pública y lo retorna como descarga",
)
async def formatear(
    archivo:    Annotated[UploadFile, File(description="Archivo .docx sin formato")],
    apo1_id:   Annotated[str, Form(description="ID del primer apoderado BDC, o 'ronnie'/'felix' para Banlegal")],
    notario_id: Annotated[str, Form(description="ID del notario autorizante")],
    apo2_id:   Annotated[str | None, Form(description="ID del segundo apoderado BDC; omitir para Banlegal")] = None,
    db: Session = Depends(obtener_db),
):
    """
    Recibe un borrador .docx sin formato, aplica el proceso de formateo
    notarial y retorna el archivo formateado como descarga directa.
    También registra la fecha de formateo en confecciones.fecha_formateado.

    El archivo de salida tiene:
    - Tipografía Courier New 13pt, doble espacio, página oficio
    - Comparecencia con el notario y apoderados seleccionados
    - Números convertidos a letras, abreviaturas expandidas
    - Formato visual (negritas y subrayados) según norma notarial
    """
    nombre_lower = (archivo.filename or "").lower()
    if not nombre_lower.endswith(".docx") and not nombre_lower.endswith(".doc"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .docx o .doc")

    try:
        contenido = await archivo.read()
        if nombre_lower.endswith(".doc"):
            try:
                contenido = _doc_a_docx(contenido)
            except Exception as e:
                logger.error("Error convirtiendo .doc a .docx: %s", e)
                raise ValueError("No se pudo convertir el archivo .doc. Asegúrate de que Microsoft Word esté instalado.")
        resultado, wf = formatear_documento(contenido, apo1_id, notario_id, apo2_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Error inesperado al formatear '%s': %s", archivo.filename, e)
        raise HTTPException(status_code=500, detail="Error interno al formatear el documento")

    # Registrar fecha de formateo en la BD para la tarjeta de borradores del dashboard
    if wf:
        try:
            registro = db.query(Confeccion).filter(Confeccion.numero_carpeta == wf).first()
            if registro:
                registro.fecha_formateado = datetime.now()
                db.commit()
        except Exception as e:
            logger.warning("No se pudo registrar fecha_formateado para WF %s: %s", wf, e)

    nombre_base   = re.sub(r"\.(docx|doc)$", "", archivo.filename, flags=re.IGNORECASE)
    nombre_salida = f"{nombre_base}_FORMATEADO.docx"
    return StreamingResponse(
        io.BytesIO(resultado),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{nombre_salida}"'},
    )
