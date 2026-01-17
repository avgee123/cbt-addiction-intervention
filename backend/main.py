from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import uuid
from services.ai_service import analyze_video_and_generate_cbt

app = FastAPI(title="BEACON.ai Backend - Final")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"],  # Change this when deploying later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_videos"
VOICE_DIR = "vocie_notes"
os.makedirs(UPLOAD_DIR, exist_oke=True)
os.makedirs(VOICE_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "BEACON.ai Backend is running"}

@app.post("api/session/start")
async def start_cbt_session(
    addiction_type: str = Form(...),
    video: UploadFile = File(...)
):
    file_id = str(uuid.uuid4())
    video_filename = f"{file_id}_{video.filename}"
    temp_path = os.path.join(UPLOAD_DIR, video_filename)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        cbt_roadmap = await analyze_video_and_generate_cbt(temp_path, addiction_type)

        return{
            "success": True,
            "addiction_type": addiction_type,
            "data": cbt_roadmap
        }

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Processing Failed: {str(e)}")
    
@app.post("/api/voice/save")
async def save_voice_note(
    user_id: str = Form(...),
    voice_file: UploadFile = File(...)
):
    try:
        voice_id = str(uuid.uuid4())
        save_path = os.path.join(VOICE_DIR, f"{user_id}_{voice_id}.webm")

        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(voice_file.file, buffer)

        return {"status": "success", "message": "Voice note saved for therapist review."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save voice note: {str(e)}")
    
    if __name__ == "__main__":
        import uvicorn
        uvicorn.run(app, host="0.0.0.0", port=8000)


    


