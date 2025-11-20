export type StemKind = 'vocals' | 'drums' | 'bass' | 'other';

type StemAppearance = {
    timelineBg: string;
    timelineBorder: string;
    timelineHover: string;
    overlayBg: string;
    overlayBorder: string;
    icon: string;
};

const STEM_COLORS: Record<StemKind, StemAppearance> = {
    vocals: {
        timelineBg: 'bg-purple-600/80',
        timelineBorder: 'border-purple-400',
        timelineHover: 'hover:bg-purple-500/90',
        overlayBg: 'bg-purple-600/90',
        overlayBorder: 'border-purple-400',
        icon: 'text-purple-400'
    },
    drums: {
        timelineBg: 'bg-sky-600/80',
        timelineBorder: 'border-sky-400',
        timelineHover: 'hover:bg-sky-500/90',
        overlayBg: 'bg-sky-600/90',
        overlayBorder: 'border-sky-400',
        icon: 'text-sky-400'
    },
    bass: {
        timelineBg: 'bg-amber-500/80',
        timelineBorder: 'border-amber-300',
        timelineHover: 'hover:bg-amber-500/90',
        overlayBg: 'bg-amber-500/90',
        overlayBorder: 'border-amber-300',
        icon: 'text-amber-400'
    },
    other: {
        timelineBg: 'bg-rose-500/80',
        timelineBorder: 'border-rose-300',
        timelineHover: 'hover:bg-rose-500/90',
        overlayBg: 'bg-rose-500/90',
        overlayBorder: 'border-rose-300',
        icon: 'text-rose-400'
    }
};

export const getStemAppearance = (stemType: StemKind | undefined) => {
    if (!stemType) return STEM_COLORS.other;
    return STEM_COLORS[stemType] ?? STEM_COLORS.other;
};
