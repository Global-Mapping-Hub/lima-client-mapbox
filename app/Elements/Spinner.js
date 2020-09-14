class Spinner {
	constructor() {
		this.spinner = document.getElementById('spinner_wrapper');
	}
	hide() {
		this.spinner.style.display = 'none';
	}
	show() {
		this.spinner.style.display = 'block';
	}
}

export default Spinner;