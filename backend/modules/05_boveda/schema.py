"""
Esquemas Pydantic para el módulo Bóveda.
"""

from datetime import date

from pydantic import BaseModel


class RegistroItem(BaseModel):
    """Representación de una fila del registro de bóveda."""

    id:             int
    repertorio:     int
    fecha:          date
    hora_ingreso:   str
    es_reingreso:   bool
    motivo:         str
    numero_entrega: int

    model_config = {"from_attributes": True}


class VerificacionRepertorio(BaseModel):
    """Resultado de verificar si un repertorio ya fue ingresado este año."""

    es_reingreso:      bool
    registros_previos: list[RegistroItem]


class RegistrarRequest(BaseModel):
    """Datos para registrar una entrega a la bóveda."""

    repertorio: int
    motivo:     str | None = None  # obligatorio solo si es_reingreso = True
    usuario_id: int | None = None  # usuario que registra la entrega


class EditarRequest(BaseModel):
    """Editar el número de repertorio de un registro existente."""

    repertorio: int
    contrasena: str | None = None  # obligatorio si el registro es de un día anterior


class EliminarRequest(BaseModel):
    """Solicitud de eliminación de un registro."""

    contrasena: str | None = None  # obligatorio si el registro es de un día anterior


class ConfigBoveda(BaseModel):
    """Configuración del número de entrega activo para el día actual."""

    entrega_actual: int
    fecha_entrega:  date | None = None

    model_config = {"from_attributes": True}


class RespuestaBusqueda(BaseModel):
    """Resultado de buscar un repertorio en el historial completo."""

    repertorio: int
    registros:  list[RegistroItem]
    total:      int
