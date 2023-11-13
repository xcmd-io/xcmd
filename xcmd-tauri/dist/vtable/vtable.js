class GeneratedDataSource {
	async getLength() {
		return 400_000;
	}

	async getItem(index) {
		return {
			name: `index${index}`,
		};
	}
}

class EmptyDataSource {
	static INSTANCE = new EmptyDataSource();

	async getLength() {
		return 0;
	}

	async getItem(_index) {
		return null;
	}
}

class ArrayDataSource {
	array;

	constructor(array) {
		this.array = Array.isArray(array) ? array : [];
	}

	async getLength() {
		return this.array.length;
	}

	async getItem(index) {
		return this.array[index];
	}
}

function compareString(a, b) {
	if ((a === null || a === undefined) && (b === null || b === undefined)) {
		return 0;
	}
	if (a === null || a === undefined) {
		return -1;
	}
	if (b === null || b === undefined) {
		return 1;
	}
	return a.localeCompare(b);
}

class RemoteDataSource {
	config;
	response;

	constructor(config, request) {
		this.config = config;
		this.response = this.listFiles(request);
	}

	baseUri() {
		const { port } = this.config;
		// TODO: use TLS when tauri adds support to trust self-signed certificates
		return 'http://localhost:' + port;
	}

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
		const result = await response.json();
		result.list.files.sort((a, b) => (b.isDirectory - a.isDirectory)
			|| compareString(a.name, b.name)
			|| compareString(a.extension, b.extension)
			|| compareString(a.key, b.key));
		return result;
	}

	async getPath() {
		return (await this.response).list.path;
	}

	async getName() {
		return (await this.response).list.name;
	}

	async getLength() {
		return (await this.response).list.files.length;
	}

	async getItem(index) {
		return (await this.response).list.files[index];
	}

	async getActiveIndex() {
		return (await this.response).list.files.findIndex(item => item.isActive);
	}
}

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
	start;
	end;

	constructor(start, end) {
		this.start = start;
		this.end = end;
	}

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

const iconCache = new Map();

class VTable {
	tBody;
	tBodyRowTemplate;
	rowHeight;
	dataSource;
	activeIndex = 0;

	constructor(element, dataSource = EmptyDataSource.INSTANCE) {
		const table = element;

		this.dataSource = dataSource;
		this.tBody = table.tBodies[0];
		this.tBodyRowTemplate = this.tBody.querySelector('tr.tbody-row');
		this.rowHeight = this.tBodyRowTemplate.offsetHeight;

		this.tBody.tabIndex = this.tBodyRowTemplate.tabIndex;
		this.tBody.removeChild(this.tBodyRowTemplate);

		this.populate();

		this.tBody.onscroll = () => {
			this.populate();
		};

		this.tBody.addEventListener('focusin', (evt) => {
			const target = evt.target;
			if (target.parentElement === this.tBody) {
				this.activeIndex = this.getRowIndex(target);
			}
		});

		this.tBody.addEventListener('dblclick', (evt) => {
			const target = evt.target;
			if (this.tBody.contains(target.parentElement)) {
				return this.onDoubleClick(evt);
			}
		});

		addEventListener('resize', () => {
			this.populate();
		});

		table.onkeydown = (evt) => {
			switch (evt.keyCode) {
				// up
				case 38:
					this.focusRowByIndex(this.activeIndex - 1);
					return false;
				// down
				case 40:
					this.focusRowByIndex(this.activeIndex + 1);
					return false;
				// page up
				case 33:
					this.focusRowByIndex(this.activeIndex - this.calculateRowsPerPage() + 1);
					return false;
				// page down
				case 34:
					this.focusRowByIndex(this.activeIndex + this.calculateRowsPerPage() - 1);
					return false;
				// home
				case 36:
					this.focusRowByIndex(0);
					return false;
				// end
				case 35:
					this.focusRowByIndex(async () => await this.dataSource.getLength() - 1);
					return false;
				default:
					this.onKeyDown(evt);
			}
		};
	}

	onKeyDown(evt) {
		console.log('keyCode', evt.keyCode);
	}

	onDoubleClick(evt) {
		console.log('doubleClick');
	}

