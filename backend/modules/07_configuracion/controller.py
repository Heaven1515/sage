"""
Módulo 07 — Configuración
Controller: login, CRUD de usuarios y gestión de parámetros globales.

Funciones públicas:
  - login                    → verifica credenciales, retorna SesionSchema
  - listar_usuarios          → todos los usuarios activos e inactivos
  - crear_usuario            → crea usuario nuevo (valida nombre único)
  - editar_usuario           → modifica datos de un usuario existente
  - eliminar_usuario         → elimina usuario (no permite eliminar a Jespina)
  - obtener_configuracion    → retorna el singleton de configuración
  - actualizar_configuracion → guarda y propaga cambios a tablas de módulos
"""

import hashlib
import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from .model import Configuracion, Usuario
from .schema import ConfiguracionSchema, SesionSchema, UsuarioSchema

logger = logging.getLogger(__name__)


# ── Contraseñas ───────────────────────────────────────────────────────────────

def _hash(contrasena: str) -> str | None:
    """Retorna SHA-256 de la contraseña, o None si está vacía (sin contraseña)."""
    if not contrasena.strip():
        return None
    return hashlib.sha256(contrasena.encode()).hexdigest()


def _verificar(ingresada: str, almacenada: str | None) -> bool:
    """
    Verifica contraseña ingresada contra el hash almacenado.
    Si almacenada es None (sin contraseña), siempre retorna True.
    """
    if almacenada is None:
        return True
    return hashlib.sha256(ingresada.encode()).hexdigest() == almacenada


# ── Seed inicial ──────────────────────────────────────────────────────────────

def _seed_usuario_defecto(db: Session) -> None:
    """Crea al usuario administrador 'Jespina' si la tabla está vacía.
    Si ya existe, resetea su contraseña para permitir auto-login."""
    if db.query(Usuario).count() == 0:
        admin = Usuario(
            nombre="Javier Espina Fuentes",
            usuario="Jespina",
            cargo="Jefe de Registro",
            contrasena_hash=None,
            es_admin=True,
            activo=True,
        )
        db.add(admin)
        db.commit()
        logger.info("Usuario por defecto 'Jespina' creado.")
    else:
        # Quitar contraseña para que el auto-login funcione siempre
        user = db.query(Usuario).filter(Usuario.usuario == "Jespina").first()
        if user and user.contrasena_hash is not None:
            user.contrasena_hash = None
            db.commit()


# ── Config singleton ──────────────────────────────────────────────────────────

_DEFECTOS: dict = {
    "conf_escaneados": "",
    "vb_carpeta":      "",
    "vb_salida":       "",
    "pre_escaneados":  "",
    "pre_url":         "http://192.168.1.28/in_copia_compulsa_ad_pdf.php",
    "post_entrada":    "",
    "post_salida":     "",
    "post_url":        "https://conservador.cl/portal/ingresar_cc",
    "escaner_red":     "",
    "notaria":         "33ª Notaría de Santiago",
    "notario_titular": "Carolina Elizabeth Piña Cuevas",
    "notario_dia":     "Carolina Elizabeth Piña Cuevas",
    "valor_operacion": 12000,
    "red_interna":     "192.168.1.x",
    "ip_impresora":     "",
    "nombre_impresora": "RICOH IM 550 PCL 6",
}


def _singleton(db: Session) -> Configuracion:
    """Retorna o crea el singleton de configuración (id=1)."""
    cfg = db.query(Configuracion).filter(Configuracion.id == 1).first()
    if not cfg:
        cfg = Configuracion(id=1, **_DEFECTOS)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _propagar_campo(tabla: str, campo: str, valor: str, db: Session) -> None:
    """
    Actualiza un campo en la tabla de configuración de otro módulo,
    solo si ya existe la fila id=1. No crea filas nuevas para no violar
    restricciones NOT NULL de campos que no conocemos aquí.
    """
    try:
        fila = db.execute(text(f"SELECT id FROM {tabla} WHERE id = 1")).fetchone()
        if fila:
            db.execute(
                text(f"UPDATE {tabla} SET {campo} = :v WHERE id = 1"),
                {"v": valor},
            )
            logger.info("Propagado %s.%s → %s", tabla, campo, valor)
    except Exception as exc:
        logger.warning("No se pudo propagar a %s.%s: %s", tabla, campo, exc)


# ── Login ─────────────────────────────────────────────────────────────────────

def login(usuario: str, contrasena: str, db: Session) -> SesionSchema:
    """
    Verifica credenciales. Lanza ValueError si el usuario no existe,
    está inactivo o la contraseña no coincide.
    """
    _seed_usuario_defecto(db)

    user = db.query(Usuario).filter(
        Usuario.usuario == usuario,
        Usuario.activo.is_(True),
    ).first()

    if not user:
        raise ValueError("Usuario no encontrado o inactivo.")
    if not _verificar(contrasena, user.contrasena_hash):
        raise ValueError("Contraseña incorrecta.")

    return SesionSchema(
        id       = user.id,
        nombre   = user.nombre,
        usuario  = user.usuario,
        cargo    = user.cargo,
        es_admin = user.es_admin,
    )


# ── CRUD Usuarios ─────────────────────────────────────────────────────────────

def listar_usuarios(db: Session) -> list[UsuarioSchema]:
    """Retorna todos los usuarios ordenados por id."""
    _seed_usuario_defecto(db)
    return [
        UsuarioSchema.model_validate(u)
        for u in db.query(Usuario).order_by(Usuario.id).all()
    ]


