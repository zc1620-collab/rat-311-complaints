# NYC Rat Complaints Map

An interactive web map built with Mapbox GL JS that visualizes rat complaints filed with NYC 311, broken down by City Council District. Each district is color-coded by complaint volume using a continuous color scale. It focuses in on Council District 36, which received the highest number of rat complaints from 2020-2026, and shows individual points to represent the scale and location within this district of complaints. The feature also allows the user to type in a specific address within Council District 36 to see how many complaints have been issued at that location.

## Features

- Choropleth fill layer color-scaled by number of rat complaints (`NUMPOINTS`)
- District boundary outlines rendered on top of the fill layer
- Mapbox Standard style base map
- Data sourced from NYC 311 rat complaint records, aggregated by council district
- Points for individual 311 rat complaints within the council district with the highest number of complaints

## Project Structure

```
├── index.html
├── styles.css
├── script.js
├── point-complaints-highest-CD.json
└── rat-complaints-per-cd.json

## Getting Started

### Prerequisites

- A [Mapbox account](https://account.mapbox.com/) and public access token

### Installation

1. Clone or download this repository.
2. Replace the `accessToken` value in `script.js` with your own Mapbox public token:
   ```js
   mapboxgl.accessToken = 'pk.your_token_here';
   ```
3. Serve the project with a local web server. For example:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8000
   ```
4. Open `http://localhost:8000` in your browser.

## Data

`rat-complaints-per-cd.json` is a GeoJSON file containing NYC City Council District polygons. Each feature includes a `NUMPOINTS` property representing the number of rat complaints received from that district.

`point-complaints-highest-CD.json` is a GeoJSON file containing points for each 311 rat complaint in Council District 26 from 2020-2026. Each feature includes a 'Incident Address' property representing the location of the complaint. 

https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2020-to-Present/erm2-nwe9/about_data

https://data.cityofnewyork.us/City-Government/City-Council-Districts/872g-cjhh/about_data

## Color Scale

The fill color is driven by a linear `interpolate` expression in Mapbox GL JS, mapping `NUMPOINTS` to a purple-to-magenta ramp:

| Value  | Color     |
|--------|-----------|
| 1,025  | `#f1eef6` |
| 3,500  | `#d7b5d8` |
| 6,000  | `#df65b0` |
| 9,000  | `#dd1c77` |
| 11,344 | `#980043` |

## Built With

- [Mapbox GL JS v3.20.0](https://docs.mapbox.com/mapbox-gl-js/)
- HTML / CSS / Vanilla JavaScript

## License

MIT
