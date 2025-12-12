/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'selector', // v4 uses 'selector' instead of 'class'
    theme: {
        extend: {},
    },
    plugins: [],
}
