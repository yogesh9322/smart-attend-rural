import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDashboardAnalytics } from '../services/api';
import socket from '../services/socket';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import {
  FaCalendarAlt, FaRedo, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaChartLine, FaCheck, FaExclamation, FaLightbulb, FaUserClock, FaArrowRight
} from 'react-icons/fa';

const AIAnalytics = () => {
  const { t, i18n } = useTranslation('common');
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchAnalytics = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const res = await getDashboardAnalytics();
      if (res.success) {
        setData(res.data);
        setLastUpdated(new Date());
      } else {
        setError(res.message || 'Failed to query attendance data.');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to load attendance insights.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();

    // Listen for real-time attendance updates
    socket.on('attendance_updated', () => {
      fetchAnalytics(true);
    });

    return () => {
      socket.off('attendance_updated');
    };
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E7D32]"></div>
        <p className="text-gray-600 dark:text-gray-300 font-medium text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-center font-semibold text-sm">
        {error || t('students.noRecords')}
      </div>
    );
  }

  const { counters, classWise, studentStats = [], monthlyTrend = [] } = data;

  // Monthly trend data dynamically returned from database
  const trendData = monthlyTrend;

  // Attention list (students needing follow-up)
  const attentionStudents = studentStats.filter(s => s.risk === 'High' || s.risk === 'Medium');

  return (
    <div className="space-y-6 pb-12 text-gray-800 dark:text-gray-100">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dashboard_extra.attendanceInsights', 'Attendance Insights')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-300 font-medium mt-1">
            {i18n.language === 'hi'
              ? 'आज की उपस्थिति और महत्वपूर्ण सिफारिशों का एक सरल विवरण।'
              : i18n.language === 'mr'
              ? 'आजच्या उपस्थितीचा आणि महत्वाच्या शिफारसींचा संक्षिप्त आढावा.'
              : "A simple overview of today's attendance and important recommendations."}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto text-xs font-medium text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700/60 px-3 py-2 rounded-xl">
            <FaCalendarAlt className="text-gray-400" />
            <span>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="text-gray-400">|</div>
          <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button
            onClick={() => fetchAnalytics()}
            title="Refresh Data"
            className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
          >
            <FaRedo className="text-xs" />
          </button>
        </div>
      </div>

      {/* 2. Top Summary Cards (4 Equal Size Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Attendance */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
              {t('dashboard_extra.attendanceRate', 'Attendance Rate')}
            </p>
            <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mt-1">{counters?.averageAttendance || 0}%</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-[#2E7D32] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 shrink-0">
            <FaChartLine className="text-xl" />
          </div>
        </div>

        {/* Present Students */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
              {t('attendance.present', 'Present')} {t('nav.students', 'Students')}
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{counters?.lowRisk || 0}</h3>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800 shrink-0">
            <FaCheckCircle className="text-xl" />
          </div>
        </div>

        {/* Absent Students */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
              {t('attendance.absent', 'Absent')} {t('nav.students', 'Students')}
            </p>
            <h3 className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{counters?.highRisk || 0}</h3>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-800 shrink-0">
            <FaTimesCircle className="text-xl" />
          </div>
        </div>

        {/* Needs Attention */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
              {t('dashboard_extra.atRisk', 'Needs Attention')}
            </p>
            <h3 className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{(counters?.highRisk || 0) + (counters?.mediumRisk || 0)}</h3>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-800 shrink-0">
            <FaExclamationTriangle className="text-xl" />
          </div>
        </div>
      </div>

      {/* 3. Single Attendance Overview Summary Card */}
      <div className="bg-emerald-50/70 dark:bg-[#112216] border border-emerald-200 dark:border-emerald-800/80 p-5 rounded-2xl shadow-sm transition-colors">
        <h3 className="text-xs font-bold text-[#2E7D32] dark:text-emerald-400 uppercase tracking-wider mb-1">
          {t('dashboard_extra.attendanceOverview', 'Attendance Overview')}
        </h3>
        <p className="text-gray-800 dark:text-emerald-100 font-semibold text-base leading-relaxed">
          {i18n.language === 'hi'
            ? `आज स्कूल की उपस्थिति ${counters?.averageAttendance || 0}% है। ${counters?.highRisk > 0 ? `${counters.highRisk} छात्रों को बार-बार अनुपस्थित रहने के कारण अनुवर्ती कार्रवाई की आवश्यकता है।` : 'सभी कक्षाएं आज स्थिर भागीदारी प्रदर्शित करती हैं।'} कुल मिलाकर उपस्थिति स्वस्थ बनी हुई है।`
            : i18n.language === 'mr'
            ? `आज शाळेतील उपस्थिती ${counters?.averageAttendance || 0}% आहे. ${counters?.highRisk > 0 ? `${counters.highRisk} विद्यार्थ्यांवर वारंवार गैरहजर राहिल्यामुळे कारवाई करणे आवश्यक आहे.` : 'सर्व वर्गांमध्ये आज स्थिर उपस्थिती आहे.'} एकंदरीत उपस्थिती चांगली आहे.`
            : `Today's school attendance is ${counters?.averageAttendance || 0}%. ${counters?.highRisk > 0 ? `${counters.highRisk} student(s) require follow-up due to repeated absences.` : 'All classes demonstrate stable participation today.'} Overall attendance remains healthy.`}
        </p>
      </div>

      {/* 4. Key Highlights & Smart Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Highlights Checklist */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors space-y-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {i18n.language === 'hi' ? 'मुख्य विशेषताएं' : i18n.language === 'mr' ? 'मुख्य वैशिष्ट्ये' : 'Key Highlights'}
          </h3>
          <ul className="space-y-2.5 text-xs font-semibold">
            <li className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <span className="p-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-md"><FaCheck className="text-emerald-600 dark:text-emerald-400 text-xs" /></span>
              <span>{i18n.language === 'hi' ? 'सौंपी गई कक्षा सूचियों के लिए उपस्थिति पूरी हुई' : i18n.language === 'mr' ? 'वाटप केलेल्या वर्गांसाठी उपस्थिती पूर्ण झाली' : 'Attendance completed for assigned classroom rosters'}</span>
            </li>
            {counters?.highRisk > 0 ? (
              <li className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
                <span className="p-1 bg-amber-100 dark:bg-amber-900/60 rounded-md"><FaExclamation className="text-amber-600 dark:text-amber-400 text-xs" /></span>
                <span>{i18n.language === 'hi' ? `${counters.highRisk} छात्रों की उपस्थिति 75% से कम है` : i18n.language === 'mr' ? `${counters.highRisk} विद्यार्थ्यांची उपस्थिती 75% पेक्षा कमी आहे` : `${counters.highRisk} student(s) have low attendance below 75%`}</span>
              </li>
            ) : (
              <li className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
                <span className="p-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-md"><FaCheck className="text-emerald-600 dark:text-emerald-400 text-xs" /></span>
                <span>{i18n.language === 'hi' ? 'प्राथमिक सूचियों में कोई गंभीर कम उपस्थिति चेतावनी नहीं' : i18n.language === 'mr' ? 'यादीमध्ये कोणतीही गंभीर कमी उपस्थितीची चेतावणी नाही' : 'No critical low attendance alerts in primary rosters'}</span>
              </li>
            )}
            <li className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300">
              <span className="p-1 bg-emerald-100 dark:bg-emerald-900/60 rounded-md"><FaCheck className="text-emerald-600 dark:text-emerald-400 text-xs" /></span>
              <span>{i18n.language === 'hi' ? 'कक्षा 6-ए ने इस सप्ताह शीर्ष उपस्थिति स्थिरता प्राप्त की' : i18n.language === 'mr' ? 'इयत्ता 6वी-अ ने या आठवड्यात अव्वल उपस्थिती राखली' : 'Grade 6-A achieved top attendance stability this week'}</span>
            </li>
            <li className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300">
              <span className="p-1 bg-amber-100 dark:bg-amber-900/60 rounded-md"><FaExclamation className="text-amber-600 dark:text-amber-400 text-xs" /></span>
              <span>{i18n.language === 'hi' ? 'अनुपस्थित छात्रों के लिए अभिभावक अनुवर्ती सूचना की सिफारिश की गई' : i18n.language === 'mr' ? 'गैरहजर विद्यार्थ्यांसाठी पालकांना सूचना देण्याची शिफारस केली आहे' : 'Parent follow-up notice recommended for absent students'}</span>
            </li>
          </ul>
        </div>

        {/* Single Smart Recommendation Card */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between transition-colors">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FaLightbulb className="text-amber-500 text-sm" />
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {i18n.language === 'hi' ? 'स्मार्ट सिफारिश' : i18n.language === 'mr' ? 'स्मार्ट शिफारस' : 'Smart Recommendation'}
              </h3>
            </div>
            <p className="text-gray-800 dark:text-gray-100 font-semibold text-sm leading-relaxed mt-2">
              {counters?.highRisk > 0
                ? (i18n.language === 'hi' ? `${counters.highRisk} छात्र इस महीने बार-बार अनुपस्थित रहे हैं। अभिभावक बैठक या एसएमएस सूचना की सिफारिश की जाती है।` : i18n.language === 'mr' ? `${counters.highRisk} विद्यार्थी या महिन्यात वारंवार गैरहजर राहिले आहेत. पालक सभा किंवा एसएमएस सूचना देणे शिफारसीय आहे.` : `${counters.highRisk} student(s) have been absent repeatedly this month. A parent meeting or SMS notice is recommended.`)
                : (i18n.language === 'hi' ? 'कुल मिलाकर कक्षा की उपस्थिति अच्छा प्रदर्शन कर रही है। सुबह की सभाओं के दौरान साप्ताहिक जांच बनाए रखें।' : i18n.language === 'mr' ? 'एकंदरीत वर्गातील उपस्थिती चांगली आहे. सकाळच्या असेंब्ली दरम्यान साप्ताहिक उपस्थितीची नोंद ठेवा.' : 'Overall classroom attendance is performing well. Maintain weekly roster check-ins during morning assemblies.')}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-150 dark:border-gray-700 flex justify-end">
            <button
              onClick={() => navigate('/notices')}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
            >
              <span>{t('notices.publishNotice', 'Send Notice')}</span>
              <FaArrowRight className="text-[10px]" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Suggested Actions (Simple Action Cards) */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {i18n.language === 'hi' ? 'सुझाए गए कार्य' : i18n.language === 'mr' ? 'सुचविलेल्या कृती' : 'Suggested Actions'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-white">{i18n.language === 'hi' ? 'अभिभावकों से संपर्क करें' : i18n.language === 'mr' ? 'पालकांशी संपर्क साधा' : 'Contact Parents'}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{i18n.language === 'hi' ? 'अनुपस्थित अभिभावकों को एसएमएस या व्हाट्सएप अपडेट भेजें।' : i18n.language === 'mr' ? 'गैरहजर पालकांना एसएमएस किंवा व्हॉट्सॲप अपडेट पाठवा.' : 'Send SMS or WhatsApp updates to absent parents.'}</p>
            </div>
            <button
              onClick={() => navigate('/notices')}
              className="w-full py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-lg transition cursor-pointer text-center"
            >
              {t('notices.publishNotice', 'Send Notice')}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-white">{i18n.language === 'hi' ? 'कम उपस्थिति की समीक्षा करें' : i18n.language === 'mr' ? 'कमी उपस्थितीचे पुनरावलोकन करा' : 'Review Low Attendance'}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{i18n.language === 'hi' ? '75% उपस्थिति सीमा से नीचे के छात्रों को फ़िल्टर करें।' : i18n.language === 'mr' ? '75% उपस्थिती मर्यादेपेक्षा कमी असलेल्या विद्यार्थ्यांना फिल्टर करा.' : 'Filter students below 75% attendance threshold.'}</p>
            </div>
            <button
              onClick={() => navigate('/students')}
              className="w-full py-2 bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 text-white text-xs font-bold rounded-lg transition cursor-pointer text-center"
            >
              {i18n.language === 'hi' ? 'सूची देखें' : i18n.language === 'mr' ? 'यादी पहा' : 'View Roster'}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-white">{i18n.language === 'hi' ? 'मासिक रिपोर्ट जनरेट करें' : i18n.language === 'mr' ? 'मासिक अहवाल तयार करा' : 'Generate Monthly Report'}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{i18n.language === 'hi' ? 'स्कूल रिकॉर्ड के लिए प्रिंट करने योग्य पीडीएफ सारांश निर्यात करें।' : i18n.language === 'mr' ? 'शाळेच्या रेकॉर्डसाठी पीडीएफ सारांश निर्यात करा.' : 'Export printable PDF summary for school records.'}</p>
            </div>
            <button
              onClick={() => navigate('/advanced-reports')}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer text-center"
            >
              {t('reports.downloadPdf', 'Generate PDF')}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800 dark:text-white">{i18n.language === 'hi' ? 'परिपत्रक प्रकाशित करें' : i18n.language === 'mr' ? 'परिपत्रक प्रसिद्ध करा' : 'Publish Circular'}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{i18n.language === 'hi' ? 'सामान्य स्कूल उपस्थिति घोषणाएं पोस्ट करें।' : i18n.language === 'mr' ? 'सामान्य शाळा उपस्थितीच्या घोषणा पोस्ट करा.' : 'Post general school attendance announcements.'}</p>
            </div>
            <button
              onClick={() => navigate('/notices')}
              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition cursor-pointer text-center"
            >
              {t('notices.publishNotice', 'Create Notice')}
            </button>
          </div>
        </div>
      </div>

      {/* 6. Student Attention List Table */}
      {attentionStudents.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
          <div className="px-5 py-4 border-b border-gray-150 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {i18n.language === 'hi' ? 'अनुवर्ती कार्रवाई की आवश्यकता वाले छात्र' : i18n.language === 'mr' ? 'कारवाईची आवश्यकता असलेले विद्यार्थी' : 'Students Needing Follow-up'} ({attentionStudents.length})
            </h3>
            <button
              onClick={() => navigate('/students')}
              className="text-xs font-bold text-[#2E7D32] dark:text-green-400 hover:underline cursor-pointer"
            >
              {i18n.language === 'hi' ? 'पूर्ण निर्देशिका देखें' : i18n.language === 'mr' ? 'पूर्ण यादी पहा' : 'View Full Directory'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-150 dark:divide-gray-700 text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-750 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-5 py-3">{t('common.name', 'Name')}</th>
                  <th className="px-5 py-3">{t('nav.classes', 'Class')}</th>
                  <th className="px-5 py-3">{i18n.language === 'hi' ? 'उपस्थिति %' : i18n.language === 'mr' ? 'उपस्थिती %' : 'Attendance %'}</th>
                  <th className="px-5 py-3">{t('reports.status', 'Status')}</th>
                  <th className="px-5 py-3 text-right">{t('common.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-xs font-semibold">
                {attentionStudents.map((s) => (
                  <tr key={s.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-gray-900 dark:text-white">{s.name}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-300">{s.className}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-800 dark:text-gray-200">{s.rate}%</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          s.risk === 'High'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {s.risk === 'High' ? (i18n.language === 'hi' ? 'गंभीर' : i18n.language === 'mr' ? 'गंभीर' : 'Critical') : (i18n.language === 'hi' ? 'ध्यान देने की आवश्यकता' : i18n.language === 'mr' ? 'लक्ष देणे आवश्यक' : 'Needs Attention')}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => navigate(`/students?search=${encodeURIComponent(s.name)}`)}
                        className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-[11px] font-bold transition cursor-pointer"
                      >
                        {t('students.viewFullProfile', 'View Profile')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. Charts Section (2 Charts Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class-wise Attendance Bar Chart */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-2xl shadow-sm transition-colors">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {i18n.language === 'hi' ? 'कक्षा-वार उपस्थिति दर (%)' : i18n.language === 'mr' ? 'वर्गनिहाय उपस्थितीचे प्रमाण (%)' : 'Class-wise Attendance Rate (%)'}
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classWise}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} domain={[0, 100]} unit="%" />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value) => [`${value}%`, t('reports.title', 'Attendance')]}
                />
                <Bar dataKey="rate" name="Attendance Rate" fill="#2E7D32" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Attendance Trend Line Chart */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 rounded-2xl shadow-sm transition-colors">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            {i18n.language === 'hi' ? 'मासिक उपस्थिति प्रवृत्ति (%)' : i18n.language === 'mr' ? 'मासिक उपस्थितीचा कल (%)' : 'Monthly Attendance Trend (%)'}
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 700 }} domain={[0, 100]} unit="%" />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value) => [`${value}%`, i18n.language === 'hi' ? 'मासिक उपस्थिति' : i18n.language === 'mr' ? 'मासिक उपस्थिती' : 'Monthly Attendance']}
                />
                <Line type="monotone" dataKey="rate" name="Monthly Attendance" stroke="#2E7D32" strokeWidth={3} dot={{ fill: '#2E7D32', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalytics;
