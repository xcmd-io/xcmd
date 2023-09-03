class Pane {
	tabs;
	address;
	table;
	port;

	constructor(element, port) {
		this.tabs = new Tabs(element.querySelector('.tabs'));
		this.address = element.querySelector('.address');
		this.table = new VTable(element.querySelector('.vtable'));
		this.port = port;
		this.setDataSource(new RemoteDataSource(this.port, {}));

		this.address.onblur = () => {
			const newDataSource = new RemoteDataSource(this.port, {
				path: this.address.value,
			});
			this.setDataSource(newDataSource);
		};

		this.table.onKeyDown = evt => {
			switch (evt.keyCode) {
				case 9:
					const otherPane = element == leftPane
						? rightPane
						: leftPane;
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
	}

	async setDataSource(dataSource) {
		await this.table.setDataSource(dataSource);
		this.address.value = await dataSource.getPath();
		const activeIndex = await dataSource.getActiveIndex();
		if (activeIndex !== -1) {
			await this.table.focusRowByIndex(activeIndex);
		}
	}

	async enterDirectory() {
		const item = await this.table.dataSource.getItem(this.table.activeIndex);
		const newDataSource = new RemoteDataSource(this.port, {
			path: this.address.value,
			key: item.key,
		});
		await this.setDataSource(newDataSource);
	}
}
