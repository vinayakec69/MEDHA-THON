"""
TwinMed — FastAPI Backend Server
================================
Runs on NVIDIA Jetson AGX Orin for edge AI medical processing.

Endpoints:
  GET  /                  → Serves the dashboard (index.html)
  POST /api/upload-scan   → Accepts CT scan images, returns AI analysis
  POST /api/generate-report → Generates a PDF surgical report
"""

import os, io, time, random, datetime
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.lib.styles import getSampleStyleSheet

app = FastAPI(title="TwinMed API", version="1.0")

# Static files will be mounted AFTER api routes (at bottom of file)

STATIC_DIR = Path(__file__).parent

# ---------- Serve Dashboard ----------
@app.get("/")
async def serve_dashboard():
    return FileResponse(STATIC_DIR / "index.html")


# ---------- Upload CT Scan Endpoint ----------
@app.post("/api/upload-scan")
async def upload_scan(files: list[UploadFile] = File(...)):
    """
    Accepts uploaded CT scan slices (images).
    Simulates AI segmentation and returns analysis results.
    In production, this would run a 3D U-Net model on the Jetson GPU.
    """
    start_time = time.time()
    
    file_count = len(files)
    total_size = 0
    
    # Read all uploaded files (simulate processing)
    for f in files:
        data = await f.read()
        total_size += len(data)
    
    # Simulate AI processing time (proportional to file count)
    processing_time = min(3.0, file_count * 0.02)
    time.sleep(processing_time)
    
    elapsed = round(time.time() - start_time, 2)
    
    # Generate realistic analysis results
    bone_density = round(random.uniform(0.85, 1.15), 3)
    cortical_thickness = round(random.uniform(1.8, 3.2), 1)
    erosion_score = random.choice([0, 0, 1, 1, 2])
    
    return JSONResponse({
        "status": "success",
        "message": f"Processed {file_count} DICOM slices in {elapsed}s",
        "analysis": {
            "slices_processed": file_count,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "processing_time_s": elapsed,
            "bone_density_score": bone_density,
            "cortical_thickness_mm": cortical_thickness,
            "erosion_grade": erosion_score,
            "erosion_label": ["None", "Mild", "Moderate", "Severe"][min(erosion_score, 3)],
            "mesh_vertices": random.randint(12000, 45000),
            "mesh_faces": random.randint(24000, 90000),
            "ai_confidence": round(random.uniform(0.92, 0.99), 3),
            "device": "NVIDIA Jetson AGX Orin (Edge)"
        }
    })


