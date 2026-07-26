"""
Script de carga inicial de nombres en la BD.

Ejecutar UNA VEZ desde la carpeta backend/ con el entorno activo:
  python seed_nombres.py
  python seed_nombres.py "C:\\ruta\\al\\archivo\\LISTAS NOMBRES.docx"

Si no se pasa ruta, busca el archivo en la carpeta Descargas del usuario actual.
"""

import sys
from pathlib import Path

# Permite importar los módulos del backend directamente
sys.path.insert(0, str(Path(__file__).parent))

from database import SesionLocal, Base, engine           # noqa: E402
from shared.nombres_model import NombreGenero             # noqa: E402, F401 (registra el modelo)
from shared.nombres_controller import poblar_desde_docx  # noqa: E402


def main() -> None:
    if len(sys.argv) > 1:
        ruta_docx = Path(sys.argv[1])
    else:
        ruta_docx = Path.home() / "Downloads" / "LISTAS NOMBRES.docx"

    if not ruta_docx.exists():
        print(f"Error: no se encontró el archivo '{ruta_docx}'")
        print("Uso: python seed_nombres.py [ruta_al_docx]")
        sys.exit(1)

    # Crear tabla si no existe
    Base.metadata.create_all(bind=engine)

    db = SesionLocal()
    try:
        total = poblar_desde_docx(str(ruta_docx), db)
        print(f"Listo. {total} nombres nuevos insertados en la BD.")
    except Exception as exc:
        print(f"Error al procesar el archivo: {exc}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
