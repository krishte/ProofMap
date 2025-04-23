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

  // For edge editing mode (graph view)

  // New state for display mode: "graph" or "list"
  const [displayMode, setDisplayMode] = useState("graph");
  // State for filtering list view by topic; "All" means no filter.
  const [filterTopic, setFilterTopic] = useState("All");

  const downloadGraph = () => {
    if (!result) return;

    // CSV header
    const rows = [["name", "statement", "proof"]];

    // Populate rows
    result.theorem_list.forEach((s) => {
      const name = `${s.id}: ${s.name}`;
      const statement = s.statement?.replace(/"/g, '""') || "";
      const proof = s.proof?.replace(/"/g, '""') || "";
      rows.push([name, statement, proof]);
    });

    // Convert to CSV format (handle commas/quotes)
    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "proofmap-export.csv";
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
          />
        )}
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
          <button
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onClick={downloadGraph}
          >
            Export to file
          </button>
        </div>
      </div>
    );
  } else {
    // File upload area
    mainContent = <LandingView setResult={setResult} setTopics={setTopics} />;
  }
  return <div>{mainContent}</div>;
}

export default App;
