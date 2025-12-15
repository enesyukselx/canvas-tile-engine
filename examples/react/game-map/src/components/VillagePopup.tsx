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
            className="absolute z-10"
            style={{
                left: position.x < 160 ? 0 : position.x - 160,
                top: position.y,
            }}
        >
            <div className="w-80 rounded-3xl border border-amber-500/50 bg-slate-950/80 p-4 text-slate-100 shadow-[0_20px_45px_rgba(0,0,0,0.45)] backdrop-blur supports-[backdrop-filter]:bg-slate-950/70">
                <div className="grid gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">Player</span>
                        <span className="font-semibold text-white">{item.playerName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">Village name</span>
                        <span className="font-semibold text-white">{item.villageName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">Type</span>
                        <span className="font-semibold text-white">{item.type.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-300">Coordinates</span>
                        <span className="rounded-full bg-slate-900/70 px-3 py-1 font-semibold tracking-wide text-amber-200">
                            {item.x} · {item.y}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
