

import React, { useState, useRef, useEffect } from 'react';
import { HotelNode, ChatMessage, SimulationResponse } from '../types';
import { chatWithData } from '../services/geminiService';
import { useHotel } from '../contexts/HotelContext';
import { Send, Bot, User, Sparkles, Settings2, UserCog, ChevronDown, Activity, AlertTriangle, Eye, EyeOff, Brain } from 'lucide-react';

interface ChatBotProps {
  data: HotelNode;
  onOpenPersonaModal?: () => void; // Callback to open modal
}

// --- NEW COMPONENT: AI Analysis Card ---
const AIAnalysisCard: React.FC<{ analysis: SimulationResponse }> = ({ analysis }) => {
    const [expanded, setExpanded] = useState(false);

    const getHealthColor = (h: string) => {
        if (h === 'good') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (h === 'missing_info') return 'text-amber-600 bg-amber-50 border-amber-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getHealthLabel = (h: string) => {
        if (h === 'good') return 'Veri Sağlıklı';
        if (h === 'missing_info') return 'Eksik Bilgi';
        if (h === 'ambiguous') return 'Muğlak Veri';
        return 'Riskli / Uydurma';
    }

    return (
        <div className="space-y-3">
            {/* Main Chat Answer */}
            <div className="text-slate-800 leading-relaxed font-medium">
                {analysis.answer}
            </div>

            {/* Collapsible Insight Box */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                <button 
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200 transition-colors text-xs font-bold text-slate-500 uppercase tracking-wider"
                >
                    <div className="flex items-center gap-2">
                        <Brain size={12} className="text-indigo-500"/>
                        Simülasyon Analizi
                    </div>
                    {expanded ? <ChevronDown size={14} className="rotate-180"/> : <ChevronDown size={14}/>}
                </button>
                
                {expanded && (
                    <div className="p-3 space-y-3 text-xs">
                        
                        {/* Row 1: Intent & Health */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white border border-slate-200 rounded p-2">
                                <div className="text-[9px] text-slate-400 font-bold mb-1">ALGILANAN NİYET</div>
                                <div className="font-semibold text-slate-700">{analysis.intent}</div>
                            </div>
                            <div className={`border rounded p-2 ${getHealthColor(analysis.dataHealth)}`}>
                                <div className="text-[9px] font-bold mb-1 opacity-70">VERİ SAĞLIĞI</div>
                                <div className="font-semibold flex items-center gap-1">
                                    <Activity size={10} />
                                    {getHealthLabel(analysis.dataHealth)}
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Logic Path */}
                        <div className="bg-white border border-slate-200 rounded p-2">
                            <div className="text-[9px] text-slate-400 font-bold mb-1">TARAMA YOLU</div>
                            <div className="font-mono text-[10px] text-slate-600 break-words leading-tight">
                                {analysis.analysis}
                            </div>
                        </div>

                        {/* Row 3: Blindness Check */}
                        {analysis.blindness && analysis.blindness !== 'None' && (
                            <div className="bg-red-50 border border-red-100 rounded p-2 flex gap-2">
                                <EyeOff size={14} className="text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[9px] text-red-400 font-bold mb-0.5">VERİ KÖRLÜĞÜ RİSKİ</div>
                                    <div className="text-red-700 leading-tight">{analysis.blindness}</div>
                                </div>
                            </div>
                        )}

                        {/* Row 4: Suggestions */}
                        {analysis.suggestion && (
                            <div className="bg-indigo-50 border border-indigo-100 rounded p-2 flex gap-2">
                                <Sparkles size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-[9px] text-indigo-400 font-bold mb-0.5">MODELLEME ÖNERİSİ</div>
                                    <div className="text-indigo-700 leading-tight">{analysis.suggestion}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const ChatBot: React.FC<ChatBotProps> = ({ data, onOpenPersonaModal }) => {
  const { personas, activePersonaId, setActivePersonaId } = useHotel();
  
  const activePersona = personas.find(p => p.id === activePersonaId) || null;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Merhaba! Ben Otel Veri Simülatörü. Veri ağacınızın tutarlılığını test etmek için hazırım. Bana otel hakkında sorular sorabilirsiniz.",
      analysis: {
          answer: "Merhaba! Ben Otel Veri Simülatörü. Veri ağacınızın tutarlılığını test etmek için hazırım. Bana otel hakkında sorular sorabilirsiniz.",
          intent: "Karşılama",
          dataHealth: "good",
          analysis: "System Init",
          blindness: "None"
      },
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
             timestamp: new Date(),
             analysis: {
                 answer: activePersona 
                    ? `Mod Değiştirildi: ${activePersona.name} olarak simülasyon yapıyorum.` 
                    : "Varsayılan simülatör moduna dönüldü.",
                 intent: "System",
                 dataHealth: "good",
                 analysis: "Persona Switch",
                 blindness: "None"
             }
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

    // Pass activePersona to service which now returns structured JSON
    const aiResponse = await chatWithData(data, userMsg.text, history, activePersona);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: aiResponse.answer, // Fallback text for simple displays
      analysis: aiResponse,    // Full structured data
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
                <Bot size={16} className="text-indigo-500" /> Simülatör
             </h3>
             <div className="flex items-center gap-2 mt-1">
                 {/* Persona Selector */}
                 <div className="relative group">
                     <select 
                        value={activePersonaId} 
                        onChange={(e) => setActivePersonaId(e.target.value)}
                        className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-1 pl-2 pr-6 rounded cursor-pointer hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                         <option value="default">Varsayılan Asistan</option>
                         {personas.map(p => (
                             <option key={p.id} value={p.id}>{p.name}</option>
                         ))}
                     </select>
                     <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                 </div>
                 
                 {/* Edit Button */}
                 <button 
                    type="button"
                    onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation();
                        if (onOpenPersonaModal) onOpenPersonaModal();
                    }}
                    className="p-2 ml-1 text-slate-500 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 rounded-lg shadow-sm transition-all z-10" 
                    title="Persona Yönet"
                 >
                    <Settings2 size={15} />
                 </button>
             </div>
         </div>
         <div className="flex items-center text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            <Sparkles size={10} className="mr-1" /> Gemini 3 Flash
         </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none w-full'
              }`}
            >
              {msg.sender === 'ai' && msg.analysis ? (
                  <AIAnalysisCard analysis={msg.analysis} />
              ) : (
                  <div>{msg.text}</div>
              )}
              
              <div className={`text-[9px] mt-1 opacity-60 text-right font-medium ${msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
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
                placeholder={`${activePersona ? activePersona.role : 'Misafir'} olarak bir soru sorun...`}
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
        <p className="text-[10px] text-center text-slate-400 mt-2">Cevaplar ve analizler, mevcut veri setinizin AI tarafından nasıl okunduğunu simüle eder.</p>
      </form>
    </div>
  );
};

export default ChatBot;
