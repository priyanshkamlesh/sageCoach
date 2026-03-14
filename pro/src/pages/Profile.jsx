// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggleInline from "../components/ThemeToggleInline.jsx";
import AccountBanner from "../components/AccountBanner";
import { useAuthGuard } from "../hooks/useAuthguard.js"; // make sure file name matches
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  deleteUser as firebaseDeleteUser,
} from "firebase/auth";
import { auth } from "./firebase.jsx";
import { API_BASE_URL } from "../config";

import {
  User,
  Mail,
  Calendar,
  VenetianMask,
  Lock,
  Edit,
  Save,
  XCircle,
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
          {type === "password" ? "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" : value || "-"}
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
  useAuthGuard(); // ðŸ”’ guard this page

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
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [creds, setCreds] = useState({
    email: "",
    password: null,
    provider: "local",
  });

  // Load profile on mount
  useEffect(() => {
    (async () => {
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
      const lowerEmail = String(email).toLowerCase();
      const profiles = getProfiles();

      if (!profiles[email] && !profiles[lowerEmail]) {
        profiles[lowerEmail] = {
          username: "",
          email: lowerEmail,
          age: 20,
          gender: "Male",
        };
        saveProfiles(profiles);
      }

      let merged = profiles[email] || profiles[lowerEmail] || {
        username: "",
        email: lowerEmail,
        age: "",
        gender: "Male",
      };
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/user/profile?email=${encodeURIComponent(email)}`
        );
        const data = await res.json();
        if (res.ok && data?.exists && data?.profile) {
          const p = data.profile;
          const nested = p.profile || {};
          const rawGender = p.gender || nested.gender || merged.gender || "Male";
          const normGender = (() => {
            const g = String(rawGender).trim().toLowerCase();
            if (g === "male") return "Male";
            if (g === "female") return "Female";
            if (g === "other") return "Other";
            if (g === "prefer_not_to_say" || g === "prefer not to say") return "Prefer not to say";
            return "Male";
          })();
          merged = {
            ...merged,
            username: p.username || nested.username || merged.username || "",
            email: p.email || merged.email || lowerEmail,
            age: p.age ?? nested.age ?? merged.age ?? "",
            gender: normGender,
          };
          profiles[lowerEmail] = merged;
          saveProfiles(profiles);
        }
      } catch (err) {
        console.error("Profile sync fetch failed:", err);
      }

      setFormData(merged);
      setOriginalData(merged);

      const c = getCredentials();
      setCreds(
        c?.email === email ? c : { email: lowerEmail, password: null, provider: "local" }
      );
    })();
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const currentFirebaseUser = auth.currentUser;
    const oldEmail = originalData.email;
    const newEmail = formData.email;

    if (currentFirebaseUser && oldEmail && newEmail && oldEmail !== newEmail) {
      try {
        await firebaseUpdateEmail(currentFirebaseUser, newEmail);
      } catch (err) {
        console.error("Firebase email update failed:", err);
        if (err?.code === "auth/requires-recent-login") {
          alert("For security, please logout and login again before changing email.");
        } else {
          alert("Unable to update email in Firebase.");
        }
        return;
      }
    }

    const profiles = getProfiles();
    const newKey = String(formData.email || "").toLowerCase();
    const oldKey = String(originalData.email || "").toLowerCase();
    if (oldKey && oldKey !== newKey) {
      delete profiles[originalData.email];
      delete profiles[oldKey];
    }
    profiles[newKey] = {
      username: formData.username || "",
      email: newKey,
      age: Number(formData.age) || "",
      gender: formData.gender || "Male",
    };
    saveProfiles(profiles);

    const currentCreds = getCredentials();
    if (currentCreds?.email && currentCreds.email !== formData.email) {
      setCredentials({ ...currentCreds, email: newKey });
      setCreds({ ...currentCreds, email: newKey });
      setCurrentUser(newKey);
      localStorage.setItem("userEmail", newKey);
    }

    setOriginalData(profiles[newKey]);
    setFormData(profiles[newKey]);
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

  const handlePasswordSave = async () => {
    const currentCreds = getCredentials();
    const email = formData.email || currentCreds.email;

    if (!email) {
      alert("No user context found. Please log in again.");
      return;
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !firebaseUser.email) {
      alert("No active Firebase session found. Please login again.");
      return;
    }

    const isGoogleOnly = (firebaseUser.providerData || []).some(
      (p) => p.providerId === "google.com"
    );

    if (!isGoogleOnly) {
      if (!currentPassword) {
        alert("Please enter your current password.");
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(
          firebaseUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(firebaseUser, credential);
      } catch (reauthErr) {
        console.error("Re-auth failed:", reauthErr);
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

    try {
      await firebaseUpdatePassword(firebaseUser, newPassword);

      const updated = { email, password: newPassword, provider: "local" };
      setCredentials(updated);
      setCreds(updated);
      setCurrentUser(email);
      localStorage.setItem("userEmail", email);

      alert("Password updated successfully.");
      cancelPasswordChange();
    } catch (err) {
      console.error("Firebase password update failed:", err);
      if (err?.code === "auth/requires-recent-login") {
        alert("For security, please logout and login again, then try again.");
      } else {
        alert("Unable to update password in Firebase.");
      }
    }
  };

  const handleDeleteAccount = async () => {
    const firebaseUser = auth.currentUser;
    const emailToDelete = (firebaseUser?.email || formData.email || "").trim().toLowerCase();

    if (!emailToDelete) {
      alert("No account found to delete.");
      return;
    }
    if (!firebaseUser) {
      alert("No active session found. Please login again.");
      return;
    }

    const confirmDelete = window.confirm(
      "Delete your account permanently? This will remove your login and saved data."
    );
    if (!confirmDelete) return;

    setDeletingAccount(true);
    try {
      await firebaseDeleteUser(firebaseUser);

      await fetch(`${API_BASE_URL}/api/user/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToDelete }),
      });

      try {
        const profiles = getProfiles();
        delete profiles[emailToDelete];
        saveProfiles(profiles);
      } catch {}

      clearCurrentUser();
      localStorage.removeItem("userEmail");
      localStorage.removeItem("authToken");
      localStorage.removeItem("userCredentials");
      localStorage.removeItem("userName");

      alert("Account deleted successfully.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Delete account failed:", err);
      if (err?.code === "auth/requires-recent-login") {
        alert("For security, please logout and login again, then delete your account.");
      } else {
        alert("Unable to delete account right now. Please try again.");
      }
    } finally {
      setDeletingAccount(false);
    }
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
                {savedPassword
                  ? showSavedPassword
                    ? savedPassword
                    : "••".repeat(Math.max(savedPassword.length || 8, 8))
                  : showSavedPassword
                    ? "Password cannot be retrieved from Firebase for security."
                    : "••••••••"}
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
                This account was created with Google. You donâ€™t need your
                current password â€” set a new one here to enable email/password
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

          <div className="mt-6 pt-4 border-t border-red-900/60">
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="w-full md:w-auto px-5 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {deletingAccount ? "Deleting Account..." : "Delete Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




