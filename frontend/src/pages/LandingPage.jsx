import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Wifi,
  Smartphone,
  BarChart3,
  Users,
  ShieldCheck,
  CheckCircle,
  FileSpreadsheet,
  Cpu,
  Star,
  ChevronDown,
  Menu,
  X,
  School,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Lock,
  LineChart,
  UserCheck2,
  CalendarDays,
  Bot,
  Globe,
  Mic,
  Volume2,
  MessageSquare
} from 'lucide-react';

const LandingPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFAQ, setActiveFAQ] = useState(null);
  const [previewTab, setPreviewTab] = useState('admin');

  // Track page scroll to toggle sticky header background
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleFAQ = (idx) => {
    setActiveFAQ(activeFAQ === idx ? null : idx);
  };

  const faqData = [
    {
      q: t('landing.faq1Q'),
      a: t('landing.faq1A')
    },
    {
      q: t('landing.faq2Q'),
      a: t('landing.faq2A')
    },
    {
      q: t('landing.faq3Q'),
      a: t('landing.faq3A')
    },
    {
      q: t('landing.faq4Q'),
      a: t('landing.faq4A')
    },
    {
      q: t('landing.faq5Q'),
      a: t('landing.faq5A')
    }
  ];

  const languagesList = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans antialiased overflow-x-hidden">
      {/* Sticky Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="p-2 bg-[#2E7D32] rounded-xl text-white shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-black text-gray-800 tracking-wider leading-none uppercase">
                {t('landing.logo')}
              </span>
              <span className="text-[9px] text-[#2E7D32] font-extrabold mt-1 hidden sm:block">
                {t('landing.tagline')}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-gray-650 uppercase tracking-wider">
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#2E7D32] transition-colors">{t('landing.home')}</a>
            <a href="#features" className="hover:text-[#2E7D32] transition-colors">{t('landing.features')}</a>
            <a href="#how" className="hover:text-[#2E7D32] transition-colors">{t('landing.howItWorks')}</a>
            <a href="#ai-assistant" className="hover:text-[#2E7D32] transition-colors">{t('landing.aiAssistant')}</a>
            <a href="#why" className="hover:text-[#2E7D32] transition-colors">{t('landing.about')}</a>
            <a href="#cta" className="hover:text-[#2E7D32] transition-colors">{t('landing.contact')}</a>
          </nav>

          {/* Desktop Call to Actions */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Language Dropdown Selector */}
            <div className="relative" onMouseLeave={() => setLangOpen(false)}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-2 border border-[#2E7D32] rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer transition-colors"
              >
                <span>🌐</span>
                <span>{languagesList.find(l => l.code === i18n.language)?.name || 'English'}</span>
                <span className="text-[8px] text-[#2E7D32]">▼</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 mt-1.5 w-32 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
                  {languagesList.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2 text-xs font-bold text-[#2E7D32] hover:text-[#1B5E20] transition-colors cursor-pointer uppercase tracking-wider"
            >
              {t('landing.login')}
            </button>
          </div>

          {/* Hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-b border-gray-150 px-4 pt-2 pb-6 space-y-4 shadow-lg"
            >
              <nav className="flex flex-col gap-3.5 text-xs font-bold text-gray-650 uppercase tracking-wider">
                <a href="#" onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-[#2E7D32]">{t('landing.home')}</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#2E7D32]">{t('landing.features')}</a>
                <a href="#how" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#2E7D32]">{t('landing.howItWorks')}</a>
                <a href="#ai-assistant" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#2E7D32]">{t('landing.aiAssistant')}</a>
                <a href="#why" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#2E7D32]">{t('landing.about')}</a>
                <a href="#cta" onClick={() => setMobileMenuOpen(false)} className="hover:text-[#2E7D32]">{t('landing.contact')}</a>
              </nav>
              
              {/* Mobile Language Selector */}
              <div className="border-t border-gray-150 pt-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Language</span>
                <div className="flex gap-2">
                  {languagesList.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex-1 py-2 text-xs font-bold text-center border rounded-xl cursor-pointer ${
                        i18n.language === lang.code
                          ? 'border-[#2E7D32] bg-green-50 text-[#2E7D32]'
                          : 'border-gray-200 text-gray-650'
                      }`}
                    >
                      {lang.flag} {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-gray-150">
                <button
                  onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-center text-[#2E7D32] bg-green-50 border border-green-150 rounded-xl"
                >
                  {t('landing.login')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12">
        {/* Left Info Column */}
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
              {t('landing.heroTitle')}
            </h2>
          </motion.div>

          <p className="text-base sm:text-lg text-[#64748B] leading-relaxed font-medium">
            {t('landing.heroSubtitle')}
          </p>

          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer border border-[#2E7D32]"
            >
              <span>{t('landing.heroGetStarted')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const previewSec = document.getElementById('previews');
                previewSec?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-3.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl border border-gray-300 shadow-sm transition-all cursor-pointer"
            >
              {t('landing.heroWatchDemo')}
            </button>
          </div>

          {/* Bullets grid */}
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 pt-4 text-xs font-bold text-gray-600 text-left max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-[#2E7D32] w-4.5 h-4.5" />
              <span>✔ {t('landing.bulletOffline')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-[#2E7D32] w-4.5 h-4.5" />
              <span>✔ {t('landing.bulletAi')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-[#2E7D32] w-4.5 h-4.5" />
              <span>✔ {t('landing.bulletSecure')}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-[#2E7D32] w-4.5 h-4.5" />
              <span>✔ {t('landing.bulletParent')}</span>
            </div>
          </div>
        </div>

        {/* Right CSS School dashboard Illustration */}
        <div className="flex-1 w-full max-w-md lg:max-w-none flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative w-full aspect-video bg-gradient-to-tr from-green-50 to-[#e8f5e9] border border-green-150 rounded-2xl p-6 shadow-xl flex flex-col justify-between overflow-hidden"
          >
            {/* Soft blurred background shape */}
            <div className="absolute top-[-30px] right-[-30px] w-40 h-40 bg-[#2E7D32] bg-opacity-10 rounded-full blur-2xl" />
            
            {/* Fake Dashboard header */}
            <div className="flex justify-between items-center pb-4 border-b border-green-200 border-opacity-50">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-[10px] font-bold text-green-700 tracking-widest uppercase">{t('landing.activeView')}</span>
            </div>

            {/* Illustration Elements */}
            <div className="flex-1 grid grid-cols-3 gap-4 pt-4">
              {/* Box 1: Teacher taking attendance */}
              <div className="p-3 bg-white border border-green-100 rounded-xl flex flex-col justify-between shadow-sm">
                <Users className="text-[#2E7D32] w-5 h-5" />
                <div>
                  <h4 className="text-[10px] font-bold text-gray-800">{t('landing.rollCall')}</h4>
                  <p className="text-[8px] text-gray-400 mt-0.5">38/40 {t('landing.marked')}</p>
                </div>
              </div>

              {/* Box 2: Dashboard Analytics card */}
              <div className="p-3 bg-white border border-green-100 rounded-xl flex flex-col justify-between shadow-sm">
                <BarChart3 className="text-secondary w-5 h-5" />
                <div>
                  <h4 className="text-[10px] font-bold text-gray-800">{t('landing.attendance')}</h4>
                  <p className="text-[8px] text-green-600 font-bold mt-0.5">95% {t('landing.dailyAvg')}</p>
                </div>
              </div>

              {/* Box 3: Parent receiving notifications */}
              <div className="p-3 bg-[#2E7D32] text-white rounded-xl flex flex-col justify-between shadow-sm">
                <Smartphone className="text-green-200 w-5 h-5" />
                <div>
                  <h4 className="text-[10px] font-bold">{t('landing.smsSent')}</h4>
                  <p className="text-[8px] text-green-100 mt-0.5">{t('landing.smsSentDesc')}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 text-center text-[10px] text-green-650 font-bold italic">
              {t('landing.empowering')}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bg-white border-y border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: t('landing.statsSchools'), count: '100+', icon: <School className="text-[#2E7D32]" /> },
            { label: t('landing.statsSaved'), count: '10 Min', icon: <TrendingUp className="text-[#2E7D32]" /> },
            { label: t('landing.statsOffline'), count: '100%', icon: <Wifi className="text-[#2E7D32]" /> },
            { label: t('landing.statsAlerts'), count: '24×7', icon: <Smartphone className="text-[#2E7D32]" /> },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:shadow-md transition-shadow">
              <div className="p-3 bg-white border border-gray-150 rounded-2xl mb-3">
                {item.icon}
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-800 leading-none">{item.count}</h3>
              <p className="text-xs text-[#64748B] mt-1.5 font-semibold uppercase tracking-wider">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.coreFeatures')}</span>
          <h2 className="text-3xl font-bold text-gray-800">{t('landing.featuresTitle')}</h2>
          <p className="text-sm text-gray-500 max-w-lg mx-auto font-medium">
            {t('landing.featuresSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { title: t('landing.feat1Title'), desc: t('landing.feat1Desc'), icon: <UserCheck className="text-white" />, color: 'bg-[#2E7D32]' },
            { title: t('landing.feat2Title'), desc: t('landing.feat2Desc'), icon: <Wifi className="text-white" />, color: 'bg-secondary' },
            { title: t('landing.feat3Title'), desc: t('landing.feat3Desc'), icon: <Smartphone className="text-white" />, color: 'bg-amber-600' },
            { title: t('landing.feat4Title'), desc: t('landing.feat4Desc'), icon: <FileSpreadsheet className="text-white" />, color: 'bg-emerald-600' },
            { title: t('landing.feat5Title'), desc: t('landing.feat5Desc'), icon: <BarChart3 className="text-white" />, color: 'bg-blue-600' },
            { title: t('landing.feat6Title'), desc: t('landing.feat6Desc'), icon: <ShieldCheck className="text-white" />, color: 'bg-green-700' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-all duration-200">
              <div className="space-y-4">
                <div className={`w-11 h-11 ${item.color} rounded-2xl flex items-center justify-center shadow-sm`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800">{item.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed font-medium">{item.desc}</p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="mt-5 text-xs font-bold text-[#2E7D32] hover:text-[#1B5E20] flex items-center gap-1 cursor-pointer"
              >
                <span>{t('landing.learnMore')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Why SmartAttend Rural Section */}
      <section id="why" className="bg-white border-y border-gray-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
          {/* Left Column Illustration */}
          <div className="flex-1 w-full max-w-sm lg:max-w-none flex justify-center">
            <div className="w-full aspect-square max-w-[360px] bg-gradient-to-br from-green-50 to-[#e8f5e9] border border-green-150 rounded-full flex items-center justify-center p-8 shadow-inner">
              <School className="w-32 h-32 text-[#2E7D32]" />
            </div>
          </div>

          {/* Right Column Bullet list */}
          <div className="flex-1 space-y-6">
            <div className="space-y-3 text-center lg:text-left">
              <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.whyChoose')}</span>
              <h2 className="text-3xl font-bold text-gray-800">{t('landing.whyTitle')}</h2>
              <p className="text-sm text-gray-500 font-medium">
                {t('landing.whySubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-semibold text-gray-700">
              {[
                t('landing.why1'),
                t('landing.why2'),
                t('landing.why3'),
                t('landing.why4'),
                t('landing.why5'),
                t('landing.why6'),
                t('landing.why7'),
                t('landing.why8'),
              ].map((bullet, idx) => (
                <div key={idx} className="flex items-center gap-2 text-left">
                  <CheckCircle className="text-[#2E7D32] w-4.5 h-4.5 shrink-0" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>

            <div className="text-center lg:text-left pt-2">
              <button
                onClick={() => {
                  const featuresSec = document.getElementById('features');
                  featuresSec?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer border border-[#2E7D32]"
              >
                {t('landing.whyBtn')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.processFlow')}</span>
          <h2 className="text-3xl font-bold text-gray-800">{t('landing.howTitle')}</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">
            {t('landing.howSubtitle')}
          </p>
        </div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 relative">
          {[
            { step: '01', title: t('landing.step1Title'), desc: t('landing.step1Desc'), icon: <Users /> },
            { step: '02', title: t('landing.step2Title'), desc: t('landing.step2Desc'), icon: <Lock /> },
            { step: '03', title: t('landing.step3Title'), desc: t('landing.step3Desc'), icon: <UserCheck2 /> },
            { step: '04', title: t('landing.step4Title'), desc: t('landing.step4Desc'), icon: <Smartphone /> },
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm relative flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="absolute top-4 right-4 text-3xl font-black text-green-100 leading-none">{item.step}</span>
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-150 text-[#2E7D32] flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="text-base font-bold text-gray-800">{item.title}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed font-medium">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Roles Section */}
      <section id="roles" className="bg-white border-y border-gray-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.rolesTitle')}</span>
            <h2 className="text-3xl font-bold text-gray-800">{t('landing.rolesHeading')}</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">
              {t('landing.rolesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Admin */}
            <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-gray-150 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-green-50 border border-green-150 text-[#2E7D32] flex items-center justify-center font-bold">A</div>
                <h3 className="text-lg font-bold text-gray-800">{t('landing.roleAdmin')}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed font-medium">{t('landing.roleAdminDesc')}</p>
                <ul className="text-xs font-bold text-gray-650 space-y-2 border-t border-gray-200 pt-4">
                  <li className="flex items-center gap-2">✔ {t('landing.roleAdminB1')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleAdminB2')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleAdminB3')}</li>
                </ul>
              </div>
            </div>

            {/* Teacher */}
            <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-gray-150 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-150 text-secondary flex items-center justify-center font-bold">T</div>
                <h3 className="text-lg font-bold text-gray-800">{t('landing.roleTeacher')}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed font-medium">{t('landing.roleTeacherDesc')}</p>
                <ul className="text-xs font-bold text-gray-650 space-y-2 border-t border-gray-200 pt-4">
                  <li className="flex items-center gap-2">✔ {t('landing.roleTeacherB1')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleTeacherB2')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleTeacherB3')}</li>
                </ul>
              </div>
            </div>

            {/* Parent */}
            <div className="bg-[#F8FAFC] p-6 rounded-2xl border border-gray-150 hover:shadow-md transition-shadow flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-yellow-50 border border-yellow-150 text-amber-600 flex items-center justify-center font-bold">P</div>
                <h3 className="text-lg font-bold text-gray-800">{t('landing.roleParent')}</h3>
                <p className="text-xs text-[#64748B] leading-relaxed font-medium">{t('landing.roleParentDesc')}</p>
                <ul className="text-xs font-bold text-gray-650 space-y-2 border-t border-gray-200 pt-4">
                  <li className="flex items-center gap-2">✔ {t('landing.roleParentB1')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleParentB2')}</li>
                  <li className="flex items-center gap-2">✔ {t('landing.roleParentB3')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="ai" className="bg-[#1A251D] text-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-green-300 text-xs font-bold uppercase tracking-widest bg-green-900 border border-green-850 px-3 py-1 rounded-full bg-opacity-40">{t('landing.aiPreview')}</span>
            <h2 className="text-3xl font-bold text-white">{t('landing.aiTitle')}</h2>
            <p className="text-sm text-green-200 max-w-md mx-auto font-medium">
              {t('landing.aiSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: t('landing.ai1Title'), desc: t('landing.ai1Desc'), isSoon: true },
              { title: t('landing.ai2Title'), desc: t('landing.ai2Desc'), isSoon: true },
              { title: t('landing.ai3Title'), desc: t('landing.ai3Desc'), isSoon: true },
              { title: t('landing.ai4Title'), desc: t('landing.ai4Desc'), isSoon: true },
            ].map((item, idx) => (
              <div key={idx} className="bg-green-950 bg-opacity-40 p-5 rounded-2xl border border-green-900 flex flex-col justify-between h-44">
                <div className="space-y-2.5">
                  <div className="w-8 h-8 rounded-xl bg-green-900 bg-opacity-50 text-green-300 flex items-center justify-center">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="text-[11px] text-green-150 leading-relaxed font-medium">{item.desc}</p>
                </div>
                {item.isSoon && (
                  <span className="text-[8px] font-bold text-green-300 bg-green-900 bg-opacity-60 border border-green-800 px-2 py-0.5 rounded-full uppercase w-fit">
                    {t('landing.comingSoon')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview mockup screenshots Section */}
      <section id="previews" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.interactive')}</span>
          <h2 className="text-3xl font-bold text-gray-800">{t('landing.visualizing')}</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">
            {t('landing.mockSubtitle')}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center border-b border-gray-200">
          {[
            { label: t('landing.tabAdmin'), id: 'admin' },
            { label: t('landing.tabTeacher'), id: 'teacher' },
            { label: t('landing.tabParent'), id: 'parent' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPreviewTab(tab.id)}
              className={`px-6 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer uppercase tracking-wider ${
                previewTab === tab.id
                  ? 'border-[#2E7D32] text-[#2E7D32]'
                  : 'border-transparent text-gray-400 hover:text-gray-650'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Laptop frame mockup */}
        <div className="max-w-4xl mx-auto bg-gray-900 border-4 border-gray-800 rounded-3xl p-3 shadow-2xl relative overflow-hidden aspect-video">
          <div className="w-full h-full bg-[#F8FAFC] rounded-2xl overflow-hidden flex flex-col p-4">
            {/* Header placeholder */}
            <div className="h-8 border-b border-gray-200 flex justify-between items-center px-3 mb-3 text-[9px] font-bold text-gray-400">
              <div className="flex items-center gap-1">
                <School className="w-3.5 h-3.5 text-[#2E7D32]" />
                <span className="text-gray-700">{t('landing.logo')} Preview</span>
              </div>
              <span className="px-2 py-0.5 bg-green-50 text-primary border border-green-150 rounded-full font-extrabold uppercase scale-90">
                Mock active
              </span>
            </div>

            {/* Active view */}
            {previewTab === 'admin' && (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {/* 3 mini cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-white border border-gray-150 rounded-xl flex items-center gap-2">
                    <Users className="text-[#2E7D32] w-4.5 h-4.5" />
                    <div>
                      <p className="text-[8px] text-gray-400 font-bold">{t('landing.totalStudents')}</p>
                      <h4 className="text-xs font-black text-gray-700">142</h4>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-gray-150 rounded-xl flex items-center gap-2">
                    <CalendarDays className="text-secondary w-4.5 h-4.5" />
                    <div>
                      <p className="text-[8px] text-gray-400 font-bold">{t('landing.dailyRate')}</p>
                      <h4 className="text-xs font-black text-gray-700">92%</h4>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-gray-150 rounded-xl flex items-center gap-2">
                    <TrendingUp className="text-amber-600 w-4.5 h-4.5" />
                    <div>
                      <p className="text-[8px] text-gray-400 font-bold">{t('landing.holidaysCalendar')}</p>
                      <h4 className="text-xs font-black text-gray-700">4 {t('landing.days')}</h4>
                    </div>
                  </div>
                </div>

                {/* Audit details placeholder */}
                <div className="p-3 bg-white border border-gray-150 rounded-xl flex flex-col gap-1.5 shadow-inner">
                  <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 uppercase">
                    <span>{t('landing.recentAudits')}</span>
                    <span className="text-primary hover:underline cursor-pointer">{t('landing.viewTimeline')}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="p-1.5 bg-gray-50 rounded border border-gray-100 text-[9px] font-medium">
                      {t('landing.audit1')} (10:14 AM)
                    </div>
                    <div className="p-1.5 bg-gray-50 rounded border border-gray-100 text-[9px] font-medium">
                      {t('landing.audit2')} (10:10 AM)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'teacher' && (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-800">{t('landing.gradeRegister')}</h4>
                  <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded-full uppercase">
                    {t('landing.pendingCheckin')}
                  </span>
                </div>

                {/* Simulated list */}
                <div className="space-y-1.5">
                  {[
                    { roll: '01', name: 'Aarav Patel', status: 'Present' },
                    { roll: '02', name: 'Diya Patel', status: 'Absent' },
                    { roll: '03', name: 'Jay Pawar', status: 'Present' },
                  ].map((std) => (
                    <div key={std.roll} className="flex justify-between items-center p-2 bg-white border border-gray-150 rounded-xl text-[10px]">
                      <span className="font-bold text-gray-750">{std.roll} • {std.name}</span>
                      <div className="flex gap-1 text-[8px] font-extrabold uppercase">
                        <span className={`px-2 py-0.5 rounded border ${std.status === 'Present' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-650'}`}>
                          {std.status === 'Present' ? t('landing.present') : t('landing.absent')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewTab === 'parent' && (
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">Aarav Patel</h4>
                    <p className="text-[8px] text-gray-400 font-bold">Class: {t('landing.gradeRegister')} | Roll: 01</p>
                  </div>
                  <button className="px-2 py-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded text-[8px] font-bold flex items-center gap-1 cursor-pointer">
                    <FileSpreadsheet className="w-2.5 h-2.5" />
                    <span>{t('landing.downloadReport')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="p-2 bg-green-50 border border-green-150 rounded-xl">
                    <span className="text-gray-400 block text-[8px]">{t('landing.present')}</span>
                    <span className="text-green-700 text-sm">22 {t('landing.days')}</span>
                  </div>
                  <div className="p-2 bg-red-50 border border-red-150 rounded-xl">
                    <span className="text-gray-400 block text-[8px]">{t('landing.absent')}</span>
                    <span className="text-red-700 text-sm">2 {t('landing.days')}</span>
                  </div>
                  <div className="p-2 bg-yellow-50 border border-yellow-150 rounded-xl">
                    <span className="text-gray-400 block text-[8px]">{t('landing.attendance')}</span>
                    <span className="text-amber-600 text-sm">92%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Smart AI Assistant Preview Section */}
      <section id="ai-assistant" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 border-t border-gray-200">
        <div className="text-center space-y-3">
          <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full bg-opacity-70">
            {t('landing.aiBadge')}
          </span>
          <h2 className="text-3xl font-bold text-gray-800">{t('landing.aiAssistantTitle')}</h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">
            {t('landing.aiAssistantSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column: Cards */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-green-50 text-[#2E7D32] rounded-xl shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{t('landing.cardAsk')}</h4>
                <p className="text-xs text-gray-500 mt-1 font-semibold">
                  {t('landing.faqTitle')}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-green-50 text-[#2E7D32] rounded-xl shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{t('landing.cardLang')}</h4>
                <p className="text-xs text-gray-500 mt-1 font-semibold">
                  English, हिन्दी, मराठी
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-green-50 text-[#2E7D32] rounded-xl shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{t('landing.cardVoice')}</h4>
                <p className="text-xs text-gray-500 mt-1 font-semibold">
                  {t('landing.comingSoon')}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-green-50 text-[#2E7D32] rounded-xl shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{t('landing.cardAudio')}</h4>
                <p className="text-xs text-gray-500 mt-1 font-semibold">
                  {t('landing.comingSoon')}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex items-start gap-4">
              <div className="p-3 bg-green-50 text-[#2E7D32] rounded-xl shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-800">{t('landing.cardSimple')}</h4>
                <p className="text-xs text-gray-500 mt-1 font-semibold">
                  {t('landing.feat6Desc')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Simulated Chat Window */}
          <div className="flex justify-center w-full">
            <div className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden flex flex-col h-96">
              {/* Green Header */}
              <div className="px-4 py-3 bg-[#2E7D32] text-white flex justify-between items-center text-xs font-bold shadow-md">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-green-200" />
                  <span>SmartAttend AI Assistant</span>
                </div>
                <span className="text-[9px] font-bold text-green-200 uppercase tracking-widest bg-green-900 border border-green-850 px-2 py-0.5 rounded-full">
                  Live Preview
                </span>
              </div>

              {/* Chat Body */}
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-none p-3 text-xs font-bold bg-[#2E7D32] text-white shadow-sm">
                    {t('landing.mockUser')}
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-none p-3 text-xs font-bold bg-white text-gray-700 border border-gray-150 shadow-sm leading-relaxed">
                    {t('landing.mockAi')}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-gray-100 bg-white flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <Mic className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  readOnly
                  placeholder="SmartAttend AI Assistant Preview..."
                  className="flex-1 py-1.5 px-3 border border-gray-200 rounded-full focus:outline-none text-[10px] font-semibold text-gray-400 bg-gray-50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-white border-y border-gray-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.testimonials')}</span>
            <h2 className="text-3xl font-bold text-gray-800">{t('landing.whatLeadersSay')}</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto font-medium">
              {t('landing.testSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { role: t('landing.roleAdmin'), name: 'Principal Sharma', quote: t('landing.quotePrincipal'), stars: 5 },
              { role: t('landing.roleTeacher'), name: 'Ramesh Kumar', quote: t('landing.quoteTeacher'), stars: 5 },
              { role: t('landing.roleParent'), name: 'Suresh Patel', quote: t('landing.quoteParent'), stars: 5 },
            ].map((test, idx) => (
              <div key={idx} className="bg-[#F8FAFC] p-6 rounded-2xl border border-gray-150 hover:shadow-md transition-shadow flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex gap-0.5 text-yellow-400">
                    {Array.from({ length: test.stars }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-650 leading-relaxed font-semibold italic">"{test.quote}"</p>
                </div>
                <div className="flex items-center gap-2.5 pt-3 border-t border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-green-100 text-[#2E7D32] flex items-center justify-center font-bold text-xs uppercase">
                    {test.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-800">{test.name}</h4>
                    <p className="text-[10px] text-gray-400 capitalize">{test.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-16 md:py-24 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-[#2E7D32] text-xs font-bold uppercase tracking-widest bg-green-50 border border-green-150 px-3 py-1 rounded-full">{t('landing.faq')}</span>
          <h2 className="text-3xl font-bold text-gray-800">{t('landing.faqTitle')}</h2>
        </div>

        <div className="space-y-4">
          {faqData.map((item, idx) => {
            const isOpen = activeFAQ === idx;
            return (
              <div key={idx} className="bg-white border border-gray-250 rounded-2xl overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleFAQ(idx)}
                  className="w-full flex justify-between items-center px-6 py-4.5 text-left text-sm font-extrabold text-gray-800 hover:bg-gray-50 focus:outline-none cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 pt-1 text-xs text-[#64748B] leading-relaxed font-semibold">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto bg-gradient-to-tr from-[#2E7D32] to-green-900 rounded-3xl text-white py-16 px-8 text-center space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-green-950 bg-opacity-20 pointer-events-none" />
        
        <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight relative z-10">
          {t('landing.ctaTitle')}
        </h2>
        <p className="text-sm sm:text-base text-green-100 max-w-md mx-auto relative z-10 font-medium">
          {t('landing.ctaSubtitle')}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 relative z-10">
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3.5 bg-white hover:bg-gray-50 text-[#2E7D32] text-sm font-bold rounded-xl shadow-md transition-colors cursor-pointer border border-white"
          >
            {t('landing.heroGetStarted')}
          </button>
          <button
            onClick={() => alert("Central Office support phone: +91 98765 43210. Email: help@smartattend.gov.in")}
            className="px-6 py-3.5 bg-transparent hover:bg-green-800 text-white text-sm font-bold rounded-xl border border-white transition-colors cursor-pointer"
          >
            {t('landing.ctaBtn')}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 bg-[#1A251D] text-green-200 border-t border-green-900 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo column */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="p-2 bg-[#2E7D32] rounded-xl text-white border border-green-800">
                <School className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold text-white tracking-wider">{t('landing.logo')}</span>
            </Link>
            <p className="text-xs text-green-200 leading-relaxed font-semibold">
              {t('landing.footerDesc')}
            </p>
          </div>

          {/* Product column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footerProduct')}</h4>
            <ul className="text-xs space-y-2 font-semibold text-green-200">
              <li><a href="#features" className="hover:text-white transition-colors">{t('landing.features')}</a></li>
              <li><a href="#previews" className="hover:text-white transition-colors">{t('landing.interactive')}</a></li>
              <li><a href="#roles" className="hover:text-white transition-colors">{t('landing.rolesTitle')}</a></li>
              <li><a href="#ai" className="hover:text-white transition-colors">{t('landing.aiPreview')}</a></li>
            </ul>
          </div>

          {/* Resources column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footerResources')}</h4>
            <ul className="text-xs space-y-2 font-semibold text-green-200">
              <li><a href="#" className="hover:text-white transition-colors">User Guides</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Central FAQs</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Contact column */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-widest">{t('landing.footerContact')}</h4>
            <p className="text-xs leading-relaxed font-semibold text-green-200">
              Email: support@smartattend.gov.in<br />
              Phone: +91 98765 43210<br />
              Location: {t('landing.locationText')}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-green-900 mt-12 pt-6 text-center text-xs text-green-300 font-medium">
          © {new Date().getFullYear()} {t('landing.copyright')}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
