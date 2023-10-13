class Tabs {
	tabs;
	tabTemplate;

	constructor(element) {
		this.tabs = element;
		this.tabTemplate = this.tabs.firstElementChild;
		this.tabs.removeChild(this.tabTemplate);

		// for (let i = 0; i < 10; ++i) {
		// 	this.addTab({name: 'xcmd'});
		// }
		const tab = this.addTab({name: 'xcmd'});
		tab.classList.add('selected');

		this.tabs.onwheel = event => {
			event.preventDefault();
			this.tabs.scrollLeft += event.deltaY;
		};

		this.tabs.onclick = event => {
			const target = event.target.closest('li');
			const selected = this.tabs.querySelector('.selected');
			if (target !== selected) {
				if (selected) {
					selected.classList.remove('selected');
				}
				target.classList.add('selected');
			}
		};
	}

	createTab(item) {
		const newTab = this.tabTemplate.cloneNode(true);
		const fns = {};
		for (const slot of newTab.querySelectorAll('*[data-text]')) {
			const text = item[slot.dataset.text];
			slot.textContent = text;
			slot.title = text;
		}
		for (const slot of newTab.querySelectorAll('*[data-src]')) {
			slot.src = item[slot.dataset.src];
		}
		for (const slot of newTab.querySelectorAll('*[data-text-fn]')) {
			slot.textContent = fns[slot.dataset.textFn](item);
		}
		for (const slot of newTab.querySelectorAll('*[data-src-fn]')) {
			slot.src = fns[slot.dataset.srcFn](item);
		}
		return newTab;
	}

	addTab(item) {
		const newTab = this.createTab(item);
		this.tabs.appendChild(newTab);
		return newTab;
	}

	updateActiveTab(item) {
		const activeTab = this.tabs.querySelector('li.selected');
		if (!activeTab) {
			return;
		}
		const updatedTab = this.createTab(item);
		updatedTab.classList.add('selected');
		this.tabs.replaceChild(updatedTab, activeTab);
	}
}
