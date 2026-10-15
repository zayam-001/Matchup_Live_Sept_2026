import React from 'react';

// The two "characters" of the homepage motion system, drawn in the existing
// Match Up palette (navy #020D45, orange #E55C30, cream #F6EDDC). Pure markup;
// all movement is applied from outside via transforms.

/** Face centre of the racket in its own viewBox; used to aim the ball at it. */
export const RACKET_VIEWBOX = { width: 120, height: 270, faceX: 60, faceY: 74 };

const HOLES: [number, number][] = (() => {
    const out: [number, number][] = [];
    for (let row = 0; row < 7; row++) {
        const y = 34 + row * 12;
        const half = row === 0 || row === 6 ? 2 : row === 1 || row === 5 ? 3 : 4;
        for (let i = -half; i <= half; i++) {
            const x = 60 + i * 10.5 + (row % 2 ? 5.25 : 0);
            if (Math.hypot((x - 60) / 44, (y - 74) / 52) < 0.86) out.push([x, y]);
        }
    }
    return out;
})();

export const PadelRacket: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
    <svg className={className} style={style} viewBox={`0 0 ${RACKET_VIEWBOX.width} ${RACKET_VIEWBOX.height}`} fill="none" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="muRacketFace" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#14256B" />
                <stop offset="1" stopColor="#071550" />
            </linearGradient>
            <linearGradient id="muRacketFrame" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FF8A5B" />
                <stop offset=".55" stopColor="#E55C30" />
                <stop offset="1" stopColor="#B8441F" />
            </linearGradient>
            <linearGradient id="muRacketGrip" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#F6EDDC" />
                <stop offset="1" stopColor="#CFC4AE" />
            </linearGradient>
        </defs>
        {/* Head: padel rackets are solid, perforated, slightly teardrop shaped */}
        <path d="M60 8 C 96 8, 112 38, 112 70 C 112 104, 92 132, 70 142 L 50 142 C 28 132, 8 104, 8 70 C 8 38, 24 8, 60 8 Z" fill="url(#muRacketFrame)" />
        <path d="M60 17 C 90 17, 102 42, 102 70 C 102 99, 86 122, 66 131 L 54 131 C 34 122, 18 99, 18 70 C 18 42, 30 17, 60 17 Z" fill="url(#muRacketFace)" />
        {HOLES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#020D45" stroke="rgba(229,92,48,.35)" strokeWidth=".6" />)}
        {/* Throat (the open triangle above the handle) */}
        <path d="M50 142 L 70 142 L 66 176 L 54 176 Z" fill="url(#muRacketFrame)" />
        <path d="M56 148 L 64 148 L 62 166 L 58 166 Z" fill="#020D45" opacity=".85" />
        {/* Handle + grip wrap + butt cap */}
        <rect x="52" y="176" width="16" height="78" rx="5" fill="url(#muRacketGrip)" />
        {[186, 198, 210, 222, 234, 246].map(y => <path key={y} d={`M52 ${y} L 68 ${y - 6}`} stroke="rgba(2,13,69,.18)" strokeWidth="2" />)}
        <rect x="49" y="252" width="22" height="10" rx="4" fill="#E55C30" />
        {/* Highlight along the frame */}
        <path d="M28 40 C 36 24, 48 18, 60 17" stroke="rgba(255,255,255,.35)" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

/** The Match Up ball: same look as the existing hero orbit ball. */
export const PadelBall: React.FC<{ className?: string; style?: React.CSSProperties; innerRef?: React.Ref<HTMLSpanElement> }> = ({ className, style, innerRef }) => (
    <span className={`mu-ball ${className || ''}`} style={style} ref={innerRef} aria-hidden="true">
        <span className="mu-ball__spin" />
    </span>
);
