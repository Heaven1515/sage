"""
Módulo 02 — VB / Lectura de Words
Schemas Pydantic para la lectura y procesamiento de archivos .docx de la carpeta VB.
"""

from pydantic import BaseModel


class CarpetasDisponibles(BaseModel):
    """
    Lista de subcarpetas diarias disponibles dentro de 'Vistos Buenos de Abogados'.
    El frontend la usa para poblar el selector de carpeta.
    """

    # Nombres de subcarpetas, ordenadas de más reciente a más antigua. Ej: ["VB 03-04-2026"]
    carpetas: list[str]

    # Ruta completa de la carpeta matriz, para mostrar contexto al usuario
    ruta_matriz: str | None


class SolicitudLeerWords(BaseModel):
    """Petición para leer los .docx de una subcarpeta VB específica."""

    # Nombre de la subcarpeta a leer. Ej: "VB 03-04-2026"
    nombre_carpeta: str


class WordItem(BaseModel):
    """
    Datos extraídos de un archivo .docx VB, enriquecido con el RUT de la BD.
    Una fila de este tipo corresponde a una fila en la tabla del frontend.
    """

    archivo: str            # Nombre del archivo sin ruta. Ej: "2345678.docx"
    wf: str                 # N° Carpeta extraído de la tabla interna del Word
    nombre_cliente: str     # Nombre del cliente extraído de la tabla interna
    materia: str            # Tipo de escritura (párrafo justo antes de "BANCO DE CHILE")
    comuna: str             # Comuna del Conservador de Bienes Raíces detectada en el texto
    rut: str | None         # RUT desde vb_escrituras; si no está en BD, desde el Word
    en_bd: bool             # True si el WF fue encontrado en la tabla vb_escrituras
