import io from 'socket.io-client';
import axios from 'axios';
import moment from 'moment';
import md5 from 'md5';
import {area as turfarea} from '@turf/area';
import {polygon as turfpolygon} from 'turf-polygon';

import mapboxgl from 'mapbox-gl';
import MapboxDraw from "@mapbox/mapbox-gl-draw";

import {apiUrl, vtilesUrl, vtilesLayer} from '../config';
import {tooltipGen} from '../Utilities/Templates';
import MapboxGLButtonControl from '../Utilities/MapboxButtons';

import Spinner from './Spinner';
import GlobalError from './GlobalError';

// drawn items styling
const approvedFill = '#4caf50';
const normalFill = '#3388ff';

// socket.io init
const socket = io({path: (apiUrl) ? `${apiUrl}/socket.io` : ''});
const mouseSocket = io('/micemove', {path: (apiUrl) ? `${apiUrl}/socket.io` : ''});

// all the sockets logic is here + drawing mode
export default class liveMonitoringMap {
	constructor(userDetails) {
		// elements
		this.spinner = new Spinner();

		// user info setup
		this.userDetails = userDetails;
		this.current_user = this.userDetails.username;
		this.userRights = this.userDetails.editor;
		this.userAddition = md5(new Date().getTime()).substring(28); // last 4 digits

		// live features
		//this.user_pointers = L.featureGroup().addTo(this.map);
		this.lat = 0;
		this.lng = 0;
		this.oldlat = 0;
		this.oldlng = 0;
		this.drawingEnabled = false;

		// init mapbox map
		this.map = new mapboxgl.Map({
			container: 'map', // container id
			style: './public/mapstyle.json', //hosted style id
			hash: true,
			center: [51.73, 47.20],
			zoom: 3,
			maxZoom: 22
		});

		// add default controls
		this.map.addControl(new mapboxgl.NavigationControl(), 'top-left');
		this.map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

		// mapbox-gl-draw controls
		this.drawControl = new MapboxDraw({
			displayControlsDefault: false,
			controls: {
				polygon: true,
				trash: true
			}
		});
		this.map.addControl(this.drawControl, 'top-left');

		// do on map load
		this.map.on('load', () => {
			// network
			this.initMouseSync();
			this.initSocketEvents();

			// drawing controls
			this.initDrawControls();

			// custom buttons
			this.initMapButtons();

			// vector layer
			this.initVectorData();
		});

		this.spinner.hide();
	}


	/*===============*/
	/* custom map buttons */
	/*===============*/
	initMapButtons = () => {
		// map buttons
		this.testBtn = new MapboxGLButtonControl('test', 'testLabel', () => {
			
		});
		this.map.addControl(this.testBtn, "top-left");
	}


	/*===============*/
	/* drawing logic */
	/*===============*/
	initDrawControls = () => {
		//this.map.on('draw.create', this.saveGeometry);
		//this.map.on('draw.delete', this.saveGeometry);
		//this.map.on('draw.update', this.saveGeometry);

		this.map.on('draw.selectionchange', (e) => {
			// if there are no features, then it's a 'deselect'
			if (e.features.length === 0) {
				// save and remove all features on deselect
				let drawnData = this.drawControl.getAll();
				for (let i = 0; i < drawnData.features.length; i++) {
					let feature = drawnData.features[i];
					let geom = feature.geometry;

					// check if geometry is not null
					if (geom.coordinates[0][0] !== null) {
						// calculate polygon's area and assign an id
						let area = turfarea(turfpolygon(geom.coordinates))/10000; // sq.m to ha
						let geoid = feature.id;

						// TODO: change to live date
						let date = moment('13-Sep-2020').format('YYYY-MM-DD');

						// TODO: remove (left for backward compatibility)
						// set feature props
						feature.properties.geoid = geoid;

						// save to the DB
						this.saveGeometry2DB(geoid, area, geom, '', date, () => {
							socket.emit('user_created_geometry', this.current_user, feature);
						});

						// remove this geometry from the screen
						this.drawControl.delete(geoid);
					}
				}
				// update vector layer quickly
				this.updateVectorData('burnscars_source');
			}
		})
	}

	


	/*===============================================*/
	/* block with all the networking bits and pieces */
	/*===============================================*/
	// read current user's mouse position
	initMouseSync = () => {
		this.map.on('mousemove', (e) => {
			this.lat = e.lngLat.lat;
			this.lng = e.lngLat.lng;
		});
		setInterval(() => {
			if (this.oldlat != this.lat && this.oldlng != this.lng) {
				// add a small id, so we can distinguish between same users :)
				mouseSocket.emit('user_mouse_update', this.current_user, this.userAddition, this.lat, this.lng);
			}
			this.oldlat = this.lat;
			this.oldlng = this.lng;
		}, 500);
	}

