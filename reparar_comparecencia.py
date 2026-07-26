"""
Script de reparación — comparecencia sin año
============================================
Corrige escrituras donde el bug de _llenar_parrafo_fecha cortó el run
"a ____ del año dos mil veintiséis, ante mí," y dejó solo "a veinte de marzo  ".

Uso: ejecutar con Python 3.x que tenga python-docx instalado.
     pip install python-docx   (si no está instalado)

Eliminar este archivo una vez completada la reparación.
"""

import re
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, scrolledtext

from docx import Document

# ── Constantes ────────────────────────────────────────────────────────────────

SUFIJO_FALTANTE = " del año dos mil veintiséis, ante mí, "

_MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)

# Detecta el run dañado: "a [día en letras] de [mes]" sin "del año"
_PATRON_DAÑADO = re.compile(
    r"^a\s+[\w\s]+\s+de\s+(?:" + "|".join(_MESES) + r")\s*$",
    re.IGNORECASE,
)


# ── Lógica de reparación ──────────────────────────────────────────────────────

def _reparar_archivo(ruta: Path) -> str:
    """
    Abre el .docx, busca el run dañado y le agrega el sufijo faltante.
    Retorna un mensaje de resultado para mostrar en la UI.
    """
    try:
        doc = Document(str(ruta))
    except Exception as e:
        return f"  ✗ No se pudo abrir: {e}"

    reparado = False
    for p in doc.paragraphs:
        for run in p.runs:
            if _PATRON_DAÑADO.match(run.text):
                texto_original = run.text.rstrip()
                run.text = texto_original + SUFIJO_FALTANTE
                reparado = True
                break
        if reparado:
            break

    if not reparado:
        return "  — Sin cambios (run no encontrado o ya correcto)"

    try:
        doc.save(str(ruta))
        return "  ✓ Reparado correctamente"
    except Exception as e:
        return f"  ✗ No se pudo guardar: {e}"


def procesar_carpeta(ruta_carpeta: str, log: scrolledtext.ScrolledText) -> None:
    """Procesa todos los .docx de la carpeta seleccionada."""
    carpeta = Path(ruta_carpeta)
    archivos = sorted(carpeta.glob("*.docx"))

    if not archivos:
        log.insert(tk.END, "No se encontraron archivos .docx en la carpeta.\n")
        return

    log.insert(tk.END, f"Procesando {len(archivos)} archivo(s)...\n\n")

    reparados   = 0
    sin_cambios = 0
    con_error   = 0

    for archivo in archivos:
        log.insert(tk.END, f"{archivo.name}\n")
        resultado = _reparar_archivo(archivo)
        log.insert(tk.END, resultado + "\n\n")
        log.see(tk.END)
        log.update()

        if "✓" in resultado:
            reparados += 1
        elif "✗" in resultado:
            con_error += 1
        else:
            sin_cambios += 1

    log.insert(tk.END, "─" * 50 + "\n")
    log.insert(tk.END, f"Reparados: {reparados}  |  Sin cambios: {sin_cambios}  |  Errores: {con_error}\n")


# ── Interfaz gráfica ──────────────────────────────────────────────────────────

def main() -> None:
    ventana = tk.Tk()
    ventana.title("Reparar comparecencia — SAGE")
    ventana.geometry("640x480")
    ventana.resizable(True, True)

    # Variable para la ruta seleccionada
    ruta_var = tk.StringVar(value="(ninguna carpeta seleccionada)")

    # ── Fila superior: selector de carpeta ───────────────────────────────────
    frame_top = tk.Frame(ventana, pady=10, padx=10)
    frame_top.pack(fill=tk.X)

    tk.Label(frame_top, text="Carpeta con los .docx:").pack(side=tk.LEFT)

    lbl_ruta = tk.Label(
        frame_top, textvariable=ruta_var,
        fg="gray", anchor="w", width=50,
    )
    lbl_ruta.pack(side=tk.LEFT, padx=6)

    def seleccionar() -> None:
        ruta = filedialog.askdirectory(title="Seleccionar carpeta con escrituras")
        if ruta:
            ruta_var.set(ruta)
            lbl_ruta.config(fg="black")

    tk.Button(frame_top, text="Seleccionar carpeta", command=seleccionar).pack(side=tk.LEFT)

    # ── Área de log ───────────────────────────────────────────────────────────
    log = scrolledtext.ScrolledText(ventana, wrap=tk.WORD, font=("Consolas", 10))
    log.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 6))

    log.insert(
        tk.END,
        "Este script agrega  \" del año dos mil veintiséis, ante mí, \"\n"
        "a los runs de comparecencia que quedaron incompletos por el bug.\n\n"
        "Selecciona la carpeta que contiene los .docx afectados y pulsa Reparar.\n\n",
    )

    # ── Botón Reparar ─────────────────────────────────────────────────────────
    def reparar() -> None:
        ruta = ruta_var.get()
        if ruta == "(ninguna carpeta seleccionada)":
            log.insert(tk.END, "Primero selecciona una carpeta.\n")
            return
        log.insert(tk.END, "=" * 50 + "\n")
        log.insert(tk.END, f"Carpeta: {ruta}\n\n")
        btn_reparar.config(state=tk.DISABLED)
        procesar_carpeta(ruta, log)
        btn_reparar.config(state=tk.NORMAL)

    btn_reparar = tk.Button(
        ventana, text="Reparar archivos",
        bg="#1565c0", fg="white",
        font=("Arial", 11, "bold"),
        padx=12, pady=6,
        command=reparar,
    )
    btn_reparar.pack(pady=(0, 10))

    ventana.mainloop()


if __name__ == "__main__":
    main()
