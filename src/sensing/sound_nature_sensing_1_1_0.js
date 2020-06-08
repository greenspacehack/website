'use strict';

/*global window, document */
/*jslint bitwise: true */

var NatureSensing = (function(){
	
	var map;
    
    var marker;

    var app = {};

    var id = [0, 0, 0, 0];

    var key = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F];

    /* Function to retrieve key */

    const WAKE_URL = "https://audiomothencryptionkey.herokuapp.com/";

    const KEY_URL = "https://audiomothencryptionkey.herokuapp.com/key/";

    const BUTTON_ID = "chime_button";

    function wakeEncryptionServer() {

        var xhr = new XMLHttpRequest();
        
        xhr.open('GET', WAKE_URL, true);

        xhr.responseType = 'json';

        xhr.onload = function() {

            console.log("NATURE SENSING: Response from encryption server.");

        };

        xhr.send();

    }
    function getEncryptionKey(latLng, zoom, callback) {

        var xhr = new XMLHttpRequest();
        
        xhr.open('GET', KEY_URL + latLng.lat + "/" + latLng.lng + "/" + zoom + "/", true);

        xhr.responseType = 'json';

        xhr.onload = function() {
        
            var status = xhr.status;

            if (status === 200 && xhr.response.id && xhr.response.id.length === 4 && xhr.response.key && xhr.response.key.length === 16) {

                id = xhr.response.id;

                key = xhr.response.key;

                callback(true);

            } else {

                callback(false);
            
            }

        };

        xhr.send();

    };

    /* Function to enable and disable button */

    function enableButton() {

        document.getElementById(BUTTON_ID).disabled = false;

    }

    function disableButton() {

        document.getElementById(BUTTON_ID).disabled = true;

    }

    /* Function to encode little-endian value */

    function littleEndianBytes(byteCount, value) {

        var i, buffer = [];

        for (i = 0; i < byteCount; i += 1) {
            buffer.push((value >> (i * 8)) & 255);
        }

        return buffer;

    }

    /* Main code entry point */

    document.addEventListener("DOMContentLoaded", function () {

        /* Set up listener for the chime button */

        document.getElementById("chime_button").addEventListener("click", function () {

            var date, bytes, unixtime;

            /* Generate bit sequence */

            date = new Date();

            unixtime = Math.round(date.valueOf() / 1000);

            bytes = littleEndianBytes(4, unixtime);

            console.log("NATURE SENSING: Time : " + bytes);

            bytes = bytes.concat(id);

            bytes = bytes.concat(key);

            /* Display output */

            console.log("NATURE SENSING: ID : " + id);

            console.log("NATURE SENSING: KEY : " + key);

            disableButton();

            chime(bytes, ["c4:4", "d4:4", "e4:4", "c4:4", "c4:4", "d4:4", "e4:4", "c4:4", "e4:4", "f4:4", "g4:8", "e4:4", "f4:4", "g4:8"], function() {

                enableButton();

            });

        });

        /* Code entry point */

        disableButton();

        wakeEncryptionServer();

        /* Set up the map */

        function setUpMap(lat, lng) {

		    try {
            
                map = new L.Map('locationPicker');
        
            } catch(e) {

			    console.log(e);
        
            }

            var osm = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {minZoom: 1, maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'});		
        
            map.setView([lat, lng], 10);
        
            map.addLayer(osm);
        
		    if (!marker) {
        
                marker = new L.marker([lat, lng], {draggable:'true'});
        
            } else {

			    marker.setLatLng([lat, lng]);
        
            }
		
		    marker.on('dragend', function(e) {

                var zoom, latLng;
                
                zoom = map.getZoom();
                
                latLng = e.target.getLatLng();

                console.log("NATURE SENSING: Map marker moved to " + latLng + " at zoom level " + zoom);

                map.setView(e.target.getLatLng());
                
                getEncryptionKey(latLng, zoom, function(success) {
        
                    if (success === true) {

                        enableButton();
            
                        console.log("NATURE SENSING: Encryption key retrieved from server.");
            
                    } else {
            
                        console.log("NATURE SENSING: Problem retrieving encryption key from server.");
            
                    }
                
                });
        
            });
        
		    map.addLayer(marker);

	    }

        function geoSuccess(position) {

            console.log("NATURE SENSING: Setting map marker to user location.");
            
            setUpMap(position.coords.latitude, position.coords.longitude);
        
        };

        var geoError = function(error) {
        
            console.log("NATURE SENSING: Setting map marker to default location.");
        
            setUpMap(51.7519, -1.2581);
        
        };

        navigator.geolocation.getCurrentPosition(geoSuccess, geoError);

    });

})();