var map;

function mapOnLoad() {
	if (document.location.pathname.indexOf("/map/")!=0) return;

	// Initialise map
	var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	});
	var gsm = L.tileLayer("https://osm.cycle.travel/greenspace/{z}/{x}/{y}.png", {
	    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors and Ordnance Survey'
	});
	map = L.map('map', { layers: [gsm] }).setView([51.72, -1.25], 10);
	L.control.layers({ "OpenStreetMap": osm, "Greenspace": gsm }).addTo(map);

	// Load data
	$.ajax({ url: "/data/map_index.geojson", dataType: "json", success: loadData });
}

var features = [];

function loadData(data,status,xhr) {
	features = data.features;
	for (var i=0; i<features.length; i++) {
		var feature = features[i];
		var ll = feature.geometry.coordinates.reverse();
		var html = feature.properties.name+"<br/><a href='"+feature.properties.url+"'>View in directory</a>";
		L.marker(ll).addTo(map).bindPopup(html);
	}
}
