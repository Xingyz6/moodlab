// 工具一 · 情绪卡片 v3：4 版式 + 多图 + 自定义（尺寸/颜色/水印/图片高度/字号/对齐/两图方向）
var SIZES = {
  '4:5':  [1080, 1350],
  '1:1':  [1080, 1080],
  '3:4':  [1080, 1440],
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '4:3':  [1440, 1080]
};
var FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',Arial,sans-serif";
var SERIF = "'Songti SC','SimSun','Noto Serif SC',Georgia,serif";

var cardState = {
  mood: 'calm',
  text: '',
  imgs: [],
  tpl: 'gradient',
  size: '4:5',
  color: '',            // 空 = 用心情色
  sign: '心情实验室',    // 空字符串 = 不显示水印
  imgRatio: 0.56,       // 图片区占比
  textScale: 1,         // 字号倍率
  align: 'center',      // left | center | right
  twoDir: 'v',          // 两张图：v 上下 / h 左右
  sel: 0,               // 当前选中要旋转的那张
  showMood: true,       // 海报上是否显示心情标签（表情 + 名字）
  textColor: '',        // 空 = 用版式默认的文字色
  vnameX: 0.88,         // 杂志版竖排名字的横向位置（占卡片宽的比例）
  vnameScale: 1,        // 竖排名字字号倍率
  vnameY: 0.5,          // 竖排名字在色块里的上下位置（占色块高的比例）
  imgEdge: 0.055,       // 杂志版：照片四周留的心情色边（占卡片宽的比例）
  fileTag: '',          // 文件名里「用户可自定义」的那一段
  stroke: '',           // 正文描边：'' 无 / '#000000' 黑 / '#ffffff' 白
  moodStroke: ''        // 心情名描边，单独设置
};

var TEMPLATES = [
  { k: 'gradient', n: '渐变' },
  { k: 'minimal',  n: '极简' },
  { k: 'magazine', n: '杂志' },
  { k: 'film',     n: '胶片' }
];

