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
let activeYear = 'all';
let allPoints = null;
let choroData = null;

/* ── Title screen ───────────────────────────────────────────────── */
function enterMap() {
    const titleScreen = document.getElementById('title-screen');
    titleScreen.classList.add('fade-out');
    setTimeout(() => {
        titleScreen.style.display = 'none';
    }, 600);
}

/* ── Parse year from "5/10/26 1:26" format ─────────────────────── */
function parseYear(dateStr) {
    if (!dateStr) return null;
    try {
        const datePart = String(dateStr).trim().split(' ')[0];  // "5/10/26"
        const parts = datePart.split('/');
        if (parts.length < 3) return null;
        const yearShort = parseInt(parts[2], 10);
        if (isNaN(yearShort)) return null;
        return 2000 + yearShort;
    } catch {
        return null;
    }
}

/* ── Count complaints per district for a given year ─────────────── */
function countByDistrict(year) {
    const counts = {};
    if (!allPoints) return counts;

    allPoints.features.forEach(f => {
        const props = f.properties;
        const district = String(props['Council District']);  // gives "16"
        const featureYear = parseYear(props['Created Date']);

        if (featureYear === null) return;
        if (year !== 'all' && featureYear !== parseInt(year, 10)) return;

        counts[district] = (counts[district] || 0) + 1;
    });

    return counts;
}

/* ── Get min/max across all districts for current filter ─────────── */
function getRange(year) {
    const counts = Object.values(countByDistrict(year));
    if (counts.length === 0) return { min: 0, max: 1 };
    return {
        min: Math.min(...counts),
        max: Math.max(...counts)
    };
}

/* ── Build updated GeoJSON with FILTERED_COUNT injected ─────────── */
function buildFilteredGeoJSON(year) {
    const counts = countByDistrict(year);

    return {
        type: 'FeatureCollection',
        features: choroData.features.map(f => {
            const key = String(f.properties['CounDist']);   // gives "42"
            const filteredCount = counts[key] || 0;
            return {
                ...f,
                properties: {
                    ...f.properties,
                    FILTERED_COUNT: filteredCount
                }
            };
        })
    };
}

/* ── Build color expression using FILTERED_COUNT ────────────────── */
function buildColorExpression(year) {
    const { min, max } = getRange(year);
    const mid1 = Math.round(min + (max - min) * 0.25);
    const mid2 = Math.round(min + (max - min) * 0.5);
    const mid3 = Math.round(min + (max - min) * 0.75);

    return [
        'interpolate', ['linear'], ['get', 'FILTERED_COUNT'],
        min, '#f1eef6',
        mid1, '#d7b5d8',
        mid2, '#df65b0',
        mid3, '#d22475',
        max, '#7b0337'
    ];
}

/* ── Update choropleth and legend for selected year ─────────────── */
function updateYear(year) {
    if (!allPoints || !choroData) return;
    activeYear = year;

    // Set color expression first
    map.setPaintProperty('council-districts-fill', 'fill-color', buildColorExpression(year));

    // Then update the source data
    const filtered = buildFilteredGeoJSON(year);
    map.getSource('rat-complaints-per-cd').setData(filtered);

    const { min, max } = getRange(year);
    const mid1 = Math.round(min + (max - min) * 0.25);
    const mid2 = Math.round(min + (max - min) * 0.5);
    const mid3 = Math.round(min + (max - min) * 0.75);
    const labels = [
        `${min.toLocaleString()} – ${mid1.toLocaleString()}`,
        `${mid1.toLocaleString()} – ${mid2.toLocaleString()}`,
        `${mid2.toLocaleString()} – ${mid3.toLocaleString()}`,
        `${mid3.toLocaleString()} – ${max.toLocaleString()}`,
        `${max.toLocaleString()}+`
    ];
    document.querySelectorAll('.legend-label').forEach((el, i) => {
        el.textContent = labels[i];
    });

    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.year === year);
    });

    const yearLabel = year === 'all' ? '2020–present' : year;
    document.getElementById('legend-title').textContent =
        `Rat-related 311 complaints by council district — ${yearLabel}`;
}

/* ── Load both data files then initialize choropleth ────────────── */
Promise.all([
    fetch('./total-311-requests.json').then(r => r.json()),
    fetch('./rat-complaints-per-cd.json').then(r => r.json())
]).then(([points, choro]) => {
    allPoints = points;
    choroData = choro;
    if (map.isStyleLoaded()) {
        updateYear('all');
    } else {
        map.once('load', () => updateYear('all'));
    }
});

/* ── Wire up year filter buttons ────────────────────────────────── */
document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => updateYear(btn.dataset.year));
});

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
        layout: { 'visibility': 'none' },
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

    /* ── Hover: district popup + highlight ──────────────────────── */
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
    const yearLabel = activeYear === 'all' ? '2020–present' : activeYear;

    let count = 0;
    if (allPoints) {
        const counts = countByDistrict(activeYear);
        const key = String(props[DISTRICT_PROP]);    // "42" to match countByDistrict keys
        count = counts[key] || 0;
    }

    popup
        .setLngLat(e.lngLat)
        .setHTML(`
            <strong>Council District ${props[DISTRICT_PROP]}</strong><br>
            ${yearLabel} rat sighting complaints: ${count.toLocaleString()}
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

        /* hide points and restore year filter when zoomed back out */
        if (map.getZoom() < 11) {
            map.setLayoutProperty('clusters', 'visibility', 'none');
            map.setLayoutProperty('cluster-count', 'visibility', 'none');
            map.setLayoutProperty('unclustered-points', 'visibility', 'none');

            const yf = document.getElementById('year-filter');
            yf.style.opacity = '1';
            yf.style.pointerEvents = 'auto';

            document.getElementById('zoom-note').style.display = 'none';
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

            /* dim year filter — it only applies to choropleth view */
            const yf = document.getElementById('year-filter');
            yf.style.opacity = '0.3';
            yf.style.pointerEvents = 'none';

            document.getElementById('zoom-note').style.display = 'block';
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
        popup.remove();
        map.getCanvas().style.cursor = 'pointer';

        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        const year = parseYear(props['Created Date']);

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        pointPopup
            .setLngLat(coords)
            .setHTML(`
                <strong>${props['Incident Address'] || 'Address unavailable'}</strong><br>
                <span style="opacity:0.75">${props['Problem Detail (formerly Descriptor)'] || props['Complaint Type'] || 'No description'}</span><br>
                <span style="opacity:0.5; font-size:11px">Filed: ${year || 'Date unavailable'}</span>
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