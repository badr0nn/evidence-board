import React, { useState } from "react";
import { NodeResizer } from "reactflow";
import NodeHandles from "./NodeHandles";

/**
 * NoteNode - "Sticky Note" versi Dark Theme
 *
 * === FITUR RESIZE ===
 * <NodeResizer> aktif saat node di-select; .sticky-note-dark & textarea-nya
 * sudah diset mengikuti 100% ukuran wrapper (lihat index.css).
 *
 * === VIEW MODE vs EDIT MODE (fix teks kepotong di export PDF) ===
 * Default menampilkan <div> murni (aman untuk html2canvas). Klik untuk
 * masuk Edit Mode (<textarea> beneran, autoFocus), kembali ke View Mode
 * saat onBlur.
 */
export default function NoteNode({ id, data, selected }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="sticky-note-dark" style={{ boxShadow: "none" }}>
      <NodeResizer minWidth={150} minHeight={150} isVisible={selected} />

      <NodeHandles idPrefix={id} />

      {/* Selotip dekoratif kiri & kanan, versi gelap (efek kaca buram) */}
      <div className="sticky-tape sticky-tape-left" />
      <div className="sticky-tape sticky-tape-right" />

      <div className="sticky-note-pin-dark" />

      {editing ? (
        <textarea
          autoFocus
          className="nodrag sticky-note-textarea-dark py-2 leading-relaxed"
          placeholder="Tulis kronologi / catatan penyelidikan di sini..."
          value={data.text ?? ""}
          onChange={(e) => data.onChange?.({ text: e.target.value })}
          onBlur={() => setEditing(false)}
          style={{ position: "relative", zIndex: 2, pointerEvents: "auto" }}
        />
      ) : (
        <div
          className="nodrag sticky-note-textarea-dark py-2 leading-relaxed"
          style={{
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            wordBreak: "break-all",
            display: "block",
            cursor: "text",
            position: "relative",
            zIndex: 2,
            pointerEvents: "auto",
          }}
          onClick={() => setEditing(true)}
        >
          {data.text?.trim() ? (
            data.text
          ) : (
            <span className="text-slate-500">Tulis kronologi / catatan penyelidikan di sini...</span>
          )}
        </div>
      )}
    </div>
  );
}
