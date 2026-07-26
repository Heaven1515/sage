"""
Módulo 07 — Configuración
Schemas Pydantic para la API de autenticación, usuarios y configuración.
"""

from pydantic import BaseModel


# ── Autenticación ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Datos de inicio de sesión."""

    usuario:    str
    contrasena: str = ""  # Puede quedar vacía (usuarios sin contraseña)


class SesionSchema(BaseModel):
    """Datos de la sesión activa, devueltos al frontend tras login exitoso."""

    id:       int
    nombre:   str
    usuario:  str
    cargo:    str
    es_admin: bool


# ── Usuarios ──────────────────────────────────────────────────────────────────

class UsuarioSchema(BaseModel):
    """Representación pública de un usuario del sistema."""

    id:       int
    nombre:   str
    usuario:  str
    cargo:    str
    es_admin: bool
    activo:   bool

    model_config = {"from_attributes": True}


class CrearUsuarioRequest(BaseModel):
    """Datos para crear un usuario nuevo."""

    nombre:     str
    usuario:    str
    cargo:      str
    contrasena: str  = ""     # Vacía = sin contraseña
    es_admin:   bool = False


class EditarUsuarioRequest(BaseModel):
    """Campos editables de un usuario. None = no cambiar."""

    nombre:            str  | None = None
    cargo:             str  | None = None
    contrasena:        str  | None = None  # "" = quitar contraseña, texto = cambiarla, None = no tocar
    contrasena_antigua: str | None = None  # Requerida cuando se cambia la contraseña
    activo:            bool | None = None


# ── Nombres ───────────────────────────────────────────────────────────────────

class AgregarNombreRequest(BaseModel):
    """Datos para agregar o actualizar un nombre en la BD de géneros."""
    nombre: str
    genero: str   # "M" o "F"


class NombreSchema(BaseModel):
    """Nombre con género tal como se almacena en la BD."""
    nombre: str
    genero: str


# ── Configuración ─────────────────────────────────────────────────────────────

class ConfiguracionSchema(BaseModel):
    """Parámetros globales del sistema."""

    conf_escaneados:  str | None = None
    vb_carpeta:       str | None = None
    vb_salida:        str | None = None
    pre_escaneados:   str | None = None
    pre_url:          str | None = None
    post_entrada:     str | None = None
    post_salida:      str | None = None
    post_url:         str | None = None
    notaria:          str | None = None
    notario_titular:  str | None = None
    notario_dia:      str | None = None
    valor_operacion:  int        = 12000
    red_interna:      str | None = None
    ip_impresora:     str | None = None
    nombre_impresora: str | None = None
    modo_demo:        bool       = False

    model_config = {"from_attributes": True}
