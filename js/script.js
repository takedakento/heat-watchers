// -----------------------------------------------------------------
// 1) SETUP SVG & PROJECTION
// -----------------------------------------------------------------
const width = 800, height = 600;
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Group for drawing path shapes
const g = svg.append("g");

// Define a projection for Toronto
const projection = d3.geoMercator()
    .center([-79.38, 43.7])  // long, lat for Toronto
    .scale(70000)
    .translate([width / 2, height / 2]);

// Define a path generator
const path = d3.geoPath().projection(projection);

// Define zoom behavior
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

// -----------------------------------------------------------------
// 2) TOOLTIP
// -----------------------------------------------------------------
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip");

// -----------------------------------------------------------------
// 3) LEGEND FUNCTION
// -----------------------------------------------------------------
function drawLegend(domain, colorScale, labelFormatter = d3.format(".2f")) {
    // Remove any existing legend
    svg.selectAll(".legend").remove();

    // Create or select <defs> element
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

// -----------------------------------------------------------------
// 4) DRAW MAP FUNCTION
// -----------------------------------------------------------------
function drawMap(layerConfig) {
    // Remove existing paths
    g.selectAll("path").remove();

    const data = layerConfig.data;
    const colorScale = layerConfig.colorScale;
    const valueFunc = layerConfig.valueFunc;
    const label = layerConfig.label;

    // Draw polygons
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
                .html(`
                  <strong>DAUID:</strong> ${d.properties.DAUID}<br/>
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
        });

    // Update the legend
    drawLegend(colorScale.domain(), colorScale);
}

// -----------------------------------------------------------------
// 5) LOAD THE SINGLE GEOJSON (data/data.geojson)
// -----------------------------------------------------------------
d3.json("data/data.geojson").then(myData => {
    // We'll define the possible layers within the same dataset
    const dataSets = {
        exposure: {
            label: "Heat Exposure (°C Days)",
            valueFunc: d => d.properties.degree_days_20,  // 'degree_days_20'
            colorScale: null
        },
        canopy: {
            label: "Tree Canopy (%)",
            valueFunc: d => d.properties.canopy_percent,  // 'canopy_percent'
            colorScale: null
        },
        impervious: {
            label: "Impervious Surface (%)",
            valueFunc: d => d.properties.impervious_percent, // 'impervious_percent'
            colorScale: null
        },
        coolAccess: {
            label: "Access to Cooling Centers (Higher=Better)",
            // Invert distance so higher means better
            valueFunc: d => 1 / Math.max(d.properties.cool_mean, 0.000001),
            colorScale: null
        },
        hospitalAccess: {
            label: "Access to Hospitals (Higher=Better)",
            valueFunc: d => 1 / Math.max(d.properties.hospital_mean, 0.000001),
            colorScale: null
        }
    };

    // Create color scales for each layer
    Object.keys(dataSets).forEach(key => {
        const layer = dataSets[key];
        // Get all values from the features for domain
        const values = myData.features.map(layer.valueFunc);
        const domain = d3.extent(values);

        // Pick a color scheme
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

        // Attach the full GeoJSON for drawing
        layer.data = myData;
    });

    // Draw the initial layer (Heat Exposure by default)
    drawMap(dataSets.exposure);

    // Dropdown event to switch layers
    d3.select("#data-toggle").on("change", function() {
        const selectedKey = this.value;
        drawMap(dataSets[selectedKey]);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});
