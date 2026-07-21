import localforage from 'localforage';

// Configure localForage instance for offline attendance
const attendanceStore = localforage.createInstance({
  name: 'smart_attend_rural',
  storeName: 'offline_attendance_queue',
});

/**
 * Save attendance record to local queue when offline
 * @param {String} classId - Class standard standard ID
 * @param {String|Date} date - Date of attendance
 * @param {Array} records - Array of students with present/absent status
 * @returns {Promise<String>} - Returns the unique queue item key
 */
export const saveOfflineAttendance = async (classId, date, records) => {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const key = `${classId}_${dateStr}`;
  
  const payload = {
    key,
    classId,
    date,
    records,
    timestamp: Date.now(),
  };

  await attendanceStore.setItem(key, payload);
  console.log(`[Offline DB] Attendance cached for class ${classId} on date ${dateStr}`);
  return key;
};

/**
 * Get all cached attendance records that are waiting to sync
 * @returns {Promise<Array>} - List of cached attendance records
 */
export const getOfflineAttendanceQueue = async () => {
  const keys = await attendanceStore.keys();
  const queue = [];
  
  for (const key of keys) {
    const item = await attendanceStore.getItem(key);
    if (item) {
      queue.push(item);
    }
  }

  // Sort by timestamp so older records sync first
  return queue.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Delete a specific record from the offline cache queue after successful sync
 * @param {String} key - Cache unique key
 */
export const removeOfflineAttendance = async (key) => {
  await attendanceStore.removeItem(key);
  console.log(`[Offline DB] Sync successful. Cleared cached key: ${key}`);
};

/**
 * Check if a specific class has cached attendance for a given date
 * @param {String} classId
 * @param {String|Date} date
 * @returns {Promise<Boolean>}
 */
export const hasOfflineAttendance = async (classId, date) => {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const key = `${classId}_${dateStr}`;
  const record = await attendanceStore.getItem(key);
  return !!record;
};
