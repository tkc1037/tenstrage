// トップの「よく読まれている記事」。配列の順がそのまま表示順位になる。
// 根拠: Cloudflare RUM 記事別PV 2026-08-22〜09-21（TenstrageVault/reports/analytics-20260921.md）。
// 30日表で同数（10PV）の3記事は、直近7日（09-14〜09-21）の実数で並べた。
// 次の実測で順位が変わったら、この配列だけを更新する。非公開・削除済みの記事は自動で除外される。
export const popularArticlesPeriod = '2026年8月22日〜9月21日';

export const popularArticleSlugs = [
  'go-app-guide',                   // 130PV
  'jpn-taxi-guide',                 // 30PV
  'taxi-type2-license-guide',       // 20PV
  '20260619-go-crew-sidebusiness',  // 10PV（7日: 5）
  'taxi-company-selection-guide',   // 10PV（7日: 3）
  'taxi-income-commission-guide',   // 10PV（7日: 1）
];
