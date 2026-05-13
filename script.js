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
let currentView = 'choropleth';  // 'choropleth' or 'clusters'
let isAllYearsMode = true;

/* ── All-years scale ───────────────────────────── */
const ALL_COLOR_STOPS = [
    [0, '#f1eef6'],
    [3000, '#d7b5d8'],
    [6000, '#df65b0'],
    [9000, '#d22475'],
    [11344, '#7b0337']
];

/* ── Standardized yearly scale ────────────────── */
/* Same scale used for every single year */
const YEAR_COLOR_STOPS = [
    [0, '#f1eef6'],
    [500, '#d7b5d8'],
    [1000, '#df65b0'],
    [1500, '#d22475'],
    [2000, '#7b0337']
];

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
        const datePart = String(dateStr).trim().split(' ')[0];
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
        const district = String(props['Council District']);
        const featureYear = parseYear(props['Created Date']);

        if (featureYear === null) return;
        if (year !== 'all' && featureYear !== parseInt(year, 10)) return;

        counts[district] = (counts[district] || 0) + 1;
    });

    return counts;
}

/* ── Build updated GeoJSON with FILTERED_COUNT injected ─────────── */
function buildFilteredGeoJSON(year) {
    const counts = countByDistrict(year);

    return {
        type: 'FeatureCollection',
        features: choroData.features.map(f => {
            const key = String(f.properties[DISTRICT_PROP]);
            return {
                ...f,
                properties: {
                    ...f.properties,
                    FILTERED_COUNT: counts[key] || 0
                }
            };
        })
    };
}

/* ── Fixed color expression using global scale ──────────────────── */
function buildColorExpression(mode = 'all') {

    const stops = mode === 'all'
        ? ALL_COLOR_STOPS
        : YEAR_COLOR_STOPS;

    return [
        'interpolate',
        ['linear'],
        ['get', 'FILTERED_COUNT'],

        stops[0][0], stops[0][1],
        stops[1][0], stops[1][1],
        stops[2][0], stops[2][1],
        stops[3][0], stops[3][1],
        stops[4][0], stops[4][1]
    ];
}

/* ── Update legend labels to always show fixed global scale ─────── */
function updateLegendLabels(year = 'all') {

    const stops = year === 'all'
        ? ALL_COLOR_STOPS
        : YEAR_COLOR_STOPS;

    const labels = [
        `${stops[0][0].toLocaleString()} – ${stops[1][0].toLocaleString()}`,
        `${stops[1][0].toLocaleString()} – ${stops[2][0].toLocaleString()}`,
        `${stops[2][0].toLocaleString()} – ${stops[3][0].toLocaleString()}`,
        `${stops[3][0].toLocaleString()} – ${stops[4][0].toLocaleString()}`,
        `${stops[4][0].toLocaleString()}+`
    ];

    document.querySelectorAll('.legend-label').forEach((el, i) => {
        el.textContent = labels[i];
    });
}

/* ── Update choropleth for selected year ────────────────────────── */
function updateYear(year) {
    if (!allPoints || !choroData) return;
    activeYear = year;
    updateLegendLabels(year);

    const filtered = buildFilteredGeoJSON(year);
    map.getSource('rat-complaints-per-cd').setData(filtered);
    map.setPaintProperty('council-districts-fill', 'fill-color', buildColorExpression(year));

    const yearLabel = year === 'all'
        ? 'All Years (2020–2026)'
        : year;
    document.getElementById('legend-title').textContent =
        `Rat-related 311 complaints by council district — ${yearLabel}`;
    document.getElementById('slider-label').textContent =
        year === 'all' ? 'All years' : year;
}

