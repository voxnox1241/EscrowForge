import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "var(--text-primary)",
        indigo: "var(--text-secondary)",
        muted: "var(--text-muted)",
        purple: "var(--accent-purple)",
        blue: "var(--accent-blue)",
        secured: "var(--status-secured)",
        disbursed: "var(--status-disbursed)",
        returned: "var(--status-returned)",
        "glass-bg": "var(--glass-bg)",
        "glass-bg-hover": "var(--glass-bg-hover)",
        "glass-border": "var(--glass-border)",
        "glass-border-hover": "var(--glass-border-hover)",
      },
    },
  },
  plugins: [],
};
export default config;
