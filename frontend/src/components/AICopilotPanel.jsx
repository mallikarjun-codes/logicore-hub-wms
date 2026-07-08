import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, X, ChevronRight } from 'lucide-react';

export default function AICopilotPanel({ isOpen, onClose }) {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // Map route to AI Analyst Persona
  const getPersona = (path) => {
    if (path.startsWith('/inventory')) {
      return {
        title: 'Inventory Analyst',
        subtitle: 'Optimizing product catalog & bin allocations',
        greet: 'Hello! I am your WareMind Inventory Analyst. Ask me about your product counts, SKU allocations, or catalog boundaries.'
      };
    }
    if (path.startsWith('/billing')) {
      return {
        title: 'Billing Assistant',
        subtitle: 'Auditing charges, invoice states & plans',
        greet: 'Welcome to your Billing Hub. I can help analyze your recent paid/unpaid invoices, calculate storage costs, or review your plan parameters.'
      };
    }
    if (path.startsWith('/warehouse')) {
      return {
        title: 'Warehouse Operations Analyst',
        subtitle: 'Reviewing space occupancy & layout metrics',
        greet: 'Operational dashboard loaded. Ask me about your warehouse grid zones, rack occupancy status, or total capacity thresholds.'
      };
    }
    // Default dashboard
    return {
      title: 'Business Intelligence Analyst',
      subtitle: 'Aggregating high-level WMS operations',
      greet: 'Hello. I am your WMS Business Analyst. Ask me anything about your dashboard metrics, client accounts, or performance summaries.'
    };
  };

  const persona = getPersona(location.pathname);

  // Restart chat / greet on persona change
  useEffect(() => {
    setMessages([
      { id: 'greet', text: persona.greet, sender: 'bot', timestamp: new Date() }
    ]);
  }, [location.pathname]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response logic (to be integrated next)
    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: `bot-${Date.now()}`,
        text: `Based on your request regarding the ${persona.title} page, this is a simulated context-aware answer from your WareMind Copilot. Database retrieval hooks are initialized and ready.`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1200);
  };

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[400px] max-w-full bg-[#18181b]/95 backdrop-blur-md border-l border-[#27272a] shadow-2xl flex flex-col transition-transform duration-300 z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#27272a] flex items-center justify-between bg-[#09090b]/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-gray-100 flex items-center gap-1.5">
              {persona.title}
              <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </h3>
            <p className="text-xs text-gray-400">{persona.subtitle}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-gray-300'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`p-3 rounded-2xl text-sm leading-relaxed shadow-md ${
                msg.sender === 'user'
                  ? 'bg-indigo-600/90 text-white rounded-tr-none'
                  : 'bg-zinc-900 border border-zinc-800 text-gray-200 rounded-tl-none'
              }`}
            >
              {msg.text}
              <div className="text-[10px] text-gray-400/80 mt-1 text-right">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 max-w-[85%]">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-gray-300 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 text-gray-300 p-3 rounded-2xl rounded-tl-none flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-4 border-t border-[#27272a] bg-[#09090b]/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask the ${persona.title}...`}
            className="flex-1 bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-gray-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
