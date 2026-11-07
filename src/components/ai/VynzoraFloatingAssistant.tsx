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
  PhoneCall,
  PhoneOff,
} from 'lucide-react';
import AiMessageBubble, { ChatMessage } from './AiMessageBubble';
import { detectLanguage, SupportedLanguage, SUPPORTED_LANGUAGES } from '@/lib/ai/languageUtils';

const SUGGESTED_PROMPTS_BY_LANG: Record<SupportedLanguage, string[]> = {
  en: [
    "Show me today's notifications.",
    "How many new enquiries do we have?",
    "Give me the CRM summary.",
    "Generate a monthly business report.",
    "Which customers need follow-up?",
    "Analyse our lead conversion performance.",
  ],
  ml: [
    "ഇന്നത്തെ notifications കാണിക്കൂ",
    "ഇന്ന് എത്ര പുതിയ enquiries വന്നിട്ടുണ്ട്?",
    "CRM സമ്മറി തരൂ",
    "ബിസിനസ് പെർഫോമൻസ് റിപ്പോർട്ട് വേണം",
    "ഫോളോ-അപ്പ് ആവശ്യമുള്ള കസ്റ്റമേഴ്സ് ആരാണ്?",
    "ഏറ്റവും ഡിമാൻഡ് ഉള്ള സർവീസ് ഏതാണ്?",
  ],
  hi: [
    "आज की सूचनाएं (notifications) दिखाएं",
    "आज कितनी नई enquiries आई हैं?",
    "सीआरएम (CRM) का सारांश दें",
    "व्यावसायिक रिपोर्ट तैयार करें",
    "किन ग्राहकों को फॉलो-अप चाहिए?",
    "सबसे अधिक मांग वाली सेवा कौन सी है?",
  ],
};

