import React, { useState, useEffect } from 'react';
// We will use a standard <a> tag for navigation within the HashRouter.
import { ArrowLeft, Loader2, AlertTriangle, Search, VolumeX } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="bg-slate-800 p-4 rounded-lg mb-8 border border-gray-700 shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <a href="#/" className="flex items-center gap-3 group">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform"
          >
            {/* Using a simple bot icon path */}
            <path d="M12 8V4H8" />
            <path d="M16 4h-4" />
            <path d="M12 16h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2" />
            <path d="M12 16v4" />
            <path d="M8 16v4" />
            <path d="M16 16v4" />
            <path d="M10 12h.01" />
            <path d="M14 12h.01" />
          </svg>
          {/* --- (MODIFIED) Title changed --- */}
          <span className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">Virtual Coach</span>
        </a>
        <div className="flex items-center gap-4">
          <a href="dashboard" className="text-gray-300 hover:text-cyan-400 transition-colors">Dashboard</a>
          <a href="profile" className="text-gray-300 hover:text-cyan-400 transition-colors">Profile</a>
        </div>
      </div>
    </nav>
  );
};

// --- YouTube Shorts Player Component ---
export default function ShortsPlayer() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- NEW STATE for Search and Filter ---
  const [searchQuery, setSearchQuery] = useState("fitness shorts OR sports shorts");
  const [sortOrder, setSortOrder] = useState("relevance"); // 'relevance', 'viewCount', 'rating'
  
  // --- IMPORTANT ---
  // Add your YouTube Data API Key here.
  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY; // <--- PASTE YOUR API KEY HERE

  /**
   * Fetches videos from YouTube API based on current query and sort order.
   */
  const fetchShorts = async (query, order) => {
    if (!YOUTUBE_API_KEY) {
      setError("YouTube API Key is missing.");
      setIsLoading(false);
      return; // Stop if no API key
    }

    setIsLoading(true);
    setError(null);
    
    const maxResults = 25;
    // API call to search for short videos
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoDuration=short&maxResults=${maxResults}&order=${order}&key=${YOUTUBE_API_KEY}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error.message || "Failed to fetch videos. Check API key and quotas.");
      }
      const data = await response.json();
      setVideos(data.items || []);
    } catch (err) {
      console.error("Error fetching YouTube videos:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Run once on mount to fetch initial videos
  useEffect(() => {
    // Stop scrolling on the main body when this component is mounted
    document.body.style.overflow = 'hidden';
    
    // Fetch initial videos with default query and sort order
    fetchShorts(searchQuery, sortOrder);

    // Cleanup function to re-enable body scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- NEW: Handler for search form submission ---
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return; // Don't search if query is empty
    fetchShorts(searchQuery, sortOrder);
  };

  // --- NEW: Handler for changing the sort filter ---
  const handleSortChange = (e) => {
    const newSortOrder = e.target.value;
    setSortOrder(newSortOrder);
    // Re-fetch videos with the new sort order
    fetchShorts(searchQuery, newSortOrder);
  };

  // --- MODIFIED: Main container is now flex-col ---
  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white font-sans">
      <Navbar/>
      
      {/* --- MODIFIED: UI Overlay is now a static header block --- */}
      <div className="flex-shrink-0 p-4 bg-black/90 border-b border-gray-700 z-50">
        <div className="flex items-center justify-between mb-3">
          {/* Back Button */}
          <a
            href="home"
            className="p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-colors"
            aria-label="Go back to home"
          >
            <ArrowLeft size={24} />
          </a>
          
          {/* Title */}
          <div className="text-center">
            <h1 className="text-lg font-semibold">Fitness & Sports Shorts</h1>
            {/* --- NEW: Unmute Hint --- */}
            <p className="text-xs text-gray-400 flex items-center justify-center">
              <VolumeX size={12} className="mr-1" />
              Tap video to unmute
            </p>
          </div>
          
          {/* Spacer */}
          <div className="w-10"></div>
        </div>

        {/* --- NEW: Search Form --- */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2">
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for shorts..."
            className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button 
            type="submit" 
            className="p-2 bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </form>

        {/* --- NEW: Filter Dropdown --- */}
        <div className="flex justify-end">
          <label htmlFor="sortOrder" className="text-xs text-gray-400 mr-2 self-center">Sort by:</label>
          <select 
            id="sortOrder"
            value={sortOrder}
            onChange={handleSortChange}
            className="p-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="relevance">Relevance</option>
            <option value="viewCount">View Count</option>
            <option value="rating">Rating</option>
          </select>
        </div>
      </div>

      {/* --- MODIFIED: Loading State now fills flex-1 --- */}
      {isLoading && (
        <div className="flex-1 w-full flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-white" />
          <p className="mt-4 text-lg">Loading Shorts...</p>
        </div>
      )}

      {/* --- MODIFIED: Error State now fills flex-1 (removed pt-40) --- */}
      {error && !isLoading && (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center p-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
          <p className="mt-4 text-lg font-semibold">An Error Occurred</p>
          <p className="text-gray-300 max-w-md">{error}</p>
          {error === "YouTube API Key is missing." && (
            <p className="mt-2 text-yellow-400 bg-gray-800 p-3 rounded-lg">
              Please add your `YOUTUBE_API_KEY` to `ShortsPlayer.jsx` to load videos.
            </p>
          )}
        </div>
      )}

      {/* --- MODIFIED: Video Shorts Container now fills flex-1 --- */}
      {!isLoading && !error && videos.length > 0 && (
        <div className="flex-1 w-full overflow-y-auto overflow-x-hidden snap-y snap-mandatory relative">
          {videos.map((video) => (
            // --- MODIFIED: Video item is now h-full (fills parent) ---
            <div 
              key={video.id.videoId} 
              className="h-full w-full snap-start flex items-center justify-center relative bg-black"
            >
              {/* --- MODIFIED: Iframe uses h-full and removed max-h --- */}
              <iframe
                src={`https://www.youtube.com/embed/${video.id.videoId}?autoplay=1&mute=1&loop=1&playlist=${video.id.videoId}&controls=0`}
                title={video.snippet.title}
                frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-[9/16] h-full w-auto max-w-full rounded-xl"
              ></iframe>
              
              {/* Video Title Overlay (bottom) */}
              <div className="absolute bottom-12 md:bottom-16 left-4 right-4 max-w-sm mx-auto z-30 p-3 bg-black/40 rounded-lg backdrop-blur-sm">
                <p className="text-white text-sm font-medium line-clamp-2">
                  {video.snippet.title}
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  {video.snippet.channelTitle}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODIFIED: No Videos State now fills flex-1 (removed pt-40) --- */}
      {!isLoading && !error && videos.length === 0 && (
        <div className="flex-1 w-full flex flex-col items-center justify-center text-center p-4">
          <p className="text-lg">No shorts found for that search.</p>
        </div>
      )}
    </div>
  );
}