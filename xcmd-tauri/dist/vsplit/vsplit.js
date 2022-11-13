class VSplit {
	constructor(element) {
		const splitter = element;
		const splitterHandle = splitter.querySelector('.vsplit-handle');
		let splitterMoving = false;
		let splitterHandlePreview;
		let splitterPercentage;

		function updateHandlePreview(event, handle, parentElement) {
			const rect = parentElement.getBoundingClientRect();
			splitterPercentage = Math.max(10, Math.min(90, (event.pageX + 1 - rect.left) / rect.width * 100));
			handle.style.left = `calc(${splitterPercentage.toFixed(2)}% - 1px)`;
		}

		function move(event) {
			event.preventDefault();
			updateHandlePreview(event, splitterHandlePreview, splitterHandlePreview.parentElement);
		}

		function startMoving(event, handle) {
			if (splitterMoving) {
				return;
			}
			console.log('start');
			splitterMoving = true
			splitterPercentage = 50;
			splitterHandlePreview = handle.cloneNode(true);
			splitterHandlePreview.className = 'vsplit-handle-preview';
			updateHandlePreview(event, splitterHandlePreview, handle.parentElement);
			handle.parentElement.appendChild(splitterHandlePreview);
			document.body.classList.add('vsplit-moving');
			document.addEventListener('mousemove', move, true);
			document.addEventListener('mouseup', stopMoving, true);
		}

		function stopMoving() {
			document.body.classList.remove('vsplit-moving');
			document.removeEventListener('mousemove', move, true);
			document.removeEventListener('mouseup', stopMoving, true);
			const splitter = splitterHandlePreview.parentElement;
			console.log('stop');

			splitterMoving = false;
			splitterHandlePreview.remove();
			splitterHandlePreview = null;

			splitter.firstElementChild.style.flex = splitterPercentage.toFixed(2);
			splitter.lastElementChild.style.flex = (100 - splitterPercentage).toFixed(2);
		}

		splitterHandle.addEventListener('mousedown', function(event) {
			if (event.target.classList.contains('vsplit-handle')) {
				startMoving(event, event.target);
			}
		});

		splitterHandle.addEventListener('dblclick', function(event) {
			console.log('double click');
			const handle = event.target;
			const splitter = handle.parentElement;
			splitter.firstElementChild.style.flex = '1';
			splitter.lastElementChild.style.flex = '1';
		});
	}
}
