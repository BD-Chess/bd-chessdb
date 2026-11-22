var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key2 of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key2) && key2 !== except && __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));

// node_modules/protobufjs/src/util/aspromise.js
var require_aspromise = __commonJS({
  "node_modules/protobufjs/src/util/aspromise.js"(exports, module) {
    "use strict";
    module.exports = asPromise;
    function asPromise(fn, ctx) {
      for (var params = new Array(arguments.length - 1), offset = 0, index = 2, pending = !0; index < arguments.length; )
        params[offset++] = arguments[index++];
      return new Promise(function(resolve, reject) {
        params[offset] = function(err) {
          if (pending)
            if (pending = !1, err)
              reject(err);
            else {
              for (var params2 = new Array(arguments.length - 1), offset2 = 0; offset2 < params2.length; )
                params2[offset2++] = arguments[offset2];
              resolve.apply(null, params2);
            }
        };
        try {
          fn.apply(ctx || null, params);
        } catch (err) {
          pending && (pending = !1, reject(err));
        }
      });
    }
  }
});

// node_modules/protobufjs/src/util/base64.js
var require_base64 = __commonJS({
  "node_modules/protobufjs/src/util/base64.js"(exports) {
    "use strict";
    var base64 = exports;
    base64.length = function(string) {
      var p = string.length;
      if (!p)
        return 0;
      for (; p > 0 && string.charAt(p - 1) === "="; )
        --p;
      return Math.floor(p * 3 / 4);
    };
    var b64 = new Array(64), s64 = new Array(123);
    for (i = 0; i < 64; )
      s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
    var i;
    s64[45] = 62;
    s64[95] = 63;
    base64.encode = function(buffer, start, end) {
      for (var parts = null, chunk = [], i2 = 0, j = 0, t; start < end; ) {
        var b = buffer[start++];
        switch (j) {
          case 0:
            chunk[i2++] = b64[b >> 2], t = (b & 3) << 4, j = 1;
            break;
          case 1:
            chunk[i2++] = b64[t | b >> 4], t = (b & 15) << 2, j = 2;
            break;
          case 2:
            chunk[i2++] = b64[t | b >> 6], chunk[i2++] = b64[b & 63], j = 0;
            break;
        }
        i2 > 8191 && ((parts || (parts = [])).push(String.fromCharCode.apply(String, chunk)), i2 = 0);
      }
      return j && (chunk[i2++] = b64[t], chunk[i2++] = 61, j === 1 && (chunk[i2++] = 61)), parts ? (i2 && parts.push(String.fromCharCode.apply(String, chunk.slice(0, i2))), parts.join("")) : String.fromCharCode.apply(String, chunk.slice(0, i2));
    };
    var invalidEncoding = "invalid encoding";
    base64.decode = function(string, buffer, offset) {
      for (var start = offset, j = 0, t, i2 = 0; i2 < string.length; ) {
        var c = string.charCodeAt(i2++);
        if (c === 61 && j > 1)
          break;
        if ((c = s64[c]) === void 0)
          throw Error(invalidEncoding);
        switch (j) {
          case 0:
            t = c, j = 1;
            break;
          case 1:
            buffer[offset++] = t << 2 | (c & 48) >> 4, t = c, j = 2;
            break;
          case 2:
            buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2, t = c, j = 3;
            break;
          case 3:
            buffer[offset++] = (t & 3) << 6 | c, j = 0;
            break;
        }
      }
      if (j === 1)
        throw Error(invalidEncoding);
      return offset - start;
    };
    var base64Re = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, base64UrlRe = /[-_]/, base64UrlNoPaddingRe = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;
    base64.test = function(string) {
      return base64Re.test(string) || base64UrlRe.test(string) && base64UrlNoPaddingRe.test(string);
    };
  }
});

// node_modules/protobufjs/src/util/eventemitter.js
var require_eventemitter = __commonJS({
  "node_modules/protobufjs/src/util/eventemitter.js"(exports, module) {
    "use strict";
    module.exports = EventEmitter;
    function EventEmitter() {
      this._listeners = /* @__PURE__ */ Object.create(null);
    }
    EventEmitter.prototype.on = function(evt, fn, ctx) {
      return (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn,
        ctx: ctx || this
      }), this;
    };
    EventEmitter.prototype.off = function(evt, fn) {
      if (evt === void 0)
        this._listeners = /* @__PURE__ */ Object.create(null);
      else if (fn === void 0)
        this._listeners[evt] = [];
      else {
        var listeners = this._listeners[evt];
        if (!listeners)
          return this;
        for (var i = 0; i < listeners.length; )
          listeners[i].fn === fn ? listeners.splice(i, 1) : ++i;
      }
      return this;
    };
    EventEmitter.prototype.emit = function(evt) {
      var listeners = this._listeners[evt];
      if (listeners) {
        for (var args = [], i = 1; i < arguments.length; )
          args.push(arguments[i++]);
        for (i = 0; i < listeners.length; )
          listeners[i].fn.apply(listeners[i++].ctx, args);
      }
      return this;
    };
  }
});

// node_modules/protobufjs/src/util/float.js
var require_float = __commonJS({
  "node_modules/protobufjs/src/util/float.js"(exports, module) {
    "use strict";
    module.exports = factory(factory);
    function factory(exports2) {
      return typeof Float32Array < "u" ? (function() {
        var f32 = new Float32Array([-0]), f8b = new Uint8Array(f32.buffer), le = f8b[3] === 128;
        function writeFloat_f32_cpy(val, buf, pos) {
          f32[0] = val, buf[pos] = f8b[0], buf[pos + 1] = f8b[1], buf[pos + 2] = f8b[2], buf[pos + 3] = f8b[3];
        }
        function writeFloat_f32_rev(val, buf, pos) {
          f32[0] = val, buf[pos] = f8b[3], buf[pos + 1] = f8b[2], buf[pos + 2] = f8b[1], buf[pos + 3] = f8b[0];
        }
        exports2.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev, exports2.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;
        function readFloat_f32_cpy(buf, pos) {
          return f8b[0] = buf[pos], f8b[1] = buf[pos + 1], f8b[2] = buf[pos + 2], f8b[3] = buf[pos + 3], f32[0];
        }
        function readFloat_f32_rev(buf, pos) {
          return f8b[3] = buf[pos], f8b[2] = buf[pos + 1], f8b[1] = buf[pos + 2], f8b[0] = buf[pos + 3], f32[0];
        }
        exports2.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev, exports2.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;
      })() : (function() {
        function writeFloat_ieee754(writeUint, val, buf, pos) {
          var sign = val < 0 ? 1 : 0;
          if (sign && (val = -val), val === 0)
            writeUint(1 / val > 0 ? (
              /* positive */
              0
            ) : (
              /* negative 0 */
              2147483648
            ), buf, pos);
          else if (isNaN(val))
            writeUint(2143289344, buf, pos);
          else if (val > 34028234663852886e22)
            writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
          else if (val < 11754943508222875e-54)
            writeUint((sign << 31 | Math.round(val / 1401298464324817e-60)) >>> 0, buf, pos);
          else {
            var exponent = Math.floor(Math.log(val) / Math.LN2), mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
            writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
          }
        }
        exports2.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE), exports2.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);
        function readFloat_ieee754(readUint, buf, pos) {
          var uint = readUint(buf, pos), sign = (uint >> 31) * 2 + 1, exponent = uint >>> 23 & 255, mantissa = uint & 8388607;
          return exponent === 255 ? mantissa ? NaN : sign * (1 / 0) : exponent === 0 ? sign * 1401298464324817e-60 * mantissa : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
        }
        exports2.readFloatLE = readFloat_ieee754.bind(null, readUintLE), exports2.readFloatBE = readFloat_ieee754.bind(null, readUintBE);
      })(), typeof Float64Array < "u" ? (function() {
        var f64 = new Float64Array([-0]), f8b = new Uint8Array(f64.buffer), le = f8b[7] === 128;
        function writeDouble_f64_cpy(val, buf, pos) {
          f64[0] = val, buf[pos] = f8b[0], buf[pos + 1] = f8b[1], buf[pos + 2] = f8b[2], buf[pos + 3] = f8b[3], buf[pos + 4] = f8b[4], buf[pos + 5] = f8b[5], buf[pos + 6] = f8b[6], buf[pos + 7] = f8b[7];
        }
        function writeDouble_f64_rev(val, buf, pos) {
          f64[0] = val, buf[pos] = f8b[7], buf[pos + 1] = f8b[6], buf[pos + 2] = f8b[5], buf[pos + 3] = f8b[4], buf[pos + 4] = f8b[3], buf[pos + 5] = f8b[2], buf[pos + 6] = f8b[1], buf[pos + 7] = f8b[0];
        }
        exports2.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev, exports2.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;
        function readDouble_f64_cpy(buf, pos) {
          return f8b[0] = buf[pos], f8b[1] = buf[pos + 1], f8b[2] = buf[pos + 2], f8b[3] = buf[pos + 3], f8b[4] = buf[pos + 4], f8b[5] = buf[pos + 5], f8b[6] = buf[pos + 6], f8b[7] = buf[pos + 7], f64[0];
        }
        function readDouble_f64_rev(buf, pos) {
          return f8b[7] = buf[pos], f8b[6] = buf[pos + 1], f8b[5] = buf[pos + 2], f8b[4] = buf[pos + 3], f8b[3] = buf[pos + 4], f8b[2] = buf[pos + 5], f8b[1] = buf[pos + 6], f8b[0] = buf[pos + 7], f64[0];
        }
        exports2.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev, exports2.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;
      })() : (function() {
        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
          var sign = val < 0 ? 1 : 0;
          if (sign && (val = -val), val === 0)
            writeUint(0, buf, pos + off0), writeUint(1 / val > 0 ? (
              /* positive */
              0
            ) : (
              /* negative 0 */
              2147483648
            ), buf, pos + off1);
          else if (isNaN(val))
            writeUint(0, buf, pos + off0), writeUint(2146959360, buf, pos + off1);
          else if (val > 17976931348623157e292)
            writeUint(0, buf, pos + off0), writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
          else {
            var mantissa;
            if (val < 22250738585072014e-324)
              mantissa = val / 5e-324, writeUint(mantissa >>> 0, buf, pos + off0), writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
            else {
              var exponent = Math.floor(Math.log(val) / Math.LN2);
              exponent === 1024 && (exponent = 1023), mantissa = val * Math.pow(2, -exponent), writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0), writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
            }
          }
        }
        exports2.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4), exports2.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);
        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
          var lo = readUint(buf, pos + off0), hi = readUint(buf, pos + off1), sign = (hi >> 31) * 2 + 1, exponent = hi >>> 20 & 2047, mantissa = 4294967296 * (hi & 1048575) + lo;
          return exponent === 2047 ? mantissa ? NaN : sign * (1 / 0) : exponent === 0 ? sign * 5e-324 * mantissa : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
        }
        exports2.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4), exports2.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);
      })(), exports2;
    }
    function writeUintLE(val, buf, pos) {
      buf[pos] = val & 255, buf[pos + 1] = val >>> 8 & 255, buf[pos + 2] = val >>> 16 & 255, buf[pos + 3] = val >>> 24;
    }
    function writeUintBE(val, buf, pos) {
      buf[pos] = val >>> 24, buf[pos + 1] = val >>> 16 & 255, buf[pos + 2] = val >>> 8 & 255, buf[pos + 3] = val & 255;
    }
    function readUintLE(buf, pos) {
      return (buf[pos] | buf[pos + 1] << 8 | buf[pos + 2] << 16 | buf[pos + 3] << 24) >>> 0;
    }
    function readUintBE(buf, pos) {
      return (buf[pos] << 24 | buf[pos + 1] << 16 | buf[pos + 2] << 8 | buf[pos + 3]) >>> 0;
    }
  }
});

// node_modules/protobufjs/src/util/utf8.js
var require_utf8 = __commonJS({
  "node_modules/protobufjs/src/util/utf8.js"(exports) {
    "use strict";
    var utf8 = exports, looseDecoder = new TextDecoder("utf-8", { ignoreBOM: !0 }), strictDecoder, TEXT_DECODER_MIN_LENGTH = 64;
    try {
      strictDecoder = new TextDecoder("utf-8", { fatal: !0, ignoreBOM: !0 });
    } catch {
      strictDecoder = looseDecoder;
    }
    utf8.length = function(string) {
      for (var len = 0, c = 0, i = 0; i < string.length; ++i)
        c = string.charCodeAt(i), c < 128 ? len += 1 : c < 2048 ? len += 2 : (c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320 ? (++i, len += 4) : len += 3;
      return len;
    };
    function utf8_read_decoder(decoder, buffer, start, end) {
      var source = start === 0 && end === buffer.length ? buffer : buffer.subarray(start, end);
      return decoder.decode(source);
    }
    utf8.read = function(buffer, start, end) {
      if (end - start < 1)
        return "";
      if (end - start >= TEXT_DECODER_MIN_LENGTH)
        return utf8_read_decoder(looseDecoder, buffer, start, end);
      for (var str = "", i = start, c1, c2, c3, c4, c5, c6, c7, c8; i + 7 < end; i += 8) {
        if (c1 = buffer[i], c2 = buffer[i + 1], c3 = buffer[i + 2], c4 = buffer[i + 3], c5 = buffer[i + 4], c6 = buffer[i + 5], c7 = buffer[i + 6], c8 = buffer[i + 7], (c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 128)
          return str + utf8_read_decoder(looseDecoder, buffer, i, end);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
      }
      for (; i < end; ++i) {
        if (c1 = buffer[i], c1 & 128)
          return str + utf8_read_decoder(looseDecoder, buffer, i, end);
        str += String.fromCharCode(c1);
      }
      return str;
    };
    utf8.readStrict = function(buffer, start, end) {
      if (end - start < 1)
        return "";
      if (end - start >= TEXT_DECODER_MIN_LENGTH)
        return utf8_read_decoder(strictDecoder, buffer, start, end);
      for (var str = "", i = start, c1, c2, c3, c4, c5, c6, c7, c8; i + 7 < end; i += 8) {
        if (c1 = buffer[i], c2 = buffer[i + 1], c3 = buffer[i + 2], c4 = buffer[i + 3], c5 = buffer[i + 4], c6 = buffer[i + 5], c7 = buffer[i + 6], c8 = buffer[i + 7], (c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 128)
          return str + utf8_read_decoder(strictDecoder, buffer, i, end);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
      }
      for (; i < end; ++i) {
        if (c1 = buffer[i], c1 & 128)
          return str + utf8_read_decoder(strictDecoder, buffer, i, end);
        str += String.fromCharCode(c1);
      }
      return str;
    };
    utf8.write = function(string, buffer, offset) {
      for (var start = offset, c1, c2, i = 0; i < string.length; ++i)
        c1 = string.charCodeAt(i), c1 < 128 ? buffer[offset++] = c1 : c1 < 2048 ? (buffer[offset++] = c1 >> 6 | 192, buffer[offset++] = c1 & 63 | 128) : (c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320 ? (c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023), ++i, buffer[offset++] = c1 >> 18 | 240, buffer[offset++] = c1 >> 12 & 63 | 128, buffer[offset++] = c1 >> 6 & 63 | 128, buffer[offset++] = c1 & 63 | 128) : (buffer[offset++] = c1 >> 12 | 224, buffer[offset++] = c1 >> 6 & 63 | 128, buffer[offset++] = c1 & 63 | 128);
      return offset - start;
    };
  }
});

// node_modules/protobufjs/src/util/pool.js
var require_pool = __commonJS({
  "node_modules/protobufjs/src/util/pool.js"(exports, module) {
    "use strict";
    module.exports = pool;
    function pool(alloc, slice, size) {
      var SIZE = size || 8192, MAX = SIZE >>> 1, slab = null, offset = SIZE;
      return function(size2) {
        if (size2 < 1 || size2 > MAX)
          return alloc(size2);
        offset + size2 > SIZE && (slab = alloc(SIZE), offset = 0);
        var buf = slice.call(slab, offset, offset += size2);
        return offset & 7 && (offset = (offset | 7) + 1), buf;
      };
    }
  }
});

// node_modules/protobufjs/src/util/longbits.js
var require_longbits = __commonJS({
  "node_modules/protobufjs/src/util/longbits.js"(exports, module) {
    "use strict";
    module.exports = LongBits;
    var Long2;
    function LongBits(lo, hi) {
      this.lo = lo >>> 0, this.hi = hi >>> 0;
    }
    var zero = LongBits.zero = new LongBits(0, 0);
    zero.toNumber = function() {
      return 0;
    };
    zero.zzEncode = zero.zzDecode = function() {
      return this;
    };
    zero.length = function() {
      return 1;
    };
    var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";
    LongBits.fromNumber = function(value) {
      if (value === 0)
        return zero;
      var sign = value < 0;
      sign && (value = -value);
      var lo = value >>> 0, hi = (value - lo) / 4294967296 >>> 0;
      return sign && (hi = ~hi >>> 0, lo = ~lo >>> 0, ++lo > 4294967295 && (lo = 0, ++hi > 4294967295 && (hi = 0))), new LongBits(lo, hi);
    };
    LongBits.from = function(value) {
      if (typeof value == "number")
        return LongBits.fromNumber(value);
      if (typeof value == "string" || value instanceof String)
        if (Long2)
          value = Long2.fromString(value);
        else
          return LongBits.fromNumber(parseInt(value, 10));
      return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
    };
    LongBits.prototype.toNumber = function(unsigned) {
      if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0, hi = ~this.hi >>> 0;
        return lo || (hi = hi + 1 >>> 0), -(lo + hi * 4294967296);
      }
      return this.lo + this.hi * 4294967296;
    };
    LongBits.prototype.toLong = function(unsigned) {
      return Long2 ? new Long2(this.lo | 0, this.hi | 0, !!unsigned) : { low: this.lo | 0, high: this.hi | 0, unsigned: !!unsigned };
    };
    var charCodeAt = String.prototype.charCodeAt;
    LongBits.fromHash = function(hash) {
      return hash === zeroHash ? zero : new LongBits(
        (charCodeAt.call(hash, 0) | charCodeAt.call(hash, 1) << 8 | charCodeAt.call(hash, 2) << 16 | charCodeAt.call(hash, 3) << 24) >>> 0,
        (charCodeAt.call(hash, 4) | charCodeAt.call(hash, 5) << 8 | charCodeAt.call(hash, 6) << 16 | charCodeAt.call(hash, 7) << 24) >>> 0
      );
    };
    LongBits.prototype.toHash = function() {
      return String.fromCharCode(
        this.lo & 255,
        this.lo >>> 8 & 255,
        this.lo >>> 16 & 255,
        this.lo >>> 24,
        this.hi & 255,
        this.hi >>> 8 & 255,
        this.hi >>> 16 & 255,
        this.hi >>> 24
      );
    };
    LongBits.prototype.zzEncode = function() {
      var mask = this.hi >> 31;
      return this.hi = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0, this.lo = (this.lo << 1 ^ mask) >>> 0, this;
    };
    LongBits.prototype.zzDecode = function() {
      var mask = -(this.lo & 1);
      return this.lo = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0, this.hi = (this.hi >>> 1 ^ mask) >>> 0, this;
    };
    LongBits.prototype.length = function() {
      var part0 = this.lo, part1 = (this.lo >>> 28 | this.hi << 4) >>> 0, part2 = this.hi >>> 24;
      return part2 === 0 ? part1 === 0 ? part0 < 16384 ? part0 < 128 ? 1 : 2 : part0 < 2097152 ? 3 : 4 : part1 < 16384 ? part1 < 128 ? 5 : 6 : part1 < 2097152 ? 7 : 8 : part2 < 128 ? 9 : 10;
    };
    LongBits._configure = function(Long_) {
      Long2 = Long_;
    };
  }
});

// node_modules/long/umd/index.js
var require_umd = __commonJS({
  "node_modules/long/umd/index.js"(exports, module) {
    (function(global2, factory) {
      function preferDefault(exports2) {
        return exports2.default || exports2;
      }
      typeof define == "function" && define.amd ? define([], function() {
        var exports2 = {};
        return factory(exports2), preferDefault(exports2);
      }) : typeof exports == "object" ? (factory(exports), typeof module == "object" && (module.exports = preferDefault(exports))) : (function() {
        var exports2 = {};
        factory(exports2), global2.Long = preferDefault(exports2);
      })();
    })(
      typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : exports,
      function(_exports) {
        "use strict";
        Object.defineProperty(_exports, "__esModule", {
          value: !0
        }), _exports.default = void 0;
        var wasm = null;
        try {
          wasm = new WebAssembly.Instance(
            new WebAssembly.Module(
              new Uint8Array([
                // \0asm
                0,
                97,
                115,
                109,
                // version 1
                1,
                0,
                0,
                0,
                // section "type"
                1,
                13,
                2,
                // 0, () => i32
                96,
                0,
                1,
                127,
                // 1, (i32, i32, i32, i32) => i32
                96,
                4,
                127,
                127,
                127,
                127,
                1,
                127,
                // section "function"
                3,
                7,
                6,
                // 0, type 0
                0,
                // 1, type 1
                1,
                // 2, type 1
                1,
                // 3, type 1
                1,
                // 4, type 1
                1,
                // 5, type 1
                1,
                // section "global"
                6,
                6,
                1,
                // 0, "high", mutable i32
                127,
                1,
                65,
                0,
                11,
                // section "export"
                7,
                50,
                6,
                // 0, "mul"
                3,
                109,
                117,
                108,
                0,
                1,
                // 1, "div_s"
                5,
                100,
                105,
                118,
                95,
                115,
                0,
                2,
                // 2, "div_u"
                5,
                100,
                105,
                118,
                95,
                117,
                0,
                3,
                // 3, "rem_s"
                5,
                114,
                101,
                109,
                95,
                115,
                0,
                4,
                // 4, "rem_u"
                5,
                114,
                101,
                109,
                95,
                117,
                0,
                5,
                // 5, "get_high"
                8,
                103,
                101,
                116,
                95,
                104,
                105,
                103,
                104,
                0,
                0,
                // section "code"
                10,
                191,
                1,
                6,
                // 0, "get_high"
                4,
                0,
                35,
                0,
                11,
                // 1, "mul"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                126,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 2, "div_s"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                127,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 3, "div_u"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                128,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 4, "rem_s"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                129,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11,
                // 5, "rem_u"
                36,
                1,
                1,
                126,
                32,
                0,
                173,
                32,
                1,
                173,
                66,
                32,
                134,
                132,
                32,
                2,
                173,
                32,
                3,
                173,
                66,
                32,
                134,
                132,
                130,
                34,
                4,
                66,
                32,
                135,
                167,
                36,
                0,
                32,
                4,
                167,
                11
              ])
            ),
            {}
          ).exports;
        } catch {
        }
        function Long2(low, high, unsigned) {
          this.low = low | 0, this.high = high | 0, this.unsigned = !!unsigned;
        }
        Long2.prototype.__isLong__, Object.defineProperty(Long2.prototype, "__isLong__", {
          value: !0
        });
        function isLong(obj) {
          return (obj && obj.__isLong__) === !0;
        }
        function ctz32(value) {
          var c = Math.clz32(value & -value);
          return value ? 31 - c : c;
        }
        Long2.isLong = isLong;
        var INT_CACHE = {}, UINT_CACHE = {};
        function fromInt(value, unsigned) {
          var obj, cachedObj, cache;
          return unsigned ? (value >>>= 0, (cache = 0 <= value && value < 256) && (cachedObj = UINT_CACHE[value], cachedObj) ? cachedObj : (obj = fromBits(value, 0, !0), cache && (UINT_CACHE[value] = obj), obj)) : (value |= 0, (cache = -128 <= value && value < 128) && (cachedObj = INT_CACHE[value], cachedObj) ? cachedObj : (obj = fromBits(value, value < 0 ? -1 : 0, !1), cache && (INT_CACHE[value] = obj), obj));
        }
        Long2.fromInt = fromInt;
        function fromNumber(value, unsigned) {
          if (isNaN(value)) return unsigned ? UZERO : ZERO;
          if (unsigned) {
            if (value < 0) return UZERO;
            if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
          } else {
            if (value <= -TWO_PWR_63_DBL) return MIN_VALUE;
            if (value + 1 >= TWO_PWR_63_DBL) return MAX_VALUE;
          }
          return value < 0 ? fromNumber(-value, unsigned).neg() : fromBits(
            value % TWO_PWR_32_DBL2 | 0,
            value / TWO_PWR_32_DBL2 | 0,
            unsigned
          );
        }
        Long2.fromNumber = fromNumber;
        function fromBits(lowBits, highBits, unsigned) {
          return new Long2(lowBits, highBits, unsigned);
        }
        Long2.fromBits = fromBits;
        var pow_dbl = Math.pow;
        function fromString(str, unsigned, radix) {
          if (str.length === 0) throw Error("empty string");
          if (typeof unsigned == "number" ? (radix = unsigned, unsigned = !1) : unsigned = !!unsigned, str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity")
            return unsigned ? UZERO : ZERO;
          if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
          var p;
          if ((p = str.indexOf("-")) > 0) throw Error("interior hyphen");
          if (p === 0)
            return fromString(str.substring(1), unsigned, radix).neg();
          for (var radixToPower = fromNumber(pow_dbl(radix, 8)), result = ZERO, i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
              var power = fromNumber(pow_dbl(radix, size));
              result = result.mul(power).add(fromNumber(value));
            } else
              result = result.mul(radixToPower), result = result.add(fromNumber(value));
          }
          return result.unsigned = unsigned, result;
        }
        Long2.fromString = fromString;
        function fromValue(val, unsigned) {
          return typeof val == "number" ? fromNumber(val, unsigned) : typeof val == "string" ? fromString(val, unsigned) : fromBits(
            val.low,
            val.high,
            typeof unsigned == "boolean" ? unsigned : val.unsigned
          );
        }
        Long2.fromValue = fromValue;
        var TWO_PWR_16_DBL = 65536, TWO_PWR_24_DBL = 1 << 24, TWO_PWR_32_DBL2 = TWO_PWR_16_DBL * TWO_PWR_16_DBL, TWO_PWR_64_DBL = TWO_PWR_32_DBL2 * TWO_PWR_32_DBL2, TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2, TWO_PWR_24 = fromInt(TWO_PWR_24_DBL), ZERO = fromInt(0);
        Long2.ZERO = ZERO;
        var UZERO = fromInt(0, !0);
        Long2.UZERO = UZERO;
        var ONE = fromInt(1);
        Long2.ONE = ONE;
        var UONE = fromInt(1, !0);
        Long2.UONE = UONE;
        var NEG_ONE = fromInt(-1);
        Long2.NEG_ONE = NEG_ONE;
        var MAX_VALUE = fromBits(-1, 2147483647, !1);
        Long2.MAX_VALUE = MAX_VALUE;
        var MAX_UNSIGNED_VALUE = fromBits(-1, -1, !0);
        Long2.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;
        var MIN_VALUE = fromBits(0, -2147483648, !1);
        Long2.MIN_VALUE = MIN_VALUE;
        var LongPrototype = Long2.prototype;
        LongPrototype.toInt = function() {
          return this.unsigned ? this.low >>> 0 : this.low;
        }, LongPrototype.toNumber = function() {
          return this.unsigned ? (this.high >>> 0) * TWO_PWR_32_DBL2 + (this.low >>> 0) : this.high * TWO_PWR_32_DBL2 + (this.low >>> 0);
        }, LongPrototype.toString = function(radix) {
          if (radix = radix || 10, radix < 2 || 36 < radix) throw RangeError("radix");
          if (this.isZero()) return "0";
          if (this.isNegative())
            if (this.eq(MIN_VALUE)) {
              var radixLong = fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
              return div.toString(radix) + rem1.toInt().toString(radix);
            } else return "-" + this.neg().toString(radix);
          for (var radixToPower = fromNumber(pow_dbl(radix, 6), this.unsigned), rem = this, result = ""; ; ) {
            var remDiv = rem.div(radixToPower), intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0, digits = intval.toString(radix);
            if (rem = remDiv, rem.isZero()) return digits + result;
            for (; digits.length < 6; ) digits = "0" + digits;
            result = "" + digits + result;
          }
        }, LongPrototype.getHighBits = function() {
          return this.high;
        }, LongPrototype.getHighBitsUnsigned = function() {
          return this.high >>> 0;
        }, LongPrototype.getLowBits = function() {
          return this.low;
        }, LongPrototype.getLowBitsUnsigned = function() {
          return this.low >>> 0;
        }, LongPrototype.getNumBitsAbs = function() {
          if (this.isNegative())
            return this.eq(MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
          for (var val = this.high != 0 ? this.high : this.low, bit = 31; bit > 0 && (val & 1 << bit) == 0; bit--) ;
          return this.high != 0 ? bit + 33 : bit + 1;
        }, LongPrototype.isSafeInteger = function() {
          var top11Bits = this.high >> 21;
          return top11Bits ? this.unsigned ? !1 : top11Bits === -1 && !(this.low === 0 && this.high === -2097152) : !0;
        }, LongPrototype.isZero = function() {
          return this.high === 0 && this.low === 0;
        }, LongPrototype.eqz = LongPrototype.isZero, LongPrototype.isNegative = function() {
          return !this.unsigned && this.high < 0;
        }, LongPrototype.isPositive = function() {
          return this.unsigned || this.high >= 0;
        }, LongPrototype.isOdd = function() {
          return (this.low & 1) === 1;
        }, LongPrototype.isEven = function() {
          return (this.low & 1) === 0;
        }, LongPrototype.equals = function(other) {
          return isLong(other) || (other = fromValue(other)), this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1 ? !1 : this.high === other.high && this.low === other.low;
        }, LongPrototype.eq = LongPrototype.equals, LongPrototype.notEquals = function(other) {
          return !this.eq(
            /* validates */
            other
          );
        }, LongPrototype.neq = LongPrototype.notEquals, LongPrototype.ne = LongPrototype.notEquals, LongPrototype.lessThan = function(other) {
          return this.comp(
            /* validates */
            other
          ) < 0;
        }, LongPrototype.lt = LongPrototype.lessThan, LongPrototype.lessThanOrEqual = function(other) {
          return this.comp(
            /* validates */
            other
          ) <= 0;
        }, LongPrototype.lte = LongPrototype.lessThanOrEqual, LongPrototype.le = LongPrototype.lessThanOrEqual, LongPrototype.greaterThan = function(other) {
          return this.comp(
            /* validates */
            other
          ) > 0;
        }, LongPrototype.gt = LongPrototype.greaterThan, LongPrototype.greaterThanOrEqual = function(other) {
          return this.comp(
            /* validates */
            other
          ) >= 0;
        }, LongPrototype.gte = LongPrototype.greaterThanOrEqual, LongPrototype.ge = LongPrototype.greaterThanOrEqual, LongPrototype.compare = function(other) {
          if (isLong(other) || (other = fromValue(other)), this.eq(other)) return 0;
          var thisNeg = this.isNegative(), otherNeg = other.isNegative();
          return thisNeg && !otherNeg ? -1 : !thisNeg && otherNeg ? 1 : this.unsigned ? other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1 : this.sub(other).isNegative() ? -1 : 1;
        }, LongPrototype.comp = LongPrototype.compare, LongPrototype.negate = function() {
          return !this.unsigned && this.eq(MIN_VALUE) ? MIN_VALUE : this.not().add(ONE);
        }, LongPrototype.neg = LongPrototype.negate, LongPrototype.add = function(addend) {
          isLong(addend) || (addend = fromValue(addend));
          var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = addend.high >>> 16, b32 = addend.high & 65535, b16 = addend.low >>> 16, b00 = addend.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
          return c00 += a00 + b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 + b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 + b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 + b48, c48 &= 65535, fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
        }, LongPrototype.subtract = function(subtrahend) {
          return isLong(subtrahend) || (subtrahend = fromValue(subtrahend)), this.add(subtrahend.neg());
        }, LongPrototype.sub = LongPrototype.subtract, LongPrototype.multiply = function(multiplier) {
          if (this.isZero()) return this;
          if (isLong(multiplier) || (multiplier = fromValue(multiplier)), wasm) {
            var low = wasm.mul(
              this.low,
              this.high,
              multiplier.low,
              multiplier.high
            );
            return fromBits(low, wasm.get_high(), this.unsigned);
          }
          if (multiplier.isZero()) return this.unsigned ? UZERO : ZERO;
          if (this.eq(MIN_VALUE)) return multiplier.isOdd() ? MIN_VALUE : ZERO;
          if (multiplier.eq(MIN_VALUE)) return this.isOdd() ? MIN_VALUE : ZERO;
          if (this.isNegative())
            return multiplier.isNegative() ? this.neg().mul(multiplier.neg()) : this.neg().mul(multiplier).neg();
          if (multiplier.isNegative())
            return this.mul(multiplier.neg()).neg();
          if (this.lt(TWO_PWR_24) && multiplier.lt(TWO_PWR_24))
            return fromNumber(
              this.toNumber() * multiplier.toNumber(),
              this.unsigned
            );
          var a48 = this.high >>> 16, a32 = this.high & 65535, a16 = this.low >>> 16, a00 = this.low & 65535, b48 = multiplier.high >>> 16, b32 = multiplier.high & 65535, b16 = multiplier.low >>> 16, b00 = multiplier.low & 65535, c48 = 0, c32 = 0, c16 = 0, c00 = 0;
          return c00 += a00 * b00, c16 += c00 >>> 16, c00 &= 65535, c16 += a16 * b00, c32 += c16 >>> 16, c16 &= 65535, c16 += a00 * b16, c32 += c16 >>> 16, c16 &= 65535, c32 += a32 * b00, c48 += c32 >>> 16, c32 &= 65535, c32 += a16 * b16, c48 += c32 >>> 16, c32 &= 65535, c32 += a00 * b32, c48 += c32 >>> 16, c32 &= 65535, c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48, c48 &= 65535, fromBits(c16 << 16 | c00, c48 << 16 | c32, this.unsigned);
        }, LongPrototype.mul = LongPrototype.multiply, LongPrototype.divide = function(divisor) {
          if (isLong(divisor) || (divisor = fromValue(divisor)), divisor.isZero()) throw Error("division by zero");
          if (wasm) {
            if (!this.unsigned && this.high === -2147483648 && divisor.low === -1 && divisor.high === -1)
              return this;
            var low = (this.unsigned ? wasm.div_u : wasm.div_s)(
              this.low,
              this.high,
              divisor.low,
              divisor.high
            );
            return fromBits(low, wasm.get_high(), this.unsigned);
          }
          if (this.isZero()) return this.unsigned ? UZERO : ZERO;
          var approx, rem, res;
          if (this.unsigned) {
            if (divisor.unsigned || (divisor = divisor.toUnsigned()), divisor.gt(this)) return UZERO;
            if (divisor.gt(this.shru(1)))
              return UONE;
            res = UZERO;
          } else {
            if (this.eq(MIN_VALUE)) {
              if (divisor.eq(ONE) || divisor.eq(NEG_ONE))
                return MIN_VALUE;
              if (divisor.eq(MIN_VALUE)) return ONE;
              var halfThis = this.shr(1);
              return approx = halfThis.div(divisor).shl(1), approx.eq(ZERO) ? divisor.isNegative() ? ONE : NEG_ONE : (rem = this.sub(divisor.mul(approx)), res = approx.add(rem.div(divisor)), res);
            } else if (divisor.eq(MIN_VALUE)) return this.unsigned ? UZERO : ZERO;
            if (this.isNegative())
              return divisor.isNegative() ? this.neg().div(divisor.neg()) : this.neg().div(divisor).neg();
            if (divisor.isNegative()) return this.div(divisor.neg()).neg();
            res = ZERO;
          }
          for (rem = this; rem.gte(divisor); ) {
            approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
            for (var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = log2 <= 48 ? 1 : pow_dbl(2, log2 - 48), approxRes = fromNumber(approx), approxRem = approxRes.mul(divisor); approxRem.isNegative() || approxRem.gt(rem); )
              approx -= delta, approxRes = fromNumber(approx, this.unsigned), approxRem = approxRes.mul(divisor);
            approxRes.isZero() && (approxRes = ONE), res = res.add(approxRes), rem = rem.sub(approxRem);
          }
          return res;
        }, LongPrototype.div = LongPrototype.divide, LongPrototype.modulo = function(divisor) {
          if (isLong(divisor) || (divisor = fromValue(divisor)), wasm) {
            var low = (this.unsigned ? wasm.rem_u : wasm.rem_s)(
              this.low,
              this.high,
              divisor.low,
              divisor.high
            );
            return fromBits(low, wasm.get_high(), this.unsigned);
          }
          return this.sub(this.div(divisor).mul(divisor));
        }, LongPrototype.mod = LongPrototype.modulo, LongPrototype.rem = LongPrototype.modulo, LongPrototype.not = function() {
          return fromBits(~this.low, ~this.high, this.unsigned);
        }, LongPrototype.countLeadingZeros = function() {
          return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
        }, LongPrototype.clz = LongPrototype.countLeadingZeros, LongPrototype.countTrailingZeros = function() {
          return this.low ? ctz32(this.low) : ctz32(this.high) + 32;
        }, LongPrototype.ctz = LongPrototype.countTrailingZeros, LongPrototype.and = function(other) {
          return isLong(other) || (other = fromValue(other)), fromBits(
            this.low & other.low,
            this.high & other.high,
            this.unsigned
          );
        }, LongPrototype.or = function(other) {
          return isLong(other) || (other = fromValue(other)), fromBits(
            this.low | other.low,
            this.high | other.high,
            this.unsigned
          );
        }, LongPrototype.xor = function(other) {
          return isLong(other) || (other = fromValue(other)), fromBits(
            this.low ^ other.low,
            this.high ^ other.high,
            this.unsigned
          );
        }, LongPrototype.shiftLeft = function(numBits) {
          return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
            this.low << numBits,
            this.high << numBits | this.low >>> 32 - numBits,
            this.unsigned
          ) : fromBits(0, this.low << numBits - 32, this.unsigned);
        }, LongPrototype.shl = LongPrototype.shiftLeft, LongPrototype.shiftRight = function(numBits) {
          return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
            this.low >>> numBits | this.high << 32 - numBits,
            this.high >> numBits,
            this.unsigned
          ) : fromBits(
            this.high >> numBits - 32,
            this.high >= 0 ? 0 : -1,
            this.unsigned
          );
        }, LongPrototype.shr = LongPrototype.shiftRight, LongPrototype.shiftRightUnsigned = function(numBits) {
          return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits < 32 ? fromBits(
            this.low >>> numBits | this.high << 32 - numBits,
            this.high >>> numBits,
            this.unsigned
          ) : numBits === 32 ? fromBits(this.high, 0, this.unsigned) : fromBits(this.high >>> numBits - 32, 0, this.unsigned);
        }, LongPrototype.shru = LongPrototype.shiftRightUnsigned, LongPrototype.shr_u = LongPrototype.shiftRightUnsigned, LongPrototype.rotateLeft = function(numBits) {
          var b;
          return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits(
            this.low << numBits | this.high >>> b,
            this.high << numBits | this.low >>> b,
            this.unsigned
          )) : (numBits -= 32, b = 32 - numBits, fromBits(
            this.high << numBits | this.low >>> b,
            this.low << numBits | this.high >>> b,
            this.unsigned
          ));
        }, LongPrototype.rotl = LongPrototype.rotateLeft, LongPrototype.rotateRight = function(numBits) {
          var b;
          return isLong(numBits) && (numBits = numBits.toInt()), (numBits &= 63) === 0 ? this : numBits === 32 ? fromBits(this.high, this.low, this.unsigned) : numBits < 32 ? (b = 32 - numBits, fromBits(
            this.high << b | this.low >>> numBits,
            this.low << b | this.high >>> numBits,
            this.unsigned
          )) : (numBits -= 32, b = 32 - numBits, fromBits(
            this.low << b | this.high >>> numBits,
            this.high << b | this.low >>> numBits,
            this.unsigned
          ));
        }, LongPrototype.rotr = LongPrototype.rotateRight, LongPrototype.toSigned = function() {
          return this.unsigned ? fromBits(this.low, this.high, !1) : this;
        }, LongPrototype.toUnsigned = function() {
          return this.unsigned ? this : fromBits(this.low, this.high, !0);
        }, LongPrototype.toBytes = function(le) {
          return le ? this.toBytesLE() : this.toBytesBE();
        }, LongPrototype.toBytesLE = function() {
          var hi = this.high, lo = this.low;
          return [
            lo & 255,
            lo >>> 8 & 255,
            lo >>> 16 & 255,
            lo >>> 24,
            hi & 255,
            hi >>> 8 & 255,
            hi >>> 16 & 255,
            hi >>> 24
          ];
        }, LongPrototype.toBytesBE = function() {
          var hi = this.high, lo = this.low;
          return [
            hi >>> 24,
            hi >>> 16 & 255,
            hi >>> 8 & 255,
            hi & 255,
            lo >>> 24,
            lo >>> 16 & 255,
            lo >>> 8 & 255,
            lo & 255
          ];
        }, Long2.fromBytes = function(bytes, unsigned, le) {
          return le ? Long2.fromBytesLE(bytes, unsigned) : Long2.fromBytesBE(bytes, unsigned);
        }, Long2.fromBytesLE = function(bytes, unsigned) {
          return new Long2(
            bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
            bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24,
            unsigned
          );
        }, Long2.fromBytesBE = function(bytes, unsigned) {
          return new Long2(
            bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7],
            bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3],
            unsigned
          );
        }, typeof BigInt == "function" && (Long2.fromBigInt = function(value, unsigned) {
          var lowBits = Number(BigInt.asIntN(32, value)), highBits = Number(BigInt.asIntN(32, value >> BigInt(32)));
          return fromBits(lowBits, highBits, unsigned);
        }, Long2.fromValue = function(value, unsigned) {
          return typeof value == "bigint" ? Long2.fromBigInt(value, unsigned) : fromValue(value, unsigned);
        }, LongPrototype.toBigInt = function() {
          var lowBigInt = BigInt(this.low >>> 0), highBigInt = BigInt(this.unsigned ? this.high >>> 0 : this.high);
          return highBigInt << BigInt(32) | lowBigInt;
        });
        var _default = _exports.default = Long2;
      }
    );
  }
});

// node_modules/protobufjs/src/util/minimal.js
var require_minimal = __commonJS({
  "node_modules/protobufjs/src/util/minimal.js"(exports) {
    "use strict";
    var util2 = exports;
    util2.asPromise = require_aspromise();
    util2.base64 = require_base64();
    util2.EventEmitter = require_eventemitter();
    util2.float = require_float();
    util2.utf8 = require_utf8();
    util2.pool = require_pool();
    util2.LongBits = require_longbits();
    function isUnsafeProperty(key2) {
      return key2 === "__proto__" || key2 === "prototype" || key2 === "constructor";
    }
    util2.isUnsafeProperty = isUnsafeProperty;
    util2.isNode = !!(typeof global < "u" && global && global.process && global.process.versions && global.process.versions.node);
    util2.global = util2.isNode && global || typeof window < "u" && window || typeof self < "u" && self || typeof globalThis < "u" && globalThis || exports;
    util2.emptyArray = Object.freeze ? Object.freeze([]) : (
      /* istanbul ignore next */
      []
    );
    util2.emptyObject = Object.freeze ? Object.freeze({}) : (
      /* istanbul ignore next */
      {}
    );
    util2.isInteger = Number.isInteger || /* istanbul ignore next */
    function(value) {
      return typeof value == "number" && isFinite(value) && Math.floor(value) === value;
    };
    util2.isString = function(value) {
      return typeof value == "string" || value instanceof String;
    };
    util2.isObject = function(value) {
      return value && typeof value == "object";
    };
    util2.isset = /**
     * Checks if a property on a message is considered to be present.
     * @param {Object} obj Plain object or message instance
     * @param {string} prop Property name
     * @returns {boolean} `true` if considered to be present, otherwise `false`
     */
    util2.isSet = function(obj, prop) {
      var value = obj[prop];
      return value != null && Object.hasOwnProperty.call(obj, prop) ? typeof value != "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0 : !1;
    };
    util2.Buffer = (function() {
      try {
        var Buffer2 = util2.global.Buffer;
        return Buffer2.prototype.utf8Write || util2.isNode ? Buffer2 : (
          /* istanbul ignore next */
          null
        );
      } catch {
        return null;
      }
    })();
    util2.newBuffer = function(sizeOrArray) {
      var Buffer2 = util2.Buffer;
      return typeof sizeOrArray == "number" ? Buffer2 ? Buffer2.allocUnsafe(sizeOrArray) : new Uint8Array(sizeOrArray) : Buffer2 ? Buffer2.from(sizeOrArray) : new Uint8Array(sizeOrArray);
    };
    util2.rawField = function(id, wireType, data) {
      var out = [], tag = id << 3 | wireType;
      for (tag >>>= 0; tag > 127; )
        out.push(tag & 127 | 128), tag >>>= 7;
      out.push(tag);
      for (var i = 0; i < data.length; ++i)
        out.push(data[i]);
      return util2.newBuffer(out);
    };
    util2.Array = Uint8Array;
    util2.Long = /* istanbul ignore next */
    util2.global.dcodeIO && /* istanbul ignore next */
    util2.global.dcodeIO.Long || /* istanbul ignore next */
    util2.global.Long || (function() {
      try {
        var Long2 = require_umd();
        return Long2 && Long2.isLong ? Long2 : null;
      } catch {
        return null;
      }
    })();
    util2.key2Re = /^(?:true|false|0|1)$/;
    util2.key32Re = /^-?(?:0|[1-9][0-9]*)$/;
    util2.key64Re = /^(?:[\x00-\xff]{8}|-?(?:0|[1-9][0-9]*))$/;
    util2.longToHash = function(value) {
      return value ? util2.LongBits.from(value).toHash() : util2.LongBits.zeroHash;
    };
    util2.longFromHash = function(hash, unsigned) {
      var bits = util2.LongBits.fromHash(hash);
      return util2.Long ? util2.Long.fromBits(bits.lo, bits.hi, unsigned) : bits.toNumber(!!unsigned);
    };
    util2.longFromKey = function(key2, unsigned) {
      return util2.key64Re.test(key2) && !util2.key32Re.test(key2) ? util2.longFromHash(key2, unsigned) : key2;
    };
    util2.boolFromKey = function(key2) {
      return key2 === "true" || key2 === "1";
    };
    function merge(dst) {
      var ifNotSet = typeof arguments[arguments.length - 1] == "boolean", limit = ifNotSet ? arguments.length - 1 : arguments.length;
      ifNotSet = ifNotSet && arguments[arguments.length - 1];
      for (var a = 1; a < limit; ++a) {
        var src = arguments[a];
        if (src)
          for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
            !isUnsafeProperty(keys[i]) && (!ifNotSet || !Object.prototype.hasOwnProperty.call(dst, keys[i]) || dst[keys[i]] === void 0) && (dst[keys[i]] = src[keys[i]]);
      }
      return dst;
    }
    util2.merge = merge;
    util2.nestingLimit = 32;
    util2.recursionLimit = 100;
    util2.makeProp = function(obj, key2, enumerable) {
      Object.prototype.hasOwnProperty.call(obj, key2) || Object.defineProperty(obj, key2, {
        enumerable: enumerable === void 0 ? !0 : enumerable,
        configurable: !0,
        writable: !0
      });
    };
    util2.lcFirst = function(str) {
      return str.charAt(0).toLowerCase() + str.substring(1);
    };
    function newError(name) {
      function CustomError(message, properties) {
        if (!(this instanceof CustomError))
          return new CustomError(message, properties);
        Object.defineProperty(this, "message", { get: function() {
          return message;
        } }), Error.captureStackTrace ? Error.captureStackTrace(this, CustomError) : Object.defineProperty(this, "stack", { value: new Error().stack || "" }), properties && merge(this, properties);
      }
      return CustomError.prototype = Object.create(Error.prototype, {
        constructor: {
          value: CustomError,
          writable: !0,
          enumerable: !1,
          configurable: !0
        },
        name: {
          get: function() {
            return name;
          },
          set: void 0,
          enumerable: !1,
          // configurable: false would accurately preserve the behavior of
          // the original, but I'm guessing that was not intentional.
          // For an actual error subclass, this property would
          // be configurable.
          configurable: !0
        },
        toString: {
          value: function() {
            return this.name + ": " + this.message;
          },
          writable: !0,
          enumerable: !1,
          configurable: !0
        }
      }), CustomError;
    }
    util2.newError = newError;
    util2.ProtocolError = newError("ProtocolError");
    util2.oneOfGetter = function(fieldNames) {
      for (var fieldMap = {}, i = 0; i < fieldNames.length; ++i)
        fieldMap[fieldNames[i]] = 1;
      return function() {
        for (var keys = Object.keys(this), i2 = keys.length - 1; i2 > -1; --i2)
          if (fieldMap[keys[i2]] === 1 && this[keys[i2]] !== void 0 && this[keys[i2]] !== null)
            return keys[i2];
      };
    };
    util2.oneOfSetter = function(fieldNames) {
      return function(name) {
        for (var i = 0; i < fieldNames.length; ++i)
          fieldNames[i] !== name && delete this[fieldNames[i]];
      };
    };
    util2.toJSONOptions = {
      longs: String,
      enums: String,
      bytes: String,
      json: !0
    };
  }
});

// node_modules/protobufjs/src/writer.js
var require_writer = __commonJS({
  "node_modules/protobufjs/src/writer.js"(exports, module) {
    "use strict";
    module.exports = Writer;
    var util2 = require_minimal(), BufferWriter, LongBits = util2.LongBits, base64 = util2.base64, utf8 = util2.utf8;
    function Writer() {
      this.pos = 0, this.buf = this.constructor.alloc(Writer.initialBufferSize), this.view = null, this.states = null;
    }
    Writer.initialBufferSize = 128;
    Object.defineProperty(Writer.prototype, "len", {
      configurable: !0,
      enumerable: !0,
      get: function() {
        return this.pos;
      }
    });
    var create2 = function() {
      return util2.Buffer ? function() {
        return (Writer.create = function() {
          return new BufferWriter();
        })();
      } : function() {
        return new Writer();
      };
    };
    Writer.create = create2();
    Writer.alloc = function(size) {
      return new Uint8Array(size);
    };
    Writer.alloc = util2.pool(Writer.alloc, Uint8Array.prototype.subarray);
    function sizeVarint32(value) {
      return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5;
    }
    Writer.prototype._reserve = function(n) {
      var need = this.pos + n;
      if (need > this.buf.length) {
        var size = this.buf.length << 1;
        size < need && (size = need);
        var buf = this.constructor.alloc(size);
        buf.set(this.buf.subarray(0, this.pos), 0), this.buf = buf, this.view = null;
      }
    };
    function writeStringAscii(val, buf, pos) {
      for (var i = 0; i < val.length; )
        buf[pos++] = val.charCodeAt(i++);
    }
    function writeVarint32(val, buf, pos) {
      for (; val > 127; )
        buf[pos++] = val & 127 | 128, val >>>= 7;
      return buf[pos] = val, pos + 1;
    }
    Writer.prototype.uint32 = function(value) {
      value = value >>> 0, this._reserve(5);
      var pos = this.pos;
      return this.pos = writeVarint32(value, this.buf, pos), this;
    };
    Writer.prototype.int32 = function(value) {
      return (value |= 0) < 0 ? (this._reserve(10), writeVarint64(LongBits.fromNumber(value), this.buf, this.pos), this.pos += 10, this) : this.uint32(value);
    };
    Writer.prototype.sint32 = function(value) {
      return this.uint32((value << 1 ^ value >> 31) >>> 0);
    };
    function writeVarint64(val, buf, pos) {
      for (var lo = val.lo, hi = val.hi; hi; )
        buf[pos++] = lo & 127 | 128, lo = (lo >>> 7 | hi << 25) >>> 0, hi >>>= 7;
      for (; lo > 127; )
        buf[pos++] = lo & 127 | 128, lo = lo >>> 7;
      return buf[pos] = lo, pos + 1;
    }
    Writer.prototype.uint64 = function(value) {
      var bits = LongBits.from(value);
      this._reserve(10);
      var pos = this.pos;
      return this.pos = writeVarint64(bits, this.buf, pos), this;
    };
    Writer.prototype.int64 = Writer.prototype.uint64;
    Writer.prototype.sint64 = function(value) {
      var bits = LongBits.from(value).zzEncode();
      this._reserve(10);
      var pos = this.pos;
      return this.pos = writeVarint64(bits, this.buf, pos), this;
    };
    Writer.prototype.bool = function(value) {
      return this._reserve(1), this.buf[this.pos++] = value ? 1 : 0, this;
    };
    function writeFixed32(val, buf, pos) {
      buf[pos] = val & 255, buf[pos + 1] = val >>> 8 & 255, buf[pos + 2] = val >>> 16 & 255, buf[pos + 3] = val >>> 24;
    }
    Writer.prototype.fixed32 = function(value) {
      return this._reserve(4), writeFixed32(value >>> 0, this.buf, this.pos), this.pos += 4, this;
    };
    Writer.prototype.sfixed32 = Writer.prototype.fixed32;
    Writer.prototype.fixed64 = function(value) {
      var bits = LongBits.from(value);
      return this._reserve(8), writeFixed32(bits.lo, this.buf, this.pos), writeFixed32(bits.hi, this.buf, this.pos + 4), this.pos += 8, this;
    };
    Writer.prototype.sfixed64 = Writer.prototype.fixed64;
    Writer.prototype.float = function(value) {
      return this._reserve(4), util2.float.writeFloatLE(value, this.buf, this.pos), this.pos += 4, this;
    };
    Writer.prototype.double = function(value) {
      return this._reserve(8), util2.float.writeDoubleLE(value, this.buf, this.pos), this.pos += 8, this;
    };
    Writer.prototype.bytes = function(value) {
      var len = value.length >>> 0;
      if (!len)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (util2.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0), value = buf;
      }
      return this.uint32(len), this._reserve(len), this.buf.set(value, this.pos), this.pos += len, this;
    };
    Writer.prototype.raw = function(value) {
      var len = value.length >>> 0;
      return len ? (this._reserve(len), this.buf.set(value, this.pos), this.pos += len, this) : this;
    };
    Writer.prototype._delim = function(pos, len) {
      var n = sizeVarint32(len);
      return n > 1 && this.buf.copyWithin(pos + n, pos + 1, pos + 1 + len), writeVarint32(len, this.buf, pos), this.pos = pos + n + len, this;
    };
    Writer.prototype.string = function(value) {
      var n = value.length;
      if (!n)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (n < 128) {
        this._reserve(n * 3 + 5);
        var lenPos = this.pos;
        return this._delim(lenPos, utf8.write(value, this.buf, lenPos + 1));
      }
      var len = utf8.length(value);
      return this.uint32(len), this._reserve(len), len === value.length ? writeStringAscii(value, this.buf, this.pos) : utf8.write(value, this.buf, this.pos), this.pos += len, this;
    };
    Writer.prototype.uint32s = function(value) {
      var n = value.length;
      this._reserve(n * 5 + 5);
      for (var buf = this.buf, lenPos = this.pos, p = lenPos + 1, i = 0; i < n; ++i)
        p = writeVarint32(value[i] >>> 0, buf, p);
      return this._delim(lenPos, p - lenPos - 1);
    };
    Writer.prototype.int32s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, val, i = 0; i < n; ++i)
        (val = value[i] | 0) < 0 ? pos = writeVarint64(LongBits.fromNumber(val), buf, pos) : pos = writeVarint32(val, buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.sint32s = function(value) {
      var n = value.length;
      this._reserve(n * 5 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint32((value[i] << 1 ^ value[i] >> 31) >>> 0, buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.uint64s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint64(LongBits.from(value[i]), buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.int64s = Writer.prototype.uint64s;
    Writer.prototype.sint64s = function(value) {
      var n = value.length;
      this._reserve(n * 10 + 5);
      for (var buf = this.buf, lenPos = this.pos, pos = lenPos + 1, i = 0; i < n; ++i)
        pos = writeVarint64(LongBits.from(value[i]).zzEncode(), buf, pos);
      return this._delim(lenPos, pos - lenPos - 1);
    };
    Writer.prototype.bools = function(value) {
      var n = value.length;
      this.uint32(n), this._reserve(n);
      for (var buf = this.buf, p = this.pos, i = 0; i < n; ++i)
        buf[p++] = value[i] ? 1 : 0;
      return this.pos += n, this;
    };
    var VIEW_THRESHOLD_FLOAT = 16, VIEW_THRESHOLD_INT = 128;
    function getLazyView(writer, count, threshold) {
      var view = writer.view;
      if (view || count < threshold)
        return view;
      var buf = writer.buf;
      return writer.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    Writer.prototype.fixed32s = function(value) {
      var n = value.length, bytes = n * 4;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_INT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setUint32(p, value[i] >>> 0, !0), p += 4;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          writeFixed32(value[i] >>> 0, buf, p), p += 4;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.sfixed32s = Writer.prototype.fixed32s;
    Writer.prototype.fixed64s = function(value) {
      var n = value.length, bytes = n * 8;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, bits, dv = getLazyView(this, n, VIEW_THRESHOLD_INT);
      if (dv)
        for (i = 0; i < n; ++i)
          bits = LongBits.from(value[i]), dv.setUint32(p, bits.lo, !0), dv.setUint32(p + 4, bits.hi, !0), p += 8;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          bits = LongBits.from(value[i]), writeFixed32(bits.lo, buf, p), writeFixed32(bits.hi, buf, p + 4), p += 8;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.sfixed64s = Writer.prototype.fixed64s;
    Writer.prototype.floats = function(value) {
      var n = value.length, bytes = n * 4;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setFloat32(p, value[i], !0), p += 4;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          util2.float.writeFloatLE(value[i], buf, p), p += 4;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.doubles = function(value) {
      var n = value.length, bytes = n * 8;
      this.uint32(bytes), this._reserve(bytes);
      var p = this.pos, i, dv = getLazyView(this, n, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (i = 0; i < n; ++i)
          dv.setFloat64(p, value[i], !0), p += 8;
      else {
        var buf = this.buf;
        for (i = 0; i < n; ++i)
          util2.float.writeDoubleLE(value[i], buf, p), p += 8;
      }
      return this.pos += bytes, this;
    };
    Writer.prototype.fork = function() {
      return this._reserve(1), (this.states || (this.states = [])).push(this.pos), this.pos += 1, this;
    };
    Writer.prototype.reset = function() {
      var states = this.states;
      return states && states.length ? this.pos = states.pop() : this.pos = 0, this;
    };
    Writer.prototype.ldelim = function() {
      var states = this.states, len, vlen;
      if (states && states.length) {
        var lenPos = states.pop();
        len = this.pos - lenPos - 1, vlen = sizeVarint32(len), vlen > 1 ? (this._reserve(vlen - 1), this.buf.copyWithin(lenPos + vlen, lenPos + 1, lenPos + 1 + len), this.pos += vlen - 1, writeVarint32(len, this.buf, lenPos)) : this.buf[lenPos] = len;
      } else
        len = this.pos, vlen = sizeVarint32(len), this._reserve(vlen), this.buf.copyWithin(vlen, 0, len), writeVarint32(len, this.buf, 0), this.pos += vlen;
      return this;
    };
    Writer.prototype.finish = function(shared) {
      if (shared)
        return this.buf.subarray(0, this.pos);
      var buf = this.constructor.alloc(this.pos);
      return buf.set(this.buf.subarray(0, this.pos), 0), buf;
    };
    Writer.prototype.finishInto = function(buf, offset) {
      return offset === void 0 && (offset = 0), buf.set(this.buf.subarray(0, this.pos), offset), buf;
    };
    Writer._configure = function(BufferWriter_) {
      BufferWriter = BufferWriter_, Writer.create = create2(), BufferWriter._configure();
    };
  }
});

// node_modules/protobufjs/src/writer_buffer.js
var require_writer_buffer = __commonJS({
  "node_modules/protobufjs/src/writer_buffer.js"(exports, module) {
    "use strict";
    module.exports = BufferWriter;
    var Writer = require_writer();
    BufferWriter.prototype = Object.create(Writer.prototype, {
      constructor: {
        value: BufferWriter,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    var util2 = require_minimal();
    function BufferWriter() {
      Writer.call(this);
    }
    var writeStringBuffer;
    BufferWriter._configure = function() {
      BufferWriter.alloc = util2.Buffer && util2.Buffer.allocUnsafe, writeStringBuffer = util2.Buffer && util2.Buffer.prototype.utf8Write ? function(val, buf, pos) {
        return buf.utf8Write(val, pos);
      } : function(val, buf, pos) {
        return buf.write(val, pos);
      };
    };
    BufferWriter.prototype.bytes = function(value) {
      util2.isString(value) && (value = util2.Buffer.from(value, "base64"));
      var len = value.length >>> 0;
      return this.uint32(len), len && (this._reserve(len), this.buf.set(value, this.pos), this.pos += len), this;
    };
    BufferWriter.prototype.string = function(value) {
      var n = value.length;
      if (!n)
        return this._reserve(1), this.buf[this.pos++] = 0, this;
      if (n < 128) {
        this._reserve(n * 3 + 5);
        var pos = this.pos, buf = this.buf;
        return this._delim(
          pos,
          n < 40 ? util2.utf8.write(value, buf, pos + 1) : writeStringBuffer(value, buf, pos + 1)
        );
      }
      var len = util2.Buffer.byteLength(value);
      return this.uint32(len), this._reserve(len), writeStringBuffer(value, this.buf, this.pos), this.pos += len, this;
    };
    BufferWriter._configure();
  }
});

// node_modules/protobufjs/src/reader.js
var require_reader = __commonJS({
  "node_modules/protobufjs/src/reader.js"(exports, module) {
    "use strict";
    module.exports = Reader;
    var util2 = require_minimal(), BufferReader, LongBits = util2.LongBits, utf8 = util2.utf8;
    function indexOutOfRange(reader, writeLength) {
      return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
    }
    function Reader(buffer) {
      this.buf = buffer, this.pos = 0, this.len = buffer.length, this.view = null, this.discardUnknown = Reader.discardUnknown;
    }
    function create_array(buffer) {
      if (Array.isArray(buffer) && (buffer = new Uint8Array(buffer)), buffer instanceof Uint8Array)
        return new Reader(buffer);
      throw Error("illegal buffer");
    }
    var create2 = function() {
      return util2.Buffer ? function(buffer) {
        return (Reader.create = function(buffer2) {
          return util2.Buffer.isBuffer(buffer2) ? new BufferReader(buffer2) : create_array(buffer2);
        })(buffer);
      } : create_array;
    };
    Reader.create = create2();
    Reader.prototype.raw = function(start, end) {
      return this.buf.subarray(start, end);
    };
    function readVarint32NearEnd(reader) {
      for (var value = 0, i = 0; i < 4; ++i) {
        if (reader.pos >= reader.len)
          throw indexOutOfRange(reader);
        var b = reader.buf[reader.pos++];
        if (value = (value | (b & 127) << i * 7) >>> 0, b < 128)
          return value;
      }
      throw indexOutOfRange(reader);
    }
    Reader.prototype.uint32 = function() {
      if (this.len - this.pos < 5) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (this.buf[this.pos] >= 128)
          return readVarint32NearEnd(this);
      }
      var buf = this.buf, pos = this.pos, value = (buf[pos] & 127) >>> 0;
      if (buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 7) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 14) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 21) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 15) << 28) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      for (var i = 0; i < 5; ++i) {
        if (pos >= this.len)
          throw this.pos = pos, indexOutOfRange(this);
        if (buf[pos++] < 128)
          return this.pos = pos, value;
      }
      throw this.pos = pos, Error("invalid varint encoding");
    };
    Reader.prototype.tag = function() {
      if (this.len - this.pos < 5) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (this.buf[this.pos] >= 128)
          return readVarint32NearEnd(this);
      }
      var buf = this.buf, pos = this.pos, value = (buf[pos] & 127) >>> 0;
      if (buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 7) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 14) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 21) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 15) << 28) >>> 0, buf[pos] < 128 && (buf[pos] & 112) === 0)
        return this.pos = pos + 1, value;
      throw this.pos = pos + 1, Error("invalid tag encoding");
    };
    Reader.prototype.size = function() {
      if (this.len - this.pos < 5) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (this.buf[this.pos] >= 128)
          return readVarint32NearEnd(this);
      }
      var buf = this.buf, pos = this.pos, value = (buf[pos] & 127) >>> 0;
      if (buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 7) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 14) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (value = (value | (buf[pos] & 127) << 21) >>> 0, buf[pos++] < 128)
        return this.pos = pos, value;
      if (this.pos = pos + 1, buf[pos] > 7)
        throw Error("invalid length encoding");
      return (value | buf[pos] << 28) >>> 0;
    };
    Reader.prototype.int32 = function() {
      return this.uint32() | 0;
    };
    Reader.prototype.sint32 = function() {
      var value = this.uint32();
      return value >>> 1 ^ -(value & 1) | 0;
    };
    function readLongVarint() {
      var bits = new LongBits(0, 0), i = 0;
      if (this.len - this.pos > 4) {
        for (; i < 4; ++i)
          if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0, bits.hi = (bits.hi | (this.buf[this.pos] & 127) >> 4) >>> 0, this.buf[this.pos++] < 128)
          return bits;
        i = 0;
      } else {
        for (; i < 4; ++i) {
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
          if (bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        }
        throw indexOutOfRange(this);
      }
      if (this.len - this.pos > 4) {
        for (; i < 5; ++i)
          if (bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
            return bits;
      } else
        for (; i < 5; ++i) {
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
          if (bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0, this.buf[this.pos++] < 128)
            return bits;
        }
      throw Error("invalid varint encoding");
    }
    Reader.prototype.bool = function() {
      for (var value = !1, b, i = 0; i < 10; ++i) {
        if (this.pos >= this.len)
          throw indexOutOfRange(this);
        if (b = this.buf[this.pos++], b & 127 && (value = !0), b < 128)
          return value;
      }
      throw Error("invalid varint encoding");
    };
    function readFixed32_end(buf, end) {
      return (buf[end - 4] | buf[end - 3] << 8 | buf[end - 2] << 16 | buf[end - 1] << 24) >>> 0;
    }
    Reader.prototype.fixed32 = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      return readFixed32_end(this.buf, this.pos += 4);
    };
    Reader.prototype.sfixed32 = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      return readFixed32_end(this.buf, this.pos += 4) | 0;
    };
    function readFixed64() {
      if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 8);
      return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
    }
    Reader.prototype.float = function() {
      if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);
      var value = util2.float.readFloatLE(this.buf, this.pos);
      return this.pos += 4, value;
    };
    Reader.prototype.double = function() {
      if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 4);
      var value = util2.float.readDoubleLE(this.buf, this.pos);
      return this.pos += 8, value;
    };
    Reader.prototype.uint32s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value) : (this.pos = pos - 1, array.push(this.uint32()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.int32s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value) : (this.pos = pos - 1, array.push(this.int32()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.sint32s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.sint32());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.bools = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len, buf = this.buf, pos = this.pos, value;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; pos < end; )
        value = buf[pos++], value < 128 ? array.push(value !== 0) : (this.pos = pos - 1, array.push(this.bool()), pos = this.pos);
      if (this.pos = pos, pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    var VIEW_THRESHOLD_FLOAT = 8, VIEW_THRESHOLD_INT = 128;
    function getLazyView(reader, count, threshold) {
      var view = reader.view;
      if (view || count < threshold)
        return view;
      var buf = reader.buf;
      return reader.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    Reader.prototype.fixed32s = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_INT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getUint32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = readFixed32_end(buf, pos + 4);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.sfixed32s = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_INT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getInt32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = readFixed32_end(buf, pos + 4) | 0;
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.floats = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 2, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 4) array[i++] = dv.getFloat32(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 4) array[i++] = util2.float.readFloatLE(buf, pos);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 4);
      return array;
    };
    Reader.prototype.doubles = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3, i = array.length, pos = this.pos;
      array.length = i + count;
      var dv = getLazyView(this, count, VIEW_THRESHOLD_FLOAT);
      if (dv)
        for (var k = 0; k < count; ++k, pos += 8) array[i++] = dv.getFloat64(pos, !0);
      else
        for (var buf = this.buf, j = 0; j < count; ++j, pos += 8) array[i++] = util2.float.readDoubleLE(buf, pos);
      if (this.pos = pos, pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.uint64s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.uint64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.int64s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.int64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.sint64s = function(array) {
      array === void 0 && (array = []);
      var end = this.size() + this.pos, len = this.len;
      if (end > len) throw indexOutOfRange(this, end - this.pos);
      for (this.len = end; this.pos < end; )
        array.push(this.sint64());
      if (this.pos !== end) throw RangeError("index out of range");
      return this.len = len, array;
    };
    Reader.prototype.fixed64s = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len, i = array.length;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3;
      array.length = i + count;
      for (var j = 0; j < count; ++j)
        array[i++] = this.fixed64();
      if (this.pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.sfixed64s = function(array) {
      array === void 0 && (array = []);
      var len = this.size(), end = this.pos + len, i = array.length;
      if (end > this.len) throw indexOutOfRange(this, len);
      var count = len >>> 3;
      array.length = i + count;
      for (var j = 0; j < count; ++j)
        array[i++] = this.sfixed64();
      if (this.pos !== end) throw indexOutOfRange(this, 8);
      return array;
    };
    Reader.prototype.bytes = function() {
      var length = this.size(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, this.raw(start, end);
    };
    Reader.prototype.string = function() {
      var length = this.size(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, utf8.read(this.buf, start, end);
    };
    Reader.prototype.stringVerify = function() {
      var length = this.size(), start = this.pos, end = this.pos + length;
      if (end > this.len)
        throw indexOutOfRange(this, length);
      return this.pos = end, utf8.readStrict(this.buf, start, end);
    };
    Reader.prototype.skip = function(length) {
      if (typeof length == "number") {
        if (this.pos + length > this.len)
          throw indexOutOfRange(this, length);
        this.pos += length;
      } else
        do
          if (this.pos >= this.len)
            throw indexOutOfRange(this);
        while (this.buf[this.pos++] & 128);
      return this;
    };
    Reader.recursionLimit = util2.recursionLimit;
    Reader.discardUnknown = !0;
    Reader.prototype.skipType = function(wireType, depth, fieldNumber) {
      if (depth === void 0 && (depth = 0), depth > Reader.recursionLimit)
        throw Error("max depth exceeded");
      if (fieldNumber === 0)
        throw Error("illegal tag: field number 0");
      switch (wireType) {
        case 0:
          this.skip();
          break;
        case 1:
          this.skip(8);
          break;
        case 2:
          this.skip(this.size());
          break;
        case 3:
          for (; ; ) {
            var tag = this.tag(), nestedField = tag >>> 3;
            if (wireType = tag & 7, !nestedField)
              throw Error("illegal tag: field number 0");
            if (wireType === 4) {
              if (fieldNumber !== void 0 && nestedField !== fieldNumber)
                throw Error("invalid end group tag");
              break;
            }
            this.skipType(wireType, depth + 1, nestedField);
          }
          break;
        case 5:
          this.skip(4);
          break;
        /* istanbul ignore next */
        default:
          throw Error("invalid wire type " + wireType + " at offset " + this.pos);
      }
      return this;
    };
    Reader._configure = function(BufferReader_) {
      BufferReader = BufferReader_, Reader.create = create2(), BufferReader._configure();
      var fn = util2.Long ? "toLong" : (
        /* istanbul ignore next */
        "toNumber"
      );
      util2.merge(Reader.prototype, {
        int64: function() {
          return readLongVarint.call(this)[fn](!1);
        },
        uint64: function() {
          return readLongVarint.call(this)[fn](!0);
        },
        sint64: function() {
          return readLongVarint.call(this).zzDecode()[fn](!1);
        },
        fixed64: function() {
          return readFixed64.call(this)[fn](!0);
        },
        sfixed64: function() {
          return readFixed64.call(this)[fn](!1);
        }
      });
    };
  }
});

// node_modules/protobufjs/src/reader_buffer.js
var require_reader_buffer = __commonJS({
  "node_modules/protobufjs/src/reader_buffer.js"(exports, module) {
    "use strict";
    module.exports = BufferReader;
    var Reader = require_reader();
    BufferReader.prototype = Object.create(Reader.prototype, {
      constructor: {
        value: BufferReader,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    var util2 = require_minimal();
    function BufferReader(buffer) {
      Reader.call(this, buffer);
    }
    BufferReader._configure = function() {
      util2.Buffer && (BufferReader.prototype._slice = util2.Buffer.prototype.slice);
    };
    BufferReader.prototype.raw = function(start, end) {
      return this._slice.call(this.buf, start, end);
    };
    BufferReader.prototype.string = function() {
      var len = this.size(), start = this.pos, end = this.pos + len;
      if (end > this.len)
        throw RangeError("index out of range: " + this.pos + " + " + len + " > " + this.len);
      return this.pos = end, this.buf.utf8Slice ? this.buf.utf8Slice(start, end) : this.buf.toString("utf-8", start, end);
    };
    BufferReader._configure();
  }
});

// node_modules/protobufjs/src/rpc/service.js
var require_service = __commonJS({
  "node_modules/protobufjs/src/rpc/service.js"(exports, module) {
    "use strict";
    module.exports = Service;
    var util2 = require_minimal();
    Service.prototype = Object.create(util2.EventEmitter.prototype, {
      constructor: {
        value: Service,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    function Service(rpcImpl, requestDelimited, responseDelimited) {
      if (typeof rpcImpl != "function")
        throw TypeError("rpcImpl must be a function");
      util2.EventEmitter.call(this), this.rpcImpl = rpcImpl, this.requestDelimited = !!requestDelimited, this.responseDelimited = !!responseDelimited;
    }
    Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
      if (!request)
        throw TypeError("request must be specified");
      var self2 = this;
      if (!callback)
        return util2.asPromise(rpcCall, self2, method, requestCtor, responseCtor, request);
      if (!self2.rpcImpl) {
        setTimeout(function() {
          callback(Error("already ended"));
        }, 0);
        return;
      }
      try {
        return self2.rpcImpl(
          method,
          requestCtor[self2.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
          function(err, response) {
            if (err)
              return self2.emit("error", err, method), callback(err);
            if (response === null) {
              self2.end(
                /* endedByRPC */
                !0
              );
              return;
            }
            if (!(response instanceof responseCtor))
              try {
                response = responseCtor[self2.responseDelimited ? "decodeDelimited" : "decode"](response);
              } catch (err2) {
                return self2.emit("error", err2, method), callback(err2);
              }
            return self2.emit("data", response, method), callback(null, response);
          }
        );
      } catch (err) {
        self2.emit("error", err, method), setTimeout(function() {
          callback(err);
        }, 0);
        return;
      }
    };
    Service.prototype.end = function(endedByRPC) {
      return this.rpcImpl && (endedByRPC || this.rpcImpl(null, null, null), this.rpcImpl = null, this.emit("end").off()), this;
    };
  }
});

// node_modules/protobufjs/src/rpc.js
var require_rpc = __commonJS({
  "node_modules/protobufjs/src/rpc.js"(exports) {
    "use strict";
    var rpc = exports;
    rpc.Service = require_service();
  }
});

// node_modules/protobufjs/src/roots.js
var require_roots = __commonJS({
  "node_modules/protobufjs/src/roots.js"(exports, module) {
    "use strict";
    module.exports = /* @__PURE__ */ Object.create(null);
  }
});

// node_modules/protobufjs/src/index-minimal.js
var require_index_minimal = __commonJS({
  "node_modules/protobufjs/src/index-minimal.js"(exports) {
    "use strict";
    exports.build = "minimal";
    exports.Writer = require_writer();
    exports.BufferWriter = require_writer_buffer();
    exports.Reader = require_reader();
    exports.BufferReader = require_reader_buffer();
    exports.util = require_minimal();
    exports.rpc = require_rpc();
    exports.roots = require_roots();
    exports.configure = configure2;
    function configure2() {
      exports.util.LongBits._configure(exports.util.Long), exports.Writer._configure(exports.BufferWriter), exports.Reader._configure(exports.BufferReader);
    }
    configure2();
  }
});

// node_modules/protobufjs/src/util/patterns.js
var require_patterns = __commonJS({
  "node_modules/protobufjs/src/util/patterns.js"(exports) {
    "use strict";
    var patterns = exports;
    patterns.numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/;
    patterns.typeRefRe = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/;
    patterns.reservedRe = /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/;
  }
});

// node_modules/protobufjs/src/util/codegen.js
var require_codegen = __commonJS({
  "node_modules/protobufjs/src/util/codegen.js"(exports, module) {
    "use strict";
    module.exports = codegen;
    var patterns = require_patterns(), reservedRe = patterns.reservedRe;
    function codegen(functionParams, functionName) {
      typeof functionParams == "string" && (functionName = functionParams, functionParams = void 0);
      var body = [];
      function Codegen(formatStringOrScope) {
        if (typeof formatStringOrScope != "string") {
          var source = toString();
          if (codegen.verbose && console.log("codegen: " + source), source = "return " + source, formatStringOrScope) {
            for (var scopeKeys = Object.keys(formatStringOrScope), scopeParams = new Array(scopeKeys.length + 1), scopeValues = new Array(scopeKeys.length), scopeOffset = 0; scopeOffset < scopeKeys.length; )
              scopeParams[scopeOffset] = scopeKeys[scopeOffset], scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]];
            return scopeParams[scopeOffset] = source, Function.apply(null, scopeParams).apply(null, scopeValues);
          }
          return Function(source)();
        }
        for (var formatParams = new Array(arguments.length - 1), formatOffset = 0; formatOffset < formatParams.length; )
          formatParams[formatOffset] = arguments[++formatOffset];
        if (formatOffset = 0, formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function($0, $1) {
          var value = formatParams[formatOffset++];
          switch ($1) {
            case "d":
            case "f":
              return value = Number(value), Object.is(value, -0) ? "-0" : String(value);
            case "i":
              return String(Math.floor(value));
            case "j":
              return JSON.stringify(value);
            case "s":
              return String(value);
          }
          return "%";
        }), formatOffset !== formatParams.length)
          throw Error("parameter count mismatch");
        return body.push(formatStringOrScope), Codegen;
      }
      function toString(functionNameOverride) {
        return "function " + safeFunctionName(functionNameOverride || functionName) + "(" + (functionParams && functionParams.join(",") || "") + `){
  ` + body.join(`
  `) + `
}`;
      }
      return Object.defineProperty(Codegen, "toString", {
        value: toString,
        writable: !0,
        enumerable: !0,
        configurable: !0
      }), Codegen;
    }
    codegen.verbose = !1;
    function safeFunctionName(name) {
      return !name || (name = String(name).replace(/[^\w$]/g, ""), !name) ? "" : (/^\d/.test(name) && (name = "_" + name), reservedRe.test(name) ? name + "_" : name);
    }
  }
});

// (disabled):fs
var require_fs = __commonJS({
  "(disabled):fs"() {
  }
});

// node_modules/protobufjs/src/util/fs.js
var require_fs2 = __commonJS({
  "node_modules/protobufjs/src/util/fs.js"(exports, module) {
    "use strict";
    var fs = null;
    try {
      fs = require_fs(), (!fs || !fs.readFile || !fs.readFileSync) && (fs = null);
    } catch {
    }
    module.exports = fs;
  }
});

// node_modules/protobufjs/src/util/fetch.js
var require_fetch = __commonJS({
  "node_modules/protobufjs/src/util/fetch.js"(exports, module) {
    "use strict";
    module.exports = fetch;
    var asPromise = require_aspromise(), fs = require_fs2();
    function fetch(filename, options, callback) {
      return typeof options == "function" ? (callback = options, options = {}) : options || (options = {}), callback ? !options.xhr && fs && fs.readFile ? fs.readFile(filename, function(err, contents) {
        return err && typeof XMLHttpRequest < "u" ? fetch.xhr(filename, options, callback) : err ? callback(err) : callback(null, options.binary ? contents : contents.toString("utf8"));
      }) : fetch.xhr(filename, options, callback) : asPromise(fetch, this, filename, options);
    }
    fetch.xhr = function(filename, options, callback) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status !== 0 && xhr.status !== 200)
            return callback(Error("status " + xhr.status));
          if (options.binary) {
            var buffer = xhr.response;
            if (!buffer) {
              buffer = [];
              for (var i = 0; i < xhr.responseText.length; ++i)
                buffer.push(xhr.responseText.charCodeAt(i) & 255);
            }
            return callback(null, typeof Uint8Array < "u" ? new Uint8Array(buffer) : buffer);
          }
          return callback(null, xhr.responseText);
        }
      }, options.binary && ("overrideMimeType" in xhr && xhr.overrideMimeType("text/plain; charset=x-user-defined"), xhr.responseType = "arraybuffer"), xhr.open("GET", filename), xhr.send();
    };
  }
});

// node_modules/protobufjs/src/util/path.js
var require_path = __commonJS({
  "node_modules/protobufjs/src/util/path.js"(exports) {
    "use strict";
    var path = exports, urlRe = /^[a-zA-Z][a-zA-Z0-9+.-]+:\/\//;
    function normalizeUrl(path2) {
      if (typeof URL > "u" || !urlRe.test(path2))
        return null;
      try {
        return new URL(path2).href;
      } catch {
        return null;
      }
    }
    function resolveUrl(originPath, includePath) {
      if (typeof URL > "u" || !urlRe.test(originPath) || urlRe.test(includePath))
        return null;
      try {
        return new URL(includePath, originPath).href;
      } catch {
        return null;
      }
    }
    var isAbsolute = (
      /**
       * Tests if the specified path is absolute.
       * @param {string} path Path to test
       * @returns {boolean} `true` if path is absolute
       */
      path.isAbsolute = function(path2) {
        return /^(?:\/|\w+:|\\\\\w+)/.test(path2);
      }
    ), normalize = (
      /**
       * Normalizes the specified path.
       * @param {string} path Path to normalize
       * @returns {string} Normalized path
       */
      path.normalize = function(path2) {
        var normalizedUrl = normalizeUrl(path2);
        if (normalizedUrl)
          return normalizedUrl;
        var firstTwoCharacters = path2.substring(0, 2), uncPrefix = "";
        firstTwoCharacters === "\\\\" && (uncPrefix = firstTwoCharacters, path2 = path2.substring(2)), path2 = path2.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
        var parts = path2.split("/"), absolute = isAbsolute(path2), prefix = "";
        absolute && (prefix = parts.shift() + "/");
        for (var i = 0; i < parts.length; )
          parts[i] === ".." ? i > 0 && parts[i - 1] !== ".." ? parts.splice(--i, 2) : absolute ? parts.splice(i, 1) : ++i : parts[i] === "." ? parts.splice(i, 1) : ++i;
        return uncPrefix + prefix + parts.join("/");
      }
    );
    path.resolve = function(originPath, includePath, alreadyNormalized) {
      var resolvedUrl = resolveUrl(originPath, includePath);
      return resolvedUrl || (alreadyNormalized || (includePath = normalize(includePath)), isAbsolute(includePath) ? includePath : (alreadyNormalized || (originPath = normalize(originPath)), (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath));
    };
  }
});

// node_modules/protobufjs/src/namespace.js
var require_namespace = __commonJS({
  "node_modules/protobufjs/src/namespace.js"(exports, module) {
    "use strict";
    module.exports = Namespace;
    var ReflectionObject = require_object();
    Namespace.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Namespace,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Namespace.className = "Namespace";
    var Field = require_field(), util2 = require_util(), OneOf = require_oneof(), Type3, Service, Enum2;
    Namespace.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      return new Namespace(name, json.options).addJSON(json.nested, depth);
    };
    function arrayToJSON(array, toJSONOptions) {
      if (array && array.length) {
        for (var obj = {}, i = 0; i < array.length; ++i)
          obj[array[i].name] = array[i].toJSON(toJSONOptions);
        return obj;
      }
    }
    Namespace.arrayToJSON = arrayToJSON;
    Namespace.isReservedId = function(reserved, id) {
      if (reserved) {
        for (var i = 0; i < reserved.length; ++i)
          if (typeof reserved[i] != "string" && reserved[i][0] <= id && reserved[i][1] >= id)
            return !0;
      }
      return !1;
    };
    Namespace.isReservedName = function(reserved, name) {
      if (reserved) {
        for (var i = 0; i < reserved.length; ++i)
          if (reserved[i] === name)
            return !0;
      }
      return !1;
    };
    function Namespace(name, options) {
      ReflectionObject.call(this, name, options), this.nested = void 0, this._nestedArray = null, this._lookupCache = /* @__PURE__ */ Object.create(null), this._needsRecursiveFeatureResolution = !0, this._needsRecursiveResolve = !0;
    }
    function clearCache(namespace) {
      namespace._nestedArray = null, namespace._lookupCache = /* @__PURE__ */ Object.create(null);
      for (var parent = namespace; parent = parent.parent; )
        parent._lookupCache = /* @__PURE__ */ Object.create(null);
      return namespace;
    }
    Object.defineProperty(Namespace.prototype, "nestedArray", {
      get: function() {
        return this._nestedArray || (this._nestedArray = util2.toArray(this.nested));
      }
    });
    Namespace.prototype.toJSON = function(toJSONOptions) {
      return util2.toObject([
        "options",
        this.options,
        "nested",
        arrayToJSON(this.nestedArray, toJSONOptions)
      ]);
    };
    Namespace.prototype.addJSON = function(nestedJson, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      var ns = this;
      if (nestedJson)
        for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i)
          nested = nestedJson[names[i]], ns.add(
            // most to least likely
            (nested.fields !== void 0 ? Type3.fromJSON : nested.values !== void 0 ? Enum2.fromJSON : nested.methods !== void 0 ? Service.fromJSON : nested.id !== void 0 ? Field.fromJSON : Namespace.fromJSON)(names[i], nested, depth + 1)
          );
      return this;
    };
    Namespace.prototype.get = function(name) {
      return this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) ? this.nested[name] : null;
    };
    Namespace.prototype.getEnum = function(name) {
      if (this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) && this.nested[name] instanceof Enum2)
        return this.nested[name].values;
      throw Error("no such enum: " + name);
    };
    Namespace.prototype.add = function(object) {
      if (!(object instanceof Field && object.extend !== void 0 || object instanceof Type3 || object instanceof OneOf || object instanceof Enum2 || object instanceof Service || object instanceof Namespace))
        throw TypeError("object must be a valid nested object");
      if (object.name === "__proto__")
        return this;
      if (!this.nested)
        this.nested = {};
      else {
        var prev = this.get(object.name);
        if (prev)
          if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type3 || prev instanceof Service)) {
            for (var nested = prev.nestedArray, i = 0; i < nested.length; ++i)
              object.add(nested[i]);
            this.remove(prev), this.nested || (this.nested = {}), object.setOptions(prev.options, !0);
          } else
            throw Error("duplicate name '" + object.name + "' in " + this);
      }
      this.nested[object.name] = object, this instanceof Type3 || this instanceof Service || this instanceof Enum2 || this instanceof Field || object._edition || (object._edition = object._defaultEdition), this._needsRecursiveFeatureResolution = !0, this._needsRecursiveResolve = !0;
      for (var parent = this; parent = parent.parent; )
        parent._needsRecursiveFeatureResolution = !0, parent._needsRecursiveResolve = !0;
      return object.onAdd(this), clearCache(this);
    };
    Namespace.prototype.remove = function(object) {
      if (!(object instanceof ReflectionObject))
        throw TypeError("object must be a ReflectionObject");
      if (object.parent !== this)
        throw Error(object + " is not a member of " + this);
      if (!util2.remove(this.nested, object, object.name))
        throw Error(object + " is not a member of " + this);
      return Object.keys(this.nested).length || (this.nested = void 0), object.onRemove(this), clearCache(this);
    };
    Namespace.prototype.define = function(path, json) {
      if (util2.isString(path))
        path = path.split(".");
      else if (!Array.isArray(path))
        throw TypeError("illegal path");
      if (path && path.length && path[0] === "")
        throw Error("path must be relative");
      if (path.length > util2.recursionLimit)
        throw Error("max depth exceeded");
      for (var ptr = this; path.length > 0; ) {
        var part = path.shift();
        if (ptr.nested && ptr.nested[part]) {
          if (ptr = ptr.nested[part], !(ptr instanceof Namespace))
            throw Error("path conflicts with non-namespace objects");
        } else
          ptr.add(ptr = new Namespace(part));
      }
      return json && ptr.addJSON(json), ptr;
    };
    Namespace.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      this._needsRecursiveFeatureResolution && this._resolveFeaturesRecursive(this._edition);
      var nested = this.nestedArray, i = 0;
      for (this.resolve(); i < nested.length; )
        nested[i] instanceof Namespace ? nested[i++].resolveAll() : nested[i++].resolve();
      return this._needsRecursiveResolve = !1, this;
    };
    Namespace.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (this._needsRecursiveFeatureResolution = !1, edition = this._edition || edition, ReflectionObject.prototype._resolveFeaturesRecursive.call(this, edition), this.nestedArray.forEach((nested) => {
        nested._resolveFeaturesRecursive(edition);
      }), this) : this;
    };
    Namespace.prototype.lookup = function(path, filterTypes, parentAlreadyChecked) {
      if (typeof filterTypes == "boolean" ? (parentAlreadyChecked = filterTypes, filterTypes = void 0) : filterTypes && !Array.isArray(filterTypes) && (filterTypes = [filterTypes]), util2.isString(path) && path.length) {
        if (path === ".")
          return this.root;
        path = path.split(".");
      } else if (!path.length)
        return this;
      var flatPath = path.join(".");
      if (path[0] === "")
        return this.root.lookup(path.slice(1), filterTypes);
      var found = this._lookupImpl(path, flatPath);
      if (found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1) || (found = this.root._fullyQualifiedObjects && this.root._fullyQualifiedObjects["." + flatPath], found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1)))
        return found;
      if (parentAlreadyChecked)
        return null;
      for (var current = this; current.parent; ) {
        if (found = current.parent._lookupImpl(path, flatPath), found && (!filterTypes || filterTypes.indexOf(found.constructor) > -1))
          return found;
        current = current.parent;
      }
      return null;
    };
    Namespace.prototype._lookupImpl = function(path, flatPath) {
      if (Object.prototype.hasOwnProperty.call(this._lookupCache, flatPath))
        return this._lookupCache[flatPath];
      var found = this.get(path[0]), exact = null;
      if (found)
        path.length === 1 ? exact = found : found instanceof Namespace && (path = path.slice(1), exact = found._lookupImpl(path, path.join(".")));
      else
        for (var i = 0; i < this.nestedArray.length; ++i)
          if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i]._lookupImpl(path, flatPath))) {
            exact = found;
            break;
          }
      return this._lookupCache[flatPath] = exact, exact;
    };
    Namespace.prototype.lookupType = function(path) {
      var found = this.lookup(path, [Type3]);
      if (!found)
        throw Error("no such type: " + path);
      return found;
    };
    Namespace.prototype.lookupEnum = function(path) {
      var found = this.lookup(path, [Enum2]);
      if (!found)
        throw Error("no such Enum '" + path + "' in " + this);
      return found;
    };
    Namespace.prototype.lookupTypeOrEnum = function(path) {
      var found = this.lookup(path, [Type3, Enum2]);
      if (!found)
        throw Error("no such Type or Enum '" + path + "' in " + this);
      return found;
    };
    Namespace.prototype.lookupService = function(path) {
      var found = this.lookup(path, [Service]);
      if (!found)
        throw Error("no such Service '" + path + "' in " + this);
      return found;
    };
    Namespace._configure = function(Type_, Service_, Enum_) {
      Type3 = Type_, Service = Service_, Enum2 = Enum_;
    };
  }
});

// node_modules/protobufjs/src/mapfield.js
var require_mapfield = __commonJS({
  "node_modules/protobufjs/src/mapfield.js"(exports, module) {
    "use strict";
    module.exports = MapField;
    var Field = require_field();
    MapField.prototype = Object.create(Field.prototype, {
      constructor: {
        value: MapField,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    MapField.className = "MapField";
    var types = require_types(), util2 = require_util();
    function MapField(name, id, keyType, type, options, comment) {
      if (Field.call(this, name, id, type, void 0, void 0, options, comment), !util2.isString(keyType))
        throw TypeError("keyType must be a string");
      this.keyType = keyType, this.resolvedKeyType = null, this.map = !0;
    }
    MapField.fromJSON = function(name, json) {
      var field = new MapField(name, json.id, json.keyType, json.type, json.options, json.comment);
      return json.protoName && (field.protoName = json.protoName), json.jsonName !== void 0 ? field.jsonName = json.jsonName : json.options && json.options.json_name !== void 0 && (field.jsonName = json.options.json_name), field;
    };
    MapField.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "keyType",
        this.keyType,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "protoName",
        this.protoName !== this.name ? this.protoName : void 0,
        "jsonName",
        this.jsonName !== util2.jsonName(this.protoName || this.name) ? this.jsonName : void 0,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    MapField.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if (types.mapKey[this.keyType] === void 0)
        throw Error("invalid key type: " + this.keyType);
      return Field.prototype.resolve.call(this);
    };
    MapField.d = function(fieldId, fieldKeyType, fieldValueType) {
      return typeof fieldValueType == "function" ? fieldValueType = util2.decorateType(fieldValueType).name : fieldValueType && typeof fieldValueType == "object" && (fieldValueType = util2.decorateEnum(fieldValueType).name), function(prototype, fieldName) {
        util2.decorateType(prototype.constructor).add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
      };
    };
  }
});

// node_modules/protobufjs/src/method.js
var require_method = __commonJS({
  "node_modules/protobufjs/src/method.js"(exports, module) {
    "use strict";
    module.exports = Method;
    var ReflectionObject = require_object();
    Method.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Method,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Method.className = "Method";
    var util2 = require_util();
    function Method(name, type, requestType, responseType, requestStream, responseStream, options, comment, parsedOptions) {
      if (util2.isObject(requestStream) ? (options = requestStream, requestStream = responseStream = void 0) : util2.isObject(responseStream) && (options = responseStream, responseStream = void 0), !(type === void 0 || util2.isString(type)))
        throw TypeError("type must be a string");
      if (!util2.isString(requestType))
        throw TypeError("requestType must be a string");
      if (!util2.isString(responseType))
        throw TypeError("responseType must be a string");
      ReflectionObject.call(this, name, options), this.type = type || "rpc", this.requestType = requestType, this.requestStream = requestStream ? !0 : void 0, this.responseType = responseType, this.responseStream = responseStream ? !0 : void 0, this.path = "/" + this.name, this.resolvedRequestType = null, this.resolvedResponseType = null, this.comment = comment, this.parsedOptions = parsedOptions;
    }
    Method.fromJSON = function(name, json) {
      return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options, json.comment, json.parsedOptions);
    };
    Method.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "type",
        this.type !== "rpc" && /* istanbul ignore next */
        this.type || void 0,
        "requestType",
        this.requestType,
        "requestStream",
        this.requestStream,
        "responseType",
        this.responseType,
        "responseStream",
        this.responseStream,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0,
        "parsedOptions",
        this.parsedOptions
      ]);
    };
    Method.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if (this.parent) {
        var serviceName = this.parent.fullName;
        serviceName.charAt(0) === "." && (serviceName = serviceName.substring(1)), this.path = "/" + serviceName + "/" + this.name;
      } else
        this.path = "/" + this.name;
      return this.resolvedRequestType = this.parent.lookupType(this.requestType), this.resolvedResponseType = this.parent.lookupType(this.responseType), ReflectionObject.prototype.resolve.call(this);
    };
  }
});

// node_modules/protobufjs/src/service.js
var require_service2 = __commonJS({
  "node_modules/protobufjs/src/service.js"(exports, module) {
    "use strict";
    module.exports = Service;
    var Namespace = require_namespace();
    Service.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Service,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Service.className = "Service";
    var Method = require_method(), util2 = require_util(), rpc = require_rpc();
    function Service(name, options) {
      Namespace.call(this, name, options), this.methods = {}, this._methodsArray = null;
    }
    Service.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      var service = new Service(name, json.options);
      if (json.methods)
        for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
          service.add(Method.fromJSON(names[i], json.methods[names[i]]));
      return json.nested && service.addJSON(json.nested, depth), json.edition && (service._edition = json.edition), service.comment = json.comment, service._defaultEdition = "proto3", service;
    };
    Service.prototype.toJSON = function(toJSONOptions) {
      var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions), keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        inherited && inherited.options || void 0,
        "methods",
        Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */
        {},
        "nested",
        inherited && inherited.nested || void 0,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Object.defineProperty(Service.prototype, "methodsArray", {
      get: function() {
        return this._methodsArray || (this._methodsArray = util2.toArray(this.methods));
      }
    });
    function clearCache(service) {
      return service._methodsArray = null, service;
    }
    Service.prototype.get = function(name) {
      return Object.prototype.hasOwnProperty.call(this.methods, name) ? this.methods[name] : Namespace.prototype.get.call(this, name);
    };
    Service.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      Namespace.prototype.resolve.call(this);
      for (var methods = this.methodsArray, i = 0; i < methods.length; ++i)
        methods[i].resolve();
      return this;
    };
    Service.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (edition = this._edition || edition, Namespace.prototype._resolveFeaturesRecursive.call(this, edition), this.methodsArray.forEach((method) => {
        method._resolveFeaturesRecursive(edition);
      }), this) : this;
    };
    Service.prototype.add = function(object) {
      if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);
      return object instanceof Method ? object.name === "__proto__" ? this : (this.methods[object.name] = object, object.parent = this, clearCache(this)) : Namespace.prototype.add.call(this, object);
    };
    Service.prototype.remove = function(object) {
      if (object instanceof Method) {
        if (this.methods[object.name] !== object)
          throw Error(object + " is not a member of " + this);
        return delete this.methods[object.name], object.parent = null, clearCache(this);
      }
      return Namespace.prototype.remove.call(this, object);
    };
    Service.prototype.create = function(rpcImpl, requestDelimited, responseDelimited) {
      for (var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited), i = 0, method; i < /* initializes */
      this.methodsArray.length; ++i) {
        var methodName = util2.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, "");
        rpcService[methodName] = /* @__PURE__ */ (function(method2, requestType, responseType) {
          return function(request, callback) {
            return rpc.Service.prototype.rpcCall.call(this, method2, requestType, responseType, request, callback);
          };
        })(method, method.resolvedRequestType.ctor, method.resolvedResponseType.ctor);
      }
      return rpcService;
    };
  }
});

// node_modules/protobufjs/src/message.js
var require_message = __commonJS({
  "node_modules/protobufjs/src/message.js"(exports, module) {
    "use strict";
    module.exports = Message;
    var util2 = require_minimal();
    function Message(properties) {
      if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
          properties[keys[i]] != null && keys[i] !== "__proto__" && (this[keys[i]] = properties[keys[i]]);
    }
    Message.create = function(properties) {
      return this.$type.create(properties);
    };
    Message.encode = function(message, writer) {
      return this.$type.encode(message, writer);
    };
    Message.encodeDelimited = function(message, writer) {
      return this.$type.encodeDelimited(message, writer);
    };
    Message.decode = function(reader) {
      return this.$type.decode(reader);
    };
    Message.decodeDelimited = function(reader) {
      return this.$type.decodeDelimited(reader);
    };
    Message.verify = function(message) {
      return this.$type.verify(message);
    };
    Message.fromObject = function(object) {
      return this.$type.fromObject(object);
    };
    Message.toObject = function(message, options) {
      return this.$type.toObject(message, options);
    };
    Message.prototype.toJSON = function() {
      return this.$type.toObject(this, util2.toJSONOptions);
    };
  }
});

// node_modules/protobufjs/src/decoder.js
var require_decoder = __commonJS({
  "node_modules/protobufjs/src/decoder.js"(exports, module) {
    "use strict";
    module.exports = decoder;
    var Enum2 = require_enum(), types = require_types(), util2 = require_util();
    function missing(field) {
      return "missing required '" + field.name + "'";
    }
    function stringMethod(field) {
      return field._features.utf8_validation === "VERIFY" ? "stringVerify" : "string";
    }
    function genPreserveUnknown(gen, ref) {
      return gen("if(!r.discardUnknown){")('util.makeProp(m,"$unknowns",false);')("(m.$unknowns||(m.$unknowns=[])).push(%s)", ref)("}");
    }
    function decoder(mtype) {
      for (var hasMapField = !1, needsValueVar = !1, i = 0; i < mtype.fieldsArray.length; ++i) {
        var pfield = mtype._fieldsArray[i];
        pfield.map && (hasMapField = !0), (pfield.resolvedType instanceof Enum2 || !pfield.repeated && !pfield.map && !pfield.hasPresence) && (needsValueVar = !0);
      }
      var gen = util2.codegen(["r", "l", "z", "q", "g"])("if(!(r instanceof Reader))")("r=Reader.create(r)")("if(q===undefined)q=0")("if(q>Reader.recursionLimit)")('throw Error("max depth exceeded")')("var c,m" + (hasMapField ? ",k,v" : needsValueVar ? ",v" : ""))("if(l===undefined)")("c=r.len")("else{")("c=r.pos+l")("if(c>r.len)")('throw RangeError("index out of range")')("l=r.len")("r.len=c")("}")("m=g||new C")("while(r.pos<c){")("var s=r.pos")("var t=r.tag()")("if(t===z){")("z=undefined")("break")("}");
      for (mtype.fieldsArray.length && gen("var u=t&7")("switch(t>>>=3){"), i = 0; i < /* initializes */
      mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(), type = field.resolvedType instanceof Enum2 ? "int32" : field.type, ref = "m" + util2.safeProp(field.name), closed = field.resolvedType instanceof Enum2 && field.resolvedType._features.enum_type === "CLOSED";
        if (field.map) {
          gen("case %i:{", field.id)("if(u!==2)")("break"), closed || gen("if(%s===util.emptyObject)", ref)("%s={}", ref), gen("var c2=r.size()+r.pos")("if(c2>r.len)")('throw RangeError("index out of range")')("r.len=c2"), types.defaults[field.keyType] !== void 0 ? gen("k=%j", types.defaults[field.keyType]) : gen("k=null"), types.long[type] !== void 0 ? gen("v=util.Long?util.Long.fromNumber(0,%j):0", type === "uint64" || type === "fixed64") : types.defaults[type] !== void 0 ? gen("v=%j", types.defaults[type]) : gen("v=null"), gen("while(r.pos<c2){")("var t2=r.tag()")("u=t2&7")("switch(t2>>>=3){")("case 1:")("if(u!==%i)", types.mapKey[field.keyType])("break")("k=r.%s()", field.keyType === "string" ? stringMethod(field) : field.keyType)("continue")("case 2:")("if(u!==%i)", types.basic[type] === void 0 ? 2 : types.basic[type])("break"), types.basic[type] === void 0 ? gen("v=types[%i].decode(r,r.size(),undefined,q+1,v)", i) : gen("v=r.%s()", type === "string" ? stringMethod(field) : type), gen("continue")("}")("r.skipType(u,q,t2)")("}"), gen("if(r.pos!==c2)")('throw RangeError("index out of range")')("r.len=c"), closed && (gen("if(types[%i].valuesById[v]===undefined){", i), genPreserveUnknown(gen, "r.raw(s,r.pos)")("continue")("}")("if(%s===util.emptyObject)", ref)("%s={}", ref));
          var val = types.basic[type] === void 0 ? "v||new types[" + i + "].ctor" : "v";
          types.long[field.keyType] !== void 0 ? gen('%s[typeof k==="object"?util.longToHash(k):k]=%s', ref, val) : (field.keyType === "string" && gen('if(k==="__proto__")')("util.makeProp(%s,k)", ref), gen("%s[k]=%s", ref, val));
        } else field.repeated ? (gen("case %i:", field.id)("{"), types.packed[type] !== void 0 && (gen("if(u===2){"), closed ? (gen("var c2=r.size()+r.pos")("if(c2>r.len)")('throw RangeError("index out of range")')("r.len=c2")("while(r.pos<c2){")("s=r.pos")("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("%s.push(v)", ref)("}else"), genPreserveUnknown(gen, "util.rawField(" + field.id + ",0,r.raw(s,r.pos))")("}"), gen("if(r.pos!==c2)")('throw RangeError("index out of range")')("r.len=c")) : gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("r.%ss(%s)", type, ref), gen("continue")("}")), gen("if(u!==%i)", types.basic[type] === void 0 ? field.delimited ? 3 : 2 : types.basic[type])("break"), closed || gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref), types.basic[type] === void 0 ? field.delimited ? gen("%s.push(types[%i].decode(r,undefined,%i,q+1))", ref, i, field.id * 8 + 4) : gen("%s.push(types[%i].decode(r,r.size(),undefined,q+1))", ref, i) : closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref)("%s.push(v)", ref)("}else"), genPreserveUnknown(gen, "r.raw(s,r.pos)")) : gen("%s.push(r.%s())", ref, type === "string" ? stringMethod(field) : type)) : types.basic[type] === void 0 ? (gen("case %i:{", field.id)("if(u!==%i)", field.delimited ? 3 : 2)("break"), field.delimited ? gen("%s=types[%i].decode(r,undefined,%i,q+1,%s)", ref, i, field.id * 8 + 4, ref) : gen("%s=types[%i].decode(r,r.size(),undefined,q+1,%s)", ref, i, ref)) : field.hasPresence ? (gen("case %i:{", field.id)("if(u!==%i)", types.basic[type])("break"), closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("%s=v", ref), field.partOf && gen("m%s=%j", util2.safeProp(field.partOf.name), field.name), gen("}else"), genPreserveUnknown(gen, "r.raw(s,r.pos)")) : gen("%s=r.%s()", ref, type === "string" ? stringMethod(field) : type)) : (gen("case %i:{", field.id)("if(u!==%i)", types.basic[type])("break"), closed ? (gen("v=r.%s()", type)("if(types[%i].valuesById[v]!==undefined){", i)("if(v!==%j)", field.typeDefault)("%s=v", ref)("else")("delete %s", ref)("}else{"), genPreserveUnknown(gen, "r.raw(s,r.pos)")("}")) : (field.resolvedType instanceof Enum2 && field.typeDefault !== 0 ? gen("if((v=r.%s())!==%j)", type, field.typeDefault) : type === "string" ? gen("if((v=r.%s()).length)", stringMethod(field)) : type === "bytes" ? gen("if((v=r.%s()).length)", type) : types.long[type] !== void 0 ? gen('if(typeof(v=r.%s())==="object"?v.low||v.high:v!==0)', type) : gen(type === "double" || type === "float" ? "if(!Object.is(v=r.%s(),0))" : "if(v=r.%s())", type), gen("%s=v", ref)("else")("delete %s", ref)));
        field.partOf && !closed && gen("m%s=%j", util2.safeProp(field.partOf.name), field.name), gen("continue")("}");
      }
      for (i && gen("}"), gen("r.skipType(%s,q,t)", i ? "u" : "t&7"), genPreserveUnknown(gen, "r.raw(s,r.pos)")("}")("if(l!==undefined){")("if(r.pos!==c)")('throw RangeError("index out of range")')("r.len=l")("}")("if(z!==undefined)")('throw Error("missing end group")'), i = 0; i < mtype._fieldsArray.length; ++i) {
        var rfield = mtype._fieldsArray[i];
        rfield.required && gen("if(!Object.hasOwnProperty.call(m,%j))", rfield.name)("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
      }
      return gen("return m");
    }
  }
});

// node_modules/protobufjs/src/verifier.js
var require_verifier = __commonJS({
  "node_modules/protobufjs/src/verifier.js"(exports, module) {
    "use strict";
    module.exports = verifier;
    var Enum2 = require_enum(), util2 = require_util();
    function invalid(field, expected) {
      return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:" + field.keyType + "}" : "") + " expected";
    }
    function genVerifyValue(gen, field, fieldIndex, ref) {
      var resolvedType = field.resolvedType;
      if (resolvedType)
        if (resolvedType instanceof Enum2)
          if (resolvedType._features.enum_type === "CLOSED") {
            gen("switch(%s){", ref)("default:")("return%j", invalid(field, "enum value"));
            for (var keys = Object.keys(resolvedType.values), j = 0; j < keys.length; ++j) gen("case %i:", resolvedType.values[keys[j]]);
            gen("break")("}");
          } else gen('if(typeof %s!=="number"||(%s|0)!==%s)', ref, ref, ref)("return%j", invalid(field, "enum value"));
        else
          gen("{")("var e=types[%i].verify(%s,q+1);", fieldIndex, ref)("if(e)")("return%j+e", field.name + ".")("}");
      else
        switch (field.type) {
          case "int32":
          case "uint32":
          case "sint32":
          case "fixed32":
          case "sfixed32":
            gen("if(!util.isInteger(%s))", ref)("return%j", invalid(field, "integer"));
            break;
          case "int64":
          case "uint64":
          case "sint64":
          case "fixed64":
          case "sfixed64":
            gen("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)("return%j", invalid(field, "integer|Long"));
            break;
          case "float":
          case "double":
            gen('if(typeof %s!=="number")', ref)("return%j", invalid(field, "number"));
            break;
          case "bool":
            gen('if(typeof %s!=="boolean")', ref)("return%j", invalid(field, "boolean"));
            break;
          case "string":
            gen("if(!util.isString(%s))", ref)("return%j", invalid(field, "string"));
            break;
          case "bytes":
            gen('if(!(%s&&typeof %s.length==="number"||util.isString(%s)))', ref, ref, ref)("return%j", invalid(field, "buffer"));
            break;
        }
      return gen;
    }
    function genVerifyKey(gen, field, ref) {
      switch (field.keyType) {
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32":
          gen("if(!util.key32Re.test(%s))", ref)("return%j", invalid(field, "integer key"));
          break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64":
          gen("if(!util.key64Re.test(%s))", ref)("return%j", invalid(field, "integer|Long key"));
          break;
        case "bool":
          gen("if(!util.key2Re.test(%s))", ref)("return%j", invalid(field, "boolean key"));
          break;
      }
      return gen;
    }
    function verifier(mtype) {
      var gen = util2.codegen(["m", "q"])('if(typeof m!=="object"||m===null)')("return%j", "object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")("return%j", "max depth exceeded"), oneofs = mtype.oneofsArray, seenFirstField = {};
      oneofs.length && gen("var p={}");
      for (var i = 0; i < /* initializes */
      mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(), ref = "m" + util2.safeProp(field.name);
        if (field.optional && gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name), field.map)
          gen("if(!util.isObject(%s))", ref)("return%j", invalid(field, "object"))("var k=Object.keys(%s)", ref)("for(var i=0;i<k.length;++i){"), genVerifyKey(gen, field, "k[i]"), genVerifyValue(gen, field, i, ref + "[k[i]]")("}");
        else if (field.repeated)
          gen("if(!Array.isArray(%s))", ref)("return%j", invalid(field, "array"))("for(var i=0;i<%s.length;++i){", ref), genVerifyValue(gen, field, i, ref + "[i]")("}");
        else {
          if (field.partOf) {
            var oneofProp = util2.safeProp(field.partOf.name);
            seenFirstField[field.partOf.name] === 1 && gen("if(p%s===1)", oneofProp)("return%j", field.partOf.name + ": multiple values"), seenFirstField[field.partOf.name] = 1, gen("p%s=1", oneofProp);
          }
          genVerifyValue(gen, field, i, ref);
        }
        field.optional && gen("}");
      }
      return gen("return null");
    }
  }
});

// node_modules/protobufjs/src/converter.js
var require_converter = __commonJS({
  "node_modules/protobufjs/src/converter.js"(exports) {
    "use strict";
    var converter = exports, Enum2 = require_enum(), types = require_types(), util2 = require_util();
    function genValuePartial_fromObject(gen, field, fieldIndex, prop, dstProp) {
      if (field.resolvedType)
        if (field.resolvedType instanceof Enum2) {
          var dst = dstProp ? "m" + dstProp + "[m" + dstProp + ".length]" : "m" + prop;
          gen("switch(d%s){", prop);
          for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i)
            gen("case%j:", keys[i])("case %i:", values[keys[i]])("%s=%j", dst, values[keys[i]])("break");
          gen("default:"), field.resolvedType._features.enum_type !== "CLOSED" && gen('if(typeof d%s==="number"&&(d%s|0)===d%s)', prop, prop, prop)("%s=d%s", dst, prop), gen("}");
        } else gen("if(!util.isObject(d%s))", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s=types[%i].fromObject(d%s,q+1)", prop, fieldIndex, prop);
      else {
        var isUnsigned = !1;
        switch (field.type) {
          case "double":
          case "float":
            gen("m%s=Number(d%s)", prop, prop);
            break;
          case "uint32":
          case "fixed32":
            gen("m%s=d%s>>>0", prop, prop);
            break;
          case "int32":
          case "sint32":
          case "sfixed32":
            gen("m%s=d%s|0", prop, prop);
            break;
          case "uint64":
          case "fixed64":
            isUnsigned = !0;
          // eslint-disable-next-line no-fallthrough
          case "int64":
          case "sint64":
          case "sfixed64":
            gen("if(util.Long)")("m%s=util.Long.fromValue(d%s,%j)", prop, prop, isUnsigned)('else if(typeof d%s==="string")', prop)("m%s=parseInt(d%s,10)", prop, prop)('else if(typeof d%s==="number")', prop)("m%s=d%s", prop, prop)('else if(typeof d%s==="object")', prop)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
            break;
          case "bytes":
            gen('if(typeof d%s==="string")', prop)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)("else if(d%s.length>=0)", prop)("m%s=d%s", prop, prop);
            break;
          case "string":
            gen("m%s=String(d%s)", prop, prop);
            break;
          case "bool":
            gen("m%s=Boolean(d%s)", prop, prop);
            break;
        }
      }
      return gen;
    }
    converter.fromObject = function(mtype) {
      var fields = mtype.fieldsArray, gen = util2.codegen(["d", "q"])("if(d instanceof C)")("return d")("if(!util.isObject(d))")("throw TypeError(%j)", mtype.fullName + ": object expected")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")');
      if (!fields.length) return gen("return new C");
      gen("var m=new C");
      for (var i = 0; i < fields.length; ++i) {
        var field = fields[i].resolve(), prop = util2.safeProp(field.name), implicitPresence = !field.hasPresence && !field.repeated && !field.map && (field.resolvedType instanceof Enum2 || types.basic[field.type] !== void 0);
        field.map ? (gen("if(d%s){", prop)("if(!util.isObject(d%s))", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s={}", prop)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop), gen('if(ks[i]==="__proto__")')("util.makeProp(m%s,ks[i])", prop), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop + "[ks[i]]"
        )("}")("}")) : field.repeated ? (gen("if(d%s){", prop)("if(!Array.isArray(d%s))", prop)("throw TypeError(%j)", field.fullName + ": array expected"), field.resolvedType instanceof Enum2 ? gen("m%s=[]", prop) : gen("m%s=Array(d%s.length)", prop, prop), gen("for(var i=0;i<d%s.length;++i){", prop), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop + "[i]",
          field.resolvedType instanceof Enum2 ? prop : void 0
        )("}")("}")) : (field.resolvedType instanceof Enum2 || gen("if(d%s!=null){", prop), implicitPresence && (field.resolvedType instanceof Enum2 ? gen('if(d%s!==%j&&(typeof d%s!=="string"||types[%i].values[d%s]!==%j)){', prop, field.typeDefault, prop, i, prop, field.typeDefault) : field.type === "string" ? gen('if(typeof d%s!=="string"||d%s.length){', prop, prop) : field.type === "bytes" ? gen("if(d%s.length){", prop) : field.type === "bool" ? gen("if(d%s){", prop) : field.type === "double" || field.type === "float" ? gen("if(!Object.is(Number(d%s),0)){", prop) : types.long[field.type] !== void 0 ? gen('if(typeof d%s==="object"?d%s.low||d%s.high:Number(d%s)!==0){', prop, prop, prop, prop) : gen("if(Number(d%s)!==0){", prop)), genValuePartial_fromObject(
          gen,
          field,
          /* not sorted */
          i,
          prop
        ), implicitPresence && gen("}"), field.resolvedType instanceof Enum2 || gen("}"));
      }
      return gen("return m");
    };
    function genValuePartial_toObject(gen, field, fieldIndex, dstProp, srcProp) {
      if (srcProp || (srcProp = dstProp), field.resolvedType)
        field.resolvedType instanceof Enum2 ? gen("d%s=o.enums===String?(types[%i].values[m%s]===undefined?m%s:types[%i].values[m%s]):m%s", dstProp, fieldIndex, srcProp, srcProp, fieldIndex, srcProp, srcProp) : gen("d%s=types[%i].toObject(m%s,o,q+1)", dstProp, fieldIndex, srcProp);
      else {
        var isUnsigned = !1;
        switch (field.type) {
          case "double":
          case "float":
            gen("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", dstProp, srcProp, srcProp, srcProp);
            break;
          case "uint64":
          case "fixed64":
            isUnsigned = !0;
          // eslint-disable-next-line no-fallthrough
          case "int64":
          case "sint64":
          case "sfixed64":
            gen('if(typeof BigInt!=="undefined"&&o.longs===BigInt)')('d%s=typeof m%s==="number"?BigInt(m%s):util.Long.fromBits(m%s.low>>>0,m%s.high>>>0,%j).toBigInt()', dstProp, srcProp, srcProp, srcProp, srcProp, isUnsigned)('else if(typeof m%s==="number")', srcProp)("d%s=o.longs===String?String(m%s):m%s", dstProp, srcProp, srcProp)("else")("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", dstProp, srcProp, srcProp, srcProp, isUnsigned ? "true" : "", srcProp);
            break;
          case "bytes":
            gen("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", dstProp, srcProp, srcProp, srcProp, srcProp);
            break;
          default:
            gen("d%s=m%s", dstProp, srcProp);
            break;
        }
      }
      return gen;
    }
    converter.toObject = function(mtype) {
      var fields = mtype.fieldsArray.slice().sort(util2.compareFieldsById);
      if (!fields.length)
        return util2.codegen()("return {}");
      for (var gen = util2.codegen(["m", "o", "q"])("if(!o)")("o={}")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")')("var d={}"), repeatedFields = [], mapFields = [], normalFields = [], i = 0; i < fields.length; ++i)
        fields[i].partOf || (fields[i].resolve().repeated ? repeatedFields : fields[i].map ? mapFields : normalFields).push(fields[i]);
      if (repeatedFields.length) {
        for (gen("if(o.arrays||o.defaults){"), i = 0; i < repeatedFields.length; ++i) gen("d%s=[]", util2.safeProp(repeatedFields[i].name));
        gen("}");
      }
      if (mapFields.length) {
        for (gen("if(o.objects||o.defaults){"), i = 0; i < mapFields.length; ++i) gen("d%s={}", util2.safeProp(mapFields[i].name));
        gen("}");
      }
      if (normalFields.length) {
        for (gen("if(o.defaults){"), i = 0; i < normalFields.length; ++i) {
          var field = normalFields[i], prop = util2.safeProp(field.name);
          if (field.resolvedType instanceof Enum2) gen("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
          else if (field.long) gen("if(util.Long){")("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)('d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():typeof BigInt!=="undefined"&&o.longs===BigInt?n.toBigInt():n', prop)("}else")('d%s=o.longs===String?%j:typeof BigInt!=="undefined"&&o.longs===BigInt?BigInt(%j):%i', prop, field.typeDefault.toString(), field.typeDefault.toString(), field.typeDefault.toNumber());
          else if (field.bytes) {
            var arrayDefault = Array.prototype.slice.call(field.typeDefault);
            gen("if(o.bytes===String)d%s=%j", prop, util2.base64.encode(field.typeDefault, 0, field.typeDefault.length))("else{")("d%s=%j", prop, arrayDefault)("if(o.bytes!==Array)d%s=util.newBuffer(d%s)", prop, prop)("}");
          } else (field.type === "double" || field.type === "float") && typeof field.typeDefault == "number" && (!isFinite(field.typeDefault) || Object.is(field.typeDefault, -0)) ? gen("d%s=%f", prop, field.typeDefault)("if(o.json&&!isFinite(d%s))d%s=String(d%s)", prop, prop, prop) : gen("d%s=%j", prop, field.typeDefault);
        }
        gen("}");
      }
      var hasKs2 = !1;
      for (i = 0; i < fields.length; ++i) {
        var field = fields[i], index = mtype._fieldsArray.indexOf(field), prop = util2.safeProp(field.name);
        if (field.map) {
          hasKs2 || (hasKs2 = !0, gen("var ks2")), gen("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)("d%s={}", prop);
          var longKey = types.long[field.keyType] !== void 0, srcProp = prop + "[ks2[j]]";
          gen("for(var j=0;j<ks2.length;++j){"), longKey && gen("var k2=util.longFromKey(ks2[j],%j).toString()", field.keyType === "uint64" || field.keyType === "fixed64"), gen('if(ks2[j]==="__proto__")')("util.makeProp(d%s,ks2[j])", prop), genValuePartial_toObject(
            gen,
            field,
            /* sorted */
            index,
            longKey ? prop + "[k2]" : srcProp,
            srcProp
          )("}");
        } else field.repeated ? (gen("if(m%s&&m%s.length){", prop, prop)("d%s=Array(m%s.length)", prop, prop)("for(var j=0;j<m%s.length;++j){", prop), genValuePartial_toObject(
          gen,
          field,
          /* sorted */
          index,
          prop + "[j]"
        )("}")) : (gen("if(m%s!=null&&Object.hasOwnProperty.call(m,%j)){", prop, field.name), genValuePartial_toObject(
          gen,
          field,
          /* sorted */
          index,
          prop
        ), field.partOf && !field.partOf.isProto3Optional && gen("if(o.oneofs)")("d%s=%j", util2.safeProp(field.partOf.name), field.name));
        gen("}");
      }
      return gen("return d");
    };
  }
});

// node_modules/protobufjs/src/wrappers.js
var require_wrappers = __commonJS({
  "node_modules/protobufjs/src/wrappers.js"(exports) {
    "use strict";
    var wrappers = exports, Message = require_message(), util2 = require_minimal();
    wrappers[".google.protobuf.Any"] = {
      fromObject: function(object, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        if (object && object["@type"]) {
          var name = object["@type"].substring(object["@type"].lastIndexOf("/") + 1), type = this.lookup(name, [this.constructor]);
          if (type) {
            var type_url = object["@type"].charAt(0) === "." ? object["@type"].slice(1) : object["@type"];
            return type_url.indexOf("/") === -1 && (type_url = "/" + type_url), this.create({
              type_url,
              value: type.encode(type.fromObject(object, depth + 1)).finish()
            });
          }
        }
        return this.fromObject(object, depth);
      },
      toObject: function(message, options, depth) {
        if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
          throw Error("max depth exceeded");
        var googleApi = "type.googleapis.com/", prefix = "", name = "";
        if (options && options.json && message.type_url && message.value) {
          name = message.type_url.substring(message.type_url.lastIndexOf("/") + 1), prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
          var type = this.lookup(name, [this.constructor]);
          type && (message = type.decode(message.value, void 0, void 0, depth + 1));
        }
        if (!(message instanceof this.ctor) && message instanceof Message) {
          var object = message.$type.toObject(message, options, depth + 1), messageName = message.$type.fullName[0] === "." ? message.$type.fullName.slice(1) : message.$type.fullName;
          return prefix === "" && (prefix = googleApi), name = prefix + messageName, object["@type"] = name, object;
        }
        return this.toObject(message, options, depth);
      }
    };
  }
});

// node_modules/protobufjs/src/type.js
var require_type = __commonJS({
  "node_modules/protobufjs/src/type.js"(exports, module) {
    "use strict";
    module.exports = Type3;
    var Namespace = require_namespace();
    Type3.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Type3,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Type3.className = "Type";
    var Enum2 = require_enum(), OneOf = require_oneof(), Field = require_field(), MapField = require_mapfield(), Service = require_service2(), Message = require_message(), Reader = require_reader(), Writer = require_writer(), util2 = require_util(), encoder = require_encoder(), decoder = require_decoder(), verifier = require_verifier(), converter = require_converter(), wrappers = require_wrappers();
    function Type3(name, options) {
      name = name.replace(/\W/g, ""), Namespace.call(this, name, options), this.fields = {}, this.oneofs = void 0, this.extensions = void 0, this.reserved = void 0, this.group = void 0, this.visibility = void 0, this._fieldsById = null, this._fieldsArray = null, this._oneofsArray = null, this._ctor = null, this._fieldsByJsonName = null;
    }
    Object.defineProperties(Type3.prototype, {
      /**
       * Message fields by id.
       * @name Type#fieldsById
       * @type {Object.<number,Field>}
       * @readonly
       */
      fieldsById: {
        get: function() {
          if (this._fieldsById)
            return this._fieldsById;
          this._fieldsById = {};
          for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
            var field = this.fields[names[i]], id = field.id;
            if (this._fieldsById[id])
              throw Error("duplicate id " + id + " in " + this);
            this._fieldsById[id] = field;
          }
          return this._fieldsById;
        }
      },
      /**
       * Fields of this message as an array for iteration.
       * @name Type#fieldsArray
       * @type {Field[]}
       * @readonly
       */
      fieldsArray: {
        get: function() {
          return this._fieldsArray || (this._fieldsArray = util2.toArray(this.fields));
        }
      },
      /**
       * Oneofs of this message as an array for iteration.
       * @name Type#oneofsArray
       * @type {OneOf[]}
       * @readonly
       */
      oneofsArray: {
        get: function() {
          return this._oneofsArray || (this._oneofsArray = util2.toArray(this.oneofs));
        }
      },
      /**
       * The registered constructor, if any registered, otherwise a generic constructor.
       * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
       * When assigning manually, add the type to its parent namespace/root first if fields reference other reflected types, because constructor setup resolves field defaults.
       * @name Type#ctor
       * @type {Constructor<{}>}
       */
      ctor: {
        get: function() {
          return this._ctor || (this.ctor = Type3.generateConstructor(this)());
        },
        set: function(ctor) {
          var prototype = ctor.prototype;
          prototype instanceof Message || (ctor.prototype = new Message(), Object.defineProperty(ctor.prototype, "constructor", {
            value: ctor,
            writable: !0,
            enumerable: !1,
            configurable: !0
          }), util2.merge(ctor.prototype, prototype)), ctor.$type = ctor.prototype.$type = this, util2.merge(ctor, Message, !0), this._ctor = ctor, delete this.decode, delete this.fromObject;
          for (var i = 0, field; i < /* initializes */
          this.fieldsArray.length; ++i)
            field = this._fieldsArray[i].resolve(), ctor.prototype[field.name] = field.defaultValue;
          var ctorProperties = {};
          for (i = 0; i < /* initializes */
          this.oneofsArray.length; ++i)
            ctorProperties[this._oneofsArray[i].resolve().name] = {
              get: util2.oneOfGetter(this._oneofsArray[i].oneof),
              set: util2.oneOfSetter(this._oneofsArray[i].oneof)
            };
          i && Object.defineProperties(ctor.prototype, ctorProperties);
        }
      }
    });
    Type3.generateConstructor = function(mtype) {
      for (var gen = util2.codegen(["p"]), i = 0, field; i < mtype.fieldsArray.length; ++i)
        (field = mtype._fieldsArray[i]).map ? gen("this%s={}", util2.safeProp(field.name)) : field.repeated && gen("this%s=[]", util2.safeProp(field.name));
      return gen('if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null&&ks[i]!=="__proto__")')("this[ks[i]]=p[ks[i]]");
    };
    function clearCache(type) {
      return type._fieldsById = type._fieldsArray = type._oneofsArray = type._fieldsByJsonName = null, delete type.encode, delete type.decode, delete type.verify, type;
    }
    Type3.fromJSON = function(name, json, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.nestingLimit)
        throw Error("max depth exceeded");
      var type = new Type3(name, json.options);
      type.extensions = json.extensions, type.reserved = json.reserved;
      for (var names = Object.keys(json.fields), i = 0; i < names.length; ++i)
        type.add(
          (typeof json.fields[names[i]].keyType < "u" ? MapField.fromJSON : Field.fromJSON)(names[i], json.fields[names[i]])
        );
      if (json.oneofs)
        for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
          type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
      if (json.nested)
        for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
          var nested = json.nested[names[i]];
          type.add(
            // most to least likely
            (nested.id !== void 0 ? Field.fromJSON : nested.fields !== void 0 ? Type3.fromJSON : nested.values !== void 0 ? Enum2.fromJSON : nested.methods !== void 0 ? Service.fromJSON : Namespace.fromJSON)(names[i], nested, depth + 1)
          );
        }
      return json.extensions && json.extensions.length && (type.extensions = json.extensions), json.reserved && json.reserved.length && (type.reserved = json.reserved), json.group && (type.group = !0), json.visibility && (type.visibility = json.visibility), json.comment && (type.comment = json.comment), json.edition && (type._edition = json.edition), type._defaultEdition = "proto3", type;
    };
    Type3.prototype.toJSON = function(toJSONOptions) {
      var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions), keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        inherited && inherited.options || void 0,
        "oneofs",
        Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
        "fields",
        Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) {
          return !obj.declaringField;
        }), toJSONOptions) || {},
        "extensions",
        this.extensions && this.extensions.length ? this.extensions : void 0,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : void 0,
        "group",
        this.group || void 0,
        "visibility",
        this.visibility,
        "nested",
        inherited && inherited.nested || void 0,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Type3.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      Namespace.prototype.resolveAll.call(this);
      var oneofs = this.oneofsArray;
      for (i = 0; i < oneofs.length; )
        oneofs[i++].resolve();
      for (var fields = this.fieldsArray, i = 0; i < fields.length; )
        fields[i++].resolve();
      return this;
    };
    Type3.prototype._resolveFeaturesRecursive = function(edition) {
      return this._needsRecursiveFeatureResolution ? (edition = this._edition || edition, Namespace.prototype._resolveFeaturesRecursive.call(this, edition), this.oneofsArray.forEach((oneof) => {
        oneof._resolveFeatures(edition);
      }), this.fieldsArray.forEach((field) => {
        field._resolveFeatures(edition);
      }), this) : this;
    };
    Type3.prototype.get = function(name) {
      return Object.prototype.hasOwnProperty.call(this.fields, name) ? this.fields[name] : this.oneofs && Object.prototype.hasOwnProperty.call(this.oneofs, name) ? this.oneofs[name] : this.nested && Object.prototype.hasOwnProperty.call(this.nested, name) ? this.nested[name] : null;
    };
    Type3.prototype.add = function(object) {
      if (this.get(object.name))
        throw Error("duplicate name '" + object.name + "' in " + this);
      if (object instanceof Field && object.extend === void 0) {
        if (this._fieldsById ? (
          /* istanbul ignore next */
          this._fieldsById[object.id]
        ) : this.fieldsById[object.id])
          throw Error("duplicate id " + object.id + " in " + this);
        if (this.isReservedId(object.id))
          throw Error("id " + object.id + " is reserved in " + this);
        if (this.isReservedName(object.name) || object.name.charAt(0) === "$")
          throw Error("name '" + object.name + "' is reserved in " + this);
        return object.name === "__proto__" ? this : (object.parent && object.parent.remove(object), this.fields[object.name] = object, object.message = this, object.onAdd(this), clearCache(this));
      }
      if (object instanceof OneOf) {
        if (object.name.charAt(0) === "$")
          throw Error("name '" + object.name + "' is reserved in " + this);
        return object.name === "__proto__" ? this : (this.oneofs || (this.oneofs = {}), this.oneofs[object.name] = object, object.onAdd(this), clearCache(this));
      }
      return Namespace.prototype.add.call(this, object);
    };
    Type3.prototype.remove = function(object) {
      if (object instanceof Field && object.extend === void 0) {
        if (!util2.remove(this.fields, object, object.name))
          throw Error(object + " is not a member of " + this);
        return object.parent = null, object.onRemove(this), clearCache(this);
      }
      if (object instanceof OneOf) {
        if (!util2.remove(this.oneofs, object, object.name))
          throw Error(object + " is not a member of " + this);
        return object.parent = null, object.onRemove(this), clearCache(this);
      }
      return Namespace.prototype.remove.call(this, object);
    };
    Type3.prototype.isReservedId = function(id) {
      return Namespace.isReservedId(this.reserved, id);
    };
    Type3.prototype.isReservedName = function(name) {
      return Namespace.isReservedName(this.reserved, name);
    };
    Type3.prototype.create = function(properties) {
      return new this.ctor(properties);
    };
    Type3.prototype.setup = function() {
      var root2 = this.root;
      if (root2 && root2._needsRecursiveFeatureResolution) {
        var edition = root2._edition || this._edition;
        edition && root2._resolveFeaturesRecursive(edition);
      }
      for (var fullName = this.fullName, types = [], i = 0; i < /* initializes */
      this.fieldsArray.length; ++i)
        types.push(this._fieldsArray[i].resolve().resolvedType);
      this.encode = encoder(this)({
        Writer,
        types,
        util: util2
      }), this.decode = decoder(this)({
        Reader,
        types,
        util: util2,
        C: this.ctor
      }), this.verify = verifier(this)({
        types,
        util: util2
      }), this.fromObject = converter.fromObject(this)({
        types,
        util: util2,
        C: this.ctor
      }), this.toObject = converter.toObject(this)({
        types,
        util: util2
      });
      var wrapper = wrappers[fullName];
      if (wrapper) {
        var wrapperThis = Object.create(this);
        wrapperThis._ctor = this.ctor, wrapperThis.fromObject = this.fromObject, this.fromObject = wrapper.fromObject.bind(wrapperThis), wrapperThis.toObject = this.toObject, this.toObject = wrapper.toObject.bind(wrapperThis);
      }
      return this;
    };
    Type3.prototype.encode = function(message, writer) {
      return this.setup().encode.apply(this, arguments);
    };
    Type3.prototype.encodeDelimited = function(message, writer) {
      return this.encode(message, (writer || Writer.create()).fork()).ldelim();
    };
    Type3.prototype.decode = function(reader, length) {
      return this.setup().decode.apply(this, arguments);
    };
    Type3.prototype.decodeDelimited = function(reader) {
      return reader instanceof Reader || (reader = Reader.create(reader)), this.decode(reader, reader.size());
    };
    Type3.prototype.verify = function(message) {
      return this.setup().verify.apply(this, arguments);
    };
    Type3.prototype.fromObject = function(object) {
      return this.setup().fromObject.apply(this, arguments);
    };
    Type3.prototype.toObject = function(message, options) {
      return this.setup().toObject.apply(this, arguments);
    };
    Type3.prototype.getTypeUrl = function(prefix) {
      prefix === void 0 && (prefix = "type.googleapis.com");
      var fullName = this.fullName;
      return prefix + "/" + (fullName.charAt(0) === "." ? fullName.substring(1) : fullName);
    };
    Type3.d = function(typeName) {
      return function(target) {
        util2.decorateType(target, typeName);
      };
    };
  }
});

// node_modules/protobufjs/src/root.js
var require_root = __commonJS({
  "node_modules/protobufjs/src/root.js"(exports, module) {
    "use strict";
    module.exports = Root2;
    var Namespace = require_namespace();
    Root2.prototype = Object.create(Namespace.prototype, {
      constructor: {
        value: Root2,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Root2.className = "Root";
    var Field = require_field(), Enum2 = require_enum(), OneOf = require_oneof(), util2 = require_util(), Type3, parse, common;
    function Root2(options) {
      Namespace.call(this, "", options), this.deferred = [], this.files = [], this._edition = "proto2", this._fullyQualifiedObjects = {};
    }
    Root2.fromJSON = function(json, root2, depth) {
      if (depth === void 0 && (depth = 0), depth > util2.recursionLimit)
        throw Error("max depth exceeded");
      return root2 || (root2 = new Root2()), json.options && root2.setOptions(json.options), root2.addJSON(json.nested, depth).resolveAll();
    };
    Root2.prototype.resolvePath = util2.path.resolve;
    Root2.prototype.fetch = util2.fetch;
    function SYNC() {
    }
    Root2.prototype.load = function load(filename, options, callback) {
      typeof options == "function" && (callback = options, options = void 0);
      var self2 = this;
      if (!callback)
        return util2.asPromise(load, self2, filename, options);
      var sync = callback === SYNC;
      function finish(err, root2) {
        if (callback) {
          if (sync)
            throw err;
          root2 && root2.resolveAll();
          var cb = callback;
          callback = null, cb(err, root2);
        }
      }
      function getBundledFileName(filename2) {
        var idx = filename2.lastIndexOf("google/protobuf/");
        if (idx > -1) {
          var altname = filename2.substring(idx);
          if (Object.prototype.hasOwnProperty.call(common, altname)) return altname;
        }
        return Object.prototype.hasOwnProperty.call(common, filename2) ? filename2 : null;
      }
      function process2(filename2, source, depth) {
        depth === void 0 && (depth = 0);
        try {
          if (depth > util2.recursionLimit)
            throw Error("max depth exceeded");
          if (util2.isString(source) && source.charAt(0) === "{" && (source = JSON.parse(source)), !util2.isString(source))
            self2.setOptions(source.options).addJSON(source.nested);
          else {
            parse.filename = filename2;
            var parsed = parse(source, self2, options), resolved2, i2 = 0;
            if (parsed.imports)
              for (; i2 < parsed.imports.length; ++i2)
                (resolved2 = getBundledFileName(parsed.imports[i2]) || self2.resolvePath(filename2, parsed.imports[i2])) && fetch(resolved2, !1, depth + 1);
            if (parsed.weakImports)
              for (i2 = 0; i2 < parsed.weakImports.length; ++i2)
                (resolved2 = getBundledFileName(parsed.weakImports[i2]) || self2.resolvePath(filename2, parsed.weakImports[i2])) && fetch(resolved2, !0, depth + 1);
          }
        } catch (err) {
          finish(err);
        }
        !sync && !queued && finish(null, self2);
      }
      function fetch(filename2, weak, depth) {
        if (depth === void 0 && (depth = 0), filename2 = getBundledFileName(filename2) || filename2, !(self2.files.indexOf(filename2) > -1)) {
          if (self2.files.push(filename2), Object.prototype.hasOwnProperty.call(common, filename2)) {
            sync ? process2(filename2, common[filename2], depth) : (++queued, setTimeout(function() {
              --queued, process2(filename2, common[filename2], depth);
            }));
            return;
          }
          if (sync) {
            var source;
            try {
              source = util2.fs.readFileSync(filename2).toString("utf8");
            } catch (err) {
              weak || finish(err);
              return;
            }
            process2(filename2, source, depth);
          } else
            ++queued, self2.fetch(filename2, function(err, source2) {
              if (--queued, !!callback) {
                if (err) {
                  weak ? queued || finish(null, self2) : finish(err);
                  return;
                }
                process2(filename2, source2, depth);
              }
            });
        }
      }
      var queued = 0;
      util2.isString(filename) && (filename = [filename]);
      for (var i = 0, resolved; i < filename.length; ++i)
        (resolved = self2.resolvePath("", filename[i])) && fetch(resolved);
      return sync ? (self2.resolveAll(), self2) : (queued || finish(null, self2), self2);
    };
    Root2.prototype.loadSync = function(filename, options) {
      if (!util2.isNode)
        throw Error("not supported");
      return this.load(filename, options, SYNC);
    };
    Root2.prototype.resolveAll = function() {
      if (!this._needsRecursiveResolve) return this;
      if (this.deferred.length)
        throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
          return "'extend " + field.extend + "' in " + field.parent.fullName;
        }).join(", "));
      return Namespace.prototype.resolveAll.call(this);
    };
    var exposeRe = /^[A-Z]/;
    function tryHandleExtension(root2, field) {
      var extendedType = field.parent.lookup(field.extend);
      if (extendedType) {
        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, void 0, field.options);
        return extendedType.get(sisterField.name) || (sisterField.declaringField = field, field.extensionField = sisterField, extendedType.add(sisterField)), !0;
      }
      return !1;
    }
    Root2.prototype._handleAdd = function(object) {
      if (object instanceof Field)
        /* an extension field (implies not part of a oneof) */
        object.extend !== void 0 && /* not already handled */
        !object.extensionField && (tryHandleExtension(this, object) || this.deferred.push(object));
      else if (object instanceof Enum2)
        exposeRe.test(object.name) && (object.parent[object.name] = object.values);
      else if (!(object instanceof OneOf)) {
        if (object instanceof Type3)
          for (var i = 0; i < this.deferred.length; )
            tryHandleExtension(this, this.deferred[i]) ? this.deferred.splice(i, 1) : ++i;
        for (var j = 0; j < /* initializes */
        object.nestedArray.length; ++j)
          this._handleAdd(object._nestedArray[j]);
        exposeRe.test(object.name) && (object.parent[object.name] = object);
      }
      (object instanceof Type3 || object instanceof Enum2 || object instanceof Field) && (this._fullyQualifiedObjects[object.fullName] = object);
    };
    Root2.prototype._handleRemove = function(object) {
      if (object instanceof Field) {
        if (
          /* an extension field */
          object.extend !== void 0
        )
          if (
            /* already handled */
            object.extensionField
          )
            object.extensionField.parent.remove(object.extensionField), object.extensionField = null;
          else {
            var index = this.deferred.indexOf(object);
            index > -1 && this.deferred.splice(index, 1);
          }
      } else if (object instanceof Enum2)
        exposeRe.test(object.name) && delete object.parent[object.name];
      else if (object instanceof Namespace) {
        for (var i = 0; i < /* initializes */
        object.nestedArray.length; ++i)
          this._handleRemove(object._nestedArray[i]);
        exposeRe.test(object.name) && delete object.parent[object.name];
      }
      delete this._fullyQualifiedObjects[object.fullName];
    };
    Root2._configure = function(Type_, parse_, common_) {
      Type3 = Type_, parse = parse_, common = common_;
    };
  }
});

// node_modules/protobufjs/src/util.js
var require_util = __commonJS({
  "node_modules/protobufjs/src/util.js"(exports, module) {
    "use strict";
    var util2 = module.exports = require_minimal(), roots = require_roots(), Type3, Enum2;
    util2.codegen = require_codegen();
    util2.fetch = require_fetch();
    util2.path = require_path();
    util2.patterns = require_patterns();
    var reservedRe = util2.patterns.reservedRe;
    util2.fs = require_fs2();
    util2.toArray = function(object) {
      if (object) {
        for (var keys = Object.keys(object), array = new Array(keys.length), index = 0; index < keys.length; )
          array[index] = object[keys[index++]];
        return array;
      }
      return [];
    };
    util2.toObject = function(array) {
      for (var object = {}, index = 0; index < array.length; ) {
        var key2 = array[index++], val = array[index++];
        val !== void 0 && (object[key2] = val);
      }
      return object;
    };
    util2.remove = function(object, value, key2) {
      if (!object)
        return !1;
      if (key2 !== void 0 && Object.prototype.hasOwnProperty.call(object, key2) && object[key2] === value)
        return delete object[key2], !0;
      for (var names = Object.keys(object), i = 0; i < names.length; ++i)
        if (object[names[i]] === value)
          return delete object[names[i]], !0;
      return !1;
    };
    util2.isReserved = function(name) {
      return reservedRe.test(name);
    };
    util2.safeProp = function(prop) {
      return !/^[$\w_]+$/.test(prop) || reservedRe.test(prop) ? "[" + JSON.stringify(prop) + "]" : "." + prop;
    };
    util2.ucFirst = function(str) {
      return str.charAt(0).toUpperCase() + str.substring(1);
    };
    var camelCaseRe = /_([a-z])/g;
    util2.camelCase = function(str) {
      return str.substring(0, 1) + str.substring(1).replace(camelCaseRe, function($0, $1) {
        return $1.toUpperCase();
      });
    };
    util2.jsonName = function(str) {
      for (var result = "", upperNext = !1, i = 0; i < str.length; ++i) {
        var ch = str.charAt(i);
        ch === "_" ? upperNext = !0 : upperNext ? (result += ch.toUpperCase(), upperNext = !1) : result += ch;
      }
      return result;
    };
    util2.compareFieldsById = function(a, b) {
      return a.id - b.id;
    };
    util2.decorateType = function(ctor, typeName) {
      if (ctor.$type)
        return typeName && ctor.$type.name !== typeName && (util2.decorateRoot.remove(ctor.$type), ctor.$type.name = typeName, util2.decorateRoot.add(ctor.$type)), ctor.$type;
      Type3 || (Type3 = require_type());
      var type = new Type3(typeName || ctor.name);
      return util2.decorateRoot.add(type), type.ctor = ctor, Object.defineProperty(ctor, "$type", { value: type, enumerable: !1 }), Object.defineProperty(ctor.prototype, "$type", { value: type, enumerable: !1 }), type;
    };
    var decorateEnumIndex = 0;
    util2.decorateEnum = function(object) {
      if (object.$type)
        return object.$type;
      Enum2 || (Enum2 = require_enum());
      var enm = new Enum2("Enum" + decorateEnumIndex++, object);
      return util2.decorateRoot.add(enm), Object.defineProperty(object, "$type", { value: enm, enumerable: !1 }), enm;
    };
    util2.setProperty = function(dst, path, value, ifNotSet) {
      function setProp(dst2, path2, value2) {
        var part = path2.shift();
        if (util2.isUnsafeProperty(part))
          return dst2;
        if (path2.length > 0)
          dst2[part] = setProp(dst2[part] || {}, path2, value2);
        else {
          var prevValue = dst2[part];
          if (prevValue && ifNotSet)
            return dst2;
          prevValue && (value2 = [].concat(prevValue).concat(value2)), dst2[part] = value2;
        }
        return dst2;
      }
      if (typeof dst != "object")
        throw TypeError("dst must be an object");
      if (!path)
        throw TypeError("path must be specified");
      if (path = path.split("."), path.length > util2.recursionLimit)
        throw Error("max depth exceeded");
      return setProp(dst, path, value);
    };
    Object.defineProperty(util2, "decorateRoot", {
      get: function() {
        return roots.decorated || (roots.decorated = new (require_root())());
      }
    });
  }
});

// node_modules/protobufjs/src/types.js
var require_types = __commonJS({
  "node_modules/protobufjs/src/types.js"(exports) {
    "use strict";
    var types = exports, util2 = require_util(), s = [
      "double",
      // 0
      "float",
      // 1
      "int32",
      // 2
      "uint32",
      // 3
      "sint32",
      // 4
      "fixed32",
      // 5
      "sfixed32",
      // 6
      "int64",
      // 7
      "uint64",
      // 8
      "sint64",
      // 9
      "fixed64",
      // 10
      "sfixed64",
      // 11
      "bool",
      // 12
      "string",
      // 13
      "bytes"
      // 14
    ];
    function bake(values, offset) {
      var i = 0, o = /* @__PURE__ */ Object.create(null);
      for (offset |= 0; i < values.length; ) o[s[i + offset]] = values[i++];
      return o;
    }
    types.basic = bake([
      /* double   */
      1,
      /* float    */
      5,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0,
      /* string   */
      2,
      /* bytes    */
      2
    ]);
    types.defaults = bake([
      /* double   */
      0,
      /* float    */
      0,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      0,
      /* sfixed32 */
      0,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      0,
      /* sfixed64 */
      0,
      /* bool     */
      !1,
      /* string   */
      "",
      /* bytes    */
      util2.emptyArray,
      /* message  */
      null
    ]);
    types.long = bake([
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1
    ], 7);
    types.mapKey = bake([
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0,
      /* string   */
      2
    ], 2);
    types.packed = bake([
      /* double   */
      1,
      /* float    */
      5,
      /* int32    */
      0,
      /* uint32   */
      0,
      /* sint32   */
      0,
      /* fixed32  */
      5,
      /* sfixed32 */
      5,
      /* int64    */
      0,
      /* uint64   */
      0,
      /* sint64   */
      0,
      /* fixed64  */
      1,
      /* sfixed64 */
      1,
      /* bool     */
      0
    ]);
  }
});

// node_modules/protobufjs/src/field.js
var require_field = __commonJS({
  "node_modules/protobufjs/src/field.js"(exports, module) {
    "use strict";
    module.exports = Field;
    var ReflectionObject = require_object();
    Field.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Field,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Field.className = "Field";
    var Enum2 = require_enum(), types = require_types(), util2 = require_util(), Type3, ruleRe = /^(?:required|optional|repeated)$/;
    Field.fromJSON = function(name, json) {
      var field = new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment);
      return json.edition && (field._edition = json.edition), json.protoName && (field.protoName = json.protoName), json.jsonName !== void 0 ? field.jsonName = json.jsonName : json.options && json.options.json_name !== void 0 && (field.jsonName = json.options.json_name), field._defaultEdition = "proto3", field;
    };
    function Field(name, id, type, rule, extend, options, comment) {
      if (util2.isObject(rule) ? (comment = extend, options = rule, rule = extend = void 0) : util2.isObject(extend) && (comment = options, options = extend, extend = void 0), ReflectionObject.call(this, name, options), !util2.isInteger(id) || id < 0)
        throw TypeError("id must be a non-negative integer");
      if (!util2.isString(type))
        throw TypeError("type must be a string");
      if (rule !== void 0 && !ruleRe.test(rule = rule.toString().toLowerCase()))
        throw TypeError("rule must be a string rule");
      if (extend !== void 0 && !util2.isString(extend))
        throw TypeError("extend must be a string");
      this.rule = rule && rule !== "optional" ? rule : void 0, this.type = type, this.id = id, this.extend = extend || void 0, this.repeated = rule === "repeated", this.map = !1, this.message = null, this.partOf = null, this.typeDefault = null, this.defaultValue = null, this.long = util2.Long ? types.long[type] !== void 0 : (
        /* istanbul ignore next */
        !1
      ), this.bytes = type === "bytes", this.resolvedType = null, this.extensionField = null, this.declaringField = null, this.comment = comment, this.protoName = void 0, this.jsonName = void 0;
    }
    Object.defineProperty(Field.prototype, "required", {
      get: function() {
        return this._features.field_presence === "LEGACY_REQUIRED";
      }
    });
    Object.defineProperty(Field.prototype, "optional", {
      get: function() {
        return !this.required;
      }
    });
    Object.defineProperty(Field.prototype, "delimited", {
      get: function() {
        return this.resolvedType instanceof Type3 && this._features.message_encoding === "DELIMITED";
      }
    });
    Object.defineProperty(Field.prototype, "packed", {
      get: function() {
        return this._features.repeated_field_encoding === "PACKED";
      }
    });
    Object.defineProperty(Field.prototype, "hasPresence", {
      get: function() {
        return this.repeated || this.map ? !1 : this.partOf || // oneofs
        this.declaringField || this.extensionField || // extensions
        this._features.field_presence !== "IMPLICIT";
      }
    });
    Field.prototype.setOption = function(name, value, ifNotSet) {
      return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
    };
    Field.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "rule",
        this.rule !== "optional" && this.rule || void 0,
        "type",
        this.type,
        "id",
        this.id,
        "extend",
        this.extend,
        "protoName",
        this.protoName !== this.name ? this.protoName : void 0,
        "jsonName",
        this.jsonName !== util2.jsonName(this.protoName || this.name) ? this.jsonName : void 0,
        "options",
        this.options,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    Field.prototype.resolve = function() {
      if (this.resolved)
        return this;
      if ((this.typeDefault = types.defaults[this.type]) === void 0 ? (this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type), this.resolvedType instanceof Type3 ? this.typeDefault = null : this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]) : this.options && this.options.proto3_optional && (this.typeDefault = null), this.options && this.options.default != null && (this.typeDefault = this.options.default, this.resolvedType instanceof Enum2 && typeof this.typeDefault == "string" && (this.typeDefault = this.resolvedType.values[this.typeDefault])), this.options && (this.options.packed !== void 0 && this.resolvedType && !(this.resolvedType instanceof Enum2) && delete this.options.packed, Object.keys(this.options).length || (this.options = void 0)), this.long) {
        var unsigned = this.type === "uint64" || this.type === "fixed64";
        this.typeDefault = typeof this.typeDefault == "string" ? util2.Long.fromString(this.typeDefault, unsigned) : util2.Long.fromNumber(this.typeDefault, unsigned), Object.freeze && Object.freeze(this.typeDefault);
      } else if (types.long[this.type] !== void 0 && typeof this.typeDefault == "string")
        this.typeDefault = parseInt(this.typeDefault, 10);
      else if (this.bytes && typeof this.typeDefault == "string") {
        var buf;
        util2.base64.test(this.typeDefault) ? util2.base64.decode(this.typeDefault, buf = util2.newBuffer(util2.base64.length(this.typeDefault)), 0) : util2.utf8.write(this.typeDefault, buf = util2.newBuffer(util2.utf8.length(this.typeDefault)), 0), this.typeDefault = buf;
      }
      return this.map ? this.defaultValue = util2.emptyObject : this.repeated ? this.defaultValue = util2.emptyArray : this.defaultValue = this.typeDefault, this.parent instanceof Type3 && this.parent._ctor && (this.parent._ctor.prototype[this.name] = this.defaultValue), this.protoName === void 0 && (this.protoName = this.name), this.jsonName === void 0 && (this.jsonName = util2.jsonName(this.protoName)), ReflectionObject.prototype.resolve.call(this);
    };
    Field.prototype._inferLegacyProtoFeatures = function(edition) {
      if (edition !== "proto2" && edition !== "proto3")
        return {};
      var features = {};
      if (this.rule === "required" && (features.field_presence = "LEGACY_REQUIRED"), this.parent && types.defaults[this.type] === void 0) {
        var type = this.parent.get(this.type.split(".").pop());
        type && type instanceof Type3 && type.group && (features.message_encoding = "DELIMITED");
      }
      return this.getOption("packed") === !0 ? features.repeated_field_encoding = "PACKED" : this.getOption("packed") === !1 && (features.repeated_field_encoding = "EXPANDED"), features;
    };
    Field.prototype._resolveFeatures = function(edition) {
      return ReflectionObject.prototype._resolveFeatures.call(this, this._edition || edition);
    };
    Field.d = function(fieldId, fieldType, fieldRule, defaultValue) {
      return typeof fieldType == "function" ? fieldType = util2.decorateType(fieldType).name : fieldType && typeof fieldType == "object" && (fieldType = util2.decorateEnum(fieldType).name), function(prototype, fieldName) {
        util2.decorateType(prototype.constructor).add(new Field(fieldName, fieldId, fieldType, fieldRule, { default: defaultValue }));
      };
    };
    Field._configure = function(Type_) {
      Type3 = Type_;
    };
  }
});

// node_modules/protobufjs/src/oneof.js
var require_oneof = __commonJS({
  "node_modules/protobufjs/src/oneof.js"(exports, module) {
    "use strict";
    module.exports = OneOf;
    var ReflectionObject = require_object();
    OneOf.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: OneOf,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    OneOf.className = "OneOf";
    var Field = require_field(), util2 = require_util();
    function OneOf(name, fieldNames, options, comment) {
      if (Array.isArray(fieldNames) || (options = fieldNames, fieldNames = void 0), ReflectionObject.call(this, name, options), !(fieldNames === void 0 || Array.isArray(fieldNames)))
        throw TypeError("fieldNames must be an Array");
      this.oneof = fieldNames || [], this.fieldsArray = [], this.comment = comment;
    }
    OneOf.fromJSON = function(name, json) {
      return new OneOf(name, json.oneof, json.options, json.comment);
    };
    OneOf.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "options",
        this.options,
        "oneof",
        this.oneof,
        "comment",
        keepComments ? this.comment : void 0
      ]);
    };
    function addFieldsToParent(oneof) {
      if (oneof.parent)
        for (var i = 0; i < oneof.fieldsArray.length; ++i)
          oneof.fieldsArray[i].parent || oneof.parent.add(oneof.fieldsArray[i]);
    }
    OneOf.prototype.add = function(field) {
      if (!(field instanceof Field))
        throw TypeError("field must be a Field");
      return field.parent && field.parent !== this.parent && field.parent.remove(field), this.oneof.push(field.name), this.fieldsArray.push(field), field.partOf = this, addFieldsToParent(this), this;
    };
    OneOf.prototype.remove = function(field) {
      if (!(field instanceof Field))
        throw TypeError("field must be a Field");
      var index = this.fieldsArray.indexOf(field);
      if (index < 0)
        throw Error(field + " is not a member of " + this);
      return this.fieldsArray.splice(index, 1), index = this.oneof.indexOf(field.name), index > -1 && this.oneof.splice(index, 1), field.partOf = null, this;
    };
    OneOf.prototype.onAdd = function(parent) {
      ReflectionObject.prototype.onAdd.call(this, parent);
      for (var self2 = this, i = 0; i < this.oneof.length; ++i) {
        var field = parent.get(this.oneof[i]);
        field && !field.partOf && (field.partOf = self2, self2.fieldsArray.push(field));
      }
      addFieldsToParent(this);
    };
    OneOf.prototype.onRemove = function(parent) {
      for (var i = 0, field; i < this.fieldsArray.length; ++i)
        (field = this.fieldsArray[i]).parent && field.parent.remove(field);
      ReflectionObject.prototype.onRemove.call(this, parent);
    };
    Object.defineProperty(OneOf.prototype, "isProto3Optional", {
      get: function() {
        if (this.fieldsArray == null || this.fieldsArray.length !== 1)
          return !1;
        var field = this.fieldsArray[0];
        return field.options != null && field.options.proto3_optional === !0;
      }
    });
    OneOf.d = function() {
      for (var fieldNames = new Array(arguments.length), index = 0; index < arguments.length; )
        fieldNames[index] = arguments[index++];
      return function(prototype, oneofName) {
        util2.decorateType(prototype.constructor).add(new OneOf(oneofName, fieldNames)), Object.defineProperty(prototype, oneofName, {
          get: util2.oneOfGetter(fieldNames),
          set: util2.oneOfSetter(fieldNames)
        });
      };
    };
  }
});

// node_modules/protobufjs/src/object.js
var require_object = __commonJS({
  "node_modules/protobufjs/src/object.js"(exports, module) {
    "use strict";
    module.exports = ReflectionObject;
    ReflectionObject.className = "ReflectionObject";
    var OneOf = require_oneof(), util2 = require_util(), Root2, proto2Defaults = { enum_type: "CLOSED", field_presence: "EXPLICIT", json_format: "LEGACY_BEST_EFFORT", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "EXPANDED", utf8_validation: "NONE", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, proto3Defaults = { enum_type: "OPEN", field_presence: "IMPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, editions2023Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE_LEGACY", default_symbol_visibility: "EXPORT_ALL" }, editions2024Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE2024", default_symbol_visibility: "EXPORT_TOP_LEVEL" }, editions2026Defaults = { enum_type: "OPEN", field_presence: "EXPLICIT", json_format: "ALLOW", message_encoding: "LENGTH_PREFIXED", repeated_field_encoding: "PACKED", utf8_validation: "VERIFY", enforce_naming_style: "STYLE2026", default_symbol_visibility: "STRICT", enforce_proto_limits: "PROTO_LIMITS2026" };
    function ReflectionObject(name, options) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      if (options && !util2.isObject(options))
        throw TypeError("options must be an object");
      this.options = options, this.parsedOptions = null, this.name = name, this._edition = null, this._defaultEdition = "proto2", this._features = {}, this._featuresResolved = !1, this.parent = null, this.resolved = !1, this.comment = null, this.filename = null;
    }
    Object.defineProperties(ReflectionObject.prototype, {
      /**
       * Reference to the root namespace.
       * @name ReflectionObject#root
       * @type {Root}
       * @readonly
       */
      root: {
        get: function() {
          for (var ptr = this; ptr.parent !== null; )
            ptr = ptr.parent;
          return ptr;
        }
      },
      /**
       * Full name including leading dot.
       * @name ReflectionObject#fullName
       * @type {string}
       * @readonly
       */
      fullName: {
        get: function() {
          for (var path = [this.name], ptr = this.parent; ptr; )
            path.unshift(ptr.name), ptr = ptr.parent;
          return path.join(".");
        }
      }
    });
    ReflectionObject.prototype.toJSON = /* istanbul ignore next */
    function() {
      throw Error();
    };
    ReflectionObject.prototype.onAdd = function(parent) {
      this.parent && this.parent !== parent && this.parent.remove(this), this.parent = parent, this.resolved = !1;
      var root2 = parent.root;
      root2 instanceof Root2 && root2._handleAdd(this);
    };
    ReflectionObject.prototype.onRemove = function(parent) {
      var root2 = parent.root;
      root2 instanceof Root2 && root2._handleRemove(this), this.parent = null, this.resolved = !1;
    };
    ReflectionObject.prototype.resolve = function() {
      return this.resolved ? this : (this.root instanceof Root2 && (this.resolved = !0), this);
    };
    ReflectionObject.prototype._resolveFeaturesRecursive = function(edition) {
      return this._resolveFeatures(this._edition || edition);
    };
    ReflectionObject.prototype._resolveFeatures = function(edition) {
      if (!this._featuresResolved) {
        var defaults = {};
        if (!edition)
          throw new Error("Unknown edition for " + this.fullName);
        var protoFeatures = util2.merge(
          {},
          this.options && this.options.features,
          this._inferLegacyProtoFeatures(edition)
        );
        if (this._edition) {
          if (edition === "proto2")
            defaults = Object.assign({}, proto2Defaults);
          else if (edition === "proto3")
            defaults = Object.assign({}, proto3Defaults);
          else if (edition === "2023")
            defaults = Object.assign({}, editions2023Defaults);
          else if (edition === "2024")
            defaults = Object.assign({}, editions2024Defaults);
          else if (edition === "2026")
            defaults = Object.assign({}, editions2026Defaults);
          else
            throw new Error("Unknown edition: " + edition);
          this._features = util2.merge(defaults, protoFeatures);
        } else if (this.partOf instanceof OneOf) {
          var lexicalParentFeaturesCopy = util2.merge({}, this.partOf._features);
          this._features = util2.merge(lexicalParentFeaturesCopy, protoFeatures);
        } else if (!this.declaringField)
          if (this.parent) {
            var parentFeaturesCopy = util2.merge({}, this.parent._features);
            this._features = util2.merge(parentFeaturesCopy, protoFeatures);
          } else
            throw new Error("Unable to find a parent for " + this.fullName);
        this.extensionField && (this.extensionField._features = this._features), this._featuresResolved = !0;
      }
    };
    ReflectionObject.prototype._inferLegacyProtoFeatures = function() {
      return {};
    };
    ReflectionObject.prototype.getOption = function(name) {
      if (this.options && Object.prototype.hasOwnProperty.call(this.options, name))
        return this.options[name];
    };
    ReflectionObject.prototype.setOption = function(name, value, ifNotSet) {
      if (name === "__proto__")
        return this;
      if (this.options || (this.options = {}), /^features\./.test(name))
        util2.setProperty(this.options, name, value, ifNotSet);
      else {
        var prev = this.getOption(name);
        (!ifNotSet || prev === void 0) && (prev !== value && (this.resolved = !1), this.options[name] = value);
      }
      return this;
    };
    ReflectionObject.prototype.setParsedOption = function(name, value, propName) {
      if (name === "__proto__")
        return this;
      this.parsedOptions || (this.parsedOptions = []);
      var parsedOptions = this.parsedOptions;
      if (propName) {
        var opt = parsedOptions.find(function(opt2) {
          return Object.prototype.hasOwnProperty.call(opt2, name);
        });
        if (opt) {
          var newValue = opt[name];
          util2.setProperty(newValue, propName, value);
        } else
          opt = {}, opt[name] = util2.setProperty({}, propName, value), parsedOptions.push(opt);
      } else {
        var newOpt = {};
        newOpt[name] = value, parsedOptions.push(newOpt);
      }
      return this;
    };
    ReflectionObject.prototype.setOptions = function(options, ifNotSet) {
      if (options)
        for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
          this.setOption(keys[i], options[keys[i]], ifNotSet);
      return this;
    };
    Object.defineProperty(ReflectionObject.prototype, "toString", {
      value: function() {
        var className = this.constructor.className, fullName = this.fullName;
        return fullName.length ? className + " " + fullName : className;
      },
      writable: !0,
      enumerable: !1,
      configurable: !0
    });
    ReflectionObject.prototype._editionToJSON = function() {
      if (!(!this._edition || this._edition === "proto3"))
        return this._edition;
    };
    ReflectionObject._configure = function(Root_) {
      Root2 = Root_;
    };
  }
});

// node_modules/protobufjs/src/enum.js
var require_enum = __commonJS({
  "node_modules/protobufjs/src/enum.js"(exports, module) {
    "use strict";
    module.exports = Enum2;
    var ReflectionObject = require_object();
    Enum2.prototype = Object.create(ReflectionObject.prototype, {
      constructor: {
        value: Enum2,
        writable: !0,
        enumerable: !1,
        configurable: !0
      }
    });
    Enum2.className = "Enum";
    var Namespace = require_namespace(), util2 = require_util();
    function Enum2(name, values, options, comment, comments, valuesOptions) {
      if (ReflectionObject.call(this, name, options), values && typeof values != "object")
        throw TypeError("values must be an object");
      if (this.valuesById = /* @__PURE__ */ Object.create(null), this.values = Object.create(this.valuesById), this.comment = comment, this.comments = comments || {}, this.valuesOptions = valuesOptions, this._valuesFeatures = {}, this.reserved = void 0, this.visibility = void 0, values)
        for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
          keys[i] !== "__proto__" && typeof values[keys[i]] == "number" && (this.values[keys[i]] = values[keys[i]], this.valuesById[values[keys[i]]] === void 0 && (this.valuesById[values[keys[i]]] = keys[i]));
    }
    Enum2.prototype._resolveFeatures = function(edition) {
      return edition = this._edition || edition, ReflectionObject.prototype._resolveFeatures.call(this, edition), Object.keys(this.values).forEach((key2) => {
        var parentFeaturesCopy = util2.merge({}, this._features);
        this._valuesFeatures[key2] = util2.merge(parentFeaturesCopy, this.valuesOptions && this.valuesOptions[key2] && this.valuesOptions[key2].features || {});
      }), this;
    };
    Enum2.fromJSON = function(name, json) {
      var enm = new Enum2(name, json.values, json.options, json.comment, json.comments, json.valuesOptions);
      return enm.reserved = json.reserved, json.visibility && (enm.visibility = json.visibility), json.edition && (enm._edition = json.edition), enm._defaultEdition = "proto3", enm;
    };
    Enum2.prototype.toJSON = function(toJSONOptions) {
      var keepComments = toJSONOptions ? !!toJSONOptions.keepComments : !1;
      return util2.toObject([
        "edition",
        this._editionToJSON(),
        "options",
        this.options,
        "valuesOptions",
        this.valuesOptions,
        "values",
        this.values,
        "reserved",
        this.reserved && this.reserved.length ? this.reserved : void 0,
        "visibility",
        this.visibility,
        "comment",
        keepComments ? this.comment : void 0,
        "comments",
        keepComments ? this.comments : void 0
      ]);
    };
    Enum2.prototype.add = function(name, id, comment, options) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      if (!util2.isInteger(id))
        throw TypeError("id must be an integer");
      if (name === "__proto__")
        return this;
      if (this.values[name] !== void 0)
        throw Error("duplicate name '" + name + "' in " + this);
      if (this.isReservedId(id))
        throw Error("id " + id + " is reserved in " + this);
      if (this.isReservedName(name))
        throw Error("name '" + name + "' is reserved in " + this);
      if (this.valuesById[id] !== void 0) {
        if (!(this.options && this.options.allow_alias))
          throw Error("duplicate id " + id + " in " + this);
        this.values[name] = id;
      } else
        this.valuesById[this.values[name] = id] = name;
      return options && (this.valuesOptions === void 0 && (this.valuesOptions = {}), this.valuesOptions[name] = options || null), this.comments[name] = comment || null, this;
    };
    Enum2.prototype.remove = function(name) {
      if (!util2.isString(name))
        throw TypeError("name must be a string");
      var val = this.values[name];
      if (val == null)
        throw Error("name '" + name + "' does not exist in " + this);
      return delete this.valuesById[val], delete this.values[name], delete this.comments[name], this.valuesOptions && delete this.valuesOptions[name], this;
    };
    Enum2.prototype.isReservedId = function(id) {
      return Namespace.isReservedId(this.reserved, id);
    };
    Enum2.prototype.isReservedName = function(name) {
      return Namespace.isReservedName(this.reserved, name);
    };
  }
});

// node_modules/protobufjs/src/encoder.js
var require_encoder = __commonJS({
  "node_modules/protobufjs/src/encoder.js"(exports, module) {
    "use strict";
    module.exports = encoder;
    var Enum2 = require_enum(), types = require_types(), util2 = require_util();
    function genTypePartial(gen, field, fieldIndex, ref) {
      return field.delimited ? gen("types[%i].encode(%s,w.uint32(%i),q+1).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0) : gen("types[%i].encode(%s,w.uint32(%i).fork(),q+1).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
    }
    function encoder(mtype) {
      for (var gen = util2.codegen(["m", "w", "q"])("if(!w)")("w=Writer.create()")("if(q===undefined)q=0")("if(q>util.recursionLimit)")('throw Error("max depth exceeded")'), i, ref, fields = (
        /* initializes */
        mtype.fieldsArray.slice().sort(util2.compareFieldsById)
      ), i = 0; i < fields.length; ++i) {
        var field = fields[i].resolve(), index = mtype._fieldsArray.indexOf(field), type = field.resolvedType instanceof Enum2 ? "int32" : field.type, wireType = types.basic[type];
        ref = "m" + util2.safeProp(field.name), field.map ? (gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name)("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref), field.keyType === "bool" ? gen("w.uint32(%i).fork().uint32(%i).bool(util.boolFromKey(ks[i]))", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType]) : types.long[field.keyType] !== void 0 ? gen("w.uint32(%i).fork().uint32(%i).%s(util.longFromKey(ks[i],%j))", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType, field.keyType === "uint64" || field.keyType === "fixed64") : gen("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType), wireType === void 0 ? gen("types[%i].encode(%s[ks[i]],w.uint32(18).fork(),q+1).ldelim().ldelim()", index, ref) : gen(".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref), gen("}")("}")) : field.repeated ? (gen("if(%s!=null&&%s.length){", ref, ref), field.packed && types.packed[type] !== void 0 ? gen("w.uint32(%i).%ss(%s)", (field.id << 3 | 2) >>> 0, type, ref) : (gen("for(var i=0;i<%s.length;++i)", ref), wireType === void 0 ? genTypePartial(gen, field, index, ref + "[i]") : gen("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref)), gen("}")) : (field.required || (field.hasPresence || !(field.resolvedType instanceof Enum2 || types.basic[type] !== void 0) ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j))", ref, field.name) : field.resolvedType instanceof Enum2 ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==%j)", ref, field.name, ref, field.typeDefault) : type === "bool" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==false)", ref, field.name, ref) : type === "string" ? gen('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!=="")', ref, field.name, ref) : type === "bytes" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s.length)", ref, field.name, ref) : type === "double" || type === "float" ? gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&!Object.is(%s,0))", ref, field.name, ref) : types.long[type] !== void 0 ? gen('if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&(typeof %s==="object"?%s.low||%s.high:%s!==0))', ref, field.name, ref, ref, ref, ref) : gen("if(%s!=null&&Object.hasOwnProperty.call(m,%j)&&%s!==0)", ref, field.name, ref)), wireType === void 0 ? genTypePartial(gen, field, index, ref) : gen("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref));
      }
      return gen('if(m.$unknowns!=null&&Object.hasOwnProperty.call(m,"$unknowns"))')("for(var i=0;i<m.$unknowns.length;++i)")("w.raw(m.$unknowns[i])")("return w");
    }
  }
});

// node_modules/protobufjs/src/index-light.js
var require_index_light = __commonJS({
  "node_modules/protobufjs/src/index-light.js"(exports, module) {
    "use strict";
    exports = module.exports = require_index_minimal();
    exports.build = "light";
    function load(filename, root2, callback) {
      return typeof root2 == "function" ? (callback = root2, root2 = new exports.Root()) : root2 || (root2 = new exports.Root()), root2.load(filename, callback);
    }
    exports.load = load;
    function loadSync(filename, root2) {
      return root2 || (root2 = new exports.Root()), root2.loadSync(filename);
    }
    exports.loadSync = loadSync;
    exports.encoder = require_encoder();
    exports.decoder = require_decoder();
    exports.verifier = require_verifier();
    exports.converter = require_converter();
    exports.ReflectionObject = require_object();
    exports.Namespace = require_namespace();
    exports.Root = require_root();
    exports.Enum = require_enum();
    exports.Type = require_type();
    exports.Field = require_field();
    exports.OneOf = require_oneof();
    exports.MapField = require_mapfield();
    exports.Service = require_service2();
    exports.Method = require_method();
    exports.Message = require_message();
    exports.wrappers = require_wrappers();
    exports.types = require_types();
    exports.util = require_util();
    exports.ReflectionObject._configure(exports.Root);
    exports.Namespace._configure(exports.Type, exports.Service, exports.Enum);
    exports.Root._configure(exports.Type, void 0, {});
    exports.Field._configure(exports.Type);
  }
});

// node_modules/protobufjs/light.js
var require_light = __commonJS({
  "node_modules/protobufjs/light.js"(exports, module) {
    "use strict";
    module.exports = require_index_light();
  }
});

// lib/routing/search_parameters.ts
var protobuf = __toESM(require_light(), 1);

// lib/protobufjs_helpers.ts
var import_long = __toESM(require_umd(), 1), protobufModule = __toESM(require_light(), 1);
protobufModule.util.Long = import_long.default;
protobufModule.configure();
var int64Min = -(1n << 63n), int64Max = (1n << 63n) - 1n;
function isProtobufLong(value) {
  return value !== null && typeof value == "object" && typeof value.low == "number" && typeof value.high == "number" && typeof value.unsigned == "boolean";
}
function exactLongValue(value) {
  return value.unsigned ? BigInt(value.high >>> 0) << 32n | BigInt(value.low >>> 0) : BigInt(value.high | 0) * 0x100000000n + BigInt(value.low >>> 0);
}
function bigintAsLong(value) {
  if (value < int64Min || value > int64Max)
    throw new RangeError(`BigInt value ${value} is outside the signed 64-bit integer range.`);
  return {
    low: Number(BigInt.asIntN(32, value)),
    high: Number(BigInt.asIntN(32, value >> 32n)),
    unsigned: !1
  };
}
var protobufFieldAliases = /* @__PURE__ */ new WeakMap();
function normalizeProtobufInput(value, type, path = type.name) {
  if (!value || typeof value != "object" || Array.isArray(value) || value instanceof Uint8Array)
    throw new TypeError(`${path} must be a protobuf message object.`);
  let aliases = protobufFieldAliases.get(type);
  if (!aliases) {
    aliases = /* @__PURE__ */ new Map();
    for (let field of type.fieldsArray)
      aliases.set(field.name, field.resolve()), aliases.set(field.name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), field), aliases.set(field.name.replace(/_([a-zA-Z0-9])/g, (_match, letter) => letter.toUpperCase()), field);
    protobufFieldAliases.set(type, aliases);
  }
  let normalized = {};
  for (let [key2, entry] of Object.entries(value)) {
    if (entry === void 0) continue;
    let field = aliases.get(key2);
    if (!field) throw new TypeError(`Unknown protobuf field ${path}.${key2}.`);
    if (Object.prototype.hasOwnProperty.call(normalized, field.name)) throw new TypeError(`Duplicate protobuf field ${path}.${key2}.`);
    let nested = field.resolvedType;
    if (entry === null && nested instanceof protobufModule.Type && !field.repeated && !field.map) continue;
    let fieldPath = `${path}.${key2}`;
    if (field.map) {
      if (!entry || typeof entry != "object" || Array.isArray(entry)) throw new TypeError(`${fieldPath} must be a map.`);
      normalized[field.name] = Object.fromEntries(Object.entries(entry).map(([mapKey, mapValue]) => [
        mapKey,
        nested instanceof protobufModule.Type ? normalizeProtobufInput(mapValue, nested, `${fieldPath}[${mapKey}]`) : mapValue
      ]));
    } else if (nested instanceof protobufModule.Type)
      if (field.repeated) {
        if (!Array.isArray(entry)) throw new TypeError(`${fieldPath} must be an array.`);
        normalized[field.name] = entry.map((item, index) => normalizeProtobufInput(item, nested, `${fieldPath}[${index}]`));
      } else normalized[field.name] = normalizeProtobufInput(entry, nested, fieldPath);
    else normalized[field.name] = entry;
  }
  return normalized;
}
function encodeProtobufBigInts(value, type) {
  if (type instanceof protobufModule.Enum && typeof value == "string") {
    if (!Object.prototype.hasOwnProperty.call(type.values, value))
      throw new TypeError(`Unknown ${type.fullName} enum name: ${value}`);
    return type.values[value];
  }
  if (["int64", "sint64", "sfixed64", "uint64", "fixed64"].includes(String(type)) && typeof value == "number" && !Number.isSafeInteger(value))
    throw new RangeError(`int64 value ${value} must be a safe integer number; use bigint for larger integers.`);
  if (["uint64", "fixed64"].includes(String(type)) && typeof value == "number" && value < 0)
    throw new RangeError(`uint64 value ${value} must be nonnegative.`);
  if (["int32", "sint32", "sfixed32"].includes(String(type)) && typeof value == "number" && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647))
    throw new RangeError(`int32 value ${value} must be an integer in the signed 32-bit range.`);
  if (["uint32", "fixed32"].includes(String(type)) && typeof value == "number" && (!Number.isInteger(value) || value < 0 || value > 4294967295))
    throw new RangeError(`uint32 value ${value} must be an integer in the unsigned 32-bit range.`);
  if (isProtobufLong(value) && ["int64", "sint64", "sfixed64", "uint64", "fixed64"].includes(String(type))) {
    for (let bits of [value.low, value.high])
      if (!Number.isInteger(bits) || bits < -2147483648 || bits > 4294967295)
        throw new RangeError("Protobuf Long low/high values must fit 32-bit words.");
    return encodeProtobufBigInts(exactLongValue(value), type);
  }
  if (typeof value == "bigint" && ["uint64", "fixed64"].includes(String(type))) {
    if (value < 0n || value > (1n << 64n) - 1n) throw new RangeError(`BigInt value ${value} is outside the unsigned 64-bit integer range.`);
    return { low: Number(BigInt.asIntN(32, value)), high: Number(BigInt.asIntN(32, value >> 32n)), unsigned: !0 };
  }
  return typeof value == "bigint" ? bigintAsLong(value) : value instanceof Uint8Array ? value : Array.isArray(value) ? value.map((entry) => encodeProtobufBigInts(entry, type)) : value && typeof value == "object" ? Object.fromEntries(
    Object.entries(value).map(([key2, entry]) => {
      let field = type instanceof protobufModule.Type ? type.fields[key2]?.resolve() : void 0, entryType = field?.resolvedType ?? field?.type;
      return field?.map && entry && typeof entry == "object" && !Array.isArray(entry) ? [key2, Object.fromEntries(Object.entries(entry).map(([mapKey, mapValue]) => [mapKey, encodeProtobufBigInts(mapValue, entryType)]))] : [key2, encodeProtobufBigInts(entry, entryType)];
    })
  ) : value;
}

// lib/generated/routing_schemas.ts
var routingParametersDescriptor = { options: { java_package: "com.google.ortools.constraintsolver", java_multiple_files: !0, csharp_namespace: "Google.OrTools.ConstraintSolver" }, nested: { operations_research: { options: { java_package: "com.google.ortools.util", java_multiple_files: !0, csharp_namespace: "Google.OrTools.Util" }, nested: { RoutingSearchParameters: { oneofs: { _disableSchedulingBewareThisMayDegradePerformance: { oneof: ["disableSchedulingBewareThisMayDegradePerformance"] } }, fields: { firstSolutionStrategy: { type: "FirstSolutionStrategy.Value", id: 1, protoName: "first_solution_strategy" }, useUnfilteredFirstSolutionStrategy: { type: "bool", id: 2, protoName: "use_unfiltered_first_solution_strategy" }, savingsParameters: { type: "SavingsParameters", id: 70, protoName: "savings_parameters" }, globalCheapestInsertionFirstSolutionParameters: { type: "GlobalCheapestInsertionParameters", id: 71, protoName: "global_cheapest_insertion_first_solution_parameters" }, globalCheapestInsertionLsOperatorParameters: { type: "GlobalCheapestInsertionParameters", id: 72, protoName: "global_cheapest_insertion_ls_operator_parameters" }, localCheapestInsertionParameters: { type: "LocalCheapestInsertionParameters", id: 68, protoName: "local_cheapest_insertion_parameters" }, localCheapestCostInsertionParameters: { type: "LocalCheapestInsertionParameters", id: 69, protoName: "local_cheapest_cost_insertion_parameters" }, christofidesUseMinimumMatching: { type: "bool", id: 30, protoName: "christofides_use_minimum_matching" }, firstSolutionOptimizationPeriod: { type: "int32", id: 59, protoName: "first_solution_optimization_period" }, localSearchOperators: { type: "LocalSearchNeighborhoodOperators", id: 3, protoName: "local_search_operators" }, lsOperatorNeighborsRatio: { type: "double", id: 53, protoName: "ls_operator_neighbors_ratio" }, lsOperatorMinNeighbors: { type: "int32", id: 54, protoName: "ls_operator_min_neighbors" }, useMultiArmedBanditConcatenateOperators: { type: "bool", id: 41, protoName: "use_multi_armed_bandit_concatenate_operators" }, multiArmedBanditCompoundOperatorMemoryCoefficient: { type: "double", id: 42, protoName: "multi_armed_bandit_compound_operator_memory_coefficient" }, multiArmedBanditCompoundOperatorExplorationCoefficient: { type: "double", id: 43, protoName: "multi_armed_bandit_compound_operator_exploration_coefficient" }, maxSwapActiveChainSize: { type: "int32", id: 66, protoName: "max_swap_active_chain_size" }, relocateExpensiveChainNumArcsToConsider: { type: "int32", id: 20, protoName: "relocate_expensive_chain_num_arcs_to_consider" }, heuristicExpensiveChainLnsNumArcsToConsider: { type: "int32", id: 32, protoName: "heuristic_expensive_chain_lns_num_arcs_to_consider" }, heuristicCloseNodesLnsNumNodes: { type: "int32", id: 35, protoName: "heuristic_close_nodes_lns_num_nodes" }, localSearchMetaheuristic: { type: "LocalSearchMetaheuristic.Value", id: 4, protoName: "local_search_metaheuristic" }, localSearchMetaheuristics: { rule: "repeated", type: "LocalSearchMetaheuristic.Value", id: 63, protoName: "local_search_metaheuristics" }, numMaxLocalOptimaBeforeMetaheuristicSwitch: { type: "int32", id: 64, protoName: "num_max_local_optima_before_metaheuristic_switch" }, guidedLocalSearchLambdaCoefficient: { type: "double", id: 5, protoName: "guided_local_search_lambda_coefficient" }, guidedLocalSearchResetPenaltiesOnNewBestSolution: { type: "bool", id: 51, protoName: "guided_local_search_reset_penalties_on_new_best_solution" }, guidedLocalSearchPenalizeWithVehicleClasses: { type: "bool", id: 61, protoName: "guided_local_search_penalize_with_vehicle_classes" }, useGuidedLocalSearchPenaltiesInLocalSearchOperators: { type: "bool", id: 62, protoName: "use_guided_local_search_penalties_in_local_search_operators" }, useDepthFirstSearch: { type: "bool", id: 6, protoName: "use_depth_first_search" }, useCp: { type: "OptionalBoolean", id: 28, protoName: "use_cp" }, useCpSat: { type: "OptionalBoolean", id: 27, protoName: "use_cp_sat" }, useGeneralizedCpSat: { type: "OptionalBoolean", id: 47, protoName: "use_generalized_cp_sat" }, satParameters: { type: "sat.SatParameters", id: 48, protoName: "sat_parameters" }, reportIntermediateCpSatSolutions: { type: "bool", id: 56, protoName: "report_intermediate_cp_sat_solutions" }, fallbackToCpSatSizeThreshold: { type: "int32", id: 52, protoName: "fallback_to_cp_sat_size_threshold" }, continuousSchedulingSolver: { type: "SchedulingSolver", id: 33, protoName: "continuous_scheduling_solver" }, mixedIntegerSchedulingSolver: { type: "SchedulingSolver", id: 34, protoName: "mixed_integer_scheduling_solver" }, disableSchedulingBewareThisMayDegradePerformance: { type: "bool", id: 50, protoName: "disable_scheduling_beware_this_may_degrade_performance", options: { proto3_optional: !0 } }, optimizationStep: { type: "double", id: 7, protoName: "optimization_step" }, numberOfSolutionsToCollect: { type: "int32", id: 17, protoName: "number_of_solutions_to_collect" }, solutionLimit: { type: "int64", id: 8, protoName: "solution_limit" }, timeLimit: { type: "google.protobuf.Duration", id: 9, protoName: "time_limit" }, lnsTimeLimit: { type: "google.protobuf.Duration", id: 10, protoName: "lns_time_limit" }, secondaryLsTimeLimitRatio: { type: "double", id: 57, protoName: "secondary_ls_time_limit_ratio" }, improvementLimitParameters: { type: "ImprovementSearchLimitParameters", id: 37, protoName: "improvement_limit_parameters" }, useFullPropagation: { type: "bool", id: 11, protoName: "use_full_propagation" }, logSearch: { type: "bool", id: 13, protoName: "log_search" }, logCostScalingFactor: { type: "double", id: 22, protoName: "log_cost_scaling_factor" }, logCostOffset: { type: "double", id: 29, protoName: "log_cost_offset" }, logTag: { type: "string", id: 36, protoName: "log_tag" }, useIteratedLocalSearch: { type: "bool", id: 58, protoName: "use_iterated_local_search" }, iteratedLocalSearchParameters: { type: "IteratedLocalSearchParameters", id: 60, protoName: "iterated_local_search_parameters" } }, reserved: [[14, 14], [15, 15], [16, 16], [18, 18], [19, 19], [21, 21], [23, 23], [31, 31], [40, 40], [44, 44], [45, 45], [46, 46], [49, 49], [55, 55], [65, 65], [67, 67]], nested: { LocalSearchNeighborhoodOperators: { fields: { useRelocate: { type: "OptionalBoolean", id: 1, protoName: "use_relocate" }, useRelocatePair: { type: "OptionalBoolean", id: 2, protoName: "use_relocate_pair" }, useLightRelocatePair: { type: "OptionalBoolean", id: 24, protoName: "use_light_relocate_pair" }, useRelocateNeighbors: { type: "OptionalBoolean", id: 3, protoName: "use_relocate_neighbors" }, useRelocateSubtrip: { type: "OptionalBoolean", id: 25, protoName: "use_relocate_subtrip" }, useExchange: { type: "OptionalBoolean", id: 4, protoName: "use_exchange" }, useExchangePair: { type: "OptionalBoolean", id: 22, protoName: "use_exchange_pair" }, useExchangeSubtrip: { type: "OptionalBoolean", id: 26, protoName: "use_exchange_subtrip" }, useCross: { type: "OptionalBoolean", id: 5, protoName: "use_cross" }, useCrossExchange: { type: "OptionalBoolean", id: 6, protoName: "use_cross_exchange" }, useRelocateExpensiveChain: { type: "OptionalBoolean", id: 23, protoName: "use_relocate_expensive_chain" }, useTwoOpt: { type: "OptionalBoolean", id: 7, protoName: "use_two_opt" }, useOrOpt: { type: "OptionalBoolean", id: 8, protoName: "use_or_opt" }, useLinKernighan: { type: "OptionalBoolean", id: 9, protoName: "use_lin_kernighan" }, useTspOpt: { type: "OptionalBoolean", id: 10, protoName: "use_tsp_opt" }, useMakeActive: { type: "OptionalBoolean", id: 11, protoName: "use_make_active" }, useRelocateAndMakeActive: { type: "OptionalBoolean", id: 21, protoName: "use_relocate_and_make_active" }, useExchangeAndMakeActive: { type: "OptionalBoolean", id: 37, protoName: "use_exchange_and_make_active" }, useExchangePathStartEndsAndMakeActive: { type: "OptionalBoolean", id: 38, protoName: "use_exchange_path_start_ends_and_make_active" }, useMakeInactive: { type: "OptionalBoolean", id: 12, protoName: "use_make_inactive" }, useMakeChainInactive: { type: "OptionalBoolean", id: 13, protoName: "use_make_chain_inactive" }, useSwapActive: { type: "OptionalBoolean", id: 14, protoName: "use_swap_active" }, useSwapActiveChain: { type: "OptionalBoolean", id: 35, protoName: "use_swap_active_chain" }, useExtendedSwapActive: { type: "OptionalBoolean", id: 15, protoName: "use_extended_swap_active" }, useShortestPathSwapActive: { type: "OptionalBoolean", id: 34, protoName: "use_shortest_path_swap_active" }, useShortestPathTwoOpt: { type: "OptionalBoolean", id: 36, protoName: "use_shortest_path_two_opt" }, useNodePairSwapActive: { type: "OptionalBoolean", id: 20, protoName: "use_node_pair_swap_active" }, usePathLns: { type: "OptionalBoolean", id: 16, protoName: "use_path_lns" }, useFullPathLns: { type: "OptionalBoolean", id: 17, protoName: "use_full_path_lns" }, useTspLns: { type: "OptionalBoolean", id: 18, protoName: "use_tsp_lns" }, useInactiveLns: { type: "OptionalBoolean", id: 19, protoName: "use_inactive_lns" }, useGlobalCheapestInsertionPathLns: { type: "OptionalBoolean", id: 27, protoName: "use_global_cheapest_insertion_path_lns" }, useLocalCheapestInsertionPathLns: { type: "OptionalBoolean", id: 28, protoName: "use_local_cheapest_insertion_path_lns" }, useRelocatePathGlobalCheapestInsertionInsertUnperformed: { type: "OptionalBoolean", id: 33, protoName: "use_relocate_path_global_cheapest_insertion_insert_unperformed" }, useGlobalCheapestInsertionExpensiveChainLns: { type: "OptionalBoolean", id: 29, protoName: "use_global_cheapest_insertion_expensive_chain_lns" }, useLocalCheapestInsertionExpensiveChainLns: { type: "OptionalBoolean", id: 30, protoName: "use_local_cheapest_insertion_expensive_chain_lns" }, useGlobalCheapestInsertionCloseNodesLns: { type: "OptionalBoolean", id: 31, protoName: "use_global_cheapest_insertion_close_nodes_lns" }, useLocalCheapestInsertionCloseNodesLns: { type: "OptionalBoolean", id: 32, protoName: "use_local_cheapest_insertion_close_nodes_lns" }, useGlobalCheapestInsertionVisitTypesLns: { type: "OptionalBoolean", id: 39, protoName: "use_global_cheapest_insertion_visit_types_lns" }, useLocalCheapestInsertionVisitTypesLns: { type: "OptionalBoolean", id: 40, protoName: "use_local_cheapest_insertion_visit_types_lns" } } }, SchedulingSolver: { values: { SCHEDULING_UNSET: 0, SCHEDULING_GLOP: 1, SCHEDULING_CP_SAT: 2 } }, ImprovementSearchLimitParameters: { fields: { improvementRateCoefficient: { type: "double", id: 38, protoName: "improvement_rate_coefficient" }, improvementRateSolutionsDistance: { type: "int32", id: 39, protoName: "improvement_rate_solutions_distance" } } } } }, RoutingModelParameters: { fields: { solverParameters: { type: "ConstraintSolverParameters", id: 1, protoName: "solver_parameters" }, reduceVehicleCostModel: { type: "bool", id: 2, protoName: "reduce_vehicle_cost_model" }, maxCallbackCacheSize: { type: "int32", id: 3, protoName: "max_callback_cache_size" } } }, FirstSolutionStrategy: { fields: {}, nested: { Value: { values: { UNSET: 0, AUTOMATIC: 15, PATH_CHEAPEST_ARC: 3, PATH_MOST_CONSTRAINED_ARC: 4, EVALUATOR_STRATEGY: 5, SAVINGS: 10, PARALLEL_SAVINGS: 17, SWEEP: 11, CHRISTOFIDES: 13, ALL_UNPERFORMED: 6, BEST_INSERTION: 7, PARALLEL_CHEAPEST_INSERTION: 8, SEQUENTIAL_CHEAPEST_INSERTION: 14, LOCAL_CHEAPEST_INSERTION: 9, LOCAL_CHEAPEST_COST_INSERTION: 16, GLOBAL_CHEAPEST_ARC: 1, LOCAL_CHEAPEST_ARC: 2, FIRST_UNBOUND_MIN_VALUE: 12 } } } }, LocalSearchMetaheuristic: { fields: {}, nested: { Value: { values: { UNSET: 0, AUTOMATIC: 6, GREEDY_DESCENT: 1, GUIDED_LOCAL_SEARCH: 2, SIMULATED_ANNEALING: 3, TABU_SEARCH: 4, GENERIC_TABU_SEARCH: 5 } } } }, RoutingSearchStatus: { fields: {}, nested: { Value: { values: { ROUTING_NOT_SOLVED: 0, ROUTING_SUCCESS: 1, ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED: 2, ROUTING_FAIL: 3, ROUTING_FAIL_TIMEOUT: 4, ROUTING_INVALID: 5, ROUTING_INFEASIBLE: 6, ROUTING_OPTIMAL: 7 } } } }, LocalCheapestInsertionParameters: { fields: { pickupDeliveryStrategy: { type: "PairInsertionStrategy", id: 1, protoName: "pickup_delivery_strategy" }, insertionSortingProperties: { rule: "repeated", type: "InsertionSortingProperty", id: 2, protoName: "insertion_sorting_properties" } }, nested: { PairInsertionStrategy: { values: { AUTOMATIC: 0, BEST_PICKUP_THEN_BEST_DELIVERY: 1, BEST_PICKUP_DELIVERY_PAIR: 2, BEST_PICKUP_DELIVERY_PAIR_MULTITOUR: 3 } }, InsertionSortingProperty: { values: { SORTING_PROPERTY_UNSPECIFIED: 0, SORTING_PROPERTY_ALLOWED_VEHICLES: 1, SORTING_PROPERTY_PENALTY: 2, SORTING_PROPERTY_PENALTY_OVER_ALLOWED_VEHICLES_RATIO: 3, SORTING_PROPERTY_HIGHEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS: 4, SORTING_PROPERTY_LOWEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS: 5, SORTING_PROPERTY_LOWEST_MIN_ARC_COST_TO_VEHICLE_START_ENDS: 6, SORTING_PROPERTY_HIGHEST_DIMENSION_USAGE: 7, SORTING_PROPERTY_RANDOM: 8 } } } }, SavingsParameters: { fields: { neighborsRatio: { type: "double", id: 1, protoName: "neighbors_ratio" }, maxMemoryUsageBytes: { type: "double", id: 2, protoName: "max_memory_usage_bytes" }, addReverseArcs: { type: "bool", id: 3, protoName: "add_reverse_arcs" }, arcCoefficient: { type: "double", id: 4, protoName: "arc_coefficient" } } }, GlobalCheapestInsertionParameters: { fields: { farthestSeedsRatio: { type: "double", id: 1, protoName: "farthest_seeds_ratio" }, neighborsRatio: { type: "double", id: 2, protoName: "neighbors_ratio" }, minNeighbors: { type: "int32", id: 3, protoName: "min_neighbors" }, useNeighborsRatioForInitialization: { type: "bool", id: 6, protoName: "use_neighbors_ratio_for_initialization" }, addUnperformedEntries: { type: "bool", id: 7, protoName: "add_unperformed_entries" } } }, SpatiallyCloseRoutesRuinStrategy: { oneofs: { _numRuinedRoutes: { oneof: ["numRuinedRoutes"] } }, fields: { numRuinedRoutes: { type: "uint32", id: 3, protoName: "num_ruined_routes", options: { proto3_optional: !0 } } } }, RandomWalkRuinStrategy: { oneofs: { _numRemovedVisits: { oneof: ["numRemovedVisits"] } }, fields: { numRemovedVisits: { type: "uint32", id: 7, protoName: "num_removed_visits", options: { proto3_optional: !0 } } } }, SISRRuinStrategy: { oneofs: { _maxRemovedSequenceSize: { oneof: ["maxRemovedSequenceSize"] }, _avgNumRemovedVisits: { oneof: ["avgNumRemovedVisits"] }, _bypassFactor: { oneof: ["bypassFactor"] } }, fields: { maxRemovedSequenceSize: { type: "uint32", id: 1, protoName: "max_removed_sequence_size", options: { proto3_optional: !0 } }, avgNumRemovedVisits: { type: "uint32", id: 2, protoName: "avg_num_removed_visits", options: { proto3_optional: !0 } }, bypassFactor: { type: "double", id: 3, protoName: "bypass_factor", options: { proto3_optional: !0 } } } }, RuinStrategy: { oneofs: { strategy: { oneof: ["spatiallyCloseRoutes", "randomWalk", "sisr"] } }, fields: { spatiallyCloseRoutes: { type: "SpatiallyCloseRoutesRuinStrategy", id: 1, protoName: "spatially_close_routes" }, randomWalk: { type: "RandomWalkRuinStrategy", id: 2, protoName: "random_walk" }, sisr: { type: "SISRRuinStrategy", id: 3 } } }, RecreateParameters: { oneofs: { parameters: { oneof: ["localCheapestInsertion", "savings", "globalCheapestInsertion"] } }, fields: { localCheapestInsertion: { type: "LocalCheapestInsertionParameters", id: 1, protoName: "local_cheapest_insertion" }, savings: { type: "SavingsParameters", id: 2 }, globalCheapestInsertion: { type: "GlobalCheapestInsertionParameters", id: 3, protoName: "global_cheapest_insertion" } } }, RecreateStrategy: { oneofs: { _heuristic: { oneof: ["heuristic"] }, _parameters: { oneof: ["parameters"] } }, fields: { heuristic: { type: "FirstSolutionStrategy.Value", id: 1, options: { proto3_optional: !0 } }, parameters: { type: "RecreateParameters", id: 2, options: { proto3_optional: !0 } } } }, RuinCompositionStrategy: { fields: {}, nested: { Value: { values: { UNSET: 0, RUN_ALL_SEQUENTIALLY: 1, RUN_ALL_RANDOMLY: 2, RUN_ONE_RANDOMLY: 3 } } } }, RuinRecreateParameters: { oneofs: { _routeSelectionNeighborsRatio: { oneof: ["routeSelectionNeighborsRatio"] }, _routeSelectionMinNeighbors: { oneof: ["routeSelectionMinNeighbors"] }, _routeSelectionMaxNeighbors: { oneof: ["routeSelectionMaxNeighbors"] } }, fields: { ruinStrategies: { rule: "repeated", type: "RuinStrategy", id: 1, protoName: "ruin_strategies" }, ruinCompositionStrategy: { type: "RuinCompositionStrategy.Value", id: 2, protoName: "ruin_composition_strategy" }, recreateStrategy: { type: "RecreateStrategy", id: 3, protoName: "recreate_strategy" }, routeSelectionNeighborsRatio: { type: "double", id: 4, protoName: "route_selection_neighbors_ratio", options: { proto3_optional: !0 } }, routeSelectionMinNeighbors: { type: "uint32", id: 5, protoName: "route_selection_min_neighbors", options: { proto3_optional: !0 } }, routeSelectionMaxNeighbors: { type: "uint32", id: 6, protoName: "route_selection_max_neighbors", options: { proto3_optional: !0 } } } }, PerturbationStrategy: { fields: {}, nested: { Value: { values: { UNSET: 0, RUIN_AND_RECREATE: 1 } } } }, CoolingScheduleStrategy: { fields: {}, nested: { Value: { values: { UNSET: 0, EXPONENTIAL: 1, LINEAR: 2 } } } }, GreedyDescentAcceptanceStrategy: { fields: {} }, SimulatedAnnealingAcceptanceStrategy: { oneofs: { _initialTemperature: { oneof: ["initialTemperature"] }, _finalTemperature: { oneof: ["finalTemperature"] }, _automaticTemperatures: { oneof: ["automaticTemperatures"] } }, fields: { coolingScheduleStrategy: { type: "CoolingScheduleStrategy.Value", id: 1, protoName: "cooling_schedule_strategy" }, initialTemperature: { type: "double", id: 2, protoName: "initial_temperature", options: { proto3_optional: !0 } }, finalTemperature: { type: "double", id: 3, protoName: "final_temperature", options: { proto3_optional: !0 } }, automaticTemperatures: { type: "bool", id: 4, protoName: "automatic_temperatures", options: { proto3_optional: !0 } } } }, AllNodesPerformedAcceptanceStrategy: { fields: {} }, MoreNodesPerformedAcceptanceStrategy: { fields: {} }, AbsencesBasedAcceptanceStrategy: { oneofs: { _removeRouteWithLowestAbsences: { oneof: ["removeRouteWithLowestAbsences"] } }, fields: { removeRouteWithLowestAbsences: { type: "bool", id: 1, protoName: "remove_route_with_lowest_absences", options: { proto3_optional: !0 } } } }, AcceptanceStrategy: { oneofs: { strategy: { oneof: ["greedyDescent", "simulatedAnnealing", "allNodesPerformed", "moreNodesPerformed", "absencesBased"] } }, fields: { greedyDescent: { type: "GreedyDescentAcceptanceStrategy", id: 1, protoName: "greedy_descent" }, simulatedAnnealing: { type: "SimulatedAnnealingAcceptanceStrategy", id: 2, protoName: "simulated_annealing" }, allNodesPerformed: { type: "AllNodesPerformedAcceptanceStrategy", id: 3, protoName: "all_nodes_performed" }, moreNodesPerformed: { type: "MoreNodesPerformedAcceptanceStrategy", id: 4, protoName: "more_nodes_performed" }, absencesBased: { type: "AbsencesBasedAcceptanceStrategy", id: 5, protoName: "absences_based" } } }, IteratedLocalSearchParameters: { oneofs: { _improvePerturbedSolution: { oneof: ["improvePerturbedSolution"] } }, fields: { perturbationStrategy: { type: "PerturbationStrategy.Value", id: 1, protoName: "perturbation_strategy" }, ruinRecreateParameters: { type: "RuinRecreateParameters", id: 2, protoName: "ruin_recreate_parameters" }, improvePerturbedSolution: { type: "bool", id: 3, protoName: "improve_perturbed_solution", options: { proto3_optional: !0 } }, referenceSolutionAcceptanceStrategy: { type: "AcceptanceStrategy", id: 4, protoName: "reference_solution_acceptance_strategy" }, bestSolutionAcceptanceStrategy: { type: "AcceptanceStrategy", id: 5, protoName: "best_solution_acceptance_strategy" } } }, ConstraintSolverParameters: { fields: { compressTrail: { type: "TrailCompression", id: 1, protoName: "compress_trail" }, trailBlockSize: { type: "int32", id: 2, protoName: "trail_block_size" }, arraySplitSize: { type: "int32", id: 3, protoName: "array_split_size" }, storeNames: { type: "bool", id: 4, protoName: "store_names" }, nameCastVariables: { type: "bool", id: 5, protoName: "name_cast_variables" }, nameAllVariables: { type: "bool", id: 6, protoName: "name_all_variables" }, profilePropagation: { type: "bool", id: 7, protoName: "profile_propagation" }, profileFile: { type: "string", id: 8, protoName: "profile_file" }, profileLocalSearch: { type: "bool", id: 16, protoName: "profile_local_search" }, printLocalSearchProfile: { type: "bool", id: 17, protoName: "print_local_search_profile" }, tracePropagation: { type: "bool", id: 9, protoName: "trace_propagation" }, traceSearch: { type: "bool", id: 10, protoName: "trace_search" }, printModel: { type: "bool", id: 11, protoName: "print_model" }, printModelStats: { type: "bool", id: 12, protoName: "print_model_stats" }, printAddedConstraints: { type: "bool", id: 13, protoName: "print_added_constraints" }, disableSolve: { type: "bool", id: 15, protoName: "disable_solve" }, useSmallTable: { type: "bool", id: 101, protoName: "use_small_table" }, useCumulativeEdgeFinder: { type: "bool", id: 105, protoName: "use_cumulative_edge_finder" }, useCumulativeTimeTable: { type: "bool", id: 106, protoName: "use_cumulative_time_table" }, useCumulativeTimeTableSync: { type: "bool", id: 112, protoName: "use_cumulative_time_table_sync" }, useSequenceHighDemandTasks: { type: "bool", id: 107, protoName: "use_sequence_high_demand_tasks" }, useAllPossibleDisjunctions: { type: "bool", id: 108, protoName: "use_all_possible_disjunctions" }, maxEdgeFinderSize: { type: "int32", id: 109, protoName: "max_edge_finder_size" }, diffnUseCumulative: { type: "bool", id: 110, protoName: "diffn_use_cumulative" }, useElementRmq: { type: "bool", id: 111, protoName: "use_element_rmq" }, skipLocallyOptimalPaths: { type: "bool", id: 113, protoName: "skip_locally_optimal_paths" }, checkSolutionPeriod: { type: "int32", id: 114, protoName: "check_solution_period" } }, reserved: [[100, 100], [102, 102], [103, 103], [104, 104]], nested: { TrailCompression: { values: { NO_COMPRESSION: 0, COMPRESS_WITH_ZLIB: 1 } } } }, sat: { options: { csharp_namespace: "Google.OrTools.Sat", go_package: "github.com/google/or-tools/ortools/sat/proto/satparameters", java_package: "com.google.ortools.sat", java_multiple_files: !0 }, nested: { SatParameters: { edition: "proto2", fields: { name: { type: "string", id: 171, options: { default: "" } }, preferredVariableOrder: { type: "VariableOrder", id: 1, protoName: "preferred_variable_order", options: { default: "IN_ORDER" } }, initialPolarity: { type: "Polarity", id: 2, protoName: "initial_polarity", options: { default: "POLARITY_FALSE" } }, usePhaseSaving: { type: "bool", id: 44, protoName: "use_phase_saving", options: { default: !0 } }, polarityRephaseIncrement: { type: "int32", id: 168, protoName: "polarity_rephase_increment", options: { default: 1e3 } }, polarityExploitLsHints: { type: "bool", id: 309, protoName: "polarity_exploit_ls_hints", options: { default: !1 } }, randomPolarityRatio: { type: "double", id: 45, protoName: "random_polarity_ratio", options: { default: 0 } }, randomBranchesRatio: { type: "double", id: 32, protoName: "random_branches_ratio", options: { default: 0 } }, useErwaHeuristic: { type: "bool", id: 75, protoName: "use_erwa_heuristic", options: { default: !1 } }, initialVariablesActivity: { type: "double", id: 76, protoName: "initial_variables_activity", options: { default: 0 } }, alsoBumpVariablesInConflictReasons: { type: "bool", id: 77, protoName: "also_bump_variables_in_conflict_reasons", options: { default: !1 } }, minimizationAlgorithm: { type: "ConflictMinimizationAlgorithm", id: 4, protoName: "minimization_algorithm", options: { default: "RECURSIVE" } }, binaryMinimizationAlgorithm: { type: "BinaryMinizationAlgorithm", id: 34, protoName: "binary_minimization_algorithm", options: { default: "BINARY_MINIMIZATION_FROM_UIP_AND_DECISIONS" } }, subsumptionDuringConflictAnalysis: { type: "bool", id: 56, protoName: "subsumption_during_conflict_analysis", options: { default: !0 } }, extraSubsumptionDuringConflictAnalysis: { type: "bool", id: 351, protoName: "extra_subsumption_during_conflict_analysis", options: { default: !0 } }, decisionSubsumptionDuringConflictAnalysis: { type: "bool", id: 353, protoName: "decision_subsumption_during_conflict_analysis", options: { default: !0 } }, eagerlySubsumeLastNConflicts: { type: "int32", id: 343, protoName: "eagerly_subsume_last_n_conflicts", options: { default: 4 } }, subsumeDuringVivification: { type: "bool", id: 355, protoName: "subsume_during_vivification", options: { default: !0 } }, useChronologicalBacktracking: { type: "bool", id: 330, protoName: "use_chronological_backtracking", options: { default: !1 } }, maxBackjumpLevels: { type: "int32", id: 331, protoName: "max_backjump_levels", options: { default: 50 } }, chronologicalBacktrackMinConflicts: { type: "int32", id: 332, protoName: "chronological_backtrack_min_conflicts", options: { default: 1e3 } }, clauseCleanupPeriod: { type: "int32", id: 11, protoName: "clause_cleanup_period", options: { default: 1e4 } }, clauseCleanupPeriodIncrement: { type: "int32", id: 337, protoName: "clause_cleanup_period_increment", options: { default: 0 } }, clauseCleanupTarget: { type: "int32", id: 13, protoName: "clause_cleanup_target", options: { default: 0 } }, clauseCleanupRatio: { type: "double", id: 190, protoName: "clause_cleanup_ratio", options: { default: 0.5 } }, clauseCleanupLbdBound: { type: "int32", id: 59, protoName: "clause_cleanup_lbd_bound", options: { default: 5 } }, clauseCleanupLbdTier1: { type: "int32", id: 349, protoName: "clause_cleanup_lbd_tier1", options: { default: 0 } }, clauseCleanupLbdTier2: { type: "int32", id: 350, protoName: "clause_cleanup_lbd_tier2", options: { default: 0 } }, clauseCleanupOrdering: { type: "ClauseOrdering", id: 60, protoName: "clause_cleanup_ordering", options: { default: "CLAUSE_ACTIVITY" } }, pbCleanupIncrement: { type: "int32", id: 46, protoName: "pb_cleanup_increment", options: { default: 200 } }, pbCleanupRatio: { type: "double", id: 47, protoName: "pb_cleanup_ratio", options: { default: 0.5 } }, variableActivityDecay: { type: "double", id: 15, protoName: "variable_activity_decay", options: { default: 0.8 } }, maxVariableActivityValue: { type: "double", id: 16, protoName: "max_variable_activity_value", options: { default: 1e100 } }, glucoseMaxDecay: { type: "double", id: 22, protoName: "glucose_max_decay", options: { default: 0.95 } }, glucoseDecayIncrement: { type: "double", id: 23, protoName: "glucose_decay_increment", options: { default: 0.01 } }, glucoseDecayIncrementPeriod: { type: "int32", id: 24, protoName: "glucose_decay_increment_period", options: { default: 5e3 } }, clauseActivityDecay: { type: "double", id: 17, protoName: "clause_activity_decay", options: { default: 0.999 } }, maxClauseActivityValue: { type: "double", id: 18, protoName: "max_clause_activity_value", options: { default: 1e20 } }, restartAlgorithms: { rule: "repeated", type: "RestartAlgorithm", id: 61, protoName: "restart_algorithms" }, defaultRestartAlgorithms: { type: "string", id: 70, protoName: "default_restart_algorithms", options: { default: "LUBY_RESTART,LBD_MOVING_AVERAGE_RESTART,DL_MOVING_AVERAGE_RESTART" } }, restartPeriod: { type: "int32", id: 30, protoName: "restart_period", options: { default: 50 } }, restartRunningWindowSize: { type: "int32", id: 62, protoName: "restart_running_window_size", options: { default: 50 } }, restartDlAverageRatio: { type: "double", id: 63, protoName: "restart_dl_average_ratio", options: { default: 1 } }, restartLbdAverageRatio: { type: "double", id: 71, protoName: "restart_lbd_average_ratio", options: { default: 1 } }, useBlockingRestart: { type: "bool", id: 64, protoName: "use_blocking_restart", options: { default: !1 } }, blockingRestartWindowSize: { type: "int32", id: 65, protoName: "blocking_restart_window_size", options: { default: 5e3 } }, blockingRestartMultiplier: { type: "double", id: 66, protoName: "blocking_restart_multiplier", options: { default: 1.4 } }, numConflictsBeforeStrategyChanges: { type: "int32", id: 68, protoName: "num_conflicts_before_strategy_changes", options: { default: 0 } }, strategyChangeIncreaseRatio: { type: "double", id: 69, protoName: "strategy_change_increase_ratio", options: { default: 0 } }, maxTimeInSeconds: { type: "double", id: 36, protoName: "max_time_in_seconds", options: { default: 1 / 0 } }, maxDeterministicTime: { type: "double", id: 67, protoName: "max_deterministic_time", options: { default: 1 / 0 } }, maxNumDeterministicBatches: { type: "int32", id: 291, protoName: "max_num_deterministic_batches", options: { default: 0 } }, maxNumberOfConflicts: { type: "int64", id: 37, protoName: "max_number_of_conflicts", options: { default: 9223372036854776e3 } }, maxMemoryInMb: { type: "int64", id: 40, protoName: "max_memory_in_mb", options: { default: 1e4 } }, absoluteGapLimit: { type: "double", id: 159, protoName: "absolute_gap_limit", options: { default: 1e-4 } }, relativeGapLimit: { type: "double", id: 160, protoName: "relative_gap_limit", options: { default: 0 } }, randomSeed: { type: "int32", id: 31, protoName: "random_seed", options: { default: 1 } }, permuteVariableRandomly: { type: "bool", id: 178, protoName: "permute_variable_randomly", options: { default: !1 } }, permutePresolveConstraintOrder: { type: "bool", id: 179, protoName: "permute_presolve_constraint_order", options: { default: !1 } }, useAbslRandom: { type: "bool", id: 180, protoName: "use_absl_random", options: { default: !1 } }, logSearchProgress: { type: "bool", id: 41, protoName: "log_search_progress", options: { default: !1 } }, logSubsolverStatistics: { type: "bool", id: 189, protoName: "log_subsolver_statistics", options: { default: !1 } }, logPrefix: { type: "string", id: 185, protoName: "log_prefix", options: { default: "" } }, logToStdout: { type: "bool", id: 186, protoName: "log_to_stdout", options: { default: !0 } }, logToResponse: { type: "bool", id: 187, protoName: "log_to_response", options: { default: !1 } }, usePbResolution: { type: "bool", id: 43, protoName: "use_pb_resolution", options: { default: !1 } }, minimizeReductionDuringPbResolution: { type: "bool", id: 48, protoName: "minimize_reduction_during_pb_resolution", options: { default: !1 } }, countAssumptionLevelsInLbd: { type: "bool", id: 49, protoName: "count_assumption_levels_in_lbd", options: { default: !0 } }, presolveBveThreshold: { type: "int32", id: 54, protoName: "presolve_bve_threshold", options: { default: 500 } }, filterSatPostsolveClauses: { type: "bool", id: 324, protoName: "filter_sat_postsolve_clauses", options: { default: !1 } }, presolveBveClauseWeight: { type: "int32", id: 55, protoName: "presolve_bve_clause_weight", options: { default: 3 } }, probingDeterministicTimeLimit: { type: "double", id: 226, protoName: "probing_deterministic_time_limit", options: { default: 1 } }, presolveProbingDeterministicTimeLimit: { type: "double", id: 57, protoName: "presolve_probing_deterministic_time_limit", options: { default: 30 } }, presolveBlockedClause: { type: "bool", id: 88, protoName: "presolve_blocked_clause", options: { default: !0 } }, presolveUseBva: { type: "bool", id: 72, protoName: "presolve_use_bva", options: { default: !0 } }, presolveBvaThreshold: { type: "int32", id: 73, protoName: "presolve_bva_threshold", options: { default: 1 } }, maxPresolveIterations: { type: "int32", id: 138, protoName: "max_presolve_iterations", options: { default: 3 } }, cpModelPresolve: { type: "bool", id: 86, protoName: "cp_model_presolve", options: { default: !0 } }, cpModelProbingLevel: { type: "int32", id: 110, protoName: "cp_model_probing_level", options: { default: 2 } }, cpModelUseSatPresolve: { type: "bool", id: 93, protoName: "cp_model_use_sat_presolve", options: { default: !0 } }, loadAtMostOnesInSatPresolve: { type: "bool", id: 335, protoName: "load_at_most_ones_in_sat_presolve", options: { default: !1 } }, removeFixedVariablesEarly: { type: "bool", id: 310, protoName: "remove_fixed_variables_early", options: { default: !0 } }, detectTableWithCost: { type: "bool", id: 216, protoName: "detect_table_with_cost", options: { default: !1 } }, tableCompressionLevel: { type: "int32", id: 217, protoName: "table_compression_level", options: { default: 2 } }, expandAlldiffConstraints: { type: "bool", id: 170, protoName: "expand_alldiff_constraints", options: { default: !1 } }, maxAlldiffDomainSize: { type: "int32", id: 320, protoName: "max_alldiff_domain_size", options: { default: 256 } }, expandReservoirConstraints: { type: "bool", id: 182, protoName: "expand_reservoir_constraints", options: { default: !0 } }, maxDomainSizeForLinear2Expansion: { type: "int32", id: 340, protoName: "max_domain_size_for_linear2_expansion", options: { default: 8 } }, expandReservoirUsingCircuit: { type: "bool", id: 288, protoName: "expand_reservoir_using_circuit", options: { default: !1 } }, encodeCumulativeAsReservoir: { type: "bool", id: 287, protoName: "encode_cumulative_as_reservoir", options: { default: !1 } }, maxLinMaxSizeForExpansion: { type: "int32", id: 280, protoName: "max_lin_max_size_for_expansion", options: { default: 0 } }, disableConstraintExpansion: { type: "bool", id: 181, protoName: "disable_constraint_expansion", options: { default: !1 } }, encodeComplexLinearConstraintWithInteger: { type: "bool", id: 223, protoName: "encode_complex_linear_constraint_with_integer", options: { default: !1 } }, mergeNoOverlapWorkLimit: { type: "double", id: 145, protoName: "merge_no_overlap_work_limit", options: { default: 1e12 } }, mergeAtMostOneWorkLimit: { type: "double", id: 146, protoName: "merge_at_most_one_work_limit", options: { default: 1e8 } }, presolveSubstitutionLevel: { type: "int32", id: 147, protoName: "presolve_substitution_level", options: { default: 1 } }, presolveExtractIntegerEnforcement: { type: "bool", id: 174, protoName: "presolve_extract_integer_enforcement", options: { default: !1 } }, presolveInclusionWorkLimit: { type: "int64", id: 201, protoName: "presolve_inclusion_work_limit", options: { default: 1e8 } }, ignoreNames: { type: "bool", id: 202, protoName: "ignore_names", options: { default: !0 } }, inferAllDiffs: { type: "bool", id: 233, protoName: "infer_all_diffs", options: { default: !0 } }, findBigLinearOverlap: { type: "bool", id: 234, protoName: "find_big_linear_overlap", options: { default: !0 } }, findClausesThatAreExactlyOne: { type: "bool", id: 333, protoName: "find_clauses_that_are_exactly_one", options: { default: !0 } }, useSatInprocessing: { type: "bool", id: 163, protoName: "use_sat_inprocessing", options: { default: !0 } }, inprocessingDtimeRatio: { type: "double", id: 273, protoName: "inprocessing_dtime_ratio", options: { default: 0.2 } }, inprocessingProbingDtime: { type: "double", id: 274, protoName: "inprocessing_probing_dtime", options: { default: 1 } }, inprocessingMinimizationDtime: { type: "double", id: 275, protoName: "inprocessing_minimization_dtime", options: { default: 1 } }, inprocessingMinimizationUseConflictAnalysis: { type: "bool", id: 297, protoName: "inprocessing_minimization_use_conflict_analysis", options: { default: !0 } }, inprocessingMinimizationUseAllOrderings: { type: "bool", id: 298, protoName: "inprocessing_minimization_use_all_orderings", options: { default: !1 } }, inprocessingUseCongruenceClosure: { type: "bool", id: 342, protoName: "inprocessing_use_congruence_closure", options: { default: !0 } }, inprocessingUseSatSweeping: { type: "bool", id: 354, protoName: "inprocessing_use_sat_sweeping", options: { default: !1 } }, numWorkers: { type: "int32", id: 206, protoName: "num_workers", options: { default: 0 } }, numSearchWorkers: { type: "int32", id: 100, protoName: "num_search_workers", options: { default: 0 } }, numFullSubsolvers: { type: "int32", id: 294, protoName: "num_full_subsolvers", options: { default: 0 } }, subsolvers: { rule: "repeated", type: "string", id: 207 }, extraSubsolvers: { rule: "repeated", type: "string", id: 219, protoName: "extra_subsolvers" }, ignoreSubsolvers: { rule: "repeated", type: "string", id: 209, protoName: "ignore_subsolvers" }, filterSubsolvers: { rule: "repeated", type: "string", id: 293, protoName: "filter_subsolvers" }, subsolverParams: { rule: "repeated", type: "SatParameters", id: 210, protoName: "subsolver_params" }, interleaveSearch: { type: "bool", id: 136, protoName: "interleave_search", options: { default: !1 } }, interleaveBatchSize: { type: "int32", id: 134, protoName: "interleave_batch_size", options: { default: 0 } }, shareObjectiveBounds: { type: "bool", id: 113, protoName: "share_objective_bounds", options: { default: !0 } }, shareLevelZeroBounds: { type: "bool", id: 114, protoName: "share_level_zero_bounds", options: { default: !0 } }, shareLinear2Bounds: { type: "bool", id: 326, protoName: "share_linear2_bounds", options: { default: !1 } }, shareBinaryClauses: { type: "bool", id: 203, protoName: "share_binary_clauses", options: { default: !0 } }, shareGlueClauses: { type: "bool", id: 285, protoName: "share_glue_clauses", options: { default: !0 } }, minimizeSharedClauses: { type: "bool", id: 300, protoName: "minimize_shared_clauses", options: { default: !0 } }, shareGlueClausesDtime: { type: "double", id: 322, protoName: "share_glue_clauses_dtime", options: { default: 1 } }, checkLratProof: { type: "bool", id: 344, protoName: "check_lrat_proof", options: { default: !1 } }, checkMergedLratProof: { type: "bool", id: 352, protoName: "check_merged_lrat_proof", options: { default: !1 } }, outputLratProof: { type: "bool", id: 345, protoName: "output_lrat_proof", options: { default: !1 } }, checkDratProof: { type: "bool", id: 346, protoName: "check_drat_proof", options: { default: !1 } }, outputDratProof: { type: "bool", id: 347, protoName: "output_drat_proof", options: { default: !1 } }, maxDratTimeInSeconds: { type: "double", id: 348, protoName: "max_drat_time_in_seconds", options: { default: 1 / 0 } }, debugPostsolveWithFullSolver: { type: "bool", id: 162, protoName: "debug_postsolve_with_full_solver", options: { default: !1 } }, debugMaxNumPresolveOperations: { type: "int32", id: 151, protoName: "debug_max_num_presolve_operations", options: { default: 0 } }, debugCrashOnBadHint: { type: "bool", id: 195, protoName: "debug_crash_on_bad_hint", options: { default: !1 } }, debugCrashIfPresolveBreaksHint: { type: "bool", id: 306, protoName: "debug_crash_if_presolve_breaks_hint", options: { default: !1 } }, debugCrashIfLratCheckFails: { type: "bool", id: 339, protoName: "debug_crash_if_lrat_check_fails", options: { default: !1 } }, useOptimizationHints: { type: "bool", id: 35, protoName: "use_optimization_hints", options: { default: !0 } }, coreMinimizationLevel: { type: "int32", id: 50, protoName: "core_minimization_level", options: { default: 2 } }, findMultipleCores: { type: "bool", id: 84, protoName: "find_multiple_cores", options: { default: !0 } }, coverOptimization: { type: "bool", id: 89, protoName: "cover_optimization", options: { default: !0 } }, maxSatAssumptionOrder: { type: "MaxSatAssumptionOrder", id: 51, protoName: "max_sat_assumption_order", options: { default: "DEFAULT_ASSUMPTION_ORDER" } }, maxSatReverseAssumptionOrder: { type: "bool", id: 52, protoName: "max_sat_reverse_assumption_order", options: { default: !1 } }, maxSatStratification: { type: "MaxSatStratificationAlgorithm", id: 53, protoName: "max_sat_stratification", options: { default: "STRATIFICATION_DESCENT" } }, propagationLoopDetectionFactor: { type: "double", id: 221, protoName: "propagation_loop_detection_factor", options: { default: 10 } }, usePrecedencesInDisjunctiveConstraint: { type: "bool", id: 74, protoName: "use_precedences_in_disjunctive_constraint", options: { default: !0 } }, transitivePrecedencesWorkLimit: { type: "int32", id: 327, protoName: "transitive_precedences_work_limit", options: { default: 1e6 } }, maxSizeToCreatePrecedenceLiteralsInDisjunctive: { type: "int32", id: 229, protoName: "max_size_to_create_precedence_literals_in_disjunctive", options: { default: 60 } }, useStrongPropagationInDisjunctive: { type: "bool", id: 230, protoName: "use_strong_propagation_in_disjunctive", options: { default: !1 } }, useDynamicPrecedenceInDisjunctive: { type: "bool", id: 263, protoName: "use_dynamic_precedence_in_disjunctive", options: { default: !1 } }, useDynamicPrecedenceInCumulative: { type: "bool", id: 268, protoName: "use_dynamic_precedence_in_cumulative", options: { default: !1 } }, useOverloadCheckerInCumulative: { type: "bool", id: 78, protoName: "use_overload_checker_in_cumulative", options: { default: !1 } }, useConservativeScaleOverloadChecker: { type: "bool", id: 286, protoName: "use_conservative_scale_overload_checker", options: { default: !1 } }, useTimetableEdgeFindingInCumulative: { type: "bool", id: 79, protoName: "use_timetable_edge_finding_in_cumulative", options: { default: !1 } }, maxNumIntervalsForTimetableEdgeFinding: { type: "int32", id: 260, protoName: "max_num_intervals_for_timetable_edge_finding", options: { default: 100 } }, useHardPrecedencesInCumulative: { type: "bool", id: 215, protoName: "use_hard_precedences_in_cumulative", options: { default: !1 } }, exploitAllPrecedences: { type: "bool", id: 220, protoName: "exploit_all_precedences", options: { default: !1 } }, useDisjunctiveConstraintInCumulative: { type: "bool", id: 80, protoName: "use_disjunctive_constraint_in_cumulative", options: { default: !0 } }, noOverlap_2dBooleanRelationsLimit: { type: "int32", id: 321, protoName: "no_overlap_2d_boolean_relations_limit", options: { default: 10 } }, useTimetablingInNoOverlap_2d: { type: "bool", id: 200, protoName: "use_timetabling_in_no_overlap_2d", options: { default: !1 } }, useEnergeticReasoningInNoOverlap_2d: { type: "bool", id: 213, protoName: "use_energetic_reasoning_in_no_overlap_2d", options: { default: !1 } }, useAreaEnergeticReasoningInNoOverlap_2d: { type: "bool", id: 271, protoName: "use_area_energetic_reasoning_in_no_overlap_2d", options: { default: !1 } }, useTryEdgeReasoningInNoOverlap_2d: { type: "bool", id: 299, protoName: "use_try_edge_reasoning_in_no_overlap_2d", options: { default: !1 } }, maxPairsPairwiseReasoningInNoOverlap_2d: { type: "int32", id: 276, protoName: "max_pairs_pairwise_reasoning_in_no_overlap_2d", options: { default: 1250 } }, maximumRegionsToSplitInDisconnectedNoOverlap_2d: { type: "int32", id: 315, protoName: "maximum_regions_to_split_in_disconnected_no_overlap_2d", options: { default: 0 } }, useLinear3ForNoOverlap_2dPrecedences: { type: "bool", id: 323, protoName: "use_linear3_for_no_overlap_2d_precedences", options: { default: !0 } }, useDualSchedulingHeuristics: { type: "bool", id: 214, protoName: "use_dual_scheduling_heuristics", options: { default: !0 } }, useAllDifferentForCircuit: { type: "bool", id: 311, protoName: "use_all_different_for_circuit", options: { default: !1 } }, routingCutSubsetSizeForBinaryRelationBound: { type: "int32", id: 312, protoName: "routing_cut_subset_size_for_binary_relation_bound", options: { default: 0 } }, routingCutSubsetSizeForTightBinaryRelationBound: { type: "int32", id: 313, protoName: "routing_cut_subset_size_for_tight_binary_relation_bound", options: { default: 0 } }, routingCutSubsetSizeForExactBinaryRelationBound: { type: "int32", id: 316, protoName: "routing_cut_subset_size_for_exact_binary_relation_bound", options: { default: 8 } }, routingCutSubsetSizeForShortestPathsBound: { type: "int32", id: 318, protoName: "routing_cut_subset_size_for_shortest_paths_bound", options: { default: 8 } }, routingCutDpEffort: { type: "double", id: 314, protoName: "routing_cut_dp_effort", options: { default: 1e7 } }, routingCutMaxInfeasiblePathLength: { type: "int32", id: 317, protoName: "routing_cut_max_infeasible_path_length", options: { default: 6 } }, searchBranching: { type: "SearchBranching", id: 82, protoName: "search_branching", options: { default: "AUTOMATIC_SEARCH" } }, hintConflictLimit: { type: "int32", id: 153, protoName: "hint_conflict_limit", options: { default: 10 } }, repairHint: { type: "bool", id: 167, protoName: "repair_hint", options: { default: !1 } }, fixVariablesToTheirHintedValue: { type: "bool", id: 192, protoName: "fix_variables_to_their_hinted_value", options: { default: !1 } }, useProbingSearch: { type: "bool", id: 176, protoName: "use_probing_search", options: { default: !1 } }, useExtendedProbing: { type: "bool", id: 269, protoName: "use_extended_probing", options: { default: !0 } }, probingNumCombinationsLimit: { type: "int32", id: 272, protoName: "probing_num_combinations_limit", options: { default: 2e4 } }, shavingDeterministicTimeInProbingSearch: { type: "double", id: 204, protoName: "shaving_deterministic_time_in_probing_search", options: { default: 1e-3 } }, shavingSearchDeterministicTime: { type: "double", id: 205, protoName: "shaving_search_deterministic_time", options: { default: 0.1 } }, shavingSearchThreshold: { type: "int64", id: 290, protoName: "shaving_search_threshold", options: { default: 64 } }, useObjectiveLbSearch: { type: "bool", id: 228, protoName: "use_objective_lb_search", options: { default: !1 } }, useObjectiveShavingSearch: { type: "bool", id: 253, protoName: "use_objective_shaving_search", options: { default: !1 } }, variablesShavingLevel: { type: "int32", id: 289, protoName: "variables_shaving_level", options: { default: -1 } }, pseudoCostReliabilityThreshold: { type: "int64", id: 123, protoName: "pseudo_cost_reliability_threshold", options: { default: 100 } }, optimizeWithCore: { type: "bool", id: 83, protoName: "optimize_with_core", options: { default: !1 } }, optimizeWithLbTreeSearch: { type: "bool", id: 188, protoName: "optimize_with_lb_tree_search", options: { default: !1 } }, saveLpBasisInLbTreeSearch: { type: "bool", id: 284, protoName: "save_lp_basis_in_lb_tree_search", options: { default: !1 } }, binarySearchNumConflicts: { type: "int32", id: 99, protoName: "binary_search_num_conflicts", options: { default: -1 } }, optimizeWithMaxHs: { type: "bool", id: 85, protoName: "optimize_with_max_hs", options: { default: !1 } }, useFeasibilityJump: { type: "bool", id: 265, protoName: "use_feasibility_jump", options: { default: !0 } }, useLsOnly: { type: "bool", id: 240, protoName: "use_ls_only", options: { default: !1 } }, feasibilityJumpDecay: { type: "double", id: 242, protoName: "feasibility_jump_decay", options: { default: 0.95 } }, feasibilityJumpLinearizationLevel: { type: "int32", id: 257, protoName: "feasibility_jump_linearization_level", options: { default: 2 } }, feasibilityJumpRestartFactor: { type: "int32", id: 258, protoName: "feasibility_jump_restart_factor", options: { default: 1 } }, feasibilityJumpBatchDtime: { type: "double", id: 292, protoName: "feasibility_jump_batch_dtime", options: { default: 0.1 } }, feasibilityJumpVarRandomizationProbability: { type: "double", id: 247, protoName: "feasibility_jump_var_randomization_probability", options: { default: 0.05 } }, feasibilityJumpVarPerburbationRangeRatio: { type: "double", id: 248, protoName: "feasibility_jump_var_perburbation_range_ratio", options: { default: 0.2 } }, feasibilityJumpEnableRestarts: { type: "bool", id: 250, protoName: "feasibility_jump_enable_restarts", options: { default: !0 } }, feasibilityJumpMaxExpandedConstraintSize: { type: "int32", id: 264, protoName: "feasibility_jump_max_expanded_constraint_size", options: { default: 500 } }, numViolationLs: { type: "int32", id: 244, protoName: "num_violation_ls", options: { default: 0 } }, violationLsPerturbationPeriod: { type: "int32", id: 249, protoName: "violation_ls_perturbation_period", options: { default: 100 } }, violationLsCompoundMoveProbability: { type: "double", id: 259, protoName: "violation_ls_compound_move_probability", options: { default: 0.5 } }, sharedTreeNumWorkers: { type: "int32", id: 235, protoName: "shared_tree_num_workers", options: { default: -1 } }, useSharedTreeSearch: { type: "bool", id: 236, protoName: "use_shared_tree_search", options: { default: !1 } }, sharedTreeWorkerMinRestartsPerSubtree: { type: "int32", id: 282, protoName: "shared_tree_worker_min_restarts_per_subtree", options: { default: 1 } }, sharedTreeWorkerEnableTrailSharing: { type: "bool", id: 295, protoName: "shared_tree_worker_enable_trail_sharing", options: { default: !0 } }, sharedTreeWorkerEnablePhaseSharing: { type: "bool", id: 304, protoName: "shared_tree_worker_enable_phase_sharing", options: { default: !0 } }, sharedTreeOpenLeavesPerWorker: { type: "double", id: 281, protoName: "shared_tree_open_leaves_per_worker", options: { default: 2 } }, sharedTreeMaxNodesPerWorker: { type: "int32", id: 238, protoName: "shared_tree_max_nodes_per_worker", options: { default: 1e4 } }, sharedTreeSplitStrategy: { type: "SharedTreeSplitStrategy", id: 239, protoName: "shared_tree_split_strategy", options: { default: "SPLIT_STRATEGY_AUTO" } }, sharedTreeBalanceTolerance: { type: "int32", id: 305, protoName: "shared_tree_balance_tolerance", options: { default: 1 } }, sharedTreeSplitMinDtime: { type: "double", id: 328, protoName: "shared_tree_split_min_dtime", options: { default: 0.1 } }, enumerateAllSolutions: { type: "bool", id: 87, protoName: "enumerate_all_solutions", options: { default: !1 } }, keepAllFeasibleSolutionsInPresolve: { type: "bool", id: 173, protoName: "keep_all_feasible_solutions_in_presolve", options: { default: !1 } }, fillTightenedDomainsInResponse: { type: "bool", id: 132, protoName: "fill_tightened_domains_in_response", options: { default: !1 } }, fillAdditionalSolutionsInResponse: { type: "bool", id: 194, protoName: "fill_additional_solutions_in_response", options: { default: !1 } }, instantiateAllVariables: { type: "bool", id: 106, protoName: "instantiate_all_variables", options: { default: !0 } }, autoDetectGreaterThanAtLeastOneOf: { type: "bool", id: 95, protoName: "auto_detect_greater_than_at_least_one_of", options: { default: !0 } }, stopAfterFirstSolution: { type: "bool", id: 98, protoName: "stop_after_first_solution", options: { default: !1 } }, stopAfterPresolve: { type: "bool", id: 149, protoName: "stop_after_presolve", options: { default: !1 } }, stopAfterRootPropagation: { type: "bool", id: 252, protoName: "stop_after_root_propagation", options: { default: !1 } }, lnsInitialDifficulty: { type: "double", id: 307, protoName: "lns_initial_difficulty", options: { default: 0.5 } }, lnsInitialDeterministicLimit: { type: "double", id: 308, protoName: "lns_initial_deterministic_limit", options: { default: 0.1 } }, useLns: { type: "bool", id: 283, protoName: "use_lns", options: { default: !0 } }, useLnsOnly: { type: "bool", id: 101, protoName: "use_lns_only", options: { default: !1 } }, solutionPoolSize: { type: "int32", id: 193, protoName: "solution_pool_size", options: { default: 3 } }, solutionPoolDiversityLimit: { type: "int32", id: 329, protoName: "solution_pool_diversity_limit", options: { default: 10 } }, alternativePoolSize: { type: "int32", id: 325, protoName: "alternative_pool_size", options: { default: 1 } }, useRinsLns: { type: "bool", id: 129, protoName: "use_rins_lns", options: { default: !0 } }, useFeasibilityPump: { type: "bool", id: 164, protoName: "use_feasibility_pump", options: { default: !0 } }, useLbRelaxLns: { type: "bool", id: 255, protoName: "use_lb_relax_lns", options: { default: !0 } }, lbRelaxNumWorkersThreshold: { type: "int32", id: 296, protoName: "lb_relax_num_workers_threshold", options: { default: 16 } }, fpRounding: { type: "FPRoundingMethod", id: 165, protoName: "fp_rounding", options: { default: "PROPAGATION_ASSISTED" } }, diversifyLnsParams: { type: "bool", id: 137, protoName: "diversify_lns_params", options: { default: !1 } }, randomizeSearch: { type: "bool", id: 103, protoName: "randomize_search", options: { default: !1 } }, searchRandomVariablePoolSize: { type: "int64", id: 104, protoName: "search_random_variable_pool_size", options: { default: 0 } }, pushAllTasksTowardStart: { type: "bool", id: 262, protoName: "push_all_tasks_toward_start", options: { default: !1 } }, useOptionalVariables: { type: "bool", id: 108, protoName: "use_optional_variables", options: { default: !1 } }, useExactLpReason: { type: "bool", id: 109, protoName: "use_exact_lp_reason", options: { default: !0 } }, useCombinedNoOverlap: { type: "bool", id: 133, protoName: "use_combined_no_overlap", options: { default: !1 } }, atMostOneMaxExpansionSize: { type: "int32", id: 270, protoName: "at_most_one_max_expansion_size", options: { default: 3 } }, catchSigintSignal: { type: "bool", id: 135, protoName: "catch_sigint_signal", options: { default: !0 } }, useImpliedBounds: { type: "bool", id: 144, protoName: "use_implied_bounds", options: { default: !0 } }, polishLpSolution: { type: "bool", id: 175, protoName: "polish_lp_solution", options: { default: !1 } }, lpPrimalTolerance: { type: "double", id: 266, protoName: "lp_primal_tolerance", options: { default: 1e-7 } }, lpDualTolerance: { type: "double", id: 267, protoName: "lp_dual_tolerance", options: { default: 1e-7 } }, convertIntervals: { type: "bool", id: 177, protoName: "convert_intervals", options: { default: !0 } }, symmetryLevel: { type: "int32", id: 183, protoName: "symmetry_level", options: { default: 2 } }, useSymmetryInLp: { type: "bool", id: 301, protoName: "use_symmetry_in_lp", options: { default: !1 } }, keepSymmetryInPresolve: { type: "bool", id: 303, protoName: "keep_symmetry_in_presolve", options: { default: !1 } }, symmetryDetectionDeterministicTimeLimit: { type: "double", id: 302, protoName: "symmetry_detection_deterministic_time_limit", options: { default: 1 } }, newLinearPropagation: { type: "bool", id: 224, protoName: "new_linear_propagation", options: { default: !0 } }, linearSplitSize: { type: "int32", id: 256, protoName: "linear_split_size", options: { default: 100 } }, linearizationLevel: { type: "int32", id: 90, protoName: "linearization_level", options: { default: 1 } }, booleanEncodingLevel: { type: "int32", id: 107, protoName: "boolean_encoding_level", options: { default: 1 } }, maxDomainSizeWhenEncodingEqNeqConstraints: { type: "int32", id: 191, protoName: "max_domain_size_when_encoding_eq_neq_constraints", options: { default: 16 } }, maxNumCuts: { type: "int32", id: 91, protoName: "max_num_cuts", options: { default: 1e4 } }, cutLevel: { type: "int32", id: 196, protoName: "cut_level", options: { default: 1 } }, onlyAddCutsAtLevelZero: { type: "bool", id: 92, protoName: "only_add_cuts_at_level_zero", options: { default: !1 } }, addObjectiveCut: { type: "bool", id: 197, protoName: "add_objective_cut", options: { default: !1 } }, addCgCuts: { type: "bool", id: 117, protoName: "add_cg_cuts", options: { default: !0 } }, addMirCuts: { type: "bool", id: 120, protoName: "add_mir_cuts", options: { default: !0 } }, addZeroHalfCuts: { type: "bool", id: 169, protoName: "add_zero_half_cuts", options: { default: !0 } }, addCliqueCuts: { type: "bool", id: 172, protoName: "add_clique_cuts", options: { default: !0 } }, addRltCuts: { type: "bool", id: 279, protoName: "add_rlt_cuts", options: { default: !0 } }, maxAllDiffCutSize: { type: "int32", id: 148, protoName: "max_all_diff_cut_size", options: { default: 64 } }, addLinMaxCuts: { type: "bool", id: 152, protoName: "add_lin_max_cuts", options: { default: !0 } }, maxIntegerRoundingScaling: { type: "int32", id: 119, protoName: "max_integer_rounding_scaling", options: { default: 600 } }, addLpConstraintsLazily: { type: "bool", id: 112, protoName: "add_lp_constraints_lazily", options: { default: !0 } }, rootLpIterations: { type: "int32", id: 227, protoName: "root_lp_iterations", options: { default: 2e3 } }, minOrthogonalityForLpConstraints: { type: "double", id: 115, protoName: "min_orthogonality_for_lp_constraints", options: { default: 0.05 } }, maxCutRoundsAtLevelZero: { type: "int32", id: 154, protoName: "max_cut_rounds_at_level_zero", options: { default: 1 } }, maxConsecutiveInactiveCount: { type: "int32", id: 121, protoName: "max_consecutive_inactive_count", options: { default: 100 } }, cutMaxActiveCountValue: { type: "double", id: 155, protoName: "cut_max_active_count_value", options: { default: 1e10 } }, cutActiveCountDecay: { type: "double", id: 156, protoName: "cut_active_count_decay", options: { default: 0.8 } }, cutCleanupTarget: { type: "int32", id: 157, protoName: "cut_cleanup_target", options: { default: 1e3 } }, newConstraintsBatchSize: { type: "int32", id: 122, protoName: "new_constraints_batch_size", options: { default: 50 } }, exploitIntegerLpSolution: { type: "bool", id: 94, protoName: "exploit_integer_lp_solution", options: { default: !0 } }, exploitAllLpSolution: { type: "bool", id: 116, protoName: "exploit_all_lp_solution", options: { default: !0 } }, exploitBestSolution: { type: "bool", id: 130, protoName: "exploit_best_solution", options: { default: !1 } }, exploitRelaxationSolution: { type: "bool", id: 161, protoName: "exploit_relaxation_solution", options: { default: !1 } }, exploitObjective: { type: "bool", id: 131, protoName: "exploit_objective", options: { default: !0 } }, detectLinearizedProduct: { type: "bool", id: 277, protoName: "detect_linearized_product", options: { default: !1 } }, useNewIntegerConflictResolution: { type: "bool", id: 336, protoName: "use_new_integer_conflict_resolution", options: { default: !1 } }, create_1uipBooleanDuringIcr: { type: "bool", id: 341, protoName: "create_1uip_boolean_during_icr", options: { default: !0 } }, mipMaxBound: { type: "double", id: 124, protoName: "mip_max_bound", options: { default: 1e7 } }, mipVarScaling: { type: "double", id: 125, protoName: "mip_var_scaling", options: { default: 1 } }, mipScaleLargeDomain: { type: "bool", id: 225, protoName: "mip_scale_large_domain", options: { default: !1 } }, mipAutomaticallyScaleVariables: { type: "bool", id: 166, protoName: "mip_automatically_scale_variables", options: { default: !0 } }, onlySolveIp: { type: "bool", id: 222, protoName: "only_solve_ip", options: { default: !1 } }, mipWantedPrecision: { type: "double", id: 126, protoName: "mip_wanted_precision", options: { default: 1e-6 } }, mipMaxActivityExponent: { type: "int32", id: 127, protoName: "mip_max_activity_exponent", options: { default: 53 } }, mipCheckPrecision: { type: "double", id: 128, protoName: "mip_check_precision", options: { default: 1e-4 } }, mipComputeTrueObjectiveBound: { type: "bool", id: 198, protoName: "mip_compute_true_objective_bound", options: { default: !0 } }, mipMaxValidMagnitude: { type: "double", id: 199, protoName: "mip_max_valid_magnitude", options: { default: 1e20 } }, mipTreatHighMagnitudeBoundsAsInfinity: { type: "bool", id: 278, protoName: "mip_treat_high_magnitude_bounds_as_infinity", options: { default: !1 } }, mipDropTolerance: { type: "double", id: 232, protoName: "mip_drop_tolerance", options: { default: 1e-16 } }, mipPresolveLevel: { type: "int32", id: 261, protoName: "mip_presolve_level", options: { default: 2 } } }, nested: { VariableOrder: { values: { IN_ORDER: 0, IN_REVERSE_ORDER: 1, IN_RANDOM_ORDER: 2 } }, Polarity: { values: { POLARITY_TRUE: 0, POLARITY_FALSE: 1, POLARITY_RANDOM: 2 } }, ConflictMinimizationAlgorithm: { values: { NONE: 0, SIMPLE: 1, RECURSIVE: 2 }, reserved: [[3, 3]] }, BinaryMinizationAlgorithm: { values: { NO_BINARY_MINIMIZATION: 0, BINARY_MINIMIZATION_FROM_UIP: 1, BINARY_MINIMIZATION_FROM_UIP_AND_DECISIONS: 5 }, reserved: [[2, 2], [3, 3], [4, 4]] }, ClauseOrdering: { values: { CLAUSE_ACTIVITY: 0, CLAUSE_LBD: 1 } }, RestartAlgorithm: { values: { NO_RESTART: 0, LUBY_RESTART: 1, DL_MOVING_AVERAGE_RESTART: 2, LBD_MOVING_AVERAGE_RESTART: 3, FIXED_RESTART: 4 } }, MaxSatAssumptionOrder: { values: { DEFAULT_ASSUMPTION_ORDER: 0, ORDER_ASSUMPTION_BY_DEPTH: 1, ORDER_ASSUMPTION_BY_WEIGHT: 2 } }, MaxSatStratificationAlgorithm: { values: { STRATIFICATION_NONE: 0, STRATIFICATION_DESCENT: 1, STRATIFICATION_ASCENT: 2 } }, SearchBranching: { values: { AUTOMATIC_SEARCH: 0, FIXED_SEARCH: 1, PORTFOLIO_SEARCH: 2, LP_SEARCH: 3, PSEUDO_COST_SEARCH: 4, PORTFOLIO_WITH_QUICK_RESTART_SEARCH: 5, HINT_SEARCH: 6, PARTIAL_FIXED_SEARCH: 7, RANDOMIZED_SEARCH: 8 } }, SharedTreeSplitStrategy: { values: { SPLIT_STRATEGY_AUTO: 0, SPLIT_STRATEGY_DISCREPANCY: 1, SPLIT_STRATEGY_OBJECTIVE_LB: 2, SPLIT_STRATEGY_BALANCED_TREE: 3, SPLIT_STRATEGY_FIRST_PROPOSAL: 4 } }, FPRoundingMethod: { values: { NEAREST_INTEGER: 0, LOCK_BASED: 1, ACTIVE_LOCK_BASED: 3, PROPAGATION_ASSISTED: 2 } } } } } }, OptionalBoolean: { values: { BOOL_UNSPECIFIED: 0, BOOL_FALSE: 2, BOOL_TRUE: 3 } } } }, google: { nested: { protobuf: { nested: { Duration: { fields: { seconds: { type: "int64", id: 1 }, nanos: { type: "int32", id: 2 } } } } } } } } };

// lib/routing/search_parameters.ts
var root = protobuf.Root.fromJSON(routingParametersDescriptor), parametersType = root.lookupType("operations_research.RoutingSearchParameters"), modelParametersType = root.lookupType("operations_research.RoutingModelParameters");
root.resolveAll();
function encodeRoutingSearchParameters(parameters) {
  let captured = normalizeProtobufInput(parameters, parametersType);
  if (captured.satParameters?.numSearchWorkers) throw new TypeError("Routing CP-SAT numSearchWorkers is not supported; use numWorkers.");
  if (captured.satParameters?.numWorkers !== void 0 && captured.satParameters.numWorkers < 0) throw new TypeError("Routing CP-SAT numWorkers must be nonnegative.");
  return { ...encodeRoutingParameters(captured, parametersType), numWorkers: captured.satParameters?.numWorkers ?? 1 };
}
function encodeRoutingModelParameters(parameters) {
  return encodeRoutingParameters(normalizeProtobufInput(parameters, modelParametersType), modelParametersType);
}
function encodeRoutingParameters(normalized, parametersType2) {
  let fields = [];
  function collectFields(value2, type, prefix) {
    for (let [key2, entry] of Object.entries(value2)) {
      let field = type.fields[key2].resolve(), name = `${prefix}${field.name.replace(/_([a-zA-Z0-9])/g, (_match, letter) => letter.toUpperCase())}`;
      if (!field.repeated && field.resolvedType instanceof protobuf.Type && !field.map) {
        let nested = entry;
        Object.keys(nested).length === 0 ? fields.push(name) : collectFields(nested, field.resolvedType, `${name}.`);
      } else fields.push(name);
    }
  }
  collectFields(normalized, parametersType2, "");
  let value = encodeProtobufBigInts(normalized, parametersType2), error = parametersType2.verify(value);
  if (error) throw new TypeError(`Routing search parameters: ${error}`);
  return { proto: new Uint8Array(parametersType2.encode(parametersType2.create(value)).finish()), fields };
}
function encodeRoutingSearchParametersForValidation(parameters) {
  return encodeRoutingParameters(normalizeProtobufInput(parameters, parametersType), parametersType);
}

// lib/callback_validation.ts
function synchronousCallbackResult(result, errorMessage) {
  if (result && typeof result.then == "function")
    throw Promise.resolve(result).catch(() => {
    }), new TypeError(errorMessage);
  return result;
}

// lib/package_metadata.ts
var packageName = "or-tools-wasm", version = "2.2.0";

// node_modules/@bufbuild/protobuf/dist/esm/is-message.js
function isMessage(arg, schema) {
  return arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string" ? schema === void 0 ? !0 : schema.typeName === arg.$typeName : !1;
}

// node_modules/@bufbuild/protobuf/dist/esm/descriptors.js
var ScalarType;
(function(ScalarType2) {
  ScalarType2[ScalarType2.DOUBLE = 1] = "DOUBLE", ScalarType2[ScalarType2.FLOAT = 2] = "FLOAT", ScalarType2[ScalarType2.INT64 = 3] = "INT64", ScalarType2[ScalarType2.UINT64 = 4] = "UINT64", ScalarType2[ScalarType2.INT32 = 5] = "INT32", ScalarType2[ScalarType2.FIXED64 = 6] = "FIXED64", ScalarType2[ScalarType2.FIXED32 = 7] = "FIXED32", ScalarType2[ScalarType2.BOOL = 8] = "BOOL", ScalarType2[ScalarType2.STRING = 9] = "STRING", ScalarType2[ScalarType2.BYTES = 12] = "BYTES", ScalarType2[ScalarType2.UINT32 = 13] = "UINT32", ScalarType2[ScalarType2.SFIXED32 = 15] = "SFIXED32", ScalarType2[ScalarType2.SFIXED64 = 16] = "SFIXED64", ScalarType2[ScalarType2.SINT32 = 17] = "SINT32", ScalarType2[ScalarType2.SINT64 = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));

// node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js
function varint64read() {
  let buf = this.buf, pos = this.pos, lo = 0, hi = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    let b = buf[pos++];
    if (lo |= (b & 127) << shift, (b & 128) == 0) {
      this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
      return;
    }
  }
  let middleByte = buf[pos++];
  if (lo |= (middleByte & 15) << 28, hi = (middleByte & 112) >> 4, (middleByte & 128) == 0) {
    this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
    return;
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    let b = buf[pos++];
    if (hi |= (b & 127) << shift, (b & 128) == 0) {
      this.pos = pos, this.assertBounds(), this.varint64Lo = lo, this.varint64Hi = hi;
      return;
    }
  }
  throw new Error("invalid varint");
}
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  let minus = dec[0] === "-";
  minus && (dec = dec.slice(1));
  let base = 1e6, lowBits = 0, highBits = 0;
  function add1e6digit(begin, end) {
    let digit1e6 = Number(dec.slice(begin, end));
    highBits *= base, lowBits = lowBits * base + digit1e6, lowBits >= TWO_PWR_32_DBL && (highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0), lowBits = lowBits % TWO_PWR_32_DBL);
  }
  return add1e6digit(-24, -18), add1e6digit(-18, -12), add1e6digit(-12, -6), add1e6digit(-6), minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi), negative = bits.hi & 2147483648;
  negative && (bits = negate(bits.lo, bits.hi));
  let result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  if ({ lo, hi } = toUnsigned(lo, hi), hi <= 2097151)
    return String(TWO_PWR_32_DBL * hi + lo);
  let low = lo & 16777215, mid = (lo >>> 24 | hi << 8) & 16777215, high = hi >> 16 & 65535, digitA = low + mid * 6777216 + high * 6710656, digitB = mid + high * 8147497, digitC = high * 2, base = 1e7;
  return digitA >= base && (digitB += Math.floor(digitA / base), digitA %= base), digitB >= base && (digitC += Math.floor(digitB / base), digitB %= base), digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  return highBits = ~highBits, lowBits ? lowBits = ~lowBits + 1 : highBits += 1, newBits(lowBits, highBits);
}
var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
  let partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
};
function varint32write(value, bytes) {
  if (value >>> 0 < 128) {
    bytes.push(value);
    return;
  }
  if (value >= 0) {
    for (; value > 127; )
      bytes.push(value & 127 | 128), value = value >>> 7;
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++)
      bytes.push(value & 127 | 128), value = value >> 7;
    bytes.push(1);
  }
}
function varint32read() {
  let b = this.buf[this.pos++];
  if ((b & 128) === 0)
    return this.assertBounds(), b;
  let result = b & 127;
  if (b = this.buf[this.pos++], result |= (b & 127) << 7, (b & 128) === 0)
    return this.assertBounds(), result;
  if (b = this.buf[this.pos++], result |= (b & 127) << 14, (b & 128) === 0)
    return this.assertBounds(), result;
  if (b = this.buf[this.pos++], result |= (b & 127) << 21, (b & 128) === 0)
    return this.assertBounds(), result;
  b = this.buf[this.pos++], result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) !== 0)
    throw new Error("invalid varint");
  return this.assertBounds(), result >>> 0;
}

// node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
var protoInt64 = /* @__PURE__ */ makeInt64Support();
function makeInt64Support() {
  let dv = new DataView(new ArrayBuffer(8));
  if (typeof BigInt == "function" && typeof dv.getBigInt64 == "function" && typeof dv.getBigUint64 == "function" && typeof dv.setBigInt64 == "function" && typeof dv.setBigUint64 == "function" && (!!globalThis.Deno || !!globalThis.Bun || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1")) {
    let MIN = BigInt("-9223372036854775808"), MAX = BigInt("9223372036854775807"), UMIN = BigInt("0"), UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: !0,
      parse(value) {
        let bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN)
          throw new Error(`invalid int64: ${value}`);
        return bi;
      },
      uParse(value) {
        let bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN)
          throw new Error(`invalid uint64: ${value}`);
        return bi;
      },
      enc(value) {
        return dv.setBigInt64(0, this.parse(value), !0), {
          lo: dv.getInt32(0, !0),
          hi: dv.getInt32(4, !0)
        };
      },
      uEnc(value) {
        return dv.setBigInt64(0, this.uParse(value), !0), {
          lo: dv.getInt32(0, !0),
          hi: dv.getInt32(4, !0)
        };
      },
      dec(lo, hi) {
        return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigInt64(0, !0);
      },
      uDec(lo, hi) {
        return dv.setInt32(0, lo, !0), dv.setInt32(4, hi, !0), dv.getBigUint64(0, !0);
      }
    };
  }
  return {
    zero: "0",
    supported: !1,
    parse(value) {
      return typeof value != "string" && (value = value.toString()), assertInt64String(value), value;
    },
    uParse(value) {
      return typeof value != "string" && (value = value.toString()), assertUInt64String(value), value;
    },
    enc(value) {
      return typeof value != "string" && (value = value.toString()), assertInt64String(value), int64FromString(value);
    },
    uEnc(value) {
      return typeof value != "string" && (value = value.toString()), assertUInt64String(value), int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
function assertInt64String(value) {
  if (!/^-?[0-9]+$/.test(value))
    throw new Error("invalid int64: " + value);
}
function assertUInt64String(value) {
  if (!/^[0-9]+$/.test(value))
    throw new Error("invalid uint64: " + value);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js
function scalarZeroValue(type, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return "";
    case ScalarType.BOOL:
      return !1;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return 0;
    case ScalarType.INT64:
    case ScalarType.UINT64:
    case ScalarType.SFIXED64:
    case ScalarType.FIXED64:
    case ScalarType.SINT64:
      return longAsString ? "0" : protoInt64.zero;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    default:
      return 0;
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js
function unsafeIsSetExplicit(target, localName) {
  return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== void 0;
}
function setOwn(obj, key2, value) {
  key2 === "__proto__" ? Object.defineProperty(obj, "__proto__", {
    value,
    writable: !0,
    enumerable: !0,
    configurable: !0
  }) : obj[key2] = value;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js
function isObject(arg) {
  return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}

// node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js
function isWrapperDesc(messageDesc2) {
  let f = messageDesc2.fields[0];
  return isWrapperTypeName(messageDesc2.typeName) && f !== void 0 && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
}
var wrapperTypeNames = /* @__PURE__ */ new Set([
  "google.protobuf.DoubleValue",
  "google.protobuf.FloatValue",
  "google.protobuf.Int64Value",
  "google.protobuf.UInt64Value",
  "google.protobuf.Int32Value",
  "google.protobuf.UInt32Value",
  "google.protobuf.BoolValue",
  "google.protobuf.StringValue",
  "google.protobuf.BytesValue"
]);
function isWrapperTypeName(name) {
  return wrapperTypeNames.has(name);
}

// node_modules/@bufbuild/protobuf/dist/esm/create.js
var EDITION_PROTO3 = 999, EDITION_PROTO2 = 998, IMPLICIT = 2;
function create(schema, init) {
  return isMessage(init, schema) ? init : compiledCreate(schema)(init);
}
var compiledCreates = /* @__PURE__ */ new WeakMap();
function compiledCreate(desc) {
  let compiled = compiledCreates.get(desc);
  return compiled === void 0 && (compiled = compileCreate(desc), compiledCreates.set(desc, compiled)), compiled;
}
var INIT_SINGULAR = 0, INIT_LIST = 1, INIT_MAP = 2, INIT_ONEOF = 3;
function compileCreate(desc) {
  let typeName = desc.typeName, { properties, prototype } = compileInitMessage(desc);
  return (init) => {
    let message;
    prototype !== void 0 ? (message = Object.create(prototype), message.$typeName = typeName) : message = { $typeName: typeName };
    for (let i = 0; i < properties.length; i++) {
      let property = properties[i], name = property.name, initValue = init?.[name];
      switch (property.kind) {
        case INIT_SINGULAR:
          initValue != null ? message[name] = property.convert !== void 0 ? property.convert(initValue) : initValue : property.constant !== void 0 && (message[name] = property.constant);
          break;
        case INIT_LIST:
          message[name] = property.convert !== void 0 && Array.isArray(initValue) ? initValue.map(property.convert) : initValue ?? [];
          break;
        case INIT_MAP:
          if (property.convert === void 0 || !isObject(initValue))
            message[name] = initValue ?? {};
          else {
            let converted = {}, keys = Object.keys(initValue);
            for (let k = 0; k < keys.length; k++)
              setOwn(converted, keys[k], property.convert(initValue[keys[k]]));
            message[name] = converted;
          }
          break;
        case INIT_ONEOF: {
          let oneofValue = initValue;
          if (oneofValue?.case != null) {
            let convert = property.convert.get(oneofValue.case);
            if (convert !== void 0) {
              message[name] = {
                case: oneofValue.case,
                value: convert(oneofValue.value)
              };
              break;
            }
          }
          message[name] = { case: void 0 };
          break;
        }
      }
    }
    return message;
  };
}
function compileInitMessage(desc) {
  var _a, _b;
  let properties = [], prototype = {}, usePrototype = needsPrototypeChain(desc);
  for (let member of desc.members) {
    let name = member.localName;
    if (member.kind == "oneof") {
      properties.push({
        name,
        kind: INIT_ONEOF,
        constant: void 0,
        convert: compileConvertOneof(member)
      });
      continue;
    }
    switch (member.fieldKind) {
      case "message": {
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: void 0,
          convert: compileConvertMessage(member)
        });
        break;
      }
      case "list": {
        properties.push({
          name,
          kind: INIT_LIST,
          constant: void 0,
          convert: member.listKind == "message" ? (_a = compileConvertMessage(member)) !== null && _a !== void 0 ? _a : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      case "map": {
        properties.push({
          name,
          kind: INIT_MAP,
          constant: void 0,
          convert: member.mapKind == "message" ? (_b = compileConvertMessage(member)) !== null && _b !== void 0 ? _b : ((value) => value) : member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        });
        break;
      }
      default: {
        let zeroValue = createZeroValue(member);
        properties.push({
          name,
          kind: INIT_SINGULAR,
          constant: member.presence == IMPLICIT ? zeroValue : void 0,
          convert: member.fieldKind == "scalar" && member.scalar == ScalarType.BYTES ? toU8Arr : void 0
        }), usePrototype && (prototype[name] = zeroValue);
        break;
      }
    }
  }
  return {
    properties,
    prototype: usePrototype ? prototype : void 0
  };
}
function compileConvertOneof(oneof) {
  let converters = /* @__PURE__ */ new Map();
  for (let field of oneof.fields) {
    let convert;
    field.fieldKind == "message" ? convert = compileConvertMessage(field) : field.fieldKind == "scalar" && field.scalar == ScalarType.BYTES && (convert = toU8Arr), converters.set(field.localName, convert ?? ((value) => value));
  }
  return converters;
}
function compileConvertMessage(field) {
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message))
    return field.message.fields[0].scalar == ScalarType.BYTES ? toU8Arr : void 0;
  if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value")
    return;
  let messageDesc2 = field.message, compiled;
  return (value) => !isObject(value) || isMessage(value, messageDesc2) ? value : (compiled ?? (compiled = compiledCreate(messageDesc2)), compiled(value));
}
function toU8Arr(value) {
  return Array.isArray(value) ? new Uint8Array(value) : value;
}
function needsPrototypeChain(desc) {
  switch (desc.file.edition) {
    case EDITION_PROTO3:
      return !1;
    case EDITION_PROTO2:
      return !0;
    default:
      return desc.fields.some((f) => f.presence != IMPLICIT && f.fieldKind != "message" && !f.oneof);
  }
}
function createZeroValue(field) {
  let defaultValue = field.getDefaultValue();
  return defaultValue !== void 0 ? field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue : field.fieldKind == "scalar" ? scalarZeroValue(field.scalar, field.longAsString) : field.enum.values[0].number;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js
var FieldError = class extends Error {
  constructor(fieldOrOneof, message, name = "FieldValueInvalidError") {
    super(message), this.name = name, this.field = () => fieldOrOneof;
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js
var te;
function configureTextEncoding(textEncoding) {
  var _a;
  te = Object.assign(Object.assign({}, textEncoding), { encodeUtf8Into: (_a = textEncoding.encodeUtf8Into) !== null && _a !== void 0 ? _a : emulateEncodeInto(textEncoding.encodeUtf8.bind(textEncoding)) });
}
function getTextEncoding() {
  if (!te) {
    let globals = globalThis;
    if (!globals.TextEncoder || !globals.TextDecoder)
      throw new Error("encoding API missing: install TextEncoder and TextDecoder on globalThis");
    let textEncoder = new globals.TextEncoder(), textDecoder = new globals.TextDecoder("utf-8", {
      ignoreBOM: !0
    }), textDecoderStrict, config = {
      encodeUtf8(text) {
        return textEncoder.encode(text);
      },
      decodeUtf8(bytes, strict) {
        return strict ? (textDecoderStrict || (textDecoderStrict = new globals.TextDecoder("utf-8", {
          fatal: !0,
          ignoreBOM: !0
        })), textDecoderStrict.decode(bytes)) : textDecoder.decode(bytes);
      },
      checkUtf8(text) {
        try {
          return encodeURIComponent(text), !0;
        } catch {
          return !1;
        }
      }
    };
    textEncoder.encodeInto && (config.encodeUtf8Into = textEncoder.encodeInto.bind(textEncoder));
    let nativeStringIsWellFormed = String.prototype.isWellFormed;
    nativeStringIsWellFormed && (config.checkUtf8 = (text) => nativeStringIsWellFormed.call(text)), configureTextEncoding(config);
  }
  return te;
}
function emulateEncodeInto(encodeUtf8) {
  return (text, dest) => {
    let bytes = encodeUtf8(text);
    return dest.set(bytes), { written: bytes.byteLength };
  };
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2.Varint = 0] = "Varint", WireType2[WireType2.Bit64 = 1] = "Bit64", WireType2[WireType2.LengthDelimited = 2] = "LengthDelimited", WireType2[WireType2.StartGroup = 3] = "StartGroup", WireType2[WireType2.EndGroup = 4] = "EndGroup", WireType2[WireType2.Bit32 = 5] = "Bit32";
})(WireType || (WireType = {}));
var UINT32_MAX = 4294967295, INT32_MAX = 2147483647, INT32_MIN = -2147483648, BinaryWriter = class {
  constructor(encodeUtf8) {
    this.stackPos = [], this.encodeUtf8Into = encodeUtf8 ? emulateEncodeInto(encodeUtf8) : getTextEncoding().encodeUtf8Into, this.buffer = EMPTY_BUFFER, this.viewCache = EMPTY_VIEW, this.pos = 0;
  }
  ensureCapacity(size) {
    let required = this.pos + size;
    if (required > this.buffer.length) {
      let newLen = this.buffer.length || INITIAL_SIZE;
      for (; newLen < required; )
        newLen *= 2;
      let newBuf = new Uint8Array(newLen);
      this.pos > 0 && newBuf.set(this.buffer), this.buffer = newBuf;
    }
  }
  /**
   * The DataView over `buffer`, rebuilt only if the buffer has grown since it
   * was last used.
   */
  view() {
    let bytes = this.buffer, view = this.viewCache;
    if (view.byteLength === bytes.byteLength)
      return view;
    let newView = new DataView(bytes.buffer);
    return this.viewCache = newView, newView;
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    let result = this.buffer.slice(0, this.pos);
    return this.pos = 0, this.stackPos = [], result;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    return this.stackPos.push(this.pos), this.ensureCapacity(DEFAULT_LEN_PREFIX_SIZE), this.buffer[this.pos++] = 0, this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let forkPos = this.stackPos.pop();
    if (forkPos === void 0)
      throw new Error("invalid state, fork stack empty");
    let len = this.pos - forkPos - DEFAULT_LEN_PREFIX_SIZE, lenPrefixSize = varint32Size(len);
    return lenPrefixSize > DEFAULT_LEN_PREFIX_SIZE && (this.ensureCapacity(lenPrefixSize - DEFAULT_LEN_PREFIX_SIZE), this.buffer.copyWithin(forkPos + lenPrefixSize, forkPos + DEFAULT_LEN_PREFIX_SIZE, this.pos)), this.pos = forkPos, this.uint32(len), this.pos += len, this;
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    return this.ensureCapacity(chunk.length), this.buffer.set(chunk, this.pos), this.pos += chunk.length, this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    if (assertUInt32(value), this.ensureCapacity(5), value < 128)
      return this.buffer[this.pos++] = value, this;
    for (; value > 127; )
      this.buffer[this.pos++] = value & 127 | 128, value >>>= 7;
    return this.buffer[this.pos++] = value, this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    if (assertInt32(value), value >= 0)
      return this.uint32(value);
    this.ensureCapacity(10);
    for (let i = 0; i < 9; i++)
      this.buffer[this.pos++] = value & 127 | 128, value >>= 7;
    return this.buffer[this.pos++] = 1, this;
  }
  /**
   * Write a `bool` value, a varint.
   */
  bool(value) {
    return this.ensureCapacity(1), this.buffer[this.pos++] = value ? 1 : 0, this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    return this.uint32(value.byteLength), this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    typeof value != "string" && (value = String(value));
    let len = value.length;
    if (len <= ASCII_MAX_LENGTH) {
      this.ensureCapacity(len + 1);
      let ascii = this.buffer, pos = this.pos;
      ascii[pos++] = len;
      let i = 0;
      for (; i < len; i++) {
        let code = value.charCodeAt(i);
        if (code > 127)
          break;
        ascii[pos++] = code;
      }
      if (i == len)
        return this.pos = pos, this;
    }
    this.ensureCapacity(len * 3 + 5);
    let lenPrefixSizeGuess = varint32Size(len), buf = this.buffer, start = this.pos, { written } = this.encodeUtf8Into(value, buf.subarray(start + lenPrefixSizeGuess)), lenPrefixSize = varint32Size(written);
    return lenPrefixSize != lenPrefixSizeGuess && buf.copyWithin(start + lenPrefixSize, start + lenPrefixSizeGuess, start + lenPrefixSizeGuess + written), this.uint32(written), this.pos += written, this;
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    return assertFloat32(value), this.ensureCapacity(4), this.view().setFloat32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    return this.ensureCapacity(8), this.view().setFloat64(this.pos, value, !0), this.pos += 8, this;
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    return assertUInt32(value), this.ensureCapacity(4), this.view().setUint32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    return assertInt32(value), this.ensureCapacity(4), this.view().setInt32(this.pos, value, !0), this.pos += 4, this;
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    return assertInt32(value), this.uint32((value << 1 ^ value >> 31) >>> 0);
  }
  /**
   * Write a `sfixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    let tc = protoInt64.enc(value);
    this.ensureCapacity(8);
    let view = this.view();
    return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    let tc = protoInt64.uEnc(value);
    this.ensureCapacity(8);
    let view = this.view();
    return view.setInt32(this.pos, tc.lo, !0), view.setInt32(this.pos + 4, tc.hi, !0), this.pos += 8, this;
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    let tc = protoInt64.enc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    let tc = protoInt64.enc(value), sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
    return this.writeVarint64(lo, hi);
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    let tc = protoInt64.uEnc(value);
    return this.writeVarint64(tc.lo, tc.hi);
  }
  /**
   * Write a 64-bit varint directly into the buffer. Accepts the value as
   * split low/high 32-bit words.
   *
   * Ported from varint64write() to avoid the intermediate number[] buffer.
   * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/writer.js#L344
   */
  writeVarint64(lo, hi) {
    this.ensureCapacity(10);
    let buf = this.buffer, pos = this.pos;
    for (let i = 0; i < 28; i = i + 7) {
      let shift = lo >>> i, hasNext = !(!(shift >>> 7) && hi == 0);
      if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
        return this.pos = pos, this;
    }
    let splitBits = lo >>> 28 & 15 | (hi & 7) << 4, hasMoreBits = hi >> 3 != 0;
    if (buf[pos++] = (hasMoreBits ? splitBits | 128 : splitBits) & 255, !hasMoreBits)
      return this.pos = pos, this;
    for (let i = 3; i < 31; i = i + 7) {
      let shift = hi >>> i, hasNext = !!(shift >>> 7);
      if (buf[pos++] = (hasNext ? shift | 128 : shift) & 255, !hasNext)
        return this.pos = pos, this;
    }
    return buf[pos++] = hi >>> 31 & 1, this.pos = pos, this;
  }
}, INITIAL_SIZE = 128, DEFAULT_LEN_PREFIX_SIZE = 1, EMPTY_BUFFER = new Uint8Array(0), EMPTY_VIEW = new DataView(EMPTY_BUFFER.buffer), ASCII_MAX_LENGTH = 32;
function varint32Size(value) {
  return value < 128 ? 1 : value < 16384 ? 2 : value < 2097152 ? 3 : value < 268435456 ? 4 : 5;
}
var BinaryReader = class {
  constructor(buf, decodeUtf8 = getTextEncoding().decodeUtf8) {
    this.decodeUtf8 = decodeUtf8, this.varint64Lo = 0, this.varint64Hi = 0, this.varint64 = varint64read, this.uint32 = varint32read, this.buf = buf, this.len = buf.length, this.pos = 0, this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /**
   * Reads a tag - field number and wire type. Tags are uint32 varints; values
   * that do not fit in uint32 are rejected.
   */
  tag() {
    let start = this.pos, tag = this.uint32(), bytesRead = this.pos - start;
    if (bytesRead > 5 || bytesRead == 5 && this.buf[this.pos - 1] > 15)
      throw new Error("illegal tag: varint overflows uint32");
    let fieldNo = tag >>> 3, wireType = tag & 7;
    if (fieldNo <= 0 || wireType > 5)
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag. Recursion into nested groups
   * is guarded by the `recursionLimit` argument: When the limit is reached,
   * this method throws.
   */
  skip(wireType, fieldNo, recursionLimit = 100) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        for (; this.buf[this.pos++] & 128; )
          ;
        break;
      // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
      case WireType.Bit64:
        this.pos += 4;
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        if (recursionLimit <= 0)
          throw new Error("maximum recursion depth reached");
        for (; ; ) {
          let [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo)
              throw new Error("invalid end group tag");
            break;
          }
          this.skip(wt, fn, recursionLimit - 1);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    return this.assertBounds(), this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return this.varint64(), protoInt64.dec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return this.varint64(), protoInt64.uDec(this.varint64Lo, this.varint64Hi);
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    this.varint64();
    let lo = this.varint64Lo, hi = this.varint64Hi, s = -(lo & 1);
    return lo = (lo >>> 1 | (hi & 1) << 31) ^ s, hi = hi >>> 1 ^ s, protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let b = this.buf[this.pos];
    return b < 128 ? (this.pos++, b !== 0) : (this.varint64(), this.varint64Lo !== 0 || this.varint64Hi !== 0);
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, !0);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, !0);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    return this.pos += len, this.assertBounds(), this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text. If
   * `strict` is true, throw on invalid UTF-8 instead of substituting U+FFFD.
   */
  string(strict) {
    let len = this.uint32(), start = this.pos;
    this.pos += len, this.assertBounds();
    let buf = this.buf;
    if (len <= ASCII_MAX_LENGTH) {
      let codes = new Array(len);
      for (let i = 0; i < len; i++) {
        let byte = buf[start + i];
        if (byte > 127)
          return this.decodeUtf8(buf.subarray(start, this.pos), strict);
        codes[i] = byte;
      }
      return String.fromCharCode.apply(String, codes);
    }
    return this.decodeUtf8(buf.subarray(start, this.pos), strict);
  }
};
function assertInt32(arg) {
  if (typeof arg == "string")
    arg = Number(arg);
  else if (typeof arg != "number")
    throw new Error("invalid int32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg == "string")
    arg = Number(arg);
  else if (typeof arg != "number")
    throw new Error("invalid uint32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg == "string") {
    let o = arg;
    if (arg = Number(arg), Number.isNaN(arg) && o !== "NaN")
      throw new Error("invalid float32: " + o);
  } else if (typeof arg != "number")
    throw new Error("invalid float32: " + typeof arg);
  if (!Number.isFinite(Math.fround(arg)) && Number.isFinite(arg))
    throw new Error("invalid float32: " + arg);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/message.js
var NULL_VALUE = 0;
function localMessageMapper(field) {
  if (usesJsonRepresentation(field))
    return {
      toMessage: (local) => wktStructToReflect(local),
      toLocal: (message) => wktStructToLocal(message)
    };
  if (field.fieldKind == "message" && !field.oneof && isWrapperDesc(field.message)) {
    let wrapperDesc = field.message, valueLocalName = wrapperDesc.fields[0].localName;
    return {
      toMessage: (local) => {
        let message = create(wrapperDesc);
        return local !== void 0 && (message[valueLocalName] = local), message;
      },
      toLocal: (message) => message[valueLocalName]
    };
  }
  let childDesc = field.message;
  return {
    toMessage: (local) => local === void 0 ? create(childDesc) : local,
    toLocal: (message) => message
  };
}
function usesJsonRepresentation(field) {
  return field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value";
}
function wktStructToReflect(json) {
  let struct = {
    $typeName: "google.protobuf.Struct",
    fields: {}
  };
  if (isObject(json))
    for (let k of Object.keys(json))
      setOwn(struct.fields, k, wktValueToReflect(json[k]));
  return struct;
}
function wktStructToLocal(val) {
  let json = {};
  for (let k of Object.keys(val.fields))
    setOwn(json, k, wktValueToLocal(val.fields[k]));
  return json;
}
function wktValueToLocal(val) {
  switch (val.kind.case) {
    case "structValue":
      return wktStructToLocal(val.kind.value);
    case "listValue":
      return val.kind.value.values.map(wktValueToLocal);
    case "nullValue":
    case void 0:
      return null;
    default:
      return val.kind.value;
  }
}
function wktValueToReflect(json) {
  let value = {
    $typeName: "google.protobuf.Value",
    kind: { case: void 0 }
  };
  switch (typeof json) {
    case "number":
      value.kind = { case: "numberValue", value: json };
      break;
    case "string":
      value.kind = { case: "stringValue", value: json };
      break;
    case "boolean":
      value.kind = { case: "boolValue", value: json };
      break;
    case "object":
      if (json === null)
        value.kind = { case: "nullValue", value: NULL_VALUE };
      else if (Array.isArray(json)) {
        let listValue = {
          $typeName: "google.protobuf.ListValue",
          values: []
        };
        if (Array.isArray(json))
          for (let e of json)
            listValue.values.push(wktValueToReflect(e));
        value.kind = {
          case: "listValue",
          value: listValue
        };
      } else
        value.kind = {
          case: "structValue",
          value: wktStructToReflect(json)
        };
      break;
  }
  return value;
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js
var nativeSetFromBase64 = Uint8Array.prototype.setFromBase64;
function base64Decode(base64Str) {
  let len = base64Str.length, size = len - (len + 3 >> 2);
  (len & 3) == 0 && base64Str[len - 1] == "=" && (size -= base64Str[len - 2] == "=" ? 2 : 1);
  let bytes = new Uint8Array(size), written = -1;
  if (nativeSetFromBase64)
    try {
      let result = nativeSetFromBase64.call(bytes, base64Str);
      result.read == len && (written = result.written);
    } catch {
    }
  return written < 0 && (written = setFromBase64(bytes, base64Str)), written == size ? bytes : bytes.subarray(0, written);
}
function setFromBase64(bytes, base64Str) {
  let table = getDecodeTable(), bytePos = 0, groupPos = 0, b, p = 0;
  for (let i = 0; i < base64Str.length; i++) {
    if (b = table[base64Str.charCodeAt(i)], b === void 0)
      switch (base64Str[i]) {
        // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
        case "=":
          groupPos = 0;
        // reset state when padding found
        case `
`:
        case "\r":
        case "	":
        case " ":
          continue;
        // skip white-space, and padding
        default:
          throw Error("invalid base64 string");
      }
    switch (groupPos) {
      case 0:
        p = b, groupPos = 1;
        break;
      case 1:
        bytes[bytePos++] = p << 2 | (b & 48) >> 4, p = b, groupPos = 2;
        break;
      case 2:
        bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2, p = b, groupPos = 3;
        break;
      case 3:
        bytes[bytePos++] = (p & 3) << 6 | b, groupPos = 0;
        break;
    }
  }
  if (groupPos == 1)
    throw Error("invalid base64 string");
  return bytePos;
}
var nativeToBase64 = Uint8Array.prototype.toBase64;
var encodeTableStd, encodeTableUrl, decodeTable;
function getEncodeTable(encoding) {
  return encodeTableStd || (encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(""), encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_")), encoding == "url" ? (
    // biome-ignore lint/style/noNonNullAssertion: TS fails to narrow down
    encodeTableUrl
  ) : encodeTableStd;
}
function getDecodeTable() {
  if (!decodeTable) {
    decodeTable = [];
    let encodeTable = getEncodeTable("std");
    for (let i = 0; i < encodeTable.length; i++)
      decodeTable[encodeTable[i].charCodeAt(0)] = i;
    decodeTable[45] = encodeTable.indexOf("+"), decodeTable[95] = encodeTable.indexOf("/");
  }
  return decodeTable;
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js
function protoCamelCase(snakeCase) {
  let capNext = !1, b = [];
  for (let i = 0; i < snakeCase.length; i++) {
    let c = snakeCase.charAt(i);
    switch (c) {
      case "_":
        capNext = !0;
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        b.push(c), capNext = !1;
        break;
      default:
        capNext && (capNext = !1, c = c.toUpperCase()), b.push(c);
        break;
    }
  }
  return b.join("");
}
var reservedObjectProperties = /* @__PURE__ */ new Set([
  // names reserved by JavaScript
  "constructor",
  "toString",
  "toJSON",
  "valueOf"
]);
function safeObjectProperty(name) {
  return reservedObjectProperties.has(name) ? name + "$" : name;
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js
function restoreJsonNames(message) {
  for (let f of message.field)
    unsafeIsSetExplicit(f, "jsonName") || (f.jsonName = protoCamelCase(f.name));
  message.nestedType.forEach(restoreJsonNames);
}

// node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js
function parseTextFormatEnumValue(descEnum, value) {
  let enumValue = descEnum.values.find((v) => v.name === value);
  if (!enumValue)
    throw new Error(`cannot parse ${descEnum} default value: ${value}`);
  return enumValue.number;
}
function parseTextFormatScalarValue(type, value) {
  switch (type) {
    case ScalarType.STRING:
      return value;
    case ScalarType.BYTES: {
      let u = unescapeBytesDefaultValue(value);
      if (u === !1)
        throw new Error(`cannot parse ${ScalarType[type]} default value: ${value}`);
      return u;
    }
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return protoInt64.parse(value);
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return protoInt64.uParse(value);
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      switch (value) {
        case "inf":
          return Number.POSITIVE_INFINITY;
        case "-inf":
          return Number.NEGATIVE_INFINITY;
        case "nan":
          return Number.NaN;
        default:
          return parseFloat(value);
      }
    case ScalarType.BOOL:
      return value === "true";
    case ScalarType.INT32:
    case ScalarType.UINT32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
      return parseInt(value, 10);
  }
}
function unescapeBytesDefaultValue(str) {
  let b = [], input = {
    tail: str,
    c: "",
    next() {
      return this.tail.length == 0 ? !1 : (this.c = this.tail[0], this.tail = this.tail.substring(1), !0);
    },
    take(n) {
      if (this.tail.length >= n) {
        let r = this.tail.substring(0, n);
        return this.tail = this.tail.substring(n), r;
      }
      return !1;
    }
  };
  for (; input.next(); )
    switch (input.c) {
      case "\\":
        if (input.next())
          switch (input.c) {
            case "\\":
              b.push(input.c.charCodeAt(0));
              break;
            case "b":
              b.push(8);
              break;
            case "f":
              b.push(12);
              break;
            case "n":
              b.push(10);
              break;
            case "r":
              b.push(13);
              break;
            case "t":
              b.push(9);
              break;
            case "v":
              b.push(11);
              break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7": {
              let s = input.c, t = input.take(2);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 8);
              if (Number.isNaN(n))
                return !1;
              b.push(n);
              break;
            }
            case "x": {
              let s = input.c, t = input.take(2);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 16);
              if (Number.isNaN(n))
                return !1;
              b.push(n);
              break;
            }
            case "u": {
              let s = input.c, t = input.take(4);
              if (t === !1)
                return !1;
              let n = parseInt(s + t, 16);
              if (Number.isNaN(n))
                return !1;
              let chunk = new Uint8Array(4);
              new DataView(chunk.buffer).setInt32(0, n, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
              break;
            }
            case "U": {
              let s = input.c, t = input.take(8);
              if (t === !1)
                return !1;
              let tc = protoInt64.uEnc(s + t), chunk = new Uint8Array(8), view = new DataView(chunk.buffer);
              view.setInt32(0, tc.lo, !0), view.setInt32(4, tc.hi, !0), b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
              break;
            }
          }
        break;
      default:
        b.push(input.c.charCodeAt(0));
    }
  return new Uint8Array(b);
}

// node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js
function* nestedTypes(desc) {
  switch (desc.kind) {
    case "file":
      for (let message of desc.messages)
        yield message, yield* nestedTypes(message);
      yield* desc.enums, yield* desc.services, yield* desc.extensions;
      break;
    case "message":
      for (let message of desc.nestedMessages)
        yield message, yield* nestedTypes(message);
      yield* desc.nestedEnums, yield* desc.nestedExtensions;
      break;
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/registry.js
function createEmbeddedFileRegistry(fileDescriptorProto, resolve) {
  return buildFileRegistry([fileDescriptorProto, resolve]);
}
function buildFileRegistry(args, check) {
  let registry = createBaseRegistry();
  if (!args.length)
    return registry;
  if ("$typeName" in args[0] && args[0].$typeName == "google.protobuf.FileDescriptorSet") {
    for (let file of args[0].file)
      check?.(file), addFile(file, registry);
    return registry;
  }
  if ("$typeName" in args[0]) {
    let recurseDeps = function(file) {
      let deps = [];
      for (let protoFileName of file.dependency) {
        if (registry.getFile(protoFileName) != null || seen.has(protoFileName))
          continue;
        let dep = resolve(protoFileName);
        if (!dep)
          throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
        "kind" in dep ? registry.addFile(dep, !1, !0) : (seen.add(dep.name), deps.push(dep));
      }
      return deps.concat(...deps.map(recurseDeps));
    }, input = args[0], resolve = args[1], seen = /* @__PURE__ */ new Set();
    for (let file of [input, ...recurseDeps(input)].reverse())
      check?.(file), addFile(file, registry);
  } else
    for (let fileReg of args)
      for (let file of fileReg.files)
        registry.addFile(file);
  return registry;
}
function createBaseRegistry() {
  let types = /* @__PURE__ */ new Map(), extendees = /* @__PURE__ */ new Map(), files = /* @__PURE__ */ new Map();
  return {
    kind: "registry",
    types,
    extendees,
    [Symbol.iterator]() {
      return types.values();
    },
    get files() {
      return files.values();
    },
    addFile(file, skipTypes, withDeps) {
      if (files.set(file.proto.name, file), !skipTypes)
        for (let type of nestedTypes(file))
          this.add(type);
      if (withDeps)
        for (let f of file.dependencies)
          this.addFile(f, skipTypes, withDeps);
    },
    add(desc) {
      if (desc.kind == "extension") {
        let numberToExt = extendees.get(desc.extendee.typeName);
        numberToExt || extendees.set(
          desc.extendee.typeName,
          // biome-ignore lint/suspicious/noAssignInExpressions: no
          numberToExt = /* @__PURE__ */ new Map()
        ), numberToExt.set(desc.number, desc);
      }
      types.set(desc.typeName, desc);
    },
    get(typeName) {
      return types.get(typeName);
    },
    getFile(fileName) {
      return files.get(fileName);
    },
    getMessage(typeName) {
      let t = types.get(typeName);
      return t?.kind == "message" ? t : void 0;
    },
    getEnum(typeName) {
      let t = types.get(typeName);
      return t?.kind == "enum" ? t : void 0;
    },
    getExtension(typeName) {
      let t = types.get(typeName);
      return t?.kind == "extension" ? t : void 0;
    },
    getExtensionFor(extendee, no) {
      var _a;
      return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
    },
    getService(typeName) {
      let t = types.get(typeName);
      return t?.kind == "service" ? t : void 0;
    }
  };
}
var EDITION_PROTO22 = 998, EDITION_PROTO32 = 999, EDITION_UNSTABLE = 9999, TYPE_STRING = 9, TYPE_GROUP = 10, TYPE_MESSAGE = 11, TYPE_BYTES = 12, TYPE_ENUM = 14, LABEL_REPEATED = 3, LABEL_REQUIRED = 2, JS_STRING = 1, IDEMPOTENCY_UNKNOWN = 0, EXPLICIT = 1, IMPLICIT2 = 2, LEGACY_REQUIRED = 3, PACKED = 1, DELIMITED = 2, OPEN = 1, VERIFY = 2;
var maximumEdition = 1002, featureDefaults = {
  // EDITION_PROTO2
  998: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 2,
    // CLOSED,
    repeatedFieldEncoding: 2,
    // EXPANDED,
    utf8Validation: 3,
    // NONE,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 2,
    // LEGACY_BEST_EFFORT,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_PROTO3
  999: {
    fieldPresence: 2,
    // IMPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2023
  1e3: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 2,
    // STYLE_LEGACY,
    defaultSymbolVisibility: 1,
    // EXPORT_ALL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2024
  1001: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 1,
    // STYLE2024,
    defaultSymbolVisibility: 2,
    // EXPORT_TOP_LEVEL,
    enforceProtoLimits: 1
    // LEGACY_NO_EXPLICIT_LIMITS,
  },
  // EDITION_2026
  1002: {
    fieldPresence: 1,
    // EXPLICIT,
    enumType: 1,
    // OPEN,
    repeatedFieldEncoding: 1,
    // PACKED,
    utf8Validation: 2,
    // VERIFY,
    messageEncoding: 1,
    // LENGTH_PREFIXED,
    jsonFormat: 1,
    // ALLOW,
    enforceNamingStyle: 3,
    // STYLE2026,
    defaultSymbolVisibility: 4,
    // STRICT,
    enforceProtoLimits: 2
    // PROTO_LIMITS2026,
  }
};
function addFile(proto, reg) {
  var _a, _b;
  let file = {
    kind: "file",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    edition: getFileEdition(proto),
    name: proto.name.replace(/\.proto$/, ""),
    dependencies: findFileDependencies(proto, reg),
    enums: [],
    messages: [],
    extensions: [],
    services: [],
    toString() {
      return `file ${proto.name}`;
    }
  }, mapEntriesStore = /* @__PURE__ */ new Map(), mapEntries = {
    get(typeName) {
      return mapEntriesStore.get(typeName);
    },
    add(desc) {
      var _a2;
      assert(((_a2 = desc.proto.options) === null || _a2 === void 0 ? void 0 : _a2.mapEntry) === !0), mapEntriesStore.set(desc.typeName, desc);
    }
  };
  for (let enumProto of proto.enumType)
    addEnum(enumProto, file, void 0, reg);
  for (let messageProto of proto.messageType)
    addMessage(messageProto, file, void 0, reg, mapEntries);
  for (let serviceProto of proto.service)
    addService(serviceProto, file, reg);
  addExtensions(file, reg);
  for (let mapEntry of mapEntriesStore.values())
    addFields(mapEntry, reg, mapEntries);
  for (let message of file.messages)
    addFields(message, reg, mapEntries), addExtensions(message, reg);
  reg.addFile(file, !0);
}
function addExtensions(desc, reg) {
  switch (desc.kind) {
    case "file":
      for (let proto of desc.proto.extension) {
        let ext = newField(proto, desc, reg);
        desc.extensions.push(ext), reg.add(ext);
      }
      break;
    case "message":
      for (let proto of desc.proto.extension) {
        let ext = newField(proto, desc, reg);
        desc.nestedExtensions.push(ext), reg.add(ext);
      }
      for (let message of desc.nestedMessages)
        addExtensions(message, reg);
      break;
  }
}
function addFields(message, reg, mapEntries) {
  let allOneofs = message.proto.oneofDecl.map((proto) => newOneof(proto, message)), oneofsSeen = /* @__PURE__ */ new Set();
  for (let proto of message.proto.field) {
    let oneof = findOneof(proto, allOneofs), field = newField(proto, message, reg, oneof, mapEntries);
    message.fields.push(field), message.field[field.localName] = field, oneof === void 0 ? message.members.push(field) : (oneof.fields.push(field), oneofsSeen.has(oneof) || (oneofsSeen.add(oneof), message.members.push(oneof)));
  }
  for (let oneof of allOneofs.filter((o) => oneofsSeen.has(o)))
    message.oneofs.push(oneof);
  for (let child of message.nestedMessages)
    addFields(child, reg, mapEntries);
}
function addEnum(proto, file, parent, reg) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j;
  let sharedPrefix = findEnumSharedPrefix(proto.name, proto.value), desc = {
    kind: "enum",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    parent,
    open: !0,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    value: {},
    values: [],
    sharedPrefix,
    toString() {
      return `enum ${this.typeName}`;
    }
  };
  desc.open = isEnumOpen(desc), reg.add(desc);
  for (let p of proto.value) {
    let name = p.name, value = {
      kind: "enum_value",
      proto: p,
      deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : !1,
      parent: desc,
      name,
      localName: safeObjectProperty(sharedPrefix == null ? name : name.substring(sharedPrefix.length)),
      number: p.number,
      jsonName: (_e = findEnumValueJsonName(p)) !== null && _e !== void 0 ? _e : name,
      toString() {
        return `enum value ${desc.typeName}.${name}`;
      }
    };
    desc.values.push(value), (_f = (_h = desc.value)[_j = p.number]) !== null && _f !== void 0 || (_h[_j] = value);
  }
  ((_g = parent?.nestedEnums) !== null && _g !== void 0 ? _g : file.enums).push(desc);
}
function addMessage(proto, file, parent, reg, mapEntries) {
  var _a, _b, _c, _d;
  let desc = {
    kind: "message",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    parent,
    name: proto.name,
    typeName: makeTypeName(proto, parent, file),
    fields: [],
    field: {},
    oneofs: [],
    members: [],
    nestedEnums: [],
    nestedMessages: [],
    nestedExtensions: [],
    toString() {
      return `message ${this.typeName}`;
    }
  };
  ((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === !0 ? mapEntries.add(desc) : (((_d = parent?.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc), reg.add(desc));
  for (let enumProto of proto.enumType)
    addEnum(enumProto, file, desc, reg);
  for (let messageProto of proto.nestedType)
    addMessage(messageProto, file, desc, reg, mapEntries);
}
function addService(proto, file, reg) {
  var _a, _b;
  let desc = {
    kind: "service",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    file,
    name: proto.name,
    typeName: makeTypeName(proto, void 0, file),
    methods: [],
    method: {},
    toString() {
      return `service ${this.typeName}`;
    }
  };
  file.services.push(desc), reg.add(desc);
  for (let methodProto of proto.method) {
    let method = newMethod(methodProto, desc, reg);
    desc.methods.push(method), desc.method[method.localName] = method;
  }
}
function newMethod(proto, parent, reg) {
  var _a, _b, _c, _d;
  let methodKind;
  proto.clientStreaming && proto.serverStreaming ? methodKind = "bidi_streaming" : proto.clientStreaming ? methodKind = "client_streaming" : proto.serverStreaming ? methodKind = "server_streaming" : methodKind = "unary";
  let input = reg.getMessage(trimLeadingDot(proto.inputType)), output = reg.getMessage(trimLeadingDot(proto.outputType));
  assert(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`), assert(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
  let name = proto.name;
  return {
    kind: "rpc",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    parent,
    name,
    localName: safeObjectProperty(name.length ? safeObjectProperty(name[0].toLowerCase() + name.substring(1)) : name),
    methodKind,
    input,
    output,
    idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
    toString() {
      return `rpc ${parent.typeName}.${name}`;
    }
  };
}
function newOneof(proto, parent) {
  return {
    kind: "oneof",
    proto,
    deprecated: !1,
    parent,
    fields: [],
    name: proto.name,
    localName: safeObjectProperty(protoCamelCase(proto.name)),
    toString() {
      return `oneof ${parent.typeName}.${this.name}`;
    }
  };
}
function newField(proto, parentOrFile, reg, oneof, mapEntries) {
  var _a, _b, _c;
  let isExtension = mapEntries === void 0, field = {
    kind: "field",
    proto,
    deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : !1,
    name: proto.name,
    number: proto.number,
    scalar: void 0,
    message: void 0,
    enum: void 0,
    presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
    utf8Validation: isUtf8Validated(proto, parentOrFile),
    listKind: void 0,
    mapKind: void 0,
    mapKey: void 0,
    delimitedEncoding: void 0,
    packed: void 0,
    longAsString: !1,
    getDefaultValue: void 0
  }, toStr;
  if (isExtension) {
    let file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file, parent = parentOrFile.kind == "file" ? void 0 : parentOrFile, typeName = makeTypeName(proto, parent, file);
    field.kind = "extension", field.file = file, field.parent = parent, field.oneof = void 0, field.typeName = typeName, field.jsonName = `[${typeName}]`, toStr = () => `extension ${typeName}`;
    let extendee = reg.getMessage(trimLeadingDot(proto.extendee));
    assert(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`), field.extendee = extendee;
  } else {
    let parent = parentOrFile;
    assert(parent.kind == "message"), field.parent = parent, field.oneof = oneof, field.localName = oneof ? protoCamelCase(proto.name) : safeObjectProperty(protoCamelCase(proto.name)), field.jsonName = proto.jsonName, toStr = () => `field ${parent.typeName}.${proto.name}`;
  }
  Object.defineProperty(field, "toString", {
    value: toStr,
    writable: !0,
    enumerable: !0,
    configurable: !0
  });
  let label = proto.label, type = proto.type, jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
  if (label === LABEL_REPEATED) {
    let mapEntry = type == TYPE_MESSAGE ? mapEntries?.get(trimLeadingDot(proto.typeName)) : void 0;
    if (mapEntry) {
      field.fieldKind = "map";
      let { key: key2, value } = findMapEntryFields(mapEntry);
      return field.mapKey = key2.scalar, field.mapKind = value.fieldKind, field.message = value.message, field.delimitedEncoding = !1, field.enum = value.enum, field.scalar = value.scalar, field;
    }
    switch (field.fieldKind = "list", type) {
      case TYPE_MESSAGE:
      case TYPE_GROUP:
        field.listKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert(field.message), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
        break;
      case TYPE_ENUM:
        field.listKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), assert(field.enum);
        break;
      default:
        field.listKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING;
        break;
    }
    return field.packed = isPackedField(proto, parentOrFile), field;
  }
  switch (type) {
    case TYPE_MESSAGE:
    case TYPE_GROUP:
      field.fieldKind = "message", field.message = reg.getMessage(trimLeadingDot(proto.typeName)), assert(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile), field.getDefaultValue = () => {
      };
      break;
    case TYPE_ENUM: {
      let enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
      assert(enumeration !== void 0, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`), field.fieldKind = "enum", field.enum = reg.getEnum(trimLeadingDot(proto.typeName)), field.getDefaultValue = () => unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatEnumValue(enumeration, proto.defaultValue) : void 0;
      break;
    }
    default: {
      field.fieldKind = "scalar", field.scalar = type, field.longAsString = jstype == JS_STRING, field.getDefaultValue = () => unsafeIsSetExplicit(proto, "defaultValue") ? parseTextFormatScalarValue(type, proto.defaultValue) : void 0;
      break;
    }
  }
  return field;
}
function getFileEdition(proto) {
  switch (proto.syntax) {
    case "":
    case "proto2":
      return EDITION_PROTO22;
    case "proto3":
      return EDITION_PROTO32;
    case "editions":
      if (proto.edition === EDITION_UNSTABLE)
        return maximumEdition;
      if (proto.edition in featureDefaults)
        return proto.edition;
      throw new Error(`${proto.name}: unsupported edition`);
    default:
      throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
  }
}
function findFileDependencies(proto, reg) {
  return proto.dependency.map((wantName) => {
    let dep = reg.getFile(wantName);
    if (!dep)
      throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
    return dep;
  });
}
function findEnumSharedPrefix(enumName, values) {
  let prefix = camelToSnakeCase(enumName) + "_";
  for (let value of values) {
    if (!value.name.toLowerCase().startsWith(prefix))
      return;
    let shortName = value.name.substring(prefix.length);
    if (shortName.length == 0 || /^\d/.test(shortName))
      return;
  }
  return prefix;
}
function findEnumValueJsonName(proto) {
  var _a, _b;
  let jsonName;
  for (let uf of (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.$unknown) !== null && _b !== void 0 ? _b : []) {
    if (uf.no !== 998 || uf.wireType !== WireType.LengthDelimited)
      continue;
    let reader = new BinaryReader(new BinaryReader(uf.data).bytes());
    for (; reader.pos < reader.len; ) {
      let [no, wireType] = reader.tag();
      no === 1 && wireType === WireType.LengthDelimited ? jsonName = reader.string() : reader.skip(wireType, no);
    }
  }
  return jsonName;
}
function camelToSnakeCase(camel) {
  return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c) => "_" + c)).toLowerCase();
}
function makeTypeName(proto, parent, file) {
  let typeName;
  return parent ? typeName = `${parent.typeName}.${proto.name}` : file.proto.package.length > 0 ? typeName = `${file.proto.package}.${proto.name}` : typeName = `${proto.name}`, typeName;
}
function trimLeadingDot(typeName) {
  return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}
function findOneof(proto, allOneofs) {
  if (!unsafeIsSetExplicit(proto, "oneofIndex") || proto.proto3Optional)
    return;
  let oneof = allOneofs[proto.oneofIndex];
  return assert(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`), oneof;
}
function getFieldPresence(proto, oneof, isExtension, parent) {
  if (proto.label == LABEL_REQUIRED)
    return LEGACY_REQUIRED;
  if (proto.label == LABEL_REPEATED)
    return IMPLICIT2;
  if (oneof || proto.proto3Optional || isExtension)
    return EXPLICIT;
  let resolved = resolveFeature("fieldPresence", { proto, parent });
  return resolved == IMPLICIT2 && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP) ? EXPLICIT : resolved;
}
function isPackedField(proto, parent) {
  if (proto.label != LABEL_REPEATED)
    return !1;
  switch (proto.type) {
    case TYPE_STRING:
    case TYPE_BYTES:
    case TYPE_GROUP:
    case TYPE_MESSAGE:
      return !1;
  }
  let o = proto.options;
  return o && unsafeIsSetExplicit(o, "packed") ? o.packed : PACKED == resolveFeature("repeatedFieldEncoding", {
    proto,
    parent
  });
}
function findMapEntryFields(mapEntry) {
  let key2 = mapEntry.fields.find((f) => f.number === 1), value = mapEntry.fields.find((f) => f.number === 2);
  return assert(key2 && key2.fieldKind == "scalar" && key2.scalar != ScalarType.BYTES && key2.scalar != ScalarType.FLOAT && key2.scalar != ScalarType.DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map"), { key: key2, value };
}
function isEnumOpen(desc) {
  var _a;
  return OPEN == resolveFeature("enumType", {
    proto: desc.proto,
    parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
  });
}
function isDelimitedEncoding(proto, parent) {
  return proto.type == TYPE_GROUP ? !0 : DELIMITED == resolveFeature("messageEncoding", {
    proto,
    parent
  });
}
function isUtf8Validated(proto, parent) {
  return VERIFY == resolveFeature("utf8Validation", {
    proto,
    parent
  });
}
function resolveFeature(name, ref) {
  var _a, _b;
  let featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
  if (featureSet) {
    let val = featureSet[name];
    if (val != 0)
      return val;
  }
  if ("kind" in ref) {
    if (ref.kind == "message")
      return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
    let editionDefaults = featureDefaults[ref.edition];
    if (!editionDefaults)
      throw new Error(`feature default for edition ${ref.edition} not found`);
    return editionDefaults[name];
  }
  return resolveFeature(name, ref.parent);
}
function assert(condition, msg) {
  if (!condition)
    throw new Error(msg);
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js
function boot(boot2) {
  let root2 = bootFileDescriptorProto(boot2);
  return root2.messageType.forEach(restoreJsonNames), createEmbeddedFileRegistry(root2, () => {
  }).getFile(root2.name);
}
function bootFileDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    syntax: "",
    edition: 0
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FileDescriptorProto", dependency: [], publicDependency: [], weakDependency: [], optionDependency: [], service: [], extension: [] }, init), { messageType: init.messageType.map(bootDescriptorProto), enumType: init.enumType.map(bootEnumDescriptorProto) }));
}
function bootDescriptorProto(init) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  return Object.assign(/* @__PURE__ */ Object.create({
    visibility: 0
  }), {
    $typeName: "google.protobuf.DescriptorProto",
    name: init.name,
    field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
    extension: [],
    nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
    enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
    extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e) => Object.assign({ $typeName: "google.protobuf.DescriptorProto.ExtensionRange" }, e))) !== null && _h !== void 0 ? _h : [],
    oneofDecl: [],
    reservedRange: [],
    reservedName: []
  });
}
function bootFieldDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    label: 1,
    typeName: "",
    extendee: "",
    defaultValue: "",
    oneofIndex: 0,
    jsonName: "",
    proto3Optional: !1
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldDescriptorProto" }, init), { options: init.options ? bootFieldOptions(init.options) : void 0 }));
}
function bootFieldOptions(init) {
  var _a, _b, _c;
  return Object.assign(/* @__PURE__ */ Object.create({
    ctype: 0,
    packed: !1,
    jstype: 0,
    lazy: !1,
    unverifiedLazy: !1,
    deprecated: !1,
    weak: !1,
    debugRedact: !1,
    retention: 0
  }), Object.assign(Object.assign({ $typeName: "google.protobuf.FieldOptions" }, init), { targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [], editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e) => Object.assign({ $typeName: "google.protobuf.FieldOptions.EditionDefault" }, e))) !== null && _c !== void 0 ? _c : [], uninterpretedOption: [] }));
}
function bootEnumDescriptorProto(init) {
  return Object.assign(/* @__PURE__ */ Object.create({
    visibility: 0
  }), {
    $typeName: "google.protobuf.EnumDescriptorProto",
    name: init.name,
    reservedName: [],
    reservedRange: [],
    value: init.value.map((e) => Object.assign({ $typeName: "google.protobuf.EnumValueDescriptorProto" }, e))
  });
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js
function messageDesc(file, path, ...paths) {
  return paths.reduce((acc, cur) => acc.nestedMessages[cur], file.messages[path]);
}

// node_modules/@bufbuild/protobuf/dist/esm/wkt/google/protobuf/descriptor_pb.js
var file_google_protobuf_descriptor = /* @__PURE__ */ boot({ name: "google/protobuf/descriptor.proto", package: "google.protobuf", messageType: [{ name: "FileDescriptorSet", field: [{ name: "file", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FileDescriptorProto" }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "FileDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "package", number: 2, type: 9, label: 1 }, { name: "dependency", number: 3, type: 9, label: 3 }, { name: "public_dependency", number: 10, type: 5, label: 3 }, { name: "weak_dependency", number: 11, type: 5, label: 3 }, { name: "option_dependency", number: 15, type: 9, label: 3 }, { name: "message_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 5, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "service", number: 6, type: 11, label: 3, typeName: ".google.protobuf.ServiceDescriptorProto" }, { name: "extension", number: 7, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FileOptions" }, { name: "source_code_info", number: 9, type: 11, label: 1, typeName: ".google.protobuf.SourceCodeInfo" }, { name: "syntax", number: 12, type: 9, label: 1 }, { name: "edition", number: 14, type: 14, label: 1, typeName: ".google.protobuf.Edition" }] }, { name: "DescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "field", number: 2, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "extension", number: 6, type: 11, label: 3, typeName: ".google.protobuf.FieldDescriptorProto" }, { name: "nested_type", number: 3, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto" }, { name: "enum_type", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto" }, { name: "extension_range", number: 5, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ExtensionRange" }, { name: "oneof_decl", number: 8, type: 11, label: 3, typeName: ".google.protobuf.OneofDescriptorProto" }, { name: "options", number: 7, type: 11, label: 1, typeName: ".google.protobuf.MessageOptions" }, { name: "reserved_range", number: 9, type: 11, label: 3, typeName: ".google.protobuf.DescriptorProto.ReservedRange" }, { name: "reserved_name", number: 10, type: 9, label: 3 }, { name: "visibility", number: 11, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "ExtensionRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions" }] }, { name: "ReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "ExtensionRangeOptions", field: [{ name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }, { name: "declaration", number: 2, type: 11, label: 3, typeName: ".google.protobuf.ExtensionRangeOptions.Declaration", options: { retention: 2 } }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "verification", number: 3, type: 14, label: 1, typeName: ".google.protobuf.ExtensionRangeOptions.VerificationState", defaultValue: "UNVERIFIED", options: { retention: 2 } }], nestedType: [{ name: "Declaration", field: [{ name: "number", number: 1, type: 5, label: 1 }, { name: "full_name", number: 2, type: 9, label: 1 }, { name: "type", number: 3, type: 9, label: 1 }, { name: "reserved", number: 5, type: 8, label: 1 }, { name: "repeated", number: 6, type: 8, label: 1 }] }], enumType: [{ name: "VerificationState", value: [{ name: "DECLARATION", number: 0 }, { name: "UNVERIFIED", number: 1 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "FieldDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 3, type: 5, label: 1 }, { name: "label", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Label" }, { name: "type", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FieldDescriptorProto.Type" }, { name: "type_name", number: 6, type: 9, label: 1 }, { name: "extendee", number: 2, type: 9, label: 1 }, { name: "default_value", number: 7, type: 9, label: 1 }, { name: "oneof_index", number: 9, type: 5, label: 1 }, { name: "json_name", number: 10, type: 9, label: 1 }, { name: "options", number: 8, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions" }, { name: "proto3_optional", number: 17, type: 8, label: 1 }], enumType: [{ name: "Type", value: [{ name: "TYPE_DOUBLE", number: 1 }, { name: "TYPE_FLOAT", number: 2 }, { name: "TYPE_INT64", number: 3 }, { name: "TYPE_UINT64", number: 4 }, { name: "TYPE_INT32", number: 5 }, { name: "TYPE_FIXED64", number: 6 }, { name: "TYPE_FIXED32", number: 7 }, { name: "TYPE_BOOL", number: 8 }, { name: "TYPE_STRING", number: 9 }, { name: "TYPE_GROUP", number: 10 }, { name: "TYPE_MESSAGE", number: 11 }, { name: "TYPE_BYTES", number: 12 }, { name: "TYPE_UINT32", number: 13 }, { name: "TYPE_ENUM", number: 14 }, { name: "TYPE_SFIXED32", number: 15 }, { name: "TYPE_SFIXED64", number: 16 }, { name: "TYPE_SINT32", number: 17 }, { name: "TYPE_SINT64", number: 18 }] }, { name: "Label", value: [{ name: "LABEL_OPTIONAL", number: 1 }, { name: "LABEL_REPEATED", number: 3 }, { name: "LABEL_REQUIRED", number: 2 }] }] }, { name: "OneofDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "options", number: 2, type: 11, label: 1, typeName: ".google.protobuf.OneofOptions" }] }, { name: "EnumDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "value", number: 2, type: 11, label: 3, typeName: ".google.protobuf.EnumValueDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumOptions" }, { name: "reserved_range", number: 4, type: 11, label: 3, typeName: ".google.protobuf.EnumDescriptorProto.EnumReservedRange" }, { name: "reserved_name", number: 5, type: 9, label: 3 }, { name: "visibility", number: 6, type: 14, label: 1, typeName: ".google.protobuf.SymbolVisibility" }], nestedType: [{ name: "EnumReservedRange", field: [{ name: "start", number: 1, type: 5, label: 1 }, { name: "end", number: 2, type: 5, label: 1 }] }] }, { name: "EnumValueDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "number", number: 2, type: 5, label: 1 }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.EnumValueOptions" }] }, { name: "ServiceDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "method", number: 2, type: 11, label: 3, typeName: ".google.protobuf.MethodDescriptorProto" }, { name: "options", number: 3, type: 11, label: 1, typeName: ".google.protobuf.ServiceOptions" }] }, { name: "MethodDescriptorProto", field: [{ name: "name", number: 1, type: 9, label: 1 }, { name: "input_type", number: 2, type: 9, label: 1 }, { name: "output_type", number: 3, type: 9, label: 1 }, { name: "options", number: 4, type: 11, label: 1, typeName: ".google.protobuf.MethodOptions" }, { name: "client_streaming", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "server_streaming", number: 6, type: 8, label: 1, defaultValue: "false" }] }, { name: "FileOptions", field: [{ name: "java_package", number: 1, type: 9, label: 1 }, { name: "java_outer_classname", number: 8, type: 9, label: 1 }, { name: "java_multiple_files", number: 10, type: 8, label: 1, defaultValue: "false", options: {} }, { name: "java_generate_equals_and_hash", number: 20, type: 8, label: 1, options: { deprecated: !0 } }, { name: "java_string_check_utf8", number: 27, type: 8, label: 1, defaultValue: "false" }, { name: "optimize_for", number: 9, type: 14, label: 1, typeName: ".google.protobuf.FileOptions.OptimizeMode", defaultValue: "SPEED" }, { name: "go_package", number: 11, type: 9, label: 1 }, { name: "cc_generic_services", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "java_generic_services", number: 17, type: 8, label: 1, defaultValue: "false" }, { name: "py_generic_services", number: 18, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 23, type: 8, label: 1, defaultValue: "false" }, { name: "cc_enable_arenas", number: 31, type: 8, label: 1, defaultValue: "true", options: {} }, { name: "objc_class_prefix", number: 36, type: 9, label: 1 }, { name: "csharp_namespace", number: 37, type: 9, label: 1 }, { name: "swift_prefix", number: 39, type: 9, label: 1 }, { name: "php_class_prefix", number: 40, type: 9, label: 1 }, { name: "php_namespace", number: 41, type: 9, label: 1 }, { name: "php_metadata_namespace", number: 44, type: 9, label: 1 }, { name: "ruby_package", number: 45, type: 9, label: 1 }, { name: "features", number: 50, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "OptimizeMode", value: [{ name: "SPEED", number: 1 }, { name: "CODE_SIZE", number: 2 }, { name: "LITE_RUNTIME", number: 3 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "MessageOptions", field: [{ name: "message_set_wire_format", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "no_standard_descriptor_accessor", number: 2, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "map_entry", number: 7, type: 8, label: 1 }, { name: "deprecated_legacy_json_field_conflicts", number: 11, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 12, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "FieldOptions", field: [{ name: "ctype", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.CType", defaultValue: "STRING" }, { name: "packed", number: 2, type: 8, label: 1 }, { name: "jstype", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.JSType", defaultValue: "JS_NORMAL" }, { name: "lazy", number: 5, type: 8, label: 1, defaultValue: "false" }, { name: "unverified_lazy", number: 15, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "weak", number: 10, type: 8, label: 1, defaultValue: "false", options: { deprecated: !0 } }, { name: "debug_redact", number: 16, type: 8, label: 1, defaultValue: "false" }, { name: "retention", number: 17, type: 14, label: 1, typeName: ".google.protobuf.FieldOptions.OptionRetention" }, { name: "targets", number: 19, type: 14, label: 3, typeName: ".google.protobuf.FieldOptions.OptionTargetType" }, { name: "edition_defaults", number: 20, type: 11, label: 3, typeName: ".google.protobuf.FieldOptions.EditionDefault" }, { name: "features", number: 21, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "feature_support", number: 22, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], nestedType: [{ name: "EditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "value", number: 2, type: 9, label: 1 }] }, { name: "FeatureSupport", field: [{ name: "edition_introduced", number: 1, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "edition_deprecated", number: 2, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "deprecation_warning", number: 3, type: 9, label: 1 }, { name: "edition_removed", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "removal_error", number: 5, type: 9, label: 1 }] }], enumType: [{ name: "CType", value: [{ name: "STRING", number: 0 }, { name: "CORD", number: 1 }, { name: "STRING_PIECE", number: 2 }] }, { name: "JSType", value: [{ name: "JS_NORMAL", number: 0 }, { name: "JS_STRING", number: 1 }, { name: "JS_NUMBER", number: 2 }] }, { name: "OptionRetention", value: [{ name: "RETENTION_UNKNOWN", number: 0 }, { name: "RETENTION_RUNTIME", number: 1 }, { name: "RETENTION_SOURCE", number: 2 }] }, { name: "OptionTargetType", value: [{ name: "TARGET_TYPE_UNKNOWN", number: 0 }, { name: "TARGET_TYPE_FILE", number: 1 }, { name: "TARGET_TYPE_EXTENSION_RANGE", number: 2 }, { name: "TARGET_TYPE_MESSAGE", number: 3 }, { name: "TARGET_TYPE_FIELD", number: 4 }, { name: "TARGET_TYPE_ONEOF", number: 5 }, { name: "TARGET_TYPE_ENUM", number: 6 }, { name: "TARGET_TYPE_ENUM_ENTRY", number: 7 }, { name: "TARGET_TYPE_SERVICE", number: 8 }, { name: "TARGET_TYPE_METHOD", number: 9 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "OneofOptions", field: [{ name: "features", number: 1, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "EnumOptions", field: [{ name: "allow_alias", number: 2, type: 8, label: 1 }, { name: "deprecated", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "deprecated_legacy_json_field_conflicts", number: 6, type: 8, label: 1, options: { deprecated: !0 } }, { name: "features", number: 7, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "EnumValueOptions", field: [{ name: "deprecated", number: 1, type: 8, label: 1, defaultValue: "false" }, { name: "features", number: 2, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "debug_redact", number: 3, type: 8, label: 1, defaultValue: "false" }, { name: "feature_support", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FieldOptions.FeatureSupport" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "ServiceOptions", field: [{ name: "features", number: 34, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "MethodOptions", field: [{ name: "deprecated", number: 33, type: 8, label: 1, defaultValue: "false" }, { name: "idempotency_level", number: 34, type: 14, label: 1, typeName: ".google.protobuf.MethodOptions.IdempotencyLevel", defaultValue: "IDEMPOTENCY_UNKNOWN" }, { name: "features", number: 35, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "uninterpreted_option", number: 999, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption" }], enumType: [{ name: "IdempotencyLevel", value: [{ name: "IDEMPOTENCY_UNKNOWN", number: 0 }, { name: "NO_SIDE_EFFECTS", number: 1 }, { name: "IDEMPOTENT", number: 2 }] }], extensionRange: [{ start: 990, end: 999 }, { start: 1e3, end: 536870912 }] }, { name: "UninterpretedOption", field: [{ name: "name", number: 2, type: 11, label: 3, typeName: ".google.protobuf.UninterpretedOption.NamePart" }, { name: "identifier_value", number: 3, type: 9, label: 1 }, { name: "positive_int_value", number: 4, type: 4, label: 1 }, { name: "negative_int_value", number: 5, type: 3, label: 1 }, { name: "double_value", number: 6, type: 1, label: 1 }, { name: "string_value", number: 7, type: 12, label: 1 }, { name: "aggregate_value", number: 8, type: 9, label: 1 }], nestedType: [{ name: "NamePart", field: [{ name: "name_part", number: 1, type: 9, label: 2 }, { name: "is_extension", number: 2, type: 8, label: 2 }] }] }, { name: "FeatureSet", field: [{ name: "field_presence", number: 1, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.FieldPresence", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPLICIT", edition: 900 }, { value: "IMPLICIT", edition: 999 }, { value: "EXPLICIT", edition: 1e3 }] } }, { name: "enum_type", number: 2, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnumType", options: { retention: 1, targets: [6, 1], editionDefaults: [{ value: "CLOSED", edition: 900 }, { value: "OPEN", edition: 999 }] } }, { name: "repeated_field_encoding", number: 3, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.RepeatedFieldEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "EXPANDED", edition: 900 }, { value: "PACKED", edition: 999 }] } }, { name: "utf8_validation", number: 4, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.Utf8Validation", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "NONE", edition: 900 }, { value: "VERIFY", edition: 999 }] } }, { name: "message_encoding", number: 5, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.MessageEncoding", options: { retention: 1, targets: [4, 1], editionDefaults: [{ value: "LENGTH_PREFIXED", edition: 900 }] } }, { name: "json_format", number: 6, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.JsonFormat", options: { retention: 1, targets: [3, 6, 1], editionDefaults: [{ value: "LEGACY_BEST_EFFORT", edition: 900 }, { value: "ALLOW", edition: 999 }] } }, { name: "enforce_naming_style", number: 7, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.EnforceNamingStyle", options: { retention: 2, targets: [1, 2, 3, 4, 5, 6, 7, 8, 9], editionDefaults: [{ value: "STYLE_LEGACY", edition: 900 }, { value: "STYLE2024", edition: 1001 }, { value: "STYLE2026", edition: 1002 }] } }, { name: "default_symbol_visibility", number: 8, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility", options: { retention: 2, targets: [1], editionDefaults: [{ value: "EXPORT_ALL", edition: 900 }, { value: "EXPORT_TOP_LEVEL", edition: 1001 }, { value: "STRICT", edition: 1002 }] } }, { name: "enforce_proto_limits", number: 9, type: 14, label: 1, typeName: ".google.protobuf.FeatureSet.ProtoLimitsFeature.EnforceProtoLimits", options: { retention: 2, targets: [6, 3, 4, 5], editionDefaults: [{ value: "LEGACY_NO_EXPLICIT_LIMITS", edition: 900 }, { value: "PROTO_LIMITS2026", edition: 1002 }] } }], nestedType: [{ name: "VisibilityFeature", enumType: [{ name: "DefaultSymbolVisibility", value: [{ name: "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", number: 0 }, { name: "EXPORT_ALL", number: 1 }, { name: "EXPORT_TOP_LEVEL", number: 2 }, { name: "LOCAL_ALL", number: 3 }, { name: "STRICT", number: 4 }] }] }, { name: "ProtoLimitsFeature", enumType: [{ name: "EnforceProtoLimits", value: [{ name: "PROTO_LIMITS_UNKNOWN", number: 0 }, { name: "LEGACY_NO_EXPLICIT_LIMITS", number: 1 }, { name: "PROTO_LIMITS2026", number: 2 }] }] }], enumType: [{ name: "FieldPresence", value: [{ name: "FIELD_PRESENCE_UNKNOWN", number: 0 }, { name: "EXPLICIT", number: 1 }, { name: "IMPLICIT", number: 2 }, { name: "LEGACY_REQUIRED", number: 3 }] }, { name: "EnumType", value: [{ name: "ENUM_TYPE_UNKNOWN", number: 0 }, { name: "OPEN", number: 1 }, { name: "CLOSED", number: 2 }] }, { name: "RepeatedFieldEncoding", value: [{ name: "REPEATED_FIELD_ENCODING_UNKNOWN", number: 0 }, { name: "PACKED", number: 1 }, { name: "EXPANDED", number: 2 }] }, { name: "Utf8Validation", value: [{ name: "UTF8_VALIDATION_UNKNOWN", number: 0 }, { name: "VERIFY", number: 2 }, { name: "NONE", number: 3 }] }, { name: "MessageEncoding", value: [{ name: "MESSAGE_ENCODING_UNKNOWN", number: 0 }, { name: "LENGTH_PREFIXED", number: 1 }, { name: "DELIMITED", number: 2 }] }, { name: "JsonFormat", value: [{ name: "JSON_FORMAT_UNKNOWN", number: 0 }, { name: "ALLOW", number: 1 }, { name: "LEGACY_BEST_EFFORT", number: 2 }] }, { name: "EnforceNamingStyle", value: [{ name: "ENFORCE_NAMING_STYLE_UNKNOWN", number: 0 }, { name: "STYLE2024", number: 1 }, { name: "STYLE_LEGACY", number: 2 }, { name: "STYLE2026", number: 3 }] }], extensionRange: [{ start: 1e3, end: 9995 }, { start: 9995, end: 1e4 }, { start: 1e4, end: 10001 }] }, { name: "FeatureSetDefaults", field: [{ name: "defaults", number: 1, type: 11, label: 3, typeName: ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault" }, { name: "minimum_edition", number: 4, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "maximum_edition", number: 5, type: 14, label: 1, typeName: ".google.protobuf.Edition" }], nestedType: [{ name: "FeatureSetEditionDefault", field: [{ name: "edition", number: 3, type: 14, label: 1, typeName: ".google.protobuf.Edition" }, { name: "overridable_features", number: 4, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }, { name: "fixed_features", number: 5, type: 11, label: 1, typeName: ".google.protobuf.FeatureSet" }] }] }, { name: "SourceCodeInfo", field: [{ name: "location", number: 1, type: 11, label: 3, typeName: ".google.protobuf.SourceCodeInfo.Location" }], nestedType: [{ name: "Location", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "span", number: 2, type: 5, label: 3, options: { packed: !0 } }, { name: "leading_comments", number: 3, type: 9, label: 1 }, { name: "trailing_comments", number: 4, type: 9, label: 1 }, { name: "leading_detached_comments", number: 6, type: 9, label: 3 }] }], extensionRange: [{ start: 536e6, end: 536000001 }] }, { name: "GeneratedCodeInfo", field: [{ name: "annotation", number: 1, type: 11, label: 3, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation" }], nestedType: [{ name: "Annotation", field: [{ name: "path", number: 1, type: 5, label: 3, options: { packed: !0 } }, { name: "source_file", number: 2, type: 9, label: 1 }, { name: "begin", number: 3, type: 5, label: 1 }, { name: "end", number: 4, type: 5, label: 1 }, { name: "semantic", number: 5, type: 14, label: 1, typeName: ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic" }], enumType: [{ name: "Semantic", value: [{ name: "NONE", number: 0 }, { name: "SET", number: 1 }, { name: "ALIAS", number: 2 }] }] }] }], enumType: [{ name: "Edition", value: [{ name: "EDITION_UNKNOWN", number: 0 }, { name: "EDITION_LEGACY", number: 900 }, { name: "EDITION_PROTO2", number: 998 }, { name: "EDITION_PROTO3", number: 999 }, { name: "EDITION_2023", number: 1e3 }, { name: "EDITION_2024", number: 1001 }, { name: "EDITION_2026", number: 1002 }, { name: "EDITION_UNSTABLE", number: 9999 }, { name: "EDITION_1_TEST_ONLY", number: 1 }, { name: "EDITION_2_TEST_ONLY", number: 2 }, { name: "EDITION_99997_TEST_ONLY", number: 99997 }, { name: "EDITION_99998_TEST_ONLY", number: 99998 }, { name: "EDITION_99999_TEST_ONLY", number: 99999 }, { name: "EDITION_MAX", number: 2147483647 }] }, { name: "SymbolVisibility", value: [{ name: "VISIBILITY_UNSET", number: 0 }, { name: "VISIBILITY_LOCAL", number: 1 }, { name: "VISIBILITY_EXPORT", number: 2 }] }] });
var FileDescriptorProtoSchema = /* @__PURE__ */ messageDesc(file_google_protobuf_descriptor, 1);
var ExtensionRangeOptions_VerificationState;
(function(ExtensionRangeOptions_VerificationState2) {
  ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.DECLARATION = 0] = "DECLARATION", ExtensionRangeOptions_VerificationState2[ExtensionRangeOptions_VerificationState2.UNVERIFIED = 1] = "UNVERIFIED";
})(ExtensionRangeOptions_VerificationState || (ExtensionRangeOptions_VerificationState = {}));
var FieldDescriptorProto_Type;
(function(FieldDescriptorProto_Type2) {
  FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.DOUBLE = 1] = "DOUBLE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FLOAT = 2] = "FLOAT", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT64 = 3] = "INT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT64 = 4] = "UINT64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.INT32 = 5] = "INT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED64 = 6] = "FIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.FIXED32 = 7] = "FIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BOOL = 8] = "BOOL", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.STRING = 9] = "STRING", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.GROUP = 10] = "GROUP", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.MESSAGE = 11] = "MESSAGE", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.BYTES = 12] = "BYTES", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.UINT32 = 13] = "UINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.ENUM = 14] = "ENUM", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED32 = 15] = "SFIXED32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SFIXED64 = 16] = "SFIXED64", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT32 = 17] = "SINT32", FieldDescriptorProto_Type2[FieldDescriptorProto_Type2.SINT64 = 18] = "SINT64";
})(FieldDescriptorProto_Type || (FieldDescriptorProto_Type = {}));
var FieldDescriptorProto_Label;
(function(FieldDescriptorProto_Label2) {
  FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.OPTIONAL = 1] = "OPTIONAL", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REPEATED = 3] = "REPEATED", FieldDescriptorProto_Label2[FieldDescriptorProto_Label2.REQUIRED = 2] = "REQUIRED";
})(FieldDescriptorProto_Label || (FieldDescriptorProto_Label = {}));
var FileOptions_OptimizeMode;
(function(FileOptions_OptimizeMode2) {
  FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.SPEED = 1] = "SPEED", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.CODE_SIZE = 2] = "CODE_SIZE", FileOptions_OptimizeMode2[FileOptions_OptimizeMode2.LITE_RUNTIME = 3] = "LITE_RUNTIME";
})(FileOptions_OptimizeMode || (FileOptions_OptimizeMode = {}));
var FieldOptions_CType;
(function(FieldOptions_CType2) {
  FieldOptions_CType2[FieldOptions_CType2.STRING = 0] = "STRING", FieldOptions_CType2[FieldOptions_CType2.CORD = 1] = "CORD", FieldOptions_CType2[FieldOptions_CType2.STRING_PIECE = 2] = "STRING_PIECE";
})(FieldOptions_CType || (FieldOptions_CType = {}));
var FieldOptions_JSType;
(function(FieldOptions_JSType2) {
  FieldOptions_JSType2[FieldOptions_JSType2.JS_NORMAL = 0] = "JS_NORMAL", FieldOptions_JSType2[FieldOptions_JSType2.JS_STRING = 1] = "JS_STRING", FieldOptions_JSType2[FieldOptions_JSType2.JS_NUMBER = 2] = "JS_NUMBER";
})(FieldOptions_JSType || (FieldOptions_JSType = {}));
var FieldOptions_OptionRetention;
(function(FieldOptions_OptionRetention2) {
  FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_UNKNOWN = 0] = "RETENTION_UNKNOWN", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_RUNTIME = 1] = "RETENTION_RUNTIME", FieldOptions_OptionRetention2[FieldOptions_OptionRetention2.RETENTION_SOURCE = 2] = "RETENTION_SOURCE";
})(FieldOptions_OptionRetention || (FieldOptions_OptionRetention = {}));
var FieldOptions_OptionTargetType;
(function(FieldOptions_OptionTargetType2) {
  FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_UNKNOWN = 0] = "TARGET_TYPE_UNKNOWN", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FILE = 1] = "TARGET_TYPE_FILE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_EXTENSION_RANGE = 2] = "TARGET_TYPE_EXTENSION_RANGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_MESSAGE = 3] = "TARGET_TYPE_MESSAGE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_FIELD = 4] = "TARGET_TYPE_FIELD", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ONEOF = 5] = "TARGET_TYPE_ONEOF", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM = 6] = "TARGET_TYPE_ENUM", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_ENUM_ENTRY = 7] = "TARGET_TYPE_ENUM_ENTRY", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_SERVICE = 8] = "TARGET_TYPE_SERVICE", FieldOptions_OptionTargetType2[FieldOptions_OptionTargetType2.TARGET_TYPE_METHOD = 9] = "TARGET_TYPE_METHOD";
})(FieldOptions_OptionTargetType || (FieldOptions_OptionTargetType = {}));
var MethodOptions_IdempotencyLevel;
(function(MethodOptions_IdempotencyLevel2) {
  MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENCY_UNKNOWN = 0] = "IDEMPOTENCY_UNKNOWN", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.NO_SIDE_EFFECTS = 1] = "NO_SIDE_EFFECTS", MethodOptions_IdempotencyLevel2[MethodOptions_IdempotencyLevel2.IDEMPOTENT = 2] = "IDEMPOTENT";
})(MethodOptions_IdempotencyLevel || (MethodOptions_IdempotencyLevel = {}));
var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
(function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility2) {
  FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_ALL = 1] = "EXPORT_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.EXPORT_TOP_LEVEL = 2] = "EXPORT_TOP_LEVEL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.LOCAL_ALL = 3] = "LOCAL_ALL", FeatureSet_VisibilityFeature_DefaultSymbolVisibility2[FeatureSet_VisibilityFeature_DefaultSymbolVisibility2.STRICT = 4] = "STRICT";
})(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
var FeatureSet_ProtoLimitsFeature_EnforceProtoLimits;
(function(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2) {
  FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.PROTO_LIMITS_UNKNOWN = 0] = "PROTO_LIMITS_UNKNOWN", FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.LEGACY_NO_EXPLICIT_LIMITS = 1] = "LEGACY_NO_EXPLICIT_LIMITS", FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2[FeatureSet_ProtoLimitsFeature_EnforceProtoLimits2.PROTO_LIMITS2026 = 2] = "PROTO_LIMITS2026";
})(FeatureSet_ProtoLimitsFeature_EnforceProtoLimits || (FeatureSet_ProtoLimitsFeature_EnforceProtoLimits = {}));
var FeatureSet_FieldPresence;
(function(FeatureSet_FieldPresence2) {
  FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.FIELD_PRESENCE_UNKNOWN = 0] = "FIELD_PRESENCE_UNKNOWN", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.EXPLICIT = 1] = "EXPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.IMPLICIT = 2] = "IMPLICIT", FeatureSet_FieldPresence2[FeatureSet_FieldPresence2.LEGACY_REQUIRED = 3] = "LEGACY_REQUIRED";
})(FeatureSet_FieldPresence || (FeatureSet_FieldPresence = {}));
var FeatureSet_EnumType;
(function(FeatureSet_EnumType2) {
  FeatureSet_EnumType2[FeatureSet_EnumType2.ENUM_TYPE_UNKNOWN = 0] = "ENUM_TYPE_UNKNOWN", FeatureSet_EnumType2[FeatureSet_EnumType2.OPEN = 1] = "OPEN", FeatureSet_EnumType2[FeatureSet_EnumType2.CLOSED = 2] = "CLOSED";
})(FeatureSet_EnumType || (FeatureSet_EnumType = {}));
var FeatureSet_RepeatedFieldEncoding;
(function(FeatureSet_RepeatedFieldEncoding2) {
  FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.REPEATED_FIELD_ENCODING_UNKNOWN = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.PACKED = 1] = "PACKED", FeatureSet_RepeatedFieldEncoding2[FeatureSet_RepeatedFieldEncoding2.EXPANDED = 2] = "EXPANDED";
})(FeatureSet_RepeatedFieldEncoding || (FeatureSet_RepeatedFieldEncoding = {}));
var FeatureSet_Utf8Validation;
(function(FeatureSet_Utf8Validation2) {
  FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.UTF8_VALIDATION_UNKNOWN = 0] = "UTF8_VALIDATION_UNKNOWN", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.VERIFY = 2] = "VERIFY", FeatureSet_Utf8Validation2[FeatureSet_Utf8Validation2.NONE = 3] = "NONE";
})(FeatureSet_Utf8Validation || (FeatureSet_Utf8Validation = {}));
var FeatureSet_MessageEncoding;
(function(FeatureSet_MessageEncoding2) {
  FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.MESSAGE_ENCODING_UNKNOWN = 0] = "MESSAGE_ENCODING_UNKNOWN", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.LENGTH_PREFIXED = 1] = "LENGTH_PREFIXED", FeatureSet_MessageEncoding2[FeatureSet_MessageEncoding2.DELIMITED = 2] = "DELIMITED";
})(FeatureSet_MessageEncoding || (FeatureSet_MessageEncoding = {}));
var FeatureSet_JsonFormat;
(function(FeatureSet_JsonFormat2) {
  FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.JSON_FORMAT_UNKNOWN = 0] = "JSON_FORMAT_UNKNOWN", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.ALLOW = 1] = "ALLOW", FeatureSet_JsonFormat2[FeatureSet_JsonFormat2.LEGACY_BEST_EFFORT = 2] = "LEGACY_BEST_EFFORT";
})(FeatureSet_JsonFormat || (FeatureSet_JsonFormat = {}));
var FeatureSet_EnforceNamingStyle;
(function(FeatureSet_EnforceNamingStyle2) {
  FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.ENFORCE_NAMING_STYLE_UNKNOWN = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE2024 = 1] = "STYLE2024", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE_LEGACY = 2] = "STYLE_LEGACY", FeatureSet_EnforceNamingStyle2[FeatureSet_EnforceNamingStyle2.STYLE2026 = 3] = "STYLE2026";
})(FeatureSet_EnforceNamingStyle || (FeatureSet_EnforceNamingStyle = {}));
var GeneratedCodeInfo_Annotation_Semantic;
(function(GeneratedCodeInfo_Annotation_Semantic2) {
  GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.NONE = 0] = "NONE", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.SET = 1] = "SET", GeneratedCodeInfo_Annotation_Semantic2[GeneratedCodeInfo_Annotation_Semantic2.ALIAS = 2] = "ALIAS";
})(GeneratedCodeInfo_Annotation_Semantic || (GeneratedCodeInfo_Annotation_Semantic = {}));
var Edition;
(function(Edition2) {
  Edition2[Edition2.EDITION_UNKNOWN = 0] = "EDITION_UNKNOWN", Edition2[Edition2.EDITION_LEGACY = 900] = "EDITION_LEGACY", Edition2[Edition2.EDITION_PROTO2 = 998] = "EDITION_PROTO2", Edition2[Edition2.EDITION_PROTO3 = 999] = "EDITION_PROTO3", Edition2[Edition2.EDITION_2023 = 1e3] = "EDITION_2023", Edition2[Edition2.EDITION_2024 = 1001] = "EDITION_2024", Edition2[Edition2.EDITION_2026 = 1002] = "EDITION_2026", Edition2[Edition2.EDITION_UNSTABLE = 9999] = "EDITION_UNSTABLE", Edition2[Edition2.EDITION_1_TEST_ONLY = 1] = "EDITION_1_TEST_ONLY", Edition2[Edition2.EDITION_2_TEST_ONLY = 2] = "EDITION_2_TEST_ONLY", Edition2[Edition2.EDITION_99997_TEST_ONLY = 99997] = "EDITION_99997_TEST_ONLY", Edition2[Edition2.EDITION_99998_TEST_ONLY = 99998] = "EDITION_99998_TEST_ONLY", Edition2[Edition2.EDITION_99999_TEST_ONLY = 99999] = "EDITION_99999_TEST_ONLY", Edition2[Edition2.EDITION_MAX = 2147483647] = "EDITION_MAX";
})(Edition || (Edition = {}));
var SymbolVisibility;
(function(SymbolVisibility2) {
  SymbolVisibility2[SymbolVisibility2.VISIBILITY_UNSET = 0] = "VISIBILITY_UNSET", SymbolVisibility2[SymbolVisibility2.VISIBILITY_LOCAL = 1] = "VISIBILITY_LOCAL", SymbolVisibility2[SymbolVisibility2.VISIBILITY_EXPORT = 2] = "VISIBILITY_EXPORT";
})(SymbolVisibility || (SymbolVisibility = {}));

// node_modules/@bufbuild/protobuf/dist/esm/from-binary.js
function makeReadContext(options) {
  return Object.assign(Object.assign({ readUnknownFields: !0, recursionLimit: 100 }, options), { depth: 0 });
}
function fromBinary(schema, bytes, options) {
  let message = create(schema);
  return compiledReader(schema).read(message, new BinaryReader(bytes), makeReadContext(options), bytes.byteLength), message;
}
var compiledReaders = /* @__PURE__ */ new WeakMap();
function compiledReader(desc) {
  let compiled = compiledReaders.get(desc);
  return compiled === void 0 && (compiled = compileMessage(desc)), compiled;
}
function compileMessage(desc) {
  let descString = String(desc), fieldReaders = /* @__PURE__ */ new Map(), compiled = {
    read: compileMessageReader(descString, fieldReaders),
    readGroup: compileGroupReader(descString, fieldReaders)
  };
  compiledReaders.set(desc, compiled);
  for (let field of desc.fields)
    fieldReaders.set(field.number, compileFieldReader(field));
  return compiled;
}
function compileMessageReader(descString, fieldReaders) {
  return (message, reader, ctx, length) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit)
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    let end = reader.pos + length, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    for (; reader.pos < end; ) {
      let [fieldNo, wireType] = reader.tag(), fieldReader = fieldReaders.get(fieldNo);
      if (fieldReader === void 0) {
        let data = reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
        ctx.readUnknownFields && unknownFields.push({ no: fieldNo, wireType, data });
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
  };
}
function compileGroupReader(descString, fieldReaders) {
  return (message, reader, ctx, fieldNo) => {
    var _a;
    if (++ctx.depth > ctx.recursionLimit)
      throw new Error(`cannot decode ${descString} from binary: maximum recursion depth of ${ctx.recursionLimit} reached`);
    let recordFieldNo, wireType, unknownFields = (_a = message.$unknown) !== null && _a !== void 0 ? _a : [];
    for (; reader.pos < reader.len && ([recordFieldNo, wireType] = reader.tag(), wireType != WireType.EndGroup); ) {
      let fieldReader = fieldReaders.get(recordFieldNo);
      if (fieldReader === void 0) {
        let data = reader.skip(wireType, recordFieldNo, ctx.recursionLimit - ctx.depth);
        ctx.readUnknownFields && unknownFields.push({ no: recordFieldNo, wireType, data });
        continue;
      }
      fieldReader(message, reader, ctx, wireType);
    }
    if (wireType != WireType.EndGroup || recordFieldNo !== fieldNo)
      throw new Error("invalid end group tag");
    unknownFields.length > 0 && (message.$unknown = unknownFields), ctx.depth--;
  };
}
function compileFieldReader(field) {
  switch (field.fieldKind) {
    case "scalar":
      return compileScalarFieldReader(field);
    case "enum":
      return compileEnumFieldReader(field);
    case "message":
      return compileMessageFieldReader(field);
    case "list":
      return compileListFieldReader(field);
    case "map":
      return compileMapFieldReader(field);
  }
}
function compileScalarFieldReader(field) {
  let readScalar = compileScalarReader(field.scalar, field.utf8Validation, field.longAsString), localName = field.localName;
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (message, reader) => {
      message[oneofLocalName] = {
        case: localName,
        value: readScalar(reader)
      };
    };
  }
  return (message, reader) => {
    message[localName] = readScalar(reader);
  };
}
function compileEnumFieldReader(field) {
  var _a;
  let localName = field.localName, oneofLocalName = (_a = field.oneof) === null || _a === void 0 ? void 0 : _a.localName;
  if (field.enum.open)
    return oneofLocalName !== void 0 ? (message, reader) => {
      message[oneofLocalName] = { case: localName, value: reader.int32() };
    } : (message, reader) => {
      message[localName] = reader.int32();
    };
  let values = field.enum.values, fieldNo = field.number;
  return (message, reader, ctx, wireType) => {
    var _a2;
    let val = reader.int32();
    if (values.some((v) => v.number === val))
      oneofLocalName !== void 0 ? message[oneofLocalName] = { case: localName, value: val } : message[localName] = val;
    else if (ctx.readUnknownFields) {
      let bytes = [];
      varint32write(val, bytes);
      let unknownFields = (_a2 = message.$unknown) !== null && _a2 !== void 0 ? _a2 : [];
      unknownFields.push({
        no: fieldNo,
        wireType,
        data: new Uint8Array(bytes)
      }), message.$unknown = unknownFields;
    }
  };
}
function compileMessageFieldReader(field) {
  let localName = field.localName, { toMessage, toLocal } = localMessageMapper(field), readChild = compileChildReader(field);
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (message, reader, ctx) => {
      let oneof = message[oneofLocalName], child = toMessage(oneof.case === localName ? oneof.value : void 0);
      readChild(child, reader, ctx), message[oneofLocalName] = { case: localName, value: toLocal(child) };
    };
  }
  return (message, reader, ctx) => {
    let child = toMessage(message[localName]);
    readChild(child, reader, ctx), message[localName] = toLocal(child);
  };
}
function compileChildReader(field) {
  let compiledChild = compiledReader(field.message);
  if (field.delimitedEncoding) {
    let fieldNo = field.number;
    return (child, reader, ctx) => compiledChild.readGroup(child, reader, ctx, fieldNo);
  }
  return (child, reader, ctx) => compiledChild.read(child, reader, ctx, reader.uint32());
}
function compileListFieldReader(field) {
  let localName = field.localName;
  if (field.listKind == "message") {
    let { toMessage, toLocal } = localMessageMapper(field), readChild = compileChildReader(field);
    return (message, reader, ctx) => {
      let child = toMessage(void 0);
      readChild(child, reader, ctx), message[localName].push(toLocal(child));
    };
  }
  let scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar, longAsString = field.listKind == "scalar" ? field.longAsString : !1, readScalar = compileScalarReader(scalarType, field.utf8Validation, longAsString), packedPossible = scalarType != ScalarType.STRING && scalarType != ScalarType.BYTES;
  return (message, reader, ctx, wireType) => {
    let items = message[localName];
    if (wireType == WireType.LengthDelimited && packedPossible) {
      let end = reader.uint32() + reader.pos;
      for (; reader.pos < end; )
        items.push(readScalar(reader));
    } else
      items.push(readScalar(reader));
  };
}
function compileMapFieldReader(field) {
  let localName = field.localName, readKey = compileScalarReader(field.mapKey, field.utf8Validation, !1), keyZero = scalarZeroValue(field.mapKey, !1), readValue, valueDefault;
  switch (field.mapKind) {
    case "scalar": {
      let scalar = field.scalar, readScalar = compileScalarReader(scalar, field.utf8Validation, !1);
      if (readValue = (reader) => readScalar(reader), scalar == ScalarType.BYTES)
        valueDefault = () => new Uint8Array(0);
      else {
        let zero = scalarZeroValue(scalar, !1);
        valueDefault = () => zero;
      }
      break;
    }
    case "enum": {
      let zero = field.enum.values[0].number;
      readValue = (reader) => reader.int32(), valueDefault = () => zero;
      break;
    }
    case "message": {
      let { toMessage, toLocal } = localMessageMapper(field), readChild = compiledReader(field.message).read;
      readValue = (reader, ctx, existing) => {
        let child = toMessage(existing);
        return readChild(child, reader, ctx, reader.uint32()), toLocal(child);
      }, valueDefault = () => toLocal(toMessage(void 0));
      break;
    }
  }
  return (message, reader, ctx) => {
    let record = message[localName], key2, val, len = reader.uint32(), end = reader.pos + len;
    for (; reader.pos < end; ) {
      let [fieldNo, wireType] = reader.tag();
      switch (fieldNo) {
        case 1:
          key2 = readKey(reader);
          break;
        case 2:
          val = readValue(reader, ctx, val);
          break;
        default:
          reader.skip(wireType, fieldNo, ctx.recursionLimit - ctx.depth);
      }
    }
    key2 === void 0 && (key2 = keyZero), val === void 0 && (val = valueDefault()), setOwn(record, key2, val);
  };
}
function compileScalarReader(type, utf8Validation, longAsString) {
  switch (type) {
    case ScalarType.STRING:
      return (reader) => reader.string(utf8Validation);
    case ScalarType.BOOL:
      return (reader) => reader.bool();
    case ScalarType.DOUBLE:
      return (reader) => reader.double();
    case ScalarType.FLOAT:
      return (reader) => reader.float();
    case ScalarType.INT32:
      return (reader) => reader.int32();
    case ScalarType.INT64:
      return longAsString ? (reader) => String(reader.int64()) : (reader) => reader.int64();
    case ScalarType.UINT64:
      return longAsString ? (reader) => String(reader.uint64()) : (reader) => reader.uint64();
    case ScalarType.FIXED64:
      return longAsString ? (reader) => String(reader.fixed64()) : (reader) => reader.fixed64();
    case ScalarType.BYTES:
      return (reader) => reader.bytes();
    case ScalarType.FIXED32:
      return (reader) => reader.fixed32();
    case ScalarType.SFIXED32:
      return (reader) => reader.sfixed32();
    case ScalarType.SFIXED64:
      return longAsString ? (reader) => String(reader.sfixed64()) : (reader) => reader.sfixed64();
    case ScalarType.SINT64:
      return longAsString ? (reader) => String(reader.sint64()) : (reader) => reader.sint64();
    case ScalarType.UINT32:
      return (reader) => reader.uint32();
    case ScalarType.SINT32:
      return (reader) => reader.sint32();
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js
function fileDesc(b64, imports) {
  var _a;
  let root2 = fromBinary(FileDescriptorProtoSchema, base64Decode(b64));
  return root2.messageType.forEach(restoreJsonNames), root2.dependency = (_a = imports?.map((f) => f.proto.name)) !== null && _a !== void 0 ? _a : [], createEmbeddedFileRegistry(root2, (protoFileName) => imports?.find((f) => f.proto.name === protoFileName)).getFile(root2.name);
}

// node_modules/@bufbuild/protobuf/dist/esm/to-binary.js
var IMPLICIT3 = 2, LEGACY_REQUIRED2 = 3, writeDefaults = {
  writeUnknownFields: !0
};
function makeWriteOptions(options) {
  return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function toBinary(schema, message, options) {
  let writer = new BinaryWriter();
  return compiledWriter(schema)(writer, makeWriteOptions(options), message), writer.finish();
}
var compiledWriters = /* @__PURE__ */ new WeakMap();
function compiledWriter(desc) {
  let compiled = compiledWriters.get(desc);
  return compiled === void 0 && (compiled = compileMessage2(desc)), compiled;
}
function compileMessage2(desc) {
  let typeName = desc.typeName, sortedFields = desc.fields.concat().sort((a, b) => a.number - b.number), foreignField = sortedFields[0], fieldWriters = [], compiled = (writer, opts, message) => {
    if (message.$typeName !== typeName && foreignField !== void 0)
      throw new FieldError(foreignField, `cannot use ${foreignField} with message ${message.$typeName}`, "ForeignFieldError");
    for (let i = 0; i < fieldWriters.length; i++)
      fieldWriters[i](writer, opts, message);
    let unknown = message.$unknown;
    if (unknown !== void 0 && opts.writeUnknownFields)
      for (let i = 0; i < unknown.length; i++) {
        let { no, wireType, data } = unknown[i];
        writer.tag(no, wireType).raw(data);
      }
  };
  compiledWriters.set(desc, compiled);
  for (let field of sortedFields)
    fieldWriters.push(compileField(field));
  return compiled;
}
function compileField(field) {
  switch (field.fieldKind) {
    case "message":
    case "scalar":
    case "enum":
      return compileSingularField(field);
    case "list":
      return compileListField(field);
    case "map":
      return compileMapField(field);
  }
}
function compileSingularField(field) {
  let writeValue = compileSingularValue(field), localName = field.localName;
  if (field.oneof) {
    let oneofLocalName = field.oneof.localName;
    return (writer, opts, message) => {
      let oneof = message[oneofLocalName];
      oneof.case === localName && writeValue(writer, opts, oneof.value);
    };
  }
  if (field.presence != IMPLICIT3) {
    let requiredError = field.presence == LEGACY_REQUIRED2 ? `cannot encode ${field} to binary: required field not set` : void 0;
    return (writer, opts, message) => {
      let value = message[localName];
      if (value !== void 0 && Object.prototype.hasOwnProperty.call(message, localName))
        writeValue(writer, opts, value);
      else if (requiredError !== void 0)
        throw new Error(requiredError);
    };
  }
  if (field.fieldKind == "enum") {
    let zero = field.enum.values[0].number;
    return (writer, opts, message) => {
      let value = message[localName];
      value !== zero && writeValue(writer, opts, value);
    };
  }
  switch (field.scalar) {
    case ScalarType.BOOL:
      return (writer, opts, message) => {
        let value = message[localName];
        value !== !1 && writeValue(writer, opts, value);
      };
    case ScalarType.STRING:
      return (writer, opts, message) => {
        let value = message[localName];
        value !== "" && writeValue(writer, opts, value);
      };
    case ScalarType.BYTES:
      return (writer, opts, message) => {
        let value = message[localName];
        (!(value instanceof Uint8Array) || value.byteLength > 0) && writeValue(writer, opts, value);
      };
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return (writer, opts, message) => {
        let value = message[localName];
        Object.is(value, 0) || writeValue(writer, opts, value);
      };
    default:
      return (writer, opts, message) => {
        let value = message[localName];
        value != 0 && writeValue(writer, opts, value);
      };
  }
}
function compileSingularValue(field) {
  switch (field.fieldKind) {
    case "message": {
      let { toMessage } = localMessageMapper(field), writeChild = compileChildWriter(field);
      return (writer, opts, value) => {
        writeChild(writer, opts, toMessage(value));
      };
    }
    case "scalar":
    case "enum": {
      let scalarType = field.fieldKind == "enum" ? ScalarType.INT32 : field.scalar, fieldNo = field.number, wireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      return (writer, opts, value) => {
        writer.tag(fieldNo, wireType), writeScalar(writer, value);
      };
    }
  }
}
function compileListField(field) {
  let localName = field.localName, fieldNo = field.number;
  switch (field.listKind) {
    case "message": {
      let { toMessage } = localMessageMapper(field), writeChild = compileChildWriter(field);
      return (writer, opts, message) => {
        let items = message[localName];
        for (let i = 0; i < items.length; i++)
          writeChild(writer, opts, toMessage(items[i]));
      };
    }
    case "scalar":
    case "enum": {
      let scalarType = field.listKind == "enum" ? ScalarType.INT32 : field.scalar, writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
      if (field.packed)
        return (writer, opts, message) => {
          let items = message[localName];
          if (items.length != 0) {
            writer.tag(fieldNo, WireType.LengthDelimited).fork();
            for (let i = 0; i < items.length; i++)
              writeScalar(writer, items[i]);
            writer.join();
          }
        };
      let wireType = writeTypeOfScalar(scalarType);
      return (writer, opts, message) => {
        let items = message[localName];
        for (let i = 0; i < items.length; i++)
          writer.tag(fieldNo, wireType), writeScalar(writer, items[i]);
      };
    }
  }
}
function compileMapField(field) {
  let localName = field.localName, fieldNo = field.number, writeKey = compileMapKey(field);
  if (field.mapKind == "message") {
    let { toMessage } = localMessageMapper(field), writeMessage = compiledWriter(field.message);
    return (writer, opts, message) => {
      let record = message[localName], keys = Object.keys(record);
      for (let i = 0; i < keys.length; i++) {
        let key2 = keys[i];
        writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeKey(writer, key2), writer.tag(2, WireType.LengthDelimited).fork(), writeMessage(writer, opts, toMessage(record[key2])), writer.join(), writer.join();
      }
    };
  }
  let scalarType = field.mapKind == "enum" ? ScalarType.INT32 : field.scalar, valueWireType = writeTypeOfScalar(scalarType), writeScalar = compileScalarValue(scalarType, field.parent.typeName, field.name);
  return (writer, opts, message) => {
    let record = message[localName], keys = Object.keys(record);
    for (let i = 0; i < keys.length; i++) {
      let key2 = keys[i];
      writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeKey(writer, key2), writer.tag(2, valueWireType), writeScalar(writer, record[key2]), writer.join();
    }
  };
}
function compileMapKey(field) {
  let wireType = writeTypeOfScalar(field.mapKey), writeScalar = compileScalarValue(field.mapKey, field.parent.typeName, field.name), convertKey = compileMapKeyConverter(field.mapKey);
  return (writer, key2) => {
    writer.tag(1, wireType), writeScalar(writer, convertKey(key2));
  };
}
function compileMapKeyConverter(type) {
  switch (type) {
    case ScalarType.STRING:
      return (key2) => key2;
    case ScalarType.BOOL:
      return (key2) => key2 === "true" ? !0 : key2 === "false" ? !1 : key2;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return (key2) => {
        try {
          return protoInt64.uParse(key2);
        } catch {
          return key2;
        }
      };
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return (key2) => {
        try {
          return protoInt64.parse(key2);
        } catch {
          return key2;
        }
      };
    default:
      return (key2) => {
        let n = Number.parseInt(key2);
        return Number.isFinite(n) ? n : key2;
      };
  }
}
function compileScalarValue(type, messageName, fieldName) {
  let writeScalar = compileScalarWrite(type);
  return (writer, value) => {
    try {
      writeScalar(writer, value);
    } catch (e) {
      throw e instanceof Error ? new Error(`cannot encode field ${messageName}.${fieldName} to binary: ${e.message}`) : e;
    }
  };
}
function compileScalarWrite(type) {
  switch (type) {
    case ScalarType.STRING:
      return (writer, value) => writer.string(value);
    case ScalarType.BOOL:
      return (writer, value) => writer.bool(value);
    case ScalarType.DOUBLE:
      return (writer, value) => writer.double(value);
    case ScalarType.FLOAT:
      return (writer, value) => writer.float(value);
    case ScalarType.INT32:
      return (writer, value) => writer.int32(value);
    case ScalarType.INT64:
      return (writer, value) => writer.int64(value);
    case ScalarType.UINT64:
      return (writer, value) => writer.uint64(value);
    case ScalarType.FIXED64:
      return (writer, value) => writer.fixed64(value);
    case ScalarType.BYTES:
      return (writer, value) => writer.bytes(value);
    case ScalarType.FIXED32:
      return (writer, value) => writer.fixed32(value);
    case ScalarType.SFIXED32:
      return (writer, value) => writer.sfixed32(value);
    case ScalarType.SFIXED64:
      return (writer, value) => writer.sfixed64(value);
    case ScalarType.SINT64:
      return (writer, value) => writer.sint64(value);
    case ScalarType.UINT32:
      return (writer, value) => writer.uint32(value);
    case ScalarType.SINT32:
      return (writer, value) => writer.sint32(value);
  }
}
function compileChildWriter(field) {
  let fieldNo = field.number, writeMessage = compiledWriter(field.message);
  return field.delimitedEncoding ? (writer, opts, child) => {
    writer.tag(fieldNo, WireType.StartGroup), writeMessage(writer, opts, child), writer.tag(fieldNo, WireType.EndGroup);
  } : (writer, opts, child) => {
    writer.tag(fieldNo, WireType.LengthDelimited).fork(), writeMessage(writer, opts, child), writer.join();
  };
}
function writeTypeOfScalar(type) {
  switch (type) {
    case ScalarType.BYTES:
    case ScalarType.STRING:
      return WireType.LengthDelimited;
    case ScalarType.DOUBLE:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      return WireType.Bit64;
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.FLOAT:
      return WireType.Bit32;
    default:
      return WireType.Varint;
  }
}

// lib/generated/bridge/job_pb.ts
var file_job = /* @__PURE__ */ fileDesc("Cglqb2IucHJvdG8SFm9ydG9vbHNfd2FzbS5icmlkZ2UudjEi7gIKE1NvbHZlckJyaWRnZVJlcXVlc3QSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSQAoJcmVzb3VyY2VzGAMgASgLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJSZXNvdXJjZVJlcXVlc3QSGQoPZXhlY3V0ZV9wYXlsb2FkGAogASgMSAASPQoGY2FuY2VsGAsgASgLMisub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJDYW5jZWxSZXF1ZXN0SAASQwoJaW50ZXJydXB0GAwgASgLMi4ub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJJbnRlcnJ1cHRSZXF1ZXN0SAASRQoOY2FsbGJhY2tfcmVwbHkYDSABKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckNhbGxiYWNrUmVwbHlIAEILCglvcGVyYXRpb24iKAoVU29sdmVyUmVzb3VyY2VSZXF1ZXN0Eg8KB3RocmVhZHMYASABKA0iMAoTU29sdmVyQ2FuY2VsUmVxdWVzdBIZChF0YXJnZXRfcmVxdWVzdF9pZBgBIAEoDSIzChZTb2x2ZXJJbnRlcnJ1cHRSZXF1ZXN0EhkKEXRhcmdldF9yZXF1ZXN0X2lkGAEgASgNIjEKFFNvbHZlckpvYkludGVycnVwdGVkEhkKEXRhcmdldF9yZXF1ZXN0X2lkGAEgASgNIj0KFVNvbHZlckNhbGxiYWNrUmVxdWVzdBITCgtjYWxsYmFja19pZBgBIAEoBBIPCgdwYXlsb2FkGAIgASgMIkoKE1NvbHZlckNhbGxiYWNrUmVwbHkSEwoLY2FsbGJhY2tfaWQYASABKAQSDwoHcGF5bG9hZBgCIAEoDBINCgVlcnJvchgDIAEoCSKiBAoUU29sdmVyQnJpZGdlUmVzcG9uc2USEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSDgoGam9iX2lkGAMgASgEEhMKC3NlcXVlbmNlX2lkGAQgASgEEjkKBnN0YXR1cxgKIAEoCzInLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iU3RhdHVzSAASOwoHZmFpbHVyZRgLIAEoCzIoLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iRmFpbHVyZUgAEhcKDWV2ZW50X3BheWxvYWQYDCABKAxIABIYCg5yZXN1bHRfcGF5bG9hZBgNIAEoDEgAEj8KCWNhbmNlbGxlZBgOIAEoCzIqLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVySm9iQ2FuY2VsbGVkSAASOgoFcmVhZHkYDyABKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlcldvcmtlclJlYWR5SAASQwoLaW50ZXJydXB0ZWQYECABKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYkludGVycnVwdGVkSAASSQoQY2FsbGJhY2tfcmVxdWVzdBgRIAEoCzItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuU29sdmVyQ2FsbGJhY2tSZXF1ZXN0SABCCQoHcGF5bG9hZCITChFTb2x2ZXJXb3JrZXJSZWFkeSIvChJTb2x2ZXJKb2JDYW5jZWxsZWQSGQoRdGFyZ2V0X3JlcXVlc3RfaWQYASABKA0iUwoQU29sdmVyRXZlbnRCYXRjaBI/CglyZXNwb25zZXMYASADKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckJyaWRnZVJlc3BvbnNlIs0BCg9Tb2x2ZXJKb2JTdGF0dXMSEgoKcmVxdWVzdF9pZBgBIAEoDRIOCgZzb2x2ZXIYAiABKAkSNQoFc3RhdGUYAyABKA4yJi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlNvbHZlckpvYlN0YXRlEhUKDWNyZWF0ZWRfYXRfbXMYBCABKAQSFQoNc3RhcnRlZF9hdF9tcxgFIAEoBBIZChFhbGxvY2F0ZWRfdGhyZWFkcxgGIAEoDRIWCg5xdWV1ZV9wb3NpdGlvbhgHIAEoDSKiAQoQU29sdmVySm9iRmFpbHVyZRISCgpyZXF1ZXN0X2lkGAEgASgNEg4KBnNvbHZlchgCIAEoCRI3CgRraW5kGAMgASgOMikub3J0b29sc193YXNtLmJyaWRnZS52MS5Tb2x2ZXJGYWlsdXJlS2luZBIPCgdtZXNzYWdlGAQgASgJEg0KBXRyYWNlGAUgASgJEhEKCXJldHJ5YWJsZRgGIAEoCCqKAgoOU29sdmVySm9iU3RhdGUSIAocU09MVkVSX0pPQl9TVEFURV9VTlNQRUNJRklFRBAAEhsKF1NPTFZFUl9KT0JfU1RBVEVfUVVFVUVEEAESHQoZU09MVkVSX0pPQl9TVEFURV9TVEFSVElORxACEhwKGFNPTFZFUl9KT0JfU1RBVEVfUlVOTklORxADEh8KG1NPTFZFUl9KT0JfU1RBVEVfQ0FOQ0VMTElORxAEEh4KGlNPTFZFUl9KT0JfU1RBVEVfQ0FOQ0VMTEVEEAUSHgoaU09MVkVSX0pPQl9TVEFURV9TVUNDRUVERUQQBhIbChdTT0xWRVJfSk9CX1NUQVRFX0ZBSUxFRBAHKucDChFTb2x2ZXJGYWlsdXJlS2luZBIjCh9TT0xWRVJfRkFJTFVSRV9LSU5EX1VOU1BFQ0lGSUVEEAASJgoiU09MVkVSX0ZBSUxVUkVfS0lORF9FWEVDVVRPUl9FUlJPUhABEioKJlNPTFZFUl9GQUlMVVJFX0tJTkRfUlVOVElNRV9MT0FEX0VSUk9SEAISJAogU09MVkVSX0ZBSUxVUkVfS0lORF9XT1JLRVJfQ1JBU0gQAxIrCidTT0xWRVJfRkFJTFVSRV9LSU5EX1NFUlZFUl9ESVNDT05ORUNURUQQBBIfChtTT0xWRVJfRkFJTFVSRV9LSU5EX1RJTUVPVVQQBRIhCh1TT0xWRVJfRkFJTFVSRV9LSU5EX0NBTkNFTExFRBAGEiAKHFNPTFZFUl9GQUlMVVJFX0tJTkRfSU5URVJOQUwQBxInCiNTT0xWRVJfRkFJTFVSRV9LSU5EX0lOVkFMSURfUkVRVUVTVBAIEicKI1NPTFZFUl9GQUlMVVJFX0tJTkRfVU5BVVRIRU5USUNBVEVEEAkSIgoeU09MVkVSX0ZBSUxVUkVfS0lORF9RVUVVRV9GVUxMEAoSKgomU09MVkVSX0ZBSUxVUkVfS0lORF9VTlNVUFBPUlRFRF9TT0xWRVIQC2IGcHJvdG8z"), SolverBridgeRequestSchema = /* @__PURE__ */ messageDesc(file_job, 0), SolverResourceRequestSchema = /* @__PURE__ */ messageDesc(file_job, 1), SolverCancelRequestSchema = /* @__PURE__ */ messageDesc(file_job, 2), SolverInterruptRequestSchema = /* @__PURE__ */ messageDesc(file_job, 3);
var SolverCallbackReplySchema = /* @__PURE__ */ messageDesc(file_job, 6), SolverBridgeResponseSchema = /* @__PURE__ */ messageDesc(file_job, 7);
var SolverEventBatchSchema = /* @__PURE__ */ messageDesc(file_job, 10), SolverJobStatusSchema = /* @__PURE__ */ messageDesc(file_job, 11), SolverJobFailureSchema = /* @__PURE__ */ messageDesc(file_job, 12), SolverJobState = /* @__PURE__ */ ((SolverJobState3) => (SolverJobState3[SolverJobState3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverJobState3[SolverJobState3.QUEUED = 1] = "QUEUED", SolverJobState3[SolverJobState3.STARTING = 2] = "STARTING", SolverJobState3[SolverJobState3.RUNNING = 3] = "RUNNING", SolverJobState3[SolverJobState3.CANCELLING = 4] = "CANCELLING", SolverJobState3[SolverJobState3.CANCELLED = 5] = "CANCELLED", SolverJobState3[SolverJobState3.SUCCEEDED = 6] = "SUCCEEDED", SolverJobState3[SolverJobState3.FAILED = 7] = "FAILED", SolverJobState3))(SolverJobState || {});
var SolverFailureKind = /* @__PURE__ */ ((SolverFailureKind3) => (SolverFailureKind3[SolverFailureKind3.UNSPECIFIED = 0] = "UNSPECIFIED", SolverFailureKind3[SolverFailureKind3.EXECUTOR_ERROR = 1] = "EXECUTOR_ERROR", SolverFailureKind3[SolverFailureKind3.RUNTIME_LOAD_ERROR = 2] = "RUNTIME_LOAD_ERROR", SolverFailureKind3[SolverFailureKind3.WORKER_CRASH = 3] = "WORKER_CRASH", SolverFailureKind3[SolverFailureKind3.SERVER_DISCONNECTED = 4] = "SERVER_DISCONNECTED", SolverFailureKind3[SolverFailureKind3.TIMEOUT = 5] = "TIMEOUT", SolverFailureKind3[SolverFailureKind3.CANCELLED = 6] = "CANCELLED", SolverFailureKind3[SolverFailureKind3.INTERNAL = 7] = "INTERNAL", SolverFailureKind3[SolverFailureKind3.INVALID_REQUEST = 8] = "INVALID_REQUEST", SolverFailureKind3[SolverFailureKind3.UNAUTHENTICATED = 9] = "UNAUTHENTICATED", SolverFailureKind3[SolverFailureKind3.QUEUE_FULL = 10] = "QUEUE_FULL", SolverFailureKind3[SolverFailureKind3.UNSUPPORTED_SOLVER = 11] = "UNSUPPORTED_SOLVER", SolverFailureKind3))(SolverFailureKind || {});

// lib/solver_executor.ts
var DEFAULT_SOLVER_STATUS_INTERVAL_MS = 2e3, SolverJobState2 = SolverJobState, SolverFailureKind2 = SolverFailureKind, SolverExecutorBusyError = class extends Error {
  constructor(solver) {
    super(`${solver} executor already has an active job.`), this.name = "SolverExecutorBusyError";
  }
}, SolverJobCancelledError = class extends Error {
  constructor(solver, requestId) {
    super(`${solver} worker job ${requestId} was cancelled.`), this.name = "AbortError";
  }
};
function createSolverJobStatusEvent(solver, requestId, state3, createdAtMs, startedAtMs = 0n, allocatedThreads = 0, queuePosition = 0) {
  return {
    type: "status",
    status: create(SolverJobStatusSchema, {
      requestId,
      solver,
      state: state3,
      createdAtMs,
      startedAtMs,
      allocatedThreads,
      queuePosition
    })
  };
}
function createSolverFailureEvent(solver, requestId, message, kind = SolverFailureKind2.INTERNAL, trace = "", retryable = !1) {
  return {
    type: "failure",
    failure: create(SolverJobFailureSchema, {
      requestId,
      solver,
      kind,
      message,
      trace,
      retryable
    })
  };
}
function trackPendingEvent(pending, result, onFailure) {
  if (result === void 0) return;
  let tracked = Promise.resolve(result).then(
    () => {
      pending.delete(tracked);
    },
    (error) => {
      pending.delete(tracked), onFailure(error);
    }
  );
  pending.add(tracked);
}

// lib/cloud_executor.ts
var CLOUD_STATUS_URL = "https://or-tools-wasm-api.axelwickman.com/status", CloudExecutorUnavailableError = class extends Error {
  constructor(message = "OR-Tools WASM Cloud execution is not currently available.", options) {
    super(message), this.name = "CloudExecutorUnavailableError", this.cause = options?.cause;
  }
};
function processLike() {
  return globalThis.process;
}
function terminalSupportsColor() {
  let process2 = processLike();
  if (!process2 || optionalEnvironmentVariable("NO_COLOR") !== void 0) return !1;
  let forceColor = optionalEnvironmentVariable("FORCE_COLOR");
  return forceColor !== void 0 ? forceColor !== "0" : process2.stdout?.isTTY === !0;
}
function optionalEnvironmentVariable(name) {
  try {
    return processLike()?.env?.[name];
  } catch {
    return;
  }
}
var CloudExecutor = class {
  constructor(solver, options = {}) {
    this.solver = solver;
    this.nextRequestId = 1;
    this.controllers = /* @__PURE__ */ new Set();
    this.fetchImpl = options.fetch ?? globalThis.fetch, this.log = options.log ?? ((message) => console.info(message)), this.test = options.test === !0;
  }
  async load() {
  }
  execute(_request, options) {
    let requestId = this.nextRequestId++, controller = new AbortController();
    return this.controllers.add(controller), {
      requestId,
      result: this.run(requestId, controller, options),
      cancel: () => this.cancel(requestId, controller, options)
    };
  }
  terminate(reason) {
    for (let controller of this.controllers.values()) controller.abort(reason);
    this.controllers.clear();
  }
  async run(requestId, controller, options) {
    let createdAtMs = BigInt(Date.now()), onEvent = options.onEvent;
    await onEvent(createSolverJobStatusEvent(
      this.solver,
      requestId,
      SolverJobState2.STARTING,
      createdAtMs
    ));
    try {
      let statusMessage = await (await this.fetchImpl(CLOUD_STATUS_URL, {
        method: "POST",
        headers: {
          accept: terminalSupportsColor() ? "text/x-ansi" : "text/plain",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          package: packageName,
          version,
          ...this.test ? { test: !0 } : {}
        }),
        signal: controller.signal
      })).text();
      statusMessage && this.log(statusMessage);
      let error = new CloudExecutorUnavailableError();
      throw await onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error.message,
        SolverFailureKind2.UNSUPPORTED_SOLVER
      )), await onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), error;
    } catch (error) {
      if (error instanceof CloudExecutorUnavailableError) throw error;
      if (controller.signal.aborted) {
        let cancelled = new CloudExecutorUnavailableError(
          "OR-Tools WASM Cloud status request was cancelled.",
          { cause: error }
        );
        throw await onEvent(createSolverFailureEvent(
          this.solver,
          requestId,
          cancelled.message,
          SolverFailureKind2.CANCELLED
        )), await onEvent(createSolverJobStatusEvent(
          this.solver,
          requestId,
          SolverJobState2.CANCELLED,
          createdAtMs
        )), cancelled;
      }
      let unavailable = new CloudExecutorUnavailableError(
        "Could not reach OR-Tools WASM Cloud.",
        { cause: error }
      );
      throw await onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        unavailable.message,
        SolverFailureKind2.EXECUTOR_ERROR
      )), await onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.FAILED,
        createdAtMs
      )), unavailable;
    } finally {
      this.controllers.delete(controller);
    }
  }
  async cancel(requestId, controller, options) {
    this.controllers.has(controller) && (await options.onEvent(createSolverJobStatusEvent(
      this.solver,
      requestId,
      SolverJobState2.CANCELLING,
      BigInt(Date.now())
    )), controller.abort());
  }
};

// lib/browser_threading.ts
var key = /* @__PURE__ */ Symbol.for("or-tools-wasm.single-thread-warning"), host = globalThis, state = () => host[key] ?? (host[key] = { enabled: !0, printed: !1 });
function setSingleThreadWarningEnabled(enabled) {
  state().enabled = enabled;
}
function isSingleThreadedBrowser() {
  return typeof globalThis.crossOriginIsolated == "boolean" && (globalThis.crossOriginIsolated !== !0 || typeof globalThis.SharedArrayBuffer != "function");
}
function warnSingleThreadedBrowser() {
  if (typeof document > "u") return;
  let notice = state();
  if (!(!isSingleThreadedBrowser() || !notice.enabled || notice.printed)) {
    notice.printed = !0;
    try {
      console.warn("OR-Tools WASM is running with one solver thread because cross-origin isolation is unavailable. Automatic execution runs directly and may block the UI. Enable COOP/COEP headers for parallel solving and shared worker callbacks/cancellation. To hide this warning, call setSingleThreadWarningEnabled(false).");
    } catch {
    }
  }
}

// lib/executor_configuration.ts
var isBrowserMainThread = typeof window < "u" && typeof document < "u", isWorkerAvailable = typeof Worker < "u";
function resolveExecutorConfiguration(selection = "auto") {
  let configuration = typeof selection == "string" ? { type: selection } : selection;
  return configuration.type !== "auto" ? ((configuration.type === "direct" || configuration.type === "worker") && warnSingleThreadedBrowser(), configuration) : isSingleThreadedBrowser() ? (warnSingleThreadedBrowser(), { type: "direct" }) : { type: isBrowserMainThread && isWorkerAvailable ? "worker" : "direct" };
}

// lib/cloud_notice.ts
var stateKey = /* @__PURE__ */ Symbol.for("or-tools-wasm.cloud-notice"), host2 = globalThis;
function state2() {
  return host2[stateKey] ?? (host2[stateKey] = { printed: !1 });
}
function setCloudNoticeEnabled(enabled) {
  state2().enabled = enabled;
}
function printCloudNotice(solver) {
  let notice = state2();
  if (notice.printed || !(notice.enabled ?? optionalEnvironmentVariable("ORTOOLS_WASM_CLOUD_NOTICE") !== "0")) return;
  notice.printed = !0;
  let lines = [
    "OR-Tools WASM Cloud",
    "",
    "Build your app. Let us run the solvers.",
    "Send optimization jobs through an API.",
    "We handle the compute, queues, and scaling.",
    "",
    "Explore cloud / early access:",
    "https://or-tools-wasm-api.axelwickman.com/info"
  ];
  if (solver === "cp-sat" || solver === "routing") {
    let label = solver === "cp-sat" ? "CP-SAT" : "Routing";
    lines.push(
      "",
      `Only need ${label}? Use the standalone package:`,
      `npm install ${solver}-wasm`,
      `https://www.npmjs.com/package/${solver}-wasm`
    );
  }
  let width = Math.max(...lines.map((line) => line.length)), border = `+-${"-".repeat(width)}-+`, banner = [border, ...lines.map((line) => `| ${line.padEnd(width)} |`), border].join(`
`);
  try {
    console.info(terminalSupportsColor() ? `\x1B[36m${banner}\x1B[0m` : banner);
  } catch {
  }
}

// lib/solver_job.ts
function createAbortError(signal) {
  if (signal.reason instanceof Error) return signal.reason;
  let message = signal.reason === void 0 ? "The solver job was aborted." : String(signal.reason);
  if (typeof DOMException < "u") return new DOMException(message, "AbortError");
  let error = new Error(message);
  return error.name = "AbortError", error;
}
async function executeSolverJob(executor, request, options) {
  if (options.signal?.aborted) throw createAbortError(options.signal);
  let callbackFailure, nativeCallbackFailure, eventChain = Promise.resolve(), job, observersStopped = !1, releaseObservers, releaseCurrentObserver, observerStop = new Promise((resolve) => {
    releaseObservers = resolve;
  }), stopObservers = () => {
    observersStopped = !0, releaseCurrentObserver?.(), releaseObservers();
  }, failObserver = (error) => {
    callbackFailure || (callbackFailure = { error }, stopObservers(), job ? job.cancel().catch(() => {
    }) : queueMicrotask(() => {
      job?.cancel().catch(() => {
      });
    }));
  }, onEvent = (event) => {
    if (!(observersStopped || options.signal?.aborted)) {
      if (!callbackFailure)
        try {
          options.onEventSync?.(event);
        } catch (error) {
          failObserver(error);
        }
      !options.onEvent || observersStopped || (eventChain = eventChain.then(async () => {
        if (!observersStopped)
          try {
            let observed = options.onEvent(event), cancelled = new Promise((resolve) => {
              observersStopped ? resolve() : releaseCurrentObserver = resolve;
            });
            try {
              await Promise.race([observed, cancelled]);
            } finally {
              releaseCurrentObserver = void 0;
            }
          } catch (error) {
            failObserver(error);
          }
      }));
    }
  };
  job = executor.execute(request, {
    resources: options.resources,
    onDispatch: options.onDispatch,
    onAbandonedResult: options.onAbandonedResult,
    onEvent,
    onCallback: options.onCallback ? (payload) => {
      if (nativeCallbackFailure) throw nativeCallbackFailure.error;
      try {
        return options.onCallback(payload);
      } catch (error) {
        throw nativeCallbackFailure ?? (nativeCallbackFailure = { error }), stopObservers(), error;
      }
    } : void 0
  });
  let abortFailure, onAbort = () => {
    !options.signal || abortFailure || (abortFailure = { error: createAbortError(options.signal) }, stopObservers(), job?.cancel().catch(() => {
    }));
  }, onInterrupt = () => {
    job && (job.interrupt?.() ?? job.cancel()).catch(() => {
    });
  };
  options.interruptSignal?.aborted ? job.interrupt?.().catch(() => {
  }) : options.interruptSignal?.addEventListener("abort", onInterrupt, { once: !0 }), options.signal?.addEventListener("abort", onAbort, { once: !0 }), options.signal?.aborted && onAbort();
  try {
    let response;
    try {
      response = await job.result;
    } catch (error) {
      if (stopObservers(), await Promise.race([eventChain, observerStop]), nativeCallbackFailure) throw nativeCallbackFailure.error;
      if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError" && abortFailure)) {
        if (callbackFailure) throw callbackFailure.error;
        if (abortFailure) throw abortFailure.error;
      }
      throw error;
    }
    if (await Promise.race([eventChain, observerStop]), await options.onSuccess?.(response), nativeCallbackFailure) throw nativeCallbackFailure.error;
    if (callbackFailure) throw callbackFailure.error;
    if (abortFailure) throw abortFailure.error;
    return options.showCloudNotice && printCloudNotice(executor.solver), response;
  } finally {
    stopObservers(), options.signal?.removeEventListener("abort", onAbort), options.interruptSignal?.removeEventListener("abort", onInterrupt);
  }
}

// lib/solver_bridge.ts
function encodeSolverBridgeRequest(input) {
  return toBinary(SolverBridgeRequestSchema, create(SolverBridgeRequestSchema, {
    requestId: input.requestId,
    solver: input.solver,
    resources: create(SolverResourceRequestSchema, {
      threads: input.resources?.threads ?? 0
    }),
    operation: { case: "executePayload", value: input.payload }
  }));
}
function encodeSolverBridgeCancelRequest(requestId, solver, targetRequestId) {
  return toBinary(SolverBridgeRequestSchema, create(SolverBridgeRequestSchema, {
    requestId,
    solver,
    operation: {
      case: "cancel",
      value: create(SolverCancelRequestSchema, { targetRequestId })
    }
  }));
}
function encodeSolverBridgeInterruptRequest(requestId, solver, targetRequestId) {
  return toBinary(SolverBridgeRequestSchema, create(SolverBridgeRequestSchema, {
    requestId,
    solver,
    operation: {
      case: "interrupt",
      value: create(SolverInterruptRequestSchema, { targetRequestId })
    }
  }));
}
function decodeSolverBridgeRequest(bytes) {
  return fromBinary(SolverBridgeRequestSchema, bytes);
}
function encodeSolverBridgeCallbackReply(requestId, solver, callbackId, payload, error = "") {
  return toBinary(SolverBridgeRequestSchema, create(SolverBridgeRequestSchema, {
    requestId,
    solver,
    operation: { case: "callbackReply", value: create(SolverCallbackReplySchema, { callbackId, payload, error }) }
  }));
}
function decodeSolverBridgeResponse(bytes) {
  return fromBinary(SolverBridgeResponseSchema, bytes);
}

// lib/solver_server_executor.ts
var PROTOBUF_CONTENT_TYPE = "application/x-protobuf", EVENT_STREAM_CONTENT_TYPE = "text/event-stream", JOB_ACCEPTED_STATUS = 202, JOB_NOT_READY_STATUS = 204, JOB_STREAM_NOT_READY_STATUS = 409, CALLBACK_POLL_INTERVAL_MS = 20, CALLBACK_REPLY_TIMEOUT_MS = 3e4, JOB_RELEASE_TIMEOUT_MS = 1e3, JOB_STOP_TIMEOUT_MS = 3e4, RemoteSolverError = class extends Error {
  constructor(failure, emitted = !1) {
    super(failure.message);
    this.failure = failure;
    this.emitted = emitted;
    this.name = failure.kind === SolverFailureKind2.CANCELLED ? "AbortError" : "RemoteSolverError", failure.trace && (this.stack = failure.trace);
  }
}, ServerConnectionError = class extends Error {
  constructor(cause) {
    let error = cause;
    super(error instanceof Error ? error.message : String(error));
    this.cause = cause;
    this.name = error instanceof Error ? error.name : "Error", error instanceof Error && (this.stack = error.stack);
  }
}, ServerHttpError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}, CallbackTransportError = class extends Error {
  constructor(cause) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.cause = cause;
  }
};
function bytesBody(bytes) {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
async function delay(ms, signal) {
  let timeout;
  try {
    await withAbortSignal(signal, () => new Promise((resolve) => {
      timeout = setTimeout(resolve, ms);
    }));
  } finally {
    clearTimeout(timeout);
  }
}
async function withRequestDeadline(timeoutMs, message, request, parentSignal) {
  let controller = new AbortController(), onAbort = () => controller.abort(parentSignal.reason);
  parentSignal?.addEventListener("abort", onAbort, { once: !0 }), parentSignal?.aborted && onAbort();
  let timeout = setTimeout(() => {
    let reason = new Error(message);
    reason.name = "TimeoutError", controller.abort(reason);
  }, timeoutMs);
  try {
    return await withAbortSignal(controller.signal, () => request(controller.signal));
  } finally {
    clearTimeout(timeout), parentSignal?.removeEventListener("abort", onAbort);
  }
}
async function withAbortSignal(signal, action) {
  if (signal.aborted) throw new ServerConnectionError(signal.reason);
  let onAbort, aborted = new Promise((_, reject) => {
    onAbort = () => reject(new ServerConnectionError(signal.reason)), signal.addEventListener("abort", onAbort, { once: !0 });
  });
  try {
    let result = await Promise.race([action(), aborted]);
    if (signal.aborted) throw new ServerConnectionError(signal.reason);
    return result;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
function decodeBase64Bytes(value) {
  let binary = globalThis.atob(value), bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}
async function* serverSentEventData(body, signal) {
  let reader = body.getReader(), onAbort = () => {
    reader.cancel(signal.reason).catch(() => {
    });
  };
  signal.addEventListener("abort", onAbort, { once: !0 });
  let decoder = new TextDecoder(), buffer = "";
  try {
    for (; ; ) {
      let chunk = await withAbortSignal(signal, () => reader.read()).catch((error) => {
        throw error instanceof ServerConnectionError ? error : new ServerConnectionError(error);
      });
      buffer += decoder.decode(chunk.value, { stream: !chunk.done }), buffer = buffer.replace(/\r\n/g, `
`);
      let separator = buffer.indexOf(`

`);
      for (; separator >= 0; ) {
        let frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        let data = frame.split(`
`).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join(`
`);
        data && (yield data), separator = buffer.indexOf(`

`);
      }
      if (chunk.done) return;
    }
  } finally {
    signal.removeEventListener("abort", onAbort), reader.cancel().catch(() => {
    }), reader.releaseLock();
  }
}
var SolverServerExecutor = class {
  constructor(codec, configuration) {
    this.codec = codec;
    this.nextRequestId = 1;
    this.solver = codec.solver;
    let value = String(configuration.url);
    this.baseUrl = value.endsWith("/") ? value : `${value}/`, this.headers = { ...configuration.headers }, configuration.authToken && (this.headers.Authorization = `Bearer ${configuration.authToken}`);
    let fetchImpl = configuration.fetch ?? globalThis.fetch;
    if (typeof fetchImpl != "function") throw new Error(`${codec.label} server executor requires fetch().`);
    this.fetchImpl = fetchImpl.bind(globalThis), this.statusIntervalMs = configuration.statusIntervalMs ?? DEFAULT_SOLVER_STATUS_INTERVAL_MS;
  }
  execute(request, options) {
    let requestId = this.nextRequestId++, controller = new AbortController(), finished = !1, cancelled = !1, interrupted = !1, abandoned = !1, terminal = !1, controlController = new AbortController(), stopTimeout, stopRequest, terminalReceived = () => {
      terminal = !0, clearTimeout(stopTimeout), stopTimeout = void 0, controlController.abort();
    }, submissionSettled = !1, rejectSubmission, submissionCancelled = new Promise((_, reject) => {
      rejectSubmission = reject;
    }), submission = this.submit(
      requestId,
      request,
      options.resources,
      options.onAbandonedResult ? void 0 : controller.signal
    ).then((accepted) => (submissionSettled = !0, controller.signal.aborted && accepted.jobId !== 0n && this.cancel(requestId, Promise.resolve(accepted), this.codec.solver === "mathopt").catch(() => {
    }), interrupted && !abandoned && !controller.signal.aborted && stop(!1).catch(() => {
    }), accepted), (error) => {
      throw submissionSettled = !0, error;
    }), submitted = options.onAbandonedResult ? submission : Promise.race([submission, submissionCancelled]), abandon = (reason) => {
      abandoned = !0, clearTimeout(stopTimeout), stopTimeout = void 0, rejectSubmission(new ServerConnectionError(reason));
    }, stop = (abort) => {
      if (finished || terminal) return Promise.resolve();
      if (cancelled || (cancelled = abort), interrupted || (interrupted = !abort), abort && options.onAbandonedResult && !abandoned) {
        let reason2 = new Error(`${this.codec.label} server operation was cancelled.`);
        reason2.name = "AbortError", abandon(reason2);
      }
      if (abandoned) return Promise.resolve();
      if ((submissionSettled || !abort) && stopTimeout === void 0 && (stopTimeout = setTimeout(() => {
        let reason2 = new Error(`${this.codec.label} server ${cancelled ? "cancellation" : "interruption"} did not settle within 30 seconds.`);
        if (reason2.name = cancelled ? "AbortError" : "TimeoutError", options.onAbandonedResult) {
          abandon(reason2);
          return;
        }
        controller.abort(reason2), controlController.abort(reason2);
      }, JOB_STOP_TIMEOUT_MS)), submissionSettled)
        return stopRequest || (stopRequest = this.cancel(requestId, submission, this.codec.solver === "mathopt" || !abort, controlController.signal).catch((error) => {
          if (!terminal) throw error;
        })), stopRequest;
      if (!abort) return Promise.resolve();
      let reason = new Error(`${this.codec.label} server submission was cancelled.`);
      return reason.name = "AbortError", rejectSubmission(new ServerConnectionError(reason)), controller.abort(reason), Promise.resolve();
    }, running = this.run(
      requestId,
      submitted,
      { ...options, onEvent: (event) => abandoned ? void 0 : options.onEvent(event) },
      controller.signal,
      terminalReceived
    ).then(async (result) => (abandoned && await options.onAbandonedResult(this.codec.encodeResult(result)), result)).finally(() => {
      finished = !0, terminalReceived();
    });
    return {
      requestId,
      result: options.onAbandonedResult ? Promise.race([running, submissionCancelled]).catch(async (error) => {
        throw abandoned && await options.onEvent(createSolverFailureEvent(
          this.solver,
          requestId,
          error.message,
          error.name === "TimeoutError" ? SolverFailureKind2.TIMEOUT : SolverFailureKind2.CANCELLED,
          error.stack ?? "",
          error.name === "TimeoutError"
        )), error;
      }) : running,
      cancel: () => stop(!0),
      interrupt: this.codec.solver === "mathopt" || this.codec.solver === "cp-sat" ? () => stop(!1) : void 0
    };
  }
  async load() {
    let response = await this.fetch(new URL("healthz", this.baseUrl), { headers: this.headers });
    if (!response.ok)
      throw new Error(`${this.codec.label} server health check failed (${response.status} ${response.statusText}).`);
  }
  terminate(_reason) {
  }
  async fetch(input, init, acceptLateSubmission = !1) {
    try {
      if (init?.signal?.aborted) throw new ServerConnectionError(init.signal.reason);
      let response = await this.fetchImpl(input, init);
      if (init?.signal?.aborted && !acceptLateSubmission)
        throw response.body?.cancel(init.signal.reason).catch(() => {
        }), new ServerConnectionError(init.signal.reason);
      return response;
    } catch (error) {
      throw error instanceof ServerConnectionError ? error : new ServerConnectionError(error);
    }
  }
  async submit(requestId, request, resources, signal) {
    let bytes = encodeSolverBridgeRequest({
      requestId,
      solver: this.solver,
      payload: this.codec.encodeRequest(request),
      resources
    }), response = await this.fetch(new URL("jobs", this.baseUrl), {
      method: "POST",
      headers: { accept: PROTOBUF_CONTENT_TYPE, "content-type": PROTOBUF_CONTENT_TYPE, ...this.headers },
      body: bytesBody(bytes),
      signal
    }, !0);
    return response.ok || await this.throwHttpError("submission", response), decodeSolverBridgeResponse(new Uint8Array(await response.arrayBuffer()));
  }
  async run(requestId, submitted, options, signal, terminalReceived) {
    try {
      return await withAbortSignal(signal, async () => {
        let accepted = await submitted, immediate = await this.handleResponse(accepted, options, signal, terminalReceived);
        if (immediate !== null) return immediate;
        if (accepted.jobId === 0n) throw new Error(`${this.codec.label} server did not return a job id.`);
        if (options.onCallback) return await this.pollResult(accepted.jobId, accepted.sequenceId, options, signal, terminalReceived);
        let streamed = await this.streamResult(accepted.jobId, accepted.sequenceId, options, signal, terminalReceived);
        return streamed.complete ? streamed.result : await this.pollResult(accepted.jobId, streamed.sequenceId, options, signal, terminalReceived);
      });
    } catch (error) {
      if (error instanceof ServerHttpError && error.status === 410 && !options.onAbandonedResult && this.cancel(requestId, submitted).catch(() => {
      }), error instanceof CallbackTransportError && (this.cancel(requestId, submitted).catch(() => {
      }), error = error.cause), error instanceof RemoteSolverError)
        throw error.emitted || await options.onEvent({ type: "failure", failure: error.failure }), error;
      let kind = SolverFailureKind2.EXECUTOR_ERROR, retryable = !1;
      throw error instanceof ServerConnectionError ? (kind = error.name === "TimeoutError" ? SolverFailureKind2.TIMEOUT : error.name === "AbortError" ? SolverFailureKind2.CANCELLED : SolverFailureKind2.SERVER_DISCONNECTED, retryable = kind !== SolverFailureKind2.CANCELLED) : error instanceof ServerHttpError && (error.status === 401 || error.status === 403 ? kind = SolverFailureKind2.UNAUTHENTICATED : error.status === 408 || error.status === 504 ? kind = SolverFailureKind2.TIMEOUT : error.status === 429 ? kind = SolverFailureKind2.QUEUE_FULL : error.status >= 400 && error.status < 500 && (kind = SolverFailureKind2.INVALID_REQUEST), retryable = error.status === 408 || error.status === 429 || error.status >= 500), await options.onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error instanceof Error ? error.message : String(error),
        kind,
        error instanceof Error ? error.stack ?? "" : "",
        retryable
      )), error;
    }
  }
  async streamResult(jobId, initialSequenceId, options, signal, terminalReceived) {
    let sequenceId = initialSequenceId, response;
    try {
      response = await this.fetch(
        new URL(`jobs/${jobId}/stream?after=${initialSequenceId}`, this.baseUrl),
        { headers: { accept: EVENT_STREAM_CONTENT_TYPE, ...this.headers }, signal }
      );
    } catch (error) {
      if (signal.aborted) throw error;
      return { complete: !1, sequenceId };
    }
    if (response.status === 404 || response.status === JOB_STREAM_NOT_READY_STATUS || response.status === 503)
      return response.body?.cancel().catch(() => {
      }), { complete: !1, sequenceId };
    if (response.ok || await this.throwHttpError("event stream", response), !response.headers.get("content-type")?.includes(EVENT_STREAM_CONTENT_TYPE) || !response.body)
      return { complete: !1, sequenceId };
    try {
      for await (let data of serverSentEventData(response.body, signal)) {
        let outer = decodeSolverBridgeResponse(decodeBase64Bytes(data));
        outer.sequenceId > sequenceId && (sequenceId = outer.sequenceId);
        let terminal = outer.payload.case === "resultPayload" || outer.payload.case === "failure";
        try {
          let result = await this.handleResponse(outer, options, signal, terminalReceived);
          if (result !== null) return { complete: !0, result };
        } finally {
          terminal && await this.release(jobId);
        }
      }
    } catch (error) {
      if (error instanceof ServerConnectionError && !signal.aborted) return { complete: !1, sequenceId };
      throw error;
    }
    return { complete: !1, sequenceId };
  }
  async pollResult(jobId, initialSequenceId, options, signal, terminalReceived) {
    let sequenceId = initialSequenceId, pollIntervalMs = options.onCallback ? Math.min(this.statusIntervalMs, CALLBACK_POLL_INTERVAL_MS) : this.statusIntervalMs, pollImmediately = !0;
    for (; ; ) {
      if (pollImmediately || await delay(pollIntervalMs, signal), signal.aborted) throw new ServerConnectionError(signal.reason);
      pollImmediately = !1;
      let eventsResponse = await this.fetch(
        new URL(`jobs/${jobId}/events?after=${sequenceId}`, this.baseUrl),
        { headers: { accept: PROTOBUF_CONTENT_TYPE, ...this.headers }, signal }
      );
      eventsResponse.ok || await this.throwHttpError("events", eventsResponse);
      let eventBytes = new Uint8Array(await eventsResponse.arrayBuffer());
      if (eventBytes.byteLength) {
        let batch = fromBinary(SolverEventBatchSchema, eventBytes);
        for (let outer2 of batch.responses) {
          outer2.sequenceId > sequenceId && (sequenceId = outer2.sequenceId);
          let terminal2 = outer2.payload.case === "resultPayload" || outer2.payload.case === "failure";
          try {
            let result = await this.handleResponse(outer2, options, signal, terminalReceived);
            if (result !== null) return result;
            outer2.payload.case === "callbackRequest" && (pollImmediately = !0);
          } finally {
            terminal2 && await this.release(jobId);
          }
        }
      }
      if (pollImmediately) continue;
      let outer = await this.fetchJob(new URL(`jobs/${jobId}/result`, this.baseUrl), "result", signal);
      if (!outer) continue;
      let terminal = outer.payload.case === "resultPayload" || outer.payload.case === "failure";
      try {
        let result = await this.handleResponse(outer, options, signal, terminalReceived);
        if (result !== null) return result;
      } finally {
        terminal && await this.release(jobId);
      }
    }
  }
  async release(jobId) {
    await withRequestDeadline(JOB_RELEASE_TIMEOUT_MS, "Solver job cleanup timed out.", async (signal) => {
      await (await this.fetch(new URL(`jobs/${jobId}`, this.baseUrl), {
        method: "DELETE",
        headers: this.headers,
        signal
      })).arrayBuffer();
    }).catch(() => {
    });
  }
  async fetchJob(url, operation, signal) {
    let response = await this.fetch(url, {
      headers: { accept: PROTOBUF_CONTENT_TYPE, ...this.headers },
      signal
    });
    if (response.status === JOB_NOT_READY_STATUS) return null;
    response.status !== JOB_ACCEPTED_STATUS && !response.ok && await this.throwHttpError(operation, response);
    let bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength ? decodeSolverBridgeResponse(bytes) : null;
  }
  async handleResponse(outer, options, signal, terminalReceived) {
    if (signal.aborted) throw new ServerConnectionError(signal.reason);
    if (outer.solver && outer.solver !== this.solver)
      throw new Error(`${this.codec.label} server returned response for solver ${outer.solver}.`);
    switch (outer.payload.case) {
      case "callbackRequest": {
        let request = outer.payload.value;
        if (!options.onCallback) throw new CallbackTransportError(new Error("No solver callback handler registered."));
        let payload = new Uint8Array(), error = "";
        try {
          payload = options.onCallback(request.payload);
        } catch (caught) {
          error = (caught instanceof Error ? caught.message : String(caught)) || "Solver callback failed.";
        }
        let bytes = encodeSolverBridgeCallbackReply(outer.requestId, this.solver, request.callbackId, payload, error);
        try {
          await withRequestDeadline(CALLBACK_REPLY_TIMEOUT_MS, "Solver callback reply timed out.", async (replySignal) => {
            let reply = await this.fetch(new URL(`jobs/${outer.jobId}/callback`, this.baseUrl), {
              method: "POST",
              headers: { "content-type": PROTOBUF_CONTENT_TYPE, ...this.headers },
              body: bytesBody(bytes),
              signal: replySignal
            });
            !reply.ok && reply.status !== 409 && await this.throwHttpError("callback reply", reply), await reply.arrayBuffer();
          }, signal);
        } catch (cause) {
          throw new CallbackTransportError(cause);
        }
        return null;
      }
      case "failure":
        throw terminalReceived(), await options.onEvent({ type: "failure", failure: outer.payload.value }), new RemoteSolverError(outer.payload.value, !0);
      case "status":
        return await options.onEvent({ type: "status", status: outer.payload.value }), null;
      case "eventPayload": {
        let event = this.codec.decodeEvent?.(outer.payload.value);
        return event != null && await options.onEvent(event), null;
      }
      case "resultPayload":
        return terminalReceived(), this.codec.decodeResult(outer.payload.value);
      default:
        return null;
    }
  }
  async cancel(targetRequestId, submitted, nativeInterruption = !1, signal) {
    return withRequestDeadline(JOB_STOP_TIMEOUT_MS, `${this.codec.label} server stop request timed out.`, async (controlSignal) => {
      let accepted = await submitted;
      if (accepted.jobId === 0n) throw new Error(`${this.codec.label} server did not return a job id.`);
      let bytes = (nativeInterruption ? encodeSolverBridgeInterruptRequest : encodeSolverBridgeCancelRequest)(this.nextRequestId++, this.solver, targetRequestId), operation = nativeInterruption ? "interrupt" : "cancel", response = await this.fetch(new URL(`jobs/${accepted.jobId}/${operation}`, this.baseUrl), {
        method: "POST",
        headers: { accept: PROTOBUF_CONTENT_TYPE, "content-type": PROTOBUF_CONTENT_TYPE, ...this.headers },
        body: bytesBody(bytes),
        signal: controlSignal
      });
      response.ok || await this.throwHttpError("cancel", response);
      let responseBytes = new Uint8Array(await response.arrayBuffer());
      if (!responseBytes.byteLength) return;
      let acknowledgement = decodeSolverBridgeResponse(responseBytes);
      if (acknowledgement.payload.case === "failure") throw new RemoteSolverError(acknowledgement.payload.value);
      if (acknowledgement.payload.case !== "interrupted" && acknowledgement.payload.case !== "cancelled" || nativeInterruption !== (acknowledgement.payload.case === "interrupted") || acknowledgement.payload.value.targetRequestId !== targetRequestId)
        throw new Error(`${this.codec.label} server returned an invalid cancellation acknowledgement.`);
    }, signal);
  }
  async throwHttpError(operation, response) {
    if ((response.headers.get("content-type") ?? "").includes(PROTOBUF_CONTENT_TYPE)) {
      let bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength) {
        let outer = decodeSolverBridgeResponse(bytes);
        if (outer.payload.case === "failure") throw new RemoteSolverError(outer.payload.value);
      }
    }
    let detail = await response.text().catch(() => "");
    throw new ServerHttpError(
      `${this.codec.label} server job ${operation} failed (${response.status} ${response.statusText}): ${detail}`,
      response.status
    );
  }
};

// lib/solver_worker.ts
var WORKER_CALLBACK_REPLY_CHUNK_SIZE = 65536, CALLBACK_REPLY_TIMEOUT_MS2 = 3e4;

// lib/worker_helpers.ts
var ManagedWorker = class {
  constructor(options) {
    this.options = options;
    this.worker = null;
    this.workerPromise = null;
    this.rejectCreation = null;
    this.readyPromise = null;
    this.rejectReady = null;
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.generation = 0;
    this.identity = {};
    this.terminationError = new Error("Worker terminated.");
  }
  get runtimeIdentity() {
    return this.identity;
  }
  get isReady() {
    return this.worker !== null && this.readyPromise !== null && this.rejectReady === null;
  }
  async load() {
    let worker = await this.ensureReady();
    this.pendingRequests.size === 0 && worker.unref?.();
  }
  async post(request, onEvent, transfer, beforePost) {
    let generation = this.generation, worker = await this.ensureReady(generation);
    if (generation !== this.generation) throw this.terminationError;
    try {
      beforePost?.();
    } catch (error) {
      throw this.pendingRequests.size === 0 && worker.unref?.(), error;
    }
    return worker.ref?.(), new Promise((resolve, reject) => {
      let id = this.options.getRequestId(request), pending = { resolve, reject, onEvent, eventChain: Promise.resolve() };
      this.pendingRequests.set(id, pending);
      try {
        worker.postMessage(request, transfer);
      } catch (error) {
        this.pendingRequests.get(id) === pending && this.pendingRequests.delete(id), reject(error), this.pendingRequests.size === 0 && worker.unref?.();
      }
    });
  }
  terminate(reason) {
    let error = reason instanceof Error ? reason : new Error(reason ?? "Worker terminated.");
    this.generation++, this.identity = {}, this.terminationError = error, this.options.onTerminate?.(), this.worker?.terminate(), this.worker = null, this.rejectCreation?.(error), this.rejectCreation = null, this.workerPromise = null, this.rejectReady?.(error), this.rejectReady = null, this.readyPromise = null;
    for (let pending of this.pendingRequests.values())
      pending.reject(error);
    this.pendingRequests.clear();
  }
  async ensureReady(generation = this.generation) {
    let worker = await this.ensureWorker(generation);
    if (generation !== this.generation) throw this.terminationError;
    if (!this.readyPromise)
      throw new Error("Worker ready state unavailable.");
    if (await this.readyPromise, generation !== this.generation) throw this.terminationError;
    return worker;
  }
  async ensureWorker(generation) {
    if (generation !== this.generation) throw this.terminationError;
    if (this.worker) return this.worker;
    if (!this.workerPromise) {
      let cancelled = new Promise((_, reject) => {
        this.rejectCreation = reject;
      });
      cancelled.catch(() => {
      });
      let creating = this.options.createWorker().then((worker2) => {
        if (generation !== this.generation)
          throw worker2.terminate(), this.terminationError;
        return worker2;
      });
      this.workerPromise = Promise.race([creating, cancelled]);
    }
    let loading = this.workerPromise, worker;
    try {
      worker = await loading;
    } catch (error) {
      throw this.workerPromise === loading && (this.workerPromise = null, this.rejectCreation = null), error;
    }
    if (generation !== this.generation)
      throw worker.terminate(), this.terminationError;
    return this.worker === worker || (this.worker = worker, this.workerPromise = null, this.rejectCreation = null, this.readyPromise = new Promise((resolve, reject) => {
      this.rejectReady = reject;
      let handleMessage = (message) => {
        if (generation !== this.generation || this.options.handleMessage?.(message)) return;
        if (this.options.isReady?.(message)) {
          this.rejectReady = null, resolve();
          return;
        }
        let id = this.options.getResponseId(message), pending = id === void 0 ? void 0 : this.pendingRequests.get(id);
        if (this.options.isEvent?.(message)) {
          pending?.onEvent && (pending.eventChain = pending.eventChain.then(() => pending.onEvent?.(message)).catch((error) => {
            this.pendingRequests.get(id) === pending && this.pendingRequests.delete(id), pending.reject(error), this.pendingRequests.size === 0 && worker.unref?.();
          }));
          return;
        }
        if (this.options.isError?.(message)) {
          let error = new Error(this.options.errorMessage?.(message) ?? "Worker request failed.");
          pending ? (pending.reject(error), this.pendingRequests.delete(id), this.pendingRequests.size === 0 && worker.unref?.()) : reject(error);
          return;
        }
        pending && (this.pendingRequests.delete(id), pending.eventChain.then(
          () => {
            pending.resolve(message), this.pendingRequests.size === 0 && worker.unref?.();
          },
          (error) => {
            pending.reject(error), this.pendingRequests.size === 0 && worker.unref?.();
          }
        ));
      }, handleError = (errorLike) => {
        if (generation !== this.generation) return;
        let message = this.options.loadErrorMessage?.(errorLike) ?? defaultLoadErrorMessage(errorLike), error = new Error(message);
        Object.defineProperty(error, "cause", { value: errorLike, configurable: !0, writable: !0 }), this.rejectReady = null, reject(error), this.terminate(error);
      };
      typeof worker.on == "function" ? (worker.on("message", handleMessage), worker.on("error", handleError), worker.on("exit", (code) => {
        generation === this.generation && this.terminate(new Error(`Worker exited unexpectedly with code ${code}.`));
      })) : (worker.onmessage = (event) => handleMessage(event.data), worker.onerror = handleError), this.options.isReady || (this.rejectReady = null, resolve());
    }), this.readyPromise.catch(() => {
    })), worker;
  }
};
function defaultLoadErrorMessage(errorLike) {
  return `Worker failed to load: ${errorLike instanceof Error ? errorLike.message : errorLike.error instanceof Error ? errorLike.error.message : errorLike.message || "The runtime blocked or failed to load the worker module."}`;
}
var SolverWorkerExecutor = class {
  constructor(codec, createWorker, supportsSharedCancellation = !1) {
    this.codec = codec;
    this.supportsSharedCancellation = supportsSharedCancellation;
    this.nextRequestId = 1;
    this.activeJob = null;
    this.cancellation = null;
    this.callbackHandler = null;
    this.callbackReplies = /* @__PURE__ */ new Set();
    this.solver = codec.solver, this.worker = new ManagedWorker({
      createWorker,
      isReady: (bytes) => {
        if (!(bytes instanceof Uint8Array)) return !1;
        let response = decodeSolverBridgeResponse(bytes);
        return response.solver === this.solver && response.payload.case === "ready";
      },
      getRequestId: (bytes) => decodeSolverBridgeRequest(bytes).requestId,
      getResponseId: (bytes) => bytes instanceof Uint8Array ? decodeSolverBridgeResponse(bytes).requestId : void 0,
      isEvent: (bytes) => {
        if (!(bytes instanceof Uint8Array)) return !1;
        let payload = decodeSolverBridgeResponse(bytes).payload.case;
        return payload === "eventPayload" || payload === "status";
      },
      handleMessage: (message) => {
        if (message instanceof Uint8Array) return !1;
        if (message.type === "callback") {
          let control = new Int32Array(message.reply, 0, 3);
          if (Atomics.load(control, 0) !== 0) return !0;
          this.callbackReplies.add(control);
          let failureState = -2;
          try {
            let handler = this.callbackHandler;
            if (!handler?.invoke || handler.requestId !== message.requestId || this.activeJob?.cancelled) throw new Error("No active solver callback handler.");
            let reply;
            try {
              reply = handler.invoke(message.payload);
            } catch (error) {
              throw failureState = -1, error;
            }
            if (!(reply instanceof Uint8Array) || reply.length > 2147483647) throw new Error("Invalid solver callback reply.");
            Atomics.store(control, 2, reply.length), this.sendCallbackReply(control, reply);
          } catch {
            Atomics.compareExchange(control, 0, 0, failureState), Atomics.notify(control, 0), this.callbackReplies.delete(control);
          }
          return !0;
        }
        return this.cancellation = message, !0;
      },
      loadErrorMessage: (error) => defaultLoadErrorMessage(error).replace("Worker", `${codec.label} worker`),
      onTerminate: () => {
        this.stopCallbackReplies(), this.cancellation = null;
      }
    });
  }
  execute(request, options) {
    if (this.activeJob) throw new SolverExecutorBusyError(this.codec.label);
    let requestId = this.nextRequestId++, state3 = {
      cancelled: !1,
      dispatched: !1,
      createdAtMs: BigInt(Date.now()),
      request
    };
    return this.activeJob = state3, this.callbackHandler = { requestId, invoke: options.onCallback }, {
      requestId,
      result: this.run(requestId, request, options, state3).finally(() => {
        this.activeJob === state3 && (this.stopCallbackReplies(), this.activeJob = null, this.callbackHandler = null);
      }),
      cancel: () => this.cancel(requestId, options, state3),
      interrupt: () => this.interrupt(state3)
    };
  }
  async load() {
    await this.worker.load();
  }
  terminate(reason) {
    this.worker.terminate(reason ?? `${this.codec.label} worker executor terminated.`);
  }
  stopCallbackReplies() {
    for (let reply of this.callbackReplies)
      Atomics.store(reply, 0, -2), Atomics.notify(reply, 0);
    this.callbackReplies.clear();
  }
  async sendCallbackReply(control, bytes) {
    try {
      let offset = 0, deadline = Date.now() + CALLBACK_REPLY_TIMEOUT_MS2;
      do {
        for (; Atomics.load(control, 0) === 1; ) {
          if (Date.now() >= deadline) {
            Atomics.store(control, 0, -2), Atomics.notify(control, 0);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        if (Atomics.load(control, 0) !== 0) return;
        let count = Math.min(WORKER_CALLBACK_REPLY_CHUNK_SIZE, bytes.length - offset);
        new Uint8Array(control.buffer, 12, count).set(bytes.subarray(offset, offset + count)), Atomics.store(control, 1, count), Atomics.compareExchange(control, 0, 0, 1), Atomics.notify(control, 0), offset += count, deadline = Date.now() + CALLBACK_REPLY_TIMEOUT_MS2;
      } while (offset < bytes.length);
    } finally {
      this.callbackReplies.delete(control);
    }
  }
  async run(requestId, request, options, state3) {
    let bytes = encodeSolverBridgeRequest({
      requestId,
      solver: this.solver,
      payload: this.codec.encodeRequest(request)
    }), failureHandled = !1;
    try {
      let resultBytes = await this.worker.post(bytes, async (eventBytes) => {
        if (!(eventBytes instanceof Uint8Array)) return;
        let outer2 = decodeSolverBridgeResponse(eventBytes);
        if (outer2.payload.case === "status")
          await options.onEvent({ type: "status", status: outer2.payload.value });
        else if (outer2.payload.case === "eventPayload") {
          let event = this.codec.decodeEvent?.(outer2.payload.value);
          event != null && await options.onEvent(event);
        }
      }, [bytes.buffer], () => {
        if (options.onDispatch?.(this.worker.runtimeIdentity), this.cancellation && Atomics.store(
          new Uint8Array(this.cancellation.memory),
          this.cancellation.byteOffset,
          0
        ), state3.cancelled) throw state3.error;
        state3.dispatched = !0;
      });
      if (this.stopCallbackReplies(), !(resultBytes instanceof Uint8Array))
        throw new Error(`${this.codec.label} worker returned an invalid message.`);
      if (state3.cancelled) throw state3.error;
      let outer = decodeSolverBridgeResponse(resultBytes);
      if (outer.payload.case === "failure") {
        failureHandled = !0, await options.onEvent({ type: "failure", failure: outer.payload.value });
        let error = new Error(outer.payload.value.message);
        throw outer.payload.value.trace && (error.stack = outer.payload.value.trace), error;
      }
      if (outer.payload.case !== "resultPayload")
        throw new Error(
          `${this.codec.label} worker returned unexpected response: ${outer.payload.case ?? "empty"}`
        );
      return this.codec.decodeResult(outer.payload.value);
    } catch (error) {
      throw this.stopCallbackReplies(), state3.cancelled ? (await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.CANCELLED,
        state3.createdAtMs
      )), state3.error ?? error) : (failureHandled || await options.onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error instanceof Error ? error.message : String(error),
        SolverFailureKind2.WORKER_CRASH,
        error instanceof Error ? error.stack ?? "" : "",
        !0
      )), error);
    }
  }
  async interrupt(state3) {
    if (this.activeJob !== state3) return;
    if (!(typeof this.supportsSharedCancellation == "function" ? this.supportsSharedCancellation(state3.request) : this.supportsSharedCancellation)) throw new Error(`${this.codec.label} worker does not support native interruption.`);
    if (await this.worker.load(), !this.cancellation) throw new Error(`${this.codec.label} worker did not provide an interruption signal.`);
    Atomics.store(new Uint8Array(this.cancellation.memory), this.cancellation.byteOffset, 1);
  }
  async cancel(targetRequestId, options, state3) {
    if (this.activeJob !== state3 || state3.cancelled) return;
    if (!state3.dispatched) {
      state3.cancelled = !0, state3.error = new SolverJobCancelledError(this.codec.label, targetRequestId), this.worker.isReady || this.worker.terminate(state3.error);
      return;
    }
    if (this.codec.solver === "mathopt") return this.interrupt(state3);
    if (this.codec.solver === "mp-solver" && ["sessionCreate", "sessionRun", "sessionClose"].includes(state3.request.type ?? "")) {
      (typeof this.supportsSharedCancellation == "function" ? this.supportsSharedCancellation(state3.request) : this.supportsSharedCancellation) && await this.interrupt(state3);
      return;
    }
    if (state3.cancelled = !0, state3.error = new SolverJobCancelledError(this.codec.label, targetRequestId), await options.onEvent(createSolverJobStatusEvent(
      this.solver,
      targetRequestId,
      SolverJobState2.CANCELLING,
      state3.createdAtMs
    )), !(typeof this.supportsSharedCancellation == "function" ? this.supportsSharedCancellation(state3.request) : this.supportsSharedCancellation) || isSingleThreadedBrowser() && !this.cancellation) {
      this.worker.terminate(state3.error);
      return;
    }
    if (await this.worker.load(), !this.cancellation)
      throw new Error(`${this.codec.label} worker did not provide a cancellation signal.`);
    Atomics.store(
      new Uint8Array(this.cancellation.memory),
      this.cancellation.byteOffset,
      1
    );
  }
};

// lib/wasm_runtime_lock.ts
async function withWasmRuntimeLock(module, run) {
  let previous = module.__ortoolsNativeCallTail ?? Promise.resolve(), release, current = new Promise((resolve) => {
    release = resolve;
  });
  module.__ortoolsNativeCallTail = current, await previous;
  try {
    return await run();
  } finally {
    release(), module.__ortoolsNativeCallTail === current && delete module.__ortoolsNativeCallTail;
  }
}

// lib/wasm_memory.ts
function allocateWasm(module, size) {
  let pointer = module._malloc(size);
  if (!pointer) throw new Error("Could not allocate WASM memory.");
  return pointer;
}
function allocateWasmBytes(module, bytes, minimumSize = 0) {
  let size = Math.max(bytes?.length ?? 0, minimumSize);
  if (!size) return 0;
  let pointer = allocateWasm(module, size);
  try {
    return bytes && module.HEAPU8.set(bytes, pointer), pointer;
  } catch (error) {
    throw module._free(pointer), error;
  }
}
async function withWasmAllocations(module, use) {
  let pointers = [];
  try {
    return await use((bytes, minimumSize) => {
      let pointer = allocateWasmBytes(module, bytes, minimumSize);
      return pointer && pointers.push(pointer), pointer;
    });
  } finally {
    for (let pointer of pointers) module._free(pointer);
  }
}
async function withWasmCString(module, value, use) {
  let pointer = allocateWasmBytes(
    module,
    new TextEncoder().encode(`${value}\0`)
  );
  try {
    return await use(pointer);
  } finally {
    module._free(pointer);
  }
}

// lib/routing/direct_executor.ts
import { loadRoutingRuntime } from "./runtime/routing.js";

// lib/int64.ts
var INT64_MIN = -9223372036854775808n, INT64_MAX = 9223372036854775807n;
function toInt64(value, label = "integer") {
  let exact;
  if (typeof value == "number") {
    if (!Number.isSafeInteger(value))
      throw new RangeError(`${label} must be a safe integer or bigint, got ${value}`);
    exact = BigInt(value);
  } else if (typeof value == "bigint")
    exact = value;
  else
    throw new TypeError(`${label} must be a safe integer or bigint`);
  if (exact < INT64_MIN || exact > INT64_MAX)
    throw new RangeError(`${label} is outside signed int64 range: ${exact}`);
  return exact;
}
function toIndex(value, label = "index", maximum = Number.MAX_SAFE_INTEGER) {
  let exact = toInt64(value, label);
  if (exact < 0n || exact > BigInt(maximum))
    throw new RangeError(`${label} is outside range 0..${maximum}: ${exact}`);
  return Number(exact);
}
function asNumber(value, label = "integer") {
  let number = Number(toInt64(value, label));
  if (!Number.isSafeInteger(number))
    throw new RangeError(`${label} cannot be represented as a safe JavaScript number: ${value}`);
  return number;
}

// lib/generated/bridge/routing_pb.ts
var file_routing = /* @__PURE__ */ fileDesc("Cg1yb3V0aW5nLnByb3RvEhZvcnRvb2xzX3dhc20uYnJpZGdlLnYxIloKDVJvdXRpbmdNYXRyaXgSDgoGdmFsdWVzGAEgAygDEhEKCWRpbWVuc2lvbhgCIAEoBRIXCg9yb3V0aW5nX2luZGljZXMYAyABKAgSDQoFdW5hcnkYBCABKAgiqAEKE1JvdXRpbmdBZGREaW1lbnNpb24SPQoOdHJhbnNpdF9tYXRyaXgYASABKAsyJS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNYXRyaXgSEQoJc2xhY2tfbWF4GAIgASgDEhAKCGNhcGFjaXR5GAMgASgDEh8KF2ZpeF9zdGFydF9jdW11bF90b196ZXJvGAQgASgIEgwKBG5hbWUYBSABKAkivQEKJlJvdXRpbmdBZGREaW1lbnNpb25XaXRoVmVoaWNsZUNhcGFjaXR5Ej0KDnRyYW5zaXRfbWF0cml4GAEgASgLMiUub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTWF0cml4EhEKCXNsYWNrX21heBgCIAEoAxISCgpjYXBhY2l0aWVzGAMgAygDEh8KF2ZpeF9zdGFydF9jdW11bF90b196ZXJvGAQgASgIEgwKBG5hbWUYBSABKAkivQEKJlJvdXRpbmdBZGREaW1lbnNpb25XaXRoVmVoaWNsZVRyYW5zaXRzEj8KEHRyYW5zaXRfbWF0cmljZXMYASADKAsyJS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNYXRyaXgSEQoJc2xhY2tfbWF4GAIgASgDEhAKCGNhcGFjaXR5GAMgASgDEh8KF2ZpeF9zdGFydF9jdW11bF90b196ZXJvGAQgASgIEgwKBG5hbWUYBSABKAkiyQEKMFJvdXRpbmdBZGREaW1lbnNpb25XaXRoVmVoaWNsZVRyYW5zaXRBbmRDYXBhY2l0eRI/ChB0cmFuc2l0X21hdHJpY2VzGAEgAygLMiUub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTWF0cml4EhEKCXNsYWNrX21heBgCIAEoAxISCgpjYXBhY2l0aWVzGAMgAygDEh8KF2ZpeF9zdGFydF9jdW11bF90b196ZXJvGAQgASgIEgwKBG5hbWUYBSABKAkiNgoeUm91dGluZ1BpZWNld2lzZUxpbmVhckZ1bmN0aW9uEgkKAXgYASADKAMSCQoBeRgCIAMoAyKSAQobUm91dGluZ1N0YXRlRGVwZW5kZW50TWF0cml4EhQKDGRvbWFpbl9zdGFydBgBIAEoAxISCgpkb21haW5fZW5kGAIgASgDEkkKCWZ1bmN0aW9ucxgDIAMoCzI2Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1BpZWNld2lzZUxpbmVhckZ1bmN0aW9uIrYCChxSb3V0aW5nQWRkRGVwZW5kZW50RGltZW5zaW9uEj8KEHRyYW5zaXRfbWF0cmljZXMYASADKAsyJS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNYXRyaXgSTwoSZGVwZW5kZW50X21hdHJpY2VzGAIgAygLMjMub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU3RhdGVEZXBlbmRlbnRNYXRyaXgSGwoOYmFzZV9kaW1lbnNpb24YAyABKAlIAIgBARIRCglzbGFja19tYXgYBCABKAMSEgoKY2FwYWNpdGllcxgFIAMoAxIfChdmaXhfc3RhcnRfY3VtdWxfdG9femVybxgGIAEoCBIMCgRuYW1lGAcgASgJQhEKD19iYXNlX2RpbWVuc2lvbiKTAQobUm91dGluZ0FkZENvbnN0YW50RGltZW5zaW9uEg0KBXZhbHVlGAEgASgDEhAKCGNhcGFjaXR5GAIgASgDEh8KF2ZpeF9zdGFydF9jdW11bF90b196ZXJvGAMgASgIEgwKBG5hbWUYBCABKAkSFgoJc2xhY2tfbWF4GAUgASgDSACIAQFCDAoKX3NsYWNrX21heCJsChlSb3V0aW5nQWRkVmVjdG9yRGltZW5zaW9uEg4KBnZhbHVlcxgBIAMoAxIQCghjYXBhY2l0eRgCIAEoAxIfChdmaXhfc3RhcnRfY3VtdWxfdG9femVybxgDIAEoCBIMCgRuYW1lGAQgASgJIpMBChlSb3V0aW5nQWRkTWF0cml4RGltZW5zaW9uEjUKBm1hdHJpeBgBIAEoCzIlLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01hdHJpeBIQCghjYXBhY2l0eRgCIAEoAxIfChdmaXhfc3RhcnRfY3VtdWxfdG9femVybxgDIAEoCBIMCgRuYW1lGAQgASgJIikKEVJvdXRpbmdTd2VlcFBvaW50EgkKAXgYASABKAUSCQoBeRgCIAEoBSJUChdSb3V0aW5nU2V0U3dlZXBBcnJhbmdlchI5CgZwb2ludHMYASADKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTd2VlcFBvaW50IjMKG1JvdXRpbmdPcmRlcmVkQWN0aXZpdHlHcm91cBIUCgxkaXNqdW5jdGlvbnMYASADKAUiugEKFVJvdXRpbmdBZGREaXNqdW5jdGlvbhIPCgdpbmRpY2VzGAEgAygDEhQKB3BlbmFsdHkYAiABKANIAIgBARIcCg9tYXhfY2FyZGluYWxpdHkYAyABKANIAYgBARIiChVwZW5hbHR5X2Nvc3RfYmVoYXZpb3IYBCABKAVIAogBAUIKCghfcGVuYWx0eUISChBfbWF4X2NhcmRpbmFsaXR5QhgKFl9wZW5hbHR5X2Nvc3RfYmVoYXZpb3IiPwobUm91dGluZ0FkZFBpY2t1cEFuZERlbGl2ZXJ5Eg4KBnBpY2t1cBgBIAEoAxIQCghkZWxpdmVyeRgCIAEoAyJbCh9Sb3V0aW5nQWRkUGlja3VwQW5kRGVsaXZlcnlTZXRzEhoKEnBpY2t1cF9kaXNqdW5jdGlvbhgBIAEoBRIcChRkZWxpdmVyeV9kaXNqdW5jdGlvbhgCIAEoBSJeCiBSb3V0aW5nU2V0UGlja3VwVG9EZWxpdmVyeUxpbWl0cxIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRISCgpwYWlyX2luZGV4GAIgASgFEg4KBmxpbWl0cxgDIAMoAyJCCiNSb3V0aW5nQWRkVmVoaWNsZUVxdWFsaXR5Q29uc3RyYWludBIMCgRsZWZ0GAEgASgDEg0KBXJpZ2h0GAIgASgDIlsKJFJvdXRpbmdBZGRDdW11bExlc3NPckVxdWFsQ29uc3RyYWludBIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRIMCgRsZWZ0GAIgASgDEg0KBXJpZ2h0GAMgASgDIjUKFFJvdXRpbmdTZXROZXh0VmFsdWVzEg0KBWluZGV4GAEgASgDEg4KBnZhbHVlcxgCIAMoAyI4ChdSb3V0aW5nU2V0VmVoaWNsZVZhbHVlcxINCgVpbmRleBgBIAEoAxIOCgZ2YWx1ZXMYAiADKAUiRAohUm91dGluZ1NldEFsbG93ZWRWZWhpY2xlc0ZvckluZGV4EhAKCHZlaGljbGVzGAEgAygFEg0KBWluZGV4GAIgASgDIlwKFVJvdXRpbmdTZXRTbGFja0JvdW5kcxIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRINCgVpbmRleBgCIAEoAxINCgVsb3dlchgDIAEoAxINCgV1cHBlchgEIAEoAyI3ChZSb3V0aW5nU2V0QWN0aXZlVmFsdWVzEg0KBWluZGV4GAEgASgDEg4KBnZhbHVlcxgCIAMoBSKkAQoYUm91dGluZ1NldERpbWVuc2lvblZhbHVlEhYKDmRpbWVuc2lvbl9uYW1lGAEgASgJEj8KBGtpbmQYAiABKA4yMS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdEaW1lbnNpb25WYWx1ZUtpbmQSDQoFdmFsdWUYAyABKAMSFAoHdmVoaWNsZRgEIAEoBUgAiAEBQgoKCF92ZWhpY2xlIlwKFVJvdXRpbmdTZXRDdW11bEJvdW5kcxIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRINCgVpbmRleBgCIAEoAxINCgVsb3dlchgDIAEoAxINCgV1cHBlchgEIAEoAyJ/ChhSb3V0aW5nQWRkTm9kZVByZWNlZGVuY2USFgoOZGltZW5zaW9uX25hbWUYASABKAkSDQoFZmlyc3QYAiABKAMSDgoGc2Vjb25kGAMgASgDEg4KBm9mZnNldBgEIAEoAxIcChRwZXJmb3JtZWRfY29uc3RyYWludBgFIAEoBSJkChxSb3V0aW5nU2V0U29mdFNwYW5VcHBlckJvdW5kEhYKDmRpbWVuc2lvbl9uYW1lGAEgASgJEg0KBWJvdW5kGAIgASgDEgwKBGNvc3QYAyABKAMSDwoHdmVoaWNsZRgEIAEoBSJxCilSb3V0aW5nU2V0UXVhZHJhdGljQ29zdFNvZnRTcGFuVXBwZXJCb3VuZBIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRINCgVib3VuZBgCIAEoAxIMCgRjb3N0GAMgASgDEg8KB3ZlaGljbGUYBCABKAUihgEKJFJvdXRpbmdTZXRBcmNDb3N0RXZhbHVhdG9yT2ZWZWhpY2xlcxI9Cg50cmFuc2l0X21hdHJpeBgBIAEoCzIlLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01hdHJpeBIQCgh2ZWhpY2xlcxgDIAMoBUoECAIQA1IHdmVoaWNsZSJ0ChhSb3V0aW5nU2V0Q3VtdWxTb2Z0Qm91bmQSFgoOZGltZW5zaW9uX25hbWUYASABKAkSDQoFaW5kZXgYAiABKAMSDQoFYm91bmQYAyABKAMSEwoLY29lZmZpY2llbnQYBCABKAMSDQoFbG93ZXIYBSABKAgiMgofUm91dGluZ1NldE1heGltdW1BY3RpdmVWZWhpY2xlcxIPCgdtYXhpbXVtGAEgASgFIjsKGlJvdXRpbmdTZXRGaXhlZFZlaGljbGVDb3N0EgwKBGNvc3QYASABKAMSDwoHdmVoaWNsZRgCIAEoBSJVCh9Sb3V0aW5nU2V0QW1vcnRpemVkVmVoaWNsZUNvc3RzEg4KBmxpbmVhchgBIAEoAxIRCglxdWFkcmF0aWMYAiABKAMSDwoHdmVoaWNsZRgDIAEoBSJCCh5Sb3V0aW5nU2V0VmVoaWNsZVVzZWRXaGVuRW1wdHkSDwoHaXNfdXNlZBgBIAEoCBIPCgd2ZWhpY2xlGAIgASgFIkQKI1JvdXRpbmdBZGRTb2Z0U2FtZVZlaGljbGVDb25zdHJhaW50Eg8KB2luZGljZXMYASADKAMSDAoEY29zdBgCIAEoAyJBCh5Sb3V0aW5nU2V0UGlja3VwRGVsaXZlcnlQb2xpY3kSDgoGcG9saWN5GAEgASgFEg8KB3ZlaGljbGUYAiABKAUiQgoTUm91dGluZ1NldFZpc2l0VHlwZRINCgVpbmRleBgBIAEoAxIMCgR0eXBlGAIgASgFEg4KBnBvbGljeRgDIAEoBSJBCiFSb3V0aW5nQWRkSGFyZFR5cGVJbmNvbXBhdGliaWxpdHkSDQoFdHlwZTEYASABKAUSDQoFdHlwZTIYAiABKAUiRQolUm91dGluZ0FkZFRlbXBvcmFsVHlwZUluY29tcGF0aWJpbGl0eRINCgV0eXBlMRgBIAEoBRINCgV0eXBlMhgCIAEoBSKZAQoZUm91dGluZ0FkZFR5cGVSZXF1aXJlbWVudBJACgRraW5kGAEgASgOMjIub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVHlwZVJlcXVpcmVtZW50S2luZBIWCg5kZXBlbmRlbnRfdHlwZRgCIAEoBRIiChpyZXF1aXJlZF90eXBlX2FsdGVybmF0aXZlcxgDIAMoBSKEAgoTUm91dGluZ0FkZEZpbmFsaXplchJCCg12YXJpYWJsZV9raW5kGAEgASgOMisub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVmFyaWFibGVLaW5kEhYKDmRpbWVuc2lvbl9uYW1lGAIgASgJEg0KBWluZGV4GAMgASgDEjoKBGtpbmQYBCABKA4yLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdGaW5hbGl6ZXJLaW5kEg4KBnRhcmdldBgFIAEoAxITCgZ3ZWlnaHQYBiABKANIAIgBARIWCg5yZXNvdXJjZV9ncm91cBgHIAEoBUIJCgdfd2VpZ2h0IpQBChhSb3V0aW5nVmFyaWFibGVSZWZlcmVuY2USOQoEa2luZBgBIAEoDjIrLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1ZhcmlhYmxlS2luZBIWCg5kaW1lbnNpb25fbmFtZRgCIAEoCRINCgVpbmRleBgDIAEoAxIWCg5yZXNvdXJjZV9ncm91cBgEIAEoBSJoChJSb3V0aW5nU2V0VGFidVZhcnMSQwoJdmFyaWFibGVzGAEgAygLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVmFyaWFibGVSZWZlcmVuY2USDQoFcmVzZXQYAiABKAgixAEKE1JvdXRpbmdNb2RpZnlEb21haW4SQgoIdmFyaWFibGUYASABKAsyMC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdWYXJpYWJsZVJlZmVyZW5jZRI7CgZhY3Rpb24YAiABKA4yKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdEb21haW5BY3Rpb24SDQoFbG93ZXIYAyABKAMSDQoFdXBwZXIYBCABKAMSDgoGdmFsdWVzGAUgAygDImwKEVJvdXRpbmdMaW5lYXJUZXJtEkIKCHZhcmlhYmxlGAEgASgLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVmFyaWFibGVSZWZlcmVuY2USEwoLY29lZmZpY2llbnQYAiABKAMiYwoXUm91dGluZ0xpbmVhckV4cHJlc3Npb24SOAoFdGVybXMYASADKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdMaW5lYXJUZXJtEg4KBm9mZnNldBgCIAEoAyKsAQoXUm91dGluZ0xpbmVhckNvbXBhcmlzb24SPQoEbGVmdBgBIAEoCzIvLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0xpbmVhckV4cHJlc3Npb24SPgoFcmlnaHQYAiABKAsyLy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdMaW5lYXJFeHByZXNzaW9uEhIKCmNvbXBhcmlzb24YAyABKAUiwgIKGlJvdXRpbmdBZGRMaW5lYXJDb25zdHJhaW50Ej0KBGxlZnQYASABKAsyLy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdMaW5lYXJFeHByZXNzaW9uEj4KBXJpZ2h0GAIgASgLMi8ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTGluZWFyRXhwcmVzc2lvbhISCgpjb21wYXJpc29uGAMgASgFEkMKCmNvbmRpdGlvbnMYBCADKAsyLy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdMaW5lYXJDb21wYXJpc29uEkwKEmJvb2xlYW5fY29uZGl0aW9ucxgFIAMoCzIwLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Jvb2xlYW5FeHByZXNzaW9uIkwKE1JvdXRpbmdBcmNDb3N0UXVlcnkSEgoKZnJvbV9pbmRleBgBIAEoAxIQCgh0b19pbmRleBgCIAEoAxIPCgd2ZWhpY2xlGAMgASgFIrwBChJSb3V0aW5nRG9tYWluUXVlcnkSQgoIdmFyaWFibGUYASABKAsyMC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdWYXJpYWJsZVJlZmVyZW5jZRIbCg5jb250YWluc192YWx1ZRgCIAEoA0gAiAEBEh0KEHNvZnRfbG93ZXJfYm91bmQYAyABKAhIAYgBAUIRCg9fY29udGFpbnNfdmFsdWVCEwoRX3NvZnRfbG93ZXJfYm91bmQimAEKE1JvdXRpbmdEb21haW5SZXN1bHQSCwoDbWluGAEgASgDEgsKA21heBgCIAEoAxIMCgRzaXplGAMgASgEEg0KBWJvdW5kGAQgASgIEhUKCGNvbnRhaW5zGAUgASgISACIAQESFwoKc29mdF9ib3VuZBgGIAEoA0gBiAEBQgsKCV9jb250YWluc0INCgtfc29mdF9ib3VuZCLAJgoVUm91dGluZ01vZGVsT3BlcmF0aW9uEkQKDWFkZF9kaW1lbnNpb24YASABKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGREaW1lbnNpb25IABJtCiNhZGRfZGltZW5zaW9uX3dpdGhfdmVoaWNsZV9jYXBhY2l0eRgCIAEoCzI+Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZERpbWVuc2lvbldpdGhWZWhpY2xlQ2FwYWNpdHlIABJtCiNhZGRfZGltZW5zaW9uX3dpdGhfdmVoaWNsZV90cmFuc2l0cxgDIAEoCzI+Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZERpbWVuc2lvbldpdGhWZWhpY2xlVHJhbnNpdHNIABJVChZhZGRfY29uc3RhbnRfZGltZW5zaW9uGAQgASgLMjMub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkQ29uc3RhbnREaW1lbnNpb25IABJRChRhZGRfdmVjdG9yX2RpbWVuc2lvbhgFIAEoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFZlY3RvckRpbWVuc2lvbkgAElEKFGFkZF9tYXRyaXhfZGltZW5zaW9uGAYgASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkTWF0cml4RGltZW5zaW9uSAASSAoPYWRkX2Rpc2p1bmN0aW9uGAcgASgLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkRGlzanVuY3Rpb25IABJWChdhZGRfcGlja3VwX2FuZF9kZWxpdmVyeRgIIAEoCzIzLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFBpY2t1cEFuZERlbGl2ZXJ5SAASZgofYWRkX3ZlaGljbGVfZXF1YWxpdHlfY29uc3RyYWludBgJIAEoCzI7Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFZlaGljbGVFcXVhbGl0eUNvbnN0cmFpbnRIABJqCiJhZGRfY3VtdWxfbGVzc19vcl9lcXVhbF9jb25zdHJhaW50GAogASgLMjwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkQ3VtdWxMZXNzT3JFcXVhbENvbnN0cmFpbnRIABJZChlzZXRfc29mdF9zcGFuX3VwcGVyX2JvdW5kGAsgASgLMjQub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0U29mdFNwYW5VcHBlckJvdW5kSAASdQooc2V0X3F1YWRyYXRpY19jb3N0X3NvZnRfc3Bhbl91cHBlcl9ib3VuZBgMIAEoCzJBLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFF1YWRyYXRpY0Nvc3RTb2Z0U3BhblVwcGVyQm91bmRIABJqCiJzZXRfYXJjX2Nvc3RfZXZhbHVhdG9yX29mX3ZlaGljbGVzGA0gASgLMjwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0QXJjQ29zdEV2YWx1YXRvck9mVmVoaWNsZXNIABJPChNhZGRfbm9kZV9wcmVjZWRlbmNlGA4gASgLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkTm9kZVByZWNlZGVuY2VIABJJChBzZXRfY3VtdWxfYm91bmRzGA8gASgLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0Q3VtdWxCb3VuZHNIABJjCh5zZXRfYWxsb3dlZF92ZWhpY2xlc19mb3JfaW5kZXgYECABKAsyOS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTZXRBbGxvd2VkVmVoaWNsZXNGb3JJbmRleEgAEk0KEnNldF92ZWhpY2xlX3ZhbHVlcxgRIAEoCzIvLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFZlaGljbGVWYWx1ZXNIABJHCg9zZXRfbmV4dF92YWx1ZXMYEiABKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTZXROZXh0VmFsdWVzSAASSQoQc2V0X3NsYWNrX2JvdW5kcxgTIAEoCzItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFNsYWNrQm91bmRzSAASSwoRc2V0X2FjdGl2ZV92YWx1ZXMYFCABKAsyLi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTZXRBY3RpdmVWYWx1ZXNIABJPChNzZXRfZGltZW5zaW9uX3ZhbHVlGBUgASgLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0RGltZW5zaW9uVmFsdWVIABJQChRzZXRfY3VtdWxfc29mdF9ib3VuZBgWIAEoCzIwLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldEN1bXVsU29mdEJvdW5kSAASXgobc2V0X21heGltdW1fYWN0aXZlX3ZlaGljbGVzGBcgASgLMjcub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0TWF4aW11bUFjdGl2ZVZlaGljbGVzSAASVAoWc2V0X2ZpeGVkX3ZlaGljbGVfY29zdBgYIAEoCzIyLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldEZpeGVkVmVoaWNsZUNvc3RIABJeChtzZXRfYW1vcnRpemVkX3ZlaGljbGVfY29zdHMYGSABKAsyNy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTZXRBbW9ydGl6ZWRWZWhpY2xlQ29zdHNIABJdChtzZXRfdmVoaWNsZV91c2VkX3doZW5fZW1wdHkYGiABKAsyNi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTZXRWZWhpY2xlVXNlZFdoZW5FbXB0eUgAEmcKIGFkZF9zb2Z0X3NhbWVfdmVoaWNsZV9jb25zdHJhaW50GBsgASgLMjsub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkU29mdFNhbWVWZWhpY2xlQ29uc3RyYWludEgAElwKGnNldF9waWNrdXBfZGVsaXZlcnlfcG9saWN5GBwgASgLMjYub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0UGlja3VwRGVsaXZlcnlQb2xpY3lIABKDAQovYWRkX2RpbWVuc2lvbl93aXRoX3ZlaGljbGVfdHJhbnNpdF9hbmRfY2FwYWNpdHkYHSABKAsySC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGREaW1lbnNpb25XaXRoVmVoaWNsZVRyYW5zaXRBbmRDYXBhY2l0eUgAEkUKDnNldF92aXNpdF90eXBlGB4gASgLMisub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0VmlzaXRUeXBlSAASYgodYWRkX2hhcmRfdHlwZV9pbmNvbXBhdGliaWxpdHkYHyABKAsyOS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGRIYXJkVHlwZUluY29tcGF0aWJpbGl0eUgAEmoKIWFkZF90ZW1wb3JhbF90eXBlX2luY29tcGF0aWJpbGl0eRggIAEoCzI9Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFRlbXBvcmFsVHlwZUluY29tcGF0aWJpbGl0eUgAElEKFGFkZF90eXBlX3JlcXVpcmVtZW50GCEgASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkVHlwZVJlcXVpcmVtZW50SAASRAoNYWRkX2ZpbmFsaXplchgiIAEoCzIrLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZEZpbmFsaXplckgAEkQKDW1vZGlmeV9kb21haW4YIyABKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNb2RpZnlEb21haW5IABJTChVhZGRfbGluZWFyX2NvbnN0cmFpbnQYJCABKAsyMi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGRMaW5lYXJDb25zdHJhaW50SAASUQoUYWRkX2Jvb2xlYW5fdmFyaWFibGUYJSABKAsyMS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGRCb29sZWFuVmFyaWFibGVIABJVChZhZGRfYm9vbGVhbl9jb25zdHJhaW50GCYgASgLMjMub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkQm9vbGVhbkNvbnN0cmFpbnRIABJVChZhZGRfaW50ZWdlcl9leHByZXNzaW9uGCcgASgLMjMub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkSW50ZWdlckV4cHJlc3Npb25IABJNChJhZGRfYnJlYWtfaW50ZXJ2YWwYKCABKAsyLy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGRCcmVha0ludGVydmFsSAASTwoTc2V0X2JyZWFrX2ludGVydmFscxgpIAEoCzIwLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldEJyZWFrSW50ZXJ2YWxzSAASXgobc2V0X2JyZWFrX2Rpc3RhbmNlX2R1cmF0aW9uGCogASgLMjcub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0QnJlYWtEaXN0YW5jZUR1cmF0aW9uSAASUgoVc2V0X3BhdGhfZW5lcmd5X2Nvc3RzGCsgASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0UGF0aEVuZXJneUNvc3RzSAASVgoXYWRkX3NhbWVfYWN0aXZpdHlfZ3JvdXAYLCABKAsyMy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBZGRTYW1lQWN0aXZpdHlHcm91cEgAElcKF2FkZF9kZXBlbmRlbnRfZGltZW5zaW9uGC0gASgLMjQub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWRkRGVwZW5kZW50RGltZW5zaW9uSAASXwocYWRkX3BpY2t1cF9hbmRfZGVsaXZlcnlfc2V0cxguIAEoCzI3Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFBpY2t1cEFuZERlbGl2ZXJ5U2V0c0gAEmEKHXNldF9waWNrdXBfdG9fZGVsaXZlcnlfbGltaXRzGC8gASgLMjgub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2V0UGlja3VwVG9EZWxpdmVyeUxpbWl0c0gAEk0KHHNldF9maXJzdF9zb2x1dGlvbl9ldmFsdWF0b3IYMCABKAsyJS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNYXRyaXhIABIrCiFzZXRfcHJpbWFyeV9jb25zdHJhaW5lZF9kaW1lbnNpb24YMSABKAlIABJRChRhZGRfcm91dGVfY29uc3RyYWludBgyIAEoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZFJvdXRlQ29uc3RyYWludEgAEk0KEnNldF9waWVjZXdpc2VfY29zdBgzIAEoCzIvLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFBpZWNld2lzZUNvc3RIABJXChdhZGRfZm9yYmlkZGVuX2ludGVydmFscxg0IAEoCzI0Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0FkZEZvcmJpZGRlbkludGVydmFsc0gAEk0KEnNldF9zd2VlcF9hcnJhbmdlchg1IAEoCzIvLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFN3ZWVwQXJyYW5nZXJIABJZChphZGRfb3JkZXJlZF9hY3Rpdml0eV9ncm91cBg2IAEoCzIzLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ09yZGVyZWRBY3Rpdml0eUdyb3VwSAASQwoNc2V0X3RhYnVfdmFycxg3IAEoCzIqLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1NldFRhYnVWYXJzSAASNAoqaWdub3JlX2Rpc2p1bmN0aW9uc19hbHJlYWR5X2ZvcmNlZF90b196ZXJvGDggASgISABCCwoJb3BlcmF0aW9uImUKG1JvdXRpbmdQaWVjZXdpc2VDb3N0U2VnbWVudBIPCgdwb2ludF94GAEgASgDEg8KB3BvaW50X3kYAiABKAMSDQoFc2xvcGUYAyABKAMSFQoNb3RoZXJfcG9pbnRfeBgEIAEoAyKHAQoXUm91dGluZ1NldFBpZWNld2lzZUNvc3QSFgoOZGltZW5zaW9uX25hbWUYASABKAkSDQoFaW5kZXgYAiABKAMSRQoIc2VnbWVudHMYAyADKAsyMy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdQaWVjZXdpc2VDb3N0U2VnbWVudCLXAQoRUm91dGluZ01vZGVsUXVlcnkSOwoEa2luZBgBIAEoDjItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01vZGVsUXVlcnlLaW5kEg0KBWluZGV4GAIgASgDEhMKC290aGVyX2luZGV4GAMgASgDEhgKEHZlaGljbGVfb3JfY2xhc3MYBCABKAUSFQoNZGVmYXVsdF92YWx1ZRgFIAEoAxIbChNwcmVkaWNhdGVfZXZhbHVhdG9yGAYgASgFEhMKC3RoaXJkX2luZGV4GAcgASgDIiQKEVJvdXRpbmdJbmRleEdyb3VwEg8KB2luZGljZXMYASADKAUiTwoSUm91dGluZ0luZGV4R3JvdXBzEjkKBmdyb3VwcxgBIAMoCzIpLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0luZGV4R3JvdXAi5AEKFlJvdXRpbmdNb2RlbEluc3BlY3Rpb24SEgoFdmFsdWUYASABKANIAIgBARIZChFkaW1lbnNpb25faW5kaWNlcxgCIAMoBRIPCgdpbmRpY2VzGAMgAygFEjkKBmdyb3VwcxgEIAMoCzIpLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0luZGV4R3JvdXASRQoRcHJlY2VkZW5jZV9ncm91cHMYBSADKAsyKi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdJbmRleEdyb3Vwc0IICgZfdmFsdWUipgIKFVJvdXRpbmdEaW1lbnNpb25RdWVyeRIWCg5kaW1lbnNpb25fbmFtZRgBIAEoCRI/CgRraW5kGAIgASgOMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nRGltZW5zaW9uUXVlcnlLaW5kEg0KBWluZGV4GAMgASgDEhMKC290aGVyX2luZGV4GAQgASgDEhgKEHZlaGljbGVfb3JfY2xhc3MYBSABKAUSDQoFbG93ZXIYBiABKAMSDQoFdXBwZXIYByABKAMSEgoKcGFpcl9pbmRleBgIIAEoBRIgChhwaWNrdXBfYWx0ZXJuYXRpdmVfaW5kZXgYCSABKAUSIgoaZGVsaXZlcnlfYWx0ZXJuYXRpdmVfaW5kZXgYCiABKAUihgEKHFJvdXRpbmdBZGRGb3JiaWRkZW5JbnRlcnZhbHMSFgoOZGltZW5zaW9uX25hbWUYASABKAkSDQoFaW5kZXgYAiABKAMSPwoJaW50ZXJ2YWxzGAMgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nSW50NjRJbnRlcnZhbCIyChRSb3V0aW5nSW50NjRJbnRlcnZhbBINCgVzdGFydBgBIAEoAxILCgNlbmQYAiABKAMiswIKGlJvdXRpbmdEaW1lbnNpb25JbnNwZWN0aW9uEhIKBXZhbHVlGAEgASgDSACIAQESPwoJaW50ZXJ2YWxzGAIgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nSW50NjRJbnRlcnZhbBIhChloYXNfcGllY2V3aXNlX2xpbmVhcl9jb3N0GAMgASgIEkoKDWNvc3Rfc2VnbWVudHMYBCADKAsyMy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdQaWVjZXdpc2VDb3N0U2VnbWVudBJHChBub2RlX3ByZWNlZGVuY2VzGAUgAygLMi0ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTm9kZVByZWNlZGVuY2VCCAoGX3ZhbHVlImQKFVJvdXRpbmdOb2RlUHJlY2VkZW5jZRINCgVmaXJzdBgBIAEoAxIOCgZzZWNvbmQYAiABKAMSDgoGb2Zmc2V0GAMgASgDEhwKFHBlcmZvcm1lZF9jb25zdHJhaW50GAQgASgFIl0KGVJvdXRpbmdBZGRSb3V0ZUNvbnN0cmFpbnQSEQoJZXZhbHVhdG9yGAEgASgFEi0KJWNvc3RzX2FyZV9ob21vZ2VuZW91c19hY3Jvc3NfdmVoaWNsZXMYAiABKAgiTgodUm91dGluZ1BpY2t1cERlbGl2ZXJ5UG9zaXRpb24SEgoKcGFpcl9pbmRleBgBIAEoBRIZChFhbHRlcm5hdGl2ZV9pbmRleBgCIAEoBSLZAQofUm91dGluZ1BpY2t1cERlbGl2ZXJ5SW5zcGVjdGlvbhJFCgZwaWNrdXAYASABKAsyNS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdQaWNrdXBEZWxpdmVyeVBvc2l0aW9uEkcKCGRlbGl2ZXJ5GAIgASgLMjUub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nUGlja3VwRGVsaXZlcnlQb3NpdGlvbhIRCglpc19waWNrdXAYAyABKAgSEwoLaXNfZGVsaXZlcnkYBCABKAgiSAodUm91dGluZ0JyZWFrSW5zcGVjdGlvblJlcXVlc3QSFgoOZGltZW5zaW9uX25hbWUYASABKAkSDwoHdmVoaWNsZRgCIAEoBSJCChxSb3V0aW5nQnJlYWtEaXN0YW5jZUR1cmF0aW9uEhAKCGRpc3RhbmNlGAEgASgDEhAKCGR1cmF0aW9uGAIgASgDIpgCChlSb3V0aW5nQnJlYWtDb25maWd1cmF0aW9uEh0KFWhhc19icmVha19jb25zdHJhaW50cxgBIAEoCBIRCglpbnRlcnZhbHMYAiADKAUSTwoRZGlzdGFuY2VfZHVyYXRpb24YAyADKAsyNC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdCcmVha0Rpc3RhbmNlRHVyYXRpb24SIQoUcHJlX3RyYXZlbF9ldmFsdWF0b3IYBCABKAVIAIgBARIiChVwb3N0X3RyYXZlbF9ldmFsdWF0b3IYBSABKAVIAYgBAUIXChVfcHJlX3RyYXZlbF9ldmFsdWF0b3JCGAoWX3Bvc3RfdHJhdmVsX2V2YWx1YXRvciIfCgxSb3V0aW5nUm91dGUSDwoHaW5kaWNlcxgBIAMoAyK2AQoYUm91dGluZ0luaXRpYWxBc3NpZ25tZW50EjQKBnJvdXRlcxgBIAMoCzIkLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1JvdXRlEh8KF2lnbm9yZV9pbmFjdGl2ZV9pbmRpY2VzGAIgASgIEkMKCHNuYXBzaG90GAMgASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQXNzaWdubWVudFNuYXBzaG90IrICChlSb3V0aW5nQXNzaWdubWVudFNuYXBzaG90EkQKCXZhcmlhYmxlcxgBIAMoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Fzc2lnbm1lbnRWYXJpYWJsZRJBCglpbnRlcnZhbHMYAiADKAsyLi5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdCcmVha0Fzc2lnbm1lbnQSHAoPb2JqZWN0aXZlX3ZhbHVlGAMgASgDSACIAQESGgoNb2JqZWN0aXZlX21pbhgEIAEoA0gBiAEBEhoKDW9iamVjdGl2ZV9tYXgYBSABKANIAogBAUISChBfb2JqZWN0aXZlX3ZhbHVlQhAKDl9vYmplY3RpdmVfbWluQhAKDl9vYmplY3RpdmVfbWF4IkgKGVJvdXRpbmdBc3NpZ25tZW50VHJhbnNmZXISEwoLbmV4dF92YWx1ZXMYASADKAUSFgoOdmVoaWNsZV92YWx1ZXMYAiADKAUiXwoRUm91dGluZ1JvdXRlTG9ja3MSNAoGcm91dGVzGAEgAygLMiQub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nUm91dGUSFAoMY2xvc2Vfcm91dGVzGAIgASgIIpwBChRSb3V0aW5nUHJlQXNzaWdubWVudBJRCgtuZXh0X3ZhbHVlcxgBIAMoCzI8Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1ByZUFzc2lnbm1lbnQuTmV4dFZhbHVlc0VudHJ5GjEKD05leHRWYWx1ZXNFbnRyeRILCgNrZXkYASABKAUSDQoFdmFsdWUYAiABKAU6AjgBIk0KFlJvdXRpbmdDdW11bE9wdGltaXplcnMSGQoRZ2xvYmFsX2RpbWVuc2lvbnMYASADKAkSGAoQbG9jYWxfZGltZW5zaW9ucxgCIAMoCSKEAwoXUm91dGluZ1NlYXJjaFN0YXRpc3RpY3MSKQohbnVtX2NwX3NhdF9jYWxsc19pbl9scF9zY2hlZHVsaW5nGAEgASgDEicKH251bV9nbG9wX2NhbGxzX2luX2xwX3NjaGVkdWxpbmcYAiABKAMSHwoXbnVtX21pbl9jb3N0X2Zsb3dfY2FsbHMYAyABKAMSIwobbnVtX2NwX3NhdF9jYWxsc19pbl9yb3V0aW5nGAQgASgDEi8KJ251bV9nZW5lcmFsaXplZF9jcF9zYXRfY2FsbHNfaW5fcm91dGluZxgFIAEoAxIsCh9udW1fZGVjaXNpb25zX2luX2ZpcnN0X3NvbHV0aW9uGAYgASgDSACIAQESKgodbnVtX3JlamVjdHNfaW5fZmlyc3Rfc29sdXRpb24YByABKANIAYgBAUIiCiBfbnVtX2RlY2lzaW9uc19pbl9maXJzdF9zb2x1dGlvbkIgCh5fbnVtX3JlamVjdHNfaW5fZmlyc3Rfc29sdXRpb24ipgMKD1JvdXRpbmdTb2x1dGlvbhIXCg9vYmplY3RpdmVfdmFsdWUYASABKAMSEwoLbmV4dF92YWx1ZXMYAiADKAMSDgoGc3RhcnRzGAMgAygDEgwKBGVuZHMYBCADKAMSQgoKZGltZW5zaW9ucxgFIAMoCzIuLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0RpbWVuc2lvblZhbHVlcxIWCg52ZWhpY2xlX3ZhbHVlcxgGIAMoBRJPChRhc3NpZ25tZW50X3ZhcmlhYmxlcxgHIAMoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Fzc2lnbm1lbnRWYXJpYWJsZRJPChRyZXNvdXJjZV9hc3NpZ25tZW50cxgIIAMoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1Jlc291cmNlQXNzaWdubWVudBJJChFicmVha19hc3NpZ25tZW50cxgJIAMoCzIuLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0JyZWFrQXNzaWdubWVudCLDDwoUUm91dGluZ0JyaWRnZVJlcXVlc3QSIgoadmFsaWRhdGVfc2VhcmNoX3BhcmFtZXRlcnMYKSABKAgSFQoNbnVtX2xvY2F0aW9ucxgBIAEoBRIUCgxudW1fdmVoaWNsZXMYAiABKAUSDgoGc3RhcnRzGAMgAygFEgwKBGVuZHMYBCADKAUSPQoOdHJhbnNpdF9tYXRyaXgYByABKAsyJS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNYXRyaXgSQQoKb3BlcmF0aW9ucxgIIAMoCzItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01vZGVsT3BlcmF0aW9uEhcKD2RpbWVuc2lvbl9uYW1lcxgJIAMoCRJMChJpbml0aWFsX2Fzc2lnbm1lbnQYCiABKAsyMC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdJbml0aWFsQXNzaWdubWVudBIVCg1pbnRlcnJ1cHRpYmxlGAsgASgIEh8KF3NlYXJjaF9wYXJhbWV0ZXJzX3Byb3RvGAwgASgMEh8KF3NlYXJjaF9wYXJhbWV0ZXJfZmllbGRzGA0gAygJEh4KFm1vZGVsX3BhcmFtZXRlcnNfcHJvdG8YDiABKAwSHgoWbW9kZWxfcGFyYW1ldGVyX2ZpZWxkcxgPIAMoCRIXCg9zb2x1dGlvbl9ldmVudHMYECABKAgSIQoZdHJhY2tfdW5jaGVja2VkX25laWdoYm9ycxgRIAEoCBIcChRyZWFkX2Fzc2lnbm1lbnRfb25seRgSIAEoCBJCCg5kb21haW5fcXVlcmllcxgTIAMoCzIqLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0RvbWFpblF1ZXJ5EkUKEGFyY19jb3N0X3F1ZXJpZXMYFCADKAsyKy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBcmNDb3N0UXVlcnkSRQoPcmVzb3VyY2VfZ3JvdXBzGBUgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nUmVzb3VyY2VHcm91cBImChlyZXNvdXJjZV9pbnNwZWN0aW9uX2dyb3VwGBYgASgFSACIAQESHwoXaW5zcGVjdF9hY3Rpdml0eV9ncm91cHMYFyABKAgSPgoLcm91dGVfbG9ja3MYGCABKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdSb3V0ZUxvY2tzEh4KFmluc3BlY3RfcHJlX2Fzc2lnbm1lbnQYGSABKAgSTgoTZmlyc3Rfc29sdXRpb25faGludBgaIAEoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Fzc2lnbm1lbnRTbmFwc2hvdBJKChFhc3NpZ25tZW50X2FjdGlvbhgbIAEoDjIvLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Fzc2lnbm1lbnRBY3Rpb24SUAoVY2FuZGlkYXRlX2Fzc2lnbm1lbnRzGBwgAygLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQXNzaWdubWVudFNuYXBzaG90EiAKGHBhY2tpbmdfZHVyYXRpb25fc2Vjb25kcxgdIAEoARIcChRjaGVja19zb2x1dGlvbl9pbl9jcBgeIAEoCBIgChhpbnNwZWN0X2N1bXVsX29wdGltaXplcnMYHyABKAgSIQoZY2FsbF9hdF9zb2x1dGlvbl9tb25pdG9ycxggIAEoCBItCiBwaWNrdXBfZGVsaXZlcnlfaW5zcGVjdGlvbl9pbmRleBghIAEoBUgBiAEBEk8KEGJyZWFrX2luc3BlY3Rpb24YIiABKAsyNS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdCcmVha0luc3BlY3Rpb25SZXF1ZXN0EkYKD2RpbWVuc2lvbl9xdWVyeRgjIAEoCzItLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0RpbWVuc2lvblF1ZXJ5EhsKE3NlYXJjaF9lbnRyeV9ldmVudHMYJCABKAgSPgoLbW9kZWxfcXVlcnkYJSABKAsyKS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdNb2RlbFF1ZXJ5Ej4KEHJvdXRlX2Nvc3RfcXVlcnkYJiABKAsyJC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdSb3V0ZRJFCg9zZWNvbmRhcnlfbW9kZWwYJyABKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdCcmlkZ2VSZXF1ZXN0Ek4KE2Fzc2lnbm1lbnRfdHJhbnNmZXIYKCABKAsyMS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBc3NpZ25tZW50VHJhbnNmZXJCHAoaX3Jlc291cmNlX2luc3BlY3Rpb25fZ3JvdXBCIwohX3BpY2t1cF9kZWxpdmVyeV9pbnNwZWN0aW9uX2luZGV4SgQIBRAGSgQIBhAHUhdmaXJzdF9zb2x1dGlvbl9zdHJhdGVneVIOc29sdXRpb25fbGltaXQiiAEKGVJvdXRpbmdTZXRQYXRoRW5lcmd5Q29zdHMSDQoFZm9yY2UYASABKAkSEAoIZGlzdGFuY2UYAiABKAkSEQoJdGhyZXNob2xkGAMgASgDEhIKCmNvc3RfYmVsb3cYBCABKAMSEgoKY29zdF9hYm92ZRgFIAEoAxIPCgd2ZWhpY2xlGAYgASgFIi4KG1JvdXRpbmdBZGRTYW1lQWN0aXZpdHlHcm91cBIPCgdpbmRpY2VzGAEgAygFIicKFFJvdXRpbmdBY3Rpdml0eUdyb3VwEg8KB2luZGljZXMYASADKAUiZgoVUm91dGluZ0FjdGl2aXR5R3JvdXBzEg4KBmdyb3VwcxgBIAMoBRI9CgdtZW1iZXJzGAIgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQWN0aXZpdHlHcm91cCJkChZSb3V0aW5nRGltZW5zaW9uVmFsdWVzEgwKBG5hbWUYASABKAkSFAoMY3VtdWxfdmFsdWVzGAIgAygDEhIKCmN1bXVsX21pbnMYAyADKAMSEgoKY3VtdWxfbWF4cxgEIAMoAyJ5ChlSb3V0aW5nQXNzaWdubWVudFZhcmlhYmxlEkIKCHZhcmlhYmxlGAEgASgLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVmFyaWFibGVSZWZlcmVuY2USCwoDbWluGAIgASgDEgsKA21heBgDIAEoAyIuChBSb3V0aW5nUm91dGVDb3N0EhEKBGNvc3QYASABKANIAIgBAUIHCgVfY29zdCLdDwoVUm91dGluZ0JyaWRnZVJlc3BvbnNlEiMKFnNlYXJjaF9wYXJhbWV0ZXJfZXJyb3IYIyABKAlIAIgBARIUCgxoYXNfc29sdXRpb24YASABKAgSDgoGc3RhdHVzGAIgASgFEhcKD29iamVjdGl2ZV92YWx1ZRgDIAEoAxITCgtuZXh0X3ZhbHVlcxgEIAMoAxIOCgZzdGFydHMYBSADKAMSDAoEZW5kcxgGIAMoAxJCCgpkaW1lbnNpb25zGAcgAygLMi4ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nRGltZW5zaW9uVmFsdWVzEhwKFGxvY2FsX3NlYXJjaF9wcm9maWxlGAggASgJEj4KC3NvbHZlX2V2ZW50GAkgASgLMikub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU29sdmVFdmVudBIWCg52ZWhpY2xlX3ZhbHVlcxgKIAMoBRIuCiFhdXRvbWF0aWNfZmlyc3Rfc29sdXRpb25fc3RyYXRlZ3kYCyABKAVIAYgBARJDCg5kb21haW5fcmVzdWx0cxgMIAMoCzIrLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0RvbWFpblJlc3VsdBIRCglhcmNfY29zdHMYDSADKAMSTwoUYXNzaWdubWVudF92YXJpYWJsZXMYDiADKAsyMS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBc3NpZ25tZW50VmFyaWFibGUSTwoUcmVzb3VyY2VfYXNzaWdubWVudHMYDyADKAsyMS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdSZXNvdXJjZUFzc2lnbm1lbnQSTgoTcmVzb3VyY2VfaW5zcGVjdGlvbhgQIAEoCzIxLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1Jlc291cmNlSW5zcGVjdGlvbhJJChFicmVha19hc3NpZ25tZW50cxgRIAMoCzIuLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0JyZWFrQXNzaWdubWVudBJGCg9hY3Rpdml0eV9ncm91cHMYEiABKAsyLS5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdBY3Rpdml0eUdyb3VwcxIaCg1sb2Nrc19hcHBsaWVkGBMgASgISAKIAQESRAoOcHJlX2Fzc2lnbm1lbnQYFCABKAsyLC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdQcmVBc3NpZ25tZW50EkQKE2NvbGxlY3RlZF9zb2x1dGlvbnMYFSADKAsyJy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdTb2x1dGlvbhIfChJ0aW1lX2xpbWl0X3JlYWNoZWQYFiABKAhIA4gBARIhChRjb21wdXRlZF9sb3dlcl9ib3VuZBgXIAEoA0gEiAEBEiIKFW9iamVjdGl2ZV9sb3dlcl9ib3VuZBgYIAEoA0gFiAEBEkoKEXNlYXJjaF9zdGF0aXN0aWNzGBkgASgLMi8ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nU2VhcmNoU3RhdGlzdGljcxJIChBjdW11bF9vcHRpbWl6ZXJzGBogASgLMi4ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQ3VtdWxPcHRpbWl6ZXJzEiAKE2Fzc2lnbm1lbnRfZmVhc2libGUYGyABKAhIBogBARJbChpwaWNrdXBfZGVsaXZlcnlfaW5zcGVjdGlvbhgcIAEoCzI3Lm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1BpY2t1cERlbGl2ZXJ5SW5zcGVjdGlvbhJOChNicmVha19jb25maWd1cmF0aW9uGB0gASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQnJlYWtDb25maWd1cmF0aW9uElAKFGRpbWVuc2lvbl9pbnNwZWN0aW9uGB4gASgLMjIub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nRGltZW5zaW9uSW5zcGVjdGlvbhIWCg5zZWFyY2hfZW50ZXJlZBgfIAEoCBJIChBtb2RlbF9pbnNwZWN0aW9uGCAgASgLMi4ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTW9kZWxJbnNwZWN0aW9uEjwKCnJvdXRlX2Nvc3QYISABKAsyKC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdSb3V0ZUNvc3QSSgoPYXNzaWdubWVudF9zZWVkGCIgASgLMjEub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQXNzaWdubWVudFNuYXBzaG90QhkKF19zZWFyY2hfcGFyYW1ldGVyX2Vycm9yQiQKIl9hdXRvbWF0aWNfZmlyc3Rfc29sdXRpb25fc3RyYXRlZ3lCEAoOX2xvY2tzX2FwcGxpZWRCFQoTX3RpbWVfbGltaXRfcmVhY2hlZEIXChVfY29tcHV0ZWRfbG93ZXJfYm91bmRCGAoWX29iamVjdGl2ZV9sb3dlcl9ib3VuZEIWChRfYXNzaWdubWVudF9mZWFzaWJsZSKAAQoXUm91dGluZ0FkZEJyZWFrSW50ZXJ2YWwSDQoFaW5kZXgYASABKAUSEQoJc3RhcnRfbWluGAIgASgDEhEKCXN0YXJ0X21heBgDIAEoAxIQCghkdXJhdGlvbhgEIAEoAxIQCghvcHRpb25hbBgFIAEoCBIMCgRuYW1lGAYgASgJIrsCChhSb3V0aW5nU2V0QnJlYWtJbnRlcnZhbHMSFgoOZGltZW5zaW9uX25hbWUYASABKAkSEQoJaW50ZXJ2YWxzGAIgAygFEg8KB3ZlaGljbGUYAyABKAUSOQoKcHJlX3RyYXZlbBgEIAEoCzIlLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01hdHJpeBI6Cgtwb3N0X3RyYXZlbBgFIAEoCzIlLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ01hdHJpeBIeChFwcmVfdHJhdmVsX2hhbmRsZRgGIAEoBUgAiAEBEh8KEnBvc3RfdHJhdmVsX2hhbmRsZRgHIAEoBUgBiAEBQhQKEl9wcmVfdHJhdmVsX2hhbmRsZUIVChNfcG9zdF90cmF2ZWxfaGFuZGxlIm4KH1JvdXRpbmdTZXRCcmVha0Rpc3RhbmNlRHVyYXRpb24SFgoOZGltZW5zaW9uX25hbWUYASABKAkSDwoHdmVoaWNsZRgCIAEoBRIQCghkaXN0YW5jZRgDIAEoAxIQCghkdXJhdGlvbhgEIAEoAyLlAQoWUm91dGluZ0JyZWFrQXNzaWdubWVudBINCgVpbmRleBgBIAEoBRIVCg1wZXJmb3JtZWRfbWluGAIgASgDEhUKDXBlcmZvcm1lZF9tYXgYAyABKAMSFgoJc3RhcnRfbWluGAQgASgDSACIAQESFgoJc3RhcnRfbWF4GAUgASgDSAGIAQESFAoHZW5kX21pbhgGIAEoA0gCiAEBEhQKB2VuZF9tYXgYByABKANIA4gBAUIMCgpfc3RhcnRfbWluQgwKCl9zdGFydF9tYXhCCgoIX2VuZF9taW5CCgoIX2VuZF9tYXgiVwoRUm91dGluZ1NvbHZlRXZlbnQSFwoPb2JqZWN0aXZlX3ZhbHVlGAEgASgDEhYKDnNvbHV0aW9uX2NvdW50GAIgASgDEhEKCXVuY2hlY2tlZBgDIAEoCCJTCg9Sb3V0aW5nUmVzb3VyY2USFgoOZGltZW5zaW9uX25hbWUYASABKAkSFAoMc3RhcnRfZG9tYWluGAIgAygDEhIKCmVuZF9kb21haW4YAyADKAMiPQoXUm91dGluZ1ZlaGljbGVSZXNvdXJjZXMSDwoHdmVoaWNsZRgBIAEoBRIRCglyZXNvdXJjZXMYAiADKAUiuQEKFFJvdXRpbmdSZXNvdXJjZUdyb3VwEjoKCXJlc291cmNlcxgBIAMoCzInLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ1Jlc291cmNlEhkKEXJlcXVpcmVkX3ZlaGljbGVzGAIgAygFEkoKEWFsbG93ZWRfcmVzb3VyY2VzGAMgAygLMi8ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nVmVoaWNsZVJlc291cmNlcyI3ChlSb3V0aW5nUmVzb3VyY2VBc3NpZ25tZW50EgwKBG1pbnMYASADKAMSDAoEbWF4cxgCIAMoAyJ2ChhSb3V0aW5nSW5zcGVjdGVkUmVzb3VyY2USEwoLY2xhc3NfaW5kZXgYASABKAUSRQoUZGltZW5zaW9uX2F0dHJpYnV0ZXMYAiADKAsyJy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdSZXNvdXJjZSJ3ChRSb3V0aW5nUmVzb3VyY2VDbGFzcxIYChByZXNvdXJjZV9pbmRpY2VzGAEgAygFEkUKFGRpbWVuc2lvbl9hdHRyaWJ1dGVzGAIgAygLMicub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nUmVzb3VyY2UivAEKGVJvdXRpbmdSZXNvdXJjZUluc3BlY3Rpb24SGwoTYWZmZWN0ZWRfZGltZW5zaW9ucxgBIAMoCRJDCglyZXNvdXJjZXMYAiADKAsyMC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdJbnNwZWN0ZWRSZXNvdXJjZRI9CgdjbGFzc2VzGAMgAygLMiwub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nUmVzb3VyY2VDbGFzcyKEAgoYUm91dGluZ0Jvb2xlYW5FeHByZXNzaW9uEgwKBGtpbmQYASABKAUSDQoFdmFsdWUYAiABKAgSQgoIdmFyaWFibGUYAyABKAsyMC5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdWYXJpYWJsZVJlZmVyZW5jZRJDCgpjb21wYXJpc29uGAQgASgLMi8ub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nTGluZWFyQ29tcGFyaXNvbhJCCghvcGVyYW5kcxgFIAMoCzIwLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Jvb2xlYW5FeHByZXNzaW9uInAKGVJvdXRpbmdBZGRCb29sZWFuVmFyaWFibGUSDQoFaW5kZXgYASABKAUSRAoKZXhwcmVzc2lvbhgCIAEoCzIwLm9ydG9vbHNfd2FzbS5icmlkZ2UudjEuUm91dGluZ0Jvb2xlYW5FeHByZXNzaW9uImMKG1JvdXRpbmdBZGRCb29sZWFuQ29uc3RyYWludBJECgpleHByZXNzaW9uGAEgASgLMjAub3J0b29sc193YXNtLmJyaWRnZS52MS5Sb3V0aW5nQm9vbGVhbkV4cHJlc3Npb24ifQobUm91dGluZ0FkZEludGVnZXJFeHByZXNzaW9uEg0KBWluZGV4GAEgASgFEgwKBGtpbmQYAiABKAUSQQoIb3BlcmFuZHMYAyADKAsyLy5vcnRvb2xzX3dhc20uYnJpZGdlLnYxLlJvdXRpbmdMaW5lYXJFeHByZXNzaW9uKogCChlSb3V0aW5nRGltZW5zaW9uVmFsdWVLaW5kEiwKKFJPVVRJTkdfRElNRU5TSU9OX1ZBTFVFX0tJTkRfVU5TUEVDSUZJRUQQABIxCi1ST1VUSU5HX0RJTUVOU0lPTl9WQUxVRV9LSU5EX1NQQU5fVVBQRVJfQk9VTkQQARIqCiZST1VUSU5HX0RJTUVOU0lPTl9WQUxVRV9LSU5EX1NQQU5fQ09TVBACEisKJ1JPVVRJTkdfRElNRU5TSU9OX1ZBTFVFX0tJTkRfU0xBQ0tfQ09TVBADEjEKLVJPVVRJTkdfRElNRU5TSU9OX1ZBTFVFX0tJTkRfR0xPQkFMX1NQQU5fQ09TVBAEKlIKGlJvdXRpbmdUeXBlUmVxdWlyZW1lbnRLaW5kEhAKDFNBTUVfVkVISUNMRRAAEg8KC1dIRU5fQURESU5HEAESEQoNV0hFTl9SRU1PVklORxACKpcBChRSb3V0aW5nRmluYWxpemVyS2luZBIhCh1ST1VUSU5HX0ZJTkFMSVpFUl9VTlNQRUNJRklFRBAAEh4KGlJPVVRJTkdfRklOQUxJWkVSX01JTklNSVpFEAESHgoaUk9VVElOR19GSU5BTElaRVJfTUFYSU1JWkUQAhIcChhST1VUSU5HX0ZJTkFMSVpFUl9UQVJHRVQQAyqxAwoTUm91dGluZ1ZhcmlhYmxlS2luZBIgChxST1VUSU5HX1ZBUklBQkxFX1VOU1BFQ0lGSUVEEAASGgoWUk9VVElOR19WQVJJQUJMRV9DVU1VTBABEhoKFlJPVVRJTkdfVkFSSUFCTEVfU0xBQ0sQAhIZChVST1VUSU5HX1ZBUklBQkxFX05FWFQQAxIcChhST1VUSU5HX1ZBUklBQkxFX1ZFSElDTEUQBBIbChdST1VUSU5HX1ZBUklBQkxFX0FDVElWRRAFEhwKGFJPVVRJTkdfVkFSSUFCTEVfVFJBTlNJVBAGEiIKHlJPVVRJTkdfVkFSSUFCTEVfRklYRURfVFJBTlNJVBAHEiMKH1JPVVRJTkdfVkFSSUFCTEVfQUNUSVZFX1ZFSElDTEUQCBIlCiFST1VUSU5HX1ZBUklBQkxFX1JPVVRFX0NPTlNJREVSRUQQCRIdChlST1VUSU5HX1ZBUklBQkxFX1JFU09VUkNFEAoSHAoYUk9VVElOR19WQVJJQUJMRV9CT09MRUFOEAsSHwobUk9VVElOR19WQVJJQUJMRV9FWFBSRVNTSU9OEAwqsAEKE1JvdXRpbmdEb21haW5BY3Rpb24SHgoaUk9VVElOR19ET01BSU5fVU5TUEVDSUZJRUQQABIYChRST1VUSU5HX0RPTUFJTl9SQU5HRRABEhkKFVJPVVRJTkdfRE9NQUlOX1ZBTFVFUxACEiIKHlJPVVRJTkdfRE9NQUlOX1JFTU9WRV9JTlRFUlZBTBADEiAKHFJPVVRJTkdfRE9NQUlOX1JFTU9WRV9WQUxVRVMQBCqOBQoZUm91dGluZ0RpbWVuc2lvblF1ZXJ5S2luZBIjCh9ST1VUSU5HX0RJTUVOU0lPTl9RVUVSWV9UUkFOU0lUEAASKQolUk9VVElOR19ESU1FTlNJT05fUVVFUllfVFJBTlNJVF9DTEFTUxABEi0KKVJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX0FMTE9XRURfSU5URVJWQUxTEAISLworUk9VVElOR19ESU1FTlNJT05fUVVFUllfRk9SQklEREVOX0lOVEVSVkFMUxADEikKJVJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX0ZJUlNUX0FMTE9XRUQQBBIoCiRST1VUSU5HX0RJTUVOU0lPTl9RVUVSWV9MQVNUX0FMTE9XRUQQBRIqCiZST1VUSU5HX0RJTUVOU0lPTl9RVUVSWV9QSUVDRVdJU0VfQ09TVBAGEikKJVJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX1ZFSElDTEVfQ0xBU1MQBxIkCiBST1VUSU5HX0RJTUVOU0lPTl9RVUVSWV9JU19VTkFSWRAIEjEKLVJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX1BJQ0tVUF9ERUxJVkVSWV9MSU1JVBAJEiwKKFJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX05PREVfUFJFQ0VERU5DRVMQChItCilST1VUSU5HX0RJTUVOU0lPTl9RVUVSWV9UUkFOU0lUU19QT1NJVElWRRALEigKJFJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX1RSQU5TSVRfU0lHThAMEjUKMVJPVVRJTkdfRElNRU5TSU9OX1FVRVJZX1NIT1JURVNUX1RSQU5TSVRJT05fU0xBQ0sQDSraCwoVUm91dGluZ01vZGVsUXVlcnlLaW5kEioKJlJPVVRJTkdfTU9ERUxfUVVFUllfVkVISUNMRV9DT1NUX0NMQVNTEAASLgoqUk9VVElOR19NT0RFTF9RVUVSWV9IQVNfVkVISUNMRV9DT1NUX0NMQVNTEAESKgomUk9VVElOR19NT0RFTF9RVUVSWV9DT1NUX0NMQVNTRVNfQ09VTlQQAhIyCi5ST1VUSU5HX01PREVMX1FVRVJZX05PTlpFUk9fQ09TVF9DTEFTU0VTX0NPVU5UEAMSKQolUk9VVElOR19NT0RFTF9RVUVSWV9IT01PR0VORU9VU19DT1NUUxAEEioKJlJPVVRJTkdfTU9ERUxfUVVFUllfQVJDX0NPU1RfRk9SX0NMQVNTEAUSKwonUk9VVElOR19NT0RFTF9RVUVSWV9VTlBFUkZPUk1FRF9QRU5BTFRZEAYSNAowUk9VVElOR19NT0RFTF9RVUVSWV9VTlBFUkZPUk1FRF9QRU5BTFRZX09SX1ZBTFVFEAcSKAokUk9VVElOR19NT0RFTF9RVUVSWV9VTkFSWV9ESU1FTlNJT05TEAgSLworUk9VVElOR19NT0RFTF9RVUVSWV9TT0ZUX09SX1NQQU5fRElNRU5TSU9OUxAJEiwKKFJPVVRJTkdfTU9ERUxfUVVFUllfU0lOR0xFX05PREVTX09GX1RZUEUQChIsCihST1VUSU5HX01PREVMX1FVRVJZX1BBSVJfSU5ESUNFU19PRl9UWVBFEAsSJQohUk9VVElOR19NT0RFTF9RVUVSWV9WRUhJQ0xFX0NMQVNTEAwSLQopUk9VVElOR19NT0RFTF9RVUVSWV9WRUhJQ0xFX0NMQVNTRVNfQ09VTlQQDRIoCiRST1VUSU5HX01PREVMX1FVRVJZX1ZFSElDTEVfT0ZfQ0xBU1MQDhItCilST1VUSU5HX01PREVMX1FVRVJZX1ZJU0lUX1RZUEVfQ09NUE9ORU5UUxAPEioKJlJPVVRJTkdfTU9ERUxfUVVFUllfU09SVEVEX1ZJU0lUX1RZUEVTEBASLAooUk9VVElOR19NT0RFTF9RVUVSWV9TQU1FX1ZFSElDTEVfSU5ESUNFUxAREi4KKlJPVVRJTkdfTU9ERUxfUVVFUllfVkVISUNMRVNfT0ZfU0FNRV9DTEFTUxASEi8KK1JPVVRJTkdfTU9ERUxfUVVFUllfU0FNRV9WRUhJQ0xFX0NMQVNTX0FSQ1MQExIvCitST1VUSU5HX01PREVMX1FVRVJZX1NPUlRFRF9OT0RFX1BSRUNFREVOQ0VTEBQSMwovUk9VVElOR19NT0RFTF9RVUVSWV9ESVNKVU5DVElPTl9NQVhfQ0FSRElOQUxJVFkQFRJECkBST1VUSU5HX01PREVMX1FVRVJZX0hBU19NQVhfQ0FSRElOQUxJVFlfQ09OU1RSQUlORURfRElTSlVOQ1RJT05TEBYSMwovUk9VVElOR19NT0RFTF9RVUVSWV9QRVJGRUNUX0JJTkFSWV9ESVNKVU5DVElPTlMQFxInCiNST1VUSU5HX01PREVMX1FVRVJZX1NJTkdMRVRPTl9OT0RFUxAYEicKI1JPVVRJTkdfTU9ERUxfUVVFUllfVkVISUNMRV9BTExPV0VEEBkSLworUk9VVElOR19NT0RFTF9RVUVSWV9GSVJTVF9TT0xVVElPTl9BUkNfQ09TVBAaEj4KOlJPVVRJTkdfTU9ERUxfUVVFUllfRklSU1RfTUFUQ0hJTkdfUElDS1VQX0RFTElWRVJZX1NJQkxJTkcQGxIsCihST1VUSU5HX01PREVMX1FVRVJZX0FSQ19NT1JFX0NPTlNUUkFJTkVEEBwSKQolUk9VVElOR19NT0RFTF9RVUVSWV9JU19NQVRDSElOR19NT0RFTBAdEi0KKVJPVVRJTkdfTU9ERUxfUVVFUllfUk9VVEVTX0lOVEVSREVQRU5ERU5UEB4q7wIKF1JvdXRpbmdBc3NpZ25tZW50QWN0aW9uEiMKH1JPVVRJTkdfQVNTSUdOTUVOVF9BQ1RJT05fU09MVkUQABIiCh5ST1VUSU5HX0FTU0lHTk1FTlRfQUNUSU9OX1BBQ0sQARIlCiFST1VUSU5HX0FTU0lHTk1FTlRfQUNUSU9OX0NPTVBBQ1QQAhIvCitST1VUSU5HX0FTU0lHTk1FTlRfQUNUSU9OX0NPTVBBQ1RfQU5EX0NIRUNLEAMSKAokUk9VVElOR19BU1NJR05NRU5UX0FDVElPTl9GQVNUX1NPTFZFEAQSLQopUk9VVElOR19BU1NJR05NRU5UX0FDVElPTl9NVUxUSVBMRV9TVEFSVFMQBRIpCiVST1VUSU5HX0FTU0lHTk1FTlRfQUNUSU9OX0xPV0VSX0JPVU5EEAYSLworUk9VVElOR19BU1NJR05NRU5UX0FDVElPTl9DSEVDS19GRUFTSUJJTElUWRAHYgZwcm90bzM"), RoutingMatrixSchema = /* @__PURE__ */ messageDesc(file_routing, 0), RoutingAddDimensionSchema = /* @__PURE__ */ messageDesc(file_routing, 1), RoutingAddDimensionWithVehicleCapacitySchema = /* @__PURE__ */ messageDesc(file_routing, 2), RoutingAddDimensionWithVehicleTransitsSchema = /* @__PURE__ */ messageDesc(file_routing, 3), RoutingAddDimensionWithVehicleTransitAndCapacitySchema = /* @__PURE__ */ messageDesc(file_routing, 4), RoutingPiecewiseLinearFunctionSchema = /* @__PURE__ */ messageDesc(file_routing, 5), RoutingStateDependentMatrixSchema = /* @__PURE__ */ messageDesc(file_routing, 6), RoutingAddDependentDimensionSchema = /* @__PURE__ */ messageDesc(file_routing, 7), RoutingAddConstantDimensionSchema = /* @__PURE__ */ messageDesc(file_routing, 8), RoutingAddVectorDimensionSchema = /* @__PURE__ */ messageDesc(file_routing, 9), RoutingAddMatrixDimensionSchema = /* @__PURE__ */ messageDesc(file_routing, 10);
var RoutingSetSweepArrangerSchema = /* @__PURE__ */ messageDesc(file_routing, 12), RoutingOrderedActivityGroupSchema = /* @__PURE__ */ messageDesc(file_routing, 13), RoutingAddDisjunctionSchema = /* @__PURE__ */ messageDesc(file_routing, 14), RoutingAddPickupAndDeliverySchema = /* @__PURE__ */ messageDesc(file_routing, 15), RoutingAddPickupAndDeliverySetsSchema = /* @__PURE__ */ messageDesc(file_routing, 16), RoutingSetPickupToDeliveryLimitsSchema = /* @__PURE__ */ messageDesc(file_routing, 17), RoutingAddVehicleEqualityConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 18), RoutingAddCumulLessOrEqualConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 19), RoutingSetNextValuesSchema = /* @__PURE__ */ messageDesc(file_routing, 20), RoutingSetVehicleValuesSchema = /* @__PURE__ */ messageDesc(file_routing, 21), RoutingSetAllowedVehiclesForIndexSchema = /* @__PURE__ */ messageDesc(file_routing, 22), RoutingSetSlackBoundsSchema = /* @__PURE__ */ messageDesc(file_routing, 23), RoutingSetActiveValuesSchema = /* @__PURE__ */ messageDesc(file_routing, 24), RoutingSetDimensionValueSchema = /* @__PURE__ */ messageDesc(file_routing, 25), RoutingSetCumulBoundsSchema = /* @__PURE__ */ messageDesc(file_routing, 26), RoutingAddNodePrecedenceSchema = /* @__PURE__ */ messageDesc(file_routing, 27), RoutingSetSoftSpanUpperBoundSchema = /* @__PURE__ */ messageDesc(file_routing, 28), RoutingSetQuadraticCostSoftSpanUpperBoundSchema = /* @__PURE__ */ messageDesc(file_routing, 29), RoutingSetArcCostEvaluatorOfVehiclesSchema = /* @__PURE__ */ messageDesc(file_routing, 30), RoutingSetCumulSoftBoundSchema = /* @__PURE__ */ messageDesc(file_routing, 31), RoutingSetMaximumActiveVehiclesSchema = /* @__PURE__ */ messageDesc(file_routing, 32), RoutingSetFixedVehicleCostSchema = /* @__PURE__ */ messageDesc(file_routing, 33), RoutingSetAmortizedVehicleCostsSchema = /* @__PURE__ */ messageDesc(file_routing, 34), RoutingSetVehicleUsedWhenEmptySchema = /* @__PURE__ */ messageDesc(file_routing, 35), RoutingAddSoftSameVehicleConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 36), RoutingSetPickupDeliveryPolicySchema = /* @__PURE__ */ messageDesc(file_routing, 37), RoutingSetVisitTypeSchema = /* @__PURE__ */ messageDesc(file_routing, 38), RoutingAddHardTypeIncompatibilitySchema = /* @__PURE__ */ messageDesc(file_routing, 39), RoutingAddTemporalTypeIncompatibilitySchema = /* @__PURE__ */ messageDesc(file_routing, 40), RoutingAddTypeRequirementSchema = /* @__PURE__ */ messageDesc(file_routing, 41), RoutingAddFinalizerSchema = /* @__PURE__ */ messageDesc(file_routing, 42), RoutingVariableReferenceSchema = /* @__PURE__ */ messageDesc(file_routing, 43), RoutingSetTabuVarsSchema = /* @__PURE__ */ messageDesc(file_routing, 44), RoutingModifyDomainSchema = /* @__PURE__ */ messageDesc(file_routing, 45);
var RoutingLinearExpressionSchema = /* @__PURE__ */ messageDesc(file_routing, 47), RoutingLinearComparisonSchema = /* @__PURE__ */ messageDesc(file_routing, 48), RoutingAddLinearConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 49);
var RoutingDomainQuerySchema = /* @__PURE__ */ messageDesc(file_routing, 51), RoutingDomainResultSchema = /* @__PURE__ */ messageDesc(file_routing, 52), RoutingModelOperationSchema = /* @__PURE__ */ messageDesc(file_routing, 53);
var RoutingSetPiecewiseCostSchema = /* @__PURE__ */ messageDesc(file_routing, 55), RoutingModelQuerySchema = /* @__PURE__ */ messageDesc(file_routing, 56);
var RoutingModelInspectionSchema = /* @__PURE__ */ messageDesc(file_routing, 59), RoutingDimensionQuerySchema = /* @__PURE__ */ messageDesc(file_routing, 60), RoutingAddForbiddenIntervalsSchema = /* @__PURE__ */ messageDesc(file_routing, 61);
var RoutingDimensionInspectionSchema = /* @__PURE__ */ messageDesc(file_routing, 63);
var RoutingAddRouteConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 65);
var RoutingPickupDeliveryInspectionSchema = /* @__PURE__ */ messageDesc(file_routing, 67), RoutingBreakInspectionRequestSchema = /* @__PURE__ */ messageDesc(file_routing, 68);
var RoutingBreakConfigurationSchema = /* @__PURE__ */ messageDesc(file_routing, 70), RoutingRouteSchema = /* @__PURE__ */ messageDesc(file_routing, 71), RoutingInitialAssignmentSchema = /* @__PURE__ */ messageDesc(file_routing, 72), RoutingAssignmentSnapshotSchema = /* @__PURE__ */ messageDesc(file_routing, 73);
var RoutingRouteLocksSchema = /* @__PURE__ */ messageDesc(file_routing, 75), RoutingPreAssignmentSchema = /* @__PURE__ */ messageDesc(file_routing, 76), RoutingCumulOptimizersSchema = /* @__PURE__ */ messageDesc(file_routing, 77), RoutingSearchStatisticsSchema = /* @__PURE__ */ messageDesc(file_routing, 78), RoutingSolutionSchema = /* @__PURE__ */ messageDesc(file_routing, 79), RoutingBridgeRequestSchema = /* @__PURE__ */ messageDesc(file_routing, 80), RoutingSetPathEnergyCostsSchema = /* @__PURE__ */ messageDesc(file_routing, 81), RoutingAddSameActivityGroupSchema = /* @__PURE__ */ messageDesc(file_routing, 82);
var RoutingActivityGroupsSchema = /* @__PURE__ */ messageDesc(file_routing, 84);
var RoutingAssignmentVariableSchema = /* @__PURE__ */ messageDesc(file_routing, 86), RoutingRouteCostSchema = /* @__PURE__ */ messageDesc(file_routing, 87), RoutingBridgeResponseSchema = /* @__PURE__ */ messageDesc(file_routing, 88), RoutingAddBreakIntervalSchema = /* @__PURE__ */ messageDesc(file_routing, 89), RoutingSetBreakIntervalsSchema = /* @__PURE__ */ messageDesc(file_routing, 90), RoutingSetBreakDistanceDurationSchema = /* @__PURE__ */ messageDesc(file_routing, 91), RoutingBreakAssignmentSchema = /* @__PURE__ */ messageDesc(file_routing, 92), RoutingSolveEventSchema = /* @__PURE__ */ messageDesc(file_routing, 93);
var RoutingResourceGroupSchema = /* @__PURE__ */ messageDesc(file_routing, 96), RoutingResourceAssignmentSchema = /* @__PURE__ */ messageDesc(file_routing, 97);
var RoutingResourceInspectionSchema = /* @__PURE__ */ messageDesc(file_routing, 100), RoutingBooleanExpressionSchema = /* @__PURE__ */ messageDesc(file_routing, 101), RoutingAddBooleanVariableSchema = /* @__PURE__ */ messageDesc(file_routing, 102), RoutingAddBooleanConstraintSchema = /* @__PURE__ */ messageDesc(file_routing, 103), RoutingAddIntegerExpressionSchema = /* @__PURE__ */ messageDesc(file_routing, 104);

// lib/routing/protocol.ts
var routingDimensionValueKinds = {
  spanUpperBound: 1 /* SPAN_UPPER_BOUND */,
  spanCost: 2 /* SPAN_COST */,
  slackCost: 3 /* SLACK_COST */,
  globalSpanCost: 4 /* GLOBAL_SPAN_COST */
};
function routingVariableKey(variable) {
  return JSON.stringify([variable.kind, variable.dimensionName, variable.index, variable.resourceGroup ?? 0]);
}
function bridgeMatrix(values, dimension, routingIndices = !0, unary = !1) {
  return create(RoutingMatrixSchema, {
    values: [...values],
    dimension,
    routingIndices,
    unary
  });
}
function bridgeVariable(variable) {
  return create(RoutingVariableReferenceSchema, { ...variable, index: BigInt(toIndex(variable.index)) });
}
function bridgeExpression(expression) {
  return create(RoutingLinearExpressionSchema, {
    offset: expression.offset,
    terms: expression.terms.map((term) => ({ variable: bridgeVariable(term.variable), coefficient: term.coefficient }))
  });
}
function decodeVariable(variable) {
  if (!variable) throw new Error("Routing operation has no variable reference.");
  return {
    kind: variable.kind,
    dimensionName: variable.dimensionName,
    index: toIndex(variable.index),
    ...variable.kind === 10 /* ROUTING_VARIABLE_RESOURCE */ ? { resourceGroup: variable.resourceGroup ?? 0 } : {}
  };
}
function decodeExpression(expression) {
  if (!expression) throw new Error("Routing constraint has no expression.");
  return { offset: expression.offset, terms: expression.terms.map((term) => ({ variable: decodeVariable(term.variable), coefficient: term.coefficient })) };
}
function bridgeBoolean(expression) {
  let kind = { constant: 1, variable: 2, comparison: 3, and: 4, or: 5, not: 6 }[expression.kind];
  return create(RoutingBooleanExpressionSchema, {
    kind,
    ...expression.kind === "constant" ? { value: expression.value } : {},
    ...expression.kind === "variable" ? { variable: bridgeVariable(expression.variable) } : {},
    ...expression.kind === "comparison" ? { comparison: {
      left: bridgeExpression(expression.comparison.left),
      right: bridgeExpression(expression.comparison.right),
      comparison: expression.comparison.comparison
    } } : {},
    ..."operands" in expression ? { operands: expression.operands.map(bridgeBoolean) } : {}
  });
}
function decodeBoolean(expression) {
  if (!expression) throw new Error("Routing Boolean expression is missing.");
  switch (expression.kind) {
    case 1:
      return { kind: "constant", value: expression.value };
    case 2:
      return { kind: "variable", variable: decodeVariable(expression.variable) };
    case 3: {
      let comparison = expression.comparison;
      if (!comparison) throw new Error("Routing Boolean comparison is missing.");
      return { kind: "comparison", comparison: { left: decodeExpression(comparison.left), right: decodeExpression(comparison.right), comparison: comparison.comparison } };
    }
    case 4:
    case 5:
    case 6:
      return { kind: expression.kind === 4 ? "and" : expression.kind === 5 ? "or" : "not", operands: expression.operands.map(decodeBoolean) };
    default:
      throw new Error("Unsupported Routing Boolean expression.");
  }
}
function encodeModelOperation(operation, dimension) {
  switch (operation.type) {
    case "setTabuVars":
      return create(RoutingModelOperationSchema, { operation: { case: "setTabuVars", value: create(
        RoutingSetTabuVarsSchema,
        { variables: operation.variables?.map(bridgeVariable), reset: operation.variables === null }
      ) } });
    case "setSweepArranger":
      return create(RoutingModelOperationSchema, { operation: { case: "setSweepArranger", value: create(RoutingSetSweepArrangerSchema, operation) } });
    case "addOrderedActivityGroup":
      return create(RoutingModelOperationSchema, { operation: { case: "addOrderedActivityGroup", value: create(RoutingOrderedActivityGroupSchema, operation) } });
    case "ignoreDisjunctionsAlreadyForcedToZero":
      return create(RoutingModelOperationSchema, { operation: { case: "ignoreDisjunctionsAlreadyForcedToZero", value: !0 } });
    case "addForbiddenIntervals":
      return create(RoutingModelOperationSchema, { operation: { case: "addForbiddenIntervals", value: create(RoutingAddForbiddenIntervalsSchema, operation) } });
    case "setPiecewiseCost":
      return create(RoutingModelOperationSchema, { operation: { case: "setPiecewiseCost", value: create(RoutingSetPiecewiseCostSchema, operation) } });
    case "addRouteConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addRouteConstraint", value: create(RoutingAddRouteConstraintSchema, operation) } });
    case "setFirstSolutionEvaluator":
      return create(RoutingModelOperationSchema, { operation: { case: "setFirstSolutionEvaluator", value: bridgeMatrix(operation.transitMatrix, dimension) } });
    case "setPrimaryConstrainedDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "setPrimaryConstrainedDimension", value: operation.dimensionName } });
    case "setPathEnergyCosts":
      return create(RoutingModelOperationSchema, { operation: { case: "setPathEnergyCosts", value: create(RoutingSetPathEnergyCostsSchema, operation) } });
    case "addSameActivityGroup":
      return create(RoutingModelOperationSchema, { operation: { case: "addSameActivityGroup", value: create(RoutingAddSameActivityGroupSchema, operation) } });
    case "addBreakInterval":
      return create(RoutingModelOperationSchema, { operation: { case: "addBreakInterval", value: create(RoutingAddBreakIntervalSchema, operation) } });
    case "setBreakIntervals":
      return create(RoutingModelOperationSchema, { operation: { case: "setBreakIntervals", value: create(RoutingSetBreakIntervalsSchema, {
        dimensionName: operation.dimensionName,
        vehicle: operation.vehicle,
        intervals: operation.intervals,
        preTravelHandle: operation.preTravelHandle,
        postTravelHandle: operation.postTravelHandle,
        preTravel: operation.preTravel && bridgeMatrix(operation.preTravel, dimension),
        postTravel: operation.postTravel && bridgeMatrix(operation.postTravel, dimension)
      }) } });
    case "setBreakDistanceDuration":
      return create(RoutingModelOperationSchema, { operation: { case: "setBreakDistanceDuration", value: create(RoutingSetBreakDistanceDurationSchema, operation) } });
    case "addIntegerExpression":
      return create(RoutingModelOperationSchema, { operation: { case: "addIntegerExpression", value: create(RoutingAddIntegerExpressionSchema, {
        index: operation.index,
        kind: operation.kind,
        operands: operation.operands.map(bridgeExpression)
      }) } });
    case "addBooleanVariable":
      return create(RoutingModelOperationSchema, { operation: { case: "addBooleanVariable", value: create(RoutingAddBooleanVariableSchema, {
        index: operation.index,
        expression: bridgeBoolean(operation.expression)
      }) } });
    case "addBooleanConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addBooleanConstraint", value: create(RoutingAddBooleanConstraintSchema, { expression: bridgeBoolean(operation.expression) }) } });
    case "modifyDomain":
      return create(RoutingModelOperationSchema, { operation: { case: "modifyDomain", value: create(RoutingModifyDomainSchema, {
        variable: bridgeVariable(operation.variable),
        action: operation.action,
        lower: operation.lower,
        upper: operation.upper,
        values: operation.values
      }) } });
    case "addLinearConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addLinearConstraint", value: create(RoutingAddLinearConstraintSchema, {
        left: bridgeExpression(operation.left),
        right: bridgeExpression(operation.right),
        comparison: operation.comparison,
        booleanConditions: operation.booleanConditions?.map(bridgeBoolean),
        conditions: operation.conditions?.map((condition) => create(RoutingLinearComparisonSchema, {
          left: bridgeExpression(condition.left),
          right: bridgeExpression(condition.right),
          comparison: condition.comparison
        }))
      }) } });
    case "addFinalizer":
      return create(RoutingModelOperationSchema, { operation: { case: "addFinalizer", value: create(RoutingAddFinalizerSchema, {
        variableKind: operation.variableKind,
        dimensionName: operation.dimensionName,
        index: BigInt(toIndex(operation.index)),
        resourceGroup: operation.resourceGroup,
        kind: operation.kind,
        target: toInt64(operation.target),
        weight: operation.weight === void 0 ? void 0 : toInt64(operation.weight)
      }) } });
    case "setNextValues":
      return create(RoutingModelOperationSchema, { operation: { case: "setNextValues", value: create(RoutingSetNextValuesSchema, {
        index: BigInt(toIndex(operation.index, "successor variable index")),
        values: Array.from(operation.values, (value) => BigInt(toIndex(value, "successor value")))
      }) } });
    case "setVehicleValues":
      return create(RoutingModelOperationSchema, { operation: { case: "setVehicleValues", value: create(RoutingSetVehicleValuesSchema, {
        index: BigInt(toIndex(operation.index, "vehicle variable index")),
        values: Array.from(operation.values, (value) => {
          let exact = toInt64(value, "vehicle domain value");
          if (exact < -1n || exact > 2147483647n) throw new RangeError("Invalid vehicle domain value.");
          return Number(exact);
        })
      }) } });
    case "setAllowedVehiclesForIndex":
      return create(RoutingModelOperationSchema, { operation: { case: "setAllowedVehiclesForIndex", value: create(RoutingSetAllowedVehiclesForIndexSchema, {
        vehicles: operation.vehicles.map((vehicle) => toIndex(vehicle, "eligible vehicle", 2147483647)),
        index: BigInt(toIndex(operation.index, "eligibility index"))
      }) } });
    case "setActiveValues":
      return create(RoutingModelOperationSchema, { operation: { case: "setActiveValues", value: create(RoutingSetActiveValuesSchema, {
        index: BigInt(toIndex(operation.index, "active variable index")),
        values: Array.from(operation.values, (value) => toIndex(value, "active domain value", 1))
      }) } });
    case "setSlackBounds":
      return create(RoutingModelOperationSchema, { operation: { case: "setSlackBounds", value: create(RoutingSetSlackBoundsSchema, {
        dimensionName: operation.dimensionName,
        index: BigInt(toIndex(operation.index, "slack index")),
        lower: toInt64(operation.lower),
        upper: toInt64(operation.upper)
      }) } });
    case "setDimensionValue":
      return create(RoutingModelOperationSchema, { operation: { case: "setDimensionValue", value: create(RoutingSetDimensionValueSchema, {
        dimensionName: operation.dimensionName,
        kind: routingDimensionValueKinds[operation.setting],
        value: toInt64(operation.value),
        vehicle: operation.vehicle === void 0 ? void 0 : toIndex(operation.vehicle, "dimension vehicle", 2147483647)
      }) } });
    case "setMaximumActiveVehicles":
      return create(RoutingModelOperationSchema, { operation: { case: "setMaximumActiveVehicles", value: create(RoutingSetMaximumActiveVehiclesSchema, {
        maximum: toIndex(operation.maximum, "maximum active vehicles", 2147483647)
      }) } });
    case "setFixedVehicleCost":
      return create(RoutingModelOperationSchema, { operation: { case: "setFixedVehicleCost", value: create(RoutingSetFixedVehicleCostSchema, {
        cost: toInt64(operation.cost),
        vehicle: toIndex(operation.vehicle, "fixed-cost vehicle", 2147483647)
      }) } });
    case "setAmortizedVehicleCosts":
      return create(RoutingModelOperationSchema, { operation: { case: "setAmortizedVehicleCosts", value: create(RoutingSetAmortizedVehicleCostsSchema, {
        linear: toInt64(operation.linear),
        quadratic: toInt64(operation.quadratic),
        vehicle: toIndex(operation.vehicle, "amortized-cost vehicle", 2147483647)
      }) } });
    case "setVehicleUsedWhenEmpty":
      return create(RoutingModelOperationSchema, { operation: { case: "setVehicleUsedWhenEmpty", value: create(RoutingSetVehicleUsedWhenEmptySchema, {
        isUsed: operation.isUsed,
        vehicle: toIndex(operation.vehicle, "empty-route vehicle", 2147483647)
      }) } });
    case "setCumulSoftBound":
      return create(RoutingModelOperationSchema, { operation: { case: "setCumulSoftBound", value: create(RoutingSetCumulSoftBoundSchema, {
        dimensionName: operation.dimensionName,
        index: BigInt(toIndex(operation.index, "soft cumul index")),
        bound: toInt64(operation.bound),
        coefficient: toInt64(operation.coefficient),
        lower: operation.lower
      }) } });
    case "setCumulBounds":
      return create(RoutingModelOperationSchema, { operation: { case: "setCumulBounds", value: create(RoutingSetCumulBoundsSchema, {
        dimensionName: operation.dimensionName,
        index: BigInt(toIndex(operation.index, "cumul index")),
        lower: toInt64(operation.lower),
        upper: toInt64(operation.upper)
      }) } });
    case "addNodePrecedence":
      return create(RoutingModelOperationSchema, { operation: { case: "addNodePrecedence", value: create(RoutingAddNodePrecedenceSchema, {
        dimensionName: operation.dimensionName,
        first: BigInt(toIndex(operation.first, "precedence first index")),
        second: BigInt(toIndex(operation.second, "precedence second index")),
        offset: operation.offset,
        performedConstraint: operation.performedConstraint
      }) } });
    case "setArcCostEvaluatorOfVehicles":
      return create(RoutingModelOperationSchema, { operation: { case: "setArcCostEvaluatorOfVehicles", value: create(RoutingSetArcCostEvaluatorOfVehiclesSchema, {
        transitMatrix: bridgeMatrix(operation.transitMatrix, dimension),
        vehicles: operation.vehicles
      }) } });
    case "addDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "addDimension", value: create(RoutingAddDimensionSchema, {
        transitMatrix: bridgeMatrix(operation.transitMatrix, dimension, !0, operation.unaryTransit),
        slackMax: operation.slackMax,
        capacity: operation.capacity,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addDimensionWithVehicleCapacity":
      return create(RoutingModelOperationSchema, { operation: { case: "addDimensionWithVehicleCapacity", value: create(RoutingAddDimensionWithVehicleCapacitySchema, {
        transitMatrix: bridgeMatrix(operation.transitMatrix, dimension, !0, operation.unaryTransit),
        slackMax: operation.slackMax,
        capacities: operation.capacities,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addDimensionWithVehicleTransits":
      return create(RoutingModelOperationSchema, { operation: { case: "addDimensionWithVehicleTransits", value: create(RoutingAddDimensionWithVehicleTransitsSchema, {
        transitMatrices: operation.transitMatrices.map((matrix, i) => bridgeMatrix(matrix, dimension, !0, operation.unaryTransits?.[i])),
        slackMax: operation.slackMax,
        capacity: operation.capacity,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addTypeRequirement":
      return create(RoutingModelOperationSchema, { operation: { case: "addTypeRequirement", value: create(RoutingAddTypeRequirementSchema, {
        kind: operation.kind,
        dependentType: operation.dependentType,
        requiredTypeAlternatives: operation.requiredTypeAlternatives
      }) } });
    case "setVisitType":
      return create(RoutingModelOperationSchema, { operation: { case: "setVisitType", value: create(RoutingSetVisitTypeSchema, {
        index: BigInt(operation.index),
        type: operation.visitType,
        policy: operation.policy
      }) } });
    case "addHardTypeIncompatibility":
      return create(RoutingModelOperationSchema, { operation: { case: "addHardTypeIncompatibility", value: create(RoutingAddHardTypeIncompatibilitySchema, {
        type1: operation.type1,
        type2: operation.type2
      }) } });
    case "addTemporalTypeIncompatibility":
      return create(RoutingModelOperationSchema, { operation: { case: "addTemporalTypeIncompatibility", value: create(RoutingAddTemporalTypeIncompatibilitySchema, {
        type1: operation.type1,
        type2: operation.type2
      }) } });
    case "addDimensionWithVehicleTransitAndCapacity":
      return create(RoutingModelOperationSchema, { operation: { case: "addDimensionWithVehicleTransitAndCapacity", value: create(RoutingAddDimensionWithVehicleTransitAndCapacitySchema, {
        transitMatrices: operation.transitMatrices.map((matrix, i) => bridgeMatrix(matrix, dimension, !0, operation.unaryTransits?.[i])),
        slackMax: operation.slackMax,
        capacities: operation.capacities,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addDependentDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "addDependentDimension", value: create(RoutingAddDependentDimensionSchema, {
        transitMatrices: operation.transitMatrices.map((matrix, i) => bridgeMatrix(matrix, dimension, !0, operation.unaryTransits?.[i])),
        dependentMatrices: operation.dependentMatrices.map((matrix) => create(RoutingStateDependentMatrixSchema, {
          domainStart: matrix.domainStart,
          domainEnd: matrix.domainEnd,
          functions: matrix.functions.map((fn) => create(RoutingPiecewiseLinearFunctionSchema, fn))
        })),
        baseDimension: operation.baseDimension,
        slackMax: operation.slackMax,
        capacities: operation.capacities,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addConstantDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "addConstantDimension", value: create(RoutingAddConstantDimensionSchema, {
        value: operation.value,
        capacity: operation.capacity,
        slackMax: operation.slackMax,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addVectorDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "addVectorDimension", value: create(RoutingAddVectorDimensionSchema, {
        values: operation.values,
        capacity: operation.capacity,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addMatrixDimension":
      return create(RoutingModelOperationSchema, { operation: { case: "addMatrixDimension", value: create(RoutingAddMatrixDimensionSchema, {
        matrix: bridgeMatrix(operation.matrix.flat(), operation.matrix.length, !1),
        capacity: operation.capacity,
        fixStartCumulToZero: operation.fixStartCumulToZero,
        name: operation.name
      }) } });
    case "addSoftSameVehicleConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addSoftSameVehicleConstraint", value: create(RoutingAddSoftSameVehicleConstraintSchema, {
        indices: operation.indices.map((index) => BigInt(toIndex(index, "soft same-vehicle index"))),
        cost: toInt64(operation.cost)
      }) } });
    case "setPickupDeliveryPolicy":
      return create(RoutingModelOperationSchema, { operation: { case: "setPickupDeliveryPolicy", value: create(RoutingSetPickupDeliveryPolicySchema, {
        policy: toIndex(operation.policy, "pickup/delivery policy", 2),
        vehicle: toIndex(operation.vehicle, "pickup/delivery vehicle", 2147483647)
      }) } });
    case "addDisjunction":
      return create(RoutingModelOperationSchema, { operation: { case: "addDisjunction", value: create(RoutingAddDisjunctionSchema, {
        indices: bridgeIndices(operation.indices, "disjunction indices"),
        penalty: operation.penalty,
        maxCardinality: operation.maxCardinality === void 0 ? void 0 : toInt64(operation.maxCardinality),
        penaltyCostBehavior: operation.penaltyCostBehavior === void 0 ? void 0 : toIndex(operation.penaltyCostBehavior, "disjunction penalty behavior", 1)
      }) } });
    case "addPickupAndDeliverySets":
      return create(RoutingModelOperationSchema, { operation: { case: "addPickupAndDeliverySets", value: create(RoutingAddPickupAndDeliverySetsSchema, {
        pickupDisjunction: toIndex(operation.pickupDisjunction, "pickup disjunction", 2147483647),
        deliveryDisjunction: toIndex(operation.deliveryDisjunction, "delivery disjunction", 2147483647)
      }) } });
    case "setPickupToDeliveryLimits":
      return create(RoutingModelOperationSchema, { operation: { case: "setPickupToDeliveryLimits", value: create(RoutingSetPickupToDeliveryLimitsSchema, {
        dimensionName: operation.dimensionName,
        pairIndex: toIndex(operation.pairIndex, "pickup/delivery pair", 2147483647),
        limits: operation.limits.map((value) => toInt64(value, "pickup/delivery limit"))
      }) } });
    case "addPickupAndDelivery":
      return create(RoutingModelOperationSchema, { operation: { case: "addPickupAndDelivery", value: create(RoutingAddPickupAndDeliverySchema, {
        pickup: BigInt(toIndex(operation.pickup, "pickup index")),
        delivery: BigInt(toIndex(operation.delivery, "delivery index"))
      }) } });
    case "addVehicleEqualityConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addVehicleEqualityConstraint", value: create(RoutingAddVehicleEqualityConstraintSchema, {
        left: BigInt(toIndex(operation.left, "left index")),
        right: BigInt(toIndex(operation.right, "right index"))
      }) } });
    case "addCumulLessOrEqualConstraint":
      return create(RoutingModelOperationSchema, { operation: { case: "addCumulLessOrEqualConstraint", value: create(RoutingAddCumulLessOrEqualConstraintSchema, {
        dimensionName: operation.dimensionName,
        left: BigInt(toIndex(operation.left, "left index")),
        right: BigInt(toIndex(operation.right, "right index"))
      }) } });
    case "setSoftSpanUpperBound":
      return create(RoutingModelOperationSchema, { operation: { case: "setSoftSpanUpperBound", value: create(RoutingSetSoftSpanUpperBoundSchema, {
        dimensionName: operation.dimensionName,
        bound: operation.bound,
        cost: operation.cost,
        vehicle: operation.vehicle
      }) } });
    case "setQuadraticCostSoftSpanUpperBound":
      return create(RoutingModelOperationSchema, { operation: { case: "setQuadraticCostSoftSpanUpperBound", value: create(RoutingSetQuadraticCostSoftSpanUpperBoundSchema, {
        dimensionName: operation.dimensionName,
        bound: operation.bound,
        cost: operation.cost,
        vehicle: operation.vehicle
      }) } });
  }
}
function indices(values, label) {
  return values.map((value, index) => toIndex(value, `${label}[${index}]`));
}
function bridgeIndices(values, label) {
  return values.map((value, index) => BigInt(toIndex(value, `${label}[${index}]`)));
}
function decodeMatrix(values, dimension) {
  let flat = [...values];
  return Array.from(
    { length: dimension },
    (_, row) => flat.slice(row * dimension, (row + 1) * dimension)
  );
}
function decodeModelOperation(input) {
  switch (input.operation.case) {
    case "setTabuVars":
      return { type: "setTabuVars", variables: input.operation.value.reset ? null : input.operation.value.variables.map(decodeVariable) };
    case "setSweepArranger":
      return { type: "setSweepArranger", points: input.operation.value.points.map(({ x, y }) => ({ x, y })) };
    case "addOrderedActivityGroup":
      return { type: "addOrderedActivityGroup", disjunctions: [...input.operation.value.disjunctions] };
    case "ignoreDisjunctionsAlreadyForcedToZero":
      return { type: "ignoreDisjunctionsAlreadyForcedToZero" };
    case "addForbiddenIntervals": {
      let value = input.operation.value;
      return { type: "addForbiddenIntervals", dimensionName: value.dimensionName, index: value.index, intervals: value.intervals.map(({ start, end }) => ({ start, end })) };
    }
    case "setPiecewiseCost": {
      let value = input.operation.value;
      return { type: "setPiecewiseCost", dimensionName: value.dimensionName, index: value.index, segments: value.segments.map(({ pointX, pointY, slope, otherPointX }) => ({ pointX, pointY, slope, otherPointX })) };
    }
    case "addRouteConstraint":
      return { type: "addRouteConstraint", evaluator: input.operation.value.evaluator, costsAreHomogeneousAcrossVehicles: input.operation.value.costsAreHomogeneousAcrossVehicles };
    case "setFirstSolutionEvaluator":
      return { type: "setFirstSolutionEvaluator", transitMatrix: BigInt64Array.from(input.operation.value.values) };
    case "setPrimaryConstrainedDimension":
      return { type: "setPrimaryConstrainedDimension", dimensionName: input.operation.value };
    case "addBreakInterval": {
      let value = input.operation.value;
      return {
        type: "addBreakInterval",
        index: value.index,
        startMin: value.startMin,
        startMax: value.startMax,
        duration: value.duration,
        optional: value.optional,
        name: value.name
      };
    }
    case "setPathEnergyCosts": {
      let value = input.operation.value;
      return {
        type: "setPathEnergyCosts",
        force: value.force,
        distance: value.distance,
        threshold: value.threshold,
        costBelow: value.costBelow,
        costAbove: value.costAbove,
        vehicle: value.vehicle
      };
    }
    case "addSameActivityGroup":
      return { type: "addSameActivityGroup", indices: input.operation.value.indices };
    case "setBreakIntervals": {
      let value = input.operation.value;
      return {
        type: "setBreakIntervals",
        dimensionName: value.dimensionName,
        vehicle: value.vehicle,
        intervals: value.intervals,
        preTravel: value.preTravel?.values,
        postTravel: value.postTravel?.values,
        ...value.preTravelHandle === void 0 ? {} : { preTravelHandle: value.preTravelHandle },
        ...value.postTravelHandle === void 0 ? {} : { postTravelHandle: value.postTravelHandle }
      };
    }
    case "setBreakDistanceDuration": {
      let value = input.operation.value;
      return {
        type: "setBreakDistanceDuration",
        dimensionName: value.dimensionName,
        vehicle: value.vehicle,
        distance: value.distance,
        duration: value.duration
      };
    }
    case "addIntegerExpression":
      return { type: "addIntegerExpression", index: input.operation.value.index, kind: input.operation.value.kind, operands: input.operation.value.operands.map(decodeExpression) };
    case "addBooleanVariable":
      return { type: "addBooleanVariable", index: input.operation.value.index, expression: decodeBoolean(input.operation.value.expression) };
    case "addBooleanConstraint":
      return { type: "addBooleanConstraint", expression: decodeBoolean(input.operation.value.expression) };
    case "modifyDomain": {
      let value = input.operation.value;
      return {
        type: "modifyDomain",
        variable: decodeVariable(value.variable),
        action: value.action,
        lower: value.lower,
        upper: value.upper,
        values: value.values
      };
    }
    case "addLinearConstraint": {
      let value = input.operation.value;
      return {
        type: "addLinearConstraint",
        left: decodeExpression(value.left),
        right: decodeExpression(value.right),
        comparison: value.comparison,
        ...value.booleanConditions.length ? { booleanConditions: value.booleanConditions.map(decodeBoolean) } : {},
        ...value.conditions.length ? { conditions: value.conditions.map((condition) => ({
          left: decodeExpression(condition.left),
          right: decodeExpression(condition.right),
          comparison: condition.comparison
        })) } : {}
      };
    }
    case "addFinalizer": {
      let value = input.operation.value;
      return {
        type: "addFinalizer",
        variableKind: value.variableKind,
        dimensionName: value.dimensionName,
        index: toIndex(value.index),
        ...value.variableKind === 10 /* ROUTING_VARIABLE_RESOURCE */ ? { resourceGroup: value.resourceGroup } : {},
        kind: value.kind,
        target: value.target,
        ...value.weight === void 0 ? {} : { weight: value.weight }
      };
    }
    case "setNextValues": {
      let value = input.operation.value;
      return {
        type: "setNextValues",
        index: toIndex(value.index, "successor variable index"),
        values: indices(value.values, "successor values")
      };
    }
    case "setVehicleValues": {
      let value = input.operation.value;
      return {
        type: "setVehicleValues",
        index: toIndex(value.index, "vehicle variable index"),
        values: value.values
      };
    }
    case "setAllowedVehiclesForIndex": {
      let value = input.operation.value;
      return {
        type: "setAllowedVehiclesForIndex",
        vehicles: value.vehicles,
        index: toIndex(value.index, "eligibility index")
      };
    }
    case "setActiveValues": {
      let value = input.operation.value;
      return {
        type: "setActiveValues",
        index: toIndex(value.index, "active variable index"),
        values: value.values.map((item) => toIndex(item, "active domain value", 1))
      };
    }
    case "setSlackBounds": {
      let value = input.operation.value;
      return {
        type: "setSlackBounds",
        dimensionName: value.dimensionName,
        index: toIndex(value.index, "slack index"),
        lower: value.lower,
        upper: value.upper
      };
    }
    case "setDimensionValue": {
      let value = input.operation.value, setting = Object.keys(routingDimensionValueKinds).find((key2) => routingDimensionValueKinds[key2] === value.kind);
      if (!setting) throw new Error("Routing dimension setting has an invalid kind.");
      return {
        type: "setDimensionValue",
        dimensionName: value.dimensionName,
        setting,
        value: value.value,
        vehicle: value.vehicle === void 0 ? void 0 : toIndex(value.vehicle, "dimension vehicle", 2147483647)
      };
    }
    case "setMaximumActiveVehicles": {
      let value = input.operation.value;
      return { type: "setMaximumActiveVehicles", maximum: toIndex(value.maximum, "maximum active vehicles", 2147483647) };
    }
    case "setFixedVehicleCost": {
      let value = input.operation.value;
      return { type: "setFixedVehicleCost", cost: value.cost, vehicle: toIndex(value.vehicle, "fixed-cost vehicle", 2147483647) };
    }
    case "setAmortizedVehicleCosts": {
      let value = input.operation.value;
      return { type: "setAmortizedVehicleCosts", linear: value.linear, quadratic: value.quadratic, vehicle: toIndex(value.vehicle, "amortized-cost vehicle", 2147483647) };
    }
    case "setVehicleUsedWhenEmpty": {
      let value = input.operation.value;
      return { type: "setVehicleUsedWhenEmpty", isUsed: value.isUsed, vehicle: toIndex(value.vehicle, "empty-route vehicle", 2147483647) };
    }
    case "setCumulSoftBound": {
      let value = input.operation.value;
      return {
        type: "setCumulSoftBound",
        dimensionName: value.dimensionName,
        index: toIndex(value.index, "soft cumul index"),
        bound: value.bound,
        coefficient: value.coefficient,
        lower: value.lower
      };
    }
    case "setCumulBounds": {
      let value = input.operation.value;
      return {
        type: "setCumulBounds",
        dimensionName: value.dimensionName,
        index: toIndex(value.index, "cumul index"),
        lower: value.lower,
        upper: value.upper
      };
    }
    case "addNodePrecedence": {
      let value = input.operation.value;
      return {
        type: "addNodePrecedence",
        dimensionName: value.dimensionName,
        first: toIndex(value.first, "precedence first index"),
        second: toIndex(value.second, "precedence second index"),
        offset: value.offset,
        performedConstraint: value.performedConstraint
      };
    }
    case "setArcCostEvaluatorOfVehicles": {
      let value = input.operation.value;
      return { type: "setArcCostEvaluatorOfVehicles", transitMatrix: new BigInt64Array(value.transitMatrix?.values ?? []), vehicles: value.vehicles };
    }
    case "addDimension": {
      let value = input.operation.value;
      return { type: "addDimension", ...value.transitMatrix?.unary ? { unaryTransit: !0 } : {}, transitMatrix: new BigInt64Array(value.transitMatrix?.values ?? []), slackMax: value.slackMax, capacity: value.capacity, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addDimensionWithVehicleCapacity": {
      let value = input.operation.value;
      return { type: "addDimensionWithVehicleCapacity", ...value.transitMatrix?.unary ? { unaryTransit: !0 } : {}, transitMatrix: new BigInt64Array(value.transitMatrix?.values ?? []), slackMax: value.slackMax, capacities: value.capacities, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addDimensionWithVehicleTransits": {
      let value = input.operation.value;
      return { type: "addDimensionWithVehicleTransits", ...value.transitMatrices.some((item) => item.unary) ? { unaryTransits: value.transitMatrices.map((item) => item.unary) } : {}, transitMatrices: value.transitMatrices.map((item) => new BigInt64Array(item.values)), slackMax: value.slackMax, capacity: value.capacity, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addTypeRequirement": {
      let value = input.operation.value;
      return { type: "addTypeRequirement", kind: value.kind, dependentType: value.dependentType, requiredTypeAlternatives: value.requiredTypeAlternatives };
    }
    case "setVisitType": {
      let value = input.operation.value;
      return { type: "setVisitType", index: toIndex(value.index), visitType: value.type, policy: value.policy };
    }
    case "addHardTypeIncompatibility": {
      let value = input.operation.value;
      return { type: "addHardTypeIncompatibility", type1: value.type1, type2: value.type2 };
    }
    case "addTemporalTypeIncompatibility": {
      let value = input.operation.value;
      return { type: "addTemporalTypeIncompatibility", type1: value.type1, type2: value.type2 };
    }
    case "addDimensionWithVehicleTransitAndCapacity": {
      let value = input.operation.value;
      return { type: "addDimensionWithVehicleTransitAndCapacity", ...value.transitMatrices.some((item) => item.unary) ? { unaryTransits: value.transitMatrices.map((item) => item.unary) } : {}, transitMatrices: value.transitMatrices.map((item) => new BigInt64Array(item.values)), slackMax: value.slackMax, capacities: value.capacities, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addDependentDimension": {
      let value = input.operation.value;
      return {
        type: "addDependentDimension",
        ...value.transitMatrices.some((item) => item.unary) ? { unaryTransits: value.transitMatrices.map((item) => item.unary) } : {},
        transitMatrices: value.transitMatrices.map((item) => new BigInt64Array(item.values)),
        dependentMatrices: value.dependentMatrices.map((matrix) => ({
          domainStart: matrix.domainStart,
          domainEnd: matrix.domainEnd,
          functions: matrix.functions.map((fn) => ({ x: fn.x, y: fn.y }))
        })),
        baseDimension: value.baseDimension,
        slackMax: value.slackMax,
        capacities: value.capacities,
        fixStartCumulToZero: value.fixStartCumulToZero,
        name: value.name
      };
    }
    case "addConstantDimension": {
      let value = input.operation.value;
      return { type: "addConstantDimension", value: value.value, capacity: value.capacity, ...value.slackMax === void 0 ? {} : { slackMax: value.slackMax }, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addVectorDimension": {
      let value = input.operation.value;
      return { type: "addVectorDimension", values: value.values, capacity: value.capacity, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addMatrixDimension": {
      let value = input.operation.value;
      return { type: "addMatrixDimension", matrix: decodeMatrix(value.matrix?.values ?? [], value.matrix?.dimension ?? 0), capacity: value.capacity, fixStartCumulToZero: value.fixStartCumulToZero, name: value.name };
    }
    case "addSoftSameVehicleConstraint": {
      let value = input.operation.value;
      return { type: "addSoftSameVehicleConstraint", indices: indices(value.indices, "soft same-vehicle indices"), cost: value.cost };
    }
    case "setPickupDeliveryPolicy": {
      let value = input.operation.value;
      return { type: "setPickupDeliveryPolicy", policy: toIndex(value.policy, "pickup/delivery policy", 2), vehicle: toIndex(value.vehicle, "pickup/delivery vehicle", 2147483647) };
    }
    case "addDisjunction": {
      let value = input.operation.value;
      return {
        type: "addDisjunction",
        indices: indices(value.indices, "disjunction indices"),
        penalty: value.penalty,
        ...value.maxCardinality === void 0 ? {} : { maxCardinality: value.maxCardinality },
        ...value.penaltyCostBehavior === void 0 ? {} : { penaltyCostBehavior: toIndex(value.penaltyCostBehavior, "disjunction penalty behavior", 1) }
      };
    }
    case "addPickupAndDeliverySets": {
      let value = input.operation.value;
      return { type: "addPickupAndDeliverySets", pickupDisjunction: value.pickupDisjunction, deliveryDisjunction: value.deliveryDisjunction };
    }
    case "setPickupToDeliveryLimits": {
      let value = input.operation.value;
      return { type: "setPickupToDeliveryLimits", dimensionName: value.dimensionName, pairIndex: value.pairIndex, limits: value.limits };
    }
    case "addPickupAndDelivery": {
      let value = input.operation.value;
      return { type: "addPickupAndDelivery", pickup: toIndex(value.pickup, "pickup index"), delivery: toIndex(value.delivery, "delivery index") };
    }
    case "addVehicleEqualityConstraint": {
      let value = input.operation.value;
      return { type: "addVehicleEqualityConstraint", left: toIndex(value.left, "left index"), right: toIndex(value.right, "right index") };
    }
    case "addCumulLessOrEqualConstraint": {
      let value = input.operation.value;
      return { type: "addCumulLessOrEqualConstraint", dimensionName: value.dimensionName, left: toIndex(value.left, "left index"), right: toIndex(value.right, "right index") };
    }
    case "setSoftSpanUpperBound": {
      let value = input.operation.value;
      return { type: "setSoftSpanUpperBound", dimensionName: value.dimensionName, bound: value.bound, cost: value.cost, vehicle: value.vehicle };
    }
    case "setQuadraticCostSoftSpanUpperBound": {
      let value = input.operation.value;
      return { type: "setQuadraticCostSoftSpanUpperBound", dimensionName: value.dimensionName, bound: value.bound, cost: value.cost, vehicle: value.vehicle };
    }
    default:
      throw new Error("Routing request contains an empty model operation.");
  }
}
function bridgeAssignment(snapshot) {
  return snapshot && create(RoutingAssignmentSnapshotSchema, {
    ...snapshot,
    variables: snapshot.variables.map((value) => ({ ...value, variable: bridgeVariable(value.variable) }))
  });
}
function decodeBreakAssignment(value) {
  return {
    index: value.index,
    performedMin: value.performedMin,
    performedMax: value.performedMax,
    startMin: value.startMin,
    startMax: value.startMax,
    endMin: value.endMin,
    endMax: value.endMax
  };
}
function decodeAssignment(snapshot) {
  return snapshot && {
    ...snapshot.objectiveValue === void 0 ? {} : { objectiveValue: snapshot.objectiveValue },
    ...snapshot.objectiveMin === void 0 ? {} : { objectiveMin: snapshot.objectiveMin },
    ...snapshot.objectiveMax === void 0 ? {} : { objectiveMax: snapshot.objectiveMax },
    intervals: snapshot.intervals.map(decodeBreakAssignment),
    variables: snapshot.variables.map((value) => ({ min: value.min, max: value.max, variable: decodeVariable(value.variable) }))
  };
}
function encodeOperation(operation) {
  return toBinary(RoutingBridgeRequestSchema, bridgeRequest(operation.request, operation.interruptible));
}
function bridgeRequest(request, interruptible = !1) {
  return create(RoutingBridgeRequestSchema, {
    validateSearchParameters: request.validateSearchParameters,
    assignmentTransfer: request.assignmentTransfer,
    secondaryModel: request.secondaryModel && bridgeRequest(request.secondaryModel),
    routeLocks: request.routeLocks && create(RoutingRouteLocksSchema, {
      closeRoutes: request.routeLocks.closeRoutes,
      routes: request.routeLocks.routes.map((indices2) => ({ indices: bridgeIndices(indices2, "lock indices") }))
    }),
    inspectPreAssignment: request.inspectPreAssignment,
    firstSolutionHint: bridgeAssignment(request.firstSolutionHint),
    resourceInspectionGroup: request.resourceInspectionGroup,
    inspectActivityGroups: request.inspectActivityGroups,
    arcCostQueries: request.arcCostQueries,
    domainQueries: request.domainQueries?.map((query) => create(RoutingDomainQuerySchema, {
      variable: bridgeVariable(query.variable),
      containsValue: query.containsValue,
      softLowerBound: query.softLowerBound
    })),
    solutionEvents: request.solutionEvents ?? !1,
    trackUncheckedNeighbors: request.trackUncheckedNeighbors ?? !1,
    numLocations: request.numLocations,
    numVehicles: request.numVehicles,
    starts: request.starts,
    ends: request.ends,
    searchParametersProto: request.searchParametersProto,
    searchParameterFields: request.searchParameterFields ?? [],
    modelParametersProto: request.modelParametersProto,
    modelParameterFields: request.modelParameterFields ?? [],
    transitMatrix: bridgeMatrix(request.transitMatrix, request.transitMatrixDimension),
    operations: request.operations.map((item) => encodeModelOperation(item, request.transitMatrixDimension)),
    resourceGroups: request.resourceGroups?.map((group) => create(RoutingResourceGroupSchema, group)),
    dimensionNames: request.dimensionNames,
    initialAssignment: request.initialAssignment ? create(RoutingInitialAssignmentSchema, {
      routes: request.initialAssignment.routes.map((indices2) => create(RoutingRouteSchema, {
        indices: bridgeIndices(indices2, "route indices")
      })),
      ignoreInactiveIndices: request.initialAssignment.ignoreInactiveIndices,
      snapshot: bridgeAssignment(request.initialAssignment.snapshot)
    }) : void 0,
    interruptible,
    readAssignmentOnly: request.readAssignmentOnly,
    assignmentAction: request.assignmentAction,
    candidateAssignments: request.candidateAssignments?.map((value) => bridgeAssignment(value)),
    packingDurationSeconds: request.packingDurationSeconds,
    checkSolutionInCp: request.checkSolutionInCp ?? !0,
    inspectCumulOptimizers: request.inspectCumulOptimizers ?? !1,
    callAtSolutionMonitors: request.callAtSolutionMonitors ?? !1,
    dimensionQuery: request.dimensionQuery && create(RoutingDimensionQuerySchema, request.dimensionQuery),
    routeCostQuery: request.routeCostQuery && create(RoutingRouteSchema, { indices: bridgeIndices(request.routeCostQuery, "route cost indices") }),
    modelQuery: request.modelQuery && create(RoutingModelQuerySchema, request.modelQuery),
    searchEntryEvents: request.searchEntryEvents ?? !1,
    pickupDeliveryInspectionIndex: request.pickupDeliveryInspectionIndex,
    breakInspection: request.breakInspection && create(RoutingBreakInspectionRequestSchema, request.breakInspection)
  });
}
function decodeOperation(payload) {
  return decodeBridgeRequest(fromBinary(RoutingBridgeRequestSchema, payload));
}
function decodeBridgeRequest(request) {
  if (!request.transitMatrix && !request.validateSearchParameters) throw new Error("Routing request has no transit matrix.");
  return {
    type: "solve",
    interruptible: request.interruptible,
    request: {
      ...request.validateSearchParameters ? { validateSearchParameters: !0 } : {},
      ...request.assignmentTransfer ? { assignmentTransfer: {
        nextValues: [...request.assignmentTransfer.nextValues],
        vehicleValues: [...request.assignmentTransfer.vehicleValues]
      } } : {},
      ...request.secondaryModel ? { secondaryModel: decodeBridgeRequest(request.secondaryModel).request } : {},
      ...request.routeLocks ? { routeLocks: {
        closeRoutes: request.routeLocks.closeRoutes,
        routes: request.routeLocks.routes.map((route) => indices(route.indices, "lock indices"))
      } } : {},
      ...request.inspectPreAssignment ? { inspectPreAssignment: !0 } : {},
      ...request.firstSolutionHint ? { firstSolutionHint: decodeAssignment(request.firstSolutionHint) } : {},
      ...request.resourceInspectionGroup === void 0 ? {} : { resourceInspectionGroup: request.resourceInspectionGroup },
      ...request.inspectActivityGroups ? { inspectActivityGroups: !0 } : {},
      ...request.arcCostQueries.length ? { arcCostQueries: request.arcCostQueries } : {},
      ...request.domainQueries.length ? { domainQueries: request.domainQueries.map((query) => ({
        variable: decodeVariable(query.variable),
        ...query.containsValue === void 0 ? {} : { containsValue: query.containsValue },
        ...query.softLowerBound === void 0 ? {} : { softLowerBound: query.softLowerBound }
      })) } : {},
      readAssignmentOnly: request.readAssignmentOnly,
      solutionEvents: request.solutionEvents,
      trackUncheckedNeighbors: request.trackUncheckedNeighbors,
      numLocations: request.numLocations,
      numVehicles: request.numVehicles,
      starts: request.starts,
      ends: request.ends,
      searchParametersProto: request.searchParametersProto,
      searchParameterFields: request.searchParameterFields,
      modelParametersProto: request.modelParameterFields.length > 0 || request.modelParametersProto.length > 0 ? request.modelParametersProto : void 0,
      modelParameterFields: request.modelParameterFields,
      transitMatrix: new BigInt64Array(request.transitMatrix?.values ?? []),
      transitMatrixDimension: request.transitMatrix?.dimension ?? 0,
      operations: request.operations.map(decodeModelOperation),
      ...request.resourceGroups.length ? { resourceGroups: request.resourceGroups.map((group) => ({
        resources: group.resources.map((resource) => ({ dimensionName: resource.dimensionName, startDomain: resource.startDomain, endDomain: resource.endDomain })),
        requiredVehicles: group.requiredVehicles,
        allowedResources: group.allowedResources.map((value) => ({ vehicle: value.vehicle, resources: value.resources }))
      })) } : {},
      dimensionNames: request.dimensionNames,
      assignmentAction: request.assignmentAction,
      candidateAssignments: request.candidateAssignments.map((value) => decodeAssignment(value)),
      packingDurationSeconds: request.packingDurationSeconds,
      checkSolutionInCp: request.checkSolutionInCp,
      inspectCumulOptimizers: request.inspectCumulOptimizers,
      callAtSolutionMonitors: request.callAtSolutionMonitors,
      dimensionQuery: request.dimensionQuery && { dimensionName: request.dimensionQuery.dimensionName, kind: request.dimensionQuery.kind, index: request.dimensionQuery.index, otherIndex: request.dimensionQuery.otherIndex, vehicleOrClass: request.dimensionQuery.vehicleOrClass, lower: request.dimensionQuery.lower, upper: request.dimensionQuery.upper, pairIndex: request.dimensionQuery.pairIndex, pickupAlternativeIndex: request.dimensionQuery.pickupAlternativeIndex, deliveryAlternativeIndex: request.dimensionQuery.deliveryAlternativeIndex },
      ...request.routeCostQuery ? { routeCostQuery: indices(request.routeCostQuery.indices, "route cost indices") } : {},
      modelQuery: request.modelQuery && {
        kind: request.modelQuery.kind,
        index: request.modelQuery.index,
        otherIndex: request.modelQuery.otherIndex,
        vehicleOrClass: request.modelQuery.vehicleOrClass,
        defaultValue: request.modelQuery.defaultValue,
        predicateEvaluator: request.modelQuery.predicateEvaluator,
        thirdIndex: request.modelQuery.thirdIndex
      },
      searchEntryEvents: request.searchEntryEvents,
      pickupDeliveryInspectionIndex: request.pickupDeliveryInspectionIndex,
      breakInspection: request.breakInspection && { dimensionName: request.breakInspection.dimensionName, vehicle: request.breakInspection.vehicle },
      initialAssignment: request.initialAssignment ? {
        routes: request.initialAssignment.routes.map((route, routeIndex) => indices(route.indices, `route ${routeIndex} indices`)),
        ignoreInactiveIndices: request.initialAssignment.ignoreInactiveIndices,
        ...request.initialAssignment.snapshot ? { snapshot: decodeAssignment(request.initialAssignment.snapshot) } : {}
      } : void 0
    }
  };
}
function bridgeSolution(solution) {
  return {
    objectiveValue: solution.objectiveValue,
    nextValues: bridgeIndices(solution.nextValues, "next values"),
    vehicleValues: solution.vehicleValues,
    resourceAssignments: solution.resourceAssignments?.map((value) => create(RoutingResourceAssignmentSchema, value)),
    breakAssignments: solution.breakAssignments?.map((value) => create(RoutingBreakAssignmentSchema, value)),
    assignmentVariables: solution.assignmentVariables?.map((value) => create(RoutingAssignmentVariableSchema, { variable: bridgeVariable(value.variable), min: value.min, max: value.max })),
    starts: bridgeIndices(solution.starts, "starts"),
    ends: bridgeIndices(solution.ends, "ends"),
    dimensions: Object.entries(solution.dimensionCumulValues).map(([name, cumulValues]) => ({
      name,
      cumulValues,
      cumulMins: solution.dimensionCumulMins?.[name] ?? cumulValues,
      cumulMaxs: solution.dimensionCumulMaxs?.[name] ?? []
    }))
  };
}
function encodeResult(result) {
  let solution = result.solution;
  return toBinary(RoutingBridgeResponseSchema, create(RoutingBridgeResponseSchema, {
    searchParameterError: result.searchParameterError,
    assignmentSeed: bridgeAssignment(result.assignmentSeed),
    routeCost: result.routeCost === void 0 ? void 0 : create(RoutingRouteCostSchema, { cost: result.routeCost ?? void 0 }),
    locksApplied: result.locksApplied,
    preAssignment: result.preAssignment && create(RoutingPreAssignmentSchema, { nextValues: result.preAssignment }),
    status: result.status,
    collectedSolutions: result.collectedSolutions?.map((value) => create(RoutingSolutionSchema, bridgeSolution(value))),
    timeLimitReached: result.timeLimitReached,
    computedLowerBound: result.computedLowerBound,
    dimensionInspection: result.dimensionInspection && create(RoutingDimensionInspectionSchema, result.dimensionInspection),
    modelInspection: result.modelInspection && create(RoutingModelInspectionSchema, {
      ...result.modelInspection,
      groups: result.modelInspection.groups.map((indices2) => ({ indices: indices2 })),
      precedenceGroups: result.modelInspection.precedenceGroups.map((groups) => ({ groups: groups.map((indices2) => ({ indices: indices2 })) }))
    }),
    assignmentFeasible: result.assignmentFeasible,
    pickupDeliveryInspection: result.pickupDeliveryInspection && create(RoutingPickupDeliveryInspectionSchema, result.pickupDeliveryInspection),
    breakConfiguration: result.breakConfiguration && create(RoutingBreakConfigurationSchema, result.breakConfiguration),
    cumulOptimizers: result.cumulOptimizers && create(RoutingCumulOptimizersSchema, result.cumulOptimizers),
    objectiveLowerBound: result.objectiveLowerBound,
    searchStatistics: result.searchStatistics && create(RoutingSearchStatisticsSchema, {
      ...result.searchStatistics,
      numDecisionsInFirstSolution: result.searchStatistics.numDecisionsInFirstSolution ?? void 0,
      numRejectsInFirstSolution: result.searchStatistics.numRejectsInFirstSolution ?? void 0
    }),
    arcCosts: result.arcCosts,
    domainResults: result.domainResults?.map((result2) => create(RoutingDomainResultSchema, result2)),
    localSearchProfile: result.localSearchProfile,
    resourceInspection: result.resourceInspection ? create(RoutingResourceInspectionSchema, result.resourceInspection) : void 0,
    activityGroups: result.activityGroups ? create(RoutingActivityGroupsSchema, {
      groups: result.activityGroups.groups,
      members: result.activityGroups.members.map((indices2) => ({ indices: indices2 }))
    }) : void 0,
    automaticFirstSolutionStrategy: result.automaticFirstSolutionStrategy,
    ...solution ? { hasSolution: !0, ...bridgeSolution(solution) } : { hasSolution: !1 }
  }));
}
function decodeSolution(snapshot, status) {
  return {
    status,
    objectiveValue: snapshot.objectiveValue,
    ...snapshot.breakAssignments.length ? { breakAssignments: snapshot.breakAssignments.map(decodeBreakAssignment) } : {},
    ...snapshot.resourceAssignments.length ? { resourceAssignments: snapshot.resourceAssignments.map((value) => ({ mins: value.mins, maxs: value.maxs })) } : {},
    nextValues: indices(snapshot.nextValues, "next values"),
    ...snapshot.vehicleValues.length ? { vehicleValues: snapshot.vehicleValues } : {},
    starts: indices(snapshot.starts, "starts"),
    ends: indices(snapshot.ends, "ends"),
    ...snapshot.assignmentVariables.length ? { assignmentVariables: snapshot.assignmentVariables.map((value) => ({ variable: decodeVariable(value.variable), min: value.min, max: value.max })) } : {},
    dimensionCumulValues: Object.fromEntries(
      snapshot.dimensions.map((item) => [item.name, item.cumulValues])
    ),
    dimensionCumulMins: Object.fromEntries(snapshot.dimensions.map((item) => [item.name, item.cumulMins.length ? item.cumulMins : item.cumulValues])),
    dimensionCumulMaxs: Object.fromEntries(snapshot.dimensions.filter((item) => item.cumulMaxs.length > 0).map((item) => [item.name, item.cumulMaxs]))
  };
}
function decodeResult(payload) {
  let response = fromBinary(RoutingBridgeResponseSchema, payload);
  return {
    ...response.searchParameterError !== void 0 ? { searchParameterError: response.searchParameterError } : {},
    ...response.assignmentSeed ? { assignmentSeed: decodeAssignment(response.assignmentSeed) } : {},
    type: "solve",
    ...response.routeCost ? { routeCost: response.routeCost.cost ?? null } : {},
    ...response.collectedSolutions.length ? { collectedSolutions: response.collectedSolutions.map((value) => decodeSolution(value, response.status)) } : {},
    ...response.timeLimitReached === void 0 ? {} : { timeLimitReached: response.timeLimitReached },
    ...response.computedLowerBound === void 0 ? {} : { computedLowerBound: response.computedLowerBound },
    ...response.dimensionInspection ? { dimensionInspection: { value: response.dimensionInspection.value, intervals: response.dimensionInspection.intervals.map(({ start, end }) => ({ start, end })), hasPiecewiseLinearCost: response.dimensionInspection.hasPiecewiseLinearCost, nodePrecedences: response.dimensionInspection.nodePrecedences.map(({ first, second, offset, performedConstraint }) => ({ first, second, offset, performedConstraint })), costSegments: response.dimensionInspection.costSegments.map(({ pointX, pointY, slope, otherPointX }) => ({ pointX, pointY, slope, otherPointX })) } } : {},
    ...response.assignmentFeasible === void 0 ? {} : { assignmentFeasible: response.assignmentFeasible },
    ...response.pickupDeliveryInspection ? { pickupDeliveryInspection: {
      pickup: response.pickupDeliveryInspection.pickup && { pairIndex: response.pickupDeliveryInspection.pickup.pairIndex, alternativeIndex: response.pickupDeliveryInspection.pickup.alternativeIndex },
      delivery: response.pickupDeliveryInspection.delivery && { pairIndex: response.pickupDeliveryInspection.delivery.pairIndex, alternativeIndex: response.pickupDeliveryInspection.delivery.alternativeIndex },
      isPickup: response.pickupDeliveryInspection.isPickup,
      isDelivery: response.pickupDeliveryInspection.isDelivery
    } } : {},
    ...response.breakConfiguration ? { breakConfiguration: {
      hasBreakConstraints: response.breakConfiguration.hasBreakConstraints,
      intervals: response.breakConfiguration.intervals,
      distanceDuration: response.breakConfiguration.distanceDuration.map(({ distance, duration }) => ({ distance, duration })),
      preTravelEvaluator: response.breakConfiguration.preTravelEvaluator,
      postTravelEvaluator: response.breakConfiguration.postTravelEvaluator
    } } : {},
    ...response.cumulOptimizers ? { cumulOptimizers: { globalDimensions: response.cumulOptimizers.globalDimensions, localDimensions: response.cumulOptimizers.localDimensions } } : {},
    ...response.modelInspection ? { modelInspection: {
      value: response.modelInspection.value,
      dimensionIndices: response.modelInspection.dimensionIndices,
      indices: response.modelInspection.indices,
      groups: response.modelInspection.groups.map((group) => [...group.indices]),
      precedenceGroups: response.modelInspection.precedenceGroups.map((groups) => groups.groups.map((group) => [...group.indices]))
    } } : {},
    ...response.objectiveLowerBound === void 0 ? {} : { objectiveLowerBound: response.objectiveLowerBound },
    ...response.searchStatistics ? { searchStatistics: {
      numCpSatCallsInLpScheduling: response.searchStatistics.numCpSatCallsInLpScheduling,
      numGlopCallsInLpScheduling: response.searchStatistics.numGlopCallsInLpScheduling,
      numMinCostFlowCalls: response.searchStatistics.numMinCostFlowCalls,
      numCpSatCallsInRouting: response.searchStatistics.numCpSatCallsInRouting,
      numGeneralizedCpSatCallsInRouting: response.searchStatistics.numGeneralizedCpSatCallsInRouting,
      numDecisionsInFirstSolution: response.searchStatistics.numDecisionsInFirstSolution ?? null,
      numRejectsInFirstSolution: response.searchStatistics.numRejectsInFirstSolution ?? null
    } } : {},
    ...response.locksApplied === void 0 ? {} : { locksApplied: response.locksApplied },
    ...response.preAssignment ? { preAssignment: response.preAssignment.nextValues } : {},
    ...response.activityGroups ? { activityGroups: {
      groups: response.activityGroups.groups,
      members: response.activityGroups.members.map((group) => group.indices)
    } } : {},
    ...response.resourceInspection ? { resourceInspection: {
      affectedDimensions: response.resourceInspection.affectedDimensions,
      resources: response.resourceInspection.resources.map((resource) => ({ classIndex: resource.classIndex, dimensionAttributes: resource.dimensionAttributes.map((attribute) => ({
        dimensionName: attribute.dimensionName,
        startDomain: attribute.startDomain,
        endDomain: attribute.endDomain
      })) })),
      classes: response.resourceInspection.classes.map((resourceClass) => ({ resourceIndices: resourceClass.resourceIndices, dimensionAttributes: resourceClass.dimensionAttributes.map((attribute) => ({
        dimensionName: attribute.dimensionName,
        startDomain: attribute.startDomain,
        endDomain: attribute.endDomain
      })) }))
    } } : {},
    ...response.automaticFirstSolutionStrategy === void 0 ? {} : { automaticFirstSolutionStrategy: response.automaticFirstSolutionStrategy },
    ...response.arcCosts.length ? { arcCosts: response.arcCosts } : {},
    ...response.domainResults.length ? { domainResults: response.domainResults.map((result) => ({ min: result.min, max: result.max, size: result.size, bound: result.bound, ...result.contains === void 0 ? {} : { contains: result.contains }, ...result.softBound === void 0 ? {} : { softBound: result.softBound } })) } : {},
    localSearchProfile: response.localSearchProfile,
    status: response.status,
    solution: response.hasSolution ? decodeSolution(response, response.status) : null
  };
}
var routingProtocol = {
  solver: "routing",
  label: "Routing",
  encodeRequest: encodeOperation,
  decodeRequest: decodeOperation,
  encodeResult,
  decodeResult,
  encodeEvent: (event) => toBinary(RoutingBridgeResponseSchema, create(RoutingBridgeResponseSchema, {
    ...event.type === "searchEntered" ? { searchEntered: !0 } : { solveEvent: create(RoutingSolveEventSchema, {
      objectiveValue: event.objectiveValue,
      solutionCount: event.solutionCount,
      unchecked: event.unchecked
    }) }
  })),
  decodeEvent: (payload) => {
    let response = fromBinary(RoutingBridgeResponseSchema, payload);
    if (response.searchEntered) return { type: "searchEntered" };
    let event = response.solveEvent;
    return event ? {
      type: "solution",
      objectiveValue: event.objectiveValue,
      solutionCount: event.solutionCount,
      unchecked: event.unchecked
    } : null;
  }
};

// lib/routing/native_runtime.ts
async function closeModelWithParameters(module, handle, message) {
  let pointer = allocateWasmBytes(module, message.searchParametersProto, 1);
  try {
    if (await withWasmCString(module, (message.searchParameterFields ?? []).join(","), (paths) => ccallNumber(module, "routing_close_model_proto", Array(4).fill("number"), [handle, pointer, message.searchParametersProto.length, paths])) !== 1) throw new Error(`Routing search parameters: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
  } finally {
    module._free(pointer);
  }
}
async function loadAssignment(module, handle, snapshot) {
  let range = snapshot.objectiveMin !== void 0;
  if (range !== (snapshot.objectiveMax !== void 0) || range && snapshot.objectiveValue !== void 0)
    throw new Error("Invalid Routing assignment objective snapshot.");
  let minimum = snapshot.objectiveMin ?? snapshot.objectiveValue ?? 0n, maximum = snapshot.objectiveMax ?? snapshot.objectiveValue ?? 0n;
  if (await ccallNumber(
    module,
    "routing_input_assignment_create",
    ["number", "number", "bigint", "bigint"],
    [handle, Number(range || snapshot.objectiveValue !== void 0), minimum, maximum]
  ) !== 1)
    throw new Error("Failed to create native Routing assignment.");
  for (let { variable, min, max } of snapshot.variables)
    if (await withWasmCString(module, variable.dimensionName ?? "", (name) => ccallNumber(
      module,
      "routing_input_assignment_variable",
      ["number", "number", "number", "bigint", "number", "bigint", "bigint"],
      [handle, variable.kind, name, BigInt(variable.index), variable.resourceGroup ?? 0, min, max]
    )) !== 1) throw new Error("Invalid Routing assignment variable snapshot.");
  for (let interval of snapshot.intervals) {
    let bounds = copyInt64Array(module, [
      interval.performedMin,
      interval.performedMax,
      interval.startMin ?? 0n,
      interval.startMax ?? 0n,
      interval.endMin ?? 0n,
      interval.endMax ?? 0n
    ]);
    try {
      if (await ccallNumber(module, "routing_input_assignment_interval", Array(3).fill("number"), [handle, interval.index, bounds.ptr]) !== 1)
        throw new Error("Invalid Routing interval snapshot.");
    } finally {
      module._free(bounds.ptr);
    }
  }
}
function copyInt32Array(module, values) {
  let array = new Int32Array(values);
  return allocateWasmBytes(module, new Uint8Array(array.buffer), 4);
}
function copyInt64Array(module, values) {
  let array = values instanceof BigInt64Array ? values : BigInt64Array.from(values, (value) => toInt64(value));
  return { ptr: allocateWasmBytes(module, new Uint8Array(array.buffer, array.byteOffset, array.byteLength), 8), length: array.length };
}
async function ccallNumber(module, name, argTypes, args) {
  return await module.ccall(name, "number", argTypes, args, { async: !0 });
}
async function ccallBigInt(module, name, argTypes, args) {
  return await module.ccall(name, "bigint", argTypes, args, { async: !0 });
}
async function ccallVoid(module, name, argTypes, args) {
  await module.ccall(name, void 0, argTypes, args, { async: !0 });
}
async function registerTransitMatrix(module, modelHandle, matrix, dimension, unary = !1) {
  let { ptr, length } = copyInt64Array(module, matrix);
  try {
    let evaluatorIndex = await ccallNumber(
      module,
      "routing_register_matrix_transit_callback",
      Array(5).fill("number"),
      [modelHandle, ptr, length, dimension, unary ? 1 : 0]
    );
    if (evaluatorIndex < 0)
      throw new Error("Routing executor failed to register transit matrix.");
    return evaluatorIndex;
  } finally {
    module._free(ptr);
  }
}
async function registerStateDependentMatrix(module, model, matrix) {
  let offsets = [0], x = [], y = [];
  for (let fn of matrix.functions) {
    if (fn.x.length !== fn.y.length) throw new RangeError("Routing transit x/y anchors must have matching lengths.");
    for (let value of fn.x) x.push(value);
    for (let value of fn.y) y.push(value);
    offsets.push(x.length);
  }
  if (x.length > 2147483647) throw new RangeError("Routing transit anchors exceed the native array size.");
  let pointers = [];
  try {
    let offsetPtr = copyInt32Array(module, offsets);
    pointers.push(offsetPtr);
    let xs = copyInt64Array(module, x);
    pointers.push(xs.ptr);
    let ys = copyInt64Array(module, y);
    pointers.push(ys.ptr);
    let evaluator = await ccallNumber(
      module,
      "routing_register_state_dependent_transit_matrix",
      ["number", "bigint", "bigint", "number", "number", "number", "number", "number"],
      [model, matrix.domainStart, matrix.domainEnd, offsetPtr, offsets.length, xs.ptr, ys.ptr, x.length]
    );
    if (evaluator < 0) throw new Error("Invalid Routing state-dependent domain, matrix or anchors.");
    return evaluator;
  } finally {
    for (let pointer of pointers) module._free(pointer);
  }
}
async function createLinearExpression(module, model, expression) {
  let pointers = [];
  try {
    let resourceGroups = copyInt32Array(module, expression.terms.map((term) => term.variable.resourceGroup ?? 0));
    pointers.push(resourceGroups);
    let kinds = copyInt32Array(module, expression.terms.map((term) => term.variable.kind));
    pointers.push(kinds);
    let indices2 = copyInt64Array(module, expression.terms.map((term) => BigInt(term.variable.index)));
    pointers.push(indices2.ptr);
    let coefficients = copyInt64Array(module, expression.terms.map((term) => term.coefficient));
    pointers.push(coefficients.ptr);
    let names = expression.terms.map((term) => {
      let bytes = new TextEncoder().encode(`${term.variable.dimensionName}\0`), pointer = allocateWasmBytes(module, bytes);
      return pointers.push(pointer), pointer;
    }), namesPtr = copyInt32Array(module, names);
    pointers.push(namesPtr);
    let id = await ccallNumber(
      module,
      "routing_create_linear_expression",
      ["number", "number", "number", "number", "number", "number", "bigint", "number"],
      [model, kinds, indices2.ptr, coefficients.ptr, namesPtr, expression.terms.length, expression.offset, resourceGroups]
    );
    if (!id) throw new Error("Routing expression has an invalid variable reference.");
    return id;
  } finally {
    for (let pointer of pointers) module._free(pointer);
  }
}
async function createBooleanExpression(module, model, expression) {
  let left = 0, right = 0, comparison = 0, value = 0, kinds = { constant: 1, variable: 2, comparison: 3, and: 4, or: 5, not: 6 };
  expression.kind === "constant" ? value = expression.value ? 1 : 0 : expression.kind === "variable" ? left = await createLinearExpression(module, model, { terms: [{ variable: expression.variable, coefficient: 1n }], offset: 0n }) : expression.kind === "comparison" && (left = await createLinearExpression(module, model, expression.comparison.left), right = await createLinearExpression(module, model, expression.comparison.right), comparison = expression.comparison.comparison);
  let children = [];
  if ("operands" in expression) for (let operand of expression.operands) children.push(await createBooleanExpression(module, model, operand));
  let pointer = copyInt32Array(module, children);
  try {
    let id = await ccallNumber(
      module,
      "routing_create_boolean_expression",
      Array(8).fill("number"),
      [model, kinds[expression.kind], value, comparison, left, right, pointer, children.length]
    );
    if (!id) throw new Error("Invalid native Routing Boolean expression.");
    return id;
  } finally {
    module._free(pointer);
  }
}
async function solveWithSearchParameters(module, modelHandle, message, fromAssignment, interruptible) {
  let bytes = message.searchParametersProto, pointer = allocateWasmBytes(module, bytes, 1);
  try {
    let result = await withWasmCString(module, (message.searchParameterFields ?? []).join(","), async (fieldPaths) => ccallNumber(
      module,
      "routing_solve_with_parameters_proto",
      ["number", "number", "number", "number", "number", "number"],
      [modelHandle, pointer, bytes.length, fieldPaths, fromAssignment ? 1 : 0, interruptible ? 1 : 0]
    ));
    if (result < 0) {
      let error = await module.ccall("routing_last_search_parameter_error", "string", [], []);
      throw new Error(`Routing search parameters: ${error}`);
    }
    return result;
  } finally {
    module._free(pointer);
  }
}
async function deleteRoutingModel(module, state3) {
  try {
    state3.modelHandle && await ccallVoid(module, "routing_delete_model", ["number"], [state3.modelHandle]);
  } finally {
    state3.managerHandle && await ccallVoid(module, "routing_delete_index_manager", ["number"], [state3.managerHandle]);
  }
}
async function createRoutingModel(module, message, callbackId = 0) {
  let managerHandle = 0, modelHandle = 0, startsPtr = 0, endsPtr = 0;
  if (message.readAssignmentOnly && !message.initialAssignment) throw new Error("Routing assignment validation requires routes.");
  try {
    if (startsPtr = copyInt32Array(module, message.starts), endsPtr = copyInt32Array(module, message.ends), managerHandle = await ccallNumber(
      module,
      "routing_create_index_manager_starts_ends",
      ["number", "number", "number", "number"],
      [message.numLocations, message.numVehicles, startsPtr, endsPtr]
    ), message.modelParametersProto !== void 0) {
      let bytes = message.modelParametersProto, pointer = allocateWasmBytes(module, bytes, 1);
      try {
        modelHandle = await withWasmCString(module, (message.modelParameterFields ?? []).join(","), (paths) => ccallNumber(
          module,
          "routing_create_model_with_parameters",
          ["number", "number", "number", "number"],
          [managerHandle, pointer, bytes.length, paths]
        ));
      } finally {
        module._free(pointer);
      }
    } else modelHandle = await ccallNumber(module, "routing_create_model", ["number"], [managerHandle]);
    if (callbackId && message.searchEntryEvents && module.ccall("routing_add_enter_search_callback", void 0, ["number", "number"], [modelHandle, callbackId]), callbackId && message.solutionEvents && module.ccall(
      "routing_add_solution_callback",
      void 0,
      ["number", "number", "number"],
      [modelHandle, callbackId, message.trackUncheckedNeighbors ? 1 : 0]
    ), !modelHandle) throw new Error(`Routing model parameters: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
    let evaluatorIndex = await registerTransitMatrix(module, modelHandle, message.transitMatrix, message.transitMatrixDimension);
    await ccallNumber(
      module,
      "routing_set_arc_cost_evaluator_of_all_vehicles",
      ["number", "number"],
      [modelHandle, evaluatorIndex]
    );
    for (let group = 0; group < (message.resourceGroups?.length ?? 0); ++group)
      if (await ccallNumber(module, "routing_add_resource_group", ["number"], [modelHandle]) !== group) throw new Error("Failed to create Routing resource group.");
    let breakCount = 0, travelHandles = /* @__PURE__ */ new Map();
    for (let operation of message.operations)
      if (operation.type === "setPathEnergyCosts") {
        if (!await withWasmCString(module, operation.force, (force) => withWasmCString(module, operation.distance, (distance) => ccallNumber(
          module,
          "routing_set_path_energy_costs",
          ["number", "number", "number", "number", "bigint", "bigint", "bigint"],
          [modelHandle, force, distance, operation.vehicle, operation.threshold, operation.costBelow, operation.costAbove]
        )))) throw new Error("Invalid Routing path-energy dimensions, vehicle or costs.");
      } else if (operation.type === "addSameActivityGroup") {
        let indices2 = copyInt32Array(module, operation.indices);
        try {
          if (!await ccallNumber(module, "routing_add_same_activity_group", Array(3).fill("number"), [modelHandle, indices2, operation.indices.length]))
            throw new Error("Invalid Routing same-activity index.");
        } finally {
          module._free(indices2);
        }
      } else if (operation.type === "addBreakInterval") {
        let index = await withWasmCString(module, operation.name, (name) => ccallNumber(
          module,
          "routing_add_break_interval",
          ["number", "bigint", "bigint", "bigint", "number", "number"],
          [modelHandle, operation.startMin, operation.startMax, operation.duration, operation.optional ? 1 : 0, name]
        ));
        if (index !== operation.index || index !== breakCount++) throw new Error("Failed to create Routing break interval.");
      } else if (operation.type === "setBreakIntervals") {
        let preTravel = operation.preTravel ? await registerTransitMatrix(module, modelHandle, BigInt64Array.from(operation.preTravel), message.transitMatrixDimension) : -1, postTravel = operation.postTravel ? await registerTransitMatrix(module, modelHandle, BigInt64Array.from(operation.postTravel), message.transitMatrixDimension) : -1;
        preTravel >= 0 && operation.preTravelHandle !== void 0 && travelHandles.set(preTravel, operation.preTravelHandle), postTravel >= 0 && operation.postTravelHandle !== void 0 && travelHandles.set(postTravel, operation.postTravelHandle);
        let intervals = copyInt32Array(module, operation.intervals);
        try {
          if (!await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(
            module,
            "routing_set_break_intervals",
            ["number", "number", "number", "number", "number", "number", "number"],
            [modelHandle, name, operation.vehicle, intervals, operation.intervals.length, preTravel, postTravel]
          ))) throw new Error(module.ccall("routing_last_break_error", "string", [], []) || "Invalid Routing break intervals.");
        } finally {
          module._free(intervals);
        }
      } else if (operation.type === "setBreakDistanceDuration") {
        if (!await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(
          module,
          "routing_set_break_distance_duration",
          ["number", "number", "number", "bigint", "bigint"],
          [modelHandle, name, operation.vehicle, operation.distance, operation.duration]
        ))) throw new Error(module.ccall("routing_last_break_error", "string", [], []) || "Invalid Routing break distance/duration.");
      } else if (operation.type === "addIntegerExpression") {
        let operands = [];
        for (let operand of operation.operands) operands.push(await createLinearExpression(module, modelHandle, operand));
        let pointer = copyInt32Array(module, operands);
        try {
          let expression = await ccallNumber(module, "routing_create_integer_expression", Array(4).fill("number"), [modelHandle, operation.kind, pointer, operands.length]);
          if (!expression || await ccallNumber(module, "routing_register_integer_variable", Array(3).fill("number"), [modelHandle, operation.index, expression]) !== 1)
            throw new Error("Invalid native Routing integer expression kind, arity or operands.");
        } finally {
          module._free(pointer);
        }
      } else if (operation.type === "addBooleanVariable" || operation.type === "addBooleanConstraint") {
        let expression = await createBooleanExpression(module, modelHandle, operation.expression);
        if ((operation.type === "addBooleanVariable" ? await ccallNumber(module, "routing_register_boolean_variable", ["number", "number", "number"], [modelHandle, operation.index, expression]) : await ccallNumber(module, "routing_add_boolean_constraint", ["number", "number"], [modelHandle, expression])) !== 1) throw new Error("Invalid native Routing Boolean variable or constraint.");
      } else if (operation.type === "setMaximumActiveVehicles") {
        if (await ccallNumber(
          module,
          "routing_set_maximum_active_vehicles",
          ["number", "number"],
          [modelHandle, toIndex(operation.maximum, "Routing maximum active vehicles", 2147483647)]
        ) !== 1) throw new Error("Routing failed to set the active vehicle limit.");
      } else if (operation.type === "setFixedVehicleCost") {
        if (await ccallNumber(
          module,
          "routing_set_fixed_vehicle_cost",
          ["number", "number", "bigint"],
          [modelHandle, toIndex(operation.vehicle, "Routing fixed-cost vehicle", message.numVehicles - 1), toInt64(operation.cost)]
        ) !== 1) throw new Error("Routing failed to set a fixed vehicle cost.");
      } else if (operation.type === "setAmortizedVehicleCosts") {
        if (await ccallNumber(
          module,
          "routing_set_amortized_vehicle_costs",
          ["number", "number", "bigint", "bigint"],
          [modelHandle, toIndex(operation.vehicle, "Routing amortized-cost vehicle", message.numVehicles - 1), toInt64(operation.linear), toInt64(operation.quadratic)]
        ) !== 1) throw new Error("Routing failed to set amortized vehicle costs.");
      } else if (operation.type === "setVehicleUsedWhenEmpty") {
        if (typeof operation.isUsed != "boolean") throw new TypeError("Routing empty-route usage must be a boolean.");
        if (await ccallNumber(
          module,
          "routing_set_vehicle_used_when_empty",
          ["number", "number", "number"],
          [modelHandle, toIndex(operation.vehicle, "Routing empty-route vehicle", message.numVehicles - 1), Number(operation.isUsed)]
        ) !== 1) throw new Error("Routing failed to set empty-route usage.");
      } else if (operation.type === "addForbiddenIntervals") {
        let data = copyInt64Array(module, operation.intervals.flatMap((interval) => [interval.start, interval.end]));
        try {
          if (await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(
            module,
            "routing_add_forbidden_intervals",
            ["number", "number", "bigint", "number", "number"],
            [modelHandle, name, operation.index, data.ptr, operation.intervals.length]
          )) !== 1) throw new Error(`Routing forbidden intervals: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
        } finally {
          module._free(data.ptr);
        }
      } else if (operation.type === "setPiecewiseCost") {
        let data = copyInt64Array(module, operation.segments.flatMap((value) => [value.pointX, value.pointY, value.slope, value.otherPointX]));
        try {
          if (await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(
            module,
            "routing_set_piecewise_cost",
            ["number", "number", "bigint", "number", "number"],
            [modelHandle, name, operation.index, data.ptr, operation.segments.length]
          )) !== 1) throw new Error(`Routing piecewise cost: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
        } finally {
          module._free(data.ptr);
        }
      } else if (operation.type === "ignoreDisjunctionsAlreadyForcedToZero") {
        if (await ccallNumber(module, "routing_ignore_disjunctions_already_forced_to_zero", ["number"], [modelHandle]) !== 1)
          throw new Error("Failed to ignore Routing disjunctions already forced to zero.");
      } else if (operation.type === "setTabuVars") {
        let pointers = [];
        try {
          let variables = operation.variables ?? [], kinds = copyInt32Array(module, variables.map((variable) => variable.kind));
          pointers.push(kinds);
          let indices2 = copyInt64Array(module, variables.map((variable) => BigInt(variable.index)));
          pointers.push(indices2.ptr);
          let groups = copyInt32Array(module, variables.map((variable) => variable.resourceGroup ?? 0));
          pointers.push(groups);
          let names = variables.map((variable) => {
            let pointer = allocateWasmBytes(module, new TextEncoder().encode(`${variable.dimensionName}\0`));
            return pointers.push(pointer), pointer;
          }), namesPtr = copyInt32Array(module, names);
          if (pointers.push(namesPtr), await ccallNumber(
            module,
            "routing_set_tabu_vars",
            Array(6).fill("number"),
            [modelHandle, kinds, indices2.ptr, namesPtr, groups, operation.variables === null ? -1 : variables.length]
          ) !== 1)
            throw new Error(String(module.ccall("routing_last_search_parameter_error", "string", [], [])));
        } finally {
          for (let pointer of pointers) module._free(pointer);
        }
      } else if (operation.type === "setSweepArranger" || operation.type === "addOrderedActivityGroup") {
        let values = operation.type === "setSweepArranger" ? operation.points.flatMap(({ x, y }) => [x, y]) : operation.disjunctions, data = copyInt32Array(module, values);
        try {
          let name = operation.type === "setSweepArranger" ? "routing_set_sweep_arranger" : "routing_add_ordered_activity_group";
          if (await ccallNumber(module, name, ["number", "number", "number"], [modelHandle, data, operation.type === "setSweepArranger" ? operation.points.length : values.length]) !== 1)
            throw new Error(String(module.ccall("routing_last_search_parameter_error", "string", [], [])));
        } finally {
          module._free(data);
        }
      } else if (operation.type === "addRouteConstraint") {
        if (await ccallNumber(
          module,
          "routing_add_route_constraint",
          Array(4).fill("number"),
          [modelHandle, operation.evaluator, callbackId, Number(operation.costsAreHomogeneousAcrossVehicles)]
        ) !== 1)
          throw new Error("Routing route constraint requires native callback transport.");
      } else if (operation.type === "setFirstSolutionEvaluator") {
        let evaluator = await registerTransitMatrix(module, modelHandle, operation.transitMatrix, message.transitMatrixDimension);
        if (await ccallNumber(module, "routing_set_first_solution_evaluator", ["number", "number"], [modelHandle, evaluator]) !== 1)
          throw new Error("Failed to set native Routing first-solution evaluator.");
      } else if (operation.type === "setPrimaryConstrainedDimension") {
        if (await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(module, "routing_set_primary_constrained_dimension", ["number", "number"], [modelHandle, name])) !== 1) throw new Error("Routing primary constrained dimension does not exist.");
      } else if (operation.type === "setArcCostEvaluatorOfVehicles") {
        if (!operation.vehicles.length || operation.vehicles.some((vehicle) => !Number.isInteger(vehicle) || vehicle < 0 || vehicle >= message.numVehicles))
          throw new Error("Routing arc-cost vehicle is out of range.");
        let index = await registerTransitMatrix(module, modelHandle, operation.transitMatrix, message.transitMatrixDimension);
        for (let vehicle of operation.vehicles) await ccallNumber(
          module,
          "routing_set_arc_cost_evaluator_of_vehicle",
          ["number", "number", "number"],
          [modelHandle, index, vehicle]
        );
      } else if (operation.type === "addDimension") {
        let index = await registerTransitMatrix(module, modelHandle, operation.transitMatrix, message.transitMatrixDimension, operation.unaryTransit);
        await withWasmCString(module, operation.name, async (namePtr) => {
          await ccallNumber(
            module,
            "routing_add_dimension",
            ["number", "number", "bigint", "bigint", "number", "number"],
            [modelHandle, index, operation.slackMax, operation.capacity, operation.fixStartCumulToZero ? 1 : 0, namePtr]
          );
        });
      } else if (operation.type === "addDimensionWithVehicleCapacity") {
        let index = await registerTransitMatrix(module, modelHandle, operation.transitMatrix, message.transitMatrixDimension, operation.unaryTransit), capacities = copyInt64Array(module, operation.capacities);
        try {
          await withWasmCString(module, operation.name, async (namePtr) => {
            await ccallNumber(
              module,
              "routing_add_dimension_with_vehicle_capacity",
              ["number", "number", "bigint", "number", "number", "number", "number"],
              [modelHandle, index, operation.slackMax, capacities.ptr, capacities.length, operation.fixStartCumulToZero ? 1 : 0, namePtr]
            );
          });
        } finally {
          module._free(capacities.ptr);
        }
      } else if (operation.type === "addDimensionWithVehicleTransits") {
        let evaluatorIndices = [];
        for (let [i, matrix] of operation.transitMatrices.entries())
          evaluatorIndices.push(await registerTransitMatrix(module, modelHandle, matrix, message.transitMatrixDimension, operation.unaryTransits?.[i]));
        let evaluatorsPtr = copyInt32Array(module, evaluatorIndices);
        try {
          await withWasmCString(module, operation.name, async (namePtr) => {
            await ccallNumber(
              module,
              "routing_add_dimension_with_vehicle_transits",
              ["number", "number", "number", "bigint", "bigint", "number", "number"],
              [modelHandle, evaluatorsPtr, evaluatorIndices.length, operation.slackMax, operation.capacity, operation.fixStartCumulToZero ? 1 : 0, namePtr]
            );
          });
        } finally {
          module._free(evaluatorsPtr);
        }
      } else if (operation.type === "addDependentDimension") {
        if (operation.transitMatrices.length !== message.numVehicles || operation.dependentMatrices.length !== message.numVehicles || operation.capacities.length !== message.numVehicles)
          throw new RangeError("Routing dependent dimension requires one evaluator and capacity per vehicle.");
        let fixed = [], dependent = [];
        for (let [i, matrix] of operation.transitMatrices.entries())
          fixed.push(await registerTransitMatrix(module, modelHandle, matrix, message.transitMatrixDimension, operation.unaryTransits?.[i]));
        for (let matrix of operation.dependentMatrices) dependent.push(await registerStateDependentMatrix(module, modelHandle, matrix));
        let pointers = [];
        try {
          let fixedPtr = copyInt32Array(module, fixed);
          pointers.push(fixedPtr);
          let dependentPtr = copyInt32Array(module, dependent);
          pointers.push(dependentPtr);
          let limits = copyInt64Array(module, operation.capacities);
          pointers.push(limits.ptr);
          let add = (basePtr) => withWasmCString(module, operation.name, (namePtr) => ccallNumber(
            module,
            "routing_add_dependent_dimension",
            ["number", "number", "number", "number", "number", "bigint", "number", "number", "number"],
            [modelHandle, fixedPtr, dependentPtr, fixed.length, basePtr, operation.slackMax, limits.ptr, Number(operation.fixStartCumulToZero), namePtr]
          ));
          if ((operation.baseDimension === void 0 ? await add(0) : await withWasmCString(module, operation.baseDimension, add)) !== 1) throw new Error("Invalid Routing dependent dimension or cumul domain coverage.");
        } finally {
          for (let pointer of pointers) module._free(pointer);
        }
      } else if (operation.type === "addDimensionWithVehicleTransitAndCapacity") {
        if (operation.transitMatrices.length !== message.numVehicles || operation.capacities.length !== message.numVehicles)
          throw new RangeError("Routing dimension requires one evaluator and capacity per vehicle.");
        let evaluatorIndices = [];
        for (let [i, matrix] of operation.transitMatrices.entries())
          evaluatorIndices.push(await registerTransitMatrix(module, modelHandle, matrix, message.transitMatrixDimension, operation.unaryTransits?.[i]));
        let evaluatorsPtr = copyInt32Array(module, evaluatorIndices);
        try {
          let capacities = copyInt64Array(module, operation.capacities);
          try {
            if (await withWasmCString(module, operation.name, (namePtr) => ccallNumber(
              module,
              "routing_add_dimension_with_vehicle_transit_and_capacity",
              ["number", "number", "number", "bigint", "number", "number", "number", "number"],
              [
                modelHandle,
                evaluatorsPtr,
                evaluatorIndices.length,
                operation.slackMax,
                capacities.ptr,
                capacities.length,
                operation.fixStartCumulToZero ? 1 : 0,
                namePtr
              ]
            )) !== 1) throw new Error("Routing failed to add vehicle transit/capacity dimension.");
          } finally {
            module._free(capacities.ptr);
          }
        } finally {
          module._free(evaluatorsPtr);
        }
      } else if (operation.type === "addTypeRequirement") {
        let pointer = copyInt32Array(module, operation.requiredTypeAlternatives);
        try {
          if (await ccallNumber(
            module,
            "routing_add_type_requirement",
            ["number", "number", "number", "number", "number"],
            [modelHandle, operation.kind, operation.dependentType, pointer, operation.requiredTypeAlternatives.length]
          ) !== 1) throw new Error("Invalid Routing type requirement kind or visit type.");
        } finally {
          module._free(pointer);
        }
      } else if (operation.type === "setVisitType") {
        if (await ccallNumber(
          module,
          "routing_set_visit_type",
          ["number", "bigint", "number", "number"],
          [modelHandle, toInt64(operation.index), operation.visitType, operation.policy]
        ) !== 1) throw new Error("Invalid Routing visit-type index, type or policy.");
      } else if (operation.type === "addHardTypeIncompatibility") {
        if (await ccallNumber(
          module,
          "routing_add_hard_type_incompatibility",
          ["number", "number", "number"],
          [modelHandle, operation.type1, operation.type2]
        ) !== 1) throw new Error("Routing hard incompatibility references an unknown visit type.");
      } else if (operation.type === "addTemporalTypeIncompatibility") {
        if (await ccallNumber(
          module,
          "routing_add_temporal_type_incompatibility",
          ["number", "number", "number"],
          [modelHandle, operation.type1, operation.type2]
        ) !== 1) throw new Error("Routing temporal incompatibility references an unknown visit type.");
      } else if (operation.type === "setNextValues") {
        let values = copyInt64Array(module, Array.from(operation.values, (value) => toIndex(value, "Routing successor value", message.transitMatrixDimension - 1)));
        try {
          if (await ccallNumber(
            module,
            "routing_set_next_values",
            ["number", "bigint", "number", "number"],
            [modelHandle, toInt64(operation.index), values.ptr, values.length]
          ) !== 1) throw new Error("Routing successor domain has an invalid index or value.");
        } finally {
          module._free(values.ptr);
        }
      } else if (operation.type === "setVehicleValues") {
        let values = Array.from(operation.values, (value) => {
          let exact = toInt64(value, "Routing vehicle domain value");
          if (exact < -1n || exact >= BigInt(message.numVehicles)) throw new RangeError("Invalid Routing vehicle domain value.");
          return Number(exact);
        }), pointer = copyInt32Array(module, values);
        try {
          if (await ccallNumber(
            module,
            "routing_set_vehicle_values",
            ["number", "bigint", "number", "number"],
            [modelHandle, toInt64(operation.index), pointer, values.length]
          ) !== 1) throw new Error("Routing vehicle domain has an invalid index or value.");
        } finally {
          module._free(pointer);
        }
      } else if (operation.type === "setAllowedVehiclesForIndex") {
        let vehicles = operation.vehicles.map((vehicle) => toIndex(vehicle, "Routing eligible vehicle", message.numVehicles - 1)), pointer = copyInt32Array(module, vehicles);
        try {
          if (await ccallNumber(
            module,
            "routing_set_allowed_vehicles_for_index",
            ["number", "number", "number", "bigint"],
            [modelHandle, pointer, vehicles.length, toInt64(operation.index)]
          ) !== 1) throw new Error("Routing vehicle eligibility has invalid vehicles or index.");
        } finally {
          module._free(pointer);
        }
      } else if (operation.type === "setActiveValues") {
        let values = Array.from(operation.values, (value) => toIndex(value, "Routing active domain value", 1)), pointer = copyInt32Array(module, values);
        try {
          if (await ccallNumber(
            module,
            "routing_set_active_values",
            ["number", "bigint", "number", "number"],
            [modelHandle, toInt64(operation.index), pointer, values.length]
          ) !== 1) throw new Error("Routing active domain has an invalid index or value.");
        } finally {
          module._free(pointer);
        }
      } else if (operation.type === "setDimensionValue") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_dimension_set_value",
          ["number", "number", "number", "number", "bigint"],
          [modelHandle, namePtr, routingDimensionValueKinds[operation.setting], operation.vehicle ?? -1, toInt64(operation.value)]
        )) !== 1) throw new Error("Routing dimension setting has an unknown dimension, invalid kind, vehicle or value.");
      } else if (operation.type === "modifyDomain") {
        let values = copyInt64Array(module, operation.values);
        try {
          if (await withWasmCString(module, operation.variable.dimensionName, (name) => ccallNumber(
            module,
            "routing_modify_domain",
            ["number", "number", "number", "bigint", "number", "bigint", "bigint", "number", "number", "number"],
            [
              modelHandle,
              operation.variable.kind,
              name,
              BigInt(operation.variable.index),
              operation.action,
              operation.lower,
              operation.upper,
              values.ptr,
              values.length,
              operation.variable.resourceGroup ?? 0
            ]
          )) !== 1) throw new Error("Invalid Routing domain operation.");
        } finally {
          module._free(values.ptr);
        }
      } else if (operation.type === "addLinearConstraint") {
        let left = await createLinearExpression(module, modelHandle, operation.left), right = await createLinearExpression(module, modelHandle, operation.right);
        if (operation.conditions?.length || operation.booleanConditions?.length) {
          let conditions = [];
          for (let condition of operation.conditions ?? []) conditions.push(
            await createLinearExpression(module, modelHandle, condition.left),
            await createLinearExpression(module, modelHandle, condition.right),
            condition.comparison
          );
          let booleanConditions = [];
          for (let condition of operation.booleanConditions ?? []) booleanConditions.push(await createBooleanExpression(module, modelHandle, condition));
          let booleanPointer = copyInt32Array(module, booleanConditions), pointer = 0;
          try {
            if (pointer = copyInt32Array(module, conditions), await ccallNumber(
              module,
              "routing_add_conditional_linear_constraint",
              ["number", "number", "number", "number", "number", "number", "number", "number"],
              [modelHandle, left, right, operation.comparison, pointer, operation.conditions?.length ?? 0, booleanPointer, booleanConditions.length]
            ) !== 1)
              throw new Error("Invalid Routing conditional comparison.");
          } finally {
            pointer && module._free(pointer), module._free(booleanPointer);
          }
        } else if (await ccallNumber(
          module,
          "routing_add_linear_constraint",
          ["number", "number", "number", "number"],
          [modelHandle, left, right, operation.comparison]
        ) !== 1) throw new Error("Invalid Routing comparison.");
      } else if (operation.type === "addFinalizer") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_add_finalizer",
          ["number", "number", "number", "bigint", "number", "bigint", "number", "bigint", "number"],
          [
            modelHandle,
            operation.variableKind,
            namePtr,
            toInt64(operation.index),
            operation.kind,
            toInt64(operation.target),
            operation.weight === void 0 ? 0 : 1,
            toInt64(operation.weight ?? 0n),
            operation.resourceGroup ?? 0
          ]
        )) !== 1) throw new Error("Routing finalizer has an invalid variable, dimension or kind.");
      } else if (operation.type === "setSlackBounds") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_dimension_set_slack_bounds",
          ["number", "number", "bigint", "bigint", "bigint"],
          [modelHandle, namePtr, toInt64(operation.index), toInt64(operation.lower), toInt64(operation.upper)]
        )) !== 1) throw new Error("Routing slack bounds have an unknown dimension, invalid index or reversed range.");
      } else if (operation.type === "setCumulBounds") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_dimension_set_cumul_bounds",
          ["number", "number", "bigint", "bigint", "bigint"],
          [modelHandle, namePtr, toInt64(operation.index), operation.lower, operation.upper]
        )) !== 1) throw new Error("Routing cumul bounds have an unknown dimension, invalid index or reversed range.");
      } else if (operation.type === "addNodePrecedence") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_dimension_add_node_precedence",
          ["number", "number", "bigint", "bigint", "bigint", "number"],
          [modelHandle, namePtr, toInt64(operation.first), toInt64(operation.second), operation.offset, operation.performedConstraint ?? 0]
        )) !== 1) throw new Error("Routing node precedence has an unknown dimension or invalid indices.");
      } else if (operation.type === "addConstantDimension")
        await withWasmCString(module, operation.name, async (namePtr) => {
          await ccallNumber(
            module,
            operation.slackMax === void 0 ? "routing_add_constant_dimension" : "routing_add_constant_dimension_with_slack",
            operation.slackMax === void 0 ? ["number", "bigint", "bigint", "number", "number"] : ["number", "bigint", "bigint", "bigint", "number", "number"],
            operation.slackMax === void 0 ? [modelHandle, operation.value, operation.capacity, operation.fixStartCumulToZero ? 1 : 0, namePtr] : [modelHandle, operation.value, operation.capacity, operation.slackMax, operation.fixStartCumulToZero ? 1 : 0, namePtr]
          );
        });
      else if (operation.type === "addVectorDimension") {
        let values = copyInt64Array(module, operation.values);
        try {
          await withWasmCString(module, operation.name, async (namePtr) => {
            await ccallNumber(
              module,
              "routing_add_vector_dimension",
              ["number", "number", "number", "bigint", "number", "number"],
              [modelHandle, values.ptr, values.length, operation.capacity, operation.fixStartCumulToZero ? 1 : 0, namePtr]
            );
          });
        } finally {
          module._free(values.ptr);
        }
      } else if (operation.type === "addMatrixDimension") {
        let flat = operation.matrix.flat(), matrix = copyInt64Array(module, flat);
        try {
          await withWasmCString(module, operation.name, async (namePtr) => {
            await ccallNumber(
              module,
              "routing_add_matrix_dimension",
              ["number", "number", "number", "number", "bigint", "number", "number"],
              [modelHandle, matrix.ptr, matrix.length, operation.matrix.length, operation.capacity, operation.fixStartCumulToZero ? 1 : 0, namePtr]
            );
          });
        } finally {
          module._free(matrix.ptr);
        }
      } else if (operation.type === "addSoftSameVehicleConstraint") {
        let indices2 = copyInt64Array(module, operation.indices);
        try {
          if (await ccallNumber(
            module,
            "routing_add_soft_same_vehicle_constraint",
            ["number", "number", "number", "bigint"],
            [modelHandle, indices2.ptr, indices2.length, toInt64(operation.cost)]
          ) !== 1) throw new Error("Routing failed to add a soft same-vehicle constraint.");
        } finally {
          module._free(indices2.ptr);
        }
      } else if (operation.type === "setPickupDeliveryPolicy") {
        if (await ccallNumber(
          module,
          "routing_set_pickup_delivery_policy",
          ["number", "number", "number"],
          [modelHandle, toIndex(operation.vehicle, "Routing pickup/delivery vehicle", message.numVehicles - 1), toIndex(operation.policy, "Routing pickup/delivery policy", 2)]
        ) !== 1) throw new Error("Routing failed to set a pickup/delivery policy.");
      } else if (operation.type === "addDisjunction") {
        let indices2 = copyInt64Array(module, operation.indices);
        try {
          if (await ccallNumber(
            module,
            "routing_add_disjunction_with_options",
            ["number", "number", "number", "bigint", "number", "bigint", "number"],
            [
              modelHandle,
              indices2.ptr,
              indices2.length,
              operation.penalty ?? 0n,
              operation.penalty === void 0 ? 0 : 1,
              operation.maxCardinality ?? 1n,
              operation.penaltyCostBehavior ?? 0
            ]
          ) < 0) throw new Error("Routing failed to add disjunction indices.");
        } finally {
          module._free(indices2.ptr);
        }
      } else if (operation.type === "addPickupAndDeliverySets") {
        if (await ccallNumber(
          module,
          "routing_add_pickup_and_delivery_sets",
          ["number", "number", "number"],
          [
            modelHandle,
            toIndex(operation.pickupDisjunction, "pickup disjunction", 2147483647),
            toIndex(operation.deliveryDisjunction, "delivery disjunction", 2147483647)
          ]
        ) !== 1)
          throw new Error("Routing pickup/delivery sets have an invalid disjunction.");
      } else if (operation.type === "setPickupToDeliveryLimits") {
        let limits = copyInt64Array(module, operation.limits);
        try {
          if (await withWasmCString(module, operation.dimensionName, (name) => ccallNumber(
            module,
            "routing_set_pickup_to_delivery_limits",
            ["number", "number", "number", "number", "number"],
            [modelHandle, name, toIndex(operation.pairIndex, "pickup/delivery pair", 2147483647), limits.ptr, limits.length]
          )) !== 1) throw new Error("Routing pickup/delivery limit table has an invalid dimension, pair or size.");
        } finally {
          module._free(limits.ptr);
        }
      } else if (operation.type === "addPickupAndDelivery") {
        if (await ccallNumber(
          module,
          "routing_add_pickup_and_delivery",
          ["number", "bigint", "bigint"],
          [modelHandle, toInt64(operation.pickup), toInt64(operation.delivery)]
        ) !== 1) throw new Error("Routing failed to add pickup/delivery indices.");
      } else if (operation.type === "addVehicleEqualityConstraint") {
        if (await ccallNumber(
          module,
          "routing_add_vehicle_equality_constraint",
          ["number", "bigint", "bigint"],
          [modelHandle, toInt64(operation.left), toInt64(operation.right)]
        ) !== 1) throw new Error("Routing failed to add a vehicle equality constraint.");
      } else if (operation.type === "addCumulLessOrEqualConstraint") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_add_dimension_cumul_less_or_equal_constraint",
          ["number", "number", "bigint", "bigint"],
          [modelHandle, namePtr, toInt64(operation.left), toInt64(operation.right)]
        )) !== 1) throw new Error("Routing failed to add a cumul precedence constraint.");
      } else if (operation.type === "setCumulSoftBound") {
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          "routing_dimension_set_cumul_soft_bound",
          ["number", "number", "bigint", "bigint", "bigint", "number"],
          [modelHandle, namePtr, toInt64(operation.index), toInt64(operation.bound), toInt64(operation.coefficient), Number(operation.lower)]
        )) !== 1) throw new Error("Routing failed to set a soft cumul bound.");
      } else if (operation.type === "setSoftSpanUpperBound" || operation.type === "setQuadraticCostSoftSpanUpperBound") {
        let name = operation.type === "setSoftSpanUpperBound" ? "routing_dimension_set_soft_span_upper_bound" : "routing_dimension_set_quadratic_cost_soft_span_upper_bound";
        if (await withWasmCString(module, operation.dimensionName, (namePtr) => ccallNumber(
          module,
          name,
          ["number", "number", "bigint", "bigint", "number"],
          [modelHandle, namePtr, toInt64(operation.bound), toInt64(operation.cost), operation.vehicle]
        )) !== 1) throw new Error("Routing failed to set a soft span bound.");
      }
    for (let [groupIndex, group] of (message.resourceGroups ?? []).entries()) {
      for (let [resourceIndex, resource] of group.resources.entries()) {
        let start = copyInt64Array(module, resource.startDomain);
        try {
          let end = copyInt64Array(module, resource.endDomain);
          try {
            if (await withWasmCString(module, resource.dimensionName, (name) => ccallNumber(
              module,
              "routing_add_resource",
              ["number", "number", "number", "number", "number", "number", "number"],
              [modelHandle, groupIndex, name, start.ptr, start.length, end.ptr, end.length]
            )) !== resourceIndex) throw new Error("Invalid Routing resource attributes or dimension.");
          } finally {
            module._free(end.ptr);
          }
        } finally {
          module._free(start.ptr);
        }
      }
      for (let vehicle of group.requiredVehicles) if (await ccallNumber(
        module,
        "routing_require_resource",
        ["number", "number", "number"],
        [modelHandle, groupIndex, vehicle]
      ) !== 1) throw new Error("Invalid Routing resource vehicle.");
      for (let allowed of group.allowedResources) {
        let ptr = copyInt32Array(module, allowed.resources);
        try {
          if (await ccallNumber(
            module,
            "routing_allow_resources",
            ["number", "number", "number", "number", "number"],
            [modelHandle, groupIndex, allowed.vehicle, ptr, allowed.resources.length]
          ) !== 1) throw new Error("Invalid Routing resource eligibility.");
        } finally {
          module._free(ptr);
        }
      }
    }
    return { modelHandle, managerHandle, breakCount, travelHandles };
  } catch (error) {
    throw await deleteRoutingModel(module, { modelHandle, managerHandle }), error;
  } finally {
    startsPtr && module._free(startsPtr), endsPtr && module._free(endsPtr);
  }
}
async function solveRoutingWithModule(module, message, interruptible = !1, callbackId = 0) {
  if (message.validateSearchParameters) {
    let bytes = allocateWasmBytes(module, message.searchParametersProto, 1);
    try {
      return { status: 0, solution: null, searchParameterError: await withWasmCString(module, (message.searchParameterFields ?? []).join(","), (fields) => module.ccall(
        "routing_find_error_in_search_parameters",
        "string",
        ["number", "number", "number"],
        [bytes, message.searchParametersProto.length, fields],
        { async: !0 }
      )) };
    } finally {
      module._free(bytes);
    }
  }
  let models = [];
  try {
    let requests = [], seen = /* @__PURE__ */ new Set();
    for (let current = message; current; current = current.secondaryModel) {
      if (seen.has(current)) throw new Error("Routing secondary models must not form a cycle.");
      if (seen.add(current), message.secondaryModel && current.operations.some((operation) => operation.type === "addRouteConstraint"))
        throw new Error("Native Routing secondary-model optimization does not safely support whole-route callbacks.");
      requests.push(current), models.push(await createRoutingModel(module, current, callbackId));
    }
    for (let index = models.length - 1; index > 0; --index) {
      let current = requests[index], bytes = allocateWasmBytes(module, current.searchParametersProto, 1);
      try {
        if (!await withWasmCString(module, (current.searchParameterFields ?? []).join(","), (fields) => ccallNumber(
          module,
          "routing_set_secondary_model",
          Array(5).fill("number"),
          [models[index - 1].modelHandle, models[index].modelHandle, bytes, current.searchParametersProto.length, fields]
        ))) throw new Error(`Routing secondary model: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
      } finally {
        module._free(bytes);
      }
    }
    let { modelHandle, breakCount, travelHandles } = models[0];
    if (message.assignmentTransfer) {
      await closeModelWithParameters(module, modelHandle, message);
      let next = copyInt64Array(module, message.assignmentTransfer.nextValues);
      try {
        let vehicles = copyInt64Array(module, message.assignmentTransfer.vehicleValues);
        try {
          let encoded = await module.ccall(
            "routing_transfer_assignment",
            "string",
            Array(5).fill("number"),
            [modelHandle, next.ptr, next.length, vehicles.ptr, vehicles.length],
            { async: !0 }
          );
          if (!encoded) throw new Error(`Routing assignment transfer: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
          let data = JSON.parse(encoded);
          return { status: 0, solution: null, assignmentSeed: {
            objectiveMin: BigInt(data.objectiveMin),
            objectiveMax: BigInt(data.objectiveMax),
            intervals: [],
            variables: data.variables.map(({ variable, min, max }) => ({ variable, min: BigInt(min), max: BigInt(max) }))
          } };
        } finally {
          module._free(vehicles.ptr);
        }
      } finally {
        module._free(next.ptr);
      }
    }
    if (message.routeCostQuery) {
      let input = copyInt64Array(module, message.routeCostQuery.map(BigInt));
      try {
        let value = await module.ccall(
          "routing_get_route_cost",
          "string",
          ["number", "number", "number"],
          [modelHandle, input.ptr, input.length],
          { async: !0 }
        );
        if (!value) throw new Error(`Routing route cost: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
        return { status: 0, solution: null, routeCost: value === "null" ? null : BigInt(value) };
      } finally {
        module._free(input.ptr);
      }
    }
    if (message.modelQuery) {
      let query = message.modelQuery;
      (query.kind < 8 || query.kind >= 10 && query.kind <= 20 || query.kind === 24 || query.kind === 26 || query.kind === 27 || query.kind >= 28 && query.kind <= 30) && await closeModelWithParameters(module, modelHandle, message);
      let encoded;
      if (query.kind === 30) {
        let pointer = allocateWasmBytes(module, message.searchParametersProto, 1);
        try {
          encoded = await withWasmCString(module, (message.searchParameterFields ?? []).join(","), (paths) => module.ccall(
            "routing_inspect_model_parameters",
            "string",
            Array(5).fill("number"),
            [modelHandle, query.kind, pointer, message.searchParametersProto.length, paths],
            { async: !0 }
          ));
        } finally {
          module._free(pointer);
        }
      } else encoded = await module.ccall(
        "routing_inspect_model",
        "string",
        ["number", "number", "bigint", "bigint", "number", "bigint", "number", "number", "bigint"],
        [modelHandle, query.kind, query.index, query.otherIndex, query.vehicleOrClass, query.defaultValue, callbackId, query.predicateEvaluator ?? 0, query.thirdIndex ?? 0n],
        { async: !0 }
      );
      if (!encoded) throw new Error(`Routing model inspection: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
      let data = JSON.parse(encoded);
      return { status: 0, solution: null, modelInspection: {
        value: data.value === void 0 ? void 0 : BigInt(data.value),
        dimensionIndices: data.dimensionIndices,
        indices: data.indices,
        groups: data.groups,
        precedenceGroups: data.precedenceGroups
      } };
    }
    if (message.dimensionQuery) {
      let query = message.dimensionQuery;
      if (query.kind !== 6 && query.kind !== 8 && await closeModelWithParameters(module, modelHandle, message), query.kind === 13) {
        if (!message.initialAssignment?.snapshot) throw new Error("Shortest transition slack requires an assignment snapshot.");
        await loadAssignment(module, modelHandle, message.initialAssignment.snapshot);
      }
      let encoded = await withWasmCString(module, query.dimensionName, (name) => module.ccall(
        "routing_inspect_dimension",
        "string",
        ["number", "number", "number", "bigint", "bigint", "number", "bigint", "bigint", "number", "number", "number"],
        [
          modelHandle,
          name,
          query.kind,
          query.index,
          query.otherIndex,
          query.vehicleOrClass,
          query.lower,
          query.upper,
          query.pairIndex ?? 0,
          query.pickupAlternativeIndex ?? 0,
          query.deliveryAlternativeIndex ?? 0
        ],
        { async: !0 }
      ));
      if (!encoded) throw new Error(`Routing dimension inspection: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
      let data = JSON.parse(encoded);
      return { status: 0, solution: null, dimensionInspection: {
        value: data.value === void 0 ? void 0 : BigInt(data.value),
        hasPiecewiseLinearCost: data.hasPiecewiseLinearCost,
        nodePrecedences: data.nodePrecedences.map(({ first, second, offset, performedConstraint }) => ({ first: BigInt(first), second: BigInt(second), offset: BigInt(offset), performedConstraint })),
        intervals: data.intervals.map(({ start, end }) => ({ start: BigInt(start), end: BigInt(end) })),
        costSegments: data.costSegments.map(({ pointX, pointY, slope, otherPointX }) => ({ pointX: BigInt(pointX), pointY: BigInt(pointY), slope: BigInt(slope), otherPointX: BigInt(otherPointX) }))
      } };
    }
    if (message.pickupDeliveryInspectionIndex !== void 0) {
      let index = toIndex(message.pickupDeliveryInspectionIndex, "Routing pickup/delivery index", message.transitMatrixDimension - message.numVehicles - 1), position = async (delivery2) => {
        let field = (kind) => ccallNumber(module, "routing_pickup_delivery_position", Array(4).fill("number"), [modelHandle, index, delivery2, kind]), pairIndex = await field(0);
        if (pairIndex < -1) throw new Error("Invalid native pickup/delivery inspection.");
        return { position: pairIndex < 0 ? void 0 : { pairIndex, alternativeIndex: await field(1) }, classified: !!await field(2) };
      }, pickup = await position(0), delivery = await position(1);
      return { status: 0, solution: null, pickupDeliveryInspection: { pickup: pickup.position, delivery: delivery.position, isPickup: pickup.classified, isDelivery: delivery.classified } };
    }
    if (message.breakInspection) {
      let { dimensionName, vehicle } = message.breakInspection;
      return await withWasmCString(module, dimensionName, async (name) => {
        let value = async (kind, index = 0) => {
          let result = await ccallBigInt(module, "routing_break_configuration_value", Array(5).fill("number"), [modelHandle, name, vehicle, kind, index]);
          if (result === -2n) throw new Error(module.ccall("routing_last_break_error", "string", [], []));
          return result;
        }, hasBreakConstraints = !!await value(0), configuration = { hasBreakConstraints, intervals: [], distanceDuration: [] };
        if (hasBreakConstraints) {
          let intervals = Number(await value(1)), pairs = Number(await value(3));
          for (let i = 0; i < intervals; ++i) configuration.intervals.push(Number(await value(2, i)));
          for (let i = 0; i < pairs; ++i) configuration.distanceDuration.push({ distance: await value(4, i), duration: await value(5, i) });
          let pre = Number(await value(6)), post = Number(await value(7));
          configuration.preTravelEvaluator = travelHandles.get(pre) ?? pre, configuration.postTravelEvaluator = travelHandles.get(post) ?? post;
        }
        return { status: 0, solution: null, breakConfiguration: configuration };
      });
    }
    if (message.inspectActivityGroups) {
      module.ccall("routing_close_model", null, ["number"], [modelHandle]);
      let read = async (group) => {
        let length = await ccallNumber(module, "routing_activity_groups", Array(4).fill("number"), [modelHandle, group, 0, 0]);
        if (length < 0) throw new Error("Invalid native Routing activity group.");
        if (length === 0) return [];
        let pointer = allocateWasm(module, length * 4);
        try {
          if (await ccallNumber(module, "routing_activity_groups", Array(4).fill("number"), [modelHandle, group, pointer, length]) !== length)
            throw new Error("Native Routing activity-group size changed.");
          return Array.from(new Int32Array(module.HEAPU8.buffer, pointer, length));
        } finally {
          module._free(pointer);
        }
      }, groups = await read(-1), count2 = await ccallNumber(module, "routing_activity_group_count", ["number"], [modelHandle]);
      if (count2 < 0) throw new Error("Invalid native Routing activity-group count.");
      let members = [];
      for (let group = 0; group < count2; ++group) members.push(await read(group));
      return { status: 0, solution: null, localSearchProfile: "", automaticFirstSolutionStrategy: 0, activityGroups: { groups, members } };
    }
    if (message.resourceInspectionGroup !== void 0) {
      let group = toIndex(message.resourceInspectionGroup, "Routing resource group", (message.resourceGroups?.length ?? 0) - 1);
      module.ccall("routing_close_model", null, ["number"], [modelHandle]);
      let count2 = await ccallNumber(module, "routing_resource_classes_count", ["number", "number"], [modelHandle, group]);
      if (count2 < 0) throw new Error("Invalid native Routing resource inspection group.");
      let readArray = async (name, types, args, exact) => {
        let length = await ccallNumber(module, name, [...types, "number", "number"], [...args, 0, 0]);
        if (length < 0) throw new Error("Invalid native Routing resource inspection.");
        if (length === 0) return [];
        let width = exact ? 8 : 4, pointer = allocateWasm(module, width * length);
        try {
          if (await ccallNumber(module, name, [...types, "number", "number"], [...args, pointer, length]) !== length) throw new Error("Native Routing resource inspection size changed.");
          let view = new DataView(module.HEAPU8.buffer, pointer, width * length);
          return Array.from({ length }, (_, index) => exact ? view.getBigInt64(index * width, !0) : view.getInt32(index * width, !0));
        } finally {
          module._free(pointer);
        }
      }, attributes = async (index, forClass) => {
        let result = [];
        for (let dimensionName of message.dimensionNames) {
          let domains = await withWasmCString(module, dimensionName, async (name) => {
            let args = [modelHandle, group, index, name, forClass ? 1 : 0], types = ["number", "number", "number", "number", "number", "number"];
            return {
              startDomain: await readArray("routing_resource_attributes", types, [...args, 0], !0),
              endDomain: await readArray("routing_resource_attributes", types, [...args, 1], !0)
            };
          });
          result.push({ dimensionName, ...domains });
        }
        return result;
      }, resourceInspection = { affectedDimensions: [], resources: [], classes: [] };
      for (let dimensionName of message.dimensionNames) {
        let affected = await withWasmCString(module, dimensionName, (name) => ccallNumber(
          module,
          "routing_resource_dimension_affected",
          ["number", "number", "number"],
          [modelHandle, group, name]
        ));
        if (affected < 0) throw new Error("Unknown native Routing resource inspection dimension.");
        affected && resourceInspection.affectedDimensions.push(dimensionName);
      }
      for (let resource = 0; resource < message.resourceGroups[group].resources.length; ++resource) {
        let classIndex = await ccallNumber(module, "routing_resource_class_index", ["number", "number", "number"], [modelHandle, group, resource]);
        if (classIndex < 0) throw new Error("Native Routing model did not compute resource classes.");
        resourceInspection.resources.push({ classIndex, dimensionAttributes: await attributes(resource, !1) });
      }
      for (let resourceClass = 0; resourceClass < count2; ++resourceClass) resourceInspection.classes.push({
        resourceIndices: await readArray("routing_resources_in_class", ["number", "number", "number"], [modelHandle, group, resourceClass], !1),
        dimensionAttributes: await attributes(resourceClass, !0)
      });
      return { status: 0, solution: null, resourceInspection, localSearchProfile: "", automaticFirstSolutionStrategy: 0 };
    }
    if (message.domainQueries?.length) {
      let domainResults = [];
      for (let query of message.domainQueries) {
        let pointer = allocateWasm(module, 40);
        try {
          if (await withWasmCString(module, query.variable.dimensionName, (name) => ccallNumber(
            module,
            "routing_inspect_variable",
            ["number", "number", "number", "bigint", "number", "bigint", "number", "number", "number"],
            [
              modelHandle,
              query.variable.kind,
              name,
              BigInt(query.variable.index),
              query.containsValue === void 0 ? 0 : 1,
              query.containsValue ?? 0n,
              query.softLowerBound === void 0 ? 0 : query.softLowerBound ? 1 : 2,
              pointer,
              query.variable.resourceGroup ?? 0
            ]
          )) !== 1) throw new Error("Invalid Routing variable domain query.");
          let view = new DataView(module.HEAPU8.buffer, pointer, 40), flags = view.getBigInt64(24, !0);
          domainResults.push({
            min: view.getBigInt64(0, !0),
            max: view.getBigInt64(8, !0),
            size: view.getBigUint64(16, !0),
            bound: (flags & 1n) !== 0n,
            ...query.softLowerBound === void 0 ? {} : { softBound: view.getBigInt64(32, !0) },
            ...query.containsValue === void 0 ? {} : { contains: (flags & 2n) !== 0n }
          });
        } finally {
          module._free(pointer);
        }
      }
      return { status: 0, solution: null, localSearchProfile: "", automaticFirstSolutionStrategy: 0, domainResults };
    }
    if (message.arcCostQueries?.length) {
      module.ccall("routing_close_model", null, ["number"], [modelHandle]);
      let arcCosts = [];
      for (let query of message.arcCostQueries)
        arcCosts.push(module.ccall(
          "routing_get_arc_cost_for_vehicle",
          "bigint",
          ["number", "bigint", "bigint", "number"],
          [modelHandle, query.fromIndex, query.toIndex, query.vehicle]
        ));
      return { status: 0, solution: null, localSearchProfile: "", automaticFirstSolutionStrategy: 0, arcCosts };
    }
    let dimensionVariableKinds = [
      2 /* ROUTING_VARIABLE_SLACK */,
      6 /* ROUTING_VARIABLE_TRANSIT */,
      7 /* ROUTING_VARIABLE_FIXED_TRANSIT */
    ], captureGroups = message.dimensionNames.flatMap((dimensionName) => dimensionVariableKinds.map((kind) => ({
      kind,
      dimensionName,
      count: message.transitMatrixDimension - message.numVehicles
    })));
    for (let kind of [8 /* ROUTING_VARIABLE_ACTIVE_VEHICLE */, 9 /* ROUTING_VARIABLE_ROUTE_CONSIDERED */])
      captureGroups.push({ kind, dimensionName: "", count: message.numVehicles });
    captureGroups.push({
      kind: 11 /* ROUTING_VARIABLE_BOOLEAN */,
      dimensionName: "",
      count: message.operations.filter((operation) => operation.type === "addBooleanVariable").length
    }), captureGroups.push({
      kind: 12 /* ROUTING_VARIABLE_EXPRESSION */,
      dimensionName: "",
      count: message.operations.filter((operation) => operation.type === "addIntegerExpression").length
    });
    for (let group of captureGroups)
      if (await withWasmCString(module, group.dimensionName, (name) => ccallNumber(
        module,
        "routing_capture_assignment_variables",
        ["number", "number", "number"],
        [modelHandle, group.kind, name]
      )) !== 1) throw new Error("Failed to capture native Routing assignment variables.");
    let locksApplied;
    if ((message.inspectCumulOptimizers || message.routeLocks || message.inspectPreAssignment || message.firstSolutionHint || message.initialAssignment?.snapshot || message.assignmentAction !== void 0 && message.assignmentAction !== 0 /* SOLVE */) && await closeModelWithParameters(module, modelHandle, message), message.inspectCumulOptimizers) {
      let dimensions = async (global2) => {
        let count2 = await ccallNumber(module, "routing_cumul_optimizer_count", ["number", "number"], [modelHandle, global2]);
        if (count2 < 0) throw new Error("Native Routing cumul optimizer inspection failed.");
        let names = [];
        for (let index = 0; index < count2; ++index) names.push(await module.ccall(
          "routing_cumul_optimizer_dimension_name",
          "string",
          ["number", "number", "number"],
          [modelHandle, global2, index],
          { async: !0 }
        ));
        return names;
      };
      return { status: 0, solution: null, cumulOptimizers: { globalDimensions: await dimensions(1), localDimensions: await dimensions(0) } };
    }
    if (message.routeLocks) {
      let { routes, closeRoutes } = message.routeLocks;
      locksApplied = await withWasmAllocations(module, async (allocate) => {
        let values = BigInt64Array.from(routes.flat(), (value) => toInt64(value)), lengths = Int32Array.from(routes, (route) => route.length);
        return await ccallNumber(
          module,
          "routing_apply_locks",
          Array(5).fill("number"),
          [
            modelHandle,
            allocate(new Uint8Array(values.buffer), 8),
            allocate(new Uint8Array(lengths.buffer), 4),
            routes.length,
            closeRoutes ? 1 : 0
          ]
        ) === 1;
      });
    }
    if (message.inspectPreAssignment) {
      let preAssignment = {};
      for (let index = 0; index < message.transitMatrixDimension - message.numVehicles; ++index) {
        let next = await ccallBigInt(module, "routing_preassignment_next", ["number", "number"], [modelHandle, index]);
        next >= 0n && (preAssignment[index] = toIndex(next, "Routing preassignment next index"));
      }
      return {
        status: 0,
        solution: null,
        localSearchProfile: "",
        automaticFirstSolutionStrategy: 0,
        preAssignment,
        ...locksApplied === void 0 ? {} : { locksApplied }
      };
    }
    if (message.firstSolutionHint && (await loadAssignment(module, modelHandle, message.firstSolutionHint), await ccallNumber(module, "routing_set_first_solution_hint", ["number"], [modelHandle]) !== 1))
      throw new Error("Failed to set native Routing first-solution hint.");
    let action = message.assignmentAction ?? 0 /* SOLVE */;
    if (action !== 0 /* SOLVE */ && !await ccallNumber(
      module,
      "routing_configure_assignment_workflow",
      Array(5).fill("number"),
      [modelHandle, action, message.packingDurationSeconds ?? 0, message.checkSolutionInCp === !1 ? 0 : 1, message.callAtSolutionMonitors ? 1 : 0]
    ))
      throw new Error("Failed to configure Routing assignment operation.");
    for (let candidate of message.candidateAssignments ?? [])
      if (await loadAssignment(module, modelHandle, candidate), !await ccallNumber(module, "routing_add_candidate_assignment", ["number"], [modelHandle]))
        throw new Error("Failed to load Routing starting assignment.");
    let ok, initialAssignment = message.initialAssignment;
    if (initialAssignment?.snapshot)
      await loadAssignment(module, modelHandle, initialAssignment.snapshot), ok = message.readAssignmentOnly ? await ccallNumber(module, "routing_restore_assignment", ["number", "number"], [modelHandle, interruptible ? 1 : 0]) : await solveWithSearchParameters(module, modelHandle, message, !0, interruptible);
    else if (initialAssignment) {
      let routes = initialAssignment.routes, values = copyInt64Array(module, routes.flat()), routeLengthsPtr = 0;
      try {
        routeLengthsPtr = copyInt32Array(module, routes.map((route) => route.length));
        let bytes = message.searchParametersProto ?? new Uint8Array(), parametersPtr = allocateWasmBytes(module, bytes, 1), read;
        try {
          read = await withWasmCString(module, (message.searchParameterFields ?? []).join(","), (fieldPaths) => ccallNumber(
            module,
            "routing_read_assignment_from_routes_proto",
            ["number", "number", "number", "number", "number", "number", "number", "number", "number"],
            [
              modelHandle,
              values.ptr,
              routeLengthsPtr,
              routes.length,
              initialAssignment.ignoreInactiveIndices ? 1 : 0,
              parametersPtr,
              bytes.length,
              fieldPaths,
              interruptible ? 1 : 0
            ]
          ));
        } finally {
          module._free(parametersPtr);
        }
        if (read < 0) throw new Error(`Routing search parameters: ${module.ccall("routing_last_search_parameter_error", "string", [], [])}`);
        ok = read === 1 && !message.readAssignmentOnly ? await solveWithSearchParameters(module, modelHandle, message, !0, interruptible) : read;
      } finally {
        module._free(values.ptr), routeLengthsPtr && module._free(routeLengthsPtr);
      }
    } else
      ok = await solveWithSearchParameters(module, modelHandle, message, !1, interruptible);
    let nativeStatus = await ccallNumber(module, "routing_status", ["number"], [modelHandle]), status = ok !== 1 && message.initialAssignment && nativeStatus === 0 ? 3 : nativeStatus, localSearchProfile = module.ccall("routing_local_search_profile", "string", ["number"], [modelHandle]), automaticFirstSolutionStrategy = await ccallNumber(module, "routing_get_automatic_first_solution_strategy", ["number"], [modelHandle]), parameterBytes = allocateWasmBytes(module, message.searchParametersProto, 1), firstSolutionCounters;
    try {
      firstSolutionCounters = await withWasmCString(module, (message.searchParameterFields ?? []).join(","), async (fields) => [
        await ccallBigInt(
          module,
          "routing_first_solution_statistic",
          Array(5).fill("number"),
          [modelHandle, 0, parameterBytes, message.searchParametersProto.length, fields]
        ),
        await ccallBigInt(
          module,
          "routing_first_solution_statistic",
          Array(5).fill("number"),
          [modelHandle, 1, parameterBytes, message.searchParametersProto.length, fields]
        )
      ]);
    } finally {
      module._free(parameterBytes);
    }
    let searchStatistics = {
      numDecisionsInFirstSolution: firstSolutionCounters[0] < 0n ? null : firstSolutionCounters[0],
      numRejectsInFirstSolution: firstSolutionCounters[1] < 0n ? null : firstSolutionCounters[1],
      numCpSatCallsInLpScheduling: await ccallBigInt(module, "routing_search_statistic", ["number", "number"], [modelHandle, 0]),
      numGlopCallsInLpScheduling: await ccallBigInt(module, "routing_search_statistic", ["number", "number"], [modelHandle, 1]),
      numMinCostFlowCalls: await ccallBigInt(module, "routing_search_statistic", ["number", "number"], [modelHandle, 2]),
      numCpSatCallsInRouting: await ccallBigInt(module, "routing_search_statistic", ["number", "number"], [modelHandle, 3]),
      numGeneralizedCpSatCallsInRouting: await ccallBigInt(module, "routing_search_statistic", ["number", "number"], [modelHandle, 4])
    }, metadata = {
      status,
      localSearchProfile,
      automaticFirstSolutionStrategy,
      searchStatistics,
      objectiveLowerBound: await ccallBigInt(module, "routing_objective_lower_bound", ["number"], [modelHandle]),
      ...action === 1 /* PACK */ ? { timeLimitReached: !!await ccallNumber(
        module,
        "routing_packing_time_limit_reached",
        ["number"],
        [modelHandle]
      ) } : {},
      ...action === 6 /* LOWER_BOUND */ ? { computedLowerBound: await ccallBigInt(
        module,
        "routing_computed_lower_bound",
        ["number"],
        [modelHandle]
      ) } : {},
      ...action === 7 /* CHECK_FEASIBILITY */ ? { assignmentFeasible: !!await ccallNumber(
        module,
        "routing_assignment_feasible",
        ["number"],
        [modelHandle]
      ) } : {}
    };
    if (ok !== 1) return { ...metadata, solution: null };
    let readSolution = async () => {
      let starts = [], ends = [], nextValues = Array.from({ length: message.transitMatrixDimension }, (_, index) => index), vehicleValues = [];
      for (let index = 0; index < message.transitMatrixDimension; ++index)
        vehicleValues.push(await ccallNumber(
          module,
          "routing_assignment_vehicle_value",
          ["number", "bigint"],
          [modelHandle, toInt64(index)]
        ));
      let dimensionCumulValues = /* @__PURE__ */ Object.create(null), dimensionCumulMaxs = /* @__PURE__ */ Object.create(null);
      for (let vehicle = 0; vehicle < message.numVehicles; vehicle++) {
        let index = toIndex(await ccallBigInt(module, "routing_start", ["number", "number"], [modelHandle, vehicle]), "route start index");
        for (starts.push(index); await ccallNumber(module, "routing_is_end", ["number", "bigint"], [modelHandle, toInt64(index)]) !== 1; ) {
          let next = toIndex(await ccallBigInt(module, "routing_next_value", ["number", "bigint"], [modelHandle, toInt64(index)]), "next index");
          nextValues[index] = next, index = next;
        }
        ends.push(index);
      }
      for (let dimensionName of message.dimensionNames)
        dimensionCumulValues[dimensionName] = [], dimensionCumulMaxs[dimensionName] = [], await withWasmCString(module, dimensionName, async (namePtr) => {
          for (let index = 0; index < message.transitMatrixDimension; index++)
            dimensionCumulValues[dimensionName][index] = await ccallBigInt(
              module,
              "routing_assignment_dimension_cumul_value",
              ["number", "number", "bigint"],
              [modelHandle, namePtr, toInt64(index)]
            ), dimensionCumulMaxs[dimensionName][index] = await ccallBigInt(
              module,
              "routing_assignment_dimension_cumul_max",
              ["number", "number", "bigint"],
              [modelHandle, namePtr, toInt64(index)]
            );
        });
      let assignmentVariables = [], boundsPointer = allocateWasm(module, 16);
      try {
        for (let group of captureGroups) await withWasmCString(module, group.dimensionName, async (name) => {
          for (let index = 0; index < group.count; ++index) {
            if (await ccallNumber(
              module,
              "routing_assignment_variable_bounds",
              ["number", "number", "number", "bigint", "number"],
              [modelHandle, group.kind, name, BigInt(index), boundsPointer]
            ) !== 1) throw new Error("Native Routing assignment has no captured variable bounds.");
            let view = new DataView(module.HEAPU8.buffer, boundsPointer, 16);
            assignmentVariables.push({ variable: { kind: group.kind, dimensionName: group.dimensionName, index }, min: view.getBigInt64(0, !0), max: view.getBigInt64(8, !0) });
          }
        });
      } finally {
        module._free(boundsPointer);
      }
      let resourceAssignments = [], resourceBounds = allocateWasm(module, 16);
      try {
        for (let group = 0; group < (message.resourceGroups?.length ?? 0); ++group) {
          let values = { mins: [], maxs: [] };
          for (let vehicle = 0; vehicle < message.numVehicles; ++vehicle) {
            if (await ccallNumber(
              module,
              "routing_assignment_resource_bounds",
              ["number", "number", "number", "number"],
              [modelHandle, group, vehicle, resourceBounds]
            ) !== 1) throw new Error("Native Routing assignment has no resource bounds.");
            let view = new DataView(module.HEAPU8.buffer, resourceBounds, 16);
            values.mins.push(view.getBigInt64(0, !0)), values.maxs.push(view.getBigInt64(8, !0));
          }
          resourceAssignments.push(values);
        }
      } finally {
        module._free(resourceBounds);
      }
      let breakAssignments = [], breakBounds = allocateWasm(module, 48);
      try {
        for (let index = 0; index < breakCount; ++index) {
          if (!await ccallNumber(module, "routing_assignment_break_bounds", ["number", "number", "number"], [modelHandle, index, breakBounds]))
            throw new Error("Routing assignment has no break interval bounds.");
          let bounds = new BigInt64Array(module.HEAPU8.buffer, breakBounds, 6);
          breakAssignments.push({ index, performedMin: bounds[0], performedMax: bounds[1], ...bounds[1] === 0n ? {} : {
            startMin: bounds[2],
            startMax: bounds[3],
            endMin: bounds[4],
            endMax: bounds[5]
          } });
        }
      } finally {
        module._free(breakBounds);
      }
      return {
        ...breakAssignments.length ? { breakAssignments } : {},
        status,
        objectiveValue: await ccallBigInt(module, "routing_assignment_objective_value", ["number"], [modelHandle]),
        nextValues,
        vehicleValues,
        starts,
        ends,
        dimensionCumulValues,
        assignmentVariables,
        ...resourceAssignments.length ? { resourceAssignments } : {},
        dimensionCumulMins: dimensionCumulValues,
        dimensionCumulMaxs
      };
    }, solution = await readSolution(), collectedSolutions = [], count = await ccallNumber(module, "routing_collected_solution_count", ["number"], [modelHandle]);
    for (let index = 0; index < count; ++index) {
      if (!await ccallNumber(module, "routing_select_collected_solution", ["number", "number"], [modelHandle, index]))
        throw new Error("Native Routing collected solution is unavailable.");
      collectedSolutions.push(await readSolution());
    }
    return { ...metadata, solution, collectedSolutions };
  } finally {
    for (let state3 of models) await deleteRoutingModel(module, state3);
  }
}

// lib/routing/direct_executor.ts
var DirectRoutingExecutor = class {
  constructor(loadModuleImpl = loadRoutingRuntime) {
    this.loadModuleImpl = loadModuleImpl;
    this.solver = "routing";
    this.nextRequestId = 1;
    this.activeJob = null;
  }
  async load() {
    await this.module();
  }
  terminate(_reason) {
  }
  execute(operation, options) {
    if (isSingleThreadedBrowser() && operation.interruptible)
      throw new Error("Native interruption requires COOP/COEP headers. Omit the signal/interrupter and use a solver time limit for header-free execution.");
    if (this.activeJob) throw new SolverExecutorBusyError(this.solver);
    let requestId = this.nextRequestId++, state3 = { cancelled: !1, nativeRunning: !1 };
    return this.activeJob = state3, {
      requestId,
      result: this.run(requestId, operation, options).finally(() => {
        this.activeJob === state3 && (this.activeJob = null);
      }),
      cancel: async () => {
        if (this.activeJob !== state3) return;
        state3.cancelled = !0;
        let module = await this.module();
        this.activeJob === state3 && state3.nativeRunning && operation.interruptible && this.interrupt(module);
      }
    };
  }
  interrupt(module) {
    let address = module.ccall("routing_interrupt_address", "number", [], []);
    Atomics.store(module.HEAPU8, address, 1);
  }
  module() {
    return this.loadModuleImpl();
  }
  async run(requestId, operation, options) {
    let createdAt = BigInt(Date.now());
    try {
      await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.STARTING,
        createdAt
      ));
      let module = await this.module();
      await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.RUNNING,
        createdAt,
        BigInt(Date.now())
      ));
      let pendingCallbacks = /* @__PURE__ */ new Set(), callbackFailure, result = await withWasmRuntimeLock(module, async () => {
        let registry = module.__ortoolsRoutingCallbacks ?? (module.__ortoolsRoutingCallbacks = { nextId: 1, sinks: /* @__PURE__ */ new Map() }), routes = operation.request.operations.some((value) => value.type === "addRouteConstraint") || operation.request.modelQuery?.kind === 27 /* ROUTING_MODEL_QUERY_FIRST_MATCHING_PICKUP_DELIVERY_SIBLING */;
        if (routes && !options.onCallback) throw new Error("Routing callback operations require a callback handler.");
        let callbackId = operation.request.solutionEvents || operation.request.searchEntryEvents || routes ? registry.nextId++ : 0, routeCallbacks = module.__ortoolsRoutingRouteCallbacks ?? (module.__ortoolsRoutingRouteCallbacks = /* @__PURE__ */ new Map());
        routes && routeCallbacks.set(callbackId, (bytes) => {
          if (callbackFailure) return 0;
          let pointer = 0;
          try {
            let reply = options.onCallback(bytes);
            if (!(reply.length === 1 && reply[0] === 0 || reply.length === 9 && reply[0] === 1))
              throw new Error("Invalid Routing route callback reply.");
            return pointer = allocateWasm(module, reply.length + 4), new DataView(module.HEAPU8.buffer).setUint32(pointer, reply.length, !0), module.HEAPU8.set(reply, pointer + 4), pointer;
          } catch (error) {
            return pointer && module._free(pointer), callbackFailure ?? (callbackFailure = { error }), 0;
          }
        }), (operation.request.solutionEvents || operation.request.searchEntryEvents) && registry.sinks.set(callbackId, (bytes) => {
          if (callbackFailure) return;
          let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          try {
            let pending = options.onEvent(bytes.length === 0 ? { type: "searchEntered" } : {
              type: "solution",
              objectiveValue: view.getBigInt64(0, !0),
              solutionCount: view.getBigInt64(8, !0),
              unchecked: view.getBigInt64(16, !0) !== 0n
            });
            trackPendingEvent(pendingCallbacks, pending, (error) => {
              callbackFailure ?? (callbackFailure = { error });
            });
          } catch (error) {
            callbackFailure ?? (callbackFailure = { error });
          }
        });
        let state3 = this.activeJob;
        if (!state3) throw new Error("Routing solve has no active job.");
        state3.nativeRunning = !0, state3.cancelled && operation.interruptible && this.interrupt(module);
        try {
          return await solveRoutingWithModule(module, operation.request, operation.interruptible, callbackId);
        } catch (error) {
          throw callbackFailure ? callbackFailure.error : error;
        } finally {
          state3.nativeRunning = !1, callbackId && registry.sinks.delete(callbackId), routeCallbacks.delete(callbackId);
        }
      });
      if (await Promise.all(pendingCallbacks), callbackFailure) throw callbackFailure.error;
      return await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.SUCCEEDED,
        createdAt
      )), { type: "solve", ...result };
    } catch (error) {
      throw await options.onEvent(createSolverFailureEvent(
        this.solver,
        requestId,
        error instanceof Error ? error.message : String(error),
        SolverFailureKind2.INTERNAL,
        error instanceof Error ? error.stack ?? "" : ""
      )), await options.onEvent(createSolverJobStatusEvent(
        this.solver,
        requestId,
        SolverJobState2.FAILED,
        createdAt
      )), error;
    }
  }
};

// lib/routing/route_callbacks.ts
function routingRouteCallback(callbacks) {
  return (payload) => {
    if (payload.length < 4 || (payload.length - 4) % 8) throw new Error("Invalid Routing route callback payload.");
    let view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength), callback = callbacks[view.getUint32(0, !0)];
    if (!callback) throw new Error("Unknown Routing route evaluator.");
    let route = [];
    for (let offset = 4; offset < payload.length; offset += 8) route.push(toIndex(view.getBigInt64(offset, !0), "Routing route index"));
    let result = synchronousCallbackResult(callback(route), "Routing route callbacks must return synchronously.");
    if (result === null) return new Uint8Array([0]);
    let reply = new Uint8Array(9);
    return reply[0] = 1, new DataView(reply.buffer).setBigInt64(1, toInt64(result, "Routing route cost"), !0), reply;
  };
}

// lib/routing/expressions.ts
function comparisonConstraint(left, right, comparison, conditions = []) {
  if (new Set([left, right, ...conditions.flatMap((condition) => RoutingBoolExpr.from(condition).variables().map((variable) => RoutingLinearExpr.from(variable)))].flatMap((expression) => expression.terms.map((term) => term.variable.model))).size > 1) throw new Error("Variables belong to different Routing models.");
  return Object.freeze({
    type: "routingLinearConstraint",
    left,
    right,
    comparison,
    ...conditions.length ? { conditions: Object.freeze([...conditions]) } : {},
    asBool() {
      return RoutingBoolExpr.from(this);
    },
    onlyEnforceIf(...additional) {
      for (let condition of additional) RoutingBoolExpr.from(condition);
      return comparisonConstraint(left, right, comparison, [...conditions, ...additional]);
    }
  });
}
var RoutingLinearExpr = class _RoutingLinearExpr {
  constructor(terms, offset) {
    this.terms = Object.freeze(terms.map((term) => Object.freeze({ ...term }))), this.offset = toInt64(offset, "Routing expression offset"), Object.freeze(this);
  }
  static from(value) {
    if (value instanceof _RoutingLinearExpr) return value;
    if (typeof value == "number" || typeof value == "bigint") return new _RoutingLinearExpr([], toInt64(value));
    if (!value || typeof value != "object" || !value.model) throw new TypeError("Expected a Routing variable, linear expression or integer.");
    return new _RoutingLinearExpr([{ variable: value, coefficient: 1n }], 0n);
  }
  add(value) {
    let other = _RoutingLinearExpr.from(value);
    if (new Set([...this.terms, ...other.terms].map((term) => term.variable.model)).size > 1) throw new Error("Variables belong to different Routing models.");
    return new _RoutingLinearExpr([...this.terms, ...other.terms], toInt64(this.offset + other.offset, "Routing expression offset"));
  }
  sub(value) {
    return this.add(_RoutingLinearExpr.from(value).neg());
  }
  mul(value) {
    let coefficient = toInt64(value, "Routing expression multiplier");
    return new _RoutingLinearExpr(
      this.terms.map((term) => ({
        variable: term.variable,
        coefficient: toInt64(term.coefficient * coefficient, "Routing expression coefficient")
      })),
      toInt64(this.offset * coefficient, "Routing expression offset")
    );
  }
  neg() {
    return this.mul(-1);
  }
  compare(value, comparison) {
    let right = _RoutingLinearExpr.from(value);
    return comparisonConstraint(this, right, comparison);
  }
  eq(value) {
    return this.compare(value, "eq");
  }
  ne(value) {
    return this.compare(value, "ne");
  }
  le(value) {
    return this.compare(value, "le");
  }
  ge(value) {
    return this.compare(value, "ge");
  }
  lt(value) {
    return this.compare(value, "lt");
  }
  gt(value) {
    return this.compare(value, "gt");
  }
}, RoutingBoolExpr = class _RoutingBoolExpr {
  constructor(node) {
    this.node = node;
    Object.freeze(node), Object.freeze(this);
  }
  static from(value) {
    if (value instanceof _RoutingBoolExpr) return value;
    if (typeof value == "boolean") return new _RoutingBoolExpr({ kind: "constant", value });
    if (typeof value == "object" && value !== null && "type" in value && value.type === "routingLinearConstraint") {
      if (!(value.left instanceof RoutingLinearExpr) || !(value.right instanceof RoutingLinearExpr) || value.conditions?.length)
        throw new TypeError("Routing Boolean predicates and enforcement conditions must be unconditional linear comparisons.");
      return new _RoutingBoolExpr({ kind: "comparison", comparison: comparisonConstraint(value.left, value.right, value.comparison) });
    }
    if (typeof value == "object" && value !== null && "kind" in value && ["routingBoolVar", "routingActiveVar", "routingActiveVehicleVar", "routingVehicleRouteConsideredVar"].includes(value.kind))
      return new _RoutingBoolExpr({ kind: "variable", variable: value });
    throw new TypeError("Routing Boolean predicates and enforcement conditions require Boolean values, variables or unconditional linear comparisons.");
  }
  static combine(kind, values) {
    if (!values.length) throw new RangeError("Routing Boolean AND/OR requires at least one operand.");
    let operands = values.map((value) => _RoutingBoolExpr.from(value));
    if (new Set(operands.flatMap((operand) => operand.variables().map((variable) => variable.model))).size > 1) throw new Error("Variables belong to different Routing models.");
    return new _RoutingBoolExpr({ kind, operands: Object.freeze(operands) });
  }
  static and(...values) {
    return this.combine("and", values);
  }
  static or(...values) {
    return this.combine("or", values);
  }
  and(...values) {
    return _RoutingBoolExpr.and(this, ...values);
  }
  or(...values) {
    return _RoutingBoolExpr.or(this, ...values);
  }
  not() {
    return new _RoutingBoolExpr({ kind: "not", operands: Object.freeze([this]) });
  }
  variables() {
    let node = this.node;
    return node.kind === "constant" ? [] : node.kind === "variable" ? [node.variable] : node.kind === "comparison" ? [...node.comparison.left.terms, ...node.comparison.right.terms].map((term) => term.variable) : node.operands.flatMap((operand) => operand.variables());
  }
};

// lib/routing/api.ts
var breakIntervalRecords = /* @__PURE__ */ new WeakMap(), createBreakInterval, _RoutingBreakInterval = class _RoutingBreakInterval {
  constructor(model, data) {
    this.model = model;
    this.data = data;
    breakIntervalRecords.set(this, data);
  }
  get index() {
    return this.data.index;
  }
  get name() {
    return this.data.name;
  }
  get startMin() {
    return this.data.startMin;
  }
  get startMax() {
    return this.data.startMax;
  }
  get duration() {
    return this.data.duration;
  }
  get optional() {
    return this.data.optional;
  }
};
createBreakInterval = (model, data) => new _RoutingBreakInterval(model, data);
var RoutingBreakInterval = _RoutingBreakInterval;
function decorateVariable(identity, overrides = {}) {
  return Object.freeze(Object.defineProperties(identity, { ...variableMethods(identity), ...overrides }));
}
function variableMethods(identity) {
  let variable = identity, model = identity.model, domain = (options = {}) => model.inspectVariableDomain(variable, options);
  return Object.fromEntries(Object.entries({
    domain,
    min: async (options) => (await domain(options)).min,
    max: async (options) => (await domain(options)).max,
    size: async (options) => (await domain(options)).size,
    bound: async (options) => (await domain(options)).bound,
    contains: async (value, options) => (await model.inspectVariableDomain(variable, options, value)).contains === !0,
    value: async (options) => {
      let result = await domain(options);
      if (!result.bound) throw new Error("Routing variable is not bound.");
      return result.min;
    },
    setMin: (value) => model.setVariableRange(variable, value, INT64_MAX),
    setMax: (value) => model.setVariableRange(variable, INT64_MIN, value),
    setRange: (lower, upper) => model.setVariableRange(variable, lower, upper),
    setValue: (value) => model.setVariableValues(variable, [value]),
    setValues: (values) => model.setVariableValues(variable, values),
    removeValue: (value) => model.removeVariableValues(variable, [value]),
    removeValues: (values) => model.removeVariableValues(variable, values),
    removeInterval: (lower, upper) => model.removeVariableInterval(variable, lower, upper),
    add: (value) => RoutingLinearExpr.from(variable).add(value),
    sub: (value) => RoutingLinearExpr.from(variable).sub(value),
    mul: (value) => RoutingLinearExpr.from(variable).mul(value),
    neg: () => RoutingLinearExpr.from(variable).neg(),
    eq: (value) => RoutingLinearExpr.from(variable).eq(value),
    ne: (value) => RoutingLinearExpr.from(variable).ne(value),
    le: (value) => RoutingLinearExpr.from(variable).le(value),
    ge: (value) => RoutingLinearExpr.from(variable).ge(value),
    lt: (value) => RoutingLinearExpr.from(variable).lt(value),
    gt: (value) => RoutingLinearExpr.from(variable).gt(value)
  }).map(([name, method]) => [name, { value: method }]));
}
var INT32_MAX2 = 2147483647;
async function createRoutingWorker() {
  return new Worker(
    new URL("./routing/worker.js", import.meta.url),
    { type: "module", name: "ortools-executor-routing" }
  );
}
var directExecutor = new DirectRoutingExecutor(), workerExecutor = new SolverWorkerExecutor(
  routingProtocol,
  createRoutingWorker,
  !0
);
function createRoutingExecutor(selection = "auto") {
  return createResolvedExecutor(resolveExecutorConfiguration(selection));
}
function createResolvedExecutor(configuration) {
  switch (configuration.type) {
    case "direct":
      return directExecutor;
    case "worker":
      return workerExecutor;
    case "server":
      return new SolverServerExecutor(routingProtocol, configuration);
    case "cloud":
      return new CloudExecutor("routing", { test: configuration.test });
  }
}
async function findErrorInRoutingSearchParameters(parameters = {}, options = {}) {
  let encoded = encodeRoutingSearchParametersForValidation(parameters), executor = createRoutingExecutor(options.executor), result = await executeSolverJob(executor, { type: "solve", interruptible: !1, request: {
    validateSearchParameters: !0,
    searchParametersProto: encoded.proto,
    searchParameterFields: encoded.fields,
    numLocations: 0,
    numVehicles: 0,
    starts: [],
    ends: [],
    transitMatrix: new BigInt64Array(),
    transitMatrixDimension: 0,
    operations: [],
    dimensionNames: []
  } }, {
    signal: options.signal,
    onEvent: () => {
    },
    resources: { threads: 1 },
    showCloudNotice: !(executor instanceof SolverServerExecutor)
  });
  if (result.searchParameterError === void 0) throw new Error("Routing executor did not return parameter validation.");
  return result.searchParameterError;
}
var FirstSolutionStrategy = /* @__PURE__ */ ((FirstSolutionStrategy2) => (FirstSolutionStrategy2[FirstSolutionStrategy2.UNSET = 0] = "UNSET", FirstSolutionStrategy2[FirstSolutionStrategy2.AUTOMATIC = 15] = "AUTOMATIC", FirstSolutionStrategy2[FirstSolutionStrategy2.PATH_CHEAPEST_ARC = 3] = "PATH_CHEAPEST_ARC", FirstSolutionStrategy2[FirstSolutionStrategy2.PATH_MOST_CONSTRAINED_ARC = 4] = "PATH_MOST_CONSTRAINED_ARC", FirstSolutionStrategy2[FirstSolutionStrategy2.EVALUATOR_STRATEGY = 5] = "EVALUATOR_STRATEGY", FirstSolutionStrategy2[FirstSolutionStrategy2.SAVINGS = 10] = "SAVINGS", FirstSolutionStrategy2[FirstSolutionStrategy2.PARALLEL_SAVINGS = 17] = "PARALLEL_SAVINGS", FirstSolutionStrategy2[FirstSolutionStrategy2.SWEEP = 11] = "SWEEP", FirstSolutionStrategy2[FirstSolutionStrategy2.CHRISTOFIDES = 13] = "CHRISTOFIDES", FirstSolutionStrategy2[FirstSolutionStrategy2.ALL_UNPERFORMED = 6] = "ALL_UNPERFORMED", FirstSolutionStrategy2[FirstSolutionStrategy2.BEST_INSERTION = 7] = "BEST_INSERTION", FirstSolutionStrategy2[FirstSolutionStrategy2.PARALLEL_CHEAPEST_INSERTION = 8] = "PARALLEL_CHEAPEST_INSERTION", FirstSolutionStrategy2[FirstSolutionStrategy2.SEQUENTIAL_CHEAPEST_INSERTION = 14] = "SEQUENTIAL_CHEAPEST_INSERTION", FirstSolutionStrategy2[FirstSolutionStrategy2.LOCAL_CHEAPEST_INSERTION = 9] = "LOCAL_CHEAPEST_INSERTION", FirstSolutionStrategy2[FirstSolutionStrategy2.LOCAL_CHEAPEST_COST_INSERTION = 16] = "LOCAL_CHEAPEST_COST_INSERTION", FirstSolutionStrategy2[FirstSolutionStrategy2.GLOBAL_CHEAPEST_ARC = 1] = "GLOBAL_CHEAPEST_ARC", FirstSolutionStrategy2[FirstSolutionStrategy2.LOCAL_CHEAPEST_ARC = 2] = "LOCAL_CHEAPEST_ARC", FirstSolutionStrategy2[FirstSolutionStrategy2.FIRST_UNBOUND_MIN_VALUE = 12] = "FIRST_UNBOUND_MIN_VALUE", FirstSolutionStrategy2))(FirstSolutionStrategy || {}), RoutingSearchStatus = /* @__PURE__ */ ((RoutingSearchStatus2) => (RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_NOT_SOLVED = 0] = "ROUTING_NOT_SOLVED", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_SUCCESS = 1] = "ROUTING_SUCCESS", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED = 2] = "ROUTING_PARTIAL_SUCCESS_LOCAL_OPTIMUM_NOT_REACHED", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_FAIL = 3] = "ROUTING_FAIL", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_FAIL_TIMEOUT = 4] = "ROUTING_FAIL_TIMEOUT", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_INVALID = 5] = "ROUTING_INVALID", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_INFEASIBLE = 6] = "ROUTING_INFEASIBLE", RoutingSearchStatus2[RoutingSearchStatus2.ROUTING_OPTIMAL = 7] = "ROUTING_OPTIMAL", RoutingSearchStatus2))(RoutingSearchStatus || {}), PickupAndDeliveryPolicy = /* @__PURE__ */ ((PickupAndDeliveryPolicy2) => (PickupAndDeliveryPolicy2[PickupAndDeliveryPolicy2.PICKUP_AND_DELIVERY_NO_ORDER = 0] = "PICKUP_AND_DELIVERY_NO_ORDER", PickupAndDeliveryPolicy2[PickupAndDeliveryPolicy2.PICKUP_AND_DELIVERY_LIFO = 1] = "PICKUP_AND_DELIVERY_LIFO", PickupAndDeliveryPolicy2[PickupAndDeliveryPolicy2.PICKUP_AND_DELIVERY_FIFO = 2] = "PICKUP_AND_DELIVERY_FIFO", PickupAndDeliveryPolicy2))(PickupAndDeliveryPolicy || {}), VisitTypePolicy = /* @__PURE__ */ ((VisitTypePolicy2) => (VisitTypePolicy2[VisitTypePolicy2.TYPE_ADDED_TO_VEHICLE = 0] = "TYPE_ADDED_TO_VEHICLE", VisitTypePolicy2[VisitTypePolicy2.ADDED_TYPE_REMOVED_FROM_VEHICLE = 1] = "ADDED_TYPE_REMOVED_FROM_VEHICLE", VisitTypePolicy2[VisitTypePolicy2.TYPE_ON_VEHICLE_UP_TO_VISIT = 2] = "TYPE_ON_VEHICLE_UP_TO_VISIT", VisitTypePolicy2[VisitTypePolicy2.TYPE_SIMULTANEOUSLY_ADDED_AND_REMOVED = 3] = "TYPE_SIMULTANEOUSLY_ADDED_AND_REMOVED", VisitTypePolicy2))(VisitTypePolicy || {}), RoutingPrecedencePerformedConstraint = /* @__PURE__ */ ((RoutingPrecedencePerformedConstraint2) => (RoutingPrecedencePerformedConstraint2[RoutingPrecedencePerformedConstraint2.FIRST_AND_SECOND_INDEPENDENT = 0] = "FIRST_AND_SECOND_INDEPENDENT", RoutingPrecedencePerformedConstraint2[RoutingPrecedencePerformedConstraint2.SECOND_IMPLIES_FIRST = 1] = "SECOND_IMPLIES_FIRST", RoutingPrecedencePerformedConstraint2[RoutingPrecedencePerformedConstraint2.FIRST_IMPLIES_SECOND = 2] = "FIRST_IMPLIES_SECOND", RoutingPrecedencePerformedConstraint2[RoutingPrecedencePerformedConstraint2.FIRST_AND_SECOND_EQUAL = 3] = "FIRST_AND_SECOND_EQUAL", RoutingPrecedencePerformedConstraint2))(RoutingPrecedencePerformedConstraint || {}), RoutingTransitEvaluatorSign = /* @__PURE__ */ ((RoutingTransitEvaluatorSign2) => (RoutingTransitEvaluatorSign2[RoutingTransitEvaluatorSign2.UNKNOWN = 0] = "UNKNOWN", RoutingTransitEvaluatorSign2[RoutingTransitEvaluatorSign2.POSITIVE_OR_ZERO = 1] = "POSITIVE_OR_ZERO", RoutingTransitEvaluatorSign2[RoutingTransitEvaluatorSign2.NEGATIVE_OR_ZERO = 2] = "NEGATIVE_OR_ZERO", RoutingTransitEvaluatorSign2))(RoutingTransitEvaluatorSign || {}), PenaltyCostBehavior = /* @__PURE__ */ ((PenaltyCostBehavior2) => (PenaltyCostBehavior2[PenaltyCostBehavior2.PENALIZE_ONCE = 0] = "PENALIZE_ONCE", PenaltyCostBehavior2[PenaltyCostBehavior2.PENALIZE_PER_INACTIVE = 1] = "PENALIZE_PER_INACTIVE", PenaltyCostBehavior2))(PenaltyCostBehavior || {}), LocalSearchMetaheuristic = /* @__PURE__ */ ((LocalSearchMetaheuristic2) => (LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.UNSET = 0] = "UNSET", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.AUTOMATIC = 6] = "AUTOMATIC", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.GREEDY_DESCENT = 1] = "GREEDY_DESCENT", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.GUIDED_LOCAL_SEARCH = 2] = "GUIDED_LOCAL_SEARCH", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.SIMULATED_ANNEALING = 3] = "SIMULATED_ANNEALING", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.TABU_SEARCH = 4] = "TABU_SEARCH", LocalSearchMetaheuristic2[LocalSearchMetaheuristic2.GENERIC_TABU_SEARCH = 5] = "GENERIC_TABU_SEARCH", LocalSearchMetaheuristic2))(LocalSearchMetaheuristic || {}), BOOL_FALSE = 2, BOOL_TRUE = 3, BOOL_UNSPECIFIED = 0;
function defaultRoutingSearchParameters() {
  return {};
}
function defaultRoutingModelParameters() {
  return { solverParameters: { tracePropagation: !1, profileLocalSearch: !1 } };
}
var BoundCost = class {
  constructor(bound = 0n, cost = 0n) {
    this.bound = toInt64(bound, "Routing span bound"), this.cost = toInt64(cost, "Routing span cost");
  }
};
function dimensionVariable(kind, model, dimensionName, index, recordBounds) {
  let label = kind === "routingCumulVar" ? "Routing cumul" : "Routing slack", setRange = (lower, upper) => {
    let minimum = toInt64(lower, `${label} lower bound`), maximum = toInt64(upper, `${label} upper bound`);
    if (minimum > maximum) throw new RangeError(`${label} lower bound exceeds upper bound.`);
    recordBounds(index, minimum, maximum);
  };
  return decorateVariable({ kind, model, dimensionName, index }, {
    setMin: { value: (value) => setRange(value, INT64_MAX) },
    setMax: { value: (value) => setRange(INT64_MIN, value) },
    setRange: { value: setRange }
  });
}
function routingVariableKind(kind) {
  switch (kind) {
    case "routingNextVar":
      return 3 /* ROUTING_VARIABLE_NEXT */;
    case "routingCumulVar":
      return 1 /* ROUTING_VARIABLE_CUMUL */;
    case "routingSlackVar":
      return 2 /* ROUTING_VARIABLE_SLACK */;
    case "routingVehicleVar":
      return 4 /* ROUTING_VARIABLE_VEHICLE */;
    case "routingActiveVar":
      return 5 /* ROUTING_VARIABLE_ACTIVE */;
    case "routingTransitVar":
      return 6 /* ROUTING_VARIABLE_TRANSIT */;
    case "routingFixedTransitVar":
      return 7 /* ROUTING_VARIABLE_FIXED_TRANSIT */;
    case "routingActiveVehicleVar":
      return 8 /* ROUTING_VARIABLE_ACTIVE_VEHICLE */;
    case "routingVehicleRouteConsideredVar":
      return 9 /* ROUTING_VARIABLE_ROUTE_CONSIDERED */;
    case "routingExpressionVar":
      return 12 /* ROUTING_VARIABLE_EXPRESSION */;
    case "routingBoolVar":
      return 11 /* ROUTING_VARIABLE_BOOLEAN */;
    case "routingResourceVar":
      return 10 /* ROUTING_VARIABLE_RESOURCE */;
    default:
      throw new Error("Unsupported Routing variable kind.");
  }
}
var RoutingIndexManager = class {
  constructor(numLocations, numVehicles, depotOrStarts, maybeEnds) {
    this.indexToNodeMap = [];
    this.nodeToIndexMap = /* @__PURE__ */ new Map();
    this.startIndices = [];
    this.endIndices = [];
    if (this.numLocations = toIndex(numLocations, "Routing number of locations", INT32_MAX2), this.numVehicles = toIndex(numVehicles, "Routing number of vehicles", INT32_MAX2), Array.isArray(depotOrStarts)) {
      if (!Array.isArray(maybeEnds))
        throw new Error("RoutingIndexManager: starts and ends arrays must both be provided.");
      if (depotOrStarts.length !== numVehicles || maybeEnds.length !== numVehicles)
        throw new Error("RoutingIndexManager: starts and ends arrays must match numVehicles.");
      this.startNodes = depotOrStarts.map((value, index) => toIndex(value, `Routing start[${index}]`, this.numLocations - 1)), this.endNodes = maybeEnds.map((value, index) => toIndex(value, `Routing end[${index}]`, this.numLocations - 1));
    } else {
      let depot = toIndex(depotOrStarts, "Routing depot", this.numLocations - 1);
      this.startNodes = Array.from({ length: this.numVehicles }, () => depot), this.endNodes = Array.from({ length: this.numVehicles }, () => depot);
    }
    this.createIndexMapping();
  }
  get starts() {
    return [...this.startNodes];
  }
  get ends() {
    return [...this.endNodes];
  }
  get depot() {
    return this.starts[0];
  }
  indexToNode(index) {
    let node = this.indexToNodeMap[index];
    if (node === void 0) throw new Error(`RoutingIndexManager.indexToNode: index ${index} is out of range.`);
    return node;
  }
  nodeToIndex(node) {
    return this.nodeToIndexMap.get(node) ?? -1;
  }
  getNumberOfNodes() {
    return this.numLocations;
  }
  getNumberOfVehicles() {
    return this.numVehicles;
  }
  getNumberOfIndices() {
    return this.indexToNodeMap.length;
  }
  getStartIndex(vehicle) {
    return this.startIndices[vehicle];
  }
  getEndIndex(vehicle) {
    return this.endIndices[vehicle];
  }
  createIndexMapping() {
    let starts = new Set(this.starts), ends = new Set(this.ends);
    for (let node = 0; node < this.numLocations; node++)
      (starts.has(node) || !ends.has(node)) && (this.nodeToIndexMap.set(node, this.indexToNodeMap.length), this.indexToNodeMap.push(node));
    let seenStarts = /* @__PURE__ */ new Set();
    for (let start of this.starts)
      seenStarts.has(start) ? (this.startIndices.push(this.indexToNodeMap.length), this.indexToNodeMap.push(start)) : (seenStarts.add(start), this.startIndices.push(this.nodeToIndex(start)));
    for (let end of this.ends)
      this.endIndices.push(this.indexToNodeMap.length), this.indexToNodeMap.push(end);
  }
}, createRoutingDimension, _RoutingDimension = class _RoutingDimension {
  constructor(model, name, state3, record, maximumIndex, configureBreaks, configurePairLimit, inspect) {
    this.model = model;
    this.name = name;
    this.state = state3;
    this.record = record;
    this.maximumIndex = maximumIndex;
    this.configureBreaks = configureBreaks;
    this.configurePairLimit = configurePairLimit;
    this.inspect = inspect;
  }
  setPickupToDeliveryLimitFunctionForPair(limit, pairIndex) {
    this.configurePairLimit(limit, pairIndex);
  }
  hasPickupToDeliveryLimits() {
    return !!this.state.pickupToDeliveryLimits?.size;
  }
  /** Native limit for an alternative pair; an unset limit is INT64_MAX. */
  async getPickupToDeliveryLimitForPair(pairIndex, pickupAlternativeIndex, deliveryAlternativeIndex, options = {}) {
    return (await this.query(9, 0, {
      pairIndex: toIndex(pairIndex, "Routing pickup/delivery pair", INT32_MAX2),
      pickupAlternativeIndex: toIndex(pickupAlternativeIndex, "Routing pickup alternative", INT32_MAX2),
      deliveryAlternativeIndex: toIndex(deliveryAlternativeIndex, "Routing delivery alternative", INT32_MAX2)
    }, options)).value;
  }
  cumulVar(index) {
    return dimensionVariable(
      "routingCumulVar",
      this.model,
      this.name,
      toIndex(index, "Routing cumul index", this.maximumIndex),
      (index2, lower, upper) => this.record({ type: "setCumulBounds", dimensionName: this.name, index: index2, lower, upper })
    );
  }
  /** Bound waiting time at a routing index; end indices have no SlackVar. */
  slackVar(index) {
    return dimensionVariable(
      "routingSlackVar",
      this.model,
      this.name,
      toIndex(index, "Routing slack index", this.maximumIndex - this.model.vehicles()),
      (index2, lower, upper) => this.record({ type: "setSlackBounds", dimensionName: this.name, index: index2, lower, upper })
    );
  }
  /** Native transit includes fixed travel, dependent transit and slack. Ends have no transit variable. */
  transitVar(index) {
    return decorateVariable({
      kind: "routingTransitVar",
      model: this.model,
      dimensionName: this.name,
      index: toIndex(index, "Routing transit index", this.maximumIndex - this.model.vehicles())
    });
  }
  fixedTransitVar(index) {
    return decorateVariable({
      kind: "routingFixedTransitVar",
      model: this.model,
      dimensionName: this.name,
      index: toIndex(index, "Routing fixed transit index", this.maximumIndex - this.model.vehicles())
    });
  }
  setCumulVarRange(index, lower, upper) {
    this.cumulVar(index).setRange(lower, upper);
  }
  setBreakIntervalsOfVehicle(intervals, vehicle, options = {}) {
    this.configureBreaks(intervals, vehicle, options);
  }
  setBreakDistanceDurationOfVehicle(distance, duration, vehicle) {
    let exactDistance = toInt64(distance, "Routing break distance"), exactDuration = toInt64(duration, "Routing break duration");
    if (exactDistance < 0n || exactDuration < 0n) throw new RangeError("Routing break distance and duration must be nonnegative.");
    this.record({
      type: "setBreakDistanceDuration",
      dimensionName: this.name,
      vehicle: toIndex(vehicle, "Routing break vehicle", this.model.vehicles() - 1),
      distance: exactDistance,
      duration: exactDuration
    });
  }
  inspectBreaks(vehicle, options = {}) {
    return this.model.inspectBreaks(this.name, vehicle, options);
  }
  async hasBreakConstraints(options = {}) {
    return (await this.inspectBreaks(0, options)).hasBreakConstraints;
  }
  async initializedBreaks(vehicle, options) {
    let data = await this.inspectBreaks(vehicle, options);
    if (!data.hasBreakConstraints) throw new Error("Routing break constraints are not initialized.");
    return data;
  }
  async getBreakIntervalsOfVehicle(vehicle, options = {}) {
    return (await this.initializedBreaks(vehicle, options)).intervals;
  }
  async getBreakDistanceDurationOfVehicle(vehicle, options = {}) {
    return (await this.initializedBreaks(vehicle, options)).distanceDuration;
  }
  async getPreTravelEvaluatorOfVehicle(vehicle, options = {}) {
    return (await this.initializedBreaks(vehicle, options)).preTravelEvaluator;
  }
  async getPostTravelEvaluatorOfVehicle(vehicle, options = {}) {
    return (await this.initializedBreaks(vehicle, options)).postTravelEvaluator;
  }
  setSpanUpperBoundForVehicle(value, vehicle) {
    this.setDimensionValue("spanUpperBound", value, vehicle);
  }
  setSpanCostCoefficientForVehicle(value, vehicle) {
    this.setDimensionValue("spanCost", value, vehicle);
  }
  setSpanCostCoefficientForAllVehicles(value) {
    this.setDimensionValueForAllVehicles("spanCost", value);
  }
  setSlackCostCoefficientForVehicle(value, vehicle) {
    this.setDimensionValue("slackCost", value, vehicle);
  }
  setSlackCostCoefficientForAllVehicles(value) {
    this.setDimensionValueForAllVehicles("slackCost", value);
  }
  setGlobalSpanCostCoefficient(value) {
    this.setDimensionValue("globalSpanCost", value);
  }
  setDimensionValue(setting, value, vehicle) {
    var _a;
    let exact = toInt64(value, "Routing dimension value");
    if (exact < 0n) throw new RangeError("Routing dimension value must be nonnegative.");
    let vehicleIndex = setting === "globalSpanCost" ? void 0 : toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1);
    this.record({ type: "setDimensionValue", dimensionName: this.name, setting, value: exact, vehicle: vehicleIndex }), ((_a = this.state).dimensionValues ?? (_a.dimensionValues = /* @__PURE__ */ new Map())).set(`${setting}:${vehicleIndex ?? ""}`, exact);
  }
  setDimensionValueForAllVehicles(setting, value) {
    let exact = toInt64(value, "Routing dimension value");
    if (exact < 0n) throw new RangeError("Routing dimension value must be nonnegative.");
    for (let vehicle = 0; vehicle < this.model.vehicles(); ++vehicle) this.setDimensionValue(setting, exact, vehicle);
  }
  getSpanUpperBoundForVehicle(vehicle) {
    return this.dimensionValue("spanUpperBound", vehicle, INT64_MAX);
  }
  getSpanCostCoefficientForVehicle(vehicle) {
    return this.dimensionValue("spanCost", vehicle, 0n);
  }
  getSlackCostCoefficientForVehicle(vehicle) {
    return this.dimensionValue("slackCost", vehicle, 0n);
  }
  globalSpanCostCoefficient() {
    return this.dimensionValue("globalSpanCost", void 0, 0n);
  }
  dimensionValue(setting, vehicle, fallback) {
    let index = setting === "globalSpanCost" ? void 0 : toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1);
    return this.state.dimensionValues?.get(`${setting}:${index ?? ""}`) ?? fallback;
  }
  setCumulVarPiecewiseLinearCost(index, segments) {
    if (segments.length === 0) throw new RangeError("Routing piecewise cost requires at least one segment.");
    this.record({
      type: "setPiecewiseCost",
      dimensionName: this.name,
      index: BigInt(toIndex(index, "Routing piecewise cumul index", this.maximumIndex)),
      segments: segments.map((segment) => ({
        pointX: toInt64(segment.pointX),
        pointY: toInt64(segment.pointY),
        slope: toInt64(segment.slope),
        otherPointX: toInt64(segment.otherPointX)
      }))
    });
  }
  async hasCumulVarPiecewiseLinearCost(index, options = {}) {
    return (await this.query(6, index, {}, options)).hasPiecewiseLinearCost;
  }
  async getCumulVarPiecewiseLinearCost(index, options = {}) {
    let result = await this.query(6, index, {}, options);
    return result.hasPiecewiseLinearCost ? result.costSegments : null;
  }
  async getTransitValue(fromIndex, toIndexValue, vehicle, options = {}) {
    return (await this.query(0, fromIndex, {
      otherIndex: BigInt(toIndex(toIndexValue, "Routing transit destination", this.maximumIndex)),
      vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1)
    }, options)).value;
  }
  async getTransitValueFromClass(fromIndex, toIndexValue, vehicleClass, options = {}) {
    return (await this.query(1, fromIndex, {
      otherIndex: BigInt(toIndex(toIndexValue, "Routing transit destination", this.maximumIndex)),
      vehicleOrClass: toIndex(vehicleClass, "Routing dimension vehicle class", INT32_MAX2)
    }, options)).value;
  }
  async vehicleToClass(vehicle, options = {}) {
    return Number((await this.query(7, 0, { vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1) }, options)).value);
  }
  async isUnary(options = {}) {
    return (await this.query(8, 0, {}, options)).value === 1n;
  }
  /** Native sign metadata; does not evaluate every arc. */
  async areVehicleTransitsPositive(vehicle, options = {}) {
    return (await this.query(11, 0, { vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1) }, options)).value === 1n;
  }
  async getTransitEvaluatorSign(vehicle, options = {}) {
    return Number((await this.query(12, 0, { vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1) }, options)).value);
  }
  /** Query a self-dependent dimension in the supplied assignment's restored native state.
   * The current cumul and route variables must be bound; no completion is performed.
   */
  async shortestTransitionSlack(assignment, index, options = {}) {
    let snapshot = snapshotForAssignment(assignment, this.model);
    return (await this.inspect({
      dimensionName: this.name,
      kind: 13,
      index: BigInt(toIndex(index, "Routing slack index", this.maximumIndex - this.model.vehicles())),
      otherIndex: 0n,
      vehicleOrClass: 0,
      lower: 0n,
      upper: 0n
    }, options, snapshot)).value;
  }
  async getNodePrecedences(options = {}) {
    return (await this.query(10, 0, {}, options)).nodePrecedences.map(({ first, second, offset, performedConstraint }) => ({ first: Number(first), second: Number(second), offset, performedConstraint }));
  }
  addForbiddenIntervals(index, intervals) {
    let values = intervals.map((interval) => {
      let start = toInt64(interval.start), end = toInt64(interval.end);
      if (start > end) throw new RangeError("Routing forbidden interval start exceeds end.");
      return { start, end };
    });
    this.record({
      type: "addForbiddenIntervals",
      dimensionName: this.name,
      index: BigInt(toIndex(index, "Routing cumul index", this.maximumIndex)),
      intervals: values
    });
  }
  async getAllowedIntervalsInRange(index, lower, upper, options = {}) {
    return (await this.query(2, index, { lower: toInt64(lower), upper: toInt64(upper) }, options)).intervals;
  }
  async getForbiddenIntervals(index, options = {}) {
    return (await this.query(3, index, {}, options)).intervals;
  }
  async getFirstPossibleGreaterOrEqualValueForNode(index, value, options = {}) {
    return (await this.query(4, index, { lower: toInt64(value) }, options)).value;
  }
  async getLastPossibleLessOrEqualValueForNode(index, value, options = {}) {
    return (await this.query(5, index, { upper: toInt64(value) }, options)).value;
  }
  query(kind, index, values, options) {
    return this.inspect({
      dimensionName: this.name,
      kind,
      otherIndex: 0n,
      vehicleOrClass: 0,
      lower: 0n,
      upper: 0n,
      ...values,
      index: BigInt(toIndex(index, "Routing dimension index", this.maximumIndex))
    }, options);
  }
  setCumulVarSoftUpperBound(index, bound, coefficient) {
    this.setCumulSoftBound(index, bound, coefficient, !1);
  }
  setCumulVarSoftLowerBound(index, bound, coefficient) {
    this.setCumulSoftBound(index, bound, coefficient, !0);
  }
  hasCumulVarSoftUpperBound(index) {
    return this.cumulSoftBound(index, !1) !== void 0;
  }
  hasCumulVarSoftLowerBound(index) {
    return this.cumulSoftBound(index, !0) !== void 0;
  }
  getCumulVarSoftUpperBound(index, options = {}) {
    return this.model.inspectCumulSoftBound(this.name, index, !1, options);
  }
  getCumulVarSoftLowerBound(index, options = {}) {
    return this.model.inspectCumulSoftBound(this.name, index, !0, options);
  }
  getCumulVarSoftUpperBoundCoefficient(index) {
    return this.cumulSoftBound(index, !1)?.cost ?? 0n;
  }
  getCumulVarSoftLowerBoundCoefficient(index) {
    return this.cumulSoftBound(index, !0)?.cost ?? 0n;
  }
  cumulSoftBound(index, lower) {
    let routingIndex = toIndex(index, "Routing soft cumul index", this.maximumIndex);
    return (lower ? this.state.cumulSoftLowerBounds : this.state.cumulSoftUpperBounds)?.get(routingIndex);
  }
  setCumulSoftBound(index, bound, coefficient, lower) {
    var _a, _b;
    let routingIndex = toIndex(index, "Routing soft cumul index", this.maximumIndex), value = this.validatedBoundCost(bound, coefficient);
    this.record({ type: "setCumulSoftBound", dimensionName: this.name, index: routingIndex, bound: value.bound, coefficient: value.cost, lower }), (lower ? (_a = this.state).cumulSoftLowerBounds ?? (_a.cumulSoftLowerBounds = /* @__PURE__ */ new Map()) : (_b = this.state).cumulSoftUpperBounds ?? (_b.cumulSoftUpperBounds = /* @__PURE__ */ new Map())).set(routingIndex, value);
  }
  validatedBoundCost(bound, coefficient) {
    let value = new BoundCost(bound, coefficient);
    if (value.cost < 0n) throw new RangeError("Routing soft bound coefficient must be nonnegative.");
    return value;
  }
  /** Require the second routing index's cumul to be at least first + offset. */
  addNodePrecedence(first, second, offset, performedConstraint = 0 /* FIRST_AND_SECOND_INDEPENDENT */) {
    if (this.model.isEnd(first) || this.model.isEnd(second)) throw new RangeError("Routing node precedences cannot reference end indices.");
    this.record({
      type: "addNodePrecedence",
      dimensionName: this.name,
      first: toIndex(first, "Routing precedence first index", this.maximumIndex),
      second: toIndex(second, "Routing precedence second index", this.maximumIndex),
      offset: toInt64(offset),
      performedConstraint: toIndex(performedConstraint, "Routing precedence performed constraint", 3)
    });
  }
  hasSoftSpanUpperBounds() {
    return this.state.softSpanUpperBounds.size > 0;
  }
  setSoftSpanUpperBoundForVehicle(boundCost, vehicle) {
    let vehicleIndex = toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1), value = this.validatedBoundCost(boundCost.bound, boundCost.cost);
    this.record({ type: "setSoftSpanUpperBound", dimensionName: this.name, bound: value.bound, cost: value.cost, vehicle: vehicleIndex }), this.state.softSpanUpperBounds.set(vehicleIndex, value);
  }
  getSoftSpanUpperBoundForVehicle(vehicle) {
    let value = this.state.softSpanUpperBounds.get(toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1));
    if (!this.hasSoftSpanUpperBounds()) throw new Error("No soft span upper bounds have been configured.");
    return value ? new BoundCost(value.bound, value.cost) : new BoundCost(INT64_MAX, 0);
  }
  hasQuadraticCostSoftSpanUpperBounds() {
    return this.state.quadraticCostSoftSpanUpperBounds.size > 0;
  }
  setQuadraticCostSoftSpanUpperBoundForVehicle(boundCost, vehicle) {
    let vehicleIndex = toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1), value = this.validatedBoundCost(boundCost.bound, boundCost.cost);
    this.record({ type: "setQuadraticCostSoftSpanUpperBound", dimensionName: this.name, bound: value.bound, cost: value.cost, vehicle: vehicleIndex }), this.state.quadraticCostSoftSpanUpperBounds.set(vehicleIndex, value);
  }
  getQuadraticCostSoftSpanUpperBoundForVehicle(vehicle) {
    let value = this.state.quadraticCostSoftSpanUpperBounds.get(toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1));
    if (!this.hasQuadraticCostSoftSpanUpperBounds()) throw new Error("No quadratic soft span upper bounds have been configured.");
    return value ? new BoundCost(value.bound, value.cost) : new BoundCost(INT64_MAX, 0);
  }
};
createRoutingDimension = (...args) => new _RoutingDimension(...args);
var RoutingDimension = _RoutingDimension, seedStates = /* @__PURE__ */ new WeakMap(), createAssignmentSeed, _RoutingAssignmentSeed = class _RoutingAssignmentSeed {
  constructor(routing, snapshot) {
    this.routing = routing;
    let owned = structuredClone(snapshot);
    seedStates.set(this, { routing, snapshot: owned }), this.values = new Map(owned.variables.map((value) => [routingVariableKey(value.variable), value]));
  }
  value(variable) {
    let kind = 3 /* ROUTING_VARIABLE_NEXT */, index;
    if (typeof variable == "number") index = toIndex(variable, "Routing seed successor index");
    else {
      if (variable.model !== this.routing) throw new Error("Variable belongs to a different Routing model.");
      if (variable.kind !== "routingNextVar" && variable.kind !== "routingVehicleVar")
        throw new TypeError("Routing seeds contain only successor and vehicle variables.");
      variable.kind === "routingVehicleVar" && (kind = 4 /* ROUTING_VARIABLE_VEHICLE */), index = variable.index;
    }
    let value = this.values.get(routingVariableKey({ kind, index, dimensionName: "" }));
    if (!value || value.min !== value.max) throw new RangeError("Routing seed has no bound value for this variable.");
    return Number(value.min);
  }
};
createAssignmentSeed = (model, snapshot) => new _RoutingAssignmentSeed(model, snapshot);
var RoutingAssignmentSeed = _RoutingAssignmentSeed, assignmentStates = /* @__PURE__ */ new WeakMap(), createAssignment, _Assignment = class _Assignment {
  constructor(routing, result, diagnostics) {
    this.routing = routing;
    if (!result) throw new TypeError("Assignments require a native solution; use RoutingModel.solve() or readAssignmentFromRoutes().");
    this.localSearchProfile = diagnostics?.localSearchProfile ?? null, this.automaticFirstSolutionStrategy = diagnostics?.automaticFirstSolutionStrategy ?? null;
    let snapshot = structuredClone(result);
    this.result = snapshot, this.capturedVariables = new Map((snapshot.assignmentVariables ?? []).map((value) => [routingVariableKey(value.variable), value])), assignmentStates.set(this, { routing, result: snapshot });
  }
  breakInterval(interval) {
    if (!breakIntervalRecords.has(interval) || interval.model !== this.routing) throw new Error("Break interval belongs to a different Routing model.");
    let value = this.result.breakAssignments?.find((value2) => value2.index === interval.index);
    if (!value) throw new RangeError("Assignment has no value for this break interval.");
    return {
      performed: value.performedMin === value.performedMax ? value.performedMin === 1n : null,
      ...value.performedMax === 0n ? {} : { startMin: value.startMin, startMax: value.startMax, endMin: value.endMin, endMax: value.endMax }
    };
  }
  resourceIndex(vehicle, group) {
    let index = typeof group == "number" ? group : group.index;
    if (typeof group != "number" && this.routing.getResourceGroup(index) !== group) throw new Error("Routing resource group belongs to another model.");
    let data = this.result?.resourceAssignments?.[toIndex(index, "Routing resource group")];
    if (!data) throw new Error("Routing assignment has no resource data for this group.");
    if (vehicle = toIndex(vehicle, "Routing vehicle", data.mins.length - 1), data.mins[vehicle] !== data.maxs[vehicle]) throw new Error("Routing resource assignment is not bound.");
    return Number(data.mins[vehicle]);
  }
  objectiveValue() {
    return this.result.objectiveValue;
  }
  value(indexOrVar) {
    if (typeof indexOrVar == "object") {
      if (indexOrVar.model !== this.routing) throw new Error("Variable belongs to a different Routing model.");
      if (indexOrVar.kind === "routingNextVar") {
        let value3 = this.result.nextValues[indexOrVar.index];
        if (value3 === void 0) throw new RangeError("Assignment has no successor value for this index.");
        return value3;
      }
      if (indexOrVar.kind === "routingVehicleVar") {
        let value3 = this.result.vehicleValues?.[indexOrVar.index];
        if (value3 === void 0) throw new RangeError("Assignment has no vehicle value for this index.");
        return value3;
      }
      if (indexOrVar.kind === "routingActiveVar") {
        let next = this.result.nextValues[indexOrVar.index];
        if (next === void 0) throw new RangeError("Assignment has no active value for this index.");
        return +(next !== indexOrVar.index);
      }
      if (indexOrVar.kind !== "routingCumulVar") {
        let value3 = this.capturedBound(indexOrVar, "min");
        if ((indexOrVar.kind === "routingBoolVar" || indexOrVar.kind === "routingExpressionVar") && value3 !== this.capturedBound(indexOrVar, "max")) throw new Error("Routing expression assignment is not bound.");
        return value3;
      }
      let value2 = this.result.dimensionCumulValues[indexOrVar.dimensionName]?.[indexOrVar.index];
      if (value2 === void 0) throw new RangeError("Assignment has no value for this dimension index.");
      return value2;
    }
    let value = this.result.nextValues[indexOrVar];
    if (value === void 0) throw new RangeError("Assignment has no value for this index.");
    return value;
  }
  min(indexOrVar) {
    return typeof indexOrVar == "object" && (indexOrVar.kind === "routingSlackVar" || indexOrVar.kind === "routingTransitVar" || indexOrVar.kind === "routingFixedTransitVar" || indexOrVar.kind === "routingActiveVehicleVar" || indexOrVar.kind === "routingVehicleRouteConsideredVar" || indexOrVar.kind === "routingResourceVar" || indexOrVar.kind === "routingBoolVar" || indexOrVar.kind === "routingExpressionVar") ? this.capturedBound(indexOrVar, "min") : typeof indexOrVar == "object" && indexOrVar.kind === "routingCumulVar" ? this.cumulBound(indexOrVar, "min") : this.value(indexOrVar);
  }
  max(indexOrVar) {
    return typeof indexOrVar == "object" && (indexOrVar.kind === "routingSlackVar" || indexOrVar.kind === "routingTransitVar" || indexOrVar.kind === "routingFixedTransitVar" || indexOrVar.kind === "routingActiveVehicleVar" || indexOrVar.kind === "routingVehicleRouteConsideredVar" || indexOrVar.kind === "routingResourceVar" || indexOrVar.kind === "routingBoolVar" || indexOrVar.kind === "routingExpressionVar") ? this.capturedBound(indexOrVar, "max") : typeof indexOrVar == "object" && indexOrVar.kind === "routingCumulVar" ? this.cumulBound(indexOrVar, "max") : this.value(indexOrVar);
  }
  capturedBound(variable, bound) {
    if (variable.model !== this.routing) throw new Error("Variable belongs to a different Routing model.");
    if (variable.kind === "routingResourceVar") {
      let value2 = this.result?.resourceAssignments?.[variable.resourceGroup]?.[bound === "min" ? "mins" : "maxs"][variable.index];
      if (value2 === void 0) throw new RangeError("Assignment has no captured native bounds for this resource variable.");
      return Number(value2);
    }
    let reference = { kind: routingVariableKind(variable.kind), dimensionName: "dimensionName" in variable ? variable.dimensionName : "", index: variable.index }, value = this.capturedVariables.get(routingVariableKey(reference));
    if (!value) throw new RangeError("Assignment has no captured native bounds for this variable.");
    return variable.kind === "routingActiveVehicleVar" || variable.kind === "routingVehicleRouteConsideredVar" || variable.kind === "routingBoolVar" ? Number(value[bound]) : value[bound];
  }
  cumulBound(variable, bound) {
    if (variable.model !== this.routing) throw new Error("Variable belongs to a different Routing model.");
    let value = (bound === "min" ? this.result?.dimensionCumulMins : this.result?.dimensionCumulMaxs)?.[variable.dimensionName]?.[variable.index];
    if (bound === "max" && value === void 0) throw new RangeError("Assignment has no maximum for this dimension index.");
    return value ?? this.value(variable);
  }
};
createAssignment = (model, result, diagnostics) => new _Assignment(model, result, diagnostics);
var Assignment = _Assignment, RoutingResult = class {
  constructor(status, assignment, localSearchProfile = null, automaticFirstSolutionStrategy = null, collectedAssignments = [], searchStatistics = null, objectiveLowerBound = null, timeLimitReached = null) {
    this.status = status;
    this.assignment = assignment;
    this.localSearchProfile = localSearchProfile;
    this.automaticFirstSolutionStrategy = automaticFirstSolutionStrategy;
    this.collectedAssignments = collectedAssignments;
    this.searchStatistics = searchStatistics;
    this.objectiveLowerBound = objectiveLowerBound;
    this.timeLimitReached = timeLimitReached;
    this.hasSolution = assignment !== null;
  }
};
function snapshotForAssignment(assignment, routing, allowSeed = !1) {
  if (assignment instanceof RoutingAssignmentSeed) {
    if (!allowSeed) throw new TypeError("This Routing operation requires a restored assignment, not a route seed.");
    let state4 = seedStates.get(assignment);
    if (!state4 || state4.routing !== routing) throw new Error("Routing seed belongs to another model or is not registered.");
    return structuredClone(state4.snapshot);
  }
  let state3 = assignmentStates.get(assignment);
  if (!state3 || state3.routing !== routing)
    throw new Error("Routing assignment belongs to another model or is not registered.");
  let result = state3.result, variables = [...result.assignmentVariables ?? []], add = (kind, index, min, max = min, dimensionName = "", resourceGroup) => variables.push({ variable: { kind, index, dimensionName, ...resourceGroup === void 0 ? {} : { resourceGroup } }, min, max });
  for (let index = 0; index < result.nextValues.length - routing.vehicles(); ++index) add(3 /* ROUTING_VARIABLE_NEXT */, index, BigInt(result.nextValues[index]));
  result.vehicleValues?.forEach((value, index) => add(4 /* ROUTING_VARIABLE_VEHICLE */, index, BigInt(value)));
  for (let [name, values] of Object.entries(result.dimensionCumulValues))
    values.forEach((value, index) => add(
      1 /* ROUTING_VARIABLE_CUMUL */,
      index,
      result.dimensionCumulMins?.[name]?.[index] ?? value,
      result.dimensionCumulMaxs?.[name]?.[index] ?? value,
      name
    ));
  return result.resourceAssignments?.forEach((group, resourceGroup) => group.mins.forEach((min, vehicle) => add(10 /* ROUTING_VARIABLE_RESOURCE */, vehicle, min, group.maxs[vehicle], "", resourceGroup))), structuredClone({ variables, intervals: result.breakAssignments ?? [], objectiveValue: result.objectiveValue });
}
function resourceDomain(intervals) {
  return (intervals ?? [[INT64_MIN, INT64_MAX]]).flatMap((interval) => {
    if (interval.length !== 2) throw new TypeError("Routing resource domains require pairs of bounds.");
    let lower = toInt64(interval[0]), upper = toInt64(interval[1]);
    if (lower > upper) throw new RangeError("Routing resource domain lower bound exceeds its upper bound.");
    return [lower, upper];
  });
}
function resourceDimensionAttributes(data) {
  let intervals = (bounds) => {
    if (bounds.length % 2) throw new Error("Native Routing resource domain has an incomplete interval.");
    let result = [];
    for (let index = 0; index < bounds.length; index += 2) result.push([bounds[index], bounds[index + 1]]);
    return result;
  };
  return { dimensionName: data.dimensionName, startDomain: intervals(data.startDomain), endDomain: intervals(data.endDomain) };
}
var resourceGroupSnapshots = /* @__PURE__ */ new WeakMap(), createResourceGroup, _RoutingResourceGroup = class _RoutingResourceGroup {
  constructor(model, index) {
    this.model = model;
    this.index = index;
    this.data = { resources: [], requiredVehicles: [], allowedResources: [] };
    Object.defineProperty(this, "index", { writable: !1 }), resourceGroupSnapshots.set(this, () => structuredClone(this.data));
  }
  addResource(attributes, dimensionName) {
    if (!this.model.hasDimension(dimensionName)) throw new RangeError("Routing resource dimension does not exist.");
    let resource = { dimensionName, startDomain: resourceDomain(attributes.startDomain), endDomain: resourceDomain(attributes.endDomain) };
    return this.data.resources.push(resource), this.data.resources.length - 1;
  }
  size() {
    return this.data.resources.length;
  }
  notifyVehicleRequiresAResource(vehicle) {
    vehicle = this.vehicle(vehicle), this.data.requiredVehicles.includes(vehicle) || this.data.requiredVehicles.push(vehicle);
  }
  vehicleRequiresAResource(vehicle) {
    return this.data.requiredVehicles.includes(this.vehicle(vehicle));
  }
  getVehiclesRequiringAResource() {
    return [...this.data.requiredVehicles];
  }
  setAllowedResourcesForVehicle(vehicle, resources) {
    if (vehicle = this.vehicle(vehicle), !this.vehicleRequiresAResource(vehicle)) throw new Error("Vehicle must require a resource before restricting its resources.");
    if (!resources.length) throw new RangeError("Use clearAllowedResourcesForVehicle to allow all resources.");
    let values = [...new Set(resources.map((resource) => toIndex(resource, "Routing resource", this.size() - 1)))];
    this.clearAllowedResourcesForVehicle(vehicle), this.data.allowedResources.push({ vehicle, resources: values });
  }
  clearAllowedResourcesForVehicle(vehicle) {
    vehicle = this.vehicle(vehicle), this.data.allowedResources = this.data.allowedResources.filter((value) => value.vehicle !== vehicle);
  }
  getResourcesMarkedAllowedForVehicle(vehicle) {
    return vehicle = this.vehicle(vehicle), [...this.data.allowedResources.find((value) => value.vehicle === vehicle)?.resources ?? []];
  }
  isResourceAllowedForVehicle(resource, vehicle) {
    resource = toIndex(resource, "Routing resource", this.size() - 1);
    let allowed = this.getResourcesMarkedAllowedForVehicle(vehicle);
    return allowed.length === 0 || allowed.includes(resource);
  }
  inspect(options = {}) {
    return this.model.inspectResourceGroup(this, options);
  }
  async getResources(options = {}) {
    return (await this.inspect(options)).resources;
  }
  async getResource(resource, options = {}) {
    return resource = toIndex(resource, "Routing resource", this.size() - 1), (await this.inspect(options)).resources[resource];
  }
  async getResourceClassesCount(options = {}) {
    return (await this.inspect(options)).classes.length;
  }
  async getResourceIndicesInClass(resourceClass, options = {}) {
    resourceClass = toIndex(resourceClass, "Routing resource class");
    let classes = (await this.inspect(options)).classes;
    return classes[toIndex(resourceClass, "Routing resource class", classes.length - 1)].resourceIndices;
  }
  async getResourceIndicesPerClass(options = {}) {
    return (await this.inspect(options)).classes.map((resourceClass) => resourceClass.resourceIndices);
  }
  async getResourceClassIndex(resource, options = {}) {
    return (await this.getResource(resource, options)).classIndex;
  }
  async getDimensionAttributesForClass(dimensionName, resourceClass, options = {}) {
    this.model.getDimensionOrDie(dimensionName), resourceClass = toIndex(resourceClass, "Routing resource class");
    let classes = (await this.inspect(options)).classes, attributes = classes[toIndex(resourceClass, "Routing resource class", classes.length - 1)].dimensionAttributes.find((value) => value.dimensionName === dimensionName);
    if (!attributes) throw new Error("Native Routing resource inspection has no attributes for this dimension.");
    return attributes;
  }
  vehicle(vehicle) {
    return toIndex(vehicle, "Routing vehicle", this.model.vehicles() - 1);
  }
};
createResourceGroup = (model, index) => new _RoutingResourceGroup(model, index);
var RoutingResourceGroup = _RoutingResourceGroup, RoutingModel = class _RoutingModel {
  constructor(manager, parameters) {
    this.manager = manager;
    this.parameters = parameters;
    this.firstSolutionHint = null;
    this.routeEvaluators = [];
    this.primaryConstrainedDimension = "";
    this.solving = !1;
    this.arcCostEvaluatorIndex = null;
    this.vehicleArcCostEvaluators = /* @__PURE__ */ new Map();
    this.evaluatorCallbacks = /* @__PURE__ */ new Map();
    this.nextEvaluatorIndex = 1;
    this.operations = [];
    this.booleanVariablesCount = 0;
    this.integerVariablesCount = 0;
    this.resourceGroups = [];
    this.fixedVehicleCosts = /* @__PURE__ */ new Map();
    this.amortizedVehicleCosts = /* @__PURE__ */ new Map();
    this.vehiclesUsedWhenEmpty = /* @__PURE__ */ new Map();
    this.softSameVehicleConstraints = [];
    this.visitTypes = /* @__PURE__ */ new Map();
    this.numberOfVisitTypes = 0;
    this.hardTypeIncompatibilities = /* @__PURE__ */ new Map();
    this.temporalTypeIncompatibilities = /* @__PURE__ */ new Map();
    this.typeRequirements = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()];
    this.pickupDeliveryPolicies = /* @__PURE__ */ new Map();
    this.pickupDeliveryPairs = [];
    this.disjunctions = [];
    this.indexDisjunctions = /* @__PURE__ */ new Map();
    this.dimensions = /* @__PURE__ */ new Map();
    this.breakIntervals = [];
    this.unaryEvaluators = /* @__PURE__ */ new Set();
    this.stateDependentEvaluators = /* @__PURE__ */ new Map();
    this.enterSearchCallbacks = [];
    this.atSolutionCallbacks = [];
    this.lastStatus = null;
    this.parameters = parameters && structuredClone(parameters);
  }
  addResourceGroup() {
    let group = createResourceGroup(this, this.resourceGroups.length);
    return this.resourceGroups.push(group), group;
  }
  addBreakInterval(options) {
    let startMin = toInt64(options.startMin, "Routing break start minimum"), startMax = toInt64(options.startMax, "Routing break start maximum"), duration = toInt64(options.duration, "Routing break duration");
    if (startMin > startMax || duration < 0n || startMax > INT64_MAX - duration) throw new RangeError("Invalid Routing break start range or duration.");
    let data = {
      index: this.breakIntervals.length,
      startMin,
      startMax,
      duration,
      optional: options.optional ?? !1,
      name: options.name ?? ""
    };
    return this.breakIntervals.push(data), this.operations.push({ type: "addBreakInterval", ...data }), createBreakInterval(this, data);
  }
  setDimensionBreakIntervals(dimensionName, intervals, vehicle, options) {
    this.getDimensionOrDie(dimensionName);
    let indices2 = intervals.map((interval) => {
      let data = breakIntervalRecords.get(interval);
      if (!data || interval.model !== this || this.breakIntervals[data.index] !== data) throw new Error("Break interval belongs to a different Routing model or is not registered.");
      return data.index;
    });
    this.operations.push({
      type: "setBreakIntervals",
      dimensionName,
      intervals: indices2,
      vehicle: toIndex(vehicle, "Routing break vehicle", this.vehicles() - 1),
      preTravel: options.preTravelEvaluator === void 0 || options.preTravelEvaluator === -1 ? void 0 : [...this.buildTransitMatrixForEvaluator(options.preTravelEvaluator)],
      postTravel: options.postTravelEvaluator === void 0 || options.postTravelEvaluator === -1 ? void 0 : [...this.buildTransitMatrixForEvaluator(options.postTravelEvaluator)],
      preTravelHandle: options.preTravelEvaluator,
      postTravelHandle: options.postTravelEvaluator
    });
  }
  getResourceGroup(index) {
    return this.resourceGroups[toIndex(index, "Routing resource group", this.resourceGroups.length - 1)];
  }
  getResourceGroups() {
    return [...this.resourceGroups];
  }
  getDimensionResourceGroupIndices(name) {
    if (!this.hasDimension(name)) throw new RangeError("Routing resource dimension does not exist.");
    return this.resourceGroups.filter((group) => resourceGroupSnapshots.get(group)().resources.some((resource) => resource.dimensionName === name)).map((group) => group.index);
  }
  getDimensionResourceGroupIndex(name) {
    let groups = this.getDimensionResourceGroupIndices(name);
    if (groups.length !== 1) throw new Error("Routing dimension must have exactly one resource group for this query.");
    return groups[0];
  }
  registerTransitCallback(callback) {
    let evaluatorIndex = this.nextEvaluatorIndex++;
    return this.evaluatorCallbacks.set(evaluatorIndex, callback), evaluatorIndex;
  }
  setArcCostEvaluatorOfAllVehicles(evaluatorIndex) {
    this.callbackForEvaluatorIndex(evaluatorIndex), this.arcCostEvaluatorIndex = evaluatorIndex, this.vehicleArcCostEvaluators.clear();
  }
  setFirstSolutionEvaluator(evaluatorIndex) {
    this.callbackForEvaluatorIndex(evaluatorIndex), this.firstSolutionEvaluatorIndex = evaluatorIndex;
  }
  setPrimaryConstrainedDimension(dimensionName) {
    dimensionName !== "" && this.getDimensionOrDie(dimensionName), this.primaryConstrainedDimension = dimensionName;
  }
  getPrimaryConstrainedDimension() {
    return this.primaryConstrainedDimension;
  }
  setSecondaryModel(model, parameters = {}) {
    if (model === null) {
      this.secondaryModel = void 0;
      return;
    }
    if (!(model instanceof _RoutingModel)) throw new TypeError("Routing secondary model must be a RoutingModel or null.");
    for (let current = model; current; current = current.secondaryModel?.model)
      if (current === this) throw new Error("Routing secondary models must not form a cycle.");
    if (model.manager.numLocations !== this.manager.numLocations || model.manager.numVehicles !== this.manager.numVehicles || model.manager.starts.some((value, index) => value !== this.manager.starts[index]) || model.manager.ends.some((value, index) => value !== this.manager.ends[index]))
      throw new Error("Routing secondary model must use the same index-manager layout.");
    this.secondaryModel = { model, parameters: structuredClone(parameters) };
  }
  setArcCostEvaluatorOfVehicle(evaluatorIndex, vehicle) {
    toIndex(vehicle, "Routing vehicle", this.vehicles() - 1), this.callbackForEvaluatorIndex(evaluatorIndex), this.vehicleArcCostEvaluators.set(vehicle, evaluatorIndex);
  }
  async solveWithExecutor(parameters, options, initialAssignment, readAssignmentOnly = !1, workflow = {}) {
    if (this.solving) throw new Error("RoutingModel.solve() is already in progress.");
    this.solving = !0;
    try {
      return await this.executeSolve(parameters, options, initialAssignment, readAssignmentOnly, workflow);
    } finally {
      this.solving = !1;
    }
  }
  createRequest(parameters, options, initialAssignment, readAssignmentOnly = !1, callbacks = this.routeEvaluators) {
    if (options.signal?.aborted) throw createAbortError(options.signal);
    if (this.secondaryModel && (this.routeEvaluators.length || this.secondaryModel.model.routeEvaluators.length))
      throw new Error("Native Routing secondary-model optimization does not safely support whole-route callbacks.");
    let dimension = this.manager.getNumberOfIndices(), capturedCallbacks = [...callbacks], encodedParameters = encodeRoutingSearchParameters(parameters), encodedModelParameters = encodeRoutingModelParameters(this.parameters ?? {}), secondary = this.secondaryModel?.model.createRequest(this.secondaryModel.parameters, {}), ownWorkers = encodedParameters.numWorkers, threads = ownWorkers <= 0 || secondary && secondary.resources === void 0 ? void 0 : Math.max(ownWorkers, secondary?.resources?.threads ?? 1), vehicleGroups = /* @__PURE__ */ new Map();
    for (let [vehicle, evaluatorIndex] of this.vehicleArcCostEvaluators) {
      if (evaluatorIndex === this.arcCostEvaluatorIndex) continue;
      let vehicles = vehicleGroups.get(evaluatorIndex) ?? [];
      vehicles.push(vehicle), vehicleGroups.set(evaluatorIndex, vehicles);
    }
    return { request: {
      ...secondary ? { secondaryModel: secondary.request } : {},
      ...this.routeLocks ? { routeLocks: structuredClone(this.routeLocks) } : {},
      ...this.firstSolutionHint ? { firstSolutionHint: snapshotForAssignment(this.firstSolutionHint, this) } : {},
      readAssignmentOnly,
      ...this.resourceGroups.length ? { resourceGroups: this.resourceGroups.map((group) => resourceGroupSnapshots.get(group)()) } : {},
      searchEntryEvents: !!options.onEvent || this.enterSearchCallbacks.length > 0,
      solutionEvents: !!options.onEvent || this.atSolutionCallbacks.length > 0,
      trackUncheckedNeighbors: options.trackUncheckedNeighbors === !0 || this.atSolutionCallbacks.some((entry) => entry.trackUncheckedNeighbors),
      numLocations: this.manager.numLocations,
      numVehicles: this.manager.numVehicles,
      starts: [...this.manager.starts],
      ends: [...this.manager.ends],
      searchParametersProto: encodedParameters.proto,
      searchParameterFields: encodedParameters.fields,
      modelParametersProto: encodedModelParameters.proto,
      modelParameterFields: encodedModelParameters.fields,
      transitMatrix: this.buildTransitMatrix(),
      transitMatrixDimension: dimension,
      operations: structuredClone([
        ...this.operations,
        ...this.pickupToDeliveryLimitOperations(),
        ...this.firstSolutionEvaluatorIndex === void 0 ? [] : [{
          type: "setFirstSolutionEvaluator",
          transitMatrix: this.buildTransitMatrixForEvaluator(this.firstSolutionEvaluatorIndex)
        }],
        ...this.primaryConstrainedDimension === "" ? [] : [{
          type: "setPrimaryConstrainedDimension",
          dimensionName: this.primaryConstrainedDimension
        }],
        ...[...vehicleGroups].map(([evaluatorIndex, vehicles]) => ({
          type: "setArcCostEvaluatorOfVehicles",
          vehicles,
          transitMatrix: this.buildTransitMatrixForEvaluator(evaluatorIndex)
        }))
      ]),
      dimensionNames: [...this.dimensions.keys()],
      initialAssignment: initialAssignment ? {
        routes: initialAssignment.routes.map((indices2) => [...indices2]),
        ignoreInactiveIndices: initialAssignment.ignoreInactiveIndices,
        ...initialAssignment.snapshot ? { snapshot: structuredClone(initialAssignment.snapshot) } : {}
      } : void 0
    }, resources: threads === void 0 ? void 0 : { threads }, callbacks: capturedCallbacks };
  }
  async executeSolve(parameters, options, initialAssignment, readAssignmentOnly = !1, workflow = {}) {
    let prepared = this.createRequest(parameters, options, initialAssignment, readAssignmentOnly), { request } = prepared;
    Object.assign(request, structuredClone(workflow)), this.lastStatus = null;
    let response = await this.executeNative(prepared, options), ownedAssignment = (result) => {
      if (!result) return null;
      if (request.resourceGroups?.length && (result.resourceAssignments?.length !== request.resourceGroups.length || result.resourceAssignments.some((value) => value.mins.length !== request.numVehicles || value.maxs.length !== request.numVehicles)))
        throw new Error("Routing executor did not return the requested resource assignments.");
      return createAssignment(this, result, {
        localSearchProfile: response.localSearchProfile ?? null,
        automaticFirstSolutionStrategy: response.automaticFirstSolutionStrategy ?? null
      });
    };
    this.lastStatus = response.status;
    let assignment = ownedAssignment(response.solution), collectedAssignments = (response.collectedSolutions ?? []).map((result) => ownedAssignment(result)), action = request.assignmentAction ?? 0 /* SOLVE */;
    return assignment && collectedAssignments.length === 0 && !parameters.useIteratedLocalSearch && (parameters.numberOfSolutionsToCollect ?? 1) === 1 && (action === 0 /* SOLVE */ || action === 5 /* MULTIPLE_STARTS */) && collectedAssignments.push(assignment), new RoutingResult(
      response.status,
      assignment,
      response.localSearchProfile ?? null,
      response.automaticFirstSolutionStrategy ?? null,
      collectedAssignments,
      response.searchStatistics ?? null,
      response.objectiveLowerBound ?? null,
      response.timeLimitReached ?? null
    );
  }
  async executeNative({ request, resources, callbacks }, options) {
    let executor = createRoutingExecutor(options.executor), entryCallbacks = [...this.enterSearchCallbacks];
    return await executeSolverJob(
      executor,
      { type: "solve", request, interruptible: !!options.signal },
      {
        showCloudNotice: !(executor instanceof SolverServerExecutor),
        onCallback: callbacks.length ? routingRouteCallback(callbacks) : void 0,
        onEvent: async (event) => {
          if (event.type === "searchEntered")
            for (let callback of entryCallbacks) await callback();
          event.type === "solution" && await this.runAtSolutionCallbacks(event), await options.onEvent?.(event);
        },
        signal: options.signal,
        resources
      }
    );
  }
  async solveWithParameters(parameters = defaultRoutingSearchParameters(), options = {}) {
    return (await this.solveWithExecutor(parameters, options)).assignment;
  }
  async solve(options = {}) {
    let { executor: _executor, onEvent: _onEvent, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options;
    return this.solveWithExecutor(parameters, options);
  }
  status() {
    return this.lastStatus ?? 0 /* ROUTING_NOT_SOLVED */;
  }
  vehicles() {
    return this.manager.getNumberOfVehicles();
  }
  setMaximumNumberOfActiveVehicles(maximum) {
    let count = toIndex(maximum, "Routing maximum active vehicles", INT32_MAX2);
    this.operations.push({ type: "setMaximumActiveVehicles", maximum: count }), this.maximumActiveVehicles = count;
  }
  getMaximumNumberOfActiveVehicles() {
    return this.maximumActiveVehicles ?? this.vehicles();
  }
  setFixedCostOfVehicle(cost, vehicle) {
    let index = toIndex(vehicle, "Routing fixed-cost vehicle", this.vehicles() - 1), value = this.vehicleCost(cost);
    this.operations.push({ type: "setFixedVehicleCost", cost: value, vehicle: index }), this.fixedVehicleCosts.set(index, value);
  }
  setPathEnergyCostOfVehicle(force, distance, costPerUnit, vehicle) {
    this.setPathEnergyCostsOfVehicle(force, distance, 0, 0, costPerUnit, vehicle);
  }
  setPathEnergyCostsOfVehicle(force, distance, threshold, costBelow, costAbove, vehicle) {
    this.getDimensionOrDie(force), this.getDimensionOrDie(distance), this.operations.push({
      type: "setPathEnergyCosts",
      force,
      distance,
      threshold: this.vehicleCost(threshold),
      costBelow: this.vehicleCost(costBelow),
      costAbove: this.vehicleCost(costAbove),
      vehicle: toIndex(vehicle, "Routing energy-cost vehicle", this.vehicles() - 1)
    });
  }
  setFixedCostOfAllVehicles(cost) {
    let value = this.vehicleCost(cost);
    for (let vehicle = 0; vehicle < this.vehicles(); ++vehicle) this.setFixedCostOfVehicle(value, vehicle);
  }
  getFixedCostOfVehicle(vehicle) {
    return this.fixedVehicleCosts.get(toIndex(vehicle, "Routing fixed-cost vehicle", this.vehicles() - 1)) ?? 0n;
  }
  setAmortizedCostFactorsOfVehicle(linear, quadratic, vehicle) {
    let index = toIndex(vehicle, "Routing amortized-cost vehicle", this.vehicles() - 1), factors = this.amortizedFactors(linear, quadratic);
    this.operations.push({ type: "setAmortizedVehicleCosts", ...factors, vehicle: index }), this.amortizedVehicleCosts.set(index, factors);
  }
  setAmortizedCostFactorsOfAllVehicles(linear, quadratic) {
    let factors = this.amortizedFactors(linear, quadratic);
    for (let vehicle = 0; vehicle < this.vehicles(); ++vehicle) this.setAmortizedCostFactorsOfVehicle(factors.linear, factors.quadratic, vehicle);
  }
  getAmortizedLinearCostFactorOfVehicles() {
    return Array.from({ length: this.vehicles() }, (_, vehicle) => this.amortizedVehicleCosts.get(vehicle)?.linear ?? 0n);
  }
  getAmortizedQuadraticCostFactorOfVehicles() {
    return Array.from({ length: this.vehicles() }, (_, vehicle) => this.amortizedVehicleCosts.get(vehicle)?.quadratic ?? 0n);
  }
  setVehicleUsedWhenEmpty(isUsed, vehicle) {
    let index = toIndex(vehicle, "Routing empty-route vehicle", this.vehicles() - 1);
    if (typeof isUsed != "boolean") throw new TypeError("Routing empty-route usage must be a boolean.");
    this.operations.push({ type: "setVehicleUsedWhenEmpty", isUsed, vehicle: index }), this.vehiclesUsedWhenEmpty.set(index, isUsed);
  }
  isVehicleUsedWhenEmpty(vehicle) {
    return this.vehiclesUsedWhenEmpty.get(toIndex(vehicle, "Routing empty-route vehicle", this.vehicles() - 1)) ?? !1;
  }
  vehicleCost(value) {
    let cost = toInt64(value, "Routing vehicle cost");
    if (cost < 0n) throw new RangeError("Routing vehicle cost must be nonnegative.");
    return cost;
  }
  amortizedFactors(linear, quadratic) {
    let factors = { linear: this.vehicleCost(linear), quadratic: this.vehicleCost(quadratic) };
    if (factors.linear + factors.quadratic > INT64_MAX) throw new RangeError("Routing amortized cost factors must sum to a signed int64 value.");
    return factors;
  }
  start(vehicle) {
    return this.manager.getStartIndex(vehicle);
  }
  end(vehicle) {
    return this.manager.getEndIndex(vehicle);
  }
  isEnd(index) {
    return this.manager.ends.some((_, vehicle) => this.manager.getEndIndex(vehicle) === index);
  }
  registerTransitMatrix(matrix) {
    let nodes = this.manager.getNumberOfNodes();
    if (matrix.length !== nodes) throw new RangeError("Routing transit matrix must contain one row and column per node.");
    let snapshot = Array.from(matrix, (row) => {
      if (!Array.isArray(row) || row.length !== nodes) throw new RangeError("Routing transit matrix must contain one row and column per node.");
      return Array.from(row, (value) => toInt64(value));
    });
    return this.registerTransitCallback((fromIndex, toIndex2) => {
      let fromNode = this.manager.indexToNode(fromIndex), toNode = this.manager.indexToNode(toIndex2);
      return snapshot[fromNode][toNode];
    });
  }
  registerUnaryTransitCallback(callback) {
    let index = this.registerTransitCallback((fromIndex) => callback(fromIndex));
    return this.unaryEvaluators.add(index), index;
  }
  registerUnaryTransitVector(values) {
    if (values.length !== this.manager.getNumberOfNodes()) throw new RangeError("Routing transit vector must contain one value per node.");
    let snapshot = Array.from(values, (value) => toInt64(value));
    return this.registerUnaryTransitCallback((fromIndex) => snapshot[this.manager.indexToNode(fromIndex)]);
  }
  /** Register per-arc native piecewise-linear transit over [domainStart, domainEnd). */
  registerStateDependentTransitCallback(callback, options) {
    if (typeof callback != "function") throw new TypeError("Routing state-dependent callback must be a function.");
    let domainStart = toInt64(options.domainStart), domainEnd = toInt64(options.domainEnd);
    if (domainStart < 0n || domainStart >= domainEnd || domainEnd > BigInt(INT32_MAX2))
      throw new RangeError("Routing state-dependent domain must satisfy 0 <= start < end <= 2147483647.");
    let index = this.stateDependentEvaluators.size;
    return this.stateDependentEvaluators.set(index, { callback, domainStart, domainEnd }), index;
  }
  addDimensionDependentDimensionWithVehicleCapacity(transitIndices, dependentTransitIndices, baseDimension, slackMax, capacities, fixStartCumulToZero, name) {
    if (this.validateDimensionOptions(fixStartCumulToZero, name), this.dimensions.has(name)) return !1;
    if (baseDimension !== null && this.getDimensionOrDie(baseDimension), transitIndices.length !== this.vehicles() || dependentTransitIndices.length !== this.vehicles() || capacities.length !== this.vehicles())
      throw new RangeError("Routing dependent dimension requires one fixed evaluator, dependent evaluator and capacity per vehicle.");
    let slack = this.dimensionLimit(slackMax, "Routing dimension slack"), limits = Array.from(capacities, (value) => this.dimensionLimit(value, "Routing vehicle capacity")), matrices = Array.from(transitIndices, (index) => this.buildTransitMatrixForEvaluator(toIndex(index, "Routing transit evaluator"))), snapshots = /* @__PURE__ */ new Map(), dependentMatrices = dependentTransitIndices.map((index) => {
      let evaluator = this.stateDependentEvaluators.get(toIndex(index, "Routing state-dependent evaluator"));
      if (!evaluator) throw new RangeError("Routing state-dependent evaluator is unavailable.");
      let matrix = snapshots.get(index);
      if (!matrix) {
        let functions = [], dimension = this.manager.getNumberOfIndices();
        for (let from = 0; from < dimension; ++from) for (let to = 0; to < dimension; ++to) {
          let fn = synchronousCallbackResult(evaluator.callback(from, to), "Routing state-dependent transit callbacks must return synchronously.");
          functions.push({ x: Array.from(fn.x, (value) => toInt64(value)), y: Array.from(fn.y, (value) => toInt64(value)) });
        }
        matrix = { domainStart: evaluator.domainStart, domainEnd: evaluator.domainEnd, functions }, snapshots.set(index, matrix);
      }
      return matrix;
    });
    return this.addDimensionState(name), this.operations.push({
      type: "addDependentDimension",
      transitMatrices: matrices,
      ...transitIndices.some((index) => this.unaryEvaluators.has(index)) ? { unaryTransits: transitIndices.map((index) => this.unaryEvaluators.has(index)) } : {},
      dependentMatrices,
      ...baseDimension !== null ? { baseDimension } : {},
      slackMax: slack,
      capacities: limits,
      fixStartCumulToZero,
      name
    }), !0;
  }
  addDimension(transitIndex, slackMax, capacity, fixStartCumulToZero, name) {
    if (this.dimensions.has(name)) return !1;
    let operation = {
      type: "addDimension",
      transitMatrix: this.buildTransitMatrixForEvaluator(transitIndex),
      ...this.unaryEvaluators.has(transitIndex) ? { unaryTransit: !0 } : {},
      slackMax: toInt64(slackMax),
      capacity: toInt64(capacity),
      fixStartCumulToZero,
      name
    };
    return this.addDimensionState(name), this.operations.push(operation), !0;
  }
  addDimensionWithVehicleCapacity(transitIndex, slackMax, capacities, fixStartCumulToZero, name) {
    if (this.dimensions.has(name)) return !1;
    let operation = {
      type: "addDimensionWithVehicleCapacity",
      transitMatrix: this.buildTransitMatrixForEvaluator(transitIndex),
      ...this.unaryEvaluators.has(transitIndex) ? { unaryTransit: !0 } : {},
      slackMax: toInt64(slackMax),
      capacities: capacities.map((value) => toInt64(value)),
      fixStartCumulToZero,
      name
    };
    return this.addDimensionState(name), this.operations.push(operation), !0;
  }
  addDimensionWithVehicleTransits(transitIndices, slackMax, capacity, fixStartCumulToZero, name) {
    if (this.dimensions.has(name)) return !1;
    let indices2 = Array.isArray(transitIndices) ? transitIndices : [transitIndices], operation = {
      type: "addDimensionWithVehicleTransits",
      transitMatrices: indices2.map((index) => this.buildTransitMatrixForEvaluator(index)),
      ...indices2.some((index) => this.unaryEvaluators.has(index)) ? { unaryTransits: indices2.map((index) => this.unaryEvaluators.has(index)) } : {},
      slackMax: toInt64(slackMax),
      capacity: toInt64(capacity),
      fixStartCumulToZero,
      name
    };
    return this.addDimensionState(name), this.operations.push(operation), !0;
  }
  addDimensionWithVehicleTransitAndCapacity(transitIndices, slackMax, capacities, fixStartCumulToZero, name) {
    if (this.validateDimensionOptions(fixStartCumulToZero, name), this.dimensions.has(name)) return !1;
    if (transitIndices.length !== this.vehicles() || capacities.length !== this.vehicles())
      throw new RangeError("Routing dimension requires one evaluator and capacity per vehicle.");
    let slack = this.dimensionLimit(slackMax, "Routing dimension slack"), limits = Array.from(capacities, (value) => this.dimensionLimit(value, "Routing vehicle capacity")), matrices = Array.from(transitIndices, (index) => this.buildTransitMatrixForEvaluator(toIndex(index, "Routing transit evaluator")));
    return this.addDimensionState(name), this.operations.push({
      type: "addDimensionWithVehicleTransitAndCapacity",
      transitMatrices: matrices,
      slackMax: slack,
      ...transitIndices.some((index) => this.unaryEvaluators.has(index)) ? { unaryTransits: transitIndices.map((index) => this.unaryEvaluators.has(index)) } : {},
      capacities: limits,
      fixStartCumulToZero,
      name
    }), !0;
  }
  addConstantDimensionWithSlack(value, capacity, slackMax, fixStartCumulToZero, name) {
    this.validateDimensionOptions(fixStartCumulToZero, name);
    let transit = toInt64(value), limit = this.dimensionLimit(capacity, "Routing dimension capacity"), slack = this.dimensionLimit(slackMax, "Routing dimension slack"), evaluator = this.registerTransitCallback(() => transit);
    return this.addDimensionState(name) ? (this.operations.push({ type: "addConstantDimension", value: transit, capacity: limit, slackMax: slack, fixStartCumulToZero, name }), [evaluator, !0]) : [evaluator, !1];
  }
  dimensionLimit(value, label) {
    let exact = toInt64(value, label);
    if (exact < 0n) throw new RangeError(`${label} must be nonnegative.`);
    return exact;
  }
  validateDimensionOptions(fixStartCumulToZero, name) {
    if (typeof fixStartCumulToZero != "boolean") throw new TypeError("Routing fixed-start flag must be a boolean.");
    if (typeof name != "string" || name.includes("\0")) throw new TypeError("Routing dimension name must be a string without NUL.");
  }
  addConstantDimension(value, capacity, fixStartCumulToZero, name) {
    let transit = toInt64(value), limit = toInt64(capacity);
    return this.addDimensionState(name) ? (this.operations.push({ type: "addConstantDimension", value: transit, capacity: limit, fixStartCumulToZero, name }), [this.registerTransitCallback(() => transit), !0]) : [-1, !1];
  }
  addVectorDimension(values, capacity, fixStartCumulToZero, name) {
    if (values.length !== this.manager.getNumberOfNodes()) throw new RangeError("Routing dimension vector must contain one value per node.");
    let transits = values.map((item) => toInt64(item)), limit = toInt64(capacity);
    return this.addDimensionState(name) ? (this.operations.push({ type: "addVectorDimension", values: transits, capacity: limit, fixStartCumulToZero, name }), [this.registerUnaryTransitVector(transits), !0]) : [-1, !1];
  }
  addMatrixDimension(matrix, capacity, fixStartCumulToZero, name) {
    let nodes = this.manager.getNumberOfNodes();
    if (matrix.length !== nodes || matrix.some((row) => row.length !== nodes)) throw new RangeError("Routing dimension matrix must contain one row and column per node.");
    let transits = matrix.map((row) => row.map((item) => toInt64(item))), limit = toInt64(capacity);
    return this.addDimensionState(name) ? (this.operations.push({ type: "addMatrixDimension", matrix: transits, capacity: limit, fixStartCumulToZero, name }), [this.registerTransitMatrix(transits), !0]) : [-1, !1];
  }
  hasDimension(name) {
    return this.dimensions.has(name);
  }
  getAllDimensionNames() {
    let encoder = new TextEncoder();
    return [...this.dimensions.keys()].map((name) => ({ name, bytes: encoder.encode(name) })).sort((a, b) => {
      for (let i = 0; i < Math.min(a.bytes.length, b.bytes.length); ++i)
        if (a.bytes[i] !== b.bytes[i]) return a.bytes[i] - b.bytes[i];
      return a.bytes.length - b.bytes.length;
    }).map((entry) => entry.name);
  }
  getDimensions() {
    return [...this.dimensions.keys()].map((name) => this.getDimensionOrDie(name));
  }
  getDimensionOrDie(name) {
    let state3 = this.dimensions.get(name);
    if (!state3)
      throw new Error(`RoutingModel.getDimensionOrDie: unknown dimension '${name}'.`);
    return createRoutingDimension(
      this,
      name,
      state3,
      (operation) => this.operations.push(operation),
      this.manager.getNumberOfIndices() - 1,
      (intervals, vehicle, options) => this.setDimensionBreakIntervals(name, intervals, vehicle, options),
      (limit, pairIndex) => {
        if (pairIndex = toIndex(pairIndex, "Routing pickup/delivery pair", this.pickupDeliveryPairs.length - 1), typeof limit != "function") throw new TypeError("Routing pickup/delivery limit must be a function.");
        (state3.pickupToDeliveryLimits ?? (state3.pickupToDeliveryLimits = /* @__PURE__ */ new Map())).set(pairIndex, limit);
      },
      (query, options, assignment) => this.inspectDimension(query, options, assignment)
    );
  }
  /** Replace eligible vehicles for an index; an empty list allows every vehicle.
   * Optional nodes may still be dropped.
   */
  setAllowedVehiclesForIndex(vehicleIds, index) {
    let routingIndex = toIndex(index, "Routing eligibility index", this.manager.getNumberOfIndices() - 1), vehicles = Array.from(vehicleIds, (vehicle) => toIndex(vehicle, "Routing eligible vehicle", this.vehicles() - 1));
    this.operations.push({ type: "setAllowedVehiclesForIndex", vehicles, index: routingIndex });
  }
  addDisjunction(indices2, penalty, maxCardinality, penaltyCostBehavior) {
    if (indices2.length === 0) throw new RangeError("Routing disjunction cannot be empty.");
    let snapshot = Array.from(indices2, (index) => {
      let value = toIndex(index, "Routing disjunction index", this.manager.getNumberOfIndices() - this.vehicles() - 1);
      for (let vehicle = 0; vehicle < this.vehicles(); ++vehicle)
        if (value === this.manager.getStartIndex(vehicle)) throw new RangeError("Routing disjunction cannot include a vehicle start.");
      return value;
    }), maximum = maxCardinality === void 0 ? void 0 : toInt64(maxCardinality, "Routing disjunction cardinality");
    if (maximum !== void 0 && maximum < 1n) throw new RangeError("Routing disjunction cardinality must be positive.");
    let behavior = penaltyCostBehavior === void 0 ? void 0 : toIndex(penaltyCostBehavior, "Routing disjunction penalty behavior", 1), cost = penalty === void 0 ? void 0 : toInt64(penalty);
    this.operations.push({
      type: "addDisjunction",
      indices: snapshot,
      penalty: cost,
      ...maximum === void 0 ? {} : { maxCardinality: maximum },
      ...behavior === void 0 ? {} : { penaltyCostBehavior: behavior }
    });
    let id = this.disjunctions.length;
    this.disjunctions.push({
      penalty: cost ?? -1n,
      penaltyCostBehavior: behavior ?? 0 /* PENALIZE_ONCE */,
      size: snapshot.length
    });
    for (let index of snapshot) {
      let memberships = this.indexDisjunctions.get(index) ?? [];
      memberships.push(id), this.indexDisjunctions.set(index, memberships);
    }
    return id;
  }
  /** Return disjunction IDs containing this routing node index, preserving duplicate memberships. */
  getDisjunctionIndices(index) {
    let value = toIndex(index, "Routing disjunction node index", this.manager.getNumberOfIndices() - this.vehicles() - 1);
    return [...this.indexDisjunctions.get(value) ?? []];
  }
  disjunction(index) {
    return this.disjunctions[toIndex(index, "Routing disjunction ID", this.disjunctions.length - 1)];
  }
  getDisjunctionPenalty(index) {
    return this.disjunction(index).penalty;
  }
  async getDisjunctionMaxCardinality(index, options = {}) {
    return this.disjunction(index), (await this.inspectModel(
      21 /* ROUTING_MODEL_QUERY_DISJUNCTION_MAX_CARDINALITY */,
      { index: BigInt(index) },
      options
    )).value;
  }
  getDisjunctionPenaltyCostBehavior(index) {
    return this.disjunction(index).penaltyCostBehavior;
  }
  getNumberOfDisjunctions() {
    return this.disjunctions.length;
  }
  /** Native sorted pairs whose visits each belong to exactly one disjunction. */
  async getPerfectBinaryDisjunctions(options = {}) {
    return (await this.inspectModel(23 /* ROUTING_MODEL_QUERY_PERFECT_BINARY_DISJUNCTIONS */, {}, options)).groups.map((pair) => {
      if (pair.length !== 2) throw new Error("Native Routing executor returned an invalid disjunction pair.");
      return [pair[0], pair[1]];
    });
  }
  /** Native visit count excluding starts, ends and pickup/delivery alternatives. */
  async getNumOfSingletonNodes(options = {}) {
    return Number((await this.inspectModel(24 /* ROUTING_MODEL_QUERY_SINGLETON_NODES */, {}, options)).value);
  }
  /** Explicit allowed-vehicle configuration, not a complete feasibility check. */
  async isVehicleAllowedForIndex(vehicle, index, options = {}) {
    return (await this.inspectModel(25 /* ROUTING_MODEL_QUERY_VEHICLE_ALLOWED */, {
      vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.vehicles() - 1),
      index: BigInt(toIndex(index, "Routing eligibility index", this.manager.getNumberOfIndices() - this.vehicles() - 1))
    }, options)).value === 1n;
  }
  /** Native construction cost; preserves the int64-maximum route-closing sentinel. */
  async getArcCostForFirstSolution(fromIndex, toIndexValue, options = {}) {
    return (await this.inspectModel(26 /* ROUTING_MODEL_QUERY_FIRST_SOLUTION_ARC_COST */, {
      index: BigInt(toIndex(fromIndex, "Routing first-solution arc origin", this.manager.getNumberOfIndices() - this.vehicles() - 1)),
      otherIndex: BigInt(toIndex(toIndexValue, "Routing first-solution arc destination", this.manager.getNumberOfIndices() - 1))
    }, options)).value;
  }
  /** Native inspection tests the -1 sentinel specifically, rather than every negative penalty. */
  hasMandatoryDisjunctions() {
    return this.disjunctions.some((value) => value.penalty === -1n);
  }
  async hasMaxCardinalityConstrainedDisjunctions(options = {}) {
    return (await this.inspectModel(
      22 /* ROUTING_MODEL_QUERY_HAS_MAX_CARDINALITY_CONSTRAINED_DISJUNCTIONS */,
      {},
      options
    )).value === 1n;
  }
  /** Explicitly ignore disjunctions whose active variables are already fixed to zero at this construction point. */
  ignoreDisjunctionsAlreadyForcedToZero() {
    this.operations.push({ type: "ignoreDisjunctionsAlreadyForcedToZero" });
  }
  addSoftSameVehicleConstraint(indices2, cost) {
    let snapshot = Array.from(indices2, (index) => toIndex(index, "Routing soft same-vehicle index", this.manager.getNumberOfIndices() - this.vehicles() - 1)), value = this.vehicleCost(cost);
    snapshot.length !== 0 && (this.operations.push({ type: "addSoftSameVehicleConstraint", indices: snapshot, cost: value }), this.softSameVehicleConstraints.push({ indices: snapshot, cost: value }));
  }
  getNumberOfSoftSameVehicleConstraints() {
    return this.softSameVehicleConstraints.length;
  }
  getSoftSameVehicleIndices(index) {
    return [...this.softSameVehicleConstraints[toIndex(index, "Routing soft same-vehicle constraint", this.softSameVehicleConstraints.length - 1)].indices];
  }
  getSoftSameVehicleCost(index) {
    return this.softSameVehicleConstraints[toIndex(index, "Routing soft same-vehicle constraint", this.softSameVehicleConstraints.length - 1)].cost;
  }
  setPickupAndDeliveryPolicyOfVehicle(policy, vehicle) {
    let index = toIndex(vehicle, "Routing pickup/delivery vehicle", this.vehicles() - 1), value = toIndex(policy, "Routing pickup/delivery policy", 2 /* PICKUP_AND_DELIVERY_FIFO */);
    this.operations.push({ type: "setPickupDeliveryPolicy", policy: value, vehicle: index }), this.pickupDeliveryPolicies.set(index, value);
  }
  setPickupAndDeliveryPolicyOfAllVehicles(policy) {
    let value = toIndex(policy, "Routing pickup/delivery policy", 2 /* PICKUP_AND_DELIVERY_FIFO */);
    for (let vehicle = 0; vehicle < this.vehicles(); ++vehicle) this.setPickupAndDeliveryPolicyOfVehicle(value, vehicle);
  }
  getPickupAndDeliveryPolicyOfVehicle(vehicle) {
    return this.pickupDeliveryPolicies.get(toIndex(vehicle, "Routing pickup/delivery vehicle", this.vehicles() - 1)) ?? 0 /* PICKUP_AND_DELIVERY_NO_ORDER */;
  }
  /** Copy native route variables to this model without validating or solving a schedule. */
  async transferAssignmentFrom(assignment, options = {}) {
    let state3 = assignmentStates.get(assignment);
    if (!state3) throw new Error("Routing source assignment is not registered.");
    let sourceModel = state3.routing;
    if (sourceModel.manager.numLocations !== this.manager.numLocations || sourceModel.vehicles() !== this.vehicles() || sourceModel.manager.starts.some((value, index) => value !== this.manager.starts[index]) || sourceModel.manager.ends.some((value, index) => value !== this.manager.ends[index]))
      throw new Error("Routing assignment transfer requires the same index-manager layout.");
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.assignmentTransfer = {
      nextValues: state3.result.nextValues.slice(0, sourceModel.manager.getNumberOfIndices() - sourceModel.vehicles()),
      vehicleValues: [...state3.result.vehicleValues ?? []]
    };
    let snapshot = (await this.inspectNative(prepared, options)).assignmentSeed;
    if (!snapshot) throw new Error("Native Routing executor did not return an assignment seed.");
    return createAssignmentSeed(this, snapshot);
  }
  async solveFromAssignmentWithParameters(assignment, parameters, options = {}) {
    return (await this.solveWithExecutor(
      parameters,
      options,
      { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this, !0) }
    )).assignment;
  }
  async restoreAssignment(assignment, options = {}) {
    let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options;
    return (await this.solveWithExecutor(
      parameters,
      options,
      { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this, !0) },
      !0
    )).assignment;
  }
  async solveFromAssignmentsWithParameters(assignments, parameters = {}, options = {}) {
    return await this.solveWithExecutor(parameters, options, void 0, !1, {
      assignmentAction: 5 /* MULTIPLE_STARTS */,
      candidateAssignments: Array.from(assignments, (assignment) => snapshotForAssignment(assignment, this, !0))
    });
  }
  async fastSolveFromAssignmentWithParameters(assignment, parameters = {}, checkSolutionInCp = !0, options = {}) {
    return await this.solveWithExecutor(
      parameters,
      options,
      { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this) },
      !1,
      { assignmentAction: 4 /* FAST_SOLVE */, checkSolutionInCp }
    );
  }
  async packCumulsOfOptimizerDimensionsFromAssignment(assignment, durationLimitSeconds, options = {}) {
    if (typeof durationLimitSeconds != "number" || Number.isNaN(durationLimitSeconds)) throw new RangeError("Routing packing duration must be a number other than NaN.");
    let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options, result = await this.solveWithExecutor(
      parameters,
      options,
      { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this) },
      !1,
      { assignmentAction: 1 /* PACK */, packingDurationSeconds: durationLimitSeconds }
    );
    if (result.timeLimitReached === null) throw new Error("Native Routing executor did not return the packing time-limit flag.");
    return { assignment: result.assignment, timeLimitReached: result.timeLimitReached };
  }
  async compactAssignment(assignment, options = {}) {
    return await this.compactNativeAssignment(assignment, !1, options);
  }
  async compactAndCheckAssignment(assignment, options = {}) {
    return await this.compactNativeAssignment(assignment, !0, options);
  }
  async compactNativeAssignment(assignment, check, options) {
    let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options;
    return (await this.solveWithExecutor(
      parameters,
      options,
      { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this) },
      !1,
      { assignmentAction: check ? 3 /* COMPACT_AND_CHECK */ : 2 /* COMPACT */ }
    )).assignment;
  }
  async computeLowerBound(options = {}) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.assignmentAction = 6 /* LOWER_BOUND */;
    let result = await this.inspectNative(prepared, options);
    if (result.computedLowerBound === void 0) throw new Error("Native Routing executor did not return the computed lower bound.");
    return result.computedLowerBound;
  }
  async checkIfAssignmentIsFeasible(assignment, callAtSolutionMonitors = !1, options = {}) {
    if (typeof callAtSolutionMonitors != "boolean") throw new TypeError("Routing monitor option must be a boolean.");
    if (this.solving) throw new Error("RoutingModel.solve() is already in progress.");
    this.solving = !0;
    try {
      let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options, prepared = this.createRequest(
        parameters,
        options,
        { routes: [], ignoreInactiveIndices: !1, snapshot: snapshotForAssignment(assignment, this, !0) }
      ), { request } = prepared;
      request.assignmentAction = 7 /* CHECK_FEASIBILITY */, request.callAtSolutionMonitors = callAtSolutionMonitors;
      let response = await this.executeNative(prepared, options);
      if (response.assignmentFeasible === void 0) throw new Error("Native Routing executor did not return assignment feasibility.");
      return response.assignmentFeasible;
    } finally {
      this.solving = !1;
    }
  }
  async inspectCumulOptimizers(options) {
    let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options, prepared = this.createRequest(parameters, options), { request } = prepared;
    request.inspectCumulOptimizers = !0;
    let data = (await this.inspectNative(prepared, options)).cumulOptimizers;
    if (!data) throw new Error("Native Routing executor did not return cumul optimizer inspection.");
    return data;
  }
  async hasGlobalCumulOptimizer(dimensionName, options = {}) {
    return this.getDimensionOrDie(dimensionName), (await this.inspectCumulOptimizers(options)).globalDimensions.includes(dimensionName);
  }
  async hasLocalCumulOptimizer(dimensionName, options = {}) {
    return this.getDimensionOrDie(dimensionName), (await this.inspectCumulOptimizers(options)).localDimensions.includes(dimensionName);
  }
  async getDimensionsWithGlobalCumulOptimizers(options = {}) {
    return (await this.inspectCumulOptimizers(options)).globalDimensions.map((name) => this.getDimensionOrDie(name));
  }
  async getDimensionsWithLocalCumulOptimizers(options = {}) {
    return (await this.inspectCumulOptimizers(options)).localDimensions.map((name) => this.getDimensionOrDie(name));
  }
  setFirstSolutionHint(assignment) {
    assignment !== null && snapshotForAssignment(assignment, this), this.firstSolutionHint = assignment;
  }
  getFirstSolutionHint() {
    return this.firstSolutionHint;
  }
  addRouteConstraint(evaluator, costsAreHomogeneousAcrossVehicles = !1) {
    if (typeof evaluator != "function" || typeof costsAreHomogeneousAcrossVehicles != "boolean") throw new TypeError("Routing route constraint requires a callback and Boolean cost-homogeneity flag.");
    this.operations.push({ type: "addRouteConstraint", evaluator: this.routeEvaluators.length, costsAreHomogeneousAcrossVehicles }), this.routeEvaluators.push(evaluator);
  }
  async getRouteCost(route, options = {}) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.routeCostQuery = route.map((index) => toIndex(index, "Routing route index", this.manager.getNumberOfIndices() - 1));
    let result = await this.inspectNative(prepared, options);
    if (result.routeCost === void 0) throw new Error("Native Routing executor did not return route cost.");
    return result.routeCost;
  }
  /** Return the first native pickup/delivery counterpart accepted by the synchronous predicate. */
  async getFirstMatchingPickupDeliverySibling(index, predicate, options = {}) {
    if (typeof predicate != "function") throw new TypeError("Routing sibling lookup requires a predicate.");
    let callbacks = [...this.routeEvaluators], evaluator = callbacks.length;
    callbacks.push((indices2) => {
      if (indices2.length !== 1) throw new Error("Invalid Routing sibling predicate payload.");
      let matches = synchronousCallbackResult(predicate(indices2[0]), "Routing sibling predicates must return synchronously.");
      if (typeof matches != "boolean") throw new TypeError("Routing sibling predicate must return a Boolean synchronously.");
      return matches ? 1n : 0n;
    });
    let result = await this.inspectModel(27 /* ROUTING_MODEL_QUERY_FIRST_MATCHING_PICKUP_DELIVERY_SIBLING */, {
      index: BigInt(toIndex(index, "Routing pickup/delivery index", this.manager.getNumberOfIndices() - this.vehicles() - 1)),
      predicateEvaluator: evaluator
    }, options, callbacks);
    return result.value === -1n ? null : toIndex(result.value, "Native Routing sibling index", this.manager.getNumberOfIndices() - 1);
  }
  async inspectPickupDelivery(index, options) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.pickupDeliveryInspectionIndex = toIndex(index, "Routing pickup/delivery index", this.manager.getNumberOfIndices() - this.vehicles() - 1);
    let data = (await this.inspectNative(prepared, options)).pickupDeliveryInspection;
    if (!data) throw new Error("Native Routing executor did not return pickup/delivery inspection.");
    return data;
  }
  async getPickupPosition(index, options = {}) {
    return (await this.inspectPickupDelivery(index, options)).pickup ?? null;
  }
  async getDeliveryPosition(index, options = {}) {
    return (await this.inspectPickupDelivery(index, options)).delivery ?? null;
  }
  async isPickup(index, options = {}) {
    return (await this.inspectPickupDelivery(index, options)).isPickup;
  }
  async isDelivery(index, options = {}) {
    return (await this.inspectPickupDelivery(index, options)).isDelivery;
  }
  async inspectBreaks(dimensionName, vehicle, options = {}) {
    this.getDimensionOrDie(dimensionName);
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.breakInspection = { dimensionName, vehicle: toIndex(vehicle, "Routing break vehicle", this.vehicles() - 1) };
    let data = (await this.inspectNative(prepared, options)).breakConfiguration;
    if (!data) throw new Error("Native Routing executor did not return break configuration.");
    return { ...data, intervals: data.intervals.map((index) => createBreakInterval(this, this.breakIntervals[toIndex(index, "Routing break interval", this.breakIntervals.length - 1)])) };
  }
  async applyLocksToAllVehicles(routes, closeRoutes, options = {}) {
    this.routeLocks = { routes: routes.map((route, vehicle) => route.map((index, position) => toIndex(index, `Routing lock ${vehicle} index ${position}`, this.manager.getNumberOfIndices() - 1))), closeRoutes };
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.inspectPreAssignment = !0;
    let result = await this.inspectNative(prepared, options);
    if (result.locksApplied === void 0) throw new Error("Native Routing executor did not report lock application.");
    return result.locksApplied;
  }
  async inspectPreAssignment(options = {}) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.inspectPreAssignment = !0;
    let data = (await this.inspectNative(prepared, options)).preAssignment;
    if (!data) throw new Error("Native Routing executor did not return preassignment data.");
    return { nextValues: new Map(Object.entries(data).map(([index, next]) => [Number(index), next])) };
  }
  /** Restore routes with native feasibility checks; infeasible routes return null.
   * ignoreInactiveIndices skips nodes forced inactive by the native model. It
   * does not allow omitting mandatory nodes. Pass executor options and await.
   */
  async readAssignmentFromRoutes(routes, ignoreInactiveIndices, options = {}) {
    let { executor: _executor, onEvent: _event, signal: _signal, trackUncheckedNeighbors: _unchecked, ...parameters } = options;
    return (await this.solveWithExecutor(parameters, options, {
      routes: routes.map((route, vehicle) => route.map((index, position) => toIndex(index, `Routing route ${vehicle} index ${position}`, this.manager.getNumberOfIndices() - 1))),
      ignoreInactiveIndices
    }, !0)).assignment;
  }
  setVisitType(index, type, policy) {
    let node = toIndex(index, "Routing visit-type index", this.manager.getNumberOfIndices() - this.vehicles() - 1), kind = toInt64(type, "Routing visit type");
    if (kind < -1n || kind >= BigInt(INT32_MAX2)) throw new RangeError("Routing visit type must be -1 or a nonnegative int32 below INT32_MAX.");
    let value = toIndex(policy, "Routing visit-type policy", 3 /* TYPE_SIMULTANEOUSLY_ADDED_AND_REMOVED */);
    this.operations.push({ type: "setVisitType", index: node, visitType: Number(kind), policy: value }), this.visitTypes.set(node, { type: Number(kind), policy: value }), this.numberOfVisitTypes = Math.max(this.numberOfVisitTypes, Number(kind) + 1);
  }
  getVisitType(index) {
    return this.visitTypes.get(toIndex(index, "Routing visit-type index", this.manager.getNumberOfIndices() - 1))?.type ?? -1;
  }
  getVisitTypePolicy(index) {
    return this.visitTypes.get(toIndex(index, "Routing visit-type index", this.manager.getNumberOfIndices() - 1))?.policy ?? 0 /* TYPE_ADDED_TO_VEHICLE */;
  }
  getNumberOfVisitTypes() {
    return this.numberOfVisitTypes;
  }
  visitTypeIndex(type) {
    return toIndex(type, "Routing visit type", this.numberOfVisitTypes - 1);
  }
  getSingleNodesOfType(type, options = {}) {
    return this.inspectModel(
      10 /* ROUTING_MODEL_QUERY_SINGLE_NODES_OF_TYPE */,
      { vehicleOrClass: this.visitTypeIndex(type) },
      options
    ).then((result) => result.indices);
  }
  getPairIndicesOfType(type, options = {}) {
    return this.inspectModel(
      11 /* ROUTING_MODEL_QUERY_PAIR_INDICES_OF_TYPE */,
      { vehicleOrClass: this.visitTypeIndex(type) },
      options
    ).then((result) => result.indices);
  }
  addTypeIncompatibility(type1, type2, operation, incompatibilities) {
    let first = this.visitTypeIndex(type1), second = this.visitTypeIndex(type2);
    this.operations.push({ type: operation, type1: first, type2: second });
    for (let [type, other] of [[first, second], [second, first]]) {
      let incompatible = incompatibilities.get(type) ?? /* @__PURE__ */ new Set();
      incompatible.add(other), incompatibilities.set(type, incompatible);
    }
  }
  addHardTypeIncompatibility(type1, type2) {
    this.addTypeIncompatibility(type1, type2, "addHardTypeIncompatibility", this.hardTypeIncompatibilities);
  }
  getHardTypeIncompatibilitiesOfType(type) {
    return [...this.hardTypeIncompatibilities.get(this.visitTypeIndex(type)) ?? []].sort((a, b) => a - b);
  }
  hasHardTypeIncompatibilities() {
    return this.hardTypeIncompatibilities.size > 0;
  }
  /** Forbid simultaneous presence; types may share a route after removal. */
  addTemporalTypeIncompatibility(type1, type2) {
    this.addTypeIncompatibility(type1, type2, "addTemporalTypeIncompatibility", this.temporalTypeIncompatibilities);
  }
  getTemporalTypeIncompatibilitiesOfType(type) {
    return [...this.temporalTypeIncompatibilities.get(this.visitTypeIndex(type)) ?? []].sort((a, b) => a - b);
  }
  hasTemporalTypeIncompatibilities() {
    return this.temporalTypeIncompatibilities.size > 0;
  }
  addTypeRequirement(kind, dependentType, requiredTypeAlternatives) {
    let dependent = this.visitTypeIndex(dependentType), alternatives = [...new Set(Array.from(requiredTypeAlternatives, (type) => this.visitTypeIndex(type)))].sort((a, b) => a - b);
    if (this.operations.push({ type: "addTypeRequirement", kind, dependentType: dependent, requiredTypeAlternatives: alternatives }), alternatives.length === 0) return;
    let requirements = this.typeRequirements[kind].get(dependent) ?? [];
    requirements.push(alternatives), this.typeRequirements[kind].set(dependent, requirements);
  }
  getTypeRequirements(kind, type) {
    return (this.typeRequirements[kind].get(this.visitTypeIndex(type)) ?? []).map((alternatives) => [...alternatives]);
  }
  /** Each call requires at least one alternative on the same route. */
  addSameVehicleRequiredTypeAlternatives(dependentType, alternatives) {
    this.addTypeRequirement(0 /* SAME_VEHICLE */, dependentType, alternatives);
  }
  addRequiredTypeAlternativesWhenAddingType(dependentType, alternatives) {
    this.addTypeRequirement(1 /* WHEN_ADDING */, dependentType, alternatives);
  }
  addRequiredTypeAlternativesWhenRemovingType(dependentType, alternatives) {
    this.addTypeRequirement(2 /* WHEN_REMOVING */, dependentType, alternatives);
  }
  getSameVehicleRequiredTypeAlternativesOfType(type) {
    return this.getTypeRequirements(0 /* SAME_VEHICLE */, type);
  }
  getRequiredTypeAlternativesWhenAddingType(type) {
    return this.getTypeRequirements(1 /* WHEN_ADDING */, type);
  }
  getRequiredTypeAlternativesWhenRemovingType(type) {
    return this.getTypeRequirements(2 /* WHEN_REMOVING */, type);
  }
  hasSameVehicleTypeRequirements() {
    return this.typeRequirements[0 /* SAME_VEHICLE */].size > 0;
  }
  hasTemporalTypeRequirements() {
    return this.typeRequirements[1 /* WHEN_ADDING */].size > 0 || this.typeRequirements[2 /* WHEN_REMOVING */].size > 0;
  }
  hasTypeRegulations() {
    return this.hasHardTypeIncompatibilities() || this.hasTemporalTypeIncompatibilities() || this.hasSameVehicleTypeRequirements() || this.hasTemporalTypeRequirements();
  }
  addPickupAndDelivery(pickup, delivery) {
    let maximum = this.manager.getNumberOfIndices() - this.vehicles() - 1;
    return this.operations.push({
      type: "addPickupAndDelivery",
      pickup: toIndex(pickup, "Routing pickup index", maximum),
      delivery: toIndex(delivery, "Routing delivery index", maximum)
    }), this.pickupDeliveryPairs.push({ pickups: 1, deliveries: 1 }) - 1;
  }
  addPickupAndDeliverySets(pickupDisjunction, deliveryDisjunction) {
    pickupDisjunction = toIndex(pickupDisjunction, "Routing pickup disjunction", this.disjunctions.length - 1), deliveryDisjunction = toIndex(deliveryDisjunction, "Routing delivery disjunction", this.disjunctions.length - 1);
    let pickups = this.disjunction(pickupDisjunction).size, deliveries = this.disjunction(deliveryDisjunction).size;
    return this.operations.push({ type: "addPickupAndDeliverySets", pickupDisjunction, deliveryDisjunction }), this.pickupDeliveryPairs.push({ pickups, deliveries }) - 1;
  }
  addEnterSearchCallback(callback) {
    if (typeof callback != "function") throw new TypeError("Routing search-entry callback must be a function.");
    this.enterSearchCallbacks.push(callback);
  }
  addAtSolutionCallback(callback, trackUncheckedNeighbors = !1) {
    this.atSolutionCallbacks.push({ callback, trackUncheckedNeighbors });
  }
  /** Add native linear or Boolean constraints, validating the whole batch before recording it. */
  addConstraints(...constraints) {
    let operations = constraints.map((constraint) => this.solverConstraintOperation(constraint));
    this.operations.push(...operations);
  }
  /** An editable copy of the model parameter overrides submitted to native OR-Tools. */
  getModelParameters() {
    return structuredClone(this.parameters ?? {});
  }
  addVariableMinimizedByFinalizer(variable) {
    this.addFinalizer(variable, 1 /* ROUTING_FINALIZER_MINIMIZE */);
  }
  addVariableMaximizedByFinalizer(variable) {
    this.addFinalizer(variable, 2 /* ROUTING_FINALIZER_MAXIMIZE */);
  }
  addWeightedVariableMinimizedByFinalizer(variable, weight) {
    this.addFinalizer(variable, 1 /* ROUTING_FINALIZER_MINIMIZE */, 0n, weight);
  }
  addWeightedVariableMaximizedByFinalizer(variable, weight) {
    this.addFinalizer(variable, 2 /* ROUTING_FINALIZER_MAXIMIZE */, 0n, weight);
  }
  addVariableTargetToFinalizer(variable, target) {
    this.addFinalizer(variable, 3 /* ROUTING_FINALIZER_TARGET */, target);
  }
  addWeightedVariableTargetToFinalizer(variable, target, weight) {
    this.addFinalizer(variable, 3 /* ROUTING_FINALIZER_TARGET */, target, weight);
  }
  variableReference(variable) {
    let variableKind, dimensionName = "", index, maximum = this.manager.getNumberOfIndices() - 1;
    if (typeof variable == "number")
      variableKind = 3 /* ROUTING_VARIABLE_NEXT */, index = toIndex(variable, "Routing finalizer successor index", maximum - this.vehicles());
    else {
      if (!variable || variable.model !== this) throw new Error("Variable belongs to a different Routing model.");
      variableKind = routingVariableKind(variable.kind);
      let includesEnds = variable.kind === "routingCumulVar" || variable.kind === "routingVehicleVar", maximumVariableIndex = variable.kind === "routingExpressionVar" ? this.integerVariablesCount - 1 : variable.kind === "routingBoolVar" ? this.booleanVariablesCount - 1 : variable.kind === "routingActiveVehicleVar" || variable.kind === "routingVehicleRouteConsideredVar" || variable.kind === "routingResourceVar" ? this.vehicles() - 1 : maximum - (includesEnds ? 0 : this.vehicles());
      index = toIndex(variable.index, "Routing variable index", maximumVariableIndex), (variable.kind === "routingCumulVar" || variable.kind === "routingSlackVar" || variable.kind === "routingTransitVar" || variable.kind === "routingFixedTransitVar") && (dimensionName = variable.dimensionName, this.getDimensionOrDie(dimensionName));
    }
    return {
      kind: variableKind,
      dimensionName,
      index,
      ...typeof variable != "number" && variable.kind === "routingResourceVar" ? { resourceGroup: this.getResourceGroup(variable.resourceGroup).index } : {}
    };
  }
  addFinalizer(variable, kind, target = 0n, weight) {
    let reference = this.variableReference(variable), exactTarget = toInt64(target, "Routing finalizer target"), exactWeight = weight === void 0 ? void 0 : toInt64(weight, "Routing finalizer weight");
    this.operations.push({
      type: "addFinalizer",
      variableKind: reference.kind,
      dimensionName: reference.dimensionName,
      index: reference.index,
      ...reference.resourceGroup === void 0 ? {} : { resourceGroup: reference.resourceGroup },
      kind,
      target: exactTarget,
      ...exactWeight === void 0 ? {} : { weight: exactWeight }
    });
  }
  /** Fix a successor routing index. End indices have no successor variable. */
  setNextValue(index, successor) {
    this.setNextValues(index, [successor]);
  }
  /** Intersect a successor domain; omitted successors are forbidden.
   * Values are routing indices, including ends. Self means an optional node is
   * unperformed. Empty or conflicting domains produce no solution.
   */
  setNextValues(index, successors) {
    let maximum = this.manager.getNumberOfIndices() - 1, routingIndex = toIndex(index, "Routing successor variable index", maximum - this.vehicles()), values = Array.from(successors, (value) => toIndex(value, "Routing successor value", maximum));
    this.operations.push({ type: "setNextValues", index: routingIndex, values });
  }
  /**
   * @deprecated Use nextVarHandle(index) for a validated, model-bound successor
   * variable. This method returns the numeric index unchanged.
   */
  nextVar(index) {
    return index;
  }
  nextVarHandle(index) {
    let variable = {
      kind: "routingNextVar",
      model: this,
      index: toIndex(index, "Routing successor index", this.manager.getNumberOfIndices() - this.vehicles() - 1)
    };
    return decorateVariable(variable);
  }
  activeVar(index) {
    let variable = {
      kind: "routingActiveVar",
      model: this,
      index: toIndex(index, "Routing active index", this.manager.getNumberOfIndices() - this.vehicles() - 1)
    };
    return decorateVariable(variable);
  }
  /** Native activity uses vehicle IDs and is zero for empty routes, even when they incur costs. */
  activeVehicleVar(vehicle) {
    return decorateVariable({
      kind: "routingActiveVehicleVar",
      model: this,
      index: toIndex(vehicle, "Routing active vehicle", this.vehicles() - 1)
    });
  }
  /** Native route consideration includes empty routes marked as used for costs and constraints. */
  vehicleRouteConsideredVar(vehicle) {
    return decorateVariable({
      kind: "routingVehicleRouteConsideredVar",
      model: this,
      index: toIndex(vehicle, "Routing route considered vehicle", this.vehicles() - 1)
    });
  }
  resourceVar(vehicle, group) {
    let resourceGroup = this.getResourceGroup(typeof group == "number" ? group : group.index);
    if (typeof group != "number" && group !== resourceGroup) throw new Error("Routing resource group belongs to another model.");
    return decorateVariable({
      kind: "routingResourceVar",
      model: this,
      index: toIndex(vehicle, "Routing resource vehicle", this.vehicles() - 1),
      resourceGroup: resourceGroup.index
    });
  }
  vehicleVar(index) {
    let variable = {
      kind: "routingVehicleVar",
      model: this,
      index: toIndex(index, "Routing vehicle index", this.manager.getNumberOfIndices() - 1)
    };
    return decorateVariable(variable);
  }
  setVariableRange(variable, lower, upper) {
    let reference = this.variableReference(variable), minimum = toInt64(lower), maximum = toInt64(upper);
    if (minimum > maximum) throw new RangeError("Routing variable lower bound exceeds upper bound.");
    this.operations.push({
      type: "modifyDomain",
      variable: reference,
      action: 1 /* ROUTING_DOMAIN_RANGE */,
      lower: minimum,
      upper: maximum,
      values: []
    });
  }
  setVariableValues(variable, values) {
    let reference = this.variableReference(variable), exact = Array.from(values, (value) => toInt64(value));
    if (reference.kind === 5 /* ROUTING_VARIABLE_ACTIVE */)
      this.operations.push({ type: "setActiveValues", index: reference.index, values: exact.map((value) => toIndex(value, "Routing active domain value", 1)) });
    else if (reference.kind === 4 /* ROUTING_VARIABLE_VEHICLE */) {
      let vehicles = exact.map((value) => {
        if (value < -1n || value >= BigInt(this.vehicles())) throw new RangeError("Routing vehicle domain values must be -1 or a valid vehicle ID.");
        return Number(value);
      });
      this.operations.push({ type: "setVehicleValues", index: reference.index, values: vehicles });
    } else reference.kind === 3 /* ROUTING_VARIABLE_NEXT */ ? this.setNextValues(reference.index, exact.map((value) => toIndex(value, "Routing successor value", this.manager.getNumberOfIndices() - 1))) : this.operations.push({ type: "modifyDomain", variable: reference, action: 2 /* ROUTING_DOMAIN_VALUES */, lower: 0n, upper: 0n, values: exact });
  }
  removeVariableValues(variable, values) {
    this.operations.push({
      type: "modifyDomain",
      variable: this.variableReference(variable),
      action: 4 /* ROUTING_DOMAIN_REMOVE_VALUES */,
      lower: 0n,
      upper: 0n,
      values: Array.from(values, (value) => toInt64(value))
    });
  }
  removeVariableInterval(variable, lower, upper) {
    let reference = this.variableReference(variable), minimum = toInt64(lower), maximum = toInt64(upper);
    if (minimum > maximum) throw new RangeError("Routing removal lower bound exceeds upper bound.");
    this.operations.push({
      type: "modifyDomain",
      variable: reference,
      action: 3 /* ROUTING_DOMAIN_REMOVE_INTERVAL */,
      lower: minimum,
      upper: maximum,
      values: []
    });
  }
  async inspectVariableDomain(variable, options = {}, containsValue) {
    let reference = this.variableReference(variable), probe = containsValue === void 0 ? void 0 : toInt64(containsValue), prepared = this.createRequest({}, options), { request } = prepared;
    request.domainQueries = [{ variable: reference, ...probe === void 0 ? {} : { containsValue: probe } }];
    let result = (await this.inspectNative(prepared, options)).domainResults?.[0];
    if (!result || probe !== void 0 && result.contains === void 0) throw new Error("Routing executor returned no native variable domain or membership answer.");
    return result;
  }
  product(left, right) {
    return this.integerExpression(1, [left, right]);
  }
  abs(value) {
    return this.integerExpression(2, [value]);
  }
  min(...values) {
    return this.integerExpression(3, values);
  }
  max(...values) {
    return this.integerExpression(4, values);
  }
  integerExpression(kind, values) {
    if (!values.length) throw new RangeError("Routing minimum/maximum requires at least one operand.");
    let operands = values.map((value) => this.linearExpression(RoutingLinearExpr.from(value))), index = this.integerVariablesCount++;
    return this.operations.push({ type: "addIntegerExpression", index, kind, operands }), decorateVariable({ kind: "routingExpressionVar", model: this, index });
  }
  reify(predicate) {
    let expression = this.booleanExpression(RoutingBoolExpr.from(predicate)), index = this.booleanVariablesCount++;
    return this.operations.push({ type: "addBooleanVariable", index, expression }), decorateVariable({ kind: "routingBoolVar", model: this, index });
  }
  booleanExpression(expression) {
    let node = expression.node;
    if (node.kind === "constant") return { kind: "constant", value: node.value };
    if (node.kind === "variable") return { kind: "variable", variable: this.variableReference(node.variable) };
    if (node.kind === "comparison") {
      let comparison = node.comparison;
      if (comparison.conditions?.length) throw new TypeError("Routing Boolean predicates must be unconditional linear comparisons.");
      let kind = { eq: 1, ne: 2, le: 3, ge: 4, lt: 5, gt: 6 }[comparison.comparison];
      if (!kind) throw new Error("Unsupported Routing comparison.");
      return { kind: "comparison", comparison: { left: this.linearExpression(comparison.left), right: this.linearExpression(comparison.right), comparison: kind } };
    }
    return { kind: node.kind, operands: node.operands.map((operand) => this.booleanExpression(operand)) };
  }
  linearExpression(expression) {
    if (!(expression instanceof RoutingLinearExpr)) throw new TypeError("Expected a Routing linear expression.");
    return { terms: expression.terms.map((term) => ({ variable: this.variableReference(term.variable), coefficient: toInt64(term.coefficient) })), offset: toInt64(expression.offset) };
  }
  solverConstraintOperation(constraint) {
    if (constraint instanceof RoutingBoolExpr || typeof constraint == "boolean" || constraint && typeof constraint == "object" && "kind" in constraint && ["routingBoolVar", "routingActiveVar", "routingActiveVehicleVar", "routingVehicleRouteConsideredVar"].includes(String(constraint.kind))) return { type: "addBooleanConstraint", expression: this.booleanExpression(RoutingBoolExpr.from(constraint)) };
    if (constraint && typeof constraint == "object" && constraint.type === "routingLinearConstraint") {
      let linear = constraint, encodeComparison = (value) => {
        if (!value || value.type !== "routingLinearConstraint") throw new TypeError("Expected a Routing linear comparison.");
        let comparison = { eq: 1, ne: 2, le: 3, ge: 4, lt: 5, gt: 6 }[value.comparison];
        if (!comparison) throw new Error("Unsupported Routing comparison.");
        return { left: this.linearExpression(value.left), right: this.linearExpression(value.right), comparison };
      }, conditions = [], booleanConditions = [];
      for (let condition of linear.conditions ?? []) {
        let predicate = RoutingBoolExpr.from(condition);
        predicate.node.kind === "comparison" ? conditions.push(encodeComparison(predicate.node.comparison)) : booleanConditions.push(this.booleanExpression(predicate));
      }
      return {
        type: "addLinearConstraint",
        ...encodeComparison(linear),
        ...conditions.length ? { conditions } : {},
        ...booleanConditions.length ? { booleanConditions } : {}
      };
    }
    throw new Error("RoutingModel.addConstraints: unsupported constraint.");
  }
  async getArcCostForVehicle(fromIndex, toIndexValue, vehicle, options = {}) {
    let maximum = this.manager.getNumberOfIndices() - 1, from = toIndex(fromIndex, "Routing from index", maximum), to = toIndex(toIndexValue, "Routing to index", maximum);
    if (!Number.isInteger(vehicle) || vehicle < -1 || vehicle >= this.vehicles()) throw new RangeError("Invalid Routing vehicle.");
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.arcCostQueries = [{ fromIndex: BigInt(from), toIndex: BigInt(to), vehicle }];
    let response = await this.inspectNative(prepared, options);
    if (response.arcCosts?.[0] === void 0) throw new Error("Routing executor returned no native arc cost.");
    return response.arcCosts[0];
  }
  async getVehicleClassIndexOfVehicle(vehicle, options = {}) {
    return Number((await this.inspectModel(
      12 /* ROUTING_MODEL_QUERY_VEHICLE_CLASS */,
      { vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.vehicles() - 1) },
      options
    )).value);
  }
  async getVehicleClassesCount(options = {}) {
    return Number((await this.inspectModel(13 /* ROUTING_MODEL_QUERY_VEHICLE_CLASSES_COUNT */, {}, options)).value);
  }
  async getVehicleOfClass(vehicleClass, options = {}) {
    return Number((await this.inspectModel(
      14 /* ROUTING_MODEL_QUERY_VEHICLE_OF_CLASS */,
      { vehicleOrClass: toIndex(vehicleClass, "Routing vehicle class", INT32_MAX2) },
      options
    )).value);
  }
  async getVisitTypeComponents(options = {}) {
    return (await this.inspectModel(15 /* ROUTING_MODEL_QUERY_VISIT_TYPE_COMPONENTS */, {}, options)).groups;
  }
  async getTopologicallySortedVisitTypes(options = {}) {
    return (await this.inspectModel(16 /* ROUTING_MODEL_QUERY_SORTED_VISIT_TYPES */, {}, options)).groups;
  }
  async getSameVehicleIndicesOfIndex(index, options = {}) {
    return (await this.inspectModel(
      17 /* ROUTING_MODEL_QUERY_SAME_VEHICLE_INDICES */,
      { index: BigInt(toIndex(index, "Routing same-vehicle index", this.manager.getNumberOfIndices() - this.vehicles() - 1)) },
      options
    )).indices;
  }
  async getVehiclesOfSameClass(startEndIndex, options = {}) {
    let index = toIndex(startEndIndex, "Routing start/end index", this.manager.getNumberOfIndices() - 1);
    return (await this.inspectModel(18 /* ROUTING_MODEL_QUERY_VEHICLES_OF_SAME_CLASS */, { index: BigInt(index) }, options)).indices;
  }
  async getSameVehicleClassArcs(fromIndex, toIndexValue, options = {}) {
    let maximum = this.manager.getNumberOfIndices() - 1;
    return (await this.inspectModel(
      19 /* ROUTING_MODEL_QUERY_SAME_VEHICLE_CLASS_ARCS */,
      { index: BigInt(toIndex(fromIndex, "Routing from index", maximum)), otherIndex: BigInt(toIndex(toIndexValue, "Routing to index", maximum)) },
      options
    )).groups;
  }
  async getTopologicallySortedNodePrecedences(options = {}) {
    return (await this.inspectModel(20 /* ROUTING_MODEL_QUERY_SORTED_NODE_PRECEDENCES */, {}, options)).precedenceGroups;
  }
  async getCostClassIndexOfVehicle(vehicle, options = {}) {
    return Number((await this.inspectModel(
      0 /* ROUTING_MODEL_QUERY_VEHICLE_COST_CLASS */,
      { vehicleOrClass: toIndex(vehicle, "Routing vehicle", this.vehicles() - 1) },
      options
    )).value);
  }
  async hasVehicleWithCostClassIndex(costClass, options = {}) {
    return (await this.inspectModel(
      1 /* ROUTING_MODEL_QUERY_HAS_VEHICLE_COST_CLASS */,
      { vehicleOrClass: toIndex(costClass, "Routing cost class", INT32_MAX2) },
      options
    )).value === 1n;
  }
  async getCostClassesCount(options = {}) {
    return Number((await this.inspectModel(2 /* ROUTING_MODEL_QUERY_COST_CLASSES_COUNT */, {}, options)).value);
  }
  async getNonZeroCostClassesCount(options = {}) {
    return Number((await this.inspectModel(3 /* ROUTING_MODEL_QUERY_NONZERO_COST_CLASSES_COUNT */, {}, options)).value);
  }
  async costsAreHomogeneousAcrossVehicles(options = {}) {
    return (await this.inspectModel(4 /* ROUTING_MODEL_QUERY_HOMOGENEOUS_COSTS */, {}, options)).value === 1n;
  }
  /** Whether native Routing detects a vehicle/node matching problem. */
  async isMatchingModel(options = {}) {
    return (await this.inspectModel(29 /* ROUTING_MODEL_QUERY_IS_MATCHING_MODEL */, {}, options)).value === 1n;
  }
  /** Native route coupling for the supplied search parameters and model configuration. */
  async areRoutesInterdependent(parameters = {}, options = {}) {
    return (await this.inspectModel(
      30 /* ROUTING_MODEL_QUERY_ROUTES_INTERDEPENDENT */,
      {},
      options,
      this.routeEvaluators,
      parameters
    )).value === 1n;
  }
  /** Native construction-time arc preference, using the selected primary dimension. */
  async arcIsMoreConstrainedThanArc(from, to1, to2, options = {}) {
    let maximum = this.manager.getNumberOfIndices() - 1;
    return (await this.inspectModel(28 /* ROUTING_MODEL_QUERY_ARC_MORE_CONSTRAINED */, {
      index: BigInt(toIndex(from, "Routing arc source", maximum - this.vehicles())),
      otherIndex: BigInt(toIndex(to1, "Routing first destination", maximum)),
      thirdIndex: BigInt(toIndex(to2, "Routing second destination", maximum))
    }, options)).value === 1n;
  }
  async getArcCostForClass(fromIndex, toIndexValue, costClass, options = {}) {
    let maximum = this.manager.getNumberOfIndices() - 1, index = toIndex(fromIndex, "Routing from index", maximum), otherIndex = toIndex(toIndexValue, "Routing to index", maximum);
    if (this.isEnd(index) && index !== otherIndex) throw new RangeError("A Routing end index cannot start an arc.");
    return (await this.inspectModel(
      5 /* ROUTING_MODEL_QUERY_ARC_COST_FOR_CLASS */,
      { index: BigInt(index), otherIndex: BigInt(otherIndex), vehicleOrClass: toIndex(costClass, "Routing cost class", INT32_MAX2) },
      options
    )).value;
  }
  async unperformedPenalty(index, options = {}) {
    return (await this.inspectModel(
      6 /* ROUTING_MODEL_QUERY_UNPERFORMED_PENALTY */,
      { index: BigInt(toIndex(index, "Routing penalty index", this.manager.getNumberOfIndices() - this.vehicles() - 1)) },
      options
    )).value;
  }
  async unperformedPenaltyOrValue(defaultValue, index, options = {}) {
    return (await this.inspectModel(
      7 /* ROUTING_MODEL_QUERY_UNPERFORMED_PENALTY_OR_VALUE */,
      {
        index: BigInt(toIndex(index, "Routing penalty index", this.manager.getNumberOfIndices() - this.vehicles() - 1)),
        defaultValue: toInt64(defaultValue, "Routing default penalty")
      },
      options
    )).value;
  }
  getUnaryDimensions(options = {}) {
    return this.classifiedDimensions(8 /* ROUTING_MODEL_QUERY_UNARY_DIMENSIONS */, options);
  }
  getDimensionsWithSoftOrSpanCosts(options = {}) {
    return this.classifiedDimensions(9 /* ROUTING_MODEL_QUERY_SOFT_OR_SPAN_DIMENSIONS */, options);
  }
  async classifiedDimensions(kind, options) {
    let dimensions = this.getDimensions();
    return (await this.inspectModel(kind, {}, options)).dimensionIndices.map((index) => dimensions[toIndex(index, "Native Routing dimension index", dimensions.length - 1)]);
  }
  async inspectModel(kind, values, options, callbacks = this.routeEvaluators, parameters = {}) {
    let prepared = this.createRequest(parameters, options, void 0, !1, callbacks), { request } = prepared;
    request.modelQuery = { kind, index: 0n, otherIndex: 0n, vehicleOrClass: 0, defaultValue: 0n, ...values };
    let result = (await this.inspectNative(prepared, options)).modelInspection;
    if (!result || (kind < 8 /* ROUTING_MODEL_QUERY_UNARY_DIMENSIONS */ || kind >= 12 /* ROUTING_MODEL_QUERY_VEHICLE_CLASS */ && kind <= 14 /* ROUTING_MODEL_QUERY_VEHICLE_OF_CLASS */ || kind === 21 /* ROUTING_MODEL_QUERY_DISJUNCTION_MAX_CARDINALITY */ || kind === 22 /* ROUTING_MODEL_QUERY_HAS_MAX_CARDINALITY_CONSTRAINED_DISJUNCTIONS */ || kind >= 24 /* ROUTING_MODEL_QUERY_SINGLETON_NODES */) && result.value === void 0)
      throw new Error("Native Routing executor did not return model inspection.");
    return result;
  }
  async inspectCumulSoftBound(dimensionName, index, lower, options = {}) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.domainQueries = [{ variable: this.variableReference(this.getDimensionOrDie(dimensionName).cumulVar(index)), softLowerBound: lower }];
    let bound = (await this.inspectNative(prepared, options)).domainResults?.[0]?.softBound;
    if (bound === void 0) throw new Error("Routing executor returned no native soft bound.");
    return bound;
  }
  async inspectResourceGroup(group, options = {}) {
    if (this.getResourceGroup(group.index) !== group) throw new Error("Routing resource group belongs to another model.");
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.resourceInspectionGroup = group.index;
    let data = (await this.inspectNative(prepared, options)).resourceInspection;
    if (!data) throw new Error("Native Routing executor did not return resource inspection data.");
    return {
      affectedDimensions: [...data.affectedDimensions],
      resources: data.resources.map((resource) => ({ classIndex: resource.classIndex, dimensionAttributes: resource.dimensionAttributes.map(resourceDimensionAttributes) })),
      classes: data.classes.map((resourceClass) => ({ resourceIndices: [...resourceClass.resourceIndices], dimensionAttributes: resourceClass.dimensionAttributes.map(resourceDimensionAttributes) }))
    };
  }
  /** Select variables for native GENERIC_TABU_SEARCH; null restores its default. */
  setTabuVars(variables) {
    this.operations.push({ type: "setTabuVars", variables: variables === null ? null : variables.map((variable) => {
      if (typeof variable == "number") throw new TypeError("Routing tabu selection requires variable handles.");
      return this.variableReference(variable);
    }) });
  }
  /** Points are in routing-index order, including duplicate starts and ends. */
  setSweepArranger(points) {
    if (points.length !== this.manager.getNumberOfIndices()) throw new RangeError("Routing sweep requires one point per routing index.");
    let copied = points.map(({ x, y }) => {
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < -2147483648 || x > INT32_MAX2 || y < -2147483648 || y > INT32_MAX2)
        throw new RangeError("Routing sweep coordinates must fit int32.");
      return { x, y };
    });
    this.operations.push({ type: "setSweepArranger", points: copied });
  }
  addOrderedActivityGroup(disjunctions) {
    this.operations.push({ type: "addOrderedActivityGroup", disjunctions: disjunctions.map((index) => toIndex(index, "Routing ordered-activity disjunction", this.disjunctions.length - 1)) });
  }
  getOrderedActivityGroups() {
    return this.operations.flatMap((operation) => operation.type === "addOrderedActivityGroup" && operation.disjunctions.length > 1 ? [[...operation.disjunctions]] : []);
  }
  addSameActivityGroup(indices2) {
    this.operations.push({ type: "addSameActivityGroup", indices: indices2.map((index) => toIndex(index, "Routing activity-group index", this.manager.getNumberOfIndices() - this.vehicles() - 1)) });
  }
  async inspectActivityGroups(options = {}) {
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.inspectActivityGroups = !0;
    let data = (await this.inspectNative(prepared, options)).activityGroups;
    if (!data) throw new Error("Native Routing executor did not return activity groups.");
    return { groups: [...data.groups], members: data.members.map((indices2) => [...indices2]) };
  }
  async inspectDimension(query, options = {}, assignment) {
    this.getDimensionOrDie(query.dimensionName);
    let prepared = this.createRequest({}, options), { request } = prepared;
    request.dimensionQuery = query, assignment && (request.initialAssignment = { routes: [], ignoreInactiveIndices: !1, snapshot: assignment });
    let result = (await this.inspectNative(prepared, options)).dimensionInspection;
    if (!result || [0, 1, 4, 5, 7, 8, 9, 11, 12, 13].includes(query.kind) && result.value === void 0)
      throw new Error("Native Routing executor did not return dimension inspection.");
    return result;
  }
  async inspectNative({ request, resources, callbacks }, options) {
    request.solutionEvents = !1;
    let executor = createRoutingExecutor(options.executor);
    return executeSolverJob(executor, { type: "solve", request, interruptible: !1 }, {
      onCallback: callbacks.length ? routingRouteCallback(callbacks) : void 0,
      signal: options.signal,
      onEvent: () => {
      },
      resources,
      showCloudNotice: !(executor instanceof SolverServerExecutor)
    });
  }
  addDimensionState(name) {
    return this.dimensions.has(name) ? !1 : (this.dimensions.set(name, {
      softSpanUpperBounds: /* @__PURE__ */ new Map(),
      quadraticCostSoftSpanUpperBounds: /* @__PURE__ */ new Map()
    }), !0);
  }
  pickupToDeliveryLimitOperations() {
    let operations = [];
    for (let [dimensionName, state3] of this.dimensions)
      for (let [pairIndex, limit] of state3.pickupToDeliveryLimits ?? []) {
        let { pickups, deliveries } = this.pickupDeliveryPairs[pairIndex], limits = [];
        for (let pickup = 0; pickup < pickups; ++pickup)
          for (let delivery = 0; delivery < deliveries; ++delivery) {
            let value = synchronousCallbackResult(limit(pickup, delivery), "Routing pickup/delivery limit callbacks must return synchronously.");
            limits.push(toInt64(value, "Routing pickup/delivery limit"));
          }
        operations.push({ type: "setPickupToDeliveryLimits", dimensionName, pairIndex, limits });
      }
    return operations;
  }
  callbackForEvaluator() {
    return this.arcCostEvaluatorIndex === null ? () => 0 : this.callbackForEvaluatorIndex(this.arcCostEvaluatorIndex);
  }
  callbackForEvaluatorIndex(evaluatorIndex) {
    let callback = this.evaluatorCallbacks.get(evaluatorIndex);
    if (!callback)
      throw new Error(`RoutingModel: evaluator ${evaluatorIndex} is unavailable.`);
    return callback;
  }
  buildTransitMatrix() {
    let callback = this.callbackForEvaluator();
    return this.buildTransitMatrixFromCallback(callback);
  }
  buildTransitMatrixForEvaluator(evaluatorIndex) {
    return this.buildTransitMatrixFromCallback(this.callbackForEvaluatorIndex(evaluatorIndex));
  }
  buildTransitMatrixFromCallback(callback) {
    let dimension = this.manager.getNumberOfIndices(), matrix = new BigInt64Array(dimension * dimension);
    for (let from = 0; from < dimension; from++)
      for (let to = 0; to < dimension; to++) {
        let value = synchronousCallbackResult(callback(from, to), "Routing transit callbacks must return synchronously.");
        matrix[from * dimension + to] = toInt64(value);
      }
    return matrix;
  }
  async runAtSolutionCallbacks(event) {
    for (let entry of this.atSolutionCallbacks)
      (!event.unchecked || entry.trackUncheckedNeighbors) && await entry.callback({ ...event });
  }
};

// lib/generated/routing_parameters.ts
var FirstSolutionStrategy_Value = /* @__PURE__ */ ((FirstSolutionStrategy_Value2) => (FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.UNSET = 0] = "UNSET", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.AUTOMATIC = 15] = "AUTOMATIC", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.PATH_CHEAPEST_ARC = 3] = "PATH_CHEAPEST_ARC", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.PATH_MOST_CONSTRAINED_ARC = 4] = "PATH_MOST_CONSTRAINED_ARC", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.EVALUATOR_STRATEGY = 5] = "EVALUATOR_STRATEGY", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.SAVINGS = 10] = "SAVINGS", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.PARALLEL_SAVINGS = 17] = "PARALLEL_SAVINGS", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.SWEEP = 11] = "SWEEP", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.CHRISTOFIDES = 13] = "CHRISTOFIDES", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.ALL_UNPERFORMED = 6] = "ALL_UNPERFORMED", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.BEST_INSERTION = 7] = "BEST_INSERTION", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.PARALLEL_CHEAPEST_INSERTION = 8] = "PARALLEL_CHEAPEST_INSERTION", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.SEQUENTIAL_CHEAPEST_INSERTION = 14] = "SEQUENTIAL_CHEAPEST_INSERTION", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.LOCAL_CHEAPEST_INSERTION = 9] = "LOCAL_CHEAPEST_INSERTION", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.LOCAL_CHEAPEST_COST_INSERTION = 16] = "LOCAL_CHEAPEST_COST_INSERTION", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.GLOBAL_CHEAPEST_ARC = 1] = "GLOBAL_CHEAPEST_ARC", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.LOCAL_CHEAPEST_ARC = 2] = "LOCAL_CHEAPEST_ARC", FirstSolutionStrategy_Value2[FirstSolutionStrategy_Value2.FIRST_UNBOUND_MIN_VALUE = 12] = "FIRST_UNBOUND_MIN_VALUE", FirstSolutionStrategy_Value2))(FirstSolutionStrategy_Value || {}), LocalCheapestInsertionParameters_PairInsertionStrategy = /* @__PURE__ */ ((LocalCheapestInsertionParameters_PairInsertionStrategy2) => (LocalCheapestInsertionParameters_PairInsertionStrategy2[LocalCheapestInsertionParameters_PairInsertionStrategy2.AUTOMATIC = 0] = "AUTOMATIC", LocalCheapestInsertionParameters_PairInsertionStrategy2[LocalCheapestInsertionParameters_PairInsertionStrategy2.BEST_PICKUP_THEN_BEST_DELIVERY = 1] = "BEST_PICKUP_THEN_BEST_DELIVERY", LocalCheapestInsertionParameters_PairInsertionStrategy2[LocalCheapestInsertionParameters_PairInsertionStrategy2.BEST_PICKUP_DELIVERY_PAIR = 2] = "BEST_PICKUP_DELIVERY_PAIR", LocalCheapestInsertionParameters_PairInsertionStrategy2[LocalCheapestInsertionParameters_PairInsertionStrategy2.BEST_PICKUP_DELIVERY_PAIR_MULTITOUR = 3] = "BEST_PICKUP_DELIVERY_PAIR_MULTITOUR", LocalCheapestInsertionParameters_PairInsertionStrategy2))(LocalCheapestInsertionParameters_PairInsertionStrategy || {}), LocalCheapestInsertionParameters_InsertionSortingProperty = /* @__PURE__ */ ((LocalCheapestInsertionParameters_InsertionSortingProperty2) => (LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_UNSPECIFIED = 0] = "SORTING_PROPERTY_UNSPECIFIED", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_ALLOWED_VEHICLES = 1] = "SORTING_PROPERTY_ALLOWED_VEHICLES", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_PENALTY = 2] = "SORTING_PROPERTY_PENALTY", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_PENALTY_OVER_ALLOWED_VEHICLES_RATIO = 3] = "SORTING_PROPERTY_PENALTY_OVER_ALLOWED_VEHICLES_RATIO", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_HIGHEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS = 4] = "SORTING_PROPERTY_HIGHEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_LOWEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS = 5] = "SORTING_PROPERTY_LOWEST_AVG_ARC_COST_TO_VEHICLE_START_ENDS", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_LOWEST_MIN_ARC_COST_TO_VEHICLE_START_ENDS = 6] = "SORTING_PROPERTY_LOWEST_MIN_ARC_COST_TO_VEHICLE_START_ENDS", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_HIGHEST_DIMENSION_USAGE = 7] = "SORTING_PROPERTY_HIGHEST_DIMENSION_USAGE", LocalCheapestInsertionParameters_InsertionSortingProperty2[LocalCheapestInsertionParameters_InsertionSortingProperty2.SORTING_PROPERTY_RANDOM = 8] = "SORTING_PROPERTY_RANDOM", LocalCheapestInsertionParameters_InsertionSortingProperty2))(LocalCheapestInsertionParameters_InsertionSortingProperty || {}), OptionalBoolean = /* @__PURE__ */ ((OptionalBoolean2) => (OptionalBoolean2[OptionalBoolean2.BOOL_UNSPECIFIED = 0] = "BOOL_UNSPECIFIED", OptionalBoolean2[OptionalBoolean2.BOOL_FALSE = 2] = "BOOL_FALSE", OptionalBoolean2[OptionalBoolean2.BOOL_TRUE = 3] = "BOOL_TRUE", OptionalBoolean2))(OptionalBoolean || {}), LocalSearchMetaheuristic_Value = /* @__PURE__ */ ((LocalSearchMetaheuristic_Value2) => (LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.UNSET = 0] = "UNSET", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.AUTOMATIC = 6] = "AUTOMATIC", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.GREEDY_DESCENT = 1] = "GREEDY_DESCENT", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.GUIDED_LOCAL_SEARCH = 2] = "GUIDED_LOCAL_SEARCH", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.SIMULATED_ANNEALING = 3] = "SIMULATED_ANNEALING", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.TABU_SEARCH = 4] = "TABU_SEARCH", LocalSearchMetaheuristic_Value2[LocalSearchMetaheuristic_Value2.GENERIC_TABU_SEARCH = 5] = "GENERIC_TABU_SEARCH", LocalSearchMetaheuristic_Value2))(LocalSearchMetaheuristic_Value || {}), RoutingSearchParameters_SchedulingSolver = /* @__PURE__ */ ((RoutingSearchParameters_SchedulingSolver2) => (RoutingSearchParameters_SchedulingSolver2[RoutingSearchParameters_SchedulingSolver2.SCHEDULING_UNSET = 0] = "SCHEDULING_UNSET", RoutingSearchParameters_SchedulingSolver2[RoutingSearchParameters_SchedulingSolver2.SCHEDULING_GLOP = 1] = "SCHEDULING_GLOP", RoutingSearchParameters_SchedulingSolver2[RoutingSearchParameters_SchedulingSolver2.SCHEDULING_CP_SAT = 2] = "SCHEDULING_CP_SAT", RoutingSearchParameters_SchedulingSolver2))(RoutingSearchParameters_SchedulingSolver || {}), PerturbationStrategy_Value = /* @__PURE__ */ ((PerturbationStrategy_Value2) => (PerturbationStrategy_Value2[PerturbationStrategy_Value2.UNSET = 0] = "UNSET", PerturbationStrategy_Value2[PerturbationStrategy_Value2.RUIN_AND_RECREATE = 1] = "RUIN_AND_RECREATE", PerturbationStrategy_Value2))(PerturbationStrategy_Value || {}), RuinCompositionStrategy_Value = /* @__PURE__ */ ((RuinCompositionStrategy_Value2) => (RuinCompositionStrategy_Value2[RuinCompositionStrategy_Value2.UNSET = 0] = "UNSET", RuinCompositionStrategy_Value2[RuinCompositionStrategy_Value2.RUN_ALL_SEQUENTIALLY = 1] = "RUN_ALL_SEQUENTIALLY", RuinCompositionStrategy_Value2[RuinCompositionStrategy_Value2.RUN_ALL_RANDOMLY = 2] = "RUN_ALL_RANDOMLY", RuinCompositionStrategy_Value2[RuinCompositionStrategy_Value2.RUN_ONE_RANDOMLY = 3] = "RUN_ONE_RANDOMLY", RuinCompositionStrategy_Value2))(RuinCompositionStrategy_Value || {}), CoolingScheduleStrategy_Value = /* @__PURE__ */ ((CoolingScheduleStrategy_Value2) => (CoolingScheduleStrategy_Value2[CoolingScheduleStrategy_Value2.UNSET = 0] = "UNSET", CoolingScheduleStrategy_Value2[CoolingScheduleStrategy_Value2.EXPONENTIAL = 1] = "EXPONENTIAL", CoolingScheduleStrategy_Value2[CoolingScheduleStrategy_Value2.LINEAR = 2] = "LINEAR", CoolingScheduleStrategy_Value2))(CoolingScheduleStrategy_Value || {}), ConstraintSolverParameters_TrailCompression = /* @__PURE__ */ ((ConstraintSolverParameters_TrailCompression2) => (ConstraintSolverParameters_TrailCompression2[ConstraintSolverParameters_TrailCompression2.NO_COMPRESSION = 0] = "NO_COMPRESSION", ConstraintSolverParameters_TrailCompression2[ConstraintSolverParameters_TrailCompression2.COMPRESS_WITH_ZLIB = 1] = "COMPRESS_WITH_ZLIB", ConstraintSolverParameters_TrailCompression2))(ConstraintSolverParameters_TrailCompression || {});

// lib/routing.ts
import { terminateLoadedRuntimeThreads } from "./runtime_loader.js";
export {
  Assignment,
  BOOL_FALSE,
  BOOL_TRUE,
  BOOL_UNSPECIFIED,
  BoundCost,
  CloudExecutorUnavailableError,
  ConstraintSolverParameters_TrailCompression,
  CoolingScheduleStrategy_Value,
  FirstSolutionStrategy,
  FirstSolutionStrategy_Value,
  LocalCheapestInsertionParameters_InsertionSortingProperty,
  LocalCheapestInsertionParameters_PairInsertionStrategy,
  LocalSearchMetaheuristic,
  LocalSearchMetaheuristic_Value,
  OptionalBoolean,
  PenaltyCostBehavior,
  PerturbationStrategy_Value,
  PickupAndDeliveryPolicy,
  RoutingAssignmentSeed,
  RoutingBoolExpr,
  RoutingBreakInterval,
  RoutingDimension,
  RoutingIndexManager,
  RoutingLinearExpr,
  RoutingModel,
  RoutingPrecedencePerformedConstraint,
  RoutingResourceGroup,
  RoutingResult,
  RoutingSearchParameters_SchedulingSolver,
  RoutingSearchStatus,
  RoutingTransitEvaluatorSign,
  RuinCompositionStrategy_Value,
  VisitTypePolicy,
  asNumber,
  defaultRoutingModelParameters,
  defaultRoutingSearchParameters,
  findErrorInRoutingSearchParameters,
  setCloudNoticeEnabled,
  setSingleThreadWarningEnabled,
  terminateLoadedRuntimeThreads
};
/*! Bundled license information:

long/umd/index.js:
  (**
   * @license
   * Copyright 2009 The Closure Library Authors
   * Copyright 2020 Daniel Wirtz / The long.js Authors.
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * SPDX-License-Identifier: Apache-2.0
   *)
*/