	async setDataSource(dataSource) {
		this.tBody.dataset.range = '';
		const focused = document.activeElement === this.tBody || document.activeElement.parentElement === this.tBody;
		this.tBody.replaceChildren.apply(this.tBody, []);
		if (focused) {
			this.tBody.focus({ preventScroll: true });
		}
		this.dataSource = dataSource;
		this.activeIndex = 0;
		return await this.populate();
	}

	async populate() {
		const dataSource = this.dataSource;
		const length = await dataSource.getLength();
		if (dataSource !== this.dataSource) {
			return;
		}
		const { scrollTop, offsetHeight } = this.tBody;
		const newTBody = document.createElement('tbody');
		const start = Math.floor(scrollTop / this.rowHeight);
		const end = Math.min(length, Math.ceil((scrollTop + offsetHeight) / this.rowHeight));
		const range = new Range(start, end);
		if (this.tBody.dataset.range === range.toString()) {
			return;
		}
		this.tBody.dataset.range = range.toString();

		const fns = {
			icon: (item, slot) => {
				if (!this.dataSource.config) {
					return item.isDirectory ? 'folder.svg' : 'file.svg';
				}
				const iconUrl = `${this.dataSource.baseUri()}/icons/${item.icon}`;
				if (item.iconAlt) {
					const cachedIcon = iconCache.get(iconUrl);
					if (cachedIcon) {
						slot.parentNode.replaceChild(cachedIcon.cloneNode(), slot);
						return iconUrl;
					}
					const altIconUrl = `${this.dataSource.baseUri()}/icons/${item.iconAlt}`;
					const image = slot.cloneNode();
					image.src = iconUrl;
					image.onload = function () {
						slot.parentNode.replaceChild(image, slot);
						iconCache.set(iconUrl, image);
						if (iconCache.size > 5_000) {
							for (const [key, _value] of iconCache) {
								iconCache.delete(key);
								break;
							}
						}
					};
					return altIconUrl;
				}
				return iconUrl;
			},
			date: (item) => {
				const date = new Date(item.date);
				if (isNaN(date)) {
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
			const tBodyRow = this.tBodyRowTemplate.cloneNode(true);
			const item = await dataSource.getItem(i);
			if (dataSource !== this.dataSource) {
				return;
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-text]')) {
				const text = item[slot.dataset.text];
				slot.textContent = text;
				slot.title = text;
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-html]')) {
				slot.innerHTML = item[slot.dataset.html];
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-src]')) {
				slot.src = item[slot.dataset.src];
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-text-fn]')) {
				slot.textContent = fns[slot.dataset.textFn](item, slot);
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-html-fn]')) {
				slot.innerHTML = fns[slot.dataset.htmlFn](item, slot);
			}
			for (const slot of tBodyRow.querySelectorAll('*[data-src-fn]')) {
				slot.src = fns[slot.dataset.srcFn](item, slot);
			}
			newTBody.appendChild(tBodyRow);
		}
		if (newTBody.rows.length) {
			newTBody.firstElementChild.style.marginTop = cssMultiplyHeight(range.start, this.rowHeight);
			newTBody.lastElementChild.style.marginBottom = cssMultiplyHeight(length - range.end, this.rowHeight);
		}
		const focused = document.activeElement === this.tBody || document.activeElement.parentElement === this.tBody;
		this.tBody.replaceChildren.apply(this.tBody, newTBody.children);
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

	focusRow(row) {
		if (!row) {
			return false;
		}
		if (this.tBody.scrollTop > row.offsetTop - 1) {
			this.tBody.scrollTop = row.offsetTop - 1;
		} else if (this.tBody.scrollTop < row.offsetTop + row.offsetHeight - this.tBody.offsetHeight + 1) {
			this.tBody.scrollTop = row.offsetTop + row.offsetHeight - this.tBody.offsetHeight + 1;
		}
		const focused = document.activeElement === this.tBody || document.activeElement.parentElement === this.tBody;
		if (focused) {
			row.focus({ preventScroll: true });
		}
		this.activeIndex = this.getRowIndex(row);
		return true;
	}

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

	calculateRowsPerPage() {
		return (0 | this.tBody.offsetHeight / this.tBody.rows[0].offsetHeight);
	}

	getRowIndex(element) {
		return Range.parse(this.tBody.dataset.range).start + element.rowIndex - this.tBody.rows[0].rowIndex;
	}
}
