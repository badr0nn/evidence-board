import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ConnectionMode,
  getNodesBounds,
  getViewportForBounds,
} from "reactflow";
import "reactflow/dist/style.css";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

import SuspectNode from "./components/nodes/SuspectNode";
import PhotoNode from "./components/nodes/PhotoNode";
import NoteNode from "./components/nodes/NoteNode";
import RedStringEdge from "./components/edges/RedStringEdge";
import GreenStringEdge from "./components/edges/GreenStringEdge";

const LOGO_SRC = "/siber-logo.jpg";

// Ambil dari .env (lihat README / .env.example)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";
// Scope terbatas: aplikasi hanya bisa mengakses file yang DIBUAT atau DIPILIH
// sendiri oleh pengguna lewat Picker -> paling aman untuk aplikasi pihak ketiga.
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const nodeTypes = { suspect: SuspectNode, photo: PhotoNode, note: NoteNode };
const edgeTypes = { redstring: RedStringEdge, greenString: GreenStringEdge };
const defaultEdgeOptions = { type: "redstring" };

let idCounter = 0;
function genId(prefix) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function loadImageAsDataURL(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

// Memuat script eksternal satu kali, mengembalikan Promise
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Gagal memuat script: ${src}`));
    document.body.appendChild(script);
  });
}

function safeFileName(title) {
  return (title || "evidence-board")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");
}

function BoardCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [caseTitle, setCaseTitle] = useState("Untitled Case File #001");
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gdriveBusy, setGdriveBusy] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  // Warna koneksi aktif: 'red' | 'green' — menentukan tipe edge yang dipakai onConnect
  const [activeConnectionColor, setActiveConnectionColor] = useState("red");

  const reactFlowInstance = useReactFlow();
  const canvasWrapperRef = useRef(null);
  const loadInputRef = useRef(null);
  const tokenClientRef = useRef(null);

  // ---------- Update data satu node (dipakai oleh semua custom node) ----------
  const updateNodeData = useCallback(
    (id, partialData) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...partialData } } : n
        )
      );
    },
    [setNodes]
  );

  // === FIX BUG: callback bernama eksplisit, semua bermuara ke updateNodeData ===
  // Dipakai oleh SuspectNode (label/description/image) dan tetap kompatibel
  // dengan node lain yang masih memakai `data.onChange(partial)` generik.
  const makeDataWithHandler = useCallback(
    (id, initialData) => ({
      ...initialData,
      onChange: (partial) => updateNodeData(id, partial),
      onChangeLabel: (value) => updateNodeData(id, { label: value }),
      onChangeDesc: (value) => updateNodeData(id, { description: value }),
      onChangeImage: (image) => updateNodeData(id, { image }),
    }),
    [updateNodeData]
  );

  // ---------- Penempatan node baru: sekitar tengah viewport, sedikit acak ----------
  const getSpawnPosition = useCallback(() => {
    const viewport = reactFlowInstance.getViewport
      ? reactFlowInstance.getViewport()
      : { x: 0, y: 0, zoom: 1 };
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    const centerScreen = {
      x: (rect?.width || window.innerWidth) / 2 - viewport.x,
      y: (rect?.height || window.innerHeight) / 2 - viewport.y,
    };
    const zoom = viewport.zoom || 1;
    const jitterX = (Math.random() - 0.5) * 220;
    const jitterY = (Math.random() - 0.5) * 160;
    return {
      x: centerScreen.x / zoom + jitterX,
      y: centerScreen.y / zoom + jitterY,
    };
  }, [reactFlowInstance]);

  const handleAddSuspect = useCallback(() => {
    const id = genId("suspect");
    setNodes((nds) =>
      nds.concat({
        id,
        type: "suspect",
        position: getSpawnPosition(),
        // width/height awal WAJIB diisi agar NodeResizer (lihat SuspectNode.jsx)
        // punya titik awal ukuran yang jelas -- tanpa ini, wrapper node React
        // Flow tidak punya dimensi pasti dan kartu (width:100%/height:100%)
        // bisa kolaps ke 0px saat pertama kali dirender.
        style: { width: 220, height: 300 },
        data: makeDataWithHandler(id, { label: "", description: "", image: null }),
      })
    );
  }, [getSpawnPosition, makeDataWithHandler, setNodes]);

  const handleAddNote = useCallback(() => {
    const id = genId("note");
    setNodes((nds) =>
      nds.concat({
        id,
        type: "note",
        position: getSpawnPosition(),
        style: { width: 190, height: 170 },
        data: makeDataWithHandler(id, { text: "" }),
      })
    );
  }, [getSpawnPosition, makeDataWithHandler, setNodes]);

  const handleAddPhoto = useCallback(() => {
    const id = genId("photo");
    setNodes((nds) =>
      nds.concat({
        id,
        type: "photo",
        position: getSpawnPosition(),
        data: makeDataWithHandler(id, { image: null, label: "" }),
      })
    );
  }, [getSpawnPosition, makeDataWithHandler, setNodes]);

  // ---------- Koneksi antar node (benang merah/hijau, tergantung pilihan aktif) ----------
  const onConnect = useCallback(
    (connection) =>
      setEdges((eds) =>
        addEdge(
          { ...connection, type: activeConnectionColor === "green" ? "greenString" : "redstring" },
          eds
        )
      ),
    [setEdges, activeConnectionColor]
  );

  // ---------- Helper bersama: pulihkan board dari objek payload (lokal maupun GDrive) ----------
  const restoreBoardFromPayload = useCallback(
    (parsed) => {
      const loadedNodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
      const loadedEdges = Array.isArray(parsed?.edges) ? parsed.edges : [];

      const hydratedNodes = loadedNodes.map((n) => ({
        ...n,
        data: makeDataWithHandler(n.id, { ...n.data, onChange: undefined }),
      }));
      // Pertahankan tipe edge yang tersimpan (merah/hijau) — jangan dipaksa
      // jadi 'redstring' semua, hanya fallback bila tipe tidak dikenali.
      const hydratedEdges = loadedEdges.map((ed) => ({
        ...ed,
        type: ed.type === "greenString" ? "greenString" : "redstring",
      }));

      setCaseTitle(parsed?.caseTitle || "Untitled Case File");
      setNodes(hydratedNodes);
      setEdges(hydratedEdges);
      idCounter += 1000; // hindari bentrok id dengan data lama

      window.requestAnimationFrame(() => {
        reactFlowInstance.fitView?.({ padding: 0.2, duration: 300 });
      });
    },
    [makeDataWithHandler, setNodes, setEdges, reactFlowInstance]
  );

  // ================= SAVE / LOAD LOKAL (data.json) =================
  const handleSaveBoard = useCallback(() => {
    setIsSaving(true);
    try {
      const payload = { caseTitle, nodes, edges, savedAt: new Date().toISOString() };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsSaving(false);
    }
  }, [caseTitle, nodes, edges]);

  const handleLoadClick = useCallback(() => loadInputRef.current?.click(), []);

  const handleLoadFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          restoreBoardFromPayload(JSON.parse(reader.result));
        } catch (err) {
          console.error("Gagal memuat file board:", err);
          alert("File data.json tidak valid atau rusak.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [restoreBoardFromPayload]
  );

  // ================= GOOGLE DRIVE: init GIS (OAuth) + Picker =================
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
      console.warn(
        "VITE_GOOGLE_CLIENT_ID / VITE_GOOGLE_API_KEY belum diisi — fitur Google Drive dinonaktifkan. Lihat README."
      );
      return;
    }

    let cancelled = false;

    Promise.all([
      loadScriptOnce("https://accounts.google.com/gsi/client"),
      loadScriptOnce("https://apis.google.com/js/api.js"),
    ])
      .then(() => {
        if (cancelled) return;

        // Token client untuk OAuth 2.0 (Google Identity Services)
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: () => {}, // di-override per-request, lihat requestAccessToken()
        });

        // Muat modul Picker dari gapi
        window.gapi.load("picker", () => {
          if (!cancelled) setGoogleReady(true);
        });
      })
      .catch((err) => console.error("Gagal memuat Google API:", err));

    return () => {
      cancelled = true;
    };
  }, []);

  // Meminta access token (munculkan popup consent bila perlu)
  const requestAccessToken = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!tokenClientRef.current) {
        reject(new Error("Google API belum siap. Cek konfigurasi Client ID/API Key."));
        return;
      }
      tokenClientRef.current.callback = (response) => {
        if (response.error) {
          reject(response);
          return;
        }
        resolve(response.access_token);
      };
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    });
  }, []);

  // ---------- SAVE TO GDRIVE (multipart upload) ----------
  const handleSaveToGDrive = useCallback(async () => {
    if (!googleReady) {
      alert("Google Drive belum siap. Cek konfigurasi Client ID/API Key di .env.");
      return;
    }
    setGdriveBusy(true);
    try {
      const token = await requestAccessToken();
      const payload = { caseTitle, nodes, edges, savedAt: new Date().toISOString() };
      const fileContent = JSON.stringify(payload, null, 2);
      const fileName = `${safeFileName(caseTitle)}-evidence-board.json`;
      const metadata = { name: fileName, mimeType: "application/json" };

      const boundary = "evidence_board_boundary_" + Date.now();
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        fileContent +
        closeDelimiter;

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload gagal (${res.status}): ${errText}`);
      }
      const result = await res.json();
      alert(`Board tersimpan ke Google Drive sebagai "${result.name}".`);
    } catch (err) {
      console.error("Gagal menyimpan ke Google Drive:", err);
      alert("Gagal menyimpan ke Google Drive. Cek console untuk detail.");
    } finally {
      setGdriveBusy(false);
    }
  }, [googleReady, requestAccessToken, caseTitle, nodes, edges]);

  // ---------- LOAD FROM GDRIVE (Google Picker) ----------
  const openDrivePicker = useCallback(
    (token) => {
      const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setMimeTypes("application/json")
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .setTitle("Pilih file Evidence Board (.json)")
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const fileId = data.docs[0].id;
            try {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (!res.ok) throw new Error(`Gagal mengunduh file (${res.status})`);
              const parsed = await res.json();
              restoreBoardFromPayload(parsed);
            } catch (err) {
              console.error("Gagal memuat file dari Google Drive:", err);
              alert("Gagal membaca file dari Google Drive. Pastikan file berformat JSON valid.");
            } finally {
              setGdriveBusy(false);
            }
          } else if (data.action === window.google.picker.Action.CANCEL) {
            setGdriveBusy(false);
          }
        })
        .build();

      picker.setVisible(true);
    },
    [restoreBoardFromPayload]
  );

  const handleLoadFromGDrive = useCallback(async () => {
    if (!googleReady) {
      alert("Google Drive belum siap. Cek konfigurasi Client ID/API Key di .env.");
      return;
    }
    setGdriveBusy(true);
    try {
      const token = await requestAccessToken();
      openDrivePicker(token);
    } catch (err) {
      console.error("Gagal membuka Google Drive:", err);
      alert("Gagal membuka Google Drive. Cek console untuk detail.");
      setGdriveBusy(false);
    }
  }, [googleReady, requestAccessToken, openDrivePicker]);

  // ================= EXPORT PDF =================
  // Metode resmi React Flow untuk export gambar: hitung bounding box SELURUH
  // node (getNodesBounds), lalu hitung transform (x, y, zoom) yang pas untuk
  // memuat seluruh bounding box itu ke ukuran gambar target
  // (getViewportForBounds), lalu screenshot elemen `.react-flow__viewport`
  // dengan transform tsb dipaksakan lewat inline style saat capture.
  // html-to-image (toPng) dipakai sebagai pengganti html2canvas karena lebih
  // akurat merender elemen SVG (garis edge React Flow) tanpa terpotong.
  const handleExportPDF = useCallback(async () => {
    if (!canvasWrapperRef.current) return;
    setIsExporting(true);

    try {
      const nodes = reactFlowInstance.getNodes();
      if (!nodes.length) {
        alert("Belum ada node di kanvas untuk di-export.");
        return;
      }

      // Bounding box seluruh node, diberi padding supaya garis/tepi node
      // terluar tidak mepet ke pinggir gambar hasil export.
      const nodesBounds = getNodesBounds(nodes);
      const exportPadding = 80;
      nodesBounds.x -= exportPadding;
      nodesBounds.y -= exportPadding;
      nodesBounds.width += exportPadding * 2;
      nodesBounds.height += exportPadding * 2;

      // Resolusi gambar target: lebar tetap tinggi, tinggi menyesuaikan
      // rasio bounding box supaya proporsi node/edge tidak gepeng/melar.
      const imageWidth = 1920;
      const imageHeight = Math.max(
        1,
        Math.round(imageWidth * (nodesBounds.height / nodesBounds.width))
      );

      // minZoom 0.5, maxZoom 2 -> transform (x, y, zoom) presisi agar
      // seluruh nodesBounds pas termuat di imageWidth x imageHeight.
      const viewportTransform = getViewportForBounds(
        nodesBounds,
        imageWidth,
        imageHeight,
        0.5,
        2
      );

      const viewportEl = canvasWrapperRef.current.querySelector(".react-flow__viewport");
      if (!viewportEl) {
        throw new Error("Elemen .react-flow__viewport tidak ditemukan di DOM.");
      }

      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#0b0f19",
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${viewportTransform.x}px, ${viewportTransform.y}px) scale(${viewportTransform.zoom})`,
        },
      });

      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.setFillColor(11, 15, 25);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      // a) Judul kasus di tengah atas
      pdf.setFont("courier", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(244, 233, 193);
      pdf.text(caseTitle || "UNTITLED CASE FILE", pageWidth / 2, 32, { align: "center" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(120, 130, 165);
      pdf.text(`Report generated: ${new Date().toLocaleString("id-ID")}`, pageWidth / 2, 46, {
        align: "center",
      });

      const marginTop = 60;
      const marginBottom = 60;
      const marginSide = 24;
      const maxW = pageWidth - marginSide * 2;
      const maxH = pageHeight - marginTop - marginBottom;
      const ratio = imageWidth / imageHeight;

      let imgW = maxW;
      let imgH = imgW / ratio;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = imgH * ratio;
      }
      const imgX = (pageWidth - imgW) / 2;
      const imgY = marginTop + (maxH - imgH) / 2;

      pdf.addImage(dataUrl, "PNG", imgX, imgY, imgW, imgH);

      // b) Watermark di bagian bawah
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(193, 18, 31);
      pdf.text("CONFIDENTIAL - EVIDENCE BOARD BY BADR0N", marginSide, pageHeight - 20);

      // c) Logo Siber di pojok kanan bawah
      try {
        const logoDataUrl = await loadImageAsDataURL(LOGO_SRC);
        const logoW = 30;
        const logoH = 45;
        pdf.addImage(
          logoDataUrl,
          "JPEG",
          pageWidth - marginSide - logoW,
          pageHeight - logoH - 12,
          logoW,
          logoH
        );
      } catch (err) {
        console.warn("Logo Siber tidak dapat dimuat untuk PDF:", err);
      }

      pdf.save(`${safeFileName(caseTitle)}.pdf`);
    } catch (err) {
      console.error("Gagal export PDF:", err);
      alert("Terjadi kesalahan saat membuat PDF. Cek console untuk detail.");
    } finally {
      setIsExporting(false);
    }
  }, [caseTitle, reactFlowInstance]);

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-[#0b0f19]">
      {/* ================= HEADER (64px, tidak overlap dengan kanvas) ================= */}
      <header className="h-16 shrink-0 w-full bg-slate-950/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 z-20">
        {/* Kiri: logo + watermark */}
        <div className="flex items-center gap-3 min-w-[220px]">
          <img
            src={LOGO_SRC}
            alt="Logo Siber"
            className="w-9 h-9 object-contain rounded shadow-md shadow-black/50"
          />
          <div className="leading-tight select-none">
            <p className="text-sm font-semibold tracking-wide text-slate-100">
              EVIDENCE BOARD
            </p>
            <p className="text-[10px] tracking-widest text-slate-500">
              BY BADR0N 🛡️
            </p>
          </div>
        </div>

        {/* Tengah: input Case Title */}
        <div className="flex-1 flex flex-col items-center px-6">
          <span className="text-[9px] tracking-[3px] text-slate-500 font-semibold mb-1">
            CASE TITLE
          </span>
          <input
            type="text"
            value={caseTitle}
            onChange={(e) => setCaseTitle(e.target.value)}
            placeholder="Masukkan judul kasus..."
            className="w-full max-w-xl bg-slate-900 border border-slate-700 focus:border-red-700 text-amber-100 text-center text-base tracking-wide rounded-md px-4 py-1.5 outline-none shadow-inner shadow-black/40 font-mono"
          />
        </div>

        {/* Kanan: indikator status */}
        <div className="flex items-center gap-2 min-w-[220px] justify-end">
          <span className="status-dot" />
          <span className="text-xs text-slate-300 font-medium">SECURE CONNECTION</span>
        </div>
      </header>

      {/* ================= AREA KANVAS (murni React Flow, mengisi sisa tinggi layar) ================= */}
      <div className="flex-1 w-full relative min-h-0 rf-wrapper" ref={canvasWrapperRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          connectionMode={ConnectionMode.Loose}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="#2a3350" />
          <Controls className={isExporting ? "hide-on-export" : ""} showInteractive={false} />
          <MiniMap
            className={isExporting ? "hide-on-export" : ""}
            pannable
            zoomable
            nodeColor={(n) => {
              if (n.type === "suspect") return "#c1121f";
              if (n.type === "note") return "#475569";
              if (n.type === "photo") return "#64748b";
              return "#94a3b8";
            }}
            maskColor="rgba(11,15,25,0.7)"
          />
        </ReactFlow>

        {/* ================= PANEL KONTROL (mengapung, kanan atas kanvas) ================= */}
        {!isExporting && (
          <div className="absolute top-4 right-4 z-20 w-56 bg-slate-900/70 backdrop-blur-md border border-slate-700 rounded-xl p-3 flex flex-col gap-1.5 shadow-2xl shadow-black/60">
            <p className="text-[10px] tracking-[2px] text-slate-500 font-bold px-1 pb-1.5 mb-0.5 border-b border-slate-700/80">
              CASE FILE MENU
            </p>

            <button
              onClick={handleAddSuspect}
              className="text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2 transition-colors"
            >
              + Add Suspect
            </button>
            <button
              onClick={handleAddNote}
              className="text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2 transition-colors"
            >
              + Add Note
            </button>
            <button
              onClick={handleAddPhoto}
              className="text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2 transition-colors"
            >
              + Add Evidence Photo
            </button>

            {/* ---- Toggle warna benang koneksi aktif ---- */}
            <div className="mt-1.5 pt-2 border-t border-dashed border-slate-700">
              <p className="text-[9px] tracking-[1.5px] text-slate-500 font-semibold px-1 mb-1">
                ACTIVE CONNECTION COLOR
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveConnectionColor("red")}
                  aria-pressed={activeConnectionColor === "red"}
                  className={`flex-1 text-xs rounded-md px-2 py-1.5 border transition-colors ${
                    activeConnectionColor === "red"
                      ? "bg-red-800/80 border-red-600 text-white"
                      : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  🔴 Red
                </button>
                <button
                  type="button"
                  onClick={() => setActiveConnectionColor("green")}
                  aria-pressed={activeConnectionColor === "green"}
                  className={`flex-1 text-xs rounded-md px-2 py-1.5 border transition-colors ${
                    activeConnectionColor === "green"
                      ? "bg-green-800/80 border-green-600 text-white"
                      : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  🟢 Green
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveBoard}
              disabled={isSaving}
              className="mt-1.5 pt-2 border-t border-dashed border-slate-700 text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border-x border-b border-slate-700 rounded-md px-3 py-2 transition-colors disabled:opacity-50"
            >
              💾 Save Board (.json)
            </button>
            <button
              onClick={handleLoadClick}
              className="text-left text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2 transition-colors"
            >
              📂 Load Board
            </button>
            <input
              ref={loadInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleLoadFile}
            />

            <button
              onClick={handleSaveToGDrive}
              disabled={gdriveBusy || !googleReady}
              title={!googleReady ? "Konfigurasi Client ID / API Key belum lengkap" : ""}
              className="mt-1.5 pt-2 border-t border-dashed border-slate-700 text-left text-sm text-sky-100 bg-sky-900/60 hover:bg-sky-800/70 border-x border-b border-sky-800 rounded-md px-3 py-2 transition-colors disabled:opacity-40"
            >
              {gdriveBusy ? "⏳ Menghubungkan..." : "☁️ Save to GDrive"}
            </button>
            <button
              onClick={handleLoadFromGDrive}
              disabled={gdriveBusy || !googleReady}
              title={!googleReady ? "Konfigurasi Client ID / API Key belum lengkap" : ""}
              className="text-left text-sm text-sky-100 bg-sky-900/60 hover:bg-sky-800/70 border border-sky-800 rounded-md px-3 py-2 transition-colors disabled:opacity-40"
            >
              {gdriveBusy ? "⏳ Menghubungkan..." : "☁️ Load from GDrive"}
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="mt-1.5 pt-2 border-t border-dashed border-slate-700 text-left text-sm text-white bg-red-800/90 hover:bg-red-700 border-x border-b border-red-700 rounded-md px-3 py-2 transition-colors disabled:opacity-50"
            >
              {isExporting ? "⏳ Membuat PDF..." : "🖨️ Export PDF Report"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <BoardCanvas />
    </ReactFlowProvider>
  );
}
