class GlobalError {
	constructor() {
		this.block = document.getElementById('global_error');
	}
	setData(text) {
		this.block.innerText = text;
	}
	hide() {
		this.block.style.display = 'none';
	}
	show() {
		this.block.style.display = 'block';
	}
}

export default GlobalError;