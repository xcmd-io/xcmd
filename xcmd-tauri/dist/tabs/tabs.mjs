import stylesheet from './tabs.css' assert { type: 'css' };

document.adoptedStyleSheets.push(stylesheet);

/**
 * @param {string} message
 * @returns {never}
 */
function error(message) {
	throw new Error(message);
}

export class Tabs {
	/** @type {HTMLUListElement} */
	tabs;

	/** @type {HTMLLIElement} */
	tabTemplate;

	/**
	 * Constructor.
	 *
	 * @param {HTMLUListElement | null} element
	 */
	constructor(element) {
		this.tabs = element ?? error('tabs element not found');
		this.tabTemplate = /** @type {HTMLLIElement} */ (this.tabs.firstElementChild);
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
			const target = /** @type {HTMLElement | null} */ (event.target);
			if (target instanceof HTMLElement) {
				const closestTab = target.closest('li');
				const selectedTab = this.tabs.querySelector('.selected');
				if (closestTab !== null && closestTab !== selectedTab) {
					if (selectedTab) {
						selectedTab.classList.remove('selected');
					}
					closestTab.classList.add('selected');
				}
			}
		};
	}

	/**
	 * @param {any} item
	 * @returns {HTMLLIElement}
	 */
	createTab(item) {
		const newTab = /** @type {HTMLLIElement} */ (this.tabTemplate.cloneNode(true));
		/** @type {Record<string, (item: any, slot: HTMLElement) => string>} */
		const fns = {};
		for (const slot of newTab.querySelectorAll('*[data-text]')) {
			if (slot instanceof HTMLElement && slot.dataset.text) {
				const text = item[slot.dataset.text];
				slot.textContent = text;
				slot.title = text;
			}
		}
		for (const slot of newTab.querySelectorAll('*[data-src]')) {
			if (slot instanceof HTMLImageElement && slot.dataset.src) {
				slot.src = item[slot.dataset.src];
			}
		}
		for (const slot of newTab.querySelectorAll('*[data-text-fn]')) {
			if (slot instanceof HTMLElement && slot.dataset.textFn) {
				slot.textContent = fns[slot.dataset.textFn](item, slot);
			}
		}
		for (const slot of newTab.querySelectorAll('*[data-src-fn]')) {
			if (slot instanceof HTMLImageElement && slot.dataset.srcFn) {
				slot.src = fns[slot.dataset.srcFn](item, slot);
			}
		}
		return newTab;
	}

	/**
	 * @param {any} item
	 * @returns {HTMLLIElement}
	 */
	addTab(item) {
		const newTab = this.createTab(item);
		this.tabs.appendChild(newTab);
		return newTab;
	}

	/**
	 * @param {any} item
	 * @returns {void}
	 */
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
