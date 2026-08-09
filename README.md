# Evidence Board (Papan Kasus / Crazy Wall) — v5

React + React Flow + Tailwind. Polaroid tersangka, foto barang bukti, sticky note,
benang merah anti-bug, Save/Load lokal (.json), **Save/Load ke Google Drive**,
Export PDF beridentitas resmi, dan **Basic Auth via Vercel Edge Middleware**.

## 0. Riwayat Perbaikan

### v5 — Vercel Edge Middleware (Basic Auth)

- **`middleware.js` baru di root proyek** (sejajar `src/`, BUKAN di dalam
  `src/`) — Vercel secara otomatis mendeteksi file ini sebagai Edge
  Middleware dan menjalankannya di setiap request, sebelum aplikasi React
  di dalamnya termuat.
- Membaca kredensial dari `process.env.AUTH_USER` / `process.env.AUTH_PASS`,
  dengan fallback `admin` / `Siber2026` bila variabel belum di-set.
- Kredensial salah/kosong -> `401` + header `WWW-Authenticate: Basic
  realm="Secure Area"` (memicu dialog login bawaan browser). Kredensial
  benar -> `NextResponse.next()` (request diteruskan normal).
- Lihat bagian **4. Setup Basic Auth (Vercel Edge Middleware)** di bawah
  untuk cara deploy & konfigurasi env var-nya — termasuk **catatan teknis
  penting** soal pemakaian `next/server` di proyek berbasis Vite.
- Perbaikan teks input `SuspectNode.jsx` dari sesi sebelumnya (tanpa
  `height` tetap, `line-height` numerik eksplisit, padding & margin lega)
  tetap dipertahankan persis seperti versi terakhir yang sudah diperbaiki.

### v3 — Perbaikan Bug Visual

- **Bug scrollbar hilang:** root container di `App.jsx` memakai
  `w-screen h-screen overflow-hidden flex flex-col`, ditambah reset di
  `index.css` (`html, body, #root` di-set `margin:0`, `height:100%`,
  `overflow:hidden`, plus `box-sizing: border-box` global). Area kanvas
  memakai `flex-1 w-full relative min-h-0` — `min-h-0` penting supaya flex
  child tidak menolak menyusut ketika konten (node-node) melebihi tinggi
  layar, yang tadinya memicu scrollbar.
- **Bug teks "NAMA TERSANGKA" terpotong:** input pada `SuspectNode.jsx`
  sekarang memakai padding vertikal cukup (`py-2`), `line-height: 1.6`
  (`leading-normal`), `height: auto` (tidak ada batas tinggi tetap), dan
  `display: block` supaya teks tidak lagi tercekik di baris atas/bawah.

### v4 — Fix Bug Krusial + 2 Fitur Visual Baru

- **FIX BUG: input Nama Tersangka & Keterangan tidak bisa diedit.**
  `SuspectNode.jsx` sekarang mengikat `value` langsung ke `data.label` /
  `data.description`, dan `onChange` memanggil callback bernama eksplisit
  `data.onChangeLabel` / `data.onChangeDesc` (dibuat di `App.jsx` lewat
  `makeDataWithHandler`, keduanya bermuara ke `updateNodeData(id, partial)` →
  `setNodes`) — sehingga ketikan langsung ter-update secara real-time. Handle
  koneksi (`NodeHandles`) diposisikan di tepi kartu (offset -6px keluar),
  jadi tidak pernah menghalangi pointer-events pada input; `position:
  relative` + `pointer-events: auto` juga ditambahkan eksplisit pada
  input/textarea sebagai jaring pengaman. Class `nodrag` tetap dipertahankan.
- **Fitur baru — NoteNode tema gelap:** sticky note yang tadinya kuning terang
  kini memakai gradasi `slate-800 → slate-900`, teks `text-stone-300`, border
  gelap tipis, dan efek "selotip" kaca buram (`rgba(148,163,184,0.16)`) yang
  tetap terlihat natural di atas kanvas gelap.
