mapboxgl.accessToken = 'pk.eyJ1Ijoiem9lamNvc3RlbGxvIiwiYSI6ImNtbmkydjBiZDA5MGQycHBrNDc2cDBoY28ifQ.gPfZDNZopRE9ZILzYXo63A';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: [-74.006, 40.7128],
    zoom: 10
});

map.on('load', () => {
    //adds council district json polygons with 311 complaint data 
    map.addSource('rat-complaints-per-cd', {
        type: 'geojson',
        data: './rat-complaints-per-cd.json'
    });

    //add source for points in highest council district
    map.addSource('point-of-complaints', {
    type: 'geojson',
    data: './point-complaints-highest-CD.json'
    });

    //adds fill color for each council district based on number of 311 rat complaints received

    map.addLayer({
        id: 'council-districts-fill',
        type: 'fill',
        source: 'rat-complaints-per-cd',
        paint: {
            'fill-color': [
                'interpolate',
                ['linear'],
                ['get', 'NUMPOINTS'],
                1025, '#f1eef6',   // low end
                3500, '#d7b5d8',
                6000, '#df65b0',
                9000, '#d22475',
                11344, '#7b0337'   // high end
            ],
            'fill-opacity': 0.7
        }
    });

    //adds line outline of each council district
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

    //add dots for points
    map.addLayer({
        id: 'point-of-complaints',
        type: 'circle',
        source: 'point-of-complaints',
        paint: {
            'circle-radius': 1,
            'circle-color': '#ff0000',
            'circle-opacity': .8
        }
    })
});