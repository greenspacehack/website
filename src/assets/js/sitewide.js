function doOnLoad() {
	// Call all functions including 'OnLoad' (e.g. mapOnLoad)
	// The function may want to inspect window.location.pathname to see if it's relevant
	for (var k in window) {
		if (k.indexOf("OnLoad")>-1 && k!="doOnLoad") { window[k](); }
	}
	// Initialise automap
	document.querySelectorAll("div.automap").forEach((div) => {
		var ll = div.getAttribute('data-ll').split(',');
		ll = [Number(ll[0]),Number(ll[1])];
		console.log(ll);
		var m = L.map(div).setView(ll, 13);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
		}).addTo(m);
		L.marker(ll).addTo(m);
	});
}

function enlargeImage(url) {
	document.getElementById('modal').innerHTML = "<img src='"+url+"' />";
	document.getElementById('modal').style.display='block';
}
function dismissModal() {
	document.getElementById('modal').style.display='none';
}
