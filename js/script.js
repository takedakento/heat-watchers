// -------------------------------------------------------------
// 1) SETUP SVG & PROJECTION
// -------------------------------------------------------------
const width = 800, height = 600;
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Main group for drawing geometry
const g = svg.append("g");

// Define a projection for Toronto
const projection = d3.geoMercator()
    .center([-79.38, 43.7])  // approximate center of Toronto
    .scale(70000)
    .translate([width / 2, height / 2]);

// Path generator using our projection
const path = d3.geoPath().projection(projection);

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
svg.call(zoom);

// Reset zoom function
function resetZoom() {
    svg.transition()
       .duration(750)
       .call(zoom.transform, d3.zoomIdentity);
}
d3.select("#resetZoom").on("click", resetZoom);

// -------------------------------------------------------------
// 2) TOOLTIP (FOR HOVER)
// -------------------------------------------------------------
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip");

// -------------------------------------------------------------
// 3) LEGEND FUNCTION
// -------------------------------------------------------------
function drawLegend(domain, colorScale, labelFormatter = d3.format(".2f")) {
    // Remove any existing legend
    svg.selectAll(".legend").remove();

    // Create or select <defs> for gradient
    let defs = svg.select("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
    } else {
        defs.selectAll("#legend-gradient").remove();
    }

    // Append linearGradient for the legend
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
// 4) BAR CHART HELPERS
// -------------------------------------------------------------
/**
 * Draws a horizontal bar chart for a single variable.
 * @param {d3.Selection} container - The HTML container to append chart to.
 * @param {Object} config - An object describing the bar to draw:
 *   {
 *     label: "Population",
 *     value: 12000,
 *     max: 50000,  // max city-wide
 *     format: d3.format(",") // optional
 *   }
 */
function drawBarChart(container, config) {
    const barWidth = 300;
    const barHeight = 20;

    // If no value or value is zero
    const val = config.value || 0;
    const maxVal = config.max || 1;

    // Create a wrapper div
    const barDiv = container.append("div")
      .attr("class", "bar-chart");

    // Label
    barDiv.append("div")
      .attr("class", "bar-label")
      .text(config.label + ": ");

    // We'll place the numeric text next to label
    barDiv.append("span")
      .text((config.format ? config.format(val) : val))
      .style("margin-left", "5px");

    // Add an SVG for the bar
    const svgBar = barDiv.append("svg")
      .attr("width", barWidth)
      .attr("height", barHeight);

    // Scale for the bar's length
    const xScale = d3.scaleLinear()
      .domain([0, maxVal])
      .range([0, barWidth]);

    // Background rect
    svgBar.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", barWidth)
      .attr("height", barHeight)
      .attr("fill", "#ddd");

    // Filled rect
    svgBar.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", xScale(val))
      .attr("height", barHeight)
      .attr("fill", "#69b3a2");
}

// -------------------------------------------------------------
// 5) UPDATE INFO PANEL (ON CLICK)
// -------------------------------------------------------------
function updateInfoPanel(d, maxValues) {
    const props = d.properties;
    const infoPanel = d3.select("#info-panel");
    infoPanel.html("");

    infoPanel.append("h3").text(`Dissemination Area: ${props.DAUID}`);

    // Create sub-heading
    infoPanel.append("p").text("Census Data:");

    // We'll render bar charts for these variables:
    // population_2016, pop_density_km2, median_income, unemployment_rate
    // The max values are pre-calculated city-wide maximums

    // Create a container for bar charts
    const barContainer = infoPanel.append("div");

    drawBarChart(barContainer, {
      label: "Population (2016)",
      value: props.population_2016,
      max: maxValues.population_2016,
      format: d3.format(",")
    });

    drawBarChart(barContainer, {
      label: "Pop. Density (per km²)",
      value: props.pop_density_km2,
      max: maxValues.pop_density_km2,
      format: d3.format(".1f")
    });

    drawBarChart(barContainer, {
      label: "Median Income ($)",
      value: props.median_income,
      max: maxValues.median_income,
      format: d3.format(",") // e.g., 50,000
    });

    drawBarChart(barContainer, {
      label: "Unemployment Rate (%)",
      value: props.unemployment_rate,
      max: maxValues.unemployment_rate,
      format: d3.format(".1f")
    });
}

// -------------------------------------------------------------
// 6) DRAW MAP FUNCTION
// -------------------------------------------------------------
function drawMap(layerConfig, maxValues) {
    // Clear existing paths
    g.selectAll("path").remove();

    const data = layerConfig.data;
    const colorScale = layerConfig.colorScale;
    const valueFunc = layerConfig.valueFunc;
    const label = layerConfig.label;

    // Render polygons
    g.selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => colorScale(valueFunc(d)))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            // Show tooltip for the selected layer only
            const val = valueFunc(d);
            tooltip
                .style("display", "block")
                .html(`
                    <strong>${label}:</strong> ${val.toFixed(2)}
                `)
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
            // Show more detailed info in the panel
            updateInfoPanel(d, maxValues);
        });

    // Draw the legend
    drawLegend(colorScale.domain(), colorScale);
}

// -------------------------------------------------------------
// 7) LOAD THE SINGLE GEOJSON
// -------------------------------------------------------------
d3.json("data/data.geojson").then(myData => {
    // We'll define the layers (exposure, canopy, etc.) in an object
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

    // Precompute city-wide max values for the 4 census fields we want to chart
    // We'll iterate over all features in myData
    const maxValues = {
      population_2016: 0,
      pop_density_km2: 0,
      median_income: 0,
      unemployment_rate: 0
    };

    myData.features.forEach(f => {
        const p = f.properties;
        maxValues.population_2016 = Math.max(maxValues.population_2016, p.population_2016 || 0);
        maxValues.pop_density_km2 = Math.max(maxValues.pop_density_km2, p.pop_density_km2 || 0);
        maxValues.median_income = Math.max(maxValues.median_income, p.median_income || 0);
        maxValues.unemployment_rate = Math.max(maxValues.unemployment_rate, p.unemployment_rate || 0);
    });

    // Create color scales for each layer
    Object.keys(dataSets).forEach(key => {
        const layer = dataSets[key];
        const values = myData.features.map(layer.valueFunc);
        const domain = d3.extent(values);

        // Choose color scheme
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

    // Draw the initial layer (Heat Exposure)
    drawMap(dataSets.exposure, maxValues);

    // Dropdown event
    d3.select("#data-toggle").on("change", function() {
        const selectedKey = this.value;
        drawMap(dataSets[selectedKey], maxValues);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});
