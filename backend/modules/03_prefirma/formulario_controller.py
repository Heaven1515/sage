"""
Envía el PDF y sus datos al servidor SIGN+ de la notaría.

Flujo:
  1. POST /login.php  →  extrae Bearer JWT del HTML de respuesta
  2. POST /escrituras_publicas/api/  con multipart/form-data + Bearer token
     accion = guardar_copia_compulsa
     datos  = JSON con campos del formulario
     file_principal = PDF

Requiere requests.Session() — sin Selenium, sin navegador.
Accesible solo desde la red interna de la notaría.
"""

import json
import logging
import re
from datetime import date
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

# ── Configuración SIGN+ ───────────────────────────────────────────────────────
# Cambiar si el servidor o las credenciales cambian.
URL_BASE_DEFECTO     = "http://192.168.1.177"
URL_API_DEFECTO      = "http://192.168.1.177/app/escrituras_publicas/api/"
SIGNPLUS_USUARIO     = "JESPINA"
SIGNPLUS_PASSWORD    = "Cpina2026"
TIMEOUT_SEGUNDOS  = 30

_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


# ── API pública ───────────────────────────────────────────────────────────────

def enviar_formulario(
    ruta_pdf:      str,
    numero:        str,
    anho:          str,
    tipo_contrato: str,
    fecha_dia:     int,
    fecha_mes:     int,
    fecha_anio:    int,
    url:           str | None = None,
) -> None:
    """
    Envía el formulario con los datos del PDF a SIGN+.
    Lanza excepción si el servidor no responde, el login falla o retorna error.
    El archivo NO se elimina aquí — eso lo hace el controller si todo sale bien.
    Si url es None, usa URL_BASE_DEFECTO.
    """
    ruta = Path(ruta_pdf)
    if not ruta.exists():
        raise FileNotFoundError(f"PDF no encontrado al enviar: {ruta_pdf}")

    # Paso 1: login (siempre en la raíz del servidor)
    sesion, token = _login(URL_BASE_DEFECTO)

    # Paso 2: construir payload y subir
    fecha_escritura = f"{fecha_anio:04d}-{fecha_mes:02d}-{fecha_dia:02d}"
    datos = _construir_datos(numero, anho, tipo_contrato, fecha_escritura)

    with open(ruta, "rb") as archivo_pdf:
        respuesta = sesion.post(
            URL_API_DEFECTO,
            data={
                "accion": "guardar_copia_compulsa",
                "datos":  json.dumps(datos),
            },
            files={"file_principal": (ruta.name, archivo_pdf, "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
            timeout=TIMEOUT_SEGUNDOS,
        )

    if respuesta.status_code != 200:
        raise RuntimeError(
            f"SIGN+ retornó HTTP {respuesta.status_code} al subir {ruta.name}"
        )

    resultado = respuesta.json()
    if not resultado.get("estado"):
        raise RuntimeError(
            f"SIGN+ rechazó la copia: {resultado.get('mensaje', 'sin mensaje')}"
        )

    logger.info(
        "Copia enviada a SIGN+ | Repertorio: %s-%s | Archivo: %s | id_firma: %s",
        numero, anho, ruta.name, resultado.get("id_firma", "-"),
    )


# ── Helpers internos ──────────────────────────────────────────────────────────

def _login(url_base: str) -> tuple[requests.Session, str]:
    """
    Abre sesión en SIGN+ y extrae el Bearer JWT del HTML de respuesta.
    Lanza RuntimeError si el login falla o no se encuentra el token.
    """
    sesion = requests.Session()
    sesion.headers.update({"User-Agent": "Mozilla/5.0"})

    respuesta = sesion.post(
        f"{url_base}/login.php",
        data={
            "username":    SIGNPLUS_USUARIO,
            "password":    SIGNPLUS_PASSWORD,
            "secondLogin": "s",
        },
        timeout=TIMEOUT_SEGUNDOS,
    )

    match = re.search(r"localStorage\.setItem\('token',\s*'([^']+)'\)", respuesta.text)
    if not match:
        raise RuntimeError(
            "Login a SIGN+ fallido: no se encontró el token JWT en la respuesta. "
            "Revisa usuario y contraseña en formulario_controller.py"
        )

    token = match.group(1)
    logger.debug("Login SIGN+ OK — token %d chars", len(token))
    return sesion, token


def _construir_datos(
    numero:          str,
    anho:            str,
    tipo_contrato:   str,
    fecha_escritura: str,  # YYYY-MM-DD
) -> dict:
    """
    Construye el dict que va como JSON en el campo 'datos' del POST.
    Replica exactamente los campos de formCopia de store/copias.js.
    """
    hoy = date.today().isoformat()
    cuerpo_cert = _generar_cuerpo_cert(tipo_contrato, fecha_escritura)

    return {
        "ot":                      "",
        "repertorio":              numero,
        "anho":                    int(anho),
        "tipo_contrato":           tipo_contrato,
        "email":                   "",
        "fecha_escritura":         fecha_escritura,
        "monto":                   "",
        "moneda":                  "PESOS",
        "voltear":                 False,
        "fecha_emision":           hoy,
        "matricera":               "",
        "banco":                   "",
        "modificar_certificacion": False,
        "cuerpo_cert":             cuerpo_cert,
        "existe_pdf":              "nop",
        "url_pdf_existente":       "",
        "lista_comparecientes":    [],
    }


def _generar_cuerpo_cert(tipo_contrato: str, fecha_escritura: str) -> str:
    """
    Genera el texto de certificación igual que generarTextoCertificacion() en JS.
    """
    tipo = tipo_contrato.upper() if tipo_contrato else "LA ESCRITURA PÚBLICA"

    try:
        year, month, day = fecha_escritura.split("-")
        nombre_mes = _MESES[int(month) - 1]
        return (
            f"Certifico que el presente documento electrónico es copia fiel e "
            f"íntegra de {tipo} otorgado el {day} de {nombre_mes} de {year} "
            f"reproducido en las siguientes páginas."
        )
    except Exception:
        return (
            f"Certifico que el presente documento electrónico es copia fiel e "
            f"íntegra de {tipo} reproducido en las siguientes páginas."
        )
