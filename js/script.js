// -------------------------------------------------------------
// 1) SETUP SVG & PROJECTION
// -------------------------------------------------------------
const width = 800, height = 600;
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

const projection = d3.geoMercator()
    .center([-79.38, 43.7])
    .scale(70000)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
svg.call(zoom);

function resetZoom() {
    svg.transition()
       .duration(750)
       .call(zoom.transform, d3.zoomIdentity);
}
d3.select("#resetZoom").on("click", resetZoom);

// -------------------------------------------------------------
// 2) TOOLTIP
// -------------------------------------------------------------
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

// -------------------------------------------------------------
// 3) LEGEND FUNCTION
// -------------------------------------------------------------
function drawLegend(domain, colorScale, labelFormatter = d3.format(".2f")) {
    svg.selectAll(".legend").remove();

    let defs = svg.select("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
    } else {
        defs.selectAll("#legend-gradient").remove();
    }

    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(domain[0]));
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(domain[1]));

    const legendWidth = 300;
    const legendHeight = 10;
    const legendGroup = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(20, ${height - 50})`);

    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    const legendScale = d3.scaleLinear()
        .domain(domain)
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(labelFormatter);

    legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);
}

// -------------------------------------------------------------
// 4) BAR CHART HELPER
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 5) UPDATE INFO PANEL
// -------------------------------------------------------------
function updateInfoPanel(d, maxValues) {
    const props = d.properties;
    const infoPanel = d3.select("#info-panel");
    infoPanel.html("");

    // Title
    infoPanel.append("h3").text(`Dissemination Area: ${props.DAUID}`);

    // Subheading
    infoPanel.append("p").text("Census Data:");

    const barContainer = infoPanel.append("div");

    // population_2016, pop_density_km2, median_income => use city-wide max
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

    // Unemployment rate displayed as fraction of 100
    // So a rate of 7.5 means 7.5% out of 100%
    drawBar(barContainer, {
      label: "Unemployment Rate (%)",
      value: props.unemployment_rate,
      max: 100, // fixed scale from 0 to 100
      format: d3.format(".1f")
    });
}

// -------------------------------------------------------------
// 6) DRAW MAP
// -------------------------------------------------------------
function drawMap(layerConfig, maxValues) {
    g.selectAll("path").remove();

    const data = layerConfig.data;
    const colorScale = layerConfig.colorScale;
    const valueFunc = layerConfig.valueFunc;
    const label = layerConfig.label;

    g.selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => colorScale(valueFunc(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            const val = valueFunc(d);
            tooltip
                .style("display", "block")
                .html(`<strong>${label}:</strong> ${val.toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");

            d3.select(event.currentTarget)
                .attr("stroke", "#000")
                .attr("stroke-width", 2);
        })
        .on("mouseout", (event) => {
            tooltip.style("display", "none");
            d3.select(event.currentTarget)
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5);
        })
        .on("click", (event, d) => {
            updateInfoPanel(d, maxValues);
        });

    drawLegend(colorScale.domain(), colorScale);
}

// -------------------------------------------------------------
// 7) LOAD SINGLE GEOJSON
// -------------------------------------------------------------
d3.json("data/data.geojson").then(myData => {

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
            label: "Access to Cooling Centers (Higher=Better)",
            valueFunc: d => 1 / Math.max(d.properties.cool_mean, 0.000001),
            colorScale: null
        },
        hospitalAccess: {
            label: "Access to Hospitals (Higher=Better)",
            valueFunc: d => 1 / Math.max(d.properties.hospital_mean, 0.000001),
            colorScale: null
        }
    };

    // Compute city-wide max for the other 3 fields (not unemployment)
    const maxValues = {
      population_2016: 0,
      pop_density_km2: 0,
      median_income: 0
    };
    // We'll keep track of unemployment in case you still want it
    // for other uses, but we won't use it to scale the bar.
    let maxUnemp = 0;

    myData.features.forEach(f => {
        const p = f.properties;
        maxValues.population_2016 = Math.max(maxValues.population_2016, p.population_2016 || 0);
        maxValues.pop_density_km2 = Math.max(maxValues.pop_density_km2, p.pop_density_km2 || 0);
        maxValues.median_income = Math.max(maxValues.median_income, p.median_income || 0);
        maxUnemp = Math.max(maxUnemp, p.unemployment_rate || 0);
    });

    // We'll store the unemployment city-wide max if you need it:
    maxValues.unemployment_rate = maxUnemp;

    // Build color scales for each layer
    Object.keys(dataSets).forEach(key => {
        const layer = dataSets[key];
        const values = myData.features.map(layer.valueFunc);
        const domain = d3.extent(values);

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

        layer.colorScale = d3.scaleSequential()
            .domain(domain)
            .interpolator(interpolator);

        layer.data = myData;
    });

    drawMap(dataSets.exposure, maxValues);

    d3.select("#data-toggle").on("change", function() {
        const selectedKey = this.value;
        drawMap(dataSets[selectedKey], maxValues);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});
