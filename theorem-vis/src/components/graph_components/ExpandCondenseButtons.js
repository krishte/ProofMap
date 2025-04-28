import React, { useState, useRef, useEffect } from "react";
import * as d3 from "d3";

function ExpandCondenseButtons({ simulationRef, containerRef }) {
  const [searchQuery, setSearchQuery] = useState("");
  const inputWrapperRef = useRef(null);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const svg = d3.select(containerRef.current).select("svg");
    if (svg.empty()) return;

    // grab all your node <foreignObject>s
    const nodes = svg.selectAll(".node");

    if (!searchQuery) {
      // no query → reset all borders
      nodes.style("outline", "1px solid #ccc");
      return;
    }

    const q = searchQuery.toLowerCase();

    // 1) reset every node first
    nodes.style("outline", "1px solid #ccc");

    const stripAccents = (str) =>
      str
        .normalize("NFD") // decompose combined letters into letter + accent
        .replace(/[\u0300-\u036f]/g, "");
    // 2) highlight matching ones
    nodes
      .filter((d) =>
        stripAccents((d.id + ": " + d.name).toLowerCase()).includes(q)
      )
      // .select("div")
      .style("outline", "10px solid 	#04284a");
  }, [searchQuery]);

  const handleShrinkStart = () => {
    simulationRef.current.alpha(0.6).restart();
    simulationRef.current.force("charge", d3.forceManyBody().strength(1));
    simulationRef.current.force(
      "x",
      d3.forceX(window.innerWidth / 2).strength(0.005)
    );
    simulationRef.current.force(
      "y",
      d3.forceY(window.innerHeight / 2).strength(0.005)
    );
    simulationRef.current
      .force("charge")
      .initialize(simulationRef.current.nodes());
    simulationRef.current.force("x").initialize(simulationRef.current.nodes());
    simulationRef.current.force("y").initialize(simulationRef.current.nodes());
  };

  const handleZoomStart = () => {
    simulationRef.current.alpha(0.6).restart();
    simulationRef.current.force("charge", d3.forceManyBody().strength(-1));
    simulationRef.current.force(
      "x",
      d3.forceX(window.innerWidth / 2).strength(-0.005)
    );
    simulationRef.current.force(
      "y",
      d3.forceY(window.innerHeight / 2).strength(-0.005)
    );
    simulationRef.current
      .force("charge")
      .initialize(simulationRef.current.nodes());
    simulationRef.current.force("x").initialize(simulationRef.current.nodes());
    simulationRef.current.force("y").initialize(simulationRef.current.nodes());
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "8px", // spacing between button‐row and search box
      }}
    >
      {/* row of buttons */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onMouseDown={handleShrinkStart}
          style={{
            padding: "6px 10px",
            background: "#f0ad4e",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Condense
        </button>
        <button
          onMouseDown={handleZoomStart}
          style={{
            padding: "6px 10px",
            background: "#5bc0de",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Expand
        </button>
      </div>

      {/* search bar */}
      <input
        ref={inputWrapperRef}
        type="text"
        placeholder="Search..."
        onChange={handleSearchChange}
        style={{
          padding: "6px 5px",
          border: "2px solid #ccc",
          borderRadius: "4px",
          outline: "none",
        }}
      />
    </div>
  );
}

export default ExpandCondenseButtons;
