// شريط الأدوات بأسلوب فيفافيديو: أربع مجموعات في الأسفل (فيديو، صور، صوت، نص)،
// وفوقها صف أدوات المجموعة المختارة بأيقونات صغيرة واسم تحت كل أيقونة.
import { h, $ } from './dom.js';
import { icon } from './icons.js';

export const TABS = [
  { id: 'video', icon: 'camera', label: 'فيديو' },
  { id: 'image', icon: 'image', label: 'صور' },
  { id: 'audio', icon: 'mic', label: 'صوت' },
  { id: 'text', icon: 'keyboard', label: 'نص' },
];
const tools = [];
let tab = 'video';
try { tab = localStorage.getItem('maqta.tab') || 'video'; } catch {}
if (!TABS.some((t) => t.id === tab)) tab = 'video';

export function registerTool(t) {
  const i = tools.findIndex((x) => x.id === t.id);
  if (i >= 0) tools[i] = t; else tools.push(t);
  tools.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}
export const toolTab = (id) => tools.find((t) => t.id === id)?.group;
export const currentTab = () => tab;
export function setTab(id, render = true) {
  if (!TABS.some((t) => t.id === id) || id === tab) return;
  tab = id;
  try { localStorage.setItem('maqta.tab', id); } catch {}
  if (render) renderToolbar();
}

let lastActive = null;
export function renderToolbar(activeId = lastActive) {
  lastActive = activeId;
  const bar = $('#toolbar');
  bar.innerHTML = '';
  for (const t of tools) {
    if (t.group !== tab || t.hidden?.()) continue;
    const b = h('button.tool' + (activeId === t.id ? '.on' : ''), { type: 'button', 'data-tool': t.id, 'aria-label': t.label, onclick: () => t.run() });
    b.innerHTML = icon(t.icon, 22);
    b.append(h('span', {}, t.label));
    bar.append(b);
  }
  bar.scrollLeft = 0;
  const tb = $('#tabs');
  tb.innerHTML = '';
  for (const g of TABS) {
    const b = h('button.tab' + (g.id === tab ? '.on' : ''), { type: 'button', 'data-tab': g.id, 'aria-label': g.label, 'aria-pressed': g.id === tab ? 'true' : 'false', onclick: () => setTab(g.id) });
    b.innerHTML = icon(g.icon, 22);
    b.append(h('span', {}, g.label));
    tb.append(b);
  }
}
