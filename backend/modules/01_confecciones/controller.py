"""
Módulo 01 — Confecciones de Borradores
Controller: lógica de negocio pura, sin HTTP.

Funciones:
  - parsear_excel        → lee el .xls del banco y retorna lista de ConfeccionCrear
  - cargar_confecciones  → inserta los WFs en la BD, omite duplicados
  - obtener_lista        → retorna WFs filtrados por actividad (o todos)
"""

import logging
from datetime import datetime
from html.parser import HTMLParser

from sqlalchemy.orm import Session

from .model import Confeccion
from .schema import ConfeccionCrear, ConfeccionRespuesta, ResultadoCarga

logger = logging.getLogger(__name__)

# ── Columnas esperadas en el Excel del Banco de Chile ────────────────────────
# Índices basados en el archivo Lista_Trabajo real — no cambiar sin autorización
_COL_CARPETA   = 0
_COL_RUT       = 3
_COL_NOMBRE    = 4
_COL_ACTIVIDAD = 5
_COL_FECHA_ESP = 7


# ── Parser HTML para los .xls del banco (formato HTML disfrazado) ────────────

class _ParserExcelBanco(HTMLParser):
    """
    El banco exporta los .xls como HTML con extensión falsa.
    Este parser extrae las filas de la tabla interna.
    """

    def __init__(self):
        super().__init__()
        self.filas: list[list[str]] = []
        self._fila_actual: list[str] = []
        self._celda_actual: str = ""
        self._en_celda: bool = False

    def handle_starttag(self, tag, attrs):
        if tag in ("td", "th"):
            self._en_celda = True
            self._celda_actual = ""
        elif tag == "tr":
            self._fila_actual = []

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self._fila_actual.append(self._celda_actual.strip())
            self._en_celda = False
        elif tag == "tr":
            if self._fila_actual:
                self.filas.append(self._fila_actual)

    def handle_data(self, data):
        if self._en_celda:
            self._celda_actual += data


# ── Helpers privados ─────────────────────────────────────────────────────────

def _parsear_fecha(texto: str) -> datetime | None:
    """
    Convierte el texto de fecha del banco (ej: '06-04-26 11:41') a datetime.
    Retorna None si el texto está vacío o no tiene el formato esperado.
    """
    if not texto:
        return None
    try:
        return datetime.strptime(texto.strip(), "%d-%m-%y %H:%M")
    except ValueError:
        logger.warning("Fecha con formato inesperado: '%s' — se omite", texto)
        return None


def _fila_a_confeccion(fila: list[str]) -> ConfeccionCrear | None:
    """
    Convierte una fila del Excel en un objeto ConfeccionCrear.
    Retorna None si la fila no tiene el mínimo de columnas esperadas.
    """
    if len(fila) <= _COL_FECHA_ESP:
        return None

    numero_carpeta = fila[_COL_CARPETA].strip()
    if not numero_carpeta:
        return None

    return ConfeccionCrear(
        numero_carpeta=numero_carpeta,
        rut=fila[_COL_RUT].strip(),
        nombre_cliente=fila[_COL_NOMBRE].strip().title(),
        actividad_actual=fila[_COL_ACTIVIDAD].strip(),
        fecha_esperada=_parsear_fecha(fila[_COL_FECHA_ESP]),
    )


# ── Funciones públicas del controller ────────────────────────────────────────

def parsear_excel(contenido: bytes) -> list[ConfeccionCrear]:
    """
    Lee el contenido binario del .xls del banco y extrae los WFs.
    Omite la fila de encabezado (índice 0) y filas malformadas.
    """
    try:
        texto = contenido.decode("latin-1")
    except Exception as e:
        logger.error("Error decodificando el archivo Excel: %s", e)
        raise ValueError("El archivo no pudo ser leído. Verifica que sea un Excel del Banco de Chile.")

    parser = _ParserExcelBanco()
    parser.feed(texto)

    # La fila 0 es el encabezado — se salta
    filas_datos = parser.filas[1:]
    confecciones: list[ConfeccionCrear] = []

    for fila in filas_datos:
        confeccion = _fila_a_confeccion(fila)
        if confeccion:
            confecciones.append(confeccion)

    logger.info("Excel parseado: %d filas leídas, %d válidas", len(filas_datos), len(confecciones))
    return confecciones


def cargar_confecciones(db: Session, confecciones: list[ConfeccionCrear]) -> ResultadoCarga:
    """
    Inserta los WFs en la BD. Si un numero_carpeta ya existe, lo omite.
    Retorna un resumen con el resultado de la carga.
    """
    insertados = 0
    duplicados = 0
    errores = 0

    for item in confecciones:
        try:
            # Verifica si el WF ya existe antes de intentar insertar
            existe = db.query(Confeccion).filter(
                Confeccion.numero_carpeta == item.numero_carpeta
            ).first()

            if existe:
                existe.actividad_actual = item.actividad_actual
                existe.fecha_esperada   = item.fecha_esperada
                db.commit()
                duplicados += 1
                continue

            registro = Confeccion(
                numero_carpeta=item.numero_carpeta,
                rut=item.rut,
                nombre_cliente=item.nombre_cliente,
                actividad_actual=item.actividad_actual,
                fecha_esperada=item.fecha_esperada,
            )
            db.add(registro)
            db.commit()
            insertados += 1

        except Exception as e:
            db.rollback()
            errores += 1
            logger.error("Error insertando WF '%s': %s", item.numero_carpeta, e)

    logger.info(
        "Carga finalizada — insertados: %d, duplicados: %d, errores: %d",
        insertados, duplicados, errores,
    )

    # Retorna todos los WFs del Excel (nuevos + duplicados) para que el frontend
    # pueda filtrar localmente y mostrar solo la carga actual
    numeros = [item.numero_carpeta for item in confecciones]
    wfs_en_excel = (
        db.query(Confeccion)
        .filter(Confeccion.numero_carpeta.in_(numeros))
        .order_by(Confeccion.fecha_esperada.asc())
        .all()
    )

    return ResultadoCarga(
        total_en_excel=len(confecciones),
        insertados=insertados,
        duplicados=duplicados,
        errores=errores,
        wfs_excel=[ConfeccionRespuesta.model_validate(r) for r in wfs_en_excel],
    )


def obtener_lista(
    db: Session,
    actividades: list[str] | None = None,
) -> list[ConfeccionRespuesta]:
    """
    Retorna los WFs almacenados en la BD.
    Si se entregan actividades, filtra solo los WFs que coincidan.
    Si actividades es None o lista vacía, retorna todos.
    """
    consulta = db.query(Confeccion)

    if actividades:
        consulta = consulta.filter(Confeccion.actividad_actual.in_(actividades))

    registros = consulta.order_by(Confeccion.fecha_esperada.asc()).all()

    return [ConfeccionRespuesta.model_validate(r) for r in registros]
