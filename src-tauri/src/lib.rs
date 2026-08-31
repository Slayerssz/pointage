// Application de bureau « Pointage ».
//
// Ce n'est volontairement PAS une application complète : c'est une simple
// fenêtre qui ouvre le site déjà en ligne. Conséquence voulue : quand le
// site est mis à jour, l'application affiche la nouvelle version au
// prochain lancement — rien à réinstaller sur les postes.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Pointage");
}
