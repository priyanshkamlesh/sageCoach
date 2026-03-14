import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../pages/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useAuthGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/login", { replace: true });
      }
    });

    const handlePopState = () => {
      if (!auth.currentUser) {
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
