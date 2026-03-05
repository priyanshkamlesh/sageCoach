// src/pages/Result.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AccountBanner from "../components/AccountBanner";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

// ---------- LOCAL HELPERS (same idea as before) ----------
function setAuthToken(token) {
  try {
    localStorage.setItem("authToken", token);
  } catch {}
}

function setCurrentUserEmail(emailValue) {
  const e = String(emailValue || "").trim();
  if (!e) return;
  try {
    localStorage.setItem("userEmail", e);
    localStorage.setItem("currentUser", JSON.stringify({ email: e }));
  } catch {}
}

function ensureUserProfile(email) {
  try {
    localStorage.setItem("userProfile_exists_" + email, "1");
  } catch {}
}

function isGmail(addr) {
  return /^[A-Za-z0-9._%+-]+@gmail\.com$/i.test(String(addr || "").trim());
}

// ---------- MAIN COMPONENT ----------
export default function RegistrationForm() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("register"); // "register" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const resetMessages = () => {
    setErrorMsg("");
    setInfoMsg("");
  };

  // ---------- Handle Google redirect result (fallback from popup-blocked) ----------
  useEffect(() => {
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          const email = user.email || "";
          if (!isGmail(email)) {
            setErrorMsg("Only @gmail.com addresses are allowed.");
            return;
          }
          const token = await user.getIdToken();
          setAuthToken(token);
          setCurrentUserEmail(email);
          ensureUserProfile(email);
          setInfoMsg("Google sign-in successful! Redirecting…");
          setTimeout(() => navigate("/user_details"), 800);
        }
      } catch (err) {
        console.error("Google redirect result error:", err);
      }
    })();
  }, [navigate]);

  // ---------- Email/Password Register ----------
  const handleFirebaseRegister = async () => {
    resetMessages();
    const clean = email.trim();
    const pwd = password.trim();

    if (!clean || !pwd) {
      setErrorMsg("Please enter email and password.");
      return;
    }
    if (!isGmail(clean)) {
      setErrorMsg("Only @gmail.com addresses are allowed.");
      return;
    }
    if (pwd.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, clean, pwd);
      const user = cred.user;
      const token = await user.getIdToken();

      setAuthToken(token);
      setCurrentUserEmail(clean);
      ensureUserProfile(clean);

      setInfoMsg("Registration successful! Redirecting…");
      setTimeout(() => navigate("/user_details"), 800);
    } catch (err) {
      console.error(err);
      let msg = err.message || "Registration failed.";
      if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered. Try logging in instead.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Email/Password Login ----------
  const handleFirebaseLogin = async () => {
    resetMessages();
    const clean = loginEmail.trim();
    const pwd = loginPassword.trim();

    if (!clean || !pwd) {
      setErrorMsg("Please enter email and password.");
      return;
    }
    if (!isGmail(clean)) {
      setErrorMsg("Only @gmail.com addresses are allowed.");
      return;
    }

    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, clean, pwd);
      const user = cred.user;
      const token = await user.getIdToken();

      setAuthToken(token);
      setCurrentUserEmail(clean);
      ensureUserProfile(clean);

      setInfoMsg("Login successful! Redirecting…");
      setTimeout(() => navigate("/home"), 800);
    } catch (err) {
      console.error(err);
      let msg = err.message || "Login failed.";
      if (err.code === "auth/user-not-found") {
        msg = "No account found with this email.";
      } else if (err.code === "auth/wrong-password") {
        msg = "Incorrect password.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Google Sign-in with popup + redirect fallback ----------
  const handleGoogleAuth = async (modeLabel) => {
    resetMessages();
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const email = user.email || "";
      if (!isGmail(email)) {
        setErrorMsg("Only @gmail.com addresses are allowed.");
        return;
      }
      const token = await user.getIdToken();

      setAuthToken(token);
      setCurrentUserEmail(email);
      ensureUserProfile(email);

      setInfoMsg(
        `${modeLabel === "login" ? "Login" : "Sign in"} with Google successful! Redirecting…`
      );
      setTimeout(() => navigate("/home"), 800);
    } catch (err) {
      console.error("Google auth error:", err);
      if (err.code === "auth/popup-blocked") {
        // Fallback to redirect if popup is blocked
        setInfoMsg(
          "Popup was blocked by your browser. Redirecting to Google sign-in…"
        );
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      let msg = "Google authentication failed. Please try again.";
      if (err.code === "auth/operation-not-allowed") {
        msg =
          "Google Sign-In is not enabled for this Firebase project. Enable it in Firebase Console → Authentication → Sign-in method.";
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="relative flex justify-center items-center min-h-screen bg-[#010a13] overflow-hidden font-poppins">
      {/* animated gradient background */}
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_180deg,transparent_70%,rgba(0,255,255,0.1))] animate-[spin_12s_linear_infinite]" />

      <div className="relative z-10 w-[380px] p-8 rounded-2xl bg-[#0b111a]/70 backdrop-blur-md border border-cyan-400 text-white shadow-[0_0_30px_#00f0ff]">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-wide">
            Welcome to <span className="text-cyan-400">SageCoach</span>
          </h1>
          <p className="text-sm text-gray-300 mt-1">
            {mode === "register"
              ? "Create an account to get started."
              : "Log in to continue."}
          </p>
        </div>

        {/* compact AccountBanner */}
        <div className="mb-4">
          <AccountBanner compact />
        </div>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => {
              setMode("register");
              resetMessages();
            }}
            className={`py-2 rounded-lg border transition ${
              mode === "register"
                ? "bg-slate-700 border-cyan-400"
                : "bg-transparent border-slate-700 text-gray-300 hover:bg-slate-800"
            }`}
          >
            Register
          </button>
          <button
            onClick={() => {
              setMode("login");
              resetMessages();
            }}
            className={`py-2 rounded-lg border transition ${
              mode === "login"
                ? "bg-slate-700 border-cyan-400"
                : "bg-transparent border-slate-700 text-gray-300 hover:bg-slate-800"
            }`}
          >
            Login
          </button>
        </div>

        {errorMsg && (
          <div className="mb-3 text-xs bg-red-900/70 border border-red-700 text-red-100 px-3 py-2 rounded">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mb-3 text-xs bg-emerald-900/60 border border-emerald-600 text-emerald-100 px-3 py-2 rounded">
            {infoMsg}
          </div>
        )}

        {/* REGISTER FORM */}
        {mode === "register" && (
          <div className="space-y-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleFirebaseRegister}
              disabled={loading}
              className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 rounded font-medium text-sm transition"
            >
              {loading ? "Processing..." : "Register"}
            </button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">Or continue with</p>
              <button
                onClick={() => handleGoogleAuth("register")}
                disabled={loading}
                className="mt-2 w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded text-sm font-medium transition"
              >
                Continue with Google
              </button>
            </div>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === "login" && (
          <div className="space-y-4">
            <input
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleFirebaseLogin}
              disabled={loading}
              className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 rounded font-medium text-sm transition"
            >
              {loading ? "Processing..." : "Login"}
            </button>

            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">Or continue with</p>
              <button
                onClick={() => handleGoogleAuth("login")}
                disabled={loading}
                className="mt-2 w-full px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 rounded text-sm font-medium transition"
              >
                Login with Google
              </button>
            </div>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-6 text-center text-xs text-gray-400">
          By continuing, you agree this app is for posture awareness and does
          not replace medical advice.{" "}
          <Link to="/home" className="text-cyan-300 hover:text-cyan-200">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
