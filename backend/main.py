import os
import shutil
import certifi
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import gridfs
from datetime import datetime, timezone
from ai_service import analyze_video_and_generate_cbt, analyze_yes_no # Gabung import di sini

app = FastAPI()
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- DATABASE SETUP ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = mongo_client.beacon_db
    fs = gridfs.GridFS(db)
    print("✅ Berhasil terhubung ke MongoDB Atlas")
except Exception as e:
    print(f"❌ Gagal koneksi Database: {e}")

# --- ROUTES ---

# 1. ANALISA AWAL (Video 15 detik)
@app.post("/api/session/start")
async def start_session(file: UploadFile = File(...), addiction_type: str = Form(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        analysis = await analyze_video_and_generate_cbt(temp_path, addiction_type)
        try:
            db.checkins.insert_one({
                "user_id": "user_001",
                "type": "initial_scan",
                "analysis": analysis,
                "timestamp": datetime.now(timezone.utc)
            })
        except Exception as e:
            print(f"⚠️ DB Error: {e}")
        return analysis
    finally:
        if os.path.exists(temp_path): os.remove(temp_path)

# 2. ANALISA YES/NO (Decision Akhir)
@app.post("/api/analyze-voice-decision")
async def analyze_decision(file: UploadFile = File(...)):
    temp_audio = f"decision_{file.filename}"
    with open(temp_audio, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        decision = await analyze_yes_no(temp_audio)
        return {"decision": decision} 
    finally:
        if os.path.exists(temp_audio): os.remove(temp_audio)

# 3. SIMPAN SUARA (Log Opsional)
@app.post("/save-voice-response")
async def save_voice(file: UploadFile = File(...), addiction_type: str = Form(...)):
    try:
        audio_data = await file.read()
        file_id = fs.put(
            audio_data, 
            filename=f"response_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.webm",
            metadata={"user_id": "user_001", "addiction": addiction_type}
        )
        db.voice_logs.insert_one({
            "user_id": "user_001",
            "audio_file_id": file_id,
            "timestamp": datetime.now(timezone.utc)
        })
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# --- START SERVER ---
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)