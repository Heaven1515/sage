"""
Script de CI — crea la BD plantilla (notaria.db) para que PyInstaller la bundle.

No está pensado para correr en desarrollo. Solo lo usa el workflow de GitHub Actions
antes de compilar con PyInstaller.

Importa todos los modelos con importlib (los módulos numerados 01_, 02_... no
pueden importarse con la sintaxis directa de Python) y luego llama a create_all
para generar el esquema completo con tablas vacías.
"""

import importlib
import sys
from pathlib import Path

# Asegura que el directorio backend/ esté en el path de importación
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from database import Base, engine  # noqa: E402

# Modelos con nombre de módulo estándar
import shared.nombres_model  # noqa: F401, E402

# Modelos en módulos numerados — se importan con importlib
_MODELOS = [
    "modules.01_confecciones.model",
    "modules.02_vb.model",
    "modules.03_prefirma.model",
    "modules.04_postfirma.model",
    "modules.05_boveda.model",
    "modules.07_configuracion.model",
    "modules.09_repertorios.registro_model",
]

for ruta in _MODELOS:
    importlib.import_module(ruta)

Base.metadata.create_all(bind=engine)
print("BD plantilla creada con todas las tablas.")
