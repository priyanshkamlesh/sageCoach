import React, { useState, useRef, useEffect } from 'react';
import { API_BASE_URL } from '../config';

let rateLimitUntil = 0;
const VIRTUAL_COACH_ENDPOINT = `${API_BASE_URL}/virtual_coach/chat`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (headerValue) => {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (Number.isNaN(dateMs)) return null;

  return Math.max(0, dateMs - Date.now());
};

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
            <path d="M12 8V4H8" />
            <path d="M16 4h-4" />
            <path d="M12 16h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2" />
            <path d="M12 16v4" />
            <path d="M8 16v4" />
            <path d="M16 16v4" />
            <path d="M10 12h.01" />
            <path d="M14 12h.01" />
          </svg>
          <span className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">
            Virtual Coach
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a href="/home" className="text-gray-300 hover:text-cyan-400 transition-colors">
            Home
          </a>
          <a href="/dashboard" className="text-gray-300 hover:text-cyan-400 transition-colors">
            Dashboard
          </a>
          <a href="/profile" className="text-gray-300 hover:text-cyan-400 transition-colors">
            Profile
          </a>
        </div>
      </div>
    </nav>
  );
};


const getChatResponse = async (history) => {
  if (Date.now() < rateLimitUntil) {
    const waitSeconds = Math.ceil((rateLimitUntil - Date.now()) / 1000);
    return `Rate limit reached. Please wait about ${waitSeconds}s and try again.`;
  }

  const payload = { history };

  let retries = 0;
  const maxRetries = 5;
  let delay = 1200;

  while (retries < maxRetries) {
    try {
      const response = await fetch(VIRTUAL_COACH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const reply = (result.reply || '').trim();
        if (reply) {
          return reply;
        }
        throw new Error("Invalid response structure from API");
      } else if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
        const jitterMs = Math.floor(Math.random() * 300);
        const waitMs = retryAfterMs ?? delay + jitterMs;

        rateLimitUntil = Date.now() + waitMs;

        if (retries === maxRetries - 1) {
          return `Too many requests (429). Please retry in about ${Math.ceil(waitMs / 1000)}s.`;
        }

        await sleep(waitMs);
        delay = Math.min(delay * 2, 15000);
        retries++;
        continue;
      } else if (response.status === 401) {
        const errorResult = await response.json().catch(() => ({}));
        return `Error: ${errorResult.error || 'Unauthorized request. Check backend GROQ_API_KEY.'}`;
      } else if (response.status === 400) {
        const errorResult = await response.json().catch(() => ({}));
        return `Error: ${errorResult.error || 'Invalid request sent to chatbot service.'}`;
      } else if (response.status >= 500) {
        const errorResult = await response.json().catch(() => ({}));
        const serverMessage = errorResult.error || 'The AI service is temporarily unavailable. Please try again shortly.';

        if (retries === maxRetries - 1) {
          return `Error: ${serverMessage}`;
        }
        const jitterMs = Math.floor(Math.random() * 300);
        await sleep(delay + jitterMs);
        delay = Math.min(delay * 2, 15000);
        retries++;
        continue;
      } else {
        const errorResult = await response.json().catch(() => ({}));
        console.error("API Error:", errorResult);
        return `Error: ${errorResult.error || 'Failed to get response.'}`;
      }

    } catch (error) {
      if (retries === maxRetries - 1) {
        console.error("Max retries reached. Error fetching chat response:", error);
        return "Sorry, I'm having trouble connecting. Please try again later.";
      }
      const jitterMs = Math.floor(Math.random() * 300);
      await sleep(delay + jitterMs);
      delay = Math.min(delay * 2, 15000);
      retries++;
    }
  }
  
  return "Sorry, I ran into an issue and couldn't get a response.";
};

const renderInlineBold = (text, keyPrefix) => {
  const parts = [];
  let lastIndex = 0;
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;
  let segment = 0;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-t-${segment++}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }

    parts.push(
      <strong key={`${keyPrefix}-b-${segment++}`} className="font-semibold">
        {match[1]}
      </strong>
    );

    lastIndex = boldRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`${keyPrefix}-t-${segment++}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts.length ? parts : text;
};

const formatBotMessage = (text) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  const flushList = (baseKey) => {
    if (!listItems.length) return;

    if (listType === 'ol') {
      elements.push(
        <ol key={`${baseKey}-ol`} className="list-decimal list-inside ml-4 my-2 space-y-1">
          {listItems.map((item, idx) => (
            <li key={`${baseKey}-oli-${idx}`}>{renderInlineBold(item, `${baseKey}-oli-${idx}`)}</li>
          ))}
        </ol>
      );
    } else {
      elements.push(
        <ul key={`${baseKey}-ul`} className="list-disc list-inside ml-4 my-2 space-y-1">
          {listItems.map((item, idx) => (
            <li key={`${baseKey}-uli-${idx}`}>{renderInlineBold(item, `${baseKey}-uli-${idx}`)}</li>
          ))}
        </ul>
      );
    }

    listItems = [];
    listType = null;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushList(`line-${index}`);
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList(`line-${index}`);
      const level = headingMatch[1].length;
      const content = renderInlineBold(headingMatch[2], `h-${index}`);

      if (level === 1) {
        elements.push(<h1 key={`h1-${index}`} className="text-2xl font-bold">{content}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={`h2-${index}`} className="text-xl font-semibold">{content}</h2>);
      } else {
        elements.push(<h3 key={`h3-${index}`} className="text-lg font-semibold">{content}</h3>);
      }
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      if (listType && listType !== 'ul') flushList(`line-${index}`);
      listType = 'ul';
      listItems.push(bulletMatch[1]);
      return;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (listType && listType !== 'ol') flushList(`line-${index}`);
      listType = 'ol';
      listItems.push(numberedMatch[1]);
      return;
    }

    flushList(`line-${index}`);
    elements.push(
      <p key={`p-${index}`} className="mb-2">
        {renderInlineBold(line, `p-${index}`)}
      </p>
    );
  });

  flushList('final');
  return elements;
};


export default function FitnessChatbot() {
  const [chatHistory, setChatHistory] = useState([
    { sender: 'bot', text: 'Welcome! I am your Health & Fitness AI Coach. Ask me about diet plans, exercises, or food calories!' }
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

    return (
      <div className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl shadow-md ${
          message.sender === 'user'
            ? 'bg-indigo-500 text-white rounded-br-none' 
            : 'bg-gray-200 text-gray-800 rounded-tl-none' 
        }`}>
          {isBot ? (
            <div className="text-sm leading-6 space-y-1">{formatBotMessage(message.text)}</div>
          ) : (
            message.text
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
          <h3 className="text-xl font-semibold">Health & Fitness AI Coach</h3>
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
