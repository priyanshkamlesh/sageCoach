import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "./theme/ThemeProvider";
import ThemeToggleFab from "./components/ThemeToggleFab";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from './pages/Home';
import Result from './pages/Result';
import Analysis from './pages/Analysis';
import User_details from './pages/User_details';
import Yoga from './pages/Yoga';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile'
import Video from './pages/Video';
import Virtual_coach from './pages/Virtual_coach';
import LivePosture from "./pages/LivePosture";



export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path='/' element={<Result/>}/>
          <Route path="/login" element={<Result />} />
          <Route path="/result" element={<Result />} />

          <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="/yoga" element={<ProtectedRoute><Yoga /></ProtectedRoute>} />
          <Route path="/video" element={<ProtectedRoute><Video /></ProtectedRoute>} />
          <Route path="/virtual_coach" element={<ProtectedRoute><Virtual_coach /></ProtectedRoute>} />
          <Route path="/live-posture" element={<ProtectedRoute><LivePosture /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/user_details" element={<ProtectedRoute><User_details /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ThemeToggleFab />
      </Router>
    </ThemeProvider>
  );
}
