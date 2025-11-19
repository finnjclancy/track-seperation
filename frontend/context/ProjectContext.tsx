"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { audioEngine } from '@/lib/audio';
import { supabase } from '@/lib/supabase';
import { createSegmentName } from '@/lib/time';

const loadAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        audio.src = url;
        const cleanup = () => {
            audio.removeEventListener('loadedmetadata', onLoaded);
            audio.removeEventListener('error', onError);
            audio.src = '';
        };
        const onLoaded = () => {
            const duration = audio.duration || 0;
            cleanup();
            resolve(duration);
        };
        const onError = () => {
            cleanup();
            reject(new Error('Failed to load audio metadata'));
        };
        audio.addEventListener('loadedmetadata', onLoaded);
        audio.addEventListener('error', onError);
	    });
	};

const buildClipName = (baseName: string, offset: number, duration: number, force = false) =>
    createSegmentName(baseName, offset, offset + duration, force);

type StemRow = {
    id: string;
    project_id: string;
    name: string;
    stem_type: string;
    url: string;
    duration: number | null;
    created_at: string;
};

type SegmentRow = {
    id: string;
    stem_id: string;
    user_id: string;
    name: string;
    start_time: number | null;
    end_time: number | null;
    created_at: string;
};

const createSegmentLibraryItem = (
    segment: SegmentRow,
    parentStem: StemRow
): LibraryItem => {
    const start = segment.start_time ?? 0;
    const end = segment.end_time ?? start;
    return {
        id: segment.id,
        componentId: segment.id,
        stemId: segment.stem_id,
        name: segment.name,
        url: parentStem.url,
        type: (parentStem.stem_type as LibraryItem['type']) ?? 'other',
        duration: Math.max(0, end - start),
        startOffset: start,
        endOffset: end,
        isSegment: true,
        sourceName: parentStem.name
    };
};

const buildLibraryItems = (stems: StemRow[], segments: SegmentRow[]): LibraryItem[] => {
    const stemsMap = new Map<string, StemRow>();
    stems.forEach(stem => stemsMap.set(stem.id, stem));

    const segmentsByStem = new Map<string, LibraryItem[]>();
    segments.forEach(segment => {
        const parentStem = stemsMap.get(segment.stem_id);
        if (!parentStem) return;
        const item = createSegmentLibraryItem(segment, parentStem);
        const existing = segmentsByStem.get(segment.stem_id) ?? [];
        existing.push(item);
        segmentsByStem.set(segment.stem_id, existing);
    });

    const items: LibraryItem[] = [];
    stems.forEach(stem => {
        items.push({
            id: stem.id,
            stemId: stem.id,
            name: stem.name,
            url: stem.url,
            type: (stem.stem_type as LibraryItem['type']) ?? 'other',
            duration: stem.duration,
            sourceName: stem.name
        });

        const stemSegments = segmentsByStem.get(stem.id);
        if (stemSegments && stemSegments.length > 0) {
            stemSegments
                .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));
            items.push(...stemSegments);
        }
    });

    return items;
};

export interface LibraryItem {
    id: string;
    stemId: string;
    name: string;
    url: string;
    type: 'vocals' | 'drums' | 'bass' | 'other';
    duration?: number | null;
    startOffset?: number;
    endOffset?: number;
    isSegment?: boolean;
    componentId?: string;
    sourceName?: string;
}

export interface Clip {
    id: string;
    trackId: string; // The visual track row it belongs to
    audioUrl: string;
    name: string;
    baseName: string;
    stemId: string;
    stemType: LibraryItem['type'];
    componentId?: string;
    isSegment?: boolean;
    startTime: number; // Where it starts on the timeline (seconds)
    offset: number; // Where the audio starts within the file (seconds)
    duration: number; // How long the clip is (seconds)
    volume: number;
    pitch: number;
    speed: number;
}

export interface Track {
    id: string;
    name: string;
    isMuted: boolean;
    isSoloed: boolean;
    volume: number;
}

