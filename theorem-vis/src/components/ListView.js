// ListView.js
import React, { useEffect, useState } from "react";
import * as d3 from "d3";
import TheoremListItem from "./TheoremListItem";

function ListView({ result, topics, filterTopic }) {
  const [expandedNodes, setExpandedNodes] = useState([]);
  const nodes = result.theorem_list;
  const topicColor = d3
    .scaleOrdinal()
    .domain(topics)
    .range(d3.schemeCategory10);
  const filteredNodes =
    filterTopic === "All"
      ? nodes
      : nodes.filter((d) => d.topic === filterTopic);

  useEffect(() => {
    const listContainer = document.getElementById("theorem-list");
    if (listContainer && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([listContainer])
        .then(() => console.log("MathJax finished typesetting list view"))
        .catch((err) => console.error("MathJax typeset failed:", err));
    }
  }, [filterTopic, expandedNodes, result]);

  return (
    <div style={{ marginTop: "60px" }}>
      <div
        id="theorem-list"
        style={{
          padding: "20px",
          height: "calc(100vh - 80px)",
        }}
      >
        {filteredNodes.map((d) => (
          <TheoremListItem
            key={d.id}
            d={d}
            isExpanded={expandedNodes.includes(d.id)}
            onToggle={() =>
              setExpandedNodes((prev) =>
                prev.includes(d.id)
                  ? prev.filter((id) => id !== d.id)
                  : [...prev, d.id]
              )
            }
            topicColor={topicColor}
          />
        ))}
      </div>
    </div>
  );
}

export default ListView;
