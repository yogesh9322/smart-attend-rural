import React from 'react';
import { FaWhatsapp, FaExclamationTriangle } from 'react-icons/fa';

const TeacherWhatsAppCard = ({ teacher, student, language = 'en', theme = 'light' }) => {
  // Locale dictionary definitions inside component for clean, standalone localization
  const locales = {
    en: {
      heading: 'WhatsApp Communication',
      subheading: 'Connect with your class teacher instantly.',
      teacher: 'Teacher',
      statusAvailable: 'Available',
      statusUnavailable: 'Unavailable',
      btnChat: 'Chat on WhatsApp',
      errUnavailable: 'WhatsApp not available for this teacher. Please contact the school office.',
      prefilledMessage: (tName, sName, cStr) => 
        `Hello ${tName},\n\nI am the parent of ${sName} (${cStr}).\n\nI would like to connect with you regarding my child.\n\nThank you.`
    },
    hi: {
      heading: 'व्हाट्सएप संपर्क',
      subheading: 'अपने कक्षा शिक्षक से तुरंत संपर्क करें।',
      teacher: 'शिक्षक',
      statusAvailable: 'उपलब्ध',
      statusUnavailable: 'अनुपलब्ध',
      btnChat: 'व्हाट्सएप पर चैट करें',
      errUnavailable: 'इस शिक्षक के लिए व्हाट्सएप उपलब्ध नहीं है। कृपया स्कूल कार्यालय से संपर्क करें।',
      prefilledMessage: (tName, sName, cStr) => 
        `नमस्ते ${tName},\n\nमैं ${sName} (${cStr}) का अभिभावक हूँ।\n\nमैं अपने बच्चे के संबंध में आपसे संपर्क करना चाहता हूँ।\n\nधन्यवाद।`
    },
    mr: {
      heading: 'व्हाट्सएप संवाद',
      subheading: 'तुमच्या वर्ग शिक्षकांशी त्वरित संपर्क साधा.',
      teacher: 'शिक्षक',
      statusAvailable: 'उपलब्ध',
      statusUnavailable: 'अनुपलब्ध',
      btnChat: 'व्हाट्सएपवर चॅट करा',
      errUnavailable: 'या शिक्षकांसाठी व्हाट्सएप उपलब्ध नाही. कृपया शाळा कार्यालयाशी संपर्क साधा.',
      prefilledMessage: (tName, sName, cStr) => 
        `नमस्ते ${tName},\n\nमी ${sName} (${cStr}) चा पालक आहे.\n\nमला माझ्या पाल्याविषयी आपल्याशी संवाद साधायचा आहे.\n\nधन्यवाद.`
    }
  };

  const currentLocale = locales[language] || locales.en;
  
  const hasWhatsApp = teacher && teacher.whatsappEnabled && teacher.phoneNumber;
  const teacherName = teacher?.teacherName || 'Teacher';
  const displayPhone = hasWhatsApp ? `${teacher.countryCode || '+91'} ${teacher.phoneNumber}` : 'N/A';

  const handleChatClick = () => {
    if (!hasWhatsApp) return;

    const studentName = student?.name || 'Student';
    const grade = teacher?.class || student?.classId?.grade || 'Grade 6';
    const section = teacher?.section || student?.classId?.section || 'A';
    const classStr = `${grade}-${section}`;
    
    const rawPhone = `${teacher.countryCode || '+91'}${teacher.phoneNumber}`.replace(/\D/g, '');
    const prefilledText = currentLocale.prefilledMessage(teacherName, studentName, classStr);
    
    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(prefilledText)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition duration-200 text-left space-y-3">
      {/* Card Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400 flex items-center justify-center text-xl shrink-0">
          <FaWhatsapp />
        </div>
        <div>
          <h3 className="text-xs font-black text-gray-800 dark:text-white leading-tight uppercase tracking-wider">
            {currentLocale.heading}
          </h3>
          <p className="text-[10px] text-gray-450 dark:text-gray-500 font-semibold leading-tight mt-0.5">
            {currentLocale.subheading}
          </p>
        </div>
      </div>

      {/* Info Block (Horizontal layout for space-saving) */}
      <div className="bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-850 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-400 dark:text-gray-550 uppercase font-black">
              {currentLocale.teacher}:
            </span>
            <span className="font-extrabold text-gray-800 dark:text-gray-250">
              {teacherName}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-700 dark:text-gray-300">
            <span className="text-[9px] text-gray-400 dark:text-gray-550 uppercase font-black font-sans">
              No:
            </span>
            <span>{displayPhone}</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[9px] text-gray-400 dark:text-gray-550 uppercase font-black">
            Status
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hasWhatsApp ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
              {hasWhatsApp ? currentLocale.statusAvailable : currentLocale.statusUnavailable}
            </span>
          </span>
        </div>
      </div>

      {/* Error Warning Block if disabled */}
      {!hasWhatsApp && (
        <div className="flex items-start gap-1.5 p-2.5 bg-red-50 dark:bg-red-950 border border-red-150 dark:border-red-900 rounded-xl text-[9px] font-bold text-red-750 dark:text-red-300 leading-normal">
          <FaExclamationTriangle className="text-xs shrink-0 mt-0.5" />
          <p>{currentLocale.errUnavailable}</p>
        </div>
      )}

      {/* Action Button */}
      <div>
        <button
          onClick={handleChatClick}
          disabled={!hasWhatsApp}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#20ba59] disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 text-white text-xs font-black rounded-xl shadow-sm hover:shadow transition duration-150 cursor-pointer disabled:cursor-not-allowed"
        >
          <FaWhatsapp className="text-sm" />
          <span>{currentLocale.btnChat}</span>
        </button>
      </div>
    </div>
  );
};

export default TeacherWhatsAppCard;
