import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  getAdminNotices, createAdminNotice, updateAdminNotice, deleteAdminNotice,
  getTeacherNotices, createTeacherNotice, updateTeacherNotice, deleteTeacherNotice,
  getParentNotices, getClasses, markNoticeRead
} from '../services/api';
import {
  FaBullhorn, FaPlus, FaTimes, FaTrashAlt, FaEdit, FaPaperclip,
  FaCalendarAlt, FaExclamationTriangle, FaSchool, FaChalkboardTeacher,
  FaSearch, FaBook, FaClipboardCheck, FaRegClock, FaFilter, FaExpandAlt, FaEye
} from 'react-icons/fa';

const Notices = () => {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const isParent = user?.role === 'parent';

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [filterType, setFilterType] = useState('All'); // 'All', 'School', 'Class', 'Important'
  const [statusFilter, setStatusFilter] = useState('Published'); // 'Published', 'Draft', 'Scheduled', 'Archived', 'All'
  const [searchQuery, setSearchQuery] = useState('');

  // Teacher assigned classes list
  const [teacherClasses, setTeacherClasses] = useState([]);

  // Modal Controls
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewNotice, setViewNotice] = useState(null); // Detail view modal
  const [editingNotice, setEditingNotice] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [classId, setClassId] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('Published');
  const [attachment, setAttachment] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Categories list
  const adminCategories = ['Holiday', 'Examination', 'Meeting', 'Emergency', 'Government', 'Event', 'General'];
  const teacherCategories = ['Homework', 'Assignment', 'Test', 'Practical', 'Reminder', 'Project', 'Classroom Activity', 'General', 'Examination', 'Meeting', 'Event'];

  // Fetch teacher classes
  useEffect(() => {
    if (isTeacher) {
      getClasses().then(res => {
        if (res.success && res.data) {
          setTeacherClasses(res.data);
          if (res.data.length > 0) setClassId(res.data[0]._id);
        }
      }).catch(err => console.error(err));
    }
  }, [isTeacher]);

  // Fetch notices dynamically from backend with role-enforced queries
  const fetchNoticesList = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        search: searchQuery.trim() || undefined,
        noticeType: filterType === 'All' ? undefined : filterType,
      };

      let res;
      if (isAdmin) {
        params.status = statusFilter === 'All' ? '' : statusFilter;
        res = await getAdminNotices(params);
      } else if (isTeacher) {
        params.status = statusFilter === 'All' ? '' : statusFilter;
        res = await getTeacherNotices(params);
      } else {
        // Parent role: backend strictly enforces published notices only for parent's linked children
        res = await getParentNotices(params);
      }

      if (res && res.success) {
        setNotices(res.data || []);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load notice board.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTeacher, isParent, statusFilter, searchQuery, filterType]);

  useEffect(() => {
    fetchNoticesList();
  }, [fetchNoticesList]);

  // Client-side filter fallback ensuring instant responsive filtering
  const filteredNotices = useMemo(() => {
    return notices.filter(n => {
      const matchesSearch = !searchQuery.trim() || 
        n.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (n.content || n.description)?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'School') {
        return n.noticeType === 'School' || n.scope === 'Entire School';
      }
      if (filterType === 'Class') {
        return (
          n.noticeType === 'Class' ||
          n.scope === 'Assigned Class' ||
          n.scope === 'All Assigned Classes' ||
          Boolean(n.classId)
        );
      }

      return true;
    });
  }, [notices, filterType, searchQuery]);

  // Open Detail View & Mark Read
  const handleViewNotice = async (notice) => {
    setViewNotice(notice);
    const userId = user?._id || user?.id;
    if (userId) {
      const isAlreadyRead = notice.readBy && notice.readBy.some(id => String(id) === String(userId) || String(id?._id) === String(userId));
      if (!isAlreadyRead) {
        try {
          await markNoticeRead(notice._id);
          setNotices(prev =>
            prev.map(item =>
              item._id === notice._id
                ? { ...item, readBy: [...(item.readBy || []), userId] }
                : item
            )
          );
        } catch (err) {
          console.error('Failed to mark notice as read:', err);
        }
      }
    }
  };

  // Open Form Modal
  const handleOpenFormModal = (noticeToEdit = null) => {
    if (noticeToEdit) {
      setEditingNotice(noticeToEdit);
      setTitle(noticeToEdit.title || '');
      setContent(noticeToEdit.content || noticeToEdit.description || '');
      setCategory(noticeToEdit.category || (isAdmin ? 'General' : 'Homework'));
      setClassId(noticeToEdit.classId?._id || noticeToEdit.classId || (teacherClasses[0]?._id || ''));
      setTargetAudience(noticeToEdit.targetAudience || 'all');
      setPriority(noticeToEdit.priority || 'Medium');
      setStatus(noticeToEdit.status || 'Published');
      setAttachment(noticeToEdit.attachment || '');
      setPublishDate(noticeToEdit.publishDate ? new Date(noticeToEdit.publishDate).toISOString().split('T')[0] : '');
      setExpiryDate(noticeToEdit.expiryDate ? new Date(noticeToEdit.expiryDate).toISOString().split('T')[0] : '');
    } else {
      setEditingNotice(null);
      setTitle('');
      setContent('');
      setCategory(isAdmin ? 'General' : 'Homework');
      if (teacherClasses.length > 0) setClassId(teacherClasses[0]._id);
      setTargetAudience('all');
      setPriority('Medium');
      setStatus('Published');
      setAttachment('');
      setPublishDate(new Date().toISOString().split('T')[0]);
      setExpiryDate('');
    }
    setIsModalOpen(true);
  };

  // Handle Form Submit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setError('');

    const payload = {
      title,
      content,
      description: content,
      category,
      priority,
      status,
      attachment,
      publishDate: publishDate || undefined,
      expiryDate: expiryDate || undefined,
    };

    if (isTeacher) {
      payload.classId = classId;
      payload.noticeType = 'Class';
      payload.scope = 'Assigned Class';
      payload.targetAudience = 'class';
    } else if (isAdmin) {
      payload.noticeType = 'School';
      payload.scope = 'Entire School';
      payload.targetAudience = targetAudience;
    }

    try {
      let res;
      if (editingNotice) {
        res = isAdmin
          ? await updateAdminNotice(editingNotice._id, payload)
          : await updateTeacherNotice(editingNotice._id, payload);
      } else {
        res = isAdmin
          ? await createAdminNotice(payload)
          : await createTeacherNotice(payload);
      }

      if (res && res.success) {
        setIsModalOpen(false);
        fetchNoticesList();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to save notice.');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete Notice
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this notice?')) return;
    try {
      const res = isAdmin ? await deleteAdminNotice(id) : await deleteTeacherNotice(id);
      if (res && res.success) {
        if (viewNotice?._id === id) setViewNotice(null);
        fetchNoticesList();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete notice.');
    }
  };

  // Helper to format class label nicely
  const formatClassLabel = (cls) => {
    if (!cls) return t('notices.classNotice', { defaultValue: 'Class Notice' });
    const cleanGrade = cls.grade ? String(cls.grade).replace(/^grade\s+/i, '').trim() : '';
    const section = cls.section ? `-${cls.section}` : '';
    return cleanGrade ? `Grade ${cleanGrade}${section}` : t('notices.classNotice', { defaultValue: 'Class Notice' });
  };

  // Get Icon based on Category
  const getCategoryIcon = (cat, noticeType) => {
    if (cat === 'Holiday' || cat === 'Event') return <FaCalendarAlt className="text-purple-600 dark:text-purple-400" />;
    if (cat === 'Homework' || cat === 'Assignment' || cat === 'Project') return <FaBook className="text-[#2E7D32] dark:text-green-400" />;
    if (cat === 'Emergency') return <FaExclamationTriangle className="text-rose-600 dark:text-rose-400" />;
    if (cat === 'Examination' || cat === 'Test' || cat === 'Practical') return <FaClipboardCheck className="text-amber-600 dark:text-amber-400" />;
    if (noticeType === 'Class') return <FaChalkboardTeacher className="text-blue-600 dark:text-blue-400" />;
    return <FaBullhorn className="text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('notices.title', { defaultValue: 'Notice Board' })}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-300 font-medium mt-1">
            {t('notices.subtitle')}
          </p>
        </div>

        {(isAdmin || isTeacher) && (
          <button
            onClick={() => handleOpenFormModal()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer self-start sm:self-auto"
          >
            <FaPlus />
            <span>{isAdmin ? t('notices.publish', { defaultValue: 'Publish Notice' }) : t('notices.createClassNotice')}</span>
          </button>
        )}
      </div>

      {/* Teacher Helper Banner */}
      {isTeacher && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-3.5 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2.5">
          <FaChalkboardTeacher className="text-sm text-[#2E7D32] dark:text-green-400 shrink-0" />
          <span>{t('notices.teacherHelper')}</span>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {['All', 'School', 'Class'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                filterType === tab
                  ? 'bg-[#2E7D32] text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {tab === 'All' ? t('notices.allNotices') : tab === 'School' ? '🏫 ' + t('notices.schoolNotices') : '👨‍🏫 ' + t('notices.classNotices')}
            </button>
          ))}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {(isAdmin || isTeacher) && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
            >
              <option value="Published">{t('notices.published')}</option>
              <option value="Draft">{t('notices.drafts')}</option>
              <option value="Scheduled">{t('notices.scheduled')}</option>
              {isAdmin && <option value="Archived">{t('notices.archived')}</option>}
              <option value="All">{t('dashboard_extra.allStatuses')}</option>
            </select>
          )}

          <div className="relative flex-1 md:w-60">
            <FaSearch className="absolute left-3 top-3 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder={t('notices.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
            />
          </div>
        </div>
      </div>

      {/* 3. Notice Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E7D32]"></div>
          <span className="text-xs font-semibold text-gray-400 mt-3">{t('common.loading')}</span>
        </div>
      ) : filteredNotices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredNotices.map((n) => {
            const isSchoolNotice = n.noticeType === 'School' || n.scope === 'Entire School';
            const canEdit = isAdmin || (isTeacher && String(n.createdBy?._id || n.createdBy) === String(user?._id || user?.id));

            // Class Label Formatting
            const classLabel = n.classId
              ? formatClassLabel(n.classId)
              : n.scope === 'All Assigned Classes'
              ? t('classes.allClasses', { defaultValue: 'All Classes' })
              : t('notices.classNotice', { defaultValue: 'Class Notice' });

            // Contextual Child Info for Parent with multiple children
            let relevantChildrenNames = '';
            if (isParent) {
              if (n.relevantChildren && n.relevantChildren.length > 0) {
                relevantChildrenNames = n.relevantChildren.map(c => c.name).join(', ');
              } else if (n.classId) {
                const noticeClassId = (n.classId?._id || n.classId)?.toString();
                const matches = (user?.children || []).filter(c => {
                  const cClassId = (c.classId?._id || c.classId)?.toString();
                  return cClassId && noticeClassId && cClassId === noticeClassId;
                });
                if (matches.length > 0) {
                  relevantChildrenNames = matches.map(c => c.name).join(', ');
                }
              }
            }

            // Audience Tag Text
            const audienceText = isSchoolNotice
              ? (n.targetAudience === 'teachers' ? t('notices.teachersOnly', { defaultValue: 'Teachers Only' }) : n.targetAudience === 'parents' ? t('notices.parentsOnly', { defaultValue: 'Parents Only' }) : t('notices.entireSchool', { defaultValue: 'Entire School' }))
              : classLabel;

            const formattedDate = new Date(n.createdAt || n.publishDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const formattedTime = new Date(n.createdAt || n.publishDate).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={n._id}
                className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs hover:border-[#2E7D32] dark:hover:border-green-500 transition-all flex flex-col justify-between h-full space-y-4"
              >
                <div className="space-y-3">
                  {/* Category & Priority Badge Row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-gray-600">
                      {n.category || 'General'}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        n.priority === 'Urgent' || n.priority === 'High'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : n.priority === 'Important'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-gray-50 text-gray-600 dark:bg-gray-750 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {n.priority === 'High' || n.priority === 'Urgent' ? t('notices.urgent') : n.priority === 'Important' ? t('notices.important') : t('notices.normal')}
                    </span>
                  </div>

                  {/* Notice Title */}
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
                    {n.title}
                  </h3>

                  {/* Metadata Block: Audience & Publisher */}
                  <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{t('notices.audience')}:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{audienceText}</span>
                    </div>
                    {relevantChildrenNames && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">{t('parent_dashboard.child', { defaultValue: 'Relevant Child' })}:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[180px]">
                          {relevantChildrenNames}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{t('notices.publishedBy')}:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{n.createdBy?.name || 'School Office'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Date/Time + View Notice Button & Admin/Teacher Actions */}
                <div className="pt-3 border-t border-gray-150 dark:border-gray-700 space-y-3">
                  <div className="text-[11px] text-gray-400 dark:text-gray-400 font-medium">
                    {formattedDate} • {formattedTime}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {/* Primary Button: View Notice */}
                    <button
                      onClick={() => handleViewNotice(n)}
                      className="flex-1 py-2 px-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FaEye className="text-xs" />
                      <span>{t('notices.viewNotice')}</span>
                    </button>

                    {/* Admin/Teacher Edit & Delete Actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenFormModal(n); }}
                          title="Edit Notice"
                          className="p-2 bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-amber-900/50 rounded-xl transition cursor-pointer"
                        >
                          <FaEdit className="text-xs" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, n._id)}
                          title="Delete Notice"
                          className="p-2 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-red-900/50 rounded-xl transition cursor-pointer"
                        >
                          <FaTrashAlt className="text-xs" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl border border-gray-200 dark:border-gray-700 text-center space-y-2">
          <FaBullhorn className="mx-auto text-3xl text-gray-300 dark:text-gray-600" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">{t('notices.noRecords')}</h3>
          <p className="text-xs text-gray-400 font-medium">
            {t('notices.noRecords')}
          </p>
        </div>
      )}

      {/* 4. View Notice Modal (Centered Modal on Desktop / Full Screen on Mobile) */}
      {viewNotice && (() => {
        const isSchoolNotice = viewNotice.noticeType === 'School' || viewNotice.scope === 'Entire School';
        const classLabel = viewNotice.classId
          ? formatClassLabel(viewNotice.classId)
          : viewNotice.scope === 'All Assigned Classes'
          ? t('classes.allClasses', { defaultValue: 'All Classes' })
          : t('notices.classNotice', { defaultValue: 'Class Notice' });

        let relevantChildrenNames = '';
        if (isParent) {
          if (viewNotice.relevantChildren && viewNotice.relevantChildren.length > 0) {
            relevantChildrenNames = viewNotice.relevantChildren.map(c => c.name).join(', ');
          } else if (viewNotice.classId) {
            const noticeClassId = (viewNotice.classId?._id || viewNotice.classId)?.toString();
            const matches = (user?.children || []).filter(c => {
              const cClassId = (c.classId?._id || c.classId)?.toString();
              return cClassId && noticeClassId && cClassId === noticeClassId;
            });
            if (matches.length > 0) {
              relevantChildrenNames = matches.map(c => c.name).join(', ');
            }
          }
        }

        const audienceText = isSchoolNotice
          ? (viewNotice.targetAudience === 'teachers' ? t('notices.teachersOnly', { defaultValue: 'Teachers Only' }) : viewNotice.targetAudience === 'parents' ? t('notices.parentsOnly', { defaultValue: 'Parents Only' }) : t('notices.entireSchool', { defaultValue: 'Entire School' }))
          : classLabel;

        const formattedDate = new Date(viewNotice.createdAt || viewNotice.publishDate).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        const formattedTime = new Date(viewNotice.createdAt || viewNotice.publishDate).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-gray-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 w-full sm:max-w-xl h-full sm:h-auto min-h-screen sm:min-h-0 sm:rounded-2xl border-0 sm:border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5 my-auto max-h-none sm:max-h-[90vh] flex flex-col justify-between">
              <div className="space-y-4 overflow-y-auto pr-1">
                {/* Header Bar */}
                <div className="flex items-start justify-between gap-3 border-b border-gray-150 dark:border-gray-700 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600">
                        {viewNotice.category || 'General'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold border uppercase bg-gray-50 dark:bg-gray-750 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                        {t('notices.priority')}: {viewNotice.priority === 'High' || viewNotice.priority === 'Urgent' ? t('notices.urgent') : viewNotice.priority === 'Important' ? t('notices.important') : t('notices.normal')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                      {viewNotice.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setViewNotice(null)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-300 transition cursor-pointer"
                  >
                    <FaTimes />
                  </button>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300">
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">{t('notices.audience')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xs mt-0.5 block">{audienceText}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-gray-400 uppercase">{t('notices.publishedBy')}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-xs mt-0.5 block">{viewNotice.createdBy?.name || 'School Administration'}</span>
                  </div>
                  {relevantChildrenNames && (
                    <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{t('parent_dashboard.child', { defaultValue: 'Relevant Child' })}</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">{relevantChildrenNames} ({classLabel})</span>
                    </div>
                  )}
                  <div className="col-span-2 border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{t('reports.date')}: <strong className="text-gray-800 dark:text-gray-200">{formattedDate}</strong></span>
                    <span>{t('reports.time') || 'Time'}: <strong className="text-gray-800 dark:text-gray-200">{formattedTime}</strong></span>
                  </div>
                </div>

                {/* Complete Notice Description */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('notices.description')}</h4>
                  <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 font-medium text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-line text-sm min-h-[100px]">
                    {viewNotice.content || viewNotice.description}
                  </div>
                </div>

                {/* Attachments Section */}
                {viewNotice.attachment && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('notices.attachment')}</h4>
                    <a
                      href={viewNotice.attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold hover:underline transition"
                    >
                      <FaPaperclip />
                      <span>{t('notices.viewAttachment')}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-4 border-t border-gray-150 dark:border-gray-700">
                <button
                  onClick={() => setViewNotice(null)}
                  className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5. Create / Edit Notice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-150 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingNotice ? t('notices.editNotice') : isAdmin ? t('notices.createSchoolNotice') : t('notices.createClassNotice')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition cursor-pointer"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs font-semibold">
              {/* Notice Title */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.noticeTitle')} *</label>
                <input
                  type="text"
                  required
                  placeholder={t('notices.noticeTitle')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>

              {/* Category & Class */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.category')} *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    {(isAdmin ? adminCategories : teacherCategories).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {isTeacher ? (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('classes.title')} *</label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      <option value="all_assigned">{t('classes.allClasses')}</option>
                      {teacherClasses.map((cls) => (
                        <option key={cls._id} value={cls._id}>
                          {cls.grade} - {cls.section}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.audience')} *</label>
                    <select
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      <option value="all">{t('notices.entireSchool')}</option>
                      <option value="teachers">{t('notices.teachersOnly')}</option>
                      <option value="parents">{t('notices.parentsOnly')}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.priority')}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    <option value="High">{t('notices.urgent')}</option>
                    <option value="Medium">{t('notices.normal')}</option>
                    <option value="Low">{t('notices.normal') === 'सामान्य' ? 'कम' : t('notices.normal') === 'सामान्य' ? 'कमी' : 'Low'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('reports.status')}</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                  >
                    <option value="Published">{t('notices.published')}</option>
                    <option value="Draft">{t('notices.drafts')}</option>
                    <option value="Scheduled">Scheduled</option>
                    {isAdmin && <option value="Archived">Archived</option>}
                  </select>
                </div>
              </div>

              {/* Content / Description */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.description')} *</label>
                <textarea
                  required
                  rows="4"
                  placeholder={t('notices.descriptionPlaceholder')}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                ></textarea>
              </div>

              {/* Attachment Link */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-1">{t('notices.attachment')} ({t('common.optional') === 'रद्द करें' ? 'वैकल्पिक' : 'Optional'})</label>
                <input
                  type="text"
                  placeholder="https://example.com/document.pdf"
                  value={attachment}
                  onChange={(e) => setAttachment(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-150 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition cursor-pointer font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl transition cursor-pointer font-bold flex items-center gap-2"
                >
                  {formLoading && <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></span>}
                  <span>{editingNotice ? t('notices.updateNotice') : t('notices.publishNotice')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notices;
