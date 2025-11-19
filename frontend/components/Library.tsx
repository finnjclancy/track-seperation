import React, { useState } from 'react';
import { useProject, LibraryItem } from '@/context/ProjectContext';
import { useDraggable } from '@dnd-kit/core';
import { Music, Mic2, Drum, Guitar, Disc, Scissors, Trash2, Pencil } from 'lucide-react';
import { describeSegment } from '@/lib/time';

function DraggableLibraryItem({
    item,
    onRemove,
    onRename
}: {
    item: LibraryItem,
    onRemove: (item: LibraryItem) => void,
    onRename?: (item: LibraryItem) => void
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `lib-${item.id}`,
        data: { type: 'library-item', item }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
        opacity: 0.8
    } : undefined;

    const getIcon = () => {
        switch (item.type) {
            case 'vocals': return <Mic2 size={16} className="text-pink-400" />;
            case 'drums': return <Drum size={16} className="text-blue-400" />;
            case 'bass': return <Guitar size={16} className="text-yellow-400" />;
            default: return <Disc size={16} className="text-purple-400" />;
        }
    };

    const hasSegmentRange = item.startOffset !== undefined && item.endOffset !== undefined;
    const rangeLabel = hasSegmentRange ? describeSegment(item.startOffset!, item.endOffset!) : null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className="flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg cursor-grab active:cursor-grabbing border border-transparent hover:border-zinc-700 transition-all group"
        >
            <div className="p-2 bg-zinc-900 rounded-md group-hover:scale-110 transition-transform">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-200 truncate" title={item.name}>
                    {item.name}
                </div>
                <div className="text-xs text-zinc-500 capitalize flex items-center gap-1">
                    <span>{item.type}</span>
                    {item.isSegment && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 uppercase text-[10px] tracking-wide">
                            <Scissors size={10} /> Cut
                        </span>
                    )}
                </div>
                {rangeLabel && (
                    <div className="text-[11px] text-zinc-500 mt-0.5">{rangeLabel}</div>
                )}
            </div>
            <div className="flex items-center gap-1">
                {item.isSegment && onRename && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRename(item);
                        }}
                        className="p-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                        title="Rename segment"
                    >
                        <Pencil size={14} />
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item);
                    }}
                    className="p-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors"
                    title="Remove from library"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

export function Library() {
    const { library, removeLibraryItem, renameLibraryItem } = useProject();
    const [confirmingItem, setConfirmingItem] = useState<LibraryItem | null>(null);
    const [renamingItem, setRenamingItem] = useState<LibraryItem | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const confirmDelete = async () => {
        if (!confirmingItem) return;
        await removeLibraryItem(confirmingItem.id);
        setConfirmingItem(null);
    };

    const confirmRename = async () => {
        if (!renamingItem || !renameValue.trim()) return;
        await renameLibraryItem(renamingItem.id, renameValue.trim());
        setRenamingItem(null);
        setRenameValue('');
    };
    
    const originalStems = library.filter(item => !item.isSegment);
    const choppedStems = library.filter(item => item.isSegment);
    
    return (
        <div className="relative w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-zinc-800">
                <h2 className="font-bold text-zinc-100 flex items-center gap-2">
                    <Music size={18} className="text-indigo-500" />
                    Library
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Drag stems to timeline</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-6">
                {library.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-600">
                            <Music size={24} />
                        </div>
                        <p className="text-zinc-500 text-sm">No stems yet.</p>
                        <p className="text-zinc-600 text-xs mt-1">Import a song to get started.</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 text-right mb-2">
                                Original Stems ({originalStems.length})
                            </div>
                            <div className="space-y-2">
                                {originalStems.map(item => (
                                    <DraggableLibraryItem
                                        key={item.id}
                                        item={item}
                                        onRemove={setConfirmingItem}
                                    />
                                ))}
                                {originalStems.length === 0 && (
                                    <div className="text-xs text-zinc-500 bg-zinc-800/40 border border-dashed border-zinc-700 rounded-lg px-3 py-4 text-center">
                                        No original stems yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
                                Chopped Segments ({choppedStems.length})
                            </div>
                            <div className="space-y-2">
                                {choppedStems.map(item => (
                                    <DraggableLibraryItem
                                        key={item.id}
                                        item={item}
                                        onRemove={setConfirmingItem}
                                        onRename={(current) => {
                                            setRenamingItem(current);
                                            setRenameValue(current.name);
                                        }}
                                    />
                                ))}
                                {choppedStems.length === 0 && (
                                    <div className="text-xs text-zinc-500 bg-zinc-800/40 border border-dashed border-zinc-700 rounded-lg px-3 py-4 text-center">
                                        Cuts will appear here after you split stems.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {confirmingItem && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                        <div>
                            <div className="text-sm uppercase tracking-widest text-zinc-500">Delete Stem</div>
                            <div className="text-lg font-semibold text-white mt-1">{confirmingItem.name}</div>
                            <div className="text-xs text-zinc-400 mt-2">
                                {confirmingItem.isSegment
                                    ? 'This will remove the saved cut segment from your library.'
                                    : 'This will remove the original stem from your library.'}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                                onClick={() => setConfirmingItem(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
                                onClick={confirmDelete}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {renamingItem && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
                        <div>
                            <div className="text-sm uppercase tracking-widest text-zinc-500">Rename Segment</div>
                            <div className="text-xs text-zinc-400 mt-1">
                                Give this cut a more descriptive name so you can find it later.
                            </div>
                        </div>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                            placeholder="Enter a name"
                            autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white"
                                onClick={() => {
                                    setRenamingItem(null);
                                    setRenameValue('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={confirmRename}
                                disabled={!renameValue.trim()}
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
