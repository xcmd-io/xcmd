use std::env::consts;
use std::error::Error;
use std::fs;
use std::process::Command;

pub fn get_rustc_host() -> Result<String, Box<dyn Error>> {
	let output = Command::new("rustc").arg("-vV").output()?;
	let stdout = String::from_utf8(output.stdout)?;
	let host = stdout
		.lines()
		.find_map(|l| l.strip_prefix("host: "))
		.ok_or_else(|| "target triple not found in rustc output")?;
	Ok(host.to_string())
}

fn main() -> Result<(), Box<dyn Error>> {
	let host = get_rustc_host()?;
	fs::create_dir_all("binaries")?;
	eprintln!(
		"copying: {} -> {}",
		format!("../../target/release/xcmd-fs{}", consts::EXE_SUFFIX),
		format!("binaries/xcmd-fs-{}{}", host, consts::EXE_SUFFIX)
	);
	fs::copy(
		format!("../../target/release/xcmd-fs{}", consts::EXE_SUFFIX),
		format!("binaries/xcmd-fs-{}{}", host, consts::EXE_SUFFIX),
	)?;

	Ok(tauri_build::build())
}
