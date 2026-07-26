// Evita que se abra una consola en Windows al iniciar la app
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sage_lib::run()
}
