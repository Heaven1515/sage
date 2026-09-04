"""
Vigila una carpeta mediante polling cada 8 segundos.

El polling es más robusto que watchdog en rutas de red UNC (\\servidor\carpeta)
en Windows, donde las notificaciones del sistema de archivos son poco fiables.

Flujo:
  1. Cada 8s revisa qué PDFs hay en la carpeta configurada
  2. Si detecta uno nuevo (no visto antes), espera 12s
  3. Pasados los 12s llama al callback de procesamiento

Los 12s de espera aseguran que el escáner terminó de copiar el archivo completo
antes de intentar leerlo.

La ruta vigilada se configura manualmente desde el módulo Prefirma o desde
Configuración — no hay ninguna ruta fija en el código.
"""

import logging
import os
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

INTERVALO_S    = 8   # segundos entre revisiones de la carpeta
ESPERA_COPIA_S = 12  # segundos que se espera antes de procesar un PDF nuevo


class _HiloVigilador(threading.Thread):
    """
    Hilo daemon que revisa la carpeta del escáner periódicamente.
    Detecta PDFs nuevos y los encola para procesamiento tras la espera configurada.
    """

    def __init__(self, ruta: str, callback):
        super().__init__(daemon=True)
        self._ruta     = ruta
        self._callback = callback
        self._detener  = threading.Event()
        self._vistos   = set()  # archivos ya encolados o procesados

    def run(self) -> None:
        logger.info("Vigilador iniciado en: %s", self._ruta)
        while not self._detener.is_set():
            try:
                self._revisar_carpeta()
            except Exception as exc:
                logger.error("Error revisando carpeta del escáner: %s", exc)
            self._detener.wait(timeout=INTERVALO_S)
        logger.info("Vigilador detenido")

    def detener(self) -> None:
        self._detener.set()

    def _revisar_carpeta(self) -> None:
        """Lista la carpeta y encola los PDFs que no se hayan visto antes."""
        try:
            # Excluye archivos ya renombrados (REPERTORIOZZZZ-OTXXXX.pdf)
            # para evitar que el vigilador los vuelva a procesar.
            archivos = {
                f for f in os.listdir(self._ruta)
                if f.lower().endswith(".pdf") and not f.upper().startswith("REPERTORIO")
            }
        except OSError as exc:
            logger.warning("No se pudo leer la carpeta '%s': %s", self._ruta, exc)
            return

        nuevos = archivos - self._vistos
        for nombre in nuevos:
            self._vistos.add(nombre)
            ruta_completa = os.path.join(self._ruta, nombre)
            logger.info("PDF nuevo: %s — esperando %ds antes de procesar...", nombre, ESPERA_COPIA_S)
            temporizador = threading.Timer(ESPERA_COPIA_S, self._callback, args=[ruta_completa])
            temporizador.daemon = True
            temporizador.start()


# ── Instancia global ──────────────────────────────────────────────────────────

_hilo: _HiloVigilador | None = None


def iniciar_vigilancia(callback, ruta: str) -> None:
    """
    Arranca el hilo vigilador en la carpeta indicada.
    Lanza ValueError si ya está activo o si no se indicó una ruta.
    """
    global _hilo
    if not ruta:
        raise ValueError("Debes configurar la carpeta antes de iniciar el modo automático")
    if _hilo is not None and _hilo.is_alive():
        raise ValueError("El vigilador ya está activo")
    _hilo = _HiloVigilador(ruta, callback)
    _hilo.start()


def detener_vigilancia() -> None:
    """Detiene el hilo vigilador limpiamente."""
    global _hilo
    if _hilo is not None:
        _hilo.detener()
        _hilo.join(timeout=ESPERA_COPIA_S + 2)
        _hilo = None


def esta_activo() -> bool:
    """Retorna True si el vigilador está corriendo."""
    return _hilo is not None and _hilo.is_alive()
