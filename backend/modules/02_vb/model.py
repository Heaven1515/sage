"""
Módulo 02 — VB / Escrituras
Tablas: vb_escrituras, vb_snapshot_filas

Define la estructura de datos en SQLite mediante SQLAlchemy.
Solo describe columnas y tipos — sin lógica de negocio.
"""

from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database import Base


class VBEscritura(Base):
    """
    Representa el estado actual de un WF importado desde la lista del Banco de Chile.
    Cada fila corresponde a un N° Carpeta único (última actividad cargada).
    """

    __tablename__ = "vb_escrituras"

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


class VBSnapshotFila(Base):
    """
    Almacena TODAS las filas del Excel tal como vienen, sin deduplicar.
    Permite que GET /vb/ devuelva todas las etapas de un WF (no solo la última).
    Al subir un nuevo Excel se borran las filas del día y se reinsertan todas,
    así no hay conflictos si la misma carpeta aparece varias veces con la misma actividad.
    """

    __tablename__ = "vb_snapshot_filas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    numero_carpeta = Column(String, nullable=False, index=True)
    rut = Column(String, nullable=False)
    nombre_cliente = Column(String, nullable=False)
    actividad_actual = Column(String, nullable=False)
    fecha_esperada = Column(DateTime, nullable=True)
    fecha_carga = Column(DateTime, nullable=False, server_default=func.now())
