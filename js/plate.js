// 代码生成的“印刷图版”：网点、声纹、套准标记全部由种子算出来。
// 同一句话 / 同一天永远画出同一张，不依赖任何图片资源。
var Plate = (function () {
  var INK = '#21201C', RED = '#E4572E', BLUE = '#355E8C';

  function rng(seed) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  }

  function wave(R, W, H, cy, amp, color, w) {
    var n = Math.round(W / 3), d = 'M0 ' + cy, i, x, y;
    for (i = 1; i <= n; i++) {
      x = i * 3;
      var k = i / n;
      y = cy + Math.sin(k * Math.PI * 4) * amp * 0.5 + (R() - 0.5) * amp * 0.9;
      d += ' L' + x + ' ' + y.toFixed(1);
    }
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (w || 1.6) +
      '" opacity=".85" stroke-linejoin="round"/>';
  }

  function marks(W, H) {
    var o = 10, m = 16, s = '', pad = 6;
    [[o, o, 1, 1], [W - o, o, -1, 1], [o, H - o, 1, -1], [W - o, H - o, -1, -1]].forEach(function (p) {
      s += '<path d="M' + p[0] + ' ' + (p[1] + p[3] * m) + ' L' + p[0] + ' ' + p[1] + ' L' + (p[0] + p[2] * m) + ' ' + p[1] + '"/>';
    });
    return '<g stroke="' + INK + '" stroke-width="1" fill="none" opacity=".5">' + s + '</g>' +
      '<circle cx="' + o + '" cy="' + (H / 2) + '" r="2" fill="' + INK + '" opacity=".4"/>' +
      '<circle cx="' + (W - o) + '" cy="' + (H / 2) + '" r="2" fill="' + INK + '" opacity=".4"/>';
  }

  // 圆盘网点：越靠外越小、颜色从墨蓝过渡到朱红
  function disc(seed, W, H, opt) {
    opt = opt || {};
    var R = rng(seed), cx = W * (opt.cx === undefined ? 0.5 : opt.cx), cy = H * (opt.cy === undefined ? 0.5 : opt.cy), maxR = Math.min(W, H) * 0.44, dots = '', r, i, n, a;
    for (r = 8; r < maxR; r += 8) {
      n = Math.max(6, Math.round(2 * Math.PI * r / 9));
      for (i = 0; i < n; i++) {
        a = (i / n) * Math.PI * 2 + r * 0.012;
        var wob = 0.5 + 0.5 * Math.sin(a * 3 + r * 0.05);
        var rad = (2.1 + 2.4 * wob * (1 - r / maxR)) * Math.pow(R(), 0.45);
        if (rad < 0.5) continue;
        dots += '<circle cx="' + (cx + Math.cos(a) * r).toFixed(1) + '" cy="' + (cy + Math.sin(a) * r).toFixed(1) +
          '" r="' + rad.toFixed(2) + '" fill="' + (r > maxR * 0.66 ? RED : BLUE) +
          '" opacity="' + (0.7 + 0.3 * (1 - r / maxR)).toFixed(2) + '"/>';
      }
    }
    var clipId = 'd' + Math.floor(cx) + Math.floor(maxR);
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">' +
      '<defs><clipPath id="' + clipId + '"><circle cx="' + cx + '" cy="' + cy + '" r="' + (maxR * 0.96) + '"/></clipPath></defs>' +
      dots +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (maxR * 0.3) + '" fill="none" stroke="' + INK + '" stroke-width="1" opacity=".22"/>' +
      '<g clip-path="url(#' + clipId + ')" opacity=".82">' + wave(R, W, H, cy, H * 0.13, INK, 0.9) + '</g>' +
      '</svg>';
  }

  return { disc: disc, rng: rng };
})();
