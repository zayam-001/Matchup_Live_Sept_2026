// ISO 3166-1 alpha-2 country codes. Names come from the browser's Intl data
// so there's no translation table to maintain; flags are SVGs from flagcdn.
const CODES = [
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
    'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BW', 'BY', 'BZ',
    'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CY', 'CZ',
    'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
    'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GT', 'GU', 'GW', 'GY',
    'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
    'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
    'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
    'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM',
    'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
    'TC', 'TD', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
    'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

// Shown first in the picker (home market), the rest alphabetical.
const PINNED = ['PK'];

let displayNames: Intl.DisplayNames | null = null;
try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
} catch {
    displayNames = null;
}

export const getCountryName = (code?: string | null): string => {
    if (!code) return '';
    const upper = code.toUpperCase();
    if (upper === 'XK') return 'Kosovo';
    try {
        return displayNames?.of(upper) || upper;
    } catch {
        return upper;
    }
};

export interface CountryOption {
    code: string;
    name: string;
}

export const COUNTRIES: CountryOption[] = (() => {
    const all = CODES.map(code => ({ code, name: getCountryName(code) }));
    const pinned = PINNED.map(c => all.find(x => x.code === c)!).filter(Boolean);
    const rest = all.filter(x => !PINNED.includes(x.code)).sort((a, b) => a.name.localeCompare(b.name));
    return [...pinned, ...rest];
})();

export const getFlagUrl = (code?: string | null): string =>
    code ? `https://flagcdn.com/${code.toLowerCase()}.svg` : '';

// Accepts a code ("PK"), a name ("Pakistan") or a common alias, as typed in a
// bulk-upload sheet. Returns the ISO code or '' if it can't be matched.
const ALIASES: Record<string, string> = {
    uk: 'GB', 'united kingdom': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', britain: 'GB', 'great britain': 'GB',
    usa: 'US', 'united states of america': 'US', america: 'US', uae: 'AE', 'emirates': 'AE',
    russia: 'RU', 'south korea': 'KR', korea: 'KR', iran: 'IR', turkey: 'TR', turkiye: 'TR', holland: 'NL',
};

export const resolveCountryCode = (value?: string | null): string => {
    const v = (value || '').trim();
    if (!v) return '';
    if (v.length === 2 && CODES.includes(v.toUpperCase())) return v.toUpperCase();
    const lower = v.toLowerCase();
    if (ALIASES[lower]) return ALIASES[lower];
    const match = COUNTRIES.find(c => c.name.toLowerCase() === lower);
    return match ? match.code : '';
};
