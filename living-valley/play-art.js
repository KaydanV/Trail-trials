/** Layered character and equipment illustrations. Icons share the worn equipment art. */
let illustrationId = 0;
const clean = value => String(value ?? '').replace(/[^a-z0-9-]/gi, '');
const frame = (body, prefix, attributes = '') => `<svg class="pw-illustration" viewBox="0 0 120 120" aria-hidden="true" focusable="false" ${attributes}>${materials(prefix)}${body}</svg>`;
function materials(p) {
  return `<defs>
    <linearGradient id="${p}-forest" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a9b98a"/><stop offset=".38" stop-color="#708f68"/><stop offset="1" stop-color="#355d4d"/></linearGradient>
    <linearGradient id="${p}-canvas" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#e5cc95"/><stop offset=".45" stop-color="#b99b67"/><stop offset="1" stop-color="#7e6847"/></linearGradient>
    <linearGradient id="${p}-leather" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#b78357"/><stop offset=".5" stop-color="#76513b"/><stop offset="1" stop-color="#493f35"/></linearGradient>
    <linearGradient id="${p}-brass" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff0b6"/><stop offset=".25" stop-color="#e6c77f"/><stop offset=".53" stop-color="#b58c49"/><stop offset=".73" stop-color="#e8c77b"/><stop offset="1" stop-color="#81663e"/></linearGradient>
    <linearGradient id="${p}-teal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8ecac0"/><stop offset=".4" stop-color="#4d9994"/><stop offset="1" stop-color="#28545c"/></linearGradient>
    <linearGradient id="${p}-skin" x1="0" y1="0" x2=".75" y2="1"><stop stop-color="#ffe0aa"/><stop offset=".4" stop-color="#e8b880"/><stop offset="1" stop-color="#bd825b"/></linearGradient>
    <linearGradient id="${p}-trousers" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#52645c"/><stop offset="1" stop-color="#263e3c"/></linearGradient>
    <linearGradient id="${p}-red" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#e69e74"/><stop offset=".38" stop-color="#bf6553"/><stop offset="1" stop-color="#783f3d"/></linearGradient>
    <linearGradient id="${p}-indigo" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9c9ebd"/><stop offset=".4" stop-color="#646d97"/><stop offset="1" stop-color="#383e66"/></linearGradient>
    <radialGradient id="${p}-lens" cx=".35" cy=".25" r=".85"><stop stop-color="#effff0"/><stop offset=".25" stop-color="#b8f4d2"/><stop offset=".65" stop-color="#66c5ba"/><stop offset="1" stop-color="#24656b"/></radialGradient>
    <radialGradient id="${p}-glow"><stop stop-color="#d8f6b7" stop-opacity=".8"/><stop offset="1" stop-color="#d8f6b7" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}-lamp"><stop stop-color="#fff7ce"/><stop offset=".35" stop-color="#f6d990"/><stop offset="1" stop-color="#f6d990" stop-opacity="0"/></radialGradient>
  </defs>`;
}
const fill = (p, material) => `url(#${p}-${material})`;
function hatArt(id, p) {
  const u = name => fill(p, name);
  const common = `stroke="#394e42" stroke-width="1.5" stroke-linejoin="round"`;
  if (/antenna/.test(id)) return `<g class="pw-hat pw-hat-antenna" data-hat-art="antenna-cap">
    <circle class="pw-antenna-halo" cx="72" cy="7" r="13" fill="${u('glow')}"/>
    <path d="m67 23 3-7-1-4 3-3" fill="none" stroke="#5b5e46" stroke-width="4" stroke-linecap="round"/><path d="m67 23 3-7-1-4 3-3" fill="none" stroke="${u('brass')}" stroke-width="2"/>
    <circle cx="72" cy="7" r="4.5" fill="${u('lens')}" stroke="#366366" stroke-width="1.3"/><circle cx="71" cy="5.5" r="1.4" fill="#efffd4"/>
    <path d="M32 33q1-22 27-22 28 0 29 23l-8 8H39z" fill="${u('teal')}" ${common}/>
    <path d="M39 29q4-15 20-15 14 0 20 13" fill="none" stroke="#b7e3cf" stroke-width="2" opacity=".7"/>
    <path d="m56 12 2 18m5-18 1 17" stroke="#23535b" stroke-width="1.3" opacity=".7"/>
    <path d="M28 32q31-9 63 0l7 6q-32 11-70 0z" fill="${u('brass')}" ${common}/>
    <path d="M32 34q28-6 56 0" fill="none" stroke="#fff1ba" stroke-width="1.5"/>
    <rect x="32" y="27" width="9" height="14" rx="3" fill="${u('brass')}" stroke="#5d684b" stroke-width="1.4"/><circle cx="36.5" cy="33" r="2.5" fill="#203e46"/><path d="m36.5 31-1 2.5" stroke="#b5e6cf" stroke-width="1.2"/>
    <path d="m47 32 5-4 6 4-5 5z" fill="#d6efc0" stroke="#4a7e70" stroke-width="1"/><path d="m73 28 7 1m-6 3 7 1" stroke="#2a666a" stroke-width="1.5"/>
  </g>`;
  if (/acorn|crown/.test(id)) return `<g class="pw-hat pw-hat-acorn" data-hat-art="acorn-crown">
    <path d="m37 32-3-14 12 8 14-16 13 16 13-8-3 15" fill="${u('brass')}" stroke="#74573b" stroke-width="1.6"/>
    <path d="m45 19 3-9 9 3-2 10m14 1 1-13 10 2 1 13" fill="#78925b" stroke="#526b44" stroke-width="1.3"/>
    <path d="M38 29q22-17 44 0v11H38z" fill="${u('leather')}" stroke="#5c4934" stroke-width="1.5"/>
    <path d="M31 28q30-19 59 0l-4 12q-27 8-51 0z" fill="${u('brass')}" stroke="#685239" stroke-width="1.7"/>
    <path d="m37 29 7 7 7-10 9 9 10-10 7 11 7-7m-47 4 47 3" fill="none" stroke="#7d613c" stroke-width="1.1" opacity=".8"/>
    <path d="M47 25q13-15 26 0l-4 12-10 6-10-6z" fill="${u('canvas')}" stroke="#775439" stroke-width="1.3"/>
    <path d="M45 24q15-13 30 0l-2 5q-14 5-27 0z" fill="${u('leather')}" stroke="#6d4f36" stroke-width="1.2"/>
    <path d="m59 18 2-8 5-3" fill="none" stroke="#79603b" stroke-width="3.4" stroke-linecap="round"/><path d="m64 12q10-10 16-1-8 8-16 1" fill="#87a15a" stroke="#49653f" stroke-width="1.2"/>
    <path d="m41 33 3 2m34-1 3-2" stroke="#fff0b2" stroke-width="2" stroke-linecap="round"/>
  </g>`;
  if (/mushroom/.test(id)) return `<g class="pw-hat pw-hat-mushroom" data-hat-art="mushroom-cap">
    <path d="M34 27q26-12 53 0l-5 13q-23 9-45 0z" fill="${u('canvas')}" stroke="#725840" stroke-width="1.5"/>
    <path d="m41 29 4 9m5-11 2 13m9-13v14m8-13-2 12m9-10-2 8" stroke="#9b8059" stroke-width="1.2"/>
    <path d="M22 30Q31 6 54 5q28-5 45 24 1 11-37 10-41 0-40-9" fill="${u('red')}" stroke="#644b3f" stroke-width="1.7"/>
    <path d="M27 27Q40 8 58 9q18-1 31 14" fill="none" stroke="#f1bb8a" stroke-width="1.5" opacity=".8"/>
    <ellipse cx="40" cy="22" rx="6" ry="4.5" fill="#f2dfb0" transform="rotate(-22 40 22)"/><ellipse cx="62" cy="13" rx="6.5" ry="4" fill="#f9e9c6"/><ellipse cx="81" cy="25" rx="5.4" ry="4" fill="#edcc98" transform="rotate(20 81 25)"/>
    <path d="M27 31q33 11 67-1" fill="none" stroke="#703d3b" stroke-width="1.7"/><circle cx="58" cy="30" r="2" fill="#e7bc82"/><path d="m32 33 3-2m53 1 4-2" stroke="#ffdfab" stroke-width="1.4"/>
  </g>`;
  if (/hardhat/.test(id)) return `<g class="pw-hat pw-hat-hardhat" data-hat-art="ranger-hardhat">
    <path d="M31 33q-1-27 28-29 29 1 31 29z" fill="${u('brass')}" stroke="#806137" stroke-width="1.7"/>
    <path d="M39 28q1-19 15-21m22 21Q75 12 65 7" fill="none" stroke="#fff0b2" stroke-width="3" opacity=".8"/>
    <path d="m57 6-2 26h10L63 6" fill="#e8c077" stroke="#a57c40" stroke-width="1.2"/>
    <path d="M25 31q35-7 71 0v8q-36 10-71 0z" fill="${u('brass')}" stroke="#76603b" stroke-width="1.7"/>
    <path d="M28 34q31-4 64 0" fill="none" stroke="#fff1b7" stroke-width="1.7"/><path d="m35 28 5 1m43-2-5 2" stroke="#826941" stroke-width="1.3"/>
    <rect x="48" y="21" width="24" height="19" rx="5" fill="#365950" stroke="#acac75" stroke-width="1.5"/><circle cx="60" cy="30" r="7" fill="${u('brass')}" stroke="#294f4d" stroke-width="1"/><circle cx="60" cy="30" r="4.7" fill="${u('lens')}"/><path d="m57 27 3-1" stroke="#f7ffe2" stroke-width="1.5" stroke-linecap="round"/>
    <path d="m29 39 3 6 7-4m49 0 3 4 3-6" fill="#907145" stroke="#654d33" stroke-width="1.3"/>
  </g>`;
  if (/starry|wizard/.test(id)) return `<g class="pw-hat pw-hat-starry" data-hat-art="starry-cap">
    <path d="M33 33q11-7 14-23 6-14 26-11l-6 9q13 11 18 25z" fill="${u('indigo')}" stroke="#424764" stroke-width="1.6"/>
    <path d="M49 23q3-15 14-19m8 12 8 13" fill="none" stroke="#b4b6cf" stroke-width="1.3" opacity=".75"/>
    <path d="M25 34q36-13 72 0l-3 7q-34 11-66 0z" fill="${u('indigo')}" stroke="#3a425d" stroke-width="1.8"/>
    <path d="m36 29 48 1-1 7-46-1z" fill="${u('leather')}" stroke="#4b4250" stroke-width="1"/><rect x="57" y="29" width="11" height="8" rx="1" fill="${u('brass')}" stroke="#b69861" stroke-width="1"/><rect x="60" y="31" width="5" height="4" fill="#755e59"/>
    <path d="m57 13 1.7 4.3 4.6.4-3.5 3 .9 4.5-3.7-2.5-4 2.2 1.2-4.4-3.3-3.2 4.6-.1z" fill="#f6dc93" stroke="#d7b86e" stroke-width=".5"/><path d="m75 23 1 2.8 3 .3-2.3 2 .6 2.9-2.4-1.6-2.6 1.4.8-2.9-2.1-2.1 3-.1z" fill="#eedba4"/>
    <path d="M31 36q25 8 55 1" fill="none" stroke="#b6b2d1" stroke-width="1.2" opacity=".8"/><circle cx="48" cy="29" r=".8" fill="#f9e6ad"/><circle cx="68" cy="13" r="1" fill="#f9e6ad"/>
  </g>`;
  return `<g class="pw-hat pw-hat-rookie" data-hat-art="starter-cap">
    <path d="M33 32q1-22 26-23 25 0 29 23l-13 8H44z" fill="${u('forest')}" ${common}/>
    <path d="M40 27q2-14 19-15 17 0 22 15" fill="none" stroke="#b9c798" stroke-width="1.5" opacity=".8"/>
    <path d="m51 12-3 18m18-18 4 18" fill="none" stroke="#4c7154" stroke-width="1.2"/><path d="M30 31q31-10 63 0l6 6q-36 12-75 0z" fill="${u('canvas')}" stroke="#4b6045" stroke-width="1.6"/>
    <path d="M29 35q31-9 64 0m-57 1q25-5 49-1" fill="none" stroke="#e7d599" stroke-width="1.2" stroke-dasharray="2 2"/>
    <path d="m52 16 9-4 9 4-1 12-8 5-8-5z" fill="${u('brass')}" stroke="#476246" stroke-width="1.2"/><path d="m55 24 4-5 3 3 3-4 2 7z" fill="#496950"/><circle cx="62" cy="17" r="1.4" fill="#fff1b1"/>
    <path d="M37 29h10m28 0h10" stroke="#254e43" stroke-width="1.2"/><circle cx="39" cy="25" r=".7" fill="#d9d59f"/><circle cx="81" cy="25" r=".7" fill="#d9d59f"/>
  </g>`;
}
function boot(p, left = true) {
  const x = left ? 41 : 67;
  return `<path d="M${x} 97h13l1 10 5 5q-2 4-9 4h-16l-1-5 6-6z" fill="${fill(p, 'leather')}" stroke="#31453d" stroke-width="1.6"/>
    <path d="M${x-5} 112h24v4h-24z" fill="#263a35"/><path d="m${x+2} 100 8 1m-8 3 8 1m-9 3 9 1" stroke="#d4b98b" stroke-width="1"/>
    <path d="m${x-1} 111 10 1" stroke="#bd9667" stroke-width="1.3"/>`;
}
function leg(p, left = true) {
  const x = left ? 44 : 67;
  return `<g class="pw-ranger-leg pw-leg-${left ? 'left' : 'right'}"><path d="M${x} 80h12l-1 23-14-1z" fill="${fill(p, 'trousers')}" stroke="#2e4540" stroke-width="1.5"/>
    <path d="m${x+3} 85 7 1-1 10-7-1z" fill="#627365" opacity=".8"/><path d="m${x+1} 83 1 16" stroke="#94a286" stroke-width=".9" opacity=".7"/>${boot(p, left)}</g>`;
}
function arm(p, left = true) {
  const side = left ? 'left' : 'right';
  return `<g class="pw-ranger-arm pw-arm-${side}">${left ? `<path d="M40 54q-11 2-13 13l-3 17 11 3 9-27z" fill="${fill(p, 'forest')}" stroke="#3b5748" stroke-width="1.6"/><path d="m26 77 10 3-2 8-11-3z" fill="${fill(p, 'canvas')}" stroke="#657354" stroke-width="1.2"/><path d="m25 85 8 2-2 8-6 1-4-5z" fill="${fill(p, 'skin')}" stroke="#8e6d4f" stroke-width="1.1"/><path d="m27 90 3 1" stroke="#b1855c" stroke-width="1"/>` : `<path d="M78 54q10 2 14 13l5 17-11 4-10-27z" fill="${fill(p, 'forest')}" stroke="#3b5748" stroke-width="1.6"/><path d="m85 80 10-4 3 9-11 4z" fill="${fill(p, 'canvas')}" stroke="#657354" stroke-width="1.2"/><path d="m88 87 8-3 4 7-3 5-6-1z" fill="${fill(p, 'skin')}" stroke="#8e6d4f" stroke-width="1.1"/><path d="m91 90 4-1" stroke="#b1855c" stroke-width="1"/>`}</g>`;
}
export function renderRanger(hat = 'starter-cap') {
  const p = `pw-ranger-art-${++illustrationId}`, u = name => fill(p, name);
  return frame(`<ellipse class="pw-character-shadow" cx="60" cy="114" rx="27" ry="5" fill="#092e30" opacity=".37"/>
    ${leg(p, false)}${leg(p, true)}
    <g class="pw-ranger-satchel"><path d="M78 56q15-3 16 13l-1 20-12 4-8-6 1-25z" fill="${u('canvas')}" stroke="#405849" stroke-width="1.6"/><path d="m80 63 12 1-1 13-12 1z" fill="${u('leather')}" stroke="#796346" stroke-width="1"/><path d="m81 64 10 1-1 6-9 1z" fill="#d9bb7d"/><rect x="84" y="69" width="4" height="6" rx="1" fill="${u('brass')}"/><path d="M88 57v-7q4-4 7 0v21" fill="none" stroke="#b78e58" stroke-width="2"/><path d="M88 53h7" stroke="#e4c47f" stroke-width="1.2"/></g>
    ${arm(p, false)}
    <g class="pw-ranger-torso"><path d="m42 52 17-3 19 3 8 32-8 7H42l-9-8z" fill="${u('forest')}" stroke="#2f5143" stroke-width="1.8"/>
    <path d="m43 55 14 10 3-13 5 13 12-10-3 17H47z" fill="#aabd8d" stroke="#4f7256" stroke-width="1.1"/><path d="M60 66v17" stroke="#d9cc9c" stroke-width="1.4"/><circle cx="60" cy="74" r="1" fill="#e9d79f"/>
    <path d="m41 70 13 1-1 10-12-1z" fill="#648164" stroke="#3a5d4b" stroke-width="1"/><path d="m42 72 10 .6" stroke="#bac99d" stroke-width=".9"/><path d="m68 69 10-1 1 10-11 1z" fill="#7e966e" stroke="#3a5d4b" stroke-width="1"/><path d="m69 72 8-1" stroke="#c3cea1" stroke-width=".9"/>
    <path d="m42 52 4 2-7 28-4-1z" fill="${u('leather')}" stroke="#4a4e38" stroke-width="1"/><path d="m76 52-4 1 9 28 4-1z" fill="${u('leather')}" stroke="#4a4e38" stroke-width="1"/>
    <path d="M35 81h49v7H35z" fill="${u('leather')}" stroke="#354a3e" stroke-width="1.2"/><rect x="56" y="80" width="11" height="9" rx="1.4" fill="${u('brass')}" stroke="#715b39" stroke-width="1"/><rect x="59" y="82.5" width="5" height="4" rx=".5" fill="#5e6046"/>
    <path d="m70 80 9-1 2 12-10 1z" fill="${u('canvas')}" stroke="#5e6346" stroke-width="1"/><path d="m73 82 6 .2" stroke="#e7d49c" stroke-width=".8"/>
    <path class="pw-ranger-backpack" d="M40 56q20-11 39 0l-1 29-18 6-19-5z" fill="${u('canvas')}" stroke="#465b47" stroke-width="1.7"/><g class="pw-ranger-backpack"><path d="M40 57q20-9 39 0l-4 13-15 4-16-4z" fill="${u('forest')}" stroke="#516c4a" stroke-width="1.2"/><path d="M57 60h6v21h-6z" fill="${u('leather')}"/><rect x="55" y="69" width="10" height="8" rx="1" fill="${u('brass')}"/><path d="m46 78 9-1v7l-9-1m19-6 9 1v5l-9 1" fill="#7f9668" stroke="#5a714d" stroke-width="1"/></g></g>
    ${arm(p, true)}
    <g class="pw-ranger-head"><path d="M52 49h17v11l-9 6-10-7z" fill="${u('skin')}" stroke="#986e4c" stroke-width="1.2"/>
    <path d="m47 55 13 5 13-5 3 7-15 6-15-7z" fill="${u('red')}" stroke="#825244" stroke-width="1"/><path d="m59 63-4 13 9 2 2-12" fill="${u('red')}" stroke="#825244" stroke-width="1"/><path d="m57 73 7 2" stroke="#efb78b" stroke-width="1"/>
    <path d="M40 30q19-17 39 0l2 16q-2 16-20 17-19-1-22-17z" fill="${u('skin')}" stroke="#715d44" stroke-width="1.5"/>
    <ellipse cx="40" cy="43" rx="4" ry="5" fill="${u('skin')}" stroke="#a27b54" stroke-width="1"/><ellipse cx="80" cy="43" rx="4" ry="5" fill="${u('skin')}" stroke="#a27b54" stroke-width="1"/>
    <path d="M39 39V26q21-16 42 0v14l-7-9-12-2-14 5-4 8z" fill="${u('leather')}" stroke="#5b4a37" stroke-width="1.2"/><path d="m43 30 8-5m18 0 7 5" stroke="#b18457" stroke-width="1.1"/>
    <g class="pw-ranger-face"><path d="m47 40 7-1m12 0 7 1" fill="none" stroke="#655039" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="51" cy="44" rx="2.3" ry="2.7" fill="#243e39"/><ellipse cx="70" cy="44" rx="2.3" ry="2.7" fill="#243e39"/><circle cx="50.4" cy="43.1" r=".75" fill="#fff1c9"/><circle cx="69.4" cy="43.1" r=".75" fill="#fff1c9"/>
    <path d="m61 44-2 6 4 1" fill="none" stroke="#be885c" stroke-width="1.1" stroke-linecap="round"/><ellipse cx="47" cy="50" rx="4" ry="2" fill="#d99d78" opacity=".7"/><ellipse cx="74" cy="50" rx="4" ry="2" fill="#d99d78" opacity=".7"/>
    <path d="M55 54q6 4 12-1" fill="none" stroke="#925a43" stroke-width="1.6" stroke-linecap="round"/><path d="m57 54 7 .1" stroke="#fff0c6" stroke-width="1"/></g>
    <path class="pw-ranger-back-head" d="M40 32q20-12 40 0v16q-3 14-20 15-18-3-20-15z" fill="${u('leather')}" stroke="#674f39" stroke-width="1.2"/>
    ${hatArt(clean(hat), p)}</g>`, p, `data-character-art="ranger" data-equipped-hat="${clean(hat)}"`);
}
function trailArt(id, p) {
  const u = name => fill(p, name);
  if (id === 'none') return `<path d="m27 79 5-16 12 3-1 17-12 7-8-4zm38-33 5-15 12 3-1 18-12 6-8-3z" fill="${u('leather')}" stroke="#485c49" stroke-width="1.5"/><path d="m26 83 14-1m27-29 13-1" stroke="#d3ba87" stroke-width="2"/><path d="m47 94 34-16m-41-24 10-12" stroke="#91b394" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 7"/>`;
  if (/circuit/.test(id)) return `<path d="m23 88 19-16V58h19V40l33-17M26 95l27-21V62h19V42l22-13" fill="none" stroke="#427b76" stroke-width="6" stroke-linejoin="round"/><path d="m23 88 19-16V58h19V40l33-17" fill="none" stroke="#a5f2d1" stroke-width="2" stroke-linejoin="round"/><g fill="${u('lens')}" stroke="#5aa496" stroke-width="1.4"><circle cx="23" cy="88" r="5"/><circle cx="42" cy="58" r="5"/><circle cx="61" cy="40" r="5"/><circle cx="94" cy="23" r="6"/></g><path d="m83 67 3-8 3 8 8 3-8 3-3 8-3-8-8-3z" fill="#d8f9ba"/>`;
  if (/lantern/.test(id)) return `<circle cx="60" cy="59" r="51" fill="${u('lamp')}"/><path d="M48 32v-9q12-13 24 0v9" fill="none" stroke="${u('brass')}" stroke-width="4"/><path d="m39 38 21-12 22 12-4 45-18 9-19-9z" fill="${u('brass')}" stroke="#736a45" stroke-width="1.7"/><path d="M47 41h26v38H47z" fill="#f4d99d" stroke="#aa935b" stroke-width="1.3"/><path d="m60 48-7 19 7-3-3 13 12-20-8 3z" fill="#fff7c9"/><path d="M40 39h41m-38 43h35M60 31v57" stroke="#8b7a50" stroke-width="2"/><path d="m22 39 3-7 3 7 7 3-7 3-3 7-3-7-7-3zm66 45 2-6 2 6 6 2-6 2-2 6-2-6-6-2z" fill="#f7dc95"/>`;
  return `<path d="M18 95q57-10 40-43T97 18" fill="none" stroke="#87a78c" stroke-width="2" stroke-dasharray="2 6"/>${[[30,82],[54,59],[66,38],[91,24]].map(([x,y],i)=>`<g><circle cx="${x}" cy="${y}" r="${12-i}" fill="${u('glow')}"/><ellipse cx="${x-3}" cy="${y-3}" rx="5" ry="2.8" fill="#d8e9bc" opacity=".8" transform="rotate(-35 ${x} ${y})"/><ellipse cx="${x+3}" cy="${y-3}" rx="5" ry="2.8" fill="#c4dfb1" opacity=".8" transform="rotate(35 ${x} ${y})"/><path d="M${x} ${y-4}v8" stroke="#334f43" stroke-width="2.5" stroke-linecap="round"/><circle cx="${x}" cy="${y+4}" r="3" fill="${u('lens')}"/></g>`).join('')}`;
}
/** The pack displays the actual object, enlarged, rather than a tiny full character. */
export function renderGearIcon(id) {
  const key = clean(id || 'starter-cap'), p = `pw-gear-art-${++illustrationId}`, u = name => fill(p, name);
  let body;
  if (/trail/.test(key) || key === 'none') body = trailArt(key, p);
  else if (/biscuit/.test(key)) body = `<ellipse cx="60" cy="101" rx="40" ry="6" fill="#1c443b" opacity=".18"/><path d="m25 48 64-2 8 38q-3 14-36 17-34-1-39-14z" fill="${u('teal')}" stroke="#3b5c54" stroke-width="2"/><path d="M23 51q35 13 68-2l-2-7H26z" fill="${u('brass')}" stroke="#6f7954" stroke-width="1.5"/><path d="m28 52 7 33m53-33-5 34" stroke="#abd1b5" stroke-width="1.2"/><path d="m40 69 36-1 1 14-36 1z" fill="#e5ca8e" stroke="#9c8855" stroke-width="1.2"/><path d="m48 76 5-4 6 4-5 4z" fill="#65836a"/><path d="M64 74h7m-7 4h7" stroke="#7c8256" stroke-width="1.2"/><ellipse cx="59" cy="43" rx="34" ry="10" fill="#5c7863" stroke="#c7b47a" stroke-width="2"/><g fill="${u('canvas')}" stroke="#9c7547" stroke-width="1.4"><circle cx="43" cy="38" r="14"/><circle cx="66" cy="31" r="17"/><circle cx="78" cy="42" r="13"/></g><g fill="#976b42"><circle cx="60" cy="24" r="2"/><circle cx="72" cy="26" r="2"/><circle cx="65" cy="35" r="2"/><circle cx="38" cy="34" r="1.6"/><circle cx="47" cy="41" r="1.6"/><circle cx="78" cy="41" r="1.7"/><circle cx="84" cy="46" r="1.4"/></g><path d="M28 23q30-24 62-3l-4 17q-29-13-56 3z" fill="${u('teal')}" stroke="#496858" stroke-width="1.7"/><path d="M36 20q21-10 42-1" fill="none" stroke="#c5dcc1" stroke-width="1.5"/><path d="m53 19 7-6 8 6-2 10-7 2-6-4z" fill="${u('brass')}" stroke="#7d8056" stroke-width="1"/>`;
  else if (/torch/.test(key)) body = `<circle cx="60" cy="30" r="27" fill="${u('lamp')}"/><path d="m43 36 34-2-2 62q-15 12-30 0z" fill="${u('forest')}" stroke="#3e5746" stroke-width="2"/><path d="m49 49 20-1-1 35-18 1z" fill="${u('leather')}" stroke="#686445" stroke-width="1.2"/><path d="m50 54 17-1m-17 7 17-1m-17 7 17-1m-17 7 17-1" stroke="#bea376" stroke-width="1"/><path d="m40 29 40-1-1 16-37 1z" fill="${u('brass')}" stroke="#736a44" stroke-width="1.7"/><ellipse cx="60" cy="29" rx="20" ry="12" fill="${u('brass')}" stroke="#7b7047" stroke-width="1.8"/><ellipse cx="60" cy="28" rx="14" ry="8" fill="${u('lens')}" stroke="#6c946f" stroke-width="1.4"/><path d="M51 26q8-4 14-1" fill="none" stroke="#f3ffd7" stroke-width="2" stroke-linecap="round"/><path d="M46 94q15 7 29-1l-1 8q-13 9-28 0z" fill="${u('brass')}" stroke="#6c7048" stroke-width="1.5"/><rect x="65" y="52" width="5" height="11" rx="2" fill="#d7c382"/><path d="M49 104q-3 11 9 10" fill="none" stroke="#7e7150" stroke-width="2"/>`;
  else body = `<ellipse cx="60" cy="98" rx="38" ry="6" fill="#163e36" opacity=".16"/><g transform="translate(-14 34) scale(1.25)">${hatArt(key,p)}</g>`;
  return frame(body, p, `data-gear-id="${key}" data-art-variant="equipment"`);
}
export function renderNova() {
  const p = `pw-nova-art-${++illustrationId}`, u = name => fill(p, name);
  return frame(`<ellipse cx="60" cy="114" rx="26" ry="5" fill="#102e2b" opacity=".35"/>${leg(p,false)}${leg(p,true)}<path d="M41 29q-8 2-7 22l-5 13 18-4 29 2 14-1-6-11q4-26-12-28z" fill="${u('leather')}" stroke="#4e4736" stroke-width="1.5"/><path d="M42 54q18-8 35 0l10 30-10 9H41l-9-10z" fill="${u('forest')}" stroke="#3c5945" stroke-width="1.7"/><path d="m41 55 17 14 17-14-5 21H47z" fill="${u('canvas')}" stroke="#6b7d54" stroke-width="1.1"/><path d="M59 68v18" stroke="#d5cf9a" stroke-width="1.2"/><path d="M36 82h47v7H36z" fill="${u('leather')}" stroke="#3b4d3c" stroke-width="1"/><rect x="54" y="81" width="11" height="9" rx="1" fill="${u('brass')}" stroke="#74613f" stroke-width="1"/><rect x="57" y="84" width="5" height="3" fill="#6b7050"/>
    <path d="M40 57q-11 4-17 18l9 8 13-18m32-9q13 7 15 22l-9 5-12-20" fill="${u('forest')}" stroke="#3c5945" stroke-width="1.6"/>
    <path d="m22 73 10 7-3 8-12-7z" fill="${u('canvas')}" stroke="#62724e" stroke-width="1.1"/><path d="m23 82 8 3-2 9-8-1-3-5z" fill="${u('skin')}" stroke="#987a54" stroke-width="1.1"/><path d="m84 78 9-4 5 10-9 5z" fill="${u('canvas')}" stroke="#62724e" stroke-width="1.1"/><path d="m89 85 8-3 4 7-3 5-7-1z" fill="${u('skin')}" stroke="#987a54" stroke-width="1.1"/>
    <path d="m84 73 7-3 12 27-8 4z" fill="#e9d5a3" stroke="#9e8451" stroke-width="1.2"/><ellipse cx="87" cy="71" rx="4" ry="2" fill="#f4e8bd" stroke="#a78f5c" stroke-width="1"/><path d="m90 81 7-3m-4 12 7-3" stroke="#6b8b68" stroke-width="1.4"/>
    <path d="M52 48h16v12l-9 7-9-7z" fill="${u('skin')}" stroke="#9d7751" stroke-width="1.2"/><path d="m47 57 13 5 13-6 3 7-15 7-14-6z" fill="${u('red')}" stroke="#845342" stroke-width="1.1"/><path d="m59 65 3 16 7-2-4-14" fill="${u('red')}" stroke="#845342" stroke-width="1.1"/>
    <path d="M40 31q20-17 40 0v17q-3 14-20 16-17-2-20-16z" fill="${u('skin')}" stroke="#7c6547" stroke-width="1.5"/><path d="M38 39V27q22-18 44 0l-2 17-10-16-10 7-12 2-5 12z" fill="${u('leather')}" stroke="#67513a" stroke-width="1.2"/>
    <path d="m48 41 7-1m12 0 6 1" stroke="#70533a" stroke-width="1.7" stroke-linecap="round"/><ellipse cx="51" cy="45" rx="2.2" ry="2.6" fill="#263e36"/><ellipse cx="69" cy="45" rx="2.2" ry="2.6" fill="#263e36"/><circle cx="50.3" cy="44" r=".8" fill="#fff1d0"/><circle cx="68.3" cy="44" r=".8" fill="#fff1d0"/><ellipse cx="46" cy="50" rx="4" ry="2" fill="#d59b71" opacity=".7"/><ellipse cx="74" cy="50" rx="4" ry="2" fill="#d59b71" opacity=".7"/><path d="m60 45-2 6h4m-8 4q7 4 13-1" fill="none" stroke="#a06f4c" stroke-width="1.3" stroke-linecap="round"/>${hatArt('starter-cap',p)}<path d="m37 25-8-10 11 5 2-10 5 13" fill="#ba7055" stroke="#765644" stroke-width="1.1"/>`, p, 'data-character-art="nova"');
}
export function renderPatch() {
  const p = `pw-patch-art-${++illustrationId}`, u = name => fill(p,name);
  return frame(`<ellipse cx="60" cy="113" rx="29" ry="5" fill="#0b2a2c" opacity=".38"/><g class="pw-patch-body">
    <path d="m41 88-5 13 9 7 7-15m17-1 8 15 10-6-9-14" fill="${u('brass')}" stroke="#60634a" stroke-width="2"/><path d="M30 102h18l5 10H27q-2-5 3-10m44 0h18l3 10H71z" fill="${u('leather')}" stroke="#45574b" stroke-width="1.6"/><path d="M29 109h22m21 0h21" stroke="#cfad70" stroke-width="1.2"/>
    <g class="pw-patch-arm"><path d="m34 65-13 9-4-12" fill="none" stroke="#565f4a" stroke-width="9" stroke-linecap="round"/><path d="m34 65-13 9-4-12" fill="none" stroke="${u('brass')}" stroke-width="6" stroke-linecap="round"/><circle cx="21" cy="74" r="4" fill="${u('teal')}" stroke="#6e7854" stroke-width="1.2"/><path d="m17 63-4-7 3-4 4 4 3-5 4 3-6 10" fill="${u('brass')}" stroke="#5e6248" stroke-width="1.4"/></g>
    <path d="m86 66 12 11-3 12" fill="none" stroke="#5b644d" stroke-width="9" stroke-linecap="round"/><path d="m86 66 12 11-3 12" fill="none" stroke="${u('brass')}" stroke-width="6" stroke-linecap="round"/><circle cx="98" cy="77" r="4" fill="${u('teal')}" stroke="#6e7854" stroke-width="1.2"/><path d="m92 86-3 7 4 4 3-3 4 2 2-5-5-6" fill="${u('brass')}" stroke="#5e6248" stroke-width="1.4"/>
    <path d="M38 57q22-6 44 0l7 31-8 10H41L32 88z" fill="${u('brass')}" stroke="#55654e" stroke-width="2"/><path d="M40 61q20-4 39 0l3 22-7 8H46l-10-8z" fill="${u('forest')}" stroke="#8b9b6e" stroke-width="1.3"/><path d="m42 64 15-1 13 1" stroke="#f3d89b" stroke-width="1" opacity=".7"/>
    <rect x="43" y="66" width="34" height="15" rx="4" fill="#254c4f" stroke="#c9b77b" stroke-width="1.4"/><path d="M47 71h6v5h-6m10-5h6v5h-6m10-5h6v5h-6" fill="#eac580"/><circle class="pw-patch-antenna" cx="60" cy="88" r="3.8" fill="${u('lens')}" stroke="#d8d28c" stroke-width="1"/>
    <g fill="#5b704f"><circle cx="39" cy="61" r="1.3"/><circle cx="81" cy="61" r="1.3"/><circle cx="40" cy="90" r="1.3"/><circle cx="81" cy="90" r="1.3"/></g><path d="m46 87 5 .3m18 .2 5-.3" stroke="#a3bc88" stroke-width="1.2"/>
    <path d="m77 27 5-13-1-4 4-4" fill="none" stroke="#605f44" stroke-width="4.2" stroke-linecap="round"/><path d="m77 27 5-13-1-4 4-4" fill="none" stroke="${u('brass')}" stroke-width="2.4"/><circle class="pw-patch-antenna" cx="86" cy="6" r="9" fill="${u('glow')}"/><circle cx="86" cy="6" r="3.8" fill="${u('lens')}" stroke="#8a9161" stroke-width="1"/>
    <path d="M26 29q1-10 15-11h38q16 1 17 13v24q-2 11-17 13H40q-15-1-16-14z" fill="${u('brass')}" stroke="#5f6b4e" stroke-width="2"/><path d="M30 29q4-7 13-7h34q12 0 14 9" fill="none" stroke="#fff0bd" stroke-width="1.6" opacity=".8"/>
    <path d="M34 29q26-8 53 0l3 8-1 14q-2 10-13 10H43q-13-1-13-11V37z" fill="#173d45" stroke="#6b8e78" stroke-width="1.8"/><path d="M37 31q23-6 43-1" fill="none" stroke="#70a39b" stroke-width="1.1" opacity=".7"/>
    <g class="pw-patch-eyes"><ellipse cx="47" cy="43" rx="7.5" ry="9" fill="${u('lens')}"/><ellipse cx="74" cy="43" rx="7.5" ry="9" fill="${u('lens')}"/><ellipse cx="45.5" cy="40" rx="2" ry="3" fill="#e8ffe0"/><ellipse cx="72.5" cy="40" rx="2" ry="3" fill="#e8ffe0"/></g><path d="M54 54q6 3 12 0" fill="none" stroke="#8ed9c0" stroke-width="1.5" stroke-linecap="round"/>
    <path d="m23 36-5 2v13l5 2m73-17 5 2v13l-5 2" fill="${u('leather')}" stroke="#596748" stroke-width="1.3"/><g fill="#e9d5a3" stroke="#79865b" stroke-width=".8"><circle cx="29" cy="57" r="2.6"/><circle cx="92" cy="57" r="2.6"/></g><path d="m28 58 2-2m61 2 2-2" stroke="#777853" stroke-width=".7"/>
    <path d="m76 86 10-3 4 15-12 3z" fill="${u('canvas')}" stroke="#646e4b" stroke-width="1.1"/><path d="m78 88 9-2-1 6-7 1z" fill="${u('leather')}"/><circle cx="82" cy="91" r="1.2" fill="#e3c67e"/>
  </g>`, p, 'data-character-art="patch"');
}
