// Set up dimensions and margins
const margin = { top: 20, right: 30, bottom: 50, left: 50 };
const width = 800 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

// Append SVG for the line chart
const svg = d3.select("#lineChart")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Load and process the temperature data
d3.csv("data/tor_urban_Weatherfile_Historical.csv").then(data => {
    // Parse data: Convert YEAR and TEMP_K (Kelvin) to Celsius
    data.forEach(d => {
        d.YEAR = +d.YEAR; // Convert to numeric
        d.TEMP_C = +d.TEMP_K - 273.15; // Convert Kelvin to Celsius
    });

    // Aggregate data by year to compute average temperature
    const avgTempByYear = d3.rollups(data, v => d3.mean(v, d => d.TEMP_C), d => d.YEAR);

    // Convert to array format for D3
    const formattedData = avgTempByYear.map(d => ({ year: d[0], temp: d[1] }));

    // Define scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(formattedData, d => d.year))
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([d3.min(formattedData, d => d.temp) - 1, d3.max(formattedData, d => d.temp) + 1])
        .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format("d")).ticks(10);
    const yAxis = d3.axisLeft(yScale);

    // Append X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    // Append Y axis
    svg.append("g").call(yAxis);

    // Add axis labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .text("Year")
        .attr("font-size", "14px");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("Temp °C")
        .attr("font-size", "14px");

    // Define the line generator
    const line = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d.temp))
        .curve(d3.curveMonotoneX); // Smooth the line

    // Append the line path
    svg.append("path")
        .datum(formattedData)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", line);

});
