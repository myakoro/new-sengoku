/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/renderer/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'sengoku-gold': '#D4AF37',
                'sengoku-dark': '#2C2C2C',
                'sengoku-darker': '#1a1a1a',
                'sengoku-gray': '#CCCCCC',
                'sengoku-border': '#555555',
                'sengoku-success': '#2E7D32',
                'sengoku-danger': '#C62828',
            },
            fontFamily: {
                'sans': ['"Yu Gothic"', '"游ゴシック"', 'Meiryo', '"メイリオ"', 'sans-serif'],
                'mono': ['Consolas', 'Monaco', 'monospace'],
            },
        },
    },
    plugins: [],
}