var measureCtx = document.createElement('canvas').getContext('2d');
function mw(text, size, weight, fam) {
  measureCtx.font = weight + ' ' + size + 'px ' + (fam || FONT);
  return measureCtx.measureText(text).width;
}
function escXml(s) {
  return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
}
function wrap(text, maxW, size, weight, fam) {
  var out = [];
  text.split('\n').forEach(function (para) {
    var tokens = para.match(/[A-Za-z0-9'’\-]+|\s+|./g) || [''];
    var line = '';
    tokens.forEach(function (tk) {
      var test = line + tk;
      if (mw(test, size, weight, fam) > maxW && line.trim()) { out.push(line); line = tk; }
      else line = test;
    });
    out.push(line);
  });
  // 避头尾：标点不许另起一行
  var NO_START = '。，、；：？！）】》」』…·%';
  for (var i = 1; i < out.length; i++) {
    while (out[i] && NO_START.indexOf(out[i][0]) !== -1) {
      out[i - 1] += out[i][0];
      out[i] = out[i].slice(1);
    }
  }
  return out.filter(function (l) { return l.length; }).slice(0, 10);
}
function today() {
  var d = new Date();
  return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}
function dims() {
  var d = SIZES[cardState.size] || SIZES['4:5'];
  return { W: d[0], H: d[1] };
}
// 把颜色往白色混，直到亮度够（预设心情的亮色亮度在 0.55~0.7 之间）
function lightenTo(hex, target) {
  var amt = 0;
  while (amt < 0.9 && relLumOf(mixWhite(hex, amt)) < target) amt += 0.05;
  return mixWhite(hex, Math.min(amt, 0.9));
}
function relLumOf(hex) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var ch = [0, 2, 4].map(function (i) {
    var c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

// 把颜色往白色混，用来给自定义心情算一个「亮色」（预设心情自带 c/c2 一明一暗两个色）
function mixWhite(hex, amt) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var out = [0, 2, 4].map(function (i) {
    var v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * amt).toString(16).padStart(2, '0');
  }).join('');
  return '#' + out;
}

// 心情配色：预设心情本身有 c（亮）/ c2（深）两个色；
// 自定义心情只有一个颜色，所以要按同样关系补一个亮色，否则标签亮度和预设对不上
function palette(m) {
  if (cardState.color) {
    return { c: lightenTo(cardState.color, 0.58), c2: cardState.color, e: m.e, n: m.n };
  }
  if (cardState.mood === 'custom') {
    return { c: lightenTo(m.c2, 0.58), c2: m.c2, e: m.e, n: m.n };
  }
  return { c: m.c, c2: m.c2, e: m.e, n: m.n };
}
function sizeFor(len, W, H) {
  var base = len <= 12 ? 92 : len <= 30 ? 66 : len <= 60 ? 48 : len <= 110 ? 36 : 28;
  // 参考尺寸 1080×1350；横版按高度收，竖版按宽度收，取更保守的那个
  var k = Math.min(W / 1080, H / 1350);
  return Math.round(base * cardState.textScale * k);
}
function anchorX(W) {
  return cardState.align === 'left' ? { x: 88, a: 'start' }
    : cardState.align === 'right' ? { x: W - 88, a: 'end' }
    : { x: W / 2, a: 'middle' };
}

// ---------- 图片：1 大 / 2（上下或左右）/ 3 一大两小 / 4 个 2×2 ----------
var clipSeq = 0;
function cell(img, x, y, w, h, r, rot) {
  var id = 'c' + (clipSeq++);
  var src = img && img.src ? img.src : img;
  var deg = Number(((img && img.rot) || rot || 0)) || 0;
  var zoom = (img && img.zoom) || 1;
  var fit = (img && img.fit) || 'contain';
  var par = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
  // 位置偏移（占卡片宽高的百分比）。一旦偏移或旋转就取消格子裁切：
  // 图保持原尺寸、整张可见，代价是可以压到相邻图上（靠图层号判断谁在上）。
  var dx = (img && img.dx) || 0, dy = (img && img.dy) || 0;
  var free = dx !== 0 || dy !== 0 || deg !== 0;
  var d = dims();
  var tx = dx / 100 * d.W, ty = dy / 100 * d.H;
  var clip = free ? '' : '<clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
    '" rx="' + (r || 0) + '"/></clipPath>';
  var cattr = free ? '' : ' clip-path="url(#' + id + ')"';
  var move = (tx || ty) ? ' translate(' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')' : '';

  // 裁剪放在外层 <g>（不带 transform），位移/旋转放内层 <g>。
  // Safari 会把带 transform 的元素上的 clip-path 一起变换（裁剪框跟着图片转），看起来就是原图被裁歪。
  if (!deg && zoom === 1) {
    return clip + '<g' + cattr + '><g' + (move ? ' transform="' + move + '"' : '') + '><image href="' + src + '" x="' + x +
      '" y="' + y + '" width="' + w + '" height="' + h + '" preserveAspectRatio="' + par + '"/></g></g>';
  }
  // 旋转时：填满模式要按角度放大才不会露角；完整模式只按缩放倍数来
  var cx = x + w / 2, cy = y + h / 2;
  // 只按缩放倍数走：旋转不改尺寸
  var k = zoom;
  var iw = w * k, ih = h * k;
  return clip + '<g' + cattr + '><g transform="' + move + ' rotate(' + deg + ' ' + cx + ' ' + cy + ')"><image href="' + src +
    '" x="' + (cx - iw / 2) + '" y="' + (cy - ih / 2) + '" width="' + iw + '" height="' + ih +
    '" preserveAspectRatio="' + par + '"/></g></g>';
}
// 先按「格子」排好位置，再按图层 z 决定绘制先后：位置和层级互不影响
function layoutCells(n, x, y, w, h, gap) {
  gap = gap || 12;
  var out = [];
  if (n <= 0) return out;
  if (n === 1) { out.push({ x: x, y: y, w: w, h: h }); return out; }
  if (n === 2) {
    // 格子特别扁时（横版）上下排会把两张图压成细条，自动改成左右；
    // 用户显式选「左右」时也走这里
    var flat = w / h > 2.2;
    if (cardState.twoDir === 'h' || flat) {
      var ww = (w - gap) / 2;
      out.push({ x: x, y: y, w: ww, h: h }, { x: x + ww + gap, y: y, w: ww, h: h });
    } else {
      var hh = (h - gap) / 2;
      out.push({ x: x, y: y, w: w, h: hh }, { x: x, y: y + hh + gap, w: w, h: hh });
    }
    return out;
  }
  if (n === 3) {
    var big = h * 0.62, rest = h - big - gap, cw = (w - gap) / 2;
    out.push({ x: x, y: y, w: w, h: big },
             { x: x, y: y + big + gap, w: cw, h: rest },
             { x: x + cw + gap, y: y + big + gap, w: cw, h: rest });
    return out;
  }
  var hh2 = (h - gap) / 2, ww2 = (w - gap) / 2;
  out.push({ x: x, y: y, w: ww2, h: hh2 },
           { x: x + ww2 + gap, y: y, w: ww2, h: hh2 },
           { x: x, y: y + hh2 + gap, w: ww2, h: hh2 },
           { x: x + ww2 + gap, y: y + hh2 + gap, w: ww2, h: hh2 });
  return out;
}
function photoGrid(imgs, x, y, w, h, gap, r) {
  gap = gap || 12; r = r || 0;
  var n = Math.min(imgs.length, 4);
  if (!n) return '';
  var cells = layoutCells(n, x, y, w, h, gap);
  var draw = [];
  for (var i = 0; i < n; i++) draw.push({ im: imgs[i], c: cells[i], slot: i });
  // 图层大的后画（在上面）；z 相同按格子顺序
  draw.sort(function (a, b) { return ((a.im.z || 0) - (b.im.z || 0)) || (a.slot - b.slot); });
  return draw.map(function (d) { return cell(d.im, d.c.x, d.c.y, d.c.w, d.c.h, r); }).join('');
}

// ---------- 版式 1：渐变 ----------
function tplGradient(m, txt, W, H) {
  var p = palette(m), imgs = cardState.imgs, has = imgs.length > 0;
  var topH = has ? Math.round(H * cardState.imgRatio) : 0;
  var size = sizeFor(txt.replace(/\s/g, '').length, W, H);
  var ax = anchorX(W);
  var tc = cardState.textColor || '#ffffff';
  var lines = wrap(txt, W - 200, size, '600', FONT);
  var lh = Math.round(size * 1.45);
  var y0 = has
    ? topH + (H - topH) / 2 - (lines.length * lh) / 2 + size * 0.8
    : (H - lines.length * lh) / 2 + size * 0.8;

  return '<defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p.c2 + '"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="url(#g1)"/>' +
    (has ? photoGrid(imgs, 0, 0, W, topH, 0, 0) : '') +
    (cardState.showMood ? moodLabel(72, 96, 26, has ? '#fff' : p.c, p) : '') +
    lines.map(function (l, i) {
      return '<text x="' + ax.x + '" y="' + (y0 + i * lh) + '" text-anchor="' + ax.a + '" font-size="' + size +
        '" font-weight="600" fill="' + tc + '"' + strokeAttrs(size) + ' font-family="' + FONT + '">' + escXml(l) + '</text>';
    }).join('') +
    (cardState.sign
      ? '<text x="' + ax.x + '" y="' + (H - 58) + '" text-anchor="' + ax.a + '" font-size="22" fill="rgba(255,255,255,.45)" font-family="' + FONT + '">' + today() + ' · ' + escXml(cardState.sign) + '</text>'
      : '');
}

// ---------- 版式 2：极简 ----------
function tplMinimal(m, txt, W, H) {
  var p = palette(m), imgs = cardState.imgs, has = imgs.length > 0;
  var size = Math.round(sizeFor(txt.replace(/\s/g, '').length, W, H) * 0.78);
  var tc = cardState.textColor || '#2a231c';
  var lines = wrap(txt, W - 192, size, '400', SERIF);
  var lh = Math.round(size * 1.7);
  var imgTop = 150, imgH = has ? Math.round(H * Math.min(0.55, cardState.imgRatio * 0.8)) : 0;
  var textTop = has ? imgTop + imgH + 110 : Math.max(340, (H - lines.length * lh) / 2);

  return '<rect width="' + W + '" height="' + H + '" fill="#f7f3ea"/>' +
    (cardState.showMood ? moodLabel(96, 104, 24, p.c2, p) : '') +
    (has ? photoGrid(imgs, 96, imgTop, W - 192, imgH, 10, 6) : '') +
    lines.map(function (l, i) {
      return '<text x="96" y="' + (textTop + i * lh) + '" font-size="' + size + '" fill="' + tc + '"' + strokeAttrs(size) + ' font-family="' + SERIF + '">' + escXml(l) + '</text>';
    }).join('') +
    '<line x1="96" y1="' + (H - 150) + '" x2="' + (W - 96) + '" y2="' + (H - 150) + '" stroke="#2a231c" stroke-opacity=".18"/>' +
    '<text x="96" y="' + (H - 100) + '" font-size="22" fill="#2a231c" fill-opacity=".45" font-family="' + FONT + '">' + today() + '</text>' +
    (cardState.sign
      ? '<text x="' + (W - 96) + '" y="' + (H - 100) + '" text-anchor="end" font-size="22" fill="#2a231c" fill-opacity=".3" font-family="' + FONT + '">' + escXml(cardState.sign) + '</text>'
      : '');
}

// ---------- 版式 3：杂志 ----------
function tplMagazine(m, txt, W, H) {
  var p = palette(m), imgs = cardState.imgs, has = imgs.length > 0;
  var topH = Math.round(H * Math.min(0.75, cardState.imgRatio + 0.04));
  var size = Math.round(sizeFor(txt.replace(/\s/g, '').length, W, H) * 0.72);
  var ax = anchorX(W);
  // 下半块是心情的 c2，有时偏亮（如平静的浅蓝）——按对比度自动选黑/白字
  var tc = cardState.textColor ||
    (contrast(p.c2, '#ffffff') >= 4.5 ? '#ffffff' : '#12161f');
  var lines = wrap(txt, W - 176, size, '600', SERIF);
  var lh = Math.round(size * 1.42);
  var y0 = topH + Math.max(120, (H - topH) / 2 - (lines.length * lh) / 2 + size);

  // 无图：上半改成「竖排心情名」，emoji 缩小放右上（杂志书名式排版）
  var topInk = contrast(p.c, '#ffffff') >= contrast(p.c, '#12161f') ? '#ffffff' : '#12161f';
  var chars = String(p.n).split('');
  var fs = Math.round(Math.min(topH * 0.2, 170) * cardState.vnameScale);
  var step = Math.round(fs * 1.16);
  var total = chars.length * step;
  var cy = topH * cardState.vnameY;
  // 防止放大/上移后名字被色块裁掉：先夹住整组的上边界
  var topEdge = Math.max(0, Math.min(topH - total, cy - total / 2));
  var startY = Math.round(topEdge + fs * 0.95);   // 0.95em：中文字形上沿约占 0.88em，留一点余量
  var nx = Math.round(W * cardState.vnameX);   // 靠右：左边留白给排版余量
  var vtext = chars.map(function (ch, k) {
    return '<text x="' + nx + '" y="' + (startY + k * step) + '" text-anchor="middle" font-size="' + fs +
      '" font-family="' + SERIF + '" fill="' + topInk + '" fill-opacity=".86">' + escXml(ch) + '</text>';
  }).join('');

  // 有图：上半块仍是 p.c 色，照片内缩成「窗」，四周露出心情色（保住上下两色的关系）
  var edge = Math.round(W * cardState.imgEdge);
  return '<rect width="' + W + '" height="' + H + '" fill="' + p.c2 + '"/>' +
    (has ? '<rect width="' + W + '" height="' + topH + '" fill="' + p.c + '"/>' +
           photoGrid(imgs, edge, edge, W - edge * 2, topH - edge * 2, 10, 8)
         : '<rect width="' + W + '" height="' + topH + '" fill="' + p.c + '"/>' + vtext) +
    (cardState.showMood ? '<text x="88" y="' + (topH + 78) + '" font-size="20" fill="' + tc + '" fill-opacity=".72" letter-spacing="3"' + strokeAttrs(20, 'mood') + ' font-family="' + FONT + '">NOTE · ' + p.n + '</text>' : '') +
    lines.map(function (l, i) {
      return '<text x="' + ax.x + '" y="' + (y0 + i * lh) + '" text-anchor="' + ax.a + '" font-size="' + size + '" font-weight="600" fill="' + tc + '"' + strokeAttrs(size) + ' font-family="' + SERIF + '">' + escXml(l) + '</text>';
    }).join('') +
    (cardState.sign
      ? '<text x="' + ax.x + '" y="' + (H - 70) + '" text-anchor="' + ax.a + '" font-size="22" fill="#ffffff" fill-opacity=".5" font-family="' + FONT + '">' + today() + ' · ' + escXml(cardState.sign) + '</text>'
      : '');
}

// ---------- 版式 4：胶片 ----------
function tplFilm(m, txt, W, H) {
  var p = palette(m), imgs = cardState.imgs, has = imgs.length > 0;
  var size = Math.round(sizeFor(txt.replace(/\s/g, '').length, W, H) * 0.56);
  var tc = cardState.textColor || '#2a231c';
  var lines = wrap(txt, W - 280, size, '400', SERIF);
  var lh = Math.round(size * 1.65);
  var mat = Math.round(W * 0.033), fw = W - Math.round(W * 0.22);
  var fh = has ? Math.round(H * cardState.imgRatio) : 0;
  var fx = (W - fw) / 2, fy = Math.round(H * 0.14);
  var photo = has
    ? '<g transform="rotate(-2 ' + (W / 2) + ' ' + (fy + fh / 2) + ')">' +
        '<rect x="' + (fx - mat) + '" y="' + (fy - mat) + '" width="' + (fw + mat * 2) + '" height="' + (fh + mat * 2) + '" rx="3" fill="#fff"/>' +
        photoGrid(imgs, fx, fy, fw, fh, 8, 2) +
      '</g>'
    : '';
  var textTop = has ? fy + fh + mat * 2 + 90 : Math.max(400, (H - lines.length * lh) / 2);

  return '<rect width="' + W + '" height="' + H + '" fill="#efe9dd"/>' +
    photo +
    '<text x="' + (W - 84) + '" y="96" text-anchor="end" font-size="20" fill="#2a231c" fill-opacity=".4" font-family="' + FONT + '">' + today() + '</text>' +
    lines.map(function (l, i) {
      return '<text x="' + W / 2 + '" y="' + (textTop + i * lh) + '" text-anchor="middle" font-size="' + size + '" fill="' + tc + '"' + strokeAttrs(size) + ' font-family="' + SERIF + '">' + escXml(l) + '</text>';
    }).join('') +
    ((cardState.showMood || cardState.sign)
      ? '<text x="' + W / 2 + '" y="' + (H - 90) + '" text-anchor="middle" font-size="20" fill="#2a231c" fill-opacity=".35" font-family="' + FONT + '">' +
        (cardState.showMood ? p.n : '') +
        (cardState.showMood && cardState.sign ? ' · ' : '') +
        (cardState.sign ? escXml(cardState.sign) : '') +
        '</text>'
      : '');
}

// 心情标签拆两段：emoji 是彩色字体，不能描边（描边会把它变成单色线框）
function moodLabel(x, y, size, ink, p, extraAttrs) {
  var ea = extraAttrs || '';
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" fill="' + ink + '"' + strokeAttrs(size, 'mood') + ea + ' font-family="' + FONT + '">' + p.n + '</text>';
}

// 文字描边：paint-order=stroke 让描边画在字下面，不啃字形
function strokeAttrs(size, key) {
  var c = key === 'mood' ? cardState.moodStroke : cardState.stroke;
  if (!c) return '';
  var w = Math.max(2, Math.round(size * 0.075));
  return ' stroke="' + c + '" stroke-width="' + w +
    '" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke"';
}

// 文件名：MoodLab-用户自定义-心情名_时间
function buildFileName() {
  var d = new Date();
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var ts = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) +
    '_' + p2(d.getHours()) + p2(d.getMinutes());
  var clean = function (s) {
    return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '');
  };
  var parts = ['MoodLab', clean(cardState.fileTag), clean(curMood().n) + '_' + ts];
  return parts.filter(function (x) { return x; }).join('-') + '.png';
}

function buildCard() {
  var m = curMood();
  var txt = (cardState.text || '今天也过去了').trim();
  var d = dims(), W = d.W, H = d.H;
  var fn = { gradient: tplGradient, minimal: tplMinimal, magazine: tplMagazine, film: tplFilm }[cardState.tpl] || tplGradient;
  clipSeq = 0;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<defs><clipPath id="cardbox"><rect width="' + W + '" height="' + H + '"/></clipPath></defs>' +
    '<g clip-path="url(#cardbox)">' + fn(m, txt, W, H) + '</g></svg>';
}

// 自定义心情优先于内置心情
function curMood() {
  if (cardState.mood === 'custom' && cardState.custom) return cardState.custom;
  return moodBy(cardState.mood) || moodBy('calm');
}
// 滑杆 ↔ 数字输入：任何一个改了，两边都同步
function syncVal(rangeId, numId, v) {
  var r = document.getElementById(rangeId), n = document.getElementById(numId);
  if (r) r.value = v;
  if (n && document.activeElement !== n) n.value = v;
}

function paintCard() {
  document.getElementById('stage').innerHTML = buildCard();
  document.getElementById('cardTip').textContent =
    cardState.imgs.length > 4 ? '只排前 4 张（多选的已忽略）' : '';
}

function renderThumbs() {
  var box = document.getElementById('thumbs');
  // 图层号 = 按 z 升序的名次（1 在最下）
  var zs = cardState.imgs.map(function (im, i) { return { z: im.z || 0, i: i }; })
    .sort(function (a, b) { return (a.z - b.z) || (a.i - b.i); });
  var rank = {}, top = 0;
  zs.forEach(function (o, k) { rank[o.i] = k + 1; top = Math.max(top, o.z); });

  box.innerHTML = cardState.imgs.map(function (im, i) {
    var rot = (im.rot || 0) % 360;
    return '<span class="thumb' + (i === cardState.sel ? ' sel' : '') + '" data-pick="' + i + '" draggable="true">' +
      '<em class="idx" title="图层 ' + rank[i] + '（数字越大越靠上）">' + rank[i] + '</em>' +
      '<img src="' + im.src + '" alt="" style="transform:rotate(' + rot + 'deg)">' +
      '<b class="del" data-i="' + i + '" title="删除">×</b>' +
      '<i class="ops">' +
        '<button data-act="left" data-i="' + i + '" title="前移" aria-label="前移"' + (i === 0 ? ' disabled' : '') + '>‹</button>' +
        '<button data-act="right" data-i="' + i + '" title="后移" aria-label="后移"' + (i === cardState.imgs.length - 1 ? ' disabled' : '') + '>›</button>' +
        '<button data-act="front" data-i="' + i + '" title="置于最上层（不动位置）" aria-label="置顶"' + ((im.z || 0) === top ? ' disabled' : '') + '>↑</button>' +
      '</i>' +
    '</span>';
  }).join('');
  box.querySelectorAll('.del').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      cardState.imgs.splice(+b.dataset.i, 1);
      if (cardState.sel >= cardState.imgs.length) cardState.sel = Math.max(0, cardState.imgs.length - 1);
      renderThumbs(); paintCard();
    };
  });
  box.querySelectorAll('.thumb').forEach(function (el) {
    el.onclick = function (e) {
      if (e.target.closest('.del') || e.target.closest('[data-act]')) return;
      cardState.sel = +el.dataset.pick;
      renderThumbs();
    };
    // 拖拽换序
    el.addEventListener('dragstart', function (e) {
      cardState.dragFrom = +el.dataset.pick;
      el.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(cardState.dragFrom)); }
    });
    el.addEventListener('dragend', function () { el.classList.remove('dragging'); });
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault(); el.classList.remove('over');
      var from = cardState.dragFrom, to = +el.dataset.pick;
      if (from == null || from === to) return;
      var item = cardState.imgs.splice(from, 1)[0];
      cardState.imgs.splice(to, 0, item);
      cardState.sel = to;
      renderThumbs(); paintCard();
    });
  });
  box.querySelectorAll('[data-act]').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var i = +b.dataset.i, act = b.dataset.act, a = cardState.imgs;
      if (act === 'left' && i > 0) { a.splice(i - 1, 0, a.splice(i, 1)[0]); cardState.sel = i - 1; }
      if (act === 'right' && i < a.length - 1) { a.splice(i + 1, 0, a.splice(i, 1)[0]); cardState.sel = i + 1; }
      if (act === 'front') {
        var topZ = a.reduce(function (m2, x) { return Math.max(m2, x.z || 0); }, 0);
        a[i].z = topZ + 1;          // 只抬图层，不动格子位置
      }
      renderThumbs(); paintCard();
    };
  });
  document.getElementById('dropHint').textContent = cardState.imgs.length
    ? '已选 ' + cardState.imgs.length + ' 张 · 点图选中后可旋转'
    : '点击选图 · 可多选 · 自动裁切排版';
  renderRotBar();
}

