// <stdin>
import aapl from "aapl-source";
import msft from "msft-source";

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/typeEncoderMap.js
var TypeEncoderMap = class {
  #types = /* @__PURE__ */ new Map();
  /**
   * Register an encoder for a given type.
   *
   * @param typ The class to encode.  This is the function for the constructor
   *   of objects of this type.  For example, Uint8Array the value of the
   *   constructor property of a Uint8Array instance.
   * @param encoder The function to use for encoding this type.
   * @returns Previous registration, or undefined if none.
   */
  registerEncoder(typ, encoder) {
    const old = this.#types.get(typ);
    this.#types.set(typ, encoder);
    return old;
  }
  /**
   * Get the encoder for a given class.
   *
   * @param typ Constructor function.
   * @returns Encoder, or undefined if none specified.
   */
  get(typ) {
    return this.#types.get(typ);
  }
  /**
   * Delete the encoder for a given class.
   *
   * @param typ Constructor function.
   * @returns True if class found and deleted, otherwise false.
   */
  delete(typ) {
    return this.#types.delete(typ);
  }
  /**
   * Remove all classes from the map.
   */
  clear() {
    this.#types.clear();
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/constants.js
var MT = {
  POS_INT: 0,
  NEG_INT: 1,
  BYTE_STRING: 2,
  UTF8_STRING: 3,
  ARRAY: 4,
  MAP: 5,
  TAG: 6,
  SIMPLE_FLOAT: 7
};
var TAG = {
  DATE_STRING: 0,
  DATE_EPOCH: 1,
  POS_BIGINT: 2,
  NEG_BIGINT: 3,
  DECIMAL_FRAC: 4,
  BIGFLOAT: 5,
  BASE64URL_EXPECTED: 21,
  BASE64_EXPECTED: 22,
  BASE16_EXPECTED: 23,
  CBOR: 24,
  URI: 32,
  BASE64URL: 33,
  BASE64: 34,
  MIME: 36,
  DATE_EPOCH_DAYS: 100,
  // https://github.com/input-output-hk/cbor-sets-spec/blob/master/CBOR_SETS.md
  SET: 258,
  JSON: 262,
  WTF8: 273,
  // https://github.com/mishoo/cbor.lisp/blob/e1428a5/clext-spec.txt
  SYMBOL: 280,
  DATE_FULL: 1004,
  REGEXP: 21066,
  SELF_DESCRIBED: 55799,
  // Always invalid: https://www.ietf.org/archive/id/draft-bormann-cbor-notable-tags-10.html#name-invalid-tag
  INVALID_16: 65535,
  INVALID_32: 4294967295,
  INVALID_64: 0xffffffffffffffffn
};
var NUMBYTES = {
  ZERO: 0,
  ONE: 24,
  TWO: 25,
  FOUR: 26,
  EIGHT: 27,
  INDEFINITE: 31
};
var SIMPLE = {
  FALSE: 20,
  TRUE: 21,
  NULL: 22,
  UNDEFINED: 23
};
var SYMS = class {
  /**
   * A 0xFF byte as been found in the stream.  Used as a sentinal.
   */
  static BREAK = /* @__PURE__ */ Symbol.for("github.com/hildjj/cbor2/break");
  /**
   * Original CBOR encoding for round-tripping and crypto.
   */
  static ENCODED = /* @__PURE__ */ Symbol.for("github.com/hildjj/cbor2/cbor-encoded");
  /**
   * Pre-encoded version of length for arrays and maps.  Must include the
   * major type.
   */
  static LENGTH = /* @__PURE__ */ Symbol.for("github.com/hildjj/cbor2/length");
};
var DCBOR_INT = {
  MIN: -(2n ** 63n),
  MAX: 2n ** 64n - 1n
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/sorts.js
function sortCoreDeterministic(a, b) {
  const [_ka, _va, a8] = a;
  const [_kb, _vb, b8] = b;
  const len = Math.min(a8.length, b8.length);
  for (let i = 0; i < len; i++) {
    const diff = a8[i] - b8[i];
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/writer.js
var Writer = class _Writer {
  static defaultOptions = {
    chunkSize: 4096
  };
  #opts;
  #chunks = [];
  #dv = null;
  // View over last chunk.
  #offset = 0;
  #length = 0;
  constructor(opts = {}) {
    this.#opts = {
      ..._Writer.defaultOptions,
      ...opts
    };
    if (this.#opts.chunkSize < 8) {
      throw new RangeError(`Expected size >= 8, got ${this.#opts.chunkSize}`);
    }
    this.#alloc();
  }
  get length() {
    return this.#length;
  }
  read() {
    this.#trim();
    const ret = new Uint8Array(this.#length);
    let len = 0;
    for (const u8 of this.#chunks) {
      ret.set(u8, len);
      len += u8.length;
    }
    this.#alloc();
    return ret;
  }
  write(buf) {
    const len = buf.length;
    if (len > this.#left()) {
      this.#trim();
      if (len > this.#opts.chunkSize) {
        this.#chunks.push(buf);
        this.#alloc();
      } else {
        this.#alloc();
        this.#chunks[this.#chunks.length - 1].set(buf);
        this.#offset = len;
      }
    } else {
      this.#chunks[this.#chunks.length - 1].set(buf, this.#offset);
      this.#offset += len;
    }
    this.#length += len;
  }
  writeUint8(n) {
    this.#makeSpace(1);
    this.#dv.setUint8(this.#offset, n);
    this.#advance(1);
  }
  writeUint16(n, littleEndian = false) {
    this.#makeSpace(2);
    this.#dv.setUint16(this.#offset, n, littleEndian);
    this.#advance(2);
  }
  writeUint32(n, littleEndian = false) {
    this.#makeSpace(4);
    this.#dv.setUint32(this.#offset, n, littleEndian);
    this.#advance(4);
  }
  writeBigUint64(n, littleEndian = false) {
    this.#makeSpace(8);
    this.#dv.setBigUint64(this.#offset, n, littleEndian);
    this.#advance(8);
  }
  writeInt16(n, littleEndian = false) {
    this.#makeSpace(2);
    this.#dv.setInt16(this.#offset, n, littleEndian);
    this.#advance(2);
  }
  writeInt32(n, littleEndian = false) {
    this.#makeSpace(4);
    this.#dv.setInt32(this.#offset, n, littleEndian);
    this.#advance(4);
  }
  writeBigInt64(n, littleEndian = false) {
    this.#makeSpace(8);
    this.#dv.setBigInt64(this.#offset, n, littleEndian);
    this.#advance(8);
  }
  writeFloat32(n, littleEndian = false) {
    this.#makeSpace(4);
    this.#dv.setFloat32(this.#offset, n, littleEndian);
    this.#advance(4);
  }
  writeFloat64(n, littleEndian = false) {
    this.#makeSpace(8);
    this.#dv.setFloat64(this.#offset, n, littleEndian);
    this.#advance(8);
  }
  clear() {
    this.#length = 0;
    this.#chunks = [];
    this.#alloc();
  }
  #alloc() {
    const buf = new Uint8Array(this.#opts.chunkSize);
    this.#chunks.push(buf);
    this.#offset = 0;
    this.#dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  // Always push a new chunk right after trimming.
  #trim() {
    if (this.#offset === 0) {
      this.#chunks.pop();
      return;
    }
    const last = this.#chunks.length - 1;
    this.#chunks[last] = this.#chunks[last].subarray(0, this.#offset);
    this.#offset = 0;
    this.#dv = null;
  }
  #left() {
    const last = this.#chunks.length - 1;
    return this.#chunks[last].length - this.#offset;
  }
  #makeSpace(sz) {
    if (this.#left() < sz) {
      this.#trim();
      this.#alloc();
    }
  }
  #advance(sz) {
    this.#offset += sz;
    this.#length += sz;
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/tag.js
var Tag = class _Tag {
  static #tags = /* @__PURE__ */ new Map();
  tag;
  contents;
  /**
   * A tag wrapped around another value.
   *
   * @param tag The tag number.
   * @param contents The value that follows the tag number.
   */
  constructor(tag, contents = void 0) {
    this.tag = tag;
    this.contents = contents;
  }
  /**
   * When constructing the commented version of this tag, should the contents
   * be written as well?  If true, the comment function should output the
   * contents values itself (only used for tag 24 so far).
   *
   * @type {boolean}
   * @readonly
   */
  get noChildren() {
    const decoder = _Tag.#tags.get(this.tag);
    return Boolean(decoder?.noChildren);
  }
  /**
   * Register a decoder for a give tag number.
   *
   * @param tag The tag number.
   * @param decoder Decoder function.
   * @param description If provided, use this when commenting to add a type
   *   name in parens after the tag number.
   * @returns Old decoder for this tag, if there was one.
   */
  static registerDecoder(tag, decoder, description) {
    const old = this.#tags.get(tag);
    this.#tags.set(tag, decoder);
    if (old) {
      if (!("comment" in decoder)) {
        decoder.comment = old.comment;
      }
      if (!("noChildren" in decoder)) {
        decoder.noChildren = old.noChildren;
      }
    }
    if (description && !decoder.comment) {
      decoder.comment = () => `(${description})`;
    }
    return old;
  }
  /**
   * Remove the encoder for this tag number.
   *
   * @param tag Tag number.
   * @returns Old decoder, if there was one.
   */
  static clearDecoder(tag) {
    const old = this.#tags.get(tag);
    this.#tags.delete(tag);
    return old;
  }
  /**
   * Get the decoder for a given tag number.
   *
   * @param tag The tag number.
   * @returns The decoder function, if there is one.
   */
  static getDecoder(tag) {
    return this.#tags.get(tag);
  }
  /**
   * Get all registered decoders clone of the map.
   *
   * @returns Map containing current decoders, as a copy.
   */
  static getAllDecoders() {
    return new Map(this.#tags);
  }
  /**
   * Iterate over just the contents, so that the tag works more like an
   * array.
   *
   * @yields One time, the contained value.
   */
  *[Symbol.iterator]() {
    yield this.contents;
  }
  /**
   * Makes Tag act like an array, so that no special casing is needed when
   * the tag's contents are available.
   *
   * @param contents The value associated with the tag.
   * @returns Always returns 1.
   */
  push(contents) {
    this.contents = contents;
    return 1;
  }
  /**
   * Convert this tagged value to a useful data type, if possible.
   *
   * @param options Options for decoding.
   * @returns The converted value.
   */
  decode(options) {
    const decoder = options?.tags?.get(this.tag) ?? (options?.ignoreGlobalTags ? void 0 : _Tag.#tags.get(this.tag));
    if (decoder) {
      return decoder(this, options);
    }
    return this;
  }
  comment(options, depth) {
    const decoder = options?.tags?.get(this.tag) ?? (options?.ignoreGlobalTags ? void 0 : _Tag.#tags.get(this.tag));
    if (decoder?.comment) {
      return decoder.comment(this, options, depth);
    }
    return void 0;
  }
  toCBOR() {
    return [this.tag, this.contents];
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](_depth, inspectOptions, inspect) {
    return `${this.tag}(${inspect(this.contents, inspectOptions)})`;
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/box.js
function getEncoded(obj) {
  if (obj != null && typeof obj === "object") {
    return obj[SYMS.ENCODED];
  }
  return void 0;
}
function getEncodedLength(obj) {
  if (obj != null && typeof obj === "object") {
    return obj[SYMS.LENGTH];
  }
  return void 0;
}
function saveEncoded(obj, orig) {
  Object.defineProperty(obj, SYMS.ENCODED, {
    configurable: true,
    enumerable: false,
    value: orig
  });
}
function box(value, orig) {
  const o = Object(value);
  saveEncoded(o, orig);
  return o;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/float.js
var F16_SIGN = 1n << 15n;
var F16_EXPONENT = 31n << 10n;
var F16_QUIET = 1n << 9n;
var F16_PAYLOAD = F16_QUIET - 1n;
var F16_SIGNIFICAND = F16_QUIET | F16_PAYLOAD;
var F32_SIGN = 1n << 31n;
var F32_EXPONENT = 255n << 23n;
var F32_QUIET = 1n << 22n;
var F32_PAYLOAD = F32_QUIET - 1n;
var F32_SIGNIFICAND = F32_QUIET | F32_PAYLOAD;
var F64_SIGN = 1n << 63n;
var F64_EXPONENT = 2047n << 52n;
var F64_QUIET = 1n << 51n;
var F64_PAYLOAD = F64_QUIET - 1n;
var F64_SIGNIFICAND = F64_QUIET | F64_PAYLOAD;
var NOT_F16 = F64_PAYLOAD - (F16_PAYLOAD << 42n);
var NOT_F32 = F64_PAYLOAD - (F32_PAYLOAD << 29n);
var RADIX_PREFIX = {
  2: "0b",
  8: "0o",
  16: "0x"
};
var NAN_SIZE;
(function(NAN_SIZE2) {
  NAN_SIZE2[NAN_SIZE2["NATURAL"] = -2] = "NATURAL";
  NAN_SIZE2[NAN_SIZE2["UNKNOWN"] = -1] = "UNKNOWN";
  NAN_SIZE2[NAN_SIZE2["F16"] = 2] = "F16";
  NAN_SIZE2[NAN_SIZE2["F32"] = 4] = "F32";
  NAN_SIZE2[NAN_SIZE2["F64"] = 8] = "F64";
})(NAN_SIZE || (NAN_SIZE = {}));
function formatNAN(nan, _depth, inspectOptions, inspect) {
  let ret = "nan'";
  if (!nan.quiet) {
    ret += "!";
  }
  if (nan.sign === -1) {
    ret += "-";
  }
  ret += inspect(Math.abs(nan.payload), inspectOptions);
  ret += "'";
  ret += nan.encodingIndicator;
  return ret;
}
var NAN = class extends Number {
  // Full f64 as unsigned.
  #value;
  #size = NAN_SIZE.UNKNOWN;
  constructor(bytes, quiet = true, size = NAN_SIZE.UNKNOWN) {
    super(NaN);
    const orig = bytes;
    if (typeof bytes === "number") {
      if (!Number.isSafeInteger(bytes)) {
        throw new Error(`Invalid NAN payload: ${bytes}`);
      }
      bytes = BigInt(bytes);
      let s = 0n;
      if (bytes < 0) {
        s = F64_SIGN;
        bytes = -bytes;
      }
      if (bytes >= F64_QUIET) {
        throw new Error(`Payload too large: ${orig}`);
      }
      const q = quiet ? F64_QUIET : 0n;
      this.#value = s | F64_EXPONENT | q | bytes;
      switch (size) {
        case NAN_SIZE.NATURAL:
          throw new Error("NAN_SIZE.NATURAL only valid for bigint constructor");
        case NAN_SIZE.UNKNOWN:
          size = this.preferredSize;
          break;
        case NAN_SIZE.F16:
          if (this.#value & NOT_F16) {
            throw new Error("Invalid size for payload");
          }
          break;
        case NAN_SIZE.F32:
          if (this.#value & NOT_F32) {
            throw new Error("Invalid size for payload");
          }
          break;
        case NAN_SIZE.F64:
          break;
        default:
          throw new Error(`Invalid size: ${size}`);
      }
      this.#size = size;
    } else if (typeof bytes === "bigint") {
      let nat = NAN_SIZE.UNKNOWN;
      if ((bytes & F64_EXPONENT) === F64_EXPONENT) {
        this.#value = bytes;
        nat = NAN_SIZE.F64;
      } else if ((bytes & F32_EXPONENT) === F32_EXPONENT) {
        const s = (bytes & F32_SIGN) << 32n;
        this.#value = s | F64_EXPONENT | (bytes & F32_SIGNIFICAND) << 29n;
        nat = NAN_SIZE.F32;
      } else if ((bytes & F16_EXPONENT) === F16_EXPONENT) {
        const s = (bytes & F16_SIGN) << 48n;
        this.#value = s | F64_EXPONENT | (bytes & F16_SIGNIFICAND) << 42n;
        nat = NAN_SIZE.F16;
      } else {
        throw new Error(`Invalid raw NaN value: ${bytes}`);
      }
      if (size === NAN_SIZE.UNKNOWN) {
        this.#size = this.preferredSize;
      } else if (size === NAN_SIZE.NATURAL) {
        this.#size = nat;
      } else {
        if (size < nat) {
          throw new Error("Invalid bigint NaN size");
        }
        this.#size = size;
      }
    } else {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      switch (bytes.length) {
        case 3: {
          if (bytes[0] !== 249) {
            throw new Error("Invalid CBOR encoding for half float");
          }
          const val = BigInt(dv.getUint16(1, false));
          if ((val & F16_EXPONENT) !== F16_EXPONENT) {
            throw new Error("Not a NaN");
          }
          const s = (val & F16_SIGN) << 48n;
          this.#value = s | F64_EXPONENT | (val & F16_SIGNIFICAND) << 42n;
          this.#size = NAN_SIZE.F16;
          break;
        }
        case 5: {
          if (bytes[0] !== 250) {
            throw new Error("Invalid CBOR encoding for single float");
          }
          const val = BigInt(dv.getUint32(1, false));
          if ((val & F32_EXPONENT) !== F32_EXPONENT) {
            throw new Error("Not a NaN");
          }
          const s = (val & F32_SIGN) << 32n;
          this.#value = s | F64_EXPONENT | (val & F32_SIGNIFICAND) << 29n;
          this.#size = NAN_SIZE.F32;
          break;
        }
        case 9: {
          if (bytes[0] !== 251) {
            throw new Error("Invalid CBOR encoding for double float");
          }
          this.#value = dv.getBigUint64(1, false);
          if ((this.#value & F64_EXPONENT) !== F64_EXPONENT) {
            throw new Error("Not a NaN (NaNaN)");
          }
          this.#size = NAN_SIZE.F64;
          break;
        }
        default:
          throw new RangeError(`Invalid NAN size (should be 2, 4, or 8): ${bytes.length - 1}`);
      }
    }
    if (!this.payload && !this.quiet) {
      throw new Error("Signalling NaN with zero payload");
    }
  }
  /**
   * Get the CBOR bytes for this NaN.
   */
  get bytes() {
    const buf = new ArrayBuffer(this.#size + 1);
    const dv = new DataView(buf);
    switch (this.#size) {
      case NAN_SIZE.F16: {
        dv.setUint8(0, 249);
        const s = this.#value & F64_SIGN ? F16_SIGN : 0n;
        const val = s | F16_EXPONENT | (this.#value & F64_SIGNIFICAND) >> 42n;
        dv.setUint16(1, Number(val), false);
        break;
      }
      case NAN_SIZE.F32: {
        dv.setUint8(0, 250);
        const s = this.#value & F64_SIGN ? F32_SIGN : 0n;
        const val = s | F32_EXPONENT | (this.#value & F64_SIGNIFICAND) >> 29n;
        dv.setUint32(1, Number(val), false);
        break;
      }
      case NAN_SIZE.F64:
        dv.setUint8(0, 251);
        dv.setBigUint64(1, this.#value);
        break;
    }
    return new Uint8Array(buf);
  }
  /**
   * Is the quiet bit set?
   */
  get quiet() {
    return Boolean(this.#value & F64_QUIET);
  }
  /**
   * If negative -1, otherwise 1.  Should never be 0, since you should use
   * a real NaN or Infinity for those.
   */
  get sign() {
    return this.#value & F64_SIGN ? -1 : 1;
  }
  /**
   * Payload, as in IEEE754-2019.
   */
  get payload() {
    return Number(this.#value & F64_PAYLOAD) * this.sign;
  }
  /**
   * Full 64-bit encoding, with sign and quiet bit intact.
   */
  get raw() {
    return this.#value;
  }
  /**
   * Encoding indicator, based on the preferred size.
   */
  get encodingIndicator() {
    switch (this.#size) {
      case NAN_SIZE.F16:
        return "_1";
      case NAN_SIZE.F32:
        return "_2";
    }
    return "_3";
  }
  /**
   * The desired encoding size (2, 4, or 8).
   */
  get size() {
    return this.#size;
  }
  /**
   * How many bytes should this NaN be encoded as in prefrerred encoding?
   */
  get preferredSize() {
    if ((this.#value & NOT_F16) === 0n) {
      return NAN_SIZE.F16;
    }
    if ((this.#value & NOT_F32) === 0n) {
      return NAN_SIZE.F32;
    }
    return NAN_SIZE.F64;
  }
  /**
   * Is this currrently configured for preferred encoding?
   */
  get isShortestEncoding() {
    return this.preferredSize === this.#size;
  }
  /**
   * Write to a CBOR stream.
   * @param w Writer.
   */
  toCBOR(w) {
    w.write(this.bytes);
  }
  /**
   * Convert to a string in the given radix.
   *
   * @param radix Base for output.  Valid values: 2, 8, 10, and 16.
   * @returns String in the selected radix, with the correct radix prefix if
   *   radix is not 10.
   */
  toString(radix = 10) {
    return formatNAN(this, 1, {}, (n) => (RADIX_PREFIX[radix] ?? "") + n.toString(radix));
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](depth, inspectOptions, inspect) {
    return formatNAN(this, depth, inspectOptions, inspect);
  }
};
function parseHalf(buf, offset = 0, rejectSubnormals = false) {
  const sign = buf[offset] & 128 ? -1 : 1;
  const exp = (buf[offset] & 124) >> 2;
  const mant = (buf[offset] & 3) << 8 | buf[offset + 1];
  if (exp === 0) {
    if (rejectSubnormals && mant !== 0) {
      throw new Error(`Unwanted subnormal: ${sign * 5960464477539063e-23 * mant}`);
    }
    return sign * 5960464477539063e-23 * mant;
  } else if (exp === 31) {
    if (mant) {
      return NaN;
    }
    return sign * Infinity;
  }
  return sign * 2 ** (exp - 25) * (1024 + mant);
}
function halfToUint(half) {
  const dvu32 = new DataView(new ArrayBuffer(4));
  dvu32.setFloat32(0, half, false);
  const u = dvu32.getUint32(0, false);
  if ((u & 8191) !== 0) {
    return null;
  }
  let s16 = u >> 16 & 32768;
  const exp = u >> 23 & 255;
  const mant = u & 8388607;
  if (exp === 0 && mant === 0) {
  } else if (exp >= 113 && exp <= 142) {
    s16 += (exp - 112 << 10) + (mant >> 13);
  } else if (exp >= 103 && exp < 113) {
    if (mant & (1 << 126 - exp) - 1) {
      return null;
    }
    s16 += mant + 8388608 >> 126 - exp;
  } else if (exp === 255) {
    s16 |= 31744;
    s16 |= mant >> 13;
  } else {
    return null;
  }
  return s16;
}
function flushToZero(n) {
  if (n !== 0) {
    const a = new ArrayBuffer(8);
    const dv = new DataView(a);
    dv.setFloat64(0, n, false);
    const b = dv.getBigUint64(0, false);
    if ((b & 0x7ff0000000000000n) === 0n) {
      return b & 0x8000000000000000n ? -0 : 0;
    }
  }
  return n;
}
function checkSubnormal(buf) {
  switch (buf.length) {
    case 2:
      parseHalf(buf, 0, true);
      break;
    case 4: {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const n = dv.getUint32(0, false);
      if ((n & 2139095040) === 0 && n & 8388607) {
        throw new Error(`Unwanted subnormal: ${dv.getFloat32(0, false)}`);
      }
      break;
    }
    case 8: {
      const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
      const n = dv.getBigUint64(0, false);
      if ((n & 0x7ff0000000000000n) === 0n && n & 0x000fffffffffffn) {
        throw new Error(`Unwanted subnormal: ${dv.getFloat64(0, false)}`);
      }
      break;
    }
    default:
      throw new TypeError(`Bad input to isSubnormal: ${buf}`);
  }
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@cto.af/wtf8/lib/const.js
var EMPTY = new Uint8Array(0);
var WTF8 = "wtf-8";

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@cto.af/wtf8/lib/encode.js
function utf8length(str) {
  let len = 0;
  for (const s of str) {
    const cp = s.codePointAt(0);
    if (cp < 128) {
      len++;
    } else if (cp < 2048) {
      len += 2;
    } else if (cp < 65536) {
      len += 3;
    } else {
      len += 4;
    }
  }
  return len;
}
var Wtf8Encoder = class {
  encoding = WTF8;
  encode(input) {
    if (!input) {
      return EMPTY;
    }
    const buf = new Uint8Array(utf8length(String(input)));
    this.encodeInto(input, buf);
    return buf;
  }
  encodeInto(source, destination) {
    const str = String(source);
    const len = str.length;
    const outLen = destination.length;
    let written = 0;
    let read = 0;
    for (read = 0; read < len; read++) {
      const c = str.codePointAt(read);
      if (c < 128) {
        if (written >= outLen) {
          break;
        }
        destination[written++] = c;
      } else if (c < 2048) {
        if (written >= outLen - 1) {
          break;
        }
        destination[written++] = 192 | c >> 6;
        destination[written++] = 128 | c & 63;
      } else if (c < 65536) {
        if (written >= outLen - 2) {
          break;
        }
        destination[written++] = 224 | c >> 12;
        destination[written++] = 128 | c >> 6 & 63;
        destination[written++] = 128 | c & 63;
      } else {
        if (written >= outLen - 3) {
          break;
        }
        destination[written++] = 240 | c >> 18;
        destination[written++] = 128 | c >> 12 & 63;
        destination[written++] = 128 | c >> 6 & 63;
        destination[written++] = 128 | c & 63;
        read++;
      }
    }
    return {
      read,
      written
    };
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/utils.js
var CBOR_RANGES = /* @__PURE__ */ Symbol("CBOR_RANGES");
function setRanges(u8, ranges) {
  Object.defineProperty(u8, CBOR_RANGES, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: ranges
  });
}
function getRanges(u8) {
  return u8[CBOR_RANGES];
}
function hasRanges(u8) {
  return getRanges(u8) !== void 0;
}
function subarrayRanges(u8, begin = 0, end = u8.length - 1) {
  const ret = u8.subarray(begin, end);
  const ranges = getRanges(u8);
  if (ranges) {
    const rng = [];
    for (const r of ranges) {
      if (r[0] >= begin && r[0] + r[1] <= end) {
        const s = [...r];
        s[0] -= begin;
        rng.push(s);
      }
    }
    if (rng.length) {
      setRanges(ret, rng);
    }
  }
  return ret;
}
function hexToU8native(str) {
  return Uint8Array.fromHex(str);
}
function hexToU8fallback(str) {
  let len = Math.ceil(str.length / 2);
  const res = new Uint8Array(len);
  len--;
  for (let end = str.length, start = end - 2; end >= 0; end = start, start -= 2, len--) {
    res[len] = parseInt(str.substring(start, end), 16);
  }
  return res;
}
var hexToU8 = (
  /* c8 ignore next */
  typeof Uint8Array.fromHex === "function" ? (
    /* c8 ignore next */
    hexToU8native
  ) : (
    /* c8 ignore next */
    hexToU8fallback
  )
);
function u8toHexNative(u8) {
  return u8.toHex();
}
function u8toHexFallback(u8) {
  return u8.reduce((t, v) => t + v.toString(16).padStart(2, "0"), "");
}
var u8toHex = (
  /* c8 ignore next */
  typeof Uint8Array.prototype.toHex === "function" ? (
    /* c8 ignore next */
    u8toHexNative
  ) : (
    /* c8 ignore next */
    u8toHexFallback
  )
);
function u8concat(u8s) {
  const sz = u8s.reduce((t, v) => t + v.length, 0);
  const ranged = u8s.some((v) => hasRanges(v));
  const ranges = [];
  const ret = new Uint8Array(sz);
  let len = 0;
  for (const u8 of u8s) {
    if (!(u8 instanceof Uint8Array)) {
      throw new TypeError(`Invalid array: ${u8}`);
    }
    ret.set(u8, len);
    if (ranged) {
      const rgs = u8[CBOR_RANGES] ?? [[0, u8.length]];
      for (const r of rgs) {
        r[0] += len;
      }
      ranges.push(...rgs);
    }
    len += u8.length;
  }
  if (ranged) {
    setRanges(ret, ranges);
  }
  return ret;
}
function base64ToBytesNative(base64) {
  return Uint8Array.fromBase64(base64);
}
function base64ToBytesFallback(base64) {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}
var base64ToBytes = (
  /* c8 ignore next */
  typeof Uint8Array.fromBase64 === "function" ? (
    /* c8 ignore next */
    base64ToBytesNative
  ) : (
    /* c8 ignore next */
    base64ToBytesFallback
  )
);
function stringToHex(str) {
  let res = "";
  for (const c of str) {
    const cp = c.codePointAt(0)?.toString(16).padStart(4, "0");
    if (res) {
      res += ", ";
    }
    res += `U+${cp}`;
  }
  return res;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/encoder.js
var { ENCODED } = SYMS;
var HALF = MT.SIMPLE_FLOAT << 5 | NUMBYTES.TWO;
var FLOAT = MT.SIMPLE_FLOAT << 5 | NUMBYTES.FOUR;
var DOUBLE = MT.SIMPLE_FLOAT << 5 | NUMBYTES.EIGHT;
var TRUE = MT.SIMPLE_FLOAT << 5 | SIMPLE.TRUE;
var FALSE = MT.SIMPLE_FLOAT << 5 | SIMPLE.FALSE;
var UNDEFINED = MT.SIMPLE_FLOAT << 5 | SIMPLE.UNDEFINED;
var NULL = MT.SIMPLE_FLOAT << 5 | SIMPLE.NULL;
var TE = new TextEncoder();
var WE = new Wtf8Encoder();
var defaultEncodeOptions = {
  ...Writer.defaultOptions,
  avoidInts: false,
  cde: false,
  collapseBigInts: true,
  dateTag: TAG.DATE_EPOCH,
  dcbor: false,
  float64: false,
  flushToZero: false,
  forceEndian: null,
  ignoreOriginalEncoding: false,
  largeNegativeAsBigInt: false,
  reduceUnsafeNumbers: false,
  rejectBigInts: false,
  rejectCustomSimples: false,
  rejectDuplicateKeys: false,
  rejectFloats: false,
  rejectUndefined: false,
  simplifyNegativeZero: false,
  sortKeys: null,
  stringNormalization: null,
  types: null,
  wtf8: false,
  ignoreGlobalTags: false
};
var cdeEncodeOptions = {
  cde: true,
  ignoreOriginalEncoding: true,
  sortKeys: sortCoreDeterministic
};
var dcborEncodeOptions = {
  ...cdeEncodeOptions,
  dcbor: true,
  largeNegativeAsBigInt: true,
  reduceUnsafeNumbers: true,
  rejectCustomSimples: true,
  rejectDuplicateKeys: true,
  rejectUndefined: true,
  simplifyNegativeZero: true,
  stringNormalization: "NFC"
};
function cborAbs(value) {
  const neg = value < 0;
  if (typeof value === "bigint") {
    return [neg ? -value - 1n : value, neg];
  }
  return [neg ? -value - 1 : value, neg];
}
function writeFloat(val, w, opts) {
  if (opts.rejectFloats) {
    throw new Error(`Attempt to encode an unwanted floating point number: ${val}`);
  }
  if (isNaN(val)) {
    w.writeUint8(HALF);
    w.writeUint16(32256);
  } else if (!opts.float64 && Math.fround(val) === val) {
    const half = halfToUint(val);
    if (half === null) {
      w.writeUint8(FLOAT);
      w.writeFloat32(val);
    } else {
      w.writeUint8(HALF);
      w.writeUint16(half);
    }
  } else {
    w.writeUint8(DOUBLE);
    w.writeFloat64(val);
  }
}
function writeInt(val, w, mt) {
  const [pos, neg] = cborAbs(val);
  if (neg && mt) {
    throw new TypeError(`Negative size: ${val}`);
  }
  mt ??= neg ? MT.NEG_INT : MT.POS_INT;
  mt <<= 5;
  if (pos < 24) {
    w.writeUint8(mt | pos);
  } else if (pos <= 255) {
    w.writeUint8(mt | NUMBYTES.ONE);
    w.writeUint8(pos);
  } else if (pos <= 65535) {
    w.writeUint8(mt | NUMBYTES.TWO);
    w.writeUint16(pos);
  } else if (pos <= 4294967295) {
    w.writeUint8(mt | NUMBYTES.FOUR);
    w.writeUint32(pos);
  } else {
    w.writeUint8(mt | NUMBYTES.EIGHT);
    w.writeBigUint64(BigInt(pos));
  }
}
function writeTag(tag, w, opts) {
  if (typeof tag === "number") {
    writeInt(tag, w, MT.TAG);
  } else if (typeof tag === "object" && !opts.ignoreOriginalEncoding && SYMS.ENCODED in tag) {
    w.write(tag[SYMS.ENCODED]);
  } else if (tag <= Number.MAX_SAFE_INTEGER) {
    writeInt(Number(tag), w, MT.TAG);
  } else {
    w.writeUint8(MT.TAG << 5 | NUMBYTES.EIGHT);
    w.writeBigUint64(BigInt(tag));
  }
}
function writeBigInt(val, w, opts) {
  const [pos, neg] = cborAbs(val);
  if (opts.collapseBigInts && (!opts.largeNegativeAsBigInt || val >= -0x8000000000000000n)) {
    if (pos <= 0xffffffffn) {
      writeInt(Number(val), w);
      return;
    }
    if (pos <= 0xffffffffffffffffn) {
      const mt = (neg ? MT.NEG_INT : MT.POS_INT) << 5;
      w.writeUint8(mt | NUMBYTES.EIGHT);
      w.writeBigUint64(pos);
      return;
    }
  }
  if (opts.rejectBigInts) {
    throw new Error(`Attempt to encode unwanted bigint: ${val}`);
  }
  const tag = neg ? TAG.NEG_BIGINT : TAG.POS_BIGINT;
  const s = pos.toString(16);
  const z = s.length % 2 ? "0" : "";
  writeTag(tag, w, opts);
  const buf = hexToU8(z + s);
  writeInt(buf.length, w, MT.BYTE_STRING);
  w.write(buf);
}
function writeNumber(val, w, opts) {
  if (opts.flushToZero) {
    val = flushToZero(val);
  }
  if (Object.is(val, -0)) {
    if (opts.simplifyNegativeZero) {
      if (opts.avoidInts) {
        writeFloat(0, w, opts);
      } else {
        writeInt(0, w);
      }
    } else {
      writeFloat(val, w, opts);
    }
  } else if (!opts.avoidInts && Number.isSafeInteger(val)) {
    writeInt(val, w);
  } else if (opts.reduceUnsafeNumbers && Math.floor(val) === val && val >= DCBOR_INT.MIN && val <= DCBOR_INT.MAX) {
    writeBigInt(BigInt(val), w, opts);
  } else {
    writeFloat(val, w, opts);
  }
}
function writeString(val, w, opts) {
  const s = opts.stringNormalization ? val.normalize(opts.stringNormalization) : val;
  if (opts.wtf8 && !val.isWellFormed()) {
    const wtf8 = WE.encode(s);
    writeTag(TAG.WTF8, w, opts);
    writeInt(wtf8.length, w, MT.BYTE_STRING);
    w.write(wtf8);
  } else {
    const utf8 = TE.encode(s);
    writeInt(utf8.length, w, MT.UTF8_STRING);
    w.write(utf8);
  }
}
function writeArray(obj, w, opts) {
  const a = obj;
  writeLength(a, a.length, MT.ARRAY, w, opts);
  for (const i of a) {
    writeUnknown(i, w, opts);
  }
}
function writeUint8Array(u, w) {
  writeInt(u.length, w, MT.BYTE_STRING);
  w.write(u);
}
var TYPES = new TypeEncoderMap();
TYPES.registerEncoder(Array, writeArray);
TYPES.registerEncoder(Uint8Array, writeUint8Array);
function writeLength(obj, len, mt, w, opts) {
  const enc = getEncodedLength(obj);
  if (enc && !opts.ignoreOriginalEncoding) {
    w.write(enc);
  } else {
    writeInt(len, w, mt);
  }
}
function writeObject(obj, w, opts) {
  if (obj === null) {
    w.writeUint8(NULL);
    return;
  }
  if (!opts.ignoreOriginalEncoding && SYMS.ENCODED in obj) {
    w.write(obj[SYMS.ENCODED]);
    return;
  }
  const constructor = obj.constructor;
  if (constructor) {
    const encoder = opts.types?.get(constructor) ?? (opts.ignoreGlobalTags ? void 0 : TYPES.get(constructor));
    if (encoder) {
      const res = encoder(obj, w, opts);
      if (res !== void 0) {
        if (!Array.isArray(res) || res.length !== 2) {
          throw new Error("Invalid encoder return value");
        }
        if (typeof res[0] === "bigint" || isFinite(Number(res[0]))) {
          writeTag(res[0], w, opts);
        }
        writeUnknown(res[1], w, opts);
      }
      return;
    }
  }
  if (typeof obj.toCBOR === "function") {
    const res = obj.toCBOR(w, opts);
    if (res) {
      if (typeof res[0] === "bigint" || isFinite(Number(res[0]))) {
        writeTag(res[0], w, opts);
      }
      writeUnknown(res[1], w, opts);
    }
    return;
  }
  if (typeof obj.toJSON === "function") {
    writeUnknown(obj.toJSON(), w, opts);
    return;
  }
  const entries = Object.entries(obj).map(
    // Circular
    (e) => [e[0], e[1], encode(e[0], opts)]
  );
  if (opts.sortKeys) {
    entries.sort(opts.sortKeys);
  }
  writeLength(obj, entries.length, MT.MAP, w, opts);
  for (const [_k, v, e] of entries) {
    w.write(e);
    writeUnknown(v, w, opts);
  }
}
function writeSymbol(sym, w, opts) {
  if (!sym.description || sym !== Symbol.for(sym.description)) {
    throw new TypeError(`Private or empty symbol: ${sym.toString()}`);
  }
  writeTag(280, w, opts);
  writeString(sym.description, w, opts);
}
function writeUnknown(val, w, opts) {
  switch (typeof val) {
    case "number":
      writeNumber(val, w, opts);
      break;
    case "bigint":
      writeBigInt(val, w, opts);
      break;
    case "string":
      writeString(val, w, opts);
      break;
    case "boolean":
      w.writeUint8(val ? TRUE : FALSE);
      break;
    case "undefined":
      if (opts.rejectUndefined) {
        throw new Error("Attempt to encode unwanted undefined.");
      }
      w.writeUint8(UNDEFINED);
      break;
    case "object":
      writeObject(val, w, opts);
      break;
    case "symbol":
      writeSymbol(val, w, opts);
      break;
    default:
      throw new TypeError(`Unknown type: ${typeof val}, ${String(val)}`);
  }
}
function encode(val, options = {}) {
  const opts = { ...defaultEncodeOptions };
  if (options.dcbor) {
    Object.assign(opts, dcborEncodeOptions);
  } else if (options.cde) {
    Object.assign(opts, cdeEncodeOptions);
  }
  Object.assign(opts, options);
  const w = new Writer(opts);
  writeUnknown(val, w, opts);
  return w.read();
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/simple.js
var Simple = class _Simple {
  static KnownSimple = /* @__PURE__ */ new Map([
    [SIMPLE.FALSE, false],
    [SIMPLE.TRUE, true],
    [SIMPLE.NULL, null],
    [SIMPLE.UNDEFINED, void 0]
  ]);
  value;
  constructor(value) {
    this.value = value;
  }
  static create(num) {
    if (!_Simple.KnownSimple.has(num)) {
      return new _Simple(num);
    }
    return _Simple.KnownSimple.get(num);
  }
  toCBOR(w, opts) {
    if (opts.rejectCustomSimples) {
      throw new Error(`Cannot encode non-standard Simple value: ${this.value}`);
    }
    writeInt(this.value, w, MT.SIMPLE_FLOAT);
  }
  toString() {
    return `simple(${this.value})`;
  }
  /**
   * Convert this simple value to a useful data type, if possible.
   *
   * @returns The converted value.
   */
  decode() {
    if (!_Simple.KnownSimple.has(this.value)) {
      return this;
    }
    return _Simple.KnownSimple.get(this.value);
  }
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](_depth, inspectOptions, inspect) {
    return `simple(${inspect(this.value, inspectOptions)})`;
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/decodeStream.js
var TD = new TextDecoder("utf8", { fatal: true, ignoreBOM: true });
var DecodeStream = class _DecodeStream {
  static defaultOptions = {
    maxDepth: 1024,
    encoding: "hex",
    requirePreferred: false
  };
  #src;
  #view;
  #offset = 0;
  #opts;
  constructor(src, opts) {
    this.#opts = {
      ..._DecodeStream.defaultOptions,
      ...opts
    };
    if (typeof src === "string") {
      switch (this.#opts.encoding) {
        case "hex":
          this.#src = hexToU8(src);
          break;
        case "base64":
          this.#src = base64ToBytes(src);
          break;
        default:
          throw new TypeError(`Encoding not implemented: "${this.#opts.encoding}"`);
      }
    } else {
      this.#src = src;
    }
    this.#view = new DataView(this.#src.buffer, this.#src.byteOffset, this.#src.byteLength);
  }
  /**
   * Get the chunk of this stream from the given position to the current offset.
   *
   * @param begin Position to read from.  Should be <= current offset.
   * @returns Subarray of input stream (not copy).
   */
  toHere(begin) {
    return subarrayRanges(this.#src, begin, this.#offset);
  }
  /**
   * Get the stream of events describing the CBOR item.  Yields Value tuples.
   *
   * @throws On invalid input or extra data in input.
   * @yields MtAiValue for each value in the stream.
   * @example
   * ```js
   * const s = new DecodeStream(buffer);
   * for (const [majorType, additionalInfo, value] of s) {
   *  ...
   * }
   * ```
   */
  *[Symbol.iterator]() {
    yield* this.#nextVal(0);
    if (this.#offset !== this.#src.length) {
      throw new Error("Extra data in input");
    }
  }
  /**
   * Get a stream of events describing all CBOR items in the input CBOR Sequence
   * consisting of multiple CBOR items. Yields Value tuples.
   *
   * Note that this includes items indicating the start of an array or map, and
   * the end of an indefinite-length item, and tag numbers separate from the tag
   * content. Does not guarantee that the input is valid.
   *
   * Will attempt to read all items in an array or map, even if indefinite.
   * Throws when there is insufficient data to do so. The same applies when
   * reading tagged items, byte strings and text strings.
   *
   * @throws On insufficient data.
   * @yields MtAiValue for each value in the sequence.
   * @example
   * ```js
   * const s = new DecodeStream(buffer);
   * for (const [majorType, additionalInfo, value] of s.seq()) {
   *  ...
   * }
   * ```
   */
  *seq() {
    while (this.#offset < this.#src.length) {
      yield* this.#nextVal(0);
    }
  }
  /**
   * Get the next CBOR value from the input stream.  Yields Value tuples.
   *
   * @param depth The current depth in the CBOR tree.
   * @throws Maximum depth exceeded, invalid input.
   * @yields Information about every sub-item found in the input.
   */
  *#nextVal(depth) {
    if (depth++ > this.#opts.maxDepth) {
      throw new Error(`Maximum depth ${this.#opts.maxDepth} exceeded`);
    }
    const prevOffset = this.#offset;
    const octet = this.#view.getUint8(this.#offset++);
    const mt = octet >> 5;
    const ai = octet & 31;
    let val = ai;
    let simple = false;
    let len = 0;
    switch (ai) {
      case NUMBYTES.ONE:
        len = 1;
        val = this.#view.getUint8(this.#offset);
        if (mt === MT.SIMPLE_FLOAT) {
          if (val < 32) {
            throw new Error(`Invalid simple encoding in extra byte: ${val}`);
          }
          simple = true;
        } else if (this.#opts.requirePreferred && val < 24) {
          throw new Error(`Unexpectedly long integer encoding (1) for ${val}`);
        }
        break;
      case NUMBYTES.TWO:
        len = 2;
        if (mt === MT.SIMPLE_FLOAT) {
          val = parseHalf(this.#src, this.#offset);
        } else {
          val = this.#view.getUint16(this.#offset, false);
          if (this.#opts.requirePreferred && val <= 255) {
            throw new Error(`Unexpectedly long integer encoding (2) for ${val}`);
          }
        }
        break;
      case NUMBYTES.FOUR:
        len = 4;
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat32(this.#offset, false);
        } else {
          val = this.#view.getUint32(this.#offset, false);
          if (this.#opts.requirePreferred && val <= 65535) {
            throw new Error(`Unexpectedly long integer encoding (4) for ${val}`);
          }
        }
        break;
      case NUMBYTES.EIGHT: {
        len = 8;
        if (mt === MT.SIMPLE_FLOAT) {
          val = this.#view.getFloat64(this.#offset, false);
        } else {
          val = this.#view.getBigUint64(this.#offset, false);
          if (val <= Number.MAX_SAFE_INTEGER) {
            val = Number(val);
          }
          if (this.#opts.requirePreferred && val <= 4294967295) {
            throw new Error(`Unexpectedly long integer encoding (8) for ${val}`);
          }
        }
        break;
      }
      case 28:
      case 29:
      case 30:
        throw new Error(`Additional info not implemented: ${ai}`);
      case NUMBYTES.INDEFINITE:
        switch (mt) {
          case MT.POS_INT:
          case MT.NEG_INT:
          case MT.TAG:
            throw new Error(`Invalid indefinite encoding for MT ${mt}`);
          case MT.SIMPLE_FLOAT:
            yield [mt, ai, SYMS.BREAK, prevOffset, 0];
            return;
        }
        val = Infinity;
        break;
      default:
        simple = true;
    }
    this.#offset += len;
    switch (mt) {
      case MT.POS_INT:
        yield [mt, ai, val, prevOffset, len];
        break;
      case MT.NEG_INT:
        yield [mt, ai, typeof val === "bigint" ? -1n - val : -1 - Number(val), prevOffset, len];
        break;
      case MT.BYTE_STRING:
        if (val === Infinity) {
          yield* this.#stream(mt, depth, prevOffset);
        } else {
          yield [mt, ai, this.#read(val), prevOffset, val];
        }
        break;
      case MT.UTF8_STRING:
        if (val === Infinity) {
          yield* this.#stream(mt, depth, prevOffset);
        } else {
          yield [mt, ai, TD.decode(this.#read(val)), prevOffset, val];
        }
        break;
      case MT.ARRAY:
        if (val === Infinity) {
          yield* this.#stream(mt, depth, prevOffset, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval, prevOffset, len];
          for (let i = 0; i < nval; i++) {
            yield* this.#nextVal(depth + 1);
          }
        }
        break;
      case MT.MAP:
        if (val === Infinity) {
          yield* this.#stream(mt, depth, prevOffset, false);
        } else {
          const nval = Number(val);
          yield [mt, ai, nval, prevOffset, len];
          for (let i = 0; i < nval; i++) {
            yield* this.#nextVal(depth);
            yield* this.#nextVal(depth);
          }
        }
        break;
      case MT.TAG:
        yield [mt, ai, val, prevOffset, len];
        yield* this.#nextVal(depth);
        break;
      case MT.SIMPLE_FLOAT: {
        const oval = val;
        if (simple) {
          val = Simple.create(Number(val));
        }
        yield [mt, ai, val, prevOffset, oval];
        break;
      }
    }
  }
  #read(size) {
    const a = subarrayRanges(this.#src, this.#offset, this.#offset += size);
    if (a.length !== size) {
      throw new Error(`Unexpected end of stream reading ${size} bytes, got ${a.length}`);
    }
    return a;
  }
  *#stream(mt, depth, prevOffset, check = true) {
    yield [mt, NUMBYTES.INDEFINITE, Infinity, prevOffset, Infinity];
    while (true) {
      const child = this.#nextVal(depth);
      const first = child.next();
      const [nmt, ai, val] = first.value;
      if (val === SYMS.BREAK) {
        yield first.value;
        child.next();
        return;
      }
      if (check) {
        if (nmt !== mt) {
          throw new Error(`Unmatched major type.  Expected ${mt}, got ${nmt}.`);
        }
        if (ai === NUMBYTES.INDEFINITE) {
          throw new Error("New stream started in typed stream");
        }
      }
      yield first.value;
      yield* child;
    }
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/options.js
var DiagnosticSizes;
(function(DiagnosticSizes2) {
  DiagnosticSizes2[DiagnosticSizes2["NEVER"] = -1] = "NEVER";
  DiagnosticSizes2[DiagnosticSizes2["PREFERRED"] = 0] = "PREFERRED";
  DiagnosticSizes2[DiagnosticSizes2["ALWAYS"] = 1] = "ALWAYS";
})(DiagnosticSizes || (DiagnosticSizes = {}));

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/cbor2/lib/container.js
var LENGTH_FOR_AI = /* @__PURE__ */ new Map([
  [NUMBYTES.ZERO, 1],
  [NUMBYTES.ONE, 2],
  [NUMBYTES.TWO, 3],
  [NUMBYTES.FOUR, 5],
  [NUMBYTES.EIGHT, 9]
]);
var EMPTY_BUF = new Uint8Array(0);
function createObject(kve, opts) {
  return !opts.boxed && !opts.preferMap && kve.every(([k]) => typeof k === "string") ? Object.fromEntries(kve) : new Map(kve);
}
var CBORcontainer = class _CBORcontainer {
  static defaultDecodeOptions = {
    ...DecodeStream.defaultOptions,
    ParentType: _CBORcontainer,
    boxed: false,
    cde: false,
    dcbor: false,
    diagnosticSizes: DiagnosticSizes.PREFERRED,
    collapseBigInts: false,
    convertUnsafeIntsToFloat: false,
    createObject,
    keepNanPayloads: false,
    maxBigIntBytes: 1e4,
    pretty: false,
    preferBigInt: false,
    preferMap: false,
    rejectLargeNegatives: false,
    rejectBigInts: false,
    rejectDuplicateKeys: false,
    rejectFloats: false,
    rejectInts: false,
    rejectLongLoundNaN: false,
    rejectLongFloats: false,
    rejectNegativeZero: false,
    rejectSimple: false,
    rejectStreaming: false,
    rejectStringsNotNormalizedAs: null,
    rejectSubnormals: false,
    rejectUndefined: false,
    rejectUnsafeFloatInts: false,
    saveOriginal: false,
    sortKeys: null,
    tags: null,
    ignoreGlobalTags: false
  };
  /**
   * Throw errors when decoding for bytes that were not encoded with {@link
   * https://www.ietf.org/archive/id/draft-ietf-cbor-cde-05.html CBOR Common
   * Deterministic Encoding Profile}.
   *
   * CDE does not mandate this checking, so it is up to the application
   * whether it wants to ensure that inputs were not encoded incompetetently
   * or maliciously.  To turn all of these on at once, set the cbor option to
   * true.
   */
  static cdeDecodeOptions = {
    cde: true,
    rejectStreaming: true,
    requirePreferred: true,
    sortKeys: sortCoreDeterministic
  };
  /**
   * Throw errors when decoding for bytes that were not encoded with {@link
   * https://www.ietf.org/archive/id/draft-mcnally-deterministic-cbor-11.html
   * dCBOR: A Deterministic CBOR Application Profile}.
   *
   * The dCBOR spec mandates that these errors be thrown when decoding dCBOR.
   * Turn this on by setting the `dcbor` option to true, which also enables
   * `cde` mode.
   */
  static dcborDecodeOptions = {
    ...this.cdeDecodeOptions,
    dcbor: true,
    convertUnsafeIntsToFloat: true,
    rejectDuplicateKeys: true,
    rejectLargeNegatives: true,
    rejectLongLoundNaN: true,
    rejectLongFloats: true,
    rejectNegativeZero: true,
    rejectSimple: true,
    rejectUndefined: true,
    rejectUnsafeFloatInts: true,
    rejectStringsNotNormalizedAs: "NFC"
  };
  parent;
  mt;
  ai;
  left;
  offset;
  count = 0;
  children = [];
  depth = 0;
  #opts;
  #encodedChildren = null;
  // Only call new from create() and super().
  constructor(mav, left, parent, opts) {
    [this.mt, this.ai, , this.offset] = mav;
    this.left = left;
    this.parent = parent;
    this.#opts = opts;
    if (parent) {
      this.depth = parent.depth + 1;
    }
    if (this.mt === MT.MAP) {
      if (this.#opts.sortKeys || this.#opts.rejectDuplicateKeys) {
        this.#encodedChildren = [];
      }
    }
    if (this.#opts.rejectStreaming && this.ai === NUMBYTES.INDEFINITE) {
      throw new Error("Streaming not supported");
    }
  }
  get isStreaming() {
    return this.left === Infinity;
  }
  get done() {
    return this.left === 0;
  }
  /**
   * Factory method that returns the given ParentType if the mt/ai dictate
   * that is necessary, otherwise returns the given value.
   *
   * @param mav Major Type, Additional Information, and Associated value from
   *   token.
   * @param parent If this item is inside another item, the direct parent.
   * @param opts Options controlling creation.
   * @param stream The stream being decoded from.
   * @returns ParentType instance or value.
   * @throws Invalid major type, which should only occur from tests.
   */
  static create(mav, parent, opts, stream) {
    const [mt, ai, value, offset] = mav;
    switch (mt) {
      case MT.POS_INT:
      case MT.NEG_INT: {
        if (opts.rejectInts) {
          throw new Error(`Unexpected integer: ${value}`);
        }
        if (opts.rejectLargeNegatives && value < -0x8000000000000000n) {
          throw new Error(`Invalid 65bit negative number: ${value}`);
        }
        let val = value;
        if (opts.preferBigInt) {
          val = BigInt(val);
        } else if (opts.convertUnsafeIntsToFloat && val >= DCBOR_INT.MIN && val <= DCBOR_INT.MAX) {
          val = Number(value);
        }
        if (opts.boxed) {
          return box(val, stream.toHere(offset));
        }
        return val;
      }
      case MT.SIMPLE_FLOAT:
        if (ai > NUMBYTES.ONE) {
          if (typeof value === "symbol") {
            return value;
          }
          if (opts.rejectFloats) {
            throw new Error(`Decoding unwanted floating point number: ${value}`);
          }
          if (opts.rejectNegativeZero && Object.is(value, -0)) {
            throw new Error("Decoding negative zero");
          }
          if (isNaN(value)) {
            const buf = stream.toHere(offset);
            const val = new NAN(buf);
            if (opts.rejectLongLoundNaN) {
              if (val.payload || buf.length > 3) {
                throw new Error(`Invalid NaN encoding: "${u8toHex(buf)}"`);
              }
            } else if (opts.keepNanPayloads) {
              if (val.payload || val.sign === -1) {
                if (opts.rejectLongFloats && !val.isShortestEncoding) {
                  throw new Error(`NaN should have been encoded shorter: ${value}`);
                }
                return val;
              }
            }
          }
          if (opts.rejectSubnormals) {
            checkSubnormal(stream.toHere(offset + 1));
          }
          if (opts.rejectLongFloats) {
            const buf = encode(value, {
              chunkSize: 9,
              reduceUnsafeNumbers: opts.rejectUnsafeFloatInts
            });
            if (buf[0] >> 5 !== mt) {
              throw new Error(`Should have been encoded as int, not float: ${value}`);
            }
            if (buf.length < LENGTH_FOR_AI.get(ai)) {
              throw new Error(`Number should have been encoded shorter: ${value}`);
            }
          }
          if (typeof value === "number" && opts.boxed) {
            return box(value, stream.toHere(offset));
          }
        } else {
          if (opts.rejectSimple) {
            if (value instanceof Simple) {
              throw new Error(`Invalid simple value: ${value}`);
            }
          }
          if (opts.rejectUndefined) {
            if (value === void 0) {
              throw new Error("Unexpected undefined");
            }
          }
        }
        return value;
      case MT.BYTE_STRING:
      case MT.UTF8_STRING:
        if (value === Infinity) {
          return new opts.ParentType(mav, Infinity, parent, opts);
        }
        if (opts.rejectStringsNotNormalizedAs && typeof value === "string") {
          const n = value.normalize(opts.rejectStringsNotNormalizedAs);
          if (value !== n) {
            throw new Error(`String not normalized as "${opts.rejectStringsNotNormalizedAs}", got [${stringToHex(value)}] instead of [${stringToHex(n)}]`);
          }
        }
        if (opts.boxed) {
          return box(value, stream.toHere(offset));
        }
        return value;
      case MT.ARRAY:
        return new opts.ParentType(mav, value, parent, opts);
      case MT.MAP:
        return new opts.ParentType(mav, value * 2, parent, opts);
      case MT.TAG: {
        const ret = new opts.ParentType(mav, 1, parent, opts);
        ret.children = new Tag(value);
        return ret;
      }
    }
    throw new TypeError(`Invalid major type: ${mt}`);
  }
  static decodeToEncodeOpts(decode2) {
    return {
      ...defaultEncodeOptions,
      avoidInts: decode2.rejectInts,
      float64: !decode2.rejectLongFloats,
      flushToZero: decode2.rejectSubnormals,
      largeNegativeAsBigInt: decode2.rejectLargeNegatives,
      sortKeys: decode2.sortKeys
    };
  }
  /**
   * Add the given child to the list of children, and update how many are
   * still needed.
   *
   * @param child Any child item.
   * @param stream Stream being read from.
   * @param offset Offset of start of child in stream.
   * @returns The number of items still needed.
   */
  push(child, stream, offset) {
    this.children.push(child);
    if (this.#encodedChildren) {
      const buf = getEncoded(child) || stream.toHere(offset);
      this.#encodedChildren.push(buf);
    }
    return --this.left;
  }
  /**
   * Replace the last child with this one.  Usually after having called
   * convert on the most recent child.
   *
   * @param child New child value.
   * @param item The key or value container.  Used to check for dups.
   * @param stream The stream being read from.
   * @returns Previous child value.
   * @throws Duplicate key.
   */
  replaceLast(child, item, stream) {
    let ret = void 0;
    let last = -Infinity;
    if (this.children instanceof Tag) {
      last = 0;
      ret = this.children.contents;
      this.children.contents = child;
    } else {
      last = this.children.length - 1;
      ret = this.children[last];
      this.children[last] = child;
    }
    if (this.#encodedChildren) {
      const buf = getEncoded(child) || stream.toHere(item.offset);
      this.#encodedChildren[last] = buf;
    }
    return ret;
  }
  /**
   * Converts the childen to the most appropriate form known.
   *
   * @param stream Stream that we are reading from.
   * @returns Anything BUT a CBORcontainer.
   * @throws Invalid major type.  Only possible in testing.
   */
  convert(stream) {
    let ret = void 0;
    switch (this.mt) {
      case MT.ARRAY:
        ret = this.children;
        break;
      case MT.MAP: {
        const pu = this.#pairs();
        if (this.#opts.sortKeys) {
          let lastKey = void 0;
          for (const kve of pu) {
            if (lastKey) {
              if (this.#opts.sortKeys(lastKey, kve) >= 0) {
                throw new Error(`Duplicate or out of order key: "0x${kve[2]}"`);
              }
            }
            lastKey = kve;
          }
        } else if (this.#opts.rejectDuplicateKeys) {
          const ks = /* @__PURE__ */ new Set();
          for (const [_k, _v, e] of pu) {
            const hex = u8toHex(e);
            if (ks.has(hex)) {
              throw new Error(`Duplicate key: "0x${hex}"`);
            }
            ks.add(hex);
          }
        }
        ret = this.#opts.createObject(pu, this.#opts);
        break;
      }
      case MT.BYTE_STRING: {
        return u8concat(this.children);
      }
      case MT.UTF8_STRING: {
        const str = this.children.join("");
        ret = this.#opts.boxed ? box(str, stream.toHere(this.offset)) : str;
        break;
      }
      case MT.TAG:
        ret = this.children.decode(this.#opts);
        break;
      default:
        throw new TypeError(`Invalid mt on convert: ${this.mt}`);
    }
    if (this.#opts.saveOriginal && ret && typeof ret === "object") {
      saveEncoded(ret, stream.toHere(this.offset));
    }
    return ret;
  }
  #pairs() {
    const ary = this.children;
    const len = ary.length;
    if (len % 2) {
      throw new Error("Missing map value");
    }
    const ret = new Array(len / 2);
    if (this.#encodedChildren) {
      for (let i = 0; i < len; i += 2) {
        ret[i >> 1] = [ary[i], ary[i + 1], this.#encodedChildren[i]];
      }
    } else {
      for (let i = 0; i < len; i += 2) {
        ret[i >> 1] = [ary[i], ary[i + 1], EMPTY_BUF];
      }
    }
    return ret;
  }
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/cryptographic-computer-data-engineering-services-section/src/portable-sha256.mjs
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var H0 = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
function rotr(x, n) {
  return x >>> n | x << 32 - n;
}
var nativeCrypto = globalThis.process?.getBuiltinModule?.("node:crypto");
function sha256Bytes(bytes) {
  if (nativeCrypto !== void 0) return nativeCrypto.createHash("sha256").update(bytes).digest("hex");
  return portableSha256Bytes(bytes);
}
function portableSha256Bytes(bytes) {
  const bitLen = bytes.length * 8;
  const padLen = (bytes.length + 8 >> 6) + 1 << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 128;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 4294967296), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  const h = H0.slice();
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K[i] + w[i] | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj | 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
    h[5] = h[5] + f | 0;
    h[6] = h[6] + g | 0;
    h[7] = h[7] + hh | 0;
  }
  let hex = "";
  for (const word of h) hex += (word >>> 0).toString(16).padStart(8, "0");
  return hex;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/uri-engineering-services-section/src/ni-uri.mjs
function base64url(bytes) {
  let text2 = "";
  for (const byte of bytes) text2 += String.fromCharCode(byte);
  return btoa(text2).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64url(value) {
  const text2 = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(text2, (character) => character.charCodeAt(0));
}
function sha256(bytes) {
  const hex = sha256Bytes(bytes);
  return Uint8Array.from(hex.match(/../g), (pair) => Number.parseInt(pair, 16));
}
var NI_PREFIX = "ni:///sha-256;";
var NI_URI_PATTERN = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
function byteString(value) {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError("ni URI input must be a Uint8Array");
  }
  return value;
}
function digestBytes(value) {
  if (typeof value !== "string" || !NI_URI_PATTERN.test(value)) return null;
  const encoded = value.slice(NI_PREFIX.length);
  const digest = fromBase64url(encoded);
  return digest.length === 32 && base64url(digest) === encoded ? digest : null;
}
function makeNiUri(bytes) {
  const digest = base64url(sha256(byteString(bytes)));
  return `${NI_PREFIX}${digest}`;
}
function isNiUri(value) {
  return digestBytes(value) !== null;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/cryptographic-computer-data-engineering-services-section/src/portable-bytes.mjs
var HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));
var ownedBytes = (bytes) => globalThis.Buffer ? globalThis.Buffer.from(bytes) : Uint8Array.from(bytes);
function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return false;
  return true;
}
function bytesCompare(left, right) {
  const shared = Math.min(left.length, right.length);
  for (let index = 0; index < shared; index += 1) if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/cbor-engineering-services-section/src/cbor.mjs
var OPTIONS = Object.freeze({ ...defaultEncodeOptions, simplifyNegativeZero: true, ignoreOriginalEncoding: true, ignoreGlobalTags: true });
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function unsigned(value) {
  const integer = typeof value === "bigint" ? value : BigInt(value);
  if (integer < 0n || integer > 0xffffffffffffffffn) fail("non-canonical-cbor", "CBOR argument is outside the CBOR uint64 profile");
  return integer;
}
function encode2(value) {
  const writer = new Writer(), ancestors = /* @__PURE__ */ new Set(), stack = [{ value }];
  while (stack.length) {
    const item = stack.pop();
    if (item.exit) {
      ancestors.delete(item.value);
      continue;
    }
    if (item.bytes) {
      writer.write(item.bytes);
      continue;
    }
    const member = item.value;
    if (member instanceof Tag) fail("non-canonical-cbor", "CBOR tags are outside the supported CBOR codec profile");
    if (member instanceof Uint8Array) {
      writeUint8Array(member, writer);
      continue;
    }
    if (Array.isArray(member) || member && Object.getPrototypeOf(member) === Object.prototype) {
      if (ancestors.has(member)) fail("non-canonical-cbor", "cyclic CBOR carrier");
      ancestors.add(member);
      stack.push({ exit: true, value: member });
      if (Array.isArray(member)) {
        writeInt(member.length, writer, 4);
        for (let index = member.length - 1; index >= 0; index--) stack.push({ value: member[index] });
      } else {
        const entries = Object.entries(member).filter(([, entry]) => entry !== void 0).map(([key, entry]) => ({ bytes: encode2(key), value: entry })).sort((left, right) => bytesCompare(left.bytes, right.bytes));
        writeInt(entries.length, writer, 5);
        for (let index = entries.length - 1; index >= 0; index--) {
          stack.push({ value: entries[index].value });
          stack.push({ bytes: entries[index].bytes });
        }
      }
      continue;
    }
    if (typeof member === "number" && !Number.isFinite(member)) fail("non-canonical-cbor", "CBOR codec numbers must be finite");
    if (typeof member === "bigint") unsigned(member < 0n ? -1n - member : member);
    if (typeof member === "string" && !member.isWellFormed()) fail("non-canonical-cbor", "CBOR text string contains an unpaired Unicode surrogate");
    if (member !== null && !["boolean", "number", "bigint", "string"].includes(typeof member)) fail("non-canonical-cbor", `unsupported CBOR codec carrier value ${Object.prototype.toString.call(member)}`);
    writeUnknown(member, writer, OPTIONS);
  }
  return ownedBytes(writer.read());
}
function encodeCanonical(value) {
  return encode2(value);
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-content-address-engineering-services-section/src/semiotic-content-address-system.mjs
var canonicalSnapshots = /* @__PURE__ */ new WeakSet();
var retainedSnapshots = /* @__PURE__ */ new WeakSet();
var copyBytes = (value) => value.constructor === Uint8Array ? Uint8Array.from(value) : ownedBytes(value);
function canonicalizeSemioticJson(value) {
  return copyCarrier(value, true);
}
function copyCarrier(value, normalizeText) {
  let canonical2;
  const pending = [{ source: value, place: (result) => {
    canonical2 = result;
  } }];
  const open = /* @__PURE__ */ new Set();
  while (pending.length > 0) {
    const item = pending.pop();
    if (item.close) {
      open.delete(item.close);
      continue;
    }
    const { source, place } = item;
    if (typeof source === "string") {
      place(normalizeText ? source.normalize("NFC") : source);
      continue;
    }
    if (source !== null && typeof source === "object" && (canonicalSnapshots.has(source) || !normalizeText && retainedSnapshots.has(source))) {
      place(source);
      continue;
    }
    if (source instanceof Uint8Array) {
      place(copyBytes(source));
      continue;
    }
    if (source === null || typeof source === "boolean" || typeof source === "bigint") {
      place(source);
      continue;
    }
    if (typeof source === "number") {
      if (!Number.isFinite(source)) throw new TypeError("semiotic JSON numbers must be finite");
      place(source);
      continue;
    }
    if ((Array.isArray(source) || source && typeof source === "object") && open.has(source)) throw new TypeError("semiotic JSON must not be cyclic");
    if (Array.isArray(source)) {
      open.add(source);
      pending.push({ close: source });
      const result = new Array(source.length);
      place(result);
      for (let index = source.length - 1; index >= 0; index -= 1)
        pending.push({ source: source[index], place: (member) => {
          result[index] = member;
        } });
      continue;
    }
    if (source && Object.getPrototypeOf(source) === Object.prototype) {
      open.add(source);
      pending.push({ close: source });
      const result = {};
      const members = [], normalizedKeys = /* @__PURE__ */ new Set();
      for (const [key, member] of Object.entries(source)) {
        if (member === void 0) continue;
        const canonicalKey = key.normalize("NFC");
        if (normalizedKeys.has(canonicalKey)) throw new TypeError(`semiotic JSON map keys collide after NFC normalization: ${canonicalKey}`);
        normalizedKeys.add(canonicalKey);
        const retainedKey = normalizeText ? canonicalKey : key;
        Object.defineProperty(result, retainedKey, { value: void 0, enumerable: true, writable: true, configurable: true });
        members.push([retainedKey, member]);
      }
      place(result);
      for (let index = members.length - 1; index >= 0; index -= 1) {
        const [key, member] = members[index];
        pending.push({ source: member, place: (canonicalMember) => {
          result[key] = canonicalMember;
        } });
      }
      continue;
    }
    throw new TypeError(`unsupported semiotic JSON value ${Object.prototype.toString.call(source)}`);
  }
  return canonical2;
}
var frozenBytes = /* @__PURE__ */ new WeakMap();
function semanticBytes(value) {
  const memo = value !== null && typeof value === "object" && canonicalSnapshots.has(value);
  if (memo) {
    const cached = frozenBytes.get(value);
    if (cached !== void 0) return ownedBytes(cached);
  }
  const bytes = encodeCanonical(canonicalizeSemioticJson(value));
  if (memo) frozenBytes.set(value, bytes);
  return ownedBytes(bytes);
}
function semanticAddress(value) {
  const bytes = semanticBytes(value);
  return Object.freeze({ id: makeNiUri(bytes), bytes });
}
function semanticId(value) {
  return semanticAddress(value).id;
}
var isScalar = (value) => value === null || ["string", "number", "boolean"].includes(typeof value);
function coincides(left, right) {
  if (typeof left === "string" && typeof right === "string") return left === right || left.normalize("NFC") === right.normalize("NFC");
  if (isScalar(left) && isScalar(right) && typeof left !== "string" && typeof right !== "string") {
    if (typeof left === "number" && !Number.isFinite(left)) semanticBytes(left);
    if (typeof right === "number" && !Number.isFinite(right)) semanticBytes(right);
    return left === right;
  }
  return bytesEqual(semanticBytes(left), semanticBytes(right));
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/notation/forms.mjs
var SEN_FORMS = Object.freeze({
  var: { atoms: { 1: "natural" } },
  star: {},
  mark: { atoms: { 1: "text" } },
  lam: { terms: [1], binders: [1] },
  app: { terms: [1, 2] },
  pair: { terms: [1, 2] },
  fst: { terms: [1] },
  snd: { terms: [1] },
  coincide: { terms: [1, 2] },
  cond: { terms: [1, 2, 3] },
  fold: { terms: [1, 2, 3] },
  prim: { atoms: { 1: "text" }, terms: [2] },
  inl: { terms: [1], types: [2] },
  inr: { types: [1], terms: [2] },
  case: { terms: [1, 2, 3], binders: [2, 3] },
  abort: { terms: [1], types: [2] }
});
var SEN_TYPE_FORMS = Object.freeze({
  base: {},
  unit: {},
  arrow: { types: [1, 2] },
  prod: { types: [1, 2] },
  list: { types: [1] },
  empty: {},
  sum: { types: [1, 2] }
});

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/notation/schema.mjs
var atomSchemas = {
  natural: { type: "integer", minimum: 0 },
  text: { type: "string" }
};
function tuple(tag, form, references) {
  const width = 1 + Object.keys(form.atoms ?? {}).length + (form.terms?.length ?? 0) + (form.types?.length ?? 0);
  const items = Array.from({ length: width }, () => ({}));
  items[0] = { const: tag };
  for (const index of form.terms ?? [])
    items[index] = { $ref: references.term };
  for (const index of form.types ?? [])
    items[index] = { $ref: references.type };
  for (const [index, constraint] of Object.entries(form.atoms ?? {}))
    items[index] = atomSchemas[constraint];
  return {
    type: "array",
    prefixItems: items,
    minItems: width,
    maxItems: width,
    items: false
  };
}
var TySchema = {
  $id: "semiotic-expression-notation/term/ty",
  title: "SEN Ty",
  anyOf: Object.entries(SEN_TYPE_FORMS).map(
    ([tag, form]) => tuple(tag, form, { term: "#", type: "#" })
  )
};
var TmSchema = {
  $id: "semiotic-expression-notation/term/tm",
  title: "SEN Tm",
  anyOf: Object.entries(SEN_FORMS).map(
    ([tag, form]) => tuple(tag, form, { term: "#", type: "semiotic-expression-notation/term/ty" })
  )
};

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/four.mjs
var readingFamilies = Object.freeze({
  /** Relational: the knowledge order's reading, by what has been told. */
  knowledge: Object.freeze(["absurd", "potential", "active", "stable"]),
  /** Told (Dunn 1976): each point named by which of true and false it has been told. */
  told: Object.freeze(["told none", "told true", "told false", "told both"]),
  /** Logical (Belnap): the truth order's reading. */
  truth: Object.freeze(["neither", "true", "false", "both"]),
  /** Extremal: each point named by the order it is an extreme of — unknown and contested the
   *  knowledge bottom and top, denied and held the truth bottom and top. SEN's reading marks
   *  and claim sessions use these. */
  extremal: Object.freeze(["unknown", "held", "denied", "contested"])
});
var familyByName = new Map(Object.entries(readingFamilies).flatMap(([family, names]) => names.map((name) => [name, family])));
function familyOf(name) {
  const family = familyByName.get(name);
  if (family === void 0) throw new TypeError(`four: unknown reading ${String(name)}`);
  return family;
}
function readingOfSides(family, forTold, againstTold) {
  const names = readingFamilies[family];
  if (names === void 0) throw new TypeError(`four: unknown reading family ${String(family)}`);
  return names[(forTold ? 1 : 0) + (againstTold ? 2 : 0)];
}
function sidesOfReading(name) {
  const index = readingFamilies[familyOf(name)].indexOf(name);
  return Object.freeze([(index & 1) === 1, (index & 2) === 2]);
}
var samePoint = (left, right) => sidesOfReading(left).join() === sidesOfReading(right).join();
var isReading = (name, family) => familyByName.has(name) && (family === void 0 || familyByName.get(name) === family);
function sharedFamily(left, right) {
  const family = familyOf(left);
  if (familyOf(right) !== family) throw new TypeError(`four: ${left} (${family}) and ${right} (${familyOf(right)}) are named in different families`);
  return family;
}
var onReadings = (combine) => (left, right) => readingOfSides(sharedFamily(left, right), ...combine(...sidesOfReading(left), ...sidesOfReading(right)));
var knowledgeJoinReading = onReadings((lf, la, rf, ra) => [lf || rf, la || ra]);
var knowledgeMeetReading = onReadings((lf, la, rf, ra) => [lf && rf, la && ra]);
var knowledgeLeqReading = (left, right) => samePoint(knowledgeJoinReading(left, right), right);
var truthJoinReading = onReadings((lf, la, rf, ra) => [lf || rf, la && ra]);
var truthMeetReading = onReadings((lf, la, rf, ra) => [lf && rf, la || ra]);
var truthLeqReading = (left, right) => samePoint(truthJoinReading(left, right), right);
var knowledgeImplyReading = onReadings((lf, la, rf, ra) => [!lf || rf, !la || ra]);
var truthImplyReading = onReadings((lf, la, rf, ra) => [!lf || rf, !la && ra]);
var symmetricEvidenceDifferenceReading = onReadings(
  (lf, la, rf, ra) => [lf !== rf, la !== ra]
);
var negateReading = (name) => {
  const [f, a] = sidesOfReading(name);
  return readingOfSides(familyOf(name), a, f);
};
var conflateReading = (name) => {
  const [f, a] = sidesOfReading(name);
  return readingOfSides(familyOf(name), !a, !f);
};
function twistProduct({ bottom, top, one, leq, meet, join, fuse, imply }) {
  const value = (positive2, negative) => Object.freeze([positive2, negative]);
  const lift = (positive2, negative) => ({ left: a, right: b }) => value(positive2(a[0], b[0]), negative(a[1], b[1]));
  return Object.freeze({
    value,
    knowledgeBottom: value(bottom, bottom),
    knowledgeTop: value(top, top),
    truthBottom: value(bottom, top),
    truthTop: value(top, bottom),
    one: value(one, one),
    meetKnowledge: lift(meet, meet),
    joinKnowledge: lift(join, join),
    meetTruth: lift(meet, join),
    joinTruth: lift(join, meet),
    leqKnowledge: ({ left: a, right: b }) => leq(a[0], b[0]) && leq(a[1], b[1]),
    leqTruth: ({ left: a, right: b }) => leq(a[0], b[0]) && leq(b[1], a[1]),
    negate: (a) => value(a[1], a[0]),
    fuse: ({ left: a, right: b }) => value(fuse(a[0], b[0]), meet(imply(a[0], b[1]), imply(b[0], a[1]))),
    imply: ({ left: a, right: b }) => value(meet(imply(a[0], b[0]), imply(b[1], a[1])), fuse(a[0], b[1]))
  });
}
var two = twistProduct({ bottom: false, top: true, one: true, leq: (a, b) => !a || b, meet: (a, b) => a && b, join: (a, b) => a || b, fuse: (a, b) => a && b, imply: (a, b) => !a || b });
var viaTwo = (operation) => (left, right) => readingOfSides(sharedFamily(left, right), ...operation({ left: sidesOfReading(left), right: sidesOfReading(right) }));
var fusionReading = viaTwo(two.fuse);
var residuumReading = viaTwo(two.imply);
var linearUnit = (family = "knowledge") => readingOfSides(family, true, true);
var knowledgeBottom = (family = "knowledge") => readingOfSides(family, false, false);
var knowledgeTop = (family = "knowledge") => readingOfSides(family, true, true);
var truthTop = (family = "knowledge") => readingOfSides(family, true, false);
var truthBottom = (family = "knowledge") => readingOfSides(family, false, true);
var tally = (count) => {
  if (!Number.isSafeInteger(count) || count < 0)
    throw new TypeError(`four: a tally must be an exactly representable natural number, not ${String(count)}`);
  return count;
};
var record = (pos = 0, neg = 0) => Object.freeze({ pos: tally(pos), neg: tally(neg) });
var recordJoinK = (a, b) => record(Math.max(a.pos, b.pos), Math.max(a.neg, b.neg));
var recordMeetK = (a, b) => record(Math.min(a.pos, b.pos), Math.min(a.neg, b.neg));
var recordJoinT = (a, b) => record(Math.max(a.pos, b.pos), Math.min(a.neg, b.neg));
var recordMeetT = (a, b) => record(Math.min(a.pos, b.pos), Math.max(a.neg, b.neg));
var recordAdd = (a, b) => record(a.pos + b.pos, a.neg + b.neg);
var recordLeqK = (a, b) => a.pos <= b.pos && a.neg <= b.neg;
var recordLeqT = (a, b) => a.pos <= b.pos && b.neg <= a.neg;
var readingOfRecord = (r, family = "knowledge") => readingOfSides(family, r.pos > 0, r.neg > 0);
var topMass = (r) => Math.min(r.pos, r.neg);
var attestationRecord = (counts) => {
  if (counts.some((count) => !Number.isSafeInteger(count) || count < 1)) throw new TypeError("four: a distinct state is attested at least once");
  const total = counts.reduce((sum, count) => tally(sum + count), 0);
  return record(total - counts.length, Math.max(0, counts.length - 1));
};
var gaugeElementNames = Object.freeze(["id", "negation", "conflation", "double"]);
function gauge(element, name) {
  if (element === "negation") return negateReading(name);
  if (element === "conflation") return conflateReading(name);
  if (element === "double") return negateReading(conflateReading(name));
  if (element === "id") return name;
  throw new TypeError(`four: unknown gauge element ${String(element)}`);
}
var points = readingFamilies.knowledge;
function fail2(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function four(positiveEvidence, negativeEvidence) {
  if (typeof positiveEvidence !== "boolean" || typeof negativeEvidence !== "boolean") {
    fail2("malformed-four", "FOUR requires explicit Boolean positiveEvidence and negativeEvidence bits");
  }
  return Object.freeze({ positiveEvidence, negativeEvidence });
}
var wireOfReading = (name) => four(...sidesOfReading(name));
var FOUR = Object.freeze(Object.fromEntries(readingFamilies.truth.map((name) => [name, wireOfReading(name)])));
var obsmetrologiaRealization = Object.freeze({
  "Obsmetrologia.Articulating.Corner.toStatus": sidesOfReading,
  "Obsmetrologia.Reading.kBot": () => knowledgeBottom(),
  "Obsmetrologia.Reading.kTop": () => knowledgeTop(),
  "Obsmetrologia.Reading.tTop": () => truthTop(),
  "Obsmetrologia.Reading.tBot": () => truthBottom(),
  "Obsmetrologia.Reading.joinK": knowledgeJoinReading,
  "Obsmetrologia.Reading.meetK": knowledgeMeetReading,
  "Obsmetrologia.Reading.joinT": truthJoinReading,
  "Obsmetrologia.Reading.meetT": truthMeetReading,
  "Obsmetrologia.Reading.leK": knowledgeLeqReading,
  "Obsmetrologia.Reading.leT": truthLeqReading,
  "Obsmetrologia.Reading.negate": negateReading,
  "Obsmetrologia.Reading.conflate": conflateReading,
  "Obsmetrologia.Reading.negConf": (name) => gauge("double", name),
  "Obsmetrologia.Reading.impK": knowledgeImplyReading,
  "Obsmetrologia.Positing.FiberAlgebra.Reading.impT": truthImplyReading,
  "Obsmetrologia.Order.TwistProduct.fuse": fusionReading,
  "Obsmetrologia.Order.TwistProduct.imp": residuumReading,
  "Obsmetrologia.Order.TwistProduct.one": () => linearUnit(),
  "Obsmetrologia.Record.joinK": recordJoinK,
  "Obsmetrologia.Record.meetK": recordMeetK,
  "Obsmetrologia.Record.joinT": recordJoinT,
  "Obsmetrologia.Record.meetT": recordMeetT,
  "Obsmetrologia.Record.add": recordAdd,
  "Obsmetrologia.Record.reading": (r) => readingOfRecord(r),
  "Obsmetrologia.Record.topMass": topMass,
  "Obsmetrologia.Record.leK": recordLeqK,
  "Obsmetrologia.Record.leT": recordLeqT,
  "ObsmetrologiaComputing.attestationRecord": attestationRecord
});

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/notation.mjs
var readingNames = readingFamilies.extremal;
var isReadingName = (value) => isReading(value, "extremal");
function readingCase(subject, branch) {
  function go(remaining) {
    const [name, ...rest] = remaining;
    if (name === void 0)
      throw new TypeError("readingCase: no reading names to dispatch over");
    if (rest.length === 0) return branch(name);
    return tm.cond(
      tm.coincide(subject, tm.reading(name)),
      branch(name),
      go(rest)
    );
  }
  return go(readingNames);
}
var onReadings2 = (left, right, branch) => readingCase(left, (l) => readingCase(right, (r) => branch(l, r)));
var tm = {
  var: (index) => {
    if (!Number.isInteger(index) || index < 0)
      throw new TypeError(
        `tm.var: de-Bruijn index must be a natural number: ${index}`
      );
    return Object.freeze(["var", index]);
  },
  lam: (body) => Object.freeze(["lam", body]),
  app: (fn, arg) => Object.freeze(["app", fn, arg]),
  pair: (left, right) => Object.freeze(["pair", left, right]),
  fst: (value) => Object.freeze(["fst", value]),
  snd: (value) => Object.freeze(["snd", value]),
  star: () => Object.freeze(["star"]),
  mark: (surface) => Object.freeze(["mark", surface]),
  /** Construct exactly one of the four readings: a distinguished mark, type base. */
  reading: (name) => {
    if (!isReadingName(name))
      throw new TypeError(`tm.reading: unknown reading ${String(name)}`);
    return Object.freeze(["mark", name]);
  },
  /** `true`/`false` are the truth-axis readings, held and denied. */
  bool: (value) => {
    if (typeof value !== "boolean")
      throw new TypeError(`tm.bool: expected boolean, got ${typeof value}`);
    return tm.reading(value ? "held" : "denied");
  },
  /** Whether a reading is told for: its for-side as a truth-axis boolean, total over all four
   *  readings (unlike `boolOfTerm`, which recognizes only held and denied). */
  toldFor: (value) => readingCase(value, (name) => tm.bool(sidesOfReading(name)[0])),
  /** One of the four predication-site generator morphisms (converse/subjectProjection/
   *  objectProjection/specialization) — a bare distinguishable atom with no algebra
   *  defined over it in this grammar, so a mark. */
  generator: (name) => tm.mark(name),
  /** Negation: FOUR's side swap. */
  negate: (value) => readingCase(value, (name) => tm.reading(negateReading(name))),
  /** Conflation: FOUR's complemented swap. */
  conflate: (value) => readingCase(value, (name) => tm.reading(conflateReading(name))),
  /** Complement only (negation after conflation). */
  negConf: (value) => readingCase(value, (name) => tm.reading(negateReading(conflateReading(name)))),
  joinK: (left, right) => onReadings2(left, right, (l, r) => tm.reading(knowledgeJoinReading(l, r))),
  meetK: (left, right) => onReadings2(left, right, (l, r) => tm.reading(knowledgeMeetReading(l, r))),
  joinT: (left, right) => onReadings2(left, right, (l, r) => tm.reading(truthJoinReading(l, r))),
  meetT: (left, right) => onReadings2(left, right, (l, r) => tm.reading(truthMeetReading(l, r))),
  leK: (left, right) => onReadings2(left, right, (l, r) => tm.bool(knowledgeLeqReading(l, r))),
  leT: (left, right) => onReadings2(left, right, (l, r) => tm.bool(truthLeqReading(l, r))),
  /**
   * An assoc-list search over `fold` — the object's entries are `pair(mark(key), value)`
   * spine elements; `coincide` compares keys, `cond` picks. A missing key folds to
   * `mark("null")`, not a stuck redex.
   */
  field: (key, object) => tm.fold(
    tm.lam(
      tm.lam(
        tm.cond(
          tm.coincide(tm.fst(tm.var(0)), tm.mark(JSON.stringify(key))),
          tm.snd(tm.var(0)),
          tm.var(1)
        )
      )
    ),
    tm.mark(JSON.stringify(null)),
    object
  ),
  /** Prepend one element to an array term's spine — O(1), no `fold`: just a `pair` in
   *  front of the existing spine, reusing `array`'s OWN tag (`fst`) rather than a
   *  freshly hardcoded mark. This and `reverseArray` are the two array-combination
   *  primitives this kernel has; `append` (below) is not a third — there is no general
   *  two-arbitrary-list concatenation law in Obsmetrologia's proven math for it to
   *  answer to, so it is only ever the call-site composition of these two. */
  consArray: (elem, array) => tm.pair(tm.fst(array), tm.pair(elem, tm.snd(array))),
  /** Reverse an array term — the one real `fold` either of these needs. */
  reverseArray: (array) => tm.pair(
    tm.fst(array),
    tm.fold(tm.lam(tm.lam(tm.pair(tm.var(0), tm.var(1)))), tm.star(), array)
  ),
  /**
   * Concatenate two array terms, `left` then `right` in order — not a third kernel
   * primitive with its own `fold` shape (metroplat's own kernel comment: no
   * `Cell`/`Valuation`/bilattice/`Articulating` law anywhere concatenates two lists,
   * so there is nothing for a dedicated opcode to be sound against), but exactly the
   * call-site composition its comment prescribes: `reverseArray(left)` once, then a
   * single `fold` that `consArray`s each of its elements onto `right`. Reversed-left
   * yields left's elements last-to-first, so consing them onto `right` in that order
   * rebuilds left's original order in front of right; the result carries `right`'s
   * tag, since `right` is the accumulator being grown.
   */
  append: (left, right) => tm.fold(
    tm.lam(tm.lam(tm.consArray(tm.var(0), tm.var(1)))),
    right,
    tm.reverseArray(left)
  ),
  coincide: (left, right) => Object.freeze(["coincide", left, right]),
  /** The `eq`/`cond` elementary pair (McCarthy): dispatch by comparing an opaque mark. */
  cond: (test, then, otherwise) => Object.freeze(["cond", test, then, otherwise]),
  /** Left fold over an array-encoded list: `fold f init [x₀..xₙ] = f (… (f init x₀) …) xₙ`,
   *  with `f` a curried `λacc.λelem.…`. The one structural recursion. */
  fold: (combine, init, list) => Object.freeze(["fold", combine, init, list]),
  /** A δ-rule: the named host primitive applied to `arg` (JSON in, JSON out) once `arg` is a value. */
  prim: (name, arg) => {
    if (typeof name !== "string" || name === "") throw new TypeError("tm.prim: a primitive needs a name");
    return Object.freeze(["prim", name, arg]);
  },
  /** Left injection into a finite sum; the right summand remains explicit. */
  inl: (value, rightType) => Object.freeze(["inl", value, rightType]),
  /** Right injection into a finite sum; the left summand remains explicit. */
  inr: (leftType, value) => Object.freeze(["inr", leftType, value]),
  /** Eliminate a sum. Each branch is under one de Bruijn binder for its injection value. */
  case: (subject, whenLeft, whenRight) => Object.freeze(["case", subject, whenLeft, whenRight]),
  /** Eliminate an impossible empty value into the explicit target type. */
  abort: (subject, targetType) => Object.freeze(["abort", subject, targetType])
};
function senFail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}
function senTagged(value, kind) {
  if (!Array.isArray(value) || typeof value[0] !== "string")
    senFail("malformed-sen", `${kind} must be a tagged SEN sequence`);
  return value;
}
function validateAtom(constraint, value) {
  if (constraint === "natural" && Number.isInteger(value) && value >= 0) return;
  if (constraint === "text" && typeof value === "string") return;
  senFail("malformed-sen", `invalid SEN ${constraint} atom`);
}
function validateSenType(type) {
  const pending = [{ value: type }], open = /* @__PURE__ */ new Set();
  while (pending.length) {
    const task = pending.pop();
    if (task.close) {
      open.delete(task.close);
      continue;
    }
    const current = task.value;
    senTagged(current, "type");
    if (open.has(current)) senFail("malformed-sen", "cyclic SEN type");
    open.add(current);
    pending.push({ close: current });
    const form = SEN_TYPE_FORMS[current[0]];
    if (!form || current.length !== 1 + (form.types?.length ?? 0))
      senFail("malformed-sen", `unknown or malformed SEN type tag ${current[0]}`);
    for (const index of [...form.types ?? []].reverse()) pending.push({ value: current[index] });
  }
  return type;
}
function validateSenTerm(term) {
  const pending = [{ value: term }], open = /* @__PURE__ */ new Set();
  while (pending.length > 0) {
    const task = pending.pop();
    if (task.close) {
      open.delete(task.close);
      continue;
    }
    const current = task.value;
    senTagged(current, "term");
    if (open.has(current)) senFail("malformed-sen", "cyclic SEN term");
    open.add(current);
    pending.push({ close: current });
    const form = SEN_FORMS[current[0]];
    if (!form)
      senFail("malformed-sen", `unknown or malformed SEN term tag ${current[0]}`);
    const expected = 1 + Object.keys(form.atoms ?? {}).length + (form.terms?.length ?? 0) + (form.types?.length ?? 0);
    if (current.length !== expected) senFail("malformed-sen", `malformed SEN ${current[0]}`);
    for (const [index, constraint] of Object.entries(form.atoms ?? {})) validateAtom(constraint, current[index]);
    for (const index of form.types ?? []) validateSenType(current[index]);
    for (const index of [...form.terms ?? []].reverse()) pending.push({ value: current[index] });
  }
  return term;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/json-codec.mjs
function canonicalBytes(value) {
  return JSON.stringify(value);
}
var arrayTag = "sen.json.array";
var objectTag = "sen.json.object";
var nullTag = "sen.json.null";
var booleanTag = "sen.json.boolean";
var stringTag = "sen.json.string";
var numberTag = "sen.json.number";
function listTerm(items) {
  return items.reduceRight((tail, item) => tm.pair(item, tail), tm.star());
}
var nullDescriptor = Object.freeze({ kind: "null" });
var booleanDescriptor = Object.freeze({ kind: "boolean" });
var numberDescriptor = Object.freeze({ kind: "number" });
var stringDescriptor = Object.freeze({ kind: "string" });
function jsonToTerm(value) {
  const frames = [];
  let result;
  const emit = (term) => {
    const frame = frames.at(-1);
    if (frame === void 0) {
      result = term;
      return;
    }
    if (frame.kind === "array") {
      frame.items.push(term);
      return;
    }
    frame.entries.push([frame.key, term]);
    frame.key = void 0;
  };
  traverseJson(value, {
    scalar(kind, payload) {
      if (kind === "null") emit(tm.pair(tm.mark(canonicalBytes(nullTag)), tm.star()));
      else if (kind === "boolean") emit(tm.pair(tm.mark(canonicalBytes(booleanTag)), tm.mark(payload ? "true" : "false")));
      else if (kind === "string") emit(tm.pair(tm.mark(canonicalBytes(stringTag)), tm.mark(canonicalBytes(payload))));
      else emit(tm.pair(tm.mark(canonicalBytes(numberTag)), tm.mark(canonicalBytes(payload))));
    },
    startArray() {
      frames.push({ kind: "array", items: [] });
    },
    endArray() {
      emit(tm.pair(tm.mark(canonicalBytes(arrayTag)), listTerm(frames.pop().items)));
    },
    startObject() {
      frames.push({ kind: "object", entries: [], key: void 0 });
    },
    key(key) {
      frames.at(-1).key = key;
    },
    endObject() {
      emit(tm.pair(tm.mark(canonicalBytes(objectTag)), listTerm(frames.pop().entries.map(([key, item]) => tm.pair(tm.mark(canonicalBytes(key)), item)))));
    }
  });
  return result;
}
function traverseJson(value, visitor, ancestors = /* @__PURE__ */ new Set(), path = "$") {
  const pending = [{ kind: "value", value, path }];
  let result;
  while (pending.length) {
    const task = pending.pop();
    if (task.kind === "end") {
      result = task.array ? visitor.endArray() : visitor.endObject();
      ancestors.delete(task.value);
      continue;
    }
    if (task.kind === "key") {
      visitor.key(task.key);
      continue;
    }
    if (task.kind === "item") {
      visitor.arrayItem?.(task.index);
      continue;
    }
    const value2 = task.value, path2 = task.path;
    if (value2 === null) {
      result = visitor.scalar("null");
      continue;
    }
    if (typeof value2 === "boolean" || typeof value2 === "string") {
      result = visitor.scalar(typeof value2, value2);
      continue;
    }
    if (typeof value2 === "number") {
      if (!Number.isFinite(value2) || Object.is(value2, -0)) throw new TypeError(`jsonToTerm: ${path2} must be one finite, non-negative-zero JSON number`);
      result = visitor.scalar("number", value2);
      continue;
    }
    if (typeof value2 !== "object") throw new TypeError(`jsonToTerm: ${path2} is not a JSON value`);
    if (ancestors.has(value2)) throw new TypeError(`jsonToTerm: ${path2} contains a cycle`);
    const array = Array.isArray(value2), names = Object.getOwnPropertyNames(value2);
    if (array) {
      if (Object.getOwnPropertySymbols(value2).length || names.length !== value2.length + 1 || !names.includes("length")) throw new TypeError(`jsonToTerm: ${path2} must be a dense JSON array with no extra properties`);
    } else {
      const prototype = Object.getPrototypeOf(value2);
      if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`jsonToTerm: ${path2} must be a plain JSON record`);
      if (Object.getOwnPropertySymbols(value2).length) throw new TypeError(`jsonToTerm: ${path2} must not have symbol-keyed properties`);
    }
    const keys = array ? Array.from({ length: value2.length }, (_, i) => String(i)) : names.sort();
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value2, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) throw new TypeError(`jsonToTerm: ${path2}.${key} must be one enumerable data property`);
    }
    ancestors.add(value2);
    if (array) visitor.startArray(value2.length);
    else visitor.startObject(keys.length);
    pending.push({ kind: "end", value: value2, array });
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      pending.push({ kind: "value", value: Object.getOwnPropertyDescriptor(value2, key).value, path: array ? `${path2}[${key}]` : `${path2}.${key}` });
      pending.push(array ? { kind: "item", index: i } : { kind: "key", key });
    }
  }
  return result;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/typing.mjs
function tyEqual(left, right) {
  const pending = [[left, right]];
  while (pending.length) {
    const [a, b] = pending.pop();
    if (a === b) continue;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = a.length - 1; i >= 0; i--) pending.push([a[i], b[i]]);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) return false;
  }
  return true;
}
function judgeSen(ctx, source, expected = void 0) {
  const checkedContext = ctx.map(validateSenType);
  const term = validateSenTerm(source);
  const want = expected === void 0 ? void 0 : validateSenType(expected);
  const valueType = inferClosedValueType(term);
  if (valueType !== void 0) {
    if (want === void 0) return valueType;
    if (tyEqual(valueType, want)) return true;
  }
  return judge(checkedContext, term, want);
}
function inferClosedValueType(term) {
  const pending = [{ term, next: 0 }], results = [];
  while (pending.length) {
    const frame = pending.at(-1), value = frame.term;
    if (value[0] === "mark" || value[0] === "star") {
      results.push([value[0] === "mark" ? "base" : "unit"]);
      pending.pop();
    } else if (value[0] === "pair") {
      if (frame.next < 2) {
        pending.push({ term: value[++frame.next], next: 0 });
        continue;
      }
      const right = results.pop(), left = results.pop();
      results.push(["prod", left, right]);
      pending.pop();
    } else return void 0;
  }
  return results[0];
}
function judge(ctx, term, want = void 0) {
  const infer = () => {
    switch (term[0]) {
      case "var":
        return ctx[term[1]] ?? null;
      case "star":
        return ["unit"];
      case "mark":
        return ["base"];
      case "app": {
        const fn = judge(ctx, term[1]);
        if (fn?.[0] === "arrow" && judge(ctx, term[2], fn[1])) return fn[2];
        const arg = judge(ctx, term[2]);
        if (want && arg && judge(ctx, term[1], ["arrow", arg, want]))
          return want;
        if (arg && term[1][0] === "lam") return judge([arg, ...ctx], term[1][1]);
        const args = [];
        let head = term;
        while (head[0] === "app") {
          args.unshift(head[2]);
          head = head[1];
        }
        let scope = ctx;
        for (const argument of args) {
          if (head[0] !== "lam") return null;
          const argType = judge(ctx, argument);
          if (!argType) return null;
          scope = [argType, ...scope];
          head = head[1];
        }
        return judge(scope, head);
      }
      case "pair": {
        const cons = consOfArray(ctx, term);
        if (cons !== void 0) return cons;
        const leftTypes = [];
        let cursor = term;
        while (cursor[0] === "pair") {
          const left = judge(ctx, cursor[1]);
          if (!left) return null;
          leftTypes.push(left);
          cursor = cursor[2];
        }
        let result = judge(ctx, cursor);
        if (!result) return null;
        for (let index = leftTypes.length - 1; index >= 0; index -= 1)
          result = ["prod", leftTypes[index], result];
        return result;
      }
      case "fst":
      case "snd": {
        const pair = judge(ctx, term[1]);
        return pair?.[0] === "prod" ? pair[term[0] === "fst" ? 1 : 2] : null;
      }
      case "coincide": {
        const left = judge(ctx, term[1]), right = judge(ctx, term[2]);
        return left && right && tyEqual(left, right) ? ["base"] : null;
      }
      case "cond": {
        const yes = judge(ctx, term[2]), no = judge(ctx, term[3]);
        return judge(ctx, term[1], ["base"]) && yes && no ? joinBranchTypes(yes, no) : null;
      }
      case "inl": {
        const left = judge(ctx, term[1]);
        return left ? ["sum", left, term[2]] : null;
      }
      case "inr": {
        const right = judge(ctx, term[2]);
        return right ? ["sum", term[1], right] : null;
      }
      case "case": {
        const subject = judge(ctx, term[1]);
        if (subject?.[0] !== "sum") return null;
        const left = judge([subject[1], ...ctx], term[2]);
        const right = judge([subject[2], ...ctx], term[3]);
        return left && right ? joinBranchTypes(left, right) : null;
      }
      case "abort":
        return judge(ctx, term[1], ["empty"]) ? term[2] : null;
      case "fold": {
        const element = listElementOf(judge(ctx, term[3])), initType = judge(ctx, term[2]);
        if (element === void 0 || !initType) return null;
        const initElement = listElementOf(initType);
        const accumulator = want && judge(ctx, term[2], want) ? want : initElement ? ["list", initElement] : initType;
        if (element === null) return term[1][0] === "lam" && term[1][1][0] === "lam" ? accumulator : null;
        const combines = (acc) => judge(ctx, term[1], ["arrow", acc, ["arrow", element, acc]]);
        if (combines(accumulator)) return accumulator;
        if (initElement === null && term[1][0] === "lam" && term[1][1][0] === "lam") {
          const built = judge([element, accumulator, ...ctx], term[1][1][1]);
          if (built && listElementOf(built) && combines(built)) return built;
        }
        return null;
      }
      default:
        return null;
    }
  };
  if (term[0] === "lam" && want)
    return want[0] === "arrow" && judge([want[1], ...ctx], term[1], want[2]);
  if (term[0] === "pair" && want?.[0] === "prod") {
    let value = term, expected = want;
    while (value[0] === "pair" && expected[0] === "prod") {
      if (!judge(ctx, value[1], expected[1])) return false;
      value = value[2];
      expected = expected[2];
    }
    return judge(ctx, value, expected);
  }
  if (term[0] === "inl" && want?.[0] === "sum")
    return tyEqual(term[2], want[2]) && judge(ctx, term[1], want[1]);
  if (term[0] === "inr" && want?.[0] === "sum")
    return tyEqual(term[1], want[1]) && judge(ctx, term[2], want[2]);
  if (term[0] === "case" && want) {
    const subject = judge(ctx, term[1]);
    return subject?.[0] === "sum" && judge([subject[1], ...ctx], term[2], want) && judge([subject[2], ...ctx], term[3], want);
  }
  if (want?.[0] === "list" && term[0] === "pair" && term[1][0] === "mark") {
    let spine = term[2];
    while (spine[0] === "pair") {
      if (!judge(ctx, spine[1], want[1])) return false;
      spine = spine[2];
    }
    if (spine[0] === "star") return true;
  }
  const got = infer();
  if (want === void 0) return got;
  if (got === null) return false;
  if (want[0] === "list") {
    const element = listElementOf(got);
    return element === null || element !== void 0 && tyEqual(element, want[1]);
  }
  return tyEqual(got, want);
}
function joinBranchTypes(left, right) {
  if (tyEqual(left, right)) return left;
  const leftElement = listElementOf(left), rightElement = listElementOf(right);
  if (leftElement === void 0 || rightElement === void 0) return null;
  if (leftElement === null) return rightElement === null ? left : ["list", rightElement];
  if (rightElement === null || tyEqual(leftElement, rightElement)) return ["list", leftElement];
  return null;
}
function consOfArray(ctx, term) {
  const [, tag, rest] = term;
  if (tag[0] !== "fst" || rest[0] !== "pair" || rest[2][0] !== "snd") return void 0;
  if (JSON.stringify(tag[1]) !== JSON.stringify(rest[2][1])) return void 0;
  const element = listElementOf(judge(ctx, tag[1]));
  if (element === void 0) return void 0;
  const head = judge(ctx, rest[1]);
  if (!head || element !== null && !tyEqual(head, element)) return null;
  return ["list", head];
}
function listElementOf(type) {
  if (type?.[0] === "list") return type[1];
  if (type?.[0] !== "prod" || type[1]?.[0] !== "base") return void 0;
  let element = null;
  for (let spine = type[2]; ; spine = spine[2]) {
    if (spine?.[0] === "unit") return element;
    if (spine?.[0] !== "prod") return void 0;
    if (element !== null && !tyEqual(element, spine[1])) return void 0;
    element = spine[1];
  }
}
function illTyped(message) {
  const error = new Error(message);
  error.code = "ill-typed-term";
  throw error;
}
function validateType(source) {
  return validateSenType(canonicalizeSemioticJson(source));
}
function validateTerm(source) {
  return validateSenTerm(canonicalizeSemioticJson(source));
}
function inferTerm(source, context = []) {
  return judgeSen(context.map(validateType), validateTerm(source)) ?? illTyped("term has no SEN type");
}
function checkTerm(source, expectedSource, context = []) {
  return judgeSen(context.map(validateType), validateTerm(source), validateType(expectedSource)) || illTyped("term does not have expected SEN type");
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/computer-data-engineering-services-section/src/semiotic-expression-notation/semantic-content-identity.mjs
var SEN_NORMALIZATION_PROFILE = "urn:rce:sen:normalize:0.1.0";
var IDENTITY_SETTLEMENT_PROFILE = "urn:rce:settlement:identity:0.0.1";
var SEMANTIC_ENVELOPE_KIND = "semiotic-expression-notation.normalized-semantic-content";
var SEMANTIC_ENVELOPE_VERSION = 3;
var V2_KIND = SEMANTIC_ENVELOPE_KIND;
var ENVELOPE_VERSION = SEMANTIC_ENVELOPE_VERSION;
var V2_KEYS = Object.freeze([
  "kind",
  "version",
  "objectKind",
  "semanticType",
  "normalizationProfile",
  "settlementProfile",
  "settledBody",
  "witnessRoot"
]);
var V2_SORTED_KEYS = Object.freeze([...V2_KEYS].sort());
var EMPTY_WITNESS_ROOT = semanticId({ kind: "semantic-content.empty-witness-bundle", version: 1 });
function semanticContentRefusal(code, message) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}
function inhabitsDeclaredType(term, semanticType) {
  try {
    checkTerm(term, semanticType);
    return true;
  } catch {
    return false;
  }
}
function commitmentOf(value) {
  const { id: id2, bytes } = semanticAddress(value);
  return Object.freeze({ id: id2, token: id2, algorithm: "sha-256", mediaType: "application/sen+cbor", bytes });
}
function immutableCopy(value) {
  const copyOf = (node) => node === null || typeof node !== "object" ? node : Array.isArray(node) ? new Array(node.length) : {};
  const root = copyOf(value);
  const pending = root === value ? [] : [[value, root]];
  const finished = [];
  while (pending.length > 0) {
    const [source, target] = pending.pop();
    finished.push(target);
    for (const [key, member] of Object.entries(source)) {
      const copy = copyOf(member);
      Object.defineProperty(target, key, { value: copy, enumerable: true, writable: true, configurable: true });
      if (copy !== member) pending.push([member, copy]);
    }
  }
  for (const node of finished) Object.freeze(node);
  return root;
}
function canonicalNi(value, field) {
  if (!isNiUri(value)) {
    throw semanticContentRefusal("malformed-content-address", `${field} must be one canonical RFC 6920 SHA-256 ni URI`);
  }
  return value;
}
function canonicalString(value, field) {
  if (typeof value !== "string") throw semanticContentRefusal("malformed-normalized-content", `${field} must be a finite string`);
  return value.normalize("NFC");
}
function admitSemanticEnvelope(envelope, { normalForm = void 0, typeChecked = false } = {}) {
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) {
    throw semanticContentRefusal("malformed-normalized-content", "normalized semantic content must be one envelope object");
  }
  const keys = Object.keys(envelope).sort();
  if (keys.length !== V2_KEYS.length || !keys.every((key, index) => key === V2_SORTED_KEYS[index]) || envelope.kind !== V2_KIND || envelope.version !== ENVELOPE_VERSION) {
    throw semanticContentRefusal("malformed-normalized-content", "normalized semantic content has unknown fields, kind, or version");
  }
  const objectKind = canonicalString(envelope.objectKind, "objectKind");
  if (objectKind.length === 0) throw semanticContentRefusal("malformed-normalized-content", "objectKind must not be empty");
  if (envelope.normalizationProfile !== SEN_NORMALIZATION_PROFILE) {
    throw semanticContentRefusal("unsupported-normalization-profile", `unsupported normalization profile ${String(envelope.normalizationProfile)}`);
  }
  if (envelope.settlementProfile !== IDENTITY_SETTLEMENT_PROFILE) {
    throw semanticContentRefusal("unsupported-settlement-profile", `unsupported settlement profile ${String(envelope.settlementProfile)}`);
  }
  const witnessRoot = canonicalNi(envelope.witnessRoot, "witnessRoot");
  if (!typeChecked && !inhabitsDeclaredType(envelope.settledBody, envelope.semanticType)) {
    throw semanticContentRefusal("non-relational-content", "settledBody must be a closed SEN term inhabiting semanticType");
  }
  if (normalForm !== void 0) {
    let normalized;
    try {
      normalized = normalForm(envelope.settledBody);
    } catch {
      throw semanticContentRefusal("normalization-failure", "settledBody could not be checked under the declared normalization profile");
    }
    if (!coincides(normalized, envelope.settledBody)) {
      throw semanticContentRefusal("non-normal-content", "settledBody is not normal under the declared normalization profile");
    }
  }
  return immutableCopy({
    kind: V2_KIND,
    version: ENVELOPE_VERSION,
    objectKind,
    semanticType: envelope.semanticType,
    normalizationProfile: SEN_NORMALIZATION_PROFILE,
    settlementProfile: envelope.settlementProfile,
    settledBody: envelope.settledBody,
    witnessRoot
  });
}
function commitSemanticEnvelope(envelope, options = {}) {
  const admitted = admitSemanticEnvelope(envelope, options);
  return Object.freeze({ ...commitmentOf(admitted), envelope: admitted });
}
function identifyJsonSemanticContent({ objectKind, value, witnessRoot } = {}) {
  let term;
  try {
    term = jsonToTerm(value);
  } catch {
    throw semanticContentRefusal("non-relational-content", "value must cross the admitted JSON-to-SEN boundary");
  }
  let semanticType;
  try {
    semanticType = inferTerm(term);
  } catch {
    throw semanticContentRefusal("non-relational-content", "admitted JSON did not derive an SEN type");
  }
  return commitSemanticEnvelope({
    kind: V2_KIND,
    version: ENVELOPE_VERSION,
    objectKind,
    semanticType,
    normalizationProfile: SEN_NORMALIZATION_PROFILE,
    settlementProfile: IDENTITY_SETTLEMENT_PROFILE,
    settledBody: term,
    witnessRoot
  }, { typeChecked: true });
}
function semanticIdOf(objectKind) {
  if (typeof objectKind !== "string" || objectKind.trim() === "") throw new TypeError("semantic-object-kind-required");
  return (value) => identifyJsonSemanticContent({ objectKind, value, witnessRoot: EMPTY_WITNESS_ROOT }).id;
}

// ../../../../../../../../../../../../../../../../../github-engineering-services-section/node_modules/@red-cup-engineering/json-engineering-services-section/scripts/canonical-json.mjs
var UNBOUNDED_JSON_ENVELOPE = Object.freeze({
  maxSourceBytes: Infinity,
  maxCanonicalBytes: Infinity,
  maxDepth: Infinity,
  maxNodes: Infinity,
  maxObjectMembers: Infinity,
  maxArrayLength: Infinity,
  maxStringBytes: Infinity,
  maxKeyBytes: Infinity
});
var JSON_RESOURCE_ENVELOPE = Object.freeze({
  maxSourceBytes: 1048576,
  maxCanonicalBytes: 1048576,
  maxDepth: 64,
  maxNodes: 1e5,
  maxObjectMembers: 4096,
  maxArrayLength: 65536,
  maxStringBytes: 262144,
  maxKeyBytes: 1024
});
var utf8Encoder = new TextEncoder();
function byteLength(value) {
  return utf8Encoder.encode(value).byteLength;
}
function pathText(path) {
  const parts = [];
  let base = "$";
  for (let node = path; node !== null && typeof node === "object"; node = node.parent) {
    parts.push(node);
  }
  if (typeof path === "string") base = path;
  let text2 = base;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    text2 += part.kind === "index" ? `[${part.value}]` : `.${part.value}`;
  }
  return text2;
}
function continuesSpine(container, index, child) {
  return index === 2 && Array.isArray(container) && container[0] === "pair" && Array.isArray(child) && child[0] === "pair";
}
function spineLimit(spine, envelope, path) {
  if (spine > envelope.maxArrayLength) fail3("array-length-limit", path, `list spine exceeds ${envelope.maxArrayLength} links`);
}
function propertyPath(path, key) {
  return { parent: path, kind: "property", value: key };
}
function indexPath(path, index) {
  return { parent: path, kind: "index", value: index };
}
function fail3(code, path, message) {
  const renderedPath = pathText(path);
  const error = new TypeError(`${code} at ${renderedPath}: ${message}`);
  error.code = code;
  error.path = renderedPath;
  throw error;
}
function assertUnicodeScalars(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 55296 && unit <= 56319) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 56320 && next <= 57343)) {
        fail3("unicode-scalar", path, "must not contain a lone Unicode surrogate (high)");
      }
      index += 1;
    } else if (unit >= 56320 && unit <= 57343) {
      fail3("unicode-scalar", path, "must not contain a lone Unicode surrogate (low)");
    }
  }
}
function stringText(value, path, limit, code) {
  assertUnicodeScalars(value, path);
  if (byteLength(value) > limit) fail3(code, path, `UTF-8 string exceeds ${limit} bytes`);
  return JSON.stringify(value);
}
function chargeCanonical(state, amount, path) {
  state.canonicalBytes += amount;
  if (state.canonicalBytes > state.envelope.maxCanonicalBytes) {
    fail3("canonical-limit", path, `canonical JSON exceeds ${state.envelope.maxCanonicalBytes} bytes`);
  }
}
function projectValue(value, path, depth, state) {
  const tokens = [];
  const frames = [{ source: value, path, depth, spine: 0, entered: false }];
  let result;
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (!frame.entered) {
      frame.entered = true;
      state.nodes += 1;
      if (state.nodes > state.envelope.maxNodes) {
        fail3("node-limit", frame.path, `JSON value exceeds ${state.envelope.maxNodes} nodes`);
      }
      const item = frame.source;
      if (item === null) {
        chargeCanonical(state, 4, frame.path);
        tokens.push("null");
        result = null;
        frames.pop();
        continue;
      }
      if (typeof item === "boolean") {
        const text2 = item ? "true" : "false";
        chargeCanonical(state, text2.length, frame.path);
        tokens.push(text2);
        result = item;
        frames.pop();
        continue;
      }
      if (typeof item === "string") {
        const text2 = stringText(item, frame.path, state.envelope.maxStringBytes, "string-limit");
        chargeCanonical(state, byteLength(text2), frame.path);
        tokens.push(text2);
        result = item;
        frames.pop();
        continue;
      }
      if (typeof item === "number") {
        if (!Number.isFinite(item)) fail3("invalid-json-value", frame.path, "JCS admits only finite IEEE-754 numbers");
        const text2 = JSON.stringify(item);
        chargeCanonical(state, byteLength(text2), frame.path);
        tokens.push(text2);
        result = Object.is(item, -0) ? 0 : item;
        frames.pop();
        continue;
      }
      if (typeof item !== "object") {
        fail3("invalid-json-value", frame.path, `unsupported JSON value type: ${typeof item}`);
      }
      if (frame.depth >= state.envelope.maxDepth) {
        fail3("depth-limit", frame.path, `JSON nesting exceeds depth ${state.envelope.maxDepth}`);
      }
      if (state.active.has(item)) fail3("invalid-json-value", frame.path, "must not contain a cycle");
      state.active.add(item);
      frame.container = item;
      frame.index = 0;
      if (Array.isArray(item)) {
        if (item.length > state.envelope.maxArrayLength) {
          fail3("array-length-limit", frame.path, `array exceeds ${state.envelope.maxArrayLength} elements`);
        }
        const ownKeys = Reflect.ownKeys(item);
        if (ownKeys.some((key) => key !== "length" && (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= item.length))) {
          fail3("invalid-json-value", frame.path, "arrays may not carry symbol or non-index properties");
        }
        chargeCanonical(state, 2 + Math.max(0, item.length - 1), frame.path);
        tokens.push("[");
        frame.array = true;
        frame.carried = [];
        frame.length = item.length;
      } else {
        if (Object.getPrototypeOf(item) !== Object.prototype) {
          fail3("invalid-json-value", frame.path, "only ordinary JSON objects with Object.prototype are admitted");
        }
        const keys = Reflect.ownKeys(item);
        if (keys.some((key) => typeof key !== "string")) {
          fail3("invalid-json-value", frame.path, "symbol properties are outside the JSON data model");
        }
        if (keys.length > state.envelope.maxObjectMembers) {
          fail3("object-member-limit", frame.path, `object exceeds ${state.envelope.maxObjectMembers} members`);
        }
        frame.keys = keys.sort();
        chargeCanonical(state, 2 + Math.max(0, frame.keys.length - 1) + frame.keys.length, frame.path);
        tokens.push("{");
        frame.carried = {};
        frame.array = false;
      }
      continue;
    }
    const count = frame.array ? frame.length : frame.keys.length;
    if (frame.awaitingChild) {
      if (frame.array) {
        frame.carried.push(result);
      } else {
        Object.defineProperty(frame.carried, frame.key, {
          value: result,
          enumerable: true,
          configurable: false,
          writable: false
        });
      }
      frame.awaitingChild = false;
      frame.index += 1;
    }
    if (frame.index === count) {
      tokens.push(frame.array ? "]" : "}");
      const carried = Object.freeze(frame.carried);
      state.active.delete(frame.container);
      result = carried;
      frames.pop();
      continue;
    }
    if (frame.index > 0) tokens.push(",");
    let child;
    let childPath;
    if (frame.array) {
      const index = frame.index;
      const descriptor = Object.getOwnPropertyDescriptor(frame.container, String(index));
      childPath = indexPath(frame.path, index);
      if (descriptor === void 0) {
        fail3("invalid-json-value", childPath, "sparse arrays are outside the admitted JSON value model");
      }
      if (!("value" in descriptor) || !descriptor.enumerable) {
        fail3("invalid-json-value", childPath, "array accessors and non-enumerable elements are outside the JSON data model");
      }
      child = descriptor.value;
    } else {
      const key = frame.keys[frame.index];
      const descriptor = Object.getOwnPropertyDescriptor(frame.container, key);
      childPath = propertyPath(frame.path, key);
      if (descriptor === void 0 || !("value" in descriptor) || !descriptor.enumerable) {
        fail3("invalid-json-value", childPath, "accessor and non-enumerable properties are outside the JSON data model");
      }
      const keyText = stringText(key, childPath, state.envelope.maxKeyBytes, "key-limit");
      chargeCanonical(state, byteLength(keyText), childPath);
      tokens.push(keyText, ":");
      frame.key = key;
      child = descriptor.value;
    }
    frame.awaitingChild = true;
    const onSpine = frame.array && continuesSpine(frame.container, frame.index, child);
    const spine = onSpine ? frame.spine + 1 : 0;
    spineLimit(spine, state.envelope, childPath);
    frames.push({ source: child, path: childPath, depth: onSpine ? frame.depth : frame.depth + 1, spine, entered: false });
  }
  return { value: result, text: tokens.join("") };
}
function canonicalizeJson(value, envelope = UNBOUNDED_JSON_ENVELOPE) {
  const state = { nodes: 0, canonicalBytes: 0, active: /* @__PURE__ */ new WeakSet(), envelope };
  const projected = projectValue(value, "$", 0, state);
  return Object.freeze({ value: projected.value, text: projected.text, byteLength: state.canonicalBytes });
}
function canonicalJson(value, envelope = UNBOUNDED_JSON_ENVELOPE) {
  return canonicalizeJson(value, envelope).text;
}
if (import.meta.main) {
  const { readFileSync } = globalThis.process?.getBuiltinModule?.("node:fs") ?? {};
  process.stdout.write(
    JSON.stringify(canonicalJson(JSON.parse(readFileSync(0, "utf8")))) + "\n"
  );
}

// src/evidence-packet.mjs
var semanticId2 = semanticIdOf("brokerage.issuer-research-media.record");
var id = (v) => semanticId2(v);
function validateIssuerEvidenceRequest({ ticker, issuer, asOf, sources, claims, events = [], license = "single-customer-analysis" } = {}) {
  if (typeof ticker !== "string" || ticker.trim() === "" || typeof issuer !== "string" || issuer.trim() === "") throw new TypeError("ticker-and-issuer-required");
  if (!Number.isFinite(Date.parse(asOf)) || !Array.isArray(sources) || sources.length === 0 || sources.some((s) => !s.uri || !s.observedAt || !s.digest)) throw new TypeError("dated-content-addressed-sources-required");
  if (!Array.isArray(claims) || claims.length === 0 || claims.some((c) => !c.statement || !Array.isArray(c.sourceDigests) || c.sourceDigests.length === 0)) throw new TypeError("source-bound-claims-required");
  const sourceIds = new Set(sources.map((s) => s.digest));
  if (claims.some((c) => c.sourceDigests.some((d) => !sourceIds.has(d)))) throw new TypeError("claim-cites-unknown-source");
  if (!Array.isArray(events) || typeof license !== "string" || license.trim() === "") throw new TypeError("events-or-license-invalid");
  return Object.freeze({ ticker, issuer, asOf, sources, claims, events, license });
}
function formIssuerEvidencePacket(input) {
  const { ticker, issuer, asOf, sources, claims, events, license } = validateIssuerEvidenceRequest(input);
  const body = {
    type: "IssuerEvidencePacket",
    version: 1,
    ticker: String(ticker).toUpperCase(),
    issuer: String(issuer),
    asOf,
    sources,
    claims,
    events,
    license,
    proofStatus: "research-evidence-not-mathematical-proof",
    brokerageEffect: false
  };
  return Object.freeze({ id: id(body), ...body });
}

// src/issuer-revenue-reconciliation.mjs
var CONCEPTS = Object.freeze(["Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerExcludingAssessedTax"]);
var DAY = 864e5;
var record2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function calendarDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const milliseconds = Date.parse(value + "T00:00:00.000Z");
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== value) return null;
  return milliseconds / DAY;
}
function validIdentity(value, requested) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 && value === Number(requested);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value) === BigInt(requested);
  return false;
}
function compareWitnesses(a, b) {
  return lexical(a.concept, b.concept) || lexical(a.filed, b.filed) || lexical(a.accession, b.accession) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0) || lexical(a.start, b.start) || lexical(a.form, b.form);
}
function equalWitness(a, b) {
  return a.concept === b.concept && a.start === b.start && a.end === b.end && a.durationDays === b.durationDays && Object.is(a.value, b.value) && a.unit === b.unit && a.form === b.form && a.filed === b.filed && a.accession === b.accession;
}
function reconcileIssuerRevenueFacts(input) {
  if (!record2(input)) throw new TypeError("Invalid input envelope");
  const { cik, asOf, periodKind, maximumAgeDays, companyfacts } = input;
  const asOfDay = calendarDay(asOf);
  if (typeof cik !== "string" || !/^\d{10}$/.test(cik) || asOfDay === null || periodKind !== "quarter" && periodKind !== "annual" || !Number.isInteger(maximumAgeDays) || maximumAgeDays <= 0 || !record2(companyfacts) || !validIdentity(companyfacts.cik, cik) || typeof companyfacts.entityName !== "string" || companyfacts.entityName.trim().length === 0 || !record2(companyfacts.facts)) throw new TypeError("Invalid input envelope or issuer identity");
  const eligible = [];
  const conceptCoverage = [];
  const taxonomy = companyfacts.facts["us-gaap"];
  for (const concept of CONCEPTS) {
    const entry = record2(taxonomy) ? taxonomy[concept] : void 0;
    const observations = record2(entry) && record2(entry.units) && Array.isArray(entry.units.USD) ? entry.units.USD : [];
    const witnesses = [];
    for (const observation of observations) {
      if (!record2(observation) || typeof observation.val !== "number" || !Number.isFinite(observation.val) || typeof observation.accn !== "string" || observation.accn.trim().length === 0 || !["10-Q", "10-Q/A", "10-K", "10-K/A"].includes(observation.form)) continue;
      const startDay = calendarDay(observation.start);
      const endDay = calendarDay(observation.end);
      const filedDay = calendarDay(observation.filed);
      if (startDay === null || endDay === null || filedDay === null || startDay > endDay || endDay > asOfDay || filedDay > asOfDay) continue;
      const witness = {
        concept,
        start: observation.start,
        end: observation.end,
        durationDays: endDay - startDay + 1,
        value: observation.val,
        unit: "USD",
        form: observation.form,
        filed: observation.filed,
        accession: observation.accn
      };
      if (!witnesses.some((existing) => equalWitness(existing, witness))) witnesses.push(witness);
    }
    let latestEnd = null;
    for (const witness of witnesses) {
      if (latestEnd === null || witness.end > latestEnd) latestEnd = witness.end;
      eligible.push(witness);
    }
    conceptCoverage.push({ concept, latestEnd, count: witnesses.length });
  }
  const result = {
    type: "IssuerRevenueReconciliation",
    version: 1,
    cik,
    issuer: companyfacts.entityName,
    asOf,
    periodKind,
    status: "missing",
    unit: "USD",
    period: null,
    value: null,
    witnesses: [],
    conceptCoverage,
    revision: "none"
  };
  const [minimum, maximum] = periodKind === "quarter" ? [70, 110] : [330, 380];
  const candidates = eligible.filter((w) => w.durationDays >= minimum && w.durationDays <= maximum);
  if (candidates.length === 0) return result;
  let greatestEnd = candidates[0].end;
  for (const witness of candidates) if (witness.end > greatestEnd) greatestEnd = witness.end;
  const selected = candidates.filter((w) => w.end === greatestEnd).sort(compareWitnesses);
  result.witnesses = selected;
  if (new Set(selected.map((w) => w.start)).size > 1) {
    result.status = "ambiguous";
    result.revision = "ambiguous";
    return result;
  }
  const first = selected[0];
  result.period = { start: first.start, end: first.end, durationDays: first.durationDays };
  const latestByConcept = /* @__PURE__ */ new Map();
  for (const witness of selected) {
    const previous = latestByConcept.get(witness.concept);
    if (previous === void 0 || witness.filed > previous) latestByConcept.set(witness.concept, witness.filed);
  }
  const latest = selected.filter((w) => w.filed === latestByConcept.get(w.concept));
  const values = new Set(latest.map((w) => w.value));
  if (values.size > 1) {
    result.status = "ambiguous";
    result.revision = "ambiguous";
    return result;
  }
  result.value = latest[0].value;
  if (selected.some((w) => w.filed < latestByConcept.get(w.concept) && w.value !== result.value)) {
    result.revision = "changed-reported-value";
  } else if (new Set(selected.map((w) => w.accession)).size > 1) {
    result.revision = "equal-value-rereport";
  }
  result.status = asOfDay - calendarDay(greatestEnd) > maximumAgeDays ? "stale" : "current";
  return result;
}

// ../../../../../../../../../../../../../../../computer-data-engineering-services-section/services/cryptographic-computer-data-engineering-services-section/src/portable-sha256.mjs
var K2 = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var H02 = new Uint32Array([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
function rotr2(x, n) {
  return x >>> n | x << 32 - n;
}
var nativeCrypto2 = globalThis.process?.getBuiltinModule?.("node:crypto");
function sha256Bytes2(bytes) {
  if (nativeCrypto2 !== void 0) return nativeCrypto2.createHash("sha256").update(bytes).digest("hex");
  return portableSha256Bytes2(bytes);
}
function portableSha256Bytes2(bytes) {
  const bitLen = bytes.length * 8;
  const padLen = (bytes.length + 8 >> 6) + 1 << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 128;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 4294967296), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  const h = H02.slice();
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr2(w[i - 15], 7) ^ rotr2(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr2(w[i - 2], 17) ^ rotr2(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr2(e, 6) ^ rotr2(e, 11) ^ rotr2(e, 25);
      const ch = e & f ^ ~e & g;
      const t1 = hh + S1 + ch + K2[i] + w[i] | 0;
      const S0 = rotr2(a, 2) ^ rotr2(a, 13) ^ rotr2(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const t2 = S0 + maj | 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 | 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 | 0;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
    h[5] = h[5] + f | 0;
    h[6] = h[6] + g | 0;
    h[7] = h[7] + hh | 0;
  }
  let hex = "";
  for (const word of h) hex += (word >>> 0).toString(16).padStart(8, "0");
  return hex;
}

// ../../../../../../../../../../../../../../../computer-data-engineering-services-section/services/computer-content-engineering-services-section/services/computer-content-address-engineering-services-section/services/uri-engineering-services-section/src/ni-uri.mjs
function base64url2(bytes) {
  let text2 = "";
  for (const byte of bytes) text2 += String.fromCharCode(byte);
  return btoa(text2).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function sha2562(bytes) {
  const hex = sha256Bytes2(bytes);
  return Uint8Array.from(hex.match(/../g), (pair) => Number.parseInt(pair, 16));
}
var NI_PREFIX2 = "ni:///sha-256;";
var NI_URI_PATTERN2 = /^ni:\/\/\/sha-256;[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
function byteString2(value) {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError("ni URI input must be a Uint8Array");
  }
  return value;
}
function makeNiUri2(bytes) {
  const digest = base64url2(sha2562(byteString2(bytes)));
  return `${NI_PREFIX2}${digest}`;
}
function isNiUri2(value) {
  return typeof value === "string" && NI_URI_PATTERN2.test(value);
}

// ../../../../../../../../../../../../../../../computer-data-engineering-services-section/services/computer-content-engineering-services-section/services/computer-content-address-engineering-services-section/src/content-address.mjs
function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  throw new TypeError("content bytes must be Uint8Array or ArrayBuffer");
}
function addressContent(bytes, {
  mediaType = "application/octet-stream",
  source = void 0
} = {}) {
  const admitted = bytesOf(bytes);
  if (typeof mediaType !== "string" || mediaType.length === 0) {
    throw new TypeError("mediaType must be non-empty text");
  }
  const record4 = {
    kind: "semiotic-content.raw-carrier-address",
    version: 1,
    algorithm: "sha-256",
    size: admitted.byteLength,
    mediaType,
    ni: makeNiUri2(admitted)
  };
  if (source !== void 0) {
    if (source === null || typeof source !== "object" || Array.isArray(source)) {
      throw new TypeError("source must be an object when supplied");
    }
    record4.source = Object.freeze(structuredClone(source));
  }
  return Object.freeze(record4);
}

// src/prepared-cohort.mjs
var KINDS = ["quarter", "annual"];
var DAY2 = 864e5;
var record3 = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
var text = (x) => typeof x === "string" && x.trim().length > 0;
var positive = (x) => Number.isSafeInteger(x) && x > 0;
var urlFor = (cik) => "https://data.sec.gov/api/xbrl/companyfacts/CIK" + cik + ".json";
function config(c) {
  const bad = () => {
    throw new TypeError("Invalid issuer revenue configuration");
  };
  if (!record3(c) || !Number.isInteger(c.maximumIssuers) || c.maximumIssuers < 2 || c.maximumIssuers > 5) bad();
  if (!Array.isArray(c.issuers) || c.issuers.length < 2 || c.issuers.length > c.maximumIssuers) bad();
  const seen = /* @__PURE__ */ new Set();
  for (const i of c.issuers) {
    if (!record3(i) || typeof i.cik !== "string" || !/^\d{10}$/.test(i.cik) || !text(i.ticker) || seen.has(i.cik)) bad();
    seen.add(i.cik);
  }
  if (!text(c.userAgent) || /[\r\n]/.test(c.userAgent) || !c.userAgent.includes("@")) bad();
  for (const k of ["maximumBytes", "timeoutMs", "maximumSnapshotAgeMs", "maximumCohortBytes"]) if (!positive(c[k])) bad();
  if (!record3(c.maximumAgeDays) || !KINDS.every((k) => positive(c.maximumAgeDays[k]))) bad();
  if (!Number.isInteger(c.minimumIntervalMs) || c.minimumIntervalMs < 100 || !text(c.cacheKey)) bad();
  if (!Array.isArray(c.allowedPeriodKinds) || !c.allowedPeriodKinds.length || !c.allowedPeriodKinds.every((k) => KINDS.includes(k)) || new Set(c.allowedPeriodKinds).size !== c.allowedPeriodKinds.length || typeof c.allowAmbiguousEvidence !== "boolean") bad();
  return c;
}
function instant(v) {
  if (typeof v === "number") return Number.isInteger(v) && Number.isFinite(v) && Number.isFinite(new Date(v).getTime()) ? v : NaN;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return NaN;
  const n = Date.parse(v);
  return Number.isFinite(n) && new Date(n).toISOString() === v ? n : NaN;
}
function day(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return NaN;
  const n = Date.parse(v + "T00:00:00.000Z");
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === v ? n : NaN;
}
function canonical(v) {
  return typeof v === "string" && Number.isFinite(instant(v));
}
function unavailable() {
  return Object.assign(new Error("Issuer revenue unavailable"), { code: "issuer-revenue-unavailable", status: 503, retryable: true });
}
function refused(reason, retryable, retryAfter) {
  const e = Object.assign(new Error("Issuer revenue source unavailable: " + reason), { code: "issuer-revenue-source-unavailable", status: 503, retryable, reason });
  if (retryAfter !== void 0 && retryAfter !== null) e.retryAfter = String(retryAfter);
  return e;
}
function need(condition) {
  if (!condition) throw unavailable();
}
function ni(v) {
  return text(v) && isNiUri2(v);
}
function statement(r) {
  return "Received SEC companyfacts and reconciled " + r.periodKind + " USD revenue; status=" + r.status + "; period=" + (r.period ? r.period.start + ".." + r.period.end : "none") + "; value=" + String(r.value) + "; revision=" + r.revision + ".";
}
function comparability(issuers) {
  if (!issuers.every((i) => i.status === "current")) return "unresolved";
  const p = issuers[0].period;
  return issuers.every((i) => i.period && p && i.period.start === p.start && i.period.end === p.end) ? "aligned-periods" : "different-periods";
}
function planIssuerRevenueAcquisition(configuration) {
  const c = config(configuration);
  return { type: "IssuerRevenueAcquisitionPlan", version: 1, minimumIntervalMs: c.minimumIntervalMs, maximumCohortBytes: c.maximumCohortBytes, requests: c.issuers.map((i) => ({ cik: i.cik, ticker: i.ticker, url: urlFor(i.cik), headers: { "User-Agent": c.userAgent, Accept: "application/json" }, timeoutMs: c.timeoutMs, maximumBytes: c.maximumBytes })) };
}
function validateIssuerRevenueComparisonRequest(body, configuration) {
  const c = config(configuration);
  if (!record3(body) || Reflect.ownKeys(body).length !== 1 || !Object.hasOwn(body, "periodKind") || !c.allowedPeriodKinds.includes(body.periodKind)) throw new TypeError("Invalid issuer revenue comparison request");
  return { periodKind: body.periodKind };
}
function periodValid(p, kind, asOf, nowDay, maxAge) {
  if (!record3(p)) return false;
  const start = day(p.start), end = day(p.end);
  const length = (end - start) / DAY2 + 1;
  const [lo, hi] = kind === "quarter" ? [70, 110] : [330, 380];
  return Number.isFinite(start) && Number.isFinite(end) && start <= end && end <= day(asOf) && length === p.durationDays && length >= lo && length <= hi && (nowDay - end) / DAY2 <= maxAge;
}
function financial(r, kind, c, asOf, today) {
  need(r.status === "current" || c.allowAmbiguousEvidence && r.status === "ambiguous");
  need(Array.isArray(r.witnesses) && r.witnesses.length > 0);
  const latest = /* @__PURE__ */ new Map();
  for (const w of r.witnesses) {
    need(record3(w) && periodValid(w, kind, asOf, today, c.maximumAgeDays[kind]));
    need(Number.isFinite(w.value) && w.unit === "USD" && ["10-Q", "10-Q/A", "10-K", "10-K/A"].includes(w.form) && Number.isFinite(day(w.filed)) && w.filed <= asOf && text(w.accession) && text(w.concept));
    const old = latest.get(w.concept);
    if (!old || w.filed > old.filed) latest.set(w.concept, { filed: w.filed, values: [w.value] });
    else if (w.filed === old.filed) old.values.push(w.value);
  }
  const values = [...latest.values()].flatMap((x) => x.values);
  if (r.period !== null) {
    need(periodValid(r.period, kind, asOf, today, c.maximumAgeDays[kind]));
    need(r.witnesses.every((w) => w.start === r.period.start && w.end === r.period.end && w.durationDays === r.period.durationDays));
  }
  if (r.status === "current") {
    need(r.period !== null && Number.isFinite(r.value) && text(r.revision) && r.revision !== "ambiguous");
    need(values.every((v) => v === r.value));
  } else {
    need(r.value === null && r.revision === "ambiguous");
    if (r.period === null) {
      need(new Set(r.witnesses.map((w) => w.end)).size === 1 && new Set(r.witnesses.map((w) => w.start)).size > 1);
    } else need(new Set(values).size > 1);
  }
}
function selectPreparedIssuerRevenueComparison(input) {
  const { body, configuration, cohort, now } = input ?? {};
  const { periodKind } = validateIssuerRevenueComparisonRequest(body, configuration);
  const n = instant(now);
  if (!Number.isFinite(n)) throw new TypeError("Invalid explicit now");
  const c = configuration;
  try {
    need(record3(cohort) && cohort.type === "IssuerRevenuePreparedCohort" && cohort.version === 1 && canonical(cohort.observedAt));
    const observed = instant(cohort.observedAt);
    need(Number.isFinite(day(cohort.asOf)) && cohort.asOf === cohort.observedAt.slice(0, 10) && observed <= n && n - observed <= c.maximumSnapshotAgeMs);
    need(record3(cohort.results) && Object.hasOwn(cohort.results, "quarter") && Object.hasOwn(cohort.results, "annual"));
    const r = cohort.results[periodKind];
    need(record3(r) && r.type === "IssuerRevenueComparison" && r.version === 1 && r.observedAt === cohort.observedAt && r.asOf === cohort.asOf && r.periodKind === periodKind && r.datePolicy === "filing-date-cutoff-on-received-sources");
    need(Array.isArray(r.issuers) && Array.isArray(r.evidencePackets) && r.issuers.length === c.issuers.length && r.evidencePackets.length === c.issuers.length);
    const today = day(new Date(n).toISOString().slice(0, 10));
    for (let j = 0; j < c.issuers.length; j++) {
      const i = r.issuers[j], expected = c.issuers[j], p = r.evidencePackets[j];
      need(record3(i) && i.type === "IssuerRevenueReconciliation" && i.version === 1 && i.cik === expected.cik && i.ticker === expected.ticker && i.asOf === r.asOf && i.periodKind === periodKind && text(i.issuer) && i.unit === "USD");
      const s = i.source;
      need(record3(s) && s.uri === urlFor(expected.cik) && ni(s.digest) && positive(s.bytes) && s.bytes <= c.maximumBytes && canonical(s.observedAt));
      const sn = instant(s.observedAt);
      need(sn <= observed && n - sn <= c.maximumSnapshotAgeMs);
      financial(i, periodKind, c, r.asOf, today);
      need(record3(p) && p.type === "IssuerEvidencePacket" && p.version === 1 && p.ticker === String(expected.ticker).toUpperCase() && p.issuer === i.issuer && p.asOf === r.asOf && ni(p.id) && p.brokerageEffect === false);
      need(Array.isArray(p.sources) && p.sources.length === 1 && record3(p.sources[0]));
      need(p.sources[0].uri === s.uri && p.sources[0].digest === s.digest && p.sources[0].observedAt === s.observedAt);
      need(Array.isArray(p.claims) && p.claims.length === 1 && record3(p.claims[0]));
      const claim = p.claims[0];
      need(Array.isArray(claim.sourceDigests) && claim.sourceDigests.length === 1 && claim.sourceDigests[0] === s.digest && claim.statement === statement(i));
    }
    need(r.comparability === comparability(r.issuers));
    return r;
  } catch {
    throw unavailable();
  }
}
function abortable(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const stop = () => reject(signal.reason ?? new Error("Acquisition timeout"));
    if (signal.aborted) {
      stop();
      return;
    }
    signal.addEventListener("abort", stop, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
async function boundedBody(stream, limit, signal) {
  if (!stream || typeof stream.getReader !== "function") throw new Error("invalid-stream");
  const reader = stream.getReader();
  const chunks = [];
  let total = 0, complete = false;
  try {
    for (; ; ) {
      const part = await abortable(reader.read(), signal);
      if (!record3(part)) throw new Error("invalid-stream");
      if (part.done) {
        complete = true;
        break;
      }
      if (!(part.value instanceof Uint8Array)) throw new Error("invalid-stream");
      total += part.value.byteLength;
      if (total > limit) throw new Error("byte-overflow");
      chunks.push(part.value.slice());
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    if (!complete) {
      try {
        Promise.resolve(reader.cancel()).catch(() => {
        });
      } catch {
      }
    }
    try {
      reader.releaseLock();
    } catch {
    }
  }
}
function parseBytes(bytes) {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function platformSleep(ms) {
  let remaining = ms;
  while (remaining > 0) {
    const chunk = Math.min(remaining, 2147483647);
    await new Promise((resolve) => setTimeout(resolve, chunk));
    remaining -= chunk;
  }
}
async function acquire(request, fetcher, clock, fixedDay) {
  let signal;
  try {
    signal = AbortSignal.timeout(request.timeoutMs);
  } catch {
    throw refused("timeout-configuration", false);
  }
  let response;
  try {
    response = await abortable(fetcher(request.url, { method: "GET", headers: request.headers, redirect: "manual", signal }), signal);
  } catch {
    throw refused("network-or-timeout", true);
  }
  const retryAfter = response?.headers?.get?.("Retry-After");
  if (response?.status !== 200) {
    try {
      Promise.resolve(response?.body?.cancel?.()).catch(() => {
      });
    } catch {
    }
    const status = response?.status;
    throw refused("http-" + String(status), status === 429 || status >= 500 && status <= 599, retryAfter);
  }
  let bytes;
  try {
    const length = response.headers?.get?.("Content-Length");
    if (length !== null && length !== void 0 && /^\d+$/.test(length) && Number(length) > request.maximumBytes) {
      try {
        Promise.resolve(response.body?.cancel?.()).catch(() => {
        });
      } catch {
      }
      throw new Error("byte-overflow");
    }
    bytes = await boundedBody(response.body, request.maximumBytes, signal);
  } catch (e) {
    throw refused(signal.aborted ? "network-or-timeout" : e?.message === "byte-overflow" ? "byte-overflow" : "body-unavailable", signal.aborted || e?.message !== "byte-overflow" && e?.message !== "invalid-stream", retryAfter);
  }
  const observed = instant(clock());
  if (!Number.isFinite(observed)) throw refused("invalid-clock", false);
  const observedAt = new Date(observed).toISOString();
  if (observedAt.slice(0, 10) !== fixedDay) throw refused("utc-day-changed", true);
  try {
    const companyfacts = parseBytes(bytes);
    const address = await addressContent(bytes, { mediaType: "application/json" });
    if (!record3(address) || address.kind !== "semiotic-content.raw-carrier-address" || address.version !== 1 || address.algorithm !== "sha-256" || address.size !== bytes.length || address.mediaType !== "application/json" || !ni(address.ni) || !positive(address.size)) throw new Error("Invalid raw address");
    return { companyfacts, source: { uri: request.url, digest: address.ni, bytes: address.size, observedAt } };
  } catch {
    throw refused("invalid-source", false, retryAfter);
  }
}
async function compactIssuer(request, c, fetcher, clock, asOf) {
  const { companyfacts, source } = await acquire(request, fetcher, clock, asOf);
  const compact = {};
  for (const periodKind of KINDS) {
    let result;
    try {
      result = { ...reconcileIssuerRevenueFacts({ cik: request.cik, asOf, periodKind, maximumAgeDays: c.maximumAgeDays[periodKind], companyfacts }), ticker: request.ticker, source: { ...source } };
    } catch {
      throw refused("invalid-source-identity", false);
    }
    let packet;
    try {
      packet = await formIssuerEvidencePacket({ ticker: request.ticker, issuer: result.issuer, asOf, sources: [{ uri: source.uri, observedAt: source.observedAt, digest: source.digest }], claims: [{ statement: statement(result), sourceDigests: [source.digest] }] });
    } catch {
      throw refused("packet-construction", false);
    }
    compact[periodKind] = { result, packet };
  }
  return compact;
}
async function prepareIssuerRevenueCohort(configuration, adapters = {}) {
  const plan = planIssuerRevenueAcquisition(configuration);
  if (!record3(adapters)) throw new TypeError("Invalid adapters");
  const clock = adapters.now === void 0 ? Date.now : adapters.now;
  const fetcher = adapters.fetch === void 0 ? globalThis.fetch : adapters.fetch;
  const sleep = adapters.sleep === void 0 ? platformSleep : adapters.sleep;
  if (typeof clock !== "function" || typeof fetcher !== "function" || typeof sleep !== "function") throw new TypeError("Invalid adapters");
  const start = instant(clock());
  if (!Number.isFinite(start)) throw new TypeError("Invalid preparation clock");
  const asOf = new Date(start).toISOString().slice(0, 10);
  const parts = { quarter: { issuers: [], evidencePackets: [] }, annual: { issuers: [], evidencePackets: [] } };
  for (let j = 0; j < plan.requests.length; j++) {
    if (j) {
      try {
        await sleep(plan.minimumIntervalMs);
      } catch {
        throw refused("spacing-unavailable", true);
      }
    }
    const compact = await compactIssuer(plan.requests[j], configuration, fetcher, clock, asOf);
    for (const k of KINDS) {
      parts[k].issuers.push(compact[k].result);
      parts[k].evidencePackets.push(compact[k].packet);
    }
  }
  let completion;
  try {
    completion = instant(clock());
  } catch {
    throw refused("invalid-clock", false);
  }
  if (!Number.isFinite(completion)) throw refused("invalid-clock", false);
  const observedAt = new Date(completion).toISOString();
  if (observedAt.slice(0, 10) !== asOf) throw refused("utc-day-changed", true);
  if (completion < start || KINDS.some((k) => parts[k].issuers.some((i) => instant(i.source.observedAt) > completion))) throw refused("invalid-clock", false);
  const results = {};
  for (const k of KINDS) results[k] = { type: "IssuerRevenueComparison", version: 1, observedAt, asOf, periodKind: k, datePolicy: "filing-date-cutoff-on-received-sources", comparability: comparability(parts[k].issuers), issuers: parts[k].issuers, evidencePackets: parts[k].evidencePackets };
  const cohort = { type: "IssuerRevenuePreparedCohort", version: 1, observedAt, asOf, results };
  try {
    if (new TextEncoder().encode(JSON.stringify(cohort)).byteLength > configuration.maximumCohortBytes) throw new Error("overflow");
  } catch {
    throw refused("compact-output-overflow", false);
  }
  return cohort;
}

// <stdin>
var fullCompanyfactsPreparation = { async test() {
  const c = { "issuers": [{ "cik": "0000320193", "ticker": "AAPL" }, { "cik": "0000789019", "ticker": "MSFT" }], "userAgent": "561 Group issuer evidence support@561.group", "maximumIssuers": 5, "maximumBytes": 8388608, "timeoutMs": 1e4, "minimumIntervalMs": 1e3, "maximumAgeDays": { "quarter": 150, "annual": 550 }, "cacheKey": "issuer-research/current.json", "maximumSnapshotAgeMs": 36e5, "maximumCohortBytes": 524288, "allowedPeriodKinds": ["annual"], "allowAmbiguousEvidence": true }, started = Date.now(), sources = [aapl, msft], calls = [], sleeps = [];
  const cohort = await prepareIssuerRevenueCohort(c, { now: Date.now, sleep: async (ms) => {
    sleeps.push(ms);
  }, fetch: async (url, init) => {
    const request = new Request(url, init);
    if (request.redirect !== "manual") throw Error("redirect");
    const position = calls.length;
    calls.push(url);
    return new Response(sources[position]);
  } });
  const annual = selectPreparedIssuerRevenueComparison({ body: { periodKind: "annual" }, configuration: c, cohort, now: Date.now() });
  if (calls.length !== 2 || sleeps.length !== 1 || sleeps[0] !== 1e3) throw Error("bounded source count/interval");
  if (annual.issuers.some((x) => x.status !== "current") || cohort.results.quarter.issuers[1].status !== "stale") throw Error("actual financial periods changed");
  console.log("FULL_COMPANYFACTS_RECEIVING " + JSON.stringify({ sourceSha256: "ca5ec47a426af6f86bf53be8b8ee3a21ea83b2b4dcc983f90fe43f1d1ab21bc5", observedAt: cohort.observedAt, asOf: cohort.asOf, cohortBytes: new TextEncoder().encode(JSON.stringify(cohort)).length, annualBytes: new TextEncoder().encode(JSON.stringify(annual)).length, annual: annual.issuers.map((i) => ({ ticker: i.ticker, value: i.value, status: i.status, period: i.period, source: i.source })), quarter: cohort.results.quarter.issuers.map((i) => ({ ticker: i.ticker, status: i.status, period: i.period })), comparability: annual.comparability, fixtureClockElapsedMs: Date.now() - started, fixtureSourceStringsRetained: true, actualNetwork: false }));
} };
export {
  fullCompanyfactsPreparation
};
