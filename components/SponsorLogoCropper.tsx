import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, ZoomIn, ZoomOut, Maximize, Minimize, Loader2 } from 'lucide-react';

// Sponsor logos are shown in a 3:1 slot on the broadcast sponsor strip, so
// every upload is cropped/resized to that shape before it's stored.
const OUT_W = 900;
const OUT_H = 300;
const ASPECT = OUT_W / OUT_H;

interface SponsorLogoCropperProps {
    file: File;
    title?: string;
    onCancel: () => void;
    onConfirm: (blob: Blob) => void | Promise<void>;
}

export const SponsorLogoCropper = ({ file, title = 'Crop sponsor logo', onCancel, onConfirm }: SponsorLogoCropperProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const [img, setImg] = useState<HTMLImageElement | null>(null);
    const [frameW, setFrameW] = useState(480);
    // zoom is relative to "contain" (whole logo visible); offsets are in
    // output-pixel space so preview and export share the same maths.
    const [zoom, setZoom] = useState(0.9);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [whiteBg, setWhiteBg] = useState(false);
    const [saving, setSaving] = useState(false);
    const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => setImg(image);
        image.src = url;
        return () => URL.revokeObjectURL(url);
    }, [file]);

    useEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const containScale = img ? Math.min(OUT_W / img.width, OUT_H / img.height) : 1;
    const coverScale = img ? Math.max(OUT_W / img.width, OUT_H / img.height) : 1;

    const draw = (ctx: CanvasRenderingContext2D, preview: boolean) => {
        ctx.clearRect(0, 0, OUT_W, OUT_H);
        if (whiteBg) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, OUT_W, OUT_H);
        } else if (preview) {
            // Checkerboard so transparent areas are visible while cropping.
            const s = 30;
            for (let y = 0; y < OUT_H; y += s) {
                for (let x = 0; x < OUT_W; x += s) {
                    ctx.fillStyle = ((x + y) / s) % 2 === 0 ? '#ffffff' : '#e8e8ee';
                    ctx.fillRect(x, y, s, s);
                }
            }
        }
        if (!img) return;
        const scale = containScale * zoom;
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, OUT_W / 2 - w / 2 + offset.x, OUT_H / 2 - h / 2 + offset.y, w, h);
    };

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) draw(ctx, true);
    }, [img, zoom, offset, whiteBg]);

    const toOutput = OUT_W / Math.max(frameW, 1);

    const onPointerDown = (e: React.PointerEvent) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (!drag.current) return;
        setOffset({
            x: drag.current.ox + (e.clientX - drag.current.x) * toOutput,
            y: drag.current.oy + (e.clientY - drag.current.y) * toOutput,
        });
    };
    const onPointerUp = () => { drag.current = null; };
    const onWheel = (e: React.WheelEvent) => {
        setZoom(z => Math.min(4, Math.max(0.3, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
    };

    const setFit = () => { setZoom(0.9); setOffset({ x: 0, y: 0 }); };
    const setFill = () => { setZoom(coverScale / containScale); setOffset({ x: 0, y: 0 }); };

    const handleConfirm = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = OUT_W;
        canvas.height = OUT_H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        draw(ctx, false);
        const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
        if (!blob) return;
        setSaving(true);
        try {
            await onConfirm(blob);
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[13000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
            <div className="w-full max-w-xl bg-surface-panel border border-white/10 rounded-2xl shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider">{title}</h3>
                    <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-white/10 text-content-muted hover:text-white transition-colors" aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div ref={frameRef} className="w-full rounded-xl overflow-hidden border border-white/15" style={{ aspectRatio: String(ASPECT) }}>
                    <canvas
                        ref={canvasRef}
                        width={OUT_W}
                        height={OUT_H}
                        className="w-full h-full cursor-grab active:cursor-grabbing touch-none block"
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerUp}
                        onWheel={onWheel}
                    />
                </div>
                <p className="text-[11px] text-content-muted text-center">Drag to position · scroll or use the slider to resize</p>

                <div className="flex items-center gap-3">
                    <ZoomOut size={16} className="text-content-muted shrink-0" />
                    <input
                        type="range"
                        min={0.3}
                        max={4}
                        step={0.01}
                        value={zoom}
                        onChange={e => setZoom(Number(e.target.value))}
                        className="flex-1 accent-[#4D78FF]"
                        aria-label="Zoom"
                    />
                    <ZoomIn size={16} className="text-content-muted shrink-0" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={setFit} className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
                        <Minimize size={14} /> Fit
                    </button>
                    <button onClick={setFill} className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-colors">
                        <Maximize size={14} /> Fill
                    </button>
                    <label className="ml-auto flex items-center gap-2 text-xs font-bold text-content-secondary cursor-pointer select-none">
                        <input type="checkbox" checked={whiteBg} onChange={e => setWhiteBg(e.target.checked)} className="accent-[#4D78FF]" />
                        White background
                    </label>
                </div>

                <div className="flex gap-3 pt-1">
                    <button onClick={onCancel} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold text-sm transition-all border border-white/10">
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!img || saving}
                        className="flex-[2] bg-brand hover:bg-brand-light disabled:opacity-50 text-content-inverse py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                        {saving ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : <><Check size={16} /> Use logo</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
