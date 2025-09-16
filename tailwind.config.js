/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans", "Ubuntu", "Cantarell", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],
      },
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#eaefff",
          200: "#cddcff",
          300: "#a9c0ff",
          400: "#7c9cff",
          500: "#527cff",
          600: "#355ef5",
          700: "#2748cc",
          800: "#203ca6",
          900: "#1f357f",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        xl: "0.875rem",
        '2xl': "1rem",
      },
      keyframes: {
        fade: {
          '0%': { opacity: 0, transform: 'translateY(4px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      },
      animation: {
        'fade-in': 'fade 300ms ease-out both'
      }
    },
  },
  plugins: [],
}
