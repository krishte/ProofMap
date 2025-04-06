import React, { useRef } from "react";
import { CSSTransition } from "react-transition-group";
import TheoremDetails from "./TheoremDetails"; // your component that renders details

const TheoremListItem = ({ d, isExpanded, onToggle, topicColor }) => {
  // Create a ref for the element that will be transitioned.
  const nodeRef = useRef(null);

  return (
    <div
      onClick={onToggle}
      style={{
        marginBottom: "10px",
        padding: "10px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        background: topicColor(d.topic),
        cursor: "pointer",
      }}
    >
      <h3 style={{ margin: 0 }}>
        {d.id}: {d.name}
      </h3>
      <CSSTransition
        in={isExpanded}
        timeout={300}
        classNames="collapse"
        unmountOnExit
        nodeRef={nodeRef} // Pass the ref to CSSTransition
      >
        <div
          ref={nodeRef}
          style={{
            marginTop: "10px",
            background: "#fff",
            padding: "10px",
            borderRadius: "4px",
          }}
        >
          <TheoremDetails d={d} />
        </div>
      </CSSTransition>
    </div>
  );
};

export default TheoremListItem;
