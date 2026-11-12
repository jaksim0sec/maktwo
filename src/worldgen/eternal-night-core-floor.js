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
  luxuryNoiseAmplitude: 0.080,
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

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function gradientAt(col, row, x, z, seed) {
  let hash = Math.imul(col, 0x1f123bb5) ^ Math.imul(row, 0x5f356495) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const direction = (hash ^ (hash >>> 16)) & 7;
  const dx = x - col;
  const dz = z - row;
  const u = direction & 1 ? dx : -dx;
  const v = direction & 2 ? dz : -dz;
  if (direction & 4) return (u + v) * Math.SQRT1_2;
  return direction & 1 ? v : u;
}

function coherentNoise(x, z, seed) {
  const col = Math.floor(x);
  const row = Math.floor(z);
  const sx = smoothstep(x - col);
  const sz = smoothstep(z - row);
  const a = gradientAt(col, row, x, z, seed);
  const b = gradientAt(col, row + 1, x, z, seed);
  const near = a + sx * (gradientAt(col + 1, row, x, z, seed) - a);
  const far = b + sx * (gradientAt(col + 1, row + 1, x, z, seed) - b);
  return near + sz * (far - near);
}

const NOISE_RESOLUTION = 192;
const riverFields = new WeakMap();

function riverBand(noise, width, coreWidth) {
  const distance = Math.abs(noise) / width;
  if (distance >= 1) return 0;
  const shoulder = smoothstep(1 - distance);
  const core = smoothstep(Math.max(0, 1 - distance / coreWidth));
  return 0.42 * shoulder + 0.58 * core;
}

function getRiverField(layout) {
  const density = layout.luxuryNoiseDensity;
  if (layout.luxuryNoiseAmplitude === 0 || density === 0) return null;
  let field = riverFields.get(layout);
  if (field) return field;

  field = new Float32Array(NOISE_RESOLUTION ** 2);
  const seed = layout.noiseSeed;
  const step = layout.width / ((NOISE_RESOLUTION - 1) * layout.noiseCellSize * 3.0);
  const halfSpan = step * (NOISE_RESOLUTION - 1) / 2;
  const bandWidth = 0.052 + density * 0.23;
  const coreWidth = 0.85 - 0.58 * layout.luxuryNoiseConcentration;
  const emergence = smoothstep(Math.min(1, density / 0.2));

  for (let row = 0; row < NOISE_RESOLUTION; row++) {
    const z = row * step - halfSpan;
    for (let col = 0; col < NOISE_RESOLUTION; col++) {
      const x = col * step - halfSpan;
      // Offset the sampling coordinates with smooth, seeded noise so contours meander.
      const u = x + 1.7 + 0.85 * coherentNoise(x * 0.52 + 1.2, z * 0.52, seed ^ 0x1f123bb5);
      const v = z - 0.6 + 0.85 * coherentNoise(x * 0.52, z * 0.52 - 2.1, seed ^ 0x5f356495);
      const width = bandWidth * (0.95 + 0.35 * coherentNoise(u * 0.75, v * 0.75, seed ^ 0x45d9f3b));
      // Each layer follows a zero contour across the whole floor. Their contributions add at crossings.
      const main = riverBand(coherentNoise(u, v, seed), width, coreWidth);
      const cross = riverBand(coherentNoise(0.8 * u - 0.65 * v + 5.3, 0.65 * u + 0.8 * v, seed ^ 0x5bd1e995),
        width * 0.82, coreWidth);
      const fine = riverBand(coherentNoise(1.1 * u + 0.7 * v, -0.7 * u + 1.1 * v + 3.2, seed ^ 0x6c8e9cf5),
        width * 0.64, coreWidth);
      field[row * NOISE_RESOLUTION + col] = emergence * Math.min(1, 0.58 * main + 0.42 * cross + 0.22 * fine);
    }
  }
  riverFields.set(layout, field);
  return field;
}

function sampleRiverField(field, layout, x, z) {
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
  const value = base + layout.luxuryNoiseAmplitude * sampleRiverField(field, layout, x, z);
  return Math.max(0, Math.min(layout.districtLuxuryMax, value));
}

/** Main routes return 1, districts return a seeded weight, and other zones return 0. */
export function luxuryAt(layout, x, z) {
  const dx = x - layout.centerX;
  const dz = z - layout.centerZ;
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  return luxuryForZone(layout, dx, dz, ax, az, classify(layout, ax, az), getRiverField(layout));
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
  const field = weights == null ? null : getRiverField(layout);
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
