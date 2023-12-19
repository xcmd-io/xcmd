import { Code, Mod, getKey } from './keyboard.mjs';
import { Tabs } from './tabs/tabs.mjs';
import { RemoteDataSource, VTable } from './vtable/vtable.mjs';
import { Tab, deleteTab, getSession, insertTab, updateTab } from './session.mjs';

const session = await getSession();

export class Pane {
	/** @type {Pane} */
	static activePane;

	/** @type {Pane} */
	static otherPane;

	/** @type {Pane} */
	static leftPane;

	/** @type {Pane} */
	static rightPane;

	/** @type {number} */
	id;

	/** @type {Tabs<Tab>} */
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
	 * @param {boolean} primary Indicates whether the pane is a primary (left) pane.
	 */
	constructor(element, primary) {
		if (primary) {
			this.id = 1;
			Pane.leftPane = this;
			Pane.activePane = this;
		} else {
			this.id = 2;
			Pane.rightPane = this;
			Pane.otherPane = this;
		}

		const tabs = session.tabs.filter(x => x.paneId === this.id);
		this.tabs = new Tabs(element.querySelector('.tabs'), tabs);
		this.table = new VTable(element.querySelector('.vtable'));

		element.addEventListener('focusin', (evt) => {
			if (Pane.activePane !== this) {
				const activePane = Pane.activePane;
				Pane.activePane = this;
				Pane.otherPane = activePane;
			}
		});

		this.tabs.onClose = tab => deleteTab(tab.id);

		this.tabs.onSelect = async tab => {
			const newDataSource = new RemoteDataSource(this.config, {
				path: tab.address,
			});
			await this.setDataSource(newDataSource);
		};

		const address = element.querySelector('.address');
		if (address instanceof HTMLInputElement) {
			this.address = address;
			address.onblur = async () => {
				const newDataSource = new RemoteDataSource(this.config, {
					path: address.value,
				});
				await this.setDataSource(newDataSource);
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
					const activeTab = this.tabs.getActiveTabItem();
					const tab = await insertTab(session.sessionId, Pane.activePane.id,
						activeTab?.name, activeTab?.address, activeTab?.system);
					this.tabs.addTab(tab);
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
		const tab = this.tabs.getActiveTabItem();
		await this.setDataSource(new RemoteDataSource(this.config, {
			path: tab?.address,
		}));
	}

	/**
	 * @param {RemoteDataSource} dataSource
	 */
	async setDataSource(dataSource) {
		await this.table.setDataSource(dataSource);
		const tab = this.tabs.getActiveTabItem();
		if (tab !== undefined) {
			tab.name = await dataSource.getName();
			tab.address = await dataSource.getPath();
			await updateTab(tab.id, tab.name, tab.address, tab.system ?? '');
			this.tabs.updateActiveTab(tab);
		}
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
