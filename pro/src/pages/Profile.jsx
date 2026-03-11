// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggleInline from "../components/ThemeToggleInline.jsx";
import AccountBanner from "../components/AccountBanner";
import { useAuthGuard } from "../hooks/useAuthguard.js"; // make sure file name matches

import {
  User,
  Mail,
  Calendar,
  VenetianMask,
  Lock,
  Edit,
  Save,
  XCircle,
  LogOut,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";

// Top navbar
const Navbar = () => (
  <nav className="bg-slate-800 p-4 rounded-lg mb-8 border border-gray-700 shadow-md">
    <div className="max-w-6xl mx-auto flex justify-between items-center">
      <a href="/home" className="flex items-center gap-3 group">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5.8 11.3c.9-2.2 3.2-3.8 5.7-3.8s4.8 1.6 5.7 3.8c.2.6.2 1.3 0 1.9-.9 2.2-3.2 3.8-5.7 3.8s-4.8-1.6-5.7-3.8c-.2-.6-.2-1.3 0-1.9z" />
          <path d="M12 12a 2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
        <span className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
          SageCoach
        </span>
      </a>
      <div className="flex items-center gap-4">
        <a
          href="/home"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Home
        </a>
        <a
          href="/dashboard"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Dashboard
        </a>
      </div>
    </div>
  </nav>
);

// ---------- localStorage helpers ----------
const getCredentials = () => {
  try {
    return JSON.parse(localStorage.getItem("userCredentials") || "{}");
  } catch {
    return {};
  }
};
const setCredentials = (creds) => {
  try {
    localStorage.setItem("userCredentials", JSON.stringify(creds));
  } catch {}
};
const getProfiles = () => {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}");
  } catch {
    return {};
  }
};
const saveProfiles = (profiles) => {
  try {
    localStorage.setItem("userProfile", JSON.stringify(profiles));
  } catch {}
};
const setCurrentUser = (email) => {
  try {
    localStorage.setItem("currentUser", JSON.stringify({ email }));
  } catch {}
};
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    return null;
  }
};
const clearCurrentUser = () => {
  try {
    localStorage.removeItem("currentUser");
  } catch {}
};

