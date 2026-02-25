import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { HotelNode, LocalizedText } from '../types';
import { getLocalizedValue } from '../utils/treeUtils';
import { Printer, FileText, Globe, Download } from 'lucide-react';

interface FullContentPreviewProps {
    node: HotelNode;
    language: 'tr' | 'en';
}

const ContentNodeRenderer: React.FC<{ node: HotelNode; level: number; language: 'tr' | 'en' }> = ({ node, level, language }) => {
    const name = getLocalizedValue(node.name, language);
    const value = getLocalizedValue(node.type === 'qa_pair' ? node.answer : node.value, language);
    const description = getLocalizedValue(node.description, language);

    // Skip empty nodes if desired, or show placeholder
    if (!name) return null;

    const HeadingTag = `h${Math.min(level + 1, 6)}` as keyof JSX.IntrinsicElements;
    
    // Styles based on level
    const headingClass = level === 0 ? "text-3xl font-bold mb-4 mt-8 border-b-2 border-slate-800 pb-2" :
                         level === 1 ? "text-2xl font-bold mb-3 mt-6 text-slate-800" :
                         level === 2 ? "text-xl font-semibold mb-2 mt-4 text-slate-700" :
                         "text-lg font-medium mb-2 mt-3 text-slate-600";

    const isLeaf = !node.children || node.children.length === 0;

    return (
        <div className={`mb-4 ${level === 0 ? 'page-break-before-always' : ''}`}>
            {/* Heading */}
            <HeadingTag className={headingClass}>
                {name}
                {node.type === 'qa_pair' && <span className="ml-2 text-sm font-normal text-slate-500">(Soru-Cevap)</span>}
            </HeadingTag>

            {/* Content Body */}
            <div className="ml-4">
                {/* Description / Context */}
                {description && (
                    <div className="text-sm text-slate-500 italic mb-2 bg-slate-50 p-2 rounded border-l-2 border-slate-300 print:hidden">
                        {description}
                    </div>
                )}

                {/* Main Value */}
                {value && (
                    <div className="text-base text-slate-800 mb-3 whitespace-pre-wrap leading-relaxed">
                        {value}
                    </div>
                )}

                {/* Attributes Table */}
                {node.attributes && node.attributes.length > 0 && (
                    <div className="mb-4 overflow-x-auto">
                        <table className="min-w-full text-sm text-left border-collapse">
                            <tbody>
                                {node.attributes.map((attr, index) => (
                                    <tr key={attr.id || index} className="border-b border-slate-100 print:border-slate-200">
                                        <td className="py-1.5 pr-4 font-semibold text-slate-600 w-1/3 align-top">
                                            {getLocalizedValue(attr.key, language)}
                                        </td>
                                        <td className="py-1.5 text-slate-800 align-top">
                                            {getLocalizedValue(attr.value, language)}
                                            {/* Sub Attributes */}
                                            {attr.subAttributes && attr.subAttributes.length > 0 && (
                                                <div className="mt-1 pl-4 border-l-2 border-slate-200">
                                                    {attr.subAttributes.map((sub, subIndex) => (
                                                        <div key={sub.id || subIndex} className="flex gap-2 text-xs mt-1">
                                                            <span className="font-medium text-slate-500">{getLocalizedValue(sub.key, language)}:</span>
                                                            <span>{getLocalizedValue(sub.value, language)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Tags */}
                {node.tags && node.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3 print:hidden">
                        {node.tags.map((tag, index) => (
                            <span key={`${tag}-${index}`} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">#{tag}</span>
                        ))}
                    </div>
                )}
            </div>

            {/* Children Recursion */}
            {node.children && node.children.length > 0 && (
                <div className="ml-4 border-l border-slate-100 pl-4 print:border-l-0 print:pl-0 print:ml-0">
                    {node.children.map((child, index) => (
                        <ContentNodeRenderer key={child.id || index} node={child} level={level + 1} language={language} />
                    ))}
                </div>
            )}
        </div>
    );
};

const FullContentPreview: React.FC<FullContentPreviewProps> = ({ node, language }) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Hotel_Content_Export_${language.toUpperCase()}`,
    });

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm print:hidden">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">İçerik Önizleme & Baskı</h2>
                        <p className="text-xs text-slate-500">Tüm içerik hiyerarşisi okuma modunda.</p>
                    </div>
                </div>
                <button 
                    onClick={() => handlePrint && handlePrint()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                    <Printer size={16} />
                    <span>Yazdır / PDF Kaydet</span>
                </button>
            </div>

            {/* Preview Area */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl min-h-[800px] p-12 print:shadow-none print:p-0" ref={componentRef}>
                    
                    {/* Cover Page Header */}
                    <div className="text-center mb-12 border-b-2 border-slate-100 pb-8 print:h-screen print:flex print:flex-col print:justify-center print:items-center print:border-0 print:mb-0 print:pb-0 print:page-break-after-always relative z-10 bg-white">
                        <div>
                            <h1 className="text-4xl font-extrabold text-slate-900 mb-2 uppercase tracking-tight">
                                {getLocalizedValue(node.name, language) || 'Hotel Content'}
                            </h1>
                            <p className="text-slate-500 text-lg">
                                {language === 'tr' ? 'İçerik Dokümantasyonu' : 'Content Documentation'}
                            </p>
                            <div className="mt-4 text-sm text-slate-400 font-mono">
                                {new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', { 
                                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Content Tree */}
                    <div className="content-tree space-y-8 print:pb-12">
                        {node.children && node.children.map((child, index) => (
                            <ContentNodeRenderer key={child.id || index} node={child} level={0} language={language} />
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        margin: 1.5cm;
                        size: A4;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                    }

                    .print\:page-break-after-always {
                        page-break-after: always;
                    }

                    .page-break-before-always {
                        page-break-before: always;
                    }
                    /* AI Hints Hide */
                    .ai-hint, .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default FullContentPreview;