- **Fitur baru — pilihan warna benang (Merah/Hijau):** `GreenStringEdge.jsx`
  (duplikat `RedStringEdge` dengan palet hijau neon + bayangan hijau gelap)
  didaftarkan sebagai `greenString` di `edgeTypes`. Panel kontrol punya toggle
  **"🔴 Red | 🟢 Green"** — pilihan ini disimpan di state `activeConnectionColor`
  dan menentukan tipe edge yang dipakai `onConnect` setiap kali pengguna
  menarik garis baru. Saat **Load Board**/**Load from GDrive**, tipe edge yang
  tersimpan (merah/hijau) tetap dipertahankan, tidak lagi dipaksa jadi merah
  semua seperti versi sebelumnya.

## 1. Setup Proyek

```bash
npm create vite@latest evidence-board -- --template react
cd evidence-board
npm install reactflow html2canvas jspdf
npm install -D tailwindcss postcss autoprefixer

# Salin semua file dari paket ini ke proyekmu (timpa file bawaan Vite),
# dengan struktur seperti pada bagian "Struktur Folder" di bawah.

cp .env.example .env
# lalu isi VITE_GOOGLE_CLIENT_ID dan VITE_GOOGLE_API_KEY di file .env (lihat bagian 3)

npm run dev
```

> **Penting:** Tempatkan logo institusi persis di `public/siber-logo.jpg`
> (path root `/siber-logo.jpg`) — dipakai di header maupun di PDF. File contoh
> logo "RESERSE SIBER POLRI" sudah disertakan di paket ini.

## 2. Struktur Folder

```
evidence-board/
├── middleware.js              (Vercel Edge Middleware — Basic Auth, WAJIB di root)
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
├── public/
│   └── siber-logo.jpg
└── src/
    ├── main.jsx
    ├── index.css                 (Tailwind + gaya kustom node/edge)
    ├── App.jsx
    └── components/
        ├── nodes/
        │   ├── NodeHandles.jsx      (helper 4 handle: top/bottom/left/right)
        │   ├── SuspectNode.jsx      (kartu polaroid tersangka)
        │   ├── PhotoNode.jsx        (foto barang bukti/TKP)
        │   └── NoteNode.jsx         (sticky note tema gelap)
        └── edges/
            ├── RedStringEdge.jsx    (benang merah bezier)
            └── GreenStringEdge.jsx  (benang hijau bezier)
```

## 3. Setup Basic Auth (Vercel Edge Middleware)

`middleware.js` di root proyek melindungi **seluruh** deployment dengan HTTP
Basic Auth (dialog login bawaan browser) sebelum request menyentuh aplikasi
React di dalamnya.

### Cara kerja

1. Vercel otomatis mendeteksi `middleware.js` di root project sebagai Edge
   Middleware — tidak perlu konfigurasi tambahan di `vercel.json`.
2. Setiap request dicek header `Authorization: Basic ...`. Kalau tidak ada
   atau kredensialnya salah, browser menerima `401` + header
   `WWW-Authenticate: Basic realm="Secure Area"`, yang otomatis memicu
   popup login bawaan browser.
3. Kredensial dibandingkan ke `process.env.AUTH_USER` / `process.env.AUTH_PASS`.
   Kalau env var belum di-set, dipakai fallback `admin` / `Siber2026`.

### Setup di Vercel Dashboard

1. Buka project di Vercel → **Settings → Environment Variables**.
2. Tambahkan:
   - `AUTH_USER` = username yang kamu mau (mis. `investigator`)
   - `AUTH_PASS` = password yang kuat (JANGAN pakai fallback default di
     production)
3. Terapkan untuk environment **Production** (dan **Preview** kalau mau
   preview deployment juga terkunci).
4. Redeploy project agar env var baru terbaca.

### ⚠️ Catatan teknis penting: `next/server` di proyek Vite

`middleware.js` di paket ini memakai `import { NextResponse } from
"next/server"` sesuai permintaan spesifikasi. Perlu jujur disampaikan:
**`next/server` adalah bagian dari package `next`**, bukan API bawaan
Vercel/Vite. Agar module ini bisa di-resolve saat build & deploy, `next`
sudah saya tambahkan sebagai `devDependency` di `package.json` — **tanpa**
harus mengubah proyek ini jadi aplikasi Next.js penuh (tidak perlu folder
`pages/`/`app/`, tidak perlu `next.config.js`, dan `npm run dev`/`build`
tetap memakai Vite seperti biasa).

Ini bekerja karena `NextResponse` pada dasarnya hanyalah wrapper ringan di
atas Web API `Response` standar, dan Vercel Edge Middleware sendiri adalah
fitur platform yang independen dari framework (bukan eksklusif Next.js).
Namun ini tetap kombinasi yang tidak umum, jadi kalau saat build/deploy
Vercel kamu menemukan error terkait resolusi module `next/server`, solusi
paling aman adalah mengganti isi `middleware.js` dengan versi yang memakai
Web API standar (`Request`/`Response` murni, tanpa import `next/server`
sama sekali) — logikanya identik, hanya beda cara mengembalikan response.
Beri tahu saya kalau kamu butuh versi tersebut.

## 4. Setup Google OAuth 2.0 & Drive API (untuk Save/Load Cloud)

Fitur "☁️ Save to GDrive" / "☁️ Load from GDrive" memakai **Google Identity
Services (GIS)** untuk login + **Google Picker API** untuk memilih file, dan
**Drive REST API v3** untuk upload/download — semuanya lewat `fetch()` biasa,
tanpa library berat.

### Langkah di Google Cloud Console

1. Buka [console.cloud.google.com](https://console.cloud.google.com/) → buat
   project baru (atau pakai yang sudah ada).
2. **Aktifkan API** (menu *APIs & Services → Library*):
   - **Google Drive API**
   - **Google Picker API**
3. **Konfigurasi OAuth consent screen** (*APIs & Services → OAuth consent
   screen*):
   - Pilih tipe **External** (atau **Internal** jika pakai Google Workspace
     organisasi).
   - Isi nama aplikasi, email support, dsb.
   - Scope: tambahkan `.../auth/drive.file` (scope ini membatasi akses hanya
     ke file yang dibuat/dipilih sendiri oleh aplikasi — paling aman).
   - Tambahkan akun Google-mu sebagai *Test user* jika app masih status
     "Testing".
4. **Buat kredensial** (*APIs & Services → Credentials → Create Credentials*):
   - **OAuth client ID** → Application type: **Web application**.
     - *Authorized JavaScript origins*: tambahkan
       `http://localhost:5173` (dev) dan domain produksi kamu nanti
       (mis. `https://papan-kasus.contoh.com`).
     - Tidak perlu *Authorized redirect URIs* (memakai flow token implicit
       dari GIS, bukan redirect).
     - Salin **Client ID** yang dihasilkan.
   - **API key** → buat API key baru, lalu (disarankan) batasi supaya hanya
     bisa dipakai untuk **Google Picker API**. Salin **API key** ini.
5. Isi kedua nilai tadi ke file `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
6. Restart `npm run dev` agar env variable baru terbaca.

### Cara kerja teknisnya (ringkas)

- **Login/consent**: `google.accounts.oauth2.initTokenClient({...})` dari GIS
  memunculkan popup consent Google standar dan mengembalikan `access_token`
  sementara (tanpa perlu backend/server-side apapun).
- **Save to GDrive**: `access_token` dipakai untuk `POST` ke
  `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`
  dengan body `multipart/related` berisi metadata (`name`, `mimeType`) +
  konten JSON board — persis seperti spek `multipart/upload`.
- **Load from GDrive**: membuka **Google Picker** (`google.picker.PickerBuilder`)
  yang di-filter `setMimeTypes('application/json')`, sehingga pengguna memilih
  file JSON langsung dari Drive-nya secara visual. Setelah dipilih, file
  diunduh via `GET /drive/v3/files/{fileId}?alt=media` lalu di-parse dan
  di-restore ke board (posisi node, gambar Base64, catatan, dan koneksi benang
  merah dipulihkan persis seperti data lokal).
- Kalau `.env` belum diisi, tombol GDrive otomatis nonaktif (disabled) dan
  fitur Save/Load lokal tetap berfungsi normal.

## 5. Cara Pakai

- **+ Add Suspect / + Add Note / + Add Evidence Photo** — menambah node baru
  di tengah viewport aktif.
- Klik area foto pada **SuspectNode**/**PhotoNode** untuk unggah gambar dari
  komputer (dikonversi Base64, ikut tersimpan penuh di JSON/GDrive).
