import os

#UNUSED IN THE END

def get_protocol(addiction_type):
    """
    Mengambil teks protokol lengkap dari folder /knowledge/*.txt
    """
    # Tentukan path folder (pastikan folder 'knowledge' ada di root backend)
    file_path = f"knowledge/{addiction_type}_protocols.txt"
    
    try:
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        else:
            # Fallback jika file tidak ditemukan
            return "General CBT Protocol: Focus on breathing and immediate grounding."
    except Exception as e:
        return f"Error loading protocol: {str(e)}"

def get_motivation(addiction_type):
    """
    Fungsi tambahan jika kamu butuh kata-kata motivasi cepat 
    (Bisa ditaruh di txt juga atau hardcoded di sini saja karena pendek)
    """
    motivations = {
        "Nicotine": "Your lungs start healing in just 20 minutes.",
        "Alcohol": "Your liver starts detoxing immediately.",
        "Substance": "Your brain is reclaiming its natural balance."
    }
    return motivations.get(addiction_type, "You are stronger than your urges.")