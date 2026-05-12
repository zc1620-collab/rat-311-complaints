mapboxgl.accessToken = 'pk.eyJ1Ijoiem9lamNvc3RlbGxvIiwiYSI6ImNtbmkydjBiZDA5MGQycHBrNDc2cDBoY28ifQ.gPfZDNZopRE9ZILzYXo63A';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [-74.006, 40.7128],
    zoom: 10,
    minZoom: 9,
    maxBounds: [
        [-74.6, 40.4],
        [-73.4, 41.0]
    ]
});

const DISTRICT_PROP = 'CounDist';

/* title screen */
function enterMap() {
    const titleScreen = document.getElementById('title-screen');
    titleScreen.classList.add('fade-out');
    setTimeout(() => {
        titleScreen.style.display = 'none';
    }, 600);
}

map.on('load', () => {

    /* ── Sources ────────────────────────────────────────────────── */
    map.addSource('rat-complaints-per-cd', {
        type: 'geojson',
        data: './rat-complaints-per-cd.json'
    });

    map.addSource('point-of-complaints', {
        type: 'geojson',
        data: './total-311-requests.json',
        cluster: true,
        clusterMaxZoom: 16,
        clusterRadius: 40
    });

    /* ── Cluster circles ────────────────────────────────────────── */
    map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'point-of-complaints',
        filter: ['has', 'point_count'],
        layout: { 'visibility': 'none' },
        paint: {
            'circle-color': [
                'step', ['get', 'point_count'],
                '#d7b5d8',
                20, '#df65b0',
                100, '#7b0337'
            ],
            'circle-radius': [
                'step', ['get', 'point_count'],
                14,
                20, 20,
                100, 28
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#fff'
        }
    });

    /* ── Cluster count labels ───────────────────────────────────── */
    map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'point-of-complaints',
        filter: ['has', 'point_count'],
        layout: {
            'visibility': 'none',        
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: {
            'text-color': '#ffffff'
        }
    });

    /* ── Individual unclustered points ─────────────────────────── */
    map.addLayer({
        id: 'unclustered-points',
        type: 'circle',
        source: 'point-of-complaints',
        filter: ['!', ['has', 'point_count']],
        layout: { 'visibility': 'none' },  // fixed: was missing comma after this line
        paint: {
            'circle-radius': 5,
            'circle-color': '#7b0337',
            'circle-opacity': 0.85,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        }
    });

    /* ── Choropleth fill ────────────────────────────────────────── */
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

    /* ── District outlines ──────────────────────────────────────── */
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

    /* ── Hover highlight layers ─────────────────────────────────── */
    map.addLayer({
        id: 'council-districts-hover',
        type: 'fill',
        source: 'rat-complaints-per-cd',
        maxzoom: 13,
        paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.2
        },
        filter: ['==', ['get', DISTRICT_PROP], '']
    });

    map.addLayer({
        id: 'council-districts-hover-line',
        type: 'line',
        source: 'rat-complaints-per-cd',
        maxzoom: 13,
        paint: {
            'line-color': '#ffffff',
            'line-width': 2.5
        },
        filter: ['==', ['get', DISTRICT_PROP], '']
    });

    /* ── Hover: choropleth district popup + highlight ───────────── */
    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    let hoveredId = null;
    let hoveringPoint = false;

    map.on('mousemove', 'council-districts-fill', (e) => {
        if (hoveringPoint) return;
        if (map.getZoom() > 13) {
            popup.remove();
            return;
        }

        const props = e.features[0].properties;
        const currentId = props[DISTRICT_PROP];

        popup
            .setLngLat(e.lngLat)
            .setHTML(`
            <strong>Council District ${props[DISTRICT_PROP]}</strong><br>
            Number of Rat Sighting 311 Complaints: ${props.NUMPOINTS.toLocaleString()}
        `)
            .addTo(map);

        if (currentId !== hoveredId) {
            hoveredId = currentId;
            map.setFilter('council-districts-hover', ['==', ['get', DISTRICT_PROP], hoveredId]);
            map.setFilter('council-districts-hover-line', ['==', ['get', DISTRICT_PROP], hoveredId]);
        }
    });

    map.on('zoom', () => {
        if (map.getZoom() > 13) {
            popup.remove();
            hoveredId = null;
        }
    });

    map.on('mouseleave', 'council-districts-fill', () => {
        popup.remove();
        hoveredId = null;
        map.setFilter('council-districts-hover', ['==', ['get', DISTRICT_PROP], '']);
        map.setFilter('council-districts-hover-line', ['==', ['get', DISTRICT_PROP], '']);
        map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', 'council-districts-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    /* ── Click district: zoom in and reveal clusters ────────────── */
    map.on('click', 'council-districts-fill', (e) => {
        const clusterFeatures = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        if (clusterFeatures.length > 0) return;

        const coordinates = e.features[0].geometry.coordinates;
        const bounds = coordinates.flat(Infinity)
            .reduce((b, coord, i) => {
                if (i % 2 === 0) {
                    b[0][0] = Math.min(b[0][0], coord);
                    b[1][0] = Math.max(b[1][0], coord);
                } else {
                    b[0][1] = Math.min(b[0][1], coord);
                    b[1][1] = Math.max(b[1][1], coord);
                }
                return b;
            }, [[Infinity, Infinity], [-Infinity, -Infinity]]);

        map.fitBounds(bounds, { padding: 60, duration: 1000 });

        map.once('moveend', () => {
            map.setLayoutProperty('clusters', 'visibility', 'visible');
            map.setLayoutProperty('cluster-count', 'visibility', 'visible');
            map.setLayoutProperty('unclustered-points', 'visibility', 'visible');
        });
    });

    /* ── Click cluster: zoom into it ───────────────────────────── */
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0].properties.cluster_id;

        map.getSource('point-of-complaints').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom + 1,
                duration: 800
            });
        });
    });

    /* ── Hover individual points ────────────────────────────────── */
    const pointPopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10
    });

    map.on('mouseenter', 'unclustered-points', (e) => {
        hoveringPoint = true;
        popup.remove();  // immediately dismiss any open district popup
        map.getCanvas().style.cursor = 'pointer';

        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        pointPopup
            .setLngLat(coords)
            .setHTML(`
                <strong>${props['Incident Address'] || 'Address unavailable'}</strong><br>
                <span style="opacity:0.75">${props['Problem Detail (formerly Descriptor)'] || props['Complaint Type'] || 'No description'}</span>
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'unclustered-points', () => {
        hoveringPoint = false;
        map.getCanvas().style.cursor = '';
        pointPopup.remove();
    });

    map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
    });

});  /* end map.on('load') */