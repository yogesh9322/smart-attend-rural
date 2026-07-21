import { useState, useEffect, useCallback } from 'react';
import { getOfflineAttendanceQueue, removeOfflineAttendance } from '../services/db';
import { markAttendance } from '../services/api';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Helper to fetch pending count from local DB
  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await getOfflineAttendanceQueue();
      setPendingCount(queue.length);
    } catch (error) {
      console.error('Error fetching offline queue size:', error);
    }
  }, []);

  // Sync function to push offline data to backend API
  const syncOfflineData = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    try {
      const queue = await getOfflineAttendanceQueue();
      if (queue.length === 0) return;

      setIsSyncing(true);
      console.log(`[Sync Engine] Found ${queue.length} cached attendance grids to synchronize...`);

      for (const item of queue) {
        try {
          // Push to backend API
          const response = await markAttendance({
            classId: item.classId,
            date: item.date,
            records: item.records,
          });

          if (response.success) {
            // Remove from offline cache on success
            await removeOfflineAttendance(item.key);
          }
        } catch (error) {
          console.error(`[Sync Engine] Failed to sync item ${item.key}:`, error.message);
          // Stop sync run to avoid infinite error loops
          break;
        }
      }

      await updatePendingCount();
    } catch (error) {
      console.error('[Sync Engine] Error during batch synchronization:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updatePendingCount]);

  // Set up connection event listeners and intervals
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    updatePendingCount();

    // Setup a periodic check in case window events miss connection recovery
    const interval = setInterval(() => {
      if (navigator.onLine) {
        syncOfflineData();
      }
      updatePendingCount();
    }, 15000); // Check every 15 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncOfflineData, updatePendingCount]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    triggerSync: syncOfflineData,
    updatePendingCount,
  };
};
