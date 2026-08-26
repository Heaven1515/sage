"""
Orquesta el módulo Prefirma (flujo manual asistido):
  1. Seleccionar carpeta del escáner (tkinter, persiste en BD)
  2. Listar PDFs disponibles en esa carpeta
  3. Generar preview de un PDF seleccionado
  4. Buscar datos del repertorio en vb_registro
  5. Enviar formulario al servidor de la notaría y registrar resultado
"""

import importlib
import logging
import os
import random
from pathlib import Path

from sqlalchemy.orm import Session

from . import formulario_controller, lector_controller, preview_controller, vigilador_controller
from .model import PrefirmaConfig, PrefirmaLog
from .schema import ArchivoItem, CarpetaRespuesta, DatosRepertorio, LogItem, PreviewRespuesta, RegistroManualRequest


def _sin_tildes(texto: str) -> str:
    import unicodedata
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )

logger = logging.getLogger(__name__)


def _es_modo_demo(db: Session) -> bool:
    """Consulta si el modo demo está activo en la configuración global."""
    cfg_mod = importlib.import_module("modules.07_configuracion.controller")
    return cfg_mod.es_modo_demo(db)


# Archivos ficticios para el modo demo (simulan PDFs escaneados)
_DEMO_ARCHIVOS = [
    "20260523091500001.pdf",
    "20260523093000002.pdf",
    "20260523094500003.pdf",
    "20260523100000004.pdf",
    "20260523101500005.pdf",
]


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
    """
    Lista todos los PDFs en la carpeta configurada.
    En modo demo: retorna archivos ficticios sin acceder al disco.
    """
    if _es_modo_demo(db):
        # Excluir archivos que ya se "enviaron" hoy (están en el log con estado 'ok')
        from datetime import date
        from sqlalchemy import func
        hoy = date.today().isoformat()
        enviados = {
            r.nombre_archivo for r in
            db.query(PrefirmaLog.nombre_archivo)
            .filter(PrefirmaLog.estado == "ok", func.date(PrefirmaLog.fecha_procesado) == hoy)
            .all()
        }
        pendientes = [n for n in _DEMO_ARCHIVOS if n not in enviados]
        return [ArchivoItem(nombre=n) for n in pendientes]

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
    """
    Aplica OCR a la primera página del PDF y retorna:
      - numero: número de repertorio (str) o None
      - anho:   año del repertorio (str) o None
      - tipo_contrato: título de la escritura (str) o None
    En modo demo: retorna datos ficticios basados en vb_registro.
    """
    if _es_modo_demo(db):
        return _leer_pdf_demo(nombre_archivo, db)

    ruta = _ruta_pdf(nombre_archivo, db)
    return lector_controller.extraer_datos_pdf(str(ruta))


