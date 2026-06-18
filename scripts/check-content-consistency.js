import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ARTICLES_DIR = path.join(ROOT, 'src', 'content', 'articles');

const RULES = [
  {
    id: 'taxi-job-platform-canonical',
    description: '求人サイトはcanonical記事の推奨サービスと矛盾させない',
    forbiddenPatterns: [
      /タクシー転職ネット/g,
      /taxi-tenshoku\.net/gi,
    ],
    message:
      '求人サイト比較のcanonical方針にないサービスを主要・おすすめ扱いしないでください。検索型は転職道.com、相談型はP-CHAN TAXI、両方の補助はドライバーズワークを基準にします。',
  },
];

const articleFiles = fs
  .readdirSync(ARTICLES_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => path.join(ARTICLES_DIR, file));

const findings = [];

for (const filePath of articleFiles) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath).replaceAll(path.sep, '/');

  for (const rule of RULES) {
    for (const pattern of rule.forbiddenPatterns) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split(/\r?\n/).length;
        findings.push({
          rule: rule.id,
          file: rel,
          line,
          match: match[0],
          message: rule.message,
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`\n❌ コンテンツ一貫性チェック: ${findings.length}件`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.match}`);
    console.error(`  ${finding.message}`);
  }
  process.exit(1);
}

console.log('✅ コンテンツ一貫性チェック: 問題なし');
