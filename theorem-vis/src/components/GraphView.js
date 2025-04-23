import React, { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import ReactDOMServer from "react-dom/server";
import TheoremDetails from "./TheoremDetails";
import {
  cancelAddingEdgeModeOnBackgroundClick,
  createCollapseToggle,
  createGraph,
  createLegend,
  createLinks,
  createNodes,
  createSimulation,
  createVisibleToggle,
  handleZoom,
  nodeClickLogic,
  nodeHoverLogic,
  simulationTickLogic,
} from "./graph_utils/graphInit";

function GraphView({ result, setResult, topics, setShowAddNodePopup }) {
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  const [addingEdgeMode, setAddingEdgeMode] = useState(false);
  const [renderedGraph, setRenderedGraph] = useState(null);
  const [collapsedTopics, setCollapsedTopics] = useState(new Set());
  const [hiddenTopics, setHiddenTopics] = useState(new Set());
  const [graphViewMode, setGraphViewMode] = useState("normal");
  const [linkForceEnabled, setLinkForceEnabled] = useState(false);

  const addingEdgeModeRef = useRef(addingEdgeMode);
  const selectedEdgeNodesRef = useRef([]);
  const currentTransformRef = useRef(d3.zoomIdentity);

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

  useEffect(() => {
    addingEdgeModeRef.current = addingEdgeMode;
    if (result && containerRef.current) {
      const svg = d3.select(containerRef.current).select("svg");
      if (!svg.empty()) {
        svg
          .selectAll(".node")
          .select("div")
          .classed("pulsing", addingEdgeModeRef.current)
          .style(
            "border",
            addingEdgeModeRef.current
              ? "2px solid transparent"
              : "1px solid #ccc"
          );
      }
    }
  }, [addingEdgeMode, result]);

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

  const createTopicNode = (topic, nodes) => {
    const filteredNodes = nodes.filter((node) => node.topic === topic);
    const totalX = filteredNodes.reduce((sum, node) => sum + node.x, 0);
    const totalY = filteredNodes.reduce((sum, node) => sum + node.y, 0);
    console.log(totalX, totalY);
    return {
      id: topic,
      name: "",
      topic: topic,
      type: "theorem",
      statement: "",
      proof: "",
      ancestors: [],
      descendants: [],
      x: totalX / filteredNodes.length,
      y: totalY / filteredNodes.length,
    };
  };

  const updateCoordinates = (resultCopy, baseGraph) => {
    if (baseGraph === null) return;
    const nodeIdToNode = {};
    Array.from(resultCopy.nodes).forEach((node) => {
      nodeIdToNode[node.id] = node;
    });
    baseGraph.nodes.forEach((node) => {
      if (node.id in nodeIdToNode) {
        nodeIdToNode[node.id].x = node.x;
        nodeIdToNode[node.id].y = node.y;
      }
    });
  };

  const updateTopicNodeCoordinates = (topicToTopicNode, baseGraph) => {
    if (baseGraph === null) return;
    baseGraph.nodes.forEach((node) => {
      if (node.id in topicToTopicNode) {
        topicToTopicNode[node.id].x = node.x;
        topicToTopicNode[node.id].y = node.y;
      }
    });
  };

  const updateGraphWithCollapsedTopics = (
    newCollapsedTopics,
    newHiddenTopics,
    baseGraph
  ) => {
    // If no topic is collapsed, use the original graph.
    const resultCopy = JSON.parse(JSON.stringify(result.graph));
    // Updates coordinates based on current node positions (i.e. from renderedGraph)
    updateCoordinates(resultCopy, baseGraph);

    // Build a mapping of topic -> aggregated node.
    const topicToTopicNode = {};
    Array.from(newCollapsedTopics).forEach((topic) => {
      topicToTopicNode[topic] = createTopicNode(topic, resultCopy.nodes);
    });
    updateTopicNodeCoordinates(topicToTopicNode, baseGraph);
    // Create new nodes: remove nodes whose topic is collapsed, and add aggregated nodes.
    resultCopy.nodes = [
      ...resultCopy.nodes.filter((node) => !newCollapsedTopics.has(node.topic)),
      ...Array.from(newCollapsedTopics).map((topic) => topicToTopicNode[topic]),
    ];
    const nodeIdToNode = {};
    Array.from(resultCopy.nodes).forEach((node) => {
      nodeIdToNode[node.id] = node;
    });
    // Update links: if a link's source or target has a topic that's collapsed, replace with aggregated node.
    resultCopy.links = resultCopy.links
      .map((link) => {
        // Reassign link source+target nodes to correct references
        if (newCollapsedTopics.has(link.source.topic)) {
          link.source = topicToTopicNode[link.source.topic];
        } else {
          link.source = nodeIdToNode[link.source.id];
        }
        if (newCollapsedTopics.has(link.target.topic)) {
          link.target = topicToTopicNode[link.target.topic];
        } else {
          link.target = nodeIdToNode[link.target.id];
        }

        link.source.descendants.push(link.target.id);
        link.target.ancestors.push(link.source.id);
        return link;
      })
      .filter((link) => {
        // If both endpoints have the same topic and that topic is collapsed, do not include the link.
        if (
          link.source.topic === link.target.topic &&
          newCollapsedTopics.has(link.source.topic)
        ) {
          return false;
        }
        // If one endpoint is in a hidden topic, do not include the link.
        if (
          newHiddenTopics.has(link.source.topic) ||
          newHiddenTopics.has(link.target.topic)
        ) {
          return false;
        }
        return true;
      });

    // Filter out nodes that are in hidden topics
    resultCopy.nodes = resultCopy.nodes.filter(
      (node) => !newHiddenTopics.has(node.topic)
    );

    setRenderedGraph(resultCopy);
    return resultCopy;
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

  useEffect(() => {
    addingEdgeModeRef.current = addingEdgeMode;
    if (result && containerRef.current) {
      const graphData = renderedGraph == null ? result.graph : renderedGraph;
      const width = window.innerWidth;
      const height = window.innerHeight;

      const topicColor = d3
        .scaleOrdinal()
        .domain(topics)
        .range(d3.schemeCategory10);

      const [svg, g] = createGraph(containerRef, width, height);

      handleZoom(g, svg, currentTransformRef);

      const simulation = createSimulation(
        graphData,
        width,
        height,
        simulationRef
      );
      const link = createLinks(g, graphData);
      const node = createNodes(g, graphData, topics, topicColor, simulation);

      const legendItems = createLegend(svg, g, link, topics, topicColor);

      createCollapseToggle(
        legendItems,
        containerRef,
        currentTransformRef,
        collapsedTopics,
        setCollapsedTopics,
        hiddenTopics,
        updateGraphWithCollapsedTopics,
        renderedGraph
      );
      createVisibleToggle(
        legendItems,
        containerRef,
        currentTransformRef,
        collapsedTopics,
        setHiddenTopics,
        hiddenTopics,
        updateGraphWithCollapsedTopics,
        renderedGraph
      );

      nodeClickLogic(
        node,
        addingEdgeModeRef,
        selectedEdgeNodesRef,
        result,
        setResult,
        g,
        svg
      );
      nodeHoverLogic(node, link, g);

      simulationTickLogic(simulation, svg, node, link);

      cancelAddingEdgeModeOnBackgroundClick(
        svg,
        addingEdgeMode,
        selectedEdgeNodesRef
      );
    }
  }, [result, renderedGraph]);

  const viewModeButtons = (
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

  const expandCondenseButtons = (
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

  const addEdgeButton = (
    <div
      style={{
        position: "fixed",
        bottom: "110px",
        right: "20px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <button
        style={{
          padding: "10px 20px",
          backgroundColor: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onClick={() => {
          setAddingEdgeMode((x) => {
            return !x;
          });
          selectedEdgeNodesRef.current = [];
        }}
      >
        Add Edge
      </button>
    </div>
  );

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          border: "1px solid #ccc",
          width: window.innerWidth,
          height: window.innerHeight,
        }}
      ></div>

      {viewModeButtons}

      {expandCondenseButtons}

      {addEdgeButton}
    </div>
  );
}

export default GraphView;
