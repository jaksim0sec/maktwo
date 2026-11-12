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

  const dimensions = {};
  for (const [name, defaultRatio] of Object.entries(CORE_FLOOR_DEFAULTS.ratios)) {
    const value = (ratios[name] ?? defaultRatio) * halfWidth;
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Invalid core floor ratio: ${name}`);
    dimensions[name] = value;
  }
  const {
    centerRadius, mainShaftRadius, gardenOffset, gardenRadius, miniShaftOffset,
    miniShaftRadius, roadHalfWidth, rimWidth, luxuryFalloff, noiseCellSize,
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
    seed, noiseSeed, districtLuxuryMax, luxuryNoiseAmplitude,
    diagonalLimit: Math.SQRT2 * halfWidth,
    innerHalfWidth,
    innerDiagonalLimit: Math.SQRT2 * innerHalfWidth,
    centerRadiusSq: centerRadius ** 2,
    mainShaftRadiusSq: mainShaftRadius ** 2,
    gardenRadiusSq: gardenRadius ** 2,
    miniShaftRadiusSq: miniShaftRadius ** 2,
    inverseDoubleFalloffSq: 0.5 / (luxuryFalloff ** 2),
    inverseNoiseCellSize: 1 / noiseCellSize,
    noiseShiftX: gridValue(0, 0, noiseSeed) * 0.5,
    noiseShiftZ: gridValue(1, 0, noiseSeed) * 0.5,
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

function latticeNoise(layout, x, z) {
  const gridX = x * layout.inverseNoiseCellSize;
  const gridZ = z * layout.inverseNoiseCellSize;
  const phaseX = layout.noiseShiftX * (2 * Math.PI);
  const phaseZ = layout.noiseShiftZ * (2 * Math.PI);
  // Bend both families of lines continuously so their crossings stay connected.
  const u = gridX + layout.noiseShiftX + 0.22 * Math.sin(1.8 * gridZ + phaseX);
  const v = gridZ + layout.noiseShiftZ + 0.22 * Math.sin(2.3 * gridX + phaseZ);
  const distance = Math.min(Math.abs(u - Math.round(u)), Math.abs(v - Math.round(v)));
  const ridge = Math.max(0, 1 - distance / 0.20);
  return 2 * ridge * ridge * (3 - 2 * ridge) - 1;
}

function luxuryForZone(layout, x, z, ax, az, zone) {
  if (zone === CORE_ZONE.MAIN_ROUTE) return 1;
  if (zone !== CORE_ZONE.DISTRICT) return 0;

  const dx = Math.max(0, layout.centerRadius - ax, ax - layout.miniShaftOffset);
  const dz = Math.max(0, layout.centerRadius - az, az - layout.miniShaftOffset);
  const acrossX = ax - layout.roadHalfWidth;
  const acrossZ = az - layout.roadHalfWidth;
  const sumDistanceSq = dx * dx + dz * dz + acrossX * acrossX + acrossZ * acrossZ;
  // Harmonic mean of the two axis fields 1 / (1 + distance² / falloff²).
  const base = layout.districtLuxuryMax / (1 + sumDistanceSq * layout.inverseDoubleFalloffSq);
  if (layout.luxuryNoiseAmplitude === 0) return base;
  const value = base + layout.luxuryNoiseAmplitude * latticeNoise(layout, x, z);
  return Math.max(0, Math.min(layout.districtLuxuryMax, value));
}

/** Main routes return 1, districts return a seeded weight, and other zones return 0. */
export function luxuryAt(layout, x, z) {
  const dx = x - layout.centerX;
  const dz = z - layout.centerZ;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  return luxuryForZone(layout, dx, dz, ax, az, classify(layout, ax, az));
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
  let index = 0;
  for (let row = 0; row < depth; row++) {
    const z = z0 + row * step - layout.centerZ;
    const az = Math.abs(z);
    for (let col = 0; col < width; col++) {
      const x = x0 + col * step - layout.centerX;
      const ax = Math.abs(x);
      const zone = classify(layout, ax, az);
      zones[index] = zone;
      if (weights != null) weights[index] = luxuryForZone(layout, x, z, ax, az, zone);
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
