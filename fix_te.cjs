const fs = require('fs');
let code = fs.readFileSync('services/tournamentEngine.ts', 'utf8');

code = code.replace(/RegistrationStatus\.PENDING/g, "'PENDING'");
code = code.replace(/RegistrationStatus\.ACCEPTED/g, "'ACCEPTED'");
code = code.replace(/RegistrationStatus\.REJECTED/g, "'REJECTED'");
code = code.replace(/RegistrationStatus\.WITHDRAWN/g, "'WITHDRAWN'");
code = code.replace(/RegistrationStatus\.REPLACED/g, "'REPLACED'");

code = code.replace(/\s*RegistrationStatus,\s*/g, " ");
code = code.replace(/RegistrationStatus/g, "string");

fs.writeFileSync('services/tournamentEngine.ts', code);
console.log("tournamentEngine.ts fixed");
