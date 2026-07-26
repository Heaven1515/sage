"""
Lógica de negocio del módulo Postfirma.

Flujo principal (procesar_pdfs):
  1. Lee todos los PDFs de la carpeta origen
  2. Extrae N° certificado y N° repertorio de la página 1 de cada PDF (pdfplumber)
  3. Consulta vb_registro para obtener WF, cliente, RUT, comuna
  4. Actualiza el campo firma_electronica en vb_registro
  5. Renombra: 'WF{wf}-RUT{rut}-{cliente}-COMUNA {comuna}-REP{rep}-FE {cert}.pdf' (con prefijo REC/PRENDA/BANLEGAL si aplica)
  6. Mueve el archivo a {ruta_destino}/{DD-MM-YYYY}/
  7. Genera el JSON con las escrituras de SANTIAGO (para inscripción en el CBR)
  8. Guarda el JSON en la carpeta del día
"""

import importlib
import json
import logging
import random
import re
import shutil
import unicodedata
from datetime import datetime
from pathlib import Path

import pdfplumber
from sqlalchemy.orm import Session

from .model import PostfirmaConfig
from .schema import PostfirmaConfigSchema, ResultadoPDF, ResultadoProcesamiento


def _es_modo_demo(db: Session) -> bool:
    """Consulta si el modo demo está activo."""
    cfg_mod = importlib.import_module("modules.07_configuracion.controller")
    return cfg_mod.es_modo_demo(db)

logger = logging.getLogger(__name__)

# Lista fija de correos de notificación para el JSON del CBR de Santiago
_NOTIFICACIONES = [
    "gestoriabca@romeroyasociados.cl",
    "alzamientos_bch@notariatorrealba.cl",
    "cfaundezr@bancochile.cl",
    "gvpintob@bancochile.cl",
    "sinostro@bancochile.cl",
    "ylagos@bancochile.cl",
]

# Patrones para extraer datos de la página 1 del PDF
_RE_CERTIFICADO  = re.compile(r"Certificado Nro\s+([A-Za-z0-9]+)", re.IGNORECASE)
_RE_REPERTORIO   = re.compile(r"Repertorio\s+(?:N[°oº?]|Nro)\s*:?\s*(\d+)\s*-\s*(\d+)", re.IGNORECASE)
_RE_CONSERVADOR  = re.compile(
    r"Conservador\s+de\s+Bienes\s+Ra[ií]ces\s+de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ ]+?)(?=[,.\n\r]|$)",
    re.IGNORECASE | re.MULTILINE,
)


# ── Configuración ─────────────────────────────────────────────────────────────

def obtener_config(db: Session) -> PostfirmaConfigSchema:
    """Retorna la configuración actual de carpetas."""
    config = _obtener_o_crear_config(db)
    if _es_modo_demo(db):
        return PostfirmaConfigSchema(
            ruta_origen=config.ruta_origen or r"C:\SAGE_Demo\Firmados",
            ruta_destino=config.ruta_destino or r"C:\SAGE_Demo\Procesados",
        )
    return PostfirmaConfigSchema.model_validate(config)


def seleccionar_carpeta_origen(db: Session) -> PostfirmaConfigSchema:
    """Abre diálogo tkinter para elegir la carpeta con PDFs firmados electrónicamente."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.wm_attributes("-topmost", True)
    ruta = filedialog.askdirectory(title="Seleccionar carpeta de PDFs firmados")
    root.destroy()

    config = _obtener_o_crear_config(db)
    if ruta:
        config.ruta_origen = ruta
        db.commit()
        logger.info("Carpeta origen configurada: %s", ruta)
    return PostfirmaConfigSchema.model_validate(config)


def seleccionar_carpeta_destino(db: Session) -> PostfirmaConfigSchema:
    """Abre diálogo tkinter para elegir la carpeta base de destino."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.wm_attributes("-topmost", True)
    ruta = filedialog.askdirectory(title="Seleccionar carpeta de destino")
    root.destroy()

    config = _obtener_o_crear_config(db)
    if ruta:
        config.ruta_destino = ruta
        db.commit()
        logger.info("Carpeta destino configurada: %s", ruta)
    return PostfirmaConfigSchema.model_validate(config)


# ── Procesamiento principal ───────────────────────────────────────────────────

