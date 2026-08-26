"""
Módulo 07 — Configuración
Routes FastAPI: autenticación, usuarios y parámetros globales.

Endpoints:
  POST   /auth/login                     → inicia sesión
  GET    /configuracion/                 → obtiene config global
  PUT    /configuracion/                 → actualiza config (solo admin desde frontend)
  GET    /configuracion/usuarios         → lista usuarios
  POST   /configuracion/usuarios         → crea usuario
  PUT    /configuracion/usuarios/{id}    → edita usuario
  DELETE /configuracion/usuarios/{id}    → elimina usuario
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import obtener_db
from . import controller
from shared.nombres_controller import (
    listar_nombres,
    agregar_nombre,
    eliminar_nombre,
)
from .schema import (
    AgregarNombreRequest,
    ConfiguracionSchema,
    CrearUsuarioRequest,
    EditarUsuarioRequest,
    LoginRequest,
    NombreSchema,
    SesionSchema,
    UsuarioSchema,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Configuración"])


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=SesionSchema)
def login(req: LoginRequest, db: Session = Depends(obtener_db)):
    """Verifica usuario y contraseña. Retorna los datos de sesión al frontend."""
    try:
        return controller.login(req.usuario, req.contrasena, db)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ── GET /configuracion/ ───────────────────────────────────────────────────────

@router.get("/configuracion/", response_model=ConfiguracionSchema)
def obtener_configuracion(db: Session = Depends(obtener_db)):
    """Retorna los parámetros globales del sistema."""
    try:
        return controller.obtener_configuracion(db)
    except Exception as exc:
        logger.error("Error al obtener configuración: %s", exc)
        raise HTTPException(status_code=500, detail="Error al obtener la configuración")


# ── PUT /configuracion/ ───────────────────────────────────────────────────────

@router.put("/configuracion/", response_model=ConfiguracionSchema)
def actualizar_configuracion(datos: ConfiguracionSchema, db: Session = Depends(obtener_db)):
    """
    Actualiza los parámetros globales y propaga rutas a módulos.
    La validación de permisos (solo admin) se realiza en el frontend.
    """
    try:
        return controller.actualizar_configuracion(datos.model_dump(exclude_none=False), db)
    except Exception as exc:
        logger.error("Error al actualizar configuración: %s", exc)
        raise HTTPException(status_code=500, detail="Error al guardar la configuración")


# ── GET /configuracion/usuarios ───────────────────────────────────────────────

@router.get("/configuracion/usuarios", response_model=list[UsuarioSchema])
def listar_usuarios(db: Session = Depends(obtener_db)):
    """Lista todos los usuarios del sistema."""
    return controller.listar_usuarios(db)


# ── POST /configuracion/usuarios ──────────────────────────────────────────────

@router.post("/configuracion/usuarios", response_model=UsuarioSchema, status_code=201)
def crear_usuario(req: CrearUsuarioRequest, db: Session = Depends(obtener_db)):
    """Crea un usuario nuevo. Valida que el nombre de usuario sea único."""
    try:
        return controller.crear_usuario(
            nombre     = req.nombre,
            usuario    = req.usuario,
            cargo      = req.cargo,
            contrasena = req.contrasena,
            es_admin   = req.es_admin,
            db         = db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── PUT /configuracion/usuarios/{id} ─────────────────────────────────────────

@router.put("/configuracion/usuarios/{usuario_id}", response_model=UsuarioSchema)
def editar_usuario(
    usuario_id: int,
    req: EditarUsuarioRequest,
    db: Session = Depends(obtener_db),
):
    """Edita nombre, cargo, contraseña o estado activo de un usuario."""
    try:
        return controller.editar_usuario(usuario_id, req.model_dump(), db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── DELETE /configuracion/usuarios/{id} ──────────────────────────────────────

@router.delete("/configuracion/usuarios/{usuario_id}", status_code=204)
def eliminar_usuario(usuario_id: int, db: Session = Depends(obtener_db)):
    """Elimina un usuario. No permite eliminar al admin principal 'Jespina'."""
    try:
        controller.eliminar_usuario(usuario_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── POST /configuracion/modo-demo ─────────────────────────────────────────────

@router.post("/configuracion/modo-demo")
def toggle_modo_demo(db: Session = Depends(obtener_db)):
    """Activa/desactiva el modo demo (alterna el valor actual)."""
    return controller.toggle_modo_demo(db)


@router.get("/configuracion/modo-demo")
def estado_modo_demo(db: Session = Depends(obtener_db)):
    """Retorna si el modo demo está activo."""
    return controller.estado_modo_demo(db)


# ── GET /configuracion/impresoras ────────────────────────────────────────────

@router.get("/configuracion/impresoras")
def listar_impresoras():
    """Lista las impresoras instaladas en Windows leyendo wmic."""
    return {"impresoras": controller.listar_impresoras()}


# ── GET /configuracion/nombres ────────────────────────────────────────────────

@router.get("/configuracion/nombres", response_model=list[NombreSchema])
def listar_nombres_route(db: Session = Depends(obtener_db)):
    """Lista todos los nombres registrados con su género."""
    return listar_nombres(db)


# ── POST /configuracion/nombres ───────────────────────────────────────────────

@router.post("/configuracion/nombres", response_model=NombreSchema, status_code=201)
def agregar_nombre_route(req: AgregarNombreRequest, db: Session = Depends(obtener_db)):
    """Agrega un nombre a la BD de géneros y actualiza el cache."""
    try:
        return agregar_nombre(req.nombre, req.genero, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── DELETE /configuracion/nombres/{nombre} ────────────────────────────────────

@router.delete("/configuracion/nombres/{nombre}", status_code=204)
def eliminar_nombre_route(nombre: str, db: Session = Depends(obtener_db)):
    """Elimina un nombre de la BD de géneros y del cache."""
    try:
        eliminar_nombre(nombre, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
