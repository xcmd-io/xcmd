#![cfg_attr(
	all(not(debug_assertions), target_os = "windows"),
	windows_subsystem = "windows"
)]

use std::process::Command;

fn main() {
	tauri::Builder::default()
		.plugin(tauri_plugin_window_state::Builder::default().build())
		.invoke_handler(tauri::generate_handler![spawn_process])
		.run(tauri::generate_context!())
		.expect("failed to run app");
}

#[tauri::command]
fn spawn_process(process: String, arguments: Vec<String>) {
	Command::new(process)
		.args(arguments)
		.spawn()
		.expect("failed to spawn process");
}
