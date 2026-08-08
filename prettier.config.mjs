/** @type {import("prettier").Config} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4 reads the theme from CSS, so the class sorter needs the entry stylesheet.
  tailwindStylesheet: "./src/app/globals.css",
};

export default config;