/* ── Toggle between choropleth and cluster views ────────────────── */
function setView(view) {
    currentView = view;
    const btn = document.getElementById('view-toggle');

    if (view === 'choropleth') {
        map.setLayoutProperty('council-districts-fill', 'visibility', 'visible');
        map.setLayoutProperty('council-districts', 'visibility', 'visible');
        map.setLayoutProperty('council-districts-hover', 'visibility', 'visible');
        map.setLayoutProperty('council-districts-hover-line', 'visibility', 'visible');
        map.setLayoutProperty('clusters', 'visibility', 'none');
        map.setLayoutProperty('cluster-count', 'visibility', 'none');
        map.setLayoutProperty('unclustered-points', 'visibility', 'none');

        document.getElementById('legend').style.display = 'block';
        document.getElementById('year-filter').style.opacity = '1';
        document.getElementById('year-filter').style.pointerEvents = 'auto';
        document.getElementById('zoom-note').style.display = 'none';

        btn.textContent = 'Switch to point view';
        map.easeTo({ zoom: 10, center: [-74.006, 40.7128], duration: 800 });

    } else {
        map.setLayoutProperty('council-districts-fill', 'visibility', 'none');
        map.setLayoutProperty('council-districts', 'visibility', 'none');
        map.setLayoutProperty('council-districts-hover', 'visibility', 'none');
        map.setLayoutProperty('council-districts-hover-line', 'visibility', 'none');
        map.setLayoutProperty('clusters', 'visibility', 'visible');
        map.setLayoutProperty('cluster-count', 'visibility', 'visible');
        map.setLayoutProperty('unclustered-points', 'visibility', 'visible');

        document.getElementById('legend').style.display = 'none';
        document.getElementById('year-filter').style.opacity = '0.3';
        document.getElementById('year-filter').style.pointerEvents = 'none';
        document.getElementById('zoom-note').style.display = 'block';

        btn.textContent = 'Switch to district view';
    }
}

/* ── Wire up slider ─────────────────────────────────────────────── */
const sliderYears = [
    '2020',
    '2021',
    '2022',
    '2023',
    '2024',
    '2025',
    '2026'
];

/* default = all years */
updateYear('all');

document.getElementById('all-years-btn')
    .addEventListener('click', () => {

        document.getElementById('all-years-btn')
            .classList.add('active-mode');

        document.getElementById('yearly-btn')
            .classList.remove('active-mode');

        document.getElementById('year-slider-wrapper')
            .style.display = 'none';

        updateYear('all');
    });

document.getElementById('yearly-btn')
    .addEventListener('click', () => {

        document.getElementById('yearly-btn')
            .classList.add('active-mode');

        document.getElementById('all-years-btn')
            .classList.remove('active-mode');

        document.getElementById('year-slider-wrapper')
            .style.display = 'flex';

        const slider = document.getElementById('year-slider');
        const year = sliderYears[parseInt(slider.value)];

        updateYear(year);
    });

document.getElementById('year-slider')
    .addEventListener('input', function () {

        const year = sliderYears[parseInt(this.value)];

        updateYear(year);
    });

/* ── Wire up view toggle ────────────────────────────────────────── */
document.getElementById('view-toggle').addEventListener('click', () => {
    setView(currentView === 'choropleth' ? 'clusters' : 'choropleth');
});

/* ── Load both data files then initialize ───────────────────────── */
Promise.all([
    fetch('./311-total-complaints.json').then(r => r.json()),
    fetch('./rat-complaints-per-cd.json').then(r => r.json())
]).then(([points, choro]) => {
    allPoints = points;
    choroData = choro;
    updateLegendLabels('all');
    if (map.isStyleLoaded()) {
        updateYear('all');
    } else {
        map.once('load', () => updateYear('all'));
    }
});

map.on('load', () => {

    /* ── Sources ────────────────────────────────────────────────── */
    map.addSource('rat-complaints-per-cd', {
        type: 'geojson',
        data: './rat-complaints-per-cd.json'
    });

    map.addSource('point-of-complaints', {
        type: 'geojson',
        data: './311-total-complaints.json',
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
        paint: { 'text-color': '#ffffff' }
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
            'fill-color': buildColorExpression('all'),
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
            const key = String(props[DISTRICT_PROP]);
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

    /* ── Click district: zoom in (choropleth view only) ─────────── */
    map.on('click', 'council-districts-fill', (e) => {
        if (currentView !== 'choropleth') return;
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