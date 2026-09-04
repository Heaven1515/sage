"""
Orquesta el módulo Renombrado para Firma (ex-Prefirma):
  1. Seleccionar carpeta del escáner (tkinter, persiste en BD)
  2. Vigilar carpeta automáticamente — renombra PDFs al detectarlos
  3. Log en tiempo real de renombrados y errores
"""

import importlib
import logging
import os
from pathlib import Path

from sqlalchemy.orm import Session

from . import lector_controller, preview_controller, vigilador_controller
from .model import PrefirmaConfig, PrefirmaLog
from .schema import ArchivoItem, CarpetaRespuesta, DatosRepertorio, LogItem, PreviewRespuesta, RegistroManualRequest


logger = logging.getLogger(__name__)


# ── Carpeta del escáner ───────────────────────────────────────────────────────

def seleccionar_carpeta(db: Session) -> CarpetaRespuesta:
    """
    Abre un diálogo tkinter para que el usuario elija la carpeta del escáner.
    Guarda la ruta en BD y la retorna.
    """
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.wm_attributes("-topmost", True)

    ruta = filedialog.askdirectory(title="Seleccionar carpeta del escáner")
    root.destroy()

    if not ruta:
        config = _obtener_o_crear_config(db)
        return CarpetaRespuesta(ruta_carpeta=config.ruta_carpeta)

    config              = _obtener_o_crear_config(db)
    config.ruta_carpeta = ruta
    db.commit()
    logger.info("Carpeta escáner configurada: %s", ruta)
    return CarpetaRespuesta(ruta_carpeta=ruta)


def obtener_carpeta(db: Session) -> CarpetaRespuesta:
    """Retorna la carpeta guardada en BD (sin abrir diálogo)."""
    config = _obtener_o_crear_config(db)
    if _es_modo_demo(db) and not config.ruta_carpeta:
        return CarpetaRespuesta(ruta_carpeta=r"C:\SAGE_Demo\Scanner")
    return CarpetaRespuesta(ruta_carpeta=config.ruta_carpeta)


# ── Listado de archivos ───────────────────────────────────────────────────────

def listar_archivos(db: Session) -> list[ArchivoItem]:
    """Lista todos los PDFs pendientes (sin renombrar) en la carpeta configurada."""
    config = _obtener_o_crear_config(db)
    if not config.ruta_carpeta:
        return []

    carpeta = Path(config.ruta_carpeta)
    if not carpeta.exists():
        logger.warning("Carpeta no encontrada: %s", carpeta)
        return []

    archivos = sorted(
        [f.name for f in carpeta.iterdir() if f.suffix.lower() == ".pdf"]
    )
    return [ArchivoItem(nombre=n) for n in archivos]


# ── Lectura OCR del PDF ───────────────────────────────────────────────────────

def leer_pdf(nombre_archivo: str, db: Session) -> dict:
    """Aplica OCR a la primera página del PDF y retorna número de repertorio y año."""
    ruta = _ruta_pdf(nombre_archivo, db)
    return lector_controller.extraer_datos_pdf(str(ruta))


# ── Preview del PDF ───────────────────────────────────────────────────────────

def obtener_preview(nombre_archivo: str, db: Session) -> PreviewRespuesta:
    """Renderiza las páginas del PDF como imágenes base64 JPEG."""
    ruta = _ruta_pdf(nombre_archivo, db)
    imagenes = preview_controller.obtener_imagenes_pdf(str(ruta))
    return PreviewRespuesta(imagenes=imagenes)


# ── Búsqueda en vb_registro ───────────────────────────────────────────────────

def buscar_repertorio(numero: str, anio: str, db: Session) -> DatosRepertorio:
    """
    Busca el repertorio en vb_registro y retorna materia + fecha_escritura.
    """
    import importlib
    registro_model = importlib.import_module("modules.09_repertorios.registro_model")
    VBRegistro = registro_model.VBRegistro

    fila = (
        db.query(VBRegistro)
        .filter(VBRegistro.repertorio == numero, VBRegistro.anio == int(anio))
        .first()
    )

    if not fila:
        logger.info("Repertorio %s-%s no encontrado en vb_registro", numero, anio)
        return DatosRepertorio(encontrado=False)

    return DatosRepertorio(
        encontrado      = True,
        materia         = fila.materia,
        fecha_escritura = fila.fecha_escritura,
        nombre_cliente  = fila.nombre_cliente,
    )


# ── Registro manual en vb_registro ───────────────────────────────────────────

