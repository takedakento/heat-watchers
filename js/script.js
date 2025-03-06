// Set up SVG dimensions
const width = 800;
const height = 600;

// Create an SVG element with a group (`g`) for zooming
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Create a group inside the SVG for the map
const g = svg.append("g");

// Define a projection for Toronto (Mercator projection)
const projection = d3.geoMercator()
    .center([-79.38, 43.7]) // Center on Toronto (longitude, latitude)
    .scale(70000)  // Adjust scale to fit Toronto
    .translate([width / 2, height / 2]);

// Create a path generator
const path = d3.geoPath().projection(projection);

// Define zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 8])  // Allows zooming between 1x and 8x
    .on("zoom", (event) => {
        g.attr("transform", event.transform);  // Moves the map when zooming
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

// Load the GeoJSON data
d3.json("data/pca_vuln_index.geojson").then(data => {
    console.log("GeoJSON Loaded:", data);

    // Get min and max Heat_Vuln values
    const heatVulnExtent = d3.extent(data.features, d => d.properties.Heat_Vuln);
    
    // Define a color scale (low = light red, high = dark red)
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain(heatVulnExtent);

    // Create a tooltip div (hidden by default)
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #333")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("display", "none");

    // Draw map boundaries inside the `g` group (so zoom affects it)
    g.selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => colorScale(d.properties.Heat_Vuln)) // Apply color based on Heat_Vuln
        .attr("stroke", "#333") // Outline color
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .html(`<strong>DAUID:</strong> ${d.properties.DAUID}<br>
                       <strong>Heat Vulnerability:</strong> ${d.properties.Heat_Vuln.toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            d3.select(event.currentTarget)
                .attr("stroke", "black")
                .attr("stroke-width", 2);
        })
        .on("mouseout", (event, d) => {
            tooltip.style("display", "none");
            d3.select(event.currentTarget)
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5);
        });

    // Add a legend
    const legendWidth = 300;
    const legendHeight = 10;

    const legendSvg = svg.append("g")
        .attr("transform", `translate(20, ${height - 50})`);

    const legendScale = d3.scaleLinear()
        .domain(heatVulnExtent)
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format(".2f"));

    // Gradient for the legend
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%").attr("y1", "0%")
        .attr("x2", "100%").attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateReds(0));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateReds(1));

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    legendSvg.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);
}).catch(error => {
    console.error("Error loading the GeoJSON file:", error);
});
