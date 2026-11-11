'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Volume2,
  VolumeX,
  Radio,
  RefreshCw,
  ChevronDown,
  Globe,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Moon,
  Activity,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  language?: string;
  audioBase64?: string;
  isVoiceInput?: boolean;
}

// 7 Distinct States as per Section 10
export type AssistantVoiceState =
  | 'standby' // 1. Standby: Waiting for the wake word ("Hey", "Hey Vynzora AI", "Vynzora AI")
  | 'activated' // 2. Activated: Wake word detected; greeting the user ("Hello! I'm listening. How can I help you?")
  | 'listening' // 3. Listening: Capturing the user's question hands-free
  | 'processing' // 4. Processing: Automatically processing speech after silence detection
  | 'speaking' // 5. Speaking: Playing the AI voice response
  | 'conversation' // 6. Conversation: Waiting for the next question (turn-taking mode)
  | 'sleep' // 7. Sleep: Returning to wake-word detection mode
  | 'disabled'; // Wake-word detection explicitly disabled by user

// Configurable Silence Detection Parameters (Section 8)
const SILENCE_DURATION_MS = 1800; // 1.8 seconds of continuous silence after speech -> auto submit
const SPEECH_VOLUME_THRESHOLD = 14; // RMS amplitude threshold to detect human speech
const MIN_SPEECH_DURATION_MS = 300; // Minimum 300ms of actual speech required before silence detection arms
const MAX_RECORDING_TIMEOUT_MS = 18000; // 18 seconds maximum recording timeout
const INACTIVITY_TIMEOUT_MS = 9000; // 9 seconds without speech before returning to standby

// Regex matching accepted wake phrases: "Hey", "Hey Vynzora AI", "Vynzora AI"
const WAKE_WORD_REGEX =
  /\b(hey\s+v[iy]nzora(\s+ai)?|v[iy]nzora(\s+ai)?|hey\s+winzora(\s+ai)?|winzora(\s+ai)?|hey\s+zora(\s+ai)?|zora\s+ai|വിൻസോറ|ഹേയ്\s+വിൻസോറ|हाय\s+വിन्ज़ोरा|विन्ज़ोरा|\bhey\b)\b/i;

// Regex matching sleep/stop commands during active conversation
const SLEEP_WORD_REGEX =
  /\b(stop|go\s+to\s+sleep|sleep|bye|goodbye|cancel|exit|shut\s+down|quit|മതി|നിർത്തൂ|ശരി\s+മതി)\b/i;

const SUGGESTED_PROMPTS = [
  { label: 'ഹലോ', text: 'ഹലോ', lang: 'ml' },
  { label: 'എത്ര contacts ഉണ്ട്?', text: 'എത്ര contacts ഉണ്ട്?', lang: 'ml' },
  { label: 'എല്ലാ കോൺടാക്റ്റുകളും കാണിക്കൂ', text: 'എല്ലാ കോൺടാക്റ്റുകളുടെയും വിവരങ്ങൾ കാണിക്കൂ.', lang: 'ml' },
  { label: 'Total Enquiries?', text: 'How many enquiries do we have?', lang: 'en' },
  { label: 'Latest Enquiries', text: 'Show the latest 5 enquiries.', lang: 'en' },
  { label: 'आज कितने contacts हैं?', text: 'आज कितने contacts हैं?', lang: 'hi' },
];

