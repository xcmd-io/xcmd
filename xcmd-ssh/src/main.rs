use actix_web::body::to_bytes;
use actix_web::{get, post, web, App, HttpResponse, HttpServer};
use rust_embed::RustEmbed;
use ssh2::{FileStat, Session, Sftp};
use std::env;
use std::error::Error;
use std::net::TcpStream;
use std::sync::Arc;
use xcmd_base::{
	get_port, init_telemetry, post_startup, FileInfo, ListRequest, ListResponse, Middleware,
	Request, Response,
};

#[post("/")]
async fn enact(
	request: web::Json<Request>,
	sftp: web::Data<Arc<Sftp>>,
) -> Result<HttpResponse, Box<dyn Error>> {
	match request.into_inner() {
		Request::List(request) => {
			let response = list_files(request, sftp)?;
			let body = serde_json::to_string(&Response::List(response))?;
			Ok(HttpResponse::Ok().body(body))
		}
		_ => Ok(HttpResponse::NotFound().body("".to_string())),
	}
}

#[derive(RustEmbed)]
#[folder = "res/"]
struct Asset;

#[get("/icons/{name}")]
async fn icon(name: web::Path<String>) -> Result<HttpResponse, Box<dyn Error>> {
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
	init_telemetry("xcmd_ssh");
	let port = get_port()?;

	env::set_var("RUST_LOG", "debug");
	env::set_var("RUST_BACKTRACE", "1");
	env_logger::init();

	let tcp = TcpStream::connect(env::var("SSH_HOST").unwrap_or_default())?;
	let mut session = Session::new()?;
	session.set_tcp_stream(tcp);
	session.handshake()?;

	session
		.userauth_password(
			&env::var("SSH_USER").unwrap_or_default(),
			&env::var("SSH_PASSWORD").unwrap_or_default(),
		)
		.unwrap();
	assert!(session.authenticated());

	let sftp = Arc::new(session.sftp()?);

	let server = HttpServer::new(move || {
		App::new()
			.app_data(web::Data::new(sftp.clone()))
			.wrap(Middleware::cors())
			.wrap(Middleware::token_auth())
			.wrap(TracingLogger::default())
			.service(icon)
			.service(enact)
	})
	.bind(("127.0.0.1", port))?
	.run();

	post_startup(&server, port);

	server.await?;
	Ok(())
}

fn list_files(
	request: ListRequest,
	sftp: web::Data<Arc<Sftp>>,
) -> Result<ListResponse, Box<dyn Error>> {
	let mut files = Vec::<FileInfo>::new();
	let path = if let Some(path) = request.path {
		std::path::Path::new(&path).to_path_buf()
	} else {
		std::path::Path::new("/").to_path_buf()
	};
	let full_path = if let Some(key) = request.key {
		path.join(key)
	} else {
		path
	};
	let name = full_path
		.file_name()
		.map(|x| x.to_string_lossy().to_string())
		.unwrap_or_else(|| "/".to_string());
	if let Some(parent_path) = full_path.parent() {
		files.push(get_local_file(
			&sftp,
			parent_path,
			None,
			Some(String::from("..")),
		)?);
	}
	if let Ok(read_dir) = sftp.readdir(&full_path) {
		for (child_path, stat) in read_dir {
			files.push(get_local_file(&sftp, &child_path, Some(stat), None)?);
		}
	}
	let path = full_path.to_string_lossy().to_string();
	Ok(ListResponse { path, name, files })
}

fn get_local_file(
	sftp: &Sftp,
	path: &std::path::Path,
	stat: Option<FileStat>,
	name: Option<String>,
) -> Result<FileInfo, Box<dyn Error>> {
	let path = std::path::Path::new(path);
	// let full_path = &path.to_string_lossy().into_owned();
	let stat = if let Some(stat) = stat {
		stat
	} else {
		sftp.stat(path)?
	};
	let size = stat.size.unwrap_or(0);
	let is_dir = stat.is_dir();
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
	Ok(FileInfo {
		key: format!("{}{}", name, if is_dir { "/" } else { "" }),
		is_directory: is_dir,
		icon: (if is_dir { "folder" } else { "file" }).to_string(), // full_path,
		icon_alt: None,
		icon_type: "file".to_string(),
		name,
		extension,
		size,
		date: 0,
		attributes: "-".to_string(),
		is_active: false,
	})
}
