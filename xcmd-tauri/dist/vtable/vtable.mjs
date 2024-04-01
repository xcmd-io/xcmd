import { Code, getKey } from '../keyboard.mjs';
import { appendStyleSheet } from '../stylesheet.mjs';

appendStyleSheet('./vtable.css', import.meta.url);

/**
 * @template TItem
 * @typedef DataSource
 * @prop {() => Promise<number>} getLength
 * @prop {(index: number) => Promise<TItem | undefined>} getItem
 */

/**
 * @implements DataSource<{name: string}>
 */
export class GeneratedDataSource {
	/**
	 * @returns {Promise<number>}
	 */
	async getLength() {
		return 400_000;
	}

	/**
	 * @param {number} index
	 * @returns {Promise<{name: string}>}
	 */
	async getItem(index) {
		return {
			name: `index${index}`,
		};
	}
}

/**
 * @template TItem
 * @implements DataSource<TItem>
 */
export class EmptyDataSource {
	static INSTANCE = new EmptyDataSource();

	/**
	 * @returns {Promise<number>}
	 */
	async getLength() {
		return 0;
	}

	/**
	 * @param {number} _index
	 * @returns {Promise<TItem | undefined>}
	 */
	async getItem(_index) {
		return undefined;
	}
}

/**
 * @template TItem
 * @implements DataSource<TItem>
 */
export class ArrayDataSource {
	/** @type {TItem[]} */
	array;

	/**
	 * Constructor.
	 *
	 * @param {TItem[]} array
	 */
	constructor(array) {
		this.array = Array.isArray(array) ? array : [];
	}

	/**
	 * @returns {Promise<number>}
	 */
	async getLength() {
		return this.array.length;
	}

	/**
	 * @param {number} index
	 * @returns {Promise<TItem>}
	 */
	async getItem(index) {
		return this.array[index];
	}
}

/**
 * Locale compare strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareString(a, b) {
	const aIsUndefinedOrNull = a === null || a === undefined;
	const bIsUndefinedOrNull = b === null || b === undefined;

	if (aIsUndefinedOrNull && bIsUndefinedOrNull) {
		return 0;
	}
	if (aIsUndefinedOrNull) {
		return -1;
	}
	if (bIsUndefinedOrNull) {
		return 1;
	}
	return a.localeCompare(b);
}

/**
 * @typedef {object} RemoteDataSourceProps
 * @prop {number} port
 * @prop {string} token
 */

/**
 * @implements DataSource<FileInfo>
 */
export class RemoteDataSource {
	/** @type {RemoteDataSourceProps} */
	config;
	/** @type {Promise<ListResponse>} */
	response;

	/**
	 * Constructor.
	 *
	 * @param {RemoteDataSourceProps} config
	 * @param {*} request
	 */
	constructor(config, request) {
		this.config = config;
		this.response = this.listFiles(request);
	}

	baseUri() {
		const { port } = this.config;
		// TODO: use TLS when tauri adds support to trust self-signed certificates
		return 'http://localhost:' + port;
	}

