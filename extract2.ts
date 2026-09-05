import fs from 'fs';
const files = fs.readdirSync('./migrated_prompt_history');
for (const file of files) {
  const data = fs.readFileSync(`./migrated_prompt_history/${file}`, 'utf-8');
  const idx = data.indexOf('export const PublicLanding');
  if (idx > -1) {
    console.log(`Found in ${file}`);
    const snippet = data.substring(idx - 100, idx + 4000);
    console.log(snippet.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t'));
    break;
  }
}
