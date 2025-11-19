import React from 'react';
import { Volume2, VolumeX, Mic, Headphones } from 'lucide-react';
import { TrackState, useProject } from '@/context/ProjectContext';

export function TrackControls({ track }: { track: TrackState }) {
    const { updateTrack } = useProject();

    return (
        <div className="bg-zinc-800 rounded-lg p-4 flex items-center gap-4 w-full mb-2">
            <div className="w-32 font-bold text-zinc-300 truncate">{track.name}</div>
            
            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
                <button 
                    onClick={() => updateTrack(track.id, { isMuted: !track.isMuted })}
                    className={`p-2 rounded ${track.isMuted ? 'text-red-500 bg-red-500/10' : 'text-zinc-400 hover:text-white'}`}
                >
                    {track.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={track.volume}
                    onChange={(e) => updateTrack(track.id, { volume: parseFloat(e.target.value) })}
                    className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>

            {/* Pitch & Speed */}
            <div className="flex items-center gap-4 text-xs text-zinc-400">
                <div className="flex flex-col gap-1">
                    <label>Pitch: {track.pitch}</label>
                    <input 
                        type="range" min="-12" max="12" step="1"
                        value={track.pitch}
                        onChange={(e) => updateTrack(track.id, { pitch: parseInt(e.target.value) })}
                        className="w-24 h-1 bg-zinc-600 rounded-lg accent-indigo-500"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label>Speed: {track.speed.toFixed(2)}x</label>
                    <input 
                        type="range" min="0.5" max="2" step="0.1"
                        value={track.speed}
                        onChange={(e) => updateTrack(track.id, { speed: parseFloat(e.target.value) })}
                        className="w-24 h-1 bg-zinc-600 rounded-lg accent-indigo-500"
                    />
                </div>
            </div>
        </div>
    );
}

