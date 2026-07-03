"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";

/* ──────────────────────────────────────────────
   Type Definitions
   ────────────────────────────────────────────── */

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
  is_safe: boolean;
  violations: string[];
  equipment: {
    helmet: boolean;
    vest: boolean;
  };
}

interface DetectionResult {
  success: boolean;
  annotated_image: string;
  detections: Detection[];
  summary: {
    total_persons: number;
    safe_count: number;
    violation_count: number;
    is_all_safe: boolean;
  };
  readiness_score: number;
  source?: string;
}

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const INDUSTRIAL_SOURCES = [
  "CCTV-01: Main Gate Checkpoint",
  "CCTV-02: Assembly Line A Checkpoint",
  "CCTV-03: Loading Dock B Sector",
  "DRONE-01: Aerial Patrol Sector 3",
  "DRONE-02: Offshore Rig Deck B",
  "CAM-04: Confined Space Area",
  "CAM-05: High-Voltage Substation Area",
];

/* ──────────────────────────────────────────────
   Icon Components (inline SVG for zero deps)
   ────────────────────────────────────────────── */

function ShieldIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function UploadIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function ImageIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M6.75 2.25h10.5A2.25 2.25 0 0 1 19.5 4.5v15a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5v-15A2.25 2.25 0 0 1 6.75 2.25Z" />
    </svg>
  );
}

function FlaskIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function SearchIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function WarningIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  );
}

function ListIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
    </svg>
  );
}

