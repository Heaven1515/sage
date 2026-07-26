"""
Módulo 02 — VB / Carpeta de Descargas
Tabla: vb_carpeta_config

Almacena la configuración de la carpeta de Vistos Buenos de Abogados.
Siempre existe un único registro (id=1), creado en la primera inicialización.
"""

from sqlalchemy import Boolean, Column, Integer, String
from database import Base


class VBCarpetaConfig(Base):
    """
    Configuración única de la carpeta de descargas VB.
    Un solo registro id=1. Se crea cuando el usuario elige la ruta base por primera vez.
    """

    __tablename__ = "vb_carpeta_config"

    id = Column(Integer, primary_key=True, default=1)

    # Ruta elegida por el usuario donde se creará la carpeta matriz
    # Ej: "C:/Users/javie/Desktop"
    ruta_base = Column(String, nullable=True)

    # Carpeta de Descargas del usuario, detectada automáticamente
    # Ej: "C:/Users/javie/Downloads"
    ruta_descargas = Column(String, nullable=True)

    # True una vez que la carpeta matriz "Vistos Buenos de Abogados" fue creada
    configurada = Column(Boolean, default=False, nullable=False)

    # True mientras el vigilador de descargas está corriendo
    activa = Column(Boolean, default=False, nullable=False)

    # Nombre de la subcarpeta del día activa. Ej: "VB 03-04-2026"
    carpeta_hoy = Column(String, nullable=True)

    # Fecha en formato "DD-MM-YYYY" para detectar cambio de día
    fecha_hoy = Column(String, nullable=True)
