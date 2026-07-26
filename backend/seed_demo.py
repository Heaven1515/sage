"""
Seed de datos demo para presentación al banco.
Puebla TODAS las tablas con datos ficticios pero realistas.

Uso:
  cd backend
  python seed_demo.py          → puebla la BD de desarrollo (./notaria.db)
  python seed_demo.py --reset  → borra datos existentes antes de poblar
"""

import random
import sys
from datetime import date, datetime, timedelta

import importlib

from database import Base, engine, SesionLocal

# Importar modelos con importlib porque las carpetas empiezan con número
_m01 = importlib.import_module("modules.01_confecciones.model")
_m02 = importlib.import_module("modules.02_vb.model")
_m03 = importlib.import_module("modules.03_prefirma.model")
_m04 = importlib.import_module("modules.04_postfirma.model")
_m05 = importlib.import_module("modules.05_boveda.model")
_m07 = importlib.import_module("modules.07_configuracion.model")
_m09 = importlib.import_module("modules.09_repertorios.registro_model")

Confeccion = _m01.Confeccion
VBEscritura = _m02.VBEscritura
VBSnapshotFila = _m02.VBSnapshotFila
PrefirmaConfig = _m03.PrefirmaConfig
PrefirmaLog = _m03.PrefirmaLog
PostfirmaConfig = _m04.PostfirmaConfig
BovedaConfig = _m05.BovedaConfig
BovedaRegistro = _m05.BovedaRegistro
Configuracion = _m07.Configuracion
Usuario = _m07.Usuario
VBRegistro = _m09.VBRegistro

# ── Datos base ───────────────────────────────────────────────────────────────

NOMBRES = [
    "JUAN CARLOS MARTINEZ SOTO", "MARIA ELENA GONZALEZ ROJAS",
    "PEDRO ANTONIO SILVA MUÑOZ", "CATALINA ANDREA LOPEZ FUENTES",
    "RODRIGO ANDRES FERNANDEZ DIAZ", "FRANCISCA ELENA MORALES CASTRO",
    "ANDRES FELIPE RODRIGUEZ VALDES", "PATRICIA CARMEN TORRES BRAVO",
    "CARLOS ALBERTO HERRERA PIZARRO", "LORENA ISABEL VARGAS REYES",
    "NICOLAS EDUARDO GUTIERREZ SAAVEDRA", "DANIELA ALEJANDRA SOTO CONTRERAS",
    "FELIPE IGNACIO RAMIREZ TAPIA", "CLAUDIA PATRICIA MUÑOZ ARAYA",
    "SEBASTIAN ANDRES PEREZ FIGUEROA", "VALENTINA ROSA DIAZ LEIVA",
    "GONZALO ERNESTO ARAYA MOLINA", "CAMILA BEATRIZ FUENTES ESPINOZA",
    "ALEJANDRO JOSE CASTILLO PARRA", "CAROLINA ANDREA REYES NAVARRO",
    "MATIAS PABLO CONTRERAS VERGARA", "JAVIERA SOLEDAD ESPINOZA CAMPOS",
    "DIEGO ANTONIO NAVARRO HENRÍQUEZ", "PAULA INES CAMPOS ORELLANA",
    "TOMAS BENJAMIN VERGARA JARA", "CONSTANZA MARIA BRAVO MIRANDA",
    "MARTIN IGNACIO PARRA GATICA", "ISIDORA FRANCISCA LEIVA SEPULVEDA",
    "GABRIEL ESTEBAN JARA VASQUEZ", "ANTONIA PAZ HENRIQUEZ RIQUELME",
    "RICARDO HERNAN VASQUEZ ARAVENA", "MACARENA ALEJANDRA TAPIA CORTES",
    "JORGE LUIS MOLINA SANCHEZ", "BARBARA NICOLE ORELLANA YAÑEZ",
    "FERNANDO MIGUEL MIRANDA ZUNIGA", "MARCELA VICTORIA FIGUEROA GODOY",
    "ROBERTO CARLOS GATICA ALARCON", "CECILIA MARGARITA SEPULVEDA VEGA",
    "OSCAR PATRICIO CORTES AGUILAR", "ROSA ELIZABETH RIQUELME MEZA",
]