def crear_usuario(
    nombre: str,
    usuario: str,
    cargo: str,
    contrasena: str,
    es_admin: bool,
    db: Session,
) -> UsuarioSchema:
    """
    Crea un usuario nuevo. Lanza ValueError si el nombre de usuario ya existe.
    """
    if db.query(Usuario).filter(Usuario.usuario == usuario).first():
        raise ValueError(f"Ya existe un usuario con el nombre '{usuario}'.")

    nuevo = Usuario(
        nombre          = nombre,
        usuario         = usuario,
        cargo           = cargo,
        contrasena_hash = _hash(contrasena),
        es_admin        = es_admin,
        activo          = True,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    logger.info("Usuario '%s' creado.", usuario)
    return UsuarioSchema.model_validate(nuevo)


def editar_usuario(usuario_id: int, datos: dict, db: Session) -> UsuarioSchema:
    """
    Edita datos de un usuario. Solo modifica los campos presentes en `datos`.
    contrasena="" quita la contraseña, contrasena=texto la cambia, None no la toca.
    """
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise ValueError(f"No se encontró el usuario con id {usuario_id}.")

    if datos.get("nombre"):
        user.nombre = datos["nombre"]
    if datos.get("cargo"):
        user.cargo = datos["cargo"]
    if datos.get("activo") is not None:
        user.activo = datos["activo"]
    if "contrasena" in datos and datos["contrasena"] is not None:
        # Si el usuario tiene contraseña, verificar la antigua antes de cambiarla
        if user.contrasena_hash is not None:
            antigua = datos.get("contrasena_antigua") or ""
            if not _verificar(antigua, user.contrasena_hash):
                raise ValueError("La contraseña antigua es incorrecta.")
        user.contrasena_hash = _hash(datos["contrasena"])

    db.commit()
    db.refresh(user)
    logger.info("Usuario id=%d actualizado.", usuario_id)
    return UsuarioSchema.model_validate(user)


def eliminar_usuario(usuario_id: int, db: Session) -> None:
    """
    Elimina un usuario. No permite eliminar al administrador 'Jespina'.
    Lanza ValueError si no se encuentra o si es el admin principal.
    """
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise ValueError(f"No se encontró el usuario con id {usuario_id}.")
    if user.usuario == "Jespina":
        raise ValueError("No se puede eliminar al administrador principal.")

    db.delete(user)
    db.commit()
    logger.info("Usuario id=%d ('%s') eliminado.", usuario_id, user.usuario)


# ── Configuración ─────────────────────────────────────────────────────────────

def obtener_configuracion(db: Session) -> ConfiguracionSchema:
    """Retorna la configuración global del sistema."""
    return ConfiguracionSchema.model_validate(_singleton(db))


def actualizar_configuracion(datos: dict, db: Session) -> ConfiguracionSchema:
    """
    Guarda los nuevos valores en `configuracion` y propaga los cambios de ruta
    a las tablas de configuración de los módulos correspondientes.
    Solo actualiza filas que ya existen (id=1) para no romper restricciones NOT NULL.
    """
    cfg = _singleton(db)

    _CAMPOS = [
        "conf_escaneados", "vb_carpeta", "vb_salida",
        "pre_escaneados",  "pre_url",
        "post_entrada",    "post_salida", "post_url",
        "notaria",         "notario_titular", "notario_dia",
        "valor_operacion", "red_interna",     "ip_impresora",     "nombre_impresora",
        "modo_demo",
    ]
    for campo in _CAMPOS:
        if campo in datos and datos[campo] is not None:
            setattr(cfg, campo, datos[campo])

    db.commit()
    db.refresh(cfg)

    # Propagar a tablas de módulos (solo si la fila id=1 ya existe)
    if cfg.vb_carpeta:
        _propagar_campo("vb_carpeta_config", "ruta_base",    cfg.vb_carpeta, db)
        _propagar_campo("vb_carpeta_config", "configurada",  "1",            db)
    if cfg.pre_escaneados:
        _propagar_campo("prefirma_config",   "ruta_carpeta",   cfg.pre_escaneados, db)
    if cfg.pre_url:
        _propagar_campo("prefirma_config",   "url_formulario", cfg.pre_url,        db)
    if cfg.post_entrada:
        _propagar_campo("postfirma_config",  "ruta_origen",  cfg.post_entrada,  db)
    if cfg.post_salida:
        _propagar_campo("postfirma_config",  "ruta_destino", cfg.post_salida,   db)
    if cfg.post_url:
        _propagar_campo("postfirma_config",  "url_portal",   cfg.post_url,      db)
    db.commit()

    logger.info("Configuración global actualizada.")
    return ConfiguracionSchema.model_validate(cfg)


# ── Modo Demo ────────────────────────────────────────────────────────────────

def toggle_modo_demo(db: Session) -> dict:
    """Alterna el modo demo y retorna el nuevo estado."""
    cfg = _singleton(db)
    cfg.modo_demo = not cfg.modo_demo
    db.commit()
    logger.info("Modo demo: %s", "ACTIVADO" if cfg.modo_demo else "DESACTIVADO")
    return {"modo_demo": cfg.modo_demo}


def estado_modo_demo(db: Session) -> dict:
    """Retorna si el modo demo está activo."""
    cfg = _singleton(db)
    return {"modo_demo": cfg.modo_demo}


def es_modo_demo(db: Session) -> bool:
    """Helper que retorna True si el modo demo está activo. Usado por otros módulos."""
    cfg = db.query(Configuracion).filter(Configuracion.id == 1).first()
    return bool(cfg and cfg.modo_demo)
