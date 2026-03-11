import React, { useState, useRef, useEffect } from 'react';

// --- (NEW) Placeholder Navbar Component ---
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
          <a href="home" className="text-gray-300 hover:text-cyan-400 transition-colors">Home</a>
          <a href="dashboard" className="text-gray-300 hover:text-cyan-400 transition-colors">Dashboard</a>
          <a href="profile" className="text-gray-300 hover:text-cyan-400 transition-colors">Profile</a>
        </div>
      </div>
    </nav>
  );
};


const getChatResponse = async (history) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${import.meta.env.VITE_GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`;

  const systemInstruction = `You are a specialized health, fitness, and nutrition expert.
Your goal is to provide accurate and helpful information.
**Your HIGHEST PRIORITY is to provide answers in a list of bullet points.**
**Use bullet points (- text) or numbered points (1. text) for ALL answers.**
**Keep the points short and precise.**

You can answer questions about:
- Diseases and health conditions
- Food, nutrition, and calories
- Sports and fitness exercises
- Creating diet plans and exercise routines

**When a user asks for a plan (like a diet or exercise plan), ask only ONE follow-up question at a time.** For example, if they need a diet plan, first ask for their goals. After they answer, then ask for their BMI. Do not ask for all information at once.
If you provide medical advice, include a brief disclaimer to consult a professional.`;

  const contents = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }]
  }));

  const payload = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    tools: [
      { "google_search": {} }
    ],
  };

  let response;
  let retries = 0;
  const maxRetries = 5;
  let delay = 1000; // 1 second

  while (retries < maxRetries) {
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
          return candidate.content.parts[0].text;
        } else {
          throw new Error("Invalid response structure from API");
        }
      } else if (response.status === 429 || response.status >= 500) {
        throw new Error(`API Error: ${response.status}`);
      } else {
        const errorResult = await response.json();
        console.error("API Error:", errorResult);
        return `Error: ${errorResult.error?.message || 'Failed to get response.'}`;
      }

    } catch (error) {
      if (retries === maxRetries - 1) {
        console.error("Max retries reached. Error fetching chat response:", error);
        return "Sorry, I'm having trouble connecting. Please try again later.";
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
      retries++;
    }
  }
  
  return "Sorry, I ran into an issue and couldn't get a response.";
};

/**
 * --- (NEW) Helper function to parse simple Markdown to HTML ---
 * This will format headings, bold text, and lists.
 */
const parseMarkdownToHtml = (text) => {
  if (!text) return '';

  return text
    .replace(/^###\s(.*$)/gim, '<h3 class="text-lg font-semibold mb-1">$1</h3>')
    .replace(/^##\s(.*$)/gim, '<h2 class="text-xl font-semibold mb-2">$1</h2>')
    .replace(/^#\s(.*$)/gim, '<h1 class="text-2xl font-bold mb-3">$1</h1>')
    
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold">$1</strong>')
    
    .replace(/^(?:\*|-\s)(.*$)/gim, '<li>$1</li>')
    .replace(/<li>(.*?)<\/li>\s*(?=(?:<li>|<\/ul>|$))/gim, '<li>$1</li>')
    .replace(/((<li>.*<\/li>\s*)+)/gim, '<ul class="list-disc list-inside ml-4 my-2">$1</ul>')

    .replace(/^(\d+\.)\s(.*$)/gim, '<li>$2</li>') 
    .replace(/((<li>.*<\/li>\s*)+)/gim, (match, p1) => {
      if (match.includes('<ul')) return match; 
      return `<ol class="list-decimal list-inside ml-4 my-2">${p1}</ol>`;
    })

    .replace(/^(?!<h[1-3]>|<ul>|<ol>|<li>)(.*$)/gim, '<p class="mb-2">$1</p>')
    .replace(/<\/p>\s*<p/g, '</p><p'); 
};


export default function FitnessChatbot() {
  const [chatHistory, setChatHistory] = useState([
    { sender: 'bot', text: 'Welcome! I am your Health & Fitness AI Expert. Ask me about diet plans, exercises, or food calories!' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  /**
   * Handles sending a new message.
   * @param {React.FormEvent<HTMLFormElement>} e - The form submission event.
   */
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userMessage = userInput.trim();

    const newHistory = [...chatHistory, { sender: 'user', text: userMessage }];
    setChatHistory(newHistory);
    setUserInput('');
    setIsLoading(true);

    try {
      const botResponse = await getChatResponse(newHistory);

      setChatHistory(prev => [...prev, { sender: 'bot', text: botResponse }]);

    } catch (error) {
      console.error("Chatbot API Error:", error);
      setChatHistory(prev => [...prev, { sender: 'bot', text: 'Sorry, I ran into an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renders an individual chat message bubble.
   * @param {{ message: { sender: string, text: string } }} props - The message object.
   */
  const MessageBubble = ({ message }) => {
    const isBot = message.sender === 'bot';
    const messageContent = isBot 
      ? parseMarkdownToHtml(message.text) 
      : message.text;

    return (
      <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-md ${
          message.sender === 'user'
            ? 'bg-indigo-500 text-white rounded-br-none' 
            : 'bg-gray-200 text-gray-800 rounded-tl-none' 
        }`}>
          {isBot ? (
            <div 
              className="prose prose-sm max-w-none" 
              dangerouslySetInnerHTML={{ __html: messageContent }} 
            />
          ) : (
            messageContent
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-gray-200 p-4 md:p-8 font-sans">
      <Navbar />
      
      <div className="flex flex-col max-w-4xl mx-auto h-[75vh] bg-slate-800 rounded-xl shadow-2xl border border-gray-700">
        
        <div className="flex-shrink-0 flex items-center justify-center p-4 bg-slate-900/50 text-white shadow-md rounded-t-lg border-b border-gray-700">
          <h3 className="text-xl font-semibold">Health & Fitness AI Expert</h3>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-2">
          {chatHistory.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}
          
          {isLoading && (
            <div className="flex justify-start mb-3">
              <div className="max-w-xs p-3 rounded-xl bg-gray-700 text-gray-300 rounded-tl-none flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce delay-200"></div>
                <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="flex-shrink-0 p-4 border-t border-gray-700 bg-slate-800 rounded-b-lg">
          <div className="flex space-x-2 w-full mx-auto">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask about exercises, diet plans, or food..."
              className="flex-1 p-3 bg-slate-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
              disabled={isLoading}
            />
            <button
              type="submit"
              className={`p-3 rounded-lg text-white font-semibold transition-colors duration-200 ${
                userInput.trim() && !isLoading ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-gray-500 cursor-not-allowed'
              }`}
              disabled={!userInput.trim() || isLoading}
              aria-label="Send Message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}