// Generates GymTrack's ORIGINAL exercise / stretch illustrations as SVG files.
//
//   node scripts/generate-illustrations.mjs            → public/exercise-images/custom/
//
// Drawn from scratch with a simple jointed mannequin (forward kinematics +
// two-bone IK) and hand-built equipment shapes. No third-party artwork is used
// as input or reference.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] ?? path.join('public', 'exercise-images', 'custom');
const SIZE = 512;
const FLOOR = 452;
const LEN = { torso: 112, neck: 12, head: 22, ua: 62, fa: 56, th: 86, sh: 82, foot: 24, hand: 16 };
const C = {
  bgTop: '#f2f7fc', bgBottom: '#dce8f4', floor: '#c8d7e6', floorLine: '#b2c5d8',
  skin: '#eaa982', skinFar: '#cd8a63', shirt: '#2f7de1', shirtFar: '#2361b6', shorts: '#263445', shortsFar: '#18222e',
  shoe: '#f8fafc', shoeFar: '#cdd6e0', hair: '#3a2a20', eye: '#2b2b2b',
  metal: '#9ba9b8', metalDark: '#647384', pad: '#2f3b4c', grip: '#1c2430', cable: '#3c4652',
  band: '#1fae68', bandLight: '#6ee0a3', accent: '#f26b2c', wall: '#e3eaf2', wallLine: '#ccd7e3', stack: '#56636f',
};

const rad = (d) => (d * Math.PI) / 180;
const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];
const add = (p, a, l) => [p[0] + Math.cos(rad(a)) * l, p[1] + Math.sin(rad(a)) * l];
const plus = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const n1 = (v) => Math.round(v * 10) / 10;

const seg = (a, b, w, c, extra = '') =>
  `<line x1="${n1(a[0])}" y1="${n1(a[1])}" x2="${n1(b[0])}" y2="${n1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const dot = (p, r, c) => `<circle cx="${n1(p[0])}" cy="${n1(p[1])}" r="${r}" fill="${c}"/>`;
const rect = (x, y, w, h, c, rx = 4) => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" rx="${rx}" fill="${c}"/>`;
const poly = (pts, c) => `<polygon points="${pts.map((p) => `${n1(p[0])},${n1(p[1])}`).join(' ')}" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`;

/* ---------------- Limbs ---------------- */

function ik(root, target, l1, l2, bend) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
  const mid = [root[0] + Math.cos(base + bend * a) * l1, root[1] + Math.sin(base + bend * a) * l1];
  return [mid, [root[0] + Math.cos(base) * d, root[1] + Math.sin(base) * d]];
}

function solve(root, spec, l1, l2) {
  const s1 = (spec.s1 ?? 1) * l1;
  const s2 = (spec.s2 ?? 1) * l2;
  if (spec.target) return ik(root, spec.target, s1, s2, spec.bend ?? 1);
  const mid = add(root, spec.a1, s1);
  return [mid, add(mid, spec.a2, s2)];
}

function drawArm(shoulder, spec, far) {
  const [elbow, wrist] = solve(shoulder, spec, LEN.ua, LEN.fa);
  const skin = far ? C.skinFar : C.skin;
  let svg = seg(shoulder, elbow, 18, skin) + seg(shoulder, lerp(shoulder, elbow, 0.42), 22, far ? C.shirtFar : C.shirt) + seg(elbow, wrist, 14, skin);
  let hand = wrist;
  if (spec.hand !== undefined) {
    hand = add(wrist, spec.hand, LEN.hand);
    svg += seg(wrist, hand, 12, skin);
  } else svg += dot(wrist, 8.5, skin);
  return { svg, elbow, wrist, hand };
}

function drawLeg(hip, spec, far, facing) {
  const [knee, ankle] = solve(hip, spec, LEN.th, LEN.sh);
  const skin = far ? C.skinFar : C.skin;
  const footAngle = spec.foot ?? (facing > 0 ? 0 : 180);
  const toe = add(ankle, footAngle, LEN.foot);
  const svg =
    seg(hip, knee, 26, skin) +
    seg(hip, lerp(hip, knee, 0.62), 30, far ? C.shortsFar : C.shorts) +
    seg(knee, ankle, 20, skin) +
    seg(ankle, toe, 16, far ? C.shoeFar : C.shoe) +
    seg(plus(ankle, dir(footAngle + 90 * facing), 6), plus(toe, dir(footAngle + 90 * facing), 6), 4, '#7b8794');
  return { svg, knee, ankle, toe };
}

