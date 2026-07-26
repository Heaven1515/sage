"""
Servicio de respaldo automático de notaria.db.

- Corre cada 5 horas mientras SAGE está abierto.
- Usa la API nativa de SQLite (copia segura con la BD en uso).
- Guarda los últimos 7 respaldos en el destino configurado.
- Destino: G:\\Mi unidad\\SAGE_backups  (Google Drive Desktop)
- Si el destino no está disponible, registra el error y sigue — no interrumpe el programa.
"""

import logging
import shutil
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Configuración ─────────────────────────────────────────────────────────────
INTERVALO_HORAS   = 5
INTERVALO_SEGUNDOS = INTERVALO_HORAS * 3600
MAXIMO_RESPALDOS  = 7
CARPETA_DESTINO   = Path(r"G:\Mi unidad\SAGE_backups")

# ── Estado interno ────────────────────────────────────────────────────────────
_timer: threading.Timer | None = None


def _ruta_bd() -> Path:
    """Ruta de notaria.db — junto al ejecutable o en el repo."""
    import sys
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / "notaria.db"
    return Path(__file__).parent / "notaria.db"


def hacer_respaldo() -> bool:
    """
    Crea una copia segura de notaria.db en CARPETA_DESTINO.
    Retorna True si el respaldo fue exitoso, False si falló.
    """
    origen = _ruta_bd()
    if not origen.exists():
        logger.warning("Respaldo omitido: no se encontró notaria.db en %s", origen)
        return False

    if not CARPETA_DESTINO.exists():
        try:
            CARPETA_DESTINO.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            logger.error("Respaldo omitido: no se pudo crear carpeta destino %s — %s", CARPETA_DESTINO, exc)
            return False

    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    destino   = CARPETA_DESTINO / f"notaria_backup_{timestamp}.db"

    try:
        # sqlite3.connect().backup() es la forma segura: copia consistente aunque
        # haya escrituras en curso. Equivale a un checkpoint del WAL.
        origen_conn  = sqlite3.connect(str(origen))
        destino_conn = sqlite3.connect(str(destino))
        with destino_conn:
            origen_conn.backup(destino_conn)
        origen_conn.close()
        destino_conn.close()

        logger.info("Respaldo creado: %s", destino.name)
        _limpiar_respaldos_viejos()
        return True

    except Exception as exc:
        logger.error("Error al crear respaldo: %s", exc)
        # Si el archivo de destino quedó incompleto, borrarlo
        if destino.exists():
            destino.unlink(missing_ok=True)
        return False


def _limpiar_respaldos_viejos():
    """Elimina los respaldos más antiguos si hay más de MAXIMO_RESPALDOS."""
    try:
        archivos = sorted(
            CARPETA_DESTINO.glob("notaria_backup_*.db"),
            key=lambda f: f.stat().st_mtime,
        )
        a_borrar = archivos[:-MAXIMO_RESPALDOS] if len(archivos) > MAXIMO_RESPALDOS else []
        for f in a_borrar:
            f.unlink(missing_ok=True)
            logger.info("Respaldo antiguo eliminado: %s", f.name)
    except Exception as exc:
        logger.warning("No se pudieron limpiar respaldos viejos: %s", exc)


def _ciclo_respaldo():
    """Ejecuta el respaldo y programa el siguiente."""
    global _timer
    hacer_respaldo()
    _timer = threading.Timer(INTERVALO_SEGUNDOS, _ciclo_respaldo)
    _timer.daemon = True
    _timer.start()


def iniciar(retraso_segundos: int = 60):
    """
    Arranca el scheduler de respaldo.
    Espera `retraso_segundos` antes del primer respaldo para no sobrecargar el arranque.
    Llamar desde el startup event de FastAPI.
    """
    global _timer
    logger.info(
        "Servicio de respaldo iniciado — primer respaldo en %ds, luego cada %dh",
        retraso_segundos,
        INTERVALO_HORAS,
    )
    _timer = threading.Timer(retraso_segundos, _ciclo_respaldo)
    _timer.daemon = True
    _timer.start()


def detener():
    """Cancela el timer pendiente. Llamar desde el shutdown event de FastAPI."""
    global _timer
    if _timer is not None:
        _timer.cancel()
        _timer = None
        logger.info("Servicio de respaldo detenido.")