// 选中那张的旋转滑杆（-180° ~ 180°，1° 一档）
function renderRotBar() {
  var bar = document.getElementById('rotbar');
  var n = cardState.imgs.length;
  if (!n) { bar.hidden = true; return; }
  bar.hidden = false;
  if (cardState.sel >= n) cardState.sel = n - 1;
  var im = cardState.imgs[cardState.sel];
  var cur = Math.round(im.rot || 0), zm = Math.round((im.zoom || 1) * 100);
  document.getElementById('rotLabel').textContent = '第 ' + (cardState.sel + 1) + ' 张 / 共 ' + n + ' 张';
  syncVal('rot', 'rotNum', cur);
  syncVal('zoom', 'zoomNum', zm);
  var px = Math.round(im.dx || 0), py = Math.round(im.dy || 0);
  syncVal('posx', 'posxNum', px);
  syncVal('posy', 'posyNum', py);
  var fit = im.fit || 'contain';
  document.querySelectorAll('[data-fit]').forEach(function (b) {
    b.classList.toggle('on', b.dataset.fit === fit);
  });
}

// 换版式时，文字颜色的色块跟着默认色走（用户自己选过就不动）
function syncTextColorSwatch() {
  var el = document.getElementById('textColor');
  if (!el || cardState.textColor) return;
  el.value = (cardState.tpl === 'minimal' || cardState.tpl === 'film') ? '#2a231c' : '#ffffff';
}

