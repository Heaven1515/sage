"""
Tablas SQLAlchemy para el módulo Prefirma.

PrefirmaConfig : configuración de sesión activa (singleton, id = 1).
PrefirmaLog    : registro histórico de cada PDF procesado durante la sesión.
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from database import Base


class PrefirmaConfig(Base):
    """
    Configuración del modo automático.
    Siempre existe un único registro con id = 1 (patrón singleton).
    Persiste la fecha de otorgamiento entre reinicios del backend.
    """
    __tablename__ = "prefirma_config"

    id            = Column(Integer, primary_key=True, default=1)
    activo        = Column(Boolean, nullable=False, default=False)
    ruta_carpeta  = Column(String,  nullable=True)   # carpeta del escáner configurada por el usuario
    url_formulario = Column(String, nullable=True)   # URL del formulario web interno de la notaría
    fecha_dia     = Column(Integer, nullable=True)
    fecha_mes     = Column(Integer, nullable=True)
    fecha_anio    = Column(Integer, nullable=True)


class PrefirmaLog(Base):
    """
    Registro de cada PDF detectado en la carpeta del escáner.
    Permite al usuario ver qué se procesó, qué se subió y qué falló.
    """
    __tablename__ = "prefirma_log"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    nombre_archivo   = Column(String,  nullable=False)
    repertorio       = Column(String,  nullable=True)   # solo el número (ej: "3090")
    anho_repertorio  = Column(String,  nullable=True)   # el año (ej: "2026")
    tipo_contrato    = Column(String,  nullable=True)
    # Estados posibles: 'procesando' | 'ok' | 'error'
    estado          = Column(String,  nullable=False, default="procesando")
    mensaje_error   = Column(String,  nullable=True)
    fecha_procesado = Column(DateTime, nullable=False, default=datetime.utcnow)
    es_manual       = Column(Boolean, nullable=False, default=False, server_default="0")
    es_banlegal     = Column(Boolean, nullable=False, default=False, server_default="0")
    # Nombre resultante tras el renombrado: "REPERTORIOZZZZ-OTXXXX.pdf"
    nombre_nuevo    = Column(String, nullable=True)
