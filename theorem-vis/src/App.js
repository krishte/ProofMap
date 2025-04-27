import "./App.css";
import React, { useState } from "react";
import "katex/dist/katex.min.css";
import TopControls from "./components/TopControls";
import GraphView from "./components/GraphView";
import ListView from "./components/ListView";
import AddNodePopup from "./components/AddNodePopup";
import LandingView from "./components/LandingView";

function App() {
  const [result, setResult] = useState(null);
  const [showAddNodePopup, setShowAddNodePopup] = useState(false);
  const [topics, setTopics] = useState([]);

  // New state for display mode: "graph" or "list"
  const [displayMode, setDisplayMode] = useState("graph");
  // State for filtering list view by topic; "All" means no filter.
  const [filterTopic, setFilterTopic] = useState("All");

  const downloadResultAsJSON = () => {
    if (!result) return;

    // Serialize the result object with pretty-printing
    const jsonContent = JSON.stringify(result, null, 2);

    // Create a Blob and generate a URL
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create an anchor element and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "proofmap-result.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
              overflow: "hidden", // or "auto" if needed
            }}
          >
            <GraphView result={result} setResult={setResult} topics={topics} />
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
        {showAddNodePopup && (
          <AddNodePopup
            result={result}
            setResult={setResult}
            setShowAddNodePopup={setShowAddNodePopup}
            topics={topics}
          />
        )}
        {/* Buttons to add node and export graph*/}
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
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={downloadResultAsJSON}
          >
            Export to file
          </button>
        </div>
      </div>
    );
  } else {
    // Initial page with file upload area, existing lecture notes selection, and import json button
    mainContent = <LandingView setResult={setResult} setTopics={setTopics} />;
  }
  return <div>{mainContent}</div>;
}

export default App;
