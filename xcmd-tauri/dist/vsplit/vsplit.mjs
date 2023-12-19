import { appendStyleSheet } from '../stylesheet.mjs';

appendStyleSheet('./vsplit.css', import.meta.url);

/**
 * @param {string} message
 * @returns {never}
 */
function error(message) {
	throw new Error(message);
}

export class VSplit {
	/** @type {HTMLElement} */
	splitterHandle;

	/**
	 * Constructor.
	 *
	 * @param {HTMLElement} element
	 */
	constructor(element) {
		const splitter = element;
		this.splitterHandle = splitter.querySelector('.vsplit-handle') ?? error('handle for splitter not found');
		let splitterMoving = false;
		/** @type {HTMLElement | null} */
		let splitterHandlePreview;
		/** @type {number} */
		let splitterPercentage;

		/**
		 * @param {MouseEvent} event
		 * @param {HTMLElement | null | undefined} handle
		 * @param {HTMLElement | null | undefined} parentElement
		 * @returns {void}
		 */
		function updateHandlePreview(event, handle, parentElement) {
			if (handle && parentElement) {
				const rect = parentElement.getBoundingClientRect();
				splitterPercentage = Math.max(10, Math.min(90, (event.pageX + 1 - rect.left) / rect.width * 100));
				handle.style.left = `calc(${splitterPercentage.toFixed(2)}% - 1px)`;
			}
		}

		/**
		 * @param {MouseEvent} event
		 * @returns {void}
		 */
		function move(event) {
			event.preventDefault();
			updateHandlePreview(event, splitterHandlePreview, splitterHandlePreview?.parentElement);
		}

		/**
		 * @param {MouseEvent} event
		 * @param {HTMLElement} handle
		 * @returns {void}
		 */
		function startMoving(event, handle) {
			if (splitterMoving) {
				return;
			}
			splitterMoving = true
			splitterPercentage = 50;
			splitterHandlePreview = /** @type {HTMLElement} */ (handle.cloneNode(true));
			splitterHandlePreview.className = 'vsplit-handle-preview';
			updateHandlePreview(event, splitterHandlePreview, handle.parentElement);
			handle.parentElement?.appendChild(splitterHandlePreview);
			document.body.classList.add('vsplit-moving');
			document.addEventListener('mousemove', move, true);
			document.addEventListener('mouseup', stopMoving, true);
		}

		/**
		 * @returns {void}
		 */
		function stopMoving() {
			document.body.classList.remove('vsplit-moving');
			document.removeEventListener('mousemove', move, true);
			document.removeEventListener('mouseup', stopMoving, true);
			const splitter = splitterHandlePreview?.parentElement;
			console.log('stop');

			splitterMoving = false;
			splitterHandlePreview?.remove();
			splitterHandlePreview = null;

			split(splitter, splitterPercentage);
		}

		/**
		 * @param {HTMLElement | null | undefined} splitter
		 * @param {number} percentage
		 * @returns {void}
		 */
		function split(splitter, percentage = 50) {
			if (splitter?.firstElementChild instanceof HTMLElement) {
				splitter.firstElementChild.style.flex = percentage.toFixed(2);
			}
			if (splitter?.lastElementChild instanceof HTMLElement) {
				splitter.lastElementChild.style.flex = (100 - percentage).toFixed(2);
			}
		}

		this.splitterHandle.addEventListener('mousedown', (event) => {
			if (event.target === this.splitterHandle) {
				startMoving(event, this.splitterHandle);
			}
		});

		this.splitterHandle.addEventListener('dblclick', () => {
			split(this.splitterHandle.parentElement);
		});
	}
}
