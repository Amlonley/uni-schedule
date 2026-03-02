export function runWhenDocumentReady(callback, doc = document) {
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", callback, { once: true });
    return;
  }
  callback();
}