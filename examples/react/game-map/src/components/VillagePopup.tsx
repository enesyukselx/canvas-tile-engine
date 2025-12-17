import type { MapObject } from "../generateMapObjects";

interface VillagePopupProps {
    item: MapObject | null;
    position: { x: number; y: number };
    visible: boolean;
}

export function VillagePopup({ item, position, visible }: VillagePopupProps) {
    if (!visible || !item) return null;

    return (
        <div
            className="absolute z-10 pointer-events-none"
            style={{
                left: position.x < 180 ? 0 : position.x - 180,
                top: position.y,
            }}
        >
            <div className="w-72 border-2 border-emerald-500/50 bg-zinc-900/95 shadow-2xl backdrop-blur-sm">
                {/* Header */}
                <div className="border-b border-zinc-700 bg-zinc-800 px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {item.type}
                    </span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Player
                        </span>
                        <span className="text-sm font-semibold text-white">
                            {item.playerName}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Village
                        </span>
                        <span className="text-sm font-semibold text-white">
                            {item.villageName}
                        </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            Coords
                        </span>
                        <span className="border border-zinc-600 bg-zinc-800 px-3 py-1 font-mono text-xs font-bold text-amber-400">
                            {item.x} · {item.y}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

