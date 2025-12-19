interface CoordinateInputProps {
    inputX: string;
    inputY: string;
    onInputXChange: (value: string) => void;
    onInputYChange: (value: string) => void;
    onGoClick: () => void;
    disabled?: boolean;
}

export function CoordinateInput({
    inputX,
    inputY,
    onInputXChange,
    onInputYChange,
    onGoClick,
    disabled = false,
}: CoordinateInputProps) {
    const inputStyle = `
        w-20 h-9 px-3
        bg-zinc-900 text-white text-sm font-medium
        border-2 border-zinc-600
        outline-none
        transition-all duration-200
        focus:border-emerald-500 focus:bg-zinc-800
        hover:border-zinc-500
        placeholder:text-zinc-500
    `;

    const labelStyle = `
        text-xs font-bold uppercase tracking-wider text-zinc-400
        mb-1
    `;

    return (
        <div className="flex items-end gap-3 mt-4 p-4 bg-zinc-800/50 border border-zinc-700">
            <div className="flex flex-col">
                <label className={labelStyle} htmlFor="x">
                    X Coord
                </label>
                <input
                    className={inputStyle}
                    id="x"
                    type="number"
                    value={inputX}
                    onChange={(e) => onInputXChange(e.target.value)}
                    placeholder="X"
                />
            </div>
            <div className="flex flex-col">
                <label className={labelStyle} htmlFor="y">
                    Y Coord
                </label>
                <input
                    className={inputStyle}
                    id="y"
                    type="number"
                    value={inputY}
                    onChange={(e) => onInputYChange(e.target.value)}
                    placeholder="Y"
                />
            </div>
            <button
                onClick={onGoClick}
                disabled={disabled}
                className={`
                    h-9 px-6
                    text-white text-sm font-bold uppercase tracking-wide
                    border-2
                    transition-all duration-200
                    ${disabled
                        ? 'bg-zinc-600 border-zinc-500 cursor-not-allowed opacity-50'
                        : 'bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-400 cursor-pointer hover:from-emerald-500 hover:to-emerald-400 hover:border-emerald-300 active:scale-95'
                    }
                `}
            >
                {disabled ? 'Going...' : 'Go'}
            </button>
        </div>
    );
}

