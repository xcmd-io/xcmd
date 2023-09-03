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

	addTab(item) {
		const fns = {};
		const newTab = this.tabTemplate.cloneNode(true);
		for (const slot of newTab.querySelectorAll('*[data-text]')) {
			slot.textContent = item[slot.dataset.text];
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
		this.tabs.appendChild(newTab);
		return newTab;
	}
}
