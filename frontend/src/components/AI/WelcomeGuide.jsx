import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getAISummary } from '../../services/api';
import { FaRobot, FaSun, FaSpinner } from 'react-icons/fa';

const WelcomeGuide = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailySummary = async () => {
      try {
        setLoading(true);
        const res = await getAISummary({ lang: i18n.language });
        if (res.success) {
          setSummary(res.summary);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchDailySummary();
  }, [user, i18n.language]);

  if (!user) return null;

  return (
    <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-start gap-4 font-sans mb-6">
      <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center justify-center shrink-0">
        <FaSun className="text-xl animate-spin-slow" />
      </div>
      
      <div className="flex-1 space-y-2">
        <h2 className="text-lg font-black text-gray-800">
          Good day, {user.name}!
        </h2>
        <p className="text-xs text-gray-500 font-semibold leading-relaxed">
          Here is your SmartAttend AI morning update digest:
        </p>

        {loading ? (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold py-2">
            <FaSpinner className="animate-spin text-[#2E7D32]" />
            <span>Assembling daily parameters...</span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-gray-650 leading-relaxed whitespace-pre-line bg-gray-50 p-3 rounded-2xl border border-gray-100 mt-2">
            {summary || "No notices or updates recorded for today. Keep tracking classrooms attendance!"}
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeGuide;
