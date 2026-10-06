/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F7F9',
        panel: '#0F1524',
        panelmuted: '#1B2337',
        ink: '#11162A',
        inkmuted: '#525A72',
        line: '#E3E6EC',
        steel: {
          50: '#EEF2FB',
          100: '#DCE5F6',
          300: '#8FA8DA',
          500: '#3457A6',
          600: '#2A4685',
          700: '#213563',
        },
        amber: {
          50: '#FDF3E2',
          300: '#EFB752',
          500: '#D98E04',
          600: '#B57603',
        },
        signal: {
          green: '#1E8A5F',
          red: '#C24A3E',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 22, 42, 0.04), 0 1px 8px rgba(17, 22, 42, 0.04)',
        panel: '0 1px 2px rgba(17, 22, 42, 0.06), 0 4px 16px rgba(17, 22, 42, 0.06)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
