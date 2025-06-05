module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    // autoprefixer is often still useful but Tailwind v4 might handle some of its duties.
    // Keep it for now, can be removed if it causes issues or is confirmed redundant for your setup.
    autoprefixer: {},
  },
};
