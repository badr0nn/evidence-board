import React from "react";
import { Handle, Position } from "reactflow";

/**
 * NodeHandles
 * Menyediakan 4 handle (Top, Bottom, Left, Right) dengan id UNIK per node.
 * type="source" dipakai untuk semua sisi, tapi karena <ReactFlow connectionMode="loose">
 * diaktifkan di App.jsx, setiap handle tetap bisa berperan sebagai target maupun source.
 * Ini mencegah bug klasik "tidak bisa menyambung garis" pada React Flow.
 */
export default function NodeHandles({ idPrefix }) {
  const handleStyle = {
    width: 10,
    height: 10,
    background: "#c1121f",
    border: "2px solid #1a1a1a",
    borderRadius: "50%",
  };

  return (
    <>
      <Handle
        type="source"
        position={Position.Top}
        id={`${idPrefix}-top`}
        style={{ ...handleStyle, top: -6 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id={`${idPrefix}-bottom`}
        style={{ ...handleStyle, bottom: -6 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Left}
        id={`${idPrefix}-left`}
        style={{ ...handleStyle, left: -6 }}
        isConnectable
      />
      <Handle
        type="source"
        position={Position.Right}
        id={`${idPrefix}-right`}
        style={{ ...handleStyle, right: -6 }}
        isConnectable
      />
    </>
  );
}
