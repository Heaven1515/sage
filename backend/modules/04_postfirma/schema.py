"""
Esquemas Pydantic para el módulo Postfirma.
"""

from pydantic import BaseModel


class PostfirmaConfigSchema(BaseModel):
    """Configuración de carpetas de origen y destino."""

    ruta_origen:  str | None = None
    ruta_destino: str | None = None

    model_config = {"from_attributes": True}


class ResultadoPDF(BaseModel):
    """Resultado del procesamiento de un PDF individual."""

    nombre_original:  str
    nombre_nuevo:     str | None = None
    certificado:      str | None = None
    wf:               str | None = None
    nombre_cliente:   str | None = None
    rut:              str | None = None
    repertorio:       str | None = None
    anio:             int | None = None
    comuna:           str | None = None
    materia:          str | None = None
    en_json:          bool = False
    es_banlegal:      bool = False
    # Estados posibles: 'ok' | 'sin_datos' | 'error'
    estado:           str = "ok"
    error:            str | None = None


class ResultadoProcesamiento(BaseModel):
    """Resumen del lote completo de PDFs procesados."""

    total:             int
    procesados:        int
    sin_datos:         int
    con_error:         int
    santiago_count:    int
    banlegal_count:    int = 0
    json_guardado_en:  str | None = None
    carpeta_dia:       str | None = None
    resultados:        list[ResultadoPDF]
