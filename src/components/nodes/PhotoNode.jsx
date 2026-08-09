import React, { useRef, useCallback } from "react";
import NodeHandles from "./NodeHandles";

/**
 * PhotoNode - "Barang Bukti / TKP"
 * Node ringan khusus foto, tanpa field nama tersangka.
 */
export default function PhotoNode({ id, data }) {
  const fileInputRef = useRef(null);

  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        data.onChange?.({ image: reader.result });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [data]
  );

  return (
    <div className="evidence-photo-card">
      <NodeHandles idPrefix={id} />

      <div className="evidence-tape evidence-tape-left" />
      <div className="evidence-tape evidence-tape-right" />

      <div
        className="evidence-photo-area nodrag"
        onClick={handlePhotoClick}
        title="Klik untuk unggah foto barang bukti"
      >
        {data.image ? (
          <img src={data.image} alt="evidence" draggable={false} />
        ) : (
          <div className="evidence-photo-placeholder">
            <span>🧾</span>
            <span>Foto Barang Bukti</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="nodrag"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      <input
        type="text"
        className="nodrag evidence-label-input"
        placeholder="Label bukti (opsional)"
        value={data.label || ""}
        onChange={(e) => data.onChange?.({ label: e.target.value })}
      />
    </div>
  );
}
