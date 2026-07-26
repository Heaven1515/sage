/*
  Módulo de sesión: guarda y lee la sesión del usuario activo en localStorage.
  No es un hook de React — son funciones utilitarias para poder usarlas
  también fuera de componentes (ej. en otros hooks).
*/

export interface SesionUsuario {
  id:       number
  nombre:   string
  usuario:  string
  cargo:    string
  esAdmin:  boolean
}

const CLAVE_SESION = "sage_sesion"

/** Retorna la sesión activa, o null si no hay ninguna. */
export function obtenerSesion(): SesionUsuario | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(CLAVE_SESION)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SesionUsuario
  } catch {
    return null
  }
}

/** Guarda la sesión del usuario que acaba de iniciar sesión. */
export function guardarSesion(datos: {
  id: number
  nombre: string
  usuario: string
  cargo: string
  es_admin: boolean
}): void {
  const sesion: SesionUsuario = {
    id:      datos.id,
    nombre:  datos.nombre,
    usuario: datos.usuario,
    cargo:   datos.cargo,
    esAdmin: datos.es_admin,
  }
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
}

/** Elimina la sesión activa (cierra sesión). */
export function cerrarSesion(): void {
  localStorage.removeItem(CLAVE_SESION)
}
