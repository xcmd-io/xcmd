const vsplit = document.getElementById('vsplit');
const leftPane = vsplit.firstElementChild;
const rightPane = leftPane.cloneNode(true);
vsplit.appendChild(rightPane);

new VSplit(vsplit);
new Pane(leftPane, 8080);
new Pane(rightPane, 8080);

if (!sessionStorage.getItem('initialized')) {
	const invoke = window.__TAURI__.invoke;
	invoke('spawn_process', { process: 'xcmd-fs', arguments: [] }); // port 8080
	// invoke('spawn_process', { process: 'xcmd-ssh', arguments: [] }); // port 8081
	// invoke('spawn_process', { process: 'xcmd-s3', arguments: [] }); // port 8082
	sessionStorage.setItem('initialized', '1');
}

document.onkeydown = e => {
	switch (getKey(e)) {
		case Mod.Ctrl | Code.KeyP:
			return false;
	}
};
