"""
Extrae datos de la escritura escaneada usando OCR (PyMuPDF + pytesseract).

Los PDFs del escáner RICOH son imágenes puras sin capa de texto embebida,
por lo que se renderiza la primera página con PyMuPDF y se aplica OCR.

Datos extraídos de la primera página:
  - número de repertorio  → campo 'numero' del formulario web
  - año del repertorio    → campo 'anho' del formulario web
  - tipo de contrato      → campo 'tipo_contrato' del formulario web
"""

import io
import logging
import os
import re
import sys
from pathlib import Path

import fitz          # pymupdf — ya instalado en el proyecto (preview_controller)
import pytesseract
from PIL import Image

if getattr(sys, 'frozen', False):
    # Corriendo como backend.exe — usa Tesseract bundleado en sys._MEIPASS
    _tess_dir = os.path.join(sys._MEIPASS, 'tesseract')
    pytesseract.pytesseract.tesseract_cmd = os.path.join(_tess_dir, 'tesseract.exe')
    os.environ['TESSDATA_PREFIX'] = _tess_dir
else:
    # Desarrollo local — usa Tesseract instalado en el sistema
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

logger = logging.getLogger(__name__)

# Detecta "REPERTORIO N°3090-2026" o "REPERTORIO N°3.090-2026"
# Grupo 1: número (puede tener puntos separadores de miles)
# Grupo 2: año (4 dígitos)
_PATRON_REPERTORIO = re.compile(
    r"REPERTORIO\s+N[°º]?\s*([\d.]+)\s*[-–]\s*(\d{4})",
    re.IGNORECASE,
)

# Detecta la línea WF para saber cuándo empieza el cuerpo del documento
_PATRON_WF = re.compile(r"\bWF\s+\d", re.IGNORECASE)

# Líneas de encabezado conocidas que NO son el título de la escritura
_EXCLUIR_TITULO = {
    "BANCO DE CHILE", "A", "SANTIAGO", "NOTARIO PUBLICO INTERINO",
    "NOTARIO PUBLICO", "HUERFANOS 979 OF. 501 - SANTIAGO",
}


def extraer_datos_pdf(ruta_pdf: str) -> dict:
    """
    Lee la primera página del PDF con OCR y extrae:
      - número de repertorio
      - año del repertorio
      - tipo de contrato (título de la escritura, sea cual sea)

    Retorna None en los campos que no se puedan extraer.
    """
    ruta = Path(ruta_pdf)
    if not ruta.exists():
        raise FileNotFoundError(f"PDF no encontrado: {ruta_pdf}")

    texto = _ocr_primera_pagina(ruta_pdf)
    numero, anho  = _extraer_repertorio(texto)
    tipo_contrato = _extraer_tipo_contrato(texto)

    logger.info(
        "OCR | %s | Repertorio: %s-%s | Tipo: %s",
        ruta.name, numero, anho, tipo_contrato,
    )
    return {"numero": numero, "anho": anho, "tipo_contrato": tipo_contrato}


# ── Extracción interna ────────────────────────────────────────────────────────

def _ocr_primera_pagina(ruta_pdf: str) -> str:
    """
    Renderiza la primera página a 250 DPI con PyMuPDF y aplica OCR.
    Usa el modelo 'eng' — suficiente para documentos formateados sin tildes.
    """
    doc = fitz.open(ruta_pdf)
    if not doc.page_count:
        raise ValueError("El PDF no tiene páginas")
    pixmap = doc[0].get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
    imagen = Image.open(io.BytesIO(pixmap.tobytes("png")))
    doc.close()
    return pytesseract.image_to_string(imagen, lang="spa")


def _extraer_repertorio(texto: str) -> tuple[str | None, str | None]:
    """
    Extrae número y año del repertorio.
    Normaliza: elimina puntos separadores de miles (3.090 → 3090).
    """
    coincidencia = _PATRON_REPERTORIO.search(texto)
    if not coincidencia:
        logger.warning("Repertorio no encontrado. OCR preview: %s",
                       texto[:300].replace("\n", " | "))
        return None, None

    numero = coincidencia.group(1).replace(".", "")
    anho   = coincidencia.group(2)
    return numero, anho


def _extraer_tipo_contrato(texto: str) -> str | None:
    """
    Extrae el título de la escritura (sea cual sea su tipo).
    Lógica: busca la primera línea predominantemente en mayúsculas (≥2 palabras)
    que aparezca después de la línea WF y antes de 'BANCO DE CHILE'.

    Funciona con cualquier título:
      ALZAMIENTO DE HIPOTECA Y PROHIBICION
      CANCELACION DE HIPOTECA
      LIBERACION DE PRENDAS
      ALZAMIENTO DE PRENDA SOBRE VEHICULO
      etc.
    """
    lineas    = texto.splitlines()
    tras_wf   = False

    for linea in lineas:
        texto_linea = linea.strip()
        if not texto_linea:
            continue

        # Activar búsqueda una vez que pasamos la línea "WF XXXXXXX"
        if _PATRON_WF.search(texto_linea):
            tras_wf = True
            continue

        if not tras_wf:
            continue

        # Detenerse al llegar a "BANCO DE CHILE" — ya pasamos el título
        if "BANCO" in texto_linea.upper() and "CHILE" in texto_linea.upper():
            break

        # Ignorar líneas de encabezado conocidas
        if texto_linea.upper() in _EXCLUIR_TITULO:
            continue

        # Criterio: ≥80% letras mayúsculas y al menos 2 palabras
        letras = [c for c in texto_linea if c.isalpha()]
        if len(letras) < 8:
            continue
        ratio    = sum(1 for c in letras if c.isupper()) / len(letras)
        palabras = texto_linea.split()
        if ratio > 0.80 and len(palabras) >= 2:
            return texto_linea.strip()

    logger.warning("Tipo de contrato no encontrado en el PDF")
    return None
