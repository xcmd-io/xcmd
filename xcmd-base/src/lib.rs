mod telemetry;

use actix_cors::Cors;
use actix_web::{
	dev::{
		forward_ready, Server, ServerHandle, Service, ServiceRequest, ServiceResponse, Transform,
	},
	http::header,
	web::Data,
};
use futures_util::future::LocalBoxFuture;
use parking_lot::Mutex;
use rcgen::generate_simple_self_signed;
use rustls::{Certificate, PrivateKey, ServerConfig};
use rustls_pemfile::{certs, pkcs8_private_keys};
use serde::Deserialize;
use serde_derive::Serialize;
use std::{env, error::Error, net::TcpListener, thread, time::Duration};
use std::{
	future::{ready, Ready},
	io::BufReader,
};
use sysinfo::{ProcessExt, System, SystemExt};

pub fn get_port() -> Result<u16, Box<dyn Error>> {
	let port = if let Ok(port_str) = env::var("XCMD_PORT") {
		port_str.parse::<u16>()?
	} else {
		get_unused_port()?
	};

	Ok(port)
}

fn get_unused_port() -> Result<u16, std::io::Error> {
	let listener = TcpListener::bind(("127.0.0.1", 0))?;
	let port = listener.local_addr()?.port();
	drop(listener);
	Ok(port)
}

pub fn post_startup(server: &Server, port: u16) {
	let stop_handle = Data::new(StopHandle::default());
	stop_handle.register(server.handle());

	thread::spawn(move || {
		loop_while_parent_process_exists().ok();
		stop_handle.stop(true);
	});

	let value = StartupResponse { port };
	println!("{}", serde_json::to_string(&value).unwrap());
}

fn loop_while_parent_process_exists() -> Result<(), Box<dyn Error>> {
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupResponse {
	pub port: u16,
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
	Read(ReadRequest),
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
	/// Name.
	pub name: String,
	/// Files in the directory.
	pub files: Vec<FileInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadRequest {
	/// Directory path.
	pub path: Option<String>,
	/// Optional subdirectory key.
	pub key: Option<String>,
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
	pub attributes: String,

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

pub struct Middleware;

impl Middleware {
	pub fn token_auth() -> TokenAuth {
		TokenAuth::new(env::var("XCMD_TOKEN").ok())
	}

	pub fn cors() -> Cors {
		Cors::default()
			.allowed_origin("null")
			.allowed_origin("tauri://localhost")
			.allowed_origin("https://tauri.localhost")
			.allowed_origin("http://tauri.localhost")
			.allowed_methods(vec!["GET", "POST"])
			.allowed_headers(vec![
				header::AUTHORIZATION,
				header::ACCEPT,
				header::CONTENT_TYPE,
			])
			.max_age(3600)
	}
}

pub struct TokenAuth {
	token: Option<String>,
}

impl TokenAuth {
	pub fn new(token: Option<String>) -> Self {
		TokenAuth { token }
	}
}

impl<S, B> Transform<S, ServiceRequest> for TokenAuth
where
	S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
	S::Future: 'static,
	B: 'static,
{
	type Response = ServiceResponse<B>;
	type Error = actix_web::Error;
	type InitError = ();
	type Transform = TokenAuthMiddleware<S>;
	type Future = Ready<Result<Self::Transform, Self::InitError>>;

	fn new_transform(&self, service: S) -> Self::Future {
		ready(Ok(TokenAuthMiddleware {
			service,
			token: self.token.clone(),
		}))
	}
}

pub struct TokenAuthMiddleware<S> {
	service: S,
	token: Option<String>,
}

impl<S, B> Service<ServiceRequest> for TokenAuthMiddleware<S>
where
	S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error>,
	S::Future: 'static,
	B: 'static,
{
	type Response = ServiceResponse<B>;
	type Error = actix_web::Error;
	type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

	forward_ready!(service);

	fn call(&self, req: ServiceRequest) -> Self::Future {
		if let Some(token) = &self.token {
			if let Some(auth_header) = req.headers().get("Authorization") {
				let auth_value = auth_header.to_str().unwrap_or_default();
				if auth_value.starts_with("Bearer ") && &auth_value["Bearer ".len()..] != token {
					return Box::pin(async move {
						Err(actix_web::error::ErrorUnauthorized("Unauthorized"))
					});
				}
			} else {
				return Box::pin(async move {
					Err(actix_web::error::ErrorUnauthorized("Unauthorized"))
				});
			}
		}

		// return Box::pin(async move { Err(actix_web::error::ErrorUnauthorized("Unauthorized")) });
		let fut = self.service.call(req);

		Box::pin(async move { Ok(fut.await?) })
	}
}

pub fn load_rustls_config() -> Result<ServerConfig, Box<dyn Error>> {
	let config = ServerConfig::builder()
		.with_safe_defaults()
		.with_no_client_auth();

	let subject_alt_names = vec!["tauri.localhost".to_string(), "localhost".to_string()];
	let cert = generate_simple_self_signed(subject_alt_names)?;
	let public_key_pem = cert.serialize_pem().unwrap();
	let private_key_pem = cert.serialize_private_key_pem();

	let key_file = &mut BufReader::new(private_key_pem.as_bytes());
	let cert_file = &mut BufReader::new(public_key_pem.as_bytes());

	// convert files to key/cert objects
	let cert_chain = certs(cert_file)?
		.into_iter()
		.map(Certificate)
		.collect::<Vec<Certificate>>();
	let mut keys: Vec<PrivateKey> = pkcs8_private_keys(key_file)?
		.into_iter()
		.map(PrivateKey)
		.collect();

	// exit if no keys could be parsed
	if keys.is_empty() {
		eprintln!("Could not locate PKCS 8 private keys.");
		std::process::exit(1);
	}

	let mut result = config.with_single_cert(cert_chain, keys.remove(0))?;

	result.alpn_protocols = vec!["h2".to_string().into(), "http/1.1".to_string().into()];

	Ok(result)
}
