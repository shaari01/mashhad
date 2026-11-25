// الشريط السفلي: أيقونات كبيرة مع اسم عربي تحت كل أيقونة. كل أداة على بُعد لمستين على الأكثر.
import { h, $ } from './dom.js';
import { icon } from './icons.js';

const tools = [];
export function registerTool(t) {
  const i = tools.findIndex((x) => x.id === t.id);
  if (i >= 0) tools[i] = t; else tools.push(t);
  tools.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

export function renderToolbar(activeId = null) {
  const bar = $('#toolbar');
  bar.innerHTML = '';
  let lastGroup = null;
  for (const t of tools) {
    if (t.hidden?.()) continue;
    if (lastGroup && t.group !== lastGroup) bar.append(h('div.tool-sep'));
    lastGroup = t.group;
    const b = h('button.tool' + (activeId === t.id ? '.on' : ''), { type: 'button', 'data-tool': t.id, 'aria-label': t.label, onclick: () => t.run() });
    b.innerHTML = icon(t.icon, 30);
    b.append(h('span', {}, t.label));
    bar.append(b);
  }
}
