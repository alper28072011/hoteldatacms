import React, { useState } from 'react';
import { Download, FileJson, FileText, FileSpreadsheet, FileType, Check, X, Globe, Cpu } from 'lucide-react';
import { ExportConfig } from '../types';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (config: ExportConfig) => void;
    isExporting: boolean;
    progress: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onExport, isExporting, progress }) => {
    const [format, setFormat] = useState<ExportConfig['format']>('json');
    const [languageMode, setLanguageMode] = useState<'tr' | 'en' | 'multi'>('multi');
    const [includeAI, setIncludeAI] = useState(true);

    if (!isOpen) return null;

    const handleExport = () => {
        const languages: ('tr' | 'en')[] = languageMode === 'multi' ? ['tr', 'en'] : [languageMode];
        onExport({
            format,
            languages,
            includeAIContext: includeAI
        });
    };

    const formats = [
        { id: 'json', label: 'JSON (Full)', icon: FileJson, desc: 'Tam yedekleme ve sistem entegrasyonu için.' },
        { id: 'csv', label: 'Excel / CSV', icon: FileSpreadsheet, desc: 'Tablo görünümü ve toplu düzenleme için.' },
        { id: 'txt', label: 'Markdown / TXT', icon: FileText, desc: 'LLM eğitimi ve okunabilir doküman için.' },
        { id: 'pdf', label: 'PDF Rapor', icon: FileType, desc: 'Yazdırılabilir rapor ve paylaşım için.' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <Download size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Veri Dışarı Aktarma</h2>
                            <p className="text-xs text-slate-500">Format ve içerik ayarlarını yapılandırın.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-8">
                    
                    {/* 1. Format Selection */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">1. Dosya Formatı</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {formats.map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setFormat(f.id as any)}
                                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                        format === f.id 
                                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500' 
                                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`p-2 rounded-lg shrink-0 ${format === f.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <f.icon size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{f.label}</div>
                                        <div className="text-xs text-slate-500 mt-1 leading-relaxed">{f.desc}</div>
                                    </div>
                                    {format === f.id && <div className="ml-auto text-indigo-600"><Check size={16} /></div>}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* 2. Language & Content */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <Globe size={14} /> 2. Dil Seçimi
                            </h3>
                            <div className="space-y-2">
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                    <input type="radio" name="lang" checked={languageMode === 'multi'} onChange={() => setLanguageMode('multi')} className="text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Çoklu Dil (TR + EN)</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                    <input type="radio" name="lang" checked={languageMode === 'tr'} onChange={() => setLanguageMode('tr')} className="text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Sadece Türkçe</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                                    <input type="radio" name="lang" checked={languageMode === 'en'} onChange={() => setLanguageMode('en')} className="text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">Sadece İngilizce</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <Cpu size={14} /> 3. İçerik Detayı
                            </h3>
                            <div className="space-y-2">
                                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${includeAI ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                                    <div className="pt-0.5">
                                        <input type="checkbox" checked={includeAI} onChange={(e) => setIncludeAI(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                                    </div>
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">AI Bağlamı & Etiketler</span>
                                        <span className="text-xs text-slate-500 block mt-0.5">Sistem notları, etiketler ve açıklamalar dahil edilir. LLM eğitimi için önerilir.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
                    <div className="text-xs text-slate-400">
                        {isExporting ? `İşleniyor... %${progress}` : 'Hazır'}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                            İptal
                        </button>
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Aktarılıyor...
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    Dışarı Aktar
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                {/* Progress Bar Overlay */}
                {isExporting && (
                    <div className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                )}
            </div>
        </div>
    );
};

export default ExportModal;
