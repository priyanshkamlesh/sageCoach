// src/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Briefcase,
  Sprout,
  Youtube,
  Bot,
  UserCircle2,
  LayoutDashboard,
  ArrowRight,
  X,
  ChevronRight,
  Camera,
} from "lucide-react";
import { useAuthGuard } from "../hooks/useAuthguard";
import { useTheme } from "../theme/ThemeProvider";

// --- Helper: read ?tutorial=1 from URL ---
function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

// --- Helper Component: Option Card ---
const OptionCard = ({
  id,
  icon,
  title,
  description,
  hoverColor,
  to,
  delay,
  actionText,
  onClick,
  dark,
}) => {
  return (
    <Link
      id={id}
      to={to}
      onClick={onClick}
      className={`group p-6 rounded-xl shadow-lg border 
                  transform transition-all duration-300 hover:scale-105 hover:shadow-2xl 
                  hover:${hoverColor} cursor-pointer animate-fadeIn flex flex-col justify-between relative ${
                    dark
                      ? "bg-slate-800 border-gray-700"
                      : "bg-white border-slate-200"
                  }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div>
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-lg mb-4 
                        group-hover:bg-opacity-50 transition-all duration-300
                        ${dark ? "bg-slate-700" : "bg-slate-100"}`}
        >
          {icon}
        </div>
        <h3 className={`text-2xl font-bold mb-2 ${dark ? "text-white" : "text-slate-800"}`}>{title}</h3>
        <p className={`mb-4 ${dark ? "text-gray-400" : "text-slate-500"}`}>{description}</p>
      </div>
      <span className="font-semibold text-cyan-400 group-hover:underline flex items-center mt-2">
        {actionText}
        <ArrowRight className="w-4 h-4 ml-1 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </Link>
  );
};

