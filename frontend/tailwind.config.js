export default {
  content: ["./index.html", "./admin.html", "./src/**/*.{js,ts,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Manrope",
          "Noto Sans Thai",
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
          50: "#FFF5E5",
          100: "#FBE8C7",
          200: "#E0C375",
          300: "#F8B861",
          400: "#F69D39",
          500: "#D92243",
          600: "#B91939",
          700: "#8F132D",
          800: "#641021",
          900: "#340711",
        },
      },
      boxShadow: {
        soft: "0 20px 60px rgba(217, 34, 67, 0.14)",
      },
      borderRadius: {
        xl2: "1.5rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
};
