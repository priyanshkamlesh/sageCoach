// src/Analysis.jsx
import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  Target,
  Loader2,
  AlertOctagon,
  ArrowLeft,
  CheckCircle,
  Image as ImageIcon,
  Video,
  Lightbulb,
  Bot,
} from "lucide-react";
import AccountBanner from "../components/AccountBanner";
import { useAuthGuard } from "../hooks/useAuthguard";

const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5001";

// Extract a frame from a video for analysis
const extractFrameFromVideo = (videoFile) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      video.currentTime = Math.min(1, (video.duration || 1) * 0.2);
    };

    video.onseeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const frameFile = new File([blob], "video_frame.jpg", {
                type: "image/jpeg",
              });
              URL.revokeObjectURL(video.src);
              resolve(frameFile);
            } else reject(new Error("Could not extract frame."));
          },
          "image/jpeg",
          0.9
        );
      } catch (e) {
        reject(new Error("Failed to capture frame."));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video."));
    };

    video.load();
  });
};

// Navbar (unchanged)
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

// Circular progress ring
const CircularProgress = ({ score }) => {
  const [progress, setProgress] = useState(0);
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setProgress(score || 0), 100);
    return () => clearTimeout(t);
  }, [score]);

  let strokeColor = "stroke-red-500";
  if (progress > 40) strokeColor = "stroke-yellow-500";
  if (progress > 75) strokeColor = "stroke-green-500";
  if (progress > 95) strokeColor = "stroke-cyan-400";

  return (
    <div className="relative flex items-center justify-center w-40 h-40">
      <svg className="w-full h-full" viewBox="0 0 120 120">
        <circle
          className="text-gray-700"
          strokeWidth="10"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
        />
        <circle
          className={`transition-all duration-1000 ease-out ${strokeColor}`}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="60"
          cy="60"
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="absolute text-4xl font-bold text-white">
        {Math.round(progress)}
        <span className="text-2xl">%</span>
      </span>
    </div>
  );
};

