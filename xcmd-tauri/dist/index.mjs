import { Store } from './modules/tauri-plugin-store-api.mjs';
import { Code, Mod, getKey } from './keyboard.mjs';
import { Palette } from './palette/palette.mjs';
import { Pane } from './pane.mjs';
import { VSplit } from './vsplit/vsplit.mjs';
import { RemoteDataSource } from './vtable/vtable.mjs';
import { appendStyleSheet } from './stylesheet.mjs';

const store = new Store('settings.json');
const theme = await store.get('theme') ?? 'light';

appendStyleSheet('./themes/light.css', import.meta.url);

if (theme) {
	try {
		console.log(`loading theme: ${theme}`);
		appendStyleSheet(`./themes/${theme}.css`, import.meta.url);
	} catch (e) {
		console.log(`loading theme failed: ${e}`);
	}
}

await appendStyleSheet('./index.css', import.meta.url)
document.body.classList.remove('loading');

const vsplit = /** @type {HTMLElement} */ (document.getElementById('vsplit'));
const leftPaneElement = /** @type {HTMLElement} */ (vsplit.firstElementChild);
const rightPaneElement = /** @type {HTMLElement} */ (leftPaneElement.cloneNode(true));
vsplit.appendChild(rightPaneElement);

new VSplit(vsplit);
const leftPane = new Pane(leftPaneElement, true);
const rightPane = new Pane(rightPaneElement, false);
const palette = new Palette(/** @type {HTMLElement} */ (document.getElementById('palette')));
const commands = [
	{ name: "Developer: Reload Window", action: () => location.reload() },
];
palette.table.onKeyDown = /** @type {(evt: KeyboardEvent) => Promise<void>} */ (async evt => {
	switch (getKey(evt)) {
		case Code.Enter:
			evt.preventDefault();
			const item = await palette.table.dataSource.getItem(palette.table.activeIndex);
			item.action();
			return;
	}
});

palette.setData(commands, item => item.name);

document.body.addEventListener('keydown', async e => {
	if (e.defaultPrevented) {
		return;
	}
	switch (getKey(e)) {
		case Code.F3: {
			e.preventDefault();
			const pane = Pane.activePane;
			const table = pane.table;
			const item = await table.dataSource.getItem(table.activeIndex);
			console.log('F3', item?.key);
			if (item !== undefined && !item.isDirectory && table.dataSource instanceof RemoteDataSource) {
				const buffer = await table.dataSource.read({
					path: pane.address?.value,
					key: item.key,
				});
				const string = new TextDecoder().decode(buffer);
				// const lister = open('lister/lister.html'); // alert(string)
				const { window: win } = window.__TAURI__;
				const webview = new win.WebviewWindow('lister', {
					title: 'Cross Lister',
					url: 'lister/lister.html',
					focus: true,
					visible: false,
				});
				webview.once('tauri://created', async e => {
					setTimeout(async () => {
						await webview.emit('data', { value: string, filename: item.key });
					}, 200);
				});
			}
			return false;
		}
		case Mod.Shift | Code.F3: {
			e.preventDefault();
			const [leftPane, rightPane] = [Pane.leftPane, Pane.rightPane];
			const [leftTable, rightTable] = [leftPane.table, rightPane.table];
			const [leftDataSource, rightDataSource] = [leftTable.dataSource, rightTable.dataSource];
			const [leftItem, rightItem] = await Promise.all([
				leftDataSource.getItem(leftTable.activeIndex),
				rightDataSource.getItem(rightTable.activeIndex),
			]);
			console.log('diff', leftItem?.key, rightItem?.key);
			if (leftItem !== undefined && !leftItem.isDirectory && leftDataSource instanceof RemoteDataSource
					&& rightItem !== undefined && !rightItem.isDirectory && rightDataSource instanceof RemoteDataSource) {
				const [leftBuffer, rightBuffer] = await Promise.all([
					leftDataSource.read({
						path: leftPane.address?.value,
						key: leftItem.key,
					}),
					rightDataSource.read({
						path: rightPane.address?.value,
						key: rightItem.key,
					}),
				]);
				const [leftString, rightString] = [
					new TextDecoder().decode(leftBuffer),
					new TextDecoder().decode(rightBuffer),
				];
				const { window: win } = window.__TAURI__;
				const webview = new win.WebviewWindow('lister', {
					title: 'Cross Lister',
					url: 'lister/lister.html',
					focus: true,
					visible: false,
				});
				webview.once('tauri://created', async e => {
					setTimeout(async () => {
						await webview.emit('data', {
							mode: 'diff',
							value: leftString,
							filename: leftItem.key,
							otherValue: rightString,
							otherFilename: rightItem.key
						});
					}, 200);
				});
			}
			return false;
		}
		case Code.F4:
		case Code.F5:
		case Code.F6:
		case Code.F7:
		case Code.F8:
		case Code.F9:
			e.preventDefault();
			return false;
	}
});

const configJson = sessionStorage.getItem('config')
if (!configJson) {
	const { shell } = window.__TAURI__;
	const token = crypto.randomUUID();

	/* @ts-expect-error: environment variables should be passed in an object with env field */
	const command = shell.Command.sidecar('binaries/xcmd-fs', [], { XCMD_TOKEN: token });
	command.stdout.on('data', line => {
		const { port } = JSON.parse(line);
		const config = { port, token };
		sessionStorage.setItem('config', JSON.stringify(config));
		leftPane.setConfig(config);
		rightPane.setConfig(config);
	});

	command.execute();

	// const invoke = window.__TAURI__.invoke;
	// invoke('spawn_process', { process: 'xcmd-fs', arguments: [] }); // port 8080
	// invoke('spawn_process', { process: 'xcmd-ssh', arguments: [] }); // port 8081
	// invoke('spawn_process', { process: 'xcmd-s3', arguments: [] }); // port 8082
} else {
	const config = JSON.parse(configJson);
	leftPane.setConfig(config);
	rightPane.setConfig(config);
}
