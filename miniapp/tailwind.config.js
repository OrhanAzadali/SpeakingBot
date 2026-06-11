/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      animation: {
        "flip-in": "flipIn 0.4s ease-out",
        "slide-left": "slideLeft 0.3s ease-out",
        "slide-right": "slideRight 0.3s ease-out",
      },
      keyframes: {
        flipIn: {
          "0%": { transform: "rotateY(90deg)", opacity: 0 },
          "100%": { transform: "rotateY(0deg)", opacity: 1 },
        },
        slideLeft: {
          "0%": { transform: "translateX(0)", opacity: 1 },
          "100%": { transform: "translateX(-120%)", opacity: 0 },
        },
        slideRight: {
          "0%": { transform: "translateX(0)", opacity: 1 },
          "100%": { transform: "translateX(120%)", opacity: 0 },
        },
      },
    },
  },
  plugins: [],
};
