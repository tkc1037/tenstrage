export const categoryConfig: Record<string, { label: string; description: string }> = {
  'beginner': {
    label: '初めての方へ',
    description: 'タクシードライバーへの転職を検討中の方に向けた基礎情報。プロフィール、ロードマップ、業界の全体像を解説します。',
  },
  'pre-career': {
    label: '転職前に必見',
    description: '会社選び、二種免許、研修、面接で確認すべきポイントをまとめています。',
  },
  'company-selection': {
    label: '転職前に必見',
    description: '会社選び、二種免許、研修、面接で確認すべきポイントをまとめています。',
  },
  'income': {
    label: '収入を知る',
    description: '歩合率、給与体系、手当、勤務形態別の収入比較など、お金に関する情報をまとめています。',
  },
  'real-field': {
    label: '現場のリアル情報',
    description: '営業エリア、配車アプリ、乗り場、接客、休憩など現場で役立つ実用情報です。',
  },
  'vehicle': {
    label: '車両・道具',
    description: 'JPN TAXI、車内設備、持ち物、安全対策など車両と装備に関する情報です。',
  },
  'note': {
    label: 'Takuzoの乗務ノート',
    description: 'Takuzoが日々の乗務で気づいたこと、失敗と改善、仕事への考え方を記録しています。',
  },
};

export const categoryLabels: Record<string, string> = Object.fromEntries(
  Object.entries(categoryConfig).map(([k, v]) => [k, v.label])
);
