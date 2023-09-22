mod telemetry;

use actix_web::{
	dev::{Server, ServerHandle},
	web::Data,
};
use parking_lot::Mutex;
use serde::Deserialize;
use serde_derive::Serialize;
use std::{error::Error, thread, time::Duration};
use sysinfo::{ProcessExt, System, SystemExt};

pub fn loop_while_parent_process_exists() -> Result<(), Box<dyn Error>> {
	let mut system = System::new();
	let pid = sysinfo::get_current_pid()?;
	if !system.refresh_process(pid) {
		return Ok(());
	}
	let process = system.process(pid).ok_or("no current process info found")?;
	let parent_pid = process.parent().ok_or("no parent pid found")?;
	loop {
		if !system.refresh_process(parent_pid) {
			return Ok(());
		}
		let _parent_process = system
			.process(parent_pid)
			.ok_or("no parent process info found")?;
		thread::sleep(Duration::from_secs(1));
	}
}

pub fn stop_server_when_parent_process_exits(server: &Server) {
	let stop_handle = Data::new(StopHandle::default());
	stop_handle.register(server.handle());

	thread::spawn(move || {
		loop_while_parent_process_exists().ok();
		stop_handle.stop(true);
	});
}

#[derive(Default)]
pub struct StopHandle {
	inner: Mutex<Option<ServerHandle>>,
}

impl StopHandle {
	/// Sets the server handle to stop.
	pub fn register(&self, handle: ServerHandle) {
		*self.inner.lock() = Some(handle);
	}

	/// Sends stop signal through contained server handle.
	pub fn stop(&self, graceful: bool) {
		let _ = self.inner.lock().as_ref().unwrap().stop(graceful);
	}
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Request {
	/// Retrieve all entries of a directory.
	List(ListRequest),
	/// Gets the entry with a given key in a directory.
	Join { path: String, key: String },
	/// Creates a directory.
	Create {},
	/// Reads the entire contents of a file.
	Read {},
	/// Writes data to a file, replacing its entire contents.
	Write {},
	/// Copies a file or directory.
	Copy {},
	/// Renames a file or directory.
	Rename {},
	/// Deletes a file or directory.
	Delete {},
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Response {
	List(ListResponse),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListRequest {
	/// Directory path.
	pub path: Option<String>,
	/// Optional subdirectory key.
	pub key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
	/// Directory path.
	pub path: String,
	/// Files in the directory.
	pub files: Vec<FileInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
	/// Even if two files have same name, the key must be unique within a directory.
	/// Path consists of keys concatenated with "/".
	pub key: String,

	/// Indicates whether it is a directory.
	pub is_directory: bool,

	/// String identifying an icon. The value depends on icon type.
	pub icon: String,

	/// String identifying an alternative icon.
	pub icon_alt: Option<String>,

	/// "file" to use file at specified path to get an icon from operating system; "shell" to use just a path
	pub icon_type: String,

	/// Name shown to the user.
	pub name: String,

	/// Extension.
	pub extension: String,

	/// File size.
	pub size: u64,

	/// File date.
	pub date: u128,

	/// Attributes.
	pub attributes: u32,

	/// Indicates whether the file is active.
	pub is_active: bool,
}

pub fn init_telemetry(app_name: &str) {
	let subscriber = telemetry::get_subscriber(
		module_path!().into(),
		format!("{}=trace,xcmd_base=debug,actix_web=debug", app_name).into(),
	);
	telemetry::init_subscriber(subscriber);
}
