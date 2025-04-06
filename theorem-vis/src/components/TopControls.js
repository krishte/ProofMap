// TopControls.js
import React from "react";

function TopControls({
  displayMode,
  setDisplayMode,
  filterTopic,
  setFilterTopic,
  topics,
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1500,
        background: "rgba(255,255,255,0.9)",
        padding: "10px",
        borderRadius: "4px",
        display: "flex",
        gap: "20px",
        alignItems: "center",
      }}
    >
      <div>
        <button
          onClick={() => setDisplayMode("graph")}
          style={{
            padding: "5px 10px",
            background: displayMode === "graph" ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Graph
        </button>
        <button
          onClick={() => setDisplayMode("list")}
          style={{
            padding: "5px 10px",
            marginLeft: "10px",
            background: displayMode === "list" ? "#007bff" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
          }}
        >
          List
        </button>
      </div>
      {displayMode === "list" && (
        <div>
          <label style={{ marginRight: "10px" }}>Filter by Topic:</label>
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
          >
            <option value="All">All</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export default TopControls;
