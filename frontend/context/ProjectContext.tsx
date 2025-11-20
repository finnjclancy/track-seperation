"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

const trackIdToIndex = (trackId: string) => {
    const match = trackId?.match(/track-(\d+)/);
    if (!match) return 0;
    const parsed = parseInt(match[1], 10);
    return Number.isNaN(parsed) ? 0 : Math.max(0, parsed - 1);
};

const trackIndexToId = (index: number) => `track-${index + 1}`;

type CopiableClipData = {
    audioUrl: string;
    baseName: string;
    stemId: string;
    stemType: LibraryItem['type'];
    offset: number;
    duration: number;
    volume: number;
    pitch: number;
    speed: number;
    sourceDuration?: number | null;
    isSegment?: boolean;
};

type CopiedClipGroup = {
    baseTrackIndex: number;
    items: Array<{
        relativeStart: number;
        trackOffset: number;
        data: CopiableClipData;
    }>;
};

type StemRow = {
    id: string;
    project_id: string | null;
    name: string;
    stem_type: string;
    url: string;
    duration: number | null;
    created_at: string;
    video_id?: string | null;
    user_id?: string | null;
    project_stem_id?: string;
};

type ProjectStemRow = {
    id: string;
    project_id: string;
    stem_id: string;
    user_id: string;
    created_at: string;
    stems: StemRow | null;
};

type SegmentRow = {
    id: string;
    stem_id: string;
    user_id: string;
    project_id: string;
    name: string;
    start_time: number | null;
    end_time: number | null;
    created_at: string;
};

type ProjectClipRow = {
    id: string;
    stem_id: string;
    stem_segment_id: string | null;
    track_index: number | null;
    start_time: number | null;
    source_offset: number | null;
    duration: number | null;
    volume: number | null;
    pitch: number | null;
    speed: number | null;
    name: string | null;
    base_name: string | null;
    stems: StemRow | null;
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
        sourceName: parentStem.name,
        videoId: parentStem.video_id ?? null,
        sourceDuration: parentStem.duration,
        projectId: segment.project_id
    };
};

const buildLibraryItems = (projectStems: ProjectStemRow[], segments: SegmentRow[]): LibraryItem[] => {
    const stemsMap = new Map<string, StemRow>();
    projectStems.forEach(entry => {
        if (!entry.stems) return;
        stemsMap.set(entry.stem_id, {
            ...entry.stems,
            project_stem_id: entry.id,
            project_id: entry.project_id
        });
    });

    const items: LibraryItem[] = [];
    stemsMap.forEach(stem => {
        items.push({
            id: stem.project_stem_id ?? stem.id,
            projectStemId: stem.project_stem_id ?? undefined,
            stemId: stem.id,
            name: stem.name,
            url: stem.url,
            type: (stem.stem_type as LibraryItem['type']) ?? 'other',
            duration: stem.duration,
            sourceName: stem.name,
            videoId: stem.video_id ?? null,
            sourceDuration: stem.duration,
            projectId: stem.project_id ?? undefined
        });
    });

    segments.forEach(segment => {
        const parentStem = stemsMap.get(segment.stem_id);
        if (!parentStem) return;
        items.push(createSegmentLibraryItem(segment, parentStem));
    });

    return items;
};

const buildGlobalLibraryItems = (stems: (StemRow & { user_id: string | null })[], currentUserId: string): LibraryItem[] => {
    const seen = new Map<string, LibraryItem>();
    stems.forEach(stem => {
        const key = `${stem.video_id || stem.url}-${stem.stem_type}`;
        if (seen.has(key)) return;
        const isUserStem = stem.user_id === currentUserId;
        seen.set(key, {
            id: stem.id,
            stemId: stem.id,
            name: stem.name,
            url: stem.url,
            type: (stem.stem_type as LibraryItem['type']) ?? 'other',
            duration: stem.duration,
            sourceName: stem.name,
            videoId: stem.video_id ?? null,
            isShared: !isUserStem,
            sourceDuration: stem.duration
        });
    });
    return Array.from(seen.values());
};

