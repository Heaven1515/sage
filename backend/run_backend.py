"""
Entry point para el ejecutable empaquetado con PyInstaller.
Lanza uvicorn programáticamente (sin reload) para servir la API.
"""

import io
import logging
import multiprocessing
import os
import sys
import traceback
from pathlib import Path

# Requerido por PyInstaller cuando el proceso genera subprocesos
multiprocessing.freeze_support()

# Con console=False, sys.stdout y sys.stderr son None.
# Uvicorn llama .isatty() en ellos y falla. Se redirigen a un buffer vacío.
if sys.stdout is None:
    sys.stdout = io.StringIO()
if sys.stderr is None:
    sys.stderr = io.StringIO()

# Configura log a archivo en %APPDATA%\SAGE\backend.log
# Permite diagnosticar errores de arranque en producción (console=False)
def _configurar_log() -> None:
    ruta_log = Path(os.getenv("APPDATA", Path.home())) / "SAGE" / "backend.log"
    ruta_log.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=str(ruta_log),
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        encoding="utf-8",
    )

_configurar_log()
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    try:
        import uvicorn
        from main import app  # noqa: F401 — importa app para que se registren todos los routers

        logger.info("Backend SAGE iniciando en 127.0.0.1:8000")
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            reload=False,
            log_config=None,  # Desactiva el log de consola de uvicorn (stdout/stderr=None)
        )
    except Exception:
        logger.error("Error fatal al iniciar el backend:\n%s", traceback.format_exc())
        sys.exit(1)
