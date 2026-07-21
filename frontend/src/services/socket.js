import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL.replace('/api', '');
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      return url.replace('localhost', window.location.hostname);
    }
    return url;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${hostname}:5000`;
};

const socket = io(getSocketUrl(), { autoConnect: true });

export default socket;
