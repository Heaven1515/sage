"""
Módulo 02 — VB / Lectura de Words
Controller: lógica de negocio pura, sin HTTP.

Funciones públicas:
  - listar_carpetas_disponibles → lista subcarpetas VB dentro de la carpeta matriz
  - leer_words_carpeta          → lee todos los .docx, extrae datos, cruza con BD para RUT
"""

import logging
from pathlib import Path

from docx import Document
from sqlalchemy.orm import Session

from .carpeta_model import VBCarpetaConfig
from .model import VBEscritura
from .words_schema import CarpetasDisponibles, WordItem

logger = logging.getLogger(__name__)

_NOMBRE_CARPETA_MATRIZ = "Vistos Buenos de Abogados"


# ── Helpers de extracción (Words VB ya formateados, sin tabla interna) ────────

def _extraer_datos_word_vb(doc: Document) -> dict[str, str]:
    """
    Extrae WF, nombre del cliente y comuna de un Word VB ya formateado.

    Estructura esperada de párrafos no vacíos:
      [0] D.T. /6 REPERTORIO Nº
      [1] Abogado Redactor: <nombre>
      [2] WF <número>
      [3] <COMUNA>
      [4] ALZAMIENTO...
      [5] BANCO DE CHILE
      [6] A
      [7] <NOMBRE CLIENTE>
      ...

    Lanza ValueError si no encuentra WF o nombre del cliente.
    """
    no_vacios = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    datos: dict[str, str] = {}

    # WF: primer párrafo que empieza con "WF " (insensible a mayúsculas)
    for texto in no_vacios:
        if texto.upper().startswith("WF "):
            datos["wf"] = texto[3:].strip()
            break

    # Nombre cliente: párrafo inmediatamente posterior al párrafo que solo dice "A"
    for i, texto in enumerate(no_vacios):
        if texto.strip() == "A" and i + 1 < len(no_vacios):
            datos["nombre_cliente"] = no_vacios[i + 1]
            break

    # Materia: párrafo inmediatamente anterior a "BANCO DE CHILE"
    # Ej: "ALZAMIENTO DE HIPOTECA", "ALZAMIENTO DE PRENDA Y PROHIBICION SOBRE VEHICULO"
    for i, texto in enumerate(no_vacios):
        if texto.upper() == "BANCO DE CHILE" and i > 0:
            datos["materia"] = no_vacios[i - 1]
            break

    # Comuna: cuarto párrafo no vacío (índice 3), que el sistema siempre coloca ahí
    if len(no_vacios) > 3:
        datos["comuna"] = no_vacios[3]

    if "wf" not in datos or "nombre_cliente" not in datos:
        raise ValueError(
            "No se encontraron los campos WF o nombre del cliente en el documento"
        )

    return datos


# ── Funciones públicas del controller ────────────────────────────────────────

def listar_carpetas_disponibles(db: Session) -> CarpetasDisponibles:
    """
    Retorna las subcarpetas diarias dentro de 'Vistos Buenos de Abogados',
    ordenadas de más reciente a más antigua.
    Si la carpeta matriz no existe o no está configurada, retorna lista vacía.
    """
    config = db.query(VBCarpetaConfig).filter(VBCarpetaConfig.id == 1).first()
    if not config or not config.ruta_base:
        return CarpetasDisponibles(carpetas=[], ruta_matriz=None)

    ruta_matriz = Path(config.ruta_base) / _NOMBRE_CARPETA_MATRIZ
    if not ruta_matriz.exists():
        return CarpetasDisponibles(carpetas=[], ruta_matriz=str(ruta_matriz))

    # Solo subcarpetas cuyo nombre empieza con "VB " (las creadas por el sistema)
    carpetas = sorted(
        [d.name for d in ruta_matriz.iterdir() if d.is_dir() and d.name.startswith("VB ")],
        reverse=True,
    )
    return CarpetasDisponibles(carpetas=carpetas, ruta_matriz=str(ruta_matriz))


def leer_words_carpeta(nombre_carpeta: str, db: Session) -> list[WordItem]:
    """
    Lee todos los archivos .docx dentro de la subcarpeta VB indicada.
    Por cada archivo:
      1. Extrae WF, nombre cliente y RUT desde la tabla interna
      2. Extrae la comuna del Conservador desde el texto del documento
      3. Cruza el WF con vb_escrituras para obtener el RUT oficial de la BD
         (si no está en BD, usa el RUT del Word como respaldo)
    Los archivos con error se omiten con log de advertencia (no detiene el proceso).
    Lanza ValueError si la carpeta no existe o no está configurada.
    """
    config = db.query(VBCarpetaConfig).filter(VBCarpetaConfig.id == 1).first()
    if not config or not config.ruta_base:
        raise ValueError("La carpeta base no está configurada")

    ruta_carpeta = Path(config.ruta_base) / _NOMBRE_CARPETA_MATRIZ / nombre_carpeta
    if not ruta_carpeta.exists() or not ruta_carpeta.is_dir():
        raise ValueError(f"La carpeta '{nombre_carpeta}' no existe en la ruta configurada")

    # Acepta tanto .docx como .doc (el banco puede entregar cualquiera de los dos)
    archivos = sorted(
        list(ruta_carpeta.glob("*.docx")) + list(ruta_carpeta.glob("*.doc"))
    )
    if not archivos:
        raise ValueError(
            f"No se encontraron archivos Word (.doc/.docx) en: {ruta_carpeta}"
        )

    resultados: list[WordItem] = []
    errores: list[str] = []

    for archivo in archivos:
        try:
            doc = Document(str(archivo))
            datos = _extraer_datos_word_vb(doc)

            wf = datos.get("wf", "").strip()
            nombre = datos.get("nombre_cliente", "").strip()
            comuna = datos.get("comuna", "SANTIAGO")
            rut_word = datos.get("rut", None)

            # RUT preferido: el de la BD. Respaldo: el que está en el Word
            registro = db.query(VBEscritura).filter(
                VBEscritura.numero_carpeta == wf
            ).first()

            materia = datos.get("materia", "SIN MATERIA").strip()

            resultados.append(WordItem(
                archivo=archivo.name,
                wf=wf,
                nombre_cliente=nombre,
                materia=materia,
                comuna=comuna,
                rut=registro.rut if registro else rut_word,
                en_bd=registro is not None,
            ))

        except Exception as e:
            # No silenciar: incluir el word con WF del nombre de archivo para que
            # aparezca en la planilla aunque el documento no tenga estructura esperada
            try:
                wf_fallback = archivo.stem.split("_")[0].strip()
            except Exception:
                wf_fallback = archivo.stem
            errores.append(f"{archivo.name}: {e}")
            logger.warning(
                "No se pudo procesar '%s' correctamente (%s) — "
                "incluyendo con wf='%s' y materia SIN_MATERIA",
                archivo.name, e, wf_fallback,
            )
            resultados.append(WordItem(
                archivo=archivo.name,
                wf=wf_fallback,
                nombre_cliente="",
                materia="SIN_MATERIA",
                comuna="SANTIAGO",
                rut=None,
                en_bd=False,
            ))

    logger.info(
        "Carpeta '%s': %d encontrados, %d procesados, %d con error",
        nombre_carpeta, len(archivos), len(resultados), len(errores),
    )

    # Si todos fallaron, avisar con detalle para que no sea un silencio invisible
    if not resultados and errores:
        raise ValueError(
            f"Se encontraron {len(archivos)} archivo(s) pero ninguno pudo leerse. "
            f"Primer error: {errores[0]}"
        )

    return resultados
