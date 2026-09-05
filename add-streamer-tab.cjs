const fs = require('fs');
let code = fs.readFileSync('components/Auth.tsx', 'utf8');

code = code.replace(
    /<button \n\s*onClick=\{\(\) => \{ setOpRole\('referee'\); setError\(''\); \}\}/,
    `<button 
                                        onClick={() => { setOpRole('streamer'); setError(''); }}
                                        className={\`pb-4 text-sm font-bold uppercase tracking-wider transition-colors relative \${opRole === 'streamer' ? 'text-white' : 'text-content-muted hover:text-content-secondary'}\`}
                                    >
                                        Streamer
                                        {opRole === 'streamer' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full"></div>}
                                    </button>
                                    <button 
                                        onClick={() => { setOpRole('referee'); setError(''); }}`
);

code = code.replace(
    /\{opRole === 'admin' \? \(/,
    `{(opRole === 'admin' || opRole === 'streamer') ? (`
);

code = code.replace(
    /<label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">Admin Email<\/label>/,
    `<label className="block text-xs font-bold uppercase tracking-widest text-content-muted mb-2">{opRole === 'streamer' ? 'Streamer Email' : 'Admin Email'}</label>`
);

fs.writeFileSync('components/Auth.tsx', code);
