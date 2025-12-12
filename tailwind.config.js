/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // reliable strategy for v3/v4 compatibility
    theme: {
        extend: {},
    },
    plugins: [],
}
