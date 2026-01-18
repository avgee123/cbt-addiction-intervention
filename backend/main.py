import os
import shutil
import certifi
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import gridfs
from datetime import datetime, timezone

# Import service AI kita
from ai_service import analyze_video_and_generate_cbt

app = FastAPI()

# --- MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"]
)

# --- DATABASE SETUP ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
try:
    # Menggunakan certifi agar koneksi ke MongoDB Atlas lancar
    mongo_client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
    db = mongo_client.beacon_db
    fs = gridfs.GridFS(db)
    print("✅ Berhasil terhubung ke MongoDB Atlas")
except Exception as e:
    print(f"❌ Gagal koneksi Database: {e}")

# --- ROUTES ---

@app.post("/api/session/start")
async def start_session(file: UploadFile = File(...), addiction_type: str = Form(...)):
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Jalankan Analisis Gemini
        analysis = await analyze_video_and_generate_cbt(temp_path, addiction_type)
        
        # SIMPAN LOG KE MONGODB (Ini yang tadi hilang, sekarang sudah balik)
        try:
            db.checkins.insert_one({
                "user_id": "user_001",
                "addiction_type": addiction_type,
                "analysis_summary": analysis.get("analysis"),
                "roadmap": analysis.get("session_roadmap"),
                "timestamp": datetime.now(timezone.utc)
            })
            print("✅ Log berhasil disimpan ke MongoDB")
        except Exception as e:
            print(f"⚠️ DB Error: {e}")
            
        return analysis
        
    finally:
        if os.path.exists(temp_path): 
            os.remove(temp_path)

@app.post("/api/save-voice-response")
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

@app.get("/")
async def root():
    return {"status": "Beacon.ai Backend is Running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)