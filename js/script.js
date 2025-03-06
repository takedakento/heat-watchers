// Set up SVG dimensions
const width = 800, height = 600;
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Create a group inside the SVG for the map
const g = svg.append("g");

// Define a projection for Toronto (Mercator projection)
const projection = d3.geoMercator()
    .center([-79.38, 43.7])  // Center on Toronto (longitude, latitude)
    .scale(70000)           // Adjust scale to fit Toronto
    .translate([width / 2, height / 2]);

// Create a path generator
const path = d3.geoPath().projection(projection);

// Define zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])  // Allows zooming between 1x and 8x
    .on("zoom", (event) => {
        g.attr("transform", event.transform);  // Move the map when zooming
    });

// Apply zoom behavior to the SVG
svg.call(zoom);

// Function to reset zoom
function resetZoom() {
    svg.transition()
        .duration(750) // Smooth transition
        .call(zoom.transform, d3.zoomIdentity); // Reset to original scale and position
}

// Attach event listener to the Reset Zoom button
d3.select("#resetZoom").on("click", resetZoom);

// Create a global tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("background", "white")
    .style("border", "1px solid #333")
    .style("padding", "5px")
    .style("border-radius", "5px");

// Function to draw the legend
function drawLegend(domain, colorScale) {
    // Remove any existing legend
    svg.selectAll(".legend").remove();

    // Create (or select) the defs element
    let defs = svg.select("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
    } else {
        defs.selectAll("#legend-gradient").remove();
    }

    // Append a linearGradient for the legend
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

    const legendWidth = 300, legendHeight = 10;
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
        .tickFormat(d3.format(".2f"));

    legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);
}

// Function to draw the map based on the provided dataset
function drawMap(dataset, valueKey, colorScale, label) {
    // Remove existing paths
    g.selectAll("path").remove();

    // Draw map boundaries
    g.selectAll("path")
        .data(dataset.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => colorScale(d.properties[valueKey]))
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(`<strong>DAUID:</strong> ${d.properties.DAUID}<br>
                       <strong>${label}:</strong> ${d.properties[valueKey].toFixed(2)}`)
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

    // Draw the legend for the current dataset
    drawLegend(d3.extent(dataset.features, d => d.properties[valueKey]), colorScale);
}

// Load the GeoJSON datasets concurrently
Promise.all([
    d3.json("data/pca_vuln_index.geojson"),
    d3.json("data/exposure_degree20.geojson")
]).then(([vulnData, exposureData]) => {
    // Define color scales for each dataset
    const vulnExtent = d3.extent(vulnData.features, d => d.properties.Heat_Vuln);
    const vulnColor = d3.scaleSequential(d3.interpolateReds).domain(vulnExtent);

    const exposureExtent = d3.extent(exposureData.features, d => d.properties.SUM_temper);
    const exposureColor = d3.scaleSequential(d3.interpolateOranges).domain(exposureExtent);

    // Initially draw the vulnerability map
    drawMap(vulnData, "Heat_Vuln", vulnColor, "Heat Vulnerability");

    // Attach event listener to the dropdown to toggle between datasets
    d3.select("#data-toggle").on("change", function() {
        const selection = this.value;
        if (selection === "vulnerability") {
            drawMap(vulnData, "Heat_Vuln", vulnColor, "Heat Vulnerability");
        } else {
            drawMap(exposureData, "SUM_temper", exposureColor, "Heat Exposure (°C Days)");
        }
    });
}).catch(error => {
    console.error("Error loading data:", error);
});
