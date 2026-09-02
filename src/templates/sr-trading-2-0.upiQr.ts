/* eslint-disable no-bitwise, no-continue */

/** Offline, PDF-safe UPI QR support for SR Trading 2.0. */

type VersionSpec = {
  version: number;
  dataCodewords: number;
  eccCodewordsPerBlock: number;
  dataCodewordsPerBlock: number[];
};

const VERSION_SPECS: VersionSpec[] = [
  {
    version: 1,
    dataCodewords: 19,
    eccCodewordsPerBlock: 7,
    dataCodewordsPerBlock: [19],
  },
  {
    version: 2,
    dataCodewords: 34,
    eccCodewordsPerBlock: 10,
    dataCodewordsPerBlock: [34],
  },
  {
    version: 3,
    dataCodewords: 55,
    eccCodewordsPerBlock: 15,
    dataCodewordsPerBlock: [55],
  },
  {
    version: 4,
    dataCodewords: 80,
    eccCodewordsPerBlock: 20,
    dataCodewordsPerBlock: [80],
  },
  {
    version: 5,
    dataCodewords: 108,
    eccCodewordsPerBlock: 26,
    dataCodewordsPerBlock: [108],
  },
  {
    version: 6,
    dataCodewords: 136,
    eccCodewordsPerBlock: 18,
    dataCodewordsPerBlock: [68, 68],
  },
];

const appendBits = (target: number[], value: number, length: number): void => {
  for (let index = length - 1; index >= 0; index -= 1) {
    target.push((value >>> index) & 1);
  }
};

const multiplyGalois = (left: number, right: number): number => {
  let result = 0;
  let factor = left;
  let multiplier = right;
  while (multiplier > 0) {
    if (multiplier & 1) result ^= factor;
    multiplier >>>= 1;
    factor = (factor << 1) ^ ((factor >>> 7) * 0x11d);
  }
  return result;
};

const reedSolomonDivisor = (degree: number): number[] => {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    for (let offset = 0; offset < degree; offset += 1) {
      result[offset] = multiplyGalois(result[offset], root);
      if (offset + 1 < degree) result[offset] ^= result[offset + 1];
    }
    root = multiplyGalois(root, 2);
  }
  return result;
};

const reedSolomonRemainder = (data: number[], degree: number): number[] => {
  const divisor = reedSolomonDivisor(degree);
  const result = Array<number>(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= multiplyGalois(coefficient, factor);
    });
  });
  return result;
};

const encodeDataCodewords = (
  bytes: Uint8Array,
  spec: VersionSpec
): number[] => {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = spec.dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(
      bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0)
    );
  }
  for (let pad = 0; data.length < spec.dataCodewords; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }
  return data;
};

const addErrorCorrection = (data: number[], spec: VersionSpec): number[] => {
  const blocks: number[][] = [];
  let offset = 0;
  spec.dataCodewordsPerBlock.forEach((length) => {
    blocks.push(data.slice(offset, offset + length));
    offset += length;
  });
  const eccBlocks = blocks.map((block) =>
    reedSolomonRemainder(block, spec.eccCodewordsPerBlock)
  );
  const result: number[] = [];
  const longestBlock = Math.max(...spec.dataCodewordsPerBlock);
  for (let index = 0; index < longestBlock; index += 1) {
    blocks.forEach((block) => {
      if (index < block.length) result.push(block[index]);
    });
  }
  for (let index = 0; index < spec.eccCodewordsPerBlock; index += 1) {
    eccBlocks.forEach((block) => result.push(block[index]));
  }
  return result;
};

const formatBits = (mask: number): number => {
  const data = (1 << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
  }
  return ((data << 10) | remainder) ^ 0x5412;
};

const createMatrix = (codewords: number[], version: number): boolean[][] => {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );
  const functionModules = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false)
  );
  const setFunction = (x: number, y: number, dark: boolean): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    functionModules[y][x] = true;
  };
  const drawFinder = (centerX: number, centerY: number): void => {
    for (let y = -4; y <= 4; y += 1) {
      for (let x = -4; x <= 4; x += 1) {
        const distance = Math.max(Math.abs(x), Math.abs(y));
        setFunction(centerX + x, centerY + y, distance !== 2 && distance !== 4);
      }
    }
  };
  const drawAlignment = (centerX: number, centerY: number): void => {
    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        setFunction(
          centerX + x,
          centerY + y,
          Math.max(Math.abs(x), Math.abs(y)) !== 1
        );
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);
  for (let index = 8; index < size - 8; index += 1) {
    setFunction(6, index, index % 2 === 0);
    setFunction(index, 6, index % 2 === 0);
  }
  if (version > 1) {
    const positions = [6, size - 7];
    positions.forEach((y) =>
      positions.forEach((x) => {
        if (!functionModules[y][x]) drawAlignment(x, y);
      })
    );
  }

  const drawFormat = (bits: number): void => {
    for (let index = 0; index <= 5; index += 1)
      setFunction(8, index, Boolean((bits >>> index) & 1));
    setFunction(8, 7, Boolean((bits >>> 6) & 1));
    setFunction(8, 8, Boolean((bits >>> 7) & 1));
    setFunction(7, 8, Boolean((bits >>> 8) & 1));
    for (let index = 9; index < 15; index += 1)
      setFunction(14 - index, 8, Boolean((bits >>> index) & 1));
    for (let index = 0; index < 8; index += 1)
      setFunction(size - 1 - index, 8, Boolean((bits >>> index) & 1));
    for (let index = 8; index < 15; index += 1)
      setFunction(8, size - 15 + index, Boolean((bits >>> index) & 1));
    setFunction(8, size - 8, true);
  };
  drawFormat(0);

  const dataBits: number[] = [];
  codewords.forEach((byte) => appendBits(dataBits, byte, 8));
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (functionModules[y][x]) continue;
        const bit = dataBits[bitIndex] === 1;
        modules[y][x] = bit !== ((x + y) % 2 === 0);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
  drawFormat(formatBits(0));
  return modules;
};

const matrixToSvgDataUrl = (matrix: boolean[][]): string => {
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const path = matrix
    .flatMap((row, y) =>
      row.flatMap((dark, x) =>
        dark ? [`M${x + quietZone},${y + quietZone}h1v1h-1z`] : []
      )
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#000" d="${path}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const generateUpiQrDataUrl = (upiId: string): string => {
  const normalizedUpiId = String(upiId ?? "").trim();
  if (!normalizedUpiId) return "";
  const payload = `upi://pay?pa=${encodeURIComponent(normalizedUpiId)}`;
  const bytes = new TextEncoder().encode(payload);
  const spec = VERSION_SPECS.find(
    ({ dataCodewords, version }) =>
      4 + (version <= 9 ? 8 : 16) + bytes.length * 8 <= dataCodewords * 8
  );
  if (!spec) return "";
  const data = encodeDataCodewords(bytes, spec);
  const codewords = addErrorCorrection(data, spec);
  return matrixToSvgDataUrl(createMatrix(codewords, spec.version));
};

/* eslint-enable no-bitwise, no-continue */

export default generateUpiQrDataUrl;
