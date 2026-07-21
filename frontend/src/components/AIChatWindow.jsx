import React, { useState, useEffect, useRef } from 'react';
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
  FaVolumeUp,
  FaSpinner,
  FaCopy
} from 'react-icons/fa';

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
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chatOpen) {
      fetchHistory();
    }
  }, [chatOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        const welcomeText = t('ai.welcome', { defaultValue: "Hello! I am SmartAttend AI. I can help you with attendance, reports, notices, and student details. How can I assist you today?" });
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
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + '-ai', sender: 'ai', text: res.reply, time: timeStr }
        ]);
        speakResponse(res.reply);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + '-err', sender: 'ai', text: "Error connecting to AI server. Please try again.", time: timeStr }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm("Are you sure you want to clear your AI chat history?")) return;
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
    alert("Response copied to clipboard!");
  };

  // Text-To-Speech (Vocalization)
  const speakResponse = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
      utterance.lang = langCodes[i18n.language] || 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech-To-Text (Voice Capture)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
    recognition.lang = langCodes[i18n.language] || 'en-US';
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
        return <strong key={idx} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const role = user?.role || 'parent';
  const roleSuggestions = SUGGESTIONS[role] || SUGGESTIONS.parent;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end font-sans no-print">
      {/* Floating Chat Box Panel */}
      {chatOpen && (
        <div className="w-85 sm:w-96 h-[500px] bg-white border border-gray-150 rounded-3xl shadow-2xl flex flex-col mb-4 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="px-5 py-4 bg-[#2E7D32] text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-2">
              <FaRobot className="text-xl text-green-200" />
              <div>
                <h3 className="text-sm font-black tracking-wide">SmartAttend AI</h3>
                <p className="text-[10px] text-green-100 font-semibold mt-0.5">Always here to help.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearChat}
                className="p-1.5 hover:bg-green-700 rounded-lg text-white transition cursor-pointer"
                title="Clear Chat Logs"
              >
                <FaTrash className="text-xs" />
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 hover:bg-green-700 rounded-lg text-white transition cursor-pointer"
              >
                <FaTimes className="text-sm" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm relative group ${
                    msg.sender === 'user'
                      ? 'bg-[#2E7D32] text-white rounded-tr-none'
                      : 'bg-white text-gray-700 border border-gray-150 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{renderText(msg.text)}</p>
                  
                  {msg.sender === 'ai' && (
                    <button
                      onClick={() => handleCopyText(msg.text)}
                      className="absolute -right-6 top-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition p-1 cursor-pointer"
                      title="Copy Response"
                    >
                      <FaCopy className="text-[10px]" />
                    </button>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 font-bold mt-1 px-1">{msg.time}</span>
              </div>
            ))}
            
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400 font-bold px-1.5 animate-pulse">
                <FaSpinner className="animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested queries buttons */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-2">
              {roleSuggestions.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(sq)}
                  className="px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-[#2E7D32] border border-green-150 text-[10px] font-bold rounded-xl transition cursor-pointer"
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
            className="p-3 bg-white border-t border-gray-150 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={handleVoiceInput}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                isListening
                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border-gray-200'
              }`}
              title="Voice Input"
            >
              <FaMicrophone className="text-xs" />
            </button>
            
            <input
              type="text"
              placeholder="Ask SmartAttend AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            
            <button
              type="submit"
              className="p-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl shadow transition cursor-pointer"
            >
              <FaPaperPlane className="text-xs" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="p-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 cursor-pointer border border-green-700"
          title="Open SmartAttend AI"
        >
          <FaComments className="text-2xl" />
        </button>
      )}
    </div>
  );
};

export default AIChatWindow;
