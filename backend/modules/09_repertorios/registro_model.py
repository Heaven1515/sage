"""
Módulo 09 — Toma de Repertorios / Registro de Datos
Tabla: vb_registro

Repositorio permanente que vincula WF → Cliente → RUT → Comuna → Repertorio.
Nunca se elimina salvo cambio de notario (evento ~1 vez cada 30 años).
Sirve como fuente de verdad para el módulo Postfirma.
"""

from sqlalchemy import Boolean, Column, Date, Integer, String, DateTime
from sqlalchemy.sql import func

from database import Base


class VBRegistro(Base):
    """
    Registro permanente de una escritura procesada en VB.
    Une los datos del Word (WF, nombre, materia, comuna) con los del
    Excel de repertorios (repertorio, año) y la BD de escrituras (RUT).
    Los campos numero_caratula y firma_electronica los completa Postfirma.
    """

    __tablename__ = "vb_registro"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # Identificador del WF — puede repetirse si hay REC (mismo WF, distinto repertorio)
    wf = Column(String, nullable=False, index=True)

    # Datos del cliente
    rut = Column(String, nullable=True)
    nombre_cliente = Column(String, nullable=False)

    # Ubicación del conservador — determina si se inscribe en Santiago o provincia
    comuna = Column(String, nullable=False)

    # Tipo de escritura (ej: ALZAMIENTO DE HIPOTECA Y PROHIBICION)
    materia = Column(String, nullable=False)

    # Número de repertorio asignado por la notaría (null si no se cruzó con planilla)
    repertorio = Column(String, nullable=True)
    anio = Column(Integer, nullable=True)

    # Fecha de la escritura en formato DD-MM-YYYY
    fecha_escritura = Column(String, nullable=True)

    # Cuándo se guardó en este repositorio
    fecha_indexado = Column(DateTime, nullable=False, server_default=func.now())

    # Mes numérico de la escritura (1-12) — usado para filtrar por mes
    mes = Column(Integer, nullable=True)

    # Quién encargó el alzamiento: "ROMERO Y ASOCIADOS..." o "BANCO DE CHILE"
    # Lo llena el módulo VB al indexar la planilla Consulta OT (col F)
    cliente_notaria = Column(String, nullable=True)

    # Indica si la escritura es de tipo BANLEGAL (prenda sobre vehículo)
    es_banlegal = Column(Boolean, nullable=False, default=False, server_default="0")

    # Número de OT del banco — viene de la col A de la planilla Consulta OT
    # Lo usa el módulo Prefirma para renombrar el PDF escaneado
    numero_ot = Column(Integer, nullable=True)

    # Campos que completa el módulo Postfirma
    numero_caratula = Column(String, nullable=True)
    firma_electronica = Column(String, nullable=True)
    fecha_postfirma = Column(Date, nullable=True)

    # Usuario que realizó la indexación (lo completa el módulo VB al indexar)
    usuario_id = Column(Integer, nullable=True)
