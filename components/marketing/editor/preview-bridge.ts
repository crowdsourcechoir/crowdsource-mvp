const PREVIEW_BRIDGE_SOURCE = `(function () {
  var token = /(?:^|\\s)csc-sec-([A-Za-z0-9_-]+)/;
  var queued = 0;
  function measure() {
    var map = new Map();
    var nodes = document.querySelectorAll('[class*="csc-sec-"]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var match = String(el.className || "").match(token);
      if (!match) continue;
      var id = match[1].replace(/-outlook$/, "");
      var rect = el.getBoundingClientRect();
      var top = rect.top + window.scrollY;
      var height = rect.height;
      var prev = map.get(id);
      if (!prev || height > prev.height) map.set(id, { id: id, top: top, height: height });
    }
    var boxes = [];
    map.forEach(function (box) { boxes.push(box); });
    var height = Math.max(
      document.documentElement ? document.documentElement.scrollHeight : 0,
      document.body ? document.body.scrollHeight : 0
    );
    parent.postMessage({ source: "csc-email-preview", type: "layout", height: height, boxes: boxes }, "*");
  }
  function schedule() {
    if (queued) return;
    queued = requestAnimationFrame(function () {
      queued = 0;
      measure();
    });
  }
  window.addEventListener("load", schedule);
  window.addEventListener("resize", schedule);
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(document.documentElement);
  var images = document.getElementsByTagName("img");
  for (var n = 0; n < images.length; n++) {
    if (!images[n].complete) images[n].addEventListener("load", schedule);
  }
  schedule();
})();`;

/** Injects the editor measurement script into compiled preview HTML. Sends stay free of it. */
export function editorPreviewHtml(html: string): string {
  if (!html.trim()) return "";
  const tag = `<script>${PREVIEW_BRIDGE_SOURCE}</script>`;
  const marker = "</body>";
  const at = html.lastIndexOf(marker);
  if (at === -1) return `${html}${tag}`;
  return `${html.slice(0, at)}${tag}${html.slice(at)}`;
}
