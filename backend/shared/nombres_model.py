"""
Tabla auxiliar compartida: nombres de personas con su género.

Usada por el módulo formatear para detectar automáticamente si un nombre
corresponde a hombre o mujer y agregar el tratamiento correcto (don/doña).

Solo almacena el PRIMER NOMBRE (normalizado, sin tildes, en minúsculas).
"""

from sqlalchemy import Column, String
from database import Base


class NombreGenero(Base):
    """
    Cada fila es un primer nombre con su género asociado.
    La clave primaria es el nombre normalizado (sin tildes, minúsculas).
    Ejemplo: 'juan' → 'M',  'maria' → 'F'
    """

    __tablename__ = "nombres_genero"

    # Primer nombre normalizado (sin tildes, minúsculas) — clave única
    nombre = Column(String, primary_key=True, index=True)

    # 'M' = masculino (tratamiento: don) / 'F' = femenino (tratamiento: doña)
    genero = Column(String(1), nullable=False)
