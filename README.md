# lima-client-mapbox
Very early alpha build, still need to get rid of the copy-pasted jquery bits. Compatible with the older Leaflet version.

Platform for crowdmapping/crowdsourcing projects using mapbox-gl-js.

## Installation
```shell
git clone https://github.com/Global-Mapping-Hub/lima-client-mapbox.git
cd lima-client-mapbox
npm install
```

## Build
```shell
npm run build
```

## Configuration File
You can change most of the stuff in **src/config.js**

## Features so far:
- Users' mouse pointers can be seen (though they are upside-down right now)
- Vector tiles will be updated on polygon creation and on socket events from other users.