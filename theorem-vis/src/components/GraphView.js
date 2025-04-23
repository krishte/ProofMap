import React, { useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import ReactDOMServer from "react-dom/server";
import TheoremDetails from "./TheoremDetails";

function GraphView({ result, setResult, topics, setShowAddNodePopup }) {
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  const [addingEdgeMode, setAddingEdgeMode] = useState(false);
  const [renderedGraph, setRenderedGraph] = useState(null);
  const [collapsedTopics, setCollapsedTopics] = useState(new Set());
  const [hiddenTopics, setHiddenTopics] = useState(new Set());
  const [graphViewMode, setGraphViewMode] = useState("normal");

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

  // Helper function to compute intersection points for links
  function getIntersectionPoints(source, target, nodeWidth, nodeHeight) {
    const sx = source.x + nodeWidth / 2;
    const sy = source.y + nodeHeight / 2;
    const tx = target.x + nodeWidth / 2;
    const ty = target.y + nodeHeight / 2;
    const dx = tx - sx;
    const dy = ty - sy;
    const halfWidth = nodeWidth / 2;
    const halfHeight = nodeHeight / 2;
    let scale;
    if (dx === 0) {
      scale = halfHeight / Math.abs(dy);
    } else if (dy === 0) {
      scale = halfWidth / Math.abs(dx);
    } else {
      const scaleX = halfWidth / Math.abs(dx);
      const scaleY = halfHeight / Math.abs(dy);
      scale = Math.min(scaleX, scaleY);
    }
    return {
      sourcePoint: { x: sx + dx * scale, y: sy + dy * scale },
      targetPoint: { x: tx - dx * scale, y: ty - dy * scale },
    };
  }

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

  useEffect(() => {
    addingEdgeModeRef.current = addingEdgeMode;
    if (result && containerRef.current) {
      console.log(renderedGraph);
      const graphData = renderedGraph == null ? result.graph : renderedGraph;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const topicColor = d3
        .scaleOrdinal()
        .domain(topics)
        .range(d3.schemeCategory10);

      const svg = d3
        .select(containerRef.current)
        .html("")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      // Background click cancels edge mode
      svg.on("click", (event) => {
        if (addingEdgeMode && event.target.tagName === "svg") {
          selectedEdgeNodesRef.current = [];
          svg
            .selectAll(".node")
            .select("div")
            .style("border", "1px solid #ccc");
        }
      });

      const defs = svg.append("defs");
      defs
        .append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 10)
        .attr("refY", 0)
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#333");

      const g = svg.append("g").attr("class", "everything");
      const zoom_handler = d3.zoom().on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
      svg.call(zoom_handler);
      if (currentTransformRef) {
        svg.call(zoom_handler.transform, currentTransformRef.current);
      }

      const link = g
        .selectAll(".link")
        .data(graphData.links)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("stroke", "#333")
        .attr("stroke-width", 1.5)
        .attr("marker-end", "url(#arrowhead)");

      const simulation = d3
        .forceSimulation(graphData.nodes)
        .force(
          "link",
          d3
            .forceLink(graphData.links)
            .id((d) => d.id)
            .distance(300)
        )
        .force("charge", d3.forceManyBody().strength(-50))
        .force("x", d3.forceX(width / 2).strength(0.005))
        .force("y", d3.forceY(height / 2).strength(0.005));

      simulationRef.current = simulation;

      simulation.force("link", null);

      // LEFT LEGEND for topics
      const legend = svg
        .append("g")
        .attr("class", "legend")
        .attr("transform", `translate(20, 20)`);
      legend
        .insert("rect", ":first-child")
        .attr("x", -10)
        .attr("width", 430)
        .attr("height", topics.length * 25 + 10)
        .attr("fill", "rgba(0, 0, 0, 0.8)")
        .attr("rx", 5)
        .attr("ry", 5);

      const legendItems = legend
        .selectAll("g")
        .data(topics)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 25 + 5})`)
        .style("cursor", "pointer")
        .on("click", function (event, selectedTopic) {
          const isActive = d3.select(this).classed("active");
          if (isActive) {
            d3.selectAll(".legend-item").classed("active", false);
            g.selectAll("foreignObject")
              .select("div")
              .transition()
              .duration(300)
              .style("opacity", 1);
            link.transition().duration(300).style("opacity", 1);
          } else {
            d3.selectAll(".legend-item").classed("active", false);
            d3.select(this).classed("active", true);
            g.selectAll("foreignObject")
              .select("div")
              .transition()
              .duration(300)
              .style("opacity", (d) => (d.topic === selectedTopic ? 1 : 0.2));
            link
              .transition()
              .duration(300)
              .style("opacity", (d) =>
                d.source.topic === selectedTopic ? 1 : 0
              );
          }
        });
      legendItems
        .append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", (d) => topicColor(d));
      legendItems
        .append("text")
        .attr("x", 30)
        .attr("y", 15)
        .text((d) => d)
        .attr("font-size", "14px")
        .attr("fill", "white");

      // Append a collapse/uncollapse toggle for each topic.
      // Here we create a small group that contains a circle and a text element.
      const collapseGroup = legendItems
        .append("g")
        .attr("class", "collapse-toggle")
        .attr("transform", "translate(370, 10)")
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          // Prevent triggering the overall legend click.
          event.stopPropagation();
          // Save zoom level
          const svgElement = d3.select(containerRef.current).select("svg");
          if (!svgElement.empty()) {
            currentTransformRef.current = d3.zoomTransform(svgElement.node());
          }

          // Update collapsed nodes
          const newCollapsed = new Set(collapsedTopics);
          if (newCollapsed.has(d)) {
            newCollapsed.delete(d);
          } else {
            newCollapsed.add(d);
          }
          // Update the state.
          setCollapsedTopics(newCollapsed);
          // Update the toggle text: show "–" if collapsed, "+" if not.
          d3.select(this)
            .select("text")
            .text(newCollapsed.has(d) ? "-" : "+");

          d3.select(this)
            .select("circle")
            .attr("fill", newCollapsed.has(d) ? "#dc3545" : "#007bff");

          // Compute new graph
          updateGraphWithCollapsedTopics(
            newCollapsed,
            hiddenTopics,
            renderedGraph
          );
        });

      collapseGroup
        .append("circle")
        .attr("r", 10)
        .attr("fill", (d) => (collapsedTopics.has(d) ? "#dc3545" : "#007bff"));

      collapseGroup
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", "white")
        .text((d) => (collapsedTopics.has(d) ? "-" : "+"));

      // Append a visibility toggle (checkbox) for each topic.
      // This group displays a small rectangle that shows a checkmark when the nodes for that topic are visible.
      const visibilityGroup = legendItems
        .append("g")
        .attr("class", "visibility-toggle")
        .attr("transform", "translate(390, 0)") // positioned to the right of collapse toggle
        .style("cursor", "pointer")
        .on("click", function (event, d) {
          event.stopPropagation();
          // Save zoom level
          const svgElement = d3.select(containerRef.current).select("svg");
          if (!svgElement.empty()) {
            currentTransformRef.current = d3.zoomTransform(svgElement.node());
          }
          // Update visibleTopics state by creating a new Set.
          const newHiddenTopics = new Set(hiddenTopics);
          if (newHiddenTopics.has(d)) {
            newHiddenTopics.delete(d);
          } else {
            newHiddenTopics.add(d);
          }
          setHiddenTopics(newHiddenTopics);

          // Update the checkbox appearance.
          d3.select(this)
            .select("rect")
            .attr("fill", newHiddenTopics.has(d) ? "#28a745" : "#ccc");
          d3.select(this)
            .select("text")
            .text(newHiddenTopics.has(d) ? "✓" : "");

          // Update node visibility in the graph.
          updateGraphWithCollapsedTopics(
            collapsedTopics,
            newHiddenTopics,
            renderedGraph
          );
        });

      visibilityGroup
        .attr("y", -10)
        .append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .attr("rx", 3)
        .attr("ry", 3)
        .attr("fill", (d) => (hiddenTopics.has(d) ? "#ccc" : "#28a745"));

      visibilityGroup
        .append("text")
        .attr("x", 10)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text((d) => (hiddenTopics.has(d) ? "" : "✓"));

      const topicNodeWidth = 300;
      const topicNodeNeight = 200;
      const node = g
        .selectAll(".node")
        .data(graphData.nodes)
        .enter()
        .append("foreignObject")
        .attr("class", "node")
        .attr("width", (d) => (topics.includes(d.id) ? topicNodeWidth : 200))
        .attr("height", (d) => (topics.includes(d.id) ? topicNodeNeight : null)) // aggregated nodes get fixed height
        .each(function (d) {
          const fo = d3.select(this);
          const bgColor = topicColor(d.topic);
          const isAggregated = topics.includes(d.id);
          const height = isAggregated ? "100%" : "auto";
          const width = isAggregated ? "100%" : "auto";
          const flexStyle =
            "display: flex; align-items: center; justify-content: center;";
          const fontSize = isAggregated ? "30px" : "16px";
          const title = d.id + (d.name === "" ? "" : ": " + d.name);

          fo.html(`
            <div style="
              text-align: center;
              border: 1px solid #ccc;
              padding: 4px;
              border-radius: 4px;
              background: ${bgColor};
              opacity: 1;
              cursor: pointer;
              height: ${height};
              width: ${width};
              ${flexStyle}
            ">
              <h3 style="margin: 0; font-size: ${fontSize};">${title}</h3>
            </div>
          `);
          const innerDiv = fo.select("div").node();
          const measuredHeight = innerDiv.offsetHeight;
          const measuredWidth = innerDiv.offsetWidth;
          if (topics.includes(d.id)) {
            fo.attr("height", topicNodeNeight);
            d.nodeHeight = topicNodeNeight;
            d.nodeWidth = topicNodeWidth;
          } else {
            fo.attr("height", measuredHeight);
            d.nodeHeight = measuredHeight;
            d.nodeWidth = measuredWidth;
          }
        })
        .call(
          d3
            .drag()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.01).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      node
        .on("click", function (event, d) {
          if (addingEdgeModeRef.current) {
            d3.select(this).select("div").style("border", "5px solid red");
            selectedEdgeNodesRef.current.push(d);
            if (selectedEdgeNodesRef.current.length === 2) {
              const [source, target] = selectedEdgeNodesRef.current;
              const newLink = { source: source.id, target: target.id };
              const updatedLinks = [...result.graph.links, newLink];
              const updatedGraph = { ...result.graph, links: updatedLinks };
              setResult({ ...result, graph: updatedGraph });
              selectedEdgeNodesRef.current = [];
              g.selectAll(".node")
                .select("div")
                .style("border", "1px solid #ccc");
            }
            event.stopPropagation();
            return;
          }
          d3.select("#popup").remove();
          window.currentPopupNode = d;
          const currentTransform = d3.zoomTransform(svg.node());
          const [screenX, screenY] = currentTransform.apply([
            d.x + d.nodeWidth / 2,
            d.y + d.nodeHeight / 2,
          ]);
          const popup = d3
            .select("body")
            .append("div")
            .attr("id", "popup")
            .style("position", "absolute")
            .style("left", screenX + "px")
            .style("top", screenY + "px")
            .style("background", "#ffffff")
            .style("border", "2px solid #444")
            .style("border-radius", "8px")
            .style("padding", "15px")
            .style("box-shadow", "0 4px 8px rgba(0, 0, 0, 0.4)")
            .style("max-width", "700px")
            .style("font-family", "Arial, sans-serif")
            .style("color", "#333")
            .style("display", "flex")
            .style("flex-direction", "column")
            .html(
              `
              <h3 style="margin-top: 0;">${d.id}: ${d.name}</h3>
              <p style="margin: 5px 0;"><strong>Topic:</strong> ${d.topic}</p>
              ${ReactDOMServer.renderToStaticMarkup(<TheoremDetails d={d} />)}
              <div style="margin-top:10px; display: flex; gap: 10px;">
                <button id="edit-btn" style="padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                <button id="cancel-btn" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
              </div>
            `
            )
            .on("click", function (e) {
              e.stopPropagation();
            });

          popup.select("#edit-btn").on("click", function () {
            const editControls = popup.select("#edit-controls");
            const displayContent = popup.select("#display-content");
            const btn = d3.select(this);
            if (editControls.style("display") === "none") {
              editControls
                .style("display", "block")
                .style("border-top", "1px solid #ccc")
                .style("margin-top", "10px")
                .style("padding-top", "10px");
              displayContent.style("display", "none");
              btn
                .text("Save")
                .style("background", "#28a745")
                .style("border", "none")
                .style("padding", "5px 10px")
                .style("border-radius", "4px")
                .style("color", "#fff");
            } else {
              const newStatement = popup
                .select("#edit-statement")
                .property("value");
              const newProof = popup.select("#edit-proof").property("value");
              d.statement = newStatement;
              d.proof = newProof;
              popup.select("#rendered-statement").html(newStatement);
              popup.select("#rendered-proof").html(newProof);
              editControls.style("display", "none");
              displayContent.style("display", "block");
              btn
                .text("Edit")
                .style("background", "#007bff")
                .style("border", "none")
                .style("padding", "5px 10px")
                .style("border-radius", "4px")
                .style("color", "#fff");
            }
          });

          popup.select("#cancel-btn").on("click", function () {
            popup.remove();
          });

          if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([document.getElementById("popup")])
              .then(() =>
                console.log("MathJax finished typesetting the popup.")
              )
              .catch((err) => console.error("MathJax typeset failed: ", err));
          }
        })
        .on("mouseover", function (event, hovered_d) {
          g.selectAll("foreignObject")
            .select("div")
            .transition()
            .duration(300)
            .style("opacity", (d) =>
              hovered_d.descendants.includes(d.id) ||
              hovered_d.ancestors.includes(d.id) ||
              d.id === hovered_d.id
                ? 1
                : 0.2
            );
          link
            .transition()
            .duration(300)
            .style("opacity", (d) =>
              d.source.id === hovered_d.id || d.target.id === hovered_d.id
                ? 1
                : 0.1
            );
        })
        .on("mouseout", function (event, hovered_d) {
          g.selectAll("foreignObject")
            .select("div")
            .transition()
            .duration(300)
            .style("opacity", (d) => 1);
          link
            .transition()
            .duration(300)
            .style("opacity", (d) => 1);
        });

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => {
            const pts = getIntersectionPoints(
              d.source,
              d.target,
              d.source.nodeWidth,
              d.source.nodeHeight
            );
            return pts.sourcePoint.x;
          })
          .attr("y1", (d) => {
            const pts = getIntersectionPoints(
              d.source,
              d.target,
              d.source.nodeWidth,
              d.source.nodeHeight
            );
            return pts.sourcePoint.y;
          })
          .attr("x2", (d) => {
            const pts = getIntersectionPoints(
              d.source,
              d.target,
              d.target.nodeWidth,
              d.target.nodeHeight
            );
            return pts.targetPoint.x;
          })
          .attr("y2", (d) => {
            const pts = getIntersectionPoints(
              d.source,
              d.target,
              d.target.nodeWidth,
              d.target.nodeHeight
            );
            return pts.targetPoint.y;
          });
        node.attr("transform", (d) => `translate(${d.x},${d.y})`);

        const popupElem = d3.select("#popup").node();
        if (popupElem && window.currentPopupNode) {
          const currentTransform = d3.zoomTransform(svg.node());
          const [screenX, screenY] = currentTransform.apply([
            window.currentPopupNode.x + window.currentPopupNode.nodeWidth / 2,
            window.currentPopupNode.y + window.currentPopupNode.nodeHeight / 2,
          ]);
          d3.select(popupElem)
            .style("left", screenX + "px")
            .style("top", screenY + "px");
        }
      });
    }
  }, [result, renderedGraph]);

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

      {/* View Mode Buttons */}
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
        <button
          onClick={() => {
            setGraphViewMode("normal");
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

      {/* Shrink / Zoom Buttons */}
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
        <button
          style={{
            padding: "6px 10px",
            background: "#f0ad4e",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={() => {
            setConcentricByDegreeViewMode();
          }}
        >
          View
        </button>
      </div>

      {/* Add Edge button */}
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
    </div>
  );
}

export default GraphView;
