import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Camera, Square, Play, Activity } from "lucide-react";

const DIFF_THRESHOLD = 28;
const ACTIVE_MOTION_THRESHOLD = 0.028;
const VERY_LOW_MOTION_THRESHOLD = 0.008;
const HIGH_MOTION_THRESHOLD = 0.2;

function getSessionFeedback(metrics, durationSec) {
  const {
    totalFrames,
    activeFrames,
    pauseEvents,
    leftDominantFrames,
    rightDominantFrames,
    meanMotion,
    meanActivityArea,
  } = metrics;

  const activityRatio = totalFrames ? activeFrames / totalFrames : 0;
  const lrTotal = leftDominantFrames + rightDominantFrames;
  const imbalanceRatio = lrTotal
    ? Math.abs(leftDominantFrames - rightDominantFrames) / lrTotal
    : 0;

  const mistakes = [];

  if (durationSec < 20) {
    mistakes.push("Session was too short to evaluate form reliably.");
  }
  if (activityRatio < 0.3) {
    mistakes.push("You stayed inactive for long periods between reps.");
  }
  if (pauseEvents >= 3) {
    mistakes.push("Too many long pauses were detected during your exercise.");
  }
  if (meanMotion < 0.02) {
    mistakes.push("Range of motion looked shallow. Try fuller movement in each rep.");
  }
  if (meanMotion > HIGH_MOTION_THRESHOLD) {
    mistakes.push("Movement appeared rushed or jerky. Slow down for better control.");
  }
  if (imbalanceRatio > 0.28) {
    mistakes.push("Left-right balance looked uneven. Keep your weight distribution symmetric.");
  }
  if (meanActivityArea < 0.05) {
    mistakes.push("You may be too far from camera. Keep your full body clearly visible.");
  }
  if (meanActivityArea > 0.72) {
    mistakes.push("You may be too close to camera. Step back slightly for complete tracking.");
  }

  if (!mistakes.length) {
    mistakes.push("Good control overall. Keep your spine neutral and maintain steady breathing.");
  }

  return {
    mistakes,
    stats: {
      activityPercent: Math.round(activityRatio * 100),
      pauseEvents,
      balanceScore: Math.max(0, Math.round((1 - imbalanceRatio) * 100)),
      avgMotion: Number(meanMotion.toFixed(3)),
    },
  };
}

