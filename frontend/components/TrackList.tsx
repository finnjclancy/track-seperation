import React from 'react';
import { useProject } from '@/context/ProjectContext';
import { TrackControls } from './TrackControls';

export function TrackList() {
    const { tracks } = useProject();

    if (tracks.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-zinc-500">
                Import a song to get started
            </div>
        );
    }

    return (
        <div className="p-8 pb-32 overflow-y-auto h-full">
            {tracks.map(track => (
                <TrackControls key={track.id} track={track} />
            ))}
        </div>
    );
}

