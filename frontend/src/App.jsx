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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDone, setRecordingDone] = useState(false);
  const [timer, setTimer] = useState(15);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [isMeditationMode, setIsMeditationMode] = useState(false);
  const [meditationReady, setMeditationReady] = useState(false);
  // State baru untuk kontrol slider
  const [stressConfirmed, setStressConfirmed] = useState(false);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.error("Video play error:", e));
      };
    }
  }, [cameraStream]);

  const playAudio = (name) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setAudioFinished(false);
    const audio = new Audio(`/assets/audio/${name}.mp3`);
    setCurrentAudio(audio);
    audio.play().catch(() => setAudioFinished(true));
    audio.onended = () => setAudioFinished(true);
  };

  const handleStart = async (type) => {
    setSelectedAddiction(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
    } catch (err) {
      alert("Please allow camera and microphone access.");
    }
  };

  const startRecordingAnalysis = async () => {
    setIsRecording(true);
    setTimer(15);
    const recorder = new MediaRecorder(cameraStream);
    const chunks = [];
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
        const res = await axios.post('http://localhost:8000/api/session/start', fd);
        setSessionData(res.data);
        setRecordingDone(true);
        setIsRecording(false);
      } catch (err) {
        setIsRecording(false);
      }
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 15000);
  };

  const startTherapySession = () => {
    setIsInstantMode(true);
    setCurrentStepIdx(0);
    playAudio("distance");
  };

  const nextStep = () => {
    if (isInstantMode) {
      if (!sessionData) return alert("Gemini is still analyzing...");
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
      playAudio("stress_check"); // Hanya putar instruksi slider
    }
  };

  // FUNGSI BARU: Dipanggil saat user klik Continue di bawah slider
  const confirmStressLevel = () => {
    setStressConfirmed(true);
    playAudio("decision_prompt"); // Baru putar audio pertanyaan Yes/No
  };

  const handleDecision = (isBetter) => {
    if (currentAudio) currentAudio.pause();

    if (isBetter === "NO") {
      setIsMeditationMode(true);
      setMeditationReady(false);
      const intro = new Audio('/assets/audio/meditation_start.mp3');
      setCurrentAudio(intro);
      intro.play();
      intro.onended = () => setMeditationReady(true);
    } else {
      const win = new Audio('/assets/audio/session_complete.mp3');
      setCurrentAudio(win);
      win.play();
      setCurrentStepIdx(99); 
    }
  };

  const startMeditationMusic = () => {
    if (currentAudio) currentAudio.pause();
    const music = new Audio('/assets/audio/meditation_music.mp3');
    music.loop = true;
    setCurrentAudio(music);
    music.play();
    setMeditationReady(false);
  };

  return (
    <div style={styles.app}>
      <h1 style={styles.heading}>BEACON.ai</h1>
      <p style={styles.subheading}>Personalized CBT Therapy</p>
      
      {currentStepIdx === -1 && !cameraStream && (
        <div style={styles.card}>
          <button onClick={() => handleStart('Nicotine')} style={styles.btn}>Nicotine</button>
          <button onClick={() => handleStart('Alcohol')} style={styles.btn}>Alcohol</button>
          <button onClick={() => handleStart('Drugs')} style={styles.btn}>Drugs</button>
        </div>
      )}

      {currentStepIdx === -1 && cameraStream && (
        <div style={styles.card}>
          <video ref={videoRef} muted style={styles.video} />
          {!isRecording && !recordingDone && <button onClick={startRecordingAnalysis} style={styles.btnRecord}>Analyze Me</button>}
          {isRecording && <div style={styles.timerText}>🔴 {timer}s</div>}
          {recordingDone && <button onClick={startTherapySession} style={styles.btnNext}>Start Therapy Session</button>}
        </div>
      )}

      {currentStepIdx >= 0 && currentStepIdx !== 99 && (
        <div style={styles.card}>
          {!showFinalChoice ? (
            <>
              <h2 style={styles.stepTitle}>
                {isInstantMode ? "Step 1: Distance" : `Step ${currentStepIdx + 2}: ${sessionData?.session_roadmap[currentStepIdx]?.audio_type.replace(/_/g, ' ')}`}
              </h2>
              {audioFinished && <button onClick={nextStep} style={styles.btnNext}>Continue →</button>}
            </>
          ) : (
            <div style={styles.decisionArea}>
              {!stressConfirmed ? (
                <>
                  <div style={styles.sliderContainer}>
                    <p>Final Stress Level Check (1-10)</p>
                    <input type="range" min="1" max="10" value={stressLevel} onChange={(e) => setStressLevel(e.target.value)} style={styles.slider} />
                    <p style={{fontSize: '24px', fontWeight: 'bold'}}>{stressLevel}</p>
                  </div>
                  <button onClick={confirmStressLevel} style={styles.btnNext}>Confirm & Continue</button>
                </>
              ) : (
                <>
                  {!isMeditationMode ? (
                    <>
                      <p style={{ marginBottom: '15px' }}>Do you feel better now?</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleDecision("YES")} style={{ ...styles.btn, backgroundColor: '#10b981' }}>Yes</button>
                        <button onClick={() => handleDecision("NO")} style={{ ...styles.btn, backgroundColor: '#64748b' }}>No</button>
                      </div>
                    </>
                  ) : (
                    <div style={styles.meditationBox}>
                      <h2 style={{ color: '#38bdf8' }}>🧘 Meditation</h2>
                      {meditationReady ? (
                        <button onClick={startMeditationMusic} style={{ ...styles.btn, backgroundColor: '#38bdf8' }}>Start Music</button>
                      ) : (
                        <p>Listening to instructions...</p>
                      )}
                      <button onClick={() => window.location.reload()} style={{ ...styles.btn, backgroundColor: '#ef4444' }}>Exit</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {currentStepIdx === 99 && (
        <div style={styles.card}>
          <h2 style={styles.heading}>Well Done ✨</h2>
          <button onClick={() => window.location.reload()} style={styles.btn}>New Session</button>
        </div>
      )}
    </div>
  );
};

const styles = {
  app: { backgroundColor: '#020617', minHeight: '100vh', color: '#f8fafc', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'sans-serif' },
  card: { backgroundColor: '#0f172a', padding: '40px', borderRadius: '32px', textAlign: 'center', width: '100%', maxWidth: '500px', border: '1px solid #1e293b' },
  video: { width: '100%', borderRadius: '24px', marginBottom: '20px', transform: 'scaleX(-1)', border: '2px solid #334155' },
  btn: { display: 'block', width: '100%', padding: '16px', margin: '10px 0', backgroundColor: '#38bdf8', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: '600', cursor: 'pointer' },
  btnRecord: { padding: '18px 40px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '50px', fontSize: '18px', fontWeight: '700', cursor: 'pointer' },
  btnNext: { width: '100%', padding: '18px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: '700', cursor: 'pointer', marginTop: '20px' },
  timerText: { color: '#ef4444', fontWeight: 'bold', fontSize: '24px', margin: '20px 0' },
  stepTitle: { fontSize: '28px', marginBottom: '20px', textTransform: 'capitalize' },
  sliderContainer: { margin: '30px 0' },
  slider: { width: '100%', height: '10px', cursor: 'pointer', margin: '15px 0' },
  decisionArea: { marginTop: '10px' },
  heading: { fontSize: '36px', fontWeight: '800', marginBottom: '5px' },
  subheading: { color: '#38bdf8', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '30px' },
  meditationBox: { padding: '20px', backgroundColor: '#1e293b', borderRadius: '24px', border: '2px solid #38bdf8' },
};

export default App;