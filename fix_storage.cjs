const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

code = code.replace(/RegistrationStatus\.PENDING/g, "'PENDING'");
code = code.replace(/RegistrationStatus\.ACCEPTED/g, "'ACCEPTED'");
code = code.replace(/RegistrationStatus\.REJECTED/g, "'REJECTED'");
code = code.replace(/RegistrationStatus\.WITHDRAWN/g, "'WITHDRAWN'");
code = code.replace(/RegistrationStatus\.REPLACED/g, "'REPLACED'");

// Remove import RegistrationStatus,
code = code.replace(/\s*RegistrationStatus,\s*/g, " ");
code = code.replace(/status as RegistrationStatus/g, "status as any");

fs.writeFileSync('services/storage.ts', code);
console.log("storage.ts fixed");
