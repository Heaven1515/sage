"""
Módulo 02 — VB / Carpeta de Descargas
Controller: lógica de negocio pura, sin HTTP.

Funciones públicas:
  - obtener_estado      → retorna la config actual desde la BD
  - inicializar_carpeta → abre diálogo nativo, crea carpeta matriz, guarda en BD
  - activar_carpeta     → crea carpeta del día (si no existe) e inicia el vigilador
  - desactivar_carpeta  → detiene el vigilador y actualiza la BD
"""

import logging
import shutil
import threading
import time
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from .carpeta_model import VBCarpetaConfig
from .carpeta_schema import EstadoCarpeta

logger = logging.getLogger(__name__)

# Nombre fijo de la carpeta raíz — nunca cambia
_NOMBRE_CARPETA_MATRIZ = "Vistos Buenos de Abogados"


# ── Vigilador de Descargas ────────────────────────────────────────────────────

class _VigitadorDescargas:
    """
    Hilo daemon que monitorea la carpeta de Descargas cada 2 segundos.
    Detecta archivos .doc / .docx nuevos y los mueve a la carpeta del día activa.
    Es un singleton: una sola instancia vive durante toda la sesión del servidor.
    """

    def __init__(self) -> None:
        self._activo = False
        self._hilo: threading.Thread | None = None
        self._carpeta_descargas: Path | None = None
        self._carpeta_destino: Path | None = None

    @property
    def esta_activo(self) -> bool:
        return self._activo

    def activar(self, carpeta_descargas: Path, carpeta_destino: Path) -> None:
        """
        Inicia el vigilado hacia carpeta_destino.
        Si ya está activo, solo actualiza el destino sin crear un hilo nuevo.
        """
        self._carpeta_descargas = carpeta_descargas
        self._carpeta_destino = carpeta_destino

        if self._activo:
            logger.info("Vigilador ya activo — destino actualizado: %s", carpeta_destino)
            return

        self._activo = True
        self._hilo = threading.Thread(target=self._bucle, daemon=True)
        self._hilo.start()
        logger.info("Vigilador iniciado → %s", carpeta_destino)

    def desactivar(self) -> None:
        """Señala al hilo que debe detenerse en el próximo ciclo."""
        self._activo = False
        logger.info("Vigilador detenido")

    def _bucle(self) -> None:
        """
        Bucle principal del hilo:
        1. Captura los archivos Word presentes AL INICIO (para ignorarlos)
        2. Cada 2 segundos escanea si hay archivos nuevos
        3. Espera 1 segundo antes de mover (por si el browser aún está escribiendo)
        4. Sale limpiamente cuando _activo se pone en False
        """
        # Foto inicial — solo mueve lo que aparece DESPUÉS de activar
        archivos_conocidos: set[Path] = set(
            self._carpeta_descargas.glob("*.doc*")  # type: ignore[union-attr]
        )

        while self._activo:
            try:
                actuales = set(self._carpeta_descargas.glob("*.doc*"))  # type: ignore[union-attr]
                nuevos = actuales - archivos_conocidos

                for archivo in nuevos:
                    time.sleep(1)  # Esperar que el browser termine de escribir el archivo
                    if archivo.exists() and self._carpeta_destino:
                        destino = self._carpeta_destino / archivo.name
                        shutil.move(str(archivo), str(destino))
                        logger.info("Movido: %s → %s", archivo.name, self._carpeta_destino)

                # Re-escanear para que la próxima iteración parta de un estado limpio
                archivos_conocidos = set(self._carpeta_descargas.glob("*.doc*"))  # type: ignore[union-attr]

            except Exception as e:
                logger.error("Error en vigilador de descargas: %s", e)

            time.sleep(2)


# Singleton global — vive durante toda la sesión del servidor
_vigilador = _VigitadorDescargas()


# ── Helpers privados ──────────────────────────────────────────────────────────

