/***************************************************************
 * 1) LEAFLET MAP + OSM BASEMAP
 ***************************************************************/
const INITIAL_CENTER = [43.7, -79.38];
const INITIAL_ZOOM = 11;

// Create Leaflet map
const map = L.map("map").setView(INITIAL_CENTER, INITIAL_ZOOM);

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
  {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">' +
      'OpenStreetMap</a> contributors'
  }
).addTo(map);

/***************************************************************
 * 2) GLOBAL VARIABLES & SCALES
 ***************************************************************/
// We'll store the raw GeoJSON for reference (Turf analysis)
let geoJsonData = null;
// Leaflet geoJson layer
let geoJsonLayer = null;
// DAUID -> Leaflet layer map
let featureLayerMap = {};
// Single marker for the search location
let searchMarker = null;
// Keep track of any previously highlighted polygon
let previouslyHighlightedLayer = null;
// The currently “active” DA feature (clicked or found via search)
let activeFeature = null;

// Different data sets for toggling layers
const dataSets = {
  exposure: {
    label: "Heat Exposure (°C Days)",
    valueFunc: (f) => f.properties.degree_days_20,
    colorScale: null
  },
  canopy: {
    label: "Tree Canopy (%)",
    valueFunc: (f) => f.properties.canopy_percent,
    colorScale: null
  },
  impervious: {
    label: "Impervious Surface (%)",
    valueFunc: (f) => f.properties.impervious_percent,
    colorScale: null
  },
  coolAccess: {
    label: "Access to Cooling (Higher=Better)",
    valueFunc: (f) => 1 / Math.max(f.properties.cool_mean, 0.000001),
    colorScale: null
  },
  hospitalAccess: {
    label: "Access to Hospitals (Higher=Better)",
    valueFunc: (f) => 1 / Math.max(f.properties.hospital_mean, 0.000001),
    colorScale: null
  }
};

// For bar charts in the info panel
const maxValues = {
  population_2016: 0,
  pop_density_km2: 0,
  median_income: 0,
  unemployment_rate: 0
};

/***************************************************************
 * 3) BAR CHART & INFO PANEL
 ***************************************************************/
function drawBar(container, config) {
  const val = config.value || 0;
  const maxVal = config.max || 1;
  const frac = Math.min(val / maxVal, 1);

  // Each bar is a row with label, a bar track, and a numeric value
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

function updateInfoPanel(feature) {
  const props = feature.properties;
  const infoPanel = d3.select("#info-panel");
  infoPanel.html(""); // Clear old content

  infoPanel.append("h3").text(`DAUID: ${props.DAUID}`);
  infoPanel.append("p").text("Census Data:");

  const barContainer = infoPanel.append("div");
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
    max: 100, // show relative to 100
    format: d3.format(".1f")
  });
}

/***************************************************************
 * 4) STYLING & HIGHLIGHT
 ***************************************************************/
// Base style for polygons
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

// Common highlight style
function setHighlightStyle(layer) {
  layer.setStyle({
    weight: 2,
    color: "#000",
    opacity: 1
  });
  layer.bringToFront();
}

// Mouseover highlight
function highlightFeature(e) {
  setHighlightStyle(e.target);
}

// Reset highlight if not the active polygon
function resetHighlight(e) {
  if (previouslyHighlightedLayer === e.target) {
    // It's the active polygon, keep highlight
    return;
  }
  geoJsonLayer.resetStyle(e.target);
}

// On polygon click => set activeFeature, highlight, update panel
function clickFeature(e) {
  activeFeature = e.target.feature;
  highlightActiveFeature();
  updateInfoPanel(activeFeature);
}

// Re-apply highlight to the active polygon (if any)
function highlightActiveFeature() {
  if (activeFeature) {
    const da = activeFeature.properties.DAUID;
    const layer = featureLayerMap[da];
    if (layer) {
      // Reset old highlight
      if (previouslyHighlightedLayer && previouslyHighlightedLayer !== layer) {
        geoJsonLayer.resetStyle(previouslyHighlightedLayer);
      }
      // Highlight new
      setHighlightStyle(layer);
      previouslyHighlightedLayer = layer;
    }
  }
}

/***************************************************************
 * 5) LEGEND & LAYER SWITCH
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
    const [minVal, maxVal] = ds.colorScale.domain();

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

// Re-style polygons, highlight active, update legend
function updateMapStyle() {
  geoJsonLayer.setStyle(styleFeature);
  highlightActiveFeature();
  updateLegend();
}

/***************************************************************
 * 6) RESET ZOOM
 ***************************************************************/
function resetZoom() {
  map.setView(INITIAL_CENTER, INITIAL_ZOOM);
}
document.getElementById("resetZoom").addEventListener("click", resetZoom);

/***************************************************************
 * 7) SEARCH + TURF POINT-IN-POLYGON
 ***************************************************************/
// Restrict to Toronto bounding box (approx)
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

        // Place or update the search marker
        if (searchMarker) {
          map.removeLayer(searchMarker);
        }
        searchMarker = L.marker([lat, lon]).addTo(map);

        map.setView([lat, lon], 14);

        // If we have the raw data, do point-in-polygon
        if (!geoJsonData) return;
        const pt = turf.point([lon, lat]);

        let foundFeature = null;
        for (const f of geoJsonData.features) {
          if (turf.booleanPointInPolygon(pt, f)) {
            foundFeature = f;
            break;
          }
        }

        if (foundFeature) {
          activeFeature = foundFeature;
          highlightActiveFeature();
          updateInfoPanel(foundFeature);
        } else {
          alert("Coordinates not in any DA polygon. Possibly outside city boundary?");
        }
      } else {
        alert("No location found within Toronto. Try a different query.");
      }
    })
    .catch(err => {
      console.error("Error searching location:", err);
      alert("Error searching location. Check console for details.");
    });
}

// **Search button click**
document.getElementById("searchButton").addEventListener("click", searchLocation);

// **Enter/Return key in the search input**
document.getElementById("searchInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    searchLocation();
  }
});

/***************************************************************
 * 8) LOAD GEOJSON & INIT
 ***************************************************************/
d3.json("data/data.geojson").then(data => {
  geoJsonData = data;

  // Find city-wide maxima for the bar charts
  data.features.forEach(f => {
    const p = f.properties;
    maxValues.population_2016 
      = Math.max(maxValues.population_2016, p.population_2016 || 0);
    maxValues.pop_density_km2 
      = Math.max(maxValues.pop_density_km2, p.pop_density_km2 || 0);
    maxValues.median_income 
      = Math.max(maxValues.median_income, p.median_income || 0);
    maxValues.unemployment_rate
      = Math.max(maxValues.unemployment_rate, p.unemployment_rate || 0);
  });

  // Build color scales for each data set
  Object.keys(dataSets).forEach(key => {
    const ds = dataSets[key];
    const vals = data.features.map(ds.valueFunc);
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

  // Create the Leaflet GeoJSON layer
  geoJsonLayer = L.geoJson(data, {
    style: styleFeature,
    onEachFeature(feature, layer) {
      // Store reference for highlight
      const dauid = feature.properties.DAUID;
      featureLayerMap[dauid] = layer;

      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: clickFeature
      });
    }
  }).addTo(map);

  // Initial legend
  updateLegend();

  // When the user changes the dropdown
  d3.select("#data-toggle").on("change", () => {
    updateMapStyle();
  });

}).catch(err => {
  console.error("Error loading GeoJSON:", err);
});
