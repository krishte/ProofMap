import logo from "./logo.webp";
import "./App.css";
import React, { useState, useEffect } from "react";
import "katex/dist/katex.min.css";
import TopControls from "./components/TopControls";
import GraphView from "./components/GraphView";
import ListView from "./components/ListView";
import FileDropdown from "./components/FileDropdown";

function App() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showAddNodePopup, setShowAddNodePopup] = useState(false);
  const [newNodeId, setNewNodeId] = useState("");
  const [newNodeName, setNewNodeName] = useState("");
  const [newNodeTopic, setNewNodeTopic] = useState("");
  const [newNodeStatement, setNewNodeStatement] = useState("");
  const [newNodeProof, setNewNodeProof] = useState("");
  const [topics, setTopics] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadText, setUploadText] = useState("");
  // For edge editing mode (graph view)

  // New state for display mode: "graph" or "list"
  const [displayMode, setDisplayMode] = useState("graph");
  // State for filtering list view by topic; "All" means no filter.
  const [filterTopic, setFilterTopic] = useState("All");
  useEffect(() => {
    if (displayMode === "graph") {
      // Disable scrolling on the body
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable scrolling when leaving graph view
      document.body.style.overflow = "auto";
    }
  }, [displayMode]);

  const getExistingFile = async (saved_file_path) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setUploadProgress(0);
    setUploadText("Processing");

    const resultRes = await fetch(
      `https://proofmapapi.onrender.com/get_existing_json/${saved_file_path}`
    );
    if (!resultRes.ok) {
      const errPayload = await resultRes.json();
      setError(errPayload.message || "Processing failed");
      setLoading(false);
      return;
    }
    const payload = await resultRes.json();
    if (!payload.success) {
      setError(payload.message);
      setLoading(false);
      return;
    }

    // Clean up the theorems & graph
    const cleanedTheorems = payload.theorem_list.map((d) => ({
      ...d,
      statement: d.statement.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
      proof: d.proof.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
    }));
    const cleanedNodes = payload.graph.nodes.map((d) => ({
      ...d,
      statement: d.statement.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
      proof: d.proof.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
    }));
    const uniqueTopics = Array.from(new Set(cleanedNodes.map((d) => d.topic)));

    setTopics(uniqueTopics);
    setResult({
      theorem_list: cleanedTheorems,
      graph: { ...payload.graph, nodes: cleanedNodes },
    });
    setLoading(false);
  };

  const handleUpload = async (file) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("pdf_file", file);

    let reqId;
    try {
      const res = await fetch("https://proofmapapi.onrender.com/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { req_id } = await res.json();
      reqId = req_id;
    } catch (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(
          `https://proofmapapi.onrender.com/progress/${reqId}`
        );
        if (!statusRes.ok) throw new Error("Unknown job ID");
        const { progress, text } = await statusRes.json();

        // Check for error in the progress text
        if (text && text.toLowerCase().includes("error")) {
          clearInterval(interval);
          setError(text);
          setLoading(false);
          return;
        }

        setUploadProgress(progress);
        setUploadText(text);

        // 3) When done, fetch the result
        if (progress >= 100 && text === "Done") {
          clearInterval(interval);

          const resultRes = await fetch(
            `https://proofmapapi.onrender.com/result/${reqId}`
          );
          if (!resultRes.ok) {
            const errPayload = await resultRes.json();
            setError(errPayload.message || "Processing failed");
            setLoading(false);
            return;
          }
          const payload = await resultRes.json();

          if (!payload.success) {
            setError(payload.message);
            setLoading(false);
            return;
          }

          // Clean up the theorems & graph
          const cleanedTheorems = payload.theorem_list.map((d) => ({
            ...d,
            statement: d.statement
              .replaceAll("\\\\", "\\")
              .replaceAll("\\n", "\n"),
            proof: d.proof.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
          }));
          const cleanedNodes = payload.graph.nodes.map((d) => ({
            ...d,
            statement: d.statement
              .replaceAll("\\\\", "\\")
              .replaceAll("\\n", "\n"),
            proof: d.proof.replaceAll("\\\\", "\\").replaceAll("\\n", "\n"),
          }));
          const uniqueTopics = Array.from(
            new Set(cleanedNodes.map((d) => d.topic))
          );

          setTopics(uniqueTopics);
          setResult({
            theorem_list: cleanedTheorems,
            graph: { ...payload.graph, nodes: cleanedNodes },
          });
          setLoading(false);
        }
      } catch (e) {
        clearInterval(interval);
        setError(e.message);
        setLoading(false);
      }
    }, 1000);
  };

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
  let addNodePopup = (
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
  let mainContent;
  if (result) {
    mainContent = (
      <div>
        {/* Add the top controls for switching between graph and list view */}
        <TopControls
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          filterTopic={filterTopic}
          setFilterTopic={setFilterTopic}
          topics={topics}
        />
        <div>
          <div
            style={{
              display: displayMode === "graph" ? "block" : "none",
            }}
          >
            <GraphView
              result={result}
              setResult={setResult}
              topics={topics}
              setShowAddNodePopup={setShowAddNodePopup}
            />
          </div>
          {displayMode === "list" && (
            <ListView
              result={result}
              topics={topics}
              filterTopic={filterTopic}
            />
          )}
        </div>
        {/* Add the popup for adding a new node */}
        {showAddNodePopup && addNodePopup}
        {/* Add a button to add a new node */}
        <div
          style={{
            position: "fixed",
            bottom: "20px",
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
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={() => setShowAddNodePopup(true)}
          >
            Add Node
          </button>
        </div>
      </div>
    );
  } else {
    // File upload area
    mainContent = (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          background: "linear-gradient(135deg, #f5f7fa, #c3cfe2)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "30px",
        }}
      >
        <img
          src={logo}
          alt="Logo"
          style={{
            width: "400px",
            marginBottom: "30px",
            borderRadius: "50%",
            border: "1px solid #ccc",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "40px",
            width: "100%",
            maxWidth: "900px",
            background: "#fff",
            padding: "30px",
            borderRadius: "8px",
            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "30px",
          }}
        >
          {/* Option 1: Select an Existing File */}
          <div style={{ flex: 1, textAlign: "center", padding: "10px" }}>
            <h2 style={{ marginBottom: "15px" }}>Select an Existing File</h2>
            <div
              style={{
                margin: "0 auto",
                maxWidth: "300px",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                background: "#fafafa",
              }}
            >
              <FileDropdown
                onFileSelect={(filePath) => {
                  // Here, you might want to automatically load the file.
                  getExistingFile(filePath);
                }}
              />
            </div>
          </div>

          {/* Option 2: Upload a New File */}
          <div style={{ flex: 1, textAlign: "center", padding: "10px" }}>
            <h2 style={{ marginBottom: "15px" }}>Upload a New File</h2>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type === "application/pdf") {
                  handleUpload(file, "");
                } else {
                  alert("Please drop a PDF file.");
                }
              }}
              style={{
                border: "2px dashed #ccc",
                borderRadius: "8px",
                padding: "40px",
                cursor: "pointer",
                marginBottom: "15px",
              }}
            >
              <p style={{ fontFamily: "Helvetica, sans-serif", color: "#555" }}>
                Drag and drop your PDF file here, or click below to select.
              </p>
              <input
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                id="uploadInput"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    handleUpload(file, "");
                  }
                }}
              />
              <label
                htmlFor="uploadInput"
                style={{
                  cursor: "pointer",
                  backgroundColor: "#007bff",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  marginTop: "10px",
                  display: "inline-block",
                }}
              >
                Choose File
              </label>
            </div>
          </div>
        </div>

        {loading && (
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              width: "100%",
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {/* Progress Bar */}
            <div
              style={{
                width: "100%",
                background: "#f3f4f6",
                borderRadius: 8,
                overflow: "hidden",
                height: 12,
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #4ade80, #22c55e)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            {/* Percentage Text */}
            <span
              style={{
                color: "#374151",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {uploadText}... {uploadProgress}%
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: 400,
              marginLeft: "auto",
              marginRight: "auto",
              color: "#9b1c1c",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {/* Error Icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#9b1c1c"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
  return <div>{mainContent}</div>;
}

export default App;