function renderTemplates() {
  var box = document.getElementById('templates');
  box.innerHTML = TEMPLATES.map(function (t) {
    return '<button class="chip' + (t.k === cardState.tpl ? ' on' : '') + '" data-tpl="' + t.k + '">' + t.n + '</button>';
  }).join('');
  box.querySelectorAll('.chip').forEach(function (b) {
    b.onclick = function () {
      cardState.tpl = b.dataset.tpl;
      renderTemplates(); syncTextColorSwatch(); paintCard();
    };
  });
}

function initCard() {
  // 截图/分享用：?mood=blue&text=…&tpl=film&imgs=a.jpg,b.jpg&size=1:1&color=%23ff5500
  var q = new URLSearchParams(location.search);
  if (q.get('mood')) cardState.mood = q.get('mood');
  if (q.get('text')) cardState.text = q.get('text');
  if (q.get('tpl')) cardState.tpl = q.get('tpl');
  if (q.get('imgs')) {
    var srcs = q.get('imgs').split(',').map(function (s) { return s.trim(); });
    var rots = (q.get('rots') || '').split(',').map(function (s) { return parseFloat(s) || 0; });
    var zooms = (q.get('zooms') || '').split(',').map(function (s) { return parseFloat(s) || 0; });
    cardState.imgs = srcs.map(function (s, i) {
      return { src: s, rot: rots[i] || 0, zoom: zooms[i] ? zooms[i] / 100 : 1, z: i + 1 };
    });
  }
  if (q.get('size')) cardState.size = q.get('size');
  if (q.get('color')) cardState.color = q.get('color');
  if (q.get('sign') !== null) cardState.sign = q.get('sign');
  if (q.get('ratio')) cardState.imgRatio = Math.min(0.75, Math.max(0.25, parseFloat(q.get('ratio'))));
  if (q.get('scale')) cardState.textScale = Math.min(1.6, Math.max(0.6, parseFloat(q.get('scale'))));
  if (q.get('align')) cardState.align = q.get('align');
  if (q.get('moodlabel') === '0') cardState.showMood = false;
  if (q.get('textcolor')) cardState.textColor = q.get('textcolor');
  if (q.get('stroke')) cardState.stroke = q.get('stroke');
  if (q.get('moodstroke')) cardState.moodStroke = q.get('moodstroke');
  if (q.get('edge')) cardState.imgEdge = Math.min(0.20, Math.max(0, parseFloat(q.get('edge')) / 100));
  if (q.get('tag')) cardState.fileTag = q.get('tag');
  if (q.get('vx')) cardState.vnameX = Math.min(0.90, Math.max(0.50, parseFloat(q.get('vx')) / 100));
  if (q.get('vy')) cardState.vnameY = Math.min(0.80, Math.max(0.20, parseFloat(q.get('vy')) / 100));
  if (q.get('vs')) cardState.vnameScale = Math.min(1.6, Math.max(0.6, parseFloat(q.get('vs')) / 100));
  if (q.get('two')) cardState.twoDir = q.get('two');

  renderMoodChips(document.getElementById('card-moods'), cardState.mood, function (k) {
    cardState.mood = k; paintCard();
  });

  var ta = document.getElementById('text'), cnt = document.getElementById('count');
  ta.value = cardState.text;
  cnt.textContent = cardState.text.length + ' / 200';
  ta.addEventListener('input', function () {
    cardState.text = ta.value;
    cnt.textContent = ta.value.length + ' / 200';
    paintCard();
  });

  var drop = document.getElementById('drop'), file = document.getElementById('file');
  drop.addEventListener('click', function (e) {
    if (e.target.closest('.thumb')) return;
    file.click();
  });
  file.addEventListener('change', function () {
    var files = Array.prototype.slice.call(file.files).slice(0, 4);
    if (!files.length) return;
    var left = files.length;
    files.forEach(function (f) {
      var r = new FileReader();
      r.onload = function () {
        var zTop = cardState.imgs.reduce(function (m2, x) { return Math.max(m2, x.z || 0); }, 0);
        cardState.imgs.push({ src: r.result, rot: 0, zoom: 1, fit: 'contain', z: zTop + 1 });
        if (--left === 0) { renderThumbs(); paintCard(); }
      };
      r.readAsDataURL(f);
    });
    file.value = '';
  });
  document.getElementById('clearImg').onclick = function (e) {
    e.stopPropagation();
    cardState.imgs = [];
    cardState.sel = 0;
    renderThumbs(); paintCard();
  };

  var rot = document.getElementById('rot');
  rot.addEventListener('input', function () {
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.rot = +rot.value;
    syncVal('rot', 'rotNum', rot.value);
    var t = document.querySelector('.thumb.sel img');
    if (t) t.style.transform = 'rotate(' + rot.value + 'deg)';
    paintCard();
  });
  document.getElementById('rotReset').onclick = function (e) {
    e.stopPropagation();
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.rot = 0;
    renderRotBar(); renderThumbs(); paintCard();
  };

  var zoom = document.getElementById('zoom');
  zoom.addEventListener('input', function () {
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.zoom = (+zoom.value) / 100;
    syncVal('zoom', 'zoomNum', zoom.value);
    paintCard();
  });
  var px = document.getElementById('posx'), py = document.getElementById('posy');
  function applyPos() {
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.dx = +px.value; im.dy = +py.value;
    syncVal('posx', 'posxNum', px.value);
    syncVal('posy', 'posyNum', py.value);
    paintCard();
  }
  px.addEventListener('input', applyPos);
  py.addEventListener('input', applyPos);
  document.getElementById('posReset').onclick = function (e) {
    e.stopPropagation();
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.dx = 0; im.dy = 0;
    renderRotBar(); paintCard();
  };

  document.querySelectorAll('[data-fit]').forEach(function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var im = cardState.imgs[cardState.sel];
      if (!im) return;
      im.fit = b.dataset.fit;
      renderRotBar(); paintCard();
    };
  });
  document.getElementById('zoomReset').onclick = function (e) {
    e.stopPropagation();
    var im = cardState.imgs[cardState.sel];
    if (!im) return;
    im.zoom = 1;
    renderRotBar(); paintCard();
  };

  // ---------- 自定义：尺寸 / 颜色 / 水印 / 图片高度 / 字号 / 对齐 / 两图方向 ----------
  var sizeBox = document.getElementById('sizes');
  sizeBox.innerHTML = Object.keys(SIZES).map(function (k) {
    return '<button class="chip' + (k === cardState.size ? ' on' : '') + '" data-size="' + k + '">' + k + '</button>';
  }).join('');
  sizeBox.querySelectorAll('.chip').forEach(function (b) {
    b.onclick = function () {
      cardState.size = b.dataset.size;
      sizeBox.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); paintCard();
    };
  });

  var colorIn = document.getElementById('color');
  colorIn.value = cardState.color || moodBy(cardState.mood).c2;
  colorIn.addEventListener('input', function () { cardState.color = colorIn.value; paintCard(); });
  document.getElementById('colorReset').onclick = function (e) {
    e.stopPropagation(); cardState.color = ''; colorIn.value = moodBy(cardState.mood).c2; paintCard();
  };

  // 文字颜色：默认跟随版式（渐变/杂志白字，极简/胶片深字）
  function defaultTextColor() {
    return (cardState.tpl === 'minimal' || cardState.tpl === 'film') ? '#2a231c' : '#ffffff';
  }
  var tcIn = document.getElementById('textColor');
  if (tcIn) {
    tcIn.value = cardState.textColor || defaultTextColor();
    tcIn.addEventListener('input', function () {
      cardState.textColor = tcIn.value;
      paintCard();
    });
    document.getElementById('textColorReset').onclick = function (e) {
      e.stopPropagation();
      cardState.textColor = '';
      tcIn.value = defaultTextColor();
      paintCard();
    };
  }

  // 正文描边 / 心情名描边：各自独立
  function bindStroke(sel, key, attr) {
    document.querySelectorAll(sel).forEach(function (b) {
      b.classList.toggle('on', (b.dataset[attr] || '') === cardState[key]);
      b.onclick = function () {
        cardState[key] = b.dataset[attr] || '';
        document.querySelectorAll(sel).forEach(function (x) {
          x.classList.toggle('on', (x.dataset[attr] || '') === cardState[key]);
        });
        paintCard();
      };
    });
  }
  bindStroke('[data-stroke]', 'stroke', 'stroke');
  bindStroke('[data-mstroke]', 'moodStroke', 'mstroke');

  var tagIn = document.getElementById('fileTag');
  if (tagIn) {
    tagIn.value = cardState.fileTag;
    tagIn.addEventListener('input', function () { cardState.fileTag = tagIn.value; });
  }

  var signIn = document.getElementById('sign');
  signIn.value = cardState.sign;
  signIn.addEventListener('input', function () { cardState.sign = signIn.value; paintCard(); });

  var ratioIn = document.getElementById('ratio');
  ratioIn.value = Math.round(cardState.imgRatio * 100);
  syncVal('ratio', 'ratioNum', ratioIn.value);
  ratioIn.addEventListener('input', function () {
    cardState.imgRatio = Math.min(0.75, Math.max(0.25, (+ratioIn.value) / 100));
    syncVal('ratio', 'ratioNum', ratioIn.value);
    paintCard();
  });

  function bindPct(id, numId, key, min, max) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = Math.round(cardState[key] * 100);
    syncVal(id, numId, el.value);
    el.addEventListener('input', function () {
      cardState[key] = Math.min(max / 100, Math.max(min / 100, (+el.value) / 100));
      syncVal(id, numId, el.value);
      paintCard();
    });
  }
  bindPct('edge', 'edgeNum', 'imgEdge', 0, 20);       // 杂志版图片留边
  bindPct('vname', 'vnameNum', 'vnameX', 50, 90);    // 左右
  bindPct('vnameY', 'vnameYNum', 'vnameY', 20, 80);  // 上下
  bindPct('vnameS', 'vnameSNum', 'vnameScale', 60, 160); // 大小

  var scaleIn = document.getElementById('scale');
  scaleIn.value = Math.round(cardState.textScale * 100);
  syncVal('scale', 'scaleNum', scaleIn.value);
  scaleIn.addEventListener('input', function () {
    cardState.textScale = Math.min(1.6, Math.max(0.6, (+scaleIn.value) / 100));
    syncVal('scale', 'scaleNum', scaleIn.value);
    paintCard();
  });

  ['left', 'center', 'right'].forEach(function (a) {
    var b = document.querySelector('[data-align="' + a + '"]');
    if (a === cardState.align) b.classList.add('on');
    b.onclick = function () {
      cardState.align = a;
      document.querySelectorAll('[data-align]').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); paintCard();
    };
  });
  ['v', 'h'].forEach(function (d2) {
    var b = document.querySelector('[data-dir="' + d2 + '"]');
    if (d2 === cardState.twoDir) b.classList.add('on');
    b.onclick = function () {
      cardState.twoDir = d2;
      document.querySelectorAll('[data-dir]').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); paintCard();
    };
  });

  // 数字输入 ↔ 滑杆双向同步
  [['rot', 'rotNum'], ['zoom', 'zoomNum'], ['posx', 'posxNum'], ['posy', 'posyNum'],
   ['ratio', 'ratioNum'], ['scale', 'scaleNum'], ['vname', 'vnameNum'],
   ['vnameY', 'vnameYNum'], ['vnameS', 'vnameSNum'], ['edge', 'edgeNum']].forEach(function (p) {
    var r = document.getElementById(p[0]), n = document.getElementById(p[1]);
    function apply() {
      var v = parseFloat(n.value);
      if (isNaN(v)) return;
      v = Math.max(+r.min, Math.min(+r.max, v));
      n.value = v; r.value = v;
      r.dispatchEvent(new Event('input'));
    }
    n.addEventListener('input', apply);
    n.addEventListener('change', apply);
  });

  // 自定义心情
  var cmToggle = document.getElementById('cmToggle'),
      cmBox = document.getElementById('customMood'),
      cmE = document.getElementById('cmEmoji'),
      cmN = document.getElementById('cmName'),
      cmC = document.getElementById('cmColor');
  cmToggle.onclick = function (e) {
    e.stopPropagation();
    cmBox.hidden = !cmBox.hidden;
    if (!cmBox.hidden) cmN.focus();
  };
  function applyCustom() {
    var name = (cmN.value || '').trim();
    if (!name) return;
    var col = cmC.value;
    cardState.custom = { k: 'custom', n: name, e: (cmE.value || '🙂').trim() || '🙂', c: col, c2: col };
    cardState.mood = 'custom';
    document.querySelectorAll('#card-moods .mood').forEach(function (x) { x.classList.remove('on'); });
    paintCard();
  }
  [cmN, cmE, cmC].forEach(function (el) { el.addEventListener('input', applyCustom); });

  // 海报上是否显示心情标签（表情 + 名字）
  var moodOn = document.getElementById('moodOnCard');
  if (moodOn) {
    moodOn.checked = cardState.showMood;
    moodOn.addEventListener('change', function () {
      cardState.showMood = moodOn.checked;
      paintCard();
    });
  }

  document.getElementById('make').onclick = paintCard;
  document.getElementById('shuffle').onclick = function () {
    var i = TEMPLATES.findIndex(function (t) { return t.k === cardState.tpl; });
    cardState.tpl = TEMPLATES[(i + 1) % TEMPLATES.length].k;
    renderTemplates(); paintCard();
  };

  document.getElementById('save').onclick = function () {
    var svg = buildCard();
    var img = new Image();
    img.onload = function () {
      var d = dims(), cv = document.createElement('canvas');
      cv.width = d.W * 2; cv.height = d.H * 2;
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      var url = cv.toDataURL('image/png');
      // iOS 上 a.download 不落盘，改成展示图片让用户长按存相册
      var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (iOS) {
        var ov = document.getElementById('saveov');
        if (!ov) {
          ov = document.createElement('div');
          ov.id = 'saveov';
          ov.className = 'saveov';
          ov.innerHTML = '<div class="saveov__box"><p>长按下面的图片 → 存到相册</p>' +
            '<img alt="生成的卡片"><button class="ghost" type="button">关闭</button></div>';
          document.body.appendChild(ov);
          ov.querySelector('button').onclick = function () { ov.remove(); };
          ov.querySelector('img').src = url;
        } else {
          ov.querySelector('img').src = url;
        }
        return;
      }
      var a = document.createElement('a');
      a.download = buildFileName();
      a.href = url;
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  renderTemplates();
  renderThumbs();
  paintCard();
}
