"""
Módulo 09 — Toma de Repertorios
Schemas Pydantic: validación de entrada y salida de la API de Repertorios.
"""

from pydantic import BaseModel


class ItemRepertorio(BaseModel):
    """Un registro extraído de la planilla de repertorios del banco."""

    wf: str
    repertorio: str
    anio: int        # año de la fecha repertorio
    dia: int         # día numérico (1-31)
    mes: int         # mes numérico (1-12)
    nombre_cliente: str
    materia: str
    rut: str | None = None            # extraído del campo Compareciente de la planilla
    cliente_notaria: str | None = None  # col F de la planilla: "ROMERO Y ASOCIADOS..." o "BANCO DE CHILE"


class ResultadoItem(BaseModel):
    """Resultado del procesamiento de un Word individual."""

    wf: str
    nombre_cliente: str
    repertorio: str
    # "OK" → llenado y movido a Completos
    # "SIN_WORD" → no se encontró archivo Word con ese WF en la carpeta
    # "ERROR" → se encontró el archivo pero falló al procesarlo
    estado: str
    nombre_archivo: str | None = None


class RespuestaLlenar(BaseModel):
    """Respuesta completa del endpoint /llenar-words."""

    resultados: list[ResultadoItem]
    total_ok: int
    total_sin_word: int
    total_error: int
    ruta_completos: str     # ruta de la carpeta Completos generada
    word_resumen: str       # nombre del archivo RESUMEN_DD-MM-YYYY.docx


class ItemDetalleEnvio(BaseModel):
    """Item para generar el Word de detalle de envío al imprimir desde Finalización."""

    wf: str
    nombre_cliente: str
