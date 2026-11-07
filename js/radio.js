// 工具二 · 情绪电台（v1 骨架：心情 → 检索 → 列表 → 记一笔）
var IDX = BM25.index(SONGS);
var MOOD_QUERY = {
  happy: '欢快 明亮 流行 轻快',
  calm:  '安静 温柔 明亮 治愈',
  blue:  '深夜 忧郁 悲伤 孤独',
  anx:   '放松 睡前 安静 治愈',
  tired: '放松 治愈 纯音乐 温柔',
  angry: '愤怒 摇滚 躁 叛逆',
  miss:  '思念 怀旧 温柔 民谣',
  up:    '热血 能量 节奏 派对'
};
var radioMoods = ['calm'];   // 多选；空数组 = 不限

function logMood(k) {
  try {
    var arr = JSON.parse(localStorage.getItem('ml-log') || '[]');
    arr.push({ d: new Date().toISOString().slice(0, 10), k: k });
    localStorage.setItem('ml-log', JSON.stringify(arr.slice(-400)));
  } catch (e) {}
}

// 地域筛选：按曲目 tags 里的地区/语种分组
var REGIONS = [
  { k: 'all',   n: '不限',   tags: null },
  { k: 'hua',   n: '华语',   tags: ['中国大陆', '中国香港', '中国台湾', '中文', '华语流行', '粤语流行', '华语经典'] },
  { k: 'jpkr',  n: '日韩',   tags: ['日本', '韩国', '日文', '韩文', '日系', 'J-POP', 'K-POP', '日系摇滚', '日系流行', '日系偶像', '日语'] },
  { k: 'west',  n: '欧美',   tags: ['美国', '英国', '法国', '德国', '意大利', '西班牙', '荷兰', '瑞典', '加拿大', '澳大利亚', '欧美流行', '英文', '英伦'] },
  { k: 'latam', n: '拉美',   tags: ['巴西', '墨西哥', '拉美'] },
  { k: 'sea',   n: '东南亚', tags: ['新加坡', '马来西亚', '泰国', '印尼', '菲律宾'] }
];
var radioRegions = ['all'];        // 多选；含 'all' 等于不限
var onlyPick = false;              // 只看小编推荐（来自用户自己歌单的那批）
var POOLC = {}, IDXC = {};

