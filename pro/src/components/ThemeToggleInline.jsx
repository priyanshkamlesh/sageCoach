import React from "react";
import { useTheme } from "../theme/ThemeProvider";

export default function ThemeToggleInline({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <div className={className} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 14, color: "var(--text-color)" }}>Theme</span>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={dark}
          onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
          style={{ width: 0, height: 0, opacity: 0, position: "absolute" }}
        />
        {/* pill switch */}
        <span
          aria-hidden
          style={{
            width: 44,
            height: 24,
            borderRadius: 9999,
            background: dark ? "var(--accent)" : "var(--border-color)",
            position: "relative",
            transition: "background .2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: dark ? 22 : 3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "white",
              transition: "left .2s",
              boxShadow: "0 2px 6px rgba(0,0,0,.25)",
            }}
          />
        </span>
        <span style={{ fontSize: 13, color: "var(--text-color)" }}>
          {dark ? "Dark" : "Light"}
        </span>
      </label>
    </div>
  );
}
