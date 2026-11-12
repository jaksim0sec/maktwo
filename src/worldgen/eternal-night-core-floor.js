export const CORE_ZONE = Object.freeze({
  OUTSIDE: 0,
  PUBLIC: 1,
  MAIN_SHAFT: 2,
  SKY_GARDEN: 3,
  MINI_SHAFT: 4,
  MAIN_ROUTE: 5,
  DISTRICT: 6,
  CENTRAL: 7,
});

export const CORE_STRUCTURE = Object.freeze({ SLAB: 1, MAIN_SHAFT: 2, MINI_SHAFT: 3 });

// Prototype dimensions in blocks. The provisional height uses 90 × 6-block storeys.
// Plan ratios are relative to the apothem, half the width across parallel sides.
export const CORE_FLOOR_DEFAULTS = Object.freeze({
  width: 1024,
  floorHeight: 540,
  slabThickness: 8,
  districtLuxuryMax: 0.94,
  luxuryNoiseAmplitude: 0.035,
  luxuryNoiseDensity: 0.5,
  luxuryNoiseConcentration: 0.5,
  ratios: Object.freeze({
    centerRadius: 0.225,
    mainShaftRadius: 0.055,
    gardenOffset: 0.13,
    gardenRadius: 0.043,
    miniShaftOffset: 0.865,
    miniShaftRadius: 0.04,
    roadHalfWidth: 0.028,
    rimWidth: 0.045,
    luxuryFalloff: 0.42,
    noiseCellSize: 0.12,
  }),
});

function cardinalCenters(x, z, offset) {
  return Object.freeze([
    Object.freeze([x + offset, z]),
    Object.freeze([x, z + offset]),
    Object.freeze([x - offset, z]),
    Object.freeze([x, z - offset]),
  ]);
}

