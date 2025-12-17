import React from "react";
import type { SizeOption } from "../constants";

interface MapSizeSelectProps {
    id: string;
    label: string;
    value: string;
    options: SizeOption[];
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function MapSizeSelect({ id, label, value, options, onChange }: MapSizeSelectProps) {
    return (
        <div className="mt-4 p-4 bg-zinc-800/50 border border-zinc-700">
            <label
                htmlFor={id}
                className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2"
            >
                {label}
            </label>
            <div className="relative">
                <select
                    id={id}
                    className="
                        w-full h-9 px-3 pr-10
                        appearance-none
                        bg-zinc-900 text-white text-sm font-medium
                        border-2 border-zinc-600
                        outline-none cursor-pointer
                        transition-all duration-200
                        hover:border-zinc-500
                        focus:border-emerald-500 focus:bg-zinc-800
                    "
                    value={value}
                    onChange={onChange}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                        className="w-4 h-4 text-zinc-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="square" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
}

