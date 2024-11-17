import React, { useEffect, useRef } from 'react';
import { select, geoPath, geoMercator, geoCentroid, pointer } from 'd3';
import { feature } from 'topojson-client';
import boundaryData from './data/India ADM1 GeoBoundaries.json';

import tradeData from './data/grouped_trades_final_2.json';
import * as d3 from 'd3';

const ExactLocationMap = () => {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [currentTimeState, setCurrentTimeState] = React.useState(null);
  const [currentPosition, setCurrentPosition] = React.useState(null);

  // First useEffect for initialization
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    // Get timeKeys once
    const timeKeys = Object.keys(tradeData).sort();
    const startTime = parseInt(timeKeys[0]);
    const endTime = parseInt(timeKeys[timeKeys.length - 1]);

    // Find first timestamp with trades
    if (!currentPosition && timeKeys.length > 0) {
      const firstTradeTime = timeKeys.find(time => tradeData[time] && tradeData[time].length > 0);
      const width = wrapperRef.current.clientWidth;
      const padding = 0.15;
      const paddedWidth = width * (1 - padding);
      const timelineWidth = paddedWidth;
      
      // Calculate initial position based on first trade
      const initialPosition = ((firstTradeTime - startTime) / (endTime - startTime)) * timelineWidth;
      
      // Set initial states
      setCurrentPosition(initialPosition);
      setCurrentTimeState(firstTradeTime);
    }
  }, []); // Run once on mount

  // Main useEffect for rendering
  useEffect(() => {
    if (!svgRef.current || !wrapperRef.current) return;

    // Directly convert TopoJSON to GeoJSON
    const geojson = feature(
      boundaryData, 
      boundaryData.objects[Object.keys(boundaryData.objects)[0]]
    );
    
    if (!geojson) {
      console.error('Failed to convert TopoJSON to GeoJSON');
      return;
    }

    // Calculate the centroid using the converted GeoJSON
    const centroid = geoCentroid(geojson);

    // Clear previous content
    select(svgRef.current).selectAll("*").remove();

    // Set up dimensions
    const width = wrapperRef.current.clientWidth;
    const padding = 0.15;
    const timelineHeight = 100;
    const spacingFromMap = 60; // Spacing between map and timeline

    // Calculate the padded dimensions
    const paddedWidth = width * (1 - padding);
    const paddedHeight = window.innerHeight * 0.9 * (1 - padding);
    const paddingHeight = window.innerHeight * 0.9 * padding;

    const totalHeight = window.innerHeight * 0.9 + timelineHeight + spacingFromMap; // Total height including space for timeline

    // Create SVG
    const svg = select(svgRef.current)
      .attr("width", width)
      .attr("height", totalHeight)
      .style("background-color", "#02020A");

    // Add shadow filter definition
    const defs = svg.append("defs");
    
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("width", "400%")
      .attr("height", "400%")
      .attr("x", "-100%")
      .attr("y", "-100%");
    
    filter.append("feGaussianBlur")
      .attr("class", "blur")
      .attr("stdDeviation", "6")
      .attr("result", "coloredBlur");
    
    filter.append("feFlood")
      .attr("flood-color", "#FAB726")
      .attr("flood-opacity", "0.5")
      .attr("result", "glowColor");
    
    filter.append("feComposite")
      .attr("in", "glowColor")
      .attr("in2", "coloredBlur")
      .attr("operator", "in")
      .attr("result", "softGlow_colored");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode")
      .attr("in", "softGlow_colored");
    feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");

    // Create map group with adjusted position
    const mapGroup = svg.append("g")
      .attr("transform", `translate(${(width - paddedWidth) / 2}, ${paddingHeight / 2})`);

    // Create projection and path generator first
    const projection = geoMercator()
      .center(centroid)
      .fitSize([paddedWidth, paddedHeight], geojson);

    const pathGenerator = geoPath().projection(projection);

    // Create groups for paths and circles
    const pathsGroup = mapGroup.append("g")
      .attr("class", "paths-group");

    const circlesGroup = mapGroup.append("g")
      .attr("class", "circles-group");

    // Comment out or remove tooltip creation
    /*
    const tooltip = select(wrapperRef.current)
      .append("div")
      .attr("class", "absolute hidden")
      .style("position", "fixed")
      .style("background-color", "rgba(10, 9, 48, 0.95)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "6px")
      .style("font-size", "14px")
      .style("pointer-events", "none")
      .style("z-index", "9999")
      .style("font-family", "Inter, sans-serif")
      .style("border", "1px solid #2D2D64")
      .style("box-shadow", "0 4px 6px rgba(0, 0, 0, 0.3)")
      .style("transform", "translate(-50%, -100%)")  // Center horizontally and position above cursor
      .style("margin-top", "-10px");  // Add some space between tooltip and cursor
    */

    // Now render the map paths
    pathsGroup.selectAll("path")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("d", pathGenerator)
      .attr("fill", "#0A0930")
      .attr("stroke", "#2D2D64")
      .attr("stroke-width", 0.5)
      .attr("class", "district")
      .attr("id", d => d.properties.shapeName);

    // Set up time variables using the new data structure
    const timeKeys = Object.keys(tradeData).sort();
    const startTime = parseInt(timeKeys[0]);
    const endTime = parseInt(timeKeys[timeKeys.length - 1]);
    let currentTime = startTime;

    // Display current time
    const timeDisplay = svg.append("text")
      .attr("x", 20)
      .attr("y", 40)
      .attr("font-size", "24px")
      .attr("fill", "white")
      .attr("font-family", "Inter, sans-serif");

    // Get the actual rendered width of the map
    const mapBBox = mapGroup.node().getBBox();
    const renderedWidth = mapBBox.width;

    // Calculate the center position
    const centerX = width / 2;
    const timelineX = centerX - (renderedWidth / 2);
    
    const timelineWidth = renderedWidth;
    
    // Define renderCircle function
    const renderCircle = (trade) => {
      const { location, buy_sell, amount } = trade;
      if (location && location.latitude && location.longitude) {
        const coordinates = projection([
          parseFloat(location.longitude),
          parseFloat(location.latitude),
        ]);

        if (coordinates) {
          // Set color based on buy/sell
          const circleColor = buy_sell === 'S' ? '#5D43E6' : '#FAB726';

          // Create a log scale for radius
          const radiusScale = d3.scaleLog()
            .domain([1, 123499]) // Using 1 instead of 0 as log(0) is undefined
            .range([1, 14])
            .clamp(true); // Clamp values to the range

          // Handle zero amount separately
          const radius = amount === 0 ? 1 : radiusScale(amount);

          // Update the filter color for the glow based on trade type
          filter.select("feFlood")
            .attr("flood-color", circleColor);

          circlesGroup.append("circle")
            .attr("cx", coordinates[0])
            .attr("cy", coordinates[1])
            .attr("r", radius)
            .attr("fill", circleColor)
            .attr("opacity", 1)
            .attr("filter", "url(#glow)")
            .style("mix-blend-mode", "screen");
        }
      }
    };

    // Create timeline group
    const timelineGroup = svg.append("g")
      .attr("transform", `translate(${timelineX}, ${totalHeight-paddingHeight})`);

    // Add timeline background bar
    const timelineBar = timelineGroup.append("rect")
      .attr("width", timelineWidth)
      .attr("height", 8)
      .attr("fill", "#2e2e2e")
      .attr("rx", 4)
      .style("cursor", "pointer");

    // Add slider handle
    const handle = timelineGroup.append("circle")
      .attr("r", 8)
      .attr("fill", "#FFFFFF")
      .attr("cy", 4)
      .attr("cx", 0)
      .style("cursor", "pointer");

    // Add timestamp display group
    const timestampDisplay = timelineGroup.append("g")
      .attr("class", "timestamp-display")
      .attr("transform", "translate(0, -20)");

    // Add white background rectangle for timestamp
    const timeBackground = timestampDisplay.append("rect")
      .attr("fill", "white")
      .attr("opacity",0.1)
      .attr("rx", 8)
      .attr("ry", 8);

    // Add timestamp text
    const timeText = timestampDisplay.append("text")
      .attr("fill", "#ffffff")
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-family", "Inter, sans-serif")
      .attr("dominant-baseline", "central")
      .attr("alignment-baseline", "central");

    // Add time labels with Inter font
    timelineGroup.append("text")
      .attr("x", 0)
      .attr("y", 30)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .attr("font-family", "Inter, sans-serif")
      .attr("text-anchor", "start")
      .text(new Date(startTime).toLocaleTimeString([], { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));

    timelineGroup.append("text")
      .attr("x", timelineWidth)
      .attr("y", 30)
      .attr("fill", "white")
      .attr("font-size", "12px")
      .attr("font-family", "Inter, sans-serif")
      .attr("text-anchor", "end")
      .text(new Date(endTime).toLocaleTimeString([], { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }));

    // Function to update visualization based on position
    const updatePosition = (position) => {
      // Constrain position to timeline width
      const constrainedPosition = Math.max(0, Math.min(position, timelineWidth));
      
      // Update handle position
      handle.attr("cx", constrainedPosition);
      
      // Calculate time based on position
      const timePosition = constrainedPosition / timelineWidth;
      const currentTime = Math.round(startTime + (endTime - startTime) * timePosition);
      
      // Find nearest available timestamp
      const nearestTime = timeKeys.reduce((prev, curr) => {
        return Math.abs(curr - currentTime) < Math.abs(prev - currentTime) ? curr : prev;
      });

      // Update state
      setCurrentTimeState(nearestTime);
      setCurrentPosition(constrainedPosition);
      
      // Clear and render new circles
      circlesGroup.selectAll("circle").remove();
      if (tradeData[nearestTime]) {
        tradeData[nearestTime].forEach(trade => renderCircle(trade));
      }

      // Create time string for display
      const timeString = new Date(parseInt(nearestTime)).toLocaleTimeString([], { 
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });

      // Update timestamp text and position
      timeText
        .attr("x", constrainedPosition)
        .text(timeString);

      // Get text dimensions
      const textBBox = timeText.node().getBBox();
      // Update background rectangle size and position
      timeBackground
        .attr("x", constrainedPosition - (textBBox.width / 2) - 12)
        .attr("y", -textBBox.height - 8) // Adjust vertical position
        .attr("width", textBBox.width + 24)
        .attr("height", textBBox.height + 16);

      // Position text vertically centered in background
      timeText
        .attr("y", -(textBBox.height / 2));

      // Move timestamp display group
      timestampDisplay
        .attr("transform", `translate(0, -20)`);
    };

    // Set up drag behavior
    const drag = d3.drag()
      .on("start", function() {
        const handle = d3.select(this);
        handle.style("cursor", "grabbing");
        // Store initial position
        handle.attr("data-x", handle.attr("cx"));
      })
      .on("drag", function(event) {
        const handle = d3.select(this);
        // Get stored position and add the change in x
        const currentX = parseFloat(handle.attr("data-x")) || 0;
        const newX = currentX + event.dx;
        
        // Constrain position within timeline bounds
        const position = Math.max(0, Math.min(newX, timelineWidth));
        
        // Store new position
        handle.attr("data-x", position);
        
        updatePosition(position);
      })
      .on("end", function() {
        const handle = d3.select(this);
        handle.style("cursor", "grab");
        // Clean up stored position
        handle.attr("data-x", null);
      });

    // Apply drag only to handle
    handle
      .style("cursor", "grab")
      .call(drag);

    // Separate click handler for timeline bar
    timelineBar
      .style("cursor", "pointer")
      .on("click", function(event) {
        if (event.defaultPrevented) return;
        
        const [xPos] = d3.pointer(event, this);
        const position = Math.max(0, Math.min(xPos, timelineWidth));
        updatePosition(position);
      });

    // Disable pointer events on circles to prevent interference
    circlesGroup.style("pointer-events", "none");

    // Initial position update if we have one
    if (currentPosition !== null) {
      updatePosition(currentPosition);
    }

    // Cleanup
    return () => {
      handle.on(".drag", null);
      timelineBar.on("click", null);
    };
  }, [currentTimeState, currentPosition]); // Dependencies

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div 
        ref={wrapperRef} 
        className="relative w-full"
        style={{ position: 'relative' }}
      >
        <svg
          ref={svgRef}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        />
      </div>
    </div>
  );
};

export default ExactLocationMap;