	/**
	 * @param {ListRequest} request
	 * @returns {Promise<ListResponse>}
	 */
	async listFiles(request) {
		const { token } = this.config;
		const response = await fetch(this.baseUri(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
			},
			body: JSON.stringify({
				list: request,
			}),
		});
		const result = /** @type {ListResponse} */ (await response.json());
		result.list.files.sort((a, b) => (Number(b.isDirectory) - Number(a.isDirectory))
			|| compareString(a.name, b.name)
			|| compareString(a.extension, b.extension)
			|| compareString(a.key, b.key));
		return result;
	}

	/**
	 * @param {ReadRequest} request
	 * @returns {Promise<ArrayBuffer>}
	 */
	async read(request) {
		const { token } = this.config;
		const response = await fetch(this.baseUri(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`,
			},
			body: JSON.stringify({
				read: request,
			}),
		});
		return await response.arrayBuffer();
	}

	/**
	 * @returns {Promise<string>}
	 */
	async getPath() {
		return (await this.response).list.path;
	}

	/**
	 * @returns {Promise<string>}
	 */
	async getName() {
		return (await this.response).list.name;
	}

	/**
	 * @returns {Promise<number>}
	 */
	async getLength() {
		return (await this.response).list.files.length;
	}

	/**
	 * @param {number} index
	 * @returns {Promise<FileInfo>}
	 */
	async getItem(index) {
		return (await this.response).list.files[index];
	}

	/**
	 * @returns {Promise<number>}
	 */
	async getActiveIndex() {
		return (await this.response).list.files.findIndex(item => item.isActive);
	}
}

/**
 * Creates a CSS height value that can handle large values.
 *
 * @param {number} index
 * @param {number} height
 * @returns {string}
 */
function cssMultiplyHeight(index, height) {
	const maxValue = 1_000_000;
	if (index * height < maxValue) {
		return index * height + 'px';
	}
	const array = [];
	while (index > 1_000_000) {
		array.push(`${maxValue - 1} * (${height}px + 0em)`);
		index -= maxValue - 1;
	}
	array.push(`${index} * (${height}px + 0em)`);
	return `calc(${array.join(' + ')})`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function htmlEncode(text) {
	return text.replace(/[&<"']/g, m => {
		switch (m) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '"':
				return '&quot;';
			default:
				return '&#039;';
		}
	});
};

class Range {
	static EMPTY = new Range(0, 0);
	/** @type {number} */
	start;
	/** @type {number} */
	end;

	/**
	 * Constructor.
	 *
	 * @param {number} start
	 * @param {number} end
	 */
	constructor(start, end) {
		this.start = start;
		this.end = end;
	}

	/**
	 * @param {string | undefined} range
	 * @returns {Range}
	 */
	static parse(range) {
		if (!range) {
			return Range.EMPTY;
		}
		const dashIndex = range.indexOf('-');
		if (dashIndex === -1) {
			return Range.EMPTY;
		}
		return new Range(
			Number(range.substr(0, dashIndex)),
			Number(range.substr(dashIndex + 1)),
		);
	}

	toString() {
		return `${this.start}-${this.end}`;
	}
}

/** @type {Map<string, HTMLImageElement>} */
const iconCache = new Map();

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
export class VTable {
	/** @type {HTMLTableSectionElement} */
	tBody;

	/** @type {HTMLTableRowElement} */
	tBodyRowTemplate;

	/** @type {number} */
	rowHeight;

	/** @type {DataSource<TItem>} */
	dataSource;

	/** @type {number} */
	activeIndex = 0;

	/**
	 * Constructor.
	 *
	 * @param {HTMLTableElement | null} element
	 * @param {DataSource<TItem>} dataSource
	 */
	constructor(element, dataSource = EmptyDataSource.INSTANCE) {
		const table = element ?? error('virtual table element not found');

		this.dataSource = dataSource;
		this.tBody = table.tBodies[0];
		this.tBodyRowTemplate = this.tBody.querySelector('tr.tbody-row') ?? error('body row template for virtual table not found');
		this.rowHeight = this.tBodyRowTemplate.offsetHeight;

		this.tBody.tabIndex = this.tBodyRowTemplate.tabIndex;
		this.tBody.removeChild(this.tBodyRowTemplate);

		this.populate();

		this.tBody.onscroll = () => {
			this.populate();
		};

		this.tBody.addEventListener('focusin', (evt) => {
			const target = evt.target;
			if (target instanceof HTMLTableRowElement && target.parentElement === this.tBody) {
				this.activeIndex = this.getRowIndex(target);
			}
		});

		this.tBody.addEventListener('dblclick', (evt) => {
			const target = evt.target;
			if (target instanceof HTMLElement && this.tBody.contains(target.parentElement)) {
				return this.onDoubleClick(evt);
			}
		});

		addEventListener('resize', () => {
			this.populate();
		});

		table.addEventListener('keydown', (evt) => {
			switch (getKey(evt)) {
				case Code.UpArrow:
					evt.preventDefault();
					this.focusRowByIndex(this.activeIndex - 1);
					return;
				case Code.DownArrow:
					evt.preventDefault();
					this.focusRowByIndex(this.activeIndex + 1);
					return;
				case Code.PageUp:
					evt.preventDefault();
					this.focusRowByIndex(this.activeIndex - this.calculateRowsPerPage() + 1);
					return;
				case Code.PageDown:
					evt.preventDefault();
					this.focusRowByIndex(this.activeIndex + this.calculateRowsPerPage() - 1);
					return;
				case Code.Home:
					evt.preventDefault();
					this.focusRowByIndex(0);
					return;
				case Code.End:
					evt.preventDefault();
					this.focusRowByIndex(async () => await this.dataSource.getLength() - 1);
					return;
				default:
					this.onKeyDown(evt);
			}
		});
	}

	/**
	 * @param {KeyboardEvent} evt
	 */
	onKeyDown(evt) {
		console.log('keyCode', evt.keyCode);
	}

	/**
	 * @param {MouseEvent} evt
	 */
	onDoubleClick(evt) {
		console.log('doubleClick');
	}

	/**
	 * @param {DataSource<any>} dataSource
	 * @returns {Promise<Range | undefined>}
	 */
	async setDataSource(dataSource) {
		this.tBody.dataset.range = '';
		const focused = document.activeElement === this.tBody || document.activeElement?.parentElement === this.tBody;
		this.tBody.replaceChildren.apply(this.tBody, []);
		if (focused) {
			this.tBody.focus({ preventScroll: true });
		}
		this.dataSource = dataSource;
		this.activeIndex = 0;
		return await this.populate();
	}

	/**
	 * @returns {Promise<Range>}
	 */
	async populate() {
		const dataSource = this.dataSource;
		const length = await dataSource.getLength();
		if (dataSource !== this.dataSource) {
			return Range.EMPTY;
		}
		const { scrollTop, offsetHeight } = this.tBody;
		const newTBody = document.createElement('tbody');
		const start = Math.floor(scrollTop / this.rowHeight);
		const end = Math.min(length, Math.ceil((scrollTop + offsetHeight) / this.rowHeight));
		const range = new Range(start, end);
		if (this.tBody.dataset.range === range.toString()) {
			return range;
		}
		this.tBody.dataset.range = range.toString();

		/** @type {Record<string, (item: any, slot: HTMLElement) => string>} */
		const fns = {
			icon: (item, slot) => {
				if (!(this.dataSource instanceof RemoteDataSource) || !this.dataSource.config) {
					return item.isDirectory ? 'folder.svg' : 'file.svg';
				}
				const iconUrl = `${this.dataSource.baseUri()}/icons/${item.icon}`;
				if (item.iconAlt) {
					const cachedIcon = iconCache.get(iconUrl);
					if (cachedIcon) {
						slot.parentNode?.replaceChild(cachedIcon.cloneNode(), slot);
						return iconUrl;
					}
					const altIconUrl = `${this.dataSource.baseUri()}/icons/${item.iconAlt}`;
					const image = slot.cloneNode();
					if (image instanceof HTMLImageElement) {
						image.src = iconUrl;
						image.onload = function () {
							slot.parentNode?.replaceChild(image, slot);
							iconCache.set(iconUrl, image);
							if (iconCache.size > 5_000) {
								for (const [key, _value] of iconCache) {
									iconCache.delete(key);
									break;
								}
							}
						};
					}
					return altIconUrl;
				}
				return iconUrl;
			},
			size: (item) => {
				if (item.isDirectory) {
					return '';
				}
				if (typeof item.size !== 'bigint' && isNaN(item.size)) {
					return '???';
				}
				let number = Number(item.size);
				if (number < 0) {
					return '???';
				}
				const units = 'KMGTPEZY';
				const unitSize = 1024;
				let unitIndex = -1;
				while (number >= unitSize && unitIndex < units.length) {
					number /= unitSize;
					unitIndex++;
				}
				return unitIndex >= 0
					? `${number.toFixed(2)} ${units[unitIndex]}iB`
					: `${number.toString()} B`;
			},
			date: (item) => {
				const date = new Date(item.date);
				if (isNaN(date.getTime())) {
					return '-';
				}
				return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
			},
			match: (item) => {
				const text = item.name;
				if (!item.matchedKey.length) {
					return htmlEncode(text);
				}
				let bold = true;
				const words = text.split(/\s+/g);
				const result = [];
				for (let i = 0; i < words.length; ++i) {
					const word = words[i];
					const matchedWord = item.matchedKey[i];
					if (matchedWord && matchedWord.length) {
						result.push(`<b>${htmlEncode(word.substr(0, matchedWord.length))}</b>${htmlEncode(word.substr(matchedWord.length))}`);
					} else {
						result.push(htmlEncode(word));
					}
					bold = !bold;
				}
				return result.join(' ');
			},
		};

		for (let i = range.start; i < range.end; ++i) {
			const tBodyRow = /** @type HTMLTableRowElement */ (this.tBodyRowTemplate.cloneNode(true));
			const item = /** @type any */ (await dataSource.getItem(i));
			if (item === undefined || dataSource !== this.dataSource) {
				return Range.EMPTY;
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-text]')) {
				if (slot instanceof HTMLElement && slot.dataset.text) {
					const text = item[slot.dataset.text];
					slot.textContent = text;
					slot.title = text;
				}
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-html]')) {
				if (slot instanceof HTMLElement && slot.dataset.html) {
					slot.innerHTML = item[slot.dataset.html];
				}
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-src]')) {
				if (slot instanceof HTMLImageElement && slot.dataset.src) {
					slot.src = item[slot.dataset.src];
				}
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-text-fn]')) {
				if (slot instanceof HTMLElement && slot.dataset.textFn) {
					slot.textContent = fns[slot.dataset.textFn](item, slot);
				}
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-html-fn]')) {
				if (slot instanceof HTMLElement && slot.dataset.htmlFn) {
					slot.innerHTML = fns[slot.dataset.htmlFn](item, slot);
				}
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-src-fn]')) {
				if (slot instanceof HTMLImageElement && slot.dataset.srcFn) {
					slot.src = fns[slot.dataset.srcFn](item, slot);
				}
			}
			newTBody.appendChild(tBodyRow);
		}
		if (newTBody.rows.length) {
			/** @type {HTMLElement} */(newTBody.firstElementChild).style.marginTop = cssMultiplyHeight(range.start, this.rowHeight);
			/** @type {HTMLElement} */(newTBody.lastElementChild).style.marginBottom = cssMultiplyHeight(length - range.end, this.rowHeight);
		}
		const focused = document.activeElement === this.tBody || document.activeElement?.parentElement === this.tBody;
		this.tBody.replaceChildren.apply(this.tBody, /** @type {any} */ (newTBody.children));
		this.tBody.scrollTop = scrollTop;
		if (focused) {
			if (this.activeIndex >= range.start && this.activeIndex < range.end) {
				this.tBody.rows[this.activeIndex - start].focus({ preventScroll: true });
			} else {
				this.tBody.focus({ preventScroll: true });
			}
		}
		return range;
	}

	async focus() {
		this.tBody.focus();
		return new Promise((resolve) => setTimeout(async () => {
			await this.focusRowByIndex(this.activeIndex);
			resolve(this);
		}, 0));
	}

	/**
	 * @param {HTMLTableRowElement} row
	 * @returns {boolean}
	 */
	focusRow(row) {
		if (!row) {
			return false;
		}
		if (this.tBody.scrollTop > row.offsetTop - 1) {
			this.tBody.scrollTop = row.offsetTop - 1;
		} else if (this.tBody.scrollTop < row.offsetTop + row.offsetHeight - this.tBody.offsetHeight + 1) {
			this.tBody.scrollTop = row.offsetTop + row.offsetHeight - this.tBody.offsetHeight + 1;
		}
		const focused = document.activeElement === this.tBody || document.activeElement?.parentElement === this.tBody;
		if (focused) {
			row.focus({ preventScroll: true });
		}
		this.activeIndex = this.getRowIndex(row);
		return true;
	}

	/**
	 * @param {number | (() => number | Promise<number>)} index
	 * @returns {Promise<boolean>}
	 */
	async focusRowByIndex(index) {
		if (typeof index === 'function') {
			index = await Promise.resolve(index());
		}
		const length = await this.dataSource.getLength();
		if (index < 0) {
			index = 0;
		}
		if (index >= length) {
			index = length - 1;
		}
		let range = Range.parse(this.tBody.dataset.range);
		if (index < range.start) {
			this.tBody.scrollTop = index * this.tBody.rows[0].offsetHeight;
			range = await this.populate();
		} else if (index >= range.end) {
			this.tBody.scrollTop = (index + 1) * this.tBody.rows[0].offsetHeight - this.tBody.offsetHeight;
			range = await this.populate();
		}
		const row = this.tBody.rows[index - range.start];
		return this.focusRow(row);
	}

	/**
	 * @returns {number}
	 */
	calculateRowsPerPage() {
		return (0 | this.tBody.offsetHeight / this.tBody.rows[0].offsetHeight);
	}

	/**
	 * @param {HTMLTableRowElement} element
	 * @returns {number}
	 */
	getRowIndex(element) {
		return Range.parse(this.tBody.dataset.range).start + element.rowIndex - this.tBody.rows[0].rowIndex;
	}
}
