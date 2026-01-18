import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const currentAudioRef = useRef(null);
  const voiceChunksRef = useRef([]);

  const [selectedAddiction, setSelectedAddiction] = useState(null);
  const [cameraStream, setCameraStream] = useState(null); // Simpan stream di state
  const [isRecording, setIsRecording] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1); 
  const [isInstantMode, setIsInstantMode] = useState(false);
  const [audioFinished, setAudioFinished] = useState(false);
  const [isRecordingVoiceResponse, setIsRecordingVoiceResponse] = useState(false);

  // Sync stream ke elemen video setiap kali stream tersedia
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // 1. START: CAMERA ACCESS
  const handleStart = async (type) => {
    setSelectedAddiction(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setCameraStream(stream); // Simpan ke state agar komponen re-render
      setCurrentStepIdx(-1); // Pastikan tetap di view kamera
    } catch (err) {
      console.error(err);
      alert("Kamera diblokir atau tidak ditemukan.");
    }
  };

  // 2. INITIAL 15s STORY RECORDING
  const handleRecordProcess = () => {
    if (!cameraStream) {
      alert("Tunggu sebentar, kamera belum siap.");
      return;
    }

    setIsRecording(true);
    const chunks = [];
    
    // Gunakan cameraStream dari state, bukan dari Ref (lebih aman)
    mediaRecorderRef.current = new MediaRecorder(cameraStream);
    
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      startBridgeMode(); 
      await sendToGeminiRAG(blob); 
    };

    mediaRecorderRef.current.start();

    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }, 15000);
  };

  // 3. THE BRIDGE
  const startBridgeMode = () => {
    setLoadingAI(true);
    setIsInstantMode(true);
    setCurrentStepIdx(0); 
    playStepAudio('distance');
  };

  const sendToGeminiRAG = async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'user_story.mp4');
    formData.append('addiction_type', selectedAddiction);
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/session/start', formData);
      setSessionData(response.data); 
      setLoadingAI(false); 
    } catch (error) {
      console.error("AI Error", error);
      setLoadingAI(false);
    }
  };

  const playStepAudio = (fileName) => {
    setAudioFinished(false);
    if (currentAudioRef.current) currentAudioRef.current.pause();
    const audio = new Audio(`/assets/audio/${fileName}.mp3`);
    currentAudioRef.current = audio;
    audio.play().catch(() => setAudioFinished(true));
    audio.onended = () => setAudioFinished(true);
  };

  const nextStep = () => {
    if (isInstantMode) {
      if (currentStepIdx === 0) {
        setCurrentStepIdx(1);
        playStepAudio('intro_generic');
        return;
      }
      if (currentStepIdx === 1) {
        if (loadingAI) return; 
        setIsInstantMode(false);
        setCurrentStepIdx(0); 
        playStepAudio(sessionData?.session_roadmap[0]?.audio_type);
        return;
      }
    }
    const roadmap = sessionData?.session_roadmap || [];
    const nextIdx = currentStepIdx + 1;
    if (nextIdx >= roadmap.length) {
      setCurrentStepIdx(99); 
      return;
    }
    setCurrentStepIdx(nextIdx);
    playStepAudio(roadmap[nextIdx]?.audio_type);
  };

  return (
    <div style={styles.app}>
      <h1 style={styles.logo}>BEACON.ai</h1>
      
      {/* VIEW 1: Pilih Adiksi */}
      {currentStepIdx === -1 && !cameraStream && (
        <div style={styles.card}>
          <h2>Pick your path:</h2>
          <button onClick={() => handleStart('Nicotine')} style={styles.btnPrimary}>Nicotine</button>
          <button onClick={() => handleStart('Alcohol')} style={styles.btnPrimary}>Alcohol</button>
        </div>
      )}

      {/* VIEW 2: Kamera & Record */}
      {currentStepIdx === -1 && cameraStream && (
        <div style={styles.card}>
          <div style={styles.cameraBox}>
            <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
            {isRecording && <div style={styles.recLabel}>RECORDING 15s STORY...</div>}
          </div>
          {!isRecording && <button onClick={handleRecordProcess} style={styles.btnRecord}>Start Check-in</button>}
        </div>
      )}

      {/* VIEW 3: Terapi Mode */}
      {currentStepIdx >= 0 && currentStepIdx !== 99 && (
        <div style={styles.card}>
          <p style={styles.stepCount}>
            {isInstantMode ? `PREPARATION ${currentStepIdx + 1}` : `THERAPY STEP ${currentStepIdx + 3}`}
          </p>
          <h2 style={styles.stepTitle}>
            {isInstantMode 
              ? (currentStepIdx === 0 ? "Move away from triggers & breathe." : "Tell me your story.")
              : sessionData?.session_roadmap[currentStepIdx]?.text}
          </h2>
          {audioFinished ? (
            <button onClick={nextStep} style={styles.btnNext}>Next Step →</button>
          ) : (
            <p style={styles.statusText}>Listening...</p>
          )}
        </div>
      )}

      {/* VIEW 4: Selesai */}
      {currentStepIdx === 99 && (
        <div style={styles.card}>
          <h2>Session Complete ✨</h2>
          <button onClick={() => window.location.reload()} style={styles.btnPrimary}>Home</button>
        </div>
      )}
    </div>
  );
};

const styles = {
  app: { backgroundColor: '#020617', minHeight: '100vh', color: 'white', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logo: { fontSize: '2.5rem', marginBottom: '40px' },
  card: { backgroundColor: '#0f172a', padding: '40px', borderRadius: '40px', textAlign: 'center', width: '500px', border: '1px solid #1e293b' },
  cameraBox: { width: '100%', borderRadius: '24px', overflow: 'hidden', position: 'relative', marginBottom: '20px', backgroundColor: '#000', minHeight: '300px' },
  video: { width: '100%', height: '100%', transform: 'scaleX(-1)' },
  recLabel: { position: 'absolute', top: '10px', width: '100%', color: 'red', fontWeight: 'bold' },
  btnPrimary: { padding: '15px 30px', backgroundColor: '#38bdf8', border: 'none', borderRadius: '12px', color: 'white', margin: '10px', cursor: 'pointer' },
  btnNext: { padding: '18px 36px', backgroundColor: '#38bdf8', border: 'none', borderRadius: '16px', color: 'white', cursor: 'pointer', width: '100%' },
  btnRecord: { padding: '15px 30px', backgroundColor: '#ef4444', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer' },
  stepTitle: { fontSize: '22px', margin: '20px 0' },
  stepCount: { color: '#38bdf8', fontSize: '12px' },
  statusText: { color: '#64748b', fontStyle: 'italic' }
};

export default App;