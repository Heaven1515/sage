"""
Módulo 01 — Confecciones de Borradores
Tabla: confecciones

Define la estructura de datos en SQLite mediante SQLAlchemy.
Solo describe columnas y tipos — sin lógica de negocio.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class Confeccion(Base):
    """
    Representa un WF (escritura) importado desde la lista del Banco de Chile.
    Cada fila corresponde a un N° Carpeta único.
    """

    __tablename__ = "confecciones"

    # Clave primaria interna — no tiene relación con el WF
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Identificador único del banco — equivale al WF
    numero_carpeta = Column(String, unique=True, nullable=False, index=True)

    # Datos del cliente
    rut = Column(String, nullable=False)
    nombre_cliente = Column(String, nullable=False)

    # Etapa actual del WF según el banco (Actividad Actual en el Excel)
    actividad_actual = Column(String, nullable=False)

    # Fecha límite entregada por el banco para completar la escritura
    fecha_esperada = Column(DateTime, nullable=True)

    # Fecha en que se subió el Excel al sistema — se genera automáticamente
    fecha_carga = Column(DateTime, nullable=False, server_default=func.now())

    # Fecha en que el documento fue formateado con el botón CONFECCIONAR — None si aún no se formatea
    fecha_formateado = Column(DateTime, nullable=True)
