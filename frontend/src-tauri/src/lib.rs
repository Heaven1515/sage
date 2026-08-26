// Módulo principal de Tauri — SAGE · Notaría 33
// Lanza el backend FastAPI como proceso hijo (sidecar) al iniciar la aplicación.
// Espera hasta que el backend responda en :8000 antes de mostrar la ventana.
// Si el backend cae durante el uso, el watchdog lo reinicia automáticamente.

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

/// Mantiene vivo el proceso hijo del backend en el estado global de Tauri.
/// Sin esto, el CommandChild se dropea al terminar el closure de setup y
/// el SO puede matar el proceso sidecar.
struct GuardBackend(Mutex<Option<CommandChild>>);

/// Flag que indica al watchdog que NO reinicie el backend durante una actualización.
/// Sin esto el watchdog detecta que el backend cayó y lo relanza mientras NSIS
/// intenta sobrescribir backend.exe, dejando el archivo bloqueado.
struct ActualizandoFlag(AtomicBool);

/// Convierte un color hex "#RRGGBB" al formato COLORREF de Windows (0x00BBGGRR).
#[cfg(target_os = "windows")]
fn hex_a_colorref(hex: &str) -> u32 {
    let hex = hex.trim_start_matches('#');
    let r = u32::from_str_radix(&hex[0..2], 16).unwrap_or(0);
    let g = u32::from_str_radix(&hex[2..4], 16).unwrap_or(0);
    let b = u32::from_str_radix(&hex[4..6], 16).unwrap_or(0);
    b << 16 | g << 8 | r   // Windows usa orden BGR
}

/// Aplica color de borde y caption DWM a un HWND dado un color "#RRGGBB".
/// Con decorations:false no hay caption nativo, pero Windows 11 sigue dibujando
/// un borde de ~1px sobre la ventana (DWMWA_BORDER_COLOR = 34).
#[cfg(target_os = "windows")]
fn aplicar_color_dwm(hwnd_val: isize, hex: &str) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE, DWMWA_CAPTION_COLOR};
    let hwnd = HWND(hwnd_val as *mut _);
    let colorref = hex_a_colorref(hex);
    let tam = std::mem::size_of::<u32>() as u32;
    unsafe {
        // DWMWA_BORDER_COLOR (34): borde que Windows 11 pinta sobre ventanas frameless
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWINDOWATTRIBUTE(34),
            &colorref as *const u32 as *const _,
            tam,
        );
        // DWMWA_CAPTION_COLOR (35): caption nativo (útil si decorations se reactiva)
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_CAPTION_COLOR,
            &colorref as *const u32 as *const _,
            tam,
        );
    }
}

/// Cambia el color de la barra de caption de Windows usando DWM.
/// Acepta un color "#RRGGBB" y lo aplica a la ventana que llama el comando.
#[tauri::command]
fn set_titlebar_color(window: tauri::WebviewWindow, color: String) {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            aplicar_color_dwm(hwnd.0 as isize, &color);
        }
    }
}

/// Lanza el sidecar backend y drena su pipe stdout/stderr en una tarea async.
/// Drenar el pipe es obligatorio: si el receptor se dropea, uvicorn lanza
/// BrokenPipeError al escribir un log y el proceso muere silenciosamente.
/// Retorna el CommandChild para que el llamador lo guarde en GuardBackend.
fn lanzar_sidecar(app: &tauri::AppHandle) -> CommandChild {
    let sidecar = app.shell().sidecar("backend").expect("sidecar 'backend' no encontrado");
    let (rx, hijo) = sidecar.spawn().expect("Error al iniciar el backend");
    tauri::async_runtime::spawn(async move {
        let mut rx = rx;
        while rx.recv().await.is_some() {}
    });
    hijo
}

