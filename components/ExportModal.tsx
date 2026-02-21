
import React, { useState } from 'react';
import { HotelNode, ExportConfig } from '../types';
import { generateCleanAIJSON, generateAIText, generateOptimizedCSV, getLocalizedValue } from '../utils/treeUtils';
import { X, Download, FileJson, FileSpreadsheet, FileText, Check, Brain, Globe, Layers, Loader2, ArrowRight } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: HotelNode;
  onExportProgress: (percent: number | null) => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, data, onExportProgress }) => {
  // State for Config
  const [format, setFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [languages, setLanguages] = useState<Set<'tr' | 'en'>>(new Set(['tr', 'en']));
  const [includeAI, setIncludeAI] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const toggleLanguage = (lang: 'tr' | 'en') => {
      const newSet = new Set(languages);
      if (newSet.has(lang)) {
          if (newSet.size > 1) newSet.delete(lang); // Prevent unchecking last
      } else {
          newSet.add(lang);
      }
      setLanguages(newSet);
  };

  const handleExport = async () => {
      setIsExporting(true);
      onExportProgress(10); // Start progress

      const config: ExportConfig = {
          format,
          languages: Array.from(languages),
          includeAIContext: includeAI
      };

      try {
          await new Promise(r => setTimeout(r, 200)); // UI delay
          
          let dataStr = '';
          let mimeType = 'text/plain';
          const hotelName = typeof data.name === 'object' ? data.name.en : data.name;
          const safeName = (hotelName || "hotel").replace(/\s+/g, '_');
          const nowStr = new Date().toISOString().slice(0, 10);
          let fileName = `${safeName}_EXPORT_${nowStr}`;

          if (format === 'json') {
              onExportProgress(30);
              const jsonData = generateCleanAIJSON(data, config);
              dataStr = JSON.stringify(jsonData, null, 2);
              mimeType = 'application/json';
              fileName += '.json';
              onExportProgress(90);
          } 
          else if (format === 'csv') {
              onExportProgress(30);
              dataStr = await generateOptimizedCSV(data, onExportProgress, config);
              mimeType = 'text/csv';
              fileName += '.csv';
          } 
          else { // TXT
              onExportProgress(30);
              dataStr = await generateAIText(data, onExportProgress, config);
              fileName += '.txt';
          }

          // Create Download
          const blob = new Blob([dataStr], { type: `${mimeType};charset=utf-8;` });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', fileName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          onExportProgress(100);
          setTimeout(() => {
              onExportProgress(null);
              onClose();
          }, 1000);

      } catch (e) {
          console.error("Export failed", e);
          onExportProgress(null);
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 flex justify-between items-start shrink-0">
          <div className="text-white">
            <div className="flex items-center gap-2 mb-1 opacity-90">
                <Download size={20} />
                <span className="text-xs font-bold uppercase tracking-wider">Veri Çıkışı</span>
            </div>
            <h2 className="text-xl font-bold">Akıllı Dışa Aktarım</h2>
            <p className="text-blue-100 text-sm mt-1">Yapay zeka uyumlu veri setleri oluşturun.</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors bg-white/10 p-1.5 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-8 overflow-y-auto">
            
            {/* Step 1: Format Selection */}
            <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    <Layers size={16} className="text-blue-500"/> 1. Dosya Formatı
                </label>
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { id: 'json', label: 'JSON', icon: FileJson, desc: 'Yapısal Veri (Web/App)' },
                        { id: 'csv', label: 'Excel / CSV', icon: FileSpreadsheet, desc: 'Tablo Analizi' },
                        { id: 'txt', label: 'Markdown', icon: FileText, desc: 'LLM Bağlamı (Prompt)' }
                    ].map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setFormat(type.id as any)}
                            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                                format === type.id 
                                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-600'
                            }`}
                        >
                            <type.icon size={28} className="mb-2" />
                            <span className="font-bold text-sm">{type.label}</span>
                            <span className="text-[10px] opacity-70 mt-1">{type.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Step 2: Language Selection */}
            <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    <Globe size={16} className="text-emerald-500"/> 2. Dil Seçimi
                </label>
                <div className="flex gap-4">
                    <button 
                        onClick={() => toggleLanguage('tr')}
                        className={`flex-1 flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                            languages.has('tr') 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <span className="font-bold">Türkçe (TR)</span>
                        {languages.has('tr') && <Check size={18} />}
                    </button>
                    <button 
                        onClick={() => toggleLanguage('en')}
                        className={`flex-1 flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                            languages.has('en') 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' 
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <span className="font-bold">English (EN)</span>
                        {languages.has('en') && <Check size={18} />}
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 ml-1">
                    * Çoklu seçim yapılırsa JSON yapısında "tr" ve "en" anahtarları oluşturulur. Tekil seçimde yapı sadeleştirilir.
                </p>
            </div>

            {/* Step 3: AI Context */}
            <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    <Brain size={16} className="text-violet-500"/> 3. Yapay Zeka Desteği
                </label>
                <div 
                    onClick={() => setIncludeAI(!includeAI)}
                    className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                        includeAI 
                        ? 'bg-violet-50 border-violet-500 shadow-sm' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    <div className={`mt-1 p-1 rounded-full ${includeAI ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        <Check size={14} />
                    </div>
                    <div>
                        <div className={`font-bold text-sm ${includeAI ? 'text-violet-800' : 'text-slate-600'}`}>
                            AI İpuçlarını ve Açıklamalarını Dahil Et
                        </div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                            Verilere eklediğiniz gizli "AI Context" notlarını ve şablon açıklamalarını (System Prompts) dosyaya ekler. 
                            Bir LLM modelinin veriyi doğru anlaması için <strong>şiddetle önerilir</strong>.
                        </div>
                    </div>
                </div>
            </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
            <div className="text-xs text-slate-400 font-medium">
                {languages.size} Dil • {format.toUpperCase()} • AI {includeAI ? 'Aktif' : 'Kapalı'}
            </div>
            <button 
                onClick={handleExport}
                disabled={isExporting}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Dışa Aktar
            </button>
        </div>

      </div>
    </div>
  );
};

export default ExportModal;
