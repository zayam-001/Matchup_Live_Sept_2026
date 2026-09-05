const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components/BulkUploadTeamsModal.tsx');
let data = fs.readFileSync(filePath, 'utf8');

data = data.replace(/\\\`/g, '`');
data = data.replace(/\\\$/g, '$');

fs.writeFileSync(filePath, data, 'utf8');

