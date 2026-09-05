import fs from 'fs';
const files = fs.readdirSync('./migrated_prompt_history');
for (const file of files) {
  const data = fs.readFileSync(`./migrated_prompt_history/${file}`, 'utf-8');
  if (data.includes('export const PublicLanding')) {
    const match = data.match(/export const PublicLanding.*?<\/diff_block_end>/s) || data.match(/export const PublicLanding.*?\\n/s) || data.match(/.*?export const PublicLanding.*/g);
    console.log(`Found in ${file}`);
  }
}
