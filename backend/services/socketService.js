const socketIo = require('socket.io');

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*', // Allow all for dev
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

const broadcastAttendanceUpdate = (classId) => {
  if (io) {
    io.emit('attendance_updated', { classId, timestamp: new Date() });
    console.log(`[Socket] Broadcasted attendance_updated for class: ${classId || 'all'}`);
  }
};

const broadcastStudentUpdate = () => {
  if (io) {
    io.emit('student_updated', { timestamp: new Date() });
    console.log('[Socket] Broadcasted student_updated');
  }
};

module.exports = {
  initSocket,
  getIo,
  broadcastAttendanceUpdate,
  broadcastStudentUpdate,
};
