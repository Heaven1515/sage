"""
Entry point — Notaría 33 · Alzamientos BDC
Inicializa FastAPI, registra middlewares, crea tablas y monta los routers.

Para correr:
  uvicorn main:app --reload   (desde la carpeta backend/)
"""

import importlib
import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import Base, engine, SesionLocal
import dashboard_routes
import backup_service

# ── Configuración de logs ────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Ciclo de vida: arranque y cierre ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    backup_service.iniciar(retraso_segundos=60)
    yield
    backup_service.detener()


# ── Aplicación FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="Notaría 33 — Alzamientos BDC",
    version="1.0.0",
    description="Sistema de gestión notarial modular.",
    lifespan=lifespan,
)

# ── CORS: permite peticiones desde el frontend (dev y app de escritorio) ─────
# El backend solo escucha en 127.0.0.1 — allow_origins=["*"] es seguro aquí.
# Tauri v2 en Windows puede usar tauri://, https://tauri.localhost o
# https://localhost según la versión de WebView2; cubrir todos con wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Manejador global de errores (Mandamiento VI) ─────────────────────────────
# Captura cualquier excepción no manejada y retorna un JSON limpio al frontend
@app.exception_handler(Exception)
async def manejador_global_errores(request: Request, exc: Exception):
    logger.error("Error no manejado | Ruta: %s | Error: %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Revisa los logs para más detalle."},
    )

# Importar modelos compartidos para que Base los registre antes de create_all
import shared.nombres_model  # noqa: F401

# ── Registro de módulos ──────────────────────────────────────────────────────
# Se usa importlib porque los nombres de carpeta empiezan con número (01_, 02_...)
# lo que impide importarlos con la sintaxis estándar de Python.
MODULOS = [
    "modules.01_confecciones.routes",
    "modules.02_vb.routes",
    "modules.02_vb.carpeta_routes",
    "modules.02_vb.words_routes",
    "modules.02_vb.planilla_routes",
    "modules.09_repertorios.routes",      # Módulo 09 — toma de repertorios
    "modules.09_repertorios.registro_routes",  # Módulo 09 — registro permanente
    "modules.03_prefirma.routes",         # Módulo 03 — envío firma electrónica
    "modules.04_postfirma.routes",        # Módulo 04 — renombrado y JSON del CBR
    "modules.05_boveda.routes",           # Módulo 05 — registro de entregas a bóveda
    "modules.07_configuracion.routes",    # Módulo 07 — configuración y usuarios
]

for ruta_modulo in MODULOS:
    try:
        modulo = importlib.import_module(ruta_modulo)
        app.include_router(modulo.router)
        logger.info("Router registrado: %s", ruta_modulo)
    except Exception as exc:
        # Registra el error pero sigue cargando los demás módulos.
        # Si un módulo falla al importar, sus rutas quedan ausentes (404)
        # y el error aparece en backend.log para diagnosticar.
        logger.error("ERROR al registrar módulo %s: %s", ruta_modulo, exc, exc_info=True)

app.include_router(dashboard_routes.router)
logger.info("Router registrado: dashboard")

# Crear tablas DESPUÉS de importar los modelos para que Base las conozca
Base.metadata.create_all(bind=engine)
logger.info("Tablas verificadas/creadas en la BD")

