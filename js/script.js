/***************************************************************
 * 1) LEAFLET MAP + OSM BASEMAP
 ***************************************************************/
const INITIAL_CENTER = [43.7, -79.38];
const INITIAL_ZOOM = 11;

const map = L.map("map").setView(INITIAL_CENTER, INITIAL_ZOOM);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
  {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
  }
).addTo(map);

/***************************************************************
 * 2) GLOBAL VARIABLES & SCALES
 ***************************************************************/
let geoJsonLayer;
let searchMarker = null; // for the searched location marker

const dataSets = {
  exposure: {
    label: "Heat Exposure (°C Days)",
    valueFunc: d => d.properties.degree_days_20,
    colorScale: null
  },
  canopy: {
    label: "Tree Canopy (%)",
    valueFunc: d => d.properties.canopy_percent,
    colorScale: null
  },
  impervious: {
    label: "Impervious Surface (%)",
    valueFunc: d => d.properties.impervious_percent,
    colorScale: null
  },
  coolAccess: {
    label: "Access to Cooling (Higher=Better)",
    valueFunc: d => 1 / Math.max(d.properties.cool_mean, 0.000001),
    colorScale: null
  },
  hospitalAccess: {
    label: "Access to Hospitals (Higher=Better)",
    valueFunc: d => 1 / Math.max(d.properties.hospital_mean, 0.000001),
    colorScale: null
  }
};

const maxValues = {
  population_2016: 0,
  pop_density_km2: 0,
  median_income: 0,
  unemployment_rate: 0
};

/***************************************************************
 * 3) BAR CHART
 ***************************************************************/
function drawBar(container, config) {
  const val = config.value || 0;
  const maxVal = config.max || 1;
  const frac = Math.min(val / maxVal, 1);

  const barRow = container.append("div")
    .attr("class", "bar-chart");

  barRow.append("div")
    .attr("class", "bar-label")
    .text(config.label);

  const barWrapper = barRow.append("div")
    .attr("class", "bar-wrapper");

  barWrapper.append("div")
    .attr("class", "bar-fill")
    .style("width", (frac * 100) + "%");

  barRow.append("div")
    .attr("class", "bar-value")
    .text(config.format ? config.format(val) : val);
}

/***************************************************************
 * 4) INFO PANEL
 ***************************************************************/
function updateInfoPanel(feature) {
  const props = feature.properties;
  const infoPanel = d3.select("#info-panel");
  infoPanel.html("");

  infoPanel.append("h3").text(`DAUID: ${props.DAUID}`);

  infoPanel.append("p").text("Census Data:");
  const barContainer = infoPanel.append("div");

  // Extended bars
  drawBar(barContainer, {
    label: "Population (2016)",
    value: props.population_2016,
    max: maxValues.population_2016,
    format: d3.format(",")
  });
  drawBar(barContainer, {
    label: "Pop. Density (per km²)",
    value: props.pop_density_km2,
    max: maxValues.pop_density_km2,
    format: d3.format(".1f")
  });
  drawBar(barContainer, {
    label: "Median Income ($)",
    value: props.median_income,
    max: maxValues.median_income,
    format: d3.format(",")
  });
  drawBar(barContainer, {
    label: "Unemployment Rate (%)",
    value: props.unemployment_rate,
    max: 100,
    format: d3.format(".1f")
  });
}

/***************************************************************
 * 5) STYLE & INTERACTION
 ***************************************************************/
function styleFeature(feature) {
  const currentKey = d3.select("#data-toggle").property("value");
  const ds = dataSets[currentKey];
  const val = ds.valueFunc(feature);

  return {
    fillColor: ds.colorScale(val),
    weight: 0.5,
    color: "#333",
    opacity: 0.5,
    fillOpacity: 0.5
  };
}

function highlightFeature(e) {
  e.target.setStyle({
    weight: 2,
    color: "#000",
    opacity: 1
  });
  e.target.bringToFront();
}

function resetHighlight(e) {
  geoJsonLayer.resetStyle(e.target);
}

function clickFeature(e) {
  updateInfoPanel(e.target.feature);
}

function onEachFeature(feature, layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: clickFeature
  });
}

/***************************************************************
 * 6) UPDATE STYLES & LEGEND
 ***************************************************************/
