use actix_cors::Cors;
use actix_web::body::to_bytes;
use actix_web::{get, http, post, web, App, HttpResponse, HttpServer};
use rust_embed::RustEmbed;
use serde::Deserialize;
use std::error::Error;
use std::fs;
use tracing::trace;
use tracing_actix_web::TracingLogger;
use urlencoding::encode;
use xcmd_base::{
	init_telemetry, stop_server_when_parent_process_exits, FileInfo, ListRequest, ListResponse,
	Request, Response,
};

#[cfg(target_os = "windows")]
const DEFAULT_PATH: &str = "c:/";
#[cfg(not(target_os = "windows"))]
const DEFAULT_PATH: &str = "/";

#[post("/")]
async fn enact(request: web::Json<Request>) -> Result<HttpResponse, Box<dyn Error>> {
	match request.into_inner() {
		Request::List(request) => {
			let response = list_files(request)?;
			let body = serde_json::to_string(&Response::List(response))?;
			Ok(HttpResponse::Ok().body(body))
		}
		_ => Ok(HttpResponse::NotFound().body("".to_string())),
	}
}

#[derive(RustEmbed)]
#[folder = "res/"]
struct Asset;

#[derive(Deserialize)]
struct IconQuery {
	path: Option<String>,
}

#[get("/icons/{name}")]
async fn icon(
	name: web::Path<String>,
	query: web::Query<IconQuery>,
) -> Result<HttpResponse, Box<dyn Error>> {
	if let Some(path) = &query.path {
		let bytes = systemicons::get_icon(&path, 16, name.to_string() == "folder")
			.map_err(|err| err.message)?;
		return Ok(HttpResponse::Ok()
			.content_type("image/png")
			.append_header(("Cache-Control", "public, max-age=86400"))
			.body(bytes));
	}
	let asset_name = format!("{}.svg", name);
	if let Some(image) = Asset::get(&asset_name) {
		let bytes = to_bytes(image.data.to_vec()).await?;
		Ok(HttpResponse::Ok()
			.content_type("image/svg+xml")
			.append_header(("Cache-Control", "public, max-age=86400"))
			.body(bytes))
	} else {
		Ok(HttpResponse::NotFound().body("".to_string()))
	}
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
	init_telemetry("xcmd_fs");

	let server = HttpServer::new(|| {
		let cors = Cors::default()
			.allowed_origin("null")
			.allowed_origin("tauri://localhost")
			.allowed_origin("https://tauri.localhost")
			.allowed_methods(vec!["GET", "POST"])
			.allowed_headers(vec![http::header::AUTHORIZATION, http::header::ACCEPT])
			.allowed_header(http::header::CONTENT_TYPE)
			.max_age(3600);

		App::new()
			.wrap(TracingLogger::default())
			.wrap(cors)
			.service(icon)
			.service(enact)
	})
	.bind(("127.0.0.1", 8080))?
	.run();

	stop_server_when_parent_process_exits(&server);

	server.await
}

fn list_files(request: ListRequest) -> Result<ListResponse, Box<dyn Error>> {
	trace!("request = {:?}", &request);

	// vector for result with list of files
	let mut files = Vec::<FileInfo>::new();

	// gets the path, for instance `a/b/c`; falls back to `c:/` if not provided
	let path = if let Some(ref path) = request.path {
		std::path::Path::new(path).to_path_buf()
	} else {
		std::path::Path::new(DEFAULT_PATH).to_path_buf()
	};

	// gets the full path; this path concatenated with the optional key, for instance `a/b/c/d`
	let full_path = if let Some(ref key) = request.key {
		path.join(key)
	} else {
		path.clone()
	};

	let full_path_canonicalized = fs::canonicalize(full_path)?;
	let full_path_str = full_path_canonicalized.to_string_lossy();
	let full_path = std::path::Path::new(trim_long_path_prefix(&full_path_str));

	// gets the parent path item and adds it as the first file
	if let Some(parent_path) = full_path.parent() {
		files.push(get_local_file(parent_path, Some("..".to_string()), &None));
	}

	// active name is 'c' for case when {path: 'a/b/c', key: '..'}
	let active_name = if let Some(ref key) = request.key {
		if key == "../" {
			path.file_name().map(|x| x.to_string_lossy().to_string())
		} else {
			None
		}
	} else {
		None
	};

	// appends the files in the full_path directory
	if let Ok(read_dir) = fs::read_dir(&full_path) {
		for child_path in read_dir {
			match child_path {
				Ok(dir_entry) => files.push(get_local_file(&dir_entry.path(), None, &active_name)),
				Err(err) => eprintln!("Error: {}", err),
			}
		}
	}

	// normalizes the full_path directory
	let path = trim_long_path_prefix(&fs::canonicalize(full_path)?.to_string_lossy()).to_string();

	let response = ListResponse { path, files };
	// trace!("response = {:?}", &response);
	Ok(response)
}

fn get_local_file(
	path: &std::path::Path,
	name: Option<String>,
	active_name: &Option<String>,
) -> FileInfo {
	let path = std::path::Path::new(path);
	// let full_path = trim_long_path_prefix(&path.to_string_lossy().into_owned()).to_owned();
	let metadata = path.metadata();
	let mut size = 0;
	let mut is_dir = false;
	if let Ok(metadata) = metadata {
		size = metadata.len();
		is_dir = metadata.file_type().is_dir();
		// metadata.modified()?;
		// metadata.permissions();
	};
	let (name, extension) = if let Some(name) = name {
		(name, String::from(""))
	} else if is_dir {
		let filename = path
			.file_name()
			.map(|x| x.to_string_lossy().into_owned())
			.unwrap_or_else(|| String::from(".."));
		(filename, String::from(""))
	} else {
		(
			path.file_stem()
				.map(|x| x.to_string_lossy().into_owned())
				.unwrap_or_else(|| String::from("..")),
			path.extension()
				.map(|x| x.to_string_lossy().into_owned())
				.unwrap_or_else(|| String::from("")),
		)
	};
	FileInfo {
		key: format!("{}{}", name, if is_dir { "/" } else { "" }),
		is_directory: is_dir,
		icon: format!(
			"{}?path={}",
			if is_dir { "folder" } else { "file" },
			encode(path.to_string_lossy().into_owned().as_str())
		),
		icon_alt: Some((if is_dir { "folder" } else { "file" }).to_string()),
		icon_type: "file".to_string(),
		name: name.clone(),
		extension,
		size,
		date: 0,
		attributes: 0,
		is_active: if let Some(active_name) = &active_name {
			is_dir && active_name == &name
		} else {
			false
		},
	}
}

fn trim_long_path_prefix(path: &str) -> &str {
	path.strip_prefix("\\\\?\\").unwrap_or(path)
}
