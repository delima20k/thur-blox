import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const outputRoots = [
  'assets/grow-garden-2/seeds',
  'public/assets/grow-garden-2/seeds'
];

const icons = {
  mushroom: {
    bg: '#2a160e',
    parts: `
      <path d="M84 72h88v32h-12v28h-20v36h-28v-36H96v-28H84z" fill="#063d93"/>
      <path d="M96 84h64v20h-12v76H108v-76H96z" fill="#0c5ab4"/>
      <path d="M60 54h120v34H60z" fill="#001c68"/>
      <path d="M84 38h72v26H84z" fill="#00145a"/>
      <path d="M108 104h16v68h-16z" fill="#063d93" opacity=".75"/>`
  },
  'green-bean': {
    bg: '#1d2612',
    parts: `
      <path d="M92 62h44v96H92z" fill="#0d8b19"/>
      <circle cx="114" cy="88" r="16" fill="#55c734"/>
      <circle cx="114" cy="120" r="17" fill="#4fb82c"/>
      <circle cx="114" cy="151" r="15" fill="#43a025"/>
      <path d="M58 70l54 12-6 14-54-12z" fill="#12aa22"/>
      <path d="M137 70l50-14 6 14-54 16z" fill="#12aa22"/>
      <path d="M108 48l18 28h-34z" fill="#0c7014"/>`
  },
  banana: {
    bg: '#2b250e',
    parts: `
      <path d="M82 64h40l42 28v88H96L64 142V84z" fill="#e4d70b"/>
      <path d="M108 56h40l-26 24H82z" fill="#b68022"/>
      <path d="M124 84h30v88h-30z" fill="#f3e51b"/>
      <path d="M82 64l42 20v88l-42-24z" fill="#c7be09"/>
      <path d="M98 104h20v14H98zm0 30h20v14H98z" fill="#eadb14" opacity=".55"/>`
  },
  tulip: {
    bg: '#24220e',
    parts: `
      <path d="M104 104h32v76h-32z" fill="#0a6f35"/>
      <path d="M92 130l-28 24v-40z" fill="#0d8c42"/>
      <path d="M136 130l32 22v-42z" fill="#0d8c42"/>
      <path d="M80 56h84v54l-16 28H96l-16-28z" fill="#f5df34"/>
      <path d="M80 56l28 30 14-30 18 30 24-30v54H80z" fill="#fff06a"/>
      <path d="M106 86h18v44h-18z" fill="#d2b91e" opacity=".55"/>`
  },
  tomato: {
    bg: '#2a120f',
    parts: `
      <path d="M82 64h78v82l-40 38-38-38z" fill="#f20f0f"/>
      <path d="M104 56h44l-28 28H76z" fill="#b31313"/>
      <path d="M78 82l42 18v84l-42-36z" fill="#d90d0d"/>
      <path d="M120 100h40v48l-40 36z" fill="#ff1b1b"/>
      <path d="M98 112h18v20H98zm28 20h18v18h-18z" fill="#c20a0a" opacity=".6"/>`
  },
  apple: {
    bg: '#2a1510',
    parts: `
      <path d="M84 72h82v82l-42 38-40-38z" fill="#de211e"/>
      <path d="M100 60h50l-28 28H76z" fill="#a81616"/>
      <path d="M122 58l18-34 12 8-18 34z" fill="#206d2d"/>
      <path d="M140 44l42 10-36 24z" fill="#22a63d"/>
      <path d="M84 72l40 16v104l-40-38z" fill="#bd1717"/>
      <path d="M124 88h42v66l-42 38z" fill="#f23b32"/>`
  },
  bamboo: {
    bg: '#18331e',
    parts: `
      <path d="M74 64h86v104l-44 34-42-34z" fill="#9de6a8"/>
      <path d="M96 50h86l-22 24H74z" fill="#6ec885"/>
      <path d="M74 64l42 24v114l-42-34z" fill="#70c684"/>
      <path d="M116 88h44v80l-44 34z" fill="#c8f5ca"/>
      <path d="M86 96h72v14H86zm0 40h72v14H86z" fill="#4da96a"/>
      <path d="M118 110l36 26-36 14-34-24z" fill="#e3ffe1" opacity=".5"/>`
  },
  corn: {
    bg: '#2b2a0c',
    parts: `
      <path d="M92 72h62v88l-32 34-30-34z" fill="#f1dd00"/>
      <path d="M100 54h48l18 24H82z" fill="#d6b300"/>
      <path d="M80 140l40 54-42-20z" fill="#168a22"/>
      <path d="M160 140l-38 54 42-20z" fill="#117e20"/>
      <g fill="#fff243" opacity=".75">
        <rect x="104" y="82" width="13" height="13"/><rect x="126" y="82" width="13" height="13"/>
        <rect x="96" y="104" width="13" height="13"/><rect x="118" y="104" width="13" height="13"/><rect x="140" y="104" width="13" height="13"/>
        <rect x="104" y="126" width="13" height="13"/><rect x="126" y="126" width="13" height="13"/>
      </g>`
  },
  cactus: {
    bg: '#102817',
    parts: `
      <path d="M86 54h72v132l-36 28-36-28z" fill="#168239"/>
      <path d="M86 54l36 18v142l-36-28z" fill="#0f6c2f"/>
      <path d="M122 72h36v114l-36 28z" fill="#1d9945"/>
      <rect x="98" y="86" width="10" height="20" rx="3" fill="#071d10"/>
      <rect x="138" y="110" width="10" height="20" rx="3" fill="#071d10"/>
      <rect x="102" y="150" width="10" height="18" rx="3" fill="#071d10"/>`
  },
  grape: {
    bg: '#1c1432',
    parts: `
      <path d="M78 50h86v116l-42 40-44-40z" fill="#4822d4"/>
      <path d="M96 34h66l-20 28H78z" fill="#5e25e8"/>
      <path d="M78 50l44 18v138l-44-40z" fill="#3411a8"/>
      <path d="M122 68h42v98l-42 40z" fill="#5b2cf0"/>
      <rect x="94" y="86" width="26" height="24" fill="#260f8f"/>
      <rect x="126" y="118" width="26" height="24" fill="#3713b8"/>
      <rect x="96" y="150" width="24" height="22" fill="#2c1098"/>`
  },
  coconut: {
    bg: '#26180d',
    parts: `
      <path d="M72 70h94v96l-48 38-46-38z" fill="#57311b"/>
      <path d="M94 48h80l-28 32H72z" fill="#714424"/>
      <path d="M72 70l46 20v114l-46-38z" fill="#3e2416"/>
      <path d="M118 90h48v76l-48 38z" fill="#6b3d21"/>
      <path d="M98 72l20-14 26 10 14-10 14 16-24 12-32-10-18 12z" fill="#2b1a10"/>
      <circle cx="128" cy="120" r="7" fill="#2a170d"/><circle cx="146" cy="132" r="6" fill="#2a170d"/>`
  },
  mango: {
    bg: '#2b1e0d',
    parts: `
      <path d="M72 84h90v86l-50 36-40-42z" fill="#ff7f10"/>
      <path d="M96 62h72l-24 30H72z" fill="#ee3518"/>
      <path d="M72 84l44 22-4 100-40-42z" fill="#d93619"/>
      <path d="M116 106h46v64l-50 36z" fill="#ff9819"/>
      <path d="M126 58l40-34 18 20-50 34z" fill="#1fc13b"/>
      <path d="M88 82l26-20 22 16-20 28z" fill="#ef2b17"/>`
  }
};

