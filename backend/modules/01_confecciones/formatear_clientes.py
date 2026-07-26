"""
Módulo 01 — Confecciones de Borradores
Procesamiento de nombres de clientes y co-deudores para el módulo formatear.

Responsabilidades:
  - Invertir nombre BDC a orden notarial (APELLIDO NOMBRE)
  - Agregar tratamiento don/doña via BD de nombres
  - Detectar co-deudores (con y sin tratamiento previo)
  - Calcular sufijo de título (Y OTRO / Y OTRA)

Función pública:
  - procesar_nombres_borrador(doc_entrada, datos) → dict
    Retorna: clausulas_tx, nombres_en_cuerpo, sufijo_titulo, comuna
"""

import re
import logging

from docx import Document

from shared.nombres_controller import obtener_tratamiento
from .formatear_utils import (
    transformar_texto,
    _extraer_clausulas,
    _extraer_comuna_conservador,
    _patron_ignorar_tildes,
    _patron_nombre_flexible,
)


# ── Partículas de apellido compuesto ─────────────────────────────────────────
# Si la palabra antes del apellido materno es una de estas, forma parte del
# apellido paterno compuesto: "DEL RIO", "SAN MARTIN", "DE LA FUENTE", etc.
_PARTICULAS_SIMPLE = {'DE', 'DEL', 'SAN', 'SANTA', 'SANTO', 'VAN', 'VON', 'DOS', 'DAS'}
_PARTICULAS_DOBLE  = {'DE LA', 'DE LAS', 'DE LOS', 'DE LES'}


logger = logging.getLogger(__name__)


# ── Indicadores de persona jurídica ──────────────────────────────────────────
# Si alguna palabra del nombre (sin puntos) coincide con este set, es empresa.
# Se excluyen términos ambiguos (ciudades, adjetivos, palabras de 1-2 letras).
_INDICADORES_EMPRESA = {
    # Formas jurídicas chilenas e internacionales
    'SA', 'SPA', 'LTDA', 'LIMITADA', 'EIRL', 'SRL', 'SAC', 'LLC',
    'CORP', 'CORPORATION', 'INC', 'CIA', 'CÍA', 'CIAS', 'CO',
    'HOLDING', 'GROUP', 'GRUPO',
    # Rubros y giros inequívocamente empresariales
    'CONSTRUCTORA', 'INMOBILIARIA', 'INVERSIONES', 'CONSULTORA',
    'ASESORIAS', 'ASESORÍAS', 'TECNOLOGIA', 'TECNOLOGÍA',
    'INGENIERIA', 'INGENIERÍA', 'ARQUITECTURA',
    'COMERCIALIZADORA', 'DISTRIBUIDORA', 'IMPORTADORA', 'EXPORTADORA',
    'AGRICOLA', 'AGRÍCOLA', 'GANADERA', 'FORESTAL', 'PESQUERA', 'MINERA',
    'FARMACEUTICA', 'FARMACÉUTICA', 'LABORATORIO',
    'CLINICA', 'CLÍNICA',
    'FINANCIERA', 'COOPERATIVA', 'MUTUAL', 'SINDICATO',
    'CORPORACION', 'CORPORACIÓN', 'FUNDACION', 'FUNDACIÓN',
    'ASOCIACION', 'ASOCIACIÓN',
    'SOCIEDAD', 'SOCIEDADES', 'INDUSTRIA', 'INDUSTRIAS',
    'EMPRESA', 'EMPRESAS', 'COMPANIA', 'COMPAÑIA', 'COMPAÑÍA',
    'PRODUCTORA', 'PROCESADORA', 'COMERCIALIZADORA',
    'LOGISTICA', 'LOGÍSTICA', 'NAVIERA', 'AEROLINEA', 'AEROLÍNEA',
    'CORREDORA', 'FACTORING', 'LEASING',
    'CERVECERIA', 'CERVECERÍA', 'DESTILERIA', 'DESTILERÍA',
    'RETAIL', 'SERVICIOS', 'TEXTIL', 'HOTELERIA', 'HOTELERÍA',
    'CATERING', 'RECICLAJE', 'SOFTWARE', 'COMUNICACIONES',
    'TRANSPORTE', 'QUIMICA', 'QUÍMICA', 'ELECTRICA', 'ELÉCTRICA',
}


