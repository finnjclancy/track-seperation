import React from 'react';
import { useProject, Clip } from '@/context/ProjectContext';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';

export function TimelineClip({ clip }: { clip: Clip }) {
    const { zoom, tool, splitClip, removeClip, selectedClipId, setSelectedClipId } = useProject();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: clip.id,
        data: { type: 'clip', clip },
        disabled: tool === 'split'
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        left: `${clip.startTime * zoom}px`,
        width: `${clip.duration * zoom}px`,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleClick = (e: React.MouseEvent) => {
        if (tool === 'split') {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickTime = clickX / zoom;
            splitClip(clip.id, clip.startTime + clickTime);
            return;
        }

        e.stopPropagation();
        setSelectedClipId(clip.id);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        removeClip(clip.id);
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={handleClick}
            className={`absolute top-2 bottom-2 bg-indigo-600/80 border ${selectedClipId === clip.id ? 'border-white shadow-lg' : 'border-indigo-400'} rounded-md overflow-hidden group transition-colors
                ${tool === 'split' ? 'cursor-crosshair hover:bg-red-500/80 hover:border-red-400' : 'cursor-move hover:bg-indigo-600'}
            `}
        >
            <div className="p-2 text-xs font-bold truncate text-white drop-shadow-md pointer-events-none">
                {clip.name}
            </div>
            
            {/* Waveform placeholder */}
            <div className="absolute inset-0 opacity-30 bg-[url('/wave.svg')] bg-repeat-x bg-center bg-contain pointer-events-none" />
            
            {/* Delete Button (visible on hover) */}
            {tool !== 'split' && (
                <button 
                    onClick={handleDelete}
                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Clip"
                >
                    <Trash2 size={12} />
                </button>
            )}
            
            {/* Resize handles (visual only for now) */}
            {tool !== 'split' && (
                <>
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50" />
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50" />
                </>
            )}
        </div>
    );
}
