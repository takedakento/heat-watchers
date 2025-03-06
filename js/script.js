// Set up SVG dimensions
const width = 800, height = 600;
const svg = d3.select("#map").attr("width", width).attr("height", height);
const g = svg.append("g");  // Declare 'g' once

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

// Load the GeoJSON datasets concurrently
Promise.all([
    d3.json("data/pca_vuln_index.geojson"),
    d3.json("data/exposure_degree20.geojson")
]).then(([vulnData, exposureData]) => {
    // Define color scales
    const vulnColor = d3.scaleSequential(d3.interpolateReds)
        .domain(d3.extent(vulnData.features, d => d.properties.Heat_Vuln));
    
    const exposureDomain = d3.extent(exposureData.features, d => d.properties.SUM_temper);
    // You can choose a different color scheme for exposure if desired
    const exposureColor = d3.scaleSequential(d3.interpolateOranges).domain(exposureDomain);

    // Function to draw map based on provided dataset
    function drawMap(dataset, valueKey, colorScale, label) {
        // Remove any existing paths
        g.selectAll("path").remove();

        // Draw new paths
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
    }

    // Create a global tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("display", "none")
        .style("background", "white")
        .style("border", "1px solid #333")
        .style("padding", "5px")
        .style("border-radius", "5px");

    // Initially draw the vulnerability map
    drawMap(vulnData, "Heat_Vuln", vulnColor, "Heat Vulnerability");

    // Add a toggle dropdown for switching between datasets
    d3.select("#data-toggle").on("change", function() {
        const selection = this.value;
        if (selection === "vulnerability") {
            drawMap(vulnData, "Heat_Vuln", vulnColor, "Heat Vulnerability");
        } else {
            // For exposure, you might want to use a different color scale; here we use exposureColor
            drawMap(exposureData, "SUM_temper", exposureColor, "Heat Exposure (°C Days)");
        }
    });

    // Add a legend if desired (legend code can be updated similarly)
}).catch(error => {
    console.error("Error loading data:", error);
});
