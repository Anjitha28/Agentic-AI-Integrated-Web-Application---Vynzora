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

// 10 Distinct Lifecycle States Supporting Real-Time Interruption (Barge-In)
export type AssistantVoiceState =
  | 'INITIALIZING' // 1. Initializing microphone and wake-word detector on page load
  | 'WAKE_WORD_STANDBY' // 2. Standby: Waiting for ONLY "Hey Zora"
  | 'ACTIVATED' // 3. Activated: "Hey Zora" detected, speaking greeting
  | 'LISTENING' // 4. Listening: Capturing user's question hands-free
  | 'USER_SPEAKING' // 5. User Speaking: User is actively speaking
  | 'SPEECH_DETECTED' // Alias for USER_SPEAKING
  | 'PROCESSING' // 6. Processing: Submitting audio to Sarvam STT -> Gemini -> gTTS
  | 'SPEAKING' // 7. Speaking: Playing AI voice response (interruptible in real-time)
  | 'INTERRUPTED' // 8. Interrupted: User spoke during AI speech; audio halted immediately
  | 'CONTINUOUS_LISTENING' // 9. Continuous Listening: Turn-taking active, hands-free
  | 'DISABLED'; // Voice activation explicitly turned off by user

// Natural Speech Detection Parameters
const SILENCE_DURATION_MS = 1400; // 1.4s of continuous natural silence after speech -> auto-submit immediately
const SPEECH_VOLUME_THRESHOLD = 14; // RMS amplitude threshold for human speech
const MIN_SPEECH_DURATION_MS = 250; // Minimum 250ms of speech before silence detection arms
const MAX_RECORDING_TIMEOUT_MS = 25000; // 25s max safety window per utterance

// Configurable Audio Priority & Real-Time Interruption (Barge-In) Parameters
const MIN_BARGE_IN_SNR_DB = 12; // Signal-to-noise ratio in dB above ambient noise required for speech
const MIN_BARGE_IN_RMS = 26; // Minimum absolute RMS amplitude required for speech
const MIN_VOICE_BAND_RATIO = 0.48; // At least 48% of spectral energy must reside in human vocal range (300Hz-3400Hz)
const MIN_BARGE_IN_SPEECH_DURATION_MS = 380; // User speech must be sustained for at least 380ms to avoid transient spikes/clicks
const SPEECH_CONFIDENCE_THRESHOLD = 0.55; // Web Speech confidence score required to interrupt

// Sleep/stop commands during active conversation
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

/**
 * Normalizes speech recognition raw text for robust, zero-latency wake-word matching:
 * - Lowercases text.
 * - Strips punctuation and symbols without eating spaces.
 * - Standardizes acronyms ("a.i.", "a. i.", "a i", "eye", "aye") -> "ai" preserving boundaries.
 * - Maps greeting prefix variations ("hay", "ay", "ey", "he", "eh") -> "hey".
 * - Maps phonetic/accent variations ("zorah", "zoro", "sora", "zara", "zura", "zola", "zoya", "jora", "xora", "czora", "torah") -> "zora".
 * - Normalizes multiple spaces to a single space.
 */
