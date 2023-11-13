class Pane {
	tabs;
	address;
	table;
	config;

	constructor(element) {
		this.tabs = new Tabs(element.querySelector('.tabs'));
		this.address = element.querySelector('.address');
		this.table = new VTable(element.querySelector('.vtable'));

		this.address.onblur = () => {
			const newDataSource = new RemoteDataSource(this.config, {
				path: this.address.value,
			});
			this.setDataSource(newDataSource);
		};

		this.table.onKeyDown = evt => {
			switch (evt.keyCode) {
				case 9:
					const otherPane = element == leftPaneElement
						? rightPaneElement
						: leftPaneElement;
					otherPane.querySelector('.vtable').tBodies[0].focus();
					return false;
				case 84:
					this.tabs.addTab({name: 'xcmd'});
					return false;
				case 13:
					this.enterDirectory();
					return false;
				default:
					console.log('keyCode', evt.keyCode);
			}
		};

		this.table.onDoubleClick = (evt) => {
			this.enterDirectory();
		};
	}

	async setConfig(config) {
		this.config = config;
		this.setDataSource(new RemoteDataSource(this.config, {}));
	}

	async setDataSource(dataSource) {
		await this.table.setDataSource(dataSource);
		this.tabs.updateActiveTab({ name: await dataSource.getName() });
		this.address.value = await dataSource.getPath();
		const activeIndex = await dataSource.getActiveIndex();
		if (activeIndex !== -1) {
			await this.table.focusRowByIndex(activeIndex);
		}
	}

	async enterDirectory() {
		const item = await this.table.dataSource.getItem(this.table.activeIndex);
		if (item.isDirectory) {
			const newDataSource = new RemoteDataSource(this.config, {
				path: this.address.value,
				key: item.key,
			});
			await this.setDataSource(newDataSource);
		} else {
			console.log(this.address.value, item);
			const invoke = window.__TAURI__.invoke;
			invoke('open_detached', { directory: this.address.value, key: item.key });
		}
	}
}
