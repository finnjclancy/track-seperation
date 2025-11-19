export const formatTimestamp = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60)
        .toString()
        .padStart(2, '0');
    return `${minutes}:${secs}`;
};

export const formatTimestampDetailed = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60)
        .toString()
        .padStart(2, '0');
    const millis = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 1000)
        .toString()
        .padStart(3, '0');
    return `${minutes}:${secs}.${millis}`;
};

export const describeSegment = (start: number, end: number) => {
    return `${formatTimestampDetailed(start)} - ${formatTimestampDetailed(end)}`;
};

export const createSegmentName = (
    baseName: string,
    start: number,
    end: number,
    force = false
) => {
    if (!force && start <= 0) {
        return baseName;
    }
    const range = describeSegment(start, end);
    return `${baseName} [${range}]`;
};
