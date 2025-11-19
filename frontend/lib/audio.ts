import * as Tone from 'tone';
import { Clip } from '@/context/ProjectContext';

class AudioEngine {
    private players: Map<string, Tone.Player> = new Map();
    private channels: Map<string, Tone.Channel> = new Map();
    private mainBus: Tone.Channel | null = null;
    private isInitialized: boolean = false;
    private pausedPosition: number = 0;
    private lastSeek: number = 0;
    
    // Store clip data to allow rescheduling
    private clipData: Map<string, Clip> = new Map();

    constructor() {
        if (typeof window !== 'undefined') {
            this.mainBus = new Tone.Channel(0, 0).toDestination();
        }
    }

    async init() {
        if (this.isInitialized || typeof window === 'undefined') return;
        await Tone.start();
        this.isInitialized = true;
    }

    async addClip(clip: Clip) {
        if (typeof window === 'undefined' || !this.mainBus) return;
        await this.init();

        // Store clip data for later updates
        this.clipData.set(clip.id, clip);

        const player = new Tone.Player({
            url: clip.audioUrl,
            autostart: false,
            loop: false
        }).sync();
        const channel = new Tone.Channel(0, 0).connect(this.mainBus);
        player.connect(channel);

        await Tone.loaded();

        // Clip might have been removed while we were loading
        if (!this.clipData.has(clip.id)) {
            player.dispose();
            channel.dispose();
            return;
        }

        player.playbackRate = clip.speed;
        player.detune = clip.pitch * 100;
        channel.volume.value = Tone.gainToDb(clip.volume);

        this.players.set(clip.id, player);
        this.channels.set(clip.id, channel);

        this.scheduleClipPlayback(
            clip,
            player,
            this.getReferencePosition()
        );
    }

    private scheduleClipPlayback(clip: Clip, player: Tone.Player, position: number) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        this.stopPlayer(player);
        player.unsync();
        player.sync();

        if (clipEnd <= position) {
            return;
        }

        if (position >= clipStart) {
            const elapsed = position - clipStart;
            const remaining = Math.max(0, clip.duration - elapsed);
            if (remaining <= 0) return;
            player.start(position, clip.offset + elapsed, remaining);
        } else {
            player.start(clipStart, clip.offset, clip.duration);
        }
    }

    removeClip(id: string) {
        const player = this.players.get(id);
        const channel = this.channels.get(id);
        
        if (player) {
            player.unsync();
            this.stopPlayer(player);
            player.dispose();
            this.players.delete(id);
        }
        if (channel) {
            channel.dispose();
            this.channels.delete(id);
        }
        this.clipData.delete(id);
    }

    updateClip(id: string, updates: Partial<Clip>) {
        const player = this.players.get(id);
        const channel = this.channels.get(id);
        const currentClip = this.clipData.get(id);
        
        if (!player || !channel || !currentClip) return;

        const newClip = { ...currentClip, ...updates };
        this.clipData.set(id, newClip);

        if (updates.volume !== undefined) channel.volume.value = Tone.gainToDb(updates.volume);
        if (updates.speed !== undefined) player.playbackRate = updates.speed;
        if (updates.pitch !== undefined) player.detune = updates.pitch * 100;
        
        this.scheduleClipPlayback(newClip, player, this.getReferencePosition());
    }

    private rescheduleAll(position: number) {
        if (typeof window === 'undefined') return;
        this.clipData.forEach((clip, id) => {
            const player = this.players.get(id);
            if (!player) return;
            this.scheduleClipPlayback(clip, player, position);
        });
    }

    private getReferencePosition() {
        if (typeof window === 'undefined') return this.pausedPosition;
        return Tone.Transport.state === 'started'
            ? Tone.Transport.seconds
            : this.pausedPosition;
    }

    play() {
        if (typeof window === 'undefined') return;
        const startPosition = this.pausedPosition;
        this.rescheduleAll(startPosition);
        Tone.Transport.stop();
        Tone.Transport.start(undefined, startPosition);
    }

    pause() {
        if (typeof window === 'undefined') return;
        this.pausedPosition = Tone.Transport.seconds;
        this.players.forEach(player => player.unsync());
        Tone.Transport.pause();
        this.players.forEach(player => this.stopPlayer(player));
    }

    stop() {
        if (typeof window === 'undefined') return;
        this.players.forEach(player => player.unsync());
        Tone.Transport.stop();
        this.pausedPosition = 0;
        this.players.forEach(player => this.stopPlayer(player));
        this.rescheduleAll(0);
    }

    seek(time: number) {
        if (typeof window === 'undefined') return;
        this.pausedPosition = time;
        this.lastSeek = time;
        Tone.Transport.stop();
        Tone.Transport.seconds = time;
        this.rescheduleAll(time);
    }

    getCurrentTime() {
        if (typeof window === 'undefined') return 0;
        return Tone.Transport.seconds;
    }

    clearAll() {
        this.players.forEach(player => {
            player.unsync();
            this.stopPlayer(player);
            player.dispose();
        });
        this.channels.forEach(channel => channel.dispose());
        this.players.clear();
        this.channels.clear();
        this.clipData.clear();
        this.pausedPosition = 0;
        this.lastSeek = 0;
        if (typeof window !== 'undefined') {
            Tone.Transport.cancel();
        }
    }

    private stopPlayer(player: Tone.Player) {
        if (player.state === 'started') {
            try {
                player.stop();
            } catch (err) {
                console.warn('Unable to stop player', err);
            }
        }
    }
}

export const audioEngine = new AudioEngine();
