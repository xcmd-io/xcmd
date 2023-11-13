use actix_web::body::to_bytes;
use actix_web::{get, post, web, App, HttpResponse, HttpServer};
use rust_embed::RustEmbed;
use serde::Deserialize;
use std::error::Error;
use std::fs;
use std::fs::Permissions;
#[cfg(not(target_os = "windows"))]
use std::os::unix::fs::PermissionsExt;
use std::path::{Component, Path};
use std::time::UNIX_EPOCH;
use tracing::trace;
use tracing_actix_web::TracingLogger;
use urlencoding::encode;
use xcmd_base::{
	get_port, init_telemetry, post_startup, FileInfo, ListRequest, ListResponse, Middleware,
	Request, Response,
};

#[cfg(target_os = "windows")]
const DEFAULT_PATH: &str = "c:/";
#[cfg(not(target_os = "windows"))]
const DEFAULT_PATH: &str = "/";

pub const FMT: u32 = 0b1111_000_000_000_000;
pub const FIFO: u32 = 0b0001_000_000_000_000;
pub const FCHR: u32 = 0b0010_000_000_000_000;
pub const FBLK: u32 = 0b0110_000_000_000_000;
pub const FDIR: u32 = 0b0100_000_000_000_000;
pub const FREG: u32 = 0b1000_000_000_000_000;
pub const FLNK: u32 = 0b1010_000_000_000_000;
pub const FSCK: u32 = 0b1100_000_000_000_000;

pub const UGS: u32 = 0b0000_111_000_000_000;
pub const UID: u32 = 0b0000_100_000_000_000;
pub const GID: u32 = 0b0000_010_000_000_000;
pub const SID: u32 = 0b0000_001_000_000_000;

pub const USR: u32 = 0b000_111_000_000;
pub const UR: u32 = 0b_100_000_000;
pub const UW: u32 = 0b_010_000_000;
pub const UX: u32 = 0b_001_000_000;

pub const GRP: u32 = 0b000_000_111_000;
pub const GR: u32 = 0b_000_100_000;
pub const GW: u32 = 0b_000_010_000;
pub const GX: u32 = 0b_000_001_000;

pub const OWN: u32 = 0b000_000_000_111;
pub const OR: u32 = 0b_000_000_100;
pub const OW: u32 = 0b_000_000_010;
pub const OX: u32 = 0b_000_000_001;

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
async fn main() -> Result<(), Box<dyn Error>> {
	init_telemetry("xcmd_fs");
	let port = get_port()?;

	let server = HttpServer::new(|| {
		App::new()
			.wrap(Middleware::cors())
			.wrap(Middleware::token_auth())
			.wrap(TracingLogger::default())
			.service(icon)
			.service(enact)
	})
	.bind(("127.0.0.1", port))?
	// TODO: use TLS when tauri adds support to trust self-signed certificates
	// .bind_rustls_021(format!("127.0.0.1:{}", port), load_rustls_config()?)?
	.run();

	post_startup(&server, port);

	server.await?;
	Ok(())
}

fn list_files(request: ListRequest) -> Result<ListResponse, Box<dyn Error>> {
	trace!("request = {:?}", &request);

	// vector for result with list of files
	let mut files = Vec::<FileInfo>::new();

	// gets the path, for instance `a/b/c`; falls back to `c:/` if not provided
	let path = if let Some(ref path) = request.path {
		Path::new(path).to_path_buf()
	} else {
		Path::new(DEFAULT_PATH).to_path_buf()
	};

	// gets the full path; this path concatenated with the optional key, for instance `a/b/c/d`
	let full_path = if let Some(ref key) = request.key {
		path.join(key)
	} else {
		path.clone()
	};

	let full_path_canonicalized = fs::canonicalize(full_path)?;
	let full_path_str = full_path_canonicalized.to_string_lossy();
	let full_path = Path::new(trim_long_path_prefix(&full_path_str));

	let name = full_path
		.file_name()
		.map(|x| x.to_string_lossy().to_string())
		.unwrap_or_else(|| {
			if let Some(Component::Prefix(prefix)) = full_path.components().next() {
				prefix.as_os_str().to_string_lossy().to_string()
			} else {
				"/".to_string()
			}
		});

	// gets the parent path item and adds it as the first file
	if let Some(parent_path) = full_path.parent() {
		files.push(get_local_file(parent_path, Some("..".to_string()), &None));
	}

	// active name is 'c' for case when {path: 'a/b/c', key: '..'}
	let active_key = if let Some(ref key) = request.key {
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
				Ok(dir_entry) => files.push(get_local_file(&dir_entry.path(), None, &active_key)),
				Err(err) => eprintln!("Error: {}", err),
			}
		}
	}

	// normalizes the full_path directory
	let path = trim_long_path_prefix(&fs::canonicalize(full_path)?.to_string_lossy()).to_string();

	let response = ListResponse { path, name, files };
	// trace!("response = {:?}", &response);
	Ok(response)
}

