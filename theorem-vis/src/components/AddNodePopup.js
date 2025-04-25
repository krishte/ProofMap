import React, { useState, useEffect } from "react";

function AddNodePopup({ result, setResult, setShowAddNodePopup, topics }) {
  const [newNodeId, setNewNodeId] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeTopic, setNewNodeTopic] = useState("");
  const [newNodeStatement, setNewNodeStatement] = useState("");
  const [newNodeProof, setNewNodeProof] = useState("");
  // Local state for previews
  const [statementPreview, setStatementPreview] = useState("");
  const [proofPreview, setProofPreview] = useState("");

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

  useEffect(() => {
    setNewNodeTopic(topics[0]);
  }, [topics]);

  // Generic MathJax typeset helper
  const typeset = (containerId) => {
    const container = document.getElementById(containerId);
    if (container && window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([container])
        .then(() => console.log(`MathJax finished typesetting ${containerId}`))
        .catch((err) =>
          console.error(`MathJax typeset failed for ${containerId}:`, err)
        );
    }
  };

  const handleStatementBlur = () => {
    setStatementPreview(newNodeStatement);
    // Delay to ensure React has updated the DOM
    setTimeout(() => typeset("statement-preview"), 0);
    setTimeout(() => typeset("proof-preview"), 0);
  };

  const handleProofBlur = () => {
    setProofPreview(newNodeProof);
    setTimeout(() => typeset("proof-preview"), 0);
    setTimeout(() => typeset("statement-preview"), 0);
  };

  return (
    <>
      {/* Global placeholder styling */}
      <style>{`
        input::placeholder,
        textarea::placeholder {
          color: #aaa;
        }
      `}</style>

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
            minWidth: "500px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ marginBottom: "10px" }}>Add a New Node</h3>

          <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
            <label>Node ID:</label>
            <input
              type="text"
              placeholder="e.g. Theorem 2048"
              value={newNodeId}
              onChange={(e) => setNewNodeId(e.target.value)}
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
            />
          </div>

          <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
            <label>Node Name:</label>
            <input
              type="text"
              placeholder="e.g. Goldbach's Conjecture"
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
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
            <label>Statement:</label>
            <textarea
              rows="6"
              placeholder="e.g. Every even integer greater than 2 can be expressed as the sum of two prime numbers. "
              value={newNodeStatement}
              onChange={(e) => setNewNodeStatement(e.target.value)}
              onBlur={handleStatementBlur}
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
            />
            <div
              id="statement-preview"
              style={{ marginTop: "5px", minHeight: "1em" }}
              dangerouslySetInnerHTML={{ __html: statementPreview }}
            />
          </div>

          <div style={{ marginBottom: "10px", paddingRight: "20px" }}>
            <label>Proof:</label>
            <textarea
              rows="8"
              placeholder="e.g. Exercise"
              value={newNodeProof}
              onChange={(e) => setNewNodeProof(e.target.value)}
              onBlur={handleProofBlur}
              style={{ width: "100%", padding: "5px", marginTop: "5px" }}
            />
            <div
              id="proof-preview"
              style={{ marginTop: "5px", minHeight: "1em" }}
              dangerouslySetInnerHTML={{ __html: proofPreview }}
            />
          </div>

          <div style={{ textAlign: "right" }}>
            <button
              className="btn-cancel"
              onClick={() => setShowAddNodePopup(false)}
            >
              Cancel
            </button>
            <button className="btn-add" onClick={addNode}>
              Add
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default AddNodePopup;
