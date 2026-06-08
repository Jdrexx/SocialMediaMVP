#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const rawName = process.argv[2];

if (!rawName) {
  console.error('Usage: npm run scaffold:feature <feature-name>');
  process.exit(1);
}

const name = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');

if (!name) {
  console.error('Feature name must include at least one letter or number.');
  process.exit(1);
}

const functionName = `create${name.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join('')}Router`;
const featureDir = path.join('src', 'features', name);
const routesPath = path.join(featureDir, 'routes.js');

if (existsSync(featureDir)) {
  console.error(`Feature already exists: ${featureDir}`);
  process.exit(1);
}

await mkdir(featureDir, { recursive: true });
await writeFile(routesPath, `import express from 'express';\nimport { authRequired } from '../../lib/http.js';\n\nexport function ${functionName}({ db }) {\n  const router = express.Router();\n\n  router.get('/${name}', authRequired, (_req, res) => {\n    res.json({ ${name.replace(/-/g, '_')}: [] });\n  });\n\n  return router;\n}\n`);

console.log(`Created ${routesPath}`);
console.log('Next steps:');
console.log(`1. Add an import for ${functionName} in src/features/index.js`);
console.log(`2. Add { name: '${name}', mountPath: '/api', createRouter: ${functionName} } to featureRegistry`);
console.log('3. Add tests in tests/*.test.js before adding production behavior');
console.log('4. Run npm test');
