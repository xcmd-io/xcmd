import stylesheet from './tabs.css' assert { type: 'css' };

document.adoptedStyleSheets.push(stylesheet);

/**
 * @param {string} message
 * @returns {never}
 */
function error(message) {
	throw new Error(message);
}

/**
 * @template TItem
 */
export class Tabs {
	/** @type {TItem[]} */
	items = [];

	/** @type {HTMLUListElement} */
	tabs;

	/** @type {HTMLLIElement} */
	tabTemplate;

	/**
	 * Constructor.
	 *
	 * @param {HTMLUListElement | null} element
	 * @param {TItem[] | undefined} items
	 */
	constructor(element, items) {
		this.tabs = element ?? error('tabs element not found');
		this.tabTemplate = /** @type {HTMLLIElement} */ (this.tabs.firstElementChild);
		this.tabs.removeChild(this.tabTemplate);

		if (items) {
			for (const tab of items) {
				this.addTab(tab);
			}
		}

		this.tabs.firstElementChild?.classList.add('selected');

		this.tabs.onwheel = event => {
			event.preventDefault();
			this.tabs.scrollLeft += event.deltaY;
		};

		this.tabs.onclick = async event => {
			const target = /** @type {HTMLElement | null} */ (event.target);
			if (target instanceof HTMLElement) {
				const closestTab = target.closest('li');
				if (closestTab !== null && target.classList.contains('close')) {
					await this.closeTab(closestTab);
					return;
				}
				const selectedTab = this.tabs.querySelector('.selected');
				if (closestTab !== null && closestTab !== selectedTab) {
					if (selectedTab) {
						selectedTab.classList.remove('selected');
					}
					closestTab.classList.add('selected');
					const tabIndex = Array.prototype.indexOf.call(this.tabs.children, closestTab);
					await this.onSelect(this.items[tabIndex]);
				}
			}
		};
	}

	/**
	 * @param {HTMLElement} tabElement
	 */
	async closeTab(tabElement) {
		if (this.tabs.children.length === 1) {
			return;
		}
		const nextTab = tabElement.classList.contains('selected')
			? tabElement.nextElementSibling ?? tabElement.previousElementSibling
			: null;
		const tabIndex = Array.prototype.indexOf.call(this.tabs.children, tabElement);
		await this.onClose(this.items[tabIndex]);
		this.items.splice(tabIndex, 1);
		this.tabs.removeChild(tabElement);
		if (nextTab !== null) {
			nextTab.classList.add('selected');
			const nextTabIndex = Array.prototype.indexOf.call(this.tabs.children, nextTab);
			await this.onSelect(this.items[nextTabIndex]);
		}
	}

	/**
	 * @param {TItem} tab
	 */
	async onClose(tab) {
		console.log('close tab', tab);
	}

	/**
	 * @param {TItem} tab
	 */
	async onSelect(tab) {
		console.log('select tab', tab);
	}

	/**
	 * @param {TItem} item
	 * @returns {HTMLLIElement}
	 */
	createTab(item) {
		const newTab = /** @type {HTMLLIElement} */ (this.tabTemplate.cloneNode(true));
		/** @type {Record<string, (item: any, slot: HTMLElement) => string>} */
		const fns = {};
		for (const slot of newTab.querySelectorAll('*[data-text]')) {
			if (slot instanceof HTMLElement && slot.dataset.text) {
				const text = /** @type any */(item)[slot.dataset.text];
				slot.textContent = text;
				slot.title = text;
			}
		}
		for (const slot of newTab.querySelectorAll('*[data-src]')) {
			if (slot instanceof HTMLImageElement && slot.dataset.src) {
				slot.src = /** @type any */(item)[slot.dataset.src];
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
	 * @param {TItem} item
	 * @returns {HTMLLIElement}
	 */
	addTab(item) {
		this.items.push(item);
		const newTab = this.createTab(item);
		this.tabs.appendChild(newTab);
		return newTab;
	}

	/**
	 * @param {TItem} item
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

	/**
	 * @returns {TItem | undefined}
	 */
	getActiveTabItem() {
		const activeTab = this.tabs.querySelector('li.selected');
		if (!activeTab) {
			return;
		}
		const tabIndex = Array.prototype.indexOf.call(this.tabs.children, activeTab);
		return this.items[tabIndex];
	}
}