/* ---------------- Figures ---------------- */

/** Side view. `facing` 1 = right. `near` / `far`: { arm, leg } specs. */
function side(fig) {
  const facing = fig.facing ?? 1;
  const hip = fig.hip;
  const torsoA = fig.torso ?? -90;
  let shoulder = add(hip, torsoA, LEN.torso);
  if (fig.shoulderShift) shoulder = plus(shoulder, dir(torsoA + 90 * facing), fig.shoulderShift);
  const headA = fig.headA ?? torsoA;
  const neckTop = add(shoulder, headA, LEN.neck);
  const head = add(shoulder, headA, LEN.neck + LEN.head);
  const back = dir(headA - 90 * facing);
  const up = dir(headA);
  const forward = dir(headA + 90 * facing);
  const offset = [-5 * facing, -2];

  const farLeg = drawLeg(plus(hip, offset), fig.far.leg, true, facing);
  const farArm = drawArm(plus(shoulder, offset), fig.far.arm, true);
  const nearLeg = drawLeg(hip, fig.near.leg, false, facing);
  const nearArm = drawArm(shoulder, fig.near.arm, false);

  const torso = seg(hip, shoulder, 46, C.shirt) + dot(hip, 23, C.shorts) + seg(lerp(hip, shoulder, 0.08), lerp(hip, shoulder, 0.08), 46, C.shorts);
  const headSvg =
    seg(shoulder, neckTop, 15, C.skin) +
    dot(plus(plus(head, back, 3), up, 3), 22, C.hair) +
    dot(plus(plus(head, forward, 2), up, -2), 20, C.skin) +
    dot(plus(plus(head, forward, 11), up, 2), 2.4, C.eye);

  const layers = { far: farLeg.svg + farArm.svg, body: torso + headSvg, near: nearLeg.svg + (fig.armBehind ? '' : nearArm.svg), nearArmBehind: fig.armBehind ? nearArm.svg : '' };
  const svg = layers.far + layers.nearArmBehind + layers.body + layers.near;
  return { svg, hip, shoulder, head, near: { ...nearArm, ...nearLeg }, far: { ...farArm, ...farLeg } };
}

/** Front view. `left` / `right` = viewer's left / right. */
function front(fig) {
  const cx = fig.cx ?? 256;
  const hipC = [cx, fig.hipY ?? 284];
  const tilt = fig.tilt ?? -90;
  const shC = add(hipC, tilt, LEN.torso);
  const across = dir(tilt + 90);
  const up = dir(tilt);
  const shL = plus(shC, across, -30);
  const shR = plus(shC, across, 30);
  const hipL = plus(hipC, across, -16);
  const hipR = plus(hipC, across, 16);

  const leg = (hip, spec) => {
    const [knee, ankle] = solve(hip, spec, LEN.th, LEN.sh);
    return {
      knee,
      ankle,
      svg: seg(hip, knee, 26, C.skin) + seg(knee, ankle, 20, C.skin) + `<ellipse cx="${n1(ankle[0])}" cy="${n1(ankle[1] + 4)}" rx="13" ry="8" fill="${C.shoe}" stroke="#9aa6b2" stroke-width="2"/>`,
    };
  };
  const legL = leg(hipL, fig.left.leg);
  const legR = leg(hipR, fig.right.leg);
  const shorts = poly([plus(plus(hipL, across, -10), up, 14), plus(plus(hipR, across, 10), up, 14), plus(lerp(hipR, legR.knee, 0.45), across, 13), plus(lerp(hipL, legL.knee, 0.45), across, -13)], C.shorts);
  const torso = poly([plus(shL, across, -6), plus(shR, across, 6), plus(plus(hipR, across, 6), up, 12), plus(plus(hipL, across, -6), up, 12)], C.shirt);
  const armL = drawArm(shL, fig.left.arm, false);
  const armR = drawArm(shR, fig.right.arm, false);
  const neckTop = add(shC, tilt, LEN.neck);
  const head = add(shC, tilt, LEN.neck + LEN.head);
  const headSvg =
    seg(shC, neckTop, 17, C.skin) + dot(plus(head, up, 4), 23, C.hair) + dot(plus(head, up, -3), 21, C.skin) +
    dot(plus(plus(head, across, -7), up, 1), 2.4, C.eye) + dot(plus(plus(head, across, 7), up, 1), 2.4, C.eye);
  const legs = fig.frontLeg === 'left' ? legR.svg + legL.svg : legL.svg + legR.svg;
  const svg = legs + shorts + torso + armL.svg + armR.svg + headSvg;
  return { svg, left: { ...armL, ...legL }, right: { ...armR, ...legR }, shL, shR, head };
}

