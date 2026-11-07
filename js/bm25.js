// BM25 检索核心。纯 JS，无依赖，浏览器和 node 都能跑。
var BM25 = (function () {
  var K1 = 1.5, B = 0.75;

  // 查询扩展：左边出现，就补上右边这些词。想加同义词改这里。
  var SYN = {
    '难过': '伤心 低落 emo 忧郁 失落',
    '伤心': '难过 低落 忧郁 悲伤',
    'emo': '忧郁 难过 深夜',
    '低落': '难过 忧郁 安静',
    '写代码': '专注 学习 纯音乐 工作',
    '编程': '专注 学习 纯音乐 工作',
    '学习': '专注 读书 自习 纯音乐',
    '自习': '专注 学习 安静',
    '通勤': '路上 地铁 上班 节奏',
    '开车': '公路 路上 旅行',
    '上高速': '公路 旅行 开窗',
    '开心': '欢快 明亮 轻松',
    '高兴': '欢快 明亮 轻松',
    '跑步': '运动 燃 能量 节奏',
    '健身': '运动 燃 能量 节奏',
    '运动': '跑步 燃 能量 节奏',
    '睡觉': '睡前 助眠 安静 放松',
    '睡前': '安静 放松 月光 助眠',
    '失眠': '深夜 安静 睡前',
    '失恋': '分手 悲伤 遗憾 回忆',
    '分手': '失恋 愤怒 悲伤',
    '下雨': '雨天 安静 潮湿',
    '雨天': '安静 低落 纯音乐',
    '夏天': '夏日 阳光 轻快 清新',
    '怀旧': '回忆 老歌 经典 感伤',
    '毕业': '离别 青春 校园 感伤',
    '聚会': '派对 欢快 舞曲 节奏',
    '派对': '舞曲 欢快 节奏',
    '燃': '热血 励志 激昂 能量',
    '励志': '热血 力量 奋斗 希望',
    '吵架': '愤怒 力量 摇滚',
    '旅行': '公路 上高速 自由 轻快',
    '一个人': '孤独 安静 深夜',
    '孤独': '深夜 安静 忧郁',
    '写作业': '专注 学习 安静 纯音乐'
  };

  var STOP_CHAR = '的了是在和就都一个我你他她它这那有也很还要吗呢吧啊哦嗯把被给对从到与及或而而且但不过因为所以如果';
  var STOP_BI = { '的歌': 1, '一首': 1, '什么': 1, '适合': 1, '一些': 1, '推荐': 1, '想要': 1, '想听': 1, '听点': 1, '有点': 1, '喜欢': 1, '感觉': 1 };

  function isCJK(c) { return c >= '\u4e00' && c <= '\u9fa5'; }

  // 中文切成「单字 + 双字」，英文数字整词；单字权重低，双字权重高。
  function tokenize(text) {
    var out = [];
    var norm = String(text).toLowerCase().replace(/[^\u4e00-\u9fa5a-z0-9]+/g, ' ');
    var chunks = norm.split(/\s+/);
    for (var k = 0; k < chunks.length; k++) {
      var ch = chunks[k];
      if (!ch) continue;
      if (/^[a-z0-9]+$/.test(ch)) { out.push({ t: ch, w: 1 }); continue; }
      for (var i = 0; i < ch.length; i++) {
        var c = ch[i];
        if (isCJK(c) && STOP_CHAR.indexOf(c) === -1) out.push({ t: c, w: 0.3 });
      }
      for (var j = 0; j + 1 < ch.length; j++) {
        var bg = ch[j] + ch[j + 1];
        if (!STOP_BI[bg]) out.push({ t: bg, w: 1 });
      }
    }
    return out;
  }

  function expand(query) {
    var extra = '';
    // 中文别名：ALIAS 定义在 music.js
    if (typeof ALIAS !== 'undefined') {
      for (var ak in ALIAS) {
        if (query.indexOf(ak) !== -1) extra += ' ' + ALIAS[ak];
      }
    }
    for (var key in SYN) {
      if (query.indexOf(key) !== -1) extra += ' ' + SYN[key];
    }
    return query + extra;
  }

  function index(songs) {
    var docs = songs.map(function (s) {
      var text = [s.title, s.artist, s.tags, s.desc, s.year].join(' ');
      var toks = tokenize(text);
      var tf = {};
      toks.forEach(function (x) { tf[x.t] = (tf[x.t] || 0) + 1; });
      return { song: s, tf: tf, len: toks.length };
    });
    var df = {};
    docs.forEach(function (d) {
      for (var t in d.tf) df[t] = (df[t] || 0) + 1;
    });
    var avgdl = docs.reduce(function (a, d) { return a + d.len; }, 0) / (docs.length || 1);
    return { docs: docs, df: df, avgdl: avgdl, N: docs.length };
  }

  function search(idx, query, topK) {
    topK = topK || 8;
    var qToks = tokenize(expand(query));
    // 同一个词只算一次，权重取最大
    var qWeight = {};
    qToks.forEach(function (x) {
      qWeight[x.t] = Math.max(qWeight[x.t] || 0, x.w);
    });
    var scored = idx.docs.map(function (d) {
      var score = 0, hits = [];
      for (var t in qWeight) {
        var tf = d.tf[t];
        if (!tf) continue;
        var df = idx.df[t] || 1;
        var idf = Math.log(1 + (idx.N - df + 0.5) / (df + 0.5));
        var s = qWeight[t] * idf * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / idx.avgdl));
        if (s > 0) { score += s; hits.push({ t: t, s: s }); }
      }
      return { song: d.song, score: score, hits: hits };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.filter(function (x) { return x.score > 0; }).slice(0, topK);
    var max = top.length ? top[0].score : 1;

    return top.map(function (x) {
      var tags = x.song.tags.split(',');
      var matched = tags.filter(function (tag) {
        return x.hits.some(function (h) { return h.t.length > 1 && tag.indexOf(h.t) !== -1; });
      }).slice(0, 3);
      return {
        song: x.song,
        score: Math.round(x.score * 100) / 100,
        // 是否命中至少一个二元词（单字沾边不算），供上层过滤凑数结果
        strong: x.hits.some(function (h) { return h.t.length > 1; }),
        pct: Math.round((x.score / max) * 100),
        matchedTags: matched
      };
    });
  }

  return { index: index, search: search, tokenize: tokenize };
})();

if (typeof module !== 'undefined') module.exports = BM25;
