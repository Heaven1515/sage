"""
Tablas SQLAlchemy para el módulo Bóveda.

BovedaRegistro : registro de escrituras entregadas al archivo físico.
BovedaConfig   : número de entrega activo del día (singleton, id = 1).
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String

from database import Base


class BovedaRegistro(Base):
    """
    Cada fila representa la entrega de una escritura física a la bóveda.
    Un mismo repertorio puede aparecer más de una vez (reingresos).
    """

    __tablename__ = "boveda_registro"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    repertorio     = Column(Integer, nullable=False)            # N° de repertorio
    anio           = Column(Integer, nullable=False)            # año de la entrega
    mes            = Column(Integer, nullable=False)            # mes de la entrega
    fecha          = Column(Date, nullable=False)               # fecha completa de entrega
    hora_ingreso   = Column(String(5), nullable=False)          # HH:MM
    es_reingreso   = Column(Boolean, nullable=False, default=False)
    motivo         = Column(String, nullable=False, default="Primer ingreso")
    numero_entrega = Column(Integer, nullable=False, default=1) # a qué entrega del día pertenece
    fecha_creado   = Column(DateTime, nullable=False, default=datetime.now)
    usuario_id     = Column(Integer, nullable=True)             # usuario que registró la entrega


class BovedaConfig(Base):
    """
    Configuración del módulo Bóveda. Singleton (id = 1).
    Persiste el número de entrega activo y la fecha de la última actualización
    para reiniciar automáticamente al comenzar un nuevo día.
    """

    __tablename__ = "boveda_config"

    id             = Column(Integer, primary_key=True, default=1)
    entrega_actual = Column(Integer, nullable=False, default=1)
    fecha_entrega  = Column(Date, nullable=True)  # fecha del último incremento
