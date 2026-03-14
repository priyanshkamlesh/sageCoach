import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../pages/firebase";
import { API_BASE_URL } from "../config";

function clearClientSession() {
  try {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("currentUser");
  } catch {}
}

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const checkMongoUserExists = async (emailValue) => {
      const res = await fetch(`${API_BASE_URL}/api/user/exists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return !!data.exists;
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setStatus("blocked");
        return;
      }

      // Allow freshly registered users to complete profile first.
      if (location.pathname === "/user_details") {
        setStatus("allowed");
        return;
      }

      const exists = await checkMongoUserExists(firebaseUser.email || "");
      if (!exists) {
        await signOut(auth).catch(() => {});
        clearClientSession();
        setStatus("blocked");
        return;
      }

      setStatus("allowed");
    });

    return () => {
      unsubscribe();
    };
  }, [location.pathname]);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-slate-900 text-gray-200 flex items-center justify-center">
        <p className="text-gray-300">Checking session...</p>
      </div>
    );
  }

  if (status === "blocked") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
