const fs = require('fs');
const files = [
  'components/PlayerDashboard.tsx',
  'components/ReplaceTeamModal.tsx',
  'components/TournamentAnalytics.tsx',
  'components/AdminDashboard.tsx',
  'components/BulkUploadTeamsModal.tsx',
  'components/RegistrationForm.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  
  code = code.replace(/RegistrationStatus\.PENDING/g, "'PENDING'");
  code = code.replace(/RegistrationStatus\.ACCEPTED/g, "'ACCEPTED'");
  code = code.replace(/RegistrationStatus\.REJECTED/g, "'REJECTED'");
  code = code.replace(/RegistrationStatus\.WITHDRAWN/g, "'WITHDRAWN'");
  code = code.replace(/RegistrationStatus\.REPLACED/g, "'REPLACED'");
  
  code = code.replace(/\s*RegistrationStatus,\s*/g, " ");
  
  // also check for any loose RegistrationStatus types
  code = code.replace(/RegistrationStatus/g, "any");

  fs.writeFileSync(file, code);
}
console.log("components fixed");