RUTS = [
    "12.345.678-9", "15.678.234-K", "10.234.567-1", "18.765.432-5",
    "13.456.789-2", "16.789.345-3", "11.567.890-4", "19.876.543-6",
    "14.678.901-7", "17.890.456-8", "12.789.012-0", "15.901.234-1",
    "10.890.123-2", "18.012.345-3", "13.901.234-4", "16.123.456-5",
    "11.012.345-6", "19.234.567-7", "14.345.678-8", "17.456.789-9",
    "12.567.890-K", "15.678.901-0", "10.789.012-1", "18.890.123-2",
    "13.012.345-3", "16.234.567-4", "11.345.678-5", "19.456.789-6",
    "14.567.890-7", "17.678.901-8", "12.890.123-9", "15.012.345-K",
    "10.123.456-0", "18.234.567-1", "13.345.678-2", "16.456.789-3",
    "11.567.890-4", "19.678.901-5", "14.789.012-6", "17.901.234-7",
]

COMUNAS = [
    "SANTIAGO", "SANTIAGO", "SANTIAGO", "SANTIAGO", "SANTIAGO",
    "SANTIAGO", "SANTIAGO", "SANTIAGO",  # 60% Santiago
    "PROVIDENCIA", "LAS CONDES", "ÑUÑOA", "LA FLORIDA",
    "VIÑA DEL MAR", "VALPARAISO", "CONCEPCION", "RANCAGUA",
]

MATERIAS = [
    "ALZAMIENTO DE HIPOTECA Y PROHIBICION",
    "ALZAMIENTO DE HIPOTECA Y PROHIBICION",
    "ALZAMIENTO DE HIPOTECA Y PROHIBICION",
    "ALZAMIENTO DE HIPOTECA",
    "ALZAMIENTO DE PROHIBICION",
    "ALZAMIENTO DE HIPOTECA, PROHIBICION Y PRENDA",
]

ACTIVIDADES_CONF = [
    "Vistos Buenos", "Vistos Buenos", "Vistos Buenos",
    "Correcciones Menores",
    "REC",
    "Firma Electrónica",
    "Post Firma",
]

CLIENTES_NOTARIA = [
    "ROMERO Y ASOCIADOS LTDA.", "ROMERO Y ASOCIADOS LTDA.",
    "ROMERO Y ASOCIADOS LTDA.", "ROMERO Y ASOCIADOS LTDA.",
    "BANCO DE CHILE", "BANCO DE CHILE",
]


def _rut_sin_puntos(rut: str) -> str:
    return rut.replace(".", "")


def _fecha_escritura_str(d: date) -> str:
    return d.strftime("%d-%m-%Y")


def _generar_wf() -> str:
    """Genera un número de WF realista (formato banco)."""
    return f"2026-{random.randint(100000, 999999)}"


# ── Seed principal ───────────────────────────────────────────────────────────

