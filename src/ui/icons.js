// أيقونات خطية بسيطة (SVG) — مرسومة يدويًا، بلا مكتبات خارجية.
const P = {
  camera: '<rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="m15.5 10 6-3.5v11l-6-3.5"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 13.5h.01M8.5 14.5h7"/>',
  library: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="m16 5 3.8-1 3 15.5-3.8.8z"/>',
  narrator: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M17 7c1 1 1 3 0 4M19.5 5c2 2 2 6 0 8"/>',
  flipv: '<g transform="rotate(90 12 12)"><path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/></g>',
  imgadd: '<rect x="3" y="4" width="14" height="14" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 16 4-4 5 5"/><path d="M19 14v6M16 17h6"/>',
  imgset: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="m3 15 5-5 5 5 3-3 5 5"/><circle cx="17" cy="8" r="1.5"/>',
  audioset: '<path d="M4 18V6M9 18V9M14 18V4M19 18v-7"/><circle cx="4" cy="14" r="1.6" fill="currentColor"/><circle cx="14" cy="9" r="1.6" fill="currentColor"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  timeline: '<rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="11" height="4" rx="1"/><rect x="8" y="16" width="13" height="4" rx="1"/>',
  cards: '<rect x="3" y="5" width="5" height="14" rx="1"/><rect x="10" y="5" width="5" height="14" rx="1"/><rect x="17" y="5" width="4" height="14" rx="1"/>',
  export: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4" height="16" fill="currentColor"/><rect x="14" y="4" width="4" height="16" fill="currentColor"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trim: '<path d="M6 4v16M18 4v16"/><path d="M6 8h12M6 16h12" stroke-dasharray="2 2"/>',
  split: '<path d="M12 3v18"/><rect x="3" y="7" width="6" height="10" rx="1"/><rect x="15" y="7" width="6" height="10" rx="1"/>',
  speed: '<path d="M12 13 16 8"/><path d="M4 18a8 8 0 1 1 16 0"/><circle cx="12" cy="13" r="1.5" fill="currentColor"/>',
  transition: '<rect x="2" y="6" width="9" height="12" rx="1"/><rect x="13" y="6" width="9" height="12" rx="1"/><path d="m10 12 4-3v6z" fill="currentColor"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  text: '<path d="M4 6V4h16v2M12 4v16M9 20h6"/>',
  sticker: '<path d="M15 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h9l6-6V6a3 3 0 0 0-3-3z"/><path d="M15 21v-4a2 2 0 0 1 2-2h4"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="10" r="1" fill="currentColor"/><path d="M8.5 14a4 4 0 0 0 5.5 0"/>',
  filter: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="9" r="6"/><circle cx="12" cy="15" r="6"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  aspect: '<rect x="3" y="6" width="18" height="12" rx="2"/><rect x="8" y="3" width="8" height="18" rx="2" stroke-dasharray="2 2"/>',
  delete: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  replace: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5zM16 7l5 5-5 5z"/>',
  freeze: '<path d="M12 2v20M4.9 6l14.2 12M4.9 18 19.1 6"/><path d="m9 3 3 3 3-3M9 21l3-3 3 3"/>',
  effects: '<path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
  template: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sfx: '<path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/>',
  beat: '<path d="M4 20V10M9 20V4M14 20v-7M19 20V8"/>',
  lyrics: '<path d="M4 6h10M4 10h14M4 14h8"/><path d="M17 20v-7l4-1v6"/><circle cx="15.5" cy="20" r="1.5"/>',
  pip: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="12" y="11" width="8" height="7" rx="1" fill="currentColor"/>',
  chroma: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7 19c0-3 2-5 5-5s5 2 5 5"/>',
  track: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>',
  captions: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 12h4M12 12h6M6 15h8M16 15h2"/>',
  adjust: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  frame: '<rect x="2" y="2" width="20" height="20" rx="2"/><rect x="6" y="6" width="12" height="12"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  detach: '<path d="M3 8h18M3 16h7"/><path d="M14 13l3 3-3 3M17 16h4" />',
  reverse: '<path d="M20 12H5M9 7l-5 5 5 5"/>',
  grade: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  zoom: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6M11 8v6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  background: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="6" width="8" height="12" fill="currentColor" opacity=".35"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/>',
  record: '<circle cx="12" cy="12" r="7" fill="currentColor"/>',
  wand: '<path d="m15 4 5 5L9 20l-5-5z"/><path d="M4 3v3M2.5 4.5h3M19 15v3M17.5 16.5h3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  tap: '<path d="M9 11V5a2 2 0 1 1 4 0v6"/><path d="M13 9a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8 5 5 0 0 1-4-2l-2-3a2 2 0 0 1 3-2l2 2"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
};

export function icon(name, size = 26) {
  const body = P[name] || P.info;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.hyd === el.dataset.icon) return;
    el.dataset.hyd = el.dataset.icon;
    const existing = el.querySelector('svg.ico');
    if (existing) existing.remove();
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon, el.classList.contains('sm') ? 22 : 26));
  });
}
