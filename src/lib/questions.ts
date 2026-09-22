export const questionCategories = [
  { id: 'company', label: '会社選び' },
  { id: 'income', label: '給与・収入' },
  { id: 'housing', label: '寮・支援金' },
  { id: 'license', label: '免許・未経験' },
  { id: 'preparation', label: '応募・面接' },
  { id: 'service', label: '転職支援サービス' },
] as const;

interface Question {
  id: string;
  category: typeof questionCategories[number]['id'];
  question: string;
  answer: string;
  keywords: string;
  link: { href: string; label: string };
  source?: { href: string; label: string };
}

// Editorial checking prompts, not promises of eligibility, earnings or placement.
export const questions: Question[] = [
  { id: 'company-check', category: 'company', question: '会社選びでは、何から確認すればいい？',
    answer: 'まず希望する勤務地と働き方を決め、給与の計算方法・配車アプリ・車両・事故時の補償を同じ項目で比べましょう。グループ名だけで判断せず、雇用する会社と配属予定の営業所まで確認するのが、このサイトのおすすめです。',
    keywords: '会社 比較 選び方 営業所 通勤 大手', link: { href: '/articles/taxi-company-selection-guide/', label: '会社選びの確認ポイントを読む' } },
  { id: 'go-vehicle', category: 'company', question: 'GOやJPN TAXIがある会社なら、希望の環境で働ける？',
    answer: '会社への導入と、自分が配属される営業所で使えること・希望の車両に乗れることは分けて確認しましょう。面接では「配属先で使えるアプリ」「担当車両の決まり方」を具体的に質問してください。',
    keywords: 'GO ゴー ごー アプリ JPN TAXI ジャパンタクシー 車両 配属', link: { href: '/articles/taxi-company-selection-guide/', label: 'アプリ・車両の確認ポイントを読む' } },
  { id: 'accident-coverage', category: 'company', question: '事故補償があれば、自己負担はない？',
    answer: '「事故補償あり」という表示だけで、本人の負担がゼロとは判断できません。補償される範囲、本人負担が生じる条件、上限、休業中の扱いを確認しましょう。わからない部分は「負担なし」と読み替えず、応募前に確認する項目として残してください。',
    keywords: '事故 補償 保障 保険 負担金 自己負担 ゼロ', link: { href: '/articles/taxi-company-selection-guide/', label: '事故負担金の確認ポイントを読む' } },
  { id: 'commission-rate', category: 'income', question: '歩合率が高い会社を選べば、手取りも増える？',
    answer: '公表されている最高歩合率だけでは手取りを比べられません。その率が適用される売上条件、手当・賞与の含み方、控除項目をそろえて確認しましょう。最高値と、自分が想定する売上での給与は分けて考えてください。',
    keywords: '歩合 歩合率 給料 給与 手取り 60 62 AB型 B型 控除', link: { href: '/articles/taxi-income-commission-guide/', label: '歩合と給与の仕組みを読む' } },
  { id: 'salary-guarantee', category: 'income', question: '給与保証は、金額以外に何を確認する？',
    answer: '対象となる人、保証が始まる時期、期間、出勤などの適用条件を確認しましょう。研修中の給与と乗務開始後の保証を分け、保証が終わった後の給与計算も聞いておくと、入社後の見通しを立てやすくなります。',
    keywords: '給与保証 給与保障 月給 研修給 保証期間', link: { href: '/articles/taxi-company-selection-guide/', label: '給与条件を確認するポイントを読む' } },
  { id: 'shift-choice', category: 'income', question: '隔日勤務・昼日勤・夜日勤は、どう選ぶ？',
    answer: '収入の希望に加えて、睡眠や家庭の予定、通勤手段を整理しましょう。希望する営業所で選べる勤務形態、出庫・帰庫時刻、休日の決まり方を確認し、無理なく続けられるかを考えてください。',
    keywords: '勤務 働き方 隔日 昼日勤 夜日勤 シフト 休み 休日 時間', link: { href: '/articles/taxi-shift-comparison/', label: '勤務形態の違いを読む' } },
  { id: 'housing-cost', category: 'housing', question: '寮ありの求人では、何を確認する？',
    answer: '空室と入居条件を確認したうえで、家賃・光熱費・初期費用、個室か共用か、営業所までの通勤、退寮条件を確認しましょう。「寮あり」だけで入居できると考えず、入社日と入居日が合うかも相談してください。',
    keywords: '寮 社宅 住まい 上京 家賃 個室 初期費用 引っ越し', link: { href: '/preparation/', label: '希望条件と確認事項を整理する' } },
  { id: 'bonus-eligibility', category: 'housing', question: '入社祝い金・支援金は、未経験でも受け取れる？',
    answer: '制度名だけでは判断できません。未経験者が対象か、現任者限定ではないか、申込経路などの条件がないかを確認しましょう。金額だけで会社を決めず、給与や働き方も合わせて見てください。',
    keywords: '祝い金 祝金 入社祝金 入社祝い金 支援金 準備金 未経験', link: { href: '/articles/20260616-signing-bonus-refund-trap/', label: '祝い金の条件を確認するポイントを読む' } },
  { id: 'moving-budget', category: 'housing', question: '支援金を、入社前の引っ越し費用に使える？',
    answer: '支給時期が確認できるまでは、入社前に使えるお金として計算しない方が安心です。引っ越し・入居・研修中の生活費を先に書き出し、支給時期や分割の有無、退職時の扱いを確認してください。',
    keywords: '支援金 支払 支給 時期 前払い 分割 返還 返金 退職 引越し 引っ越し 初期費用', link: { href: '/preparation/', label: '応募前に整理する項目を見る' } },
  { id: 'license-cost', category: 'license', question: '二種免許の「会社負担」は、最初にお金が必要？',
    answer: '「会社負担」という表現だけで、入社時の支払いが不要とは判断できません。自己立替の有無、給与からの天引き、途中で退職する場合の返還条件を分けて確認しましょう。教習中の日当や交通費も一緒に聞いておくと安心です。',
    keywords: '免許代 免許費用 二種免許 2種免許 第二種 費用 持ち出し 立替 天引き 返還', link: { href: '/articles/taxi-type2-license-guide/', label: '二種免許の取得と費用を読む' } },
  { id: 'beginner-training', category: 'license', question: '未経験で道に詳しくない。研修は何を確認する？',
    answer: '地理や接客の研修、同乗指導の回数、配車アプリ・ナビの使い方、独り立ち後の相談体制を確認しましょう。「未経験歓迎」という言葉に加えて、配属先でどのような支援を受けられるかを聞くのがおすすめです。',
    keywords: '未経験 初心者 研修 地理 道 不安 ナビ 同乗', link: { href: '/articles/taxi-career-roadmap/', label: '入社から乗務開始までの流れを読む' } },
  { id: 'before-license', category: 'license', question: '二種免許を自分で取ってから、会社を探すべき？',
    answer: '先に応募先の免許取得支援と採用条件を確認しましょう。費用の支払い方法や教習中の収入を比べてから、自分で取得するか、会社の支援を利用するかを考えられます。受験資格は免許の保有状況等により異なるため、最新の案内を確認してください。',
    keywords: '二種免許 2種免許 免許代 免許費用 先に 取得 順番 資格 年齢', link: { href: '/articles/taxi-type2-license-guide/', label: '免許取得の進め方を読む' } },
  { id: 'interview-check', category: 'preparation', question: '面接で聞くことを、どうまとめればいい？',
    answer: '「希望条件」「求人情報で確認できたこと」「まだ不明なこと」の3つに分けましょう。給与計算、配属先、勤務時間、事故時の負担、免許費用・寮・支援金の適用条件を確認し、重要な条件は後で見直せる形で確認してください。',
    keywords: '面接 質問 リスト 確認 労働条件 書面', link: { href: '/preparation/', label: '面接前の確認リストを見る' } },
  { id: 'resume-preparation', category: 'preparation', question: '履歴書や志望動機は、何から準備する？',
    answer: '職歴・免許の取得時期を整理し、なぜタクシーの仕事を考えているか、どんな働き方を希望するかを自分の言葉でまとめましょう。応募先が求める書類や形式を確認してください。書類を完成させる前でも、外部の転職支援サービスに準備を相談できます。',
    keywords: '履歴書 職務経歴書 志望動機 書類 応募 準備', link: { href: '/preparation/', label: '転職準備の進め方を見る' } },
  { id: 'still-deciding', category: 'preparation', question: 'まだ転職すると決めていない。何を整理すればいい？',
    answer: '今の仕事で変えたいことと、次の仕事でも守りたい条件を書き出しましょう。収入・勤務時間・通勤・初期費用の優先順位を決め、今の仕事と比べて考えてください。情報収集から入社までの流れを先に知ると、次に確認することを決めやすくなります。',
    keywords: '迷い 相談 検討 退職 在職中 転職するか', link: { href: '/articles/taxi-career-roadmap/', label: '転職までの全体像を見る' } },
  { id: 'service-flow', category: 'service', question: 'ドライバーズワークに登録すると、どう進む？',
    answer: '登録後、担当者が希望条件や状況を聞き、求人紹介や面接の準備を支援する流れです。電話などで連絡があります。連絡できる時間帯に希望があれば担当者に伝えてください。タクゾーの運営者への相談登録ではなく、外部サービスへの登録です。',
    keywords: 'ドライバーズワーク 登録 電話 連絡 流れ 面接 支援 エージェント', link: { href: '/questions/#service-match', label: '紹介される求人について確認する' }, source: { href: 'https://www.drivers-work.com/recruit/flow/', label: 'ドライバーズワーク公式：ご利用の流れ' } },
  { id: 'service-fee', category: 'service', question: '転職相談は無料？ タクゾーで個別相談できる？',
    answer: 'ドライバーズワークは、求職者向けの転職支援を無料で案内しています。タクゾーではLINEや個別の転職相談を受け付けていません。一般的な疑問はこのQ&Aで確認し、求人紹介や応募支援を希望する場合は、ページ内のPRリンクから外部サービスを利用できます。',
    keywords: '無料 料金 費用 相談 LINE ライン 個別 タクゾー ドライバーズワーク', link: { href: '/questions/#service-flow', label: '登録後の流れを確認する' }, source: { href: 'https://www.drivers-work.com/recruit/flow/', label: 'ドライバーズワーク公式：ご利用の流れ' } },
  { id: 'service-match', category: 'service', question: '記事で見た会社を、必ず紹介してもらえる？',
    answer: '紹介を保証していません。希望の会社・営業所の取扱いと現在の募集状況は、登録先で確認してください。このサイトの閲覧内容や検索した言葉は、登録先に自動送信しません。希望の会社や条件は、ご自身で担当者に伝えてください。',
    keywords: '紹介 会社 営業所 取扱い 応募 保証 希望 自動送信', link: { href: '/preparation/', label: '相談前に希望条件を整理する' } },
];