export default function LivePosture() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const isRunningRef = useRef(false);
  const prevFrameRef = useRef(null);
  const lastPauseFlagRef = useRef(false);
  const startTimeRef = useRef(null);

  const metricsRef = useRef({
    totalFrames: 0,
    activeFrames: 0,
    pauseEvents: 0,
    leftDominantFrames: 0,
    rightDominantFrames: 0,
    motionSum: 0,
    activityAreaSum: 0,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [liveMotion, setLiveMotion] = useState(0);
  const [liveState, setLiveState] = useState("Idle");
  const [elapsed, setElapsed] = useState(0);
  const [report, setReport] = useState(null);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    let timerId;
    if (isRunning) {
      timerId = setInterval(() => {
        if (!startTimeRef.current) return;
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isRunning]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const analyzeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !isRunningRef.current) {
      rafRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    const targetWidth = 320;
    const targetHeight = 240;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const overlayCanvas = overlayCanvasRef.current;
    if (overlayCanvas) {
      overlayCanvas.width = targetWidth;
      overlayCanvas.height = targetHeight;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const frame = ctx.getImageData(0, 0, targetWidth, targetHeight).data;

    const prevFrame = prevFrameRef.current;
    if (!prevFrame) {
      prevFrameRef.current = new Uint8ClampedArray(frame);
      rafRef.current = requestAnimationFrame(analyzeFrame);
      return;
    }

    let total = 0;
    let changed = 0;
    let leftChanged = 0;
    let rightChanged = 0;
    let minX = targetWidth;
    let minY = targetHeight;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < targetHeight; y += 3) {
      for (let x = 0; x < targetWidth; x += 3) {
        const i = (y * targetWidth + x) * 4;

        const currGray = frame[i] * 0.299 + frame[i + 1] * 0.587 + frame[i + 2] * 0.114;
        const prevGray = prevFrame[i] * 0.299 + prevFrame[i + 1] * 0.587 + prevFrame[i + 2] * 0.114;
        const diff = Math.abs(currGray - prevGray);

        total += 1;
        if (diff > DIFF_THRESHOLD) {
          changed += 1;
          if (x < targetWidth / 2) leftChanged += 1;
          else rightChanged += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    prevFrameRef.current = new Uint8ClampedArray(frame);

    const motionScore = total ? changed / total : 0;
    let activityArea = 0;
    let hasLandmarks = false;
    if (changed > 20) {
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      activityArea = (bw * bh) / (targetWidth * targetHeight);
      hasLandmarks = true;
    }

    const m = metricsRef.current;
    m.totalFrames += 1;
    m.motionSum += motionScore;
    m.activityAreaSum += activityArea;

    if (motionScore > ACTIVE_MOTION_THRESHOLD) {
      m.activeFrames += 1;
      setLiveState("Active");
    } else {
      setLiveState("Resting");
    }

    if (motionScore < VERY_LOW_MOTION_THRESHOLD) {
      if (!lastPauseFlagRef.current && m.totalFrames % 60 === 0) {
        m.pauseEvents += 1;
        lastPauseFlagRef.current = true;
      }
    } else {
      lastPauseFlagRef.current = false;
    }

    if (leftChanged > rightChanged * 1.5 && motionScore > ACTIVE_MOTION_THRESHOLD) {
      m.leftDominantFrames += 1;
    }
    if (rightChanged > leftChanged * 1.5 && motionScore > ACTIVE_MOTION_THRESHOLD) {
      m.rightDominantFrames += 1;
    }

    if (overlayCanvas) {
      const octx = overlayCanvas.getContext("2d");
      octx.clearRect(0, 0, targetWidth, targetHeight);

      if (hasLandmarks) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const points = [
          [minX, minY],
          [maxX, minY],
          [minX, maxY],
          [maxX, maxY],
          [cx, minY],
          [cx, maxY],
          [minX, cy],
          [maxX, cy],
          [cx, cy],
        ];

        octx.strokeStyle = "rgba(34, 211, 238, 0.9)";
        octx.lineWidth = 2;
        octx.strokeRect(minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY));

        octx.fillStyle = "rgba(34, 211, 238, 0.95)";
        points.forEach(([px, py]) => {
          octx.beginPath();
          octx.arc(px, py, 3, 0, Math.PI * 2);
          octx.fill();
        });
      }
    }

    setLiveMotion(motionScore);
    rafRef.current = requestAnimationFrame(analyzeFrame);
  };

  const startCamera = async () => {
    setPermissionError("");
    setReport(null);
    setElapsed(0);
    prevFrameRef.current = null;
    lastPauseFlagRef.current = false;
    metricsRef.current = {
      totalFrames: 0,
      activeFrames: 0,
      pauseEvents: 0,
      leftDominantFrames: 0,
      rightDominantFrames: 0,
      motionSum: 0,
      activityAreaSum: 0,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startTimeRef.current = Date.now();
      setIsRunning(true);
      isRunningRef.current = true;
      rafRef.current = requestAnimationFrame(analyzeFrame);
    } catch (err) {
      setPermissionError("Camera access denied or unavailable on this device.");
      setIsRunning(false);
    }
  };

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const durationSec = startTimeRef.current
      ? Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000))
      : elapsed;

    setIsRunning(false);
    isRunningRef.current = false;
    setLiveState("Idle");
    setLiveMotion(0);
    startTimeRef.current = null;
    if (overlayCanvasRef.current) {
      const octx = overlayCanvasRef.current.getContext("2d");
      octx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    const m = metricsRef.current;
    const total = Math.max(1, m.totalFrames);
    const session = {
      ...m,
      meanMotion: m.motionSum / total,
      meanActivityArea: m.activityAreaSum / total,
    };

    if (m.totalFrames > 0) {
      setReport(getSessionFeedback(session, durationSec));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            Live Posture Detection
          </h1>
          <p className="text-gray-400 mt-2">
            Start camera tracking, perform your exercise, then stop to get your mistake report.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-gray-700 rounded-xl p-4 shadow-lg">
            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-700 relative">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {!isRunning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65">
                  <Camera className="w-10 h-10 text-cyan-300 mb-2" />
                  <p className="text-sm text-gray-300">Camera preview will appear here</p>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {permissionError && (
              <p className="text-red-400 text-sm mt-3">{permissionError}</p>
            )}

            <div className="flex flex-wrap gap-3 mt-4">
              {!isRunning ? (
                <button
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  <Play className="w-4 h-4" />
                  Start Detection
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                >
                  <Square className="w-4 h-4" />
                  Stop & Analyze
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-800 border border-gray-700 rounded-xl p-5 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-300" />
              Live Activity
            </h2>

            <div className="space-y-4">
              <p className="text-gray-300">
                Status: <span className="font-semibold text-white">{liveState}</span>
              </p>
              <p className="text-gray-300">
                Elapsed Time: <span className="font-semibold text-white">{elapsed}s</span>
              </p>
              <div>
                <p className="text-gray-300 mb-2">Movement Intensity</p>
                <div className="w-full h-3 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-150"
                    style={{ width: `${Math.min(100, liveMotion * 500)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Score: {liveMotion.toFixed(3)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {report && (
          <section className="mt-8 bg-slate-800 border border-cyan-500/30 rounded-xl p-6 shadow-xl">
            <h3 className="text-2xl font-bold text-cyan-300 mb-4">Session Report</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              <div className="bg-slate-700/70 rounded-lg p-3">
                <p className="text-xs text-gray-400">Activity %</p>
                <p className="text-xl font-bold text-white">{report.stats.activityPercent}%</p>
              </div>
              <div className="bg-slate-700/70 rounded-lg p-3">
                <p className="text-xs text-gray-400">Pause Events</p>
                <p className="text-xl font-bold text-white">{report.stats.pauseEvents}</p>
              </div>
              <div className="bg-slate-700/70 rounded-lg p-3">
                <p className="text-xs text-gray-400">Balance Score</p>
                <p className="text-xl font-bold text-white">{report.stats.balanceScore}/100</p>
              </div>
              <div className="bg-slate-700/70 rounded-lg p-3">
                <p className="text-xs text-gray-400">Avg Motion</p>
                <p className="text-xl font-bold text-white">{report.stats.avgMotion}</p>
              </div>
            </div>

            <h4 className="font-semibold text-lg mb-2 text-white">Detected Mistakes / Advice</h4>
            <ul className="space-y-2">
              {report.mistakes.map((item, idx) => (
                <li
                  key={`${item}-${idx}`}
                  className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-gray-200"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
