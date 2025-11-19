import React from 'react';
import { useProject, Clip, Track } from '@/context/ProjectContext';
import { TimelineClip } from './TimelineClip';
import { useDroppable } from '@dnd-kit/core';
import { MousePointer2, Scissors, Plus, Magnet } from 'lucide-react';

// Droppable Track Row Component
function TrackRow({ track, clips }: { track: Track, clips: Clip[] }) {
    const rowRef = React.useRef<HTMLDivElement | null>(null);
    const { setNodeRef, isOver } = useDroppable({
        id: track.id,
        data: {
            type: 'track',
            track,
            getRect: () => rowRef.current?.getBoundingClientRect()
        }
    });

    const assignRef = (node: HTMLDivElement | null) => {
        rowRef.current = node;
        setNodeRef(node);
    };

    return (
        <div 
            ref={assignRef}
            className={`h-24 border-b border-zinc-800/50 w-full relative group transition-colors ${isOver ? 'bg-indigo-500/10' : ''}`}
        >
            <div className="absolute top-0 left-0 right-0 h-6 bg-zinc-900/80 border-b border-zinc-800 flex items-center px-3 text-xs uppercase tracking-wide text-zinc-500">
                {track.name}
            </div>
            <div className="absolute top-6 bottom-0 left-0 right-0">
                {clips.filter(c => c.trackId === track.id).map(clip => (
                    <TimelineClip key={clip.id} clip={clip} />
                ))}
            </div>
        </div>
    );
}

export function Timeline() {
    const { tracks, clips, addTrack, zoom, currentTime, duration, setZoom, tool, setTool, seek, setSelectedClipId, snapEnabled, toggleSnap } = useProject();
    // Remove the main timeline droppable, we want individual track droppables
    // const { setNodeRef } = useDroppable({ id: 'timeline' });

    const handleRulerClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const time = clickX / zoom;
        seek(time);
    };

    // Generate time markers
    const markers = [];
    for (let i = 0; i < duration; i += 5) {
        markers.push(
            <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-800 text-[10px] text-zinc-500 pl-1 select-none pointer-events-none" style={{ left: i * zoom }}>
                {i}s
            </div>
        );
    }

    return (
        <div className="flex-1 bg-zinc-900 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="h-12 border-b border-zinc-800 flex items-center px-4 gap-4 bg-zinc-900 z-10">
                {/* Tools */}
                <div className="flex bg-zinc-800 rounded-lg p-1 gap-1">
                    <button 
                        onClick={() => setTool('pointer')}
                        className={`p-1.5 rounded ${tool === 'pointer' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                        title="Move Tool"
                    >
                        <MousePointer2 size={16} />
                    </button>
                    <button 
                        onClick={() => setTool('split')}
                        className={`p-1.5 rounded ${tool === 'split' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                        title="Split Tool"
                    >
                        <Scissors size={16} />
                    </button>
                </div>

                <div className="w-px h-6 bg-zinc-800 mx-2" />

                <button
                    onClick={toggleSnap}
                    className={`p-2 rounded flex items-center gap-2 text-xs font-medium transition-colors ${snapEnabled ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-800'}`}
                    title="Toggle Snap"
                >
                    <Magnet size={14} />
                    Snap
                </button>

                <div className="flex items-center gap-2">
                    <div className="text-xs text-zinc-400">Zoom</div>
                    <input 
                        type="range" min="10" max="200" 
                        value={zoom} 
                        onChange={e => setZoom(Number(e.target.value))}
                        className="w-32 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>

                <div className="flex-1" />
                
                <button 
                    onClick={addTrack}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors"
                >
                    <Plus size={14} />
                    Add Track
                </button>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-auto relative custom-scrollbar" onClick={() => setSelectedClipId(null)}>
                <div className="min-w-full h-full relative" style={{ width: duration * zoom }}>
                    {/* Time Ruler */}
                    <div 
                        className="h-6 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-20 flex items-end cursor-pointer hover:bg-zinc-800/50"
                        onClick={handleRulerClick}
                    >
                        {markers}
                    </div>

                    {/* Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                        style={{ left: currentTime * zoom }}
                    >
                        <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45 transform origin-center" />
                    </div>

                    {/* Track Rows */}
                    <div className="relative min-h-[400px]">
                        {tracks.map((track) => (
                            <TrackRow key={track.id} track={track} clips={clips} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
