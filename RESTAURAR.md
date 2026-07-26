# SAGE — Instrucciones de Restauración
**Respaldo generado:** 2026-04-05
**Estado del proyecto:** Todos los módulos completos. App de escritorio con Tauri lista.

---

## Requisitos previos (instalar en el PC nuevo)

| Software | Versión | Dónde descargar |
|----------|---------|-----------------|
| Python | 3.14 | python.org |
| Node.js | 22+ | nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| Rust + Cargo | stable | rustup.rs |

---

## Paso 1 — Extraer el ZIP

Extraer `SAGE_respaldo_2026-04-05.zip` en:
```
C:\Users\<TU_USUARIO>\OneDrive\Desktop\SAGE\
```

---

## Paso 2 — Backend Python

Abrir PowerShell en `SAGE\backend\` y ejecutar:

```powershell
# Instalar dependencias Python
pip install -r requirements.txt

# Verificar que el backend levanta correctamente
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Si todo está bien, verás los routers registrados y el servidor corriendo en http://localhost:8000

---

## Paso 3 — Frontend Next.js

Abrir PowerShell en `SAGE\frontend\` y ejecutar:

```powershell
# Restaurar node_modules (~500 MB, toma unos minutos)
pnpm install

# Verificar que el frontend levanta
pnpm dev
```

Abrir http://localhost:3000 — debe aparecer el login de SAGE.

---

## Paso 4 — Junction de Next.js (solo si el proyecto está en OneDrive)

Evita que Turbopack corrompa el caché al sincronizar OneDrive:

```cmd
mkdir C:\Temp\sage-next-dot-next
mklink /J "C:\Users\<TU_USUARIO>\OneDrive\Desktop\SAGE\frontend\.next" "C:\Temp\sage-next-dot-next"
```

---

## Paso 5 — Construir el ejecutable del backend

En `SAGE\backend\`:

```powershell
python -m PyInstaller sage_backend.spec --noconfirm
```

Resultado: `backend\dist\backend.exe` (~91 MB)

Copiar a Tauri:
```powershell
copy dist\backend.exe ..\frontend\src-tauri\binaries\backend-x86_64-pc-windows-msvc.exe
```

---

## Paso 6 — Construir la app de escritorio (Tauri)

En `SAGE\frontend\`:

```powershell
# Redirigir el target de Rust fuera de OneDrive (evita bloqueos de Windows)
# Esto ya está configurado en src-tauri\.cargo\config.toml

pnpm tauri build
```

Resultado: dos instaladores en:
```
C:\Users\<TU_USUARIO>\AppData\Roaming\sage-rust-target\release\bundle\msi\SAGE_1.0.0_x64_es-ES.msi
C:\Users\<TU_USUARIO>\AppData\Roaming\sage-rust-target\release\bundle\nsis\SAGE_1.0.0_x64-setup.exe
```

Instalar el `.msi` en el PC de la notaría.

---

## Notas importantes

- **Smart App Control**: debe estar en OFF en Windows Security antes de compilar Tauri. Reiniciar el PC después de desactivarlo.
- **BD de producción**: `backend\notaria.db` está incluida en el respaldo con los datos reales.
- **Nombres/género**: la tabla `nombres_genero` ya está cargada (515 nombres). Si se necesita recargar: `python seed_nombres.py` (requiere `LISTAS NOMBRES.docx` en Descargas).
- **Credenciales Gmail** (Módulo 08): están guardadas en la BD, protegidas con contraseña `notaria33`.
- **Red interna**: el formulario de prefirma apunta a `192.168.1.28` — solo funciona conectado a la red de la notaría.

---

## Resumen rápido (todo funciona, solo rebuilding)

```
pip install -r requirements.txt
pnpm install
python -m PyInstaller sage_backend.spec --noconfirm
copy dist\backend.exe ..\frontend\src-tauri\binaries\backend-x86_64-pc-windows-msvc.exe
pnpm tauri build
```
