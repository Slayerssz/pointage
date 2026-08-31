// Empêche l'ouverture d'une console noire derrière la fenêtre sous Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pointage_lib::run()
}