def _obtener_o_crear_config(db: Session) -> VBCarpetaConfig:
    """Retorna el registro único de config (id=1). Lo crea vacío si no existe."""
    config = db.query(VBCarpetaConfig).filter(VBCarpetaConfig.id == 1).first()
    if not config:
        config = VBCarpetaConfig(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _nombre_carpeta_hoy() -> str:
    """Genera el nombre de la subcarpeta del día. Ej: 'VB 03-04-2026'"""
    return f"VB {date.today().strftime('%d-%m-%Y')}"


def _fecha_hoy_str() -> str:
    """Retorna la fecha de hoy como string. Ej: '03-04-2026'"""
    return date.today().strftime("%d-%m-%Y")


def _detectar_descargas() -> str:
    """Detecta la carpeta de Descargas del usuario en Windows/Mac/Linux."""
    return str(Path.home() / "Downloads")


def _abrir_dialogo_carpeta() -> str | None:
    """
    Abre el diálogo nativo de Windows para seleccionar una carpeta.
    Aparece encima del navegador gracias a -topmost.
    Retorna la ruta elegida, o None si el usuario canceló.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.wm_attributes("-topmost", True)
        ruta = filedialog.askdirectory(
            title="Seleccionar ubicación para 'Vistos Buenos de Abogados'"
        )
        root.destroy()
        return ruta if ruta else None
    except Exception as e:
        logger.error("Error abriendo diálogo de carpeta: %s", e)
        return None


def _construir_ruta_completa(config: VBCarpetaConfig) -> str | None:
    """Arma la ruta completa de la carpeta del día si hay datos suficientes."""
    if config.ruta_base and config.carpeta_hoy:
        return str(Path(config.ruta_base) / _NOMBRE_CARPETA_MATRIZ / config.carpeta_hoy)
    return None


# ── Funciones públicas del controller ────────────────────────────────────────

def obtener_estado(db: Session) -> EstadoCarpeta:
    """Retorna el estado actual de la configuración de carpeta."""
    config = _obtener_o_crear_config(db)
    return EstadoCarpeta(
        configurada=config.configurada or False,
        activa=config.activa or False,
        ruta_base=config.ruta_base,
        carpeta_hoy=config.carpeta_hoy,
        ruta_completa=_construir_ruta_completa(config),
        vigilador_corriendo=_vigilador.esta_activo,
    )


def inicializar_carpeta(db: Session) -> EstadoCarpeta:
    """
    Abre el diálogo nativo para elegir la ruta base.
    Crea la carpeta matriz 'Vistos Buenos de Abogados' en esa ruta.
    Guarda la configuración en la BD.
    Lanza ValueError si el usuario cancela el diálogo.
    """
    ruta_elegida = _abrir_dialogo_carpeta()
    if not ruta_elegida:
        raise ValueError("Se canceló la selección de carpeta")

    carpeta_matriz = Path(ruta_elegida) / _NOMBRE_CARPETA_MATRIZ
    try:
        carpeta_matriz.mkdir(parents=True, exist_ok=True)
        logger.info("Carpeta matriz lista: %s", carpeta_matriz)
    except Exception as e:
        logger.error("No se pudo crear la carpeta matriz: %s", e)
        raise ValueError(f"No se pudo crear la carpeta en '{ruta_elegida}': {e}")

    config = _obtener_o_crear_config(db)
    config.ruta_base = ruta_elegida
    config.ruta_descargas = _detectar_descargas()
    config.configurada = True
    db.commit()
    db.refresh(config)

    return obtener_estado(db)


def activar_carpeta(db: Session, nombre_carpeta: str | None = None) -> EstadoCarpeta:
    """
    Crea la subcarpeta indicada (o la del día si no se especifica) dentro de la
    carpeta matriz e inicia el vigilador de descargas hacia ella.
    Lanza ValueError si la carpeta no fue inicializada primero.
    """
    config = _obtener_o_crear_config(db)
    if not config.configurada or not config.ruta_base:
        raise ValueError("Primero debes configurar la carpeta base")

    nombre_hoy = nombre_carpeta if nombre_carpeta else _nombre_carpeta_hoy()
    carpeta_dia = Path(config.ruta_base) / _NOMBRE_CARPETA_MATRIZ / nombre_hoy

    try:
        # exist_ok=True garantiza que no se creen carpetas duplicadas
        carpeta_dia.mkdir(parents=True, exist_ok=True)
        logger.info("Carpeta del día lista: %s", carpeta_dia)
    except Exception as e:
        logger.error("No se pudo crear la carpeta del día: %s", e)
        raise ValueError(f"No se pudo crear la carpeta del día: {e}")

    config.carpeta_hoy = nombre_hoy
    config.fecha_hoy = _fecha_hoy_str()
    config.activa = True
    db.commit()

    descargas = Path(config.ruta_descargas or _detectar_descargas())
    _vigilador.activar(descargas, carpeta_dia)

    return obtener_estado(db)


def desactivar_carpeta(db: Session) -> EstadoCarpeta:
    """Detiene el vigilador de descargas y marca la config como inactiva en la BD."""
    _vigilador.desactivar()

    config = _obtener_o_crear_config(db)
    config.activa = False
    db.commit()

    return obtener_estado(db)
