import type { Config } from "tailwindcss";

// Design tokens live in app/styles/tokens.css (Tailwind CSS v4 @theme / @utility).
// This file is kept minimal so tooling such as the shadcn CLI continues to work.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./dashboard/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
