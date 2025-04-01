// -------------------------------------------------------------
// 1) SETUP SVG & PROJECTION
// -------------------------------------------------------------
const width = 800, height = 600;
const svg = d3.select("#map")
    .attr("width", width)
    .attr("height", height);

// Main group for drawing paths (shapes)
const g = svg.append("g");

// Define a projection for Toronto (approx. center/scale)
const projection = d3.geoMercator()
    .center([-79.38, 43.7]) // longitude, latitude
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

// Function to reset zoom
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
    // Remove any existing legend
    svg.selectAll(".legend").remove();

    // Create (or select) <defs> for gradient
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
// 4) DRAW MAP FUNCTION
// -------------------------------------------------------------
function drawMap(dataset) {
    // Remove existing paths
    g.selectAll("path").remove();

    // Extract relevant references
    const data = dataset.data;
    const colorScale = dataset.colorScale;
    const valueFunc = dataset.valueFunc;
    const label = dataset.label;

    // Draw map boundaries
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

    // Update legend
    drawLegend(colorScale.domain(), colorScale);
}

// -------------------------------------------------------------
// 5) LOAD ALL DATASETS
// -------------------------------------------------------------
Promise.all([
    d3.json("data/pca_vuln_index.geojson"),    // [0] Heat Vulnerability
    d3.json("data/exposure_degree20.geojson"), // [1] Heat Exposure
    d3.json("data/canopy_cover.geojson"),      // [2] Tree Canopy
    d3.json("data/impervious_percentage.geojson"), // [3] Impervious Surface
    d3.json("data/access_cool.geojson"),       // [4] Access to Cooling
    d3.json("data/access_hospital.geojson")    // [5] Access to Hospitals
]).then(([vulnData, exposureData, canopyData, impervData, coolData, hospData]) => {

    // Create a central object to hold data & config for each layer
    const dataSets = {
        vulnerability: {
            data: vulnData,
            label: "Heat Vulnerability",
            valueFunc: d => d.properties.Heat_Vuln, 
            // We'll define colorScale after computing domain
            colorScale: null
        },
        exposure: {
            data: exposureData,
            label: "Heat Exposure (°C Days)",
            valueFunc: d => d.properties.SUM_temper,
            colorScale: null
        },
        canopy: {
            data: canopyData,
            label: "Tree Canopy (%)",
            valueFunc: d => d.properties.canopy_per, // 'canopy_per'
            colorScale: null
        },
        impervious: {
            data: impervData,
            label: "Impervious Surface (%)",
            valueFunc: d => d.properties.imper_coun, // 'imper_coun'
            colorScale: null
        },
        coolAccess: {
            data: coolData,
            label: "Cooling Center Access (Higher=Better)",
            // Invert the distance so higher values => better
            valueFunc: d => 1 / Math.max(d.properties.MEAN, 0.000001),
            colorScale: null
        },
        hospitalAccess: {
            data: hospData,
            label: "Hospital Access (Higher=Better)",
            // Invert the distance so higher values => better
            valueFunc: d => 1 / Math.max(d.properties.MEAN, 0.000001),
            colorScale: null
        }
    };

    // ---------------------------------------------------------
    // Create color scales for each dataset
    // We use d3.extent on the "valueFunc" to find min & max
    // ---------------------------------------------------------
    Object.keys(dataSets).forEach(key => {
        const ds = dataSets[key];
        const values = ds.data.features.map(ds.valueFunc);
        const domain = d3.extent(values);

        // Choose a suitable color scheme for each layer
        let interpolator;
        switch (key) {
            case "vulnerability":
                interpolator = d3.interpolateReds;
                break;
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

    // ---------------------------------------------------------
    // INITIAL DRAW: Default to Heat Vulnerability
    // ---------------------------------------------------------
    drawMap(dataSets.vulnerability);

    // ---------------------------------------------------------
    // DROPDOWN EVENT: Update map based on selected layer
    // ---------------------------------------------------------
    d3.select("#data-toggle").on("change", function() {
        const selectedKey = this.value; 
        drawMap(dataSets[selectedKey]);
    });

}).catch(error => {
    console.error("Error loading data:", error);
});
