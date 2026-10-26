// Migrated from the verified comparison preview on 2026-10-13.
// Data is curated locally, not supplied by visitors.
// 掲載内容の確認日：2026-10-12。未確認は「なし」や0に変換しない。
// 通常勤務を比較。会社ごとの出典・条件は各レコードに保持する。
const extraCompanies = [
  {
    id:'4',name:'省東自動車',area:'板橋区',address:'板橋区前野町6-11-1',pay:'AB',rate:68,
    bonus:30,bonusText:'最大30万円',bonusStatus:'yes',guarantee:'25万 × 3か月',dorm:'5.5万円',dormStatus:'yes',vehicle:'introduced',apps:['S.RIDE'],
    source:'https://www.tenshokudou.com/detail/6306',license:'全額会社負担',
    notes:{holiday:'63%',text:'支援金は入社後約3か月・規定あり。月10乗務の別求人は一種免許保有者15万円。応募する求人の金額を確認。JPNは95％以上。',official:'https://www.shoto-motor.co.jp/recruit.html'},
    sources:[['タウンワーク','https://townwork.net/viewjob/jobid_17d7ce6df33c3b8d/']]
  },
  {
    id:'5',name:'栄泉交通',area:'江東区',address:'江東区東陽5-29-43',pay:'AB',rate:60,rateMore:true,
    guarantee:'最大35万 × 6か月',dorm:'5万円〜',dormStatus:'yes',vehicle:'introduced',apps:['GO'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/4652',
    notes:{text:'歩合は「社員最高60％以上」の掲載。正確な上限は未確認。寮は先着20名・最大6か月無料。報奨金最大50万円の未経験者への適用・支給時期は未確認。',official:'https://www.eisen-kotsu.com/'}
  },
  {
    id:'6',name:'坂本自動車',office:'本社・足立',area:'台東区',address:'台東区日本堤2-36-10',pay:'B',rate:null,
    locations:[{office:'本社営業所',area:'台東区',address:'台東区日本堤2-36-10'},{office:'足立営業所',area:'足立区',address:'足立区梅島2-8-2'}],
    guarantee:'40万 × 6か月',dorm:'あり<br>月額未確認',dormStatus:'yes',accident:'修理・賠償の請求なし',vehicle:'all',apps:['GO'],license:'全額会社負担',
    source:'https://townwork.net/viewjob/jobid_d8809548c862f2b8/',sourceLabel:'タウンワーク',
    notes:{text:'本社・足立は掲載上の主要待遇が共通。10月1日更新の直接採用求人では両営業所とも最高歩合の数値記載なし。以前の64％は現行適用未確認。祝い金30万円は経験者向け。未経験の住宅支援は寮満室時・最大40万円（初期費用最大10万円＋月2.5万円×1年）、受取条件・時期は要確認。寮の空室・家賃は営業所ごとに確認。',official:'https://taxi-sakamotojidousya.com/mid_career/'},
    sources:[['給与型（公式）','https://sakamotojidousha.jp/7397/'],['本社・2026-10-13確認','https://arwrk.net/recruit/amigs05xv94ne0d/12814359/'],['足立・2026-10-13確認','https://arwrk.net/recruit/amigs05xv94ne0d/12801530/']]
  },
  {
    id:'7',name:'新和自動車',office:'本社営業所',area:'江東区',address:'江東区亀戸3-51-10',pay:'B',rate:60,
    bonus:20,bonusText:'20万円',bonusStatus:'yes',guarantee:'31万 × 6か月',dorm:'なし<br>住宅支援あり',dormStatus:'no',accident:'本人負担なし',vehicle:'introduced',apps:['S.RIDE','フルクル'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/3800',
    notes:{text:'積算歩合60％＋残業代・深夜時間給。支援金20万円は転職道経由・規定あり。別途、住居初期費用20万円まで（一都三県外からの転居など）。併給条件未確認。ハイヤーのアプリ・賃金は別条件。',official:'https://shinwa-taxi.jp/recruit/guideline.php'}
  },
  {
    id:'8',name:'京北自動車交通',office:'本社営業所',area:'豊島区',address:'豊島区池袋1-16-28',pay:'AB',rate:64,rateMore:true,
    guarantee:'35万 × 3か月',dorm:'12か月無料<br>以降は補足',dormStatus:'yes',vehicle:'introduced',apps:['S.RIDE'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/5322',
    notes:{text:'社員はAB型、定時制はB型。最高64％以上の上限・賞与算入は未確認。祝い金50万円は経験者向け。寮はタイプ・入居期間で費用が変わるため契約時確認。',official:'https://keihoku-job.amebaownd.com/'}
  },
  {
    id:'9',name:'栄交通',office:'本社営業所',area:'大田区',address:'大田区大森南2-2-20',pay:'B',rate:64,
    bonus:5,bonusText:'5万円',bonusStatus:'yes',guarantee:'30万 × 6か月',dorm:'2.5万円〜',dormStatus:'yes',vehicle:'introduced',apps:['S.RIDE'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/3845',
    notes:{text:'支援金は未経験5万円／経験者30万円。支給時期・返還条件は未確認。借上げ寮は5万円〜。同名の他県の会社とは別。'},
    sources:[['ドラEVER','https://doraever.jp/company/556074']]
  },
  {
    id:'10',name:'東京ワールド交通',area:'江東区',address:'江東区有明3-5-7 TOC有明イースト13階',pay:'B',rate:64,
    bonus:50,bonusText:'50万円',bonusStatus:'yes',guarantee:'40万 × 3か月<br>＋35万 × 9か月',vehicle:'all',apps:['GO'],license:'会社負担',
    source:'https://www.tenshokudou.com/detail/1947',
    notes:{text:'支援金は転職道で経験不問50万円、バイトルでは40万円。応募先で金額・支給日を確認。保証も転職道の見出しは435万円、本文は35万×12か月と不一致。表は見出しを採用。事故保険加入、本人負担額は未確認。',official:'https://recruit.jobcan.jp/tokyoworld-taxi/job_offers/1312062'},
    sources:[['バイトル','https://www.baitoru.com/jobdetail/160011131'],['P-CHAN','https://p-chan.jp/taxi/job-offer/7447']]
  },
  {
    id:'11',name:'日本自動車交通',area:'中野区',address:'中野区大和町1-68-7',pay:'AB',rate:63,rateBasis:'賞与込み',
    bonus:20,bonusText:'20万円',bonusStatus:'yes',dorm:'3.7万円〜',dormStatus:'yes',vehicle:'introduced',apps:['GO'],license:'会社負担',
    source:'https://www.tenshokudou.com/detail/4407',
    notes:{holiday:'65%',text:'通常63％は月営収44.8万円超・賞与込み。公式には60〜62％の記載もあり現行規定を確認。支援金20万円は正社員。家族寮対応、敷金礼金会社負担。',official:'https://recruit.nihonjidoushakoutsu.co.jp/lp1/会社紹介/'},
    sources:[['ドライバーズワーク','https://www.drivers-work.com/job/taxi6402/']]
  },
  {
    id:'12',name:'京西交通',area:'三鷹市',address:'三鷹市牟礼1-14-4',pay:'B',rate:64.5,rateBasis:'諸手当込み',
    bonus:20,bonusText:'20万円',bonusStatus:'yes',guarantee:'32万 × 3か月<br>または30万 × 6か月',dorm:'1年無料<br>2〜3年目 2万円',dormStatus:'yes',accident:'事故控除なし',vehicle:'all',apps:['GO'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/32',
    notes:{text:'64.5％はバイトル検索掲載の歩合＋割増・固定手当。本文直接取得は未了。転職道は平均賃金比率60％以上と記載。未経験支援金20万円は規定あり。寮4年目以降未確認。'},
    sources:[['バイトル（歩合）','https://www.baitoru.com/jobdetail/145321090']]
  },
  {
    id:'13',name:'エコシステム',office:'新木場営業所',area:'江東区',address:'江東区新木場1-11-14',pay:'B',rate:64,
    bonus:90,bonusText:'最大90万円',bonusStatus:'yes',bonusLabel:'最大・分割<br>免許費用を含む',guarantee:'時給保証<br>金額未確認',accident:'保険・共済あり<br>本人負担は未確認',vehicle:'unknown',vehicleText:'レクサス導入<br>JPNは未確認',apps:['GO','Uber','DiDi','ECO','LINE'],license:'支援金から充当',
    source:'https://www.tenshokudou.com/detail/5132',
    notes:{text:'74％は支援金の加算期間を含むため通常64％で比較。未経験支援は12か月の売上連動・累計90万円まで。二種費用を同じ枠から差し引くため、現金90万円の一括支給ではない。',official:'https://driver.eco-taxi.jp/'}
  },
  {
    id:'14',name:'グリーンキャブ',office:'赤羽営業所',area:'北区',address:'北区浮間5-4-43',pay:'AB',rate:60,rateMore:true,
    bonus:10,bonusText:'10万円',bonusStatus:'yes',guarantee:'38万 × 6か月<br>残り6か月は額未確認',dorm:'あり<br>月額未確認',dormStatus:'yes',accident:'弁償金会社負担',apps:['S.RIDE'],license:'全額会社負担',
    source:'https://takunavi.jp/detail/14/',sourceLabel:'タクナビ',
    notes:{text:'最高歩合は「60％以上」の掲載で上限未確認。生活支援10万円はタクナビ経由の企業支給。支給時期は未確認。保証は勤務時間等の条件あり。他営業所の待遇へ流用しない。',official:'https://greencab.co.jp/recruit-middle/'},
    sources:[['給与型の求人','https://taxi-job.net/green-cab-kita-ku-akabane-office-taxi-job/']]
  },
  {
    id:'15',name:'境交通',area:'三鷹市',address:'三鷹市深大寺2-36-1',pay:'AB',rate:64,
    guarantee:'3か月<br>金額未確認',dorm:'あり<br>月額未確認',dormStatus:'yes',accident:'数万円の免責<br>上限未確認',vehicle:'introduced',apps:['S.RIDE'],license:'全額会社負担',
    source:'https://sakai-kotu.co.jp/article/news/recruit',sourceLabel:'公式採用',
    notes:{text:'事故は基本会社補償、数万円の免責あり。具体的な上限は未確認。寮は自社アパート・空室確認が必要。公式採用ページは更新日記載なし。'}
  },
  {
    id:'16',name:'代々木自動車',area:'渋谷区',address:'渋谷区初台2-6-9',pay:'AB',rate:62,
    bonus:50,bonusText:'50万円',bonusStatus:'yes',guarantee:'30万 × 6か月',dorm:'あり<br>月額未確認',dormStatus:'yes',vehicle:'all',apps:['GO'],license:'全額会社負担',
    source:'https://www.yoyogi.co.jp/qjin',sourceLabel:'公式採用',accident:'補償・負担とも未確認',
    notes:{text:'事故補償の具体的な掲載は未確認。歩合の賞与算入、支援金の支給時期・返還条件も未確認。'},
    sources:[['公式Q&A','https://www.yoyogi.co.jp/qa']]
  },
  {
    id:'17',name:'城西タクシー',area:'中野区',address:'中野区松が丘2-31-14',rate:64,
    bonus:30,bonusText:'最大30万円',bonusLabel:'最大・住宅支援',bonusStatus:'yes',guarantee:'30万 × 3か月',vehicle:'introduced',apps:['GO'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/7003',
    notes:{text:'30万円は住宅支援。都外からの転居限定との読者情報あり。対象・支給時期・受取方法は会社へ確認。B型との読者情報はあるが、今回の公開求人で型を確認できず。事故負担の上限5万円・10％との読者情報も契約条件は未確認。'},
    sources:[['東京無線','https://www.tokyomusen.or.jp/lp/recruit/member/195/']]
  },
  {
    id:'18',name:'AYA交通',area:'板橋区',address:'板橋区高島平8-1-1',pay:'B',dorm:'あり<br>月額未確認',dormStatus:'yes',vehicle:'introduced',apps:['GO','Uber','DiDi'],
    source:'https://www.tenshokudou.com/detail/3920',
    notes:{text:'現行の最高歩合は未確認。過去求人の60.95％は最新値と断定せず表に採用しない。祝い金50万円は現任・経験者向け。寮は空室確認が必要。',official:'https://aya-koutsu.com/recruit/'}
  },
  {
    id:'19',name:'宮城交通',area:'豊島区',address:'豊島区西池袋4-24-12',pay:'AB',rate:66.89,rateMore:true,rateBasis:'隔日・賞与込み',
    guarantee:'32万 × 3か月',accident:'本人負担なし',vehicle:'introduced',apps:['S.RIDE','DiDi'],license:'会社負担',
    source:'https://www.tenshokudou.com/detail/4184',
    notes:{holiday:'66%',text:'歩合は隔日66.89％以上・夜勤67.6％以上。売上に応じ変動し上限なしとの掲載。祝い金は転職道最大40万円、P-CHANは二種保有者限定30万円。未経験への適用は未確認。保証額も媒体差あり。'},
    sources:[['P-CHAN','https://p-chan.jp/taxi/job-offer/19261']]
  },
  {
    id:'20',name:'日の出交通',area:'足立区',address:'足立区本木1-25-7',pay:'B',guarantee:'30万 × 6か月',vehicle:'introduced',apps:['GO','Uber'],license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/4942',
    notes:{text:'掲載には62％以上・最高80％超・平均67％が混在。通常勤務の最高率が特定できず数値比較は未確認。入社祝い金制度の表示はあるが、未経験対象額と寮は未確認。'}
  },
  {
    id:'21',name:'岩槻タクシー',office:'東京営業所',area:'足立区',address:'足立区西綾瀬4-5-13-101',pay:'B',rate:60,dorm:'あり<br>月額未確認',dormStatus:'yes',vehicle:'introduced',apps:['GO'],
    source:'https://www.tenshokudou.com/detail/3956',
    notes:{text:'応募資格は二種免許保有者。免許を持たない未経験者の養成採用は未確認。埼玉の営業所ではなく東京営業所の条件。'}
  },
  {
    id:'22',name:'東日本交通',area:'渋谷区',address:'渋谷区笹塚',dorm:'あり<br>月額未確認',dormStatus:'yes',apps:['GO'],license:'会社負担',accident:'免責あり<br>金額未確認',
    source:'https://www.tenshokudou.com/detail/3792',
    notes:{text:'現在の求人は積算歩合表記。過去媒体のAB型・64％は現行と照合できず未確認。所在地の番地も今回未確認。'},
    sources:[['過去掲載（参考）','https://takicorporation.com/taxijob/1141']]
  },
  {
    id:'23',name:'平和タクシー',area:'江戸川区',address:'江戸川区',pay:'B',rate:64,accident:'補償・負担とも未確認',
    source:'https://www.heiwa-taxi.tokyo/Joboffer.html',sourceLabel:'公式採用',
    notes:{text:'月営収60万円で64％。公出を含む最高67％とは区別。祝い金10万円は経験者向け。未経験向け支援・寮・事故補償の確認が必要。番地は未確認。'}
  },
  {
    id:'24',name:'幸進',area:'未確認',address:'未確認',rate:65,dorm:'あり<br>月額未確認',dormStatus:'yes',vehicle:'all',accident:'補償・負担とも未確認',
    source:'https://koushintaxi.tokyo/recruit',sourceLabel:'公式採用',
    notes:{text:'二種免許とタクシーセンター講習済みが応募条件。未経験の養成、B／AB型、事故補償、営業区域・所在地は未確認。'}
  },
  {
    id:'25',name:'品川タクシー',area:'未確認',address:'未確認',pay:'AB',rate:60,guarantee:'30万 × 6か月',license:'全額会社負担',
    source:'https://www.tenshokudou.com/detail/6325',
    notes:{text:'祝い金30万円は二種免許保有者向け。免許なし未経験への支援・寮は未確認。所在地を確認後に地図を追加。同名に近い品川自動車タクシーとは別。'}
  },
  {
    id:'26',name:'帝都三信交通',area:'大田区',address:'大田区',rate:63,dorm:'あり<br>月額未確認',dormStatus:'yes',
    source:'https://www.drivers-work.com/job/taxi6500/',sourceLabel:'ドライバーズワーク',
    notes:{text:'掲載の歩合45〜63％。B／AB型、未経験支援、事故補償の詳細は未確認。番地は未確認。'}
  },
  {
    id:'27',name:'松竹交通',office:'板橋・舟渡',area:'板橋区',address:'板橋区舟渡1-16-35',pay:'B',guarantee:'35万 × 6か月',dorm:'あり<br>月額未確認',dormStatus:'yes',vehicle:'introduced',apps:['GO'],license:'全額会社負担',
    locations:[{office:'板橋営業所',area:'板橋区',address:'板橋区舟渡1-16-35'},{office:'舟渡営業所',area:'板橋区',address:'板橋区舟渡2-11-6 松竹ビル'}],
    source:'https://www.tenshokudou.com/detail/4987',
    notes:{text:'板橋・舟渡は求人に「同一勤務条件」と明記。売上63％還元の掲載あり。ただし最高率としての上限は未確認。未経験支援金・事故補償の詳細、寮の空室は未確認。'},
    sources:[['両営業所・2026-10-13確認','https://www.baitoru.com/jobdetail/162859255'],['公式営業所一覧','https://shochiku-group.com/shochiku/会社案内/関連会社・営業所/']]
  },
  {
    id:'28',name:'七福交通',area:'江東区',address:'江東区亀戸',pay:'B',apps:['GO'],
    source:'https://www.tenshokudou.com/detail/4981',
    notes:{text:'最高74％の勤務条件・内訳を確認できず、通常最高歩合は未確認。現任向け10万円を未経験向けへ転記しない。寮・事故負担・番地も未確認。'}
  },
  {
    id:'29',name:'新都交通',area:'未確認',address:'未確認',pay:'B',
    source:'https://www.tenshokudou.com/detail/6437',
    notes:{text:'月給60〜65万円の掲載を歩合60〜65％と読み替えない。最高歩合・支援・寮・事故補償・対象営業区域を追加確認。'}
  },
  {
    id:'30',name:'東京合同自動車',area:'未確認',address:'未確認',rate:62,bonusText:'なし',bonusStatus:'no',bonusLabel:'現任のみ',accident:'補償あり<br>負担額未確認',guarantee:'30万 × 6か月',dorm:'あり<br>月額未確認',dormStatus:'yes',license:'会社負担',
    source:'https://www.promenkyo.com/job/tokyo/tokyo-godo/',sourceLabel:'プロ免許',
    notes:{holiday:'70%',text:'運営者提供情報：休日出勤の歩合は70％（1日あたり税抜売上6万円以上）。4月の運賃改定に合わせ通常の最高歩合を62％へ変更。事故補償あり、支援金は現任のみ。事故の本人負担額は未確認。給与型・所在地、拘束時間に関する控除の現行条件は追加確認。'}
  }
];


const companies=[
{id:'0',name:'ミツワ交通',office:'',area:'墨田区',address:'墨田区文花3-16-1',pay:'B',rate:62,rateNote:false,bonus:20,bonusText:'20万円',bonusStatus:'yes',guarantee:'40万 × 3か月<br>＋35万 × 9か月',dorm:'2.15〜7.5万円',dormStatus:'yes',accident:'未確認',vehicle:'all',apps:['GO'],source:'https://www.tenshokudou.com/detail/3798'},
{id:'1',name:'サンベスト東信',office:'舟渡営業所',area:'板橋区',address:'板橋区舟渡1-19-9',pay:'B',rate:63,rateNote:true,bonus:null,bonusText:'未確認',bonusStatus:'unknown',guarantee:'30万 × 3か月<br>または<br>25万 × 10か月',dorm:'3.7〜6.3万円',dormStatus:'yes',accident:'未確認',vehicle:'introduced',apps:['GO','S.RIDE','Uber','DiDi'],source:'https://www.tenshokudou.com/detail/6305'},
{id:'2',name:'山手観光自動車',office:'足立入谷営業所',area:'足立区',address:'足立区入谷9-18-5',pay:'B',rate:63,rateNote:true,bonus:null,bonusText:'未確認',bonusStatus:'unknown',guarantee:'30万 × 3か月<br>または<br>25万 × 10か月',dorm:'2.3万円',dormStatus:'yes',accident:'未確認',vehicle:'introduced',apps:['GO','S.RIDE','Uber','DiDi'],source:'https://www.tenshokudou.com/detail/6304'},
{id:'3',name:'昭和自動車',office:'本社営業所',area:'練馬区',address:'練馬区貫井2-16-21',pay:'B',rate:null,rateNote:false,bonus:30,bonusText:'最大30万円',bonusStatus:'yes',guarantee:'45万 × 6か月<br>または<br>30万 × 12か月',dorm:'未確認',dormStatus:'unknown',accident:'修理費なし',vehicle:'introduced',apps:['GO'],source:'https://www.tenshokudou.com/detail/4246'}
];
const selectedIds=new Set();
// Employer listings checked 2026-10-12; repayment terms not confirmed.
const licenseSupport={
'0':{cost:'全額会社負担',note:'二種免許：退職時の返済条件は未確認。'},
'1':{cost:'全額会社負担',note:'二種免許：社内規定あり。64〜70歳の養成は立替の記載あり。適用・返済条件は未確認。'},
'2':{cost:'全額会社負担',note:'二種免許：退職時の返済条件は未確認。'},
'3':{cost:'全額会社負担',note:'二種免許：退職時の返済条件は未確認。'}
};
const companyNotes={
'0':{holiday:'64%',text:'支援金は本乗務開始時。<br>給与保証は隔日勤務。<br>個室寮あり。',official:'https://www.mitsuwa-t.co.jp/entry'},
'1':{text:'※63％は求人掲載値。勤務形態・売上条件は未確認。<br>寮費6か月無料など。対象条件は未確認。'},
'2':{text:'※63％は求人掲載値。勤務形態・売上条件は未確認。<br>足立入谷の条件。<br>寮は光熱費別・一部設備共同。'},
'3':{holiday:'80%以上',text:'休日歩合は条件あり。<br>支援金の支給日・現行条件は未確認。<br>給与保証は隔日勤務。<br>全車JPN TAXI化は予定。',official:'https://www.showajidosha.jp/con02/'}
};
// Missing facts remain unknown; all research candidates share the same table.
for(const item of extraCompanies){
  const c={office:'',pay:null,rate:null,rateNote:false,bonus:null,bonusText:'未確認',bonusStatus:'unknown',guarantee:'未確認',dorm:'未確認',dormStatus:'unknown',accident:'未確認',vehicle:'unknown',apps:[],...item};
  companies.push(c);
  companyNotes[c.id]=c.notes;
  licenseSupport[c.id]={cost:c.license||'未確認',note:c.license==='支援金から充当'?'二種免許費用は支援金と別枠ではありません。退職時の返済条件は未確認。':'二種免許費用の適用・退職時の返済条件は未確認。'};
}
companyNotes['3'].text+='通常勤務の最高歩合は未確認。';
const locations=c=>c.locations||[{office:c.office,area:c.area,address:c.address}];
const companyCount=list=>new Set(list.map(c=>c.companyId||c.name)).size;
const areaSelect=document.getElementById('filter-area');
areaSelect.replaceChildren(new Option('すべて',''),...[...new Set(companies.flatMap(c=>locations(c).map(l=>l.area)))].map(area=>new Option(area,area)));
const appSelect=document.getElementById('filter-app');
appSelect.replaceChildren(new Option('すべて',''),...[...new Set(companies.flatMap(c=>c.apps))].map(app=>new Option(app,app)));
let visibleCompanies=[];
const value=id=>document.getElementById(id).value;
function maps(c,l=locations(c)[0]){const u=new URL('https://www.google.com/maps/search/');u.searchParams.set('api','1');u.searchParams.set('query',c.name+' '+l.office+' 東京都'+l.address);return u.href;}
// Keep comparisons short without discarding the original conditions.
const compactFields={
  '7':{dorm:'なし'},
  '8':{dorm:'12か月無料'},
  '13':{guarantee:'未確認',vehicleText:'レクサス導入'},
  '14':{guarantee:'38万 × 6か月'},
  '15':{guarantee:'未確認'}
};
function compactValue(c,key){
  return compactFields[c.id]?.[key]??(c[key]?.includes('未確認')?'未確認':c[key]);
}
function guaranteeLines(c){
  return compactValue(c,'guarantee').match(/\d+(?:\.\d+)?万\s*×\s*\d+か月/g)||[];
}
function guaranteeMarkup(c){
  const lines=guaranteeLines(c);
  return lines.length?'<div class="guarantees">'+lines.slice(0,3).map(line=>'<span class="guarantee-line">'+line+'</span>').join('')+'</div>':'未確認';
}
function detailMarkup(c){
  const escapeHtml=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const groups=new Map(['歩合','入社支援金','給与保証','寮','事故','車両','二種免許','その他'].map(label=>[label,[]]));
  const add=(label,text)=>{if(text)groups.get(label).push(text.replaceAll('<br>','・').replace('・以降は補足','').trim());};
  if(c.rateBasis)add('歩合',c.rateBasis);
  if(c.bonusLabel)add('入社支援金',c.bonusLabel);
  else if(c.bonusText.startsWith('最大'))add('入社支援金',c.bonusText);
  if(guaranteeLines(c).length>1||c.guarantee.includes('最大')||compactValue(c,'guarantee')!==c.guarantee)add('給与保証',c.guarantee.replaceAll('<br>',' ').replace(/\s+/g,' '));
  for(const [key,label] of [['dorm','寮'],['accident','事故'],['vehicleText','車両']]){
    if(c[key]&&compactValue(c,key)!==c[key])add(label,c[key]);
  }
  const category=text=>{
    if(/二種免許|二種費用|免許費用|返済|養成/.test(text))return '二種免許';
    if(/事故|免責|弁償|本人負担|保険|共済/.test(text))return '事故';
    if(/寮|住宅|住居|転居|家賃|敷金|礼金/.test(text))return '寮';
    if(/給与保証|保証額|時給保証|保証も|保証は/.test(text))return '給与保証';
    if(/支援金|未経験支援|祝い金|報奨金|入社金/.test(text))return '入社支援金';
    if(/歩合|売上|営収|賃金比率/.test(text))return '歩合';
    if(/車両|JPN|レクサス|アプリ/.test(text))return '車両';
    return 'その他';
  };
  for(const sentence of companyNotes[c.id].text.split(/<br\s*\/?>|(?<=。)/).map(s=>s.trim()).filter(Boolean))add(category(sentence),sentence);
  add('二種免許',licenseSupport[c.id].note);
  return [...groups].filter(([,items])=>items.length).map(([label,items])=>'<section class="detail-group"><h3>'+label+'</h3>'+items.map(item=>'<p>'+escapeHtml(item)+'</p>').join('')+'</section>').join('');
}
const rows=[
['最高<br>歩合率',c=>'<div class="primary-value">'+(c.rate===null?'未確認':'<span class="rate">'+c.rate+'%</span>'+(c.rateMore?'<span class="rate-suffix">以上</span>':'')+(c.rateNote?'<sup>※</sup>':''))+'</div>'+(companyNotes[c.id].holiday?'<span class="holiday">休日出勤<br><strong>'+companyNotes[c.id].holiday+'</strong></span>':'')],
['給与型',c=>c.pay?c.pay+'型':'未確認'],
['入社<br>支援金',c=>'<div class="primary-value">'+(c.bonus===null?c.bonusText:'<span class="amount">'+c.bonus+'<small>万円</small></span>')+'</div>'],
['給与<br>保証',guaranteeMarkup],
['二種<br>免許<br>費用',c=>licenseSupport[c.id]?.cost||'未確認'],
['寮<br>月額',c=>compactValue(c,'dorm')],
['事故<br>負担',c=>compactValue(c,'accident')],
['車両',c=>compactValue(c,'vehicleText')||(c.vehicle==='unknown'?'未確認':'JPN TAXI<span class="minor">'+(c.vehicle==='all'?'全車':'導入あり')+'</span>')],
['配車<br>アプリ',c=>c.apps.length?c.apps.join('・<wbr>'):'未確認'],
['所在地',c=>locations(c).map(l=>'<div>'+(locations(c).length>1?'<strong>'+l.office+'</strong><br>':'')+(l.address==='未確認'?'未確認':l.address+'<br><a class="map" href="'+maps(c,l)+'" target="_blank" rel="noopener noreferrer" aria-label="'+c.name+' '+l.office+'をGoogleマップで見る（別タブ）">地図 ↗</a>')+'</div>').join('')],
['補足',c=>'<button class="detail-button" type="button" data-details="'+c.id+'" aria-label="'+c.name+'の補足を開く">詳細</button>']
];
function ordered(list){const mode=value('sort-order');return [...list].sort((a,b)=>{if(mode==='default')return Number(a.id)-Number(b.id);const key=mode==='rate'?'rate':'bonus';if(a[key]===null&&b[key]===null)return Number(a.id)-Number(b.id);if(a[key]===null)return 1;if(b[key]===null)return -1;return b[key]-a[key]||Number(a.id)-Number(b.id);});}
function tableMarkup(list,selectable){
  const controls='<tr class="comparison-actions"><th scope="row">比較</th>'+list.map(c=>'<td>'+(selectable?'<label class="pick"><input type="checkbox" value="'+c.id+'" '+(selectedIds.has(c.id)?'checked':'')+' aria-label="'+c.name+' '+c.office+'を比較に追加">比較</label>':'<button class="remove" type="button" data-remove="'+c.id+'" aria-label="'+c.name+' '+c.office+'をピックアップから外す">外す</button>')+'</td>').join('')+'</tr>';
  const names='<tr><th scope="col">会社名</th>'+list.map(c=>'<th scope="col"><span class="company-name">'+c.name+'</span><span class="office">'+c.office+'</span></th>').join('')+'</tr>';
  return '<table><caption class="sr-only">'+(selectable?'全体比較':'ピックアップ比較')+'</caption><thead>'+controls+names+'</thead><tbody>'+rows.map(([label,render])=>'<tr><th scope="row">'+label+'</th>'+list.map(c=>'<td>'+render(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
}
function renderPicked(){const list=ordered(companies.filter(c=>selectedIds.has(c.id)));document.getElementById('selection-status').textContent='選択 '+list.length+' / 4件';document.getElementById('picked-table').innerHTML=list.length?'<div class="scroll" tabindex="0" role="region" aria-label="選択した会社の比較表。横にスクロールできます">'+tableMarkup(list,false)+'</div>':'<p class="empty">上の表で「比較」にチェック。</p>';}
function renderAll(){visibleCompanies=ordered(companies.filter(c=>(!value('filter-pay')||c.pay===value('filter-pay'))&&(!value('filter-area')||locations(c).some(l=>l.area===value('filter-area')))&&(!value('filter-vehicle')||(value('filter-vehicle')==='introduced'?['all','introduced'].includes(c.vehicle):c.vehicle===value('filter-vehicle')))&&(!value('filter-app')||c.apps.includes(value('filter-app')))&&(!value('filter-bonus')||(value('filter-bonus')==='yes'?c.bonusStatus==='yes':c.bonusStatus!=='yes'))&&(!value('filter-dorm')||(value('filter-dorm')==='yes'?c.dormStatus==='yes':c.dormStatus!=='yes'))));document.getElementById('all-table').innerHTML=visibleCompanies.length?tableMarkup(visibleCompanies,true):'<p class="empty">該当なし。条件を変えてください。</p>';document.getElementById('filter-status').textContent=companyCount(visibleCompanies)+' / '+companyCount(companies)+'社'+(companies.length>companyCount(companies)?'（'+visibleCompanies.length+'件）':'');renderPicked();}
document.getElementById('all-table').addEventListener('change',e=>{if(!e.target.matches('input[type=checkbox]'))return;const input=e.target;if(input.checked&&selectedIds.size>=4){input.checked=false;document.getElementById('selection-status').textContent='最大4件まで選べます';return;}if(input.checked)selectedIds.add(input.value);else selectedIds.delete(input.value);renderPicked();});
document.getElementById('sort-order').addEventListener('change',renderAll);
document.getElementById('comparison-controls').addEventListener('change',renderAll);
document.getElementById('reset-filters').addEventListener('click',()=>{document.querySelectorAll('#comparison-controls select').forEach(s=>s.selectedIndex=0);renderAll();});
document.getElementById('clear-selection').addEventListener('click',()=>{selectedIds.clear();renderAll();});
document.getElementById('picked-table').addEventListener('click',e=>{const button=e.target.closest('[data-remove]');if(!button)return;selectedIds.delete(button.dataset.remove);renderAll();document.getElementById('picked-title').focus({preventScroll:true});});
const detailsDialog=document.getElementById('company-details');
const closeDetails=document.getElementById('close-company-details');
let detailTrigger=null;
document.querySelector('.taxi-comparison').addEventListener('click',e=>{
  const button=e.target.closest('[data-details]');
  if(!button)return;
  const company=companies.find(c=>c.id===button.dataset.details);
  if(!company)return;
  detailTrigger=button;
  document.getElementById('company-details-title').textContent=company.name+(company.office?'（'+company.office+'）':'')+'の補足';
  document.getElementById('company-details-body').innerHTML=detailMarkup(company);
  detailsDialog.showModal();
  closeDetails.focus({preventScroll:true});
});
closeDetails.addEventListener('click',()=>detailsDialog.close());
detailsDialog.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();closeDetails.focus();}});
detailsDialog.addEventListener('close',()=>{if(detailTrigger?.isConnected)detailTrigger.focus({preventScroll:true});detailTrigger=null;});
renderAll();
