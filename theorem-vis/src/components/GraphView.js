import React, { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import {
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
} from "./graph_components/graphInit";
import ExpandCondenseButtons from "./graph_components/ExpandCondenseButtons";
import GraphViewMode from "./graph_components/GraphViewMode";

function GraphView({ result, setResult, topics, setShowAddNodePopup }) {
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  const [addingEdgeMode, setAddingEdgeMode] = useState(false);
  const [renderedGraph, setRenderedGraph] = useState(null);
  const [collapsedTopics, setCollapsedTopics] = useState(new Set());
  const [hiddenTopics, setHiddenTopics] = useState(new Set());

  const addingEdgeModeRef = useRef(addingEdgeMode);
  const selectedEdgeNodesRef = useRef([]);
  const currentTransformRef = useRef(d3.zoomIdentity);

  useEffect(() => {
    addingEdgeModeRef.current = addingEdgeMode;
    if (result && containerRef.current) {
      const svg = d3.select(containerRef.current).select("svg");
      if (!svg.empty()) {
        const nodes = svg.selectAll(".node");

        nodes.select("div").classed("pulsing", addingEdgeModeRef.current);

        nodes.style(
          "outline",
          addingEdgeModeRef.current ? "2px solid transparent" : "1px solid #ccc"
        );
      }
    }
  }, [addingEdgeMode, result]);

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
        setAddingEdgeMode,
        selectedEdgeNodesRef,
        result,
        setResult,
        g,
        svg,
        setRenderedGraph,
        setCollapsedTopics,
        setHiddenTopics
      );
      nodeHoverLogic(node, link, g);

      simulationTickLogic(simulation, svg, node, link);
    }
  }, [result, renderedGraph]);

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
          backgroundColor: addingEdgeMode ? "red" : "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onClick={() => {
          const svgElement = d3.select(containerRef.current).select("svg");
          if (!svgElement.empty()) {
            currentTransformRef.current = d3.zoomTransform(svgElement.node());
          }
          setAddingEdgeMode(!addingEdgeMode);
          selectedEdgeNodesRef.current = [];
        }}
      >
        {addingEdgeMode ? "Cancel" : "Add Edge"}
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

      <GraphViewMode
        result={result}
        simulationRef={simulationRef}
        setRenderedGraph={setRenderedGraph}
        topics={topics}
        collapsedTopics={collapsedTopics}
        setCollapsedTopics={setCollapsedTopics}
        hiddenTopics={hiddenTopics}
        setHiddenTopics={setHiddenTopics}
        updateGraphWithCollapsedTopics={updateGraphWithCollapsedTopics}
        renderedGraph={renderedGraph}
      />

      <ExpandCondenseButtons
        simulationRef={simulationRef}
        containerRef={containerRef}
      />

      {addEdgeButton}
    </div>
  );
}

export default GraphView;
