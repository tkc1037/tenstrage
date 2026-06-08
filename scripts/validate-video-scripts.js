#!/usr/bin/env node
import { readdirSync } from 'fs';
import { join } from 'path';
import { VIDEO_SCRIPTS_DIR } from './video/config.js';
import { validateVideoScript } from './video/parse-script.js';

const files = readdirSync(VIDEO_SCRIPTS_DIR).filter((file) => file.endsWith('.md'));
let errorCount = 0;

for (const file of files) {
  const { errors } = validateVideoScript(join(VIDEO_SCRIPTS_DIR, file));
  if (errors.length === 0) {
    console.log(`✅ ${file}`);
    continue;
  }
  errorCount += errors.length;
  console.error(`❌ ${file}`);
  errors.forEach((error) => console.error(`   - ${error}`));
}

if (errorCount > 0) process.exit(1);
console.log(`\n${files.length}件の台本を検証しました`);
