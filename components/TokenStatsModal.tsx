import React, { useState, useEffect } from 'react';
import { X, Calendar, Cpu, BarChart3, Loader2 } from 'lucide-react';
import { getTokenUsageLogs } from '../services/firestoreService';
import { availableModels } from '../services/geminiService';

interface TokenStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  date: string;
  model: string;
  tokens: number;
}

const TokenStatsModal: React.FC<TokenStatsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModel, setFilterModel] = useState<string>('all');

  useEffect(() => {
    if (isOpen) {
      const loadLogs = async () => {
        setLoading(true);
        try {
          const fetched = await getTokenUsageLogs();
          setLogs(fetched);
        } catch (e) {
          console.error("Failed to fetch token logs", e);
        } finally {
          setLoading(false);
        }
      };
      loadLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getModelName = (id: string) => {
    return availableModels.find(m => m.id === id)?.name || id;
  };

  const filteredLogs = logs.filter(log => filterModel === 'all' || log.model === filterModel);

  // Calculate totals
  const totalTokens = filteredLogs.reduce((acc, curr) => acc + curr.tokens, 0);
  const modelStats = logs.reduce((acc: Record<string, number>, curr) => {
    acc[curr.model] = (acc[curr.model] || 0) + curr.tokens;
    return acc;
  }, {});

  const getMostUsedModel = () => {
    const entries = Object.entries(modelStats);
    if (entries.length === 0) return 'Kayıt Yok';
    let maxModel = '';
    let maxTokens = -1;
    for (const [model, tokensVal] of entries) {
      const tokens = tokensVal as number;
      if (tokens > maxTokens) {
        maxTokens = tokens;
        maxModel = model;
      }
    }
    return getModelName(maxModel);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-indigo-600" size={20} />
            <div>
              <h3 className="text-lg font-bold text-slate-800">Yapay Zeka Tüketim İstatistikleri</h3>
              <p className="text-xs text-slate-500">Gün gün ve model model veritabanı tüketim kayıtları</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 flex flex-col justify-between">
              <span className="text-xs font-semibold text-indigo-700 tracking-wide uppercase">Toplam Filtrelenen Tüketim</span>
              <span className="text-2xl font-black font-mono text-indigo-900 mt-2">
                {totalTokens.toLocaleString('tr-TR')} <span className="text-xs font-bold text-indigo-600">tokens</span>
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">En Çok Kullanılan Model</span>
              <div className="text-sm font-bold text-slate-700 mt-2 truncate">
                {getMostUsedModel()}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4">
            <label className="text-xs font-bold text-slate-500 uppercase">Model Filtreleme</label>
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tüm Modeller</option>
              {availableModels.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>

          {/* Logs Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
                <span className="text-xs">İstatistikler yükleniyor...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs italic">
                Bulunulan güne veya modele ait tüketim kaydı bulunamadı.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="px-4 py-3"><div className="flex items-center gap-1"><Calendar size={12} /> Tarih</div></th>
                      <th className="px-4 py-3"><div className="flex items-center gap-1"><Cpu size={12} /> Yapay Zeka Modeli</div></th>
                      <th className="px-4 py-3 text-right">Tüketilen Token</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-700">{log.date}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-semibold">{getModelName(log.model)}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{log.tokens.toLocaleString('tr-TR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 rounded-b-2xl text-[10px] text-slate-400 flex items-center justify-between">
          <span>Kullanılan token bilgileri her AI işleminden sonra otomatik kaydedilir.</span>
          <span className="font-semibold text-slate-500">Firebase Cloud Store</span>
        </div>
      </div>
    </div>
  );
};

export default TokenStatsModal;
