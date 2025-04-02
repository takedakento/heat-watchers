// Set up dimensions for the chart
const margin = { top: 50, right: 30, bottom: 50, left: 60 };
const width = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// Append SVG for chart
const svg = d3.select("#chart-container")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// Load CSV data
d3.csv("data/tor_urban_Weatherfile_Historical.csv").then(data => {
    // Parse and filter data for rainfall (RAIN_Mm) for two time periods
    const rainfallData = d3.rollups(data,
        v => d3.mean(v, d => +d.RAIN_Mm),
        d => (+d.YEAR <= 2005 ? "1991-2005" : "2006-2021"),
        d => +d.MONTH
    );

    // Convert nested structure to flat format
    const processedData = rainfallData.flatMap(([period, months]) =>
        months.map(([month, avgRain]) => ({ period, month, avgRain }))
    );

    // Define scales
    const xScale = d3.scaleBand()
        .domain(d3.range(1, 13))
        .range([0, width])
        .padding(0.2);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(processedData, d => d.avgRain)])
        .nice()
        .range([height, 0]);

    const colorScale = d3.scaleOrdinal()
        .domain(["1991-2005", "2006-2021"])
        .range(["#88c0d0", "#5e81ac"]); // Light & Dark Blue

    // Group data by month
    const groupedData = d3.groups(processedData, d => d.month);

    // Draw bars
    svg.selectAll(".bar-group")
        .data(groupedData)
        .enter()
        .append("g")
        .attr("transform", d => `translate(${xScale(d[0])},0)`)
        .selectAll("rect")
        .data(d => d[1])
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * (xScale.bandwidth() / 2))
        .attr("y", d => yScale(d.avgRain))
        .attr("width", xScale.bandwidth() / 2)
        .attr("height", d => height - yScale(d.avgRain))
        .attr("fill", d => colorScale(d.period));

    // Add axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).tickFormat(d => d3.timeFormat("%b")(new Date(2022, d - 1, 1))))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g").call(d3.axisLeft(yScale).ticks(6));

    // Add legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 150},${10})`);

    legend.selectAll("rect")
        .data(colorScale.domain())
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => colorScale(d));

    legend.selectAll("text")
        .data(colorScale.domain())
        .enter()
        .append("text")
        .attr("x", 20)
        .attr("y", (d, i) => i * 20 + 12)
        .text(d => d)
        .style("font-size", "12px");
});
