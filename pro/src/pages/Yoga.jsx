// src/pages/Yoga.jsx
import React, { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  Sparkles,
  Activity,
  Image as ImageIcon,
  Save,
  RefreshCw,
} from "lucide-react";
import AccountBanner from "../components/AccountBanner";
import { useAuthGuard } from "../hooks/useAuthguard";

const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL;

const poses = [
  "Tadasana (Mountain Pose)",
  "Vrikshasana (Tree Pose)",
  "Adho Mukha Svanasana (Downward Dog)",
  "Bhujangasana (Cobra Pose)",
  "Balasana (Child's Pose)",
  "Trikonasana (Triangle Pose)",
];

const YogaNavbar = () => (
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
          <path d="M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
        </svg>
        <span className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
          ASPIRANTS POSTURE DETECTION
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
          href="/analysis"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Analysis
        </a>
        <a
          href="/yoga"
          className="text-cyan-400 font-semibold border-b border-cyan-400"
        >
          Yoga
        </a>
        <a
          href="/dashboard"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Dashboard
        </a>
        <a
          href="/profile"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Profile
        </a>
      </div>
    </div>
  </nav>
);

export default function Yoga() {
  useAuthGuard(); // 🔒 protect this page

  const [selectedPose, setSelectedPose] = useState(poses[0]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const [tips, setTips] = useState("");
  const [generatingTips, setGeneratingTips] = useState(false);

  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setResult(null);
    setTips("");

    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please upload an image or frame of your yoga pose first.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setResult(null);
    setTips("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to analyze posture.");
      }

      setResult(data);

      // Optionally auto-generate tips after analysis
      await handleGenerateTips(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to analyze yoga posture.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateTips = async (analysisData) => {
    const payload = analysisData || result;
    if (!payload) {
      setError("Run the analysis before generating tips.");
      return;
    }

    setGeneratingTips(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/generate_tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: `Yoga pose: ${selectedPose}`,
          posture_data: {
            score: payload.posture_score,
            feedback: payload.feedback,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate tips.");
      }
      setTips(data.tips || "");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to generate tips.");
    } finally {
      setGeneratingTips(false);
    }
  };

  const handleSaveScore = async () => {
    if (!result?.posture_score) {
      setError("No score to save. Run an analysis first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: result.posture_score,
          meta: {
            activity: selectedPose || "Yoga asana posture",
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save score.");
      }

      alert("✅ Score saved to Dashboard.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save score.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
    setTips("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const score = result?.posture_score ?? null;
  const displayScore =
    typeof score === "number" ? Math.round(score) : null;

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8">
      <YogaNavbar />

      <div className="max-w-6xl mx-auto space-y-6">
        <AccountBanner />

        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              Yoga Posture Analysis
            </h1>
            <p className="text-gray-400 text-sm md:text-base">
              Upload a frame of your yoga pose to see your alignment score,
              ideal posture overlay, and AI-powered tips for improvement.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xs md:text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </header>

        {/* Pose selector + upload */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pose selection */}
          <div className="md:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                Select Pose
              </h2>
            </div>
            <div className="space-y-2">
              {poses.map((pose) => (
                <button
                  key={pose}
                  onClick={() => setSelectedPose(pose)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${
                    selectedPose === pose
                      ? "bg-cyan-500/10 border-cyan-400 text-cyan-200"
                      : "bg-slate-900/60 border-slate-700 text-gray-300 hover:bg-slate-800"
                  }`}
                >
                  {pose}
                </button>
              ))}
            </div>
          </div>

          {/* Upload + preview */}
          <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                Upload Pose Image
              </h2>
            </div>

            <label className="border-2 border-dashed border-slate-600 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-400 hover:bg-slate-800/60 transition">
              <ImageIcon className="w-8 h-8 text-cyan-400" />
              <span className="text-xs text-gray-300">
                Click to upload an image (or frame) of your{" "}
                <span className="font-semibold text-cyan-300">
                  {selectedPose}
                </span>
              </span>
              <span className="text-[10px] text-gray-500">
                Supported: JPG, PNG. Choose a clear side/front view for better
                analysis.
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            {previewUrl && (
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">Preview</p>
                <img
                  src={previewUrl}
                  alt="Yoga pose preview"
                  className="max-h-56 rounded-lg border border-slate-700 object-contain"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze Pose
                  </>
                )}
              </button>

              <button
                onClick={() => handleGenerateTips(result)}
                disabled={!result || generatingTips}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 border border-cyan-500 hover:bg-slate-800 text-cyan-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingTips ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Tips…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Regenerate Tips
                  </>
                )}
              </button>

              <button
                onClick={handleSaveScore}
                disabled={!result || saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Score to Dashboard
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="mt-2 text-xs text-red-300 bg-red-900/40 border border-red-700 px-3 py-2 rounded">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Results section */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            {/* Images */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-red-400" />
                    Detected Skeleton (Errors in Red)
                  </h3>
                  <img
                    src={`data:image/jpeg;base64,${result.annotated_image_base64}`}
                    alt="Detected yoga skeleton"
                    className="rounded-lg border border-slate-700 max-h-72 w-full object-contain bg-black"
                  />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                    Ideal / Corrected Posture
                  </h3>
                  <img
                    src={`data:image/jpeg;base64,${result.corrected_skeleton_image_base64}`}
                    alt="Ideal yoga skeleton"
                    className="rounded-lg border border-slate-700 max-h-72 w-full object-contain bg-black"
                  />
                </div>
              </div>
            </div>

            {/* Score + tips */}
            <div className="space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center">
                <p className="text-xs text-gray-400 mb-2">
                  Alignment Score for
                </p>
                <p className="text-sm font-semibold text-cyan-300 mb-3 text-center">
                  {selectedPose}
                </p>
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20" />
                  <div className="relative z-10 w-28 h-28 rounded-full border-4 border-cyan-400 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {displayScore ?? "--"}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">%</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-400 text-center">
                  Higher score means closer to ideal alignment. Aim above{" "}
                  <span className="text-emerald-400 font-semibold">80%</span>{" "}
                  for long-term practice.
                </p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">
                    AI-Powered Tips
                  </h3>
                </div>
                {tips ? (
                  <div className="text-xs text-gray-200 space-y-1 max-h-64 overflow-y-auto">
                    {tips.split("\n").map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    Run an analysis and generate tips to see alignment
                    corrections here.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
