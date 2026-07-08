import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Send, Bot, User, Sparkles, X, AlertTriangle, RotateCcw } from 'lucide-react';

// ── Context mapping ───────────────────────────────────────────────────────────
const CONTEXT_MAP = {
  '/inventory':  'inventory',
  '/billing':    'billing',
  '/warehouse':  'warehouse',
  '/dashboard':  'dashboard',
};

const PERSONA_MAP = {
  inventory: {
    title: 'Inventory Analyst',
    subtitle: 'Product catalog & active bin allocations',
    greet: "Hello! I'm your WareMind Inventory Analyst. Ask me about your product counts, active SKU allocations, or catalog boundaries.",
    thinking: 'Scanning inventory records...',
  },
  billing: {
    title: 'Billing Assistant',
    subtitle: 'Invoices, charges & billing plan audit',
    greet: "Welcome. I'm your Billing Assistant. I can analyse your recent paid/unpaid invoices, calculate storage charges, or review plan parameters.",
    thinking: 'Querying billing ledger...',
  },
  warehouse: {
    title: 'Warehouse Operations',
    subtitle: 'Space occupancy & layout metrics',
    greet: "Operational console loaded. Ask me about your warehouse zones, rack occupancy status, or total capacity thresholds.",
    thinking: 'Loading warehouse telemetry...',
  },
  dashboard: {
    title: 'BI Analyst',
    subtitle: 'High-level WMS performance overview',
    greet: "Hello. I'm your WMS Business Intelligence Analyst. Ask me anything about your dashboard metrics, tenant accounts, or pipeline performance.",
    thinking: 'Aggregating operational data...',
  },
};

function getContextPage(pathname) {
  for (const [prefix, ctx] of Object.entries(CONTEXT_MAP)) {
    if (pathname.startsWith(prefix)) return ctx;
  }
  return 'dashboard';
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Converts the most common Gemini markdown patterns to JSX without a library.
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-0.5 text-zinc-300 my-1.5 pl-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="text-xs leading-relaxed">{item}</li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, i) => {
    const stripped = line.trim();

    // Bold headers: ## or ###
    if (/^#{1,3}\s/.test(stripped)) {
      flushList();
      const content = stripped.replace(/^#{1,3}\s/, '');
      elements.push(
        <p key={i} className="text-xs font-bold text-zinc-100 mt-3 mb-1">{content}</p>
      );
      return;
    }

    // Bullet list items: - or *
    if (/^[-*]\s/.test(stripped)) {
      const content = stripped.replace(/^[-*]\s/, '').replace(/\*\*(.*?)\*\*/g, '$1');
      listBuffer.push(content);
      return;
    }

    flushList();

    // Empty line — spacer
    if (stripped === '') {
      if (elements.length > 0) {
        elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      }
      return;
    }

    // Inline bold: **text**
    const parts = stripped.split(/(\*\*.*?\*\*)/g);
    const inline = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
      }
      return <span key={j}>{part}</span>;
    });

    elements.push(
      <p key={i} className="text-xs leading-relaxed text-zinc-300">{inline}</p>
    );
  });

  flushList();
  return elements;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AICopilotPanel({ isOpen, onClose }) {
  const location = useLocation();
  const { apiFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const contextPage = getContextPage(location.pathname);
  const persona = PERSONA_MAP[contextPage];

  // Reset conversation when route / context changes
  useEffect(() => {
    setMessages([
      {
        id: 'greet',
        text: persona.greet,
        sender: 'bot',
        timestamp: new Date(),
        isError: false,
      },
    ]);
    setInput('');
    setIsThinking(false);
  }, [contextPage]);

  // Auto-scroll to bottom on new message or while thinking
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (e) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isThinking) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      text: prompt,
      sender: 'user',
      timestamp: new Date(),
      isError: false,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const res = await apiFetch('/api/ai/copilot', {
        method: 'POST',
        body: JSON.stringify({ message: prompt, contextPage }),
      });

      const result = await res.json();

      const botMsg = {
        id: `bot-${Date.now()}`,
        text: (res.ok && result.success)
          ? result.data.response
          : result.message || 'I encountered an error querying the AI engine. Please try again.',
        sender: 'bot',
        timestamp: new Date(),
        isError: !(res.ok && result.success),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('[AICopilotPanel] fetch error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          text: 'The WareMind server appears offline. Cannot reach Google Gemini.',
          sender: 'bot',
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  }, [input, isThinking, contextPage, apiFetch]);

  const handleClearChat = () => {
    setMessages([
      {
        id: `greet-${Date.now()}`,
        text: persona.greet,
        sender: 'bot',
        timestamp: new Date(),
        isError: false,
      },
    ]);
    setIsThinking(false);
  };

  return (
    <div
      className={`fixed top-0 right-0 z-50 w-[26rem] h-full border-l border-zinc-800 bg-zinc-900 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* ── Drawer Header ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-gray-100 flex items-center gap-2 leading-tight">
              {persona.title}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </h3>
            <p className="text-[10px] text-zinc-500 truncate">{persona.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Clear chat */}
          <button
            onClick={handleClearChat}
            title="Clear conversation"
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Context Badge ──────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/10 shrink-0">
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          Context: <span className="text-indigo-400">{contextPage}</span>
          <span className="text-zinc-600 ml-2 font-normal">· Live data scoped to your account</span>
        </span>
      </div>

      {/* ── Message List ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.isError
                    ? 'bg-red-950 border border-red-900 text-red-400'
                    : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {msg.sender === 'user'
                ? <User className="w-3.5 h-3.5" />
                : msg.isError
                  ? <AlertTriangle className="w-3.5 h-3.5" />
                  : <Bot className="w-3.5 h-3.5" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[82%] p-3 rounded-2xl shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : msg.isError
                    ? 'bg-red-950/30 border border-red-900/60 rounded-tl-none'
                    : 'bg-zinc-950 border border-zinc-800 rounded-tl-none'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="text-xs leading-relaxed text-white">{msg.text}</p>
              ) : (
                <div className="space-y-0.5">
                  {renderMarkdown(msg.text)}
                </div>
              )}
              <div className={`text-[9px] mt-1.5 text-right ${
                msg.sender === 'user' ? 'text-indigo-200/70' : 'text-zinc-600'
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {/* ── Thinking Animation ──────────────────────────────────────────── */}
        {isThinking && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl rounded-tl-none p-3.5 flex flex-col gap-2">
              {/* Three-dot bounce */}
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              {/* Contextual thinking label */}
              <p className="text-[9px] text-zinc-600 font-medium animate-pulse">{persona.thinking}</p>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={scrollRef} />
      </div>

      {/* ── Input Bar ─────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSend}
        className="p-3.5 border-t border-zinc-800 bg-zinc-950/30 shrink-0"
      >
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask the ${persona.title}...`}
            disabled={isThinking}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-zinc-700 text-center mt-2">
          Powered by Google Gemini · Context: {contextPage}
        </p>
      </form>
    </div>
  );
}
