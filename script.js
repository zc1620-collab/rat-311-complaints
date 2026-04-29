mapboxgl.accessToken = 'pk.eyJ1Ijoiem9lamNvc3RlbGxvIiwiYSI6ImNtbmkydjBiZDA5MGQycHBrNDc2cDBoY28ifQ.gPfZDNZopRE9ZILzYXo63A';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [-74.006, 40.7128],
    zoom: 10
});

const HIGHEST_DISTRICT_ID = 36;
const HIGHEST_DISTRICT_PROP = 'CounDist';

function enterMap() {
    const titleScreen = document.getElementById('title-screen');
    titleScreen.classList.add('fade-out');
    setTimeout(() => {
        titleScreen.style.display = 'none';
    }, 600);
}

map.on('load', () => {

    //adds council district polygons and rat complaint counts
    map.addSource('rat-complaints-per-cd', {
        type: 'geojson',
        data: './rat-complaints-per-cd.json'
    });

    //adds specific points of complaints within the council district with the highest number of complaints
    map.addSource('point-of-complaints', {
        type: 'geojson',
        data: './point-complaints-highest-CD.json'
    });

    //creates fill for council districts based on number of rat complaints filed to 311
    map.addLayer({
        id: 'council-districts-fill',
        type: 'fill',
        source: 'rat-complaints-per-cd',
        paint: {
            'fill-color': [
                'interpolate', ['linear'], ['get', 'NUMPOINTS'],
                1025, '#f1eef6',
                3500, '#d7b5d8',
                6000, '#df65b0',
                9000, '#d22475',
                11344, '#7b0337'
            ],
            'fill-opacity': 0.7
        }
    });

    //adds council district outlines
    map.addLayer({
        id: 'council-districts',
        type: 'line',
        source: 'rat-complaints-per-cd',
        paint: {
            'line-color': '#131622',
            'line-width': 1,
            'line-dasharray': [5, 1, 3, 1, 1],
            'line-opacity': 1
        }
    });

    // Points layer — hidden at start
    map.addLayer({
        id: 'point-of-complaints',
        type: 'circle',
        source: 'point-of-complaints',
        layout: {
            'visibility': 'none'    // <-- hidden on load
        },
        paint: {
            'circle-radius': 3,
            'circle-color': '#5319af',
            'circle-opacity': 0.8
        }
    });

    // ── Highlight the highest district on hover ──────────────────
    // Adds a subtle pulse so users know which one to click
    map.addLayer({
        id: 'highest-district-highlight',
        type: 'line',
        source: 'rat-complaints-per-cd',
        filter: ['==', ['get', HIGHEST_DISTRICT_PROP], HIGHEST_DISTRICT_ID],
        paint: {
            'line-color': '#ffffff',
            'line-width': 3,
            'line-opacity': 0.9
        }
    });

    // ── Click handler ────────────────────────────────────────────
    map.on('click', 'council-districts-fill', (e) => {
        const clicked = e.features[0].properties[HIGHEST_DISTRICT_PROP];

        if (clicked == HIGHEST_DISTRICT_ID) {
            // 1. Get the bounding box of the clicked district polygon
            const coordinates = e.features[0].geometry.coordinates;
            const bounds = coordinates.flat(Infinity)
                .reduce((b, coord, i) => {
                    if (i % 2 === 0) {  // lon
                        b[0][0] = Math.min(b[0][0], coord);
                        b[1][0] = Math.max(b[1][0], coord);
                    } else {             // lat
                        b[0][1] = Math.min(b[0][1], coord);
                        b[1][1] = Math.max(b[1][1], coord);
                    }
                    return b;
                }, [[Infinity, Infinity], [-Infinity, -Infinity]]);

            // zooms to the district
            map.fitBounds(bounds, { padding: 60, duration: 1200 });

            // reveals the points after zoom animation completes
            map.once('moveend', () => {
                map.setLayoutProperty('point-of-complaints', 'visibility', 'visible');
            });

            // 4. Remove the instruction overlay
            const overlay = document.getElementById('instruction-overlay');
            if (overlay) overlay.classList.add('hidden');

            map.setLayoutProperty('highest-district-highlight', 'visibility', 'none');

        } else {
            // Clicked a different district — nudge them toward the right one
            const overlay = document.getElementById('instruction-overlay');
            if (overlay) {
                overlay.querySelector('p').textContent =
                    'That\'s not the one — click the darkest district!';
            }
        }
    });

    // ── Pointer cursor on hover ──────────────────────────────────
    map.on('mouseenter', 'council-districts-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'council-districts-fill', () => {
        map.getCanvas().style.cursor = '';
    });

    // ── Hover popup ─────────────────────────────────────────────────
    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    map.on('mousemove', 'council-districts-fill', (e) => {
        const props = e.features[0].properties;

        popup
            .setLngLat(e.lngLat)
            .setHTML(`
            <strong>${props[HIGHEST_DISTRICT_PROP]}</strong><br>
            Number of Rat Sighting 311 Complaints: ${props.NUMPOINTS.toLocaleString()}
        `)
            .addTo(map);
    });

    map.on('mouseleave', 'council-districts-fill', () => {
        popup.remove();
    });

    // ── Hover highlight layer 
    map.addLayer({
        id: 'council-districts-hover',
        type: 'fill',
        source: 'rat-complaints-per-cd',
        paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.2
        },
        filter: ['==', ['get', HIGHEST_DISTRICT_PROP], '']  // empty to start — nothing highlighted
    });

    map.addLayer({
        id: 'council-districts-hover-line',
        type: 'line',
        source: 'rat-complaints-per-cd',
        paint: {
            'line-color': '#ffffff',
            'line-width': 2.5
        },
        filter: ['==', ['get', HIGHEST_DISTRICT_PROP], '']
    });

    let hoveredId = null;

    map.on('mousemove', 'council-districts-fill', (e) => {
        const props = e.features[0].properties;
        const currentId = props[HIGHEST_DISTRICT_PROP];

        if (currentId !== hoveredId) {
            hoveredId = currentId;

            map.setFilter('council-districts-hover',
                ['==', ['get', HIGHEST_DISTRICT_PROP], hoveredId]
            );

            map.setFilter('council-districts-hover-line',
                ['==', ['get', HIGHEST_DISTRICT_PROP], hoveredId]
            );
        }
    });

    map.once('moveend', () => {
        map.setLayoutProperty('point-of-complaints', 'visibility', 'visible');
        // Add this line:
        document.getElementById('address-panel').classList.add('visible');
    });
});

