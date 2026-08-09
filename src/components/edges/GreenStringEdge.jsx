import React from "react";
import { getBezierPath } from "reactflow";

/**
 * GreenStringEdge
 * Varian hijau dari RedStringEdge — dipakai saat pengguna memilih
 * "Active Connection Color: 🟢 Green" di panel kontrol.
 *
 * === FIX BUG KRITIS: KOTAK HITAM SAAT EXPORT PDF (html2canvas) ===
 * Sama seperti RedStringEdge: semua properti `filter` (drop-shadow & blur)
 * dihapus. Path utama style HANYA berisi `stroke` + `strokeWidth`. Lapisan
 * bayangan pakai stroke tebal + opacity rendah tanpa filter.
 */
export default function GreenStringEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  return (
    <g className="green-string-edge-group">
      {/* Lapisan bayangan (tanpa filter blur) -> stroke tebal + opacity rendah */}
      <path
        d={edgePath}
        fill="none"
        stroke="#052e16"
        strokeWidth={selected ? 7 : 6}
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* Benang hijau utama -> style HANYA stroke & strokeWidth, tanpa filter */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? "#4ade80" : "#16a34a"}
        strokeWidth={selected ? 3.4 : 2.6}
        strokeLinecap="round"
        className="green-string-path"
        style={{
          ...style,
          stroke: selected ? "#4ade80" : "#16a34a",
          strokeWidth: selected ? 3.4 : 2.6,
        }}
        markerEnd={markerEnd}
      />
      {/* Pin kecil di ujung sumber */}
      <circle cx={sourceX} cy={sourceY} r={4.5} fill="#14532d" stroke="#052e16" strokeWidth={1} />
      {/* Pin kecil di ujung target */}
      <circle cx={targetX} cy={targetY} r={4.5} fill="#14532d" stroke="#052e16" strokeWidth={1} />
    </g>
  );
}
