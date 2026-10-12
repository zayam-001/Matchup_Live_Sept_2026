import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, getCountryName, getFlagUrl } from '../lib/countries';

export const CountryFlag = ({ code, className = '', style }: { code?: string | null; className?: string; style?: React.CSSProperties }) => {
    if (!code) return null;
    return (
        <img
            src={getFlagUrl(code)}
            alt={getCountryName(code)}
            title={getCountryName(code)}
            loading="lazy"
            className={`inline-block object-cover shrink-0 ${className}`}
            style={style}
        />
    );
};

interface CountrySelectProps {
    value?: string;
    onChange: (code: string) => void;
    required?: boolean;
    label?: string;
    placeholder?: string;
    className?: string;
    compact?: boolean;
}

// Searchable country picker showing each country's flag. Native <select>
// can't render images, hence the custom list. A hidden required input keeps
// the browser's own "please fill out this field" validation on forms.
export const CountrySelect = ({ value, onChange, required, label, placeholder = 'Select country', className = '', compact }: CountrySelectProps) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        setTimeout(() => searchRef.current?.focus(), 0);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COUNTRIES;
        return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
    }, [query]);

    const pick = (code: string) => {
        onChange(code);
        setOpen(false);
        setQuery('');
    };

    return (
        <div ref={rootRef} className={`relative ${className}`}>
            {label && (
                <label className="block text-xs font-medium text-content-secondary mb-1 uppercase tracking-wider">
                    {label} {required && '*'}
                </label>
            )}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className={`w-full flex items-center gap-2 bg-surface-ground border border-white/10 text-left text-white focus:border-brand focus:outline-none transition-all ${compact ? 'rounded p-2 text-sm' : 'rounded-xl px-4 py-3 text-sm'}`}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                >
                    {value ? (
                        <>
                            <CountryFlag code={value} className="w-6 h-4 rounded-[2px]" />
                            <span className="flex-1 truncate">{getCountryName(value)}</span>
                        </>
                    ) : (
                        <span className="flex-1 truncate text-content-muted">{placeholder}{required && !label ? ' *' : ''}</span>
                    )}
                    <ChevronDown size={16} className={`text-content-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {required && (
                    <input
                        tabIndex={-1}
                        aria-hidden="true"
                        required
                        value={value || ''}
                        onChange={() => {}}
                        onFocus={() => setOpen(true)}
                        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                    />
                )}
            </div>

            {open && (
                <div className="absolute z-[14000] mt-1 w-full min-w-[220px] bg-surface-panel border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                        <Search size={14} className="text-content-muted shrink-0" />
                        <input
                            ref={searchRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (filtered[0]) pick(filtered[0].code);
                                } else if (e.key === 'Escape') {
                                    setOpen(false);
                                }
                            }}
                            placeholder="Search country"
                            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-content-muted"
                        />
                    </div>
                    <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
                        {filtered.length === 0 && <li className="px-3 py-2 text-xs text-content-muted">No match</li>}
                        {filtered.map(c => (
                            <li key={c.code}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={c.code === value}
                                    onClick={() => pick(c.code)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-white/10 ${c.code === value ? 'bg-brand/15 text-white' : 'text-content-secondary'}`}
                                >
                                    <CountryFlag code={c.code} className="w-6 h-4 rounded-[2px]" />
                                    <span className="truncate">{c.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
