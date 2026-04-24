import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#050a14",
          panel: "#080f1e",
          border: "#0d2040",
          cyan: "#00d4ff",
          blue: "#0066ff",
          purple: "#7c3aed",
          teal: "#00ffc3",
          orange: "#ff6b00",
          red: "#ff2d55",
          green: "#00ff88",
          yellow: "#ffd700",
        },
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        display: ["'Inter'", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-cyan": "glowCyan 2s ease-in-out infinite alternate",
        "glow-purple": "glowPurple 2s ease-in-out infinite alternate",
        "scan": "scan 3s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "data-flow": "dataFlow 2s linear infinite",
        "flicker": "flicker 4s linear infinite",
        "typing": "typing 3s steps(30) infinite",
      },
      keyframes: {
        glowCyan: {
          "0%": { boxShadow: "0 0 5px #00d4ff40, 0 0 10px #00d4ff20" },
          "100%": { boxShadow: "0 0 20px #00d4ff80, 0 0 40px #00d4ff40" },
        },
        glowPurple: {
          "0%": { boxShadow: "0 0 5px #7c3aed40, 0 0 10px #7c3aed20" },
          "100%": { boxShadow: "0 0 20px #7c3aed80, 0 0 40px #7c3aed40" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        dataFlow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
          "75%": { opacity: "0.95" },
        },
        typing: {
          "0%": { width: "0" },
          "50%": { width: "100%" },
          "100%": { width: "0" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        "neon-cyan": "0 0 20px #00d4ff40, 0 0 40px #00d4ff20, inset 0 0 20px #00d4ff10",
        "neon-purple": "0 0 20px #7c3aed40, 0 0 40px #7c3aed20, inset 0 0 20px #7c3aed10",
        "neon-orange": "0 0 20px #ff6b0040, 0 0 40px #ff6b0020, inset 0 0 20px #ff6b0010",
        "neon-green": "0 0 20px #00ff8840, 0 0 40px #00ff8820, inset 0 0 20px #00ff8810",
        "neon-teal": "0 0 20px #00ffc340, 0 0 40px #00ffc320, inset 0 0 20px #00ffc310",
        "panel": "0 4px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 212, 255, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
