import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';

// Match Next.js production env-file precedence; existing environment values win.
for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
  if (existsSync(file)) loadEnvFile(file);
}
const server=resolve('.next/standalone/server.js');
if (!existsSync(server)) {
  console.error('Run npm run build before npm start.');
  process.exit(1);
}
const child=spawn(process.execPath,[server],{
  stdio:'inherit',
  env:{...process.env,NODE_ENV:'production',HOSTNAME:process.env.HOSTNAME||'0.0.0.0',PORT:process.env.PORT||'3000',DATABASE_PATH:resolve(process.env.DATABASE_PATH||'./data/manito.sqlite')},
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exit(1);});
child.on('exit',(code,signal)=>process.exit(code??(signal?1:0)));
