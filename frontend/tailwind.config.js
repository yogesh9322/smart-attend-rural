/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#e8f5e9',
          medium: '#4caf50',
          DEFAULT: '#2E7D32',
          dark: '#1b5e20',
        },
        secondary: {
          light: '#e3f2fd',
          medium: '#2196f3',
          DEFAULT: '#1565C0',
          dark: '#0d47a1',
        },
        success: '#2E7D32',
        error: '#d32f2f',
        warning: '#f57c00',
        bgLight: '#f5f5f5',
        cardWhite: '#ffffff',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
