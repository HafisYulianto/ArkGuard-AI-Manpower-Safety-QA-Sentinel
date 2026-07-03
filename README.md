# 🛡️ ArkGuard AI — Manpower Safety & QA Sentinel

> Sistem deteksi pelanggaran keselamatan kerja (K3) berbasis AI untuk lingkungan manufaktur cerdas (*Smart Manufacturing*).

Aplikasi web single-page yang menerima foto pekerja pabrik, menganalisis kepatuhan K3 (helm, rompi keselamatan) menggunakan model YOLOv8, dan menampilkan hasil deteksi secara visual.

---

## 📐 Arsitektur

```
┌─────────────────────┐       ┌───────────────────────┐       ┌────────────────────────────┐
│                     │       │                       │       │                            │
│    Next.js 14       │──────▶│    Laravel 11         │──────▶│    FastAPI + YOLOv8         │
│    Frontend         │       │    API Gateway        │       │    AI Detection Service     │
│    :3000            │◀──────│    :8000              │◀──────│    :8001                   │
│                     │       │                       │       │                            │
└─────────────────────┘       └───────────────────────┘       └────────────────────────────┘
        ▲                                                              │
        │                     Docker Network: arkguard-network         │
        └──────────────────────────────────────────────────────────────┘
```

| Layer        | Teknologi                                      | Port  |
| ------------ | ---------------------------------------------- | ----- |
| Frontend     | Next.js 14 (App Router), React 18, Tailwind 3  | 3000  |
| Backend      | Laravel 11 (PHP 8.3), API Gateway              | 8000  |
| AI Service   | FastAPI, Python 3.11, YOLOv8 (Ultralytics)     | 8001  |
| Infra        | Docker, Docker Compose                         | —     |

---

## 📁 Struktur Direktori

```
ArkGuard AI Manpower Safety & QA Sentinel/
│
├── docker-compose.yml          # Orchestrasi 3 microservice
├── README.md                   # Dokumentasi ini
├── .gitignore
│
├── frontend/                   # Next.js 14 + Tailwind CSS
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── .env.local
│   ├── public/
│   └── src/
│       └── app/
│           ├── layout.tsx      # Root layout + Inter font
│           ├── page.tsx        # Single-page UI utama
│           └── globals.css     # Tailwind directives + custom styles
│
├── backend/                    # Laravel 11 API Gateway
│   ├── Dockerfile
│   ├── composer.json
│   ├── artisan
│   ├── .env
│   ├── bootstrap/
│   │   ├── app.php
│   │   └── providers.php
│   ├── config/
│   │   ├── app.php
│   │   └── cors.php
│   ├── routes/
│   │   └── api.php             # POST /api/detect
│   ├── public/
│   │   └── index.php
│   └── app/
│       ├── Http/Controllers/
│       │   ├── Controller.php
│       │   └── ArkGuardController.php  # Core gateway controller
│       └── Providers/
│           └── AppServiceProvider.php
│
└── ai_service/                 # FastAPI + YOLOv8
    ├── Dockerfile
    ├── requirements.txt
    └── main.py                 # /detect & /health endpoints
```

---

## ⚙️ Prerequisites

- **Docker Desktop** v4.0+ ([download](https://www.docker.com/products/docker-desktop/))
- **Docker Compose** v2.0+ (included with Docker Desktop)

> Pastikan Docker daemon berjalan sebelum melanjutkan.

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone <repository-url>
cd "ArkGuard AI Manpower Safety & QA Sentinel"
```

### 2. Build & Jalankan Semua Service

```bash
docker-compose up -d --build
```

> ⏱️ **Build pertama** membutuhkan waktu ±5-10 menit karena:
> - Download dependencies (npm, composer, pip)
> - Download model YOLOv8 nano (~6 MB)
> - Build Next.js production bundle
>
> Build selanjutnya jauh lebih cepat karena Docker layer caching.

### 3. Verifikasi Container Berjalan

```bash
docker-compose ps
```

Output yang diharapkan:
```
NAME                  STATUS    PORTS
frontend_service      Up        0.0.0.0:3000->3000/tcp
backend_service       Up        0.0.0.0:8000->8000/tcp
ai_service            Up        0.0.0.0:8001->8001/tcp
```

### 4. Akses Aplikasi

| Service         | URL                                  |
| --------------- | ------------------------------------ |
| **Frontend**    | http://localhost:3000                 |
| **Backend API** | http://localhost:8000/api/detect      |
| **AI Health**   | http://localhost:8001/health          |

---

## 📖 Cara Penggunaan

1. Buka **http://localhost:3000** di browser
2. **Seret & lepas** foto pekerja pabrik ke area upload, atau **klik** untuk memilih file
3. Klik tombol **"Mulai Analisis K3"**
4. Tunggu proses analisis (biasanya 2-5 detik)
5. Lihat hasil:
   - **Gambar beranotasi** dengan bounding box berwarna
   - **Badge status** hijau (aman) atau merah (pelanggaran)
   - **Detail per pekerja** termasuk status helm dan rompi
   - **Statistik ringkasan** total pekerja, aman, dan pelanggaran

---

## ⚠️ Catatan MVP

Model **YOLOv8n** yang digunakan adalah model pre-trained pada dataset **COCO** (80 kelas objek umum). Model ini mendeteksi objek "person" dengan akurat, namun **tidak secara native mendeteksi helm atau rompi keselamatan**.

Untuk MVP demo ini:
- Deteksi **"person"** menggunakan COCO classes ✅
- Pengecekan **helm & rompi** disimulasikan secara deterministik 🔄
- Bounding box digambar dengan warna hijau (aman) / merah (pelanggaran) ✅

**Untuk produksi**: Fine-tune YOLOv8 pada dataset PPE (Personal Protective Equipment) seperti [Safety Helmet Detection Dataset](https://universe.roboflow.com/search?q=safety+helmet).

---

## 🔧 Troubleshooting

### Container tidak bisa start
```bash
# Lihat log error per service
docker-compose logs frontend_service
docker-compose logs backend_service
docker-compose logs ai_service
```

### Port sudah digunakan
```bash
# Cek proses yang menggunakan port
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :8001
```
Atau ubah port mapping di `docker-compose.yml`.

### Rebuild dari awal
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### CORS error di browser
Pastikan `backend_service` berjalan dan `config/cors.php` mengizinkan origin frontend.

---

## 🛑 Menghentikan Aplikasi

```bash
docker-compose down
```

Untuk menghapus volumes dan images:
```bash
docker-compose down --rmi all --volumes
```

---

## 📝 Lisensi

MIT License · ArkGuard AI © 2026