const placeholder = {
  bg: '#152238',
  parts: `
    <path d="M68 66h112v118H68z" fill="#1f2f4a"/>
    <path d="M86 84h76v82H86z" fill="#2d4368"/>
    <path d="M104 104h40v14h-40zM104 130h40v14h-40z" fill="#9fb0c7"/>
    <path d="M92 58h64l24 24H68z" fill="#3d5f8f"/>
    <text x="124" y="211" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="#dbeafe">pending</text>`
};

function svgFor({ bg, parts }) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
      <defs>
        <radialGradient id="burst" cx="50%" cy="48%" r="62%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#000" flood-opacity=".45"/>
        </filter>
      </defs>
      <rect width="256" height="256" rx="26" fill="${bg}"/>
      ${Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const x = 128 + Math.cos(angle) * 124;
        const y = 128 + Math.sin(angle) * 124;
        return `<path d="M128 128 L${x.toFixed(2)} ${y.toFixed(2)}" stroke="#ffffff" stroke-opacity=".045" stroke-width="10"/>`;
      }).join('')}
      <rect x="20" y="20" width="216" height="216" rx="18" fill="url(#burst)" stroke="#000" stroke-opacity=".34" stroke-width="4"/>
      <g filter="url(#shadow)" transform="translate(7 2)">${parts}</g>
    </svg>
  `);
}

for (const root of outputRoots) {
  mkdirSync(root, { recursive: true });
}

for (const [slug, icon] of Object.entries({ ...icons, 'seed-placeholder': placeholder })) {
  const image = sharp(svgFor(icon)).resize(256, 256).webp({ quality: 92 });
  await Promise.all(outputRoots.map((root) => image.clone().toFile(join(root, `${slug}.webp`))));
}
