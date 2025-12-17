interface MapPlaceholderProps {
    width: number;
    height: number;
    label?: string;
}

export function MapPlaceholder({ width, height, label = "Loading..." }: MapPlaceholderProps) {
    return (
        <div
            className="
                flex flex-col items-center justify-center
                border-2 border-zinc-700 bg-zinc-900/80
                relative overflow-hidden
            "
            style={{ width, height }}
        >
            {/* Animated gradient background */}
            <div
                className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-pulse"
                style={{ animationDuration: "1.5s" }}
            />

            {/* Grid pattern overlay */}
            <div
                className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #52525b 1px, transparent 1px),
                        linear-gradient(to bottom, #52525b 1px, transparent 1px)
                    `,
                    backgroundSize: "20px 20px",
                }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-4">
                {/* Spinner */}
                <div className="relative">
                    <div
                        className="
                            w-12 h-12 border-4 border-zinc-700
                            border-t-emerald-500
                            animate-spin
                        "
                        style={{ animationDuration: "0.8s" }}
                    />
                </div>

                {/* Label */}
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {label}
                </span>
            </div>
        </div>
    );
}
