import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStudentDetails, getTeacherContact, createNotification, getConversations } from '../services/api';
import TeacherWhatsAppCard from '../components/TeacherWhatsAppCard';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { FaPhoneAlt, FaEnvelope, FaPaperPlane, FaWhatsapp, FaComments, FaChalkboardTeacher } from 'react-icons/fa';

const ContactTeacher = () => {
  const { user } = useAuth();
  const children = user?.children || [];

  const { theme } = useTheme();
  const { i18n, t } = useTranslation();
  const [selectedChildId, setSelectedChildId] = useState(children[0]?._id || '');
  const [teacher, setTeacher] = useState(null);
  const [teacherContact, setTeacherContact] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Message Form States
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConversations = async () => {
    try {
      const res = await getConversations();
      if (res.success) {
        setConversations(res.data);
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  useEffect(() => {
    const fetchTeacherInfo = async () => {
      if (!selectedChildId) return;
      try {
        setLoading(true);
        // Get teacher contact from MongoDB via the new API endpoint
        const contactRes = await getTeacherContact(selectedChildId);
        if (contactRes.success) {
          setTeacherContact(contactRes.data);
        } else {
          setTeacherContact(null);
        }

        // Get details of the selected child
        const studentRes = await getStudentDetails(selectedChildId);
        if (studentRes.success) {
          setSelectedStudent(studentRes.data);
          setTeacher(studentRes.data?.classId?.classTeacherId || null);
        }
        
        // Fetch message logs
        await fetchConversations();
      } catch (err) {
        console.error(err);
        setTeacherContact(null);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherInfo();
  }, [selectedChildId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!subject || !body) {
      setErrorMsg('Please enter both subject and message body.');
      return;
    }

    if (!teacher) {
      setErrorMsg('No assigned class teacher found to deliver the message.');
      return;
    }

    try {
      const res = await createNotification({
        userId: teacher._id,
        title: `Message from Parent (${user.name})`,
        message: `Subject: ${subject}\n\n${body}`,
        category: 'user',
      });

      if (res.success) {
        setSuccessMsg(`Your message has been successfully delivered to ${teacher.name}.`);
        setSubject('');
        setBody('');
        await fetchConversations();
      } else {
        setErrorMsg('Failed to send the message. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Something went wrong while sending the message.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t('nav.contact_teacher') || 'Contact Class Teacher'}</h2>
          <p className="text-sm text-gray-500 font-medium">
            {t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'स्कूल वर्ग के शिक्षकों के लिए संदेश भेजें या निर्देशिका विवरण प्राप्त करें।' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'वर्ग शिक्षकांना संदेश पाठवा किंवा संपर्क तपशील पहा.' : 'Send messages or access directory details for school class teachers.'}
          </p>
        </div>

        {/* Child Selector */}
        {children.length > 1 && (
          <div>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="block w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {children.map((child) => (
                <option key={child._id} value={child._id}>
                  {child.name} (Roll {child.rollNo})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Teacher profile info and WhatsApp cards */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-md text-center">
            <div className="w-20 h-20 rounded-3xl bg-green-50 dark:bg-green-950 text-[#2E7D32] dark:text-green-400 border border-green-100 dark:border-green-800 flex items-center justify-center text-3xl font-black mx-auto mb-4">
              <FaChalkboardTeacher />
            </div>

            {loading ? (
              <div className="animate-pulse space-y-2 mt-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
            ) : teacher ? (
              <>
                <h3 className="text-lg font-extrabold text-gray-800 dark:text-white">{teacher.name}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase mt-1">{t('classes.teacher') || 'Class Teacher'}</p>

                <div className="mt-6 space-y-3">
                  <a
                    href={`tel:${teacher.phone}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-2xl text-xs font-bold text-gray-700 dark:text-gray-300 transition cursor-pointer"
                  >
                    <FaPhoneAlt className="text-green-700 text-sm" />
                    <div className="text-left">
                      <span className="text-[9px] text-gray-450 uppercase block">{t('common.phone') || 'Phone Call'}</span>
                      <span>{teacher.phone || 'N/A'}</span>
                    </div>
                  </a>

                  <a
                    href={`mailto:${teacher.email}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-850 border border-gray-150 dark:border-gray-800 rounded-2xl text-xs font-bold text-gray-700 dark:text-gray-300 transition cursor-pointer"
                  >
                    <FaEnvelope className="text-blue-700 text-sm" />
                    <div className="text-left">
                      <span className="text-[9px] text-gray-450 uppercase block">{t('common.email') || 'Send Email'}</span>
                      <span>{teacher.email || 'N/A'}</span>
                    </div>
                  </a>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-400 font-bold italic py-8">
                {t('classes.teacher') === 'वर्ग शिक्षक' ? 'इस छात्र की श्रेणी के लिए वर्तमान में कोई वर्ग शिक्षक आवंटित नहीं है।' : t('classes.teacher') === 'वर्ग शिक्षक' ? 'या विद्यार्थ्यासाठी सध्या कोणताही वर्ग शिक्षक वाटप केलेला नाही.' : 'No classroom teacher is currently assigned to this student\'s grade.'}
              </p>
            )}
          </div>

          {/* New Dynamic Teacher WhatsApp Card Component */}
          {teacherContact && (
            <TeacherWhatsAppCard
              teacher={teacherContact}
              student={selectedStudent}
              language={i18n.language}
              theme={theme}
            />
          )}
        </div>

        {/* Right Column: Contact Message Form */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-150 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-extrabold text-gray-450 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaComments className="text-green-700" />
              <span>{t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'शिक्षक को संदेश भेजें' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'शिक्षकांना संदेश पाठवा' : 'Send Message to Teacher'}</span>
            </h3>

            {successMsg && (
              <div className="p-3.5 mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-bold leading-relaxed">
                {successMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 mb-4 rounded-xl bg-red-50 border border-red-150 text-red-700 text-xs font-bold leading-relaxed">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="space-y-4">
              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'विषय' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'विषय' : 'Subject / Topic'}
                </label>
                <input
                  id="subject"
                  type="text"
                  placeholder={t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'उदा. अनुपस्थिति का कारण, बैठक का अनुरोध...' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'उदा. गैरहजेरीचे कारण, भेटीची विनंती...' : 'e.g. Absent excuse, meeting request...'}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Message Body */}
              <div>
                <label htmlFor="body" className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  {t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'संदेश विवरण' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'संदेश तपशील' : 'Message Details'}
                </label>
                <textarea
                  id="body"
                  rows="6"
                  placeholder={t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'यहाँ अपना संदेश लिखें...' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'येथे तुमचा संदेश लिहा...' : 'Write your message here...'}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!teacher}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow hover:shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <FaPaperPlane />
                <span>{t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'संदेश भेजें' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'संदेश पाठवा' : 'Send Message'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Message History Timeline */}
      <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
        <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <FaComments className="text-[#2E7D32]" />
          <span>{t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'संदेश और उत्तर इतिहास' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'संदेश आणि उत्तर इतिहास' : 'Message & Reply History'}</span>
        </h3>

        {conversations.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 font-bold italic py-4 text-center">
            {t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'कोई पुराना संवाद नहीं मिला। बातचीत शुरू करने के लिए एक संदेश भेजें।' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'कोणताही जुना संवाद आढळला नाही. संभाषण सुरू करण्यासाठी संदेश पाठवा.' : 'No past conversations found. Send a message to start communicating.'}
          </p>
        ) : (
          <div className="space-y-4">
            {conversations.map((msg) => {
              const isSentByMe = msg.senderId?._id === user?.id || msg.senderId === user?.id || msg.senderId?._id === user?._id;
              const senderName = isSentByMe ? (t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'आप' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'तुम्ही' : 'You') : msg.senderId?.name || (t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'शिक्षक' : 'Teacher');
              const isRead = msg.isRead;

              return (
                <div
                  key={msg._id}
                  className={`p-4 rounded-2xl border ${
                    isSentByMe
                      ? 'bg-gray-50 dark:bg-gray-950 border-gray-100 dark:border-gray-850'
                      : 'bg-green-50/50 dark:bg-green-950/20 border-green-100/50 dark:border-green-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSentByMe ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span className="text-xs font-black text-gray-800 dark:text-white">
                        {senderName}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {isSentByMe && (
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isRead
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-450'
                        }`}
                      >
                        {isRead ? (t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'पढ़ा गया' : t('nav.contact_teacher') === 'शिक्षकांशी संपर्क' ? 'वाचले' : 'Read') : (t('nav.contact_teacher') === 'शिक्षक से संपर्क' ? 'भेजा गया' : 'Sent')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">
                    {msg.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactTeacher;
