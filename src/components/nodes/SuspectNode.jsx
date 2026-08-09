import React, { useRef, useCallback, useState } from "react";
import { NodeResizer } from "reactflow";
import NodeHandles from "./NodeHandles";

/**
 * SuspectNode - "Foto Polaroid" tersangka
 *
 * === FITUR RESIZE ===
 * <NodeResizer> menampilkan handle di 4 sudut + sisi saat node di-select,
 * mengubah width/height node langsung di store React Flow. Kontainer utama
 * (.polaroid-card, lihat index.css) sudah diset width:100%/height:100%
 * supaya kartu ikut melar mengikuti ukuran yang diatur NodeResizer.
 *
 * === VIEW MODE vs EDIT MODE (fix teks kepotong di export PDF) ===
 * html2canvas tidak selalu merender isi <input>/<textarea> dengan akurat
 * (posisi kursor, scroll internal elemen form, dsb -> teks terpotong di PDF).
 * Solusinya: saat TIDAK sedang diedit, tampilkan teks sebagai <div> murni
 * (yang di-screenshot html2canvas dengan sempurna). Saat kartu diklik,
 * elemen berubah jadi <input>/<textarea> beneran untuk pengetikan, lalu
 * kembali ke <div> begitu kehilangan fokus (onBlur).
 *
 * Logika upload foto -> Base64 dan Handle koneksi TIDAK diubah sama sekali.
 */
export default function SuspectNode({ id, data, selected }) {
  const fileInputRef = useRef(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);

  const handlePhotoClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        // Upload foto -> Base64 -> tersimpan utuh di node data (ikut ke JSON)
        data.onChangeImage?.(reader.result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [data]
  );

  const viewTextStyle = {
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    wordBreak: "break-all",
    display: "block",
    minHeight: "1.6em",
    cursor: "text",
  };

  return (
    <div className="polaroid-card" style={{ boxShadow: "none" }}>
      <NodeResizer minWidth={150} minHeight={150} isVisible={selected} />

      <NodeHandles idPrefix={id} />

      <div className="polaroid-pin" />

      <div
        className="polaroid-photo nodrag"
        onClick={handlePhotoClick}
        title="Klik untuk unggah foto"
        style={{ position: "relative", zIndex: 1 }}
      >
        {data.image ? (
          <img src={data.image} alt="suspect" draggable={false} />
        ) : (
          <div className="polaroid-photo-placeholder">
            <span>📷</span>
            <span>Klik untuk unggah foto</span>
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

      {/* ================= NAMA TERSANGKA (View / Edit Mode, rata tengah) ================= */}
      {editingLabel ? (
        <input
          type="text"
          autoFocus
          className="nodrag block w-full mt-3 box-border bg-transparent border-0 border-b border-neutral-400
                     text-neutral-900 text-[13px] font-mono uppercase tracking-wide text-center
                     outline-none focus:border-red-700
                     px-1 py-1.5 leading-normal"
          style={{ height: "auto", lineHeight: 1.6, position: "relative", zIndex: 2 }}
          placeholder="NAMA TERSANGKA"
          value={data.label ?? ""}
          onChange={(e) => data.onChangeLabel?.(e.target.value)}
          onBlur={() => setEditingLabel(false)}
        />
      ) : (
        <div
          className="nodrag block w-full mt-3 box-border border-b border-neutral-400
                     text-neutral-900 text-[13px] font-mono uppercase tracking-wide text-center
                     px-1 py-1.5 leading-normal"
          style={{ ...viewTextStyle, lineHeight: 1.6, position: "relative", zIndex: 2 }}
          onClick={() => setEditingLabel(true)}
        >
          {data.label?.trim() ? data.label : (
            <span className="text-neutral-400">NAMA TERSANGKA</span>
          )}
        </div>
      )}

      {/* ================= KETERANGAN / DESKRIPSI (View / Edit Mode) ================= */}
      {editingDesc ? (
        <textarea
          autoFocus
          className="nodrag block w-full mt-3 box-border bg-transparent border-0
                     text-neutral-700 text-[11px] resize-none
                     outline-none px-1 py-1.5 leading-relaxed"
          style={{ height: "auto", lineHeight: 1.6, position: "relative", zIndex: 2 }}
          placeholder="Deskripsi / peran dalam kasus..."
          value={data.description ?? ""}
          onChange={(e) => data.onChangeDesc?.(e.target.value)}
          onBlur={() => setEditingDesc(false)}
          rows={2}
        />
      ) : (
        <div
          className="nodrag block w-full mt-3 box-border text-neutral-700 text-[11px] px-1 py-1.5 leading-relaxed"
          style={{ ...viewTextStyle, lineHeight: 1.6, position: "relative", zIndex: 2 }}
          onClick={() => setEditingDesc(true)}
        >
          {data.description?.trim() ? (
            data.description
          ) : (
            <span className="text-neutral-400">Deskripsi / peran dalam kasus...</span>
          )}
        </div>
      )}
    </div>
  );
}
