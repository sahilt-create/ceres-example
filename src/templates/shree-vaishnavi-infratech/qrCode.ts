/* eslint-disable no-bitwise, no-continue */

/**
 * Offline QR encoder for the document QR. The API sends documentQr as text
 * (a JSON summary of the document), not an image, so the template encodes it
 * itself: byte mode, error correction M, versions 1-20 (up to 666 bytes).
 */

// [ecc codewords per block, group 1 blocks, group 1 data codewords,
//  group 2 blocks, group 2 data codewords] for error correction level M.
const ECC_M_BLOCKS: Array<[number, number, number, number, number]> = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

const ALIGNMENT_POSITIONS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

const dataCapacity = (version: number): number => {
  const [, blocks1, data1, blocks2, data2] = ECC_M_BLOCKS[version - 1];
  return blocks1 * data1 + blocks2 * data2;
};

const appendBits = (bits: number[], value: number, length: number): void => {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
};

const multiply = (left: number, right: number): number => {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((right >>> index) & 1) * left;
  }
  return result & 0xff;
};

const reedSolomonDivisor = (degree: number): number[] => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let term = 0; term < degree; term += 1) {
      result[term] = multiply(result[term], root);
      if (term + 1 < degree) result[term] ^= result[term + 1];
    }
    root = multiply(root, 0x02);
  }
  return result;
};

const reedSolomonRemainder = (data: number[], divisor: number[]): number[] => {
  const result = new Array(divisor.length).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  });
  return result;
};

const encodeCodewords = (bytes: Uint8Array, version: number): number[] => {
  const capacityBits = dataCapacity(version) * 8;
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
    appendBits(bits, pad, 8);
  }
  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(
      bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0)
    );
  }

  const [eccLength, blocks1, data1, blocks2, data2] = ECC_M_BLOCKS[version - 1];
  const divisor = reedSolomonDivisor(eccLength);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];
  let offset = 0;
  [
    ...new Array(blocks1).fill(data1),
    ...new Array(blocks2).fill(data2),
  ].forEach((length: number) => {
    const block = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    eccBlocks.push(reedSolomonRemainder(block, divisor));
  });

  const result: number[] = [];
  const longest = Math.max(data1, data2);
  for (let index = 0; index < longest; index += 1) {
    dataBlocks.forEach((block) => {
      if (index < block.length) result.push(block[index]);
    });
  }
  for (let index = 0; index < eccLength; index += 1) {
    eccBlocks.forEach((block) => result.push(block[index]));
  }
  return result;
};

type Matrix = { modules: boolean[][]; isFunction: boolean[][] };

const createBaseMatrix = (version: number): Matrix => {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const isFunction = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const set = (x: number, y: number, dark: boolean): void => {
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  for (let index = 0; index < size; index += 1) {
    set(6, index, index % 2 === 0);
    set(index, 6, index % 2 === 0);
  }
  [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ].forEach(([centerX, centerY]) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, distance !== 2 && distance !== 4);
      }
    }
  });

  const positions = ALIGNMENT_POSITIONS[version - 1];
  positions.forEach((y, row) => {
    positions.forEach((x, column) => {
      const last = positions.length - 1;
      if (
        (row === 0 && column === 0) ||
        (row === 0 && column === last) ||
        (row === last && column === 0)
      ) {
        return;
      }
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  // Reserve the format areas (drawn per mask later) and the dark module.
  for (let index = 0; index < 9; index += 1) {
    if (!isFunction[8][index]) set(index, 8, false);
    if (!isFunction[index][8]) set(8, index, false);
  }
  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, false);
    set(8, size - 1 - index, false);
  }
  set(8, size - 8, true);

  if (version >= 7) {
    let remainder = version;
    for (let index = 0; index < 12; index += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    }
    const bits = (version << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const dark = ((bits >>> index) & 1) === 1;
      const a = size - 11 + (index % 3);
      const b = Math.floor(index / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  return { modules, isFunction };
};

const drawCodewords = (matrix: Matrix, codewords: number[]): void => {
  const { modules, isFunction } = matrix;
  const size = modules.length;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (isFunction[y][x]) continue;
        if (bitIndex < codewords.length * 8) {
          modules[y][x] =
            ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex += 1;
        }
      }
    }
  }
};

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

const applyMask = (matrix: Matrix, mask: number): boolean[][] =>
  matrix.modules.map((row, y) =>
    row.map((dark, x) =>
      matrix.isFunction[y][x] ? dark : dark !== MASKS[mask](x, y)
    )
  );

const drawFormatBits = (modules: boolean[][], mask: number): void => {
  const size = modules.length;
  // Error correction level M is 0b00.
  const data = mask;
  let remainder = data;
  for (let index = 0; index < 10; index += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  }
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const bit = (index: number): boolean => ((bits >>> index) & 1) === 1;
  for (let index = 0; index <= 5; index += 1) modules[index][8] = bit(index);
  modules[7][8] = bit(6);
  modules[8][8] = bit(7);
  modules[8][7] = bit(8);
  for (let index = 9; index < 15; index += 1) {
    modules[8][14 - index] = bit(index);
  }
  for (let index = 0; index < 8; index += 1) {
    modules[8][size - 1 - index] = bit(index);
  }
  for (let index = 8; index < 15; index += 1) {
    modules[size - 15 + index][8] = bit(index);
  }
  modules[size - 8][8] = true;
};

const penalty = (modules: boolean[][]): number => {
  const size = modules.length;
  let score = 0;
  const lineScore = (line: boolean[]): number => {
    let total = 0;
    let run = 1;
    for (let index = 1; index <= line.length; index += 1) {
      if (index < line.length && line[index] === line[index - 1]) {
        run += 1;
      } else {
        if (run >= 5) total += run - 2;
        run = 1;
      }
    }
    const text = line.map((dark) => (dark ? "1" : "0")).join("");
    const finderLike = /(?=(10111010000|00001011101))/g;
    total += (text.match(finderLike) || []).length * 40;
    return total;
  };
  for (let index = 0; index < size; index += 1) {
    score += lineScore(modules[index]);
    score += lineScore(modules.map((row) => row[index]));
  }
  let dark = 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) dark += 1;
      if (
        x < size - 1 &&
        y < size - 1 &&
        modules[y][x] === modules[y][x + 1] &&
        modules[y][x] === modules[y + 1][x] &&
        modules[y][x] === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
};

export const encodeQrMatrix = (text: string): boolean[][] | null => {
  const bytes = new TextEncoder().encode(text);
  const version = ECC_M_BLOCKS.findIndex(
    (_spec, index) =>
      4 + (index + 1 <= 9 ? 8 : 16) + bytes.length * 8 <=
      dataCapacity(index + 1) * 8
  );
  if (!bytes.length || version < 0) return null;
  const matrix = createBaseMatrix(version + 1);
  drawCodewords(matrix, encodeCodewords(bytes, version + 1));
  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(matrix, mask);
    drawFormatBits(candidate, mask);
    const score = penalty(candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

/** Returns an SVG data URL for the text, or "" when it cannot be encoded. */
const generateQrDataUrl = (text: string): string => {
  const modules = encodeQrMatrix(String(text ?? ""));
  if (!modules) return "";
  const quiet = 4;
  const size = modules.length + quiet * 2;
  const path = modules
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : ""))
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/* eslint-enable no-bitwise, no-continue */

export default generateQrDataUrl;