export default function VynzoraFloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isManualRecording, setIsManualRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // Audio Playback State (gTTS)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

  // Voice Interaction State Management (Section 10)
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(true);
  const [voiceState, setVoiceState] = useState<AssistantVoiceState>('standby');
  const [micPermission, setMicPermission] = useState<'granted' | 'prompt' | 'denied' | 'checking'>('checking');

  // Backend Health State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for audio, DOM, and timers
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Refs for Hands-Free Wake-Word & VAD
  const wakeWordRecRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<any>(null);
  const conversationInactivityTimerRef = useRef<any>(null);

  // Duplicate submission guard & state mirrors
  const isSubmittingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const voiceStateRef = useRef<AssistantVoiceState>('standby');
  voiceStateRef.current = voiceState;
  const isPlayingAudioRef = useRef(false);
  isPlayingAudioRef.current = isPlayingAudio;
  const isRecordingRef = useRef(false);
  isRecordingRef.current = isRecording;
  const isLoadingRef = useRef(false);
  isLoadingRef.current = isLoading;
  const isWakeWordEnabledRef = useRef(true);
  isWakeWordEnabledRef.current = isWakeWordEnabled;

  // Initialize or restore session ID and wake-word preference
  useEffect(() => {
    let sid = localStorage.getItem('vynzora_ai_session_id');
    if (!sid) {
      sid = 'vynzora-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
      localStorage.setItem('vynzora_ai_session_id', sid);
    }
    setSessionId(sid);

    const savedWakePref = localStorage.getItem('vynzora_wake_word_enabled');
    if (savedWakePref !== null) {
      setIsWakeWordEnabled(savedWakePref === 'true');
    }
  }, []);

  // Check Python Backend Health
  const checkBackendHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/health');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'healthy') {
          setBackendStatus('online');
          setErrorMessage(null);
          return;
        }
      }
      setBackendStatus('offline');
    } catch {
      setBackendStatus('offline');
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Stop audio and timers on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      if (vadIntervalRef.current) {
        clearInterval(vadIntervalRef.current);
      }
      if (conversationInactivityTimerRef.current) {
        clearTimeout(conversationInactivityTimerRef.current);
      }
      if (wakeWordRecRef.current) {
        try {
          wakeWordRecRef.current.abort();
        } catch {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch {}
      }
    };
  }, []);

  // ============================================================================
  // AUDIO PLAYBACK (gTTS Response & Wake Acknowledgement)
  // ============================================================================
  const stopAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  }, []);

  // Play audio from base64 string with onEnded callback
  const playAudioBase64 = useCallback(
    (base64Audio: string, onEnded?: () => void) => {
      try {
        stopAudio();

        const byteCharacters = atob(base64Audio);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);

        setCurrentAudioUrl(url);
        const audio = new Audio(url);
        audioElementRef.current = audio;

        setIsPlayingAudio(true);
        setVoiceState('speaking');

        audio.onended = () => {
          setIsPlayingAudio(false);
          if (onEnded) {
            onEnded();
          } else {
            handleResponseAudioFinished();
          }
        };

        audio.onerror = () => {
          setIsPlayingAudio(false);
          handleResponseAudioFinished();
        };

        audio.play().catch((err) => {
          console.warn('Audio playback interrupted or blocked:', err);
          setIsPlayingAudio(false);
          handleResponseAudioFinished();
        });
      } catch (e) {
        console.error('Failed to play audio:', e);
        setIsPlayingAudio(false);
        handleResponseAudioFinished();
      }
    },
    [stopAudio]
  );

  // Play Wake Acknowledgement: "Hello! I'm listening. How can I help you?"
  const playWakeAcknowledgement = useCallback(
    (onComplete: () => void) => {
      stopAudio();
      setVoiceState('activated');
      setIsPlayingAudio(true);

      const ackAudio = new Audio('/audio/wake_acknowledgement.mp3');
      audioElementRef.current = ackAudio;

      const finishAck = () => {
        setIsPlayingAudio(false);
        // Safety gap before activating microphone to prevent acoustic feedback
        setTimeout(() => {
          onComplete();
        }, 350);
      };

      ackAudio.onended = finishAck;
      ackAudio.onerror = () => {
        // Fallback to browser SpeechSynthesis if MP3 fails
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance("Hello! I'm listening. How can I help you?");
          utter.rate = 1.0;
          utter.onend = finishAck;
          utter.onerror = finishAck;
          window.speechSynthesis.speak(utter);
        } else {
          finishAck();
        }
      };

      ackAudio.play().catch(() => {
        finishAck();
      });
    },
    [stopAudio]
  );

  // Graceful Sleep Response when user says "Stop" or "Go to sleep"
  const playSleepResponse = useCallback(() => {
    stopAudio();
    stopRecording();
    setVoiceState('sleep');

    const sleepMsg: ChatMessage = {
      id: `assistant-sleep-${Date.now()}`,
      role: 'assistant',
      content: "Going to sleep. Say 'Hey' or 'Hey Vynzora AI' whenever you need me.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, sleepMsg]);

    const returnToStandby = () => {
      setVoiceState('standby');
      startWakeWordListening();
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance("Going to sleep. Say 'Hey' or 'Hey Vynzora AI' whenever you need me.");
      utter.rate = 1.0;
      utter.onend = returnToStandby;
      utter.onerror = returnToStandby;
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(returnToStandby, 800);
    }
  }, [stopAudio]);

  // ============================================================================
  // TEXT CHAT HANDLER
  // ============================================================================
  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputValue).trim();
      if (!text || isLoadingRef.current) return;

      // Check for sleep/stop commands
      if (SLEEP_WORD_REGEX.test(text)) {
        setInputValue('');
        playSleepResponse();
        return;
      }

      setErrorMessage(null);
      setInputValue('');
      setVoiceState('processing');

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.status !== 'success') {
          throw new Error(data.detail || 'Could not reach Vynzora AI Agent.');
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Synthesize voice reply if spoken or hands-free
        if (data.audio_base64) {
          playAudioBase64(data.audio_base64);
        } else {
          handleResponseAudioFinished();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'An error occurred while communicating with the agent.');
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ ' + (err.message || 'Unable to connect to AI Agent service.'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        handleResponseAudioFinished();
      } finally {
        setIsLoading(false);
      }
    },
    [inputValue, sessionId, playAudioBase64, playSleepResponse]
  );

  // ============================================================================
  // MULTILINGUAL VOICE HANDLER WITH AUTOMATIC SILENCE DETECTION (NO FINISH BUTTON)
  // ============================================================================
  const cleanupVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setLiveAudioLevel(0);
  }, []);

  const stopRecording = useCallback(() => {
    cleanupVAD();
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    setIsManualRecording(false);
  }, [cleanupVAD]);

  const processVoiceBlob = useCallback(
    async (audioBlob: Blob) => {
      // Avoid submitting empty recordings
      if (!audioBlob || audioBlob.size < 800 || !hasSpokenRef.current) {
        console.log('[Vynzora VAD] Discarding empty/silent recording.');
        isSubmittingRef.current = false;
        // If in conversation mode, return to standby gracefully
        if (voiceStateRef.current === 'conversation' || voiceStateRef.current === 'listening') {
          setVoiceState('standby');
          startWakeWordListening();
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setVoiceState('processing');

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        if (sessionId) {
          formData.append('session_id', sessionId);
        }

        const res = await fetch('/api/agent/voice', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok || data.status !== 'success') {
          if (data.status === 'unrecognized' || !data.transcript || data.transcript.trim() === '') {
            handleResponseAudioFinished();
            return;
          }
          throw new Error(data.detail || data.response || 'Voice recognition failed.');
        }

        // Check if user spoke a sleep command ("Stop" / "Go to sleep")
        if (SLEEP_WORD_REGEX.test(data.transcript.trim())) {
          playSleepResponse();
          return;
        }

        // Add user recognized speech (original Malayalam, Hindi, or English script)
        const userMessage: ChatMessage = {
          id: `user-voice-${Date.now()}`,
          role: 'user',
          content: data.transcript,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: data.detected_language,
          isVoiceInput: true,
        };

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: `assistant-voice-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: data.detected_language,
          audioBase64: data.audio_base64,
        };

        setMessages((prev) => [...prev, userMessage, assistantMessage]);

        // Automatically play synthesized gTTS audio
        if (data.audio_base64) {
          playAudioBase64(data.audio_base64);
        } else {
          handleResponseAudioFinished();
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Error processing voice.');
        setMessages((prev) => [
          ...prev,
          {
            id: `err-voice-${Date.now()}`,
            role: 'assistant',
            content: '⚠️ ' + (err.message || 'Voice processing error.'),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        handleResponseAudioFinished();
      } finally {
        setIsLoading(false);
        isSubmittingRef.current = false;
      }
    },
    [sessionId, playAudioBase64, playSleepResponse]
  );

  // Setup Voice Activity and Continuous Silence Detection (Section 8)
  const setupVAD = useCallback(
    (stream: MediaStream, onSilenceDetected: () => void, onInactivityTimeout: () => void) => {
      try {
        cleanupVAD();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        hasSpokenRef.current = false;
        let speechAccumulatedMs = 0;
        let silenceStartTime = 0;
        const startTime = Date.now();

        vadIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setLiveAudioLevel(Math.min(100, Math.round(avg * 2.5)));

          // Check if current volume corresponds to human speech
          if (avg >= SPEECH_VOLUME_THRESHOLD) {
            speechAccumulatedMs += 80;
            // User has genuinely begun speaking
            if (speechAccumulatedMs >= MIN_SPEECH_DURATION_MS) {
              hasSpokenRef.current = true;
              silenceStartTime = 0; // Reset silence counter while user continues speaking
            }
          } else if (hasSpokenRef.current) {
            // User was speaking, now paused or finished
            if (silenceStartTime === 0) {
              silenceStartTime = Date.now();
            } else if (Date.now() - silenceStartTime >= SILENCE_DURATION_MS) {
              // Exactly 1.8 seconds of continuous silence after speech detected!
              // Auto-stop recording and automatically submit without requiring button click
              clearInterval(vadIntervalRef.current);
              cleanupVAD();
              onSilenceDetected();
              return;
            }
          }

          // Safety timeout: max recording duration
          if (Date.now() - startTime >= MAX_RECORDING_TIMEOUT_MS) {
            clearInterval(vadIntervalRef.current);
            cleanupVAD();
            if (hasSpokenRef.current) {
              onSilenceDetected();
            } else {
              onInactivityTimeout();
            }
            return;
          }

          // If user triggered conversation mode but never spoke within inactivity window
          if (!hasSpokenRef.current && Date.now() - startTime >= INACTIVITY_TIMEOUT_MS) {
            clearInterval(vadIntervalRef.current);
            cleanupVAD();
            onInactivityTimeout();
            return;
          }
        }, 80);
      } catch (e) {
        console.warn('VAD initialization skipped:', e);
      }
    },
    [cleanupVAD]
  );

  // Start voice recording (supports automatic hands-free VAD and manual click mode)
  const startRecording = useCallback(
    async (isHandsFree = true) => {
      // Prevent duplicate microphone recording sessions
      if (isRecordingRef.current || isPlayingAudioRef.current) return;

      try {
        stopAudio();
        setErrorMessage(null);
        hasSpokenRef.current = false;
        isSubmittingRef.current = false;
        setIsManualRecording(!isHandsFree);
        setVoiceState(isHandsFree ? 'listening' : 'listening');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          cleanupVAD();
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());
          await processVoiceBlob(audioBlob);
        };

        mediaRecorder.start(200);
        setIsRecording(true);
        setRecordSeconds(0);

        recordTimerRef.current = setInterval(() => {
          setRecordSeconds((sec) => sec + 1);
        }, 1000);

        // Hands-free mode activates silence detection: no "Finish & Send" button click required!
        if (isHandsFree) {
          setupVAD(
            stream,
            () => {
              // Silence detected after speech -> automatically stop and send!
              if (!isSubmittingRef.current) {
                isSubmittingRef.current = true;
                stopRecording();
              }
            },
            () => {
              // User was silent -> do not submit empty audio, return to standby
              stopRecording();
              setVoiceState('standby');
              startWakeWordListening();
            }
          );
        }
      } catch (err: any) {
        console.error('Microphone access failed:', err);
        setErrorMessage('Microphone access denied. Please allow microphone permissions.');
        setIsRecording(false);
        setIsManualRecording(false);
        setVoiceState('standby');
        startWakeWordListening();
      }
    },
    [stopAudio, cleanupVAD, processVoiceBlob, setupVAD, stopRecording]
  );

  // ============================================================================
  // WAKE-WORD DETECTION ENGINE (Accepted: "Hey", "Hey Vynzora AI", "Vynzora AI")
  // ============================================================================
  const startWakeWordListening = useCallback(() => {
    if (
      !isWakeWordEnabledRef.current ||
      isPlayingAudioRef.current ||
      isRecordingRef.current ||
      isLoadingRef.current
    ) {
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser.');
      return;
    }

    try {
      if (wakeWordRecRef.current) {
        try {
          wakeWordRecRef.current.abort();
        } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        // Echo prevention: Strictly ignore any input while audio is playing or processing
        if (isPlayingAudioRef.current || isLoadingRef.current || isRecordingRef.current) {
          return;
        }

        // Section 9: Wake Word Must Control Activation
        // Only wake words trigger new voice conversations
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();

          if (WAKE_WORD_REGEX.test(transcript)) {
            console.log('[Wake Word Accepted]:', transcript);
            try {
              rec.abort();
            } catch {}

            handleWakeWordTriggered(transcript);
            break;
          }
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('Wake word listener status:', e.error);
        }
      };

      rec.onend = () => {
        // Automatically restart standby listening if still in standby state
        if (
          isWakeWordEnabledRef.current &&
          !isPlayingAudioRef.current &&
          !isRecordingRef.current &&
          !isLoadingRef.current &&
          voiceStateRef.current === 'standby'
        ) {
          setTimeout(() => {
            try {
              rec.start();
            } catch {}
          }, 350);
        }
      };

      rec.start();
      wakeWordRecRef.current = rec;
      setVoiceState('standby');
    } catch (err) {
      console.warn('Could not initialize wake-word recognition:', err);
    }
  }, []);

  const stopWakeWordListening = useCallback(() => {
    if (wakeWordRecRef.current) {
      try {
        wakeWordRecRef.current.abort();
      } catch {}
      wakeWordRecRef.current = null;
    }
  }, []);

  // Called when "Hey", "Hey Vynzora AI", or "Vynzora AI" is spoken
  const handleWakeWordTriggered = useCallback(
    (detectedTranscript: string) => {
      // 1. Activate assistant window
      setIsOpen(true);
      setIsMinimized(false);
      stopAudio();
      stopWakeWordListening();

      // Check if a question was spoken in the exact same phrase
      // (e.g. "Hey Vynzora AI, how many enquiries do we have?")
      const queryAfterWake = detectedTranscript.replace(WAKE_WORD_REGEX, '').trim();

      if (queryAfterWake.length >= 4) {
        // Direct query provided with wake word
        handleSendMessage(queryAfterWake);
        return;
      }

      // 2. Pure wake word detected -> Transition to Activated state & speak greeting:
      // "Hello! I'm listening. How can I help you?"
      setVoiceState('activated');
      playWakeAcknowledgement(() => {
        // 3. Immediately transition to Listening state and record hands-free with silence detection
        startRecording(true);
      });
    },
    [stopAudio, stopWakeWordListening, handleSendMessage, playWakeAcknowledgement, startRecording]
  );

  // Transition after assistant response audio completes
  // Preserves active conversation turn-taking so user can ask follow-ups without repeating "Hey"
  const handleResponseAudioFinished = useCallback(() => {
    if (!isWakeWordEnabledRef.current) {
      setVoiceState('disabled');
      return;
    }

    // State: Conversation (Waiting for next question naturally)
    setVoiceState('conversation');

    if (conversationInactivityTimerRef.current) {
      clearTimeout(conversationInactivityTimerRef.current);
    }

    // 9-second conversation turn-taking window
    conversationInactivityTimerRef.current = setTimeout(() => {
      // Inactivity: gracefully return to wake-word standby mode
      setVoiceState('standby');
      startWakeWordListening();
    }, INACTIVITY_TIMEOUT_MS);

    // Automatically begin hands-free listening with silence detection
    startRecording(true);
  }, [startWakeWordListening, startRecording]);

  // ============================================================================
  // AUTOMATIC INITIALIZATION ON ADMIN PAGE LOAD
  // ============================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;

    const initMicrophoneOnLoad = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          if (mounted) {
            setMicPermission('granted');
            startWakeWordListening();
          }
          return;
        }
      } catch (err: any) {
        console.log('[Vynzora AI] Mic prompt deferred or requires user gesture:', err.message);
        if (mounted) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setMicPermission('denied');
          } else {
            setMicPermission('prompt');
          }
        }

        // Gesture fallback: activate seamlessly on first user interaction anywhere
        const onFirstInteraction = async () => {
          window.removeEventListener('click', onFirstInteraction);
          window.removeEventListener('keydown', onFirstInteraction);
          window.removeEventListener('touchstart', onFirstInteraction);
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach((track) => track.stop());
            if (mounted) {
              setMicPermission('granted');
              startWakeWordListening();
            }
          } catch (e: any) {
            if (mounted && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
              setMicPermission('denied');
            }
          }
        };

        window.addEventListener('click', onFirstInteraction, { once: true });
        window.addEventListener('keydown', onFirstInteraction, { once: true });
        window.addEventListener('touchstart', onFirstInteraction, { once: true });
      }
    };

    initMicrophoneOnLoad();

    return () => {
      mounted = false;
      stopWakeWordListening();
    };
  }, [startWakeWordListening, stopWakeWordListening]);

  // Request microphone permission on manual user click if initially blocked
  const requestMicPermissionManually = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission('granted');
      startWakeWordListening();
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      setMicPermission('denied');
      setErrorMessage('Microphone permission is required for hands-free voice activation.');
    }
  };

  // Toggle Wake-Word hands-free activation
  const toggleWakeWord = () => {
    const nextVal = !isWakeWordEnabled;
    setIsWakeWordEnabled(nextVal);
    localStorage.setItem('vynzora_wake_word_enabled', String(nextVal));
    if (nextVal) {
      setVoiceState('standby');
      startWakeWordListening();
    } else {
      stopWakeWordListening();
      setVoiceState('disabled');
    }
  };

  const handleClearHistory = () => {
    stopAudio();
    stopRecording();
    setMessages([]);
    const newSid = 'vynzora-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('vynzora_ai_session_id', newSid);
    setSessionId(newSid);
    setVoiceState('standby');
    if (isWakeWordEnabled) {
      startWakeWordListening();
    }
  };

  return (
    <>
      {/* Floating Permission Prompt Banner (Only shown if browser blocked initial auto-request) */}
      {micPermission === 'prompt' && !isOpen && (
        <button
          onClick={requestMicPermissionManually}
          type="button"
          className="fixed bottom-28 right-6 z-50 px-3.5 py-2 rounded-2xl bg-slate-900/95 border border-brand-500/50 text-brand-200 text-xs shadow-2xl flex items-center gap-2 hover:bg-slate-800 transition-all cursor-pointer animate-bounce backdrop-blur-md"
          title="Click to enable automatic 'Hey Vynzora AI' hands-free voice detection"
        >
          <div className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
          <Mic className="w-3.5 h-3.5 text-brand-400" />
          <span className="font-semibold text-white">Enable Hands-Free Voice</span>
          <span className="text-[10px] text-slate-400">(Click once)</span>
        </button>
      )}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            if (isWakeWordEnabled && voiceState === 'disabled') {
              setVoiceState('standby');
              startWakeWordListening();
            }
          }}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-3 group border border-white/20 cursor-pointer"
          aria-label="Open Vynzora AI Business Assistant"
        >
          <div className="relative">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${
                voiceState === 'listening'
                  ? 'bg-amber-400 animate-ping'
                  : voiceState === 'speaking'
                  ? 'bg-purple-400 animate-pulse'
                  : voiceState === 'processing'
                  ? 'bg-cyan-400 animate-spin'
                  : backendStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-rose-400'
              }`}
            />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>Vynzora AI</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/20 font-mono">Agent Zora</span>
            </div>
            <div className="text-[10px] text-brand-100 flex items-center gap-1">
              <span>Intelligent Business Assistant</span>
            </div>
            {/* Subtle Voice Activation Standby Indicator */}
            {isWakeWordEnabled && (
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-emerald-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {voiceState === 'listening'
                    ? 'Listening... (Speak now)'
                    : voiceState === 'processing'
                    ? 'Processing speech...'
                    : voiceState === 'speaking'
                    ? 'Speaking response...'
                    : voiceState === 'conversation'
                    ? 'Turn-taking active (Speak naturally)'
                    : 'Say "Hey" or "Hey Vynzora AI"'}
                </span>
              </div>
            )}
          </div>
        </button>
      )}

      {/* Main Assistant Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col glass-panel border border-brand-500/30 rounded-3xl shadow-2xl shadow-slate-950/80 overflow-hidden transition-all duration-300 ${
            isMinimized
              ? 'w-80 h-16'
              : isExpanded
              ? 'w-[94vw] sm:w-[680px] h-[85vh] max-h-[800px]'
              : 'w-[92vw] sm:w-[460px] h-[78vh] max-h-[680px]'
          }`}
        >
          {/* Header */}
          <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-white shrink-0 select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-tight">Vynzora AI Assistant</span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                      backendStatus === 'online'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        backendStatus === 'online' ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
                      }`}
                    />
                    {backendStatus === 'online' ? 'Gemini 3.5' : 'Offline'}
                  </span>

                  {/* 7-State Visual Status Pill (Section 10) */}
                  <button
                    onClick={toggleWakeWord}
                    type="button"
                    title={
                      isWakeWordEnabled
                        ? 'Hands-Free "Hey" / "Hey Vynzora AI" is active. Click to disable.'
                        : 'Hands-Free is off. Click to enable "Hey Vynzora AI".'
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                      !isWakeWordEnabled
                        ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                        : voiceState === 'listening'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : voiceState === 'processing'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : voiceState === 'speaking'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : voiceState === 'activated'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                        : voiceState === 'conversation'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : voiceState === 'sleep'
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
                    }`}
                  >
                    {isWakeWordEnabled ? (
                      <>
                        <Radio className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
                        <span>
                          {voiceState === 'listening'
                            ? 'Listening...'
                            : voiceState === 'processing'
                            ? 'Processing...'
                            : voiceState === 'activated'
                            ? 'Activated'
                            : voiceState === 'speaking'
                            ? 'Speaking...'
                            : voiceState === 'conversation'
                            ? 'Turn-Taking Active'
                            : voiceState === 'sleep'
                            ? 'Sleeping'
                            : 'Standby: "Hey"'}
                        </span>
                      </>
                    ) : (
                      <>
                        <MicOff className="w-2.5 h-2.5" />
                        <span>Voice Wake: Off</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Multilingual CRM Intelligence • Malayalam • English • Hindi
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleClearHistory}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-900 transition-colors"
                title="Clear Conversation & Reset Session"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hidden sm:block p-1.5 rounded-lg hover:text-white hover:bg-slate-900 transition-colors"
                title={isExpanded ? 'Standard width' : 'Expand panel'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-900 transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={() => {
                  stopAudio();
                  stopRecording();
                  setIsOpen(false);
                  if (isWakeWordEnabled) {
                    setVoiceState('standby');
                    startWakeWordListening();
                  }
                }}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-900 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          {!isMinimized && (
            <>
              {/* Audio Playing Bar */}
              {isPlayingAudio && (
                <div className="px-4 py-2 bg-indigo-950/60 border-b border-indigo-900/60 flex items-center justify-between text-xs text-indigo-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-medium text-[11px]">
                      {voiceState === 'activated'
                        ? 'Vynzora AI: "Hello! I\'m listening. How can I help you?"'
                        : 'Speaking via gTTS...'}
                    </span>
                  </div>
                  <button
                    onClick={stopAudio}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold border border-rose-500/40"
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>Stop</span>
                  </button>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-2.5 bg-rose-950/70 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px]">{errorMessage}</span>
                  </div>
                  <button onClick={() => setErrorMessage(null)} className="p-0.5 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.length === 0 && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span>Welcome to Vynzora AI Business Assistant</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        ഹലോ! ഞാൻ വിൻസോറ AI ആണ്. നിങ്ങളുടെ CRM ഡാറ്റ പരിശോധിക്കാനും, കസ്റ്റമർ അന്വേഷണങ്ങൾ കണ്ടെത്താനും, പുതിയ കസ്റ്റമറെ ചേർക്കാനും എനിക്ക് സാധിക്കും.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        നിങ്ങൾക്ക് ടൈപ്പ് ചെയ്യുകയോ, അല്ലെങ്കിൽ &quot;Hey&quot; / &quot;Hey Vynzora AI&quot; എന്ന് സംസാരിച്ച് ചോദ്യങ്ങൾ ചോദിക്കുകയോ ചെയ്യാം.
                      </p>
                      {isWakeWordEnabled && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-indigo-300 font-mono">
                          <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
                          <span>Voice Activation: Say &quot;Hey&quot; or &quot;Hey Vynzora AI&quot; to wake up</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2 px-1">
                        Suggested Inquiries:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_PROMPTS.map((prompt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(prompt.text)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-brand-600/20 border border-slate-800 hover:border-brand-500/40 text-slate-300 hover:text-white text-xs transition-all text-left flex items-center gap-1.5 group cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 group-hover:scale-125 transition-transform" />
                            <span>{prompt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-md ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.isVoiceInput && (
                        <div className="flex items-center gap-1 text-[10px] text-brand-200 font-mono mb-1">
                          <Mic className="w-3 h-3 text-emerald-300" />
                          <span>Voice Input {msg.language ? `(${msg.language})` : ''}</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                      {msg.audioBase64 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2">
                          <button
                            onClick={() => playAudioBase64(msg.audioBase64!)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 text-[10px] font-semibold border border-brand-500/30 transition-colors"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Replay Audio</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl rounded-tl-none bg-slate-900/90 border border-slate-800 text-slate-400 text-xs max-w-[80%]">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-400" />
                    <span>
                      {isRecording
                        ? 'Listening to your speech...'
                        : 'Vynzora AI is thinking and querying Supabase...'}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Automatic Speech Detection Recording Bar (No Finish Button in Hands-Free Mode) */}
              {isRecording && (
                <div className="px-4 py-2.5 bg-slate-950/95 border-t border-brand-500/40 flex items-center justify-between text-xs text-brand-200">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <span>
                          {voiceState === 'conversation'
                            ? 'Listening for question...'
                            : 'Listening...'}
                        </span>
                        <span className="text-[10px] text-amber-300 font-mono">
                          (Auto-sends on 1.8s silence)
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Speak naturally; pause when finished or say &quot;Stop&quot;
                      </span>
                    </div>
                  </div>

                  {/* Manual click override if user manually initiated recording */}
                  {isManualRecording ? (
                    <button
                      onClick={stopRecording}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Finish & Send
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        stopRecording();
                        setVoiceState('standby');
                        startWakeWordListening();
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                      title="Cancel listening"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              {/* Input Bar (Preserved Manual Controls) */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : () => startRecording(false)}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Manual microphone record'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-brand-400" />}
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={
                    isRecording
                      ? 'Listening to microphone (pause when done)...'
                      : voiceState === 'activated'
                      ? 'Activating Vynzora AI...'
                      : voiceState === 'conversation'
                      ? 'Conversation active: ask question, or say "Stop"...'
                      : isWakeWordEnabled
                      ? 'Ask question, or say "Hey" / "Hey Vynzora AI"...'
                      : 'Ask in Malayalam, Hindi, or English...'
                  }
                  disabled={isLoading || isRecording}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || isRecording || !inputValue.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