/* ---------------- Props ---------------- */

const tower = (x, top = 84) =>
  rect(x - 12, top, 24, FLOOR - top, C.metal, 6) + rect(x - 12, top, 7, FLOOR - top, C.metalDark, 3) + rect(x - 30, FLOOR - 10, 60, 12, C.metalDark, 4);
const pulley = (p) => dot(p, 11, C.metalDark) + dot(p, 4.5, C.metal);
const cable = (a, b) => seg(a, b, 3.2, C.cable);
const handle = (p) => dot(p, 7, C.grip);
const band = (a, b) => seg(a, b, 7, C.band) + seg(a, b, 2.4, C.bandLight);
const pad = (a, b, w = 22) => seg(a, b, w, C.pad);
const post = (top, x = top[0]) => seg(top, [x, FLOOR - 4], 11, C.metalDark) + rect(x - 22, FLOOR - 9, 44, 10, C.metalDark, 3);
const stack = (x, y, w = 44, h = FLOOR - 8 - 236) =>
  rect(x, y, w, h, C.stack, 5) + Array.from({ length: Math.floor(h / 16) }, (_, i) => seg([x + 4, y + 10 + i * 16], [x + w - 4, y + 10 + i * 16], 2, '#3f4a55')).join('');
const anchorPost = (x, y) => post([x, 70]) + dot([x, y], 7, C.grip);
const wall = (x, w) => rect(x, 40, w, FLOOR - 40, C.wall, 0) + Array.from({ length: 5 }, (_, i) => seg([x, 110 + i * 70], [x + w, 110 + i * 70], 2, C.wallLine)).join('');

function arrow(from, to, bulge = 0) {
  const mid = lerp(from, to, 0.5);
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const normal = [-(to[1] - from[1]) / len, (to[0] - from[0]) / len];
  const ctrl = plus(mid, normal, bulge);
  return `<path d="M${n1(from[0])},${n1(from[1])} Q${n1(ctrl[0])},${n1(ctrl[1])} ${n1(to[0])},${n1(to[1])}" fill="none" stroke="${C.accent}" stroke-width="6" stroke-linecap="round" marker-end="url(#ah)" opacity="0.92"/>`;
}

function circleArrow(center, r, ry = r) {
  const start = [center[0] + r, center[1]];
  const end = [center[0] + r * Math.cos(rad(300)), center[1] + ry * Math.sin(rad(300))];
  return `<path d="M${n1(start[0])},${n1(start[1])} A${r},${ry} 0 1 1 ${n1(end[0])},${n1(end[1])}" fill="none" stroke="${C.accent}" stroke-width="5" stroke-linecap="round" marker-end="url(#ah)" opacity="0.92"/>`;
}

