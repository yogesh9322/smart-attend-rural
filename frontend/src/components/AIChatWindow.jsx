import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  getAIChatResponse,
  getAIChatHistory,
  clearAIChatHistory
} from '../services/api';
import {
  FaComments,
  FaTimes,
  FaRobot,
  FaPaperPlane,
  FaTrash,
  FaMicrophone,
  FaSpinner,
  FaCopy,
  FaVolumeUp,
  FaStop
} from 'react-icons/fa';
import { getSpeechText, selectVoiceForLanguage } from '../utils/ttsHelper';

const SUGGESTIONS = {
  admin: [
    "Show today's attendance summary.",
    "Students below 75%.",
    "Generate monthly report."
  ],
  teacher: [
    "How do I mark attendance?",
    "Show absent students.",
    "Generate attendance report."
  ],
  parent: [
    "What is my child's attendance?",
    "How do I request leave?",
    "Explain today's notice."
  ]
};

const AIChatWindow = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  // Hide floating chat launcher when on dedicated AI Assistant page
  if (location.pathname.includes('ai-assistant')) {
    return null;
  }
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const messagesEndRef = useRef(null);
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

  useEffect(() => {
    if (chatOpen) {
      fetchHistory();
    }
  }, [chatOpen]);

  // Sync initial welcome message on language switch
  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].id === 'welcome') {
        const copy = [...prev];
        copy[0].text = t('ai.welcome', 'Hello! I am your SmartAttend Assistant. How can I help you today?');
        return copy;
      }
      return prev;
    });
  }, [i18n.language, t]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

    // Stop any active speech before starting new
    stopSpeech();

    if (!text || typeof text !== 'string') return;

    // 1. Get speech-only normalized text (UI message text in state remains 100% unchanged)
    const speechText = getSpeechText(text, i18n.language);
    if (!speechText) return;

    // 2. Select appropriate language code & matching browser voice
    const voices = window.speechSynthesis.getVoices() || [];
    const { langCode, voice } = selectVoiceForLanguage(voices, i18n.language, text);

    // 3. Console debugging as requested in Requirement 13
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

      activeUtterancesRef.current.push(utterance);
      window.speechSynthesis.speak(utterance);
    });
  };

  const fetchHistory = async () => {
    try {
      const res = await getAIChatHistory();
      if (res.success && res.data.length > 0) {
        // Reverse array to maintain chronological order
        const historyLogs = res.data.reverse().map((log) => [
          { id: log._id + '-q', sender: 'user', text: log.question, time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          { id: log._id + '-a', sender: 'ai', text: log.answer, time: new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]).flat();
        setMessages(historyLogs);
      } else {
        // Add welcome message
        const welcomeText = t('ai.welcome', 'Hello! I am SmartAttend AI. How can I help you today?');
        setMessages([{
          id: 'welcome',
          sender: 'ai',
          text: welcomeText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async (textToSend) => {
    const messageText = textToSend || input;
    if (!messageText.trim()) return;

    if (!textToSend) setInput('');

    // Append user question
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { id: Date.now() + '-user', sender: 'user', text: messageText, time: timeStr };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);
    try {
      const res = await getAIChatResponse({ message: messageText, lang: i18n.language });
      if (res.success) {
        const newMsgId = Date.now() + '-ai';
        setMessages((prev) => [
          ...prev,
          { id: newMsgId, sender: 'ai', text: res.reply, time: timeStr }
        ]);
        speakMessage(newMsgId, res.reply);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + '-err', sender: 'ai', text: t('ai.serverError', 'Error connecting to AI server. Please try again.'), time: timeStr }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm(t('ai.confirmClear', 'Are you sure you want to clear your AI chat history?'))) return;
    try {
      await clearAIChatHistory();
      setMessages([]);
      fetchHistory();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    alert(t('ai.copied', 'Response copied to clipboard!'));
  };

  // Speech-To-Text (Voice Capture)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t('ai.voiceNotSupported', 'Voice speech recognition is not supported in this browser.'));
      return;
    }

    const recognition = new SpeechRecognition();
    const langCodes = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };
    recognition.lang = langCodes[i18n.language] || 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

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

    recognition.start();
  };

  // Simple Markdown renderer helper
  const renderText = (text) => {
    if (!text) return '';
    // Format bold text **word**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-bold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const role = user?.role || 'parent';
  const roleSuggestions = [
    t(`ai.sug_${role}_1`, SUGGESTIONS[role]?.[0] || 'Show today\'s attendance summary.'),
    t(`ai.sug_${role}_2`, SUGGESTIONS[role]?.[1] || 'Students below 75%.'),
    t(`ai.sug_${role}_3`, SUGGESTIONS[role]?.[2] || 'Generate monthly report.')
  ];

  return (
    <>
      {/* Floating Chat Box Panel */}
      {chatOpen && (
        <div
          role="dialog"
          aria-label={t('ai.chatTitle', 'SmartAttend AI')}
          className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 w-auto sm:w-[390px] md:w-[410px] max-w-[calc(100vw-2rem)] sm:max-w-[420px] h-[520px] max-h-[calc(100dvh-2rem)] sm:max-h-[min(560px,calc(100dvh-4rem))] bg-white dark:bg-[#151E2E] border border-gray-200 dark:border-[#263247] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans no-print"
        >
          {/* Header */}
          <div className="shrink-0 px-4 py-3 sm:px-4.5 sm:py-3.5 bg-[#2E7D32] dark:bg-[#062c1d] text-white flex justify-between items-center shadow-xs border-b border-green-800/30 dark:border-[#263247]">
            <div className="flex items-center gap-2.5 min-w-0 mr-2">
              <div className="w-8 h-8 rounded-xl bg-white/15 dark:bg-emerald-950/60 text-green-100 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <FaRobot className="text-base" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-black tracking-wide leading-tight truncate">
                  {t('ai.chatTitle', 'SmartAttend AI')}
                </h3>
                <p className="text-[10px] sm:text-[11px] text-green-100 dark:text-emerald-300 font-medium leading-tight truncate mt-0.5">
                  {t('ai.tagline', 'Always here to help.')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 hover:bg-white/15 dark:hover:bg-emerald-800/60 rounded-lg text-green-100 hover:text-white transition cursor-pointer"
                title={t('ai.clearLogs', 'Clear Chat Logs')}
                aria-label={t('ai.clearLogs', 'Clear Chat Logs')}
              >
                <FaTrash className="text-xs" />
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="p-1.5 hover:bg-white/15 dark:hover:bg-emerald-800/60 rounded-lg text-green-100 hover:text-white transition cursor-pointer"
                title={t('common.close', 'Close')}
                aria-label={t('common.close', 'Close')}
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-gray-50/70 dark:bg-[#0B1220] overscroll-contain">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    isUser
                      ? 'ml-auto items-end max-w-[85%]'
                      : 'mr-auto items-start max-w-[90%] sm:max-w-[88%]'
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs relative group break-words [overflow-wrap:anywhere] ${
                      isUser
                        ? 'bg-[#2E7D32] dark:bg-[#062c1d] text-white dark:text-emerald-100 border border-transparent dark:border-emerald-800/60 rounded-tr-xs'
                        : 'min-w-[155px] sm:min-w-[175px] bg-white dark:bg-[#182235] text-gray-800 dark:text-[#F8FAFC] border border-gray-200/80 dark:border-[#263247] rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {renderText(msg.text)}
                    </div>

                    {!isUser && (
                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-gray-100 dark:border-[#263247]/60 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => speakMessage(msg.id, msg.text)}
                          className={`flex items-center gap-1 cursor-pointer transition ${
                            speakingMsgId === msg.id
                              ? 'text-red-600 dark:text-red-400 hover:text-red-800 animate-pulse'
                              : 'text-gray-400 dark:text-[#94A3B8] hover:text-[#2E7D32] dark:hover:text-emerald-400'
                          }`}
                        >
                          {speakingMsgId === msg.id ? (
                            <FaStop className="text-red-500 text-xs" />
                          ) : (
                            <FaVolumeUp />
                          )}
                          <span>
                            {speakingMsgId === msg.id
                              ? t('ai.stopListening', 'Stop')
                              : t('ai.listenOutLoud', 'Listen Out Loud')}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.text)}
                          className="text-gray-400 dark:text-[#94A3B8] hover:text-gray-600 dark:hover:text-white transition p-1 cursor-pointer"
                          title={t('ai.copyResponse', 'Copy Response')}
                          aria-label={t('ai.copyResponse', 'Copy Response')}
                        >
                          <FaCopy className="text-[10px]" />
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mt-1 px-1">
                    {msg.time}
                  </span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-[#94A3B8] font-bold px-1.5 py-1 animate-pulse">
                <FaSpinner className="animate-spin text-[#2E7D32] dark:text-emerald-400" />
                <span>{t('ai.thinking', 'Thinking...')}</span>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* Suggested queries buttons */}
          {messages.length <= 2 && (
            <div className="shrink-0 px-3.5 py-2 bg-white dark:bg-[#151E2E] border-t border-gray-150 dark:border-[#263247] flex flex-wrap gap-1.5">
              {roleSuggestions.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(sq)}
                  className="px-2.5 py-1 bg-green-50 dark:bg-[#062c1d] hover:bg-green-100 text-[#2E7D32] dark:text-emerald-300 border border-green-200 dark:border-emerald-800/60 text-[10px] sm:text-[11px] font-semibold rounded-lg transition cursor-pointer text-left leading-snug break-words"
                >
                  {sq}
                </button>
              ))}
            </div>
          )}

          {/* Form Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="shrink-0 p-2.5 sm:p-3 bg-white dark:bg-[#151E2E] border-t border-gray-200 dark:border-[#263247] flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={loading}
              className={`p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
                  : 'bg-gray-50 dark:bg-[#182235] text-gray-500 dark:text-[#CBD5E1] hover:bg-gray-100 dark:hover:bg-[#263247] border-gray-200 dark:border-[#263247]'
              }`}
              title={t('ai.speakQuestion', 'Voice Input')}
              aria-label={t('ai.speakQuestion', 'Voice Input')}
            >
              <FaMicrophone className="text-xs" />
            </button>

            <input
              type="text"
              placeholder={t('ai.placeholder', 'Ask SmartAttend AI...')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 min-w-0 px-3.5 py-2 sm:py-2.5 bg-gray-50 dark:bg-[#182235] border border-gray-200 dark:border-[#263247] text-gray-800 dark:text-[#F8FAFC] rounded-xl text-xs sm:text-[13px] font-medium placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:border-[#2E7D32]"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-[#2E7D32] dark:bg-emerald-600 hover:bg-[#1B5E20] dark:hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-xs transition cursor-pointer shrink-0"
              title={t('ai.send', 'Send')}
              aria-label={t('ai.send', 'Send')}
            >
              <FaPaperPlane className="text-xs" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-14 sm:bottom-16 right-5 sm:right-6 z-40 p-3.5 sm:p-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-green-700/60 focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:ring-offset-2 dark:focus:ring-offset-gray-900 no-print"
          title={t('ai.chatTitle', 'Open SmartAttend AI')}
          aria-label={t('ai.chatTitle', 'Open SmartAttend AI')}
        >
          <FaComments className="text-xl sm:text-2xl" />
        </button>
      )}
    </>
  );
};

export default AIChatWindow;
