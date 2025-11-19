import React from 'react';
import { Play, Pause, Square, FastForward, Rewind } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { audioEngine } from '@/lib/audio';

export function Transport() {
    const { isPlaying, setIsPlaying, currentTime } = useProject();

    const togglePlay = () => {
        if (isPlaying) {
            audioEngine.pause();
        } else {
            audioEngine.play();
        }
        setIsPlaying(!isPlaying);
    };

    const stop = () => {
        audioEngine.stop();
        setIsPlaying(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-8 gap-8 text-zinc-200 z-50">
            <div className="flex items-center gap-4">
                <button onClick={stop} className="p-2 hover:text-white"><Square size={20} /></button>
                <button onClick={togglePlay} className="p-4 bg-indigo-600 rounded-full hover:bg-indigo-500 text-white">
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                </button>
            </div>
            <div className="font-mono text-2xl text-indigo-400">
                {formatTime(currentTime)}
            </div>
        </div>
    );
}