def seed_demo(reset: bool = False):
    """Puebla la BD con datos demo realistas."""
    Base.metadata.create_all(bind=engine)
    db = SesionLocal()

    try:
        if reset:
            print("Limpiando datos existentes...")
            for tabla in [
                PrefirmaLog, BovedaRegistro,
                Confeccion, VBEscritura, VBSnapshotFila, VBRegistro,
            ]:
                db.query(tabla).delete()
            db.commit()
            print("  Tablas limpiadas.")

        # ── 1. Usuarios ─────────────────────────────────────────────────
        if not db.query(Usuario).first():
            usuarios = [
                Usuario(nombre="Javie Espina", usuario="Jespina",
                        cargo="Jefe de Registro", es_admin=True, activo=True),
                Usuario(nombre="Carolina Piña", usuario="CPina",
                        cargo="Notario Titular", es_admin=False, activo=True),
                Usuario(nombre="María José Soto", usuario="MSoto",
                        cargo="Asistente de Registro", es_admin=False, activo=True),
                Usuario(nombre="Felipe Araya", usuario="FAraya",
                        cargo="Asistente de Bóveda", es_admin=False, activo=True),
            ]
            db.add_all(usuarios)
            db.commit()
            print("  Usuarios creados: 4")

        # ── 2. Configuración ────────────────────────────────────────────
        config = db.query(Configuracion).filter_by(id=1).first()
        if not config:
            config = Configuracion(id=1)
            db.add(config)

        config.modo_demo = True
        config.notaria = "33ª Notaría de Santiago"
        config.notario_titular = "Carolina Elizabeth Piña Cuevas"
        config.notario_dia = "Carolina Elizabeth Piña Cuevas"
        config.valor_operacion = 12000
        config.red_interna = "192.168.1.0/24"
        config.ip_impresora = "192.168.1.100"
        config.nombre_impresora = "RICOH IM 550 PCL 6"
        config.conf_escaneados = r"C:\SAGE_Demo\Escaneados"
        config.vb_carpeta = r"C:\SAGE_Demo\VB"
        config.vb_salida = r"C:\SAGE_Demo\Planillas"
        config.pre_escaneados = r"C:\SAGE_Demo\Scanner"
        config.pre_url = "http://192.168.1.28/in_copia_compulsa_ad_pdf.php"
        config.post_entrada = r"C:\SAGE_Demo\Firmados"
        config.post_salida = r"C:\SAGE_Demo\Procesados"
        db.commit()
        print("  Configuración actualizada.")

        # ── 3. vb_registro (tabla central) ──────────────────────────────
        hoy = date.today()
        anio = hoy.year
        mes_actual = hoy.month

        # Generar datos para los últimos 5 meses
        registros = []
        repertorio_actual = 2800
        wfs_generados = []

        for mes_offset in range(5, -1, -1):
            mes = mes_actual - mes_offset
            anio_reg = anio
            if mes <= 0:
                mes += 12
                anio_reg -= 1

            # Cantidad de registros por mes: más recientes = más
            cantidad = random.randint(45, 75) if mes_offset < 3 else random.randint(30, 50)

            for _ in range(cantidad):
                idx = random.randint(0, len(NOMBRES) - 1)
                wf = _generar_wf()
                comuna = random.choice(COMUNAS)
                materia = random.choice(MATERIAS)
                cliente = random.choice(CLIENTES_NOTARIA)
                es_banlegal = random.random() < 0.05  # 5% banlegal
                dia_escritura = random.randint(1, 28)
                fecha_esc = date(anio_reg, mes, dia_escritura)

                # Algunos ya tienen firma electrónica (procesados)
                # Meses antiguos (>1) siempre tienen firma; mes actual y anterior no
                tiene_firma = mes_offset > 1
                firma_elec = str(random.randint(1000000, 9999999)) if tiene_firma else None
                caratula = f"CBR-{anio_reg}-{random.randint(10000, 99999)}" if (tiene_firma and comuna == "SANTIAGO" and not es_banlegal) else None

                reg = VBRegistro(
                    wf=wf,
                    rut=RUTS[idx % len(RUTS)],
                    nombre_cliente=NOMBRES[idx],
                    comuna=comuna,
                    materia=materia,
                    repertorio=str(repertorio_actual),
                    anio=anio_reg,
                    fecha_escritura=_fecha_escritura_str(fecha_esc),
                    fecha_indexado=datetime(anio_reg, mes, dia_escritura, 9, random.randint(0, 59)),
                    mes=mes,
                    cliente_notaria=cliente,
                    es_banlegal=es_banlegal,
                    firma_electronica=firma_elec,
                    numero_caratula=caratula,
                    usuario_id=random.choice([1, 3]),
                )
                registros.append(reg)
                if mes_offset <= 1:
                    wfs_generados.append((wf, NOMBRES[idx], RUTS[idx % len(RUTS)], repertorio_actual))
                repertorio_actual += 1

        db.add_all(registros)
        db.commit()
        print(f"  vb_registro: {len(registros)} registros creados (5 meses)")

        # ── 4. Confecciones (documentos del día y recientes) ────────────
        confecciones = []
        for i in range(20):
            idx = random.randint(0, len(NOMBRES) - 1)
            dias_atras = random.randint(0, 3)
            fecha_carga = datetime.now() - timedelta(days=dias_atras, hours=random.randint(0, 8))
            fecha_form = fecha_carga + timedelta(hours=random.randint(1, 4)) if dias_atras > 0 or random.random() < 0.6 else None

            conf = Confeccion(
                numero_carpeta=_generar_wf(),
                rut=RUTS[idx % len(RUTS)],
                nombre_cliente=NOMBRES[idx],
                actividad_actual=random.choice(ACTIVIDADES_CONF),
                fecha_esperada=datetime.now() + timedelta(days=random.randint(1, 14)),
                fecha_carga=fecha_carga,
                fecha_formateado=fecha_form,
            )
            confecciones.append(conf)

        db.add_all(confecciones)
        db.commit()
        print(f"  Confecciones: {len(confecciones)} documentos")

        # ── 5. VB Escrituras + Snapshots ────────────────────────────────
        escrituras = []
        snapshots = []
        actividades_vb = ["Vistos Buenos", "Correcciones Menores", "Firma Electrónica", "Post Firma", "REC"]

        for i in range(25):
            idx = random.randint(0, len(NOMBRES) - 1)
            wf = _generar_wf()
            act = random.choice(actividades_vb[:3])  # más comunes
            fecha_carga = datetime.now() - timedelta(days=random.randint(0, 2))

            esc = VBEscritura(
                numero_carpeta=wf,
                rut=RUTS[idx % len(RUTS)],
                nombre_cliente=NOMBRES[idx],
                actividad_actual=act,
                fecha_esperada=datetime.now() + timedelta(days=random.randint(3, 10)),
                fecha_carga=fecha_carga,
            )
            escrituras.append(esc)

            # Cada WF puede tener 1-3 filas en el snapshot (distintas actividades)
            for act_snap in random.sample(actividades_vb, k=random.randint(1, 3)):
                snap = VBSnapshotFila(
                    numero_carpeta=wf,
                    rut=RUTS[idx % len(RUTS)],
                    nombre_cliente=NOMBRES[idx],
                    actividad_actual=act_snap,
                    fecha_esperada=datetime.now() + timedelta(days=random.randint(3, 10)),
                    fecha_carga=fecha_carga,
                )
                snapshots.append(snap)

        db.add_all(escrituras)
        db.add_all(snapshots)
        db.commit()
        print(f"  VB Escrituras: {len(escrituras)} | Snapshots: {len(snapshots)}")

        # ── 6. Bóveda ──────────────────────────────────────────────────
        boveda_config = db.query(BovedaConfig).filter_by(id=1).first()
        if not boveda_config:
            boveda_config = BovedaConfig(id=1, entrega_actual=3, fecha_entrega=hoy)
            db.add(boveda_config)
        else:
            boveda_config.entrega_actual = 3
            boveda_config.fecha_entrega = hoy
        db.commit()

        boveda_registros = []
        # Registros de hoy (3 entregas)
        rep_boveda = repertorio_actual - 60
        for entrega_num in range(1, 4):
            cant = random.randint(5, 10)
            hora_base = 9 + (entrega_num - 1) * 2
            for j in range(cant):
                br = BovedaRegistro(
                    repertorio=rep_boveda,
                    anio=anio,
                    mes=mes_actual,
                    fecha=hoy,
                    hora_ingreso=f"{hora_base + j // 6:02d}:{random.randint(0, 59):02d}",
                    es_reingreso=random.random() < 0.1,
                    motivo="Primer ingreso" if random.random() > 0.1 else "Corrección de firma",
                    numero_entrega=entrega_num,
                    usuario_id=random.choice([1, 3, 4]),
                )
                boveda_registros.append(br)
                rep_boveda += 1

        # Registros históricos (últimos 5 días)
        for dias_atras in range(1, 6):
            fecha_hist = hoy - timedelta(days=dias_atras)
            if fecha_hist.weekday() >= 5:
                continue  # saltar fines de semana
            cant = random.randint(10, 20)
            for j in range(cant):
                br = BovedaRegistro(
                    repertorio=rep_boveda,
                    anio=anio,
                    mes=fecha_hist.month,
                    fecha=fecha_hist,
                    hora_ingreso=f"{9 + j // 4:02d}:{random.randint(0, 59):02d}",
                    es_reingreso=False,
                    motivo="Primer ingreso",
                    numero_entrega=random.randint(1, 3),
                    usuario_id=random.choice([1, 3, 4]),
                )
                boveda_registros.append(br)
                rep_boveda += 1

        db.add_all(boveda_registros)
        db.commit()
        print(f"  Bóveda: {len(boveda_registros)} entregas")

        # ── 7. Prefirma logs ───────────────────────────────────────────
        prefirma_cfg = db.query(PrefirmaConfig).filter_by(id=1).first()
        if not prefirma_cfg:
            prefirma_cfg = PrefirmaConfig(
                id=1, activo=False,
                ruta_carpeta=r"C:\SAGE_Demo\Scanner",
            )
            db.add(prefirma_cfg)
        db.commit()

        prefirma_logs = []
        rep_pf = repertorio_actual - 100

        # Logs de hoy
        for i in range(15):
            hora = datetime.now().replace(
                hour=9 + i // 3,
                minute=random.randint(0, 59),
                second=random.randint(0, 59),
            )
            estado = "ok" if random.random() < 0.85 else "error"
            log = PrefirmaLog(
                nombre_archivo=f"20260{mes_actual:02d}{random.randint(10, 28):02d}{random.randint(100000, 999999)}.pdf",
                repertorio=str(rep_pf),
                anho_repertorio=str(anio),
                tipo_contrato=random.choice(MATERIAS).replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O"),
                estado=estado,
                mensaje_error="Timeout al conectar con el servidor" if estado == "error" else None,
                fecha_procesado=hora,
                es_manual=random.random() < 0.15,
                es_banlegal=random.random() < 0.05,
            )
            prefirma_logs.append(log)
            rep_pf += 1

        # Logs de días anteriores
        for dias_atras in range(1, 4):
            fecha_log = datetime.now() - timedelta(days=dias_atras)
            if fecha_log.weekday() >= 5:
                continue
            for i in range(random.randint(10, 20)):
                hora = fecha_log.replace(
                    hour=9 + i // 4,
                    minute=random.randint(0, 59),
                )
                log = PrefirmaLog(
                    nombre_archivo=f"2026{fecha_log.month:02d}{fecha_log.day:02d}{random.randint(100000, 999999)}.pdf",
                    repertorio=str(rep_pf),
                    anho_repertorio=str(anio),
                    tipo_contrato=random.choice(MATERIAS),
                    estado="ok",
                    fecha_procesado=hora,
                    es_manual=False,
                    es_banlegal=False,
                )
                prefirma_logs.append(log)
                rep_pf += 1

        db.add_all(prefirma_logs)
        db.commit()
        print(f"  Prefirma logs: {len(prefirma_logs)} registros")

        # ── 8. Postfirma config ─────────────────────────────────────────
        pf_config = db.query(PostfirmaConfig).filter_by(id=1).first()
        if not pf_config:
            pf_config = PostfirmaConfig(
                id=1,
                ruta_origen=r"C:\SAGE_Demo\Firmados",
                ruta_destino=r"C:\SAGE_Demo\Procesados",
            )
            db.add(pf_config)
        else:
            pf_config.ruta_origen = r"C:\SAGE_Demo\Firmados"
            pf_config.ruta_destino = r"C:\SAGE_Demo\Procesados"
        db.commit()
        print("  Postfirma config actualizada.")

        # ── Resumen ─────────────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("  SEED DEMO COMPLETADO")
        print("=" * 60)
        print(f"  Usuarios:       4")
        print(f"  vb_registro:    {len(registros)}")
        print(f"  Confecciones:   {len(confecciones)}")
        print(f"  VB Escrituras:  {len(escrituras)}")
        print(f"  VB Snapshots:   {len(snapshots)}")
        print(f"  Bóveda:         {len(boveda_registros)}")
        print(f"  Prefirma logs:  {len(prefirma_logs)}")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    if reset:
        print("MODO RESET: se borrarán datos existentes antes de poblar.\n")
    seed_demo(reset=reset)