/* ──────────────────────────────────────────────
   Main Page Component
   ────────────────────────────────────────────── */

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSource, setSelectedSource] = useState<string>(INDUSTRIAL_SOURCES[0]);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  /* ── File handling ─────────────────────────── */

  const handleFile = useCallback((selectedFile: File) => {
    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError("Format tidak didukung. Gunakan JPEG, PNG, atau WebP.");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("Ukuran file melebihi batas maksimal 10 MB.");
      return;
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setResult(null);
    setError(null);
  }, []);

  /* ── Drag-and-drop handlers ────────────────── */

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFile(selectedFile);
    },
    [handleFile]
  );

  /* ── Submit to API ─────────────────────────── */

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingMessage(`Membuat koneksi aman ke ${selectedSource}...`);

    let step = 0;
    const steps = [
      `Menghubungkan ke enkripsi SSL aliran ${selectedSource}...`,
      "Menerima aliran data sensor dan sinkronisasi sudut...",
      "Mengekstraksi bingkai gambar resolusi penuh...",
      "Mengunggah citra ke AI Inference Cluster (YOLOv8)...",
      "Melakukan analisis kepatuhan Alat Pelindung Diri (APD)..."
    ];

    const interval = setInterval(() => {
      if (step < steps.length) {
        setLoadingMessage(steps[step]);
        step++;
      }
    }, 1100);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("source", selectedSource);

    try {
      const res = await fetch(`${API_URL}/api/detect`, {
        method: "POST",
        body: formData,
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || `Server merespons dengan status ${res.status}`
        );
      }

      const data: DetectionResult = await res.json();
      if (!data.success) {
        throw new Error("Deteksi gagal. Silakan coba dengan foto lain.");
      }
      setResult(data);
      setImageSize({ width: 0, height: 0 });
    } catch (err: unknown) {
      clearInterval(interval);
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menghubungi server. Pastikan semua service berjalan.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Reset state ───────────────────────────── */

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setImageSize({ width: 0, height: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Render ────────────────────────────────── */

  return (
    <main className="min-h-screen bg-slate-50">
      {/* ═══════ Navbar ═══════ */}
      <header className="bg-slate-900 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          {/* Logo */}
          <div className="w-11 h-11 bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo.png"
              alt="ArkGuard AI Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              ArkGuard AI
            </h1>
            <p className="text-sm text-slate-400 font-medium -mt-0.5">
              Manpower Safety Sentinel
            </p>
          </div>

          {/* Online indicator */}
          <div className="ml-auto flex items-center gap-2 bg-slate-800/60 rounded-full px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-slate-400 font-medium">
              System Online
            </span>
          </div>
        </div>
      </header>

      {/* ═══════ Content ═══════ */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Page heading */}
        <div className="mb-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-800">
            Deteksi Keselamatan Kerja
          </h2>
          <p className="text-slate-500 mt-1">
            Unggah foto pekerja untuk analisis kepatuhan K3 menggunakan AI
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ═══════ LEFT COLUMN — Upload ═══════ */}
          <div className="space-y-4 animate-fade-in">
            {/* Step badge */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                1
              </div>
              <h3 className="text-lg font-semibold text-slate-700">
                Sumber &amp; Unggah Foto
              </h3>
            </div>

            {/* Mock Source Selector */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
              <label htmlFor="source-select" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Sumber Pengawasan K3 (Surveillance Source)
              </label>
              <div className="relative">
                <select
                  id="source-select"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-10"
                >
                  {INDUSTRIAL_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative bg-white border-2 border-dashed rounded-xl p-10
                flex flex-col items-center justify-center cursor-pointer
                transition-all duration-300 min-h-[320px] group
                ${
                  isDragOver
                    ? "border-emerald-500 bg-emerald-50/70 scale-[1.01] shadow-lg shadow-emerald-100"
                    : "border-slate-300 hover:border-slate-500 hover:shadow-md"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
                id="image-upload"
              />

              {preview ? (
                <div className="relative w-full animate-fade-in">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview gambar yang akan dianalisis"
                    className="w-full h-auto max-h-[280px] object-contain rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="absolute top-2 right-2 bg-slate-900/80 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors backdrop-blur-sm"
                    aria-label="Hapus gambar"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-slate-200 transition-colors">
                    <UploadIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-600 font-semibold mb-1">
                    Seret &amp; lepas foto di sini
                  </p>
                  <p className="text-slate-400 text-sm">
                    atau klik untuk memilih file
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-[11px] text-slate-300 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                      JPEG
                    </span>
                    <span className="text-[11px] text-slate-300 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                      PNG
                    </span>
                    <span className="text-[11px] text-slate-300 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                      WebP
                    </span>
                    <span className="text-[11px] text-slate-300">
                      · Maks 10 MB
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* File info card */}
            {file && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {file.type.split("/")[1].toUpperCase()}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              id="btn-analyze"
              className={`
                w-full px-6 py-3.5 rounded-lg font-semibold shadow-md
                transition-all duration-300 flex items-center justify-center gap-2.5
                ${
                  !file || loading
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : "bg-slate-900 hover:bg-slate-800 text-white hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98]"
                }
              `}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Menganalisis...</span>
                </>
              ) : (
                <>
                  <FlaskIcon className="w-5 h-5" />
                  <span>Mulai Analisis K3</span>
                </>
              )}
            </button>

            {/* Dynamic loading indicator */}
            {loading && (
              <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center gap-3.5 shadow-lg border border-slate-800 animate-pulse">
                <div className="flex-shrink-0 relative">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-450 uppercase tracking-wider text-slate-400">
                    Koneksi Command Center
                  </p>
                  <p className="text-sm font-medium text-emerald-400 truncate mt-0.5">
                    {loadingMessage}
                  </p>
                </div>
              </div>
            )}

            {/* Error alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                <WarningIcon className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Analisis Gagal
                  </p>
                  <p className="text-sm text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* ═══════ RIGHT COLUMN — Results ═══════ */}
          <div className="space-y-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {/* Step badge */}
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                2
              </div>
              <h3 className="text-lg font-semibold text-slate-700">
                Hasil Deteksi
              </h3>
            </div>

            {result ? (
              <div className="space-y-4 animate-slide-up">
                {/* ── Aerial View Mode Banner ── */}
                {(result.source || selectedSource).toLowerCase().includes("drone") && (
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-3.5 flex items-center gap-3 shadow-lg shadow-blue-500/20 border border-blue-500/30 animate-pulse">
                    <div className="bg-white/20 p-1.5 rounded-lg flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest leading-none">
                        Sensor Mode
                      </p>
                      <p className="text-xs font-bold mt-1 leading-none">
                        Aerial Top-Down Analysis Mode: Active
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Manpower Readiness Score Gauge ── */}
                {(() => {
                  const score = result.readiness_score;
                  let colorClass = "text-emerald-500";
                  let strokeClass = "stroke-emerald-500";
                  let bgStrokeClass = "stroke-emerald-100";
                  let bgBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  let statusText = "Fit to Work";
                  let statusDesc = "Tingkat kepatuhan K3 optimal. Semua pekerja mematuhi standar keselamatan.";

                  if (score < 50) {
                    colorClass = "text-rose-500";
                    strokeClass = "stroke-rose-500";
                    bgStrokeClass = "stroke-rose-100";
                    bgBadgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                    statusText = "Not Fit to Work";
                    statusDesc = "Ditemukan pelanggaran APD kritis! Area kerja memerlukan perhatian segera.";
                  } else if (score <= 80) {
                    colorClass = "text-amber-500";
                    strokeClass = "stroke-amber-500";
                    bgStrokeClass = "stroke-amber-100";
                    bgBadgeClass = "bg-amber-50 text-amber-700 border-amber-100";
                    statusText = "Caution Required";
                    statusDesc = "Beberapa personel terdeteksi tidak menggunakan APD lengkap.";
                  }

                  const radius = 32;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (score / 100) * circumference;

                  return (
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 flex items-center gap-5">
                      {/* Circle Progress */}
                      <div className="relative flex-shrink-0 w-20 h-20">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={bgStrokeClass}
                            strokeWidth="6"
                            fill="transparent"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={`${strokeClass} transition-all duration-1000 ease-out`}
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-lg font-extrabold text-slate-800 leading-none">{score}%</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Readiness</span>
                        </div>
                      </div>

                      {/* Detail Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-slate-800 font-bold text-sm">Manpower Compliance Score</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${bgBadgeClass}`}>
                            {statusText}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{statusDesc}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Summary Badge ── */}
                {result.summary.total_persons === 0 ? (
                  /* No persons detected */
                  <div className="rounded-xl p-5 flex items-center gap-4 bg-amber-50 border border-amber-200">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SearchIcon className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-700">
                        Tidak Ada Pekerja Terdeteksi
                      </p>
                      <p className="text-sm text-amber-600 mt-0.5">
                        Pastikan foto menampilkan pekerja dengan jelas dan
                        pencahayaan memadai.
                      </p>
                    </div>
                  </div>
                ) : result.summary.is_all_safe ? (
                  /* All safe */
                  <div className="rounded-xl p-5 flex items-center gap-4 bg-emerald-100 border border-emerald-200">
                    <div className="w-12 h-12 bg-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircleIcon className="w-7 h-7 text-emerald-700" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-700">
                        Semua Aman ✓
                      </p>
                      <p className="text-sm text-emerald-600 mt-0.5">
                        {result.summary.total_persons} pekerja terdeteksi —
                        semua mematuhi standar K3
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Violations found */
                  <div className="rounded-xl p-5 flex items-center gap-4 bg-red-100 border border-red-200">
                    <div className="w-12 h-12 bg-red-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <WarningIcon className="w-7 h-7 text-red-700" />
                    </div>
                    <div>
                      <p className="font-bold text-red-700">
                        ⚠ Pelanggaran Terdeteksi
                      </p>
                      <p className="text-sm text-red-600 mt-0.5">
                        {result.summary.violation_count} dari{" "}
                        {result.summary.total_persons} pekerja melanggar standar
                        K3
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Annotated Image with QA Visual Highlight ── */}
                <div className="bg-white rounded-xl shadow-lg p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Hasil Anotasi AI &amp; Analisis QA
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                        Aman
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500 animate-pulse" />
                        Pelanggaran (Pulsing QA)
                      </span>
                    </div>
                  </div>

                  {/* Relative image container */}
                  <div className="relative overflow-hidden rounded-lg bg-slate-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${result.annotated_image}`}
                      alt="Hasil deteksi keselamatan kerja"
                      className="w-full h-auto block"
                      onLoad={(e) => {
                        const { naturalWidth, naturalHeight } = e.currentTarget;
                        setImageSize({ width: naturalWidth, height: naturalHeight });
                      }}
                      id="result-image"
                    />

                    {/* SVG Mask Overlay */}
                    {imageSize.width > 0 && imageSize.height > 0 && (
                      <>
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <defs>
                            <mask id="qa-highlight-mask">
                              {/* White base = fully opaque mask (dimmed background) */}
                              <rect width="100%" height="100%" fill="white" />
                              {/* Black boxes = fully transparent holes (bright spotlight) */}
                              {result.detections.map((det, idx) => {
                                const [x1, y1, x2, y2] = det.bbox;
                                return (
                                  <rect
                                    key={idx}
                                    x={x1}
                                    y={y1}
                                    width={x2 - x1}
                                    height={y2 - y1}
                                    fill="black"
                                  />
                                );
                              })}
                            </mask>
                          </defs>
                          {/* Semi-transparent dark overlay rectangle using the mask */}
                          <rect
                            width="100%"
                            height="100%"
                            fill="#0f172a" // Slate-900
                            opacity="0.65"
                            mask="url(#qa-highlight-mask)"
                          />
                        </svg>

                        {/* HTML absolute overlays for violations */}
                        {result.detections.map((det, idx) => {
                          if (det.is_safe) return null; // Highlight only violations

                          const [x1, y1, x2, y2] = det.bbox;
                          const left = (x1 / imageSize.width) * 100;
                          const top = (y1 / imageSize.height) * 100;
                          const width = ((x2 - x1) / imageSize.width) * 100;
                          const height = ((y2 - y1) / imageSize.height) * 100;

                          return (
                            <div
                              key={idx}
                              className="absolute border-4 border-red-600 animate-pulse pointer-events-none shadow-[0_0_15px_rgba(220,38,38,0.85)] rounded flex flex-col justify-between"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              {/* Float tag top */}
                              <div className="absolute bottom-full left-0 mb-1.5 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-md uppercase tracking-wider whitespace-nowrap">
                                ⚠ PELANGGARAN K3
                              </div>

                              {/* Float tag bottom */}
                              <div className="absolute top-full left-0 mt-1.5 bg-slate-900/90 border border-red-500/40 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap max-w-[150px] truncate">
                                {det.violations.join(", ")}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>

                {/* ── Stats Row ── */}
                {result.summary.total_persons > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
                      <p className="text-2xl font-bold text-slate-800">
                        {result.summary.total_persons}
                      </p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        Total Pekerja
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100 text-center">
                      <p className="text-2xl font-bold text-emerald-600">
                        {result.summary.safe_count}
                      </p>
                      <p className="text-xs text-emerald-500 font-medium mt-0.5">
                        Aman
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100 text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {result.summary.violation_count}
                      </p>
                      <p className="text-xs text-red-500 font-medium mt-0.5">
                        Pelanggaran
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Detection Details ── */}
                {result.detections.length > 0 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
                    <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <ListIcon className="w-5 h-5 text-slate-500" />
                      Detail Deteksi per Pekerja
                    </h4>
                    <div className="space-y-3">
                      {result.detections.map((det, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-4 border transition-colors ${
                            det.is_safe
                              ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
                              : "border-red-200 bg-red-50/50 hover:bg-red-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="font-medium text-slate-700 text-sm">
                              Pekerja #{idx + 1}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                det.is_safe
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {det.is_safe ? "✓ Aman" : "⚠ Pelanggaran"}
                            </span>
                          </div>

                          {/* Equipment status */}
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  det.equipment.helmet
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                                }`}
                              />
                              <span className="text-slate-600">
                                Helm:{" "}
                                <span className="font-medium">
                                  {det.equipment.helmet ? "Ya" : "Tidak"}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  det.equipment.vest
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                                }`}
                              />
                              <span className="text-slate-600">
                                Rompi:{" "}
                                <span className="font-medium">
                                  {det.equipment.vest ? "Ya" : "Tidak"}
                                </span>
                              </span>
                            </div>
                            <div className="text-slate-400 text-xs ml-auto self-center">
                              Confidence: {(det.confidence * 100).toFixed(0)}%
                            </div>
                          </div>

                          {/* Violation tags */}
                          {det.violations.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {det.violations.map((v, vi) => (
                                <span
                                  key={vi}
                                  className="bg-red-100 text-red-700 text-xs px-2.5 py-0.5 rounded-md font-medium"
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Empty state ── */
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-10 flex flex-col items-center justify-center min-h-[320px]">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <SearchIcon className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 font-medium text-center">
                  Hasil analisis akan muncul di sini
                </p>
                <p className="text-slate-300 text-sm mt-1 text-center">
                  Unggah foto dan klik &quot;Mulai Analisis K3&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Footer ═══════ */}
        <footer className="mt-16 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-800 rounded overflow-hidden flex items-center justify-center shadow">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/img/logo.png"
                  alt="ArkGuard AI Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs text-slate-400 font-medium">
                ArkGuard AI · Manpower Safety &amp; QA Sentinel
              </span>
            </div>
            <span className="text-[11px] text-slate-300">
              MVP Demo · YOLOv8 + Next.js + Laravel + FastAPI ·{" "}
              {new Date().getFullYear()}
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
