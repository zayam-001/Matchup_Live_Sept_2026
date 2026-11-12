// Shrinks images in the browser before upload: scaled to fit `maxSize` on the
// longest side and re-encoded (WebP where the browser can, else JPEG, or PNG
// when transparency must survive). The original is kept when it's already
// smaller, and GIF/SVG are passed through untouched (animation, vectors).

export interface CompressOptions {
    /** Longest side in pixels. */
    maxSize: number;
    /** 0–1 encoder quality. */
    quality?: number;
    /** Keep transparency (logos): PNG fallback instead of JPEG. */
    alpha?: boolean;
}

/** Sizes per upload folder: banners stay sharp on a TV, logos and avatars don't need more than 512 px. */
export const PRESET_FOR_FOLDER = (folder: string): CompressOptions => {
    const f = folder.toLowerCase();
    if (/banner|cover|hero/.test(f)) return { maxSize: 1920, quality: 0.82 };
    if (/logo|crest|badge/.test(f)) return { maxSize: 512, quality: 0.9, alpha: true };
    if (/sponsor/.test(f)) return { maxSize: 800, quality: 0.88, alpha: true };
    if (/profile|avatar|photo/.test(f)) return { maxSize: 512, quality: 0.82 };
    return { maxSize: 1600, quality: 0.82 };
};

const canvasToBlob = (c: HTMLCanvasElement, type: string, quality: number) =>
    new Promise<Blob | null>(res => c.toBlob(res, type, quality));

const loadImage = async (file: Blob): Promise<{ img: CanvasImageSource; w: number; h: number; close: () => void }> => {
    if ('createImageBitmap' in window) {
        try {
            const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
            return { img: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
        } catch { /* fall back to <img> (older Safari) */ }
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
};

export const compressImage = async (file: File, opts: CompressOptions): Promise<File> => {
    if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
    const { maxSize, quality = 0.82, alpha = false } = opts;
    let source;
    try { source = await loadImage(file); } catch { return file; } // HEIC etc. the browser can't decode: upload as is
    try {
        const scale = Math.min(1, maxSize / Math.max(source.w, source.h));
        const w = Math.max(1, Math.round(source.w * scale)), h = Math.max(1, Math.round(source.h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.imageSmoothingQuality = 'high';
        if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } // JPEG has no transparency
        ctx.drawImage(source.img, 0, 0, w, h);
        // WebP first; Safari may hand back PNG instead, so check what came out.
        let blob = await canvasToBlob(canvas, 'image/webp', quality);
        if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, alpha ? 'image/png' : 'image/jpeg', quality);
        if (!blob || (blob.size >= file.size && scale === 1)) return file;
        const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
        const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
        return new File([blob], name, { type: blob.type, lastModified: Date.now() });
    } finally {
        source.close();
    }
};

/** A small compressed data URL, for the rare places an image is stored inline. */
export const compressToDataUrl = async (file: File, opts: CompressOptions): Promise<string> => {
    const out = await compressImage(file, opts);
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(out);
    });
};
