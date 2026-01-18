import React, { useRef, useState, useEffect } from 'react';
import axios from 'axios';

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  
  @keyframes breathe {
    0%, 100% { 
      transform: scale(1); 
      box-shadow: 0 0 30px rgba(251, 191, 36, 0.4), 0 0 60px rgba(251, 191, 36, 0.2);
    }
    50% { 
      transform: scale(1.02); 
      box-shadow: 0 0 50px rgba(251, 191, 36, 0.6), 0 0 80px rgba(251, 191, 36, 0.3);
    }
  }
  
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 15px 30px -5px rgba(251, 191, 36, 0.4);
  }

  .card-enter {
    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;
document.head.appendChild(styleSheet);

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
  
  // State Meditasi & Final Baru
  const [isMeditationMode, setIsMeditationMode] = useState(false);
  const [meditationMusicPlaying, setMeditationMusicPlaying] = useState(false);
  const [stressConfirmed, setStressConfirmed] = useState(false);
  const [isSessionFinished, setIsSessionFinished] = useState(false);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.error(e));
    }
  }, [cameraStream]);

  const playAudio = (name, onEndCallback = null) => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    setAudioFinished(false);
    const audio = new Audio(`/assets/audio/${name}.mp3`);
    setCurrentAudio(audio);
    audio.play().catch(() => setAudioFinished(true));
    audio.onended = () => {
      setAudioFinished(true);
      if (onEndCallback) onEndCallback();
    };
  };

  const handleStart = async (type) => {
    setSelectedAddiction(type);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
    } catch (err) { 
      alert("Allow camera access."); 
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
      setRecordingDone(true);
      setIsRecording(false);
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const fd = new FormData();
      fd.append('file', blob, 'user_video.mp4');
      fd.append('addiction_type', selectedAddiction);
      try {
        const res = await axios.post('http://localhost:8000/api/session/start', fd);
        setSessionData(res.data);
      } catch (err) { 
        console.error(err); 
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
    if (isInstantMode && !sessionData) return alert("Gemini is finalizing...");
    const roadmap = sessionData?.session_roadmap || [];
    if (isInstantMode) {
      setIsInstantMode(false);
      setCurrentStepIdx(0); 
      if (roadmap.length > 0) playAudio(roadmap[0].audio_type);
      return;
    }
    const nextIdx = currentStepIdx + 1;
    if (nextIdx < roadmap.length) {
      setCurrentStepIdx(nextIdx);
      playAudio(roadmap[nextIdx].audio_type);
    } else {
      setShowFinalChoice(true);
      playAudio("stress_check");
    }
  };

  const handleDecision = (choice) => {
    if (currentAudio) currentAudio.pause();
    if (choice === "YES") {
      setIsSessionFinished(true);
      playAudio("session_complete");
    } else {
      setIsMeditationMode(true);
      playAudio("meditation_start");
    }
  };

  const startMeditationMusic = () => {
    setMeditationMusicPlaying(true);
    if (currentAudio) currentAudio.pause();
    const music = new Audio('/assets/audio/meditation_music.mp3');
    music.loop = true;
    setCurrentAudio(music);
    music.play();
  };

  const finalizeSession = () => {
    if (currentAudio) currentAudio.pause();
    setIsSessionFinished(true);
    playAudio("session_complete");
  };

  return (
    <div style={styles.app}>
      <div style={styles.bgPattern}></div>
      
      <div style={styles.logoContainer}>
        <h1 style={styles.heading}>LAST.CALL</h1>
        <div style={styles.tagline}>Emergency Intervention System</div>
      </div>
      
      {/* 1. SELECTION & RECORDING */}
      {currentStepIdx === -1 && !isSessionFinished && (
        <div style={{...styles.card, ...styles.cardEnter}}>
          {!cameraStream ? (
            <>
              <div style={styles.sectionLabel}>CRISIS TYPE</div>
              <h3 style={styles.humanQuestion}>What are you struggling with right now?</h3>
              <button onClick={() => handleStart('Nicotine')} style={styles.btn} className="btn">
                <span style={styles.btnIcon}>🚬</span>
                <span>Nicotine</span>
              </button>
              <button onClick={() => handleStart('Alcohol')} style={styles.btn} className="btn">
                <span style={styles.btnIcon}>🍺</span>
                <span>Alcohol</span>
              </button>
              <button onClick={() => handleStart('Drugs')} style={styles.btn} className="btn">
                <span style={styles.btnIcon}>💊</span>
                <span>Substances</span>
              </button>
            </>
          ) : (
            <>
              <div style={styles.videoWrapper}>
                <video ref={videoRef} muted style={styles.video} />
                <div style={styles.videoOverlay}></div>
              </div>
              
              {!isRecording && !recordingDone && (
                <button onClick={startRecordingAnalysis} style={styles.btnRecord} className="btn">
                  <div style={styles.recordIcon}></div>
                  Talk for 15 seconds
                </button>
              )}
              
              {isRecording && (
                <div style={styles.timerContainer}>
                  <div style={styles.pulse}></div>
                  <div style={styles.timerText}>{timer}</div>
                  <div style={styles.timerLabel}>RECORDING</div>
                </div>
              )}
              
              {recordingDone && (
                <button onClick={startTherapySession} style={styles.btnNext} className="btn">
                  Start Intervention →
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 2. THERAPY STEPS & FINAL CHOICE */}
      {currentStepIdx >= 0 && !isSessionFinished && (
        <div style={{...styles.card, ...styles.cardEnter}}>
          {!showFinalChoice ? (
            <>
              <div style={styles.stepIndicator}>
                {isInstantMode ? "STEP 1" : `STEP ${currentStepIdx + 2}`}
              </div>
              <h2 style={styles.stepTitle}>
                {isInstantMode ? "Distance" : sessionData?.session_roadmap?.[currentStepIdx]?.audio_type.replace(/_/g, ' ').toUpperCase()}
              </h2>
              {audioFinished && (
                <button onClick={nextStep} style={styles.btnNext} className="btn">
                  Continue →
                </button>
              )}
            </>
          ) : (
            <div style={styles.decisionArea}>
              {!stressConfirmed ? (
                <>
                  <div style={styles.sectionLabel}>STRESS MEASUREMENT</div>
                  <h3 style={styles.humanQuestion}>How intense is the urge right now?</h3>
                  <div style={styles.sliderContainer}>
                    <div style={styles.stressDisplay}>{stressLevel}</div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={stressLevel} 
                      onChange={(e) => setStressLevel(e.target.value)} 
                      style={styles.slider} 
                    />
                    <div style={styles.sliderLabels}>
                      <span style={styles.sliderLabel}>Manageable</span>
                      <span style={styles.sliderLabel}>Overwhelming</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { 
                      setStressConfirmed(true); 
                      playAudio("decision_prompt"); 
                    }} 
                    style={styles.btnNext}
                    className="btn"
                  >
                    Lock it in
                  </button>
                </>
              ) : (
                <>
                  {!isMeditationMode ? (
                    <>
                      <div style={styles.sectionLabel}>STATUS CHECK</div>
                      <h3 style={styles.humanQuestion}>Did that help you regain control?</h3>
                      <div style={styles.buttonGroup}>
                        <button 
                          onClick={() => handleDecision("YES")} 
                          style={{...styles.btnChoice, ...styles.btnYes}}
                          className="btn"
                        >
                          ✓ Yes, I'm good
                        </button>
                        <button 
                          onClick={() => handleDecision("NO")} 
                          style={{...styles.btnChoice, ...styles.btnNo}}
                          className="btn"
                        >
                          ✗ Still struggling
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={styles.meditationBox}>
                      <div style={styles.meditationIcon}>🧘</div>
                      <h2 style={styles.meditationTitle}>RECOVERY MODE</h2>
                      
                      <div style={styles.meditationStatus}>
                        {audioFinished && !meditationMusicPlaying ? (
                          <>
                            <div style={styles.readyIndicator}>●</div>
                            <span>Ready to begin</span>
                          </>
                        ) : !meditationMusicPlaying ? (
                          <>
                            <div style={styles.loadingIndicator}></div>
                            <span>Listening to instructions...</span>
                          </>
                        ) : (
                          <>
                            <div style={styles.playingIndicator}>♫</div>
                            <span>Meditation in progress</span>
                          </>
                        )}
                      </div>
                      
                      {audioFinished && !meditationMusicPlaying && (
                        <button 
                          onClick={startMeditationMusic} 
                          style={styles.btnMeditation}
                          className="btn"
                        >
                          Begin Meditation
                        </button>
                      )}
                      
                      {meditationMusicPlaying && (
                        <button 
                          onClick={finalizeSession} 
                          style={styles.btnExit}
                          className="btn"
                        >
                          Exit Meditation
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. FINAL SUCCESS BOX */}
      {isSessionFinished && (
        <div style={{...styles.card, ...styles.cardEnter}}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>SESSION COMPLETE</h2>
          <p style={styles.successMessage}>You just proved you're stronger than the urge. Remember this moment.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={styles.btnNext}
            className="btn"
          >
            New Session
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  app: { 
    position: 'relative',
    backgroundColor: '#0a0a0a', 
    minHeight: '100vh', 
    color: '#e5e5e5', 
    padding: '60px 20px', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 50%, rgba(251, 191, 36, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(251, 191, 36, 0.02) 0%, transparent 50%)
    `,
    pointerEvents: 'none',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '60px',
    position: 'relative',
    zIndex: 1,
  },
  heading: { 
    fontSize: '72px',
    fontWeight: '700',
    margin: 0,
    letterSpacing: '-3px',
    color: '#fbbf24',
    textShadow: '0 0 40px rgba(251, 191, 36, 0.4)',
    fontFamily: '"Space Grotesk", sans-serif',
  },
  tagline: {
    marginTop: '12px',
    fontSize: '13px',
    letterSpacing: '3px',
    color: '#737373',
    textTransform: 'uppercase',
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: '400',
  },
  card: { 
    backgroundColor: 'rgba(23, 23, 23, 0.6)',
    backdropFilter: 'blur(20px)',
    padding: '48px',
    borderRadius: '24px',
    textAlign: 'center',
    width: '100%',
    maxWidth: '480px',
    border: '1px solid rgba(251, 191, 36, 0.1)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    position: 'relative',
    zIndex: 1,
  },
  cardEnter: {
    animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  sectionLabel: {
    fontSize: '11px',
    letterSpacing: '2px',
    color: '#737373',
    marginBottom: '16px',
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: '600',
  },
  humanQuestion: {
    fontSize: '20px',
    color: '#e5e5e5',
    marginBottom: '28px',
    marginTop: '8px',
    fontWeight: '500',
    lineHeight: '1.4',
    letterSpacing: '-0.3px',
  },
  videoWrapper: {
    position: 'relative',
    marginBottom: '32px',
  },
  video: { 
    width: '100%',
    borderRadius: '16px',
    transform: 'scaleX(-1)',
    border: '2px solid rgba(251, 191, 36, 0.2)',
    boxShadow: '0 0 30px rgba(251, 191, 36, 0.15)',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(to bottom, transparent, rgba(10, 10, 10, 0.3))',
    borderRadius: '16px',
    pointerEvents: 'none',
  },
  btn: { 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '18px 24px',
    margin: '12px 0',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: '"Space Grotesk", sans-serif',
    letterSpacing: '0.5px',
  },
  btnIcon: {
    fontSize: '20px',
  },
  btnRecord: { 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '20px 40px',
    backgroundColor: '#fbbf24',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '50px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    margin: '0 auto',
    animation: 'breathe 2s infinite ease-in-out',
    transition: 'all 0.3s ease',
    fontFamily: '"Space Grotesk", sans-serif',
    letterSpacing: '0.5px',
  },
  recordIcon: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#0a0a0a',
  },
  btnNext: { 
    width: '100%',
    padding: '20px',
    backgroundColor: '#fbbf24',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '24px',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: '"Space Grotesk", sans-serif',
    letterSpacing: '0.5px',
  },
  timerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '40px',
    position: 'relative',
  },
  pulse: {
    position: 'absolute',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '2px solid #fbbf24',
    animation: 'breathe 1.5s infinite ease-in-out',
  },
  timerText: { 
    fontSize: '56px',
    fontWeight: '700',
    color: '#fbbf24',
    fontFamily: '"JetBrains Mono", monospace',
    position: 'relative',
    zIndex: 1,
  },
  timerLabel: {
    fontSize: '11px',
    letterSpacing: '2px',
    color: '#737373',
    fontFamily: '"JetBrains Mono", monospace',
  },
  stepIndicator: {
    fontSize: '11px',
    letterSpacing: '3px',
    color: '#737373',
    marginBottom: '8px',
    fontFamily: '"JetBrains Mono", monospace',
    fontWeight: '600',
  },
  stepTitle: { 
    fontSize: '28px',
    marginBottom: '32px',
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: '-0.5px',
    fontFamily: '"Space Grotesk", sans-serif',
  },
  sliderContainer: { 
    margin: '32px 0',
    padding: '32px',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(251, 191, 36, 0.15)',
  },
  stressDisplay: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#fbbf24',
    marginBottom: '24px',
    fontFamily: '"JetBrains Mono", monospace',
  },
  slider: { 
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    cursor: 'pointer',
    WebkitAppearance: 'none',
    appearance: 'none',
    background: 'linear-gradient(to right, rgba(251, 191, 36, 0.3), #fbbf24)',
    outline: 'none',
    marginBottom: '12px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
  },
  sliderLabel: {
    fontSize: '11px',
    color: '#737373',
    fontFamily: '"JetBrains Mono", monospace',
    letterSpacing: '1px',
  },
  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  btnChoice: {
    padding: '18px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Space Grotesk", sans-serif',
  },
  btnYes: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)',
  },
  btnNo: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  meditationBox: { 
    padding: '40px',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderRadius: '20px',
    border: '1px dashed rgba(251, 191, 36, 0.3)',
  },
  meditationIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  meditationTitle: {
    fontSize: '24px',
    color: '#fbbf24',
    marginBottom: '24px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  meditationStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '24px',
    fontSize: '14px',
    color: '#a3a3a3',
    fontFamily: '"JetBrains Mono", monospace',
  },
  readyIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    boxShadow: '0 0 10px #22c55e',
  },
  loadingIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#fbbf24',
    animation: 'breathe 1s infinite ease-in-out',
  },
  playingIndicator: {
    fontSize: '16px',
    color: '#fbbf24',
    animation: 'breathe 2s infinite ease-in-out',
  },
  btnMeditation: {
    width: '100%',
    padding: '18px',
    backgroundColor: '#fbbf24',
    color: '#0a0a0a',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'all 0.3s ease',
    fontFamily: '"Space Grotesk", sans-serif',
  },
  btnExit: {
    width: '100%',
    padding: '14px',
    backgroundColor: 'transparent',
    color: '#737373',
    border: '1px solid rgba(115, 115, 115, 0.3)',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    fontFamily: '"Space Grotesk", sans-serif',
  },
  successIcon: {
    fontSize: '64px',
    color: '#22c55e',
    marginBottom: '16px',
  },
  successTitle: {
    fontSize: '28px',
    color: '#22c55e',
    marginBottom: '16px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
  },
  successMessage: {
    fontSize: '15px',
    color: '#a3a3a3',
    lineHeight: '1.6',
    marginBottom: '32px',
  },
  decisionArea: {
    marginTop: '0',
  },
};

export default App;