export function normalizeSpeechText(raw: string): string {
  if (!raw) return '';
  let text = raw.toLowerCase();

  // 1. Remove all punctuation and symbols first (preserving spaces)
  text = text.replace(/[,.?!\-_/\\:;"'~`()\[\]{}*#@^+=<>]/g, ' ');

  // 2. Normalize acronyms
  text = text.replace(/\ba\s*\.\s*i\b/g, 'ai');
  text = text.replace(/\ba\s+i\b/g, 'ai');
  text = text.replace(/\b(eye|aye)\b/g, 'ai');

  // 3. Normalize greeting prefix variations (hay, ay, ey, he, eh) -> hey
  text = text.replace(/\b(hay|ay|ey|he|eh)\b/g, 'hey');

  // 4. Normalize phonetic variations of zora:
  // zorah, zoro, sora, zara, zura, zola, zoya, jora, xora, czora, torah
  text = text.replace(/\b(zorah|zoro|sora|zara|zura|zola|zoya|jora|xora|czora|torah?)\b/g, 'zora');

  // 5. Collapse consecutive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Robust, low-latency wake-word matcher:
 * - Accepts ONLY the configured wake phrase: "Hey Zora" (and variations: "Hey Zorah", "Hey Zora AI", "ഹേയ് സോറ", "हाय ज़ोरा").
 * - Strictly rejects "Hey", "Hey Siri", "Siri", "Alexa", "Google", "Hey Vynzora AI", "Vynzora AI".
 * - Handles natural accents, pronunciation variations, and trailing queries.
 */
export function matchWakeWord(rawTranscript: string): {
  matched: boolean;
  phrase?: string;
  trailingQuery?: string;
  normalized?: string;
  reason?: string;
} {
  if (!rawTranscript) return { matched: false, reason: 'empty_transcript' };
  const normalized = normalizeSpeechText(rawTranscript);

  // Explicit negative check: strictly reject other voice assistants & prior wake words
  if (/\b(siri|hey siri|google|alexa|cortana|vynzora)\b/i.test(normalized)) {
    return { matched: false, normalized, reason: 'rejected_competing_assistant' };
  }

  // English wake pattern: 'hey zora' or 'hey zora ai'
  const wakePattern = /\bhey\s+zora(\s+ai)?\b/i;
  // Indic script pattern (Malayalam & Hindi, optionally with AI)
  const mlHiPattern = /(?:^|\s)(ഹേയ്\s*സോറ(\s*ai)?|ഹേ\s*സോറ(\s*ai)?|हाय\s*ज़ोरा(\s*ai)?|हे\s*ज़ोरा(\s*ai)?|हाय\s*जोरा(\s*ai)?|हे\s*जोरा(\s*ai)?)(?:$|\s)/i;

  let match = normalized.match(wakePattern);
  if (!match) {
    const padded = ` ${normalized} `;
    const mlMatch = padded.match(mlHiPattern);
    if (mlMatch) {
      const phrase = mlMatch[1].trim();
      const idx = normalized.indexOf(phrase);
      let trailingQuery = idx >= 0 ? normalized.slice(idx + phrase.length).trim() : '';
      trailingQuery = trailingQuery.replace(/^ai\b/i, '').trim();
      return { matched: true, phrase, trailingQuery, normalized };
    }
  } else if (match && match.index !== undefined) {
    const phrase = match[0].trim();
    const idxAfterWake = match.index + phrase.length;
    let trailingQuery = normalized.slice(idxAfterWake).trim();
    trailingQuery = trailingQuery.replace(/^ai\b/i, '').trim();
    return { matched: true, phrase, trailingQuery, normalized };
  }

  return { matched: false, normalized, reason: 'no_wake_phrase' };
}

/**
 * Detects whether incoming microphone transcription is self-echo from the
 * assistant's own TTS voice output playing through the room/laptop speakers.
 * Prevents the assistant from prematurely cutting itself off.
 */
export function isSelfEcho(incomingRaw: string, assistantSpokenText: string): boolean {
  if (!incomingRaw || !assistantSpokenText) return false;
  const incNorm = normalizeSpeechText(incomingRaw);
  const ttsNorm = normalizeSpeechText(assistantSpokenText);
  if (!incNorm || !ttsNorm) return false;

  // 1. Direct exact or substring inclusion
  if (ttsNorm.includes(incNorm)) {
    return true;
  }

  // 2. Word-level overlap: if the incoming words mostly match the assistant's speech
  const incWords = incNorm.split(/\s+/).filter((w) => w.length > 2);
  if (incWords.length === 0) return false;

  const ttsWords = new Set(ttsNorm.split(/\s+/));
  let matchCount = 0;
  for (const w of incWords) {
    if (ttsWords.has(w)) {
      matchCount++;
    }
  }

  const overlapRatio = matchCount / incWords.length;
  // If 70% or more of the words heard by the mic are words from the assistant's current utterance
  if (overlapRatio >= 0.70) {
    return true;
  }

  return false;
}

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

  // 8-State Voice Interaction State Management
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(true);
  const [voiceState, setVoiceState] = useState<AssistantVoiceState>('INITIALIZING');
  const [micPermission, setMicPermission] = useState<'granted' | 'prompt' | 'denied' | 'checking'>('checking');

  // Backend Health State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs for audio, DOM, and timers
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null); // Persistent MediaStream across questions
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const firstGreetingAudioRef = useRef<HTMLAudioElement | null>(null); // Preloaded "Hello! I'm Zora..."
  const ackGreetingAudioRef = useRef<HTMLAudioElement | null>(null); // Preloaded "Yes, I'm listening!..."

  // Request Tracking & Real-Time Barge-In Invalidation
  const currentRequestIdRef = useRef<number>(0);
  const hasHadFirstActivationRef = useRef<boolean>(false);
  const interruptionVadIntervalRef = useRef<any>(null);
  const startRecordingRef = useRef<((isHandsFree?: boolean) => Promise<void>) | undefined>(undefined);
  const stopRecordingRef = useRef<(() => void) | undefined>(undefined);
  const startWakeWordListeningRef = useRef<(() => void) | undefined>(undefined);
  const stopWakeWordListeningRef = useRef<(() => void) | undefined>(undefined);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const currentLanguageRef = useRef<string>('en-US');
  const handleSendMessageRef = useRef<((text?: string) => Promise<void>) | undefined>(undefined);
  const interimInterruptionTimerRef = useRef<any>(null);
  const interimInterruptionTextRef = useRef<string>('');

  // Audio Priority & Self-Echo Rejection Tracking
  const currentAssistantSpeechTextRef = useRef<string>(''); // Currently playing TTS text
  const acousticMetricsRef = useRef<{
    noiseFloor: number;
    currentRms: number;
    snr: number;
    voiceBandRatio: number;
    sustainedDurationMs: number;
  }>({
    noiseFloor: 16,
    currentRms: 0,
    snr: 0,
    voiceBandRatio: 0,
    sustainedDurationMs: 0,
  });

  // Refs for Hands-Free Wake-Word & VAD
  const wakeWordRecRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<any>(null);

  // High-Resolution Diagnostic Timing Refs (Section 5)
  const timingRef = useRef<{
    wakeListenStartedAt: number;
    activationStartedAt: number;
    micStartedAt: number;
    reqStartedAt: number;
    playStartedAt: number;
    playEndedAt: number;
  }>({
    wakeListenStartedAt: 0,
    activationStartedAt: 0,
    micStartedAt: 0,
    reqStartedAt: 0,
    playStartedAt: 0,
    playEndedAt: 0,
  });

  // Synchronous State Mirrors (avoids async React state lags)
  const isSubmittingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const voiceStateRef = useRef<AssistantVoiceState>('INITIALIZING');
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

    // Preload Zora's greeting audio files into memory for 0ms latency playback
    try {
      const g1 = new Audio('/audio/zora_first_greeting.mp3');
      g1.preload = 'auto';
      g1.load();
      firstGreetingAudioRef.current = g1;

      const g2 = new Audio('/audio/zora_ack_greeting.mp3');
      g2.preload = 'auto';
      g2.load();
      ackGreetingAudioRef.current = g2;
    } catch {}
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
      if (interruptionVadIntervalRef.current) {
        clearInterval(interruptionVadIntervalRef.current);
      }
      if (interimInterruptionTimerRef.current) {
        clearTimeout(interimInterruptionTimerRef.current);
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
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // AUDIO PLAYBACK & REAL-TIME VOICE INTERRUPTION (BARGE-IN)
  // ============================================================================
  const cleanupInterruptionVAD = useCallback(() => {
    if (interruptionVadIntervalRef.current) {
      clearInterval(interruptionVadIntervalRef.current);
      interruptionVadIntervalRef.current = null;
    }
  }, []);

  const stopAudio = useCallback(() => {
    cleanupInterruptionVAD();
    if (interimInterruptionTimerRef.current) {
      clearTimeout(interimInterruptionTimerRef.current);
      interimInterruptionTimerRef.current = null;
    }
    interimInterruptionTextRef.current = '';
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {}
      audioElementRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    isPlayingAudioRef.current = false;
    setIsPlayingAudio(false);
  }, [cleanupInterruptionVAD]);

  // Real-Time Barge-In Voice Interruption (Highest Priority)
  // Immediately stops current TTS playback, cancels remaining audio,
  // aborts active network requests, cancels backend Gemini/TTS,
  // and processes new user speech without forcing them to repeat.
  const interruptPlayback = useCallback(
    (reason = 'voice barge-in', capturedText?: string) => {
      console.log(`[Vynzora Diagnostic] Real-time Interruption triggered (${reason})! Halting playback immediately.`);

      // 1. Immediately abort active network fetch
      if (activeAbortControllerRef.current) {
        try {
          activeAbortControllerRef.current.abort();
        } catch {}
        activeAbortControllerRef.current = null;
      }

      // 2. Invalidate current and pending AI requests so stale responses never play
      currentRequestIdRef.current++;

      // 3. Immediately stop and reset audio playback
      stopAudio();

      // 4. Send cancellation notification to backend in background
      const sid = localStorage.getItem('vynzora_ai_session_id');
      if (sid) {
        fetch('/api/agent/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sid }),
        }).catch(() => {});
      }

      setVoiceState('INTERRUPTED');
      voiceStateRef.current = 'INTERRUPTED';

      // 5. If user spoke a complete question during interruption, process it immediately!
      // Do not make the user repeat their question!
      const trimmedText = capturedText ? capturedText.trim() : '';
      const isInterjection = /^(wait|hold\s+on|listen|pause|hello|നിൽക്കൂ|കേൾക്കൂ|ശരി|ശരി\s+മതി|മതി|रुको|सुनो)$/i.test(trimmedText);
      if (trimmedText && trimmedText.length >= 4 && !isInterjection) {
        console.log(`[Vynzora Diagnostic] Captured user interruption question directly: "${trimmedText}"`);
        if (handleSendMessageRef.current) {
          handleSendMessageRef.current(trimmedText);
          return;
        }
      }

      // 6. Otherwise immediately activate microphone hands-free to capture ongoing speech
      setTimeout(() => {
        if (isWakeWordEnabledRef.current) {
          startRecordingRef.current?.(true);
        }
      }, 40);
    },
    [stopAudio]
  );

  // Adaptive acoustic Voice Activity Detector & SNR Tracker during speech playback
  const setupInterruptionVAD = useCallback(
    (stream: MediaStream) => {
      try {
        cleanupInterruptionVAD();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx || !stream.active) return;

        const audioCtx =
          audioContextRef.current && audioContextRef.current.state !== 'closed'
            ? audioContextRef.current
            : new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let sustainedVoiceMs = 0;
        let ambientNoiseFloor = 16;

        interruptionVadIntervalRef.current = setInterval(() => {
          if (!isPlayingAudioRef.current) {
            cleanupInterruptionVAD();
            return;
          }

          analyser.getByteFrequencyData(dataArray);

          // 1. Overall acoustic energy
          let sumTotal = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sumTotal += dataArray[i];
          }
          const avgTotal = sumTotal / dataArray.length;

          // 2. Human vocal band energy (approx 300Hz - 3400Hz, bins 3 to 36 with 512 FFT at 48kHz)
          let voiceBandSum = 0;
          for (let i = 3; i <= 36; i++) {
            voiceBandSum += dataArray[i];
          }
          const voiceBandAvg = voiceBandSum / 34;
          const voiceBandRatio = voiceBandAvg / (avgTotal || 1);

          // 3. Track ambient noise floor (clamped below speech levels so speaker audio doesn't inflate baseline)
          if (avgTotal < ambientNoiseFloor) {
            ambientNoiseFloor = ambientNoiseFloor * 0.85 + avgTotal * 0.15;
          } else if (avgTotal < 22) {
            // Only drift noise floor when audio is genuinely low ambient background
            ambientNoiseFloor = ambientNoiseFloor * 0.98 + avgTotal * 0.02;
          }

          // 4. Signal-to-Noise Ratio (difference over ambient baseline)
          const snr = Math.max(0, avgTotal - ambientNoiseFloor);

          // 5. Genuine human speech profile:
          // User speaking into mic creates loud voice energy in vocal band
          const isHumanVocal =
            avgTotal >= MIN_BARGE_IN_RMS &&
            snr >= MIN_BARGE_IN_SNR_DB &&
            voiceBandRatio >= MIN_VOICE_BAND_RATIO;

          if (isHumanVocal) {
            sustainedVoiceMs += 50;
            // If sustained loud human voice into microphone for >= 350ms during playback:
            // Immediate acoustic barge-in trigger!
            if (sustainedVoiceMs >= MIN_BARGE_IN_SPEECH_DURATION_MS) {
              console.log(
                `[Vynzora Diagnostic] Acoustic human voice confirmed during playback (RMS: ${Math.round(avgTotal)}, SNR: ${Math.round(snr)}dB, Ratio: ${Math.round(voiceBandRatio * 100)}%)! Interrupting.`
              );
              cleanupInterruptionVAD();
              interruptPlayback('acoustic human voice barge-in');
              return;
            }
          } else {
            sustainedVoiceMs = Math.max(0, sustainedVoiceMs - 35);
          }

          acousticMetricsRef.current = {
            noiseFloor: ambientNoiseFloor,
            currentRms: avgTotal,
            snr,
            voiceBandRatio,
            sustainedDurationMs: sustainedVoiceMs,
          };
        }, 50);
      } catch (e: any) {
        console.warn('[Vynzora Diagnostic] Could not setup interruption VAD:', e.message || e);
      }
    },
    [cleanupInterruptionVAD, interruptPlayback]
  );

  // Transition after assistant response audio completes
  // User asks -> Agent responds -> Automatically restart listening -> User asks again
  const handleResponseAudioFinished = useCallback(() => {
    cleanupInterruptionVAD();
    currentAssistantSpeechTextRef.current = '';
    if (!isWakeWordEnabledRef.current) {
      setVoiceState('DISABLED');
      voiceStateRef.current = 'DISABLED';
      return;
    }

    console.log('[Vynzora Diagnostic] Listening restarted: Ready for next user question');
    setVoiceState('CONTINUOUS_LISTENING');
    voiceStateRef.current = 'CONTINUOUS_LISTENING';

    // Automatically begin hands-free listening for next question with silence detection
    startRecordingRef.current?.(true);
  }, [cleanupInterruptionVAD]);

  // Play audio from base64 string with onEnded callback & complete delivery guarantee
  const playAudioBase64 = useCallback(
    (base64Audio: string, onEnded?: () => void, textSpoken?: string) => {
      try {
        stopAudio();
        const activeRequestId = currentRequestIdRef.current;
        currentAssistantSpeechTextRef.current = textSpoken || '';

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

        isPlayingAudioRef.current = true;
        setIsPlayingAudio(true);
        setVoiceState('SPEAKING');
        voiceStateRef.current = 'SPEAKING';

        timingRef.current.playStartedAt = performance.now();
        console.log(
          `[Vynzora Diagnostic] Voice playback started (${textSpoken ? `"${textSpoken.slice(0, 70)}..."` : 'audio'}) - Complete playback prioritized`
        );

        // Enable acoustic interruption detection while audio is playing
        if (mediaStreamRef.current && mediaStreamRef.current.active) {
          setupInterruptionVAD(mediaStreamRef.current);
        }

        const finishPlayback = () => {
          cleanupInterruptionVAD();
          currentAssistantSpeechTextRef.current = '';
          if (activeRequestId !== currentRequestIdRef.current) {
            console.log('[Vynzora Diagnostic] Request was interrupted, discarding finish callback');
            return;
          }
          timingRef.current.playEndedAt = performance.now();
          const duration = Math.round(timingRef.current.playEndedAt - timingRef.current.playStartedAt);
          console.log(`[Vynzora Diagnostic] Complete voice response delivered successfully in ${duration}ms`);
          isPlayingAudioRef.current = false;
          setIsPlayingAudio(false);
          // 250ms acoustic buffer
          setTimeout(() => {
            if (activeRequestId !== currentRequestIdRef.current) return;
            if (onEnded) {
              onEnded();
            } else {
              handleResponseAudioFinished();
            }
          }, 250);
        };

        audio.onended = finishPlayback;

        audio.onerror = (e) => {
          console.error('[Vynzora Diagnostic] Audio element playback error:', e);
          cleanupInterruptionVAD();
          currentAssistantSpeechTextRef.current = '';
          isPlayingAudioRef.current = false;
          setIsPlayingAudio(false);
          handleResponseAudioFinished();
        };

        audio.play().catch((err) => {
          console.warn('[Vynzora Diagnostic] Audio playback interrupted or blocked:', err);
          cleanupInterruptionVAD();
          currentAssistantSpeechTextRef.current = '';
          isPlayingAudioRef.current = false;
          setIsPlayingAudio(false);
          handleResponseAudioFinished();
        });
      } catch (e) {
        console.error('[Vynzora Diagnostic] Failed to play audio:', e);
        cleanupInterruptionVAD();
        currentAssistantSpeechTextRef.current = '';
        isPlayingAudioRef.current = false;
        setIsPlayingAudio(false);
        handleResponseAudioFinished();
      }
    },
    [stopAudio, cleanupInterruptionVAD, setupInterruptionVAD, handleResponseAudioFinished]
  );

  // Play Preloaded Wake Greeting:
  // First activation: "Hello! I'm Zora, your Vynzora AI assistant. How can I help you today?"
  // Subsequent activation during active conversation: "Yes, I'm listening! How can I help?"
  const playWakeGreeting = useCallback(
    (isFirstActivation: boolean, onComplete: () => void) => {
      stopAudio();
      const activeRequestId = ++currentRequestIdRef.current;
      setVoiceState('ACTIVATED');
      voiceStateRef.current = 'ACTIVATED';
      isPlayingAudioRef.current = true;
      setIsPlayingAudio(true);

      const greetingText = isFirstActivation
        ? "Hello! I'm Zora, your Vynzora AI assistant. How can I help you today?"
        : "Yes, I'm listening! How can I help?";
      currentAssistantSpeechTextRef.current = greetingText;

      console.log(`[Vynzora Diagnostic] Playing wake greeting (first: ${isFirstActivation}): "${greetingText}"`);

      // Add greeting to chat message history
      const greetingMessage: ChatMessage = {
        id: `assistant-greeting-${Date.now()}`,
        role: 'assistant',
        content: greetingText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, greetingMessage]);

      const finishGreeting = () => {
        cleanupInterruptionVAD();
        currentAssistantSpeechTextRef.current = '';
        if (activeRequestId !== currentRequestIdRef.current) return;
        isPlayingAudioRef.current = false;
        setIsPlayingAudio(false);
        setTimeout(() => {
          if (activeRequestId !== currentRequestIdRef.current) return;
          onComplete();
        }, 200);
      };

      const audioSrc = isFirstActivation
        ? '/audio/zora_first_greeting.mp3'
        : '/audio/zora_ack_greeting.mp3';

      let audio = isFirstActivation ? firstGreetingAudioRef.current : ackGreetingAudioRef.current;
      if (!audio) {
        audio = new Audio(audioSrc);
        if (isFirstActivation) firstGreetingAudioRef.current = audio;
        else ackGreetingAudioRef.current = audio;
      }

      audioElementRef.current = audio;
      audio.currentTime = 0;
      audio.onended = finishGreeting;
      audio.onerror = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(greetingText);
          utter.rate = 1.0;
          utter.onend = finishGreeting;
          utter.onerror = finishGreeting;
          window.speechSynthesis.speak(utter);
        } else {
          finishGreeting();
        }
      };

      if (mediaStreamRef.current && mediaStreamRef.current.active) {
        setupInterruptionVAD(mediaStreamRef.current);
      }

      audio.play().catch(() => {
        finishGreeting();
      });
    },
    [stopAudio, cleanupInterruptionVAD, setupInterruptionVAD]
  );

  // Graceful Sleep Response when user says "Stop" or "Go to sleep"
  const playSleepResponse = useCallback(() => {
    stopAudio();
    if (stopRecordingRef.current) {
      stopRecordingRef.current();
    }
    setVoiceState('WAKE_WORD_STANDBY');
    voiceStateRef.current = 'WAKE_WORD_STANDBY';

    const sleepMsg: ChatMessage = {
      id: `assistant-sleep-${Date.now()}`,
      role: 'assistant',
      content: "Going to sleep. Say 'Hey Zora' whenever you need me.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, sleepMsg]);

    const returnToStandby = () => {
      setVoiceState('WAKE_WORD_STANDBY');
      voiceStateRef.current = 'WAKE_WORD_STANDBY';
      if (startWakeWordListeningRef.current) {
        startWakeWordListeningRef.current();
      }
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance("Going to sleep. Say 'Hey Zora' whenever you need me.");
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

      // Detect language script: Malayalam, Hindi, or English
      if (/[\u0D00-\u0D7F]/.test(text)) {
        currentLanguageRef.current = 'ml-IN';
      } else if (/[\u0900-\u097F]/.test(text)) {
        currentLanguageRef.current = 'hi-IN';
      } else {
        currentLanguageRef.current = 'en-US';
      }

      // Check for sleep/stop commands
      if (SLEEP_WORD_REGEX.test(text)) {
        setInputValue('');
        playSleepResponse();
        return;
      }

      // Abort previous active in-flight request if any
      if (activeAbortControllerRef.current) {
        try {
          activeAbortControllerRef.current.abort();
        } catch {}
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      const requestId = ++currentRequestIdRef.current;
      setErrorMessage(null);
      setInputValue('');
      setVoiceState('PROCESSING');
      voiceStateRef.current = 'PROCESSING';

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, userMessage]);
      isLoadingRef.current = true;
      setIsLoading(true);
      timingRef.current.reqStartedAt = performance.now();
      console.log(`[Vynzora Diagnostic] AI request started (#${requestId}): "${text}"`);

      try {
        const res = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
          }),
        });

        const data = await res.json();

        // Stale response check: discard if user interrupted while request was in-flight
        if (requestId !== currentRequestIdRef.current) {
          console.log(`[Vynzora Diagnostic] Discarding stale response for interrupted request #${requestId}`);
          return;
        }

        if (!res.ok || data.status !== 'success') {
          throw new Error(data.detail || 'Could not reach Vynzora AI Agent.');
        }

        const duration = Math.round(performance.now() - timingRef.current.reqStartedAt);
        console.log(`[Vynzora Diagnostic] AI response received in ${duration}ms: "${data.response.slice(0, 100)}..."`);

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Synthesize voice reply if spoken or hands-free
        if (data.audio_base64) {
          playAudioBase64(data.audio_base64, () => handleResponseAudioFinished(), data.response);
        } else {
          handleResponseAudioFinished();
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log(`[Vynzora Diagnostic] In-flight AI chat request #${requestId} aborted cleanly on interruption`);
          return;
        }
        if (requestId !== currentRequestIdRef.current) return;
        console.error('[Vynzora Diagnostic] AI chat error:', err.message || err);
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
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
        if (requestId === currentRequestIdRef.current) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [inputValue, sessionId, playAudioBase64, playSleepResponse, handleResponseAudioFinished]
  );
  handleSendMessageRef.current = handleSendMessage;

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
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsManualRecording(false);
  }, [cleanupVAD]);
  stopRecordingRef.current = stopRecording;

  const processVoiceBlob = useCallback(
    async (audioBlob: Blob) => {
      // Avoid submitting empty recordings without speech
      if (!audioBlob || audioBlob.size < 800 || !hasSpokenRef.current) {
        console.log('[Vynzora Diagnostic] No speech detected in buffer, maintaining continuous listening session');
        isSubmittingRef.current = false;
        isRecordingRef.current = false;
        setIsRecording(false);

        // In continuous listening mode: resume seamlessly without sleep
        if (
          isWakeWordEnabledRef.current &&
          (voiceStateRef.current === 'CONTINUOUS_LISTENING' || voiceStateRef.current === 'LISTENING')
        ) {
          setTimeout(() => {
            startRecording(true);
          }, 200);
        }
        return;
      }

      // Abort previous active in-flight request if any
      if (activeAbortControllerRef.current) {
        try {
          activeAbortControllerRef.current.abort();
        } catch {}
      }
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      const requestId = ++currentRequestIdRef.current;
      isLoadingRef.current = true;
      setIsLoading(true);
      setErrorMessage(null);
      setVoiceState('PROCESSING');
      voiceStateRef.current = 'PROCESSING';
      timingRef.current.reqStartedAt = performance.now();
      console.log(`[Vynzora Diagnostic] AI voice request started (#${requestId}): Sending audio blob to /api/agent/voice`);

      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        if (sessionId) {
          formData.append('session_id', sessionId);
        }

        const res = await fetch('/api/agent/voice', {
          method: 'POST',
          signal: controller.signal,
          body: formData,
        });

        const data = await res.json();

        // Stale response check: discard if user interrupted while request was in-flight
        if (requestId !== currentRequestIdRef.current) {
          console.log(`[Vynzora Diagnostic] Discarding voice response for interrupted request #${requestId}`);
          return;
        }

        if (!res.ok || data.status !== 'success') {
          if (data.status === 'unrecognized' || !data.transcript || data.transcript.trim() === '') {
            console.log('[Vynzora Diagnostic] Speech unrecognized by STT, resuming continuous listening');
            handleResponseAudioFinished();
            return;
          }
          throw new Error(data.detail || data.response || 'Voice recognition failed.');
        }

        // Dynamically update language from detected language
        if (data.detected_language === 'ml' || data.detected_language === 'ml-IN') {
          currentLanguageRef.current = 'ml-IN';
        } else if (data.detected_language === 'hi' || data.detected_language === 'hi-IN') {
          currentLanguageRef.current = 'hi-IN';
        } else if (data.detected_language === 'en' || data.detected_language === 'en-US') {
          currentLanguageRef.current = 'en-US';
        }

        const duration = Math.round(performance.now() - timingRef.current.reqStartedAt);
        console.log(`[Vynzora Diagnostic] Speech recognition + AI response received in ${duration}ms`);
        console.log(`[Vynzora Diagnostic] Transcript generated: "${data.transcript}" (Language: ${data.detected_language})`);
        console.log(`[Vynzora Diagnostic] AI response received: "${data.response.slice(0, 100)}..."`);

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

        // Automatically play synthesized gTTS audio (barge-in enabled)
        if (data.audio_base64) {
          playAudioBase64(data.audio_base64, () => {
            handleResponseAudioFinished();
          }, data.response);
        } else {
          handleResponseAudioFinished();
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log(`[Vynzora Diagnostic] In-flight AI voice request #${requestId} aborted cleanly on interruption`);
          return;
        }
        if (requestId !== currentRequestIdRef.current) return;
        console.error('[Vynzora Diagnostic] Error processing voice:', err.message || err);
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
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
        if (requestId === currentRequestIdRef.current) {
          isLoadingRef.current = false;
          setIsLoading(false);
          isSubmittingRef.current = false;
        }
      }
    },
    [sessionId, playAudioBase64, playSleepResponse, handleResponseAudioFinished]
  );

  // Setup Voice Activity and Continuous Silence Detection
  const setupVAD = useCallback(
    (stream: MediaStream, onSilenceDetected: () => void, onRecycleBuffer: () => void) => {
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
            if (speechAccumulatedMs >= MIN_SPEECH_DURATION_MS) {
              if (!hasSpokenRef.current) {
                console.log(`[Vynzora Diagnostic] User speech detected (level: ${Math.round(avg)})`);
                setVoiceState('USER_SPEAKING');
                voiceStateRef.current = 'USER_SPEAKING';
              }
              hasSpokenRef.current = true;
              silenceStartTime = 0; // Reset silence counter while user continues speaking
            }
          } else if (hasSpokenRef.current) {
            // User was speaking, now paused or finished
            if (silenceStartTime === 0) {
              silenceStartTime = Date.now();
            } else if (Date.now() - silenceStartTime >= SILENCE_DURATION_MS) {
              // Exactly 1.4 seconds of continuous silence after speech detected!
              clearInterval(vadIntervalRef.current);
              cleanupVAD();
              onSilenceDetected();
              return;
            }
          }

          // Safety timeout: max recording duration per utterance
          if (Date.now() - startTime >= MAX_RECORDING_TIMEOUT_MS) {
            clearInterval(vadIntervalRef.current);
            cleanupVAD();
            if (hasSpokenRef.current) {
              onSilenceDetected();
            } else {
              // Recycle buffer without interrupting continuous listening session
              onRecycleBuffer();
            }
            return;
          }
        }, 80);
      } catch (e: any) {
        console.warn('[Vynzora Diagnostic] VAD initialization warning:', e.message || e);
      }
    },
    [cleanupVAD]
  );

  // Start voice recording (supports automatic hands-free VAD and manual click mode)
  const startRecording = useCallback(
    async (isHandsFree = true) => {
      // Prevent duplicate microphone recording sessions
      if (isRecordingRef.current || isPlayingAudioRef.current) {
        return;
      }

      try {
        stopAudio();
        setErrorMessage(null);
        hasSpokenRef.current = false;
        isSubmittingRef.current = false;
        setIsManualRecording(!isHandsFree);

        const targetState = isHandsFree
          ? voiceStateRef.current === 'CONTINUOUS_LISTENING'
            ? 'CONTINUOUS_LISTENING'
            : 'LISTENING'
          : 'LISTENING';
        setVoiceState(targetState);
        voiceStateRef.current = targetState;

        timingRef.current.micStartedAt = performance.now();

        // Persistent MediaStream: reuse existing live stream if available (0ms latency!)
        let stream = mediaStreamRef.current;
        if (!stream || !stream.active || stream.getAudioTracks().every((t) => t.readyState === 'ended')) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
        }

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
          // If in hands-free mode and no genuine human speech was confirmed, recycle buffer without submitting empty audio
          if (!hasSpokenRef.current && isHandsFree) {
            console.log(
              '[Vynzora Diagnostic] No genuine user speech in recording buffer; recycling continuous listening session'
            );
            audioChunksRef.current = [];
            isRecordingRef.current = false;
            setIsRecording(false);
            if (
              isWakeWordEnabledRef.current &&
              (voiceStateRef.current === 'CONTINUOUS_LISTENING' || voiceStateRef.current === 'LISTENING')
            ) {
              setTimeout(() => {
                startRecordingRef.current?.(true);
              }, 150);
            }
            return;
          }
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          // Note: DO NOT stop audio tracks! Keep mediaStreamRef.current alive for continuous interaction!
          await processVoiceBlob(audioBlob);
        };

        mediaRecorder.start(200);
        isRecordingRef.current = true;
        setIsRecording(true);
        setRecordSeconds(0);

        const micLatency = Math.round(performance.now() - timingRef.current.micStartedAt);
        console.log(`[Vynzora Diagnostic] Microphone activated and recording started in ${micLatency}ms (hands-free: ${isHandsFree})`);

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
                console.log('[Vynzora Diagnostic] Recording completed (silence detected after speech)');
                stopRecording();
              }
            },
            () => {
              // 25s buffer recycling in continuous listening: restart recorder cleanly without sleeping
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                try {
                  mediaRecorderRef.current.stop();
                } catch {}
              }
            }
          );
        }
      } catch (err: any) {
        console.error('[Vynzora Diagnostic] Microphone access failed:', err.message || err);
        setErrorMessage('Microphone access denied: ' + (err.message || 'Please check microphone permissions.'));
        isRecordingRef.current = false;
        setIsRecording(false);
        setIsManualRecording(false);
        setVoiceState('WAKE_WORD_STANDBY');
        voiceStateRef.current = 'WAKE_WORD_STANDBY';
        startWakeWordListeningRef.current?.();
      }
    },
    [stopAudio, cleanupVAD, processVoiceBlob, setupVAD, stopRecording]
  );
  startRecordingRef.current = startRecording;

  // Stop wake-word listening
  const stopWakeWordListening = useCallback(() => {
    if (wakeWordRecRef.current) {
      try {
        wakeWordRecRef.current.abort();
      } catch {}
      wakeWordRecRef.current = null;
      console.log('[Vynzora Diagnostic] Wake-word listening stopped');
    }
  }, []);
  stopWakeWordListeningRef.current = stopWakeWordListening;

  // Called when "Hey Zora" is spoken
  const handleWakeWordTriggered = useCallback(
    (detectedTranscript: string) => {
      timingRef.current.activationStartedAt = performance.now();

      // If AI is currently speaking, user saying "Hey Zora" is a barge-in interruption!
      if (isPlayingAudioRef.current) {
        console.log('[Vynzora Diagnostic] "Hey Zora" spoken during playback -> Barge-in trigger!');
        stopAudio();
      }

      // 1. Immediately activate assistant window & update state
      setIsOpen(true);
      setIsMinimized(false);
      stopAudio();
      stopWakeWordListening();

      // Check if a question was spoken in the exact same phrase
      // (e.g. "Hey Zora, how many enquiries do we have?")
      const wakeMatch = matchWakeWord(detectedTranscript);
      let queryAfterWake = wakeMatch.trailingQuery?.trim() || '';
      queryAfterWake = queryAfterWake.replace(/^(ai|a\s+i)\b/i, '').trim();

      if (queryAfterWake.length >= 4) {
        // Direct query provided with wake word
        console.log(`[Vynzora Diagnostic] Direct query captured with wake word: "${queryAfterWake}"`);
        hasHadFirstActivationRef.current = true;
        handleSendMessage(queryAfterWake);
        return;
      }

      // 2. Pure wake word detected:
      // First activation: "Hello! I'm Zora, your Vynzora AI assistant. How can I help you today?"
      // Subsequent activation: "Yes, I'm listening! How can I help?"
      const isFirst = !hasHadFirstActivationRef.current;
      hasHadFirstActivationRef.current = true;

      setVoiceState('ACTIVATED');
      voiceStateRef.current = 'ACTIVATED';
      const actLatency = Math.round(performance.now() - timingRef.current.activationStartedAt);
      console.log(`[Vynzora Diagnostic] Assistant activated in ${actLatency}ms (first: ${isFirst})`);

      playWakeGreeting(isFirst, () => {
        // 3. Immediately transition to Listening state and record hands-free with silence detection
        console.log('[Vynzora Diagnostic] Greeting finished, transitioning to listening');
        startRecording(true);
      });
    },
    [stopAudio, stopWakeWordListening, handleSendMessage, playWakeGreeting, startRecording]
  );

  // ============================================================================
  // WAKE-WORD DETECTION ENGINE (Ultra-responsive interim matching + top alternatives)
  // ============================================================================
  const startWakeWordListening = useCallback(() => {
    if (
      !isWakeWordEnabledRef.current ||
      isRecordingRef.current ||
      isLoadingRef.current
    ) {
      console.log(
        `[Vynzora Diagnostic] startWakeWordListening skipped (enabled: ${isWakeWordEnabledRef.current}, rec: ${isRecordingRef.current}, loading: ${isLoadingRef.current})`
      );
      return;
    }

    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[Vynzora Diagnostic] Web Speech API not supported in this browser.');
      return;
    }

    try {
      if (wakeWordRecRef.current) {
        try {
          wakeWordRecRef.current.abort();
        } catch {}
        wakeWordRecRef.current = null;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3; // Inspect top 3 speech recognition alternatives for accents
      rec.lang = currentLanguageRef.current || 'en-US';

      timingRef.current.wakeListenStartedAt = performance.now();

      rec.onstart = () => {
        console.log('[Vynzora Diagnostic] SpeechRecognition engine started (listening for ONLY "Hey Zora")');
      };

      rec.onaudiostart = () => {
        console.log('[Vynzora Diagnostic] Microphone audio capture active in speech engine');
      };

      rec.onspeechstart = () => {
        console.log('[Vynzora Diagnostic] User speech detected on microphone');
      };

      rec.onspeechend = () => {
        console.log('[Vynzora Diagnostic] User speech ended on microphone');
      };

      rec.onaudioend = () => {
        console.log('[Vynzora Diagnostic] Audio stream paused in speech engine');
      };

      rec.onresult = (event: any) => {
        // Echo prevention: Ignore during active recording or background AI request processing
        if (isLoadingRef.current || isRecordingRef.current) {
          return;
        }

        // Real-Time Barge-In Detection: User speaking while AI is speaking
        // Full voice response delivery is prioritized. Interruption occurs ONLY when:
        // 1. Incoming speech is NOT self-echo from assistant's own TTS output.
        // 2. Clear human voice is recognized with high confidence and meaningful content.
        // 3. Acoustic VAD confirms energy in human vocal band (300Hz-3400Hz) with high SNR.
        if (isPlayingAudioRef.current) {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            for (let a = 0; a < event.results[i].length; a++) {
              const rawTranscript = event.results[i][a].transcript;
              const confidence = event.results[i][a].confidence;
              if (!rawTranscript || !rawTranscript.trim()) continue;

              const trimmed = rawTranscript.trim();
              const isFinal = event.results[i].isFinal;

              // 1. Filter out self-echo (assistant's own TTS playing out of room/device speakers)
              if (isSelfEcho(trimmed, currentAssistantSpeechTextRef.current)) {
                console.log(
                  `[Vynzora Diagnostic] Discarding self-echo from assistant voice playback: "${trimmed}"`
                );
                continue;
              }

              // 2. Explicit Wake Word Check ("Hey Zora" / "Hey Zorah")
              const wakeCheck = matchWakeWord(trimmed);
              if (wakeCheck.matched) {
                console.log(`[Vynzora Diagnostic] "Hey Zora" wake-word interruption during playback: "${trimmed}"`);
                try {
                  rec.abort();
                } catch {}
                wakeWordRecRef.current = null;
                handleWakeWordTriggered(trimmed);
                return;
              }

              // 3. Explicit Sleep / Stop Command Check ("Stop", "Sleep", "Cancel", "മതി", "ശരി മതി", "रुको")
              if (SLEEP_WORD_REGEX.test(trimmed)) {
                console.log(`[Vynzora Diagnostic] Sleep command interruption during playback: "${trimmed}"`);
                try {
                  rec.abort();
                } catch {}
                wakeWordRecRef.current = null;
                playSleepResponse();
                return;
              }

              // 4. Genuine User Speech Interruption Validation:
              // Condition A: Speech Confidence Verification
              if (confidence !== undefined && confidence > 0 && confidence < SPEECH_CONFIDENCE_THRESHOLD) {
                console.log(
                  `[Vynzora Diagnostic] Interruption rejected: Low confidence (${confidence.toFixed(2)} < ${SPEECH_CONFIDENCE_THRESHOLD}): "${trimmed}"`
                );
                continue;
              }

              // Condition B: Minimum meaningful phrase length / recognized command word
              // Filters out brief noises or one-letter clicks like "a", "oh", "um", "the", etc.
              const words = trimmed.split(/\s+/).filter(Boolean);
              const isCommandWord = /^(wait|stop|listen|cancel|hello|help|pause|നിൽക്കൂ|കേൾക്കൂ|ശരി|മതി|ശരി\s+മതി|रुको|सुनो)$/i.test(
                trimmed
              );
              if (words.length < 2 && !isCommandWord) {
                console.log(`[Vynzora Diagnostic] Interruption rejected: Fragmentary noise/single-word: "${trimmed}"`);
                continue;
              }

              // Condition C: Acoustic Signal-to-Noise Ratio & Vocal Band Verification
              const metrics = acousticMetricsRef.current;
              if (metrics.snr < 10 && metrics.currentRms < 28) {
                console.log(
                  `[Vynzora Diagnostic] Interruption rejected: Insufficient voice SNR (${metrics.snr.toFixed(1)} dB < 10 dB): "${trimmed}"`
                );
                continue;
              }

              // ALL CONDITIONS SATISFIED: Genuine human speech interruption confirmed!
              console.log(
                `[Vynzora Diagnostic] Confirmed genuine user voice interruption: "${trimmed}" (isFinal: ${isFinal}, SNR: ${metrics.snr.toFixed(1)} dB, Ratio: ${(metrics.voiceBandRatio * 100).toFixed(0)}%, Confidence: ${confidence !== undefined ? confidence.toFixed(2) : 'N/A'})`
              );

              // 1. Immediately silence TTS playback so agent stops talking over user
              stopAudio();

              // 2. Abort active network request & signal backend cancel
              if (activeAbortControllerRef.current) {
                try {
                  activeAbortControllerRef.current.abort();
                } catch {}
                activeAbortControllerRef.current = null;
              }
              const sid = localStorage.getItem('vynzora_ai_session_id');
              if (sid) {
                fetch('/api/agent/cancel', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ session_id: sid }),
                }).catch(() => {});
              }

              // 3. If final transcript or command word: complete barge-in immediately!
              if (isFinal || isCommandWord) {
                if (interimInterruptionTimerRef.current) {
                  clearTimeout(interimInterruptionTimerRef.current);
                  interimInterruptionTimerRef.current = null;
                }
                try {
                  rec.abort();
                } catch {}
                wakeWordRecRef.current = null;
                interruptPlayback('confirmed human voice barge-in', trimmed);
                return;
              }

              // 4. If interim result (user in middle of speaking their sentence):
              // Keep interim text and debounce 500ms so we capture the full question!
              interimInterruptionTextRef.current = trimmed;
              if (interimInterruptionTimerRef.current) {
                clearTimeout(interimInterruptionTimerRef.current);
              }
              interimInterruptionTimerRef.current = setTimeout(() => {
                const finalCapture = interimInterruptionTextRef.current || trimmed;
                interimInterruptionTextRef.current = '';
                interimInterruptionTimerRef.current = null;
                try {
                  rec.abort();
                } catch {}
                wakeWordRecRef.current = null;
                interruptPlayback('confirmed human voice barge-in (interim completed)', finalCapture);
              }, 500);

              return;
            }
          }
          return;
        }

        // Standby wake word detection:
        let cumulative = '';
        for (let i = 0; i < event.results.length; i++) {
          cumulative += event.results[i][0].transcript + ' ';
        }

        // 1. Check all alternatives in current results chunk for immediate sub-100ms activation
        for (let i = event.resultIndex; i < event.results.length; i++) {
          for (let a = 0; a < event.results[i].length; a++) {
            const rawTranscript = event.results[i][a].transcript;
            if (!rawTranscript || !rawTranscript.trim()) continue;

            const matchResult = matchWakeWord(rawTranscript);
            console.log(
              `[Vynzora Diagnostic] Recognized speech: "${rawTranscript}" (isFinal: ${event.results[i].isFinal}, alt: ${a}) -> ` +
                (matchResult.matched
                  ? `MATCHED ("${matchResult.phrase}")`
                  : `REJECTED (${matchResult.reason || 'no match'})`)
            );

            if (matchResult.matched && matchResult.phrase) {
              const detectLatency = Math.round(performance.now() - timingRef.current.wakeListenStartedAt);
              console.log(
                `[Vynzora Diagnostic] Wake phrase detected immediately in ${detectLatency}ms: "${matchResult.phrase}"`
              );
              try {
                rec.abort();
              } catch {}
              wakeWordRecRef.current = null;
              handleWakeWordTriggered(rawTranscript);
              return;
            }
          }
        }

        // 2. Also check cumulative session transcript to handle phrases split across chunks
        const cumMatch = matchWakeWord(cumulative);
        if (cumMatch.matched && cumMatch.phrase) {
          const detectLatency = Math.round(performance.now() - timingRef.current.wakeListenStartedAt);
          console.log(
            `[Vynzora Diagnostic] Wake phrase detected on cumulative stream in ${detectLatency}ms: "${cumMatch.phrase}"`
          );
          try {
            rec.abort();
          } catch {}
          wakeWordRecRef.current = null;
          handleWakeWordTriggered(cumulative);
          return;
        }
      };

      rec.onerror = (e: any) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          console.warn('[Vynzora Diagnostic] Wake word listener status/error:', e.error);
        }
      };

      rec.onend = () => {
        wakeWordRecRef.current = null;
        // Automatically restart standby listening or speech monitoring with fresh instance
        if (
          isWakeWordEnabledRef.current &&
          !isRecordingRef.current &&
          !isLoadingRef.current &&
          (voiceStateRef.current === 'WAKE_WORD_STANDBY' || voiceStateRef.current === 'SPEAKING')
        ) {
          setTimeout(() => {
            if (
              isWakeWordEnabledRef.current &&
              !isRecordingRef.current &&
              !isLoadingRef.current &&
              (voiceStateRef.current === 'WAKE_WORD_STANDBY' || voiceStateRef.current === 'SPEAKING')
            ) {
              console.log('[Vynzora Diagnostic] SpeechRecognition ended, restarting fresh listener instance...');
              startWakeWordListeningRef.current?.();
            }
          }, 150);
        }
      };

      rec.start();
      wakeWordRecRef.current = rec;
      if (voiceStateRef.current !== 'SPEAKING') {
        setVoiceState('WAKE_WORD_STANDBY');
        voiceStateRef.current = 'WAKE_WORD_STANDBY';
      }
      console.log('[Vynzora Diagnostic] Wake-word detection active (listening for ONLY "Hey Zora")');
    } catch (err: any) {
      console.warn('[Vynzora Diagnostic] Could not initialize wake-word recognition:', err.message || err);
    }
  }, [handleWakeWordTriggered, interruptPlayback, playSleepResponse]);
  startWakeWordListeningRef.current = startWakeWordListening;

  // ============================================================================
  // AUTOMATIC INITIALIZATION ON ADMIN PAGE LOAD
  // ============================================================================
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;
    setVoiceState('INITIALIZING');
    voiceStateRef.current = 'INITIALIZING';
    console.log('[Vynzora Diagnostic] Assistant initializing on Admin Page load');

    const initMicrophoneOnLoad = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          mediaStreamRef.current = stream;
          console.log('[Vynzora Diagnostic] Microphone permission granted');
          console.log('[Vynzora Diagnostic] Microphone initialized and stream cached');

          if (mounted) {
            setMicPermission('granted');
            setVoiceState('WAKE_WORD_STANDBY');
            voiceStateRef.current = 'WAKE_WORD_STANDBY';
            startWakeWordListeningRef.current?.();
          }
          return;
        }
      } catch (err: any) {
        console.log(
          '[Vynzora Diagnostic] Microphone permission deferred or requires user gesture:',
          err.message || err
        );
        if (mounted) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            console.warn('[Vynzora Diagnostic] Microphone permission denied');
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
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            mediaStreamRef.current = stream;
            console.log('[Vynzora Diagnostic] Microphone permission granted (on interaction)');
            console.log('[Vynzora Diagnostic] Microphone initialized');
            if (mounted) {
              setMicPermission('granted');
              setVoiceState('WAKE_WORD_STANDBY');
              voiceStateRef.current = 'WAKE_WORD_STANDBY';
              startWakeWordListeningRef.current?.();
            }
          } catch (e: any) {
            if (mounted && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')) {
              console.warn('[Vynzora Diagnostic] Microphone permission denied');
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
      stopWakeWordListeningRef.current?.();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Request microphone permission on manual user click if initially blocked
  const requestMicPermissionManually = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      console.log('[Vynzora Diagnostic] Microphone permission granted manually');
      console.log('[Vynzora Diagnostic] Microphone initialized');
      setMicPermission('granted');
      setVoiceState('WAKE_WORD_STANDBY');
      voiceStateRef.current = 'WAKE_WORD_STANDBY';
      startWakeWordListening();
    } catch (err: any) {
      console.warn('[Vynzora Diagnostic] Microphone permission request failed:', err.message || err);
      setMicPermission('denied');
      setErrorMessage('Microphone permission is required for hands-free voice activation.');
    }
  };

  // Toggle Wake-Word hands-free activation
  const toggleWakeWord = () => {
    const nextVal = !isWakeWordEnabled;
    setIsWakeWordEnabled(nextVal);
    isWakeWordEnabledRef.current = nextVal;
    localStorage.setItem('vynzora_wake_word_enabled', String(nextVal));
    if (nextVal) {
      setVoiceState('WAKE_WORD_STANDBY');
      voiceStateRef.current = 'WAKE_WORD_STANDBY';
      startWakeWordListening();
    } else {
      stopWakeWordListening();
      setVoiceState('DISABLED');
      voiceStateRef.current = 'DISABLED';
    }
  };

  const handleClearHistory = () => {
    currentRequestIdRef.current++;
    hasHadFirstActivationRef.current = false;
    stopAudio();
    stopRecording();
    setMessages([]);
    const newSid = 'vynzora-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('vynzora_ai_session_id', newSid);
    setSessionId(newSid);
    setVoiceState('WAKE_WORD_STANDBY');
    voiceStateRef.current = 'WAKE_WORD_STANDBY';
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
          title="Click to enable automatic 'Hey Zora' hands-free voice detection"
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
            if (isWakeWordEnabled && (voiceState === 'DISABLED' || voiceState === 'INITIALIZING')) {
              setVoiceState('WAKE_WORD_STANDBY');
              voiceStateRef.current = 'WAKE_WORD_STANDBY';
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
                voiceState === 'LISTENING' || voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                  ? 'bg-amber-400 animate-ping'
                  : voiceState === 'INTERRUPTED'
                  ? 'bg-amber-400 animate-ping'
                  : voiceState === 'SPEAKING'
                  ? 'bg-purple-400 animate-pulse'
                  : voiceState === 'PROCESSING'
                  ? 'bg-cyan-400 animate-spin'
                  : voiceState === 'CONTINUOUS_LISTENING'
                  ? 'bg-emerald-400 animate-pulse'
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
            {/* Voice Activation State Indicator */}
            {isWakeWordEnabled && (
              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-emerald-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {voiceState === 'INITIALIZING'
                    ? 'Initializing...'
                    : voiceState === 'ACTIVATED'
                    ? 'Activated: "Hello! I\'m Zora..."'
                    : voiceState === 'LISTENING'
                    ? 'Listening... (Speak now)'
                    : voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                    ? 'Speech Detected...'
                    : voiceState === 'PROCESSING'
                    ? 'Processing speech...'
                    : voiceState === 'SPEAKING'
                    ? 'Speaking (Speak to interrupt)...'
                    : voiceState === 'INTERRUPTED'
                    ? 'Interrupted! Listening...'
                    : voiceState === 'CONTINUOUS_LISTENING'
                    ? 'Active (Ask next question)'
                    : 'Say "Hey Zora"'}
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

                  {/* 10-State Visual Status Pill with Barge-In Support */}
                  <button
                    onClick={toggleWakeWord}
                    type="button"
                    title={
                      isWakeWordEnabled
                        ? 'Hands-Free "Hey Zora" is active (Barge-in enabled). Click to disable.'
                        : 'Hands-Free is off. Click to enable "Hey Zora".'
                    }
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                      !isWakeWordEnabled
                        ? 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                        : voiceState === 'INITIALIZING'
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : voiceState === 'LISTENING'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                        ? 'bg-rose-500/30 text-rose-200 border-rose-400 animate-pulse'
                        : voiceState === 'INTERRUPTED'
                        ? 'bg-amber-500/30 text-amber-200 border-amber-400 animate-pulse'
                        : voiceState === 'PROCESSING'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : voiceState === 'SPEAKING'
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 ring-1 ring-purple-400/50'
                        : voiceState === 'ACTIVATED'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 animate-pulse'
                        : voiceState === 'CONTINUOUS_LISTENING'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20'
                    }`}
                  >
                    {isWakeWordEnabled ? (
                      <>
                        <Radio className="w-2.5 h-2.5 text-indigo-400 animate-pulse" />
                        <span>
                          {voiceState === 'INITIALIZING'
                            ? 'Initializing...'
                            : voiceState === 'LISTENING'
                            ? 'Listening...'
                            : voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                            ? 'Speech Detected'
                            : voiceState === 'INTERRUPTED'
                            ? 'Interrupted'
                            : voiceState === 'PROCESSING'
                            ? 'Thinking...'
                            : voiceState === 'ACTIVATED'
                            ? 'Activated'
                            : voiceState === 'SPEAKING'
                            ? 'Speaking (Barge-In Ready)'
                            : voiceState === 'CONTINUOUS_LISTENING'
                            ? 'Turn-Taking Active'
                            : 'Standby: "Hey Zora"'}
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
                    setVoiceState('WAKE_WORD_STANDBY');
                    voiceStateRef.current = 'WAKE_WORD_STANDBY';
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
              {/* Audio Playing Bar (with Instant Barge-In Interruption button) */}
              {isPlayingAudio && (
                <div className="px-4 py-2 bg-indigo-950/60 border-b border-indigo-900/60 flex items-center justify-between text-xs text-indigo-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span className="font-medium text-[11px]">
                      {voiceState === 'ACTIVATED'
                        ? 'Zora: Greeting... (Speak or click to interrupt)'
                        : 'Speaking... (Speak at any time to interrupt)'}
                    </span>
                  </div>
                  <button
                    onClick={() => interruptPlayback('user clicked interrupt')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold border border-rose-500/40 cursor-pointer"
                    title="Interrupt speech and start listening immediately"
                  >
                    <VolumeX className="w-3 h-3" />
                    <span>Interrupt</span>
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
                        ഹലോ! ഞാൻ സോറ, നിങ്ങളുടെ വിൻസോറ AI അസിസ്റ്റന്റ്. CRM ഡാറ്റ പരിശോധിക്കാനും, കസ്റ്റമർ അന്വേഷണങ്ങൾ കണ്ടെത്താനും, പുതിയ കസ്റ്റമറെ ചേർക്കാനും എനിക്ക് സാധിക്കും.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        നിങ്ങൾക്ക് ടൈപ്പ് ചെയ്യുകയോ, അല്ലെങ്കിൽ &quot;Hey Zora&quot; എന്ന് സംസാരിച്ച് ചോദ്യങ്ങൾ ചോദിക്കുകയോ ചെയ്യാം. സംസാരിച്ചുകൊണ്ടിരിക്കുമ്പോൾ തന്നെ തടസ്സപ്പെടുത്തി (Barge-in) പുതിയ ചോദ്യം ചോദിക്കാം.
                      </p>
                      {isWakeWordEnabled && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-indigo-300 font-mono">
                          <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
                          <span>Voice Activation: Say &quot;Hey Zora&quot; to wake up (Barge-in supported)</span>
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
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                          ? 'bg-rose-500 animate-ping'
                          : voiceState === 'INTERRUPTED'
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-amber-400 animate-pulse'
                      }`}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        <span>
                          {voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                            ? 'Speech Detected (Capturing...)'
                            : voiceState === 'INTERRUPTED'
                            ? 'Interrupted! Listening for question...'
                            : voiceState === 'CONTINUOUS_LISTENING'
                            ? 'Listening for question...'
                            : 'Listening...'}
                        </span>
                        <span className="text-[10px] text-amber-300 font-mono">
                          (Auto-sends on natural pause)
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
                        setVoiceState('WAKE_WORD_STANDBY');
                        voiceStateRef.current = 'WAKE_WORD_STANDBY';
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

              {/* Input Bar (Synchronized Dynamic State-Aware Microphone Button & Text Input) */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                {/* Dynamic State-Aware Microphone Button Supporting Instant Barge-In */}
                <button
                  type="button"
                  onClick={
                    voiceState === 'SPEAKING'
                      ? () => interruptPlayback('mic button clicked during playback')
                      : isRecording
                      ? stopRecording
                      : () => startRecording(false)
                  }
                  disabled={isLoading && !isRecording && voiceState !== 'SPEAKING'}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/60 ring-2 ring-rose-400'
                      : voiceState === 'INTERRUPTED'
                      ? 'bg-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/50 ring-2 ring-amber-400/80'
                      : voiceState === 'LISTENING' || voiceState === 'CONTINUOUS_LISTENING'
                      ? 'bg-amber-500 text-white animate-pulse shadow-lg shadow-amber-500/50 ring-2 ring-amber-400/80'
                      : voiceState === 'ACTIVATED'
                      ? 'bg-indigo-600 text-white animate-pulse shadow-lg shadow-indigo-600/50'
                      : voiceState === 'PROCESSING'
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/50 ring-2 ring-cyan-400/60'
                      : voiceState === 'SPEAKING'
                      ? 'bg-purple-600 hover:bg-rose-600 text-white shadow-lg shadow-purple-600/50 ring-2 ring-purple-400/60 animate-pulse'
                      : isRecording
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  title={
                    voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED'
                      ? 'User Speaking (Speaking... Click to cancel)'
                      : voiceState === 'INTERRUPTED'
                      ? 'Interrupted! Capturing your question...'
                      : voiceState === 'LISTENING' || voiceState === 'CONTINUOUS_LISTENING'
                      ? 'Microphone Active: Listening for your question (Click to cancel)'
                      : voiceState === 'ACTIVATED'
                      ? 'Zora Activated: Opening microphone...'
                      : voiceState === 'PROCESSING'
                      ? 'Processing question & querying database...'
                      : voiceState === 'SPEAKING'
                      ? 'Speaking AI response (Click or speak to interrupt immediately)'
                      : 'Standby: Say "Hey Zora" (or click to speak)'
                  }
                >
                  {voiceState === 'USER_SPEAKING' || voiceState === 'SPEECH_DETECTED' ? (
                    <Activity className="w-4 h-4 text-white animate-pulse" />
                  ) : voiceState === 'INTERRUPTED' ? (
                    <Mic className="w-4 h-4 text-amber-200 animate-pulse" />
                  ) : voiceState === 'LISTENING' || voiceState === 'CONTINUOUS_LISTENING' ? (
                    <Mic className="w-4 h-4 text-white animate-pulse" />
                  ) : voiceState === 'ACTIVATED' ? (
                    <Sparkles className="w-4 h-4 text-white animate-spin" />
                  ) : voiceState === 'PROCESSING' ? (
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                  ) : voiceState === 'SPEAKING' ? (
                    <Volume2 className="w-4 h-4 text-white animate-pulse" />
                  ) : isRecording ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4 text-brand-400" />
                  )}
                </button>

                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  placeholder={
                    isRecording
                      ? 'Listening to microphone (pause when done)...'
                      : voiceState === 'ACTIVATED'
                      ? 'Activating Zora...'
                      : voiceState === 'SPEAKING'
                      ? 'Speaking (speak or click to interrupt)...'
                      : voiceState === 'CONTINUOUS_LISTENING'
                      ? 'Conversation active: ask question, or say "Stop"...'
                      : isWakeWordEnabled
                      ? 'Ask question, or say "Hey Zora"...'
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
