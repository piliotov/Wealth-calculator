import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';
import { User, Account, ChatMessage } from '../types';
import { Send, Loader2, X, MessageCircle, Trash2 } from 'lucide-react';

interface Props {
  user: User;
  accounts: Account[];
}

// Simple markdown renderer for chat messages
const renderMarkdown = (text: string): React.ReactNode => {
  // Split into lines and process
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  
  const processInlineMarkdown = (line: string): React.ReactNode => {
    // Process bold (**text** or __text__)
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    
    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.+?)\*\*|__(.+?)__/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold text-white">{boldMatch[1] || boldMatch[2]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      
      // No more matches
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };
  
  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc list-inside space-y-1 my-2 text-slate-300">
          {listItems.map((item, idx) => (
            <li key={idx}>{processInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };
  
  lines.forEach((line, idx) => {
    const trimmedLine = line.trim();
    
    // Empty line
    if (!trimmedLine) {
      flushList();
      elements.push(<div key={idx} className="h-2" />);
      return;
    }
    
    // List item (* or -)
    if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
      inList = true;
      listItems.push(trimmedLine.slice(2));
      return;
    }
    
    // If we were in a list, flush it
    flushList();
    
    // Headers
    if (trimmedLine.startsWith('### ')) {
      elements.push(<h4 key={idx} className="font-semibold text-white text-sm mt-2 mb-1">{processInlineMarkdown(trimmedLine.slice(4))}</h4>);
      return;
    }
    if (trimmedLine.startsWith('## ')) {
      elements.push(<h3 key={idx} className="font-semibold text-white mt-2 mb-1">{processInlineMarkdown(trimmedLine.slice(3))}</h3>);
      return;
    }
    if (trimmedLine.startsWith('# ')) {
      elements.push(<h2 key={idx} className="font-bold text-white text-lg mt-2 mb-1">{processInlineMarkdown(trimmedLine.slice(2))}</h2>);
      return;
    }
    
    // Numbered list (1. 2. etc)
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      elements.push(
        <div key={idx} className="flex gap-2 text-slate-300 my-0.5">
          <span className="text-slate-500 w-4 shrink-0">{numberedMatch[1]}.</span>
          <span>{processInlineMarkdown(numberedMatch[2])}</span>
        </div>
      );
      return;
    }
    
    // Regular paragraph
    elements.push(<p key={idx} className="text-slate-300 my-1">{processInlineMarkdown(trimmedLine)}</p>);
  });
  
  // Flush any remaining list
  flushList();
  
  return <div className="space-y-0.5">{elements}</div>;
};

const FloatingAIChat: React.FC<Props> = ({ user, accounts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedHistory = localStorage.getItem(`chat_${user.id}`);
    if (storedHistory) {
      setMessages(JSON.parse(storedHistory));
    } else {
      setMessages([{
        id: 'init',
        role: 'assistant',
        text: `Hey! I can help you understand your spending and answer questions about your finances.`,
        timestamp: Date.now()
      }]);
    }
  }, [user.id, user.username]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`chat_${user.id}`, JSON.stringify(messages));
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
      const responseText = await sendChatMessage(userMsg.text);
      
      const botMsg: ChatMessage = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        text: `Couldn't connect. Try again in a moment.`,
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
      text: 'Chat cleared. What would you like to know?',
      timestamp: Date.now()
    }];
    setMessages(freshStart);
    localStorage.setItem(`chat_${user.id}`, JSON.stringify(freshStart));
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg transition-all z-50 flex items-center justify-center ${
          isOpen ? 'bg-slate-700' : 'bg-blue-600 hover:bg-blue-500'
        }`}
      >
        {isOpen ? <X className="text-white w-5 h-5" /> : <MessageCircle className="text-white w-5 h-5 sm:w-6 sm:h-6" />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-4 sm:w-80 md:w-96 sm:h-[500px] sm:max-h-[70vh] bg-slate-900 sm:rounded-2xl sm:border sm:border-slate-700 z-50 flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h3 className="font-medium text-white text-sm">Assistant</h3>
              <p className="text-xs text-slate-500">Ask about your finances</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={clearChat} className="p-2 text-slate-500 hover:text-slate-300 rounded-lg" title="Clear chat">
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="sm:hidden p-2 text-slate-500 hover:text-white rounded-lg">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[85%] rounded-2xl px-4 py-2.5 text-sm
                  ${msg.role === 'assistant' 
                    ? 'bg-slate-800 text-slate-200' 
                    : 'bg-blue-600 text-white'}
                `}>
                  {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask something..."
                className="flex-1 bg-slate-800 border-none rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FloatingAIChat;