export interface LibraryItem {
    id: string;
    stemId: string;
    projectStemId?: string;
    name: string;
    url: string;
    type: 'vocals' | 'drums' | 'bass' | 'other';
    duration?: number | null;
    startOffset?: number;
    endOffset?: number;
    isSegment?: boolean;
    componentId?: string;
    sourceName?: string;
    videoId?: string | null;
    isShared?: boolean;
    sourceDuration?: number | null;
    projectId?: string;
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
    projectClipId?: string;
    startTime: number; // Where it starts on the timeline (seconds)
    offset: number; // Where the audio starts within the file (seconds)
    duration: number; // How long the clip is (seconds)
    volume: number;
    pitch: number;
    speed: number;
    sourceDuration?: number | null;
}

export interface Track {
    id: string;
    name: string;
    isMuted: boolean;
    isSoloed: boolean;
    volume: number;
}

interface ProjectContextType {
    projectId: string;
    tracks: Track[];
    clips: Clip[];
    library: LibraryItem[];
    globalLibrary: LibraryItem[];
    addTrack: () => void;
    addToLibrary: (item: LibraryItem) => void;
    removeLibraryItem: (itemId: string) => Promise<void>;
    renameLibraryItem: (itemId: string, newName: string) => Promise<void>;
    addGlobalStemToLibrary: (item: LibraryItem) => Promise<void>;
    addClip: (clip: Clip, options?: { persist?: boolean }) => void;
    updateClip: (id: string, updates: Partial<Clip>) => void;
    removeClip: (id: string) => void;
    resizeClip: (id: string, updates: { startTime?: number; duration?: number; offset?: number }) => void;
    splitClip: (id: string, splitTime: number) => void;
    copyClip: (id: string) => void;
    pasteClip: (trackId?: string, startTime?: number) => void;
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
    selectedClipIds: string[];
    setSelectedClipId: (id: string | null) => void;
    selectClip: (id: string, additive?: boolean) => void;
    toggleClipSelection: (id: string) => void;
    clearClipSelection: () => void;
    snapEnabled: boolean;
    toggleSnap: () => void;
    activeTrackId: string;
    setActiveTrackId: (id: string) => void;
    isSyncing: boolean;
    setClipSelectionDirect: (ids: string[]) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

type ProjectProviderProps = {
    userId: string;
    projectId: string;
    children: React.ReactNode;
};

export function ProjectProvider({ children, userId, projectId }: ProjectProviderProps) {
    const [tracks, setTracks] = useState<Track[]>([
        { id: 'track-1', name: 'Track 1', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-2', name: 'Track 2', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-3', name: 'Track 3', isMuted: false, isSoloed: false, volume: 1 },
        { id: 'track-4', name: 'Track 4', isMuted: false, isSoloed: false, volume: 1 },
    ]);
    const [clips, setClips] = useState<Clip[]>([]);
    const [library, setLibrary] = useState<LibraryItem[]>([]);
    const [globalLibrary, setGlobalLibrary] = useState<LibraryItem[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration] = useState(300); // Default 5 mins
    const [zoom, setZoom] = useState(50); // 50px = 1 second
    const [tool, setTool] = useState<'pointer' | 'split'>('pointer');
    const [clipSelection, setClipSelection] = useState<string[]>([]);
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [activeTrackId, setActiveTrackId] = useState<string>('track-1');
    const [copiedGroup, setCopiedGroup] = useState<CopiedClipGroup | null>(null);

    const ensureTrackCount = useCallback((count: number) => {
        setTracks(prev => {
            if (prev.length >= count) return prev;
            const nextTracks = [...prev];
            while (nextTracks.length < count) {
                const index = nextTracks.length;
                nextTracks.push({
                    id: trackIndexToId(index),
                    name: `Track ${index + 1}`,
                    isMuted: false,
                    isSoloed: false,
                    volume: 1
                });
            }
            return nextTracks;
        });
    }, []);

    const [pendingSaveCount, setPendingSaveCount] = useState(0);
    const isSyncing = pendingSaveCount > 0;

    const withSaveTracking = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
        setPendingSaveCount(count => count + 1);
        try {
            return await operation();
        } catch (error) {
            throw error;
        } finally {
            setPendingSaveCount(count => Math.max(0, count - 1));
        }
    };

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
        audioEngine.seek(position, true);
        setCurrentTime(position);
    };

    const buildClipPayload = (clip: Clip) => ({
        id: clip.projectClipId,
        project_id: projectId,
        user_id: userId,
        stem_id: clip.stemId,
        stem_segment_id: clip.componentId ?? null,
        track_index: trackIdToIndex(clip.trackId),
        start_time: clip.startTime,
        source_offset: clip.offset,
        duration: clip.duration,
        volume: clip.volume,
        pitch: clip.pitch,
        speed: clip.speed,
        name: clip.name,
        base_name: clip.baseName
    });

    const saveClipRecord = async (clip: Clip) => {
        if (!projectId || !userId || !clip.projectClipId) return;
        try {
            await withSaveTracking(() =>
                supabase
                    .from('project_clips')
                    .upsert(buildClipPayload(clip), { onConflict: 'id' })
            );
        } catch (err) {
            console.error('Failed to save clip placement', err);
        }
    };

    const syncClipRecord = async (clip: Clip) => {
        await saveClipRecord(clip);
    };

    const deleteClipRecord = async (clip: Clip | undefined) => {
        if (!clip?.projectClipId || !userId) return;
        try {
            await withSaveTracking(() =>
                supabase
                    .from('project_clips')
                    .delete()
                    .eq('id', clip.projectClipId)
                    .eq('user_id', userId)
            );
        } catch (err) {
            console.error('Failed to delete clip placement', err);
        }
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
                .eq('id', segmentId)
                .eq('project_id', projectId);
        } catch (err) {
            console.error('Failed to delete segment', err);
        }
    };

    const selectedClipId = clipSelection[0] ?? null;
    const selectedClipIds = clipSelection;

    const selectClip = (id: string, additive: boolean = false) => {
        setClipSelection(prev => {
            if (additive) {
                if (prev.includes(id)) return prev;
                return [...prev, id];
            }
            return [id];
        });
    };

    const toggleClipSelection = (id: string) => {
        setClipSelection(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    };

    const clearClipSelection = () => setClipSelection([]);

    const setClipSelectionDirect = (ids: string[]) => {
        setClipSelection(Array.from(new Set(ids)));
    };

    const setSelectedClipId = (id: string | null) => {
        if (!id) {
            clearClipSelection();
        } else {
            selectClip(id);
        }
    };

    const removeLibraryItem = async (itemId: string) => {
        const item = library.find(entry => entry.id === itemId);
        if (!item) return;

        if (item.isSegment) {
            setLibrary(prev => prev.filter(entry => entry.id !== itemId));
        } else {
            setLibrary(prev => prev.filter(entry => entry.isSegment ? entry.stemId !== item.stemId : entry.id !== itemId));
        }
        setClips(prev => prev.filter(clip => item.isSegment ? clip.componentId !== itemId : clip.stemId !== item.stemId));

        try {
            if (item.isSegment) {
                await supabase.from('stem_segments')
                    .delete()
                    .eq('id', itemId)
                    .eq('project_id', projectId);
                await supabase
                    .from('project_clips')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('user_id', userId)
                    .eq('stem_segment_id', itemId);
            } else {
                const membershipId = item.projectStemId ?? item.id;
                await supabase
                    .from('project_stems')
                    .delete()
                    .eq('id', membershipId)
                    .eq('project_id', projectId);
                await supabase
                    .from('stem_segments')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('stem_id', item.stemId);
                await supabase
                    .from('project_clips')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('user_id', userId)
                    .eq('stem_id', item.stemId);
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
                    .eq('id', itemId)
                    .eq('project_id', projectId);
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
        return () => {
            audioEngine.stop();
            setIsPlaying(false);
            setCurrentTime(0);
        };
    }, []);

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

    const addGlobalStemToLibrary = async (item: LibraryItem) => {
        if (!userId || !projectId) return;
        const alreadyHave = library.some(existing => !existing.isSegment && existing.stemId === item.stemId);
        if (alreadyHave) return;
        try {
            const { data, error } = await supabase
                .from('project_stems')
                .insert({
                    project_id: projectId,
                    stem_id: item.stemId,
                    user_id: userId,
                })
                .select('id, project_id, stem_id, stems:stem_id (id, name, stem_type, url, duration, video_id)')
                .single();
            if (error || !data) throw error;

            if (data.stems) {
                addToLibrary({
                    id: data.id,
                    projectStemId: data.id,
                    stemId: data.stem_id,
                    name: data.stems.name,
                    url: data.stems.url,
                    type: (data.stems.stem_type as LibraryItem['type']) ?? 'other',
                    duration: data.stems.duration,
                    sourceName: data.stems.name,
                    videoId: data.stems.video_id ?? null,
                    sourceDuration: data.stems.duration,
                    projectId: data.project_id
                });
            }
        } catch (err) {
            console.error('Failed to add global stem', err);
        }
    };

    const ensureClipMetadata = useCallback(async (clip: Clip) => {
        try {
            const actualDuration = await loadAudioDuration(clip.audioUrl);
            if (!actualDuration) return;

            let shouldUpdateEngine = false;
            setClips(prev => prev.map(c => {
                if (c.id !== clip.id) return c;
                const updates: Partial<Clip> = {};
                if (!c.isSegment && Math.abs(actualDuration - c.duration) > 0.05) {
                    updates.duration = actualDuration;
                    shouldUpdateEngine = true;
                }
                if (!c.sourceDuration || Math.abs((c.sourceDuration ?? 0) - actualDuration) > 0.05) {
                    updates.sourceDuration = actualDuration;
                }
                return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
            }));

            if (shouldUpdateEngine) {
                audioEngine.updateClip(clip.id, { duration: actualDuration });
            }
        } catch (err) {
            console.warn('Unable to read stem metadata', err);
        }
    }, []);

    useEffect(() => {
        if (!userId || !projectId) return;
        let isMounted = true;
        (async () => {
            const { data: projectStemsData, error: projectStemError } = await supabase
                .from('project_stems')
                .select('id, project_id, stem_id, user_id, created_at, stems:stem_id (id, project_id, name, stem_type, url, duration, created_at, video_id, user_id)')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (projectStemError) {
                console.error('Failed to load project stems', projectStemError);
                return;
            }

            const { data: segmentData, error: segmentsError } = await supabase
                .from('stem_segments')
                .select('id, name, stem_id, project_id, start_time, end_time, created_at')
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });
            if (segmentsError) {
                console.error('Failed to load stem segments', segmentsError);
            }

            const { data: globalStemsData, error: globalError } = await supabase
                .from('stems')
                .select('id, project_id, name, stem_type, url, duration, created_at, video_id, user_id')
                .order('created_at', { ascending: false });
            if (globalError) {
                console.error('Failed to load global stems', globalError);
            }

            const { data: projectClipsData, error: clipsError } = await supabase
                .from('project_clips')
                .select('id, stem_id, stem_segment_id, track_index, start_time, source_offset, duration, volume, pitch, speed, name, base_name, stems:stem_id (id, name, stem_type, url, duration, video_id)')
                .eq('project_id', projectId)
                .eq('user_id', userId)
                .order('created_at', { ascending: true });
            if (clipsError) {
                console.error('Failed to load project clips', clipsError);
            }

            if (!isMounted) return;

            setLibrary(buildLibraryItems(projectStemsData ?? [], segmentData ?? []));
            setGlobalLibrary(buildGlobalLibraryItems(globalStemsData ?? [], userId));

            const clipRows = (projectClipsData ?? []).filter(row => row.stems) as ProjectClipRow[];
            const requiredTracks = clipRows.reduce((max, row) => Math.max(max, (row.track_index ?? 0) + 1), 0);
            ensureTrackCount(Math.max(4, requiredTracks));

            const loadedClips: Clip[] = clipRows.map(row => {
                const stem = row.stems!;
                const baseName = row.base_name || stem.name;
                const offset = row.source_offset ?? 0;
                const clipDuration = row.duration ?? stem.duration ?? 0;
                const clipName = row.name ?? createSegmentName(baseName, offset, offset + clipDuration, true);
                return {
                    id: crypto.randomUUID(),
                    projectClipId: row.id,
                    trackId: trackIndexToId(row.track_index ?? 0),
                    audioUrl: stem.url,
                    name: clipName,
                    baseName: baseName,
                    stemId: row.stem_id,
                    stemType: (stem.stem_type as LibraryItem['type']) ?? 'other',
                    componentId: row.stem_segment_id ?? undefined,
                    isSegment: Boolean(row.stem_segment_id),
                    startTime: row.start_time ?? 0,
                    offset,
                    duration: clipDuration,
                    volume: row.volume ?? 0.8,
                    pitch: row.pitch ?? 0,
                    speed: row.speed ?? 1,
                    sourceDuration: stem.duration ?? clipDuration
                };
            });

            setClips(loadedClips);
            audioEngine.clearAll();
            loadedClips.forEach(async (clip) => {
                try {
                    await audioEngine.addClip(clip);
                    if (!clip.isSegment) {
                        ensureClipMetadata(clip);
                    }
                } catch (err) {
                    console.error('Failed to initialize stored clip audio', err);
                }
            });
        })();
        return () => {
            isMounted = false;
        };
    }, [userId, projectId, ensureTrackCount, ensureClipMetadata]);

    const addClip = (clip: Clip, options: { persist?: boolean } = {}) => {
        const originalSourceDuration = clip.sourceDuration;
        const clipRecordId = clip.projectClipId ?? crypto.randomUUID();
        const normalizedClip: Clip = {
            ...clip,
            projectClipId: clipRecordId,
            sourceDuration: clip.sourceDuration ?? clip.duration
        };
        setClips(prev => [...prev, normalizedClip]);
        audioEngine
            .addClip(normalizedClip)
            .then(() => {
                if (!normalizedClip.isSegment || originalSourceDuration == null) {
                    ensureClipMetadata(normalizedClip);
                }
            })
            .catch(err => console.error('Failed to initialize clip audio', err));
        if (options.persist !== false) {
            saveClipRecord(normalizedClip);
        }
    };

    const updateClip = (id: string, updates: Partial<Clip>) => {
        let updatedClip: Clip | null = null;
        setClips(prev => prev.map(c => {
            if (c.id !== id) return c;
            const nextClip = {
                ...c,
                ...updates,
                name: updates.offset !== undefined || updates.duration !== undefined
                    ? createSegmentName(c.baseName, updates.offset ?? c.offset, (updates.offset ?? c.offset) + (updates.duration ?? c.duration), true)
                    : c.name
            };
            updatedClip = nextClip;
            return nextClip;
        }));
        audioEngine.updateClip(id, updates);
        refreshPlayback();
        if (updatedClip) {
            syncClipRecord(updatedClip);
        }
    };

    const removeClip = (id: string) => {
        const clip = clips.find(c => c.id === id);
        setClips(prev => prev.filter(c => c.id !== id));
        audioEngine.removeClip(id);
        setClipSelection(prev => prev.filter(cid => cid !== id));
        deleteClipRecord(clip);
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

        const MIN_DURATION = 0.05;
        const projectLength = duration;
        const sourceLimit = clip.sourceDuration ?? Infinity;

        let newStart = Math.max(0, updates.startTime ?? clip.startTime);
        const latestPossibleStart = Math.max(0, projectLength - MIN_DURATION);
        newStart = Math.min(newStart, latestPossibleStart);

        let newOffset = Math.max(0, updates.offset ?? clip.offset);
        if (Number.isFinite(sourceLimit)) {
            const maxOffset = Math.max(0, sourceLimit - MIN_DURATION);
            newOffset = Math.min(newOffset, maxOffset);
        }

        let newDuration = Math.max(MIN_DURATION, updates.duration ?? clip.duration);
        newDuration = Math.min(newDuration, Math.max(MIN_DURATION, projectLength - newStart));
        if (Number.isFinite(sourceLimit)) {
            const maxDurationFromSource = Math.max(MIN_DURATION, sourceLimit - newOffset);
            newDuration = Math.min(newDuration, maxDurationFromSource);
        }

        // Adjust start again if clipping at end of timeline trimmed the length
        if (newStart + newDuration > projectLength) {
            newStart = Math.max(0, projectLength - newDuration);
        }

        const newName = createSegmentName(clip.baseName, newOffset, newOffset + newDuration, true);

        let updatedClip: Clip | null = null;
        setClips(prev => prev.map(c => c.id === id ? {
            ...c,
            startTime: newStart,
            duration: newDuration,
            offset: newOffset,
            name: newName
        } : c));
        updatedClip = {
            ...(clip as Clip),
            startTime: newStart,
            duration: newDuration,
            offset: newOffset,
            name: newName
        };

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
                .eq('id', clip.componentId)
                .eq('project_id', projectId);
        }
        refreshPlayback();
        if (updatedClip) {
            syncClipRecord(updatedClip);
        }
    };

    const copyClip = () => {
        if (clipSelection.length === 0) return;
        const selectedClips = clips.filter(clip => clipSelection.includes(clip.id));
        if (selectedClips.length === 0) return;
        const sorted = [...selectedClips].sort((a, b) => a.startTime - b.startTime);
        const minStart = sorted[0].startTime;
        const baseTrackIndex = trackIdToIndex(sorted[0].trackId);
        const items = sorted.map(clip => ({
            relativeStart: clip.startTime - minStart,
            trackOffset: trackIdToIndex(clip.trackId) - baseTrackIndex,
            data: {
                audioUrl: clip.audioUrl,
                baseName: clip.baseName,
                stemId: clip.stemId,
                stemType: clip.stemType,
                offset: clip.offset,
                duration: clip.duration,
                volume: clip.volume,
                pitch: clip.pitch,
                speed: clip.speed,
                sourceDuration: clip.sourceDuration,
                isSegment: clip.isSegment
            }
        }));
        setCopiedGroup({ baseTrackIndex, items });
    };

    const pasteClip = (targetTrackId?: string, desiredStart?: number) => {
        if (!copiedGroup || copiedGroup.items.length === 0) return;
        const targetIndex = targetTrackId ? trackIdToIndex(targetTrackId) : copiedGroup.baseTrackIndex;
        const baseTime = desiredStart ?? 0;
        const addedIds: string[] = [];

        copiedGroup.items.forEach(item => {
            const clipData = item.data;
            const trackIndex = Math.max(0, targetIndex + item.trackOffset);
            ensureTrackCount(trackIndex + 1);
            const startTime = Math.max(0, baseTime + item.relativeStart);
            const newClip: Clip = {
                id: crypto.randomUUID(),
                trackId: trackIndexToId(trackIndex),
                audioUrl: clipData.audioUrl,
                name: buildClipName(clipData.baseName, clipData.offset, clipData.offset + clipData.duration, true),
                baseName: clipData.baseName,
                stemId: clipData.stemId,
                stemType: clipData.stemType,
                componentId: undefined,
                isSegment: clipData.isSegment,
                startTime,
                offset: clipData.offset,
                duration: clipData.duration,
                volume: clipData.volume,
                pitch: clipData.pitch,
                speed: clipData.speed,
                sourceDuration: clipData.sourceDuration,
                projectClipId: undefined
            };
            addClip(newClip);
            addedIds.push(newClip.id);
        });
        if (addedIds.length > 0) {
            setClipSelection(addedIds);
        }
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
                    project_id: projectId,
                    name: clip.name,
                    start_time: clip.offset,
                    end_time: clip.offset + clip.duration
                })
                .select('id, name, start_time, end_time, project_id')
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
                sourceName: baseName,
                sourceDuration: clip.sourceDuration,
                projectId: data.project_id
            };

            addSegmentToLibraryState(newItem);

            const updatedClip: Clip = { ...clip, componentId: data.id, isSegment: true };
            setClips(prev => prev.map(c => c.id === clip.id ? updatedClip : c));
            syncClipRecord(updatedClip);
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
            componentId: undefined,
            sourceDuration: clip.sourceDuration,
            projectClipId: undefined
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
            componentId: undefined,
            sourceDuration: clip.sourceDuration,
            projectClipId: undefined
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
        const shouldResume = options.autoResume ?? isPlaying;
        audioEngine.seek(time, shouldResume);
        setIsPlaying(shouldResume);
    };

    return (
        <ProjectContext.Provider value={{
            projectId,
            tracks,
            clips,
            library,
            globalLibrary,
            addTrack,
            addToLibrary,
            removeLibraryItem,
            renameLibraryItem,
            addGlobalStemToLibrary,
            addClip,
            updateClip,
            resizeClip,
            copyClip,
            pasteClip,
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
            selectedClipIds,
            setSelectedClipId,
            selectClip,
            toggleClipSelection,
            clearClipSelection,
            snapEnabled,
            toggleSnap: () => setSnapEnabled(prev => !prev),
            activeTrackId,
            setActiveTrackId,
            isSyncing,
            setClipSelectionDirect
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
