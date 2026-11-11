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

  // Audio Recording State (Browser MediaRecorder -> Sarvam Saaras v3)
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Audio Playback State (gTTS)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);

  // Backend Health State
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Initialize or restore session ID
  useEffect(() => {
    let sid = localStorage.getItem('vynzora_ai_session_id');
    if (!sid) {
      sid = 'vynzora-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
      localStorage.setItem('vynzora_ai_session_id', sid);
    }
    setSessionId(sid);
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

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Play audio from base64 string
  const playAudioBase64 = (base64Audio: string) => {
    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }

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
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => setIsPlayingAudio(false);
      audio.play().catch((err) => {
        console.warn('Audio autoplay prevented or interrupted:', err);
        setIsPlayingAudio(false);
      });
    } catch (e) {
      console.error('Failed to play audio:', e);
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  };

  // ============================================================================
  // TEXT CHAT HANDLER
  // ============================================================================
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    setInputValue('');

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
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // MULTILINGUAL VOICE HANDLER (BROWSER MEDIARECORDER -> SARVAM -> GEMINI -> GTTS)
  // ============================================================================
  const startRecording = async () => {
    try {
      stopAudio();
      setErrorMessage(null);

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processVoiceBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((sec) => sec + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setErrorMessage('Microphone access denied or unavailable. Please enable microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    }
  };

  const processVoiceBlob = async (audioBlob: Blob) => {
    setIsLoading(true);
    setErrorMessage(null);

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
        throw new Error(data.detail || data.response || 'Voice recognition failed.');
      }

      // Add user recognized speech to messages
      const userMessage: ChatMessage = {
        id: `user-voice-${Date.now()}`,
        role: 'user',
        content: data.transcript,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: data.detected_language,
        isVoiceInput: true,
      };

      // Add assistant response to messages
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    stopAudio();
    setMessages([]);
    const newSid = 'vynzora-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 5);
    localStorage.setItem('vynzora_ai_session_id', newSid);
    setSessionId(newSid);
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
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 ${
                backendStatus === 'online' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
              <span>Vynzora AI</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-white/20 font-mono">Agent Zora</span>
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
                    <span className="font-medium text-[11px]">Speaking via gTTS...</span>
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
                        നിങ്ങൾക്ക് ടൈപ്പ് ചെയ്യുകയോ, മൈക്രോഫോൺ ബട്ടൺ അമർത്തി മലയാളത്തിലോ ഹിന്ദിയിലോ ഇംഗ്ലീഷിലോ സംസാരിക്കുകയോ ചെയ്യാം.
                      </p>
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
                      {isRecording ? 'Listening...' : 'Vynzora AI is thinking and querying Supabase...'}
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Recording Status Bar */}
              {isRecording && (
                <div className="px-4 py-2 bg-rose-950/80 border-t border-rose-500/40 flex items-center justify-between text-xs text-rose-300 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="font-semibold">Recording Voice:</span>
                    <span className="font-mono">{recordSeconds}s</span>
                    <span className="text-[10px] text-rose-400">(Sarvam Saaras v3)</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                  >
                    Finish & Send
                  </button>
                </div>
              )}

              {/* Input Bar */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                  title={isRecording ? 'Stop recording' : 'Speak in Malayalam, Hindi, or English'}
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
                      ? 'Listening to microphone...'
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

