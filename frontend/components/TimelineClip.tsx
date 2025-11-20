import React, { useState, useEffect } from 'react';
import { useProject, Clip } from '@/context/ProjectContext';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Trash2 } from 'lucide-react';
import { getStemAppearance } from '@/lib/colors';

export function TimelineClip({ clip }: { clip: Clip }) {
    const {
        zoom,
        tool,
        splitClip,
        removeClip,
        selectedClipIds,
        selectClip,
        toggleClipSelection,
        resizeClip,
        duration: projectDuration,
        setActiveTrackId
    } = useProject();
    const [resizeState, setResizeState] = useState<{
        edge: 'start' | 'end';
        startX: number;
        initialStart: number;
        initialDuration: number;
        initialOffset: number;
    } | null>(null);
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: clip.id,
        data: { type: 'clip', clip },
        disabled: tool === 'split' || Boolean(resizeState)
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
        const isAdditive = e.metaKey || e.ctrlKey;
        if (isAdditive) {
            toggleClipSelection(clip.id);
        } else {
            selectClip(clip.id);
        }
        setActiveTrackId(clip.trackId);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        removeClip(clip.id);
    };

    const handleResizeMouseDown = (edge: 'start' | 'end') => (e: React.MouseEvent) => {
        if (tool === 'split') return;
        e.stopPropagation();
        e.preventDefault();
        selectClip(clip.id);
        setResizeState({
            edge,
            startX: e.clientX,
            initialStart: clip.startTime,
            initialDuration: clip.duration,
            initialOffset: clip.offset
        });
    };

    useEffect(() => {
        if (!resizeState) return;

        const MIN_DURATION = 0.05;

        const handleMove = (e: MouseEvent) => {
            const deltaPx = e.clientX - resizeState.startX;
            const deltaSeconds = deltaPx / zoom;
            const sourceLimit = clip.sourceDuration ?? Infinity;

            if (resizeState.edge === 'start') {
                const minStart = Math.max(0, resizeState.initialStart - resizeState.initialOffset);
                let newStart = resizeState.initialStart + deltaSeconds;
                const maxStart = resizeState.initialStart + resizeState.initialDuration - MIN_DURATION;
                newStart = Math.min(Math.max(minStart, newStart), maxStart);
                const usedDelta = newStart - resizeState.initialStart;
                let newDuration = resizeState.initialDuration - usedDelta;
                newDuration = Math.max(MIN_DURATION, newDuration);
                let newOffset = resizeState.initialOffset + usedDelta;
                newOffset = Math.max(0, newOffset);
                const maxDurationAllowed = sourceLimit - newOffset;
                newDuration = Math.min(newDuration, maxDurationAllowed);
                resizeClip(clip.id, {
                    startTime: newStart,
                    duration: newDuration,
                    offset: newOffset
                });
            } else {
                let newDuration = resizeState.initialDuration + deltaSeconds;
                newDuration = Math.max(MIN_DURATION, newDuration);
                const maxDuration = projectDuration - resizeState.initialStart;
                const maxSourceDuration = sourceLimit - clip.offset;
                newDuration = Math.min(newDuration, maxDuration, maxSourceDuration);
                resizeClip(clip.id, {
                    duration: newDuration
                });
            }
        };

        const handleUp = () => {
            setResizeState(null);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [resizeState, zoom, resizeClip, clip.id, projectDuration, clip.offset, clip.sourceDuration]);

    const isSelected = selectedClipIds.includes(clip.id);
    const clipColors = getStemAppearance(clip.stemType);
    const containerBorder = isSelected ? 'border-white shadow-lg' : clipColors.timelineBorder;

    return (
        <div
            data-role="clip"
            ref={setNodeRef}
            style={style}
            className={`absolute top-2 bottom-2 ${clipColors.timelineBg} border ${containerBorder} rounded-md overflow-hidden group transition-colors`}
        >
            <div
                {...listeners}
                {...attributes}
                onClick={handleClick}
                className={`absolute inset-0 ${
                    tool === 'split'
                        ? 'cursor-crosshair hover:bg-red-500/80 hover:border-red-400'
                        : `cursor-move ${clipColors.timelineHover}`
                }`}
            >
                <div className="p-2 text-xs font-bold truncate text-white drop-shadow-md pointer-events-none">
                    {clip.name}
                </div>
                <div className="absolute inset-0 opacity-30 bg-[url('/wave.svg')] bg-repeat-x bg-center bg-contain pointer-events-none" />
                {tool !== 'split' && (
                    <button 
                        onClick={handleDelete}
                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Clip"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
            {tool !== 'split' && (
                <>
                    <div
                        className="absolute left-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50"
                        onMouseDown={handleResizeMouseDown('start')}
                    />
                    <div
                        className="absolute right-0 top-0 bottom-0 w-2 bg-white/20 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-white/50"
                        onMouseDown={handleResizeMouseDown('end')}
                    />
                </>
            )}
        </div>
    );
}
