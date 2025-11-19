import React, { useState } from 'react';
import { X, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';

export function ImportModal({ onClose }: { onClose: () => void }) {
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const { addToLibrary } = useProject();

    const handleImport = async () => {
        if (!url) return;
        setStatus('processing');
        setProgress(0);
        setStatusMessage('Starting process...');

        try {
            // 1. Call Backend to start processing
            const res = await fetch('http://127.0.0.1:8000/process-youtube', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url, 
                    user_id: (await supabase.auth.getUser()).data.user?.id 
                })
            });
            
            const data = await res.json();
            const projectId = data.project_id;

            // 2. Poll Supabase for status
            const interval = setInterval(async () => {
                const { data: project } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', projectId)
                    .single();

                if (project) {
                    // Update UI with backend progress
                    if (project.progress) setProgress(project.progress);
                    if (project.status_message) setStatusMessage(project.status_message);
                    
                    if (project.status === 'completed' && project.stems) {
                        clearInterval(interval);
                        setStatus('complete');
                        setProgress(100);
                        
                        // Refresh stems from database to capture metadata like IDs
                        const { data: stemRows, error: stemError } = await supabase
                            .from('stems')
                            .select('id, name, stem_type, url, duration')
                            .eq('project_id', projectId);

                        if (stemError) {
                            console.error('Failed to fetch stems after processing', stemError);
                        }

                        const fallbackTitle = project.title || 'Unknown Song';

                        if (stemRows && stemRows.length > 0) {
                            stemRows.forEach(row => {
                                addToLibrary({
                                    id: row.id,
                                    stemId: row.id,
                                    name: row.name,
                                    url: row.url,
                                    type: row.stem_type,
                                    duration: row.duration,
                                    sourceName: row.name
                                });
                            });
                        } else {
                            Object.entries(project.stems).forEach(([stemType, url]) => {
                                const generatedId = `${projectId}-${stemType}`;
                                addToLibrary({
                                    id: generatedId,
                                    stemId: generatedId,
                                    name: `${fallbackTitle} - ${stemType}`,
                                    url: url as string,
                                    type: stemType as any,
                                    duration: null,
                                    sourceName: `${fallbackTitle} - ${stemType}`
                                });
                            });
                        }

                        setTimeout(onClose, 1500);
                    } else if (project.status === 'failed') {
                        clearInterval(interval);
                        setStatus('error');
                        setStatusMessage(`Error: ${project.error}`);
                    }
                }
            }, 1000);

        } catch (e) {
            setStatus('error');
            setStatusMessage('Failed to connect to server');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-lg border border-zinc-800 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Import Song</h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="text-zinc-400 hover:text-white" />
                    </button>
                </div>

                <div className="space-y-6">
                    {status === 'idle' && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-400">YouTube URL</label>
                                <input 
                                    type="text" 
                                    placeholder="https://youtube.com/watch?v=..." 
                                    className="w-full p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            <button 
                                onClick={handleImport}
                                disabled={!url}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Download size={20} />
                                Import & Separate
                            </button>
                        </>
                    )}

                    {status !== 'idle' && (
                        <div className="py-4 space-y-6">
                            {/* Status Icon */}
                            <div className="flex justify-center">
                                {status === 'processing' && (
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                                        <Loader2 className="animate-spin text-indigo-500 relative z-10" size={48} />
                                    </div>
                                )}
                                {status === 'complete' && <CheckCircle2 className="text-green-500" size={48} />}
                                {status === 'error' && <AlertCircle className="text-red-500" size={48} />}
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-300 font-medium">{statusMessage}</span>
                                    <span className="text-zinc-500">{progress}%</span>
                                </div>
                                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ease-out ${
                                            status === 'error' ? 'bg-red-500' : 
                                            status === 'complete' ? 'bg-green-500' : 'bg-indigo-500'
                                        }`}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Steps */}
                            <div className="grid grid-cols-3 gap-2 text-xs text-center pt-2">
                                <div className={`p-2 rounded ${progress >= 10 ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600'}`}>
                                    1. Download
                                </div>
                                <div className={`p-2 rounded ${progress >= 30 ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600'}`}>
                                    2. Separate AI
                                </div>
                                <div className={`p-2 rounded ${progress >= 80 ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-600'}`}>
                                    3. Upload
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
