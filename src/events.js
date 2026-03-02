import { getModalOverlayElement } from "./dom.js";

export function bindModalOverlayClose(ui, doc = document) {
  const modalOverlayEl = getModalOverlayElement(doc);
  if (!modalOverlayEl) return;
  modalOverlayEl.onclick = ui.closeModal;
}