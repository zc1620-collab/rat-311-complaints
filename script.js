mapboxgl.accessToken = 'pk.eyJ1Ijoiem9lamNvc3RlbGxvIiwiYSI6ImNtbmkydjBiZDA5MGQycHBrNDc2cDBoY28ifQ.gPfZDNZopRE9ZILzYXo63A';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [-74.006, 40.7128],
    zoom: 10
});

const HIGHEST_DISTRICT_ID = 36;        
const HIGHEST_DISTRICT_PROP = 'CounDist'; 

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
            'circle-color': '#ff0000',
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
});