def registrar_manual(datos: RegistroManualRequest, db: Session) -> DatosRepertorio:
    """
    Guarda una escritura que no pasó por VB directamente en vb_registro.
    Permite que aparezca en el informe diario y en la planilla de carátulas.
    Si el WF ya existe, retorna advertencia pero permite el registro igualmente.
    """
    import importlib
    VBRegistro = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro

    existente = db.query(VBRegistro).filter(VBRegistro.wf == datos.wf.strip()).first()
    advertencia = None
    if existente:
        advertencia = f"El WF {datos.wf} ya estaba registrado. Se actualizaron sus datos."

    # Extraer mes desde la fecha DD-MM-YYYY
    mes = None
    partes = datos.fecha_escritura.split("-")
    if len(partes) == 3:
        try:
            mes = int(partes[1])
        except ValueError:
            pass

    if existente:
        # Actualizar el registro existente con los nuevos datos
        existente.nombre_cliente  = datos.nombre_cliente.strip().upper()
        existente.rut             = datos.rut.strip() if datos.rut else None
        existente.comuna          = datos.comuna.strip().upper()
        existente.materia         = datos.materia.strip().upper()
        existente.repertorio      = datos.repertorio.strip()
        existente.anio            = int(datos.anio)
        existente.fecha_escritura = datos.fecha_escritura.strip()
        existente.mes             = mes
        existente.cliente_notaria = datos.cliente_notaria or None
        existente.es_banlegal     = datos.es_banlegal
        db.commit()
        db.refresh(existente)
        registro = existente
    else:
        registro = VBRegistro(
            wf              = datos.wf.strip(),
            nombre_cliente  = datos.nombre_cliente.strip().upper(),
            rut             = datos.rut.strip() if datos.rut else None,
            comuna          = datos.comuna.strip().upper(),
            materia         = datos.materia.strip().upper(),
            repertorio      = datos.repertorio.strip(),
            anio            = int(datos.anio),
            fecha_escritura = datos.fecha_escritura.strip(),
            mes             = mes,
            cliente_notaria = datos.cliente_notaria or None,
            es_banlegal     = datos.es_banlegal,
        )
        db.add(registro)
        db.commit()
        db.refresh(registro)

    # Registrar en prefirma_log para que aparezca en el informe diario
    log = PrefirmaLog(
        nombre_archivo  = "(manual)",
        repertorio      = datos.repertorio.strip(),
        anho_repertorio = datos.anio.strip(),
        tipo_contrato   = datos.materia.strip().upper(),
        estado          = "ok",
        es_manual       = True,
        es_banlegal     = datos.es_banlegal,
    )
    db.add(log)
    db.commit()
    logger.info("Registro manual guardado — WF: %s, Repertorio: %s-%s, Banlegal: %s",
                datos.wf, datos.repertorio, datos.anio, datos.es_banlegal)

    return DatosRepertorio(
        encontrado      = True,
        materia         = registro.materia,
        fecha_escritura = registro.fecha_escritura,
        nombre_cliente  = registro.nombre_cliente,
        advertencia     = advertencia,
    )



# ── Historial ─────────────────────────────────────────────────────────────────

def obtener_logs(db: Session) -> list[LogItem]:
    """Lista las operaciones del día de hoy, más recientes primero."""
    from datetime import date
    from sqlalchemy import func
    hoy = date.today().isoformat()
    filas = (
        db.query(PrefirmaLog)
        .filter(func.date(PrefirmaLog.fecha_procesado) == hoy)
        .order_by(PrefirmaLog.fecha_procesado.desc())
        .all()
    )
    return [LogItem.model_validate(f) for f in filas]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _obtener_o_crear_config(db: Session) -> PrefirmaConfig:
    """
    Retorna la config de Prefirma (id=1). Si no existe la crea vacía.
    La ruta de carpeta la configura el usuario manualmente — no hay ningún
    valor predeterminado en el código.
    """
    config = db.query(PrefirmaConfig).filter_by(id=1).first()
    if config is None:
        config = PrefirmaConfig(id=1, activo=False, ruta_carpeta=None)
        db.add(config)
        db.commit()
    return config


def _ruta_pdf(nombre_archivo: str, db: Session) -> Path:
    """Construye y valida la ruta completa del PDF."""
    config = _obtener_o_crear_config(db)
    if not config.ruta_carpeta:
        raise RuntimeError("No hay carpeta del escáner configurada")
    ruta = Path(config.ruta_carpeta) / nombre_archivo
    if not ruta.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {ruta}")
    return ruta


# ── Modo automático ───────────────────────────────────────────────────────────