function Analysis() {
  useAuthGuard(); // 🔒 protect analysis page

  // steps + upload
  const [step, setStep] = useState("selection");
  const [uploadType, setUploadType] = useState(null); // 'image' | 'video'
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("No file selected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // results
  const [result, setResult] = useState(null);

  // AI tips state
  const [aiTips, setAiTips] = useState("");
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError("File is too large (max 50MB).");
      setFile(null);
      setFileName("No file selected");
      return;
    }
    setError(null);
    setFile(selectedFile);
    setFileName(selectedFile.name);
  };

  const handleFileUpload = async () => {
    if (!file) {
      setError("Please select an image or video file first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setAiTips("");
    setTipsError("");

    try {
      let fileToUpload = file;
      let fileNameForUpload = file.name;

      if (uploadType === "video") {
        fileToUpload = await extractFrameFromVideo(file);
        fileNameForUpload = "video_frame.jpg";
      }

      const formData = new FormData();
      formData.append("file", fileToUpload, fileNameForUpload);

      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        let message = `HTTP ${res.status}`;
        try {
          const err = JSON.parse(text);
          message = err?.error || message;
        } catch {
          message = text.slice(0, 200) || message;
        }
        throw new Error(message);
      }

      const data = await res.json();
      const normalized = {
        ...data,
        annotated_image:
          data.annotated_image ||
          (data.annotated_image_base64
            ? `data:image/jpeg;base64,${data.annotated_image_base64}`
            : undefined),
        corrected_skeleton_image:
          data.corrected_skeleton_image ||
          (data.annotated_image_base64
            ? `data:image/jpeg;base64,${data.annotated_image_base64}`
            : undefined),
      };

      setResult(normalized);
      setStep("results");
    } catch (err) {
      setError(
        err.message ||
          "Error connecting to backend. Is the Python server running?"
      );
      setStep(uploadType === "image" ? "fileUpload" : "selection");
    } finally {
      setLoading(false);
    }
  };

  // Generate AI tips via backend (Gemini on your Python side)
  const generateAiTips = async () => {
    if (!result) return;
    setTipsLoading(true);
    setTipsError("");
    setAiTips("");

    try {
      const payload = {
        activity: "govt aspirant posture",
        posture_data: {
          score: result.posture_score,
          feedback: Array.isArray(result.feedback) ? result.feedback : [],
        },
      };

      const res = await fetch(`${API_BASE_URL}/generate_tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        let message = `HTTP ${res.status}`;
        try {
          const err = JSON.parse(text);
          message = err.error || message;
        } catch {
          message = text.slice(0, 200) || message;
        }
        throw new Error(message);
      }

      const data = await res.json();
      const tips = data?.tips?.trim() || "";
      if (!tips) throw new Error("Tips response was empty.");
      setAiTips(tips);
    } catch (e) {
      setTipsError(e.message || "Failed to generate tips. Please try again.");
    } finally {
      setTipsLoading(false);
    }
  };

  const handleTryAnother = () => {
    setStep("selection");
    setFile(null);
    setFileName("No file selected");
    setResult(null);
    setError(null);
    setAiTips("");
    setTipsError("");
  };

  const saveScoreToDashboard = async () => {
    if (!result || typeof result.posture_score !== "number") {
      alert("No score to save.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: result.posture_score }),
      });
      if (res.ok) {
        alert("✅ Score saved successfully!");
      } else {
        alert("⚠ Failed to save score. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving score.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8 font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <AccountBanner compact />
        </div>

        {/* Step selection */}
        {step === "selection" && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-700 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">
              Choose Upload Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button
                onClick={() => {
                  setUploadType("image");
                  setStep("fileUpload");
                }}
                className="flex flex-col items-center justify-center p-6 bg-slate-900/60 border border-gray-700 rounded-lg hover:border-cyan-400 hover:shadow-cyan-500/40 shadow-md transition-all duration-300"
              >
                <ImageIcon className="w-10 h-10 text-cyan-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-1">
                  Upload Image
                </h3>
                <p className="text-gray-400 text-sm text-center">
                  Use a still photo of your study posture.
                </p>
              </button>

              <button
                onClick={() => {
                  setUploadType("video");
                  setStep("fileUpload");
                }}
                className="flex flex-col items-center justify-center p-6 bg-slate-900/60 border border-gray-700 rounded-lg hover:border-cyan-400 hover:shadow-cyan-500/40 shadow-md transition-all duration-300"
              >
                <Video className="w-10 h-10 text-cyan-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-1">
                  Upload Video
                </h3>
                <p className="text-gray-400 text-sm text-center">
                  We’ll grab a frame from your study video.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step: file upload */}
        {step === "fileUpload" && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-700 mb-6">
            <button
              className="flex items-center text-sm text-gray-400 hover:text-cyan-300 mb-4"
              onClick={() => {
                setStep("selection");
                setFile(null);
                setFileName("No file selected");
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </button>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">
              Upload {uploadType === "video" ? "Video" : "Image"} for Analysis
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Supported formats:{" "}
              {uploadType === "video" ? "MP4, WebM" : "JPG, PNG"}
            </p>

            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-red-300 bg-red-900/60 border border-red-700 px-4 py-3 rounded-lg">
                <AlertOctagon className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              <div className="w-full max-w-md">
                <label
                  htmlFor="fileInput"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-cyan-400 hover:bg-slate-900/40 transition-colors"
                >
                  <UploadCloud className="w-10 h-10 text-cyan-400 mb-3" />
                  <span className="text-sm text-gray-300 mb-1">
                    Click to select{" "}
                    {uploadType === "video" ? "a video" : "an image"}
                  </span>
                  <span className="text-xs text-gray-500">{fileName}</span>
                  <input
                    id="fileInput"
                    type="file"
                    accept={
                      uploadType === "video" ? "video/*" : "image/*"
                    }
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={handleFileUpload}
                disabled={loading}
                className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 hover:shadow-cyan-500/50 transform transition-all duration-300 disabled:from-gray-600 disabled:to-gray-700 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />{" "}
                    Analyzing…
                  </>
                ) : (
                  "Analyze Posture"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step: results */}
        {step === "results" && result && (
          <div className="bg-slate-800 p-6 rounded-xl shadow-2xl border border-gray-700 transition-opacity duration-500 animate-fadeIn">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">
              Analysis
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Score card */}
              <div className="flex flex-col items-center justify-center bg-slate-900/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-semibold text-gray-300 mb-3">
                  Alignment Score
                </h3>
                <CircularProgress score={result.posture_score} />
                <p className="text-center text-gray-400 mt-4">
                  Your overall alignment accuracy.
                </p>
              </div>

              {/* Feedback + AI tips */}
              <div>
                <h3 className="text-xl font-semibold text-gray-300 mb-3">
                  Alignment Tips
                </h3>
                {Array.isArray(result.feedback) &&
                result.feedback.length > 0 ? (
                  <ul className="space-y-4">
                    {result.feedback.map((item, index) => (
                      <li
                        key={index}
                        className="bg-slate-700 border border-gray-600 p-4 rounded-lg shadow-md transition-all duration-300 hover:shadow-red-500/20 hover:border-red-500 animate-fadeIn"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex items-start">
                          <Target className="w-6 h-6 text-red-500 mr-4 flex-shrink-0 mt-1" />
                          <div>
                            <h4 className="font-semibold text-white text-lg">
                              {item.joint}
                            </h4>
                            <p className="text-gray-300">{item.tip}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center bg-gradient-to-br from-green-600 to-emerald-700 border border-green-500 p-6 rounded-lg shadow-lg shadow-green-500/20 text-white">
                    <CheckCircle className="w-16 h-16 text-white mb-3" />
                    <h4 className="font-bold text-2xl text-center">
                      Perfect Posture!
                    </h4>
                    <p className="text-center text-lg mt-1">
                      Flawless Alignment!
                    </p>
                    <p className="text-green-100 text-center mt-2">
                      No issues detected.
                    </p>
                  </div>
                )}

                {/* AI Tips + Virtual Coach */}
                <div className="mt-6 space-y-3">
                  <button
                    onClick={generateAiTips}
                    disabled={tipsLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-gray-100 border border-gray-600 transition disabled:opacity-60"
                  >
                    <Lightbulb className="w-4 h-4 text-yellow-300" />
                    {tipsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating AI Tips…
                      </>
                    ) : (
                      <>Generate Improvement Tips</>
                    )}
                  </button>

                  {tipsError && (
                    <div className="mt-2 p-3 rounded-md border border-red-400 bg-red-900/40 text-red-200 text-sm">
                      <strong>Error:</strong> {tipsError}
                    </div>
                  )}

                  {!!aiTips && (
                    <div className="mt-3 p-4 rounded-lg border border-cyan-400 bg-slate-800 text-gray-200 whitespace-pre-wrap">
                      {aiTips}
                    </div>
                  )}

                  <a
                    href="/virtual_coach"
                    className="w-full flex items-center justify-center px-8 py-4 mt-4 bg-slate-700 text-gray-300 font-bold rounded-lg shadow-lg hover:scale-105 hover:bg-slate-600 transform transition-all duration-300"
                  >
                    <Bot className="w-5 h-5 mr-2" />
                    Ask Virtual Coach for Advice
                  </a>
                </div>
              </div>
            </div>

            {/* Images */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-300 mb-3">
                  Your Form Scan
                </h3>
                <div className="border-2 border-gray-700 rounded-lg overflow-hidden shadow-lg bg-black">
                  {result.annotated_image && (
                    <img
                      src={result.annotated_image}
                      alt="Analysis result"
                      className="w-full h-auto object-contain"
                    />
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-300 mb-3">
                  Corrected Skeleton
                </h3>
                <div className="border-2 border-gray-700 rounded-lg overflow-hidden shadow-lg bg-black">
                  {result.corrected_skeleton_image && (
                    <img
                      src={result.corrected_skeleton_image}
                      alt="Corrected pose skeleton"
                      className="w-full h-auto object-contain"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleTryAnother}
              className="w-full flex items-center justify-center px-8 py-4 mt-8 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 hover:shadow-cyan-500/50 transform transition-all duration-300"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Analyze Another Posture
            </button>

            <button
              onClick={saveScoreToDashboard}
              className="w-full flex items-center justify-center px-8 py-4 mt-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 hover:shadow-green-500/50 transform transition-all duration-300"
            >
              Save Score to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analysis;
