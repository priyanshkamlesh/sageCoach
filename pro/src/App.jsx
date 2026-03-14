import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "./theme/ThemeProvider";
import ThemeToggleFab from "./components/ThemeToggleFab";

import Home from './pages/Home';
import Result from './pages/Result';
import Analysis from './pages/Analysis';
import User_details from './pages/User_details';
import Yoga from './pages/Yoga';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile'
import Video from './pages/Video';
import Virtual_coach from './pages/Virtual_coach';



export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
        <Route path='/' element={<Result/>}/>
          <Route path="/home" element={<Home />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/yoga" element={<Yoga />} />
          <Route path="/video" element={<Video />} />
          <Route path="/virtual_coach" element={<Virtual_coach />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user_details" element={<User_details />} />
          <Route path="/result" element={<Result />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        <ThemeToggleFab />
      </Router>
    </ThemeProvider>
  );
}
