"use client";

import React, { useState, useEffect } from 'react';
import { ProjectProvider, useProject, LibraryItem, Clip, Track } from '@/context/ProjectContext';
import { Transport } from '@/components/Transport';
import { Timeline } from '@/components/Timeline';
import { Library } from '@/components/Library';
import { ImportModal } from '@/components/ImportModal';
import Auth from '@/components/Auth';
import { Plus, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core';
import { createSegmentName } from '@/lib/time';

const SNAP_THRESHOLD_SECONDS = 0.1;

type DragItemData =
    | { type: 'library-item'; item: LibraryItem }
    | { type: 'clip'; clip: Clip };

type TrackDropData = {
    type: 'track';
    track: Track;
    getRect?: () => DOMRect | null;
};

function StudioContent({ session }: { session: Session }) {
    const [showImport, setShowImport] = useState(false);
    const { clips, updateClip, addClip, zoom, tracks, removeClip, selectedClipId, setSelectedClipId, snapEnabled, copyClip, pasteClip, activeTrackId, currentTime } = useProject();
    const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent accidental drags
            },
        })
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.key === 'Backspace' || event.key === 'Delete') && selectedClipId) {
                event.preventDefault();
                removeClip(selectedClipId);
                setSelectedClipId(null);
                return;
            }

            const isCopy = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c';
            const isPaste = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v';

            if (isCopy && selectedClipId) {
                event.preventDefault();
                copyClip(selectedClipId);
                return;
            }

            if (isPaste) {
                event.preventDefault();
                pasteClip(activeTrackId, currentTime);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [removeClip, selectedClipId, setSelectedClipId, copyClip, pasteClip, activeTrackId, currentTime]);

    const renderDragOverlayContent = () => {
        if (!activeDragItem) return null;
        const label = activeDragItem.type === 'library-item'
            ? activeDragItem.item.name
            : activeDragItem.clip.name;
        const detail = activeDragItem.type === 'library-item'
            ? activeDragItem.item.type
            : activeDragItem.clip.stemType;
        return (
            <div className="px-4 py-2 bg-indigo-600/90 border border-indigo-400 rounded-lg shadow-2xl text-left w-48">
                <div className="text-[10px] uppercase tracking-widest text-indigo-200 mb-1">{detail}</div>
                <div className="text-sm font-semibold text-white truncate">{label}</div>
                <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full bg-white/70 animate-pulse" />
                </div>
            </div>
        );
    };

    const handleDragStart = (event: DragStartEvent) => {
        const data = event.active.data.current as DragItemData | undefined;
        if (data?.type) {
            setActiveDragItem(data);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, delta, over } = event;
        setActiveDragItem(null);
        
        if (!active) return;

        // Handle Library Item Drop
        if (active.data.current?.type === 'library-item') {
            // Check if dropped over a track row
            if (over) {
                const trackData = over.data.current as TrackDropData | undefined;
                const trackId = trackData?.track?.id ?? (over.id as string);
                const item = active.data.current.item;
                const startOffset = item.startOffset ?? 0;
                const forcedSegment = Boolean(item.isSegment || item.startOffset !== undefined || item.endOffset !== undefined);
                const computedDuration = item.endOffset !== undefined
                    ? Math.max(0.1, item.endOffset - startOffset)
                    : Math.max(0.1, item.duration ?? 30);
                const baseName = item.sourceName || item.name;
                const clipName = createSegmentName(baseName, startOffset, startOffset + computedDuration, forcedSegment);
                const dragRect = active.rect.current.translated ?? active.rect.current.initial;
                const trackRect = trackData?.getRect?.();
                const pointerX = dragRect ? dragRect.left + dragRect.width / 2 : 0;
                const dropTime = trackRect
                    ? Math.max(0, (pointerX - trackRect.left) / zoom)
                    : 0;

                addClip({
                    id: crypto.randomUUID(),
                    trackId,
                    name: clipName,
                    baseName,
                    audioUrl: item.url,
                    stemId: item.stemId,
                    stemType: item.type,
                    componentId: item.componentId,
                    isSegment: forcedSegment,
                    startTime: dropTime,
                    offset: startOffset,
                    duration: computedDuration,
                    volume: 0.8,
                    pitch: 0,
                    speed: 1
                });
            }
            return;
        }

        // Handle Clip Move
        if (active.data.current?.type === 'clip') {
            const clipId = active.id as string;
            const clip = clips.find(c => c.id === clipId);
            
            if (clip) {
                const deltaSeconds = delta.x / zoom;
                let newStartTime = Math.max(0, clip.startTime + deltaSeconds);
                
                // Check if moved to a different track
                let newTrackId = clip.trackId;
                if (over) {
                    const overData = over.data.current as TrackDropData | undefined;
                    if (overData?.track?.id) {
                        newTrackId = overData.track.id;
                    } else if (tracks.some(t => t.id === over.id)) {
                        newTrackId = over.id as string;
                    }
                }

                if (snapEnabled) {
                    const snaps = clips
                        .filter(other => other.id !== clipId && other.trackId === newTrackId);

                    snaps.forEach(other => {
                        const otherStart = other.startTime;
                        const otherEnd = other.startTime + other.duration;

                        if (Math.abs(newStartTime - otherEnd) <= SNAP_THRESHOLD_SECONDS) {
                            newStartTime = otherEnd;
                            return;
                        }

                        const currentClipEnd = newStartTime + clip.duration;
                        if (Math.abs(currentClipEnd - otherStart) <= SNAP_THRESHOLD_SECONDS) {
                            newStartTime = Math.max(0, otherStart - clip.duration);
                        }
                    });
                }

                updateClip(clipId, { 
                    startTime: newStartTime,
                    trackId: newTrackId
                });
            }
        }
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-screen bg-zinc-950 text-white flex flex-col">
                {/* Header */}
                <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-900">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                            AI Music Studio
                        </h1>
                        <span className="text-xs text-zinc-500 border border-zinc-800 px-2 py-1 rounded">
                            {session.user.email}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setShowImport(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Plus size={16} />
                            Add Song
                        </button>
                        <button 
                            onClick={() => supabase.auth.signOut()}
                            className="text-zinc-500 hover:text-white"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* Main Workspace */}
                <main className="flex-1 flex overflow-hidden">
                    <Library />
                    <Timeline />
                </main>

                {/* Transport Controls */}
                <Transport />

                {/* Modals */}
                {showImport && <ImportModal onClose={() => setShowImport(false)} />}

                {/* Drag Overlay */}
                <DragOverlay>
                    {renderDragOverlayContent()}
                </DragOverlay>
            </div>
        </DndContext>
    );
}

export default function Home() {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (!session) {
        return <Auth />;
    }

    return (
        <ProjectProvider userId={session.user.id}>
            <StudioContent session={session} />
        </ProjectProvider>
    );
}