/** Compile one immutable floor in world coordinates. x/z are horizontal; y is height. */
export function createFloorLayout({
  width = CORE_FLOOR_DEFAULTS.width,
  centerX = 0,
  centerZ = 0,
  floorY = 0,
  floorHeight = CORE_FLOOR_DEFAULTS.floorHeight,
  slabThickness = CORE_FLOOR_DEFAULTS.slabThickness,
  seed = 0,
  districtLuxuryMax = CORE_FLOOR_DEFAULTS.districtLuxuryMax,
  luxuryNoiseAmplitude = CORE_FLOOR_DEFAULTS.luxuryNoiseAmplitude,
  luxuryNoiseDensity = CORE_FLOOR_DEFAULTS.luxuryNoiseDensity,
  luxuryNoiseConcentration = CORE_FLOOR_DEFAULTS.luxuryNoiseConcentration,
  ratios = {},
} = {}) {
  const halfWidth = width / 2;
  const slabBottom = floorY - slabThickness;
  const floorTop = floorY + floorHeight;
  if (![width, centerX, centerZ, floorY, floorHeight, slabThickness, slabBottom, floorTop].every(Number.isFinite)
    || halfWidth <= 0 || floorTop <= floorY || slabBottom >= floorY
    || !Number.isSafeInteger(seed)) {
    throw new RangeError('Invalid core floor dimensions, origin, or seed');
  }
  if (!(districtLuxuryMax > 0 && districtLuxuryMax < 1)
    || !(luxuryNoiseAmplitude >= 0 && luxuryNoiseAmplitude <= districtLuxuryMax)) {
    throw new RangeError('Invalid district luxury range');
  }

  if (!(luxuryNoiseDensity >= 0 && luxuryNoiseDensity <= 1)
    || !(luxuryNoiseConcentration >= 0 && luxuryNoiseConcentration <= 1)) {
    throw new RangeError('Noise density and concentration must be between 0 and 1');
  }

  const dimensions = {};
  for (const [name, defaultRatio] of Object.entries(CORE_FLOOR_DEFAULTS.ratios)) {
    const value = (ratios[name] ?? defaultRatio) * halfWidth;
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Invalid core floor ratio: ${name}`);
    dimensions[name] = value;
  }
  const {
    centerRadius, mainShaftRadius, gardenOffset, gardenRadius, miniShaftOffset,
    miniShaftRadius, roadHalfWidth, rimWidth, luxuryFalloff,
  } = dimensions;
  const innerHalfWidth = halfWidth - rimWidth;
  if (gardenOffset <= mainShaftRadius + gardenRadius || gardenOffset <= Math.SQRT2 * gardenRadius
    || gardenOffset + gardenRadius >= centerRadius || roadHalfWidth >= centerRadius
    || centerRadius >= innerHalfWidth || centerRadius >= miniShaftOffset - miniShaftRadius
    || miniShaftOffset + miniShaftRadius >= halfWidth) {
    throw new RangeError('Core floor features overlap or extend beyond their bounds');
  }
  const noiseSeed = (seed | 0) ^ Math.imul(Math.floor(seed / 0x100000000), 0x9e3779b1);

  return Object.freeze({
    ...dimensions,
    width, halfWidth, centerX, centerZ, floorY, floorTop, floorHeight, slabThickness, slabBottom,
    seed, noiseSeed, districtLuxuryMax, luxuryNoiseAmplitude, luxuryNoiseDensity, luxuryNoiseConcentration,
    diagonalLimit: Math.SQRT2 * halfWidth,
    innerHalfWidth,
    innerDiagonalLimit: Math.SQRT2 * innerHalfWidth,
    centerRadiusSq: centerRadius ** 2,
    mainShaftRadiusSq: mainShaftRadius ** 2,
    gardenRadiusSq: gardenRadius ** 2,
    miniShaftRadiusSq: miniShaftRadius ** 2,
    inverseDoubleFalloffSq: 0.5 / (luxuryFalloff ** 2),
    gardenCenters: cardinalCenters(centerX, centerZ, gardenOffset),
    miniShaftCenters: cardinalCenters(centerX, centerZ, miniShaftOffset),
  });
}

function classify(layout, x, z) {
  const major = Math.max(x, z);
  const minor = Math.min(x, z);
  const sum = x + z;
  if (!(major <= layout.halfWidth && sum <= layout.diagonalLimit)) return CORE_ZONE.OUTSIDE;

  const minorSq = minor * minor;
  const centerDistanceSq = major * major + minorSq;
  if (centerDistanceSq <= layout.centerRadiusSq) {
    if (centerDistanceSq <= layout.mainShaftRadiusSq) return CORE_ZONE.MAIN_SHAFT;
    // Folding onto the nearest cardinal axis also selects the nearest of the four circles.
    const delta = major - layout.gardenOffset;
    if (delta * delta + minorSq <= layout.gardenRadiusSq) return CORE_ZONE.SKY_GARDEN;
    return CORE_ZONE.CENTRAL;
  }

  const delta = major - layout.miniShaftOffset;
  if (delta * delta + minorSq <= layout.miniShaftRadiusSq) return CORE_ZONE.MINI_SHAFT;
  if (minor <= layout.roadHalfWidth) {
    return major <= layout.miniShaftOffset ? CORE_ZONE.MAIN_ROUTE : CORE_ZONE.PUBLIC;
  }
  if (major >= layout.innerHalfWidth || sum >= layout.innerDiagonalLimit) return CORE_ZONE.PUBLIC;
  return CORE_ZONE.DISTRICT;
}

/** Return a plan classification, independent of voxel and material IDs. */
export function zoneAt(layout, x, z) {
  return classify(layout, Math.abs(x - layout.centerX), Math.abs(z - layout.centerZ));
}

/** District IDs 0–3 start at (+x,+z), followed by (-x,+z), (-x,-z), (+x,-z). */
export function districtIdAt(layout, x, z) {
  if (zoneAt(layout, x, z) !== CORE_ZONE.DISTRICT) return -1;
  if (z >= layout.centerZ) return x >= layout.centerX ? 0 : 1;
  return x < layout.centerX ? 2 : 3;
}

function gridValue(x, z, seed) {
  let hash = Math.imul(x, 0x1f123bb5) ^ Math.imul(z, 0x5f356495) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x80000000 - 1;
}

const NOISE_RESOLUTION = 192;
const BRANCH_ATTACHMENTS = [0.25, 0.47, 0.69, 0.36, 0.58, 0.80];
const branchFields = new WeakMap();

function curvePoint(start, bend, end, t) {
  const a = (1 - t) ** 2;
  const b = 2 * t * (1 - t);
  const c = t ** 2;
  return [a * start[0] + b * bend[0] + c * end[0],
    a * start[1] + b * bend[1] + c * end[1]];
}

function stampCurve(field, start, bend, end, radius, strength, growth, concentrationPower) {
  const scale = (NOISE_RESOLUTION - 1) / 2;
  const steps = 10;
  let [x, z] = start.map(value => (value + 1) * scale);
  for (let step = 1; (step - 1) / steps < growth; step++) {
    const progress = Math.min(growth, step / steps);
    const [nextX, nextZ] = curvePoint(start, bend, end, progress).map(value => (value + 1) * scale);
    const dx = nextX - x;
    const dz = nextZ - z;
    const lengthSq = dx * dx + dz * dz;
    const brush = radius * scale * (1 - 0.55 * (step - 1) / steps);
    const minX = Math.max(0, Math.floor(Math.min(x, nextX) - brush));
    const maxX = Math.min(NOISE_RESOLUTION - 1, Math.ceil(Math.max(x, nextX) + brush));
    const minZ = Math.max(0, Math.floor(Math.min(z, nextZ) - brush));
    const maxZ = Math.min(NOISE_RESOLUTION - 1, Math.ceil(Math.max(z, nextZ) + brush));
    for (let row = minZ; row <= maxZ; row++) {
      for (let col = minX; col <= maxX; col++) {
        const along = lengthSq ? Math.max(0, Math.min(1, ((col - x) * dx + (row - z) * dz) / lengthSq)) : 0;
        const distanceSq = (col - x - along * dx) ** 2 + (row - z - along * dz) ** 2;
        const falloff = Math.max(0, 1 - distanceSq / (brush * brush));
        const index = row * NOISE_RESOLUTION + col;
        field[index] = Math.max(field[index], strength * falloff ** concentrationPower);
      }
    }
    x = nextX;
    z = nextZ;
  }
}

function getBranchField(layout) {
  if (layout.luxuryNoiseAmplitude === 0 || layout.luxuryNoiseDensity === 0) return null;
  let field = branchFields.get(layout);
  if (field) return field;

  field = new Float32Array(NOISE_RESOLUTION ** 2);
  const spread = Math.max(0.45, Math.min(1.55, layout.noiseCellSize / (layout.halfWidth * 0.12)));
  const density = layout.luxuryNoiseDensity;
  const concentrationPower = 1 + 2 * layout.luxuryNoiseConcentration;
  for (let district = 0; district < 4; district++) {
    const random = salt => gridValue(district, salt, layout.noiseSeed);
    const x = (district === 0 || district === 3 ? 1 : -1) * (0.38 + 0.08 * random(0));
    const z = (district < 2 ? 1 : -1) * (0.38 + 0.08 * random(1));
    const angle = Math.PI * random(2);
    const forwardX = Math.cos(angle);
    const forwardZ = Math.sin(angle);
    const offset = ([originX, originZ], forward, across) => [
      originX + spread * (forward * forwardX - across * forwardZ),
      originZ + spread * (forward * forwardZ + across * forwardX),
    ];
    const center = [x, z];
    const start = offset(center, -0.26, 0.06 * random(3));
    const end = offset(center, 0.28, 0.10 * random(4));
    const bend = offset(center, 0, (random(5) < 0 ? -1 : 1) * (0.12 + 0.06 * random(6)));
    // Grow the trunk first, then the same seeded branches in order as density rises.
    const defaultBranchCount = random(7) > 0.30 ? 3 : 2;
    const growth = density <= 0.5
      ? density * 2 * (1 + defaultBranchCount)
      : 1 + defaultBranchCount + (density * 2 - 1) * (BRANCH_ATTACHMENTS.length - defaultBranchCount);
    const trunkGrowth = Math.min(1, growth);
    stampCurve(field, start, bend, end, 0.047, trunkGrowth, trunkGrowth, concentrationPower);

    const firstSide = random(8) < 0 ? -1 : 1;
    for (let branch = 0; branch < growth - 1; branch++) {
      const branchGrowth = Math.min(1, growth - 1 - branch);
      const salt = branch < 3 ? branch : branch + 24;
      const root = curvePoint(start, bend, end, BRANCH_ATTACHMENTS[branch] + 0.07 * random(9 + salt));
      const side = branch % 2 === 0 ? firstSide : -firstSide;
      const tip = offset(root, 0.09 + 0.12 * random(12 + salt), side * (0.16 + 0.07 * random(15 + salt)));
      const turn = offset(root, 0.02 + 0.08 * random(18 + salt), side * 0.05);
      const radius = branch >= 2 ? 0.023 : 0.031;
      const strength = branch >= 2 ? 0.52 : 0.74;
      stampCurve(field, root, turn, tip, radius, strength, branchGrowth, concentrationPower);
    }
  }
  branchFields.set(layout, field);
  return field;
}

function branchNoise(field, layout, x, z) {
  const scale = (NOISE_RESOLUTION - 1) / 2;
  const u = (x / layout.halfWidth + 1) * scale;
  const v = (z / layout.halfWidth + 1) * scale;
  const col = Math.floor(u);
  const row = Math.floor(v);
  const index = row * NOISE_RESOLUTION + col;
  const sx = u - col;
  const sz = v - row;
  const near = field[index] + sx * (field[index + 1] - field[index]);
  const far = field[index + NOISE_RESOLUTION] + sx * (field[index + NOISE_RESOLUTION + 1] - field[index + NOISE_RESOLUTION]);
  return near + sz * (far - near);
}

function luxuryForZone(layout, x, z, ax, az, zone, field) {
  if (zone === CORE_ZONE.MAIN_ROUTE) return 1;
  if (zone !== CORE_ZONE.DISTRICT) return 0;

  const dx = Math.max(0, layout.centerRadius - ax, ax - layout.miniShaftOffset);
  const dz = Math.max(0, layout.centerRadius - az, az - layout.miniShaftOffset);
  const acrossX = ax - layout.roadHalfWidth;
  const acrossZ = az - layout.roadHalfWidth;
  const sumDistanceSq = dx * dx + dz * dz + acrossX * acrossX + acrossZ * acrossZ;
  // Harmonic mean of the two axis fields 1 / (1 + distance² / falloff²).
  const base = layout.districtLuxuryMax / (1 + sumDistanceSq * layout.inverseDoubleFalloffSq);
  if (!field) return base;
  const value = base + layout.luxuryNoiseAmplitude * branchNoise(field, layout, x, z);
  return Math.max(0, Math.min(layout.districtLuxuryMax, value));
}

/** Main routes return 1, districts return a seeded weight, and other zones return 0. */
export function luxuryAt(layout, x, z) {
  const dx = x - layout.centerX;
  const dz = z - layout.centerZ;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  return luxuryForZone(layout, dx, dz, ax, az, classify(layout, ax, az), getBranchField(layout));
}

/**
 * Fill Uint8Array zones and optional Float32Array weights in row order (x changes fastest).
 * x0 and z0 are the coordinates of the first sample. Use block centers for voxel columns.
 */
export function sampleFloorRect(layout, x0, z0, width, depth, zones, weights, step = 1) {
  const size = width * depth;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(depth) || !Number.isSafeInteger(size)
    || width < 1 || depth < 1 || !Number.isFinite(step) || step <= 0
    || !Number.isFinite(x0) || !Number.isFinite(z0)
    || zones.length < size || (weights != null && weights.length < size)) {
    throw new RangeError('Invalid core floor sample rectangle or output size');
  }
  const field = weights == null ? null : getBranchField(layout);
  let index = 0;
  for (let row = 0; row < depth; row++) {
    const z = z0 + row * step - layout.centerZ;
    const az = Math.abs(z);
    for (let col = 0; col < width; col++) {
      const x = x0 + col * step - layout.centerX;
      const ax = Math.abs(x);
      const zone = classify(layout, ax, az);
      zones[index] = zone;
      if (weights != null) weights[index] = luxuryForZone(layout, x, z, ax, az, zone, field);
      index++;
    }
  }
}

/**
 * Write [minY, maxYExclusive, structureId] into out and return the span count (0 or 1).
 * Shaft spans reserve space for future geometry. Their IDs do not describe solid blocks.
 */
export function verticalSpansAt(layout, x, z, out) {
  const zone = zoneAt(layout, x, z);
  if (zone === CORE_ZONE.OUTSIDE || zone === CORE_ZONE.SKY_GARDEN) return 0;
  out[0] = layout.slabBottom;
  if (zone === CORE_ZONE.MAIN_SHAFT || zone === CORE_ZONE.MINI_SHAFT) {
    out[1] = layout.floorTop;
    out[2] = zone === CORE_ZONE.MAIN_SHAFT ? CORE_STRUCTURE.MAIN_SHAFT : CORE_STRUCTURE.MINI_SHAFT;
  } else {
    out[1] = layout.floorY;
    out[2] = CORE_STRUCTURE.SLAB;
  }
  return 1;
}

/** Hook for future detail sampling. null means no detail override at this point. */
export function detailAt(_layout, _x, _y, _z) {
  return null;
}
