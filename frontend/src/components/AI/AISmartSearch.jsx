import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { executeNaturalLanguageSearch } from '../../services/api';
import { FaRobot, FaSearch, FaSpinner, FaTimes } from 'react-icons/fa';

const AISmartSearch = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [msg, setMsg] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResults(null);
    setMsg('');

    try {
      const res = await executeNaturalLanguageSearch(query);
      if (res.success) {
        setResults(res.data);
        setMsg(res.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative font-sans no-print w-full max-w-md">
      <form onSubmit={handleSearch} className="flex items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary">
        <input
          type="text"
          placeholder={t('ai_components.smartSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 pl-4 pr-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-105 bg-gray-50 dark:bg-gray-800 focus:outline-none placeholder-gray-400"
        />
        <button
          type="submit"
          className="px-3.5 py-2 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-white transition cursor-pointer"
        >
          {loading ? <FaSpinner className="animate-spin text-xs" /> : <FaSearch className="text-xs" />}
        </button>
      </form>

      {/* Results Dropdown */}
      {results && (
        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-[10px] font-extrabold text-[#2E7D32] bg-green-50 px-2 py-0.5 rounded uppercase tracking-wider">{t('ai_components.searchResultHeader')}</span>
            <button
              onClick={() => setResults(null)}
              className="text-gray-400 hover:text-gray-650 dark:hover:text-white p-1"
            >
              <FaTimes className="text-[10px]" />
            </button>
          </div>
          <p className="text-xs font-extrabold text-gray-800 dark:text-white">{msg}</p>

          <div className="space-y-2">
            {results.map((item, idx) => (
              <div key={idx} className="p-2 border border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-850 bg-opacity-30 dark:bg-opacity-20 text-[11px] font-semibold text-gray-705 dark:text-gray-300">
                <p className="text-gray-900 dark:text-white font-bold">{item.name || 'Student'}</p>
                {item.rollNo && <p className="text-[10px] text-gray-400 dark:text-gray-450 mt-0.5">{t('ai_components.rollNo')}: {item.rollNo} {item.class && `| ${t('ai_components.class')}: ${item.class}`}</p>}
                {item.rate && <p className="text-[10px] text-red-650 font-bold mt-1">{t('ai_components.attendance')}: {item.rate}%</p>}
                {item.dates && <p className="text-[10px] text-gray-500 mt-1">{t('ai_components.leaveDates')}: {item.dates}</p>}
                {item.reason && <p className="text-[10px] text-gray-400 italic mt-0.5">"{t('ai_components.reason')}: {item.reason}"</p>}
              </div>
            ))}
            {results.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center py-4">{t('ai_components.noMatchingRecords')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AISmartSearch;
