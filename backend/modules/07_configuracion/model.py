"""
Módulo 07 — Configuración
Tablas SQLAlchemy:
  - Usuario      : usuarios del sistema con cargo y contraseña opcional
  - Configuracion: parámetros globales del sistema (singleton id=1)
"""

from sqlalchemy import Boolean, Column, Integer, String

from database import Base


class Usuario(Base):
    """
    Usuario del sistema. Solo Jespina tiene es_admin=True.
    Si contrasena_hash es None, el usuario puede entrar sin contraseña.
    """

    __tablename__ = "usuarios"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    nombre          = Column(String, nullable=False)               # Nombre completo
    usuario         = Column(String, unique=True, nullable=False)  # Login (ej. "Jespina")
    cargo           = Column(String, nullable=False, default="Jefe de Registro")
    contrasena_hash = Column(String, nullable=True)                # None = sin contraseña
    es_admin        = Column(Boolean, nullable=False, default=False)
    activo          = Column(Boolean, nullable=False, default=True)


class Configuracion(Base):
    """
    Parámetros globales del sistema. Singleton (id = 1).
    Centraliza rutas, URLs y valores configurables de todos los módulos.
    """

    __tablename__ = "configuracion"

    id               = Column(Integer, primary_key=True, default=1)

    # Rutas por módulo
    conf_escaneados  = Column(String, nullable=True)  # Módulo 01 — carpeta escaneados
    vb_carpeta       = Column(String, nullable=True)  # Módulo 02 — carpeta base VB
    vb_salida        = Column(String, nullable=True)  # Módulo 02 — salida planillas
    pre_escaneados   = Column(String, nullable=True)  # Módulo 03 — carpeta PDFs Prefirma
    pre_url          = Column(String, nullable=True)  # Módulo 03 — URL formulario notaría
    post_entrada     = Column(String, nullable=True)  # Módulo 04 — carpeta PDFs firmados
    post_salida      = Column(String, nullable=True)  # Módulo 04 — carpeta destino
    post_url         = Column(String, nullable=True)  # Módulo 04 — URL portal CBR

    # Modo demo: simula operaciones de archivos en Prefirma y Postfirma
    modo_demo        = Column(Boolean, nullable=False, default=False, server_default="0")

    # Parámetros generales
    notaria          = Column(String, nullable=True)   # Nombre de la notaría
    notario_titular  = Column(String, nullable=True)   # Nombre del notario
    notario_dia      = Column(String, nullable=True)   # Notario activo hoy (cambia según quién está de turno)
    valor_operacion  = Column(Integer, nullable=False, default=12000)  # Monto por escritura
    red_interna      = Column(String, nullable=True)   # Rango IP de la red interna
    ip_impresora     = Column(String, nullable=True)   # Dirección IP de la impresora en red (ej: 192.168.1.100)
    nombre_impresora = Column(String, nullable=True)   # Nombre de la impresora en Windows (ej: RICOH IM 550 PCL 6)
    anio_repertorios = Column(Integer, nullable=True)  # Año activo para llenar Words de repertorios (override del Excel)
