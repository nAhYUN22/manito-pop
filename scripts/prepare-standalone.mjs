import { cpSync } from 'node:fs';
// Next.js does not copy public assets into standalone output automatically.
cpSync('public', '.next/standalone/public', {recursive:true});
cpSync('.next/static', '.next/standalone/.next/static', {recursive:true});
