import React, { useState, useEffect } from 'react';
import { User, Cake, Activity, ArrowRight, TrendingUp, Heart, CheckCircle, Play, X } from 'lucide-react';
import { API_BASE_URL } from "../config";

// --- Navbar (unchanged) ---
const Navbar = () => {
  return (
    <nav className="bg-slate-800 p-4 rounded-lg mb-8 border border-gray-700 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Heart className="w-8 h-8 text-cyan-400" />
          <span className="text-xl font-bold text-white">Posture Quest AI</span>
        </div>
      </div>
    </nav>
  );
};

// --- BMI Calculator (unchanged) ---
const calculateBMI = (height, weight) => {
  if (!height || !weight || height <= 0 || weight <= 0) {
    return { bmi: null, category: 'N/A' };
  }
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  let category = 'N/A';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 18.5 && bmi < 24.9) category = 'Normal';
  else if (bmi >= 25 && bmi < 29.9) category = 'Overweight';
  else category = 'Obese';
  return { bmi: bmi.toFixed(1), category };
};

// --- Form Input (unchanged) ---
const FormInput = ({ icon, label, name, value, onChange, type = "number", min, children, placeholder }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-400 mb-1">
      {label}
    </label>
    <div className="flex items-center bg-slate-700/50 backdrop-blur-sm border border-gray-600 rounded-lg focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/50 transition-all duration-300 hover:border-gray-500">
      <span className="pl-3 pr-2 text-gray-400">{icon}</span>
      {type === "select" ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          className="w-full bg-transparent p-3 text-white placeholder-gray-500 focus:outline-none"
        >
          {children}
        </select>
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          min={min}
          placeholder={placeholder || (type === 'number' ? "0" : "...")}
          className="w-full bg-transparent p-3 text-white placeholder-gray-500 focus:outline-none"
        />
      )}
    </div>
  </div>
);

// --- Popup #1: Success (auto-close, then triggers next popup) ---
const SuccessPopup = ({ onDone }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone(); // show the next popup instead of redirecting here
    }, 1500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-cyan-400 rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
        <CheckCircle className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Profile Saved!</h2>
        <p className="text-gray-300">Great! We’ve saved your details.</p>
      </div>
    </div>
  );
};

// --- Popup #2: Start Tutorial? (Start / Skip) ---
const TutorialPrompt = ({ onStart, onSkip }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 w-[95%] max-w-md animate-fadeIn">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-white">Start Tutorial?</h3>
          <button
            onClick={onSkip}
            className="p-1 rounded hover:bg-slate-700"
            aria-label="Close"
            title="Skip tutorial"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
        </div>
        <p className="text-gray-300 mb-6">
          We can guide you through the Home page options. Start now or skip anytime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onSkip}
            className="flex-1 px-5 py-3 rounded-lg bg-slate-700 border border-gray-600 text-white hover:bg-slate-600 transition"
          >
            Skip
          </button>
          <button
            onClick={onStart}
            className="flex-1 px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-95 flex items-center justify-center"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Tutorial
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- helper: get current email from session/localStorage (no UI change) ----
function getCurrentEmail() {
  try {
    const cu = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (cu?.email) return cu.email;
  } catch {}
  const e = localStorage.getItem("userEmail");
  return e || "";
}

