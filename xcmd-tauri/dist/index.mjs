import { Store } from './modules/tauri-plugin-store-api.mjs';
import stylesheet from './index.css' assert { type: 'css' };
import defaultThemeStylesheet from './themes/light.css' assert { type: 'css' };
import { Code, getKey } from './keyboard.mjs';
import { Palette } from './palette/palette.mjs';
import { Pane } from './pane.mjs';
import { VSplit } from './vsplit/vsplit.mjs';

const store = new Store('settings.json');
const theme = await store.get('theme') ?? 'light';
document.adoptedStyleSheets.push(defaultThemeStylesheet);

if (theme) {
	try {
		console.log(`loading theme: ${theme}`);
		const themeStylesheet = await import(`./themes/${theme}.css`, { assert: { type: 'css' } });
		document.adoptedStyleSheets.push(themeStylesheet.default);
	} catch (e) {
		console.log(`loading theme failed: ${e}`);
	}
}

document.adoptedStyleSheets.push(stylesheet);

const vsplit = /** @type {HTMLElement} */ (document.getElementById('vsplit'));
const leftPaneElement = /** @type {HTMLElement} */ (vsplit.firstElementChild);
const rightPaneElement = /** @type {HTMLElement} */ (leftPaneElement.cloneNode(true));
vsplit.appendChild(rightPaneElement);

new VSplit(vsplit);
const leftPane = new Pane(leftPaneElement, rightPaneElement);
const rightPane = new Pane(rightPaneElement, leftPaneElement);
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

document.body.addEventListener('keydown', e => {
	if (e.defaultPrevented) {
		return;
	}
	switch (getKey(e)) {
		case Code.F3:
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