function svgDoc(content, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="${title}">
<title>${title} — GymTrack original illustration</title>
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bgTop}"/><stop offset="1" stop-color="${C.bgBottom}"/></linearGradient>
<marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.accent}"/></marker></defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
<rect y="${FLOOR}" width="${SIZE}" height="${SIZE - FLOOR}" fill="${C.floor}"/><line x1="0" y1="${FLOOR}" x2="${SIZE}" y2="${FLOOR}" stroke="${C.floorLine}" stroke-width="3"/>
${content}
</svg>
`;
}

/* ---------------- Poses (reusable) ---------------- */

const standLegs = { near: { a1: 72, a2: 96, foot: 0 }, far: { a1: 108, a2: 100, foot: 0 } };
const straightLegs = { near: { a1: 86, a2: 92, foot: 0 }, far: { a1: 94, a2: 90, foot: 0 } };
const seatedLegs = { near: { a1: -2, a2: 90, foot: 0 }, far: { a1: 4, a2: 92, foot: 0 } };
const frontLegs = { left: { a1: 93, a2: 90 }, right: { a1: 87, a2: 90 } };
const relaxedL = { a1: 97, a2: 93 };
const relaxedR = { a1: 83, a2: 87 };
const mirrorArm = (arm) => (arm.target ? { ...arm, target: [arm.target[0] - 6, arm.target[1] - 2] } : arm);

/** Builds a side-view image: props(back) → figure → props(front) → arrows. */
function sideImage(title, fig, props = () => ({})) {
  const figure = side({ ...fig, near: { arm: fig.arm, leg: fig.legs.near }, far: { arm: fig.farArm ?? mirrorArm(fig.arm), leg: fig.legs.far } });
  const extra = props(figure);
  return svgDoc((extra.back ?? '') + figure.svg + (extra.front ?? '') + (extra.arrows ?? ''), title);
}

function frontImage(title, fig, props = () => ({})) {
  const figure = front(fig);
  const extra = props(figure);
  return svgDoc((extra.back ?? '') + figure.svg + (extra.front ?? '') + (extra.arrows ?? ''), title);
}

/* ---------------- Illustrations ---------------- */

const images = {};
const pair = (id, start, peak) => {
  images[`${id}-start`] = start;
  images[`${id}-peak`] = peak;
};
const single = (id, main) => {
  images[`${id}-main`] = main;
};

// 1. Incline chest press (combined machine, slight incline)
{
  const base = { hip: [236, 370], torso: -115, legs: seatedLegs };
  const props = (f, showArrow) => {
    const t = dir(-115);
    const nb = dir(155);
    return {
      back:
        stack(52, 236) + tower(124, 96) + seg([124, 150], [196, 150], 12, C.metalDark) +
        pad(plus(plus(f.hip, nb, 26), t, -10), plus(plus(f.shoulder, nb, 26), t, 30)) +
        pad([200, 392], [292, 392], 18) + post([246, 400]),
      front: seg([196, 150], f.near.wrist, 10, C.metal) + handle(f.near.wrist),
      arrows: showArrow ? arrow([232, 296], [300, 228], -12) : '',
    };
  };
  pair(
    'machine-incline-chest-press',
    sideImage('Incline Chest Press (Machine) — start', { ...base, arm: { a1: 120, a2: -35 } }, (f) => props(f, true)),
    sideImage('Incline Chest Press (Machine) — finish', { ...base, arm: { a1: -25, a2: -25 } }, (f) => props(f, false)),
  );
}

// 2. Incline cable fly (incline bench between low pulleys)
{
  const base = { hip: [306, 338], torso: -150, legs: { near: { a1: 22, a2: 90, foot: 0 }, far: { a1: 28, a2: 92, foot: 0 } } };
  const props = (f, showArrow) => {
    const nb = dir(120);
    const t = dir(-150);
    return {
      back:
        tower(150) + pulley([150, 426]) +
        pad(plus(plus(f.hip, nb, 26), t, -6), plus(plus(f.shoulder, nb, 26), t, 34)) + pad([290, 362], [356, 362], 20) +
        seg([248, 374], [238, FLOOR - 2], 8, C.metalDark) + seg([346, 372], [356, FLOOR - 2], 8, C.metalDark) +
        cable([150, 426], f.far.wrist),
      front: cable([150, 426], f.near.wrist) + handle(f.near.wrist),
      arrows: showArrow ? arrow([214, 410], [270, 196], 40) : '',
    };
  };
  pair(
    'incline-cable-fly',
    sideImage('Incline Cable Fly — start', { ...base, arm: { a1: 100, a2: 100 } }, (f) => props(f, true)),
    sideImage('Incline Cable Fly — finish', { ...base, arm: { a1: -60, a2: -60 } }, (f) => props(f, false)),
  );
}

// 3. Low-to-high cable fly (low pulley behind)
{
  const base = { hip: [272, 284], torso: -86, legs: standLegs };
  const props = (f, showArrow) => ({
    back: tower(104) + pulley([104, 426]) + cable([104, 426], f.far.wrist),
    front: cable([104, 426], f.near.wrist) + handle(f.near.wrist),
    arrows: showArrow ? arrow([298, 306], [384, 160], -40) : '',
  });
  pair(
    'low-to-high-cable-fly',
    sideImage('Low-to-High Cable Fly — start', { ...base, arm: { a1: 100, a2: 80 } }, (f) => props(f, true)),
    sideImage('Low-to-High Cable Fly — finish', { ...base, arm: { a1: -12, a2: -20 } }, (f) => props(f, false)),
  );
}

// 4. Flat bench press (combined machine, flat position)
{
  const base = { hip: [330, 324], torso: 180, headA: 180, legs: { near: { a1: 32, a2: 90, foot: 0 }, far: { a1: 38, a2: 92, foot: 0 } } };
  const props = (f, showArrow) => ({
    back: stack(30, 236) + tower(112, 70) + seg([112, 86], [250, 86], 12, C.metalDark) + pad([148, 356], [372, 356], 22) + post([172, 368]) + post([348, 368]),
    front: seg([250, 92], f.near.wrist, 9, C.metal) + handle(f.near.wrist),
    arrows: showArrow ? arrow([262, 300], [262, 214]) : '',
  });
  pair(
    'machine-flat-bench-press',
    sideImage('Flat Bench Press (Machine) — start', { ...base, arm: { a1: 92, s1: 0.5, a2: -90 } }, (f) => props(f, true)),
    sideImage('Flat Bench Press (Machine) — finish', { ...base, arm: { a1: -90, a2: -90 } }, (f) => props(f, false)),
  );
}

// 5. High-to-low cable fly (high pulley behind)
{
  const base = { hip: [262, 284], torso: -82, legs: standLegs };
  const props = (f, showArrow) => ({
    back: tower(104, 70) + pulley([104, 100]) + cable([104, 100], f.far.wrist),
    front: cable([104, 100], f.near.wrist) + handle(f.near.wrist),
    arrows: showArrow ? arrow([200, 90], [340, 282], -50) : '',
  });
  pair(
    'high-to-low-cable-fly',
    sideImage('High-to-Low Cable Fly — start', { ...base, arm: { a1: -140, a2: -150 } }, (f) => props(f, true)),
    sideImage('High-to-Low Cable Fly — finish', { ...base, arm: { a1: 55, a2: 70 } }, (f) => props(f, false)),
  );
}

// 6. Resistance band lateral raise (front view, band under feet)
{
  const props = (f, showArrow) => ({
    front: band(plus(f.left.ankle, [6, 8]), f.left.wrist) + band(plus(f.right.ankle, [-6, 8]), f.right.wrist),
    arrows: showArrow ? arrow([196, 318], [118, 196], 26) + arrow([316, 318], [394, 196], -26) : '',
  });
  pair(
    'band-lateral-raise',
    frontImage('Resistance Band Lateral Raise — start', { left: { arm: relaxedL, leg: frontLegs.left }, right: { arm: relaxedR, leg: frontLegs.right } }, (f) => props(f, true)),
    frontImage('Resistance Band Lateral Raise — finish', { left: { arm: { a1: 182, a2: 178 }, leg: frontLegs.left }, right: { arm: { a1: -2, a2: 2 }, leg: frontLegs.right } }, (f) => props(f, false)),
  );
}

// 7. Resistance band face pull (band anchored at face height in front)
{
  const base = { hip: [236, 284], torso: -90, legs: standLegs };
  const props = (f, showArrow) => ({
    back: anchorPost(446, 156) + band([440, 156], f.far.wrist) + band([440, 156], f.near.wrist),
    arrows: showArrow ? arrow([370, 196], [276, 196]) : '',
  });
  pair(
    'band-face-pull',
    sideImage('Resistance Band Face Pull — start', { ...base, arm: { a1: -4, a2: -4 } }, (f) => props(f, true)),
    sideImage('Resistance Band Face Pull — finish', { ...base, arm: { a1: 178, a2: -12 } }, (f) => props(f, false)),
  );
}

// 8. Behind-the-body cable curl (low pulley behind, one arm)
{
  const base = { hip: [272, 284], torso: -88, legs: { near: { a1: 72, a2: 96, foot: 0 }, far: { a1: 110, a2: 100, foot: 0 } }, farArm: { a1: 92, a2: 92 } };
  const props = (f, showArrow) => ({
    back: tower(100) + pulley([100, 426]),
    front: cable([100, 426], f.near.wrist) + handle(f.near.wrist),
    arrows: showArrow ? arrow([228, 300], [302, 198], 34) : '',
  });
  pair(
    'behind-body-cable-curl',
    sideImage('Behind-the-Body Cable Curl — start', { ...base, arm: { a1: 106, a2: 112 } }, (f) => props(f, true)),
    sideImage('Behind-the-Body Cable Curl — finish', { ...base, arm: { a1: 106, a2: -48 } }, (f) => props(f, false)),
  );
}

// 9. Cable preacher curl (preacher bench facing the low pulley)
{
  const base = { hip: [214, 368], torso: -78, legs: seatedLegs };
  const props = (f, showArrow) => {
    const d = dir(42);
    const n = dir(132);
    return {
      back: tower(446) + pulley([446, 426]) + pad([178, 386], [252, 386], 18) + post([214, 394]),
      front:
        pad(plus(plus(f.shoulder, d, 12), n, 16), plus(plus(f.near.elbow, d, 16), n, 16), 20) + post(plus(lerp(f.shoulder, f.near.elbow, 0.7), n, 26)) +
        cable([446, 426], f.near.wrist) + handle(f.near.wrist),
      arrows: showArrow ? arrow([344, 344], [312, 236], -34) : '',
    };
  };
  pair(
    'cable-preacher-curl',
    sideImage('Cable Preacher Curl — start', { ...base, arm: { a1: 42, a2: 38 } }, (f) => props(f, true)),
    sideImage('Cable Preacher Curl — finish', { ...base, arm: { a1: 42, a2: -72 } }, (f) => props(f, false)),
  );
}

// 10–11. Forearm machine wrist flexion / extension
function forearmMachine(id, title, gripBelow) {
  const base = { hip: [196, 368], torso: -84, legs: seatedLegs };
  const props = (f, showArrow) => {
    const grip = plus(f.near.hand, [0, gripBelow ? 7 : -7]);
    return {
      back: pad([170, 386], [236, 386], 18) + post([204, 394]) + stack(372, 260),
      front:
        pad([222, 332], [290, 332], 14) + post([258, 340]) + seg(grip, [384, 268], 5, C.metal) + seg(plus(grip, [0, -10]), plus(grip, [0, 10]), 9, C.grip),
      arrows: showArrow ? arrow([310, 346], [310, 296], gripBelow ? -14 : 14) : '',
    };
  };
  pair(
    id,
    sideImage(`${title} — start`, { ...base, arm: { a1: 72, a2: 0, hand: 55 } }, (f) => props(f, true)),
    sideImage(`${title} — finish`, { ...base, arm: { a1: 72, a2: 0, hand: -55 } }, (f) => props(f, false)),
  );
}
forearmMachine('forearm-machine-wrist-flexion', 'Forearm Machine Wrist Flexion (palms up)', true);
forearmMachine('forearm-machine-wrist-extension', 'Forearm Machine Wrist Extension (palms down)', false);

// 12. Leg press calf raise
{
  const legAngle = -24;
  const base = { hip: [176, 356], torso: -148, headA: -128, arm: { target: [204, 376], bend: 1 } };
  const props = (f, pushed) => {
    const perp = dir(legAngle - 90);
    const centre = plus(f.near.ankle, dir(legAngle), pushed ? 26 : 10);
    const top = plus(centre, perp, 70);
    const bottom = plus(centre, perp, -58);
    const nb = dir(122);
    return {
      back:
        pad(plus(f.hip, nb, 24), plus(plus(f.shoulder, nb, 24), dir(-148), 26)) + pad([150, 380], [226, 380], 20) +
        seg(bottom, [300, FLOOR - 8], 10, C.metal) + seg([120, FLOOR - 8], [430, FLOOR - 8], 12, C.metalDark) + post([186, 392]),
      front: seg(bottom, top, 16, C.metalDark) + handle(f.near.wrist),
      arrows: pushed ? '' : arrow([356, 300], [372, 258], -10),
    };
  };
  const legs = (foot) => ({ near: { a1: legAngle, a2: legAngle, foot }, far: { a1: legAngle + 4, a2: legAngle + 4, foot } });
  pair(
    'leg-press-calf-raise',
    sideImage('Leg Press Calf Raise — start', { ...base, legs: legs(-114) }, (f) => props(f, false)),
    sideImage('Leg Press Calf Raise — finish', { ...base, legs: legs(-62) }, (f) => props(f, true)),
  );
}

// 13. Cable hip adduction (front view, ankle strap, low pulley at the side)
{
  const props = (f, showArrow) => ({
    back: tower(96) + pulley([96, 426]),
    front: cable([96, 426], f.left.ankle) + dot(f.left.ankle, 9, C.grip),
    arrows: showArrow ? arrow([178, 474], [282, 474], -20) : '',
  });
  const fig = (leftLeg) => ({
    frontLeg: 'left',
    left: { arm: { target: [112, 198], bend: -1 }, leg: leftLeg },
    right: { arm: { target: [286, 268], bend: 1 }, leg: { a1: 88, a2: 90 } },
  });
  pair(
    'cable-hip-adduction',
    frontImage('Cable Hip Adduction — start', fig({ a1: 118, a2: 116 }), (f) => props(f, true)),
    frontImage('Cable Hip Adduction — finish', fig({ a1: 78, a2: 72 }), (f) => props(f, false)),
  );
}

// 14. Resistance band crunch (kneeling, band anchored high in front)
{
  const legs = { near: { a1: 90, a2: 180, foot: 180 }, far: { a1: 90, a2: 180, foot: 180 } };
  const props = (f, showArrow) => ({
    back: anchorPost(446, 112) + band([440, 112], f.near.wrist),
    arrows: showArrow ? arrow([312, 186], [378, 282], -30) : '',
  });
  pair(
    'band-crunch',
    sideImage('Resistance Band Crunch — start', { hip: [250, 354], torso: -90, legs, arm: { target: [268, 204], bend: 1 } }, (f) => props(f, true)),
    sideImage('Resistance Band Crunch — finish', { hip: [250, 354], torso: -22, headA: -6, legs, arm: { target: [384, 324], bend: -1 } }, (f) => props(f, false)),
  );
}

// 15. Cable woodchop, high to low (front view, high pulley at the side)
{
  const legs = { left: { a1: 106, a2: 96 }, right: { a1: 74, a2: 84 } };
  const props = (f, showArrow) => ({
    back: tower(76, 70) + pulley([76, 104]),
    front: cable([76, 104], f.left.wrist) + handle(lerp(f.left.wrist, f.right.wrist, 0.5)),
    arrows: showArrow ? arrow([172, 150], [344, 306], -60) : '',
  });
  pair(
    'cable-woodchop',
    frontImage('Cable Woodchop (High-to-Low) — start', { cx: 262, hipY: 290, tilt: -97, left: { arm: { target: [154, 124], bend: 1 }, leg: legs.left }, right: { arm: { target: [162, 128], bend: 1 }, leg: legs.right } }, (f) => props(f, true)),
    frontImage('Cable Woodchop (High-to-Low) — finish', { cx: 262, hipY: 290, tilt: -82, left: { arm: { target: [338, 300], bend: -1 }, leg: legs.left }, right: { arm: { target: [346, 296], bend: -1 }, leg: legs.right } }, (f) => props(f, false)),
  );
}

// 16. Reverse-grip triceps pushdown (high pulley in front, palms up)
{
  const base = { hip: [226, 284], torso: -84, legs: standLegs };
  const props = (f, showArrow) => ({
    back: tower(424, 70) + pulley([424, 100]) + cable([424, 100], f.far.wrist),
    front: cable([424, 100], f.near.wrist) + seg(plus(f.near.wrist, [-12, 0]), plus(f.near.wrist, [12, 0]), 8, C.grip),
    arrows: showArrow ? arrow([300, 214], [300, 300], -18) : '',
  });
  pair(
    'reverse-grip-pushdown',
    sideImage('Reverse-Grip Pushdown — start', { ...base, arm: { a1: 96, a2: -40 } }, (f) => props(f, true)),
    sideImage('Reverse-Grip Pushdown — finish', { ...base, arm: { a1: 96, a2: 88 } }, (f) => props(f, false)),
  );
}

/* ---------------- Stretches / warm-ups ---------------- */

pair(
  'arm-circles',
  frontImage('Arm Circles — arms out', { left: { arm: { a1: 180, a2: 180 }, leg: frontLegs.left }, right: { arm: { a1: 0, a2: 0 }, leg: frontLegs.right } }, (f) => ({
    arrows: circleArrow(f.left.wrist, 26) + circleArrow(f.right.wrist, 26),
  })),
  frontImage('Arm Circles — circling', { left: { arm: { a1: -150, a2: -150 }, leg: frontLegs.left }, right: { arm: { a1: -30, a2: -30 }, leg: frontLegs.right } }, (f) => ({
    arrows: circleArrow(f.left.wrist, 26) + circleArrow(f.right.wrist, 26),
  })),
);

pair(
  'dynamic-chest-opener',
  frontImage('Dynamic Chest Opener — arms crossed', { left: { arm: { target: [288, 236], bend: -1 }, leg: frontLegs.left }, right: { arm: { target: [224, 244], bend: 1 }, leg: frontLegs.right } }, () => ({
    arrows: arrow([230, 250], [130, 196], 24) + arrow([282, 250], [382, 196], -24),
  })),
  frontImage('Dynamic Chest Opener — arms open', { left: { arm: { a1: 188, a2: 192 }, leg: frontLegs.left }, right: { arm: { a1: -8, a2: -12 }, leg: frontLegs.right } }),
);

pair(
  'shoulder-wall-slides',
  frontImage('Shoulder Wall Slides — W position', { left: { arm: { a1: 150, a2: -95 }, leg: frontLegs.left }, right: { arm: { a1: 30, a2: -85 }, leg: frontLegs.right } }, () => ({
    back: wall(108, 296),
    arrows: arrow([150, 130], [140, 60]) + arrow([362, 130], [372, 60]),
  })),
  frontImage('Shoulder Wall Slides — Y position', { left: { arm: { a1: -125, a2: -120 }, leg: frontLegs.left }, right: { arm: { a1: -55, a2: -60 }, leg: frontLegs.right } }, () => ({ back: wall(108, 296) })),
);

pair(
  'band-external-rotation',
  frontImage('Shoulder External Rotation with Band — start', { left: { arm: relaxedL, leg: frontLegs.left }, right: { arm: { a1: 92, a2: 180 }, leg: frontLegs.right } }, (f) => ({
    back: anchorPost(66, 238),
    front: band([72, 238], f.right.wrist),
    arrows: arrow([238, 260], [336, 258], 34),
  })),
  frontImage('Shoulder External Rotation with Band — finish', { left: { arm: relaxedL, leg: frontLegs.left }, right: { arm: { a1: 92, a2: -6 }, leg: frontLegs.right } }, (f) => ({
    back: anchorPost(66, 238),
    front: band([72, 238], f.right.wrist),
  })),
);

pair(
  'arm-swings',
  sideImage('Arm Swings — forward', { hip: [256, 284], legs: straightLegs, arm: { a1: -50, a2: -45 }, farArm: { a1: -56, a2: -50 } }, () => ({
    arrows: arrow([350, 112], [196, 300], -120),
  })),
  sideImage('Arm Swings — back', { hip: [256, 284], legs: straightLegs, arm: { a1: 135, a2: 140 }, farArm: { a1: 128, a2: 134 }, armBehind: false }),
);

pair(
  'scapular-retractions',
  sideImage('Scapular Retractions — shoulders forward', { hip: [240, 284], torso: -86, shoulderShift: 7, legs: straightLegs, arm: { a1: 0, a2: 0 }, farArm: { a1: 2, a2: 2 } }, () => ({
    arrows: arrow([226, 196], [190, 196]),
  })),
  sideImage('Scapular Retractions — squeeze', { hip: [240, 284], torso: -92, shoulderShift: -6, legs: straightLegs, arm: { a1: 0, a2: 0 }, farArm: { a1: 2, a2: 2 } }),
);

single(
  'wrist-circles',
  sideImage('Wrist Circles', { hip: [230, 284], legs: straightLegs, arm: { a1: -2, a2: -2, hand: -10 }, farArm: { a1: 2, a2: 2, hand: -6 } }, (f) => ({
    arrows: circleArrow(f.near.hand, 22),
  })),
);

single(
  'hip-circles',
  frontImage('Hip Circles', { left: { arm: { target: [218, 270], bend: 1 }, leg: frontLegs.left }, right: { arm: { target: [294, 270], bend: -1 }, leg: frontLegs.right } }, () => ({
    arrows: circleArrow([256, 300], 92, 26),
  })),
);

single(
  'biceps-wall-stretch',
  sideImage('Biceps Wall Stretch', { hip: [274, 284], legs: straightLegs, arm: { a1: 180, a2: 180, hand: -90 }, farArm: { a1: 92, a2: 92 } }, () => ({
    back: wall(24, 132),
  })),
);

single(
  'forearm-extensor-stretch',
  sideImage(
    'Forearm Extensor Stretch',
    { hip: [236, 284], legs: straightLegs, arm: { a1: -4, a2: -4, hand: 80 }, farArm: { target: [356, 178], bend: 1 } },
    (f) => ({ arrows: arrow(plus(f.near.hand, [22, -18]), plus(f.near.hand, [16, 14]), -10) }),
  ),
);

/* ---------------- Write ---------------- */

fs.mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(images)) fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
console.log(`Wrote ${Object.keys(images).length} illustrations to ${OUT}`);
