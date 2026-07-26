"""
Módulo 01 — Confecciones de Borradores
Schemas Pydantic: validan y tipan los datos entre el Excel, la BD y el frontend.

Orden de uso:
  ConfeccionCrear    → lo que entra al sistema (parsed del Excel)
  ConfeccionRespuesta → lo que sale hacia el frontend
  ResultadoCarga     → resumen tras subir un Excel
"""

from datetime import datetime
from pydantic import BaseModel, Field


class ConfeccionCrear(BaseModel):
    """
    Datos de un WF tal como vienen del Excel del Banco de Chile.
    Usado internamente por el controller al parsear el archivo.
    """

    numero_carpeta: str = Field(..., description="N° Carpeta — identificador único del WF")
    rut: str = Field(..., description="RUT del cliente")
    nombre_cliente: str = Field(..., description="Nombre completo del cliente")
    actividad_actual: str = Field(..., description="Etapa actual del WF según el banco")
    fecha_esperada: datetime | None = Field(None, description="Fecha límite entregada por el banco")


class ConfeccionRespuesta(BaseModel):
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


class ResultadoFormateo(BaseModel):
    """
    Respuesta del endpoint de formateo cuando ocurre un error controlado.
    En caso de éxito el endpoint retorna el archivo .docx directamente.
    """

    ok: bool = Field(..., description="True si el formateo fue exitoso")
    wf: str  = Field("", description="Número de WF procesado")
    mensaje: str = Field("", description="Detalle del error si ok=False")


class ResultadoCarga(BaseModel):
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
    wfs_excel: list[ConfeccionRespuesta] = Field(
        default_factory=list,
        description="Todos los WFs del Excel actual — para filtrar localmente en el frontend",
    )