interface ProjectContextType {
    tracks: Track[];
    clips: Clip[];
    library: LibraryItem[];
    addTrack: () => void;
    addToLibrary: (item: LibraryItem) => void;
    removeLibraryItem: (itemId: string) => Promise<void>;
    renameLibraryItem: (itemId: string, newName: string) => Promise<void>;
    addClip: (clip: Clip) => void;
    updateClip: (id: string, updates: Partial<Clip>) => void;
    removeClip: (id: string) => void;
    resizeClip: (id: string, updates: { startTime?: number; duration?: number; offset?: number }) => void;
    splitClip: (id: string, splitTime: number) => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTime: number;
    seek: (time: number, options?: { autoResume?: boolean }) => void;
    duration: number;
    zoom: number; // Pixels per second
    setZoom: (zoom: number) => void;
    tool: 'pointer' | 'split';
    setTool: (tool: 'pointer' | 'split') => void;
    selectedClipId: string | null;
    setSelectedClipId: (id: string | null) => void;
    snapEnabled: boolean;
    toggleSnap: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

type ProjectProviderProps = {
    userId: string;
    children: React.ReactNode;
};

export function ProjectProvider({ children, userId }: ProjectProviderProps) {
    const [tracks, setTracks] = useState<Track[]>([
        { id: 'track-1', name: 'Track 1', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-2', name: 'Track 2', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-3', name: 'Track 3', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-4', name: 'Track 4', isMuted: false, isSoloed: false, volume: 1 },
    ]);
    const [clips, setClips] = useState<Clip[]>([]);
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(300); // Default 5 mins
    const [zoom, setZoom] = useState(50); // 50px = 1 second
    const [tool, setTool] = useState<'pointer' | 'split'>('pointer');
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);

    const addSegmentToLibraryState = (segment: LibraryItem) => {
        setLibrary(prev => {
            if (prev.some(existing => existing.id === segment.id)) {
                return prev;
            }
            return [segment, ...prev];
        });
    };

    const refreshPlayback = () => {
        if (!isPlaying) return;
        const position = audioEngine.getCurrentTime();
        audioEngine.seek(position);
        audioEngine.play();
        setCurrentTime(position);
    };

    const removeLibraryComponent = (componentId?: string) => {
        if (!componentId) return;
        setLibrary(prev => prev.filter(item => item.id !== componentId && item.componentId !== componentId));
    };

    const deleteSegmentRecord = async (segmentId?: string) => {
        if (!segmentId) return;
        try {
            await supabase
                .from('stem_segments')
                .delete()
                .eq('id', segmentId);
        } catch (err) {
            console.error('Failed to delete segment', err);
        }
    };

    const removeLibraryItem = async (itemId: string) => {
        const item = library.find(entry => entry.id === itemId);
        if (!item) return;

        setLibrary(prev => prev.filter(entry => entry.id !== itemId));

        try {
            if (item.isSegment) {
                await supabase.from('stem_segments').delete().eq('id', itemId);
            } else {
                await supabase.from('stems').delete().eq('id', itemId);
            }
        } catch (err) {
            console.error('Failed to delete library item', err);
        }
    };

    const renameLibraryItem = async (itemId: string, newName: string) => {
        const trimmedName = newName.trim();
        if (!trimmedName) return;

        setLibrary(prev => prev.map(item => item.id === itemId ? { ...item, name: trimmedName } : item));

        const item = library.find(entry => entry.id === itemId);
        if (!item) return;

        try {
            if (item.isSegment) {
                await supabase
                    .from('stem_segments')
                    .update({ name: trimmedName })
                    .eq('id', itemId);
            } else {
                await supabase
                    .from('stems')
                    .update({ name: trimmedName })
                    .eq('id', itemId);
            }
        } catch (err) {
            console.error('Failed to rename library item', err);
        }
    };

    // Sync engine time
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPlaying) {
            interval = setInterval(() => {
                setCurrentTime(audioEngine.getCurrentTime());
            }, 50); // Smoother updates
        }
        return () => clearInterval(interval);
    }, [isPlaying]);

    useEffect(() => {
        if (clips.length === 0) {
            audioEngine.clearAll();
        }
    }, [clips.length]);

    const addTrack = () => {
        setTracks(prev => [...prev, {
            id: `track-${prev.length + 1}`,
            name: `Track ${prev.length + 1}`,
            isMuted: false,
            isSoloed: false,
            volume: 1
        }]);
    };

    const addToLibrary = (item: LibraryItem) => {
        setLibrary(prev => {
            if (prev.find(existing => existing.id === item.id)) return prev;
            return [item, ...prev];
        });
    };

    useEffect(() => {
        if (!userId) return;
        let isMounted = true;
        (async () => {
            const { data: stemsData, error: stemsError } = await supabase
                .from('stems')
                .select('id, project_id, name, stem_type, url, duration, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (stemsError) {
                console.error('Failed to load stems', stemsError);
                return;
            }

            const { data: segmentData, error: segmentsError } = await supabase
                .from('stem_segments')
                .select('id, name, stem_id, start_time, end_time, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (segmentsError) {
                console.error('Failed to load stem segments', segmentsError);
            }

            if (!isMounted || !stemsData) return;

            setLibrary(buildLibraryItems(stemsData, segmentData ?? []));
        })();
        return () => {
            isMounted = false;
        };
    }, [userId]);

    const ensureClipDuration = async (clip: Clip) => {
        if (clip.isSegment) return;
        try {
            const actualDuration = await loadAudioDuration(clip.audioUrl);
            if (!actualDuration || Math.abs(actualDuration - clip.duration) < 0.05) return;
            setClips(prev => prev.map(c => c.id === clip.id ? { ...c, duration: actualDuration } : c));
            audioEngine.updateClip(clip.id, { duration: actualDuration });
        } catch (err) {
            console.warn('Unable to read stem duration', err);
        }
    };

    const addClip = (clip: Clip) => {
        setClips(prev => [...prev, clip]);
        audioEngine
            .addClip(clip)
            .then(() => {
                if (!clip.isSegment) {
                    ensureClipDuration(clip);
                }
            })
            .catch(err => console.error('Failed to initialize clip audio', err));
    };

    const updateClip = (id: string, updates: Partial<Clip>) => {
        setClips(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        audioEngine.updateClip(id, updates);
        refreshPlayback();
    };

    const removeClip = (id: string) => {
        setClips(prev => prev.filter(c => c.id !== id));
        audioEngine.removeClip(id);
        setSelectedClipId(current => (current === id ? null : current));
    };

    const updateSegmentMetadata = (componentId: string, startOffset: number, duration: number) => {
        setLibrary(prev => prev.map(item => item.id === componentId
            ? { ...item, startOffset, endOffset: startOffset + duration, duration }
            : item
        ));
    };

    const resizeClip = (id: string, updates: { startTime?: number; duration?: number; offset?: number }) => {
        const clip = clips.find(c => c.id === id);
        if (!clip) return;

        const newStart = Math.max(0, updates.startTime ?? clip.startTime);
        const newDuration = Math.max(0.05, Math.min(updates.duration ?? clip.duration, duration - newStart));
        const newOffset = Math.max(0, updates.offset ?? clip.offset);
        const newName = createSegmentName(clip.baseName, newOffset, newOffset + newDuration, true);

        setClips(prev => prev.map(c => c.id === id ? {
            ...c,
            startTime: newStart,
            duration: newDuration,
            offset: newOffset,
            name: newName
        } : c));

        audioEngine.updateClip(id, {
            startTime: newStart,
            duration: newDuration,
            offset: newOffset
        });

        if (clip.componentId) {
            updateSegmentMetadata(clip.componentId, newOffset, newDuration);
            supabase.from('stem_segments')
                .update({
                    start_time: newOffset,
                    end_time: newOffset + newDuration
                })
                .eq('id', clip.componentId);
        }
        refreshPlayback();
    };

    const persistClipSegment = async (clip: Clip) => {
        if (!clip.stemId || !userId) return;

        try {
            const baseName = clip.baseName || clip.name;
            const { data, error } = await supabase
                .from('stem_segments')
                .insert({
                    stem_id: clip.stemId,
                    user_id: userId,
                    name: clip.name,
                    start_time: clip.offset,
                    end_time: clip.offset + clip.duration
                })
                .select('id, name, start_time, end_time')
                .single();

            if (error || !data) {
                throw error;
            }

            const start = data.start_time ?? clip.offset;
            const end = data.end_time ?? (clip.offset + clip.duration);
            const newItem: LibraryItem = {
                id: data.id,
                componentId: data.id,
                stemId: clip.stemId,
                name: data.name,
                url: clip.audioUrl,
                type: clip.stemType,
                duration: end - start,
                startOffset: start,
                endOffset: end,
                isSegment: true,
                sourceName: baseName
            };

            addSegmentToLibraryState(newItem);

            setClips(prev => prev.map(c => c.id === clip.id ? { ...c, componentId: data.id, isSegment: true } : c));
        } catch (err) {
            console.error('Failed to persist segment', err);
        }
    };

    const splitClip = (id: string, splitTime: number) => {
        const clip = clips.find(c => c.id === id);
        if (!clip) return;

        // Ensure split time is within clip bounds
        if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return;

        if (clip.componentId) {
            removeLibraryComponent(clip.componentId);
            deleteSegmentRecord(clip.componentId);
        }

        const relativeSplit = splitTime - clip.startTime;
        const baseName = clip.baseName || clip.name;
        const firstDuration = relativeSplit;
        const secondDuration = clip.duration - relativeSplit;

        // Create two new clips
        const clip1: Clip = {
            ...clip,
            id: crypto.randomUUID(),
            duration: firstDuration,
            name: buildClipName(baseName, clip.offset, firstDuration, true),
            isSegment: true,
            componentId: undefined
        };

        const clip2Offset = clip.offset + relativeSplit;
        const clip2: Clip = {
            ...clip,
            id: crypto.randomUUID(),
            startTime: splitTime,
            offset: clip2Offset,
            duration: secondDuration,
            name: buildClipName(baseName, clip2Offset, secondDuration, true),
            isSegment: true,
            componentId: undefined
        };

        // Remove old clip and add new ones
        removeClip(id);
        addClip(clip1);
        addClip(clip2);

        persistClipSegment(clip1);
        persistClipSegment(clip2);
    };

    const seek = (time: number, options: { autoResume?: boolean } = {}) => {
        setCurrentTime(time);
        audioEngine.seek(time);
        const shouldResume = options.autoResume ?? isPlaying;
        if (shouldResume) {
            audioEngine.play();
        }
    };

    return (
        <ProjectContext.Provider value={{
            tracks,
            clips,
            library,
            addTrack,
            addToLibrary,
            removeLibraryItem,
            renameLibraryItem,
            addClip,
            updateClip,
            resizeClip,
            removeClip,
            splitClip,
            isPlaying,
            setIsPlaying,
            currentTime,
            seek,
            duration,
            zoom,
            setZoom,
            tool,
            setTool,
            selectedClipId,
            setSelectedClipId,
            snapEnabled,
            toggleSnap: () => setSnapEnabled(prev => !prev)
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) throw new Error('useProject must be used within ProjectProvider');
    return context;
};
