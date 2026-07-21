import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { FaRobot, FaPaperPlane, FaMicrophone, FaVolumeUp, FaSpinner, FaSchool } from 'react-icons/fa';
import { getAIChatResponse } from '../services/api';

const ParentAIAssistant = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: 'Hello! I am your SmartAttend Assistant. How can I help you today? You can ask about your child\'s attendance or school notices.' }
  ]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Sync initial message on locale change
  useEffect(() => {
    setMessages(prev => {
      const copy = [...prev];
      if (copy.length > 0 && copy[0].id === 1) {
        copy[0].text = t('ai.welcome') || 'Hello! I am your school AI assistant. How can I help you today?';
      }
      return copy;
    });
  }, [t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speakResponse = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
      utterance.lang = langCodes[i18n.language] || 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    const langCodes = { en: 'en-US', hi: 'hi-IN', mr: 'mr-IN' };
    recognition.lang = langCodes[i18n.language] || 'en-US';
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
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: data.reply }]);
        speakResponse(data.reply);
      } else {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: 'Sorry, I encountered an issue processing that query.' }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: 'Connection to server failed. Please try again.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const samplePrompts = [
    { text: 'What is my child\'s attendance percentage?', key: 'ai.q_pct' },
    { text: 'Why is my child marked absent today?', key: 'ai.q_absent' },
    { text: 'How do I apply for leave?', key: 'ai.q_leave' },
    { text: 'When is the next school holiday?', key: 'ai.q_holiday' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white border border-gray-150 rounded-3xl overflow-hidden shadow-md">
      {/* Chat header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-green-50 text-[#2E7D32] rounded-2xl border border-green-100 flex items-center justify-center">
            <FaRobot className="text-xl" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-gray-800">SmartAttend Rural AI</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Gemini-Powered Support</p>
          </div>
        </div>
      </div>

      {/* Messages screen */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50 bg-opacity-20">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 max-w-[85%] ${
              m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                m.sender === 'user'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-[#2E7D32] border border-green-100'
              }`}
            >
              {m.sender === 'user' ? 'U' : <FaRobot />}
            </div>

            {/* Bubble */}
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${
                m.sender === 'user'
                  ? 'bg-green-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-150 text-gray-700 rounded-tl-none'
              }`}
            >
              <p>{m.text}</p>
              {m.sender === 'ai' && (
                <button
                  onClick={() => speakResponse(m.text)}
                  className="mt-2 text-[10px] font-extrabold text-gray-400 hover:text-green-700 flex items-center gap-1 cursor-pointer"
                >
                  <FaVolumeUp />
                  <span>Listen Out Loud</span>
                </button>
              )}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 pl-11">
            <FaSpinner className="animate-spin text-green-700" />
            <span>AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts panel */}
      {messages.length === 1 && (
        <div className="px-6 py-3 bg-white border-t border-gray-100 flex flex-wrap gap-2">
          {samplePrompts.map((p) => (
            <button
              key={p.text}
              onClick={() => handleSendMessage(p.text)}
              className="text-[10px] font-bold text-gray-600 bg-gray-50 hover:bg-green-50 hover:text-[#2E7D32] border border-gray-200 hover:border-green-200 px-3 py-1.5 rounded-full transition cursor-pointer"
            >
              {p.text}
            </button>
          ))}
        </div>
      )}

      {/* Input panel */}
      <div className="p-4 border-t border-gray-100 bg-white">
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
            className={`p-3 border rounded-xl flex items-center justify-center transition cursor-pointer ${
              isListening
                ? 'bg-red-50 border-red-250 text-red-655 animate-pulse'
                : 'bg-gray-50 border-gray-200 text-gray-550 hover:bg-gray-100'
            }`}
            title="Speak Question"
          >
            <FaMicrophone />
          </button>

          <input
            type="text"
            placeholder="Type your question in English, Hindi, or Marathi..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <button
            type="submit"
            disabled={aiLoading || !input.trim()}
            className="p-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            <FaPaperPlane className="text-xs" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ParentAIAssistant;