	// network logic: mouse pointers, geometry changes, etc
	initSocketEvents = () => {
		// store mouse pointers here
		this.mousePointers = { 'type': 'FeatureCollection', 'features': [] };

		// add mouse pointers as a layer
		this.map.loadImage('./lib/images/mouse.png', (error, image) => {
			if (error) throw error;
			this.map.addImage('mouse_pointer', image);
			this.map.addLayer({
				"id": "pointers",
				"type": "symbol",
				"source": {
					"type": "geojson",
					"data": this.mousePointers
				},
				"layout": {
					"icon-image": "mouse_pointer",
					"icon-allow-overlap": true,
					"icon-keep-upright": true,
					"icon-size": 0.009,
				},
				"paint": {
					"icon-opacity": 0.85
				}
			});
		});
		
		// on mouse movement event
		mouseSocket.on('user_mouse_update', (socket_user, socket_user_addition, lat, lng) => {
			// if emitted user is not current user or if username is the same but the special md5 addition is different (other tab or browser window)
			if ((this.current_user !== socket_user) || (this.current_user === socket_user && this.userAddition !== socket_user_addition)) {
				// add a new user to the feature layer
				// TODO: rewrite
				const tooltipText = `${socket_user}`; // (${socket_user_addition})`;
				const userID = `${socket_user}_${socket_user_addition}`;

				// update coordinates if user exists
				this.userCoordinatesHandler(userID, lng, lat);
			}
		});

		// show other users' geometry
		socket.on('user_created_geometry', (socket_user, geojson) => {
			//var geoid = geojson.properties.geoid;
			//console.log(geoid);
			//this.addGeometryLayer(geojson, socket_user);
			this.updateVectorDataExternally('burnscars_source');
		});

		// remove geometry removed by other users
		socket.on('user_removed_geometry', (socket_user, geoid) => {
			//this.removeFeatureVisibly(geoid);
			this.updateVectorDataExternally('burnscars_source');
		});

		// change styling of the feature approved by an admin
		socket.on('admin_changed_approval', (socket_user, geoid, approved) => {
			//this.changeApprovalStyling(geoid, approved);
		});

		// change styling of the fishnet cell changed by an admin
		socket.on('admin_changed_fishnet', (socket_user, geoid, approved) => {
			if (this.current_user !== socket_user) {
				//this.changeFishnetStyling(geoid, approved);
			}
		});


		// on timeout, when server restart, show an error message
		this.globalError = new GlobalError();
		socket.on('connect_error', (error) => { //connect_timeout
			console.log('connect_error ', error);
			this.globalError.setData('Losing connection, please reload the page');
			this.globalError.show();
		});

		socket.on('reconnect', (attemptNumber) => {
			this.globalError.hide();
		});
	}

	// show and update user mouse pointers on the screen
	userCoordinatesHandler = (userID, lng, lat) => {
		// go over features
		let found = false;
		let features = this.mousePointers.features;
		for (const f in features) {
			let marker = features[f];
			// if one is already present
			if (marker.properties.userID == userID) {
				marker.geometry.coordinates = [lng, lat];
				found = true;
			}
		}
		// if no feature like this was found
		if (!found) {
			features.push({
				'type': 'Feature',
				'properties': {'userID':userID},
				'geometry': {'type':'Point', 'coordinates':[lng, lat]}
			})
		}

		// and then update the source
		this.map.getSource('pointers').setData(this.mousePointers);
	}


	/*=======================================================*/
	/* load all geojson features from the vector tile server */
	/*=======================================================*/
	initVectorData = () => {
		this.pbfSource = vtilesUrl;

		// add vector source and corresponding layer
		this.map.addSource('burnscars_source', {
			'type': 'vector',
			'tiles': [this.pbfSource]
		});
		this.map.addLayer({
			'id': 'burnscars',
			'type': 'fill',
			'source': 'burnscars_source',
			'source-layer': vtilesLayer,
			'paint': {
				"fill-color": [
					'case',
					['==', ['get', 'approved'], true],
					approvedFill,
					normalFill,
				],
				"fill-opacity": 0.4
			}
		});

		// on polygons click
		this.map.on('click', 'burnscars', (e) => {
			let props = e.features[0].properties;
			this.getPolygonInfo(props.geoid, (data) => {
				let popup = new mapboxgl.Popup();
					popup.setLngLat(e.lngLat)
					popup.setHTML(tooltipGen(data, this.current_user, this.userRights))
					popup.addTo(this.map);
			});
		});
	}

	// update vector tiles quickly, but with a "blink"
	// source: https://github.com/mapbox/mapbox-gl-js/issues/2941#issuecomment-518631078
	updateVectorData = (sourceID) => {
		this.map.getSource(sourceID).tiles = [`${this.pbfSource}?v=${Date.now()}`];
		this.map.style.sourceCaches[sourceID].clearTiles();
		this.map.style.sourceCaches[sourceID].update(this.map.transform);
		this.map.triggerRepaint();
	}

	// update tiles slowly, when other users do something on the map
	// source: https://github.com/mapbox/mapbox-gl-js/issues/2633#issuecomment-576050636
	updateVectorDataExternally = (sourceID) => {
		console.log('updating vector tiles externally');
		const sourceCache = this.map.style.sourceCaches[sourceID];
		for (const id in sourceCache._tiles) {
			//sourceCache._tiles[id].expirationTime = Date.now() - 1;
			sourceCache._tiles[id].expirationTime = 1;
			sourceCache._tiles[id].expiredRequestCount = 0;
			sourceCache._reloadTile(id, 'reloading');
		}
		sourceCache._cache.reset();
		this.map.triggerRepaint();
	}


	//==============//
	// API requests //
	//==============//
	// save geometry and properties to the db
	saveGeometry2DB = (geoid, area, geometry, comments, date, callback) => {
		axios.post(`${apiUrl}/save`, {
			geoid: geoid,
			area: area,
			geom: JSON.stringify(geometry),
			comments: comments,
			date: date,
		}).then((out) => {
			if (out.data.success) callback()
		})
	}

	// load polygons' info from the db
	getPolygonInfo = (geoid, callback) => {
		axios.get(`${apiUrl}/polyinfo/${geoid}`).then((out) => {
			callback(out.data);
		})
	}
}