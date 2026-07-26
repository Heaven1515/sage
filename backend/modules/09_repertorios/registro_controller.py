"""
Módulo 09 — Toma de Repertorios / Registro de Datos
Controller: lógica de negocio pura, sin HTTP.

Funciones públicas:
  - indexar_sesion   → cruza Words + planilla de la sesión, guarda en vb_registro
  - listar_registros → retorna todo el repositorio, con filtros opcionales
"""

import logging
from pathlib import Path

from docx import Document
from sqlalchemy.orm import Session

import importlib
VBCarpetaConfig = importlib.import_module("modules.02_vb.carpeta_model").VBCarpetaConfig
VBEscritura = importlib.import_module("modules.02_vb.model").VBEscritura
_extraer_datos_word_vb = importlib.import_module("modules.02_vb.words_controller")._extraer_datos_word_vb

from .registro_model import VBRegistro
from .registro_schema import RegistroItem, ResultadoIndexar

logger = logging.getLogger(__name__)

_CARPETA_MATRIZ = "Vistos Buenos de Abogados"


# ── Helpers internos ──────────────────────────────────────────────────────────

def _obtener_ruta_carpeta(nombre_carpeta: str, db: Session) -> Path:
    """
    Retorna la ruta completa de una subcarpeta VB dado su nombre.
    Lanza ValueError si la carpeta no está configurada o no existe en disco.
    """
    config = db.query(VBCarpetaConfig).filter(VBCarpetaConfig.id == 1).first()
    if not config or not config.ruta_base:
        raise ValueError("La carpeta base no está configurada")

    ruta = Path(config.ruta_base) / _CARPETA_MATRIZ / nombre_carpeta
    if not ruta.exists() or not ruta.is_dir():
        raise ValueError(f"La carpeta '{nombre_carpeta}' no existe en disco")

    return ruta


def _leer_words_carpeta(ruta: Path, db: Session) -> list[dict]:
    """
    Lee todos los .doc/.docx de la carpeta y extrae: wf, nombre, materia, comuna.
    Cruza el WF con vb_escrituras para obtener el RUT.
    Retorna lista de dicts. Los archivos con error se omiten con log.
    """
    archivos = sorted(
        list(ruta.glob("*.docx")) + list(ruta.glob("*.doc"))
    )
    # Excluye la subcarpeta Completos
    archivos = [a for a in archivos if a.is_file()]

    resultados = []
    for archivo in archivos:
        try:
            doc = Document(str(archivo))
            datos = _extraer_datos_word_vb(doc)

            wf = datos.get("wf", "").strip()
            if not wf:
                continue

            # RUT preferido: el de la BD de escrituras cargadas por Excel
            registro_bd = db.query(VBEscritura).filter(
                VBEscritura.numero_carpeta == wf
            ).first()

            resultados.append({
                "wf": wf,
                "rut": registro_bd.rut if registro_bd else None,
                "nombre_cliente": datos.get("nombre_cliente", ""),
                "materia": datos.get("materia", ""),
                "comuna": datos.get("comuna", "SANTIAGO"),
            })
        except Exception as e:
            logger.warning("No se pudo leer '%s' para indexar: %s", archivo.name, e)

    return resultados


def _nombre_carpeta_a_fecha_str(nombre_carpeta: str) -> str | None:
    """
    Convierte 'VB DD-MM-YYYY' → 'DD-MM-YYYY'.
    Retorna None si el formato no coincide.
    """
    partes = nombre_carpeta.strip().split(" ", 1)
    if len(partes) == 2 and partes[0] == "VB":
        return partes[1]
    return None


# ── Función pública principal ─────────────────────────────────────────────────

