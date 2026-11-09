/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme")
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue,mjs}"],
  darkMode: "class", // allows toggling dark mode manually
  theme: {
    extend: {
      colors: {
        surface: "#0c072f",
        "surface-container": "#171241",
        "surface-container-high": "#1d184b",
        "surface-container-highest": "#231d55",
        "surface-container-low": "#110c38",
        "surface-bright": "#29235f",
        "on-surface": "#e7e2ff",
        "on-surface-variant": "#aba6d5",
        "outline-variant": "#47436c",
        primary: "#9aa8ff",
        "primary-container": "#8999ff",
        "on-primary": "#001c8d",
        "on-primary-container": "#00146f",
        secondary: "#9891ff",
        "secondary-container": "#4036a0",
        "on-secondary-container": "#d0cbff",
        tertiary: "#ffade6",
        "tertiary-container": "#ff95e3",
        "on-tertiary-container": "#650d58",
      },
      fontFamily: {
        // 西文用 Roboto，中文按系统优先级回退。
        // 注意顺序：中文字体必须排在 generic `sans-serif` 之前，否则浏览器会
        // 提前回退到默认无衬线字体，永远轮不到 PingFang / 微软雅黑。
        sans: [
          "Roboto",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "Source Han Sans SC",
          "Noto Sans CJK SC",
          ...defaultTheme.fontFamily.sans,
        ],
        display: ["Space Grotesk", "sans-serif"],
        headline: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        gradientShift: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(60px, 40px) scale(1.15)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "gradient-slow": "gradientShift 18s ease-in-out infinite",
        shimmer: "shimmer 2.5s infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
