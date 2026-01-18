import os
import google.generativeai as genai
import json
import time
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def analyze_video_and_generate_cbt(video_path, addiction_type):
    video_file = genai.upload_file(path=video_path)
    while video_file.state.name == "PROCESSING":
        time.sleep(1)
        video_file = genai.get_file(video_file.name)

    model = genai.GenerativeModel('gemini-2.5-flash')
    
    # KNOWLEDGE MAPPING:
    # Nicotine -> nicotine_fix
    # Alcohol -> alcohol_cold
    # Drugs -> grounding_heavy
    
    prompt = f"""
    ROLE: Expert CBT Therapist for {addiction_type}.
    TASK: Based on the video, create 7-10 steps for the therapy roadmap.
    
    AVAILABLE AUDIOS: 
    - Basic: ['exhale', 'breath_nasal', 'meditation_start', 'meditation_music', 'stretch', 'grounding_mp3', 'affirmation', 'stress_check']
    - Specific: ['nicotine_fix', 'alcohol_cold', 'grounding_heavy']

    DIRECTIONS:
    1. Step 1 is ALREADY DONE (Distance). 
    2. Start from Step 2 using 'intro_generic'.
    3. From Step 3 to Step 9, pick from AVAILABLE AUDIOS based on user's emotion in video.
    4. If Nicotine, include 'nicotine_fix'. If Alcohol, 'alcohol_cold'. If Drugs, 'grounding_heavy'.
    5. Always include 'stress_check' at least once in the middle.
    
    OUTPUT JSON:
    {{
      "session_roadmap": [
        {{ "step": 2, "text": "I've analyzed your state. Let's begin.", "audio_type": "intro_generic" }},
        {{ "step": 3, "text": "...", "audio_type": "..." }}
      ]
    }}
    """
    response = model.generate_content([prompt, video_file])
    return json.loads(response.text.replace("```json", "").replace("```", "").strip())

# Logic baru untuk cek Yes/No di akhir sesi
async def analyze_yes_no(audio_path):
    model = genai.GenerativeModel('gemini-1.5-flash')
    audio_file = genai.upload_file(path=audio_path)
    prompt = "Listen to this audio. Did the user say 'Yes' (they feel better) or 'No' (still struggling)? Answer only with one word: YES or NO."
    response = model.generate_content([prompt, audio_file])
    return response.text.strip().upper()