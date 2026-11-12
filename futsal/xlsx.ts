// Minimal Excel (.xlsx) read and write for squad sheets, on the jszip the app
// already ships: an .xlsx file is a zip of XML parts. Reads the first sheet as
// rows of text; writes one sheet with a bold header row and sized columns.

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const colIndex = (ref: string) => { const letters = ref.replace(/\d+/g, ''); let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

/** One-sheet workbook; the first row is bold. */
export const writeXlsx = async (rows: string[][], sheetName = 'Squads'): Promise<Blob> => {
    const { default: JSZip } = await import('jszip');
    const widths = rows[0].map((_, c) => Math.min(40, Math.max(10, ...rows.map(r => String(r[c] ?? '').length + 2))));
    const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
        const ref = `${colName(ci)}${ri + 1}`;
        const style = ri === 0 ? ' s="1"' : '';
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(String(v ?? ''))}</t></is></c>`;
    }).join('')}</row>`).join('');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>');
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData></worksheet>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/** The first worksheet of an .xlsx file as rows of trimmed text (empty rows dropped). */
export const readXlsx = async (file: Blob): Promise<string[][]> => {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
    const text = (n: Element | null | undefined) => (n ? Array.from(n.getElementsByTagName('t')).map(t => t.textContent || '').join('') : '');
    const shared = zip.file('xl/sharedStrings.xml') ? Array.from(parse(await zip.file('xl/sharedStrings.xml')!.async('string')).getElementsByTagName('si')).map(si => text(si)) : [];
    // The first sheet in workbook order, wherever its part lives.
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wb = zip.file('xl/workbook.xml'), rels = zip.file('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
        const first = parse(await wb.async('string')).getElementsByTagName('sheet')[0];
        const rid = first?.getAttribute('r:id') || first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
        const target = Array.from(parse(await rels.async('string')).getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    }
    const sheet = zip.file(sheetPath);
    if (!sheet) throw new Error('This workbook has no sheet we can read.');
    const out: string[][] = [];
    Array.from(parse(await sheet.async('string')).getElementsByTagName('row')).forEach(row => {
        const cells: string[] = [];
        Array.from(row.getElementsByTagName('c')).forEach((c, i) => {
            const ref = c.getAttribute('r');
            const idx = ref ? colIndex(ref) : i;
            const type = c.getAttribute('t');
            const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
            const value = type === 's' ? shared[Number(v)] ?? '' : type === 'inlineStr' ? text(c.getElementsByTagName('is')[0]) : v;
            cells[idx] = value.trim();
        });
        const filled = Array.from(cells, x => x ?? '');
        if (filled.some(x => x)) out.push(filled);
    });
    return out;
};
