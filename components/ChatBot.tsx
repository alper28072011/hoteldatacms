
import React, { useState, useRef, useEffect } from 'react';
import { HotelNode, ChatMessage } from '../types';
import { chatWithData } from '../services/geminiService';
import { useHotel } from '../contexts/HotelContext';
import { Send, Bot, User, Sparkles, Settings2, UserCog, ChevronDown } from 'lucide-react';

interface ChatBotProps {
  data: HotelNode;
  onOpenPersonaModal?: () => void; // Callback to open modal
}

// Custom Renderer to handle Basic Markdown (Bold and Lists)
const MessageRenderer = ({ text }: { text: string }) => {
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
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={i} className="flex items-start ml-2">
              <span className="mr-2 mt-2 w-1.5 h-1.5 bg-current rounded-full shrink-0 opacity-60"></span>
              <span>{parseBold(content)}</span>
            </div>
          );
        }
        if (!trimmed) {
          return <div key={i} className="h-2" />;
        }
        return <div key={i}>{parseBold(line)}</div>;
      })}
    </div>
  );
};

const ChatBot: React.FC<ChatBotProps> = ({ data, onOpenPersonaModal }) => {
  const { personas, activePersonaId, setActivePersonaId } = useHotel();
  
  const activePersona = personas.find(p => p.id === activePersonaId) || null;

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

  // Reset chat when persona changes
  useEffect(() => {
     if (messages.length > 0) {
         setMessages([{
             id: 'system_reset_' + Date.now(),
             sender: 'ai',
             text: activePersona 
                ? `System: Persona switched to "${activePersona.name}" (${activePersona.role}).` 
                : "System: Switched to Default Assistant.",
             timestamp: new Date()
         }]);
     }
  }, [activePersonaId]);

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

    const history = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [m.text]
    }));

    // Pass activePersona to service
    const aiResponseText = await chatWithData(data, userMsg.text, history, activePersona);

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
      {/* Header */}
      <div className="h-20 px-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
         <div className="flex flex-col">
             <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <Bot size={16} className="text-indigo-500" /> Simulator
             </h3>
             <div className="flex items-center gap-2 mt-1">
                 {/* Persona Selector */}
                 <div className="relative group">
                     <select 
                        value={activePersonaId} 
                        onChange={(e) => setActivePersonaId(e.target.value)}
                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-1 pl-2 pr-6 rounded cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                         <option value="default">Default Assistant</option>
                         {personas.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                     </select>
                     <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                 </div>
                 
                 {/* Edit Button - Fixed Clickability with z-index and explicit stopPropagation */}
                 <button 
                    type="button"
                    onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation();
                        if (onOpenPersonaModal) onOpenPersonaModal();
                    }}
                    className="p-2 ml-1 text-slate-500 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-sm transition-all z-10" 
                    title="Manage Personas"
                 >
                    <Settings2 size={15} />
                 </button>
             </div>
         </div>
         <div className="flex items-center text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            <Sparkles size={10} className="mr-1" /> Gemini 2.5 Flash
         </div>
      </div>

      {/* Chat Area */}
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

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-center space-x-2">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask as ${activePersona ? activePersona.role : 'Guest'}...`}
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
