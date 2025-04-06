// FileDropdown.js
import React, { useEffect, useState } from "react";

function FileDropdown({ onFileSelect }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");

  useEffect(() => {
    async function fetchFiles() {
      try {
        const response = await fetch(
          "https://proofmapapi.onrender.com/get_available_courses"
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        // Assume backend returns a JSON object like: { files: ["file1.pdf", "file2.pdf", ...] }
        setFiles(data.files);
      } catch (error) {
        console.error("Error fetching file list:", error);
      }
    }
    fetchFiles();
  }, []);

  const handleChange = (event) => {
    const file = event.target.value;
    setSelectedFile(file);
    if (onFileSelect) {
      onFileSelect(file);
    }
  };

  return (
    <div>
      <select id="file-dropdown" value={selectedFile} onChange={handleChange}>
        <option value="">--Select a file--</option>
        {files.map((file, index) => (
          <option key={index} value={file}>
            {file}
          </option>
        ))}
      </select>
    </div>
  );
}

export default FileDropdown;
