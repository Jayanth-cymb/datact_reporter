// Cross-platform: copy client/dist into server/public so pkg can bundle it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '..', 'client', 'dist');
const dest = path.resolve(__dirname, 'public');

if (!fs.existsSync(src)) {
  console.error(`Client build not found at ${src}. Run "npm run build:client" first.`);
  process.exit(1);
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
    const sp = path.join(s, entry.name);
    const dp = path.join(d, entry.name);
    if (entry.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}

rmrf(dest);
copyDir(src, dest);
console.log(`Copied ${src} → ${dest}`);
