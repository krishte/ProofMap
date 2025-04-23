import React, { useState } from "react";
import * as d3 from "d3";

function ExpandCondenseButtons({ simulationRef }) {
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
        gap: "8px",
      }}
    >
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
  );
}

export default ExpandCondenseButtons;
