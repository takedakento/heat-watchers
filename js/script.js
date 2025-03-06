// Set up SVG dimensions
const width = 800;
const height = 600;

// Create an SVG element
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Define a projection for Toronto (Mercator projection)
const projection = d3.geoMercator()
    .center([-79.38, 43.7]) // Center on Toronto (longitude, latitude)
    .scale(70000)  // Adjust scale to fit Toronto
    .translate([width / 2, height / 2]);

// Create a path generator
const path = d3.geoPath().projection(projection);

// Load the GeoJSON data
d3.json("data/pca_vuln_index.geojson").then(data => {
    console.log("GeoJSON Loaded:", data); // Debugging: Check if the file loads correctly

    // Get min and max Heat_Vuln values
    const heatVulnExtent = d3.extent(data.features, d => d.properties.Heat_Vuln);
    
    // Define a color scale (blue = low vulnerability, red = high vulnerability)
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain(heatVulnExtent); // Scale based on min/max values

    // Draw map boundaries with color-coding
    svg.selectAll("path")
        .data(data.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", d => colorScale(d.properties.Heat_Vuln)) // Apply color based on Heat_Vuln
        .attr("stroke", "#333") // Outline color
        .attr("stroke-width", 0.5);
}).catch(error => {
    console.error("Error loading the GeoJSON file:", error);
});
