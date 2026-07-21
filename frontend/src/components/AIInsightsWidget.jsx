import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAIInsights } from '../services/api';
import { FaRobot, FaLightbulb, FaSpinner } from 'react-icons/fa';

const AIInsightsWidget = () => {
  const { i18n } = useTranslation();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        const res = await getAIInsights(i18n.language);
        if (res.success && res.insights) {
          setInsights(res.insights);
        } else {
          setInsights([
            "💡 Monitor weekly classroom averages closely.",
            "💡 Review pending leave approvals today.",
            "💡 Co-align mid-day meal metrics to raise Friday attendance."
          ]);
        }
      } catch (err) {
        console.error(err);
        setInsights([
          "💡 Monitor weekly classroom averages closely.",
          "💡 Review pending leave approvals today.",
          "💡 Co-align mid-day meal metrics to raise Friday attendance."
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [i18n.language]);

  return (
    <div className="bg-gradient-to-r from-[#1B5E20] to-[#2E7D32] text-white rounded-3xl p-5 shadow-lg border border-green-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans">
      <div className="flex items-center gap-3.5">
        <span className="p-3 bg-white bg-opacity-10 text-green-200 rounded-2xl flex items-center justify-center border border-white border-opacity-10 shadow-inner">
          <FaRobot className="text-2xl animate-bounce" />
        </span>
        <div>
          <h3 className="text-sm font-black tracking-wide uppercase">AI Recommendations & Action Items</h3>
          <p className="text-[11px] text-green-100 font-semibold mt-0.5">Real-time attendance advice and system analysis.</p>
        </div>
      </div>

      <div className="flex-1 max-w-lg">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-green-100 font-bold justify-center py-2">
            <FaSpinner className="animate-spin" />
            <span>Analyzing attendance registers...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {insights.slice(0, 3).map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs font-bold leading-normal text-green-50 bg-white bg-opacity-5 p-1.5 rounded-xl border border-white border-opacity-5">
                <span className="text-sm shrink-0">💡</span>
                <p>{insight.replace(/^💡\s*/, '')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsightsWidget;
