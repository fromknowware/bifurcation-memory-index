/**
 * The RAM Index — embeddable ticker widget
 *
 * Usage — paste this one line where you want the live RAM Index scorecard:
 *
 *   <script src="https://ram-index.com/embed/ticker.js"></script>
 *
 * Optional attributes on the script tag:
 *   data-width  (default 300)  iframe width  in px
 *   data-height (default 205)  iframe height in px
 *
 * The widget renders the composite RI, the R_C / R_AI sub-indices, HBM
 * weight and a sparkline, and links back to ram-index.com.
 */
(function () {
  var s = document.currentScript;
  var width = parseInt((s && s.getAttribute('data-width')) || '300', 10);
  var height = parseInt((s && s.getAttribute('data-height')) || '205', 10);
  var src = (s && s.getAttribute('data-src')) || 'https://ram-index.com/embed/ticker.html';
  var f = document.createElement('iframe');
  f.src = src;
  f.width = width;
  f.height = height;
  f.style.border = '0';
  f.style.maxWidth = '100%';
  f.setAttribute('title', 'The RAM Index — live memory market signal');
  f.setAttribute('loading', 'lazy');
  if (s && s.parentNode) s.parentNode.insertBefore(f, s.nextSibling);
})();
