/***************************************************************
 * 1) LEAFLET MAP + OSM BASEMAP
 ***************************************************************/
const map = L.map("map").setView([43.7, -79.38], 11); // Toronto center, zoom 11

L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 
  {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
  }
).addTo(map);

/***************************************************************
 * 2) GLOBAL VARIABLES & SCALES
 ***************************************************************/
// We'll store the Leaflet GeoJSON layer so we can re-style it on demand
let geoJsonLayer;

// Data sets (5 layers)
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
    // Invert distance so shorter distance => higher
    valueFunc: d => 1 / Math.max(d.properties.cool_mean, 0.000001),
    colorScale: null
  },
  hospitalAccess: {
    label: "Access to Hospitals (Higher=Better)",
    valueFunc: d => 1 / Math.max(d.properties.hospital_mean, 0.000001),
    colorScale: null
  }
};

// For bar charts, we want city-wide max values (except unemployment uses 100)
const maxValues = {
  population_2016: 0,
  pop_density_km2: 0,
  median_income: 0,
  unemployment_rate: 0 // We'll store the city-wide max but use 100 for the bar
};

/***************************************************************
 * 3) SIMPLE BAR CHART (FOR INFO PANEL)
 ***************************************************************/
function drawBar(container, config) {
  const val = config.value || 0;
  const maxVal = config.max || 1;
  const frac = Math.min(val / maxVal, 1); // clamp 0..1

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
 * 4) INFO PANEL ON CLICK
 ***************************************************************/
function updateInfoPanel(feature) {
  const props = feature.properties;
  const infoPanel = d3.select("#info-panel");
  infoPanel.html("");

  // Title
  infoPanel.append("h3").text(`DAUID: ${props.DAUID}`);

  infoPanel.append("p").text("Census Data:");
  const barContainer = infoPanel.append("div");

  // 1) Population
  drawBar(barContainer, {
    label: "Population (2016)",
    value: props.population_2016,
    max: maxValues.population_2016,
    format: d3.format(",")
  });

  // 2) Pop Density
  drawBar(barContainer, {
    label: "Pop. Density (per km²)",
    value: props.pop_density_km2,
    max: maxValues.pop_density_km2,
    format: d3.format(".1f")
  });

  // 3) Median Income
  drawBar(barContainer, {
    label: "Median Income ($)",
    value: props.median_income,
    max: maxValues.median_income,
    format: d3.format(",")
  });

  // 4) Unemployment Rate => Use 0..100 scale
  drawBar(barContainer, {
    label: "Unemployment Rate (%)",
    value: props.unemployment_rate,
    max: 100, // fixed range from 0..100
    format: d3.format(".1f")
  });
}

/***************************************************************
 * 5) STYLE FUNCTION (SEMI-TRANSPARENT)
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

// Hover highlight
function highlightFeature(e) {
  const layer = e.target;
  layer.setStyle({
    weight: 2,
    color: "#000",
    opacity: 1
  });
  layer.bringToFront();
}

// Reset highlight
function resetHighlight(e) {
  geoJsonLayer.resetStyle(e.target);
}

// Click => info panel
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
 * 6) UPDATE MAP STYLE & LEGEND
 ***************************************************************/
function updateMapStyle() {
  // Restyle polygons
  geoJsonLayer.setStyle(styleFeature);
  // Update the continuous gradient legend
  updateLegend();
}

/***************************************************************
 * 7) CONTINUOUS GRADIENT LEGEND (NO BREAKS)
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

    // Title
    div.innerHTML = `<h4>${ds.label}</h4>`;

    // A single gradient bar from minVal color to maxVal color
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
 * 8) LOAD GEOJSON & INITIALIZE
 ***************************************************************/
d3.json("data/data.geojson").then(data => {
  const features = data.features;

  // Find city-wide max for 3 fields (the 4th is unemployment -> 100%):
  features.forEach(f => {
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
    onEachFeature: onEachFeature
  }).addTo(map);

  // Initial legend
  updateLegend();

  // Dropdown event
  d3.select("#data-toggle").on("change", () => {
    updateMapStyle();
  });

}).catch(err => {
  console.error("Error loading data:", err);
});
