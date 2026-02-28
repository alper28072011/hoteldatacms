

import React, { useState, useEffect } from 'react';
import { HotelNode, HealthReport, HealthIssue } from '../types';
import { generateHealthReport, autoFixDatabase, AutoFixAction, askDataCoach } from '../services/geminiService';
import { runLocalValidation } from '../utils/validationUtils';
import { useHotel } from '../contexts/HotelContext'; // Context access needed for updating tree scores
import { X, Activity, Check, TriangleAlert, Sparkles, Loader2, RefreshCw, Zap, Search, BrainCircuit, Wand2, ArrowRight, MessageSquare, Send } from 'lucide-react';

interface DataHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onApplyFix: (nodeId: string, updates: Partial<HotelNode>) => void;
  onLocate?: (nodeId: string) => void;
  onAutoFixApply?: (action: AutoFixAction) => void;
}

const DataHealthModal: React.FC<DataHealthModalProps> = ({ isOpen, onClose, data, onApplyFix, onLocate, onAutoFixApply }) => {
  const { updateNode } = useHotel(); // Get updateNode to save scores
  
  const [localReport, setLocalReport] = useState<HealthIssue[]>([]);
  const [autoFixes, setAutoFixes] = useState<AutoFixAction[]>([]);
  const [reportSummary, setReportSummary] = useState<string>('');
  
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'autofix' | 'coach'>('local');
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  // Coach State
  const [coachMessages, setCoachMessages] = useState<{role: 'user' | 'model', text: string}[]>([
      { role: 'model', text: 'Merhaba! Ben AI Veri Koçunuzum. Veri setinizi oluştururken kafanıza takılan, "Bunu nereye eklemeliyim?" veya "Bu yapıyı nasıl kurmalıyım?" gibi sorularınızı bana sorabilirsiniz. Mevcut verinizi inceleyip size en iyi yöntemi önereceğim.' }
  ]);
  const [coachInput, setCoachInput] = useState('');
  const [isCoachThinking, setIsCoachThinking] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Modalı açınca yerel doğrulamayı çalıştır
  useEffect(() => {
    if (isOpen) {
      const issues = runLocalValidation(data);
      setLocalReport(issues);
    }
  }, [isOpen, data]);

  useEffect(() => {
      if (activeTab === 'coach') {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
  }, [coachMessages, activeTab]);

  const runAutoFixScan = async () => {
    setIsScanning(true);
    setFixedIds(new Set()); // Reset fixed state on new scan
    try {
      // 1. Run Structural AutoFix Analysis
      const structuralResult = await autoFixDatabase(data);
      setAutoFixes(structuralResult);
      
      // 2. Run Deep Semantic Health Report (Scores)
      const healthReport = await generateHealthReport(data);
      setReportSummary(healthReport.summary);
      
      // 3. Update the global tree with AI Confidence Scores
      if (healthReport.nodeScores) {
          Object.entries(healthReport.nodeScores).forEach(([nodeId, score]) => {
              // Update each node silently without triggering a re-render storm
              updateNode(nodeId, { aiConfidence: score });
          });
      }

      // 4. Merge issues from report into local view if any
      if (healthReport.issues && healthReport.issues.length > 0) {
          const semanticFixes: AutoFixAction[] = healthReport.issues.map(issue => ({
              id: issue.id || `issue_${Math.random().toString(36).substr(2, 9)}`,
              type: issue.fix?.action === 'delete' ? 'update' : (issue.fix?.action as any) || 'update', // Default to update
              targetId: issue.nodeId,
              payload: issue.fix?.data,
              reasoning: `${issue.message} ${issue.fix?.description ? `(${issue.fix.description})` : ''}`,
              severity: issue.severity === 'optimization' ? 'content' : (issue.severity === 'critical' ? 'critical' : 'structural')
          }));
          
          setAutoFixes(prev => [...prev, ...semanticFixes]);
      }

      setActiveTab('autofix');
    } catch (error) {
      console.error("AutoFix Scan failed", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyFix = (action: AutoFixAction) => {
    if (onAutoFixApply) {
        onAutoFixApply(action);
        setFixedIds(prev => new Set(prev).add(action.id));
    }
  };

  const handleMagicWand = async () => {
      // Hepsini uygula (Sıralı işlem yaparak React state update'lerini garantiye alalım)
      const pending = autoFixes.filter(f => !fixedIds.has(f.id));
      
      for (const action of pending) {
          if (onAutoFixApply) {
              onAutoFixApply(action);
              // Kısa bir gecikme ekleyerek state çakışmalarını önleyelim
              await new Promise(resolve => setTimeout(resolve, 50)); 
          }
      }
      
      const allIds = pending.map(p => p.id);
      setFixedIds(prev => new Set([...prev, ...allIds]));
  };

  const handleLocalFix = (issue: HealthIssue) => {
      if (issue.fix) {
          onApplyFix(issue.fix.targetId, issue.fix.data);
          setFixedIds(prev => new Set(prev).add(issue.id));
      }
  };

  const handleLocate = (nodeId: string) => {
    if (onLocate) {
        onLocate(nodeId);
        onClose(); 
    }
  };

  const handleCoachSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!coachInput.trim() || isCoachThinking) return;

      const userMsg = coachInput.trim();
      setCoachMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setCoachInput('');
      setIsCoachThinking(true);

      try {
          // Convert history format for API
          const historyForApi = coachMessages.map(m => ({ role: m.role, parts: [m.text] }));
          const response = await askDataCoach(data, userMsg, historyForApi);
          setCoachMessages(prev => [...prev, { role: 'model', text: response }]);
      } catch (error) {
          setCoachMessages(prev => [...prev, { role: 'model', text: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin." }]);
      } finally {
          setIsCoachThinking(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden min-h-[600px]">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                <Activity size={24} />
             </div>
             <div>
                <h2 className="text-xl font-bold text-slate-800">Sağlık ve Onarım Merkezi</h2>
                <p className="text-sm text-slate-500">Doğrulama, Otomatik Düzeltme & Veri Koçluğu</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
             <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-slate-50">
           
           {/* Sidebar */}
           <div className="w-full md:w-1/3 bg-slate-50 md:border-r border-b md:border-b-0 border-slate-200 p-6 flex flex-col shrink-0 overflow-y-auto gap-4">
                
                {/* Local Status */}
                <div 
                    onClick={() => setActiveTab('local')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTab === 'local' ? 'bg-white border-blue-400 shadow-md ring-1 ring-blue-100' : 'bg-white border-slate-200 hover:border-blue-300'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Zap size={16} className="text-amber-500" /> Hızlı Doğrulama
                        </span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{localReport.length}</span>
                    </div>
                    <div className="text-xs text-slate-500">Boş alanlar, eksik değerler ve yapısal derinlik için anlık kontrol.</div>
                </div>

                {/* Auto-Fix Status */}
                <div 
                    onClick={() => autoFixes.length > 0 && setActiveTab('autofix')}
                    className={`p-4 rounded-xl border transition-all relative ${activeTab === 'autofix' ? 'bg-white border-violet-400 shadow-md ring-1 ring-violet-100' : 'bg-white border-slate-200'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Sparkles size={16} className="text-violet-500" /> Derin AI Analiz
                        </span>
                        {autoFixes.length > 0 ? (
                            <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full text-xs font-bold">{autoFixes.length}</span>
                        ) : (
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Hazır</span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 mb-4">Veri ağacını tarar, anlamsal hataları bulur ve <strong>Veri Körlüğü Puanlarını</strong> günceller.</div>
                    
                    {!isScanning ? (
                         <button 
                            onClick={(e) => { e.stopPropagation(); runAutoFixScan(); }}
                            className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                            <BrainCircuit size={14} /> Taramayı Başlat
                        </button>
                    ) : (
                        <button disabled className="w-full py-2 bg-violet-50 text-violet-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-wait">
                            <Loader2 size={14} className="animate-spin" /> Veri Analiz Ediliyor...
                        </button>
                    )}
                </div>

                {/* AI Data Coach Tab */}
                <div 
                    onClick={() => setActiveTab('coach')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${activeTab === 'coach' ? 'bg-white border-emerald-400 shadow-md ring-1 ring-emerald-100' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <MessageSquare size={16} className="text-emerald-500" /> AI Veri Koçu
                        </span>
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">YENİ</span>
                    </div>
                    <div className="text-xs text-slate-500">Veri setinizi nasıl yapılandıracağınız konusunda kararsız mısınız? Koçunuza danışın.</div>
                </div>
           </div>

           {/* Main List */}
           <div className="flex-1 bg-white flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        {activeTab === 'local' ? 'Tespit Edilen Yapısal Sorunlar' : activeTab === 'autofix' ? 'Yapay Zeka Onarım Önerileri' : 'AI Veri Seti Koçu'}
                    </h3>
                    
                    {activeTab === 'autofix' && autoFixes.length > 0 && (
                        <button 
                            onClick={handleMagicWand}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-xs font-bold hover:shadow-md transition-all"
                        >
                            <Wand2 size={14} /> Tümünü Düzelt
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 relative">
                    {/* AUTO FIX LIST */}
                    {activeTab === 'autofix' && (
                        autoFixes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Sparkles size={48} className="mb-2 text-violet-300" />
                                <p className="mb-2">Derin analiz sonuçlarını görmek için taramayı başlatın.</p>
                                {reportSummary && <div className="text-xs max-w-md text-center text-slate-500 mt-4 bg-slate-50 p-3 rounded">{reportSummary}</div>}
                            </div>
                        ) : (
                            <>
                                {reportSummary && (
                                    <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm border border-emerald-100 mb-4 flex items-start gap-2">
                                        <Check size={16} className="mt-0.5 shrink-0"/>
                                        <div>
                                            <div className="font-bold mb-1">Analiz Tamamlandı</div>
                                            {reportSummary}
                                            <div className="mt-2 text-xs opacity-80">Ağaç yapısındaki renkli noktalar güncellendi.</div>
                                        </div>
                                    </div>
                                )}
                                {autoFixes.map(action => {
                                    const isFixed = fixedIds.has(action.id);
                                    return (
                                        <div key={action.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                        action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                        action.type === 'move' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {action.type === 'move' ? 'TAŞI (Semantik)' : action.type === 'update' ? 'GÜNCELLE' : 'TİP DEĞİŞTİR'}
                                                    </span>
                                                    <span className="font-mono text-xs text-slate-400">ID: {action.targetId}</span>
                                                </div>
                                            </div>
                                            
                                            <p className="text-slate-700 text-sm mb-3 font-medium">{action.reasoning}</p>

                                            {/* Show proposed content changes if available */}
                                            {action.payload && (action.payload.description || action.payload.value) && (
                                                <div className="mb-3 bg-slate-50 p-3 rounded border border-slate-100 text-xs">
                                                    <div className="font-bold text-slate-500 mb-1 uppercase tracking-wider">Önerilen İçerik:</div>
                                                    {action.payload.description && (
                                                        <div className="mb-2">
                                                            <span className="font-semibold text-slate-600">Açıklama:</span>
                                                            <div className="pl-2 border-l-2 border-emerald-200 text-slate-600 italic">
                                                                {typeof action.payload.description === 'string' ? action.payload.description : 
                                                                 `${action.payload.description.tr} / ${action.payload.description.en}`}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {action.payload.value && (
                                                        <div>
                                                            <span className="font-semibold text-slate-600">Değer:</span>
                                                            <div className="pl-2 border-l-2 border-emerald-200 text-slate-600 italic">
                                                                {typeof action.payload.value === 'string' ? action.payload.value : 
                                                                 `${action.payload.value.tr} / ${action.payload.value.en}`}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {!isFixed ? (
                                                    <button 
                                                        onClick={() => handleApplyFix(action)}
                                                        className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100"
                                                    >
                                                        <Wand2 size={12} /> Düzeltmeyi Uygula
                                                    </button>
                                                ) : (
                                                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> UYGULANDI</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </>
                        )
                    )}

                    {/* LOCAL VALIDATION LIST */}
                    {activeTab === 'local' && (
                        localReport.length === 0 ? (
                             <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <Check size={48} className="mb-2 text-emerald-500" />
                                <p>Harika! Hızlı taramada sorun bulunamadı.</p>
                            </div>
                        ) : (
                            localReport.map(issue => {
                                const isFixed = fixedIds.has(issue.id);
                                return (
                                    <div key={issue.id} className={`border rounded-lg p-4 transition-all ${isFixed ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    issue.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {issue.severity === 'critical' ? 'KRİTİK' : issue.severity === 'warning' ? 'UYARI' : 'ÖNERİ'}
                                                </span>
                                                <span className="font-mono text-xs text-slate-400">Öğe: {issue.nodeName}</span>
                                            </div>
                                            {onLocate && (
                                                <button onClick={() => handleLocate(issue.nodeId)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Search size={12} /> Göster</button>
                                            )}
                                        </div>
                                        <p className="text-slate-700 text-sm mb-3 font-medium">{issue.message}</p>
                                        {issue.fix && !isFixed && (
                                            <button onClick={() => handleLocalFix(issue)} className="text-xs font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                                                <Sparkles size={12} /> Düzelt: {issue.fix.description}
                                            </button>
                                        )}
                                        {isFixed && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check size={12}/> DÜZELDİ</span>}
                                    </div>
                                )
                            })
                        )
                    )}

                    {/* AI DATA COACH CHAT UI */}
                    {activeTab === 'coach' && (
                        <div className="flex flex-col h-full">
                            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                {coachMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                            msg.role === 'user' 
                                            ? 'bg-emerald-600 text-white rounded-br-none' 
                                            : 'bg-slate-100 text-slate-700 rounded-bl-none border border-slate-200'
                                        }`}>
                                            {msg.role === 'model' && (
                                                <div className="flex items-center gap-2 mb-1 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                                                    <Sparkles size={12} /> AI Veri Koçu
                                                </div>
                                            )}
                                            <div className="whitespace-pre-wrap">{msg.text}</div>
                                        </div>
                                    </div>
                                ))}
                                {isCoachThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-50 text-slate-500 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-100 flex items-center gap-2 text-xs">
                                            <Loader2 size={14} className="animate-spin" /> Koç düşünüyor...
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            
                            <form onSubmit={handleCoachSubmit} className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                                <input 
                                    type="text" 
                                    value={coachInput}
                                    onChange={(e) => setCoachInput(e.target.value)}
                                    placeholder="Veri seti hakkında bir soru sorun..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                                    disabled={isCoachThinking}
                                />
                                <button 
                                    type="submit" 
                                    disabled={!coachInput.trim() || isCoachThinking}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    )}
                </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DataHealthModal;
