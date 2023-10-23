const vsplit = document.getElementById('vsplit');
const leftPaneElement = vsplit.firstElementChild;
const rightPaneElement = leftPaneElement.cloneNode(true);
vsplit.appendChild(rightPaneElement);

new VSplit(vsplit);
const leftPane = new Pane(leftPaneElement);
const rightPane = new Pane(rightPaneElement);
const palette = new Palette(document.getElementById('palette'));
const commands = [
	{ name: "Developer: Reload Window", action: () => location.reload() },
];
palette.table.onKeyDown = async evt => {
	switch (getKey(evt)) {
		case Code.Enter:
			const item = await palette.table.dataSource.getItem(palette.table.activeIndex);
			item.action();
			return false;
	}
};


palette.setData(commands, item => item.name);

document.body.onkeydown = e => {
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
};

if (!sessionStorage.getItem('initialized')) {
	const { shell } = window.__TAURI__;
	const token = crypto.randomUUID();

	const command = shell.Command.sidecar('binaries/xcmd-fs', [], { XCMD_TOKEN: token });
	command.stdout.on('data', line => {
		const { port } = JSON.parse(line);
		const config = { port, token };
		leftPane.setConfig(config);
		rightPane.setConfig(config);
	});

	command.execute();

	// const invoke = window.__TAURI__.invoke;
	// invoke('spawn_process', { process: 'xcmd-fs', arguments: [] }); // port 8080
	// invoke('spawn_process', { process: 'xcmd-ssh', arguments: [] }); // port 8081
	// invoke('spawn_process', { process: 'xcmd-s3', arguments: [] }); // port 8082
	sessionStorage.setItem('initialized', '1');
}
