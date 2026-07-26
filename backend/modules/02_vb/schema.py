"""
Módulo 02 — VB / Escrituras
Schemas Pydantic: validan y tipan los datos entre el Excel, la BD y el frontend.

Orden de uso:
  VBEscrituraCrear    → lo que entra al sistema (parsed del Excel)
  VBEscrituraRespuesta → lo que sale hacia el frontend
  ResultadoCargaVB    → resumen tras subir un Excel
"""

from datetime import datetime
from pydantic import BaseModel, Field


class VBEscrituraCrear(BaseModel):
    """
    Datos de un WF tal como vienen del Excel del Banco de Chile.
    Usado internamente por el controller al parsear el archivo.
    """

    numero_carpeta: str = Field(..., description="N° Carpeta — identificador único del WF")
    rut: str = Field(..., description="RUT del cliente")
    nombre_cliente: str = Field(..., description="Nombre completo del cliente")
    actividad_actual: str = Field(..., description="Etapa actual del WF según el banco")
    fecha_esperada: datetime | None = Field(None, description="Fecha límite entregada por el banco")


class VBEscrituraRespuesta(BaseModel):
    """
    Datos de un WF tal como los recibe el frontend.
    Incluye el id interno y la fecha de carga.
    """

    id: int
    numero_carpeta: str
    rut: str
    nombre_cliente: str
    actividad_actual: str
    fecha_esperada: datetime | None
    fecha_carga: datetime

    model_config = {"from_attributes": True}


class ResultadoCargaVB(BaseModel):
    """
    Resumen que devuelve el endpoint tras subir un Excel.
    Informa al frontend cuántos WFs se procesaron y cuántos fueron nuevos.
    Incluye la lista completa del Excel para que el frontend filtre localmente
    y muestre solo la carga actual (no toda la BD histórica).
    """

    total_en_excel: int = Field(..., description="Total de filas leídas del archivo")
    insertados: int = Field(..., description="WFs nuevos agregados a la BD")
    duplicados: int = Field(..., description="WFs ya existentes que se omitieron")
    errores: int = Field(..., description="Filas que no se pudieron procesar")
    wfs_excel: list[VBEscrituraRespuesta] = Field(
        default_factory=list,
        description="Todos los WFs del Excel actual — para filtrar localmente en el frontend",
    )