let pointsData = null;      // will hold the loaded GeoJSON once fetched

// Load the points GeoJSON into memory so we can search it
fetch('./point-complaints-highest-CD.json')
    .then(r => r.json())
    .then(data => { pointsData = data; });

function searchAddress() {
    const input = document.getElementById('address-input').value.trim().toLowerCase();
    const resultDiv = document.getElementById('search-result');

    if (!input) {
        resultDiv.innerHTML = '<span class="none">Please enter an address.</span>';
        return;
    }

    if (!pointsData) {
        resultDiv.innerHTML = '<span class="none">Data not loaded yet — try again.</span>';
        return;
    }

    // Filter features where Incident Address contains the search string
    const matches = pointsData.features.filter(f => {
        const addr = f.properties['Incident Address'];
        return addr && addr.toLowerCase().includes(input);
    });

    if (matches.length === 0) {
        resultDiv.innerHTML = `<span class="none">No complaints found for "${input}".</span>`;
    } else {
        // Get the actual matched address strings for display
        const uniqueAddresses = [...new Set(matches.map(f => f.properties['Incident Address']))];
        resultDiv.innerHTML = `
            <span class="count">${matches.length}</span>
            complaint${matches.length !== 1 ? 's' : ''} filed at:<br>
            <strong>${uniqueAddresses.join('<br>')}</strong>
        `;
    }
}

// Allow pressing Enter to search
document.getElementById('address-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchAddress();
});