#[cfg(target_os = "windows")]
fn permissions_to_string(permissions: &Permissions) -> String {
	if permissions.readonly() {
		"r".to_string()
	} else {
		"-".to_string()
	}
}

#[cfg(not(target_os = "windows"))]
fn permissions_to_string(permissions: &Permissions) -> String {
	let mode = permissions.mode();
	let fmt = mode & FMT;
	let ugs = mode & UGS;
	let usr = mode & USR;
	let grp = mode & GRP;
	let own = mode & OWN;

	vec![
		if fmt == FREG {
			"-"
		} else if fmt == FDIR {
			"d"
		} else if fmt == FLNK {
			"l"
		} else if fmt == FIFO {
			"p"
		} else if fmt == FSCK {
			"s"
		} else if fmt == FCHR {
			"c"
		} else if fmt == FBLK {
			"b"
		} else {
			"?"
		},
		if usr & UR == UR { "r" } else { "-" },
		if usr & UW == UW { "w" } else { "-" },
		if ugs & UID == UID {
			if usr & UX == UX {
				"s"
			} else {
				"S"
			}
		} else if usr & UX == UX {
			"x"
		} else {
			"-"
		},
		if grp & GR == GR { "r" } else { "-" },
		if grp & GW == GW { "w" } else { "-" },
		if ugs & GID == GID {
			if grp & GX == GX {
				"s"
			} else {
				"S"
			}
		} else if grp & GX == GX {
			"x"
		} else {
			"-"
		},
		if own & OR == OR { "r" } else { "-" },
		if own & OW == OW { "w" } else { "-" },
		if ugs & SID == SID {
			if own & OX == OX {
				"t"
			} else {
				"T"
			}
		} else if own & OX == OX {
			"x"
		} else {
			"-"
		},
	]
	.join("")
}

fn get_local_file(path: &Path, name: Option<String>, active_key: &Option<String>) -> FileInfo {
	let path = Path::new(path);
	// let full_path = trim_long_path_prefix(&path.to_string_lossy().into_owned()).to_owned();
	let metadata = path.metadata();
	let mut size = 0;
	let mut is_dir = false;
	let mut date = 0;
	let mut attributes: String = "-".to_string();
	if let Ok(metadata) = metadata {
		size = metadata.len();
		is_dir = metadata.file_type().is_dir();
		date = metadata
			.modified()
			.map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default())
			.unwrap_or_default()
			.as_millis();
		attributes = permissions_to_string(&metadata.permissions());
	};
	let (key, name, extension) = if let Some(name) = name {
		(name.clone(), name, String::from(""))
	} else if is_dir {
		let filename = path
			.file_name()
			.map(|x| x.to_string_lossy().into_owned())
			.unwrap_or_else(|| String::from(".."));
		(filename.clone(), filename, String::from(""))
	} else {
		(
			path.file_name()
				.map(|x| x.to_string_lossy().into_owned())
				.unwrap_or_else(|| String::from("..")),
			path.file_stem()
				.map(|x| x.to_string_lossy().into_owned())
				.unwrap_or_else(|| String::from("..")),
			path.extension()
				.map(|x| x.to_string_lossy().into_owned())
				.unwrap_or_else(|| String::from("")),
		)
	};
	FileInfo {
		key: format!("{}{}", key, if is_dir { "/" } else { "" }),
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
		date,
		attributes,
		is_active: if let Some(active_key) = &active_key {
			is_dir && active_key == &key
		} else {
			false
		},
	}
}

fn trim_long_path_prefix(path: &str) -> &str {
	path.strip_prefix("\\\\?\\").unwrap_or(path)
}
