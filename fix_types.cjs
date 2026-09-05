const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');

const regex = /export enum RegistrationStatus \{\n\s+PENDING = 'PENDING',\n\s+ACCEPTED = 'ACCEPTED',\n\s+REJECTED = 'REJECTED',\n\s+WITHDRAWN = 'WITHDRAWN',\n\s+REPLACED = 'REPLACED'\n\}\n\n/;

code = code.replace(regex, '');

// Also change status in Team interface
code = code.replace(/status: RegistrationStatus;/g, "status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'REPLACED' | string;");

fs.writeFileSync('types.ts', code);
console.log("types.ts fixed");