def procesar_pdfs(db: Session) -> ResultadoProcesamiento:
    """
    Procesa todos los PDFs de la carpeta origen:
    renombra, mueve a subcarpeta del día y genera JSON para Santiago.
    En modo demo: simula el procesamiento con datos de vb_registro.
    """
    config = _obtener_o_crear_config(db)

    # Modo demo: solo si está explícitamente activado en configuración
    if _es_modo_demo(db):
        return _procesar_demo(db)

    if not config.ruta_origen or not config.ruta_destino:
        raise ValueError("Configura las carpetas de origen y destino antes de procesar")

    carpeta_origen  = Path(config.ruta_origen)
    carpeta_destino = Path(config.ruta_destino)

    if not carpeta_origen.exists():
        raise ValueError(f"La carpeta de origen no existe: {config.ruta_origen}")
    if not carpeta_destino.exists():
        raise ValueError(f"La carpeta de destino no existe: {config.ruta_destino}")

    # Crear subcarpeta del día en el destino
    hoy         = datetime.now()
    nombre_dia  = hoy.strftime("%d-%m-%Y")
    carpeta_dia = carpeta_destino / nombre_dia
    carpeta_dia.mkdir(exist_ok=True)

    pdfs = sorted(carpeta_origen.glob("*.pdf"))
    resultados:    list[ResultadoPDF] = []
    entradas_json: list[dict]         = []
    wfs_en_json:   set[str]           = set()   # evita duplicados en el JSON del CBR

    for ruta_pdf in pdfs:
        resultado = _procesar_un_pdf(ruta_pdf, carpeta_dia, db)
        resultados.append(resultado)

        if resultado.en_json and resultado.wf not in wfs_en_json:
            wfs_en_json.add(resultado.wf)
            entradas_json.append({
                "tipo":              7,
                "codDocElectronico": resultado.certificado,
                "observacion":       resultado.wf,
                "notificaciones":    _NOTIFICACIONES,
            })

    # Guardar JSON en la carpeta del día si hay entradas de Santiago
    json_guardado_en = None
    if entradas_json:
        nombre_json      = f"ALZAMIENTOS-Banco_de_Chile-{hoy.strftime('%d-%m-%y-%H-%M')}.json"
        ruta_json        = carpeta_dia / nombre_json
        ruta_json.write_text(
            json.dumps(entradas_json, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        json_guardado_en = str(ruta_json)
        logger.info("JSON generado: %s (%d entradas de Santiago)", ruta_json, len(entradas_json))

    return ResultadoProcesamiento(
        total            = len(resultados),
        procesados       = sum(1 for r in resultados if r.estado == "ok"),
        sin_datos        = sum(1 for r in resultados if r.estado == "sin_datos"),
        con_error        = sum(1 for r in resultados if r.estado == "error"),
        santiago_count   = len(entradas_json),
        banlegal_count   = sum(1 for r in resultados if r.es_banlegal),
        json_guardado_en = json_guardado_en,
        carpeta_dia      = str(carpeta_dia),
        resultados       = resultados,
    )


# ── Modo demo ────────────────────────────────────────────────────────────────

def _procesar_demo(db: Session) -> ResultadoProcesamiento:
    """
    Simula 100 operaciones de postfirma con datos hardcodeados.
    No depende de la BD ni de carpetas locales — funciona en cualquier PC.
    75 operaciones basadas en archivos reales + 25 inventadas con el mismo patrón.
    """
    hoy = datetime.now()

    # (wf, rut, cliente, comuna, materia) — datos reales de la carpeta de pruebas
    _DATOS = [
        ("1042635", "8765432-1", "GUERRERO BLANCO MILANA DEL CARMEN", "ANDACOLLO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1044333", "7690123-4", "JIMENA PAZ GODOY GRASSO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1047986", "12456789-0", "JUAN GABRIEL RUIZ PALMA", "ANGOL", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1048374", "16234567-8", "CAROLINA ANDREA AGUILERA AVELLO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1049036", "9876543-2", "MONICA CECILIA VILCHES FLORES", "PUERTO AYSEN", "ALZAMIENTO DE HIPOTECA"),
        ("1049066", "14567890-K", "JORGE ANDRES MEZA FUENTES", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1049076", "11234567-3", "CLAUDIA MARCELA PIZARRO SOTO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1049121", "7456789-1", "ARTURO COUSINO PARADA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1050077", "13678901-5", "PATRICIO EDUARDO DIAZ ARAYA", "QUILPUE", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1050601", "18901234-6", "ANDREA SOLEDAD ROJAS PINTO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1050884", "10345678-7", "HECTOR RAUL CAMPOS VERA", "VICTORIA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051213", "15678234-K", "MONICA EUGENIA MONTECINO LUENGO", "TALCA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051334", "12890123-8", "RODOLFO ANDRES GONGORA CABRERA", "IQUIQUE", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051345", "8234567-9", "ALFREDO MIGUEL YORI FERNANDEZ", "SAN PEDRO DE LA PAZ", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051432", "16789345-3", "LORENA DEL PILAR LOYOLA MUNOZ", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051526", "11567890-4", "CARLOS ALFREDO ZUAZNABAR CORVALAN", "LA SERENA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051530", "14012345-0", "MARIA ANGELICA SOFFIA GARCIA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051596", "9345678-1", "VIVIANA ISABEL GALLEGUILLOS BUGUENO", "CALAMA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051689", "17456789-9", "NELSON PATRICIO VEGA CONTRERAS", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051724", "13901234-4", "RODRIGO FELIPE MUÑOZ TAPIA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA, PROHIBICION Y PRENDA"),
        ("1051746", "10678901-2", "VALERIA FARRAH WELCH AMARILES", "LINARES", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051799", "15234567-5", "MARIO ENRIQUE SAAVEDRA JARA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA, PROHIBICION Y PRENDA"),
        ("1051830", "8901234-6", "DANIELA ANDREA COFRE MARIN", "COPIAPO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051842", "12345678-9", "MARIA TRINIDAD ACHONDO GOMEZ", "VALPARAISO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051901", "16012345-7", "FERNANDO ANDRES SILVA PAREDES", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1051993", "11890123-3", "PAOLA CAROLINA BOLIVAR CASTILLO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052000", "7123456-8", "CARLOS ENRIQUE MORALES VIDAL", "VALPARAISO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052106", "14345678-8", "JESSICA PATRICIA LEON ARAVENA", "PUERTO CISNES", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052112", "18567890-1", "ALEJANDRO NICOLAS REYES PONCE", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052134", "10123456-0", "ROSA ELENA GUTIERREZ CACERES", "MELIPILLA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052145", "13456789-2", "JORGE LUIS CARRASCO BRAVO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052181", "9678901-4", "CLAUDIA IVONNE SEPULVEDA RIVAS", "VILLARRICA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052204", "15890123-6", "PEDRO PABLO FUENTES ALARCON", "LA SERENA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052213", "12567890-K", "LUIS OMAR SOTO CARDENAS", "ANCUD", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052233", "8345678-7", "MARCELA CRISTINA VEGA ALVARADO", "TEMUCO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052270", "16901234-5", "GONZALO ANDRES MARTINEZ LAGOS", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052276", "11234567-3", "SILVIA ROSA ARAYA ESPINOZA", "LA LIGUA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052285", "14678901-7", "RAUL ERNESTO TAPIA GONZALEZ", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052288", "7890123-9", "PATRICIA ELENA NUNEZ CORTES", "ANTOFAGASTA", "ALZAMIENTO DE HIPOTECA"),
        ("1052291", "13012345-3", "FELIPE ANDRES CASTILLO ROJAS", "TALCA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052292", "18234567-K", "LORENA ANDREA PIZARRO HERRERA", "COQUIMBO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052295", "10456789-1", "MARCO ANTONIO VERGARA SOTO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052299", "15123456-4", "CARMEN GLORIA DONOSO PEREZ", "OVALLE", "ALZAMIENTO DE HIPOTECA"),
        ("1052302", "9012345-2", "FRANCISCO JAVIER PINO INOSTROZA", "POZO ALMONTE", "ALZAMIENTO DE HIPOTECA"),
        ("1052312", "12789012-0", "MIGUEL ANGEL ORELLANA DIAZ", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052319", "17012345-6", "ANDREA PATRICIA LAGOS FIGUEROA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052339", "11678901-8", "CRISTIAN RODRIGO MORA SANCHEZ", "CONCEPCION", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052358", "8567890-5", "SOLEDAD ANDREA RIQUELME CASTRO", "COQUIMBO", "ALZAMIENTO DE HIPOTECA"),
        ("1052421", "14901234-9", "JUAN PABLO HENRIQUEZ GATICA", "LOS ANGELES", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052428", "7345678-0", "CAROLINA ELIZABETH TORRES MEZA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052483", "16345678-1", "PABLO ANDRES VALENZUELA RIOS", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052485", "13234567-6", "NATALIA ANDREA CIFUENTES LARA", "CONCEPCION", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052487", "10789012-3", "SERGIO ALEJANDRO MOYA PAREDES", "CASABLANCA", "ALZAMIENTO DE HIPOTECA"),
        ("1052488", "18890123-4", "VALENTINA PAZ FLORES MIRANDA", "LA SERENA", "ALZAMIENTO DE HIPOTECA"),
        ("1052489", "9234567-7", "EDUARDO NICOLAS CONTRERAS VEGA", "VALPARAISO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052491", "15456789-8", "DANIELA SOLEDAD CARVAJAL MUÑOZ", "ANTOFAGASTA", "ALZAMIENTO DE HIPOTECA"),
        ("1052492", "12012345-5", "RICARDO HERNAN BRAVO ESPINOZA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052499", "8123456-K", "MARIA JOSE SANDOVAL LEIVA", "CONSTITUCION", "ALZAMIENTO DE HIPOTECA"),
        ("1052504", "14234567-2", "VICTOR MANUEL PAREDES CORTES", "LA SERENA", "ALZAMIENTO DE HIPOTECA"),
        ("1052507", "17234567-0", "ANA MARIA GALLARDO RUIZ", "ILLAPEL", "ALZAMIENTO DE HIPOTECA"),
        ("1052619", "11345678-6", "JOSE JAIME AUDA JELVEZ", "CURICO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052690", "9567890-9", "RODRIGO HUMBERTO BLANCH CARRIZO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052693", "16567890-3", "ROBERTO EDUARDO ALBORNOZ MALUENDA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052695", "13567890-K", "PAULA DE LA LUZ ARANCIBIA RODRIGUEZ", "CONCON", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052696", "7678901-2", "ALFREDO ENRIQUE HERNANDEZ PALMA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052698", "10901234-5", "SOLANGE MARION ENERO SILVA", "SAN MIGUEL", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052699", "15012345-K", "RODRIGO ESTEBAN NUNEZ LAYANA", "VALPARAISO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052701", "18345678-7", "GLADYS ROCIO SISA PERRAZO", "VINA DEL MAR", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052703", "8456789-3", "MARIA CECILIA SUAREZ DE CAMINO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052705", "12678901-4", "EDISON LEONEL QUITRAL MANZANO", "ANTOFAGASTA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052874", "14789012-6", "LAURA TERESA REYMAN ANGUERA", "SAN PEDRO DE LA PAZ", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052881", "17678901-8", "VICTOR HUGO MORENO ARAYA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052891", "11901234-1", "CARLOS MAURO MUNOZ PEREZ", "SAN BERNARDO", "ALZAMIENTO DE HIPOTECA"),
        ("1052918", "9890123-0", "MARIANA MAGDALENA MEDINA FRANCO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        # 25 operaciones inventadas siguiendo el mismo patrón
        ("1052950", "16890123-9", "FABIOLA ANDREA JARA MOLINA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052962", "13789012-7", "HECTOR PATRICIO NAVARRO VERGARA", "RANCAGUA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052978", "10567890-6", "SANDRA PATRICIA VASQUEZ PENA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1052985", "7901234-5", "CRISTOBAL ANDRES LEON CAMPOS", "OSORNO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1052991", "15345678-2", "TATIANA ELENA FIGUEROA REYES", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053004", "12234567-K", "MANUEL ALEJANDRO CORTES GATICA", "CHILLAN", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053012", "18678901-3", "LORETO PAULINA MIRANDA SAAVEDRA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053025", "8678901-8", "GONZALO PATRICIO ESPINOZA TAPIA", "PUNTA ARENAS", "ALZAMIENTO DE HIPOTECA"),
        ("1053038", "14456789-0", "CARMEN ROSA HERRERA LEIVA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053042", "17345678-4", "JOSE MIGUEL ARAVENA FUENTES", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053055", "11456789-9", "PAULA FRANCISCA BRAVO ARAYA", "VALDIVIA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053061", "9123456-1", "DIEGO ANDRES RAMIREZ MOLINA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
        ("1053074", "16012345-7", "CECILIA ANDREA TOLEDO PARRA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053082", "13123456-9", "FERNANDO JAVIER ROJAS CASTILLO", "ARICA", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053095", "7567890-6", "VERONICA SOLEDAD CAMPOS DIAZ", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053101", "10234567-1", "RODRIGO ANTONIO SILVA HENRIQUEZ", "TALCAHUANO", "ALZAMIENTO DE HIPOTECA"),
        ("1053114", "15678901-5", "MARCELA ANDREA GONZALEZ VARGAS", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053122", "18012345-3", "LUIS ALBERTO SOTO CONTRERAS", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053135", "8234567-9", "DANIELA IGNACIA PEREZ FUENTES", "COPIAPO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053141", "14567890-K", "ALEJANDRO ANDRES MUÑOZ REYES", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053158", "11789012-5", "INES CAROLINA LAGOS MARTINEZ", "LA SERENA", "ALZAMIENTO DE HIPOTECA"),
        ("1053164", "17890456-8", "CARLOS EDUARDO VERGARA PIZARRO", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053177", "9456789-3", "FRANCISCA ELENA MORALES CASTRO", "PUERTO MONTT", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053183", "16234567-8", "OSCAR PATRICIO CORTES AGUILAR", "SANTIAGO", "ALZAMIENTO DE HIPOTECA Y PROHIBICION"),
        ("1053196", "13345678-2", "ROSA ELIZABETH RIQUELME MEZA", "SANTIAGO", "ALZAMIENTO DE HIPOTECA"),
    ]

    resultados:    list[ResultadoPDF] = []
    entradas_json: list[dict]         = []
    rep_base       = 4800

    for i, (wf, rut, cliente, comuna, materia) in enumerate(_DATOS):
        repertorio  = str(rep_base + i)
        certificado = str(123457078001 + i)

        # Flags: ~5% BANLEGAL (cada 20, pos 3,23,43,63,83), ~5% REC (cada 20, pos 7,27,47,67,87)
        es_banlegal = i % 20 == 3
        es_rec      = i % 20 == 7
        es_prenda   = "PRENDA" in materia.upper()
        es_santiago = comuna == "SANTIAGO"
        en_json     = es_santiago and not es_banlegal

        nombre_nuevo = _construir_nombre(
            wf, rut, cliente, comuna, repertorio, certificado,
            es_rec, es_prenda, [], es_banlegal
        )

        resultado = ResultadoPDF(
            nombre_original=f"documento_firmado_{i + 1:03d}.pdf",
            nombre_nuevo=nombre_nuevo,
            certificado=certificado,
            wf=wf,
            nombre_cliente=cliente,
            rut=rut,
            repertorio=repertorio,
            anio=hoy.year,
            comuna=comuna,
            materia=materia,
            en_json=en_json,
            es_banlegal=es_banlegal,
            estado="ok",
        )
        resultados.append(resultado)

        if en_json:
            entradas_json.append({
                "tipo": 7,
                "codDocElectronico": certificado,
                "observacion": wf,
                "notificaciones": _NOTIFICACIONES,
            })

    carpeta_dia_str = f"C:\\SAGE_Demo\\Procesados\\{hoy.strftime('%d-%m-%Y')}"
    json_nombre     = f"ALZAMIENTOS-Banco_de_Chile-{hoy.strftime('%d-%m-%y-%H-%M')}.json"
    json_path       = f"{carpeta_dia_str}\\{json_nombre}" if entradas_json else None

    logger.info("DEMO | Postfirma simulado: %d PDFs, %d en JSON", len(resultados), len(entradas_json))

    return ResultadoProcesamiento(
        total=len(resultados),
        procesados=len(resultados),
        sin_datos=0,
        con_error=0,
        santiago_count=len(entradas_json),
        banlegal_count=sum(1 for r in resultados if r.es_banlegal),
        json_guardado_en=json_path,
        carpeta_dia=carpeta_dia_str,
        resultados=resultados,
    )


# ── Lógica interna ────────────────────────────────────────────────────────────

def _procesar_un_pdf(ruta_pdf: Path, carpeta_dia: Path, db: Session) -> ResultadoPDF:
    """
    Procesa un PDF individual: extrae datos, consulta BD, renombra y mueve.
    """
    resultado = ResultadoPDF(nombre_original=ruta_pdf.name)

    # Extraer certificado, repertorio, conservadores y flag BANLEGAL del PDF
    try:
        certificado, repertorio, anio, comunas_pdf, es_banlegal = _extraer_datos_pdf(ruta_pdf)
        resultado.certificado  = certificado
        resultado.repertorio   = repertorio
        resultado.anio         = anio
        resultado.es_banlegal  = es_banlegal
    except Exception as exc:
        resultado.estado = "error"
        resultado.error  = f"Error leyendo PDF: {exc}"
        logger.error("Error leyendo %s: %s", ruta_pdf.name, exc)
        return resultado

    # Buscar en vb_registro para obtener WF, cliente, RUT, comuna
    registro = _buscar_en_registro(repertorio, anio, db)

    if registro is None:
        # Sin datos en BD: renombrar con lo que tenemos
        nombre_nuevo           = f"{certificado}-REPERTORIO_{repertorio}.pdf"
        resultado.nombre_nuevo = nombre_nuevo
        resultado.estado       = "sin_datos"
        resultado.error        = f"Repertorio {repertorio}-{anio} no encontrado en vb_registro"
        logger.warning("Sin datos en BD: repertorio %s-%s (archivo: %s)", repertorio, anio, ruta_pdf.name)
    else:
        resultado.wf             = registro.wf
        resultado.nombre_cliente = registro.nombre_cliente
        resultado.rut            = registro.rut
        resultado.comuna         = registro.comuna

        # BANLEGAL: detectar por BD o por texto del PDF
        es_banlegal            = es_banlegal or getattr(registro, "es_banlegal", False)
        resultado.es_banlegal  = es_banlegal

        es_rec                 = _es_rec(registro.wf, db)
        es_prenda              = "PRENDA" in (registro.materia or "").upper()
        nombre_nuevo           = _construir_nombre(
            registro.wf, registro.rut, registro.nombre_cliente,
            registro.comuna, repertorio, certificado,
            es_rec, es_prenda, comunas_pdf if es_prenda else [], es_banlegal
        )
        resultado.nombre_nuevo = nombre_nuevo
        resultado.materia      = registro.materia
        resultado.estado       = "ok"
        # BANLEGAL no va al JSON del CBR, no se sube a Drive, no va en planilla
        resultado.en_json      = (registro.comuna or "").upper() == "SANTIAGO" and not es_banlegal

        # Guardar el N° de certificado como firma_electronica en vb_registro
        try:
            registro.firma_electronica = certificado
            registro.fecha_postfirma = datetime.now().date()
            db.commit()
        except Exception as exc:
            logger.error("Error guardando firma_electronica para repertorio %s: %s", repertorio, exc)

    # Mover el archivo renombrado a la carpeta del día
    try:
        destino = carpeta_dia / resultado.nombre_nuevo
        shutil.move(str(ruta_pdf), str(destino))
        logger.info("Procesado: %s → %s", ruta_pdf.name, destino.name)
    except Exception as exc:
        resultado.estado = "error"
        resultado.error  = f"Error moviendo archivo: {exc}"
        logger.error("Error moviendo %s: %s", ruta_pdf.name, exc)

    return resultado


def _extraer_datos_pdf(ruta_pdf: Path) -> tuple[str, str, int, list[str], bool]:
    """
    Lee el PDF completo y extrae N° certificado, N° repertorio, año,
    lista de comunas del Conservador y flag BANLEGAL.
    Lanza ValueError si no encuentra certificado o repertorio.
    """
    with pdfplumber.open(str(ruta_pdf)) as pdf:
        texto_p1   = pdf.pages[0].extract_text() or ""
        texto_todo = "\n".join(p.extract_text() or "" for p in pdf.pages)

    m_cert = _RE_CERTIFICADO.search(texto_p1)
    m_rep  = _RE_REPERTORIO.search(texto_p1)

    if not m_cert:
        raise ValueError("No se encontró 'Certificado Nro' en la página 1")
    if not m_rep:
        raise ValueError("No se encontró 'Repertorio N°' en la página 1")

    # Detectar si es documento BANLEGAL (aparece en el encabezado del doc formateado)
    es_banlegal = bool(re.search(r'\bBANLEGAL\b', texto_p1))

    # Extraer todas las comunas del Conservador del documento completo (deduplicadas)
    seen: set[str] = set()
    comunas: list[str] = []
    for m in _RE_CONSERVADOR.finditer(texto_todo):
        c = _sin_tildes(m.group(1).strip().upper())
        if c not in seen:
            seen.add(c)
            comunas.append(c)

    return m_cert.group(1), m_rep.group(1), int(m_rep.group(2)), comunas, es_banlegal


def _buscar_en_registro(repertorio: str, anio: int, db: Session):
    """Consulta vb_registro por repertorio + año. Retorna el objeto ORM o None."""
    registro_model = importlib.import_module("modules.09_repertorios.registro_model")
    VBRegistro     = registro_model.VBRegistro
    return (
        db.query(VBRegistro)
        .filter(VBRegistro.repertorio == repertorio, VBRegistro.anio == anio)
        .first()
    )


def _sin_tildes(texto: str) -> str:
    """Elimina tildes y acentos. 'PROHIBICIÓN' → 'PROHIBICION', 'ñ' → 'n'."""
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def _es_rec(wf: str, db: Session) -> bool:
    """Retorna True si alguna fila del WF contiene la palabra completa REC en actividad_actual."""
    from sqlalchemy import text as sa_text
    filas = db.execute(
        sa_text("""
            SELECT actividad_actual FROM vb_snapshot_filas
            WHERE numero_carpeta = :wf
              AND actividad_actual IS NOT NULL
        """),
        {"wf": wf},
    ).fetchall()
    # Buscar la palabra REC completa (no RECTIFICACION, DECRETO, etc.)
    return any(re.search(r'\bREC\b', fila[0], re.IGNORECASE) for fila in filas)


def _construir_nombre(wf: str, rut: str | None, nombre_cliente: str | None,
                      comuna: str | None, repertorio: str | None,
                      certificado: str | None, es_rec: bool,
                      es_prenda: bool = False, comunas_pdf: list[str] | None = None,
                      es_banlegal: bool = False) -> str:
    """
    Construye el nombre final del archivo.
    Formato: {PREFIJO-}WF{wf}-RUT{rut}-{cliente}-COMUNA {comuna}-REP{repertorio}-FE {certificado}.pdf
    Prefijos posibles: REC, PRENDA, BANLEGAL (solo si aplica).
    """
    # Limpiar caracteres ilegales en nombres de archivo Windows
    def _limpiar(texto: str) -> str:
        return re.sub(r'[\\/:*?"<>|]', "_", _sin_tildes(texto))

    rut_str     = rut or "SIN_RUT"
    cliente_str = _limpiar((nombre_cliente or "SIN_CLIENTE").upper())
    rep_str     = repertorio or "SIN_REP"
    fe_str      = certificado or "SIN_FE"

    # Comuna: si es prenda con múltiples conservadores, unir con guion
    if es_prenda and comunas_pdf and len(comunas_pdf) > 1:
        comunas_limpias = [re.sub(r'[\\/:*?"<>|]', "_", c) for c in comunas_pdf]
        comuna_str = "-".join(comunas_limpias)
    else:
        comuna_str = _limpiar((comuna or "SIN_COMUNA").upper())

    # Determinar prefijo según tipo
    if es_banlegal:
        prefijo = "BANLEGAL-"
    elif es_rec:
        prefijo = "REC-"
    elif es_prenda:
        prefijo = "PRENDA-"
    else:
        prefijo = ""

    return f"{prefijo}WF{wf}-RUT{rut_str}-{cliente_str}-COMUNA {comuna_str}-REP{rep_str}-FE {fe_str}.pdf"


# ── Helper BD ─────────────────────────────────────────────────────────────────

def _obtener_o_crear_config(db: Session) -> PostfirmaConfig:
    """Retorna el singleton de configuración, creándolo si no existe."""
    config = db.query(PostfirmaConfig).filter_by(id=1).first()
    if config is None:
        config = PostfirmaConfig(id=1)
        db.add(config)
        db.commit()
    return config
