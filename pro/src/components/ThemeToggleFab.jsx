import React from "react";
import { useTheme } from "../theme/ThemeProvider";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggleFab() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: 1000,
        borderRadius: "9999px",
        border: "1px solid var(--border-color)",
        background: "var(--card-bg)",
        color: "var(--text-color)",
        boxShadow: "0 6px 18px rgba(0,0,0,.18)",
        padding: "10px 12px",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span style={{ fontSize: 12 }}>{dark ? "Light" : "Dark"}</span>
    </button>
  );
}