// --- Main Component ---
function UserDetails() {
  const [details, setDetails] = useState({
    name: '',
    height: '',
    weight: '',
    age: '',
    gender: '',
    purpose: ''
  });

  // NEW: username (minimal addition)
  const [username, setUsername] = useState('');

  const [bmiResult, setBmiResult] = useState({ bmi: null, category: 'N/A' });
  const [error, setError] = useState(null);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false);

  useEffect(() => {
    const { bmi, category } = calculateBMI(details.height, details.weight);
    setBmiResult({ bmi, category });
  }, [details.height, details.weight]);

  // Prefill username if already saved for this user (no UI change)
  useEffect(() => {
    const email = getCurrentEmail();
    if (!email) return;
    try {
      const profiles = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const me = profiles[email];
      if (me?.username) setUsername(me.username);
    } catch {}
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, height, weight, age, gender, purpose } = details;
    const trimmedUsername = (username || "").trim();

    if (name && trimmedUsername && height && weight && age && gender && purpose) {
      setError(null);
      const email = getCurrentEmail();

      if (!email) {
        setError("User email not found. Please login again.");
        return;
      }

      const payload = {
        email,
        profile: {
          name: (name || "").trim(),
          username: trimmedUsername,
          height: Number(height),
          weight: Number(weight),
          age: Number(age),
          gender,
          purpose,
          bmi: bmiResult.bmi ? Number(bmiResult.bmi) : null,
        },
      };

      try {
        const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save profile in database.");
        }
      } catch (saveErr) {
        setError(saveErr.message || "Unable to save profile. Please try again.");
        return;
      }

      // NEW: persist username alongside the profile for the current email (invisible to UI)
      if (email) {
        try {
          const profiles = JSON.parse(localStorage.getItem("userProfile") || "{}");
          profiles[email] = {
            ...(profiles[email] || {}),
            username: trimmedUsername,
            // keeping some useful basics if you want them in Profile later (optional)
            name: (name || "").trim(),
            age: Number(age),
            gender,
            purpose,
            email,
          };
          localStorage.setItem("userProfile", JSON.stringify(profiles));
          localStorage.setItem("userName", trimmedUsername);
        } catch {}
      }

      // show first popup; after auto-close it will trigger the tutorial prompt
      setShowSuccess(true);
    } else {
      setError("Please fill out all fields (including Username) to proceed.");
    }
  };

  // tutorial actions
  const startTutorial = () => {
    window.location.href = '/home?tutorial=1';
  };
  const skipTutorial = () => {
    window.location.href = '/home';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8 font-sans relative">
      <Navbar />
      <div className="max-w-3xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            Create Your Profile
          </h1>
          <p className="text-xl text-gray-400">This helps us personalize your posture tips.</p>
        </header>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-5 py-4 rounded-lg mb-8 flex items-center" role="alert">
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="md:col-span-2 bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-700 space-y-4">
            <FormInput
              icon={<User className="w-5 h-5" />}
              label="Your Name"
              name="name"
              type="text"
              value={details.name}
              onChange={handleChange}
              placeholder="Enter your name"
            />

            {/* NEW: Username (same styling) */}
            <FormInput
              icon={<User className="w-5 h-5" />}
              label="Username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. shiv_mishra"
            />

            <FormInput
              icon={<TrendingUp className="w-5 h-5" />}
              label="Height (in cm)"
              name="height"
              type="number"
              min="1"
              value={details.height}
              onChange={handleChange}
            />
            <FormInput
              icon={<Heart className="w-5 h-5" />}
              label="Weight (in kg)"
              name="weight"
              type="number"
              min="1"
              value={details.weight}
              onChange={handleChange}
            />
            <FormInput
              icon={<Cake className="w-5 h-5" />}
              label="Your Age"
              name="age"
              type="number"
              min="1"
              value={details.age}
              onChange={handleChange}
            />
            <FormInput
              icon={<User className="w-5 h-5" />}
              label="Your Gender"
              name="gender"
              type="select"
              value={details.gender}
              onChange={handleChange}
            >
              <option value="" disabled className="bg-slate-700">Select...</option>
              <option value="male" className="bg-slate-700">Male</option>
              <option value="female" className="bg-slate-700">Female</option>
              <option value="other" className="bg-slate-700">Other</option>
              <option value="prefer_not_to_say" className="bg-slate-700">Prefer not to say</option>
            </FormInput>
            <FormInput
              icon={<Activity className="w-5 h-5" />}
              label="Main Purpose of Exercise"
              name="purpose"
              type="select"
              value={details.purpose}
              onChange={handleChange}
            >
              <option value="" disabled className="bg-slate-700">Select...</option>
              <option value="general_fitness" className="bg-slate-700">General Fitness</option>
              <option value="posture_correction" className="bg-slate-700">Posture Correction</option>
              <option value="strength_building" className="bg-slate-700">Strength Building</option>
              <option value="other" className="bg-slate-700">Other</option>
            </FormInput>

            {/* Single primary action */}
            <button
              type="submit"
              className="w-full flex items-center justify-center px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg shadow-lg hover:scale-105 hover:shadow-cyan-500/50 transform transition-all duration-300"
            >
              Save & Continue
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </form>

          {/* BMI Card */}
          <div className="md:col-span-1 bg-slate-800 p-6 rounded-xl shadow-lg border border-gray-700 flex flex-col items-center justify-center">
            <h3 className="text-2xl font-bold text-white mb-4">Your BMI</h3>
            <div className="flex items-center justify-center w-36 h-36 rounded-full bg-slate-700 border-4 border-cyan-400">
              <span className="text-4xl font-bold text-white">
                {bmiResult.bmi || '--'}
              </span>
            </div>
            <p className="text-2xl font-semibold text-cyan-400 mt-4">{bmiResult.category}</p>
            <p className="text-gray-400 text-center mt-2">
              Body Mass Index (BMI) is calculated using height and weight.
            </p>
          </div>
        </div>
      </div>

      {/* Popups */}
      {showSuccess && (
        <SuccessPopup
          onDone={() => {
            setShowSuccess(false);
            setShowTutorialPrompt(true);
          }}
        />
      )}

      {showTutorialPrompt && (
        <TutorialPrompt
          onStart={startTutorial}
          onSkip={skipTutorial}
        />
      )}
    </div>
  );
}

const GlobalStyles = () => (
  <style>{`
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.5s ease-out forwards;
    }
  `}</style>
);

export default function UserDetailsWithStyles() {
  return (
    <>
      <GlobalStyles />
      <UserDetails />
    </>
  );
}
