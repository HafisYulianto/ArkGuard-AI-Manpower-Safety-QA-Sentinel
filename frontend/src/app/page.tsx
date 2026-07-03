"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent, useEffect } from "react";

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

const MOCK_CATALOG = [
  {
    id: "safe",
    title: "Kepatuhan K3 Optimal",
    desc: "Seluruh personel mematuhi prosedur helm & rompi.",
    filename: "sample_safe.png",
    source: "CCTV-01: Main Gate Checkpoint",
    badge: "100% Safe",
    badgeColor: "border-emerald-200 text-emerald-600 bg-emerald-50"
  },
  {
    id: "no_helmet",
    title: "Pelanggaran Helm",
    desc: "Personel terdeteksi tidak mengenakan helm pengaman.",
    filename: "sample_no_helmet.png",
    source: "CCTV-02: Assembly Line A Checkpoint",
    badge: "No Helmet",
    badgeColor: "border-rose-200 text-rose-600 bg-rose-50"
  },
  {
    id: "no_vest",
    title: "Pelanggaran Rompi",
    desc: "Pekerja di loading dock tanpa rompi visibilitas tinggi.",
    filename: "sample_no_vest.png",
    source: "CCTV-03: Loading Dock B Sector",
    badge: "No Vest",
    badgeColor: "border-rose-200 text-rose-600 bg-rose-50"
  },
  {
    id: "aerial",
    title: "Inspeksi Udara Rig",
    desc: "Deteksi sudut tinggi top-down lepas pantai menggunakan drone.",
    filename: "sample_aerial.png",
    source: "DRONE-02: Offshore Rig Deck B",
    badge: "Drone Feed",
    badgeColor: "border-cyan-200 text-cyan-600 bg-cyan-50"
  }
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
   Fluid Animation Components
   ────────────────────────────────────────────── */

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) {
      setDisplayValue(0);
      return;
    }
    const incrementTime = Math.max(Math.floor(duration / end), 15);
    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= end) {
        clearInterval(timer);
        setDisplayValue(end);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

function AnimatedGauge({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = score;
    if (end === 0) {
      setDisplayScore(0);
      return;
    }
    const stepTime = Math.max(10, Math.floor(1000 / end));
    const timer = setInterval(() => {
      start += 1;
      setDisplayScore(start);
      if (start >= end) {
        clearInterval(timer);
        setDisplayScore(end);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  let strokeClass = "stroke-emerald-500";
  let bgBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-250 border-emerald-200";
  let statusText = "Ready to Work";
  let statusDesc = "Seluruh personel mematuhi prosedur K3. Area kerja dinilai aman untuk operasional.";

  if (displayScore < 50) {
    strokeClass = "stroke-rose-500";
    bgBadgeClass = "bg-rose-50 text-rose-700 border-rose-250 border-rose-200";
    statusText = "Hazard Warning";
    statusDesc = "Pelanggaran keselamatan kritis terdeteksi! Tindakan disiplin segera diperlukan.";
  } else if (displayScore <= 80) {
    strokeClass = "stroke-amber-500";
    bgBadgeClass = "bg-amber-50 text-amber-700 border-amber-250 border-amber-200";
    statusText = "Caution Required";
    statusDesc = "Terdapat personel yang belum menggunakan APD lengkap di zona pemantauan.";
  }

  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-5 hud-panel transform transition-all duration-500 hover:scale-[1.01] hover:border-slate-200">
      {/* Circle Progress */}
      <div className="relative flex-shrink-0 w-20 h-20">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="5"
            fill="transparent"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={`${strokeClass} transition-all duration-100 ease-out`}
            strokeWidth="5"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black text-slate-800 leading-none">{displayScore}%</span>
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">Safety</span>
        </div>
      </div>

      {/* Detail Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h4 className="text-slate-800 font-extrabold text-xs uppercase tracking-wider">Indeks Kesiapan Kerja</h4>
          <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest transition-all duration-500 ${bgBadgeClass}`}>
            {statusText}
          </span>
        </div>
        <p className="text-slate-500 text-xs mt-1.5 leading-relaxed font-medium transition-all duration-550">{statusDesc}</p>
      </div>
    </div>
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

  /* ── Load Mock Sample image from Catalog ───── */

  const handleLoadExample = async (name: string, filename: string, source: string) => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setSelectedSource(source);
      
      const initialLog = `[INFO] Mengunduh citra contoh dari katalog: ${name}...`;
      setConsoleLogs([initialLog]);
      setLoadingMessage(initialLog);

      const response = await fetch(`/img/samples/${filename}`);
      if (!response.ok) throw new Error("Gagal mengambil file sampel");
      
      const blob = await response.blob();
      const sampleFile = new File([blob], filename, { type: "image/png" });

      setFile(sampleFile);
      setPreview(URL.createObjectURL(sampleFile));
      
      setConsoleLogs(prev => [...prev, `[SUCCESS] Citra ${filename} berhasil dimuat. Ready.`]);
    } catch (err) {
      setError("Gagal memuat gambar katalog sampel.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Submit to API ─────────────────────────── */

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    
    // Initialize Console logs (Orange developer style logs)
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
    <main className="min-h-screen bg-[#f8fafc] bg-cyber-grid text-slate-800 relative overflow-hidden font-sans pb-12">
      {/* ── Soft Warm Amber Background Glows ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-orange-500/[0.02] rounded-full blur-[120px] pointer-events-none transition-all duration-1000" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-amber-500/[0.02] rounded-full blur-[120px] pointer-events-none transition-all duration-1000" />

      {/* ═══════ Navbar (Clean Light) ═══════ */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm transition-transform duration-500 hover:rotate-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/logo2.png"
                alt="ArkGuard AI Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-wider uppercase leading-none">
                ArkGuard AI
              </h1>
              <p className="text-[10px] text-orange-600 font-semibold uppercase tracking-widest mt-1">
                Manpower Safety Sentinel
              </p>
            </div>
          </div>

          {/* System status */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 shadow-sm text-slate-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
            <span className="text-[10px] text-slate-550 text-slate-500 font-bold uppercase tracking-wider">
              Control Unit Active
            </span>
          </div>
        </div>
      </header>

      {/* ═══════ Content ═══════ */}
      <div className="max-w-7xl mx-auto p-6 relative z-10">
        
        {/* Page heading */}
        <div className="mb-8 border-b border-slate-100 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="animate-fade-in">
            <h2 className="text-xl font-extrabold text-slate-900 uppercase tracking-wider">
              Terminal Pengawasan K3
            </h2>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">
              Sistem Analisis Keselamatan Kerja &amp; Kepatuhan APD Menggunakan YOLOv8
            </p>
          </div>
          <div className="text-left md:text-right animate-fade-in" style={{ animationDelay: "100ms" }}>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">Node: AG_SENTINEL_WIN_32</span>
          </div>
        </div>

        {/* ═══════ MOCK SAMPLES CATALOG (Clean Cards) ═══════ */}
        <section className="mb-10 animate-fade-in" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-sm">
              ★
            </div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
              Katalog Gambar Contoh (Uji Coba Cepat AI)
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MOCK_CATALOG.map((sample) => (
              <div
                key={sample.id}
                onClick={() => handleLoadExample(sample.title, sample.filename, sample.source)}
                className="bg-white border border-slate-100 hover:border-orange-500/40 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md group flex flex-col justify-between h-[155px] relative overflow-hidden"
              >
                <div className="z-10">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${sample.badgeColor}`}>
                      {sample.badge}
                    </span>
                    <span className="text-[8px] font-mono text-slate-400 uppercase">
                      {sample.filename.split(".")[0]}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 group-hover:text-orange-600 transition-colors leading-tight">
                    {sample.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                    {sample.desc}
                  </p>
                </div>
                <div className="text-[8px] font-bold text-orange-600 group-hover:text-orange-550 uppercase tracking-widest mt-3 flex items-center gap-1 z-10">
                  <span>Muat Gambar</span>
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </div>
                
                {/* Accent lines inside card */}
                <div className="absolute right-0 bottom-0 w-8 h-8 opacity-[0.02] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                  <svg viewBox="0 0 100 100" className="w-full h-full fill-orange-500">
                    <polygon points="0,100 100,0 100,100" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════ MAIN LAYOUT GRID ═══════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* ═══════ LEFT COLUMN — Upload & Config ═══════ */}
          <div className="lg:col-span-5 space-y-6 animate-fade-in" style={{ animationDelay: "150ms" }}>
            
            {/* Step badge */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-sm">
                01
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                Konfigurasi Input &amp; Feed
              </h3>
            </div>

            {/* Mock Source Selector */}
            <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm relative hud-panel hover:-translate-y-0.5 hover:border-slate-200 transition-all duration-300">
              <label htmlFor="source-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Pilih Kamera Pengawasan (Video Source)
              </label>
              <div className="relative">
                <select
                  id="source-select"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all appearance-none cursor-pointer pr-10"
                >
                  {INDUSTRIAL_SOURCES.map((src) => (
                    <option key={src} value={src} className="bg-white text-slate-700">
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
                relative bg-white border-2 border-dashed rounded-xl p-8
                flex flex-col items-center justify-center cursor-pointer
                transition-all duration-500 min-h-[300px] group hud-panel hover:-translate-y-0.5 shadow-sm
                ${
                  isDragOver
                    ? "border-orange-500 bg-orange-50 scale-[1.01] shadow-md"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
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
                <div className="relative w-full animate-fade-in z-10 transition-transform duration-500 hover:scale-[1.005]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview gambar yang akan dianalisis"
                    className="w-full h-auto max-h-[260px] object-contain rounded-lg border border-slate-100 shadow-sm"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    className="absolute top-2 right-2 bg-slate-900/90 hover:bg-rose-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md transition-all duration-300 backdrop-blur-sm hover:scale-105 active:scale-95"
                    aria-label="Hapus gambar"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="z-10 flex flex-col items-center text-center transition-all duration-500 group-hover:scale-105">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:border-orange-300 transition-all duration-500 shadow-inner">
                    <UploadIcon className="w-6 h-6 text-slate-400 group-hover:text-orange-500 transition-colors" />
                  </div>
                  <p className="text-slate-700 font-bold text-sm mb-1 tracking-wide">
                    Tarik &amp; Lepaskan Citra di Sini
                  </p>
                  <p className="text-slate-400 text-xs tracking-wide">
                    atau klik untuk memuat berkas lokal
                  </p>
                  <div className="flex items-center gap-1.5 mt-5">
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase">
                      JPG
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase">
                      PNG
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded uppercase">
                      WEBP
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium ml-1">
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
                w-full px-6 py-4 rounded-xl font-bold tracking-widest text-xs uppercase glow-sweep
                transition-all duration-300 flex items-center justify-center gap-3 relative shadow-sm
                ${
                  !file || loading
                    ? "bg-slate-200 border border-slate-250 text-slate-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-sm hover:shadow active:scale-[0.98]"
                }
              `}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
              <div className="space-y-2 animate-slide-up">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Konsol Aliran Data Sistem
                </p>
                <div className="crt-screen rounded-xl p-4 font-mono text-[10px] h-[130px] flex flex-col justify-end text-slate-300 border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="space-y-1 z-10 relative select-none">
                    {consoleLogs.map((log, index) => (
                      <p key={index} className="truncate animate-fade-in">
                        <span className="text-orange-500 font-bold mr-1">&gt;</span> {log}
                      </p>
                    ))}
                    {loading && (
                      <p className="animate-pulse flex items-center gap-1">
                        <span className="text-orange-505 text-orange-500 font-bold">&gt;</span>
                        <span>[PROC] Sedang memproses...</span>
                        <span className="inline-block w-1.5 h-3 bg-orange-400" />
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error alert */}
            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
                <WarningIcon className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                    Galat Koneksi
                  </p>
                  <p className="text-xs text-rose-600 mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* ═══════ RIGHT COLUMN — Results ═══════ */}
          <div className="lg:col-span-7 space-y-6 animate-fade-in" style={{ animationDelay: "200ms" }}>
            
            {/* Step badge */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg flex items-center justify-center text-sm font-extrabold shadow-sm">
                02
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest">
                Hasil Pemantauan APD
              </h3>
            </div>

            {result ? (
              <div className="space-y-5">
                
                {/* ── Aerial View Mode Banner ── */}
                {(result.source || selectedSource).toLowerCase().includes("drone") && (
                  <div className="bg-gradient-to-r from-cyan-50 to-indigo-50 text-cyan-700 rounded-xl p-3 flex items-center gap-3 border border-cyan-150 border-cyan-100 shadow-sm relative overflow-hidden animate-slide-up">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-455 bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-800">
                        AERIAL TELEMETRY STATUS: ACTIVE
                      </p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">
                        Drone Patrol Mode diaktifkan. Algoritma top-down presisi tinggi aktif.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Manpower Readiness Score Gauge ── */}
                <AnimatedGauge score={result.readiness_score} />

                {/* ── Summary Badge ── */}
                {result.summary.total_persons === 0 ? (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-amber-50 border border-amber-200 shadow-sm animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <div className="w-11 h-11 bg-amber-100 border border-amber-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SearchIcon className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-amber-800 uppercase tracking-wider">
                        Personel Tidak Ditemukan
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Sistem tidak mendeteksi adanya objek pekerja. Gunakan foto dengan jarak pandang yang sesuai.
                      </p>
                    </div>
                  </div>
                ) : result.summary.is_all_safe ? (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-emerald-50 border border-emerald-200 shadow-sm animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <div className="w-11 h-11 bg-emerald-100 border border-emerald-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircleIcon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-emerald-800 uppercase tracking-wider">
                        Status Kepatuhan: Optimal
                      </p>
                      <p className="text-xs text-slate-550 text-slate-500 mt-0.5">
                        Terdeteksi <AnimatedNumber value={result.summary.total_persons} /> pekerja — 100% mematuhi standar keselamatan K3.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 flex items-center gap-4 bg-rose-50 border border-rose-200 shadow-sm animate-slide-up" style={{ animationDelay: "100ms" }}>
                    <div className="w-11 h-11 bg-rose-100 border border-rose-200 rounded-xl flex items-center justify-center flex-shrink-0">
                      <WarningIcon className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-rose-800 uppercase tracking-wider">
                        Peringatan Pelanggaran APD
                      </p>
                      <p className="text-xs text-slate-550 text-slate-500 mt-0.5">
                        <AnimatedNumber value={result.summary.violation_count} /> dari <AnimatedNumber value={result.summary.total_persons} /> pekerja mengabaikan kepatuhan APD wajib.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Annotated Image with QA Visual Highlight ── */}
                <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm relative hud-panel animate-slide-up" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Umpan Analitik Anotasi APD
                    </p>
                    <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-sm" />
                        Aman
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 animate-pulse shadow-sm" />
                        Pelanggaran
                      </span>
                    </div>
                  </div>

                  {/* Image wrapper */}
                  <div className="relative overflow-hidden rounded-lg bg-slate-900 border border-slate-100 shadow-inner">
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
                            fill="#090d16"
                            opacity="0.55"
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
                              className="absolute border-2 border-rose-500 animate-pulse pointer-events-none shadow-[0_0_10px_rgba(244,63,94,0.6)] rounded z-30 transition-all duration-500"
                              style={{
                                left: `${left}%`,
                                top: `${top}%`,
                                width: `${width}%`,
                                height: `${height}%`,
                              }}
                            >
                              {/* Glowing Tag brackets top */}
                              <div className="absolute bottom-full left-0 mb-1 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-md uppercase tracking-wider whitespace-nowrap">
                                ⚠ NO_PPE_DETECTION
                              </div>

                              {/* Glowing Tag details bottom */}
                              <div className="absolute top-full left-0 mt-1 bg-slate-900 border border-rose-500/30 text-rose-455 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md whitespace-nowrap max-w-[140px] truncate uppercase tracking-wide text-rose-400">
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
                  <div className="grid grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-slate-200 shadow-sm transition-all duration-300">
                      <p className="text-xl font-black text-slate-800">
                        <AnimatedNumber value={result.summary.total_persons} />
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        Total Pekerja
                      </p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-slate-200 shadow-sm transition-all duration-300">
                      <p className="text-xl font-black text-emerald-600">
                        <AnimatedNumber value={result.summary.safe_count} />
                      </p>
                      <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1">
                        Kondisi Aman
                      </p>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-xl p-4 text-center hover:border-slate-200 shadow-sm transition-all duration-300">
                      <p className="text-xl font-black text-rose-600">
                        <AnimatedNumber value={result.summary.violation_count} />
                      </p>
                      <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest mt-1">
                        Pelanggaran
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Detection Details per Worker ── */}
                {result.detections.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm relative hud-panel animate-slide-up" style={{ animationDelay: "400ms" }}>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                      <ListIcon className="w-4 h-4 text-slate-500" />
                      Detail Kepatuhan APD Personel
                    </h4>
                    <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                      {result.detections.map((det, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-4 border transition-all duration-500 hover:translate-x-0.5 ${
                            det.is_safe
                              ? "border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/40"
                              : "border-rose-100 bg-rose-50/20 hover:bg-rose-50/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <span className="font-bold text-xs text-slate-800">
                              PEKERJA #{idx + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider transition-all duration-550 ${
                                det.is_safe
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-rose-50 border-rose-200 text-rose-700"
                              }`}
                            >
                              {det.is_safe ? "✓ K3 SAFE" : "⚠ PPE_VIOLATION"}
                            </span>
                          </div>

                          {/* Equipment status dials */}
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                  det.equipment.helmet
                                    ? "bg-emerald-500 shadow-sm"
                                    : "bg-rose-500 shadow-sm"
                                }`}
                              />
                              <span>
                                Helm K3:{" "}
                                <span className="font-bold text-slate-800">
                                  {det.equipment.helmet ? "Terpasang" : "Absen"}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                                  det.equipment.vest
                                    ? "bg-emerald-500 shadow-sm"
                                    : "bg-rose-500 shadow-sm"
                                }`}
                              />
                              <span>
                                Rompi K3:{" "}
                                <span className="font-bold text-slate-800">
                                  {det.equipment.vest ? "Terpasang" : "Absen"}
                                </span>
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-450 font-bold ml-auto self-center font-mono">
                              CONFIDENCE: {(det.confidence * 100).toFixed(0)}%
                            </div>
                          </div>

                          {/* List of missing items */}
                          {det.violations.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {det.violations.map((v, vi) => (
                                <span
                                  key={vi}
                                  className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded"
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
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center min-h-[350px] text-center relative hud-panel shadow-sm">
                <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-5">
                  <SearchIcon className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-700 font-bold text-sm tracking-wide">
                  Umpan Data Belum Diproses
                </p>
                <p className="text-slate-400 text-xs mt-1.5 max-w-[280px] leading-relaxed">
                  Pilih gambar contoh dari katalog di atas, atau unggah foto inspeksi K3 lokal Anda untuk memulai analisis YOLOv8.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ SYSTEM INFORMATION SECTION (Clean Light) ═══════ */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-200 pt-8 animate-fade-in" style={{ animationDelay: "220ms" }}>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 inline-block rounded-sm" />
              Sistem Pengawasan Keselamatan Kerja
            </h3>
            <p className="text-xs text-slate-505 text-slate-500 leading-relaxed">
              ArkGuard AI adalah platform visi komputer yang diintegrasikan ke jaringan CCTV &amp; Drone industri untuk memantau penggunaan Alat Pelindung Diri (APD) secara otomatis. Menggunakan model **YOLOv8** yang dioptimalkan, sistem ini mendeteksi keberadaan helm keselamatan (Safety Helmet) dan rompi visibilitas tinggi (High-Visibility Vest) demi meminimalisir risiko kecelakaan kerja di zona manufaktur, konstruksi, dan area berisiko tinggi lainnya.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 inline-block rounded-sm" />
              Parameter Evaluasi K3
            </h3>
            <ul className="space-y-2 text-xs text-slate-500">
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold font-mono">[1]</span>
                <span><strong>Helm Keselamatan K3:</strong> Mencegah cedera kepala akibat benturan atau benda jatuh. Absennya helm mengurangi skor kesiapan wilayah secara drastis.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold font-mono">[2]</span>
                <span><strong>Rompi Reflektif K3:</strong> Memastikan visibilitas pekerja di area alat berat atau malam hari. Wajib digunakan di seluruh zona pengawasan aktif.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-600 font-bold font-mono">[3]</span>
                <span><strong>Skor Kesiapan Manpower:</strong> Mengukur indeks kelayakan kerja (100% dikurangi 30% per pekerja yang melanggar APD). Status di bawah 50% memicu alarm bahaya.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* ═══════ Footer ═══════ */}
        <footer className="mt-16 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/logo2.png"
                alt="ArkGuard AI Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              ArkGuard AI Sentinel Project
            </span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono">
            COMMAND_GATEWAY_INTEGRATION_V2 · NEXT_STANDALONE_BUILD · © {new Date().getFullYear()}
          </span>
        </footer>
      </div>
    </main>
  );
}
