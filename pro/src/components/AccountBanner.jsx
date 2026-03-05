// src/components/AccountBanner.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../pages/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { LogIn, LogOut } from "lucide-react";

export default function AccountBanner({ compact = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser || null);
      setChecking(false);

      // keep localStorage consistent
      if (!firebaseUser) {
        try {
          localStorage.removeItem("authToken");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("currentUser");
        } catch {}
      } else {
        try {
          localStorage.setItem("userEmail", firebaseUser.email || "");
        } catch {}
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout error", e);
    }

    try {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("currentUser");
    } catch {}

    alert("You have been logged out. Please login again.");
    // replace history entry so back button won't go back to protected page
    navigate("/", { replace: true });
  };

  const isLoginPage = location.pathname === "/login";
  const avatarChar = user?.email?.[0]?.toUpperCase() ?? "?";

  // While checking auth state, show neutral banner
  if (checking) {
    return (
      <div
        className={`border border-slate-700 bg-slate-900/50 rounded-xl p-4 flex items-center justify-between shadow-lg ${
          compact ? "text-sm" : "text-base"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-700 animate-pulse" />
          <div>
            <div className="h-3 w-32 bg-slate-700 rounded mb-1" />
            <div className="h-2 w-24 bg-slate-800 rounded" />
          </div>
        </div>
        <div className="h-8 w-20 bg-slate-800 rounded" />
      </div>
    );
  }

  const showLogoutButton = !!user && !isLoginPage;
  const showLoginButton = !user || isLoginPage;

  return (
    <div
      className={`border border-slate-700 bg-slate-900/50 rounded-xl p-4 flex items-center justify-between shadow-lg ${
        compact ? "text-sm" : "text-base"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-cyan-400 text-slate-900 font-bold flex items-center justify-center uppercase">
          {user ? avatarChar : "?"}
        </div>
        <div>
          <p className="font-semibold text-white">
            {user ? user.email : "You are not logged in"}
          </p>
          <p className="text-xs text-gray-400">
            {user
              ? "Logged in via Firebase"
              : "Login to save scores and track progress"}
          </p>
        </div>
      </div>

      {showLogoutButton && (
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      )}

      {showLoginButton && (
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold text-sm transition"
        >
          <LogIn size={16} />
          Login
        </button>
      )}
    </div>
  );
}