def _callback_auto(ruta_pdf_str: str) -> None:
    """
    Callback del vigilador: renombra un PDF automáticamente.
      1. OCR → extrae número de repertorio
      2. Busca en vb_registro → obtiene el número de OT
      3. Si lo encuentra: renombra a REPERTORIOZZZZ-OTXXXX.pdf, log 'ok'
      4. Si OCR falla: log 'error', el archivo queda intacto
      5. Si el repertorio no está en BD: log 'sin_datos', el archivo queda intacto
    """
    from database import SesionLocal

    nombre = Path(ruta_pdf_str).name
    carpeta = Path(ruta_pdf_str).parent
    db     = SesionLocal()
    log    = None
    try:
        # 1. OCR — solo necesitamos el número de repertorio
        datos  = lector_controller.extraer_datos_pdf(ruta_pdf_str)
        numero = datos.get("numero")
        anho   = datos.get("anho")

        if not numero:
            log = PrefirmaLog(
                nombre_archivo=nombre, estado="error",
                mensaje_error="OCR: repertorio no detectado en el PDF",
            )
            db.add(log); db.commit()
            logger.warning("RENOMBRAR | OCR sin repertorio: %s", nombre)
            return

        # 2. Buscar en vb_registro por repertorio para obtener el OT
        VBRegistro = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro
        consulta = db.query(VBRegistro).filter(VBRegistro.repertorio == numero)
        if anho:
            consulta = consulta.filter(VBRegistro.anio == int(anho))
        fila = consulta.first()

        if fila is None or fila.numero_ot is None:
            motivo = (
                f"Repertorio {numero} no encontrado en BD"
                if fila is None
                else f"Repertorio {numero} sin OT registrado — indexar planilla primero"
            )
            log = PrefirmaLog(
                nombre_archivo=nombre, repertorio=numero,
                anho_repertorio=anho, estado="sin_datos",
                mensaje_error=motivo,
            )
            db.add(log); db.commit()
            logger.warning("RENOMBRAR | %s: %s", nombre, motivo)
            return

        # 3. Construir nombre nuevo y renombrar en la misma carpeta
        nombre_nuevo = f"REPERTORIO{numero}-OT{fila.numero_ot}.pdf"
        ruta_nueva   = carpeta / nombre_nuevo
        os.rename(ruta_pdf_str, str(ruta_nueva))

        log = PrefirmaLog(
            nombre_archivo=nombre, repertorio=numero,
            anho_repertorio=anho, estado="ok",
            nombre_nuevo=nombre_nuevo,
        )
        db.add(log); db.commit()
        logger.info("RENOMBRAR | OK: %s → %s", nombre, nombre_nuevo)

    except Exception as exc:
        logger.error("RENOMBRAR | Error procesando %s: %s", nombre, exc)
        if log:
            log.estado        = "error"
            log.mensaje_error = str(exc)
            db.commit()
        else:
            try:
                db.add(PrefirmaLog(nombre_archivo=nombre, estado="error", mensaje_error=str(exc)))
                db.commit()
            except Exception:
                pass
    finally:
        db.close()


def iniciar_modo_auto(db: Session) -> dict:
    """Activa el vigilador de carpeta. Lanza ValueError si ya está activo."""
    config = _obtener_o_crear_config(db)
    if not config.ruta_carpeta:
        raise ValueError("Configura la carpeta del escáner antes de activar el modo automático")
    vigilador_controller.iniciar_vigilancia(_callback_auto, ruta=config.ruta_carpeta)
    config.activo = True
    db.commit()
    logger.info("Modo automático ACTIVADO — carpeta: %s", config.ruta_carpeta)
    return {"activo": True}


def detener_modo_auto(db: Session) -> dict:
    """Desactiva el vigilador de carpeta."""
    vigilador_controller.detener_vigilancia()
    config = _obtener_o_crear_config(db)
    config.activo = False
    db.commit()
    logger.info("Modo automático DESACTIVADO")
    return {"activo": False}


def estado_modo_auto(db: Session) -> dict:
    """Retorna si el modo automático está activo, más contadores del día."""
    from datetime import date
    from sqlalchemy import func

    activo = vigilador_controller.esta_activo()
    # Sincronizar BD por si el hilo cayó inesperadamente
    config = _obtener_o_crear_config(db)
    if config.activo != activo:
        config.activo = activo
        db.commit()

    hoy = date.today().isoformat()
    total_ok = db.query(PrefirmaLog).filter(
        PrefirmaLog.estado == "ok",
        func.date(PrefirmaLog.fecha_procesado) == hoy,
    ).count()
    total_errores = db.query(PrefirmaLog).filter(
        PrefirmaLog.estado == "error",
        func.date(PrefirmaLog.fecha_procesado) == hoy,
    ).count()

    return {"activo": activo, "total_renombrados": total_ok, "total_errores": total_errores}