# Migración: añadir columnas nuevas si no existen (SQLite no soporta ADD COLUMN IF NOT EXISTS)
with engine.connect() as _conn:
    _text = __import__("sqlalchemy").text

    _cols_prefirma = [row[1] for row in _conn.execute(_text("PRAGMA table_info(prefirma_config)"))]
    if "ruta_carpeta" not in _cols_prefirma:
        _conn.execute(_text("ALTER TABLE prefirma_config ADD COLUMN ruta_carpeta TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: prefirma_config.ruta_carpeta")
    if "url_formulario" not in _cols_prefirma:
        _conn.execute(_text("ALTER TABLE prefirma_config ADD COLUMN url_formulario TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: prefirma_config.url_formulario")

    _cols_postfirma = [row[1] for row in _conn.execute(_text("PRAGMA table_info(postfirma_config)"))]
    if "url_portal" not in _cols_postfirma:
        _conn.execute(_text("ALTER TABLE postfirma_config ADD COLUMN url_portal TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: postfirma_config.url_portal")

    # Migración: fecha_formateado en confecciones (rastreo del botón CONFECCIONAR)
    _cols_confecciones = [row[1] for row in _conn.execute(_text("PRAGMA table_info(confecciones)"))]
    if "fecha_formateado" not in _cols_confecciones:
        _conn.execute(_text("ALTER TABLE confecciones ADD COLUMN fecha_formateado DATETIME"))
        _conn.commit()
        logger.info("Migración aplicada: confecciones.fecha_formateado")

    # Columnas para Cobranza (módulo 06) — se agregan a vb_registro
    _cols_registro = [row[1] for row in _conn.execute(_text("PRAGMA table_info(vb_registro)"))]
    if "cliente_notaria" not in _cols_registro:
        _conn.execute(_text("ALTER TABLE vb_registro ADD COLUMN cliente_notaria TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.cliente_notaria")
    if "mes" not in _cols_registro:
        _conn.execute(_text("ALTER TABLE vb_registro ADD COLUMN mes INTEGER"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.mes")
    if "usuario_id" not in _cols_registro:
        _conn.execute(_text("ALTER TABLE vb_registro ADD COLUMN usuario_id INTEGER"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.usuario_id")
    if "es_banlegal" not in _cols_registro:
        _conn.execute(_text("ALTER TABLE vb_registro ADD COLUMN es_banlegal BOOLEAN NOT NULL DEFAULT 0"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.es_banlegal")
    if "fecha_postfirma" not in _cols_registro:
        _conn.execute(_text("ALTER TABLE vb_registro ADD COLUMN fecha_postfirma DATE"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.fecha_postfirma")

    # Migración: notario_dia e ip_impresora en configuracion
    _cols_config = [row[1] for row in _conn.execute(_text("PRAGMA table_info(configuracion)"))]
    if "notario_dia" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN notario_dia TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.notario_dia")
    if "ip_impresora" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN ip_impresora TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.ip_impresora")
    if "nombre_impresora" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN nombre_impresora TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.nombre_impresora")
    if "anio_repertorios" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN anio_repertorios INTEGER"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.anio_repertorios")
    if "modo_demo" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN modo_demo BOOLEAN NOT NULL DEFAULT 0"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.modo_demo")
    if "escaner_red" not in _cols_config:
        _conn.execute(_text("ALTER TABLE configuracion ADD COLUMN escaner_red TEXT"))
        _conn.commit()
        logger.info("Migración aplicada: configuracion.escaner_red")

    # Migración: usuario_id en boveda_registro (para rastrear quién registra cada entrega)
    _cols_boveda = [row[1] for row in _conn.execute(_text("PRAGMA table_info(boveda_registro)"))]
    if "usuario_id" not in _cols_boveda:
        _conn.execute(_text("ALTER TABLE boveda_registro ADD COLUMN usuario_id INTEGER"))
        _conn.commit()
        logger.info("Migración aplicada: boveda_registro.usuario_id")

    # Migración: es_manual y es_banlegal en prefirma_log
    _cols_prefirma_log = [row[1] for row in _conn.execute(_text("PRAGMA table_info(prefirma_log)"))]
    if "es_manual" not in _cols_prefirma_log:
        _conn.execute(_text("ALTER TABLE prefirma_log ADD COLUMN es_manual BOOLEAN NOT NULL DEFAULT 0"))
        _conn.commit()
        logger.info("Migración aplicada: prefirma_log.es_manual")
    if "es_banlegal" not in _cols_prefirma_log:
        _conn.execute(_text("ALTER TABLE prefirma_log ADD COLUMN es_banlegal BOOLEAN NOT NULL DEFAULT 0"))
        _conn.commit()
        logger.info("Migración aplicada: prefirma_log.es_banlegal")

    # Migración: quitar UNIQUE de wf en vb_registro (RECs tienen mismo WF, distinto repertorio)
    _indices_registro = [row[1] for row in _conn.execute(_text("PRAGMA index_list(vb_registro)"))]
    if "ix_vb_registro_wf" in _indices_registro:
        _conn.execute(_text("DROP INDEX ix_vb_registro_wf"))
        _conn.execute(_text("CREATE INDEX ix_vb_registro_wf ON vb_registro(wf)"))
        _conn.commit()
        logger.info("Migración aplicada: vb_registro.wf ya no es UNIQUE (soporte RECs)")

# Inicializar cache de nombres en memoria para detección de don/doña
from shared import nombres_controller  # noqa: E402
_db_startup = SesionLocal()
try:
    nombres_controller.inicializar_cache(_db_startup)
    nombres_controller.seed_nombres_faltantes(_db_startup)
finally:
    _db_startup.close()

# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Sistema"])
def raiz():
    """Verifica que el servidor esté corriendo."""
    return {"estado": "ok", "sistema": "Notaría 33 — Alzamientos BDC"}