export default function VynzoraFloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Messages & Input State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Voice Interaction State (Local Speech Recognition & Neural TTS)
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [autoVoiceEnabled, setAutoVoiceEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // LiveKit WebRTC Voice Agent Connection State
  const [livekitConnected, setLivekitConnected] = useState(false);
  const [livekitConnecting, setLivekitConnecting] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [livekitError, setLivekitError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const roomRef = useRef<any>(null);
  const agentAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, isLoading]);

  // Clean up LiveKit room on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (agentAudioElRef.current) {
        agentAudioElRef.current.remove();
      }
    };
  }, []);

  // Handle Speech Synthesis & Neural Audio Playback (Sarvam Bulbul v3 / Neural)
  const speakText = useCallback((text: string, lang?: SupportedLanguage) => {
    if (typeof window === 'undefined') return;

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    const targetLang = lang || detectLanguage(text);

    const cleanSpeech = text
      .replace(/[*#_`~>]/g, '')
      .replace(/•/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\|/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpeech) return;

    // Stream native Sarvam Bulbul v3 neural voice (ml-IN, hi-IN, en-IN)
    const neuralUrl = `/api/ai/tts?text=${encodeURIComponent(cleanSpeech.slice(0, 450))}&lang=${targetLang}`;
    const audio = new Audio(neuralUrl);
    audioPlayerRef.current = audio;

    setIsSpeaking(true);

    audio.onended = () => {
      setIsSpeaking(false);
      if (continuousVoice) {
        startListening();
      }
    };

    audio.onerror = (e) => {
      console.warn('Neural TTS stream error, falling back to Web Speech API:', e);
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanSpeech.slice(0, 300));
        utterance.lang = SUPPORTED_LANGUAGES[targetLang]?.speechCode || 'en-US';
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          if (continuousVoice) startListening();
        };
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    };

    audio.play().catch((err) => {
      console.warn('Audio play interrupted or waiting for user interaction:', err);
      setIsSpeaking(false);
    });
  }, [continuousVoice]);

  const stopSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ============================================================================
  // LIVEKIT WEBRTC REAL-TIME VOICE ROOM CONNECTION
  // ============================================================================

  const connectLiveKit = async () => {
    try {
      setLivekitConnecting(true);
      setLivekitError(null);
      stopSpeaking();
      stopListening();

      // 1. Generate connection token from server-side route
      const res = await fetch('/api/livekit/token?room=vynzora-crm-voice');
      const data = await res.json();

      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.error || 'LiveKit server credentials unavailable');
      }

      // 2. Import livekit-client dynamically in browser
      const { Room, RoomEvent, Track } = await import('livekit-client');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // 3. Setup event listeners
      room.on(RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          agentAudioElRef.current = el;
          document.body.appendChild(el);
          setAgentSpeaking(true);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        track.detach().forEach((el: any) => el.remove());
        setAgentSpeaking(false);
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: any[]) => {
        const isAgent = speakers.some((s) => !s.isLocal);
        setAgentSpeaking(isAgent);
      });

      room.on(RoomEvent.Disconnected, () => {
        setLivekitConnected(false);
        setLivekitConnecting(false);
        setAgentSpeaking(false);
      });

      // 4. Connect to LiveKit Cloud
      await room.connect(data.wsUrl, data.token);

      // 5. Publish microphone audio track
      await room.localParticipant.setMicrophoneEnabled(true);

      roomRef.current = room;
      setLivekitConnected(true);
      setLivekitConnecting(false);
      setMicMuted(false);

      // Welcome message in chat indicating voice agent room joined
      setMessages((prev) => [
        ...prev,
        {
          id: `lk-sys-${Date.now()}`,
          role: 'assistant',
          content: '🎙️ Connected to LiveKit Voice Agent. Microphone is live — speak in Malayalam, Hindi, or English.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: selectedLanguage,
        },
      ]);
    } catch (err: any) {
      console.error('LiveKit room connection error:', err);
      setLivekitError(err.message || 'Could not connect to LiveKit Voice Room');
      setLivekitConnected(false);
      setLivekitConnecting(false);
    }
  };

  const disconnectLiveKit = async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (agentAudioElRef.current) {
      agentAudioElRef.current.remove();
      agentAudioElRef.current = null;
    }
    setLivekitConnected(false);
    setLivekitConnecting(false);
    setAgentSpeaking(false);
  };

  const toggleMic = async () => {
    if (roomRef.current && roomRef.current.localParticipant) {
      const nextState = !micMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!nextState);
      setMicMuted(nextState);
    }
  };

  // ============================================================================
  // TEXT CHAT & DATABASE ASSISTANT HANDLER
  // ============================================================================

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    stopSpeaking();
    setVoiceError(null);
    setInputValue('');

    const detected = detectLanguage(text);
    setSelectedLanguage(detected);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: detected,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process AI query');
      }

      const aiData = data.data;
      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiData.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: aiData.language,
        toolsUsed: aiData.toolsUsed,
        chartData: aiData.chartData,
        tableData: aiData.tableData,
        reportData: aiData.reportData,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak response verbally in natural native language (Malayalam, Hindi, English)
      if (autoVoiceEnabled || isListening || continuousVoice) {
        speakText(aiData.reply, aiData.language);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Unable to retrieve data from database. Please try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: 'en',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Local Microphone Voice Input (Web Speech Fallback)
  const startListening = () => {
    stopSpeaking();
    setVoiceError(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      const speechLang =
        selectedLanguage === 'ml' ? 'ml-IN' : selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const detected = detectLanguage(transcript);
          setSelectedLanguage(detected);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission was denied. Please allow microphone access.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition start failed:', err);
      setIsListening(false);
      setVoiceError(err.message || 'Could not start microphone');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    stopSpeaking();
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-3 group border border-white/20 cursor-pointer"
          aria-label="Open Vynzora AI Business Assistant"
        >
          <div className="relative">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-ping" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>Vynzora AI</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/20 font-mono">Live CRM</span>
            </div>
            <div className="text-[10px] text-brand-100">Intelligent Business Assistant</div>
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
          <div className="p-3.5 sm:px-4 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/30">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                    Vynzora AI
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  Database-Aware Business Assistant
                </span>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 text-slate-400">
              {messages.length > 0 && !isMinimized && (
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 rounded-lg hover:text-rose-400 hover:bg-slate-900 transition-colors"
                  title="Clear conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

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
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`}
                />
              </button>

              <button
                onClick={() => {
                  stopSpeaking();
                  stopListening();
                  disconnectLiveKit();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-900 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content (Visible when not minimized) */}
          {!isMinimized && (
            <>
              {/* LiveKit Voice Connection Status Bar */}
              <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/50 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <Radio className={`w-3.5 h-3.5 ${livekitConnected ? 'text-emerald-400 animate-pulse' : 'text-indigo-400'}`} />
                  <span className="font-semibold text-slate-200">LiveKit Cloud Voice:</span>
                  {livekitConnected ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Connected ({agentSpeaking ? 'Speaking' : 'Listening'})
                    </span>
                  ) : livekitConnecting ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-indigo-300 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Connecting...
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Idle</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {livekitConnected ? (
                    <>
                      <button
                        onClick={toggleMic}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          micMuted
                            ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50'
                            : 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                        }`}
                        title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                      >
                        {micMuted ? 'Mic Muted' : 'Mic Live'}
                      </button>
                      <button
                        onClick={disconnectLiveKit}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/40 transition-colors"
                        title="Disconnect LiveKit Voice"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={connectLiveKit}
                      disabled={livekitConnecting}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>Connect Voice</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Multilingual Voice & Neural TTS Bar */}
              <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-brand-400" />
                  <span>Language:</span>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    {(['en', 'ml', 'hi'] as SupportedLanguage[]).map((langCode) => {
                      const isSelected = selectedLanguage === langCode;
                      return (
                        <button
                          key={langCode}
                          type="button"
                          onClick={() => setSelectedLanguage(langCode)}
                          className={`px-2 py-0.5 rounded font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-brand-600 text-white shadow-sm ring-1 ring-white/30'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700/60'
                          }`}
                          title={`Set voice/input language to ${SUPPORTED_LANGUAGES[langCode].nativeName}`}
                        >
                          {SUPPORTED_LANGUAGES[langCode].nativeName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isSpeaking && (
                    <button
                      onClick={stopSpeaking}
                      className="flex items-center gap-1 text-rose-400 hover:text-rose-300 text-[10px] font-semibold"
                    >
                      <VolumeX className="w-3 h-3" />
                      <span>Stop Voice</span>
                    </button>
                  )}

                  <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-slate-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={autoVoiceEnabled}
                      onChange={(e) => setAutoVoiceEnabled(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0 w-3 h-3 cursor-pointer"
                    />
                    <span>Sarvam TTS</span>
                  </label>
                </div>
              </div>

              {/* Error banner */}
              {(voiceError || livekitError) && (
                <div className="p-2.5 bg-rose-950/60 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{voiceError || livekitError}</span>
                  </div>
                  <button
                    onClick={() => {
                      setVoiceError(null);
                      setLivekitError(null);
                    }}
                    className="p-0.5 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {/* Initial Welcome & Suggested Prompts */}
                {messages.length === 0 && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span>Welcome to Vynzora AI</span>
                      </div>
                      {selectedLanguage === 'ml' ? (
                        <p className="text-xs text-slate-200 leading-relaxed">
                          നമസ്കാരം! ഞാൻ വിൻസോറ AI ആണ്, നിങ്ങളുടെ ബിസിനസ്സ് അസിസ്റ്റന്റ്.
                          <br />
                          CRM ഡാറ്റ പരിശോധിക്കാനും, കസ്റ്റമർ അന്വേഷണങ്ങൾ കണ്ടെത്താനും, നോട്ടിഫിക്കേഷനുകൾ കാണാനും, റിപ്പോർട്ടുകൾ തയ്യാറാക്കാനും എനിക്ക് സാധിക്കും.
                          <br />
                          <span className="text-brand-300 font-medium">ഇന്ന് ഞാൻ എങ്ങനെ സഹായിക്കണം?</span>
                        </p>
                      ) : selectedLanguage === 'hi' ? (
                        <p className="text-xs text-slate-200 leading-relaxed">
                          नमस्ते! मैं विन्ज़ोरा AI हूँ, आपका बिजनेस पार्टनर।
                          <br />
                          मैं CRM डेटा का विश्लेषण, ग्राहक पूछताछ, सूचनाएं और व्यावसायिक रिपोर्ट तैयार करने में आपकी सहायता कर सकता हूँ।
                          <br />
                          <span className="text-brand-300 font-medium">आज मैं आपकी क्या सहायता कर सकता हूँ?</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-200 leading-relaxed">
                          Hello! I&apos;m Vynzora AI, your business assistant.
                          <br />
                          I can help you analyse CRM data, retrieve customer information, check notifications, generate reports, and answer questions about your business.
                          <br />
                          <span className="text-brand-300 font-medium">How can I help you today?</span>
                        </p>
                      )}
                    </div>

                    {/* Suggested Question Chips */}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2 px-1">
                        {selectedLanguage === 'ml'
                          ? 'നിർദ്ദേശിച്ച ബിസിനസ്സ് ചോദ്യങ്ങൾ'
                          : selectedLanguage === 'hi'
                          ? 'सुझाए गए व्यावसायिक प्रश्न'
                          : 'Suggested Business Queries'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(SUGGESTED_PROMPTS_BY_LANG[selectedLanguage] || SUGGESTED_PROMPTS_BY_LANG.en).map(
                          (prompt) => (
                            <button
                              key={prompt}
                              onClick={() => handleSendMessage(prompt)}
                              className="text-left text-xs px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/50 text-slate-300 hover:text-white transition-all active:scale-98"
                            >
                              {prompt}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Message Bubbles */}
                {messages.map((message) => (
                  <AiMessageBubble
                    key={message.id}
                    message={message}
                    onSpeak={speakText}
                    isSpeaking={isSpeaking}
                    onStopSpeak={stopSpeaking}
                  />
                ))}

                {/* Loading / Analyzing Indicator */}
                {isLoading && (
                  <div className="flex items-center gap-3 text-xs text-slate-400 animate-in fade-in">
                    <div className="w-7 h-7 rounded-xl bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-300">
                        Querying Supabase database & analyzing insights...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Footer Input & Voice Controls */}
              <div className="p-3 bg-slate-950/95 border-t border-slate-800 space-y-2 shrink-0">
                {/* Active Listening Audio Wave Indicator */}
                {isListening && (
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-brand-600/20 border border-brand-500/40 text-brand-300 text-xs animate-in zoom-in-95">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="w-1 h-3 bg-brand-400 animate-pulse rounded-full" />
                        <span className="w-1 h-5 bg-brand-400 animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-2 bg-brand-400 animate-pulse delay-150 rounded-full" />
                        <span className="w-1 h-4 bg-brand-400 animate-pulse delay-100 rounded-full" />
                      </div>
                      <span className="font-semibold text-xs">
                        Listening in {SUPPORTED_LANGUAGES[selectedLanguage]?.nativeName || 'English'}... Speak now
                      </span>
                    </div>
                    <button
                      onClick={stopListening}
                      className="text-xs px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 hover:bg-rose-600/50"
                    >
                      Done
                    </button>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={
                        selectedLanguage === 'ml'
                          ? 'മലയാളത്തിലോ English ലോ ചോദിക്കൂ...'
                          : selectedLanguage === 'hi'
                          ? 'हिन्दी या English में पूछें...'
                          : 'Ask in English, മലയാളം, or हिन्दी...'
                      }
                      disabled={isLoading}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50"
                    />
                    {inputValue && (
                      <button
                        type="button"
                        onClick={() => setInputValue('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Microphone Button */}
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isLoading}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 ${
                      isListening
                        ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30'
                        : 'bg-slate-900 border border-slate-800 hover:border-brand-500/50 text-slate-300 hover:text-white'
                    }`}
                    title={isListening ? 'Click to stop listening' : 'Speak your question (Voice Mode)'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white transition-all shadow-md shadow-brand-600/20 flex items-center justify-center shrink-0 cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