# ---------- Generate PDF Surgical Report ----------
@app.post("/api/generate-report")
async def generate_report(
    patient_id: str = Form("#PT-8892"),
    joint: str = Form("Right Shoulder"),
    implant: str = Form("Standard Humerus Head (48mm)"),
    angle: str = Form("132°"),
    risk: str = Form("12%"),
    stability: str = Form("High"),
    bone_density: str = Form("1.02"),
    slices: str = Form("0")
):
    """Generates a professional PDF surgical planning report."""
    
    buffer = io.BytesIO()
    c = pdf_canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    
    # ---- Constants & Colors ----
    primary_blue = HexColor("#1e3a8a") # Dark clinical blue
    text_dark = HexColor("#1e293b")
    text_light = HexColor("#64748b")
    line_color = HexColor("#e2e8f0")
    
    # ---- HEADER: Hospital / Department ----
    c.setFillColor(primary_blue)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, height - 50, "TWINMED CLINICAL IMAGING")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(text_light)
    c.drawString(40, height - 65, "Department of Orthopaedic Surgery & AI Analytics")
    c.drawString(40, height - 77, "3D Pre-Operative Planning & Biomechanical Analysis")
    
    # "Barcode" / Form ID
    c.setFont("Courier-Bold", 12)
    c.setFillColor(text_dark)
    c.drawRightString(width - 40, height - 50, f"||||| ||| ||| ||| |||||||")
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 40, height - 65, f"REPORT ID: {patient_id.replace('#', '')}-{now.strftime('%H%M')}")
    c.drawRightString(width - 40, height - 77, f"DATE: {date_str}  TIME: {time_str}")
    
    # Line separator
    c.setStrokeColor(primary_blue)
    c.setLineWidth(2)
    c.line(40, height - 90, width - 40, height - 90)
    
    # ---- PATIENT DEMOGRAPHICS ----
    y = height - 120
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(primary_blue)
    c.drawString(40, y, "1. PATIENT DEMOGRAPHICS")
    
    c.setFont("Helvetica", 10)
    c.setFillColor(text_dark)
    c.drawString(50, y - 20, f"Medical Record No (MRN):")
    c.drawString(220, y - 20, f"{patient_id}")
    
    c.drawString(50, y - 35, f"Target Joint / Anatomy:")
    c.drawString(220, y - 35, f"{joint} (3D Reconstruction)")
    
    c.drawString(50, y - 50, f"Study Type:")
    c.drawString(220, y - 50, f"High-Res CT -> Digital Twin Mesh")
    
    c.drawString(50, y - 65, f"DICOM Slices Processed:")
    c.drawString(220, y - 65, f"{slices} slices")
    
    # Line
    c.setStrokeColor(line_color)
    c.setLineWidth(1)
    c.line(40, y - 80, width - 40, y - 80)
    
    # ---- 3D BIOMECHANICAL FINDINGS ----
    y -= 110
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(primary_blue)
    c.drawString(40, y, "2. QUANTITATIVE BIOMECHANICAL FINDINGS")
    
    # Table Header
    c.setFillColor(HexColor("#f1f5f9"))
    c.rect(40, y - 25, width - 80, 20, fill=True, stroke=False)
    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(50, y - 18, "PARAMETER")
    c.drawString(220, y - 18, "MEASURED VALUE")
    c.drawString(380, y - 18, "CLINICAL REFERENCE")
    
    metrics = [
        ("Alignment Angle", angle, "125° - 140° (Normal)"),
        ("Impingement Risk", risk, "< 15% (Low Risk)"),
        ("Cortical Bone Density", f"{bone_density} g/cm³", "0.90 - 1.10 g/cm³ (Healthy)"),
        ("Predicted Stability", stability, "High / Optimal")
    ]
    
    c.setFont("Helvetica", 10)
    for i, (label, val, ref) in enumerate(metrics):
        row_y = y - 45 - (i * 20)
        c.drawString(50, row_y, label)
        
        # Highlight abnormal values (simulated)
        if "High Risk" in val or float(bone_density.split()[0] if isinstance(bone_density, str) else 1.0) < 0.8:
            c.setFillColor(HexColor("#dc2626")) # Red
            c.setFont("Helvetica-Bold", 10)
        else:
            c.setFillColor(text_dark)
            c.setFont("Helvetica", 10)
            
        c.drawString(220, row_y, val)
        c.setFillColor(text_light)
        c.setFont("Helvetica", 9)
        c.drawString(380, row_y, ref)
        c.setFillColor(text_dark)
    
    # Line
    c.setStrokeColor(line_color)
    c.line(40, y - 120, width - 40, y - 120)
    
    # ---- OPERATIVE PLAN ----
    y -= 150
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(primary_blue)
    c.drawString(40, y, "3. PRE-OPERATIVE PLAN & IMPLANT SPECIFICATIONS")
    
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(text_dark)
    c.drawString(50, y - 25, "Selected Prosthesis:")
    c.setFont("Helvetica", 10)
    c.drawString(180, y - 25, f"{implant} — Titanium Alloy (Ti-6Al-4V)")
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y - 45, "Surgical Approach:")
    c.setFont("Helvetica", 10)
    c.drawString(180, y - 45, "Deltopectoral (Recommended based on 3D impingement mapping)")
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y - 65, "AI Recommendation:")
    c.setFont("Helvetica", 10)
    c.drawString(180, y - 65, "Proceed with selected implant. Geometry aligns with cortical margins.")
    
    # Line
    c.setStrokeColor(line_color)
    c.line(40, y - 85, width - 40, y - 85)
    
    # ---- SIGNATURE BLOCK ----
    y -= 180
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(text_dark)
    c.drawString(40, y, "Electronically Validated By:")
    
    c.setFont("Helvetica", 10)
    c.drawString(40, y - 20, "TwinMed Deep Learning Segmentation Pipeline")
    c.drawString(40, y - 35, "Compute Node: NVIDIA Jetson AGX Orin (Edge Processing)")
    
    # Fake signatures
    c.setStrokeColor(text_dark)
    c.line(width - 240, y - 10, width - 40, y - 10)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 40, y - 22, "Attending Orthopaedic Surgeon Signature")
    
    # ---- FOOTER ----
    c.setStrokeColor(primary_blue)
    c.setLineWidth(2)
    c.line(40, 60, width - 40, 60)
    
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(primary_blue)
    c.drawString(40, 45, "TWINMED MEDICAL SYSTEMS")
    c.setFont("Helvetica", 8)
    c.setFillColor(text_light)
    c.drawString(40, 33, "This document was generated autonomously via Edge AI. Not for diagnostic use without clinical correlation.")
    c.drawRightString(width - 40, 45, f"Page 1 of 1")
    
    c.save()
    buffer.seek(0)
    
    filename = f"Clinical_Report_{patient_id.replace('#', '')}_{datetime.datetime.now().strftime('%Y%m%d')}.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/log-error")
async def log_error(request: Request):
    data = await request.json()
    print(f"\n\n🚨 [FRONTEND UI ERROR CAUGHT]: {data}\n\n")
    return {"status": "logged"}

# ---------- Mount Static Files at ROOT (must be LAST, after all API routes) ----------
app.mount("/", StaticFiles(directory=STATIC_DIR), name="root_static")


# ---------- Run ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
