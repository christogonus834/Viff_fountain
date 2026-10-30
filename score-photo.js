// Prepares a photo of a scoresheet for reading: rotates it upright, shrinks it, turns it into clean black-on-white and
// erases the table's ruled lines (they confuse the text reader). Runs in the browser; the result is a small PNG.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ScorePhoto = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX_EDGE = 3000;

  // gray: Uint8ClampedArray/Uint8Array (w*h). Returns Uint8Array, 1 = ink, 0 = paper (after line removal).
  function binarize(gray, w, h) {
    var win = Math.max(15, Math.round(w / 50)) | 1, half = win >> 1, C = 14;
    var I = new Float64Array((w + 1) * (h + 1));                       // integral image
    for (var y = 0; y < h; y++) { var row = 0; for (var x = 0; x < w; x++) { row += gray[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
    var out = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - half), y1 = Math.min(h - 1, y + half);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - half), x1 = Math.min(w - 1, x + half);
        var sum = I[(y1 + 1) * (w + 1) + x1 + 1] - I[y0 * (w + 1) + x1 + 1] - I[(y1 + 1) * (w + 1) + x0] + I[y0 * (w + 1) + x0];
        var mean = sum / ((x1 - x0 + 1) * (y1 - y0 + 1));
        out[y * w + x] = gray[y * w + x] < mean - C ? 1 : 0;
      }
    }
    return out;
  }

  // Erase long straight-ish runs of ink (table borders). Tilt tolerant: a run may drift by one pixel per step.
  function removeLines(bw, w, h) {
    var minH = Math.round(w / 12), minV = Math.round(h / 30), kill = new Uint8Array(w * h), y, x, s, e;
    var dil = function (arr, i, step, stride) { return arr[i] || arr[i - stride] || arr[i + stride]; };
    for (y = 1; y < h - 1; y++) {                                       // horizontal
      s = -1;
      for (x = 0; x <= w; x++) {
        var on = x < w && dil(bw, y * w + x, 1, w);
        if (on && s < 0) s = x;
        if ((!on || x === w) && s >= 0) { e = x; if (e - s >= minH) for (var k = s; k < e; k++) { kill[(y - 1) * w + k] = kill[y * w + k] = kill[(y + 1) * w + k] = 1; } s = -1; }
      }
    }
    for (x = 1; x < w - 1; x++) {                                       // vertical
      s = -1;
      for (y = 0; y <= h; y++) {
        var on2 = y < h && dil(bw, y * w + x, 1, 1);
        if (on2 && s < 0) s = y;
        if ((!on2 || y === h) && s >= 0) { e = y; if (e - s >= minV) for (var m = s; m < e; m++) { kill[m * w + x - 1] = kill[m * w + x] = kill[m * w + x + 1] = 1; } s = -1; }
      }
    }
    for (var i = 0; i < bw.length; i++) if (kill[i]) bw[i] = 0;
    return bw;
  }


  // Estimate how much the page is tilted (degrees, -4..4) from how sharply the ink lines up in rows.
  function estimateSkew(gray, w, h) {
    var step = Math.max(2, Math.round(Math.max(w, h) / 700)), sw = Math.floor(w / step), sh = Math.floor(h / step), pts = [], i, x, y;
    var sum = 0, n = 0;
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) { sum += gray[(y * step) * w + x * step]; n++; }
    var thr = (sum / n) * 0.7;
    for (y = 0; y < sh; y++) for (x = 0; x < sw; x++) if (gray[(y * step) * w + x * step] < thr) pts.push(x, y);
    if (pts.length < 400) return 0;
    var best = 0, bestScore = -1, bins = sh * 2 + sw;
    for (var a = -4; a <= 4.001; a += 0.25) {
      var t = a * Math.PI / 180, sn = Math.sin(t), cs = Math.cos(t), hist = new Float32Array(bins + 4);
      for (i = 0; i < pts.length; i += 2) { var yy = Math.round(pts[i + 1] * cs - pts[i] * sn + sw); if (yy >= 0 && yy < bins) hist[yy]++; }
      var sc = 0; for (i = 0; i < hist.length; i++) sc += hist[i] * hist[i];
      if (sc > bestScore) { bestScore = sc; best = a; }
    }
    return best;
  }

  // File -> Blob (PNG). Throws an Error with a plain message for the teacher.
  async function prepare(file) {
    var bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { throw new Error('This photo could not be opened. Use a JPG or PNG photo (iPhone: set the camera to "Most Compatible").'); }
    var scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    if (w < 900) throw new Error('This photo is too small to read. Take it closer, with the whole page in view.');
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h), px = img.data, gray = new Uint8ClampedArray(w * h);
    for (var i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    var skew = estimateSkew(gray, w, h);
    if (Math.abs(skew) >= 0.25) {                                       // straighten the page
      var cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h; var c2 = cv2.getContext('2d', { willReadFrequently: true });
      c2.fillStyle = '#fff'; c2.fillRect(0, 0, w, h); c2.translate(w / 2, h / 2); c2.rotate(-skew * Math.PI / 180); c2.drawImage(cv, -w / 2, -h / 2);
      cv = cv2; ctx = c2; ctx.setTransform(1, 0, 0, 1, 0, 0); img = ctx.getImageData(0, 0, w, h); px = img.data;
      for (i = 0, j = 0; i < px.length; i += 4, j++) gray[j] = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    }
    var bw = removeLines(binarize(gray, w, h), w, h);
    for (i = 0, j = 0; i < px.length; i += 4, j++) { var v = bw[j] ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return new Promise(function (res, rej) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('Could not prepare the photo.')); }, 'image/png'); });
  }

  return { prepare: prepare, binarize: binarize, removeLines: removeLines, estimateSkew: estimateSkew };
}));
