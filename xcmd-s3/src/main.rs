use actix_cors::Cors;
use actix_web::{body::to_bytes, get, http, post, web, App, HttpResponse, HttpServer};
use aws_sdk_s3::{model::EncodingType, Credentials, Region};
use rust_embed::RustEmbed;
use tracing::trace;
use tracing_actix_web::TracingLogger;
use std::{
	borrow::{Borrow, Cow},
	error::Error,
	env,
	iter::once,
	ops::Deref,
	path::Component,
};
use xcmd_base::{
	stop_server_when_parent_process_exits, FileInfo, ListRequest, ListResponse, Request, Response, init_telemetry,
};

#[post("/")]
async fn enact(request: web::Json<Request>) -> Result<HttpResponse, Box<dyn Error>> {
	match request.into_inner() {
		Request::List(request) => {
			let response = list_files(request).await?;
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
async fn main() -> std::io::Result<()> {
	init_telemetry("xcmd_s3");

	let server = HttpServer::new(|| {
		let cors = Cors::default()
			.allowed_origin("null")
			.allowed_origin("https://tauri.localhost")
			.allowed_origin("http://127.0.0.1:1430")
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
	.bind(("127.0.0.1", 8081))?
	.run();

	stop_server_when_parent_process_exits(&server);

	server.await
}

async fn list_files(request: ListRequest) -> Result<ListResponse, Box<dyn Error>> {
	trace!("request = {:?}", &request);

	// create config for AWS SDK
	let config = aws_config::from_env()
		.credentials_provider(Credentials::from_keys(
			env::var("AWS_ACCESS_KEY_ID").unwrap_or_default().trim(),
			env::var("AWS_SECRET_ACCESS_KEY").unwrap_or_default().trim(),
			None,
		))
		.region(Region::new(env::var("AWS_DEFAULT_REGION").unwrap_or_default()))
		.load()
		.await;

	// gets the path
	let path = if let Some(ref path) = request.path {
		std::path::Path::new(path).to_path_buf()
	} else {
		std::path::Path::new("/").to_path_buf()
	};

	// gets the full path; this path concatenated with the optional key
	let full_path = if let Some(ref key) = request.key {
		path.join(key)
	} else {
		path.clone()
	};

	let separator = Cow::Borrowed("/");

	let mut active_name = None::<Cow<str>>;

	// this normalizes the path into a vector of string components
	// (invalid path is recognized as an empty vector)
	let mut path_parts = Vec::<Cow<str>>::new();
	for component in full_path.components() {
		active_name = None;

		match component {
			Component::RootDir => {
				// if root dir is recognized anywhere in the middle of the path, break using empty vector
				if !path_parts.is_empty() {
					path_parts.clear();
					break;
				}
			}
			Component::ParentDir => {
				// if there is no parent directory, break
				active_name = path_parts.pop();
				if active_name.is_none() {
					break;
				}
			}
			Component::CurDir => {
				// do nothing
			}
			Component::Normal(normal_component) => {
				// push the current component to the resulting vector
				path_parts.push(normal_component.to_string_lossy());
			}
			_ => {
				// anything else is considered invalid and breaks using empty vector
				path_parts.clear();
				break;
			}
		}
	}

	let active_key = if let Some(name) = active_name { Some(format!("{}/", name)) } else { None };
	trace!("active_key = {:?}", active_key);

	// the path has form of {bucket_name}/{prefix1}/{prefix2}/{object_name}
	let bucket_name = path_parts.get(0);
	// let path = {
	// 	let mut result = String::new();
	// 	let sep = separator.clone();
	// 	let mut iter = path_parts.iter().skip(1);
	// 	let first = &iter.skip(1).next();
	// 	//let x = once(&sep.clone());
	// 	let iter2 = first
	// 		.into_iter();
	// 		//.chain(Some(&sep.clone()).into_iter())
	// 	let iter3 = iter.flat_map(|&s| once(&sep).chain(once(&s)));
	// 	iter2.chain(iter3)
	// 		;//.for_each(|x| result.push_str(x.borrow()));
	// 	result
	// };
	// full s3 object path (excluding bucket name)
	let path = {
		let mut result = String::new();
		let sep = separator.clone();
		path_parts
			.iter()
			.skip(1)
			.flat_map(move |s| once(s.clone()).chain(once(sep.clone())))
			.for_each(|x| result.push_str(x.borrow()));
		result
	};

	let mut files = Vec::<FileInfo>::new();
	let client = aws_sdk_s3::Client::new(&config);

	// if path has a bucket name, objects within the bucket will be listed (otherwise, bucket names will be listed)
	if let Some(bucket_name) = bucket_name {
		// within a bucket, there is always a parent directory that contains all buckets
		files.push(FileInfo {
			key: "../".to_string(),
			name: "..".to_string(),
			size: 0,
			attributes: 0,
			date: 0,
			extension: "".to_string(),
			icon: "region".to_string(),
			icon_type: "".to_string(),
			is_directory: true,
			is_active: false,
		});

		let resp = client
			.list_objects_v2()
			.bucket(bucket_name.deref())
			.delimiter("/")
			.prefix(&path)
			.encoding_type(EncodingType::Url)
			.send()
			.await?;

		// get directories
		if let Some(common_prefixes) = resp.common_prefixes() {
			for common_prefix in common_prefixes {
				let key = common_prefix
					.prefix()
					.map(|x| &x[path.len()..])
					.unwrap_or_default()
					.to_string();
				let name = key.clone();
				let is_active = active_key.as_ref().map(|x| x == &key).unwrap_or(false);
				files.push(FileInfo {
					key,
					name,
					size: 0,
					attributes: 0,
					date: 0,
					extension: "".to_string(),
					icon: "bucket".to_string(),
					icon_type: "".to_string(),
					is_directory: true,
					is_active,
				});
			}
		}

		// get objects
		let objects = resp.contents().unwrap_or_default();
		for object in objects {
			let key = object
				.key()
				.map(|x| &x[path.len()..])
				.unwrap_or_default()
				.to_string();
			let name = key.clone();
			if !name.is_empty() {
				let is_active = active_key.as_ref().map(|x| x == &key).unwrap_or(false);
				files.push(FileInfo {
					key,
					name,
					size: 0,
					attributes: 0,
					date: 0,
					extension: "".to_string(),
					icon: "object".to_string(),
					icon_type: "".to_string(),
					is_directory: true,
					is_active,
				});
			}
		}
	} else {
		// if bucket name is not specified in the path
		let resp = client.list_buckets().send().await?;
		let buckets = resp.buckets().unwrap_or_default();

		for bucket in buckets {
			let name = bucket.name().unwrap_or_default().to_string();
			let key = format!("{}/", name);
			let is_active = active_key.as_ref().map(|x| x == &key).unwrap_or(false);
			files.push(FileInfo {
				key,
				name,
				size: 0,
				attributes: 0,
				date: 0,
				extension: "".to_string(),
				icon: "region".to_string(),
				icon_type: "".to_string(),
				is_directory: true,
				is_active,
			});
		}
	}

	// let absolute_path = once(separator.clone()).chain(once(path))
	// 	.collect::<String>();
	let absolute_path = {
		if path_parts.is_empty() {
			"/".to_string()
		} else {
			let mut result = String::new();
			let sep = separator.clone();
			path_parts
				.iter()
				.flat_map(move |s| once(sep.clone()).chain(once(s.clone())))
				.for_each(|x| result.push_str(x.borrow()));
			result
		}
	};

	Ok(ListResponse {
		path: absolute_path,
		files,
	})
}