/// Mata cualquier instancia anterior de backend.exe que haya quedado colgada.
/// Usa taskkill /F /IM para forzar el cierre sin importar el estado del proceso.
fn matar_backend_anterior() {
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", "backend.exe", "/T"])
        .output();
    // Espera breve para que el SO libere el puerto antes de lanzar el nuevo proceso
    std::thread::sleep(std::time::Duration::from_millis(500));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        // GuardBackend mantiene el CommandChild vivo mientras la app corre.
        // Sin este estado, el child se dropea al salir del closure de setup.
        .manage(GuardBackend(Mutex::new(None)))
        .manage(ActualizandoFlag(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![set_titlebar_color])
        .setup(|app| {
            // Mata el backend anterior antes de lanzar uno nuevo.
            // Evita el error "puerto 8000 ya en uso" cuando SAGE se cierra de golpe.
            matar_backend_anterior();

            // Lanza el backend y guarda el hijo en el estado global de Tauri.
            // GuardBackend lo mantiene vivo hasta que se cierre la app.
            let hijo = lanzar_sidecar(app.handle());
            *app.state::<GuardBackend>().0.lock().unwrap() = Some(hijo);

            // Oculta la ventana hasta que el backend esté listo.
            // Evita que el usuario vea el error de conexión mientras el backend arranca.
            let ventana = app.get_webview_window("main").expect("ventana 'main' no encontrada");
            ventana.hide().ok();

            // Aplica el color DWM del tema por defecto (azul oscuro) antes de mostrar la ventana.
            // Evita que aparezca brevemente el color de caption de Windows sin personalizar.
            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = ventana.hwnd() {
                aplicar_color_dwm(hwnd.0 as isize, "#1a3a7a");
            }

            // Hilo que espera hasta que el backend responda en /,
            // luego muestra la ventana. Reintenta cada 300 ms hasta 30 s.
            let ventana_hilo = ventana.clone();
            std::thread::spawn(move || {
                let cliente = reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_millis(500))
                    .build()
                    .expect("Error al crear cliente HTTP");

                for _ in 0..100 {
                    if cliente.get("http://127.0.0.1:8000/").send().is_ok() {
                        break;
                    }
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }

                ventana_hilo.show().ok();
                ventana_hilo.set_focus().ok();
            });

            // Watchdog: monitorea el backend cada 5 s y lo reinicia si cae.
            // 3 fallos consecutivos (~15 s sin respuesta) disparan el reinicio.
            // Espera 15 s antes de empezar para no interferir con el arranque inicial.
            let app_watchdog = app.handle().clone();
            std::thread::spawn(move || {
                let cliente = reqwest::blocking::Client::builder()
                    .timeout(std::time::Duration::from_secs(2))
                    .build()
                    .expect("Error al crear cliente watchdog");

                std::thread::sleep(std::time::Duration::from_secs(15));

                let mut fallos: u8 = 0;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));

                    if cliente.get("http://127.0.0.1:8000/").send().is_ok() {
                        fallos = 0;
                    } else {
                        fallos += 1;
                        // Si hay una actualización en curso, el watchdog NO reinicia.
                        // El instalador NSIS necesita backend.exe libre para sobrescribirlo.
                        let actualizando = app_watchdog
                            .state::<ActualizandoFlag>()
                            .0
                            .load(Ordering::SeqCst);
                        if fallos >= 3 && !actualizando {
                            fallos = 0;
                            matar_backend_anterior();
                            let nuevo_hijo = lanzar_sidecar(&app_watchdog);
                            *app_watchdog.state::<GuardBackend>().0.lock().unwrap() = Some(nuevo_hijo);
                            // Esperar hasta 30 s a que el backend responda tras reinicio
                            for _ in 0..100 {
                                std::thread::sleep(std::time::Duration::from_millis(300));
                                if cliente.get("http://127.0.0.1:8000/").send().is_ok() {
                                    break;
                                }
                            }
                        }
                    }
                }
            });

            // Al cerrar la ventana, mata exactamente el proceso backend que lanzamos.
            // Usar child.kill() en vez de taskkill evita matar otros procesos llamados
            // backend.exe que puedan estar corriendo en el sistema.
            let app_cierre = app.handle().clone();
            ventana.on_window_event(move |event| {
                if let tauri::WindowEvent::Destroyed = event {
                    let state = app_cierre.state::<GuardBackend>();
                    let mut guard = state.0.lock().unwrap();
                    if let Some(hijo) = guard.take() {
                        let _ = hijo.kill();
                    }
                }
            });

            // Revisor de actualizaciones: corre en segundo plano 20 s después del arranque.
            // Espera a que la app esté estable antes de consultar GitHub Releases.
            // Si hay versión nueva, muestra un diálogo nativo preguntando si actualizar.
            let app_updater = app.handle().clone();
            std::thread::spawn(move || {
                // Espera 20 s para que la app esté estable antes de consultar GitHub
                std::thread::sleep(std::time::Duration::from_secs(20));
                tauri::async_runtime::spawn(async move {
                use tauri_plugin_updater::UpdaterExt;
                use tauri_plugin_dialog::DialogExt;

                match app_updater.updater() {
                    Ok(updater) => {
                        match updater.check().await {
                            Ok(Some(update)) => {
                                let version = update.version.clone();
                                let confirmar = app_updater
                                    .dialog()
                                    .message(format!(
                                        "Hay una nueva versión de SAGE disponible (v{}).\n¿Deseas actualizar ahora?",
                                        version
                                    ))
                                    .title("Actualización disponible")
                                    .blocking_show();

                                if confirmar {
                                    // Paso 1: activar flag para que el watchdog NO reinicie el backend
                                    // mientras el instalador NSIS sobrescribe backend.exe
                                    app_updater
                                        .state::<ActualizandoFlag>()
                                        .0
                                        .store(true, Ordering::SeqCst);

                                    // Paso 2: kill por handle (limpio, específico a este proceso)
                                    {
                                        let state = app_updater.state::<GuardBackend>();
                                        let mut guard = state.0.lock().unwrap();
                                        if let Some(hijo) = guard.take() {
                                            let _ = hijo.kill();
                                        }
                                    }

                                    // Paso 3: loop hasta confirmar que backend.exe está muerto.
                                    // En vez de esperar tiempos fijos, verificamos con tasklist
                                    // que el proceso realmente desapareció antes de llamar al
                                    // instalador. Máximo 10s (20 intentos × 500ms).
                                    for _ in 0..20 {
                                        std::thread::sleep(std::time::Duration::from_millis(500));
                                        let _ = std::process::Command::new("taskkill")
                                            .args(["/F", "/IM", "backend.exe", "/T"])
                                            .output();
                                        let sigue_vivo = std::process::Command::new("tasklist")
                                            .args(["/FI", "IMAGENAME eq backend.exe", "/NH"])
                                            .output()
                                            .map(|o| String::from_utf8_lossy(&o.stdout)
                                                      .contains("backend.exe"))
                                            .unwrap_or(true);
                                        if !sigue_vivo {
                                            break;
                                        }
                                    }
                                    // Pausa extra para que Windows libere los handles del archivo
                                    // antes de que NSIS intente abrir backend.exe para escribir
                                    std::thread::sleep(std::time::Duration::from_millis(1000));

                                    let _ = update
                                        .download_and_install(|_, _| {}, || {})
                                        .await;
                                    app_updater.restart();
                                }
                            }
                            Ok(None) => {} // Sin actualizaciones disponibles
                            Err(_) => {}   // Sin conexión o error de red — ignorar silenciosamente
                        }
                    }
                    Err(_) => {} // Updater no disponible — ignorar
                }
                });
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error al iniciar SAGE");
}
