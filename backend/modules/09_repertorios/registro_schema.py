"""
Módulo 09 — Toma de Repertorios / Registro de Datos
Schemas Pydantic: validación de entrada y salida de la API de Registro.
"""

from datetime import datetime

from pydantic import BaseModel


class RegistroItem(BaseModel):
    """Un registro del repositorio permanente, listo para enviar al frontend."""

    id: int
    wf: str
    rut: str | None
    nombre_cliente: str
    comuna: str
    materia: str
    repertorio: str | None
    anio: int | None
    fecha_escritura: str | None
    fecha_indexado: datetime
    numero_caratula: str | None
    firma_electronica: str | None
    mes: int | None
    cliente_notaria: str | None
    es_banlegal: bool = False


class ResultadoIndexar(BaseModel):
    """Resumen de la operación de indexar una sesión."""

    indexados: int      # registros nuevos guardados en esta operación
    actualizados: int   # registros existentes que se actualizaron
    sin_repertorio: int # WFs leídos desde Words sin match en la planilla
    sin_word: int       # WFs de la planilla sin archivo Word en la carpeta
    total: int          # total acumulado en el repositorio tras la operación