- Tarik dari **titik merah kecil** di tepi node (atas/bawah/kiri/kanan) ke
  node lain untuk membuat benang merah. `connectionMode="loose"` diaktifkan
  di `<ReactFlow>` sehingga tarikan dari sisi manapun ke sisi manapun selalu
  berhasil menyambung.
- **💾 Save Board (.json)** / **📂 Load Board** — simpan/muat file lokal.
- **☁️ Save to GDrive** / **☁️ Load from GDrive** — simpan/muat langsung dari
  akun Google Drive pengguna.
- **🖨️ Export PDF Report** — papan di-fit ke layar otomatis, lalu dibuat PDF
  berisi judul kasus di atas, watermark "CONFIDENTIAL - EVIDENCE BOARD BY
  BADR0N" di bawah, dan logo Siber di pojok kanan bawah.

## 6. Catatan Teknis (anti-bug)

- Layout memakai `flex flex-col h-screen w-screen`: header sebagai flex item
  bertinggi tetap (64px, `shrink-0`), area kanvas sebagai `flex-1 min-h-0` —
  sehingga panel kontrol yang mengapung (`absolute`) selalu berada **di dalam**
  wadah kanvas, tidak pernah bertumpuk dengan header.
- Semua elemen interaktif di dalam node (`<input>`, `<textarea>`, area foto)
  memakai class **`nodrag`** — mencegah konflik antara mengetik/klik dengan
  mekanisme drag React Flow.
- `connectionMode={ConnectionMode.Loose}` + setiap node memiliki 4 `Handle`
  unik (top/bottom/left/right) via `NodeHandles.jsx` — benang merah selalu
  bisa ditarik & menempel dari sisi manapun tanpa error "handle not found".
- Fungsi callback (`data.onChange`) sengaja tidak ikut tersimpan ke JSON
  (properti fungsi otomatis diabaikan `JSON.stringify`). Saat **Load Board**
  maupun **Load from GDrive**, callback dipasang ulang otomatis lewat
  `restoreBoardFromPayload()` — satu fungsi yang dipakai bersama oleh kedua
  jalur load, supaya perilakunya konsisten.
- Panel kontrol (`{!isExporting && (...)}`) dan Controls/MiniMap React Flow
  disembunyikan sepenuhnya saat **Export PDF** agar tidak ikut ter-capture
  `html2canvas`.
