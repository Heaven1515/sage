"""
Módulo 02 — VB / Carpeta de Descargas
Schemas Pydantic: validan y tipan los datos entre el controller y el frontend.
"""

from pydantic import BaseModel


class SolicitudActivar(BaseModel):
    """Cuerpo opcional del POST /activar — permite elegir la carpeta destino."""
    # Si es None se usa la carpeta del día (VB DD-MM-YYYY de hoy)
    nombre_carpeta: str | None = None


class EstadoCarpeta(BaseModel):
    """
    Estado completo de la configuración de carpeta de descargas.
    Es lo único que devuelve la API de carpeta en todos sus endpoints.
    """

    # True si la carpeta matriz ya fue creada (primera configuración completada)
    configurada: bool

    # True si el vigilador de descargas está corriendo actualmente
    activa: bool

    # Ruta base elegida por el usuario. Ej: "C:/Users/javie/Desktop"
    ruta_base: str | None

    # Nombre de la carpeta del día vigente. Ej: "VB 03-04-2026"
    carpeta_hoy: str | None

    # Ruta completa de la carpeta del día (ruta_base + matriz + dia)
    ruta_completa: str | None

    # Refleja si el hilo vigilador está activo en memoria (puede diferir de BD tras reinicio)
    vigilador_corriendo: bool

    model_config = {"from_attributes": True}
