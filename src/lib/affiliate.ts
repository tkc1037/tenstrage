// Existing A8-issued URL. Do not add tracking parameters or redirect wrappers.
export const driversWorkUrl = 'https://px.a8.net/svt/ejp?a8mat=4B40F9+FIGOIY+58IO+BXQOH';

export function affiliateMessage(category = '', slug = '') {
  if (slug === 'go-app-guide') return 'GOを使う環境も含めて勤務先を見直したい方へ。希望する配車アプリや働き方を伝えて、転職先を相談できます。';
  if (category === 'vehicle') return '車両や設備も重視して転職先を探したい方へ。希望する車両と配属条件を、求人紹介の際に確認しましょう。';
  if (slug === 'taxi-type2-license-guide') return '免許費用や研修中の収入が気になる方へ。入社までに必要なお金を整理して、希望に合う求人を相談できます。';
  if (category === 'income') return '希望する収入と働き方が見えてきた方へ。歩合率だけでなく、給与保証や控除も確認しながら転職先を相談できます。';
  if (category === 'real-field' || category === 'note') return '今の勤務先や働き方を見直したい方へ。乗務経験や希望条件を伝えて、次の転職先を相談できます。';
  return '希望条件に合う求人を紹介してもらいたい方へ。会社選びや面接の準備を、タクシー業界の転職支援サービスに相談できます。';
}
