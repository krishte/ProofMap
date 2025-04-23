import React, { useState } from "react";
import * as d3 from "d3";

function GraphViewMode({
  result,
  simulationRef,
  setRenderedGraph,
  topics,
  updateGraphWithCollapsedTopics,
  setCollapsedTopics,
  setHiddenTopics,
  collapsedTopics,
  hiddenTopics,
  renderedGraph,
}) {
  const [graphViewMode, setGraphViewMode] = useState("normal");
  const [linkForceEnabled, setLinkForceEnabled] = useState(false);

  const setConcentricByDegreeViewMode = () => {
    setCollapsedTopics(new Set());
    setHiddenTopics(new Set());
    setLinkForceEnabled(false);
    // 1. Clone the current graph
    const baseGraph = JSON.parse(JSON.stringify(result.graph));

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // 2. Compute each node’s in‐degree and out‐degree
    const indegree = {},
      outdegree = {};
    baseGraph.nodes.forEach((n) => {
      indegree[n.id] = 0;
      outdegree[n.id] = 0;
    });
    baseGraph.links.forEach((link) => {
      outdegree[link.source.id]++;
      indegree[link.target.id]++;
    });

    // 3. Compute score = in‐degree – out‐degree for each node
    const score = {};
    baseGraph.nodes.forEach((n) => {
      score[n.id] = indegree[n.id] - outdegree[n.id];
    });

    // 4. Sort unique score values ascending
    const uniqueScores = Array.from(new Set(Object.values(score))).sort(
      (a, b) => a - b
    );

    // 5. Determine ring radii
    const maxRadius = (Math.min(width, height) / 2) * 3;
    const radiusStep = maxRadius / uniqueScores.length;
    // 1) we'll store angles here:
    const angles = {};

    // 2) Place ring 0 uniformly:
    const ring0 = baseGraph.nodes.filter(
      (n) => score[n.id] === uniqueScores[0]
    );
    ring0.forEach((n, i) => {
      angles[n.id] = (i / ring0.length) * 2 * Math.PI;
      // then set x/y as before
      const r = radiusStep;
      n.x = centerX + r * Math.cos(angles[n.id]);
      n.y = centerY + r * Math.sin(angles[n.id]);
    });

    function circularMean(parentAngles) {
      if (!parentAngles.length) return 0;
      const sum = parentAngles.reduce(
        (acc, a) => {
          acc.x += Math.cos(a);
          acc.y += Math.sin(a);
          return acc;
        },
        { x: 0, y: 0 }
      );

      return Math.atan2(sum.y, sum.x);
    }

    // 3) Now for each subsequent ring:
    uniqueScores.slice(1).forEach((sc, ringIdx1) => {
      const ringIdx = ringIdx1 + 1; // since we skipped the first
      const r = (ringIdx + 1) * radiusStep;
      const ringNodes = baseGraph.nodes.filter((n) => score[n.id] === sc);

      // small angular offset step for siblings:
      const defaultAngle = (2 * Math.PI) / ringNodes.length;

      ringNodes.forEach((node, i) => {
        // find parent angles
        const parentAngles = baseGraph.links
          .filter((l) => l.target.id === node.id)
          .map((l) => angles[l.source.id])
          .filter((a) => a !== undefined);

        // average or fallback to 0
        const angle = parentAngles.length
          ? circularMean(parentAngles)
          : defaultAngle * i;

        // spread out siblings a bit:
        angles[node.id] = angle;

        node.x = centerX + r * Math.cos(angle);
        node.y = centerY + r * Math.sin(angle);
      });
    });
    // 6. Place nodes on their score‐ring, equally spaced
    // uniqueScores.forEach((sc, ringIdx) => {
    //   const radius = (ringIdx + 1) * radiusStep;
    //   const group = baseGraph.nodes.filter((n) => score[n.id] === sc);
    //   if (group.length === 0) return;

    //   const angleStep = (2 * Math.PI) / group.length;
    //   group.forEach((node, i) => {
    //     const angle = i * angleStep;
    //     node.x = centerX + radius * Math.cos(angle);
    //     node.y = centerY + radius * Math.sin(angle);
    //   });
    // });

    const nodeIdToNode = {};
    Array.from(baseGraph.nodes).forEach((node) => {
      nodeIdToNode[node.id] = node;
    });
    baseGraph.links = baseGraph.links.map((link) => {
      // Reassign link source+target nodes to correct references

      link.source = nodeIdToNode[link.source.id];

      link.target = nodeIdToNode[link.target.id];

      link.source.descendants.push(link.target.id);
      link.target.ancestors.push(link.source.id);
      return link;
    });
    // 7. Trigger re-render / simulation restart
    setRenderedGraph(baseGraph);
  };

  const setConcentricCircleViewModeTopic = () => {
    setCollapsedTopics(new Set());
    setHiddenTopics(new Set());
    setLinkForceEnabled(false);

    const resultCopy = JSON.parse(JSON.stringify(result.graph));

    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // how big can our outermost ring be?
    const maxRadius = (Math.min(width, height) / 2) * 2;
    // Compute count per topic
    const topicCounts = topics.map((topic) => ({
      topic,
      count: resultCopy.nodes.filter((n) => n.topic === topic).length,
    }));

    // Sort topics by ascending count
    const sortedTopics = topicCounts
      .sort((a, b) => a.count - b.count)
      .map((tc) => tc.topic);

    // one ring per topic
    const radiusStep = maxRadius / sortedTopics.length;

    // for each topic, place its nodes on its own ring
    sortedTopics.forEach((topic, ti) => {
      const radius = (ti + 1) * radiusStep;
      // collect all nodes of this topic
      const nodesOfTopic = resultCopy.nodes.filter((n) => n.topic === topic);
      if (!nodesOfTopic.length) return;

      const angleStep = (2 * Math.PI) / nodesOfTopic.length;

      nodesOfTopic.forEach((node, i) => {
        const angle = i * angleStep;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });
    });

    const nodeIdToNode = {};
    Array.from(resultCopy.nodes).forEach((node) => {
      nodeIdToNode[node.id] = node;
    });
    resultCopy.links = resultCopy.links.map((link) => {
      // Reassign link source+target nodes to correct references

      link.source = nodeIdToNode[link.source.id];

      link.target = nodeIdToNode[link.target.id];

      link.source.descendants.push(link.target.id);
      link.target.ancestors.push(link.source.id);
      return link;
    });

    setRenderedGraph(resultCopy);
  };

  const updateLinkForce = (enabled) => {
    simulationRef.current.alpha(0.1).restart();
    const graphData = renderedGraph == null ? result.graph : renderedGraph;

    console.log(enabled);
    if (enabled) {
      simulationRef.current.force(
        "link",
        d3
          .forceLink(graphData.links)
          .id((d) => d.id)
          .distance(300)
      );
      simulationRef.current
        .force("link")
        .initialize(simulationRef.current.nodes());
    } else {
      simulationRef.current.force("link", null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          type="checkbox"
          checked={linkForceEnabled}
          onChange={() => {
            // flip state
            setLinkForceEnabled(!linkForceEnabled);
            updateLinkForce(!linkForceEnabled);
          }}
        />
        Enable Link Force
      </label>
      <button
        onClick={() => {
          setGraphViewMode("normal");
          setLinkForceEnabled(false);
          updateGraphWithCollapsedTopics(collapsedTopics, hiddenTopics, null);
        }}
        style={{
          padding: "6px 12px",
          background: graphViewMode === "normal" ? "#007bff" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Normal View
      </button>

      <button
        onClick={() => {
          setGraphViewMode("topicCircle");
          setConcentricCircleViewModeTopic();
        }}
        style={{
          padding: "6px 12px",
          background: graphViewMode === "topicCircle" ? "#007bff" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        TopicCircle View
      </button>

      <button
        onClick={() => {
          setGraphViewMode("edgeDegree");
          setConcentricByDegreeViewMode();
        }}
        style={{
          padding: "6px 12px",
          background: graphViewMode === "edgeDegree" ? "#007bff" : "#ccc",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        EdgeDegree View
      </button>
    </div>
  );
}

export default GraphViewMode;
