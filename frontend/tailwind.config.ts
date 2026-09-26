import type { Config } from "tailwindcss";

const config: Config = {
	content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				primary: "var(--bg-primary)",
				surface: "var(--bg-surface)",
				raised: "var(--bg-surface-raised)",
				border: "var(--border-subtle)",
				ink: "var(--text-primary)",
				muted: "var(--text-secondary)",
				signal: "var(--accent-signal)",
				alert: "var(--accent-alert)",
				warn: "var(--accent-warn)",
				focus: "var(--accent-focus)",
				mono: "var(--mono-data)"
			},
			fontFamily: {
				display: ["var(--font-display)"],
				sans: ["var(--font-body)"],
				mono: ["var(--font-mono)"]
			}
		}
	},
	plugins: []
};

export default config;
