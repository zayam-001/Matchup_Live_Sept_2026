const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

// We want to fetch the full match from `tournaments/${tId}/matches/${mId}` before updating global matches?
// Or we can just read it from mRef!
