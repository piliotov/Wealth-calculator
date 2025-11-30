import React, { useState, useRef, useEffect } from 'react';
import { generateFinancialAdvice } from '../services/geminiService';
import { getLast30DaysTransactions, getChatHistory, saveChatHistory } from '../services/localDb';
import { User, Account, ChatMessage } from '../types';
import { Bot, Send, User as UserIcon, Loader2, Sparkles, X, MessageSquareText, Trash2 } from 'lucide-react';

interface Props {
  user: User;
  accounts: Account[];
}

const FloatingAIChat: React.FC<Props> = ({ user, accounts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    getChatHistory(user.id).then(history => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        setMessages([{
          id: 'init',
          role: 'assistant',
          text: `Hello ${user.username}! I'm your Virtual CFO. I have access to your account balances and recent transaction history.`,
          timestamp: Date.now()
        }]);
      }
    });
  }, [user.id, user.username]);

  // Save history on update
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(user.id, messages);
    }
  }, [messages, user.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { 
      id: crypto.randomUUID(), 
      role: 'user', 
      text: input,
      timestamp: Date.now()
    };
    
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const transactions = await getLast30DaysTransactions(user.id);
      const responseText = await generateFinancialAdvice(transactions, accounts, userMsg.text);
      
      const botMsg: ChatMessage = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: 'Sorry, I had trouble connecting to the financial brain. Please try again.',
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    const freshStart: ChatMessage[] = [{
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Chat history cleared. How can I help you now?',
      timestamp: Date.now()
    }];
    setMessages(freshStart);
    saveChatHistory(user.id, freshStart);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 p-4 rounded-full shadow-2xl transition-all z-50 ${
          isOpen ? 'bg-slate-700 rotate-90' : 'bg-primary hover:bg-blue-600 hover:scale-105'
        }`}
      >
        {isOpen ? <X className="text-white w-6 h-6" /> : <MessageSquareText className="text-white w-6 h-6" />}
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-24 right-6 w-80 sm:w-96 bg-surface border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`} style={{ maxHeight: 'calc(100vh - 120px)', height: '500px' }}>
        
        {/* Header */}
        <div className="bg-slate-900 p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Gemini CFO</h3>
              <p className="text-[10px] text-slate-400">Context aware</p>
            </div>
          </div>
          <button onClick={clearChat} className="p-1 text-slate-500 hover:text-red-400" title="Clear History">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1
                ${msg.role === 'assistant' ? 'bg-indigo-600' : 'bg-slate-600'}
              `}>
                {msg.role === 'assistant' ? <Bot className="w-3 h-3 text-white" /> : <UserIcon className="w-3 h-3 text-white" />}
              </div>
              
              <div className={`
                max-w-[85%] rounded-2xl px-3 py-2 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap
                ${msg.role === 'assistant' 
                  ? 'bg-slate-700 text-slate-100 rounded-tl-none' 
                  : 'bg-primary text-white rounded-tr-none'}
              `}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
               <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center mt-1">
                <Bot className="w-3 h-3 text-white" />
              </div>
              <div className="bg-slate-700 text-slate-300 px-3 py-2 rounded-2xl rounded-tl-none flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-xs">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask..."
            className="flex-1 bg-surface border border-slate-700 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
};

export default FloatingAIChat;