// --- Floating guided tour overlay (Home) ---
const GuidedTour = ({ steps, onClose }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [boxStyle, setBoxStyle] = useState({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState(null);

  const current = steps[stepIndex];

  useEffect(() => {
    const el = document.getElementById(current.targetId);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    const padding = 12;
    const calloutWidth = 320;
    const calloutHeight = 120;

    let top = rect.top + scrollY - calloutHeight - padding;
    let left = rect.right + scrollX - calloutWidth;

    if (top < scrollY + 10) top = rect.bottom + scrollY + padding;
    if (left < scrollX + 10) left = rect.left + scrollX + padding;

    setBoxStyle({ top, left });
    setTargetRect({
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
    });

    window.scrollTo({ top: rect.top + scrollY - 80, behavior: "smooth" });
  }, [stepIndex, current?.targetId]);

  const next = () => {
    if (stepIndex === steps.length - 1) onClose();
    else setStepIndex(stepIndex + 1);
  };

  const skip = () => onClose();

  if (!current) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] z-40" />
      {targetRect && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl ring-4 ring-cyan-400/70"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}
      <div
        className="fixed z-50 w-[320px] bg-slate-800 border border-cyan-500/40 rounded-xl shadow-2xl p-4"
        style={boxStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <p className="text-sm text-gray-200">
            <span className="font-semibold text-cyan-300">
              {current.title}:
            </span>{" "}
            {current.text}
          </p>
          <button
            className="ml-3 p-1 rounded hover:bg-slate-700"
            onClick={skip}
            title="Skip tutorial"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Step {stepIndex + 1} of {steps.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={skip}
              className="px-3 py-2 text-sm rounded-lg bg-slate-700 border border-gray-600 hover:bg-slate-600"
            >
              Skip
            </button>
            <button
              onClick={next}
              className="px-3 py-2 text-sm rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-95"
            >
              Next <ChevronRight className="inline w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// --- Main Home Page Component ---
function HomePage() {
  useAuthGuard();
  const { theme } = useTheme();
  const dark = theme === "dark";

  const query = useQuery();
  const [showTour, setShowTour] = useState(false);

  // Tour steps (includes Dashboard)
  const steps = useMemo(
    () => [
      {
        targetId: "card-govt",
        title: "Govt. Aspirants",
        text: "Prepare for your Physical Test.",
      },
      { targetId: "card-yoga", title: "Yoga", text: "Make your body fully fit." },
      {
        targetId: "card-youtube",
        title: "YouTube",
        text: "Reach out the videos.",
      },
      {
        targetId: "card-chat",
        title: "Chat with AI",
        text: "Ask your Queries.",
      },
      {
        targetId: "card-live-posture",
        title: "Live Posture",
        text: "Use your webcam for real-time activity tracking.",
      },
      {
        targetId: "btn-dashboard",
        title: "Dashboard",
        text: "Your personal hub for progress and insights.",
      },
    ],
    []
  );

  // Start tour if ?tutorial=1 or localStorage flag is set
  useEffect(() => {
    const shouldStart =
      query.get("tutorial") === "1" ||
      localStorage.getItem("startTour") === "1";
    if (shouldStart) {
      setShowTour(true);
      localStorage.removeItem("startTour");
    }
  }, [query]);

  return (
    <div
      className={`min-h-screen p-4 md:p-8 font-sans transition-colors duration-300 ${
        dark ? "bg-slate-900 text-gray-200" : "bg-slate-100 text-slate-800"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-4">
          <Link
            to="/profile"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm transition ${
              dark
                ? "bg-slate-800 border-slate-700 text-gray-100 hover:bg-slate-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <UserCircle2 className="w-4 h-4" />
            Profile
          </Link>
        </div>
        {/* Header */}
        <header
          className="mb-14 mt-8 text-center animate-fadeIn"
          style={{ animationDelay: "100ms" }}
        >
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2 [text-shadow:_0_2px_4px_rgb(0_0_0_/_25%)]">
            What's Your Quest Today?
          </h1>
          <p className={`text-2xl ${dark ? "text-gray-400" : "text-slate-500"}`}>
            Choose a path to begin your journey.
          </p>
        </header>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-20 relative">
          <OptionCard
            id="card-govt"
            icon={<Briefcase className="w-8 h-8 text-blue-400" />}
            title="Govt. Aspirants"
            description="Posture routines for long study sessions."
            hoverColor="border-blue-500"
            to="/analysis"
            delay={200}
            actionText="Fix My Study Stance"
            dark={dark}
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "analysis");
              }
            }}
          />
          <OptionCard
            id="card-yoga"
            icon={<Sprout className="w-8 h-8 text-green-400" />}
            title="Yoga"
            description="Flow through poses and improve flexibility."
            hoverColor="border-green-500"
            to="/yoga"
            delay={300}
            actionText="Begin My Flow"
            dark={dark}
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "yoga");
              }
            }}
          />
          <OptionCard
            id="card-youtube"
            icon={<Youtube className="w-8 h-8 text-red-400" />}
            title="YouTube"
            description="Analyze your form from a video link."
            hoverColor="border-red-500"
            to="/video"
            delay={400}
            actionText="Analyze My Video"
            dark={dark}
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "video");
              }
            }}
          />
          <OptionCard
            id="card-chat"
            icon={<Bot className="w-8 h-8 text-cyan-400" />}
            title="Chat with AI"
            description="Ask our AI physiotherapist for advice."
            hoverColor="border-cyan-400"
            to="/virtual_coach"
            delay={500}
            actionText="Get Instant Advice"
            dark={dark}
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "virtual_coach");
              }
            }}
          />
          <OptionCard
            id="card-live-posture"
            icon={<Camera className="w-8 h-8 text-amber-400" />}
            title="Live Posture"
            description="Track exercise live on webcam and get mistakes when you stop."
            hoverColor="border-amber-500"
            to="/live-posture"
            delay={550}
            actionText="Start Live Detection"
            dark={dark}
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "live-posture");
              }
            }}
          />
        </div>

        {/* Motivation Line */}
        <div
          className="text-center mb-12 animate-fadeIn"
          style={{ animationDelay: "600ms" }}
        >
          <p className={`text-3xl font-light italic ${dark ? "text-gray-400" : "text-slate-500"}`}>
            "The journey of a thousand miles begins with a single step."
          </p>
        </div>

        {/* Dashboard Button */}
        <div
          className="text-center animate-fadeIn"
          style={{ animationDelay: "700ms" }}
        >
          <Link
            id="btn-dashboard"
            to="/dashboard"
            onClick={() => {
              if (localStorage.getItem("homeTourCompleted") === "1") {
                localStorage.setItem("nextPageTour", "dashboard");
              }
            }}
            className="w-full max-w-md flex items-center justify-center px-8 py-4 mx-auto bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 hover:shadow-cyan-500/50 transform transition-all duration-300"
          >
            <LayoutDashboard className="w-6 h-6 mr-3" />
            Go To Your Dashboard
          </Link>
        </div>
      </div>

      {/* Guided Tour overlay */}
      {showTour && (
        <GuidedTour
          steps={steps}
          onClose={() => {
            localStorage.setItem("homeTourCompleted", "1");
            setShowTour(false);
          }}
        />
      )}
    </div>
  );
}

export default HomePage;

