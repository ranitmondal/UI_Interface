const fs = require('fs');
const path = require('path');

// Function to remove null characters and invalid Unicode sequences
function cleanString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\u0000/g, '').replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

// Clean all environment variables
const env = process.env;
const cleanedEnv = {};

for (const [key, value] of Object.entries(env)) {
  cleanedEnv[key] = cleanString(value);
}

// Write cleaned environment to a temporary file
const envPath = path.join(process.cwd(), '.env.cleaned');
fs.writeFileSync(envPath, Object.entries(cleanedEnv)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n'));

console.log('Environment variables cleaned and written to .env.cleaned'); 