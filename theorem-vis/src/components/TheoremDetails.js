import React, { useRef } from "react";

function TheoremDetails({ d }) {
  const detailsRef = useRef(null);

  return (
    <div ref={detailsRef}>
      <div id={`display-content`}>
        <p style={{ margin: "5px 0" }}>
          <strong>Statement:</strong>
        </p>
        <div
          id={`rendered-statement`}
          style={{ padding: "5px", background: "#f9f9f9", borderRadius: "4px" }}
          dangerouslySetInnerHTML={{ __html: d.statement }}
        />
        {d.proof && d.proof.length > 0 && (
          <>
            <p style={{ margin: "5px 0" }}>
              <strong>Proof:</strong>
            </p>
            <div
              id={`rendered-proof`}
              style={{
                padding: "5px",
                background: "#f9f9f9",
                borderRadius: "4px",
              }}
              dangerouslySetInnerHTML={{ __html: d.proof }}
            />
          </>
        )}
      </div>
      <div id={`edit-controls`} style={{ display: "none", marginTop: "10px" }}>
        <p style={{ margin: "5px 0" }}>
          <strong>Edit Statement:</strong>
        </p>
        <textarea
          id={`edit-statement`}
          rows="4"
          cols="40"
          style={{ fontFamily: "monospace", padding: "5px" }}
          defaultValue={d.statement}
        />
        <p style={{ margin: "5px 0" }}>
          <strong>Edit Proof:</strong>
        </p>
        <textarea
          id={`edit-proof`}
          rows="4"
          cols="40"
          style={{ fontFamily: "monospace", padding: "5px" }}
          defaultValue={d.proof}
        />
      </div>
    </div>
  );
}

export default TheoremDetails;