# ── Normalización de nombre ───────────────────────────────────────────────────

def _normalizar_nombre_cliente(nombre: str) -> str:
    """
    Convierte nombre BDC (NOMBRE APELLIDO1 APELLIDO2) a orden notarial
    (APELLIDO1 APELLIDO2 NOMBRE), todo en mayúsculas.
    Para personas jurídicas (detectadas por palabras clave) no se invierte.

    Detecta apellidos compuestos con partícula (DEL RIO, SAN MARTIN, DE LA FUENTE):
      - Partícula simple (DE, DEL, SAN…): apellido paterno ocupa 3 posiciones finales
      - Partícula doble (DE LA, DE LOS…): apellido paterno ocupa 4 posiciones finales
    """
    partes = nombre.strip().upper().split()
    if len(partes) <= 2:
        return " ".join(partes)
    # Empresa: cualquier palabra sin puntos que coincida → no invertir
    if any(p.replace('.', '') in _INDICADORES_EMPRESA for p in partes):
        return " ".join(partes)

    # Apellido paterno con partícula doble: "DE LA FUENTE", "DE LOS RÍOS"…
    if len(partes) >= 5 and ' '.join(partes[-4:-2]) in _PARTICULAS_DOBLE:
        apellidos = partes[-4:]
        nombres   = partes[:-4]
        return " ".join(apellidos + nombres)

    # Apellido paterno con partícula simple: "DEL RIO", "SAN MARTIN"…
    if len(partes) >= 4 and partes[-3] in _PARTICULAS_SIMPLE:
        apellidos = partes[-3:]
        nombres   = partes[:-3]
        return " ".join(apellidos + nombres)

    # Estándar: últimas 2 palabras son los 2 apellidos
    apellidos = partes[-2:]
    nombres   = partes[:-2]
    return " ".join(apellidos + nombres)


# ── Detección de co-deudores ──────────────────────────────────────────────────

def _procesar_codeudores(clausulas: str) -> tuple[str, list[dict]]:
    """
    Detecta co-deudores tras 'y' sin tratamiento previo usando BD de nombres.
    Pone el nombre en mayúsculas y agrega tratamiento correcto.
    Retorna (clausulas modificadas, lista [{nombre_up, tratamiento}]).
    """
    patron = (
        r'\b([yY])\s+'
        r'(?!(?:don|doña)\s)'
        r'([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+'
        r'(?:\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+){2,4})'
    )
    codeudores: list[dict] = []
    vistos: set[str] = set()

    def _reemplazar(m: re.Match) -> str:
        nombre_candidato = m.group(2)
        primer_nombre    = nombre_candidato.strip().split()[0]
        tratamiento      = obtener_tratamiento(primer_nombre)
        if not tratamiento:
            return m.group(0)
        # Normalizar espacios múltiples: el borrador puede traer "JOSE  ESPINOSA"
        # con doble espacio, pero clausulas_tx (tras _limpiar_puntuacion) tiene
        # espacio simple → sin normalización el patrón de negrita no matchearía.
        nombre_up = re.sub(r'\s+', ' ', nombre_candidato.strip().upper())
        if nombre_up not in vistos:
            vistos.add(nombre_up)
            codeudores.append({"nombre_up": nombre_up, "tratamiento": tratamiento})
        return f"{m.group(1)} {tratamiento} {nombre_up}"

    clausulas = re.sub(patron, _reemplazar, clausulas, flags=re.UNICODE)
    return clausulas, codeudores


