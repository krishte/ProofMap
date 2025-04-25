import * as d3 from "d3";
import ReactDOMServer from "react-dom/server";
import TheoremDetails from "../TheoremDetails";

export const createGraph = (containerRef, width, height) => {
  const svg = d3
    .select(containerRef.current)
    .html("")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

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

  return [svg, g];
};

export const createLegend = (svg, g, link, topics, topicColor) => {
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
          .style("opacity", (d) => (d.source.topic === selectedTopic ? 1 : 0));
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

  return legendItems;
};

export const createCollapseToggle = (
  legendItems,
  containerRef,
  currentTransformRef,
  collapsedTopics,
  setCollapsedTopics,
  hiddenTopics,
  updateGraphWithCollapsedTopics,
  renderedGraph
) => {
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
      updateGraphWithCollapsedTopics(newCollapsed, hiddenTopics, renderedGraph);
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
};

export const createVisibleToggle = (
  legendItems,
  containerRef,
  currentTransformRef,
  collapsedTopics,
  setHiddenTopics,
  hiddenTopics,
  updateGraphWithCollapsedTopics,
  renderedGraph
) => {
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
};

export const createSimulation = (graphData, width, height, simulationRef) => {
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

  return simulation;
};

export const createNodes = (g, graphData, topics, topicColor, simulation) => {
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

  return node;
};

export const createLinks = (g, graphData) => {
  const link = g
    .selectAll(".link")
    .data(graphData.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5)
    .attr("marker-end", "url(#arrowhead)");
  return link;
};

export const handleZoom = (g, svg, currentTransformRef) => {
  const zoom_handler = d3.zoom().on("zoom", (event) => {
    g.attr("transform", event.transform);
  });
  svg.call(zoom_handler);
  if (currentTransformRef) {
    svg.call(zoom_handler.transform, currentTransformRef.current);
  }
};

export const nodeClickLogic = (
  node,
  addingEdgeModeRef,
  setAddingEdgeMode,
  selectedEdgeNodesRef,
  result,
  setResult,
  g,
  svg,
  setRenderedGraph
) => {
  node.on("click", function (event, d) {
    if (addingEdgeModeRef.current) {
      d3.select(this).select("div").style("border", "10px solid red");
      selectedEdgeNodesRef.current.push(d);
      if (selectedEdgeNodesRef.current.length === 2) {
        const [source, target] = selectedEdgeNodesRef.current;
        const newLink = { source: source, target: target };
        const updatedLinks = [...result.graph.links, newLink];
        const updatedGraph = { ...result.graph, links: updatedLinks };
        setResult({ ...result, graph: updatedGraph });
        selectedEdgeNodesRef.current = [];
        setAddingEdgeMode(false);
        g.selectAll(".node").select("div").style("border", "1px solid #ccc");
        setRenderedGraph(null);
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
        const newStatement = popup.select("#edit-statement").property("value");
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
        .then(() => console.log("MathJax finished typesetting the popup."))
        .catch((err) => console.error("MathJax typeset failed: ", err));
    }
  });
};

export const nodeHoverLogic = (node, link, g) => {
  node
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
          d.source.id === hovered_d.id || d.target.id === hovered_d.id ? 1 : 0.1
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

export const simulationTickLogic = (simulation, svg, node, link) => {
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
};
