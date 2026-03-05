// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  TrendingUp,
  ClipboardList,
  Clock,
  BarChart2,
  Calendar,
  FileText,
  AlertOctagon,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import AccountBanner from "../components/AccountBanner";
import { useAuthGuard } from "../hooks/useAuthguard";

const API_BASE_URL =
  import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5000";

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
          href="/analysis"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Analysis
        </a>
        <a
          href="/yoga"
          className="text-gray-300 hover:text-cyan-400 transition-colors"
        >
          Yoga
        </a>
        <a
          href="/dashboard"
          className="text-cyan-400 font-semibold border-b border-cyan-400"
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

export default function Dashboard() {
  useAuthGuard(); // 🔒 protect this page

  // For graph
  const [scores, setScores] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(true);

  // For detailed reports
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTrend = async () => {
      setLoadingTrend(true);
      try {
        const res = await fetch(`${API_BASE_URL}/scores`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.scores || [];
        setScores(
          arr
            .map((v) => Number(v))
            .filter((v) => Number.isFinite(v) && v >= 0 && v <= 100)
        );
      } catch (e) {
        console.error(e);
        setError(
          (prev) =>
            prev ||
            "Failed to load progress trend from /scores (check backend)."
        );
      } finally {
        setLoadingTrend(false);
      }
    };

    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/scores`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setSessions(arr);
        if (arr.length > 0) setSelectedSession(arr[0]); // latest by default
      } catch (e) {
        console.error(e);
        setError(
          (prev) =>
            prev ||
            "Failed to load previous reports from /api/scores (check backend)."
        );
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchTrend();
    fetchSessions();
  }, []);

  const { latestScore, averageScore, totalSessions, chartData } = useMemo(() => {
    if (!scores || scores.length === 0) {
      return {
        latestScore: null,
        averageScore: null,
        totalSessions: sessions.length,
        chartData: [],
      };
    }
    const last = scores[scores.length - 1];
    const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
    const chartData = scores.map((s, idx) => ({
      session: idx + 1,
      score: s,
    }));
    return {
      latestScore: last,
      averageScore: avg,
      totalSessions: sessions.length || scores.length,
      chartData,
    };
  }, [scores, sessions.length]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const da = new Date(a.created_at || 0).getTime();
      const db = new Date(b.created_at || 0).getTime();
      return db - da;
    });
  }, [sessions]);

  const formatDateTime = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8">
      <Navbar />

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <AccountBanner />
        </div>

        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            Dashboard
          </h1>
          <p className="text-gray-400 text-sm md:text-base">
            See how your posture scores have changed over time and review
            detailed session reports.
          </p>
        </header>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-5 py-4 rounded-lg mb-6 flex items-center">
            <AlertOctagon className="w-6 h-6 mr-3 text-red-400" />
            <div>
              <strong className="font-bold mr-2">Note:</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Latest score */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            <div>
              <div className="text-sm text-gray-400">Latest Score</div>
              <div className="text-2xl font-bold text-white">
                {latestScore !== null ? `${latestScore.toFixed(1)}%` : "--"}
              </div>
            </div>
          </div>

          {/* Average score */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-sm text-gray-400">Average Score</div>
              <div className="text-2xl font-bold text-white">
                {averageScore !== null ? `${averageScore.toFixed(1)}%` : "--"}
              </div>
            </div>
          </div>

          {/* Total sessions → click to open history */}
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow flex items-center gap-3 text-left hover:border-cyan-400 hover:bg-slate-700/70 transition"
          >
            <ClipboardList className="w-6 h-6 text-amber-300" />
            <div>
              <div className="text-sm text-gray-400">Total Sessions</div>
              <div className="text-2xl font-bold text-white">
                {totalSessions}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Click to view previous reports
              </div>
            </div>
          </button>
        </div>

        {/* Progress trend (graph) */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">
                Progress Trend
              </h2>
            </div>
            <span className="text-xs text-gray-400">
              Sessions: {chartData.length}
            </span>
          </div>

          {loadingTrend ? (
            <p className="text-gray-400 text-sm">Loading trend…</p>
          ) : chartData.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No scores yet. After analyzing a posture, click{" "}
              <span className="font-semibold text-cyan-300">
                “Save Score to Dashboard”
              </span>{" "}
              to see your graph here.
            </p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="session"
                    stroke="#9ca3af"
                    label={{
                      value: "Session",
                      position: "insideBottomRight",
                      offset: -5,
                      fill: "#9ca3af",
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#9ca3af"
                    label={{
                      value: "Score (%)",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#9ca3af",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      borderColor: "#4b5563",
                      borderRadius: "0.5rem",
                      color: "#e5e7eb",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#22d3ee"
                    strokeWidth={3}
                    dot={{ r: 4, stroke: "#0ea5e9", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Previous reports section – toggled by Total Sessions */}
        {showHistory && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">
                  Previous Session Reports
                </h2>
              </div>
              <span className="text-xs text-gray-400">
                {sortedSessions.length} saved
              </span>
            </div>

            {loadingSessions ? (
              <p className="text-gray-400 text-sm">
                Loading previous reports…
              </p>
            ) : sortedSessions.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No reports found in the database.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: list */}
                <div className="border border-slate-700 rounded-lg max-h-72 overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-left text-gray-400 border-b border-slate-700">
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Date &amp; Time</th>
                        <th className="py-2 px-3">Score</th>
                        <th className="py-2 px-3">Posture</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSessions.slice(0, 40).map((s, idx) => {
                        const scoreVal = Number(s.score || 0);
                        let scoreColor = "text-red-400";
                        if (scoreVal > 40) scoreColor = "text-yellow-300";
                        if (scoreVal > 75) scoreColor = "text-green-400";

                        const activity =
                          (s.meta && s.meta.activity) || "General posture";

                        const isSelected =
                          selectedSession && selectedSession.id === s.id;

                        return (
                          <tr
                            key={s.id || idx}
                            onClick={() => setSelectedSession(s)}
                            className={`cursor-pointer border-b border-slate-800 hover:bg-slate-700/40 ${
                              isSelected ? "bg-slate-700/70" : ""
                            }`}
                          >
                            <td className="py-1.5 px-3 text-gray-400">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 text-gray-200">
                              {formatDateTime(s.created_at)}
                            </td>
                            <td
                              className={`py-1.5 px-3 font-semibold ${scoreColor}`}
                            >
                              {Math.round(scoreVal)}%
                            </td>
                            <td className="py-1.5 px-3 text-gray-300">
                              {activity}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Right: selected session summary */}
                <div className="border border-slate-700 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-semibold text-white">
                      Session Report
                    </h3>
                  </div>

                  {selectedSession ? (
                    <>
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">
                          Date &amp; Time
                        </div>
                        <div className="text-sm text-gray-200">
                          {formatDateTime(selectedSession.created_at)}
                        </div>
                      </div>

                      <div className="mb-3 flex items-center gap-2">
                        <div>
                          <div className="text-xs text-gray-400 mb-1">
                            Alignment Score
                          </div>
                          <div className="text-2xl font-bold text-white">
                            {Math.round(
                              Number(selectedSession.score || 0)
                            )}
                            %
                          </div>
                        </div>
                      </div>

                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">
                          Posture / Activity
                        </div>
                        <div className="text-sm text-gray-200">
                          {selectedSession.meta?.activity ||
                            "General posture"}
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 mt-2">
                        For fresh visual analysis and tips, open the{" "}
                        <span className="text-cyan-300 font-semibold">
                          Analysis
                        </span>{" "}
                        or{" "}
                        <span className="text-cyan-300 font-semibold">
                          Yoga
                        </span>{" "}
                        page and run a new session.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Select a session from the list to view its summary here.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
