// 框架：首页 + 三个独立工具（心情不贯通，各管一摊）
var TABS = ['home', 'card', 'radio', 'science'];

function showTab(name) {
  if (TABS.indexOf(name) === -1) name = 'home';
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.classList.toggle('on', b.dataset.tab === name);
  });
  document.querySelectorAll('.panel').forEach(function (p) {
    p.classList.toggle('show', p.id === 'panel-' + name);
  });
  if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  window.scrollTo(0, 0);
  if (name === 'radio') renderReport();
}

document.querySelectorAll('#tabs button').forEach(function (b) {
  b.onclick = function () { showTab(b.dataset.tab); };
});
// 首页里一切 data-go="card|radio|science" 的元素都能直接跳过去
document.querySelectorAll('[data-go]').forEach(function (el) {
  el.addEventListener('click', function () { showTab(el.dataset.go); });
});
document.getElementById('homeLink').onclick = function (e) { e.preventDefault(); showTab('home'); };

// 首页图版：同一天画出同一张
(function () {
  var el = document.getElementById('heroPlate');
  if (!el) return;
  try {
    if (typeof Plate === 'undefined') throw new Error('Plate 未定义（plate.js 没加载）');
    var d = new Date();
    var seed = 'MoodLab-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    el.innerHTML = Plate.disc(seed, 720, 900, { cx: 0.66, cy: 0.5 });
  } catch (e) {
    el.textContent = '图版出错：' + e.message;   // 出错就写在页面上，别静默
  }
})();

// 首页的三个入口：用箭头切换，主按钮的动词跟着变
(function () {
  var TOOLS = [
    { k: 'card', label: '情绪卡片', verb: '写一张卡片',
      lead: '写下来，配一张照片，排成一张能存下来的卡片' },
    { k: 'radio', label: '情绪电台', verb: '听几首歌',
      lead: '说一句现在的心情，挑几首对得上的歌' },
    { k: 'science', label: '随心科普', verb: '看一条冷知识',
      lead: '每天一条冷知识，从杏仁核到机器学习' }
  ];
  var i = 0;
  var go = document.getElementById('homeGo');
  var lab = document.getElementById('swLabel');
  if (!go || !lab) return;
  function paint() {
    var t = TOOLS[i];
    go.dataset.go = t.k;
    go.innerHTML = t.verb + ' <span>ENTER</span>';
    lab.textContent = t.label;
    document.querySelector('.home-lead').textContent = t.lead;
  }
  document.getElementById('swPrev').onclick = function () { i = (i + TOOLS.length - 1) % TOOLS.length; paint(); };
  document.getElementById('swNext').onclick = function () { i = (i + 1) % TOOLS.length; paint(); };
  paint();
})();

initCard();
initRadio();
initScience();


if (new URLSearchParams(location.search).get('tune')) document.querySelector('.tune').open = true;

showTab((location.hash || '#home').slice(1));