def _leer_pdf_demo(nombre_archivo: str, db: Session) -> dict:
    """Simula OCR retornando un repertorio que exista en vb_registro."""
    VBRegistro = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro
    from datetime import date
    hoy = date.today()

    # Buscar un repertorio del mes actual que tenga datos completos
    registros = (
        db.query(VBRegistro)
        .filter(VBRegistro.mes == hoy.month, VBRegistro.anio == hoy.year, VBRegistro.repertorio.isnot(None))
        .limit(20)
        .all()
    )
    if registros:
        # Asignar un repertorio distinto según el índice del archivo
        idx = _DEMO_ARCHIVOS.index(nombre_archivo) if nombre_archivo in _DEMO_ARCHIVOS else 0
        reg = registros[idx % len(registros)]
        return {
            "numero": reg.repertorio,
            "anho": str(reg.anio),
            "tipo_contrato": _sin_tildes(reg.materia or "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        }

    return {
        "numero": "3000",
        "anho": str(hoy.year),
        "tipo_contrato": "ALZAMIENTO DE HIPOTECA Y PROHIBICION",
    }


# ── Preview del PDF ───────────────────────────────────────────────────────────

def obtener_preview(nombre_archivo: str, db: Session) -> PreviewRespuesta:
    """
    Renderiza todas las páginas del PDF seleccionado.
    En modo demo: genera una imagen placeholder con texto descriptivo.
    """
    if _es_modo_demo(db):
        return _preview_demo(nombre_archivo, db)

    ruta = _ruta_pdf(nombre_archivo, db)
    imagenes = preview_controller.obtener_imagenes_pdf(str(ruta))
    return PreviewRespuesta(imagenes=imagenes)


def _preview_demo(nombre_archivo: str, db: Session) -> PreviewRespuesta:
    """Genera una imagen placeholder para el modo demo."""
    import base64
    import io

    # Obtener datos del repertorio para mostrar info realista
    datos_ocr = _leer_pdf_demo(nombre_archivo, db)
    rep = datos_ocr.get("numero", "3000")
    anho = datos_ocr.get("anho", "2026")
    tipo = datos_ocr.get("tipo_contrato", "ALZAMIENTO")

    # Buscar datos del cliente en vb_registro
    VBRegistro = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro
    reg = (
        db.query(VBRegistro)
        .filter(VBRegistro.repertorio == rep, VBRegistro.anio == int(anho))
        .first()
    )
    nombre_cliente = reg.nombre_cliente if reg else "CLIENTE DEMO"
    comuna = reg.comuna if reg else "SANTIAGO"

    try:
        from PIL import Image, ImageDraw, ImageFont
        # Crear imagen que simula una escritura escaneada
        img = Image.new("RGB", (595, 842), "#FFFFFF")
        draw = ImageDraw.Draw(img)

        # Encabezado
        draw.rectangle([0, 0, 595, 80], fill="#1565c0")
        draw.text((297, 25), "ESCRITURA PÚBLICA", fill="white", anchor="mt")
        draw.text((297, 50), f"Repertorio N° {rep}-{anho}", fill="white", anchor="mt")

        # Contenido
        y = 120
        lineas = [
            f"TIPO: {tipo}",
            f"",
            f"COMPARECIENTE:",
            f"  {nombre_cliente}",
            f"",
            f"CONSERVADOR DE BIENES RAÍCES DE {comuna}",
            f"",
            f"En Santiago de Chile, a veintitrés de mayo",
            f"de dos mil veintiséis, ante mí,",
            f"CAROLINA ELIZABETH PIÑA CUEVAS,",
            f"Notario Público, Titular de la 33ª Notaría",
            f"de Santiago...",
            f"",
            f"[DOCUMENTO DE DEMOSTRACIÓN]",
        ]
        for linea in lineas:
            draw.text((40, y), linea, fill="#333333")
            y += 22

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buf.getvalue()).decode()
        return PreviewRespuesta(imagenes=[img_b64])

    except ImportError:
        # Si Pillow no está disponible, retornar lista vacía
        logger.warning("Pillow no disponible para preview demo")
        return PreviewRespuesta(imagenes=[])


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


# ── Envío del formulario ──────────────────────────────────────────────────────

def enviar_y_registrar(
    nombre_archivo: str,
    repertorio:     str,
    anho:           str,
    tipo_contrato:  str,
    fecha_dia:      int,
    fecha_mes:      int,
    fecha_anio:     int,
    db:             Session,
) -> LogItem:
    """
    Flujo completo para un PDF que el usuario aprobó:
      1. Crea log con estado 'procesando'
      2. Envía al formulario web de la notaría
      3. Elimina el archivo
      4. Actualiza log a 'ok' (o 'error' si algo falla)
    En modo demo: registra como 'ok' sin enviar ni borrar.
    """
    demo = _es_modo_demo(db)

    log = PrefirmaLog(
        nombre_archivo  = nombre_archivo,
        repertorio      = repertorio,
        anho_repertorio = anho,
        tipo_contrato   = tipo_contrato,
        estado          = "procesando",
    )
    db.add(log)
    db.commit()

    if demo:
        # Modo demo: simular envío exitoso sin tocar archivos ni red
        import time
        time.sleep(0.5)  # breve pausa para que se vea natural
        log.estado = "ok"
        db.commit()
        db.refresh(log)
        logger.info("DEMO | PDF simulado como enviado: %s (rep %s-%s)", nombre_archivo, repertorio, anho)
        return LogItem.model_validate(log)

    ruta   = _ruta_pdf(nombre_archivo, db)
    config = _obtener_o_crear_config(db)
    try:
        formulario_controller.enviar_formulario(
            ruta_pdf      = str(ruta),
            numero        = repertorio,
            anho          = anho,
            tipo_contrato = tipo_contrato,
            fecha_dia     = fecha_dia,
            fecha_mes     = fecha_mes,
            fecha_anio    = fecha_anio,
            url           = config.url_formulario or None,
        )
        os.remove(ruta)
        log.estado = "ok"
        db.commit()
        logger.info("PDF enviado y eliminado: %s", nombre_archivo)

    except Exception as exc:
        log.estado        = "error"
        log.mensaje_error = str(exc)
        db.commit()
        logger.error("Error enviando %s: %s", nombre_archivo, exc)

    db.refresh(log)
    return LogItem.model_validate(log)


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
    Callback del vigilador: procesa un PDF automáticamente.
      1. OCR → extrae repertorio, año, tipo contrato
      2. Busca en vb_registro → obtiene materia + fecha_escritura
      3. Si lo encuentra: envía al formulario, elimina PDF, log 'ok'
      4. Si no lo encuentra: log 'sin_datos', deja el archivo para proceso manual
    """
    from database import SesionLocal
    import importlib

    nombre = Path(ruta_pdf_str).name
    db     = SesionLocal()
    log    = None
    try:
        # 1. OCR
        datos  = lector_controller.extraer_datos_pdf(ruta_pdf_str)
        numero = datos.get("numero")
        anho   = datos.get("anho")
        tipo_ocr = datos.get("tipo_contrato")

        if not numero or not anho:
            log = PrefirmaLog(nombre_archivo=nombre, estado="error",
                              mensaje_error="OCR: repertorio no detectado en el PDF")
            db.add(log); db.commit()
            logger.warning("AUTO | OCR sin repertorio: %s", nombre)
            return

        # 2. Buscar en vb_registro
        VBRegistro = importlib.import_module("modules.09_repertorios.registro_model").VBRegistro
        fila = (db.query(VBRegistro)
                .filter(VBRegistro.repertorio == numero, VBRegistro.anio == int(anho))
                .first())

        if fila is None:
            log = PrefirmaLog(nombre_archivo=nombre, repertorio=numero,
                              anho_repertorio=anho, tipo_contrato=tipo_ocr,
                              estado="sin_datos",
                              mensaje_error=f"Repertorio {numero}-{anho} no en vb_registro — procesar manual")
            db.add(log); db.commit()
            logger.warning("AUTO | Sin datos BD: %s-%s (%s)", numero, anho, nombre)
            return

        # 3. Obtener fecha de escritura
        partes = (fila.fecha_escritura or "").split("-")
        if len(partes) != 3:
            log = PrefirmaLog(nombre_archivo=nombre, repertorio=numero,
                              anho_repertorio=anho, estado="error",
                              mensaje_error="Sin fecha de escritura en vb_registro")
            db.add(log); db.commit()
            return

        dia, mes, anio_fecha = int(partes[0]), int(partes[1]), int(partes[2])
        tipo_final = _sin_tildes(fila.materia or tipo_ocr or "")
        config     = _obtener_o_crear_config(db)

        # 4. Crear log y enviar formulario
        log = PrefirmaLog(nombre_archivo=nombre, repertorio=numero,
                          anho_repertorio=anho, tipo_contrato=tipo_final,
                          estado="procesando")
        db.add(log); db.commit()

        formulario_controller.enviar_formulario(
            ruta_pdf      = ruta_pdf_str,
            numero        = numero,
            anho          = anho,
            tipo_contrato = tipo_final,
            fecha_dia     = dia,
            fecha_mes     = mes,
            fecha_anio    = anio_fecha,
            url           = config.url_formulario or None,
        )
        os.remove(ruta_pdf_str)
        log.estado = "ok"
        db.commit()
        logger.info("AUTO | OK: %s (repertorio %s-%s)", nombre, numero, anho)

    except Exception as exc:
        logger.error("AUTO | Error procesando %s: %s", nombre, exc)
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

    return {"activo": activo, "total_ok": total_ok, "total_errores": total_errores}
