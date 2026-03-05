// src/hooks/useAuthGuard.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../pages/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useAuthGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    // 1) If user logs out while on this page → redirect
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        alert("Your session has ended. Please login again.");
        navigate("/login", { replace: true });
      }
    });

    // 2) If user presses BACK into this page after logout → redirect
    const handlePopState = () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("You have logged out. Please login again.");
        navigate("/login", { replace: true });
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      unsubscribe();
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);
}

