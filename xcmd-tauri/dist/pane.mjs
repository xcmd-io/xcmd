import { Code, Mod, getKey } from './keyboard.mjs';
import { Tabs } from './tabs/tabs.mjs';
import { RemoteDataSource, VTable } from './vtable/vtable.mjs';

export class Pane {
	/** @type {Pane} */
	static activePane;

	/** @type {Pane} */
	static otherPane;

	/** @type {Tabs} */
	tabs;

	/** @type {HTMLInputElement | undefined} */
	address;

	/** @type {VTable<FileInfo>} */
	table;

	/** @type {any} */
	config;

	/**
	 * Constructor.
	 *
	 * @param {Element} element Pane element.
	 */
	constructor(element) {
		this.tabs = new Tabs(element.querySelector('.tabs'));
		this.table = new VTable(element.querySelector('.vtable'));

		element.addEventListener('focusin', (evt) => {
			if (Pane.activePane !== this) {
				const activePane = Pane.activePane;
				Pane.activePane = this;
				Pane.otherPane = activePane;
			}
		});

		const address = element.querySelector('.address');
		if (address instanceof HTMLInputElement) {
			this.address = address;
			address.onblur = () => {
				const newDataSource = new RemoteDataSource(this.config, {
					path: address.value,
				});
				this.setDataSource(newDataSource);
			};
		}

		this.table.onKeyDown = async evt => {
			switch (getKey(evt)) {
				case Code.Tab:
					evt.preventDefault();
					await Pane.otherPane.focus();
					return;
				case Mod.Ctrl | Code.KeyT:
					evt.preventDefault();
					this.tabs.addTab({name: 'xcmd'});
					return;
				case Mod.Ctrl | Code.PageUp:
					evt.preventDefault();
					await this.table.focusRowByIndex(0);
					await this.enterDirectory();
					return;
				case Mod.Ctrl | Code.PageDown:
					evt.preventDefault();
					await this.enterDirectory();
					return;
				case Code.Enter:
					evt.preventDefault();
					await this.enterDirectory();
					return;
				default:
					console.log('keyCode', evt.keyCode);
			}
		};

		this.table.onDoubleClick = (_evt) => {
			this.enterDirectory();
		};
	}

	/**
	 * @param {import('./vtable/vtable.mjs').RemoteDataSourceProps} config
	 */
	async setConfig(config) {
		this.config = config;
		this.setDataSource(new RemoteDataSource(this.config, {}));
	}

	/**
	 * @param {RemoteDataSource} dataSource
	 */
	async setDataSource(dataSource) {
		await this.table.setDataSource(dataSource);
		this.tabs.updateActiveTab({ name: await dataSource.getName() });
		if (this.address !== undefined) {
			this.address.value = await dataSource.getPath();
		}
		const activeIndex = await dataSource.getActiveIndex();
		if (activeIndex !== -1) {
			await this.table.focusRowByIndex(activeIndex);
		}
	}

	async focus() {
		await this.table.focus();
	}

	async enterDirectory() {
		const item = await this.table.dataSource.getItem(this.table.activeIndex);
		if (!item) {
			return;
		}
		const currentDirectory = this.address?.value;
		if (item.isDirectory) {
			const newDataSource = new RemoteDataSource(this.config, {
				path: currentDirectory,
				key: item.key,
			});
			await this.setDataSource(newDataSource);
		} else {
			console.log(currentDirectory, item);
			const invoke = window.__TAURI__.invoke;
			invoke('open_detached', { directory: currentDirectory, key: item.key });
		}
	}
}
