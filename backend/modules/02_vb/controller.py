"""
Módulo 02 — VB / Escrituras
Controller: lógica de negocio pura, sin HTTP.

Funciones:
  - parsear_excel      → lee el .xls del banco y retorna lista de VBEscrituraCrear
  - cargar_escrituras  → inserta los WFs en la BD, omite duplicados
  - obtener_lista      → retorna todos los WFs ordenados por fecha esperada
"""

import logging
from datetime import datetime
from html.parser import HTMLParser

from sqlalchemy.orm import Session

from .model import VBEscritura, VBSnapshotFila
from .schema import VBEscrituraCrear, VBEscrituraRespuesta, ResultadoCargaVB

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


def _fila_a_escritura(fila: list[str]) -> VBEscrituraCrear | None:
    """
    Convierte una fila del Excel en un objeto VBEscrituraCrear.
    Retorna None si la fila no tiene el mínimo de columnas esperadas.
    """
    if len(fila) <= _COL_FECHA_ESP:
        return None

    numero_carpeta = fila[_COL_CARPETA].strip()
    if not numero_carpeta:
        return None

    return VBEscrituraCrear(
        numero_carpeta=numero_carpeta,
        rut=fila[_COL_RUT].strip(),
        nombre_cliente=fila[_COL_NOMBRE].strip().title(),
        actividad_actual=fila[_COL_ACTIVIDAD].strip().upper(),
        fecha_esperada=_parsear_fecha(fila[_COL_FECHA_ESP]),
    )


# ── Helper: snapshot de todas las filas del Excel ────────────────────────────

def _actualizar_snapshot(
    db: Session,
    escrituras: list[VBEscrituraCrear],
    ahora: datetime,
) -> None:
    """
    Reemplaza las filas del snapshot de hoy con las del Excel actual.
    Borra todas las filas del día y reinserta las 97 (o las que vengan)
    tal como están en el Excel — sin deduplicar, preservando el orden exacto.
    """
    from sqlalchemy import func as sqlfunc
    dia_hoy = ahora.date()
    db.query(VBSnapshotFila).filter(
        sqlfunc.date(VBSnapshotFila.fecha_carga) == dia_hoy
    ).delete(synchronize_session=False)

    for item in escrituras:
        db.add(VBSnapshotFila(
            numero_carpeta   = item.numero_carpeta,
            rut              = item.rut,
            nombre_cliente   = item.nombre_cliente,
            actividad_actual = item.actividad_actual,
            fecha_esperada   = item.fecha_esperada,
            fecha_carga      = ahora,
        ))


# ── Funciones públicas del controller ────────────────────────────────────────

def parsear_excel(contenido: bytes) -> list[VBEscrituraCrear]:
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
    escrituras: list[VBEscrituraCrear] = []

    for fila in filas_datos:
        escritura = _fila_a_escritura(fila)
        if escritura:
            escrituras.append(escritura)

    logger.info("Excel parseado: %d filas leídas, %d válidas", len(filas_datos), len(escrituras))
    return escrituras


