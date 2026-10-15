import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { generateAINotice } from '../../services/api';
import { FaRobot, FaBullhorn, FaSpinner, FaGlobe, FaCheck, FaCopy } from 'react-icons/fa';

const AINoticeGenerator = ({ onPublish }) => {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedData, setGeneratedData] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setError('');
    setGeneratedData(null);

    try {
      const res = await generateAINotice(inputText);
      if (res.success) {
        setGeneratedData(res.data);
      } else {
        setError(res.message || t('ai_components.errorGenerating'));
      }
    } catch (err) {
      console.error(err);
      setError(t('ai_components.errorGenerating'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-md space-y-4 font-sans">
      <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-gray-100">
        <FaRobot className="text-[#2E7D32]" />
        <span>{t('ai_components.studioTitle')}</span>
      </h3>

      <form onSubmit={handleGenerate} className="space-y-3">
        <div>
          <label htmlFor="draftText" className="block text-xs font-bold text-gray-500 uppercase mb-1">
            {t('ai_components.draftLabel')}
          </label>
          <textarea
            id="draftText"
            rows="3"
            placeholder={t('ai_components.draftPlaceholder')}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-750 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="w-full py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>{t('ai_components.translating')}</span>
            </>
          ) : (
            <>
              <FaGlobe />
              <span>{t('ai_components.generateBtn')}</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs font-bold rounded-xl text-center">
          {error}
        </div>
      )}

      {generatedData && (
        <div className="space-y-4 mt-4 border-t border-gray-100 pt-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('ai_components.generatedTemplates')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* English */}
            <div className="border border-gray-150 rounded-2xl p-4 bg-gray-50 bg-opacity-25 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold text-[#2E7D32] bg-green-50 px-2 py-0.5 rounded uppercase tracking-widest block w-max">{t('ai_components.english')}</span>
                <p className="text-xs text-gray-700 font-semibold leading-relaxed mt-3 whitespace-pre-line">
                  {generatedData.englishNotice}
                </p>
              </div>
              <button
                onClick={() => handleCopy(generatedData.englishNotice, 0)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 border border-gray-200 hover:bg-gray-50 text-[10px] font-extrabold text-gray-600 rounded-xl transition cursor-pointer"
              >
                {copiedIndex === 0 ? <FaCheck className="text-green-600" /> : <FaCopy />}
                <span>{copiedIndex === 0 ? t('ai_components.copied') : t('ai_components.copyText')}</span>
              </button>
            </div>

            {/* Hindi */}
            <div className="border border-gray-150 rounded-2xl p-4 bg-gray-50 bg-opacity-25 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-widest block w-max">{t('ai_components.hindi')}</span>
                <p className="text-xs text-gray-750 font-semibold leading-relaxed mt-3 whitespace-pre-line">
                  {generatedData.hindiNotice}
                </p>
              </div>
              <button
                onClick={() => handleCopy(generatedData.hindiNotice, 1)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 border border-gray-200 hover:bg-gray-50 text-[10px] font-extrabold text-gray-600 rounded-xl transition cursor-pointer"
              >
                {copiedIndex === 1 ? <FaCheck className="text-green-600" /> : <FaCopy />}
                <span>{copiedIndex === 1 ? t('ai_components.copied') : t('ai_components.copyText')}</span>
              </button>
            </div>

            {/* Marathi */}
            <div className="border border-gray-150 rounded-2xl p-4 bg-gray-50 bg-opacity-25 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-widest block w-max">{t('ai_components.marathi')}</span>
                <p className="text-xs text-gray-750 font-semibold leading-relaxed mt-3 whitespace-pre-line">
                  {generatedData.marathiNotice}
                </p>
              </div>
              <button
                onClick={() => handleCopy(generatedData.marathiNotice, 2)}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 border border-gray-200 hover:bg-gray-50 text-[10px] font-extrabold text-gray-600 rounded-xl transition cursor-pointer"
              >
                {copiedIndex === 2 ? <FaCheck className="text-green-600" /> : <FaCopy />}
                <span>{copiedIndex === 2 ? t('ai_components.copied') : t('ai_components.copyText')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AINoticeGenerator;
