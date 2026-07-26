"""
Renderiza páginas de un PDF a imágenes base64 usando PyMuPDF (fitz).

PyMuPDF no requiere poppler ni ningún binario externo — funciona con
PDFs de imagen pura como los que genera el escáner RICOH.
"""

import base64
import logging

import fitz  # pymupdf

logger = logging.getLogger(__name__)

# 1.5× = ~108 DPI — suficiente para previsualizar en pantalla sin ser pesado
_ESCALA = fitz.Matrix(1.5, 1.5)


def obtener_imagenes_pdf(ruta_pdf: str, max_paginas: int | None = None) -> list[str]:
    """
    Renderiza todas las páginas del PDF (o hasta max_paginas si se especifica).
    Retorna lista de strings base64 JPEG, una por página.
    """
    doc = fitz.open(ruta_pdf)
    imagenes: list[str] = []

    try:
        for i, pagina in enumerate(doc):
            if max_paginas is not None and i >= max_paginas:
                break
            pix        = pagina.get_pixmap(matrix=_ESCALA)
            jpeg_bytes = pix.tobytes("jpeg")
            imagenes.append(base64.b64encode(jpeg_bytes).decode())
    finally:
        doc.close()

    logger.info("Preview generado | %s | %d página(s)", ruta_pdf, len(imagenes))
    return imagenes