def cargar_escrituras(db: Session, escrituras: list[VBEscrituraCrear]) -> ResultadoCargaVB:
    """
    Inserta o actualiza los WFs en la BD en una sola transacción.

    - Una query carga todos los registros existentes de una vez.
    - Una transacción guarda todos los cambios (no 1 commit por fila).
    - Si la misma carpeta aparece varias veces en el Excel (el banco exporta
      múltiples etapas del mismo WF), la BD queda con la última actividad
      pero wfs_excel devuelve TODAS las filas tal como vienen en el Excel.
    """
    if not escrituras:
        return ResultadoCargaVB(
            total_en_excel=0, insertados=0, duplicados=0, errores=0, wfs_excel=[]
        )

    ahora = datetime.now()
    insertados = 0
    duplicados = 0

    # Una sola query para saber qué carpetas ya existen en BD
    numeros_unicos = list({item.numero_carpeta for item in escrituras})
    existentes: dict[str, VBEscritura] = {
        r.numero_carpeta: r
        for r in db.query(VBEscritura)
            .filter(VBEscritura.numero_carpeta.in_(numeros_unicos))
            .all()
    }

    try:
        for item in escrituras:
            if item.numero_carpeta in existentes:
                r = existentes[item.numero_carpeta]
                r.actividad_actual = item.actividad_actual
                r.fecha_esperada   = item.fecha_esperada
                r.fecha_carga      = ahora
                duplicados += 1
            else:
                r = VBEscritura(
                    numero_carpeta  = item.numero_carpeta,
                    rut             = item.rut,
                    nombre_cliente  = item.nombre_cliente,
                    actividad_actual= item.actividad_actual,
                    fecha_esperada  = item.fecha_esperada,
                    fecha_carga     = ahora,
                )
                db.add(r)
                # Registrar para que si la misma carpeta aparece de nuevo en
                # el mismo Excel se trate como update, no como segundo insert
                existentes[item.numero_carpeta] = r
                insertados += 1

        # Reemplaza el snapshot de hoy con todas las filas del Excel actual
        # para que GET /vb/ devuelva el total exacto al usar "Recuperar"
        _actualizar_snapshot(db, escrituras, ahora)

        db.commit()

    except Exception as e:
        db.rollback()
        logger.error("Error en carga VB: %s", e)
        raise ValueError(f"Error al guardar los datos: {e}") from e

    logger.info("Carga VB — insertados: %d, duplicados: %d", insertados, duplicados)

    # Devuelve solo las filas VB, sin repetir número de carpeta.
    # El banco exporta la misma carpeta varias veces (VB → Cierre Copias);
    # aquí se filtra "VB" y se toma solo la primera aparición por carpeta.
    carpetas_vb_vistas: set[str] = set()
    wfs_todos: list[VBEscrituraRespuesta] = []
    idx = 1
    for item in escrituras:
        if "VB" not in item.actividad_actual.upper():
            continue
        if item.numero_carpeta in carpetas_vb_vistas:
            continue
        carpetas_vb_vistas.add(item.numero_carpeta)
        wfs_todos.append(VBEscrituraRespuesta(
            id               = idx,
            numero_carpeta   = item.numero_carpeta,
            rut              = item.rut,
            nombre_cliente   = item.nombre_cliente,
            actividad_actual = item.actividad_actual,
            fecha_esperada   = item.fecha_esperada,
            fecha_carga      = ahora,
        ))
        idx += 1

    return ResultadoCargaVB(
        total_en_excel=len(escrituras),
        insertados=insertados,
        duplicados=duplicados,
        errores=0,
        wfs_excel=wfs_todos,
    )


def obtener_lista(
    db: Session,
    actividades: list[str] | None = None,
    fecha: "date | None" = None,
) -> list[VBEscrituraRespuesta]:
    """
    Retorna los WFs cargados en la fecha indicada (por defecto hoy), ordenados por fecha esperada.
    Filtrar por fecha evita mezclar listas de distintos días.
    Si se entregan actividades, aplica un segundo filtro.
    """
    from datetime import date as date_type
    from sqlalchemy import func

    dia = fecha if fecha is not None else date_type.today()

    # Consulta vb_snapshot_filas (no vb_escrituras) para devolver TODAS las
    # filas del Excel del día, incluyendo carpetas con múltiples actividades.
    consulta = db.query(VBSnapshotFila).filter(
        func.date(VBSnapshotFila.fecha_carga) == dia
    )

    if actividades:
        consulta = consulta.filter(VBSnapshotFila.actividad_actual.in_(actividades))

    registros = consulta.order_by(VBSnapshotFila.fecha_esperada.asc()).all()
    return [VBEscrituraRespuesta.model_validate(r) for r in registros]
