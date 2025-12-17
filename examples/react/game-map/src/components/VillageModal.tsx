import type { MapObject } from "../generateMapObjects";

interface VillageModalProps {
    item: MapObject | null;
    visible: boolean;
    onClose: () => void;
}

export function VillageModal({ item, visible, onClose }: VillageModalProps) {
    if (!visible || !item) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative z-10 w-96 border-2 border-emerald-500/50 bg-zinc-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-6 py-4">
                    <h2 className="text-lg font-bold uppercase tracking-wider text-white">
                        Village Details
                    </h2>
                    <button
                        onClick={onClose}
                        className="
                            flex h-8 w-8 items-center justify-center
                            border border-zinc-600 bg-zinc-700
                            text-zinc-400 transition-all duration-200
                            hover:border-red-500 hover:bg-red-500/20 hover:text-red-400
                            cursor-pointer
                        "
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="square" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Player
                            </span>
                            <span className="text-sm font-semibold text-white">
                                {item.playerName}
                            </span>
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Village Name
                            </span>
                            <span className="text-sm font-semibold text-white">
                                {item.villageName}
                            </span>
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Type
                            </span>
                            <span className="border border-emerald-600 bg-emerald-900/30 px-3 py-1 text-xs font-bold uppercase text-emerald-400">
                                {item.type}
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                Coordinates
                            </span>
                            <span className="border border-zinc-600 bg-zinc-800 px-4 py-1 font-mono text-sm font-bold text-amber-400">
                                {item.x} · {item.y}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-zinc-700 bg-zinc-800 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="
                            w-full h-10
                            bg-gradient-to-r from-emerald-600 to-emerald-500
                            text-sm font-bold uppercase tracking-wide text-white
                            border-2 border-emerald-400
                            cursor-pointer transition-all duration-200
                            hover:from-emerald-500 hover:to-emerald-400 hover:border-emerald-300
                            active:scale-[0.98]
                        "
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
