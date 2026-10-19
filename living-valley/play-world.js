/** A small, local adventure stage. Walking never awards lesson progress. */
import { getPlayScene } from './play-script.js?v=20261019-alpine';
import { WALK_BOUNDS, walkDistance, isWalkable, walkablePoint, planWalk, moveOnTrail, integrateWalk } from './play-controller.js';
import { renderRanger, renderGearIcon, renderNova, renderPatch } from './play-art.js';
export { renderGearIcon };
const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : lo));
const places = {
  welcome: { atlas: 'trail-act1-atlas.webp', crop: '0% 0%', name: 'The welcome hut', hue: '40', prop: 'cabin', quip: 'New ranger! Excellent. The last recruit was a pine cone. Very quiet on comms.' },
  maps: { atlas: 'trail-act1-atlas.webp', crop: '50% 0%', name: 'The cartographer’s clearing', hue: '80', prop: 'maps', quip: 'I drew a shortcut. Nova labelled it “a cliff”. Tough crowd.' },
  owl: { atlas: 'trail-act1-atlas.webp', crop: '100% 0%', name: 'Owl’s treetop library', hue: '60', prop: 'library', quip: 'Owl says knowledge is power. I asked whether we could charge me with it.' },
  burrow: { atlas: 'trail-act1-atlas.webp', crop: '0% 100%', name: 'The supply burrow', hue: '24', prop: 'burrow', quip: 'The mushroom is not a button. I have checked. Twice. For science.' },
  desk: { atlas: 'trail-act1-atlas.webp', crop: '50% 100%', name: 'The ranger camp', hue: '160', prop: 'camp', quip: 'Adventure checklist: you, me, extremely questionable snacks. Ready.' },
  lantern: { atlas: 'trail-act1-atlas.webp', crop: '100% 100%', name: 'Pine Relay', hue: '32', prop: 'relay', quip: 'If this works, dramatic cheering. If it doesn’t, thoughtful dramatic humming.' },
  keeper: { atlas: 'trail-later-atlas.webp', crop: '0% 0%', name: 'Bramble’s gatehouse', hue: '90', prop: 'gate', quip: 'Bramble confiscated my “official-looking” moustache. Access control is ruthless.' },
  post: { atlas: 'trail-later-atlas.webp', crop: '50% 0%', name: 'The forest post', hue: '12', prop: 'post', quip: 'A letter says I won a million batteries. Suspicious. I entered for TWO million.' },
  bridge: { atlas: 'trail-later-atlas.webp', crop: '100% 0%', name: 'The Glass Bridge', hue: '185', prop: 'bridge', quip: 'I have named the bridge Steve. Please be nice to Steve.' },
  lookout: { atlas: 'trail-later-atlas.webp', crop: '0% 100%', name: 'The network lookout', hue: '175', prop: 'lookout', quip: 'Do not shout your password across the valley. The echo has terrible privacy settings.' },
  tower: { atlas: 'trail-later-atlas.webp', crop: '50% 100%', name: 'The mountain machinery', hue: '205', prop: 'machine', quip: 'I brought a spanner and a positive attitude. Tessa has requested only the spanner.' },
  summit: { atlas: 'trail-later-atlas.webp', crop: '100% 100%', name: 'The Summit Beacon', hue: '240', prop: 'summit', quip: 'Small robot. Big mountain. Immaculate hat. We have got this.' },
};
const svg = (body, view = '0 0 120 120', extra = '') => `<svg viewBox="${view}" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;

function bossBody(chapter) {
  const bodies = {
    1: '<path fill="#6b5440" stroke="#d3b47e" stroke-width="4" d="M53 100h153v87H53z"/><path fill="#435d48" stroke="#d3b47e" stroke-width="4" d="m34 102 95-63 96 63z"/><path fill="#182b30" d="M78 122h105v41H78z"/><path fill="#e1c992" d="m99 125 33 6 31-5-2 29-29 6-34-6z"/><path stroke="#9f8c5a" stroke-width="2" d="M131 132v28m-24-22 16 2m15 0 16-3"/>',
    2: '<path fill="#ded0a1" stroke="#8f7952" stroke-width="3" d="m83 41 106 19-12 135-111-17z"/><path fill="#b47856" d="m117 104 2-15 18-13 23 9 9 23-8 19-22 5-19-11zm19-12-6 12 6 13 10-1 7-10-8-14z"/><path fill="none" stroke="#907f57" stroke-width="5" d="m100 62 60 9m-65 69 56 7m-61 8 55 7"/>',
    3: '<path fill="#7d8193" stroke="#d6bd89" stroke-width="6" d="M68 112h125v88H68z"/><path fill="none" stroke="#d6bd89" stroke-width="15" d="M91 112V81q39-53 78 0v31"/><path fill="#263744" d="m120 139 22-1 5 15-11 9 2 18h-18l4-18-10-10z"/>',
    4: '<g class="pw-boss-gear"><circle fill="#7a7868" stroke="#d6bf87" stroke-width="17" stroke-dasharray="15 12" cx="130" cy="118" r="65"/><circle fill="#254c4b" stroke="#a4b090" stroke-width="12" cx="130" cy="118" r="30"/><path fill="#c99a67" d="m117 52 15 29-14 35 22 31-8 29 24-28-19-33 12-36-14-27z"/></g>',
    5: '<path fill="none" stroke="#a2b49b" stroke-width="9" d="m72 75 110 74m-97 10 87-95M72 75v84h110V64z"/><g fill="#618e8b" stroke="#e4c993" stroke-width="4"><circle cx="72" cy="75" r="24"/><circle cx="182" cy="149" r="24"/><circle cx="85" cy="159" r="24"/><circle cx="172" cy="64" r="24"/></g><path fill="#c68070" d="m103 107 16-9 13 24 18-22 13 10-20 25 18 25-16 9-16-24-15 23-17-11 21-24z"/>',
    6: '<path fill="#d4be8f" stroke="#866c4c" stroke-width="4" d="m56 74 145-7 4 105-147 7z"/><path fill="none" stroke="#9f8154" stroke-width="4" d="m57 76 78 51 66-58m-143 106 51-62m95 56-48-54"/><path fill="#475361" d="m84 95 46 4 45-11 3 28-44 28-47-22z"/><path fill="#e2b481" d="m96 108 22 2-4 10-17-3zm47 1 23-5-1 10-18 7z"/>',
    7: '<path fill="#a6a184" stroke="#d7c792" stroke-width="4" d="M62 194V89q65-99 131 0v105h-26V91q-42-63-80 0v103z"/><path fill="#514a6f" d="M89 94q40-63 76 0v100H89z"/><path fill="#deb773" d="m119 106 14-13 15 14v25h-29z"/><path fill="none" stroke="#f3cd87" stroke-width="6" d="M124 106v-9q8-11 15 0v9"/>',
    8: '<path fill="#c5ac77" stroke="#e6cc8e" stroke-width="3" d="m82 57 48-21 48 21-7 96-41 31-42-31z"/><path fill="#3b5162" d="m98 68 32-14 31 14-6 71-25 23-26-23z"/><path fill="#a5d1ba" d="m128 72-14 35 11-4-9 41 29-44-13 4z"/><path fill="#b89a60" d="M113 22h36v22h-36zm-19 160h73v14H94z"/>',
    9: '<rect fill="#b4a375" stroke="#dec993" stroke-width="4" x="72" y="53" width="117" height="90" rx="16"/><rect fill="#263e4a" x="85" y="67" width="90" height="51" rx="9"/><path fill="#e6ba82" d="M101 82h19v14h-19zm43 0h18v14h-18z"/><path fill="#8c987c" stroke="#c6b780" stroke-width="4" d="M90 144h78l14 52H77z"/><path fill="none" stroke="#bda777" stroke-width="12" d="m76 148-23 21 7 23m112-42 26 20-4 23"/><path stroke="#bcc1a0" stroke-width="5" d="m117 54-9-23"/><circle fill="#dcb27b" cx="108" cy="26" r="7"/>',
    10: '<path fill="#acaa88" stroke="#d8c996" stroke-width="4" d="M60 57h141v105H60z"/><path fill="#263c48" d="M72 69h116v80H72z"/><path fill="#c88283" d="m114 99 16-15 19 15-7 23h-22z"/><path stroke="#c88283" stroke-width="5" d="m113 85-8-9m43 7 9-9m-7 34 16 4m-52-1-18 4m26 12-2 15m22-14 5 12"/><path fill="#aaa580" d="M118 163h24v19h-24zm-32 20h90v13H86z"/>',
    11: '<path fill="#7e9a87" stroke="#e0c98d" stroke-width="6" d="m130 42 69 24-7 82q-10 30-62 53-57-30-63-54l-6-81z"/><path fill="#d6b773" d="m130 63 45 16-6 58q-6 17-39 38z"/><path fill="#385b52" d="m130 63-44 16 5 58q6 17 39 38z"/><path fill="#ebd5a1" d="m130 84 12 28 28 3-22 19 6 28-24-15-24 15 6-28-22-19 28-3z"/>',
    12: '<path fill="#596b78" stroke="#bfc9b1" stroke-width="5" d="m84 192 23-106h47l23 106z"/><path fill="#c8ba85" stroke="#e4cc95" stroke-width="4" d="m88 83 42-37 46 37-12 33-34 15-32-15z"/><path fill="#3e4c6b" d="m106 83 24-20 26 21-8 20-17 10-18-11z"/><path fill="#c39094" d="m132 60-17 26 15 4-11 32 31-41-16-1 13-18z"/><path fill="none" stroke="#b397a8" stroke-width="6" d="m62 52-17-15m156 14 18-17m-160 88-25 1m172 0 22 2"/>',
  };
  return bodies[chapter] || bodies[12];
}

const sprites = {
  'kit-screen': svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="37" ry="7"/><path fill="#b4b88e" stroke="#4c6f5a" stroke-width="4" d="M19 25h82v61H19z"/><path fill="#1a4650" d="M27 33h66v45H27z"/><path fill="#95d3b2" d="m36 60 17-17 9 9 14-8 10 21H36z"/><path fill="#99a78b" d="M53 86h14v13H53zm-19 12h53v9H34z"/>'),
  'kit-linux': svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="30" ry="7"/><path fill="#25444c" stroke="#8cae96" stroke-width="3" d="M37 49q-4-34 22-36 30 1 26 36l15 39-18 7H37L21 88z"/><ellipse fill="#efdfb2" cx="60" cy="68" rx="25" ry="31"/><path fill="#e4b15e" d="m47 43 13-8 14 8-13 10zM36 95l19 6-7 11H22zm30 6 17-6 17 17H73z"/><g fill="#243f42"><circle cx="48" cy="31" r="3"/><circle cx="73" cy="31" r="3"/></g>'),
  'kit-viewer': svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="34" ry="7"/><rect fill="#d0c795" stroke="#5a7d62" stroke-width="4" x="25" y="21" width="71" height="78" rx="8"/><path fill="#729d84" d="M32 29h57v10H32z"/><path fill="#f1e2ad" d="M32 41h57v49H32z"/><path fill="none" stroke="#7a9d80" stroke-width="7" d="m35 79 15-25 15 16 18-20"/><path fill="#d8a153" d="m76 51 7-13 8 13-7-3z"/><circle fill="#efe2b0" cx="40" cy="34" r="2"/>'),
  'broken-sign': svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="111" rx="45" ry="7"/><path fill="#7e6342" d="M29 60h12v54H29zm53 0h11v54H82z"/><path fill="#a49b71" stroke="#4c6651" stroke-width="4" d="m15 22 91 3-3 54-84-2z"/><path fill="#183c41" d="m24 30 73 2-2 37-66-2z"/><path class="pw-sign-flicker" fill="none" stroke="#8be1bc" stroke-width="3" d="m31 43 7 4-7 5m13 3h8m12-15 5 5-4 5"/><path class="pw-sign-crack" fill="#c5a675" d="m62 22-5 15 7 13-13 15 4 10 7-11 10-11-9-15 4-13z"/><path fill="#9b7d4a" d="m70 89 23-4 12 11-31 7z"/><path fill="#7f9f81" d="m39 91 12-6 8 11-13 9z"/><path fill="#ecce78" d="M44 89h9v7h-9z"/><path class="pw-sign-wires" fill="none" stroke="#cc9062" stroke-width="3" d="m29 79 8 11-12 7m57-18 10 8"/>'),
  'gear-crate': svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="43" ry="8"/><path fill="#9a7746" stroke="#5b4d32" stroke-width="3" d="m18 47 44-13 43 14-4 50-40 14-42-15z"/><path fill="#c49e5b" d="m19 47 43 13 43-12-5-19-40-13-43 16z"/><path stroke="#e3c58a" stroke-width="5" d="m28 31 65 22M30 55v44m60-44-1 47m-48-43v45m36-47v48"/><path fill="#4c7860" d="m46 64 25 1-1 24-22 1z"/><path fill="#edce82" d="m59 68 3 7 8 2-7 4-1 8-6-6-8 2 4-8-3-7z"/><path class="pw-cache-spark" fill="#f4d77e" d="m94 17 3-10 3 10 10 3-10 3-3 10-3-10-10-3z"/>'),
  terminal: svg('<ellipse fill="#062d33" opacity=".35" cx="62" cy="107" rx="48" ry="9"/><path fill="#67543b" d="m15 76 83-5 10 14-83 9zM25 90h8v23h-8zm66-4h8v25h-8z"/><path fill="#c1b47d" stroke="#4c6355" stroke-width="3" d="m26 21 63 1 5 47-64 5z"/><path fill="#153d40" d="m33 29 48 1 4 31-49 4z"/><path class="pw-screen-type" fill="none" stroke="#8ce2be" stroke-width="3" d="m43 39 7 6-6 7m13 0h13"/><path fill="#9eac8b" d="m31 74 58-3 8 9-61 5z"/><path stroke="#4a6757" stroke-width="2" d="m42 77 40-2"/>'),
  objective: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="40" ry="8"/><path fill="#77563c" d="M28 32h67v10H28zm7 8h9v69h-9zm46 0h9v69h-9z"/><path fill="#ebd5a2" stroke="#9b854f" stroke-width="2" d="m32 14 58 3-5 63-55-2z"/><path fill="#d29f50" d="m48 19 7-10h18l5 11z"/><path stroke="#7e926d" stroke-width="4" d="m40 35 35 1m-34 12h30m-31 12 23 1"/><circle fill="#e4b05a" cx="79" cy="69" r="16"/><path fill="none" stroke="#765735" stroke-width="3" d="m72 69 5 5 10-12"/>'),
  map: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="109" rx="45" ry="7"/><path fill="#8b6b42" d="M52 37h13v76H52z"/><path fill="#d4ba77" stroke="#6c673f" stroke-width="2" d="m16 22 72-6 20 17-20 16-72 3z"/><path fill="#466c59" d="m28 31 19-4 11 9 13-11 12 8-12 10-12-8-14 7z"/><path fill="#c19d5b" stroke="#6c673f" stroke-width="2" d="m24 57 65-3 10 13-10 14-65 3-13-13z"/><path stroke="#5b6f49" stroke-width="4" d="m37 66 37-1m-30 9 25-1"/>'),
  inventory: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="110" rx="35" ry="7"/><path fill="none" stroke="#9d7c43" stroke-width="9" d="M41 34V19q19-18 38 0v15"/><path fill="#ac8350" stroke="#634d35" stroke-width="3" d="M31 28h59l7 70-36 11-36-11z"/><path fill="#dcba78" d="m31 28 59 1-1 34-28 10-30-11z"/><path fill="#7e603e" d="M56 42h11v35H56z"/><path fill="#ebce80" d="M53 53h18v16H53z"/><path fill="#536f50" d="m35 81 18-3v20l-18-3zm36-3 17 3v14l-17 3z"/>'),
  cache: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="107" rx="41" ry="8"/><path fill="#596e58" stroke="#314c42" stroke-width="3" d="m21 62 20-30 32-8 25 28 4 44-41 11-43-12z"/><path fill="#8c9a73" d="m22 62 20-29 30-8-5 41z"/><path fill="#647c60" d="m24 67 42 2 5 35-49-10z"/><path class="pw-cache-spark" fill="#f4d77e" d="m87 26 3-10 3 10 10 3-10 3-3 10-3-10-10-3z"/><path fill="#335641" d="m28 91-12-12 8 17-14-2 18 8zm54 6 13-20-4 20 13-7-11 15z"/>'),
  beacon: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="111" rx="30" ry="6"/><path fill="#9b9976" stroke="#536a55" stroke-width="3" d="m46 55-8 50h45l-9-50z"/><path fill="#6a8064" d="M48 56h24v48H48z"/><path fill="#c2b77d" d="m33 43 27-11 28 11-4 24-24 10-24-10z"/><path class="pw-beacon-glass" fill="#436e6c" stroke="#d4c385" stroke-width="2" d="M45 27h30v27H45z"/><path fill="#c1b57e" d="m39 28 21-15 21 15zM37 55h46v7H37z"/><path class="pw-beacon-core" fill="#a9c1a1" d="m60 34-7 12h14z"/>'),
  exit: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="110" rx="38" ry="7"/><path fill="#9b8d69" stroke="#4f6350" stroke-width="3" d="m27 105 3-49q1-29 30-32 29 1 31 31l3 50H77V57q0-19-17-20-17 1-17 20v48z"/><path class="pw-exit-light" fill="#8dd8bc" opacity=".25" d="M44 58q1-19 16-19 17 1 17 19v47H44z"/><path fill="#d2bb7e" d="m51 62 12-9 13 9-6 1v14H57V63z"/><path fill="#8d7752" d="M21 104h79v10H21z"/>'),
  artifact: svg('<ellipse fill="#062d33" opacity=".35" cx="60" cy="110" rx="35" ry="7"/><path fill="#7c643f" d="m29 78 61-9 9 20-59 13z"/><path fill="#ebd5a2" stroke="#9a854e" stroke-width="2" d="m32 19 45-3 15 20-5 48-50 8z"/><path fill="#c1b57e" d="m77 16-1 22 16-2z"/><path stroke="#83916d" stroke-width="3" d="m43 40 23-2m-22 14 30-2m-28 14 23-2"/><circle class="pw-artifact-glint" fill="#eab85a" cx="85" cy="76" r="14"/><path fill="#fff1bd" d="m85 66 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/>'),
};

function setPiece(kind) {
  // Large physical silhouettes give each room its own layout before any panel opens.
  const tree = '<path fill="#314c36" d="m55 400 35-273 39-3 35 274z"/><path fill="#233c31" d="m100 0-88 109h40L0 180h58L9 250h184l-45-70h54l-58-71h45z"/>';
  const pieces = {
    cabin: '<path fill="#5f4c34" d="M115 200h430v223H115z"/><path fill="#91815c" stroke="#3c4f3d" stroke-width="9" d="m65 205 258-145 264 145z"/><path fill="#394e3d" d="m100 192 223-125 224 125z"/><path fill="#8b7550" d="M146 231h367v193H146z"/><path stroke="#574e37" stroke-width="8" d="M146 267h367m-367 42h367m-367 42h367m-367 42h367"/><path fill="#344e43" stroke="#c8b777" stroke-width="7" d="M282 298q37-49 74 0v126h-74z"/><path fill="#e9bd70" stroke="#465b43" stroke-width="9" d="M177 252h59v66h-59zm228 0h59v66h-59z"/><path stroke="#6c734f" stroke-width="5" d="M206 252v66m229-66v66"/><path fill="#c6ba89" d="m233 188 185-1 5 45H228z"/><path fill="#426f5a" d="m270 207 10-8 9 8-9 7zm75-6h45v8h-45"/><path fill="#7e6a4b" d="M455 103V33h36v92z"/><path class="pw-chimney-smoke" fill="#e2d7b1" opacity=".35" d="M470 18q-27-32 2-51 20-20-1-48 47 17 28 50-9 20 1 38z"/>',
    maps: '<path fill="#71623f" d="M95 260h465v36H95zm30 35h24v138h-24zm380 0h25v138h-25z"/><path fill="#c7bb80" stroke="#5f704b" stroke-width="6" d="m163 158 337-5 29 119-353 15z"/><path fill="none" stroke="#659286" stroke-width="17" d="m285 165-21 31 51 40-8 44"/><path fill="none" stroke="#98784b" stroke-width="8" stroke-dasharray="10 8" d="m188 248 61-47 88 47 128-59"/><path fill="#d29c54" d="m439 190 11-22 11 22-11-6z"/><path fill="#837344" d="M78 156h28v280H78zm455-20h29v300h-29z"/><path fill="#c3ad6b" d="m40 118 244-8 19 49-258 8z"/><path fill="#416a50" d="m66 136 31-9 21 12-26 12zm75-4h110v10H141"/>',
    library: `<g transform="translate(20 0) scale(1.15)">${tree}</g><path fill="#7c6746" stroke="#c5ad73" stroke-width="7" d="M157 159h375v225H157z"/><path fill="#304c3b" d="M173 174h343v194H173z"/><path stroke="#b89e66" stroke-width="11" d="M174 237h342m-342 65h342M282 173v195m121-195v195"/>${Array.from({length:15},(_,i)=>`<path fill="${['#c69255','#8d9d6b','#d4b17b','#6f9987','#b4674e'][i%5]}" d="M${185+(i%5)*64} ${183+Math.floor(i/5)*65}h${18+i%3*5}v48h-${18+i%3*5}z"/>`).join('')}<path fill="#ddc185" d="m245 388 70-4 43 20-49 27-65-21z"/><path stroke="#8c7e51" stroke-width="2" d="m313 386-4 43"/>`,
    burrow: '<path fill="#4a6140" stroke="#2b4935" stroke-width="8" d="M46 425q5-317 283-323 271 7 282 323z"/><path fill="#294b37" d="M214 425V269q114-134 225 0v156z"/><path fill="#be9a59" stroke="#6e7049" stroke-width="6" d="M227 425V271q101-111 199 0v154z"/><path fill="#284b3c" d="M248 425V281q81-87 157 0v144z"/><path fill="#aa8050" d="m77 344 99-18 16 84-99 15zm394-17 85 16-12 82-83-18z"/><path stroke="#e0c483" stroke-width="5" d="m80 351 99 34m-88-49 85 63m296-62 76 63m-75-8 80-48"/><path fill="#dcc78e" d="M121 261h13v58h-13zm379-3h14v65h-14z"/><path fill="#b95e47" d="M92 265q35-65 73 0zm380-4q38-70 76 0z"/><circle fill="#f2ddb0" cx="114" cy="251" r="5"/><circle fill="#f2ddb0" cx="143" cy="252" r="5"/>',
    camp: '<path fill="#b19353" stroke="#5d6947" stroke-width="6" d="m70 398 173-251 189 251z"/><path fill="#d1b777" d="m243 147 67 251H85z"/><path fill="#294a3c" d="m247 207 44 191H143z"/><path fill="#9f7b45" d="m247 207-18 191h-86z"/><path fill="#69533c" d="m437 397 80-19 53 24-84 21z"/><path class="pw-campfire" fill="#e3a455" d="M465 384q-38-52 9-89-5 35 15 45 4-20 23-33 15 54-17 79z"/><path class="pw-campfire" fill="#f6d58a" d="M477 384q-21-27 4-49-2 24 13 18 9 26-3 31z"/><path fill="#8f7550" d="M57 217h15v209H57z"/><path fill="#d5bf83" d="m37 214 117-12 13 30-126 14z"/>',
    relay: '<path fill="#7b8066" stroke="#3e5c4c" stroke-width="8" d="m226 423 27-272h107l29 272z"/><path fill="#536c57" d="m267 423 8-269h60l8 269z"/><path fill="#c6b481" stroke="#556e54" stroke-width="6" d="m206 149 100-47 106 47-13 100-94 32-87-32z"/><path fill="#6ea297" d="M250 149h111v88H250z"/><path class="pw-lantern-glow" fill="#f2ca72" d="m304 158-28 59h56z"/><path fill="#7e8060" d="m192 152 113-82 120 82z"/><path stroke="#b3ad76" stroke-width="9" d="M304 102v141m-58-91h118"/><path fill="#786e47" d="M171 321h65v94h-65zm210 15h72v78h-72z"/>',
    gate: '<path fill="#8e7954" stroke="#496044" stroke-width="6" d="M102 164h55v261h-55zm377 0h55v261h-55z"/><path fill="#d8bb75" d="m80 174 50-51 51 51zm378 0 48-51 50 51z"/><path fill="#5b6d48" stroke="#bcaa71" stroke-width="5" d="M159 237q161-107 319 0v188H159z"/><path stroke="#d7b879" stroke-width="12" d="M191 226v198m45-211v211m46-227v227m44-228v228m45-216v216m46-195v195m44-177v177"/><path fill="#d3ad5e" stroke="#705b3d" stroke-width="4" d="M286 280h67v66h-67z"/><path fill="none" stroke="#d3ad5e" stroke-width="12" d="M299 279v-21q22-29 42 0v21"/>',
    post: '<path fill="#a28759" stroke="#506045" stroke-width="7" d="M119 241h403v182H119z"/><path fill="#576d49" stroke="#c0aa6b" stroke-width="6" d="m95 244 226-147 224 147z"/><path fill="#cbb779" d="M257 295h128v128H257z"/><path fill="#5c7057" d="M277 311h88v45h-88z"/><path fill="#e8d5a1" d="m295 327 29-13 27 15-27 12z"/><path stroke="#8e7147" stroke-width="5" d="M151 278h78v91h-78zm273 0h67v91h-67z"/><path fill="#ba6850" d="M46 245h47v73H46z"/><path fill="#dabd7b" d="M49 259h40v11H49z"/><path fill="#806744" d="M64 318h13v105H64z"/>',
    bridge: '<path fill="#3e6e6b" opacity=".75" d="M14 371q162-112 307-16t293-12v95H14z"/><path fill="#93aa9a" stroke="#42665d" stroke-width="7" d="M54 281q274-175 526 0v59q-272-143-526 0z"/><path fill="#c5ceae" stroke="#56766a" stroke-width="6" d="M54 287q273-176 526 0l-4 22q-258-160-518 0z"/><path stroke="#728c78" stroke-width="9" d="M85 268v80m46-106v89m50-109v99m52-113v105m51-113v111m53-110v110m51-100v105m52-88v97m51-76v90m50-65v80"/><path class="pw-water-ripple" stroke="#aad9cd" stroke-width="5" fill="none" d="m127 381 45-7m229 19 53-4m37-34 27 6"/>',
    lookout: '<path fill="#9d966c" stroke="#405d4c" stroke-width="8" d="m144 422 59-254h44l-46 254zm264 0-42-254h45l58 254z"/><path fill="#8d865b" stroke="#4b634a" stroke-width="6" d="M152 152h308v42H152z"/><path stroke="#adad7a" stroke-width="8" d="M194 201l222 216m-28-217L209 417M204 94v61m45-70v68m57-77v76m58-67v67m44-57v59"/><path fill="#d2b66b" stroke="#4c6a55" stroke-width="5" d="m179 95 132-84 130 84z"/><path fill="#7f9f8a" stroke="#d5c188" stroke-width="4" d="m254 131 85-35 19 20-88 37z"/><path stroke="#4a6552" stroke-width="7" d="m297 141-2 38"/><path fill="#a7a77d" d="M70 278h19v146H70z"/><path fill="#f0cc79" d="M62 251h35v34H62z"/>',
    machine: '<path fill="#8f947d" stroke="#3e6055" stroke-width="8" d="M105 166h402v259H105z"/><path fill="#405e56" d="M127 189h357v211H127z"/><path fill="#647e6a" stroke="#b8b98a" stroke-width="5" d="M146 211h124v161H146z"/><path fill="#c3b480" d="M159 229h96v12h-96zm0 28h96v12h-96zm0 28h96v12h-96zm0 28h96v12h-96z"/><g class="pw-machine-gear"><circle fill="#b29c65" stroke="#d4c28b" stroke-width="9" cx="374" cy="276" r="58" stroke-dasharray="13 12"/><circle fill="#385a51" stroke="#81967c" stroke-width="8" cx="374" cy="276" r="29"/><path stroke="#b8ba8b" stroke-width="8" d="M374 234v84m-42-42h84"/></g><path fill="none" stroke="#a7b69b" stroke-width="16" d="M115 218H68v172h47m386-162h46v174h-45"/><path fill="#b8aa79" d="M154 143v-47h52v49zm274 0V81h33v62z"/><path class="pw-machine-light" fill="#a8d39a" d="M290 345h25v17h-25zm37 0h25v17h-25zm37 0h25v17h-25z"/>',
    summit: '<path fill="#7e8b7c" stroke="#3c5d54" stroke-width="8" d="m197 426 64-324h90l72 324z"/><path fill="#5a7867" d="m262 426 23-324h38l31 324z"/><path fill="#b5ad77" stroke="#4d7160" stroke-width="6" d="m225 108 80-74 91 74-19 53-69 30-68-30z"/><path fill="#709994" d="m263 99 42-41 48 41-11 41-35 18-35-18z"/><path class="pw-lantern-glow" fill="#e7cb7f" d="m306 80-21 50h44z"/><path fill="#b9b383" d="M301 33V-12h14v45z"/><path class="pw-summit-rays" fill="none" stroke="#badfc5" stroke-width="5" d="M214 50 151 10m250 38 70-40M179 100l-80-9m330 7 92-10"/><path fill="#b2a67c" d="m171 412 270 2 27 20H145z"/>',
  };
  return `<svg class="pw-setpiece" data-prop="${kind}" viewBox="0 0 640 460" aria-hidden="true" focusable="false">${pieces[kind] || pieces.cabin}</svg>`;
}

function object(id, kind, label, x, y, extra = '') {
  return `<button type="button" class="pw-object pw-object-${kind} ${extra}" data-world-object="${e(id)}" data-world-x="${x}" data-world-y="${y}" style="--pw-x:${x}%;--pw-y:${y}%;z-index:${100+Math.round(y)}" aria-label="${e(label)}"><span class="alpine-prop" aria-hidden="true"></span><span class="pw-object-art">${sprites[kind] || sprites.artifact}</span><span class="pw-object-label">${e(label)}</span><span class="pw-interact-dot" aria-hidden="true">${id === 'objective' ? '!' : '·'}</span></button>`;
}

/** Render accepts only verifier-owned session.done / completed for world consequences. */
export function renderPlayWorld(mission = {}, session = {}, game = {}, chapter = {}) {
  const sceneKey = Object.hasOwn(places, mission.scene) ? mission.scene : Object.hasOwn(places, chapter.scene) ? chapter.scene : 'welcome';
  const place = places[sceneKey];
  const steps = Array.isArray(mission.steps) ? mission.steps : [];
  const done = steps.filter((_, index) => session.done?.[index] === true).length;
  const complete = session.completed === true && done === steps.length && steps.length > 0;
  const current = steps.find((_, index) => !session.done?.[index]);
  const boss = mission.phase === 'boss';
  const bossName = getPlayScene(mission, session).boss?.name || mission.title || 'The valley’s next mystery';
  const x = clamp(game.position?.x ?? 18, 5, 95);
  const y = clamp(game.position?.y ?? 72, 45, 88);
  const items = Array.isArray(current?.activity?.items) ? current.activity.items.filter(item => mission.id !== 'c01-01' || current.id !== 'parts' || !session.activity?.[0]?.inspected?.includes(item.id)).slice(0, 5) : [];
  const lights = steps.map((step, index) => `<i data-lit="${session.done?.[index] === true}" title="${e(step.title)}"></i>`).join('');
  const collected = Array.isArray(game.collected) ? game.collected : Array.isArray(game.opened) ? game.opened : [];
  const opened = collected.includes(`${mission.id}:cache`);
  const equippedTrail = String(game.equipped?.trail);
  const trail = /circuit/.test(equippedTrail) ? 'circuit' : /lantern/.test(equippedTrail) ? 'lantern' : /firefly/.test(equippedTrail) ? 'fireflies' : /star|spark|glow/.test(equippedTrail) ? 'stars' : /leaf|fern/.test(equippedTrail) ? 'leaves' : 'dust';
  const artifacts = items.map(item => {
    const i = current.activity.items.findIndex(candidate => candidate.id === item.id);
    const count = current.activity.items.length;
    const kind = mission.id === 'c01-01' && item.id === 'screen' ? 'kit-screen' : mission.id === 'c01-01' && item.id === 'linux' ? 'kit-linux' : mission.id === 'c01-01' && item.id === 'viewer' ? 'kit-viewer' : 'artifact';
    return object('artifact:' + item.id, kind, item.label, count <= 4 ? 29 + i * 15 : 24 + i * 13, 83 + (i % 2 ? 2 : -2), 'pw-clue-object');
  }).join('');
  const starter = mission.id === 'c01-01';
  const threat = boss ? `<div class="pw-boss-obstruction" data-subdued="${done === steps.length}" data-defeated="${complete}" aria-hidden="true"><svg viewBox="0 0 260 250"><path class="pw-threat-smoke" fill="#342b51" d="m130 0 34 40 39-10-3 48 53 27-34 42 27 48-59 8-25 47-39-34-54 25-5-52-58-26 33-40-22-59 59-7z"/>${bossBody(mission.chapter)}${steps.map((_,i)=>`<path class="pw-threat-lock" data-cleared="${session.done?.[i]===true}" fill="none" stroke="#a7a3b1" stroke-width="9" stroke-linecap="round" d="M${50+i*27} 185v${i%2?23:-25}"/>`).join('')}<path class="pw-threat-crack" fill="none" stroke="#f8ca82" stroke-width="3" d="${done ? 'm127 45-12 35 20 28-16 32 11 32' : ''}"/></svg><span>${complete ? 'CLEARED' : done === steps.length ? 'Ready for the final move' : e(bossName)}</span></div>` : '';
  return `<section class="pw-world" data-play-scene="${sceneKey}" data-boss="${boss}" data-complete="${complete}" data-progress="${done}" data-motion="on" aria-label="Explore ${e(mission.location || place.name)}"><div class="pw-scene" tabindex="0" role="group" aria-label="Adventure playfield. Click or tap the ground to walk. Use arrow keys or W A S D to move; E or Space to interact with the nearest object." style="--pw-scene-hue:${place.hue};--pw-ranger-x:${x}%;--pw-ranger-y:${y}%;--pw-patch-x:${clamp(x-9,6,94)}%;--pw-patch-y:${clamp(y+2,45,88)}%"><div class="pw-painted-backdrop" style="background-image:url('../assets/scenes/${place.atlas}');background-position:${place.crop}"></div><div class="pw-sky-wash"></div><div class="pw-distant-light"></div><div class="pw-walkground" aria-hidden="true"><svg viewBox="0 0 1200 500" preserveAspectRatio="none"><path fill="#769079" opacity=".38" d="M0 180q297-101 589-8t611-20v348H0z"/><path fill="#b2ab79" opacity=".43" d="M-70 480q162-301 518-253t822 205l-45 68H-70z"/><path fill="none" stroke="#dac994" stroke-width="3" opacity=".2" d="M0 405q228-180 568-111t632 138"/><g fill="#365a47" opacity=".8"><path d="m70 310 9-19-2 19 13-8-8 16zm925 46 10-19-2 19 13-7-9 17zM865 280l12-15-5 16 12-3-13 12zM288 412l8-23 1 22 11-5-9 14z"/></g></svg></div>${setPiece(place.prop)}<div class="pw-midground-tree pw-tree-left" aria-hidden="true"></div><div class="pw-midground-tree pw-tree-right" aria-hidden="true"></div>${threat}<div class="pw-fireflies" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div><header class="pw-location"><span class="pw-location-mark" aria-hidden="true">✦</span><span>${e(mission.location || place.name)}<small>${boss ? 'BOSS ENCOUNTER' : 'THE LIVING VALLEY'}</small></span></header><div class="pw-signal-meter" aria-label="${done} of ${steps.length} objectives solved"><span aria-hidden="true">⌁</span><div>${lights}</div></div><div class="pw-objects">${object('objective',starter?'broken-sign':'objective', getPlayScene(mission, session).current?.goal || current?.title || 'Your adventure', 26, 63, 'pw-object-primary')}${object('terminal','terminal', 'Field terminal', 66, 69)}${object('map','map','Valley map',10,57)}${object('inventory','inventory','Your adventure kit',89,80)}${object('cache',starter?'gear-crate':'cache',opened?'A very thoroughly searched crate':'Something shiny?',17,87,opened?'pw-cache-opened':'')}${object('beacon','beacon', complete?'Beacon restored':'Signal beacon',84,sceneKey === 'welcome' ? 72 : 48,complete?'pw-beacon-lit':'')}${object('exit','exit', complete?'Continue the adventure':'Trail onwards',91,57,complete?'pw-exit-open':'')}<button type="button" class="pw-nova pw-object" data-world-object="nova" data-world-x="42" data-world-y="59" style="--pw-x:42%;--pw-y:59%" aria-label="Talk to Nova, your ranger guide"><span class="alpine-character alpine-nova" aria-hidden="true"></span>${renderNova()}<span class="pw-object-label">Nova</span><span class="pw-interact-dot" aria-hidden="true">···</span></button>${artifacts}</div><div class="pw-ranger play-avatar" data-player-x="${x}" data-player-y="${y}" data-x="${x}" data-y="${y}" data-facing="right" data-facing-horizontal="right" data-walking="false" data-trail="${trail}" role="img" aria-label="Your ranger character"><span class="pw-trail-particles" aria-hidden="true"><i></i><i></i><i></i></span><span class="alpine-character alpine-ranger" aria-hidden="true"></span>${renderRanger(game.equipped?.hat)}<span class="pw-player-name">YOU</span></div><button type="button" class="pw-patch pw-object" data-world-object="patch" data-world-x="${clamp(x-9,6,94)}" data-world-y="${clamp(y+2,45,88)}" aria-label="Talk to Patch, your robot companion"><span class="alpine-character alpine-patch" aria-hidden="true"></span>${renderPatch()}<span class="pw-object-label">Patch</span><span class="pw-patch-talk" aria-hidden="true">···</span></button><div class="pw-walk-target" hidden aria-hidden="true">◎</div><div class="pw-foreground" aria-hidden="true"><svg viewBox="0 0 1200 150" preserveAspectRatio="none"><path fill="#173d35" d="m0 150 4-91 18 47-7-65 27 56 4-81 13 80 16-40-5 48 26-18-10 34 43-8-10 38zm1200 0-7-93-17 44 4-67-24 69-7-91-13 89-23-53 6 54-25-13 13 35-36-7 8 33z"/></svg></div><div class="pw-interaction-prompt" aria-live="polite" hidden></div></div><footer class="pw-world-footer"><p><strong>Patch:</strong> <span>${e(place.quip)}</span></p><div class="pw-walk-help"><span class="pw-desktop-help"><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> walk · <kbd>E</kbd> interact</span><span class="pw-touch-help">Tap the trail to walk. Tap an object to investigate.</span></div></footer><div class="pw-touch-stick" data-world-stick role="group" aria-label="Thumbstick walking controls"><span class="pw-stick-ring"><span class="pw-stick-knob"></span></span><span class="pw-stick-caption">WALK</span></div><div class="pw-touch-pad" aria-label="Walking controls"><button type="button" data-world-move="left" aria-label="Walk left">←</button><button type="button" data-world-move="up" aria-label="Walk towards the back">↑</button><button type="button" data-world-move="down" aria-label="Walk towards the front">↓</button><button type="button" data-world-move="right" aria-label="Walk right">→</button><button type="button" data-world-interact aria-label="Interact with the nearest object">✦</button></div></section>`;
}

/** Mount once after rendering; always call the returned cleanup before replacing markup. */
export function mountPlayWorld(root, { onInteract = () => {}, onPosition = () => {}, motion = true } = {}) {
  const world = root?.matches?.('.pw-world') ? root : root?.querySelector?.('.pw-world');
  if (!world) return () => {};
  const stage = world.querySelector('.pw-scene');
  const player = world.querySelector('.pw-ranger');
  const companion = world.querySelector('.pw-patch');
  const marker = world.querySelector('.pw-walk-target');
  const prompt = world.querySelector('.pw-interaction-prompt');
  const stick = world.querySelector('[data-world-stick]');
  const scenery = world.querySelector('.pw-setpiece');
  const controller = new AbortController();
  const { signal } = controller;
  const style = stage.style;
  let position = { x: parseFloat(style.getPropertyValue('--pw-ranger-x')) || 18, y: parseFloat(style.getPropertyValue('--pw-ranger-y')) || 72 };
  let patchPosition = { x: position.x - 9, y: position.y + 2 };
  let publishedPosition = { ...position };
  let velocity = { x: 0, y: 0 };
  let analog = { x: 0, y: 0 };
  let stickPointer = null;
  let route = [];
  let pendingInteraction = null;
  let raf = 0, previous = 0, lastSaved = 0, phase = 0;
  let disposed = false, nearId = '', markerTimer;
  let aspect = 1.7, pace = 25, reach = 7.5, stridePixels = 80, obstacles = [];
  let stageBounds;
  let yScale = 1, yOffset = 0;
  const projectY = y => y * yScale + yOffset;
  const unprojectY = y => (y - yOffset) / yScale;
  const keyboard = new Map();
  const touchDirections = new Map();
  const reduced = !motion || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  world.dataset.motion = reduced ? 'off' : 'on';
  const listen = (node, event, listener, options = {}) => node?.addEventListener(event, listener, { ...options, signal });
  const objects = () => [...world.querySelectorAll('[data-world-object]')];
  const objectPosition = node => node === companion ? patchPosition : ({ x: Number(node.dataset.worldX), y: Number(node.dataset.worldY) });
  const distance = (a, b) => walkDistance(a, b, aspect);
  const save = () => {
    const next = { x: Math.round(position.x * 100) / 100, y: Math.round(position.y * 100) / 100 };
    if (next.x === publishedPosition.x && next.y === publishedPosition.y) return;
    publishedPosition = next;
    onPosition({ ...next });
  };
  const isEditing = node => node?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]');
  const blocked = () => disposed || !world.isConnected || document.querySelector('dialog[open], #game-panel, .play-onboarding[data-world-blocked="true"]') || document.hidden;

  // Footprints follow the painted SVG at every screen size instead of using a
  // desktop-only invisible rectangle. The roof can occlude a ranger behind it.
  const footprints = {
    cabin: [[115, 290, 545, 430]], maps: [[95, 340, 560, 435]],
    library: [[150, 300, 535, 410]], burrow: [[50, 290, 600, 430]],
    camp: [[90, 310, 420, 407], [437, 360, 555, 423]],
    relay: [[220, 300, 390, 430]], gate: [[95, 310, 540, 430]],
    post: [[115, 300, 525, 430]], bridge: [],
    lookout: [[185, 300, 445, 430]], machine: [[105, 280, 510, 430]],
    summit: [[220, 290, 410, 435]],
  };
  function refreshGeometry() {
    stageBounds = stage.getBoundingClientRect();
    stridePixels = Math.max(48, player.getBoundingClientRect().width * 0.95);
    if (!stageBounds.width || !stageBounds.height) return;
    const narrow = stageBounds.width <= 760, short = stageBounds.height <= 560;
    const projection = narrow ? { top: 28, bottom: 64 } : short ? { top: 29, bottom: 69 } : { top: 36, bottom: 79 };
    yScale = (projection.bottom - projection.top) / (WALK_BOUNDS.bottom - WALK_BOUNDS.top);
    yOffset = projection.top - WALK_BOUNDS.top * yScale;
    aspect = stageBounds.width / (stageBounds.height * yScale);
    world.dataset.walkProjection = JSON.stringify({ scale: yScale, offset: yOffset });
    world.style.setProperty('--pw-y-scale', String(yScale));
    world.style.setProperty('--pw-y-offset', yOffset + '%');
    for (const node of objects()) if (node !== companion) node.style.setProperty('--pw-y', projectY(Number(node.dataset.worldY)) + '%');
    // Same speed in both axes, with a comfortable phone pace and a bounded
    // desktop pace. Keyboard diagonals cannot run faster than straight walks.
    pace = Math.max(145, Math.min(340, stageBounds.width * 0.24)) / stageBounds.width * 100;
    reach = Math.max(43, Math.min(90, stageBounds.width * 0.073)) / stageBounds.width * 100;
    obstacles = [];
    if (scenery) {
      scenery.style.transform = 'none';
      const original = scenery.getBoundingClientRect();
      const lift = yOffset / 100 * stageBounds.height + (yScale - 1) * (original.top - stageBounds.top);
      scenery.style.transformOrigin = '50% 0';
      scenery.style.transform = 'translateY(' + lift + 'px) scale(' + yScale + ')';
      const rect = scenery.getBoundingClientRect();
      const scale = Math.min(rect.width / 640, rect.height / 460);
      const left = rect.left - stageBounds.left + (rect.width - 640 * scale) / 2;
      const top = rect.top - stageBounds.top + (rect.height - 460 * scale) / 2;
      for (const [x1, y1, x2, y2] of footprints[scenery.dataset.prop] || []) {
        obstacles.push({
          left: (left + x1 * scale) / stageBounds.width * 100 - 0.8,
          right: (left + x2 * scale) / stageBounds.width * 100 + 0.8,
          top: unprojectY((top + y1 * scale) / stageBounds.height * 100) - 0.8 * aspect,
          bottom: unprojectY((top + y2 * scale) / stageBounds.height * 100) + 0.8 * aspect,
        });
      }
      const bottom = obstacles.length ? Math.max(...obstacles.map(rect => rect.bottom)) : 56;
      scenery.style.zIndex = String(100 + Math.round(bottom - 0.8 * aspect));
    }
    // Nova stands in front of the building, not painted into its wall. A
    // responsive SVG changes its footline, so a hard-coded NPC depth is unsafe.
    const nova = world.querySelector('[data-world-object="nova"]');
    if (nova) {
      nova.dataset.worldBaseY ||= nova.dataset.worldY;
      const point = { x: Number(nova.dataset.worldX), y: Number(nova.dataset.worldBaseY) };
      for (const rect of obstacles) {
        if (point.x >= rect.left - 2 && point.x <= rect.right + 2 && point.y >= rect.top - 10 && point.y <= rect.bottom + 1) {
          point.y = Math.min(WALK_BOUNDS.bottom - 2, rect.bottom + 2.1);
        }
      }
      nova.dataset.worldY = String(point.y);
      nova.style.setProperty('--pw-y', projectY(point.y) + '%');
      nova.style.zIndex = String(100 + Math.ceil(point.y));
    }
    world.dataset.walkObstacles = JSON.stringify(obstacles);
    world.dataset.walkAspect = String(aspect);
    world.dataset.walkSpeed = String(pace);
    world.dataset.walkReach = String(reach);
    const legal = walkablePoint(position, obstacles, WALK_BOUNDS, aspect);
    if (legal) position = legal;
    if (route.length) route = planWalk(position, route.at(-1), obstacles, WALK_BOUNDS, aspect);
    draw();
  }

  function nearestObject() {
    const nearby = objects().map(node => ({ node, d: distance(position, objectPosition(node)) }));
    nearby.sort((a, b) => a.d - b.d);
    // Patch follows the player: he must not swallow every interaction key.
    return nearby.find(item => item.node !== companion && item.d < reach) || nearby[0];
  }

  function draw() {
    style.setProperty('--pw-ranger-x', position.x + '%');
    style.setProperty('--pw-ranger-y', projectY(position.y) + '%');
    style.setProperty('--pw-patch-x', patchPosition.x + '%');
    style.setProperty('--pw-patch-y', projectY(patchPosition.y) + '%');
    player.dataset.playerX = player.dataset.x = String(Math.round(position.x * 100) / 100);
    player.dataset.playerY = player.dataset.y = String(Math.round(position.y * 100) / 100);
    player.style.zIndex = String(100 + Math.round(position.y));
    companion.style.zIndex = String(100 + Math.round(patchPosition.y));
    companion.dataset.worldX = String(patchPosition.x);
    companion.dataset.worldY = String(patchPosition.y);
    const nearby = nearestObject();
    const id = nearby && nearby.d < reach ? nearby.node.dataset.worldObject : '';
    if (id !== nearId) {
      objects().forEach(node => node.classList.toggle('pw-in-reach', node.dataset.worldObject === id));
      nearId = id;
      prompt.hidden = !id;
      prompt.textContent = id ? 'E · ' + nearby.node.getAttribute('aria-label') : '';
    }
  }

  function clearRoute() {
    route = [];
    pendingInteraction = null;
    marker.hidden = true;
    clearTimeout(markerTimer);
    world.querySelector('.pw-walk-route')?.remove();
  }

  function showRoute(points, corrected = false) {
    clearTimeout(markerTimer);
    const goal = points.at(-1);
    if (!goal) { marker.hidden = true; return; }
    marker.style.left = goal.x + '%';
    marker.style.top = projectY(goal.y) + '%';
    marker.dataset.state = 'walking';
    marker.dataset.corrected = String(corrected);
    marker.hidden = false;
    let path = world.querySelector('.pw-walk-route');
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      path.setAttribute('viewBox', '0 0 100 100');
      path.setAttribute('preserveAspectRatio', 'none');
      path.setAttribute('aria-hidden', 'true');
      path.classList.add('pw-walk-route');
      stage.insertBefore(path, marker);
    }
    const trail = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    trail.setAttribute('points', [position, ...points].map(point => point.x + ',' + projectY(point.y)).join(' '));
    path.replaceChildren(trail);
  }

  function arrived() {
    route = [];
    velocity = { x: 0, y: 0 };
    player.dataset.walking = 'false';
    player.style.setProperty('--pw-speed', '0');
    player.style.setProperty('--pw-stride', '0');
    world.querySelector('.pw-walk-route')?.remove();
    marker.dataset.state = 'arrived';
    markerTimer = setTimeout(() => { marker.hidden = true; }, reduced ? 150 : 400);
    save();
  }

  function finishInteraction(id) {
    pendingInteraction = null;
    arrived();
    if (!disposed && !blocked()) onInteract(id);
  }

  function walkTo(goal, interaction = null) {
    clearRoute();
    const next = planWalk(position, goal, obstacles, WALK_BOUNDS, aspect);
    if (!next.length) {
      prompt.textContent = 'That way is blocked. Try a clear patch of trail.';
      prompt.hidden = false;
      return;
    }
    route = next;
    pendingInteraction = interaction;
    showRoute(route, distance(goal, route.at(-1)) > 0.1);
    stage.focus({ preventScroll: true });
    schedule();
  }

  function interact(node) {
    if (!node || blocked()) return;
    const id = node.dataset.worldObject;
    const goal = objectPosition(node);
    const interactionRange = id === 'nova' ? Math.max(reach, (player.getBoundingClientRect().width + node.getBoundingClientRect().width) * 0.57 / stageBounds.width * 100) : reach;
    keyboard.clear(); touchDirections.clear(); analog = { x: 0, y: 0 };
    if (distance(position, goal) <= interactionRange) return finishInteraction(id);
    // Choose a reachable approach, never the centre of a solid cabin or desk.
    const candidates = [];
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      for (const radius of id === 'nova' ? [interactionRange * 0.95] : [interactionRange * 0.65, interactionRange * 0.9]) {
        const point = { x: goal.x + Math.cos(angle) * radius, y: goal.y + Math.sin(angle) * radius * aspect };
        if (!isWalkable(point, obstacles)) continue;
        const path = planWalk(position, point, obstacles, WALK_BOUNDS, aspect);
        if (!path.length) continue;
        const chain = [position, ...path];
        const cost = chain.slice(1).reduce((sum, value, index) => sum + distance(chain[index], value), 0);
        candidates.push({ point, cost });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    walkTo(candidates[0]?.point || goal, id);
  }

  function inputVector() {
    let x = analog.x, y = analog.y;
    const directions = new Set([...keyboard.values(), ...touchDirections.values()]);
    x += (directions.has('right') ? 1 : 0) - (directions.has('left') ? 1 : 0);
    y += (directions.has('down') ? 1 : 0) - (directions.has('up') ? 1 : 0);
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  function schedule() { if (!raf && !disposed) raf = requestAnimationFrame(frame); }
  function frame(time) {
    raf = 0;
    if (blocked()) { stopWalking(); return; }
    const dt = Math.min(0.05, previous ? (time - previous) / 1000 : 1 / 60);
    previous = time;
    let input = inputVector();
    const manual = Math.hypot(input.x, input.y) > 0.01;
    const before = { ...position };
    if (manual) clearRoute();
    else if (route.length) {
      const goal = route[0];
      const dx = goal.x - position.x, dy = (goal.y - position.y) / aspect;
      const remaining = Math.hypot(dx, dy);
      if (remaining < 0.16) {
        position = { ...goal };
        route.shift();
        velocity = { x: 0, y: 0 };
        if (!route.length) {
          draw();
          if (pendingInteraction) return finishInteraction(pendingInteraction);
          arrived();
        }
      } else {
        // Stop precisely at bends and at the target rather than drifting through
        // a wall or orbiting an interaction. Acceleration resumes on the next leg.
        const desiredPace = Math.min(pace, Math.max(1.8, remaining * 9));
        input = { x: dx / remaining * desiredPace / pace, y: dy / remaining * desiredPace / pace };
      }
    }
    const movement = integrateWalk(velocity, input, dt, { speed: pace, aspect });
    velocity = movement.velocity;
    if (route.length && !manual) {
      const goal = route[0];
      const remaining = distance(position, goal);
      if (walkDistance({ x: 0, y: 0 }, movement.delta, aspect) >= remaining) {
        position = { ...goal };
        velocity = { x: 0, y: 0 };
        route.shift();
        if (!route.length) {
          draw();
          if (pendingInteraction) return finishInteraction(pendingInteraction);
          arrived();
        }
      } else position = moveOnTrail(position, movement.delta, obstacles, WALK_BOUNDS, aspect);
    } else position = moveOnTrail(position, movement.delta, obstacles, WALK_BOUNDS, aspect);
    const travelled = distance(position, before);
    const moving = travelled > 0.001;
    player.dataset.walking = String(moving);
    const speedRatio = Math.min(1, Math.hypot(velocity.x, velocity.y) / pace);
    if (moving) {
      const dx = position.x - before.x, dy = (position.y - before.y) / aspect;
      if (Math.abs(dx) > 0.002) player.dataset.facingHorizontal = dx < 0 ? 'left' : 'right';
      player.dataset.facing = Math.abs(dy) > Math.abs(dx) * 1.25 ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right');
      phase += travelled / 100 * stageBounds.width / stridePixels * Math.PI * 2;
      player.style.setProperty('--pw-heading-y', String(dy / Math.max(0.001, travelled)));
    }
    player.style.setProperty('--pw-speed', String(moving ? speedRatio : 0));
    player.style.setProperty('--pw-step-phase', String(phase));
    player.style.setProperty('--pw-stride', String(moving && !reduced ? Math.sin(phase) : 0));
    const follow = walkablePoint({
      x: clamp(position.x + (player.dataset.facingHorizontal === 'left' ? 7 : -7), 5, 95),
      y: clamp(position.y + 2.7, 45, 88),
    }, obstacles, WALK_BOUNDS, aspect) || position;
    const patchDistance = distance(patchPosition, follow);
    if (patchDistance > 0.1) {
      const waypoint = planWalk(patchPosition, follow, obstacles, WALK_BOUNDS, aspect)[0] || follow;
      const smoothing = 1 - Math.exp(-4.8 * dt);
      patchPosition = moveOnTrail(patchPosition, { x: (waypoint.x - patchPosition.x) * smoothing, y: (waypoint.y - patchPosition.y) * smoothing }, obstacles, WALK_BOUNDS, aspect);
    }
    companion.dataset.walking = String(patchDistance > 0.4);
    draw();
    if (moving && time - lastSaved > 650) { lastSaved = time; save(); }
    if (manual || route.length || Math.hypot(velocity.x, velocity.y) > 0.01 || patchDistance > 0.25) schedule();
    else { previous = 0; save(); }
  }

  function stopWalking() {
    keyboard.clear(); touchDirections.clear(); clearRoute();
    analog = { x: 0, y: 0 }; velocity = { x: 0, y: 0 }; previous = 0;
    player.dataset.walking = 'false';
    player.style.setProperty('--pw-speed', '0');
    player.style.setProperty('--pw-stride', '0');
    resetStick(); save();
  }

  listen(stage, 'click', event => {
    const node = event.target.closest?.('[data-world-object]');
    if (node) { event.preventDefault(); interact(node); return; }
    if (event.target.closest?.('button, a') || blocked()) return;
    refreshGeometry();
    keyboard.clear(); touchDirections.clear(); analog = { x: 0, y: 0 };
    walkTo({ x: clamp((event.clientX - stageBounds.left) / stageBounds.width * 100, 5, 95), y: clamp(unprojectY((event.clientY - stageBounds.top) / stageBounds.height * 100), 45, 88) });
  });

  const keys = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  listen(document, 'keydown', event => {
    if (blocked() || isEditing(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!world.contains(document.activeElement) && document.activeElement !== document.body) return;
    if (keys[event.key]) {
      event.preventDefault(); keyboard.set(event.code || event.key, keys[event.key]); schedule();
    } else if ((event.key.toLowerCase() === 'e' || event.code === 'Space') && !event.target.closest('button')) {
      if (event.repeat) return;
      event.preventDefault();
      const focused = document.activeElement?.closest?.('[data-world-object]');
      const nearest = focused && world.contains(focused) ? focused : nearestObject()?.node;
      if (nearest) interact(nearest);
    }
  });
  listen(document, 'keyup', event => {
    if (!keys[event.key]) return;
    keyboard.delete(event.code || event.key);
    schedule();
  });
  listen(globalThis, 'blur', stopWalking);
  listen(document, 'visibilitychange', () => { if (document.hidden) stopWalking(); });

  world.querySelectorAll('[data-world-move]').forEach(button => {
    const direction = button.dataset.worldMove;
    listen(button, 'pointerdown', event => {
      if (blocked()) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      touchDirections.set(event.pointerId, direction);
      stage.focus({ preventScroll: true }); schedule();
    });
    const release = event => { touchDirections.delete(event.pointerId); schedule(); };
    listen(button, 'pointerup', release);
    listen(button, 'pointercancel', release);
    listen(button, 'lostpointercapture', release);
    listen(button, 'click', event => {
      if (event.detail !== 0 || blocked()) return;
      const goal = { x: position.x + (direction === 'left' ? -4 : direction === 'right' ? 4 : 0), y: position.y + (direction === 'up' ? -4 * aspect : direction === 'down' ? 4 * aspect : 0) };
      walkTo(goal);
    });
  });

  function resetStick() {
    stickPointer = null;
    if (!stick) return;
    stick.dataset.active = 'false';
    stick.style.setProperty('--pw-stick-x', '0px');
    stick.style.setProperty('--pw-stick-y', '0px');
  }
  function updateStick(event) {
    if (!stick || event.pointerId !== stickPointer) return;
    const bounds = stick.getBoundingClientRect();
    const radius = Math.max(20, Math.min(bounds.width, bounds.height) * 0.3);
    const dx = event.clientX - bounds.left - bounds.width / 2, dy = event.clientY - bounds.top - bounds.height / 2;
    const length = Math.hypot(dx, dy), strength = Math.min(1, length / radius);
    analog = length < 4 ? { x: 0, y: 0 } : { x: dx / length * strength, y: dy / length * strength };
    stick.style.setProperty('--pw-stick-x', analog.x * radius + 'px');
    stick.style.setProperty('--pw-stick-y', analog.y * radius + 'px');
    schedule();
  }
  listen(stick, 'pointerdown', event => {
    if (blocked() || stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture?.(event.pointerId);
    stick.dataset.active = 'true';
    stage.focus({ preventScroll: true });
    updateStick(event);
  });
  listen(stick, 'pointermove', event => {
    if (event.pointerId !== stickPointer) return;
    event.preventDefault(); updateStick(event);
  });
  const releaseStick = event => {
    if (event.pointerId !== stickPointer) return;
    analog = { x: 0, y: 0 }; resetStick(); schedule();
  };
  listen(stick, 'pointerup', releaseStick);
  listen(stick, 'pointercancel', releaseStick);
  listen(stick, 'lostpointercapture', releaseStick);
  listen(world.querySelector('[data-world-interact]'), 'click', () => { const nearest = nearestObject(); if (nearest) interact(nearest.node); });

  const observer = globalThis.ResizeObserver ? new ResizeObserver(refreshGeometry) : null;
  observer?.observe(stage);
  listen(globalThis, 'resize', refreshGeometry);
  refreshGeometry();
  draw();
  return () => {
    if (!disposed) save();
    disposed = true; controller.abort(); observer?.disconnect();
    clearTimeout(markerTimer);
    if (raf) cancelAnimationFrame(raf);
    keyboard.clear(); touchDirections.clear();
  };
}