def indexar_sesion(
    nombre_carpeta: str,
    items_repertorio: list[dict],
    db: Session,
    usuario_id: int | None = None,
) -> ResultadoIndexar:
    """
    Guarda en vb_registro los datos cruzados de planilla + Words.

    Fuente primaria: planilla (WF, nombre, RUT, materia, repertorio, fecha).
    Fuente secundaria: Words de la carpeta (solo para obtener la comuna).

    Reglas:
      - Si hay planilla y hay Word → registro completo (con comuna y repertorio)
      - Si hay planilla pero no hay Word → se guarda igual (comuna = None)
      - Si hay Word pero no hay planilla → se guarda igual (sin repertorio)
      - Si el WF ya existe en vb_registro → se actualiza (idempotente)
      - No falla si la carpeta no tiene Words (Words son opcionales)

    items_repertorio: lista de dicts con claves:
      wf, repertorio, anio, dia, mes, nombre_cliente, materia, rut (opcional)
    """
    ruta = _obtener_ruta_carpeta(nombre_carpeta, db)
    fecha_str = _nombre_carpeta_a_fecha_str(nombre_carpeta)

    # Leer Words de la carpeta para obtener comuna (no falla si no hay ninguno)
    datos_words = _leer_words_carpeta(ruta, db)
    indice_words: dict[str, dict] = {d["wf"]: d for d in datos_words}

    # Índice WF → datos planilla
    indice_planilla: dict[str, dict] = {
        item["wf"]: item for item in items_repertorio
    }

    # Unión de todos los WFs: los de la planilla y los de los Words
    todos_wf = set(indice_planilla.keys()) | set(indice_words.keys())

    contadores = {"indexados": 0, "actualizados": 0}
    sin_repertorio = 0
    sin_word = 0

    for wf in todos_wf:
        planilla = indice_planilla.get(wf)
        word     = indice_words.get(wf)

        if not planilla and not word:
            continue

        # Datos preferidos: planilla > Word > None
        nombre_cliente = (
            (planilla or {}).get("nombre_cliente")
            or (word or {}).get("nombre_cliente", "")
        )
        # RUT: viene de la planilla (campo Compareciente), con fallback a vb_escrituras (via word)
        rut = (
            (planilla or {}).get("rut")
            or (word or {}).get("rut")
        )
        materia = (
            (planilla or {}).get("materia")
            or (word or {}).get("materia", "")
        )
        # Comuna solo viene del Word (el PDF/Word tiene la cláusula del Conservador)
        # Si no hay Word para este WF, queda vacía (no va al JSON de Santiago)
        comuna = (word or {}).get("comuna") or ""

        repertorio     = (planilla or {}).get("repertorio") or None
        anio           = (planilla or {}).get("anio") or None
        dia            = (planilla or {}).get("dia")
        mes            = (planilla or {}).get("mes")
        # Col F de la planilla: quién encargó el alzamiento
        cliente_notaria = (planilla or {}).get("cliente_notaria") or None

        fecha_escritura = (
            f"{dia:02d}-{mes:02d}-{anio}" if dia and mes and anio else fecha_str
        )

        if not repertorio:
            sin_repertorio += 1
        if not word:
            sin_word += 1

        # Buscar registro existente: mismo WF y mismo repertorio (o sin repertorio)
        if repertorio:
            existente = (
                db.query(VBRegistro)
                .filter(VBRegistro.wf == wf, VBRegistro.repertorio == repertorio)
                .first()
            )
        else:
            existente = (
                db.query(VBRegistro)
                .filter(VBRegistro.wf == wf, VBRegistro.repertorio.is_(None))
                .first()
            )

        if existente:
            # Actualiza preservando campos ya completos y sin tocar los de Postfirma
            existente.rut             = rut or existente.rut
            existente.nombre_cliente  = nombre_cliente or existente.nombre_cliente
            existente.comuna          = comuna or existente.comuna
            existente.materia         = materia or existente.materia
            existente.repertorio      = repertorio or existente.repertorio
            existente.anio            = anio or existente.anio
            existente.mes             = mes or existente.mes
            existente.fecha_escritura = fecha_escritura or existente.fecha_escritura
            existente.cliente_notaria = cliente_notaria or existente.cliente_notaria
            contadores["actualizados"] += 1
        else:
            db.add(VBRegistro(
                wf              = wf,
                rut             = rut,
                nombre_cliente  = nombre_cliente,
                comuna          = comuna,
                materia         = materia,
                repertorio      = repertorio,
                anio            = anio,
                mes             = mes,
                fecha_escritura = fecha_escritura,
                cliente_notaria = cliente_notaria,
                usuario_id      = usuario_id,
            ))
            contadores["indexados"] += 1

    db.commit()

    total = db.query(VBRegistro).count()

    logger.info(
        "Indexar '%s': %d nuevos, %d actualizados, %d sin repertorio, %d sin Word",
        nombre_carpeta, contadores["indexados"], contadores["actualizados"],
        sin_repertorio, sin_word,
    )

    return ResultadoIndexar(
        indexados      = contadores["indexados"],
        actualizados   = contadores["actualizados"],
        sin_repertorio = sin_repertorio,
        sin_word       = sin_word,
        total          = total,
    )


def listar_registros(
    db: Session,
    busqueda: str | None = None,
    anio: int | None = None,
) -> list[RegistroItem]:
    """
    Retorna todos los registros del repositorio permanente.
    Filtros opcionales:
      - busqueda: filtra por WF, RUT o nombre del cliente (contiene, insensible a mayúsculas)
      - anio: filtra por año de la escritura
    """
    consulta = db.query(VBRegistro)

    if anio:
        consulta = consulta.filter(VBRegistro.anio == anio)

    if busqueda:
        termino = f"%{busqueda.lower()}%"
        from sqlalchemy import func as sqlfunc
        consulta = consulta.filter(
            sqlfunc.lower(VBRegistro.wf).like(termino)
            | sqlfunc.lower(VBRegistro.nombre_cliente).like(termino)
            | sqlfunc.lower(VBRegistro.rut).like(termino)
        )

    registros = consulta.order_by(VBRegistro.fecha_indexado.desc()).all()

    return [
        RegistroItem(
            id=r.id,
            wf=r.wf,
            rut=r.rut,
            nombre_cliente=r.nombre_cliente,
            comuna=r.comuna,
            materia=r.materia,
            repertorio=r.repertorio,
            anio=r.anio,
            mes=r.mes,
            fecha_escritura=r.fecha_escritura,
            fecha_indexado=r.fecha_indexado,
            numero_caratula=r.numero_caratula,
            firma_electronica=r.firma_electronica,
            cliente_notaria=r.cliente_notaria,
            es_banlegal=r.es_banlegal,
        )
        for r in registros
    ]
