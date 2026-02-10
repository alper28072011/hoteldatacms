
import React, { useState, useRef, useEffect } from 'react';
import { HotelNode, ChatMessage } from '../types';
import { chatWithData } from '../services/geminiService';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface ChatBotProps {
  data: HotelNode;
}

// Custom Renderer to handle Basic Markdown (Bold and Lists)
// We avoid external libraries to keep it lightweight and stable
const MessageRenderer = ({ text }: { text: string }) => {
  // Helper to parse bold syntax **text**
  const parseBold = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        
        // Handle Bullet Points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={i} className="flex items-start ml-2">
              <span className="mr-2 mt-2 w-1.5 h-1.5 bg-current rounded-full shrink-0 opacity-60"></span>
              <span>{parseBold(content)}</span>
            </div>
          );
        }

        // Handle Empty Lines (Paragraphs)
        if (!trimmed) {
          return <div key={i} className="h-2" />;
        }

        // Standard Text
        return <div key={i}>{parseBold(line)}</div>;
      })}
    </div>
  );
};

const ChatBot: React.FC<ChatBotProps> = ({ data }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I'm your hotel data simulator. Ask me anything about the hotel to test if your data structure is working.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Prepare history for API
    const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [m.text]
    }));

    // Call Gemini
    const aiResponseText = await chatWithData(data, userMsg.text, history);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: aiResponseText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
      <div className="h-20 px-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
         <div className="flex items-center space-x-2">
            <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600">
                <Bot size={18} />
            </div>
            <h3 className="font-semibold text-slate-700 text-sm">Simulator</h3>
         </div>
         <div className="flex items-center text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            <Sparkles size={10} className="mr-1" /> Gemini 2.5 Flash
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm shadow-sm ${
                msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
              }`}
            >
              <MessageRenderer text={msg.text} />
              
              <div className={`text-[9px] mt-2 opacity-60 text-right font-medium ${msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
           <div className="flex justify-start">
             <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
               <div className="flex space-x-1">
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-center space-x-2">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the hotel..."
                className="flex-1 bg-white text-slate-700 placeholder:text-slate-400 border border-slate-300 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
            />
            <button 
                type="submit" 
                disabled={isTyping || !input.trim()}
                className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send size={18} />
            </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">AI generates answers from your current JSON data.</p>
      </form>
    </div>
  );
};

export default ChatBot;