function regionOf(k) {
  return REGIONS.filter(function (r) { return r.k === k; })[0] || REGIONS[0];
}
function regionKey() {
  var rk = (!radioRegions.length || radioRegions.indexOf('all') !== -1) ? 'all' : radioRegions.slice().sort().join('+');
  return rk + (onlyPick ? '|pick' : '');
}
function poolOf(key) {
  if (!POOLC[key]) {
    var parts = key.split('|');
    var rk = parts[0], wantPick = parts[1] === 'pick';
    if (rk === 'all') {
      POOLC[key] = SONGS;
    } else {
      var tags = [];
      rk.split('+').forEach(function (k) {
        (regionOf(k).tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
      });
      POOLC[key] = SONGS.filter(function (s) {
        var own = s.tags.split(',');
        return tags.some(function (t) { return own.indexOf(t) !== -1; });
      });
    }
    if (wantPick) POOLC[key] = POOLC[key].filter(function (s) { return s.pick; });
  }
  return POOLC[key];
}
function idxOf(key) {
  if (!IDXC[key]) IDXC[key] = BM25.index(poolOf(key));
  return IDXC[key];
}
// 不限心情时：把整个候选池洗一遍，翻页就是随机翻，不重复
function shuffleAll(pool) {
  var a = pool.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.map(function (s) { return { song: s, pct: 0, matchedTags: [] }; });
}

var PAGE_SIZE = 6;
var radioItems = [], radioPage = 0;

function songHtml(r, idx) {
  var s = r.song;
  // 出处不显示：只保留人工写的那句人话描述，自动导入的“榜第 N / 收录自 / 问卷推荐”一律不出现
  var isSource = /榜第|收录自|同学问卷|录音室专辑收录|来自问卷/.test(s.desc || '');
  var line = isSource ? '' : '<div class="d">' + s.desc + '</div>';
  var tags = s.tags.split(',').slice(0, 5).map(function (t) {
    return '<span class="tag' + (r.matchedTags.indexOf(t) !== -1 ? ' hit' : '') + '">' + t + '</span>';
  }).join('');
  var netease = 'https://music.163.com/#/search/m/?s=' + encodeURIComponent(s.title + ' ' + s.artist);
  var apple = 'https://music.apple.com/cn/search?term=' + encodeURIComponent(s.title + ' ' + s.artist);
  return '<div class="song"><div class="n">' + (idx + 1) + '</div>' +
    '<div class="main"><div class="r1">' + (s.pick ? '<span class="pickb">小编推荐</span>' : '') +
    '<span class="t">' + s.title + '</span><span class="a">' + s.artist + '</span></div>' +
    line + '<div class="tags">' + tags + '</div></div>' +
    '<div class="links">' +
    '<a href="' + netease + '" target="_blank" rel="noopener">网易云</a>' +
    '<a href="' + apple + '" target="_blank" rel="noopener">Apple</a></div></div>';
}

function paintRadio() {
  var el = document.getElementById('rlist');
  var meta = document.getElementById('rmeta');
  var pager = document.getElementById('rpager');
  var total = radioItems.length;
  if (!total) {
    meta.textContent = '这个组合暂时没歌，换个心情或地域试试';
    el.innerHTML = '';
    pager.hidden = true;
    return;
  }
  var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (radioPage > pages - 1) radioPage = pages - 1;
  if (radioPage < 0) radioPage = 0;
  var start = radioPage * PAGE_SIZE;
  var slice = radioItems.slice(start, start + PAGE_SIZE);
  meta.textContent = radioPage === 0 ? '先听这几首' : '接着往下听';
  el.innerHTML = slice.map(function (r, i) { return songHtml(r, start + i); }).join('');
  pager.hidden = pages <= 1;
  document.getElementById('rprev').disabled = radioPage === 0;
  document.getElementById('rnext').disabled = radioPage >= pages - 1;
}

function jumpPage(d) {
  radioPage += d;
  paintRadio();
  var top = document.getElementById('rmeta');
  if (top) top.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function renderRadio(q, moods, keepPage) {
  var rk = regionKey();
  var pool = poolOf(rk);
  var ms = Array.isArray(moods) ? moods : (moods && moods !== 'none' ? [moods] : []);
  var res = [];
  if (!pool.length) {
    radioItems = []; paintRadio(); return;
  }
  // 只留下跟最相关那首差距不太大的：否则「巴纳姆」这种词会把只沾一个字的歌也翻出来
  // 只留「至少命中一个二元词」的结果：单字沾边（巴、纳、姆）不算，否则翻页全是凑数的
  function solid(list) {
    return list.filter(function (r) {
      return r.strong && r.pct >= 25;
    });
  }
  // 不设上限：符合条件的一律返回，交给翻页切开
  if (q) {
    res = solid(BM25.search(idxOf(rk), q, pool.length));
  } else if (!ms.length) {
    res = shuffleAll(pool);
  } else {
    var mq = ms.map(function (k) { return MOOD_QUERY[k]; }).join(' ');
    res = solid(BM25.search(idxOf(rk), mq, pool.length));
  }
  radioItems = res;
  if (!keepPage) radioPage = 0;
  paintRadio();
}

function renderReport() {
  var body = document.getElementById('reportBody');
  var log;
  try { log = JSON.parse(localStorage.getItem('ml-log') || '[]'); } catch (e) { log = []; }
  var days = [], byDate = {};
  for (var i = 6; i >= 0; i--) {
    var d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    days.push(d);
  }
  log.forEach(function (x) { byDate[x.d] = x.k; });
  var counted = days.filter(function (d) { return byDate[d]; });
  var counts = {};
  counted.forEach(function (d) { counts[byDate[d]] = (counts[byDate[d]] || 0) + 1; });
  var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

  var bars = days.map(function (d) {
    var k = byDate[d];
    var m = k ? moodBy(k) : null;
    var dd = d.slice(5).replace('-', '/');
    return '<div class="day ' + (k ? '' : 'd0') + '"><span class="em">' + (m ? m.e : '') + '</span>' +
      '<div class="bar" style="height:' + (k ? 76 : 5) + 'px;' + (m ? 'background:linear-gradient(180deg,' + m.c + ',' + m.c2 + ')' : '') + '"></div>' +
      '<span class="dl">' + dd + '</span></div>';
  }).join('');

  body.innerHTML = '<div class="week">' + bars + '</div><p class="rsum">' +
    (counted.length
      ? '这一周记了 <b>' + counted.length + '</b> 天，出现最多的是 <b>' + (top ? moodBy(top).e + ' ' + moodBy(top).n : '—') + '</b>'
      : '还没有记录，选一个心情就会记下今天') +
    '</p>';
}

function renderRegionChips() {
  var box = document.getElementById('radio-regions');
  box.innerHTML = REGIONS.map(function (r) {
    var on = r.k === 'all'
      ? (!radioRegions.length || radioRegions.indexOf('all') !== -1)
      : radioRegions.indexOf(r.k) !== -1;
    return '<button class="chip' + (on ? ' on' : '') + '" data-region="' + r.k + '">' + r.n + '</button>';
  }).join('');
  var pickBox = document.getElementById('radio-picks');
  if (pickBox) {
    pickBox.innerHTML = '<button class="chip pickchip' + (onlyPick ? ' on' : '') + '">小编推荐</button>';
    pickBox.querySelector('.pickchip').onclick = function () {
      onlyPick = !onlyPick;
      renderRegionChips();
      renderRadio(document.getElementById('rq').value.trim(), radioMoods);
    };
  }
  box.querySelectorAll('.chip').forEach(function (b) {
    b.onclick = function () {
      var k = b.dataset.region;
      if (k === 'all') {
        radioRegions = ['all'];
      } else {
        radioRegions = radioRegions.filter(function (x) { return x !== 'all'; });
        var i = radioRegions.indexOf(k);
        if (i === -1) radioRegions.push(k); else radioRegions.splice(i, 1);
        if (!radioRegions.length) radioRegions = ['all'];
      }
      renderRegionChips();
      renderRadio(document.getElementById('rq').value.trim(), radioMoods);
    };
  });
}

function toggleMood(k) {
  if (k === 'none') {
    radioMoods = [];
  } else {
    var i = radioMoods.indexOf(k);
    if (i === -1) { radioMoods.push(k); logMood(k); }
    else radioMoods.splice(i, 1);
  }
  renderMoodChipsMulti(document.getElementById('radio-moods'), radioMoods, toggleMood, true);
  document.getElementById('rq').value = '';
  renderRadio('', radioMoods);
  renderReport();
}

function initRadio() {
  renderMoodChipsMulti(document.getElementById('radio-moods'), radioMoods, toggleMood, true);
  renderRegionChips();
  document.getElementById('rgo').onclick = function () {
    var q = document.getElementById('rq').value.trim();
    renderRadio(q, radioMoods);
  };
  document.getElementById('rq').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('rgo').click();
  });
  document.getElementById('rprev').onclick = function () { jumpPage(-1); };
  document.getElementById('rnext').onclick = function () { jumpPage(1); };
  document.getElementById('rclear').onclick = function () {
    localStorage.removeItem('ml-log');
    renderReport();
  };
  renderRadio('', radioMoods);
  renderReport();
}
