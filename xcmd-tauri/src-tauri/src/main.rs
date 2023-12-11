#![cfg_attr(
	all(not(debug_assertions), target_os = "windows"),
	windows_subsystem = "windows"
)]

use std::{path::Path, process::Command};

fn main() -> Result<(), tauri::Error> {
	tauri::Builder::default()
		.plugin(tauri_plugin_window_state::Builder::default().build())
		.plugin(tauri_plugin_store::Builder::default().build())
		.plugin(tauri_plugin_sql::Builder::default().build())
		.invoke_handler(tauri::generate_handler![spawn_process])
		.invoke_handler(tauri::generate_handler![open_detached])
		.run(tauri::generate_context!())
}

#[tauri::command]
fn spawn_process(process: String, arguments: Vec<String>) -> Result<(), String> {
	Command::new(process)
		.args(arguments)
		.spawn()
		.map(|_| ())
		.map_err(|e| e.to_string())
}

#[tauri::command]
fn open_detached(directory: String, key: String) -> Result<(), String> {
	let path = Path::new(&directory).to_path_buf().join(key);
	open::that_detached(path).map_err(|e| e.to_string())
}
