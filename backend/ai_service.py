import os
import json
import time
import google.generativeai as genai
from fastapi import UploadFile
import shutil
from dotenv import load_dotenv


load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

async def analyze_video_and_generate_cbt(video_path: str, addiction_type: str):
    """
    Menganalisis video user dan membaca file protokol .txt untuk 
    menghasilkan roadmap CBT yang akurat.
    """
    
    #AI Model
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    #Protocols from knowledge
    protocol_content = ""
    txt_path = f"knowledge/{addiction_type}_protocols.txt"
    
    if os.path.exists(txt_path):
        with open(txt_path, "r") as f:
            protocol_content = f.read()
    else:
        protocol_content = "Follow standard CBT grounding techniques for emotional regulation."

    #Video uploaded to Google Cloud
    print(f"Uploading {video_path} to Gemini...")
    video_file = genai.upload_file(path=video_path)
    
    #Wait until video processing ends
    while video_file.state.name == "PROCESSING":
        print("Gemini is still processing the video...")
        time.sleep(2)
        video_file = genai.get_file(video_file.name)
    
    if video_file.state.name == "FAILED":
        raise Exception("Video processing failed on Gemini server.")

    # Audio files
    audio_inventory = {
        "Nicotine": [
            "validation_nic", "breath_intro", "inhale_exhale", 
            "sip_water", "clench_fists", "sensory_nic_blue_object", 
            "sensory_nic_textured_object", "nicotine_logic", "future_self"
        ],
        "Alcohol": [
            "validation_alc", "breath_intro", "inhale_exhale", 
            "ice_sensation", "body_scan_alc", "power_affirmation", 
            "anchor_grounding"
        ],
        "Drugs": [
            "validation_drugs", "breath_intro", "inhale_exhale", 
            "grip_reality", "sensory_shock", "logic_emergency", 
            "internal_anchor"
        ]
    }

    # PROMPT
    prompt = f"""
    You are a professional CBT Therapist AI. Analyze this 15-second video of a user struggling with {addiction_type} craving.
    
    REFERENCE PROTOCOL (Read this carefully):
    {protocol_content}
    
    INSTRUCTIONS:
    1. Evaluate their stress level through facial micro-expressions and vocal tone.
    2. Construct a 7-step CBT roadmap using ONLY these audio files: {audio_inventory[addiction_type]}.
    
    STRICT RULES:
    - ALWAYS start with 'validation_{addiction_type.lower()[:3]}'.
    - Use the 'REFERENCE PROTOCOL' above to decide which grounding technique fits the user's expression.
    - If user looks very tense, include 'breath_intro' then 'inhale_exhale' early.
    - Do NOT include 'distance', 'stress_check', or 'decision_prompt'.
    
    OUTPUT FORMAT (JSON ONLY):

    {{

      "analysis": "Brief explanation of user's state",

      "session_roadmap": [

        {{"step": 1, "audio_type": "filename_from_inventory"}},

        ...

      ]

    }}
    """

    # GENERATE CONTENT
    print("Gemini is analyzing with knowledge integration...")
    response = model.generate_content([prompt, video_file])
    
    # PARSING & CLEANUP
    try:
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(raw_text)
        print(f"✅ Roadmap generated based on {addiction_type}_protocols.txt")
        return result
        
    except Exception as e:
        print(f"❌ Error Parsing: {e}")
        return {
            "analysis": "Standard protocol applied due to parsing error.",
            "session_roadmap": [
                {"step": 1, "audio_type": f"validation_{addiction_type.lower()[:3]}"},
                {"step": 2, "audio_type": "breath_intro"},
                {"step": 3, "audio_type": "inhale_exhale"}
            ]
        }
    finally:
        genai.delete_file(video_file.name)