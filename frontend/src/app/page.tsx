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
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
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
    setConsoleLogs([]);
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
    
    // Initialize Console logs
    const initialLog = `[CONN] Inisialisasi koneksi aman ke ${selectedSource}...`;
    setConsoleLogs([initialLog]);
    setLoadingMessage(initialLog);

    let step = 0;
    const steps = [
      `[AUTH] Enkripsi jalur SSL Command Center selesai.`,
      "[SYNC] Sinkronisasi sudut drone & parameter telemetri...",
      "[FRAME] Ekstraksi bingkai video resolusi ultra...",
      "[UPLD] Mengirim frame ke AI Inference Cluster (YOLOv8)...",
      "[PROC] Menganalisis kepatuhan helm & rompi..."
    ];

    const interval = setInterval(() => {
      if (step < steps.length) {
        setConsoleLogs(prev => [...prev, steps[step]]);
        setLoadingMessage(steps[step]);
        step++;
      }
    }, 850);

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
    setConsoleLogs([]);
    setImageSize({ width: 0, height: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ── Render ────────────────────────────────── */

  return (
    <main className="min-h-screen bg-[#070b13] bg-cyber-grid text-slate-100 relative overflow-hidden font-sans pb-12">
      {/* ── Nebula Glow Effects ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ═══════ Navbar ═══════ */}
      <header className="sticky top-0 z-50 bg-[#090e1a]/60 backdrop-blur-xl border-b border-slate-900 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg shadow-emerald-500/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/logo.png"
                alt="ArkGuard AI Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wider uppercase leading-none">
                ArkGuard AI
              </h1>
              <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-widest mt-1">
                Manpower Safety Sentinel
              </p>
            </div>
          </div>

          {/* System status */}
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-full px-3 py-1.5 shadow-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
              Control Unit Active
            </span>
          </div>
        </div>
      </header>

      {/* ═══════ Content ═══════ */}
      <div className="max-w-7xl mx-auto p-6 relative z-10">
        
        {/* Page heading */}
        <div className="mb-8 border-b border-slate-900 pb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wider">
              Terminal Pengawasan K3
            </h2>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">
              Analisis Kepatuhan Alat Pelindung Diri Menggunakan Visi Komputer &amp; YOLOv8
            </p>
          </div>
          <div className="hidden sm:block text-right">
            <span className="text-[10px] font-mono text-slate-500">SYSTEM_NODE: AG_SENTINEL_WIN_32</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ═══════ LEFT COLUMN — Upload (5 Cols) ═══════ */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Step badge */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                01
              </div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">
                Konfigurasi Input &amp; Feed
              </h3>
            </div>

            {/* Mock Source Selector */}
            <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-5 shadow-2xl relative hud-panel">
              <label htmlFor="source-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Pilih Kamera Pengawasan (Video Source)
              </label>
              <div className="relative">
                <select
                  id="source-select"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-3 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-10"
                >
                  {INDUSTRIAL_SOURCES.map((src) => (
                    <option key={src} value={src} className="bg-slate-950 text-slate-200">
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
                relative bg-slate-950/20 border-2 border-dashed rounded-xl p-8
                flex flex-col items-center justify-center cursor-pointer
                transition-all duration-300 min-h-[300px] group hud-panel
                ${
                  isDragOver
                    ? "border-emerald-500 bg-emerald-950/10 scale-[1.01] shadow-2xl shadow-emerald-500/5"
                    : "border-slate-800 hover:border-slate-700 hover:bg-slate-950/30"
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
                <div className="relative w-full animate-fade-in z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview gambar yang akan dianalisis"
                    className="w-full h-auto max-h-[260px] object-contain rounded-lg border border-slate-800"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="absolute top-2 right-2 bg-slate-950/80 hover:bg-rose-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors backdrop-blur-sm border border-slate-800"
                    aria-label="Hapus gambar"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="z-10 flex flex-col items-center text-center">
                  <div className="w-14 h-14 bg-slate-950 border border-slate-900 rounded-2xl flex items-center justify-center mb-4 group-hover:border-slate-850 transition-colors shadow-inner">
                    <UploadIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-200 font-bold text-sm mb-1 tracking-wide">
                    Tarik &amp; Lepaskan Citra di Sini
                  </p>
                  <p className="text-slate-500 text-xs tracking-wide">
                    atau klik untuk memuat berkas lokal
                  </p>
                  <div className="flex items-center gap-1.5 mt-5">
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded uppercase">
                      JPG
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded uppercase">
                      PNG
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded uppercase">
                      WEBP
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium ml-1">
                      · Max 10 MB
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              id="btn-analyze"
              className={`
                w-full px-6 py-4 rounded-xl font-bold tracking-widest text-xs uppercase
                transition-all duration-300 flex items-center justify-center gap-3 relative
                ${
                  !file || loading
                    ? "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-[0.98] border border-emerald-500/20"
                }
              `}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-emerald-400"
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
                  <span>Mengeksekusi Analisis K3...</span>
                </>
              ) : (
                <>
                  <FlaskIcon className="w-4 h-4" />
                  <span>Jalankan Analisis YOLOv8</span>
                </>
              )}
            </button>

            {/* Console Log Terminal */}
            {consoleLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest text-slate-400">
                  Konsol Aliran Data Sistem
                </p>
                <div className="crt-screen rounded-xl p-4 font-mono text-[10px] h-[130px] flex flex-col justify-end text-emerald-400 border border-slate-900 shadow-2xl relative overflow-hidden">
                  <div className="space-y-1 z-10 relative select-none">
                    {consoleLogs.map((log, index) => (
                      <p key={index} className="truncate">
                        <span className="text-emerald-600 font-bold mr-1">&gt;</span> {log}
                      </p>
                    ))}
                    {loading && (
                      <p className="animate-pulse flex items-center gap-1">
                        <span className="text-emerald-600 font-bold">&gt;</span>
                        <span>[PROC] Sedang memproses...</span>
                        <span className="inline-block w-1.5 h-3 bg-emerald-400" />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error alert */}
            {error && (
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                <WarningIcon className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                    Galat Koneksi
                  </p>
                  <p className="text-xs text-rose-350 mt-1 text-rose-400">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* ═══════ RIGHT COLUMN — Results (7 Cols) ═══════ */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step badge */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                02
              </div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">
                Hasil Pemantauan APD
              </h3>
            </div>

            {result ? (
              <div className="space-y-5 animate-slide-up">
                
                {/* ── Aerial View Mode Banner ── */}
                {(result.source || selectedSource).toLowerCase().includes("drone") && (
                  <div className="bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 text-cyan-400 rounded-xl p-3 flex items-center gap-3 border border-cyan-500/20 shadow-lg shadow-cyan-500/5 relative overflow-hidden">
                    {/* Blinking scanner dot */}
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        AERIAL TELEMETRY STATUS: ACTIVE
                      </p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">
                        Drone Patrol Mode diaktifkan. Algoritma top-down presisi tinggi aktif.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Manpower Readiness Score Gauge ── */}
                {(() => {
                  const score = result.readiness_score;
                  let strokeClass = "stroke-emerald-500";
                  let bgStrokeClass = "stroke-slate-900";
                  let bgBadgeClass = "bg-emerald-950/50 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]";
                  let statusText = "Ready to Work";
                  let statusDesc = "Seluruh personel mematuhi prosedur K3. Area kerja dinilai aman untuk operasional.";

                  if (score < 50) {
                    strokeClass = "stroke-rose-500";
                    bgStrokeClass = "stroke-slate-900";
                    bgBadgeClass = "bg-rose-950/50 text-rose-450 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)] text-rose-450";
                    statusText = "Hazard Warning";
                    statusDesc = "Pelanggaran keselamatan kritis terdeteksi! Tindakan disiplin segera diperlukan.";
                  } else if (score <= 80) {
                    strokeClass = "stroke-amber-500";
                    bgStrokeClass = "stroke-slate-900";
                    bgBadgeClass = "bg-amber-950/50 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]";
                    statusText = "Caution Required";
                    statusDesc = "Terdapat personel yang belum menggunakan APD lengkap di zona pemantauan.";
                  }

                  const radius = 30;
                  const circumference = 2 * Math.PI * radius;
                  const strokeDashoffset = circumference - (score / 100) * circumference;

                  return (
                    <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-5 shadow-2xl flex items-center gap-5 hud-panel">
                      {/* Circle Progress */}
                      <div className="relative flex-shrink-0 w-20 h-20">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={bgStrokeClass}
                            strokeWidth="5"
                            fill="transparent"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r={radius}
                            className={`${strokeClass} transition-all duration-1000 ease-out`}
                            strokeWidth="5"
                            fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-base font-black text-white leading-none">{score}%</span>
                          <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Safety</span>
                        </div>
                      </div>

                      {/* Detail Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h4 className="text-white font-extrabold text-xs uppercase tracking-wider">Indeks Kesiapan Kerja</h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${bgBadgeClass}`}>
                            {statusText}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed font-medium">{statusDesc}</p>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Summary Badge ── */}
                {result.summary.total_persons === 0 ? (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-amber-950/20 border border-amber-500/20 shadow-md">
                    <div className="w-11 h-11 bg-amber-950/60 rounded-xl flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                      <SearchIcon className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-amber-400 uppercase tracking-wider">
                        Personel Tidak Ditemukan
                      </p>
                      <p className="text-xs text-slate-450 mt-0.5 text-slate-400">
                        Sistem tidak mendeteksi adanya objek pekerja. Gunakan foto dengan jarak pandang yang sesuai.
                      </p>
                    </div>
                  </div>
                ) : result.summary.is_all_safe ? (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-emerald-950/20 border border-emerald-500/20 shadow-md">
                    <div className="w-11 h-11 bg-emerald-950/60 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                      <CheckCircleIcon className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-emerald-400 uppercase tracking-wider">
                        Status Kepatuhan: Optimal
                      </p>
                      <p className="text-xs text-slate-450 mt-0.5 text-slate-400">
                        Terdeteksi {result.summary.total_persons} pekerja — 100% mematuhi standar keselamatan K3.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-rose-950/20 border border-rose-500/20 shadow-md">
                    <div className="w-11 h-11 bg-rose-950/60 rounded-xl flex items-center justify-center flex-shrink-0 border border-rose-500/30">
                      <WarningIcon className="w-6 h-6 text-rose-450 text-rose-450" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-rose-450 uppercase tracking-wider text-rose-400">
                        Peringatan Pelanggaran APD
                      </p>
                      <p className="text-xs text-slate-450 mt-0.5 text-slate-400">
                        {result.summary.violation_count} dari {result.summary.total_persons} pekerja mengabaikan kepatuhan APD wajib.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Annotated Image with QA Visual Highlight ── */}
                <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-4 shadow-2xl relative hud-panel">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Umpan Analitik Anotasi APD
                    </p>
                    <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                        Aman
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 animate-pulse shadow-[0_0_5px_rgba(244,63,94,0.5)]" />
                        Pelanggaran
                      </span>
                    </div>
                  </div>

                  {/* Image wrapper */}
                  <div className="relative overflow-hidden rounded-lg bg-slate-950 border border-slate-900 shadow-inner">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${result.annotated_image}`}
                      alt="Hasil deteksi keselamatan kerja"
                      className="w-full h-auto block z-0"
                      onLoad={(e) => {
                        const { naturalWidth, naturalHeight } = e.currentTarget;
                        setImageSize({ width: naturalWidth, height: naturalHeight });
                      }}
                      id="result-image"
                    />

                    {/* Scanline beam overlay */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                      <div className="w-full h-full animate-scanline" />
                    </div>

                    {/* SVG Mask Spotlight */}
                    {imageSize.width > 0 && imageSize.height > 0 && (
                      <>
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none z-10"
                          viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <defs>
                            <mask id="qa-highlight-mask">
                              <rect width="100%" height="100%" fill="white" />
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
                          <rect
                            width="100%"
                            height="100%"
                            fill="#020617"
                            opacity="0.75"
                            mask="url(#qa-highlight-mask)"
                          />
                        </svg>

                        {/* Neon HTML target boxes for violations */}
                        {result.detections.map((det, idx) => {
                          if (det.is_safe) return null;

                          const [x1, y1, x2, y2] = det.bbox;
                          const left = (x1 / imageSize.width) * 100;
                          const top = (y1 / imageSize.height) * 100;
                          const width = ((x2 - x1) / imageSize.width) * 100;
                          const height = ((y2 - y1) / imageSize.height) * 100;

                          return (
                            <div
                              key={idx}
                              className="absolute border-2 border-rose-500 animate-pulse pointer-events-none shadow-[0_0_12px_rgba(244,63,94,0.8)] rounded z-30"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              {/* Glowing Tag brackets top */}
                              <div className="absolute bottom-full left-0 mb-1 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-wider whitespace-nowrap">
                                ⚠ NO_PPE_DETECTION
                              </div>

                              {/* Glowing Tag details bottom */}
                              <div className="absolute top-full left-0 mt-1 bg-slate-950/95 border border-rose-500/40 text-rose-400 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap max-w-[140px] truncate uppercase tracking-wide">
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-4 text-center">
                      <p className="text-xl font-black text-white">
                        {result.summary.total_persons}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                        Total Pekerja
                      </p>
                    </div>
                    <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-4 text-center">
                      <p className="text-xl font-black text-emerald-400">
                        {result.summary.safe_count}
                      </p>
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">
                        Kondisi Aman
                      </p>
                    </div>
                    <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-4 text-center">
                      <p className="text-xl font-black text-rose-450 text-rose-400">
                        {result.summary.violation_count}
                      </p>
                      <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">
                        Pelanggaran
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Detection Details per Worker ── */}
                {result.detections.length > 0 && (
                  <div className="bg-slate-950/40 backdrop-blur-xl border border-slate-900 rounded-xl p-5 shadow-2xl relative hud-panel">
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2.5">
                      <ListIcon className="w-4 h-4 text-slate-400" />
                      Detail Kepatuhan APD Personel
                    </h4>
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                      {result.detections.map((det, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-4 border transition-colors ${
                            det.is_safe
                              ? "border-emerald-500/10 bg-emerald-950/5 hover:bg-emerald-950/10"
                              : "border-rose-500/10 bg-rose-950/5 hover:bg-rose-950/10"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 border-b border-slate-900 pb-2">
                            <span className="font-bold text-xs text-white">
                              PEKERJA #{idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${
                                det.is_safe
                                  ? "bg-emerald-950/30 text-emerald-450 border-emerald-500/20 text-emerald-400"
                                  : "bg-rose-950/30 text-rose-450 border-rose-500/20 text-rose-400"
                              }`}
                            >
                              {det.is_safe ? "✓ K3 SAFE" : "⚠ PPE_VIOLATION"}
                            </span>
                          </div>

                          {/* Equipment status dials */}
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-300">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  det.equipment.helmet
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                                    : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                                }`}
                              />
                              <span>
                                Helm K3:{" "}
                                <span className="font-bold text-white">
                                  {det.equipment.helmet ? "Terpasang" : "Absen"}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  det.equipment.vest
                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                                    : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                                }`}
                              />
                              <span>
                                Rompi K3:{" "}
                                <span className="font-bold text-white">
                                  {det.equipment.vest ? "Terpasang" : "Absen"}
                                </span>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold ml-auto self-center font-mono">
                              CONFIDENCE: {(det.confidence * 100).toFixed(0)}%
                            </div>
                          </div>

                          {/* List of missing items */}
                          {det.violations.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {det.violations.map((v, vi) => (
                                <span
                                  key={vi}
                                  className="bg-rose-950/40 text-rose-450 border border-rose-500/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-rose-400"
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
              <div className="bg-slate-950/20 border-2 border-dashed border-slate-900 rounded-xl p-12 flex flex-col items-center justify-center min-h-[350px] text-center relative hud-panel">
                <div className="w-14 h-14 bg-slate-950 border border-slate-900 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                  <SearchIcon className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-350 font-bold text-sm tracking-wide text-slate-350">
                  Umpan Data Belum Diproses
                </p>
                <p className="text-slate-500 text-xs mt-1.5 max-w-[280px] leading-relaxed">
                  Unggah berkas foto inspeksi K3 lokal, lalu tekan tombol &quot;Jalankan Analisis YOLOv8&quot; untuk memulai pemrosesan AI.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Footer ═══════ */}
        <footer className="mt-16 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-slate-950 border border-slate-800 rounded flex items-center justify-center shadow overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/logo.png"
                alt="ArkGuard AI Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-widest text-slate-400">
              ArkGuard AI Sentinel Project
            </span>
          </div>
          <span className="text-[9px] text-slate-500 font-mono">
            COMMAND_GATEWAY_INTEGRATION_V2 · NEXT_STANDALONE_BUILD · © {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </main>
  );
}
