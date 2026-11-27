// 屋台の値下げ合戦の問題を作る（ブラウザと node の両方で使う）。
// 1問＝となりの屋台との10日間。毎日「そのまま」か「値下げ」かを同時に選び、10日たったら相手の性格を当てる（正解したら2段目
// 「この相手から、いちばん多くもうけ点を取れるやり方は？」）。点の表は囚人のジレンマ（3・5・0・1）。
// 点の表と性格（作戦）は、R. Axelrod の総当たり戦（1980年）と、ずんだもん解説 GT1「値下げ競争が止まらない理由」の8つの作戦から。
// 点はゲームの中だけで、お金とは関係ない。屋台はすべて架空。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ相手・同じ乱数になる。
// PERS・SCENES の並びや中身は、足すだけでも過去の日の問題が変わる。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const DAYS = 10, SLIP = 0.05;

  // 出典（画面の「なぜ」と「このゲームについて」に出す）
  const SRC = {
    axe: ["R. Axelrod 本人の解説（囚人のジレンマの総当たり戦）", "https://websites.umich.edu/~axe/research/Software/CC/ECHome/ECCitationClassic.html"],
  };

  // もうけ点の表：[あなた, 相手]。K＝そのまま、C＝値下げ（Axelrod の大会と同じ 3/3・0/5・5/0・1/1）
  const PAY = { KK: [3, 3], KC: [0, 5], CK: [5, 0], CC: [1, 1] };
  const pay = (m, y) => PAY[m + y];
  const flip = (x) => (x === "K" ? "C" : "K");

  // 相手の性格。act(h, d) は d 日目（0から）の相手の手。h は前の日までの記録 [{ m: あなたの手, y: 相手の手 }]（うっかりのあとの手）
  const PERS = [
    { id: "tft", name: "お返し屋", em: "🍢", video: "しっぺ返し", rule: "1日目はそのまま。あとは、前の日にあなたがした手をまねする。", act: (h) => (h.length ? h[h.length - 1].m : "K") },
    { id: "grim", name: "根に持つ屋", em: "🍘", video: "根に持つ", rule: "はじめはそのまま。一度でも値下げされたら、最後までずっと値下げ。", act: (h) => (h.some((x) => x.m === "C") ? "C" : "K") },
    { id: "allc", name: "お人よし屋", em: "🍙", video: "いつも協力", rule: "何をされても、ずっとそのまま。", act: () => "K" },
    { id: "alld", name: "がめつい屋", em: "🌽", video: "いつも裏切り", rule: "何があっても、ずっと値下げ。", act: () => "C" },
    { id: "rand", name: "気まぐれ屋", em: "🍧", video: "でたらめ", rule: "毎日、半分の確率で値下げする。どの決まりにも当てはまらない。", act: null },
    { id: "tf2t", name: "がまん屋", em: "🥮", video: "2回まで許す", rule: "2日続けて値下げされたら、次の日だけ値下げで返す。", act: (h) => (h.length >= 2 && h[h.length - 1].m === "C" && h[h.length - 2].m === "C" ? "C" : "K") },
    { id: "pav", name: "調子屋", em: "🍠", video: "うまくいけば続ける", rule: "1日目はそのまま。前の日の点が3か5なら同じ手、0か1なら手を変える。", act: (h) => { if (!h.length) return "K"; const l = h[h.length - 1]; return pay(l.y, l.m)[0] >= 3 ? l.y : flip(l.y); } },
    { id: "zun", name: "ずんだ餅屋", em: "🫛", video: "信用させてから裏切る", rule: "はじめの4日はそのまま。5日目から最後まで、ずっと値下げ。", act: (h) => (h.length < 4 ? "K" : "C") },
  ];
  const PBY = Object.fromEntries(PERS.map((p) => [p.id, p]));

  // 2段目「この相手から、10日でいちばん多くもうけ点を取れるやり方は？（うっかりなし）」の4つ
  const GROUPS = {
    keep: { name: "ずっとそのまま", sub: "10日とも、ふつうの値段" },
    cut: { name: "ずっと値下げ", sub: "10日とも値下げ" },
    tft: { name: "まねして返す", sub: "1日目はそのまま、あとは相手の前の日の手" },
    last: { name: "最後の日だけ値下げ", sub: "9日目まではまねして返し、10日目だけ値下げ" },
  };
  const MY = {
    keep: () => "K",
    cut: () => "C",
    tft: (h) => (h.length ? h[h.length - 1].y : "K"),
    last: (h) => (h.length === DAYS - 1 ? "C" : h.length ? h[h.length - 1].y : "K"),
  };
  // 決まった相手に、うっかりなしで10日戦ったときの点（気まぐれ屋は平均：毎日半分の確率で値下げ）
  function scoreOf(pid, g) {
    const p = PBY[pid];
    if (!p.act) { const e = { K: [3, 0], C: [5, 1] }; let s = 0; for (let d = 0; d < DAYS; d++) { const mv = MY[g]([]) /* 気まぐれ屋は相手を見ないので、keep・cut だけ意味がある */; s += (e[mv][0] + e[mv][1]) / 2; } return g === "keep" || g === "cut" ? s : null; }
    const h = []; let s = 0;
    for (let d = 0; d < DAYS; d++) { const m = MY[g](h), y = p.act(h); h.push({ m, y }); s += pay(m, y)[0]; }
    return s;
  }
  const SCORES = Object.fromEntries(PERS.map((p) => [p.id, Object.fromEntries(Object.keys(GROUPS).map((g) => [g, scoreOf(p.id, g)]))]));
  const bestOf = (pid) => Object.keys(GROUPS).filter((g) => SCORES[pid][g] != null).reduce((a, g) => (SCORES[pid][g] > SCORES[pid][a] ? g : a), "keep");
  const GRP_WHY = {
    tft: "まねする相手には、9日目まではそのままで3点ずつ。最後の日だけ値下げすると、仕返しの日が来ません。",
    grim: "一度でも値下げすると、そこから先はずっと1点ずつ。値下げは、仕返しの来ない最後の日だけにします。",
    allc: "何をしても怒らない相手からは、毎日値下げで5点ずつ取れます。こんな相手は、めったにいません。",
    alld: "ずっと値下げの相手に「そのまま」を出すと0点。値下げで守れば、1点ずつは取れます。",
    rand: "気まぐれ屋は、こちらを見ていません。どの日も、値下げのほうが平均で1.5点多くなります。",
    tf2t: "1日の値下げは許してくれる相手。決まった4つのやり方の中では、最後の日だけ値下げがいちばんです。",
    pav: "そのままどうしが続くと、相手もそのままを続けます。最後の日だけ値下げすると、仕返しの日が来ません。",
    zun: "5日目からはずっと値下げしてくる相手。はじめから値下げしておくと、前の4日で5点ずつ取れます。",
  };

  // 場面（問いの言い方）。お店はすべて架空
  const SCENES = [
    "縁日の初日。となりに、知らない屋台が出ました。",
    "川ぞいの夜市。となりの屋台とは、今日がはじめて。",
    "秋祭りの10日間。となりの屋台の店主は、まだ何も言いません。",
    "駅前の朝市。となりの屋台も、同じくらいの品ぞろえです。",
    "蔵の町のお祭り。となりの屋台と、のれんを並べました。",
  ];

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // 種類＝性格×難しさ（やさしい：選び肢3つ・ふつう：4つ・むずかしい：4つ＋うっかり5%）
  const KINDS = [];
  for (let lv = 0; lv < 3; lv++) for (const p of PERS) KINDS.push({
    id: p.id + lv, pid: p.id, lv, name: p.name, em: p.em, ans: p.name, grp: bestOf(p.id),
    look: "相手の手を1日ずらして、あなたの手とくらべてみよう。",
    key: "残った2つの決まりを、10日の記録に1日ずつ当てはめてみよう。",
    why: `${p.rule}（動画では「${p.video}」の作戦）`,
    src: ["axe"],
  });
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);

  // 1問を作る。tag は「種類|種」（例 "tft1|2026-11-27:d2"）。同じ tag ならいつも同じ相手・同じ乱数
  function make0(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const R = rng(seedOf(tag)), si = ri(R, 0, SCENES.length - 1);
    const rr = [], sm = [], sy = [];
    for (let d = 0; d < DAYS; d++) { rr.push(R()); sm.push(R()); sy.push(R()); } // 毎日3つずつ引く（気まぐれ・あなたのうっかり・相手のうっかり）
    const os = R(); // 選び肢の並べ方の種
    return { tag, kind, pid: k.pid, lv: k.lv, name: k.name, em: k.em, ans: k.ans, grp: k.grp, gwhy: GRP_WHY[k.pid], look: k.look, key: k.key, why: k.why,
      src: k.src.map((s) => SRC[s]), q: SCENES[si], slip: k.lv === 2, rr, sm, sy, os, v: String(si), opts: [] };
  }
  // 選び肢の見本：10日とも「そのまま」で戦ったときの選び肢（遊ぶときは、遊んだ10日の記録から optsFor で作り直す）
  function makeQ(tag) { const P = make0(tag); if (P) P.opts = optsFor(P, replay(P, Array(DAYS).fill("K"))); return P; }
  const keyOf = (P) => `${P.kind}:${P.v}`;

  // 決まった性格が、この記録と1日も食いちがわないか（気まぐれ屋は、どの決まった性格にも当てはまらないとき）
  const DET = PERS.filter((p) => p.act).map((p) => p.id);
  function fits(pid, h) {
    const p = PBY[pid];
    if (!p.act) return !DET.some((id) => fits(id, h));
    for (let d = 0; d < h.length; d++) if (p.act(h.slice(0, d).map((x) => ({ m: x.m, y: x.y }))) !== h[d].y0) return false;
    return true;
  }
  // d 日目：あなたの手 mv から、相手の手と、うっかり（むずかしいだけ）と点を決める。h は前の日までの記録
  function step(P, h, mv) {
    const d = h.length, p = PBY[P.pid], seen = h.map((x) => ({ m: x.m, y: x.y }));
    let y0;
    if (p.act) y0 = p.act(seen);
    else {
      y0 = P.rr[d] < 0.5 ? "C" : "K";
      // 6日目からは、決まった性格に当てはまる数が少なくなる手にする（気まぐれ屋が、たまたま決まった性格と同じ動きにならないように）
      if (d >= 5) { const n = (y) => DET.filter((id) => fits(id, h.concat([{ m: mv, y0: y, y }]))).length; if (n(flip(y0)) < n(y0)) y0 = flip(y0); }
    }
    const ms = P.slip && P.sm[d] < SLIP, ys = P.slip && P.sy[d] < SLIP;
    const m = ms ? flip(mv) : mv, y = ys ? flip(y0) : y0, [a, b] = pay(m, y);
    return { m, y0, y, ms: ms ? 1 : 0, ys: ys ? 1 : 0, a, b };
  }
  // 10日のあと：答えと、記録に当てはまらない性格（やさしい2つ・ほか3つ）を並べる。当てはまる別の性格は出さない（答えが1つに決まる）
  function optsFor(P, h) {
    const n = P.lv === 0 ? 3 : 4, R = rng(seedOf(P.tag + ":o")), others = PERS.filter((p) => p.id !== P.pid && !fits(p.id, h)).map((p) => p.name);
    return shuffle(R, [P.ans, ...pickN(R, others, n - 1)]);
  }
  // 記録をはじめから作り直す（あなたの手の並び moves から）。続きから・別のやり方なら何点だったかに使う
  function replay(P, moves) { const h = []; for (const mv of moves) h.push(step(P, h, mv)); return h; }
  // 同じ相手・同じ乱数で、別のやり方（GROUPS のどれか）で戦ったら何点だったか
  function tryWay(P, g) { const h = []; for (let d = 0; d < DAYS; d++) h.push(step(P, h, MY[g](h.map((x) => ({ m: x.m, y: x.y }))))); return h.reduce((s, x) => s + x.a, 0); }

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), ps = pickN(R, PERS.map((p) => p.id), 5), lvs = [0, 0, 1, 1, 2];
    return ps.map((pid, i) => `${pid}${lvs[i]}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0].replace(/\d$/, ""), R = rng(seedOf("hard:" + date)), ps = pickN(R, PERS.map((p) => p.id).filter((x) => x !== dh), 3);
    return ps.map((pid, i) => `${pid}2|${date}:h${i}`);
  }

  const make = makeQ;
  const YTN = { KINDS, BY, PERS, PBY, GROUPS, GRP_WHY, SCORES, LV, SRC, PAY, DAYS, SLIP, SCENES, MY, pay, kindsOf, seedOf, rng, make, keyOf, fits, step, optsFor, replay, tryWay, dailyTags, hardTags, pickN, bestOf };
  if (typeof module !== "undefined" && module.exports) module.exports = YTN; else root.YTN = YTN;
})(typeof self !== "undefined" ? self : this);
