// Actualiza textos/atributos del inspector sin reemplazar sus controles vivos.
// El inspector usa delegación de eventos; los botones se identifican por acción.
export function reconcileChildren(target, source) {
  for (let i = 0; i < source.childNodes.length; i++) {
    const next = source.childNodes[i];
    let current = target.childNodes[i];
    const action = next.dataset?.act;
    if (action && current?.dataset?.act !== action) {
      const existing = [...target.children].find((child) => child.dataset.act === action);
      if (existing) { target.insertBefore(existing, current || null); current = existing; }
    }
    if (!current) { target.appendChild(next.cloneNode(true)); continue; }
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName ||
        (action && current.dataset?.act !== action)) {
      target.replaceChild(next.cloneNode(true), current);
      continue;
    }
    if (next.nodeType === 3) { if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue; continue; }
    for (const attribute of [...current.attributes]) {
      if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
      if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    }
    for (const attribute of next.attributes) {
      if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    }
    reconcileChildren(current, next);
  }
  while (target.childNodes.length > source.childNodes.length) target.lastChild.remove();
}
