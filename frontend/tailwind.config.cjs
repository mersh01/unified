module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    '../backend/**/*.{js,jsx,ts,tsx,py,html}'
  ],
  theme: {
    extend: {
      colors: {
        govblue: {
          50: '#f2f6fb',
          100: '#e6eef7',
          200: '#bfdff0',
          300: '#99cfe8',
          400: '#4daedb',
          500: '#006fbf',
          600: '#005fa8',
          700: '#004880'
        }
      }
    }
  },
  plugins: []
}
