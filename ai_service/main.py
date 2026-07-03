"""
ArkGuard AI Detection Service
FastAPI + YOLOv8 inference for factory worker safety (K3) analysis.

MVP Note:
  YOLOv8n is pre-trained on COCO (80 classes). It detects "person" objects
  but does NOT natively detect helmets or safety vests. For this MVP demo,
  safety equipment checks are simulated on each detected person.
  Production usage requires fine-tuning on a PPE dataset.
"""

import io
import base64
import hashlib
import struct
from typing import List

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

# ──────────────────────────────────────────────
# App Initialization
# ──────────────────────────────────────────────

app = FastAPI(
    title="ArkGuard AI Detection Service",
    description="Safety violation detection for factory workers",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model at startup (cached from Docker build)
model = YOLO("yolov8n.pt")

# COCO class index for "person"
PERSON_CLASS_ID = 0

# ──────────────────────────────────────────────
# Deterministic Safety Simulation
# ──────────────────────────────────────────────

def simulate_safety_check(bbox: List[int], image_hash: str) -> dict:
    """
    Simulate safety equipment detection for MVP demo.
    Uses a hash of bbox coordinates + image hash for deterministic
    results (same image + same bbox = same result every time).
    """
    seed_data = f"{image_hash}-{bbox[0]}-{bbox[1]}-{bbox[2]}-{bbox[3]}"
    seed_hash = hashlib.md5(seed_data.encode()).digest()
    val1, val2 = struct.unpack("BB", seed_hash[:2])

    has_helmet = val1 % 3 != 0   # ~66% chance of having helmet
    has_vest = val2 % 3 != 0     # ~66% chance of having vest

    violations = []
    if not has_helmet:
        violations.append("Tidak Memakai Helm Keselamatan")
    if not has_vest:
        violations.append("Tidak Memakai Rompi Keselamatan")

    return {
        "helmet": has_helmet,
        "vest": has_vest,
        "violations": violations,
        "is_safe": len(violations) == 0,
    }


# ──────────────────────────────────────────────
# Annotation Drawing
# ──────────────────────────────────────────────

def draw_annotations(image: np.ndarray, detections: list) -> np.ndarray:
    """Draw bounding boxes and labels on the image."""
    annotated = image.copy()

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        is_safe = det["is_safe"]

        # Colors: green for safe, red for violation
        color = (72, 199, 142) if is_safe else (67, 56, 202)  # BGR: emerald / red
        bg_color = (72, 199, 142) if is_safe else (67, 56, 202)

        # Draw bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)

        # Build label text
        if is_safe:
            label = "SAFE - K3 OK"
        else:
            violations_short = []
            if not det["equipment"]["helmet"]:
                violations_short.append("NO HELMET")
            if not det["equipment"]["vest"]:
                violations_short.append("NO VEST")
            label = " | ".join(violations_short)

        # Draw label background
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.65
        thickness = 2
        (text_w, text_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)

        label_y1 = max(y1 - text_h - 16, 0)
        label_y2 = y1
        cv2.rectangle(annotated, (x1, label_y1), (x1 + text_w + 12, label_y2), bg_color, -1)
        cv2.putText(
            annotated, label,
            (x1 + 6, label_y2 - 6),
            font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA
        )

        # Confidence badge
        conf_label = f"{det['confidence']:.0%}"
        (cw, ch), _ = cv2.getTextSize(conf_label, font, 0.5, 1)
        cv2.rectangle(annotated, (x2 - cw - 10, y1), (x2, y1 + ch + 10), color, -1)
        cv2.putText(
            annotated, conf_label,
            (x2 - cw - 5, y1 + ch + 5),
            font, 0.5, (255, 255, 255), 1, cv2.LINE_AA
        )

    return annotated


# ──────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy", "model": "yolov8n", "service": "arkguard-ai"}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    """
    Receive an image, run YOLOv8 person detection, simulate safety
    equipment checks, annotate the image, and return results.
    """
    # Validate content type
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File harus berupa gambar.")

    try:
        # Read and decode image
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Gagal membaca file gambar.")

        # Create a hash of the image for deterministic simulation
        image_hash = hashlib.md5(contents).hexdigest()

        # Run YOLOv8 inference
        results = model(img, conf=0.40, verbose=False)

        # Process detections
        detections = []

        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])

                # Only process "person" detections
                if cls_id != PERSON_CLASS_ID:
                    continue

                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

                # Simulate safety equipment check
                safety = simulate_safety_check([x1, y1, x2, y2], image_hash)

                detections.append({
                    "label": "person",
                    "confidence": round(conf, 3),
                    "bbox": [x1, y1, x2, y2],
                    "is_safe": safety["is_safe"],
                    "violations": safety["violations"],
                    "equipment": {
                        "helmet": safety["helmet"],
                        "vest": safety["vest"],
                    },
                })

        # Draw annotations on image
        annotated = draw_annotations(img, detections)

        # Encode annotated image to base64 JPEG
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, 92]
        _, buffer = cv2.imencode(".jpg", annotated, encode_params)
        img_base64 = base64.b64encode(buffer).decode("utf-8")

        # Build summary
        total_persons = len(detections)
        violation_count = sum(1 for d in detections if not d["is_safe"])

        return JSONResponse({
            "success": True,
            "annotated_image": img_base64,
            "detections": detections,
            "summary": {
                "total_persons": total_persons,
                "safe_count": total_persons - violation_count,
                "violation_count": violation_count,
                "is_all_safe": violation_count == 0,
            },
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kesalahan internal: {str(e)}")
