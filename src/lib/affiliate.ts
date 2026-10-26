// Existing A8-issued URL. Do not add tracking parameters or redirect wrappers.
export const driversWorkUrl = 'https://px.a8.net/svt/ejp?a8mat=4B40F9+FIGPAQ+58IO+BXQOH';

// A8発行のバナー素材（300×250）。計測用の1px画像を含め、発行コードを一字も変えずに出力する。
export const driversWorkBannerHtml = `<a href="https://px.a8.net/svt/ejp?a8mat=4B40F9+FIGPAQ+58IO+BXQOH" rel="nofollow">
<img border="0" width="300" height="250" alt="" src="https://www27.a8.net/svt/bgt?aid=260527653938&wid=005&eno=01&mid=s00000024432002005000&mc=1"></a>
<img border="0" width="1" height="1" src="https://www18.a8.net/0.gif?a8mat=4B40F9+FIGPAQ+58IO+BXQOH" alt="">`;

// 全広告枠で共通の注意書き。記事本文（Markdown）にも同じ文言を置いている。
export const affiliateNote = '外部サービスの登録フォームへ進みます。登録後は担当者から連絡があります。掲載会社の紹介を保証するものではありません。';

// 広告枠の誘導文。記事のカテゴリに合う文言を出し、該当がなければ最後の標準文言（記事本文のPRリンク前と同じ）を使う。
export function affiliateMessage(category = '', slug = '') {
  if (slug === 'go-app-guide') return 'GOを使う環境も含めて勤務先を見直したい方へ。希望する配車アプリや働き方を伝えて、転職先を相談できます。';
  if (category === 'vehicle') return '車両や設備も重視して転職先を探したい方へ。希望する車両と配属条件を、求人紹介の際に確認しましょう。';
  if (slug === 'taxi-type2-license-guide') return '免許費用や研修中の収入が気になる方へ。入社までに必要なお金を整理して、希望に合う求人を相談できます。';
  if (category === 'income') return '希望する収入と働き方が見えてきた方へ。歩合率だけでなく、給与保証や控除も確認しながら転職先を相談できます。';
  if (category === 'real-field' || category === 'note') return '今の勤務先や働き方を見直したい方へ。乗務経験や希望条件を伝えて、次の転職先を相談できます。';
  return '希望条件に合う求人を紹介してもらいたい方へ。会社選びや面接の準備を、タクシー業界の転職支援サービスに相談できます。';
}
