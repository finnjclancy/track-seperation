import * as Tone from 'tone';
import { Clip } from '@/context/ProjectContext';

class AudioEngine {
    private players: Map<string, Tone.Player> = new Map();
    private channels: Map<string, Tone.Channel> = new Map();
    private mainBus: Tone.Channel | null = null;
    private isInitialized: boolean = false;
    
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

        // Store clip data
        this.clipData.set(clip.id, clip);

        // Create player
        const player = new Tone.Player({
            url: clip.audioUrl,
            loop: false,
            autostart: false
        }).sync();
        const channel = new Tone.Channel(0, 0).connect(this.mainBus);
        player.connect(channel);

        // Schedule
        this.schedulePlayer(player, clip);
        
        // Set params
        player.playbackRate = clip.speed;
        player.detune = clip.pitch * 100;
        channel.volume.value = Tone.gainToDb(clip.volume);

        this.players.set(clip.id, player);
        this.channels.set(clip.id, channel);

        await Tone.loaded();
    }

    private schedulePlayer(player: Tone.Player, clip: Clip) {
        // Stop any previous scheduling before resyncing
        player.stop();
        player.unsync();

        player.sync();
        player.start(clip.startTime, clip.offset, clip.duration);
    }

    removeClip(id: string) {
        const player = this.players.get(id);
        const channel = this.channels.get(id);
        
        if (player) {
            player.stop();
            player.unsync();
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

        // Update stored data
        const newClip = { ...currentClip, ...updates };
        this.clipData.set(id, newClip);

        // Update Audio Params
        if (updates.volume !== undefined) channel.volume.value = Tone.gainToDb(updates.volume);
        if (updates.speed !== undefined) player.playbackRate = updates.speed;
        if (updates.pitch !== undefined) player.detune = updates.pitch * 100;
        
        // Reschedule if timing changed
        if (updates.startTime !== undefined || updates.offset !== undefined || updates.duration !== undefined) {
            this.schedulePlayer(player, newClip);
        }
    }

    play() {
        if (typeof window === 'undefined') return;
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    pause() {
        if (typeof window === 'undefined') return;
        Tone.Transport.pause();
    }

    stop() {
        if (typeof window === 'undefined') return;
        Tone.Transport.stop();
    }

    seek(time: number) {
        if (typeof window === 'undefined') return;
        Tone.Transport.seconds = time;
    }
    
    getCurrentTime() {
        if (typeof window === 'undefined') return 0;
        return Tone.Transport.seconds;
    }

}

export const audioEngine = new AudioEngine();
