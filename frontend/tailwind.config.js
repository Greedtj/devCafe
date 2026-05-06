export default {
  content: ["./index.html", "./admin.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        brand: {
          50: "#fbf4ee",
          100: "#f4e5d7",
          200: "#e8c7b0",
          300: "#d79f7b",
          400: "#c06b34",
          500: "#8a4f2a",
          600: "#6e3d22",
          700: "#54301b",
          800: "#3f2416",
          900: "#28170d",
        },
      },
      boxShadow: {
        soft: "0 20px 60px rgba(73, 50, 27, 0.12)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
};
