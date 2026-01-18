import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const videoRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [selectedAddiction, setSelectedAddiction] = useState(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [sessionData, setSessionData] = useState(null);
  const [audioFinished, setAudioFinished] = useState(false);
  const [isInstantMode, setIsInstantMode] = useState(false);
  const [stressLevel, setStressLevel] = useState(5);
  const [showFinalChoice, setShowFinalChoice] = useState(false);

  // State untuk alur perekaman
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDone, setRecordingDone] = useState(false);
  const [timer, setTimer] = useState(15);

  // FIXED VIDEO: Memastikan kamera muncul
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.error("Video play error:", e));
      };
    }
  }, [cameraStream]);

  const handleStart = async (type) => {
    setSelectedAddiction(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
    } catch (err) {
      alert("Please allow camera and microphone access.");
    }
  };

  // TAHAP 1: Rekam 15 detik pertama kali
  const startRecordingAnalysis = async () => {
    setIsRecording(true);
    setTimer(15);
    
    const recorder = new MediaRecorder(cameraStream);
    const chunks = [];

    // Timer visual 15 detik
    let timeLeft = 15;
    const interval = setInterval(() => {
      timeLeft -= 1;
      setTimer(timeLeft);
      if (timeLeft <= 0) clearInterval(interval);
    }, 1000);

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const fd = new FormData();
      fd.append('file', blob, 'user_video.mp4');
      fd.append('addiction_type', selectedAddiction);
      
      try {
        // Kirim hasil rekaman ke Gemini
        const res = await axios.post('http://localhost:8000/api/session/start', fd);
        setSessionData(res.data);
        setRecordingDone(true); // Rekaman beres, siap ke tahap berikutnya
        setIsRecording(false);
      } catch (err) {
        console.error("Analysis Failed", err);
        alert("Server error. Please restart backend.");
        setIsRecording(false);
      }
    };

    recorder.start();
    setTimeout(() => recorder.stop(), 15000); // REKAM 15 DETIK
  };

  // TAHAP 2: Baru masuk ke Step 1 (Distance)
  const startTherapySession = () => {
    setIsInstantMode(true);
    setCurrentStepIdx(0);
    playAudio("distance");
  };

  const playAudio = (name) => {
    setAudioFinished(false);
    const audio = new Audio(`/assets/audio/${name}.mp3`);
    audio.play().catch(() => setAudioFinished(true));
    audio.onended = () => setAudioFinished(true);
  };

  const nextStep = () => {
    if (isInstantMode) {
      if (!sessionData) return alert("Analyzing... please wait.");
      setIsInstantMode(false);
      setCurrentStepIdx(0); 
      playAudio(sessionData.session_roadmap[0].audio_type);
      return;
    }

    const roadmap = sessionData?.session_roadmap || [];
    const nextIdx = currentStepIdx + 1;

    if (nextIdx < roadmap.length) {
      setCurrentStepIdx(nextIdx);
      playAudio(roadmap[nextIdx].audio_type);
    } else {
      setShowFinalChoice(true);
      playAudio("stress_check");
    }
  };

  const handleVoiceDecision = (isBetter) => {
    if (isBetter === "NO") {
      playAudio("restart_logic");
      setTimeout(() => {
        playAudio("meditation_start");
        setTimeout(() => playAudio("meditation_music"), 4000);
      }, 5000);
    } else {
      setCurrentStepIdx(99);
    }
  };

  return (
    <div style={styles.app}>
      <h1 style={styles.heading}>BEACON.ai</h1>
      <p style={styles.subheading}>Your Smart CBT Companion</p>
      
      {/* 1. Pemilihan 3 Path */}
      {currentStepIdx === -1 && !cameraStream && (
        <div style={styles.card}>
          <h3>Pilih jenis bantuan:</h3>
          <button onClick={() => handleStart('Nicotine')} style={styles.btn}>Nicotine</button>
          <button onClick={() => handleStart('Alcohol')} style={styles.btn}>Alcohol</button>
          <button onClick={() => handleStart('Drugs')} style={styles.btn}>Drugs (Substances)</button>
        </div>
      )}

      {/* 2. Kamera & Alur Perekaman 15 Detik */}
      {currentStepIdx === -1 && cameraStream && (
        <div style={styles.card}>
          <video ref={videoRef} muted style={styles.video} />
          
          {!isRecording && !recordingDone && (
            <button onClick={startRecordingAnalysis} style={styles.btnRecord}>
              Analyze Me 15 Secs
            </button>
          )}

          {isRecording && (
            <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: '24px', margin: '20px 0'}}>
              🔴 RECORDING... {timer}s
            </div>
          )}

          {recordingDone && (
            <button onClick={startTherapySession} style={styles.btnNext}>
              Start Therapy Session
            </button>
          )}
        </div>
      )}

      {/* 3. Therapy Steps Area */}
      {currentStepIdx >= 0 && currentStepIdx !== 99 && (
        <div style={styles.card}>
          <h2 style={styles.heading}>
            {isInstantMode ? "Step 1: Distance" : `Step ${currentStepIdx + 2}: ${sessionData?.session_roadmap[currentStepIdx]?.audio_type.replace('_', ' ')}`}
          </h2>

          {/* SLIDER STRESS CHECK */}
          {(!isInstantMode && sessionData?.session_roadmap[currentStepIdx]?.audio_type === "stress_check") || showFinalChoice ? (
            <div style={styles.sliderContainer}>
              <p>How do you feel now? (1-10)</p>
              <input 
                type="range" min="1" max="10" 
                value={stressLevel} 
                onChange={(e) => setStressLevel(e.target.value)} 
                style={styles.slider} 
              />
              <p style={{textAlign: 'center', fontSize: '24px', fontWeight: 'bold'}}>{stressLevel}</p>
            </div>
          ) : null}

          {audioFinished && !showFinalChoice && (
            <button onClick={nextStep} style={styles.btnNext}>Next Step →</button>
          )}

          {showFinalChoice && (
            <div style={{marginTop: '30px', borderTop: '1px solid #334155', paddingTop: '20px'}}>
              <p style={{fontSize: '18px', marginBottom: '15px'}}>Do you feel better now?</p>
              <button onClick={() => handleVoiceDecision("YES")} style={styles.btn}>Yes, I'm Better</button>
              <button onClick={() => handleVoiceDecision("NO")} style={{...styles.btn, backgroundColor: '#64748b'}}>No, Still Struggling</button>
            </div>
          )}
        </div>
      )}

      {/* 4. Final State */}
      {currentStepIdx === 99 && (
        <div style={styles.card}>
          <h2 style={styles.heading}>Session Completed ✨</h2>
          <p>You did great today. Stay strong!</p>
          <button onClick={() => window.location.reload()} style={styles.btn}>New Session</button>
        </div>
      )}
    </div>
  );
};

const styles = {
  app: {
    backgroundColor: '#020617',
    minHeight: '100vh',
    color: '#f8fafc',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: '"Inter", sans-serif',
  },
  card: {
    backgroundColor: '#0f172a',
    padding: '40px',
    borderRadius: '32px',
    textAlign: 'center',
    width: '100%',
    maxWidth: '550px',
    border: '1px solid #1e293b',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  video: {
    width: '100%',
    borderRadius: '24px',
    marginBottom: '20px',
    transform: 'scaleX(-1)',
    backgroundColor: '#000',
    border: '2px solid #334155',
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '16px',
    margin: '12px 0',
    backgroundColor: '#38bdf8',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  btnRecord: {
    padding: '18px 40px',
    backgroundColor: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
  },
  btnNext: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '20px',
  },
  sliderContainer: {
    margin: '30px 0',
    textAlign: 'left',
  },
  slider: {
    width: '100%',
    height: '10px',
    borderRadius: '5px',
    background: '#334155',
    outline: 'none',
    margin: '15px 0',
    cursor: 'pointer',
  },
  heading: {
    fontSize: '32px',
    marginBottom: '8px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
  },
  subheading: {
    color: '#38bdf8',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginBottom: '20px',
    fontWeight: '700',
  }
};

export default App;