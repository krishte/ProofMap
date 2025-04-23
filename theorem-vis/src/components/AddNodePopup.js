import React, { useState } from "react";

function AddNodePopup({ result, setResult, setShowAddNodePopup }) {
  const [newNodeId, setNewNodeId] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeTopic, setNewNodeTopic] = useState("");
  const [newNodeStatement, setNewNodeStatement] = useState("");
  const [newNodeProof, setNewNodeProof] = useState("");

  const addNode = () => {
    if (!newNodeId || !newNodeName) {
      alert("Please provide both theorem id and name.");
      return;
    }
    const newNode = {
      id: newNodeId,
      name: newNodeName,
      topic: newNodeTopic,
      type: "theorem",
      statement: newNodeStatement,
      proof: newNodeProof,
      ancestors: [],
      descendants: [],
    };
    const updatedGraph = {
      nodes: [...result.graph.nodes, newNode],
      links: result.graph.links,
    };
    setResult({ ...result, graph: updatedGraph });
    setNewNodeId("");
    setNewNodeName("");
    setNewNodeTopic("");
    setNewNodeStatement("");
    setNewNodeProof("");
    setShowAddNodePopup(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
      onClick={() => setShowAddNodePopup(false)}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "4px",
          minWidth: "300px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginBottom: "10px" }}>Add a New Node</h3>
        <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
          <label>Node ID:</label>
          <input
            type="text"
            value={newNodeId}
            onChange={(e) => setNewNodeId(e.target.value)}
            style={{ width: "100%", padding: "5px", marginTop: "5px" }}
          />
        </div>
        <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
          <label>Node Name:</label>
          <input
            type="text"
            value={newNodeName}
            onChange={(e) => setNewNodeName(e.target.value)}
            style={{ width: "100%", padding: "5px", marginTop: "5px" }}
          />
        </div>
        <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
          <label>Topic:</label>
          <select
            value={newNodeTopic}
            onChange={(e) => setNewNodeTopic(e.target.value)}
            style={{ width: "100%", padding: "5px", marginTop: "5px" }}
          >
            <option value="">Select Topic</option>
            {result &&
              result.graph &&
              Array.from(new Set(result.graph.nodes.map((d) => d.topic))).map(
                (topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                )
              )}
          </select>
        </div>
        <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
          <label>Statement:</label>
          <textarea
            rows="4"
            value={newNodeStatement}
            onChange={(e) => setNewNodeStatement(e.target.value)}
            style={{ width: "100%", padding: "5px", marginTop: "5px" }}
          />
        </div>
        <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
          <label>Proof:</label>
          <textarea
            rows="4"
            value={newNodeProof}
            onChange={(e) => setNewNodeProof(e.target.value)}
            style={{ width: "100%", padding: "5px", marginTop: "5px" }}
          />
        </div>
        <div style={{ textAlign: "right" }}>
          <button
            onClick={() => setShowAddNodePopup(false)}
            style={{ marginRight: "10px" }}
          >
            Cancel
          </button>
          <button onClick={addNode}>Add</button>
        </div>
      </div>
    </div>
  );
}

export default AddNodePopup;
