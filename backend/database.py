"""
Conexión a la base de datos SQLite mediante SQLAlchemy.

Expone:
  - Base        → clase base para todos los modelos
  - engine      → motor de conexión (usado en main.py para crear tablas)
  - obtener_db  → dependencia FastAPI que provee la sesión por request
"""

import os
import sys
import shutil
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def _ruta_bd() -> str:
    """
    Determina la ruta de la BD según el entorno de ejecución:
    - Empaquetado (PyInstaller .exe): guarda en %APPDATA%\\SAGE\\notaria.db
      y copia la BD plantilla si es la primera vez que se abre la app.
    - Desarrollo normal: ruta relativa ./notaria.db junto al script.
    """
    if getattr(sys, 'frozen', False):
        # Corriendo desde el .exe empaquetado por PyInstaller
        ruta_datos = Path(os.getenv('APPDATA', Path.home())) / 'SAGE'
        ruta_datos.mkdir(parents=True, exist_ok=True)
        ruta_bd = ruta_datos / 'notaria.db'

        # Si no existe todavía, copiar la BD plantilla del bundle
        # (contiene nombres_genero, usuarios y configuración inicial)
        if not ruta_bd.exists():
            plantilla = Path(sys._MEIPASS) / 'notaria.db'
            if plantilla.exists():
                shutil.copy2(str(plantilla), str(ruta_bd))

        return f'sqlite:///{ruta_bd}'
    else:
        # Desarrollo: ruta relativa al directorio de trabajo
        return 'sqlite:///./notaria.db'


RUTA_BD = _ruta_bd()

engine = create_engine(
    RUTA_BD,
    # SQLite requiere este flag para funcionar con FastAPI (multi-thread)
    connect_args={"check_same_thread": False},
)

SesionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def obtener_db():
    """
    Dependencia FastAPI: abre una sesión de BD por request y la cierra al terminar.
    Se inyecta en los endpoints con Depends(obtener_db).
    """
    db = SesionLocal()
    try:
        yield db
    finally:
        db.close()
