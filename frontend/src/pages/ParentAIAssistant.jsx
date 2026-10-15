import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaRobot, FaPaperPlane, FaMicrophone, FaVolumeUp, FaSpinner, FaStop } from 'react-icons/fa';
import { getAIChatResponse } from '../services/api';
import { getSpeechText, selectVoiceForLanguage } from '../utils/ttsHelper';

const ParentAIAssistant = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: t('ai.welcome', 'Hello! I am your SmartAttend Assistant. How can I help you today?') }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeUtterancesRef = useRef([]);

  // Preload synthesis voices & cleanup on unmount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync initial message on locale change
  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].id === 1) {
        const copy = [...prev];
        copy[0].text = t('ai.welcome', 'Hello! I am your SmartAttend Assistant. How can I help you today? You can ask about your child\'s attendance or school notices.');
        return copy;
      }
      return prev;
    });
  }, [i18n.language, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeUtterancesRef.current = [];
    setSpeakingMsgId(null);
  };

  const speakMessage = (msgId, text) => {
    if (!('speechSynthesis' in window)) {
      alert(t('ai.voiceNotSupported', 'Voice speech recognition is not supported in this browser.'));
      return;
    }

    // Toggle stop if currently speaking this message
    if (speakingMsgId === msgId) {
      stopSpeech();
      return;
    }

    // Stop any existing playback
    stopSpeech();

    if (!text || typeof text !== 'string') return;

    // 1. Get speech-only normalized text (UI message in state remains 100% unchanged)
    const speechText = getSpeechText(text, i18n.language);
    if (!speechText) return;

    // 2. Select appropriate language code & matching browser voice
    const voices = window.speechSynthesis.getVoices() || [];
    const { langCode, voice } = selectVoiceForLanguage(voices, i18n.language, text);

    // 3. Console debugging
    console.log("Selected app language:", i18n.language);
    console.log("TTS language:", langCode);
    console.log("TTS voice name:", voice?.name || "System Default");
    console.log("TTS voice language:", voice?.lang || langCode);
    console.log("TTS text:", speechText);

    // 4. Split text into sentence/clause level chunks (~120 chars) to prevent Chrome engine cutoff/GC issues
    const rawChunks = speechText.split(/([.!?\n।॥;]+)/);
    const chunks = [];
    let tempChunk = '';

    for (let i = 0; i < rawChunks.length; i++) {
      tempChunk += rawChunks[i];
      if (tempChunk.length >= 120 || i === rawChunks.length - 1 || /[.!?\n।॥;]/.test(rawChunks[i])) {
        const trimmed = tempChunk.trim();
        if (trimmed.length > 0) {
          chunks.push(trimmed);
        }
        tempChunk = '';
      }
    }

    if (chunks.length === 0) chunks.push(speechText);

    setSpeakingMsgId(msgId);
    activeUtterancesRef.current = [];

    chunks.forEach((chunkText, index) => {
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.lang = langCode;
      if (voice) {
        utterance.voice = voice;
      }

      if (index === chunks.length - 1) {
        utterance.onend = () => {
          activeUtterancesRef.current = [];
          setSpeakingMsgId(null);
        };
        utterance.onerror = (e) => {
          console.error("SpeechSynthesis error:", e);
          activeUtterancesRef.current = [];
          setSpeakingMsgId(null);
        };
      }

      // Maintain reference in ref to prevent garbage collection mid-speech
      activeUtterancesRef.current.push(utterance);
      window.speechSynthesis.speak(utterance);
    });
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('ai.voiceNotSupported', 'Voice recognition not supported in this browser.'));
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    const langCodes = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    recognition.lang = langCodes[i18n.language] || 'en-IN';
    recognition.interimResults = false;
    
    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setInput(text);
    };

    recognition.onerror = (err) => {
      console.error(err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const handleSendMessage = async (textToSend) => {
    const queryText = textToSend || input;
    if (!queryText.trim()) return;

    if (!textToSend) setInput('');

    // Append user message
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: queryText }]);
    setAiLoading(true);

    try {
      const data = await getAIChatResponse({ message: queryText, lang: i18n.language });
      
      if (data.success) {
        const newMsgId = Date.now();
        setMessages(prev => [...prev, { id: newMsgId, sender: 'ai', text: data.reply }]);
        speakMessage(newMsgId, data.reply);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: t('ai.errorProcessing', 'Sorry, I encountered an issue processing that query.') }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: t('ai.serverError', 'Connection to server failed. Please try again.') }]);
    } finally {
      setAiLoading(false);
    }
  };

  const samplePrompts = [
    { text: t('ai.q_pct', "What is my child's attendance percentage?") },
    { text: t('ai.q_absent', "Why is my child marked absent today?") },
    { text: t('ai.q_leave', "How do I apply for leave?") },
    { text: t('ai.q_holiday', "When is the next school holiday?") }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#263247] rounded-2xl shadow-sm overflow-hidden font-sans">
      {/* Compact ERP Chat header */}
      <div className="px-6 py-4 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-[#263247] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-[#2E7D32] dark:text-emerald-400 shrink-0">
            <FaRobot className="text-lg" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-[#F8FAFC]">
              {t('ai.assistantTitle', 'SmartAttend Assistant')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
              School support assistant
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-4 bg-[#F8FAFC]/50 dark:bg-[#0B1220]/50">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${
              m.sender === 'user'
                ? 'max-w-[75%] sm:max-w-[70%] ml-auto flex-row-reverse'
                : 'max-w-[85%] sm:max-w-[80%] mr-auto'
            }`}
          >
            {/* Avatar */}
            {m.sender === 'user' ? (
              <div className="w-8 h-8 rounded-xl bg-slate-700 dark:bg-slate-600 text-white font-semibold text-xs flex items-center justify-center shrink-0 shadow-sm">
                U
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-[#2E7D32] dark:text-emerald-400 shrink-0">
                <FaRobot className="text-base" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={`p-4 rounded-2xl text-sm font-normal leading-relaxed shadow-sm ${
                m.sender === 'user'
                  ? 'bg-[#2E7D32] dark:bg-emerald-700 text-white rounded-tr-none px-4 py-3'
                  : 'bg-[#F8FAFC] dark:bg-[#172033] border border-slate-200 dark:border-[#263247] text-slate-800 dark:text-[#F8FAFC] rounded-tl-none'
              }`}
            >
              <p className="whitespace-pre-line">{m.text}</p>

              {/* Listen Out Loud Action */}
              {m.sender === 'ai' && (
                <button
                  onClick={() => speakMessage(m.id, m.text)}
                  className={`mt-2.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition ${
                    speakingMsgId === m.id
                      ? 'text-red-600 dark:text-red-400 hover:text-red-800 animate-pulse'
                      : 'text-[#2E7D32] dark:text-emerald-400 hover:underline'
                  }`}
                >
                  {speakingMsgId === m.id ? (
                    <>
                      <FaStop className="text-xs text-red-500" />
                      <span>{t('ai.stopListening', 'Stop')}</span>
                    </>
                  ) : (
                    <>
                      <FaVolumeUp className="text-xs" />
                      <span>{t('ai.listenOutLoud', 'Listen out loud')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {aiLoading && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-[#94A3B8] pl-12 py-1">
            <FaSpinner className="animate-spin text-[#2E7D32] dark:text-emerald-400" />
            <span>{t('ai.thinking', 'AI is thinking...')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts Panel */}
      {messages.length === 1 && (
        <div className="px-6 py-3 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-[#263247] flex flex-wrap gap-2 shrink-0">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p.text)}
              className="px-3.5 py-1.5 bg-slate-50 dark:bg-[#182235] hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-700 dark:text-[#CBD5E1] hover:text-[#2E7D32] dark:hover:text-emerald-300 border border-slate-200 dark:border-[#263247] hover:border-emerald-200 dark:hover:border-emerald-800 text-xs font-medium rounded-full transition cursor-pointer"
            >
              {p.text}
            </button>
          ))}
        </div>
      )}

      {/* Input Composer Footer */}
      <div className="p-3.5 sm:p-4 bg-white dark:bg-[#111827] border-t border-slate-200 dark:border-[#263247] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Mic Button */}
          <button
            type="button"
            onClick={handleVoiceInput}
            className={`w-11 h-11 border rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
              isListening
                ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 animate-pulse'
                : 'bg-[#F8FAFC] dark:bg-[#182235] border-slate-200 dark:border-[#263247] text-slate-500 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#263247]'
            }`}
            title={t('ai.speakQuestion', 'Speak Question')}
          >
            <FaMicrophone />
          </button>

          <input
            type="text"
            placeholder={t('ai.inputPlaceholder', 'Type your question in English, Hindi, or Marathi...')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-[#F8FAFC] dark:bg-[#182235] border border-slate-300 dark:border-[#263247] rounded-xl text-sm font-normal text-slate-800 dark:text-[#F8FAFC] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32]"
          />

          <button
            type="submit"
            disabled={aiLoading || !input.trim()}
            className="w-11 h-11 bg-[#2E7D32] hover:bg-[#1B5E20] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl shadow-sm transition disabled:opacity-40 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <FaPaperPlane className="text-xs" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ParentAIAssistant;