function updateMapStyle() {
  geoJsonLayer.setStyle(styleFeature);
  updateLegend();
}

/***************************************************************
 * 7) CONTINUOUS GRADIENT LEGEND
 ***************************************************************/
let legendControl = null;

function updateLegend() {
  if (legendControl) {
    map.removeControl(legendControl);
  }
  legendControl = L.control({ position: "topright" });
  
  legendControl.onAdd = () => {
    const div = L.DomUtil.create("div", "info-legend");
    const currentKey = d3.select("#data-toggle").property("value");
    const ds = dataSets[currentKey];
    const domain = ds.colorScale.domain();
    const [minVal, maxVal] = domain;

    div.innerHTML = `<h4>${ds.label}</h4>`;

    const minColor = ds.colorScale(minVal);
    const maxColor = ds.colorScale(maxVal);

    div.innerHTML += `
      <div style="
        width: 200px;
        height: 10px;
        margin-bottom: 5px;
        background: linear-gradient(to right, ${minColor}, ${maxColor});
      "></div>
      <div style="display: flex; justify-content: space-between;">
        <span>${minVal.toFixed(2)}</span>
        <span>${maxVal.toFixed(2)}</span>
      </div>
    `;
    return div;
  };
  
  legendControl.addTo(map);
}

/***************************************************************
 * 8) RESET ZOOM
 ***************************************************************/
function resetZoom() {
  map.setView(INITIAL_CENTER, INITIAL_ZOOM);
}
document.getElementById("resetZoom").addEventListener("click", resetZoom);

/***************************************************************
 * 9) LOCATION SEARCH (NO POPUP)
 ***************************************************************/
// Example bounding box for Toronto
const TORONTO_BBOX = "-79.639319,43.855401,-79.115408,43.407521";

function searchLocation() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ca&viewbox=${TORONTO_BBOX}&bounded=1&q=${encodeURIComponent(query)}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        // Remove existing marker if any
        if (searchMarker) {
          map.removeLayer(searchMarker);
        }

        // Add new marker at the found location
        searchMarker = L.marker([lat, lon]).addTo(map);

        // No bindPopup, so no popup is shown

        map.setView([lat, lon], 14);
      } else {
        alert("No location found within Toronto. Try a different query.");
      }
    })
    .catch(err => {
      console.error("Error searching location:", err);
      alert("Error searching location. Check console for details.");
    });
}

document.getElementById("searchButton").addEventListener("click", searchLocation);

/***************************************************************
 * 10) LOAD GEOJSON & INIT
 ***************************************************************/
d3.json("data/data.geojson").then(data => {
  const features = data.features;

  // Find city-wide maxima
  features.forEach(f => {
    const p = f.properties;
    maxValues.population_2016 = Math.max(maxValues.population_2016, p.population_2016 || 0);
    maxValues.pop_density_km2 = Math.max(maxValues.pop_density_km2, p.pop_density_km2 || 0);
    maxValues.median_income = Math.max(maxValues.median_income, p.median_income || 0);
    maxValues.unemployment_rate = Math.max(maxValues.unemployment_rate, p.unemployment_rate || 0);
  });

  // Build color scales for each layer
  Object.keys(dataSets).forEach(key => {
    const ds = dataSets[key];
    const vals = features.map(ds.valueFunc);
    const domain = d3.extent(vals);

    let interpolator;
    switch (key) {
      case "exposure":
        interpolator = d3.interpolateOranges;
        break;
      case "canopy":
        interpolator = d3.interpolateGreens;
        break;
      case "impervious":
        interpolator = d3.interpolateGreys;
        break;
      case "coolAccess":
        interpolator = d3.interpolateBlues;
        break;
      case "hospitalAccess":
        interpolator = d3.interpolatePurples;
        break;
      default:
        interpolator = d3.interpolateViridis;
    }

    ds.colorScale = d3.scaleSequential()
      .domain(domain)
      .interpolator(interpolator);
  });

  // Create Leaflet GeoJSON layer
  geoJsonLayer = L.geoJson(data, {
    style: styleFeature,
    onEachFeature
  }).addTo(map);

  // Initial legend
  updateLegend();

  // Layer dropdown event
  d3.select("#data-toggle").on("change", () => {
    updateMapStyle();
  });

}).catch(err => {
  console.error("Error loading GeoJSON:", err);
});