// Reusable field
const ProfileField = ({
  icon,
  label,
  value,
  isEditing = false,
  type = "text",
  onChange,
}) => {
  const Icon = icon;
  return (
    <div className="mb-4">
      <label className="flex items-center text-sm font-medium text-gray-400 mb-1">
        <Icon className="w-5 h-5 mr-2 text-cyan-400" />
        {label}
      </label>
      {isEditing ? (
        type === "select" ? (
          <select
            name={label.toLowerCase()}
            value={value}
            onChange={onChange}
            className="w-full px-4 py-3 bg-slate-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        ) : (
          <input
            type={type}
            name={label.toLowerCase()}
            value={value ?? ""}
            onChange={onChange}
            className="w-full px-4 py-3 bg-slate-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        )
      ) : (
        <p className="w-full px-4 py-3 bg-slate-800 rounded-lg text-gray-200">
          {type === "password" ? "••••••••" : value || "-"}
        </p>
      )}
    </div>
  );
};

// Password input component
const PassInput = ({
  label,
  value,
  onChange,
  show,
  setShow,
  placeholder = " ",
}) => (
  <div>
    <label className="text-sm font-medium text-gray-400 mb-1 block">
      {label}
    </label>
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 pr-10 bg-slate-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        autoComplete={
          label.toLowerCase().includes("current")
            ? "current-password"
            : "new-password"
        }
        inputMode="text"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-white"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  </div>
);

// ---------- Main Profile component ----------
export default function Profile() {
  useAuthGuard(); // 🔒 guard this page

  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    age: "",
    gender: "Male",
  });
  const [originalData, setOriginalData] = useState(formData);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurr, setShowCurr] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [showSavedPassword, setShowSavedPassword] = useState(false);

  const [creds, setCreds] = useState({
    email: "",
    password: null,
    provider: "local",
  });

  // Load profile on mount
  useEffect(() => {
    let session = getCurrentUser();

    if (!session || !session.email) {
      const c = getCredentials();
      if (c?.email) {
        session = { email: c.email };
        setCurrentUser(c.email);
      }
    }

    if (!session || !session.email) {
      const storedEmail = localStorage.getItem("userEmail");
      if (storedEmail) {
        session = { email: storedEmail };
        setCurrentUser(storedEmail);
      }
    }

    if (!session || !session.email) {
      return;
    }

    const email = session.email;
    const profiles = getProfiles();

    if (!profiles[email]) {
      profiles[email] = {
        username: "",
        email,
        age: 20,
        gender: "Male",
      };
      saveProfiles(profiles);
    }

    setFormData(profiles[email]);
    setOriginalData(profiles[email]);

    const c = getCredentials();
    setCreds(
      c?.email === email ? c : { email, password: null, provider: "local" }
    );
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev };
      if (name === "age") next.age = value;
      else if (name === "username") next.username = value;
      else if (name === "email") next.email = value;
      else if (name === "gender") next.gender = value;
      return next;
    });
  };

  const handleEditToggle = () => {
    if (isEditing) setFormData(originalData);
    setIsEditing(!isEditing);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const profiles = getProfiles();
    if (originalData.email && originalData.email !== formData.email) {
      delete profiles[originalData.email];
    }
    profiles[formData.email] = {
      username: formData.username || "",
      email: formData.email,
      age: Number(formData.age) || "",
      gender: formData.gender || "Male",
    };
    saveProfiles(profiles);

    const currentCreds = getCredentials();
    if (currentCreds?.email && currentCreds.email !== formData.email) {
      setCredentials({ ...currentCreds, email: formData.email });
      setCreds({ ...currentCreds, email: formData.email });
      setCurrentUser(formData.email);
      localStorage.setItem("userEmail", formData.email);
    }

    setOriginalData(profiles[formData.email]);
    setFormData(profiles[formData.email]);
    setIsEditing(false);
  };

  const handleLogout = () => {
    clearCurrentUser();
    try {
      localStorage.removeItem("userEmail");
    } catch {}
    alert("You have been logged out. Please login again.");
    navigate("/login", { replace: true });
  };

  const openPasswordSection = () => {
    setShowPasswordSection(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurr(false);
    setShowNew(false);
    setShowConf(false);
  };

  const cancelPasswordChange = () => {
    setShowPasswordSection(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurr(false);
    setShowNew(false);
    setShowConf(false);
  };

  const handlePasswordSave = () => {
    const currentCreds = getCredentials();
    const email = formData.email || currentCreds.email;

    if (!email) {
      alert("No user context found. Please log in again.");
      return;
    }

    const isGoogleOnly =
      !currentCreds?.password && currentCreds?.provider === "google";

    if (!isGoogleOnly && currentCreds?.password) {
      if (!currentPassword) {
        alert("Please enter your current password.");
        return;
      }
      if (currentPassword !== currentCreds.password) {
        alert("Current password is incorrect.");
        return;
      }
    }

    if (!newPassword || newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }

    const updated = { email, password: newPassword, provider: "local" };
    setCredentials(updated);
    setCreds(updated);
    setCurrentUser(email);
    localStorage.setItem("userEmail", email);

    alert("✅ Password updated successfully.");
    cancelPasswordChange();
  };

  const savedPassword = creds?.password ?? "";
  const isGoogleOnly = !creds?.password && creds?.provider === "google";

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8 font-sans">
      <Navbar />

      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <AccountBanner />
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 p-6 md:p-8 rounded-xl shadow-lg border border-gray-700 transition-all duration-300"
        >
          <div className="flex justify-between items-center mb-6 gap-3">
            <h1 className="text-4xl font-extrabold text-white">Your Profile</h1>

            <div className="flex items-center gap-2">
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 transform transition-all"
                >
                  <Edit className="w-5 h-5 mr-2" />
                  Edit
                </button>
              )}
              
            </div>
          </div>

          {/* User fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProfileField
              icon={User}
              label="Username"
              value={formData.username}
              isEditing={isEditing}
              onChange={handleChange}
            />
            <ProfileField
              icon={Mail}
              label="Email"
              type="email"
              value={formData.email}
              isEditing={isEditing}
              onChange={handleChange}
            />
            <ProfileField
              icon={Calendar}
              label="Age"
              type="number"
              value={formData.age}
              isEditing={isEditing}
              onChange={handleChange}
            />
            <ProfileField
              icon={VenetianMask}
              label="Gender"
              type={isEditing ? "select" : "text"}
              value={formData.gender}
              isEditing={isEditing}
              onChange={handleChange}
            />
          </div>

          <div className="border-t border-gray-700 my-8" />

          {/* Password section */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-medium text-gray-400">
              <Lock className="w-5 h-5 mr-2 text-cyan-400" />
              Password
            </label>

            <div className="flex items-center gap-2">
              <p className="w-full px-4 py-3 bg-slate-800 rounded-lg text-gray-200">
                {savedPassword && showSavedPassword
                  ? savedPassword
                  : "••".repeat(Math.max(savedPassword?.length || 8, 8))}
              </p>
              <button
                type="button"
                className="px-3 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-sm flex items-center gap-2"
                onClick={() => setShowSavedPassword((s) => !s)}
              >
                {showSavedPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showSavedPassword ? "Hide" : "Show"}
              </button>
            </div>

            {!showPasswordSection ? (
              <button
                type="button"
                onClick={openPasswordSection}
                className="w-full md:w-auto px-5 py-2 bg-slate-700 text-gray-100 font-semibold rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2"
                title="Change your password"
              >
                <Key className="w-5 h-5" />
                {isGoogleOnly ? "Set Password" : "Change Password"}
              </button>
            ) : (
              <div className="mt-4 space-y-4">
                {!isGoogleOnly && (
                  <PassInput
                    label="Current Password"
                    value={currentPassword}
                    onChange={setCurrentPassword}
                    show={showCurr}
                    setShow={setShowCurr}
                    placeholder="Enter current password"
                  />
                )}
                <PassInput
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNew}
                  setShow={setShowNew}
                  placeholder="Enter new password (min 6 chars)"
                />
                <PassInput
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConf}
                  setShow={setShowConf}
                  placeholder="Re-enter new password"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handlePasswordSave}
                    className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:scale-105 transition"
                  >
                    Save Password
                  </button>
                  <button
                    type="button"
                    onClick={cancelPasswordChange}
                    className="px-5 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isGoogleOnly && showPasswordSection && (
              <p className="text-xs text-gray-400">
                This account was created with Google. You don’t need your
                current password — set a new one here to enable email/password
                sign-in too.
              </p>
            )}
          </div>

          {/* Edit buttons */}
          {isEditing && (
            <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-700">
              <button
                type="button"
                onClick={handleEditToggle}
                className="flex items-center px-6 py-2 bg-gray-600 text-white font-bold rounded-lg shadow-lg hover:bg-gray-500 transform transition-all"
              >
                <XCircle className="w-5 h-5 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 transform transition-all"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </button>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <ThemeToggleInline />
          </div>
        </form>
      </div>
    </div>
  );
}
