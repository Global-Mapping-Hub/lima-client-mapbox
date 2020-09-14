import {strToDateUTC} from './Functions';

/* ================= */
/* custom wms layers */
/* ================= */
export class SentinelHubLayer {
	constructor(wms_layer, pane, usr_layers) {
		var startDate = strToDateUTC($('#date_main').val());
		this.date = moment(startDate).format('YYYY-MM-DD');

		this.layer = L.tileLayer.wms(wms_layer, {
			layers: (usr_layers) ? usr_layers : 'TRUE-COLOR',
			TIME: `${this.date}/${this.date}`,
			WARNINGS: 'YES', // in-image warnings, like "No data available for the specified area"
			MAXCC: 50, // the maximum allowable cloud coverage in percent
			format: 'image/png',
			attribution: '&copy; <a href="https://sentinel-hub.com/">Sentinel-Hub</a> &copy; <a href="https://www.copernicus.eu/en">Copernicus</a>',
			pane: pane
		});
	}
	getLayer() {
		return this.layer;
	}
	setDate(newDate) {
		this.date = moment(newDate).format('YYYY-MM-DD');
		this.layer.setParams({TIME: `${this.date}/${this.date}`}, false);
	}
	setLayers(newLayer) {
		this.layer.setParams({layers: newLayer}, false);
	}
}
