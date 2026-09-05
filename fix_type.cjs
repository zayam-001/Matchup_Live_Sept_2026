const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

code = code.replace(
    /if \(team\.status === 'ACCEPTED' \|\| team\.status === RegistrationStatus\.ACCEPTED\)/g,
    "if (team.status === RegistrationStatus.ACCEPTED)"
);

fs.writeFileSync('services/storage.ts', code);
console.log("Done");
