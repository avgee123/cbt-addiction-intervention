import os
import google.generativeai as genai
import json
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def analyze_video_and_generate_cbt(video_path, addiction_type):
    # 1. Load the specific RAG Knowledge Base
    protocol_file = f"knowledge/{addiction_type}_protocols.txt"
    try:
        with open(protocol_file, "r") as f:
            knowledge_context = f.read()
    except FileNotFoundError:
        knowledge_context = "General addiction recovery protocols."

    video_file = genai.upload_file(path=video_path)
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # THE CRITICAL FLOW PROMPT
    prompt = f"""
    ROLE: Expert CBT Therapist.
    ADDICTION TYPE: {addiction_type}
    CONTEXT: {knowledge_context}
    
    TASK:
    1. Analyze video for micro-expressions.
    2. Create a 10-minute CBT Session 1 Roadmap.
    
    STRICT STEP SEQUENCE (MANDATORY):
    - STEP 1: Immediate Safety. Use 'distance' audio. Instruct user to step away from triggers.
    - STEP 2: Somatic Reset. Use 'breathe' and 'exhale' instructions.
    - STEP 3: Voice Engagement. Use 'intro_generic' audio. Invite the user to press the record button and share their feelings.
    - STEP 4 & 5: Cognitive & Physical. Use 'stretch' or addiction-specific audios (nicotine_fix/alcohol_cold/grounding_heavy).
    - STEP 6: Resilience. Use 'affirmation' audio.
    - FINAL STEP: Progress Check. Use 'stress_check' audio.

    OUTPUT FORMAT (Strict JSON):
    {{
      "detected_emotion": "string",
      "intensity_score": number,
      "is_crisis": boolean,
      "session_roadmap": [
        {{ 
          "step_number": 1, 
          "type": "instruction", 
          "text": "Please move away from any triggers right now. I am here with you.", 
          "audio_type": "distance" 
        }},
        {{ 
          "step_number": 2, 
          "type": "instruction", 
          "text": "Take a deep breath in... and release. Let your body settle.", 
          "audio_type": "breathe" 
        }},
        {{ 
          "step_number": 3, 
          "type": "voice_record", 
          "text": "I want to hear your story. What triggered you today? Please press the record button and tell me.", 
          "audio_type": "intro_generic" 
        }},
        ... (generate remaining 3-5 steps based on intensity)
      ],
      "final_motivation": "A warm, empathetic English sentence."
    }}
    """

    response = model.generate_content([prompt, video_file])
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_json)