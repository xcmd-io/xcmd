# Cross Commander

Cross Commander is modern cross-platform open-source dual-pane file manager.

## Development

To start in development mode:

~~~shell
cargo run
~~~

## Releasing

Update version in `tauri.conf.json` under `.package.version`:

~~~text
"version": "0.1.8"
~~~

To release a new version:

~~~shell
git tag v0.1.8 -m "Release message"
git push origin v0.1.8
~~~
