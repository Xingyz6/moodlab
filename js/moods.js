// ===== 心情词表（三处共用） =====
var MOODS = [
  { k: 'happy', n: '开心', e: '', c: '#ffb347', c2: '#ff7a59' },
  { k: 'calm',  n: '平静', e: '', c: '#5eead4', c2: '#38bdf8' },
  { k: 'blue',  n: '忧郁', e: '', c: '#818cf8', c2: '#6366f1' },
  { k: 'anx',   n: '焦虑', e: '', c: '#f472b6', c2: '#e11d48' },
  { k: 'tired', n: '疲惫', e: '', c: '#94a3b8', c2: '#64748b' },
  { k: 'angry', n: '愤怒', e: '', c: '#ef4444', c2: '#b91c1c' },
  { k: 'miss',  n: '想念', e: '', c: '#f59e0b', c2: '#d97706' },
  { k: 'up',    n: '兴奋', e: '', c: '#a3e635', c2: '#65a30d' }
];
function moodBy(k) { return MOODS.filter(function (m) { return m.k === k; })[0]; }

// 按底色亮度决定文字用深色还是白色（浅色心情如 兴奋/开心 用白字会看不清）
function relLum(hex) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var ch = [0, 2, 4].map(function (i) {
    var c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
// 深色/白色两种字取对比度更高的那个（按亮度阈值判会漏掉中色调：忧郁、愤怒）
function contrast(a, b) {
  var la = relLum(a), lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function inkFor(hex) {
  var dark = '#12161f', light = '#ffffff';
  return contrast(hex, dark) >= contrast(hex, light) ? dark : light;
}

// 多选版：selected 是数组，点击是切换，不是替换
function renderMoodChipsMulti(el, selected, onToggle, withNone) {
  el.innerHTML = '';
  function chip(key, label, on, color) {
    var b = document.createElement('button');
    b.className = 'mood' + (key === 'none' ? ' none' : '') + (on ? ' on' : '');
    if (color) {
      b.style.setProperty('--mc', color);
      b.style.setProperty('--mci', inkFor(color));
    }
    b.innerHTML = '<i></i>' + label;
    b.onclick = function () { onToggle(key); };
    el.appendChild(b);
  }
  if (withNone) chip('none', '不限', selected.length === 0, null);
  MOODS.forEach(function (m) {
    chip(m.k, m.n, selected.indexOf(m.k) !== -1, m.c);
  });
}

// 渲染一组心情胶囊，返回当前选中。withNone=true 时最前面加一个「不限」
function renderMoodChips(el, cur, onPick, withNone) {
  el.innerHTML = '';
  if (withNone) {
    var nb = document.createElement('button');
    nb.className = 'mood none' + (cur === 'none' ? ' on' : '');
    nb.innerHTML = '<i></i>不限';
    nb.onclick = function () {
      el.querySelectorAll('.mood').forEach(function (x) { x.classList.remove('on'); });
      nb.classList.add('on');
      onPick('none');
    };
    el.appendChild(nb);
  }
  MOODS.forEach(function (m) {
    var b = document.createElement('button');
    b.className = 'mood' + (m.k === cur ? ' on' : '');
    b.style.setProperty('--mc', m.c);
    b.style.setProperty('--mci', inkFor(m.c));
    b.innerHTML = '<i></i>' + m.n;
    b.onclick = function () {
      el.querySelectorAll('.mood').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      onPick(m.k);
    };
    el.appendChild(b);
  });
}
