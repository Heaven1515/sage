"""
Schemas Pydantic para el módulo Prefirma (flujo manual asistido).
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CarpetaRespuesta(BaseModel):
    """Ruta de la carpeta del escáner actualmente configurada."""
    ruta_carpeta: Optional[str] = None


class ArchivoItem(BaseModel):
    """Un PDF disponible en la carpeta del escáner."""
    nombre: str  # solo el nombre del archivo, ej: "20260402145707048.pdf"


class PreviewRespuesta(BaseModel):
    """Páginas del PDF renderizadas como imágenes base64 JPEG."""
    imagenes: list[str]  # una por página, máximo 2


class DatosRepertorio(BaseModel):
    """Resultado de buscar un repertorio en vb_registro."""
    encontrado:      bool
    materia:         Optional[str] = None
    fecha_escritura: Optional[str] = None  # "DD-MM-YYYY"
    nombre_cliente:  Optional[str] = None
    advertencia:     Optional[str] = None  # aviso cuando el WF ya existía


class RegistroManualRequest(BaseModel):
    """Datos ingresados manualmente cuando el repertorio no está en la BD."""
    wf:              str
    nombre_cliente:  str
    rut:             Optional[str] = None
    comuna:          str
    materia:         str
    repertorio:      str
    anio:            str
    fecha_escritura: str             # "DD-MM-YYYY"
    cliente_notaria: Optional[str] = None
    es_banlegal:     bool = False


class LogItem(BaseModel):
    """Entrada del historial: un PDF detectado y su resultado de renombrado."""
    id:              int
    nombre_archivo:  str
    repertorio:      Optional[str] = None
    anho_repertorio: Optional[str] = None
    tipo_contrato:   Optional[str] = None
    estado:          str             # 'ok' | 'error' | 'sin_datos'
    mensaje_error:   Optional[str] = None
    fecha_procesado: datetime
    es_manual:       bool = False
    es_banlegal:     bool = False
    nombre_nuevo:    Optional[str] = None  # nombre resultante tras renombrar

    class Config:
        from_attributes = True
