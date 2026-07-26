"""
Tabla SQLAlchemy para el módulo Postfirma.

PostfirmaConfig: configuración de rutas de origen y destino (singleton, id = 1).
"""

from sqlalchemy import Column, Integer, String

from database import Base


class PostfirmaConfig(Base):
    """
    Configuración de carpetas del módulo Postfirma.
    Singleton: siempre existe un único registro con id = 1.
    """

    __tablename__ = "postfirma_config"

    id            = Column(Integer, primary_key=True, default=1)
    ruta_origen   = Column(String, nullable=True)   # carpeta con PDFs firmados electrónicamente
    ruta_destino  = Column(String, nullable=True)   # carpeta base donde se crea la subcarpeta del día
    url_portal    = Column(String, nullable=True)   # URL portal CBR para ingreso manual
