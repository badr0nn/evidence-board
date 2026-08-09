import React from "react";
import { getBezierPath } from "reactflow";

/**
 * RedStringEdge
 * Garis penghubung bergaya "benang merah" investigasi klasik.
 * - Kurva bezier melengkung
 * - Dua "paku pin" kecil di ujung sumber & target
 *
 * === FIX BUG KRITIS: KOTAK HITAM SAAT EXPORT PDF (html2canvas) ===
 * html2canvas tidak bisa merender filter SVG (`drop-shadow`, `blur`, dst)
 * dengan benar -> hasilnya berupa bounding box hitam pekat menutupi garis.
 * Perbaikan:
 *   - Path utama: `style` HANYA berisi `stroke` (warna) dan `strokeWidth`,
 *     TIDAK ADA properti `filter` sama sekali.
 *   - Path lapisan "bayangan" di belakangnya (dulu pakai `filter: blur(2px)`)
 *     diganti jadi stroke tebal + opacity rendah TANPA filter, supaya efek
 *     kedalaman "benang" tetap terlihat tapi aman untuk html2canvas.
 */
export default function RedStringEdge({
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
    <g className="red-string-edge-group">
      {/* Lapisan bayangan (tanpa filter blur) -> stroke tebal + opacity rendah */}
      <path
        d={edgePath}
        fill="none"
        stroke="#3a0000"
        strokeWidth={selected ? 7 : 6}
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* Benang merah utama -> style HANYA stroke & strokeWidth, tanpa filter */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? "#ff3b3b" : "#c1121f"}
        strokeWidth={selected ? 3.4 : 2.6}
        strokeLinecap="round"
        className="red-string-path"
        style={{
          ...style,
          stroke: selected ? "#ff3b3b" : "#c1121f",
          strokeWidth: selected ? 3.4 : 2.6,
        }}
        markerEnd={markerEnd}
      />
      {/* Pin kecil di ujung sumber */}
      <circle cx={sourceX} cy={sourceY} r={4.5} fill="#8a0303" stroke="#2a0000" strokeWidth={1} />
      {/* Pin kecil di ujung target */}
      <circle cx={targetX} cy={targetY} r={4.5} fill="#8a0303" stroke="#2a0000" strokeWidth={1} />
    </g>
  );
}