def _procesar_codeudores_con_don(
    clausulas: str, nombre_up_cliente: str
) -> tuple[str, list[dict]]:
    """
    Detecta co-deudores que ya traían 'don/doña' en el texto, pero solo si
    van precedidos de 'y'. Esto evita falsos positivos con referencias a la
    notaria, apoderados u otras personas mencionadas en las cláusulas.
    Excluye al cliente principal. Pone los nombres en mayúsculas.
    Retorna (clausulas modificadas, lista [{nombre_up, tratamiento}]).
    """
    patron = (
        r'([yY]\s+)(don|doña)\s+'
        r'([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+'
        r'(?:\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+){2,4})'
    )
    codeudores: list[dict] = []
    vistos: set[str] = set()

    def _reemplazar(m: re.Match) -> str:
        nombre_up = m.group(3).upper()
        if nombre_up != nombre_up_cliente and nombre_up not in vistos:
            vistos.add(nombre_up)
            codeudores.append({
                "nombre_up": nombre_up,
                "tratamiento": m.group(2).lower(),
            })
        return m.group(1) + m.group(2) + ' ' + nombre_up

    clausulas = re.sub(patron, _reemplazar, clausulas)
    return clausulas, codeudores


def _sufijo_titulo(codeudores: list[dict]) -> str:
    """Retorna ' Y OTRO' o ' Y OTRA' según el género del primer co-deudor."""
    if not codeudores:
        return ""
    return " Y OTRO" if codeudores[0]["tratamiento"] == "don" else " Y OTRA"


# ── Función pública ───────────────────────────────────────────────────────────

def procesar_nombres_borrador(doc_entrada: Document, datos: dict) -> dict:
    """
    Procesa todos los nombres del borrador BDC y retorna los datos enriquecidos.

    Modifica datos in-place (nombre_cliente, sufijo_titulo) y retorna:
      clausulas_tx     → texto de cláusulas con números en letras
      nombres_en_cuerpo → lista de nombres en mayúsculas para negrita en cuerpo
      sufijo_titulo    → '' | ' Y OTRO' | ' Y OTRA'
      comuna           → nombre de la ciudad del Conservador en mayúsculas
    """
    nombre_original = datos["nombre_cliente"]
    datos["nombre_cliente"] = _normalizar_nombre_cliente(nombre_original)
    nombre_up = nombre_original.upper()

    clausulas = _extraer_clausulas(doc_entrada)

    # Mayúsculas en cliente principal — patrón que ignora diferencias de tilde
    # entre el nombre del banco (sin tildes) y el texto del borrador (con tildes)
    clausulas = re.sub(
        _patron_nombre_flexible(nombre_original), nombre_up, clausulas, flags=re.UNICODE
    )

    # Agregar tratamiento al cliente principal via BD de nombres
    primer_nombre = nombre_original.strip().split()[0]
    tratamiento   = obtener_tratamiento(primer_nombre)
    if tratamiento:
        clausulas = re.sub(
            r'(?:(?:don|doña)\s+)?' + _patron_ignorar_tildes(nombre_up),
            f'{tratamiento} {nombre_up}',
            clausulas,
            flags=re.IGNORECASE,
        )

    # Co-deudores sin tratamiento previo (detectados por BD)
    clausulas, codeudores_bd = _procesar_codeudores(clausulas)

    # Co-deudores con don/doña ya en el texto
    clausulas, codeudores_don = _procesar_codeudores_con_don(clausulas, nombre_up)

    todos_codeudores = codeudores_bd + codeudores_don
    datos["sufijo_titulo"] = _sufijo_titulo(todos_codeudores)

    # Incluir tanto el nombre en orden BDC (tal como aparece en el cuerpo)
    # como el nombre en orden notarial (APELLIDO NOMBRE) por si el borrador
    # trae el nombre ya invertido en alguna cláusula.
    nombres_en_cuerpo = [nombre_up]
    nombre_notarial_up = datos["nombre_cliente"].upper()
    if nombre_notarial_up not in nombres_en_cuerpo:
        nombres_en_cuerpo.append(nombre_notarial_up)
    for c in todos_codeudores:
        if c["nombre_up"] not in nombres_en_cuerpo:
            nombres_en_cuerpo.append(c["nombre_up"])

    comuna       = _extraer_comuna_conservador(doc_entrada)
    clausulas_tx = transformar_texto(clausulas)

    return {
        "clausulas_tx":      clausulas_tx,
        "nombres_en_cuerpo": nombres_en_cuerpo,
        "sufijo_titulo":     datos["sufijo_titulo"],
        "comuna":            comuna,
    }
