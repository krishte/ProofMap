import logo from "../logo.webp";
import React, { useState } from "react";
import FileDropdown from "./FileDropdown";
import { FaInfoCircle } from "react-icons/fa";

function LandingView({ setResult, setTopics }) {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadText, setUploadText] = useState("");
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
      if (!res.ok) {
        setError(`Upload failed: ${res.status}`);
        setLoading(false);
        return;
      }
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
        if (!statusRes.ok) {
          setError(`Error job id unknown: ${statusRes.status}`);
          setLoading(false);
          return;
        }
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

  /* Function to parse an uploaded JSON file into the `result` variable */
  const handleJSONUpload = (file) => {
    setLoading(true);
    setResult(null);
    setError(null);
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploaded = JSON.parse(e.target.result);
        setUploadProgress(100);

        const uniqueTopics = Array.from(
          new Set(uploaded.graph.nodes.map((d) => d.topic))
        );

        setTopics(uniqueTopics);
        const nodeIdToNode = {};
        Array.from(uploaded.graph.nodes).forEach((node) => {
          nodeIdToNode[node.id] = node;
        });
        uploaded.graph.links = uploaded.graph.links.map((link) => {
          // Reassign link source+target nodes to correct references

          link.source = nodeIdToNode[link.source.id];

          link.target = nodeIdToNode[link.target.id];

          //   link.source.descendants.push(link.target.id);
          //   link.target.ancestors.push(link.source.id);
          return link;
        });

        setResult(uploaded);
      } catch (err) {
        setLoading(false);
        setError("Failed to parse JSON:", err);
        alert("Invalid JSON file. Please upload a valid ProofMap export.");
      }
    };
    reader.readAsText(file);
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(135deg, #f5f7fa, #c3cfe2)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        // padding: "30px",
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
          alignItems: "center",
          marginBottom: "30px",
          fontFamily: "Helvetica, sans-serif",
          color: "#374151",
        }}
      >
        <h2 style={{ margin: 0 }}>What is ProofMap?</h2>
        <div className="tooltip">
          <FaInfoCircle size={18} />
          <span className="tooltiptext">
            ProofMap ingests a PDF of lecture notes and builds an interactive
            graph and list of theorems so you can see exactly how each result
            depends on the others. No more hunting through 100‑page PDFs—
            ProofMap makes proof structure instantly clear.
          </span>
        </div>
      </div>

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

          {/* Dashed line separator */}
          <hr
            style={{
              borderTop: "2px dashed #ccc",
              marginTop: "30px",
              marginBottom: "20px",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "15px",
            }}
          >
            <h2 style={{}}>Import from JSON</h2>
            <div className="tooltip">
              <FaInfoCircle size={18} />
              <span className="tooltiptext">
                Once ProofMap has built a graph for your lectures notes, you can
                export the graph to a file. Upload that file here.
              </span>
            </div>
          </div>
          <input
            type="file"
            accept=".json"
            style={{ display: "none" }}
            id="jsonUpload"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleJSONUpload(file);
              }
            }}
          />
          <label
            htmlFor="jsonUpload"
            style={{
              cursor: "pointer",
              backgroundColor: "#007bff",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: "4px",
              marginTop: "5px",
              display: "inline-block",
            }}
          >
            Choose JSON
          </label>
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
              Choose PDF
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div
          style={{
            marginTop: 20,
            marginBottom: 20,
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

export default LandingView;
