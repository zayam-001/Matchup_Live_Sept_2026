import fs from 'fs';
const files = fs.readdirSync('./migrated_prompt_history');
for (const file of files) {
  const data = fs.readFileSync(`./migrated_prompt_history/${file}`, 'utf-8');
  let match = data.match(/export const PublicLanding:.*?<\/diff_block_end>/s);
  if (match) {
     console.log(`Found a diff block for PublicLanding in ${file}`);
  }
}
