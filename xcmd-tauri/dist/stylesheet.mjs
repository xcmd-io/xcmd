/**
 * @param {string} value
 * @returns {string}
 */
function createId(value) {
	return 'link_' + encodeURIComponent(value).replace(/\W/g, '_');
}

/**
 * @param {string} url
 * @param {string} base
 * @returns {Promise<HTMLElement>}
 */
export async function appendStyleSheet(url, base) {
	const id = createId(url);
	const existingLink = document.getElementById(id);
	if (existingLink !== null) {
		return Promise.resolve(existingLink);
	}

	return new Promise((resolve, reject) => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = new URL(url, base).toString();
		link.onload = () => resolve(link);
		link.onerror = (_event, _source, _lineno, _colno, error) => reject(error);
		document.getElementsByTagName('head')[0].appendChild(link);
	});
}
