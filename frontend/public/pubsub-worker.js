/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 7:
/***/ ((module) => {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

EventEmitter.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  var events = this._events;
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  if (handler === undefined)
    return false;

  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}


/***/ }),

/***/ 17:
/***/ (function(module, exports) {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;// GENERATED FILE. DO NOT EDIT.
(function (global, factory) {
  function preferDefault(exports) {
    return exports.default || exports;
  }
  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = (function () {
      var exports = {};
      factory(exports);
      return preferDefault(exports);
    }).apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else // removed by dead control flow
{}
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this,
  function (_exports) {
    "use strict";

    Object.defineProperty(_exports, "__esModule", {
      value: true,
    });
    _exports.default = void 0;
    /**
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
     */

    // WebAssembly optimizations to do native i64 multiplication and divide
    var wasm = null;
    try {
      wasm = new WebAssembly.Instance(
        new WebAssembly.Module(
          new Uint8Array([
            // \0asm
            0, 97, 115, 109,
            // version 1
            1, 0, 0, 0,
            // section "type"
            1, 13, 2,
            // 0, () => i32
            96, 0, 1, 127,
            // 1, (i32, i32, i32, i32) => i32
            96, 4, 127, 127, 127, 127, 1, 127,
            // section "function"
            3, 7, 6,
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
            6, 6, 1,
            // 0, "high", mutable i32
            127, 1, 65, 0, 11,
            // section "export"
            7, 50, 6,
            // 0, "mul"
            3, 109, 117, 108, 0, 1,
            // 1, "div_s"
            5, 100, 105, 118, 95, 115, 0, 2,
            // 2, "div_u"
            5, 100, 105, 118, 95, 117, 0, 3,
            // 3, "rem_s"
            5, 114, 101, 109, 95, 115, 0, 4,
            // 4, "rem_u"
            5, 114, 101, 109, 95, 117, 0, 5,
            // 5, "get_high"
            8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0,
            // section "code"
            10, 191, 1, 6,
            // 0, "get_high"
            4, 0, 35, 0, 11,
            // 1, "mul"
            36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173,
            32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0,
            32, 4, 167, 11,
            // 2, "div_s"
            36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173,
            32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0,
            32, 4, 167, 11,
            // 3, "div_u"
            36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173,
            32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0,
            32, 4, 167, 11,
            // 4, "rem_s"
            36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173,
            32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0,
            32, 4, 167, 11,
            // 5, "rem_u"
            36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173,
            32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0,
            32, 4, 167, 11,
          ]),
        ),
        {},
      ).exports;
    } catch {
      // no wasm support :(
    }

    /**
     * Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
     *  See the from* functions below for more convenient ways of constructing Longs.
     * @exports Long
     * @class A Long class for representing a 64 bit two's-complement integer value.
     * @param {number} low The low (signed) 32 bits of the long
     * @param {number} high The high (signed) 32 bits of the long
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @constructor
     */
    function Long(low, high, unsigned) {
      /**
       * The low 32 bits as a signed value.
       * @type {number}
       */
      this.low = low | 0;

      /**
       * The high 32 bits as a signed value.
       * @type {number}
       */
      this.high = high | 0;

      /**
       * Whether unsigned or not.
       * @type {boolean}
       */
      this.unsigned = !!unsigned;
    }

    // The internal representation of a long is the two given signed, 32-bit values.
    // We use 32-bit pieces because these are the size of integers on which
    // Javascript performs bit-operations.  For operations like addition and
    // multiplication, we split each number into 16 bit pieces, which can easily be
    // multiplied within Javascript's floating-point representation without overflow
    // or change in sign.
    //
    // In the algorithms below, we frequently reduce the negative case to the
    // positive case by negating the input(s) and then post-processing the result.
    // Note that we must ALWAYS check specially whether those values are MIN_VALUE
    // (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
    // a positive number, it overflows back into a negative).  Not handling this
    // case would often result in infinite recursion.
    //
    // Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the from*
    // methods on which they depend.

    /**
     * An indicator used to reliably determine if an object is a Long or not.
     * @type {boolean}
     * @const
     * @private
     */
    Long.prototype.__isLong__;
    Object.defineProperty(Long.prototype, "__isLong__", {
      value: true,
    });

    /**
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     * @inner
     */
    function isLong(obj) {
      return (obj && obj["__isLong__"]) === true;
    }

    /**
     * @function
     * @param {*} value number
     * @returns {number}
     * @inner
     */
    function ctz32(value) {
      var c = Math.clz32(value & -value);
      return value ? 31 - c : c;
    }

    /**
     * Tests if the specified object is a Long.
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     */
    Long.isLong = isLong;

    /**
     * A cache of the Long representations of small integer values.
     * @type {!Object}
     * @inner
     */
    var INT_CACHE = {};

    /**
     * A cache of the Long representations of small unsigned integer values.
     * @type {!Object}
     * @inner
     */
    var UINT_CACHE = {};

    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromInt(value, unsigned) {
      var obj, cachedObj, cache;
      if (unsigned) {
        value >>>= 0;
        if ((cache = 0 <= value && value < 256)) {
          cachedObj = UINT_CACHE[value];
          if (cachedObj) return cachedObj;
        }
        obj = fromBits(value, 0, true);
        if (cache) UINT_CACHE[value] = obj;
        return obj;
      } else {
        value |= 0;
        if ((cache = -128 <= value && value < 128)) {
          cachedObj = INT_CACHE[value];
          if (cachedObj) return cachedObj;
        }
        obj = fromBits(value, value < 0 ? -1 : 0, false);
        if (cache) INT_CACHE[value] = obj;
        return obj;
      }
    }

    /**
     * Returns a Long representing the given 32 bit integer value.
     * @function
     * @param {number} value The 32 bit integer in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromInt = fromInt;

    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromNumber(value, unsigned) {
      if (isNaN(value)) return unsigned ? UZERO : ZERO;
      if (unsigned) {
        if (value < 0) return UZERO;
        if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
      } else {
        if (value <= -TWO_PWR_63_DBL) return MIN_VALUE;
        if (value + 1 >= TWO_PWR_63_DBL) return MAX_VALUE;
      }
      if (value < 0) return fromNumber(-value, unsigned).neg();
      return fromBits(
        value % TWO_PWR_32_DBL | 0,
        (value / TWO_PWR_32_DBL) | 0,
        unsigned,
      );
    }

    /**
     * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
     * @function
     * @param {number} value The number in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromNumber = fromNumber;

    /**
     * @param {number} lowBits
     * @param {number} highBits
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromBits(lowBits, highBits, unsigned) {
      return new Long(lowBits, highBits, unsigned);
    }

    /**
     * Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
     *  assumed to use 32 bits.
     * @function
     * @param {number} lowBits The low 32 bits
     * @param {number} highBits The high 32 bits
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromBits = fromBits;

    /**
     * @function
     * @param {number} base
     * @param {number} exponent
     * @returns {number}
     * @inner
     */
    var pow_dbl = Math.pow; // Used 4 times (4*8 to 15+4)

    /**
     * @param {string} str
     * @param {(boolean|number)=} unsigned
     * @param {number=} radix
     * @returns {!Long}
     * @inner
     */
    function fromString(str, unsigned, radix) {
      if (str.length === 0) throw Error("empty string");
      if (typeof unsigned === "number") {
        // For goog.math.long compatibility
        radix = unsigned;
        unsigned = false;
      } else {
        unsigned = !!unsigned;
      }
      if (
        str === "NaN" ||
        str === "Infinity" ||
        str === "+Infinity" ||
        str === "-Infinity"
      )
        return unsigned ? UZERO : ZERO;
      radix = radix || 10;
      if (radix < 2 || 36 < radix) throw RangeError("radix");
      var p;
      if ((p = str.indexOf("-")) > 0) throw Error("interior hyphen");
      else if (p === 0) {
        return fromString(str.substring(1), unsigned, radix).neg();
      }

      // Do several (8) digits each time through the loop, so as to
      // minimize the calls to the very expensive emulated div.
      var radixToPower = fromNumber(pow_dbl(radix, 8));
      var result = ZERO;
      for (var i = 0; i < str.length; i += 8) {
        var size = Math.min(8, str.length - i),
          value = parseInt(str.substring(i, i + size), radix);
        if (size < 8) {
          var power = fromNumber(pow_dbl(radix, size));
          result = result.mul(power).add(fromNumber(value));
        } else {
          result = result.mul(radixToPower);
          result = result.add(fromNumber(value));
        }
      }
      result.unsigned = unsigned;
      return result;
    }

    /**
     * Returns a Long representation of the given string, written using the specified radix.
     * @function
     * @param {string} str The textual representation of the Long
     * @param {(boolean|number)=} unsigned Whether unsigned or not, defaults to signed
     * @param {number=} radix The radix in which the text is written (2-36), defaults to 10
     * @returns {!Long} The corresponding Long value
     */
    Long.fromString = fromString;

    /**
     * @function
     * @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromValue(val, unsigned) {
      if (typeof val === "number") return fromNumber(val, unsigned);
      if (typeof val === "string") return fromString(val, unsigned);
      // Throws for non-objects, converts non-instanceof Long:
      return fromBits(
        val.low,
        val.high,
        typeof unsigned === "boolean" ? unsigned : val.unsigned,
      );
    }

    /**
     * Converts the specified value to a Long using the appropriate from* function for its type.
     * @function
     * @param {!Long|number|bigint|string|!{low: number, high: number, unsigned: boolean}} val Value
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {!Long}
     */
    Long.fromValue = fromValue;

    // NOTE: the compiler should inline these constant values below and then remove these variables, so there should be
    // no runtime penalty for these.

    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_16_DBL = 1 << 16;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_24_DBL = 1 << 24;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;

    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;

    /**
     * @type {!Long}
     * @const
     * @inner
     */
    var TWO_PWR_24 = fromInt(TWO_PWR_24_DBL);

    /**
     * @type {!Long}
     * @inner
     */
    var ZERO = fromInt(0);

    /**
     * Signed zero.
     * @type {!Long}
     */
    Long.ZERO = ZERO;

    /**
     * @type {!Long}
     * @inner
     */
    var UZERO = fromInt(0, true);

    /**
     * Unsigned zero.
     * @type {!Long}
     */
    Long.UZERO = UZERO;

    /**
     * @type {!Long}
     * @inner
     */
    var ONE = fromInt(1);

    /**
     * Signed one.
     * @type {!Long}
     */
    Long.ONE = ONE;

    /**
     * @type {!Long}
     * @inner
     */
    var UONE = fromInt(1, true);

    /**
     * Unsigned one.
     * @type {!Long}
     */
    Long.UONE = UONE;

    /**
     * @type {!Long}
     * @inner
     */
    var NEG_ONE = fromInt(-1);

    /**
     * Signed negative one.
     * @type {!Long}
     */
    Long.NEG_ONE = NEG_ONE;

    /**
     * @type {!Long}
     * @inner
     */
    var MAX_VALUE = fromBits(0xffffffff | 0, 0x7fffffff | 0, false);

    /**
     * Maximum signed value.
     * @type {!Long}
     */
    Long.MAX_VALUE = MAX_VALUE;

    /**
     * @type {!Long}
     * @inner
     */
    var MAX_UNSIGNED_VALUE = fromBits(0xffffffff | 0, 0xffffffff | 0, true);

    /**
     * Maximum unsigned value.
     * @type {!Long}
     */
    Long.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;

    /**
     * @type {!Long}
     * @inner
     */
    var MIN_VALUE = fromBits(0, 0x80000000 | 0, false);

    /**
     * Minimum signed value.
     * @type {!Long}
     */
    Long.MIN_VALUE = MIN_VALUE;

    /**
     * @alias Long.prototype
     * @inner
     */
    var LongPrototype = Long.prototype;

    /**
     * Converts the Long to a 32 bit integer, assuming it is a 32 bit integer.
     * @this {!Long}
     * @returns {number}
     */
    LongPrototype.toInt = function toInt() {
      return this.unsigned ? this.low >>> 0 : this.low;
    };

    /**
     * Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa).
     * @this {!Long}
     * @returns {number}
     */
    LongPrototype.toNumber = function toNumber() {
      if (this.unsigned)
        return (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0);
      return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
    };

    /**
     * Converts the Long to a string written in the specified radix.
     * @this {!Long}
     * @param {number=} radix Radix (2-36), defaults to 10
     * @returns {string}
     * @override
     * @throws {RangeError} If `radix` is out of range
     */
    LongPrototype.toString = function toString(radix) {
      radix = radix || 10;
      if (radix < 2 || 36 < radix) throw RangeError("radix");
      if (this.isZero()) return "0";
      if (this.isNegative()) {
        // Unsigned Longs are never negative
        if (this.eq(MIN_VALUE)) {
          // We need to change the Long value before it can be negated, so we remove
          // the bottom-most digit in this base and then recurse to do the rest.
          var radixLong = fromNumber(radix),
            div = this.div(radixLong),
            rem1 = div.mul(radixLong).sub(this);
          return div.toString(radix) + rem1.toInt().toString(radix);
        } else return "-" + this.neg().toString(radix);
      }

      // Do several (6) digits each time through the loop, so as to
      // minimize the calls to the very expensive emulated div.
      var radixToPower = fromNumber(pow_dbl(radix, 6), this.unsigned),
        rem = this;
      var result = "";
      while (true) {
        var remDiv = rem.div(radixToPower),
          intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0,
          digits = intval.toString(radix);
        rem = remDiv;
        if (rem.isZero()) return digits + result;
        else {
          while (digits.length < 6) digits = "0" + digits;
          result = "" + digits + result;
        }
      }
    };

    /**
     * Gets the high 32 bits as a signed integer.
     * @this {!Long}
     * @returns {number} Signed high bits
     */
    LongPrototype.getHighBits = function getHighBits() {
      return this.high;
    };

    /**
     * Gets the high 32 bits as an unsigned integer.
     * @this {!Long}
     * @returns {number} Unsigned high bits
     */
    LongPrototype.getHighBitsUnsigned = function getHighBitsUnsigned() {
      return this.high >>> 0;
    };

    /**
     * Gets the low 32 bits as a signed integer.
     * @this {!Long}
     * @returns {number} Signed low bits
     */
    LongPrototype.getLowBits = function getLowBits() {
      return this.low;
    };

    /**
     * Gets the low 32 bits as an unsigned integer.
     * @this {!Long}
     * @returns {number} Unsigned low bits
     */
    LongPrototype.getLowBitsUnsigned = function getLowBitsUnsigned() {
      return this.low >>> 0;
    };

    /**
     * Gets the number of bits needed to represent the absolute value of this Long.
     * @this {!Long}
     * @returns {number}
     */
    LongPrototype.getNumBitsAbs = function getNumBitsAbs() {
      if (this.isNegative())
        // Unsigned Longs are never negative
        return this.eq(MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
      var val = this.high != 0 ? this.high : this.low;
      for (var bit = 31; bit > 0; bit--) if ((val & (1 << bit)) != 0) break;
      return this.high != 0 ? bit + 33 : bit + 1;
    };

    /**
     * Tests if this Long can be safely represented as a JavaScript number.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isSafeInteger = function isSafeInteger() {
      // 2^53-1 is the maximum safe value
      var top11Bits = this.high >> 21;
      // [0, 2^53-1]
      if (!top11Bits) return true;
      // > 2^53-1
      if (this.unsigned) return false;
      // [-2^53, -1] except -2^53
      return top11Bits === -1 && !(this.low === 0 && this.high === -0x200000);
    };

    /**
     * Tests if this Long's value equals zero.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isZero = function isZero() {
      return this.high === 0 && this.low === 0;
    };

    /**
     * Tests if this Long's value equals zero. This is an alias of {@link Long#isZero}.
     * @returns {boolean}
     */
    LongPrototype.eqz = LongPrototype.isZero;

    /**
     * Tests if this Long's value is negative.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isNegative = function isNegative() {
      return !this.unsigned && this.high < 0;
    };

    /**
     * Tests if this Long's value is positive or zero.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isPositive = function isPositive() {
      return this.unsigned || this.high >= 0;
    };

    /**
     * Tests if this Long's value is odd.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isOdd = function isOdd() {
      return (this.low & 1) === 1;
    };

    /**
     * Tests if this Long's value is even.
     * @this {!Long}
     * @returns {boolean}
     */
    LongPrototype.isEven = function isEven() {
      return (this.low & 1) === 0;
    };

    /**
     * Tests if this Long's value equals the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.equals = function equals(other) {
      if (!isLong(other)) other = fromValue(other);
      if (
        this.unsigned !== other.unsigned &&
        this.high >>> 31 === 1 &&
        other.high >>> 31 === 1
      )
        return false;
      return this.high === other.high && this.low === other.low;
    };

    /**
     * Tests if this Long's value equals the specified's. This is an alias of {@link Long#equals}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.eq = LongPrototype.equals;

    /**
     * Tests if this Long's value differs from the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.notEquals = function notEquals(other) {
      return !this.eq(/* validates */ other);
    };

    /**
     * Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.neq = LongPrototype.notEquals;

    /**
     * Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.ne = LongPrototype.notEquals;

    /**
     * Tests if this Long's value is less than the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lessThan = function lessThan(other) {
      return this.comp(/* validates */ other) < 0;
    };

    /**
     * Tests if this Long's value is less than the specified's. This is an alias of {@link Long#lessThan}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lt = LongPrototype.lessThan;

    /**
     * Tests if this Long's value is less than or equal the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lessThanOrEqual = function lessThanOrEqual(other) {
      return this.comp(/* validates */ other) <= 0;
    };

    /**
     * Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lte = LongPrototype.lessThanOrEqual;

    /**
     * Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.le = LongPrototype.lessThanOrEqual;

    /**
     * Tests if this Long's value is greater than the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.greaterThan = function greaterThan(other) {
      return this.comp(/* validates */ other) > 0;
    };

    /**
     * Tests if this Long's value is greater than the specified's. This is an alias of {@link Long#greaterThan}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.gt = LongPrototype.greaterThan;

    /**
     * Tests if this Long's value is greater than or equal the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.greaterThanOrEqual = function greaterThanOrEqual(other) {
      return this.comp(/* validates */ other) >= 0;
    };

    /**
     * Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.gte = LongPrototype.greaterThanOrEqual;

    /**
     * Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.ge = LongPrototype.greaterThanOrEqual;

    /**
     * Compares this Long's value with the specified's.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    LongPrototype.compare = function compare(other) {
      if (!isLong(other)) other = fromValue(other);
      if (this.eq(other)) return 0;
      var thisNeg = this.isNegative(),
        otherNeg = other.isNegative();
      if (thisNeg && !otherNeg) return -1;
      if (!thisNeg && otherNeg) return 1;
      // At this point the sign bits are the same
      if (!this.unsigned) return this.sub(other).isNegative() ? -1 : 1;
      // Both are positive if at least one is unsigned
      return other.high >>> 0 > this.high >>> 0 ||
        (other.high === this.high && other.low >>> 0 > this.low >>> 0)
        ? -1
        : 1;
    };

    /**
     * Compares this Long's value with the specified's. This is an alias of {@link Long#compare}.
     * @function
     * @param {!Long|number|bigint|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    LongPrototype.comp = LongPrototype.compare;

    /**
     * Negates this Long's value.
     * @this {!Long}
     * @returns {!Long} Negated Long
     */
    LongPrototype.negate = function negate() {
      if (!this.unsigned && this.eq(MIN_VALUE)) return MIN_VALUE;
      return this.not().add(ONE);
    };

    /**
     * Negates this Long's value. This is an alias of {@link Long#negate}.
     * @function
     * @returns {!Long} Negated Long
     */
    LongPrototype.neg = LongPrototype.negate;

    /**
     * Returns the sum of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|bigint|string} addend Addend
     * @returns {!Long} Sum
     */
    LongPrototype.add = function add(addend) {
      if (!isLong(addend)) addend = fromValue(addend);

      // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

      var a48 = this.high >>> 16;
      var a32 = this.high & 0xffff;
      var a16 = this.low >>> 16;
      var a00 = this.low & 0xffff;
      var b48 = addend.high >>> 16;
      var b32 = addend.high & 0xffff;
      var b16 = addend.low >>> 16;
      var b00 = addend.low & 0xffff;
      var c48 = 0,
        c32 = 0,
        c16 = 0,
        c00 = 0;
      c00 += a00 + b00;
      c16 += c00 >>> 16;
      c00 &= 0xffff;
      c16 += a16 + b16;
      c32 += c16 >>> 16;
      c16 &= 0xffff;
      c32 += a32 + b32;
      c48 += c32 >>> 16;
      c32 &= 0xffff;
      c48 += a48 + b48;
      c48 &= 0xffff;
      return fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };

    /**
     * Returns the difference of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|bigint|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    LongPrototype.subtract = function subtract(subtrahend) {
      if (!isLong(subtrahend)) subtrahend = fromValue(subtrahend);
      return this.add(subtrahend.neg());
    };

    /**
     * Returns the difference of this and the specified Long. This is an alias of {@link Long#subtract}.
     * @function
     * @param {!Long|number|bigint|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    LongPrototype.sub = LongPrototype.subtract;

    /**
     * Returns the product of this and the specified Long.
     * @this {!Long}
     * @param {!Long|number|bigint|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    LongPrototype.multiply = function multiply(multiplier) {
      if (this.isZero()) return this;
      if (!isLong(multiplier)) multiplier = fromValue(multiplier);

      // use wasm support if present
      if (wasm) {
        var low = wasm["mul"](
          this.low,
          this.high,
          multiplier.low,
          multiplier.high,
        );
        return fromBits(low, wasm["get_high"](), this.unsigned);
      }
      if (multiplier.isZero()) return this.unsigned ? UZERO : ZERO;
      if (this.eq(MIN_VALUE)) return multiplier.isOdd() ? MIN_VALUE : ZERO;
      if (multiplier.eq(MIN_VALUE)) return this.isOdd() ? MIN_VALUE : ZERO;
      if (this.isNegative()) {
        if (multiplier.isNegative()) return this.neg().mul(multiplier.neg());
        else return this.neg().mul(multiplier).neg();
      } else if (multiplier.isNegative())
        return this.mul(multiplier.neg()).neg();

      // If both longs are small, use float multiplication
      if (this.lt(TWO_PWR_24) && multiplier.lt(TWO_PWR_24))
        return fromNumber(
          this.toNumber() * multiplier.toNumber(),
          this.unsigned,
        );

      // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
      // We can skip products that would overflow.

      var a48 = this.high >>> 16;
      var a32 = this.high & 0xffff;
      var a16 = this.low >>> 16;
      var a00 = this.low & 0xffff;
      var b48 = multiplier.high >>> 16;
      var b32 = multiplier.high & 0xffff;
      var b16 = multiplier.low >>> 16;
      var b00 = multiplier.low & 0xffff;
      var c48 = 0,
        c32 = 0,
        c16 = 0,
        c00 = 0;
      c00 += a00 * b00;
      c16 += c00 >>> 16;
      c00 &= 0xffff;
      c16 += a16 * b00;
      c32 += c16 >>> 16;
      c16 &= 0xffff;
      c16 += a00 * b16;
      c32 += c16 >>> 16;
      c16 &= 0xffff;
      c32 += a32 * b00;
      c48 += c32 >>> 16;
      c32 &= 0xffff;
      c32 += a16 * b16;
      c48 += c32 >>> 16;
      c32 &= 0xffff;
      c32 += a00 * b32;
      c48 += c32 >>> 16;
      c32 &= 0xffff;
      c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
      c48 &= 0xffff;
      return fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };

    /**
     * Returns the product of this and the specified Long. This is an alias of {@link Long#multiply}.
     * @function
     * @param {!Long|number|bigint|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    LongPrototype.mul = LongPrototype.multiply;

    /**
     * Returns this Long divided by the specified. The result is signed if this Long is signed or
     *  unsigned if this Long is unsigned.
     * @this {!Long}
     * @param {!Long|number|bigint|string} divisor Divisor
     * @returns {!Long} Quotient
     */
    LongPrototype.divide = function divide(divisor) {
      if (!isLong(divisor)) divisor = fromValue(divisor);
      if (divisor.isZero()) throw Error("division by zero");

      // use wasm support if present
      if (wasm) {
        // guard against signed division overflow: the largest
        // negative number / -1 would be 1 larger than the largest
        // positive number, due to two's complement.
        if (
          !this.unsigned &&
          this.high === -0x80000000 &&
          divisor.low === -1 &&
          divisor.high === -1
        ) {
          // be consistent with non-wasm code path
          return this;
        }
        var low = (this.unsigned ? wasm["div_u"] : wasm["div_s"])(
          this.low,
          this.high,
          divisor.low,
          divisor.high,
        );
        return fromBits(low, wasm["get_high"](), this.unsigned);
      }
      if (this.isZero()) return this.unsigned ? UZERO : ZERO;
      var approx, rem, res;
      if (!this.unsigned) {
        // This section is only relevant for signed longs and is derived from the
        // closure library as a whole.
        if (this.eq(MIN_VALUE)) {
          if (divisor.eq(ONE) || divisor.eq(NEG_ONE))
            return MIN_VALUE; // recall that -MIN_VALUE == MIN_VALUE
          else if (divisor.eq(MIN_VALUE)) return ONE;
          else {
            // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
            var halfThis = this.shr(1);
            approx = halfThis.div(divisor).shl(1);
            if (approx.eq(ZERO)) {
              return divisor.isNegative() ? ONE : NEG_ONE;
            } else {
              rem = this.sub(divisor.mul(approx));
              res = approx.add(rem.div(divisor));
              return res;
            }
          }
        } else if (divisor.eq(MIN_VALUE)) return this.unsigned ? UZERO : ZERO;
        if (this.isNegative()) {
          if (divisor.isNegative()) return this.neg().div(divisor.neg());
          return this.neg().div(divisor).neg();
        } else if (divisor.isNegative()) return this.div(divisor.neg()).neg();
        res = ZERO;
      } else {
        // The algorithm below has not been made for unsigned longs. It's therefore
        // required to take special care of the MSB prior to running it.
        if (!divisor.unsigned) divisor = divisor.toUnsigned();
        if (divisor.gt(this)) return UZERO;
        if (divisor.gt(this.shru(1)))
          // 15 >>> 1 = 7 ; with divisor = 8 ; true
          return UONE;
        res = UZERO;
      }

      // Repeat the following until the remainder is less than other:  find a
      // floating-point that approximates remainder / other *from below*, add this
      // into the result, and subtract it from the remainder.  It is critical that
      // the approximate value is less than or equal to the real value so that the
      // remainder never becomes negative.
      rem = this;
      while (rem.gte(divisor)) {
        // Approximate the result of division. This may be a little greater or
        // smaller than the actual value.
        approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));

        // We will tweak the approximate result by changing it in the 48-th digit or
        // the smallest non-fractional digit, whichever is larger.
        var log2 = Math.ceil(Math.log(approx) / Math.LN2),
          delta = log2 <= 48 ? 1 : pow_dbl(2, log2 - 48),
          // Decrease the approximation until it is smaller than the remainder.  Note
          // that if it is too large, the product overflows and is negative.
          approxRes = fromNumber(approx),
          approxRem = approxRes.mul(divisor);
        while (approxRem.isNegative() || approxRem.gt(rem)) {
          approx -= delta;
          approxRes = fromNumber(approx, this.unsigned);
          approxRem = approxRes.mul(divisor);
        }

        // We know the answer can't be zero... and actually, zero would cause
        // infinite recursion since we would make no progress.
        if (approxRes.isZero()) approxRes = ONE;
        res = res.add(approxRes);
        rem = rem.sub(approxRem);
      }
      return res;
    };

    /**
     * Returns this Long divided by the specified. This is an alias of {@link Long#divide}.
     * @function
     * @param {!Long|number|bigint|string} divisor Divisor
     * @returns {!Long} Quotient
     */
    LongPrototype.div = LongPrototype.divide;

    /**
     * Returns this Long modulo the specified.
     * @this {!Long}
     * @param {!Long|number|bigint|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    LongPrototype.modulo = function modulo(divisor) {
      if (!isLong(divisor)) divisor = fromValue(divisor);

      // use wasm support if present
      if (wasm) {
        var low = (this.unsigned ? wasm["rem_u"] : wasm["rem_s"])(
          this.low,
          this.high,
          divisor.low,
          divisor.high,
        );
        return fromBits(low, wasm["get_high"](), this.unsigned);
      }
      return this.sub(this.div(divisor).mul(divisor));
    };

    /**
     * Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
     * @function
     * @param {!Long|number|bigint|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    LongPrototype.mod = LongPrototype.modulo;

    /**
     * Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
     * @function
     * @param {!Long|number|bigint|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    LongPrototype.rem = LongPrototype.modulo;

    /**
     * Returns the bitwise NOT of this Long.
     * @this {!Long}
     * @returns {!Long}
     */
    LongPrototype.not = function not() {
      return fromBits(~this.low, ~this.high, this.unsigned);
    };

    /**
     * Returns count leading zeros of this Long.
     * @this {!Long}
     * @returns {!number}
     */
    LongPrototype.countLeadingZeros = function countLeadingZeros() {
      return this.high ? Math.clz32(this.high) : Math.clz32(this.low) + 32;
    };

    /**
     * Returns count leading zeros. This is an alias of {@link Long#countLeadingZeros}.
     * @function
     * @param {!Long}
     * @returns {!number}
     */
    LongPrototype.clz = LongPrototype.countLeadingZeros;

    /**
     * Returns count trailing zeros of this Long.
     * @this {!Long}
     * @returns {!number}
     */
    LongPrototype.countTrailingZeros = function countTrailingZeros() {
      return this.low ? ctz32(this.low) : ctz32(this.high) + 32;
    };

    /**
     * Returns count trailing zeros. This is an alias of {@link Long#countTrailingZeros}.
     * @function
     * @param {!Long}
     * @returns {!number}
     */
    LongPrototype.ctz = LongPrototype.countTrailingZeros;

    /**
     * Returns the bitwise AND of this Long and the specified.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.and = function and(other) {
      if (!isLong(other)) other = fromValue(other);
      return fromBits(
        this.low & other.low,
        this.high & other.high,
        this.unsigned,
      );
    };

    /**
     * Returns the bitwise OR of this Long and the specified.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.or = function or(other) {
      if (!isLong(other)) other = fromValue(other);
      return fromBits(
        this.low | other.low,
        this.high | other.high,
        this.unsigned,
      );
    };

    /**
     * Returns the bitwise XOR of this Long and the given one.
     * @this {!Long}
     * @param {!Long|number|bigint|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.xor = function xor(other) {
      if (!isLong(other)) other = fromValue(other);
      return fromBits(
        this.low ^ other.low,
        this.high ^ other.high,
        this.unsigned,
      );
    };

    /**
     * Returns this Long with bits shifted to the left by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftLeft = function shiftLeft(numBits) {
      if (isLong(numBits)) numBits = numBits.toInt();
      if ((numBits &= 63) === 0) return this;
      else if (numBits < 32)
        return fromBits(
          this.low << numBits,
          (this.high << numBits) | (this.low >>> (32 - numBits)),
          this.unsigned,
        );
      else return fromBits(0, this.low << (numBits - 32), this.unsigned);
    };

    /**
     * Returns this Long with bits shifted to the left by the given amount. This is an alias of {@link Long#shiftLeft}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shl = LongPrototype.shiftLeft;

    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftRight = function shiftRight(numBits) {
      if (isLong(numBits)) numBits = numBits.toInt();
      if ((numBits &= 63) === 0) return this;
      else if (numBits < 32)
        return fromBits(
          (this.low >>> numBits) | (this.high << (32 - numBits)),
          this.high >> numBits,
          this.unsigned,
        );
      else
        return fromBits(
          this.high >> (numBits - 32),
          this.high >= 0 ? 0 : -1,
          this.unsigned,
        );
    };

    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount. This is an alias of {@link Long#shiftRight}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shr = LongPrototype.shiftRight;

    /**
     * Returns this Long with bits logically shifted to the right by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftRightUnsigned = function shiftRightUnsigned(numBits) {
      if (isLong(numBits)) numBits = numBits.toInt();
      if ((numBits &= 63) === 0) return this;
      if (numBits < 32)
        return fromBits(
          (this.low >>> numBits) | (this.high << (32 - numBits)),
          this.high >>> numBits,
          this.unsigned,
        );
      if (numBits === 32) return fromBits(this.high, 0, this.unsigned);
      return fromBits(this.high >>> (numBits - 32), 0, this.unsigned);
    };

    /**
     * Returns this Long with bits logically shifted to the right by the given amount. This is an alias of {@link Long#shiftRightUnsigned}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shru = LongPrototype.shiftRightUnsigned;

    /**
     * Returns this Long with bits logically shifted to the right by the given amount. This is an alias of {@link Long#shiftRightUnsigned}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shr_u = LongPrototype.shiftRightUnsigned;

    /**
     * Returns this Long with bits rotated to the left by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Rotated Long
     */
    LongPrototype.rotateLeft = function rotateLeft(numBits) {
      var b;
      if (isLong(numBits)) numBits = numBits.toInt();
      if ((numBits &= 63) === 0) return this;
      if (numBits === 32) return fromBits(this.high, this.low, this.unsigned);
      if (numBits < 32) {
        b = 32 - numBits;
        return fromBits(
          (this.low << numBits) | (this.high >>> b),
          (this.high << numBits) | (this.low >>> b),
          this.unsigned,
        );
      }
      numBits -= 32;
      b = 32 - numBits;
      return fromBits(
        (this.high << numBits) | (this.low >>> b),
        (this.low << numBits) | (this.high >>> b),
        this.unsigned,
      );
    };
    /**
     * Returns this Long with bits rotated to the left by the given amount. This is an alias of {@link Long#rotateLeft}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Rotated Long
     */
    LongPrototype.rotl = LongPrototype.rotateLeft;

    /**
     * Returns this Long with bits rotated to the right by the given amount.
     * @this {!Long}
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Rotated Long
     */
    LongPrototype.rotateRight = function rotateRight(numBits) {
      var b;
      if (isLong(numBits)) numBits = numBits.toInt();
      if ((numBits &= 63) === 0) return this;
      if (numBits === 32) return fromBits(this.high, this.low, this.unsigned);
      if (numBits < 32) {
        b = 32 - numBits;
        return fromBits(
          (this.high << b) | (this.low >>> numBits),
          (this.low << b) | (this.high >>> numBits),
          this.unsigned,
        );
      }
      numBits -= 32;
      b = 32 - numBits;
      return fromBits(
        (this.low << b) | (this.high >>> numBits),
        (this.high << b) | (this.low >>> numBits),
        this.unsigned,
      );
    };
    /**
     * Returns this Long with bits rotated to the right by the given amount. This is an alias of {@link Long#rotateRight}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Rotated Long
     */
    LongPrototype.rotr = LongPrototype.rotateRight;

    /**
     * Converts this Long to signed.
     * @this {!Long}
     * @returns {!Long} Signed long
     */
    LongPrototype.toSigned = function toSigned() {
      if (!this.unsigned) return this;
      return fromBits(this.low, this.high, false);
    };

    /**
     * Converts this Long to unsigned.
     * @this {!Long}
     * @returns {!Long} Unsigned long
     */
    LongPrototype.toUnsigned = function toUnsigned() {
      if (this.unsigned) return this;
      return fromBits(this.low, this.high, true);
    };

    /**
     * Converts this Long to its byte representation.
     * @param {boolean=} le Whether little or big endian, defaults to big endian
     * @this {!Long}
     * @returns {!Array.<number>} Byte representation
     */
    LongPrototype.toBytes = function toBytes(le) {
      return le ? this.toBytesLE() : this.toBytesBE();
    };

    /**
     * Converts this Long to its little endian byte representation.
     * @this {!Long}
     * @returns {!Array.<number>} Little endian byte representation
     */
    LongPrototype.toBytesLE = function toBytesLE() {
      var hi = this.high,
        lo = this.low;
      return [
        lo & 0xff,
        (lo >>> 8) & 0xff,
        (lo >>> 16) & 0xff,
        lo >>> 24,
        hi & 0xff,
        (hi >>> 8) & 0xff,
        (hi >>> 16) & 0xff,
        hi >>> 24,
      ];
    };

    /**
     * Converts this Long to its big endian byte representation.
     * @this {!Long}
     * @returns {!Array.<number>} Big endian byte representation
     */
    LongPrototype.toBytesBE = function toBytesBE() {
      var hi = this.high,
        lo = this.low;
      return [
        hi >>> 24,
        (hi >>> 16) & 0xff,
        (hi >>> 8) & 0xff,
        hi & 0xff,
        lo >>> 24,
        (lo >>> 16) & 0xff,
        (lo >>> 8) & 0xff,
        lo & 0xff,
      ];
    };

    /**
     * Creates a Long from its byte representation.
     * @param {!Array.<number>} bytes Byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @param {boolean=} le Whether little or big endian, defaults to big endian
     * @returns {Long} The corresponding Long value
     */
    Long.fromBytes = function fromBytes(bytes, unsigned, le) {
      return le
        ? Long.fromBytesLE(bytes, unsigned)
        : Long.fromBytesBE(bytes, unsigned);
    };

    /**
     * Creates a Long from its little endian byte representation.
     * @param {!Array.<number>} bytes Little endian byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {Long} The corresponding Long value
     */
    Long.fromBytesLE = function fromBytesLE(bytes, unsigned) {
      return new Long(
        bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24),
        bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24),
        unsigned,
      );
    };

    /**
     * Creates a Long from its big endian byte representation.
     * @param {!Array.<number>} bytes Big endian byte representation
     * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
     * @returns {Long} The corresponding Long value
     */
    Long.fromBytesBE = function fromBytesBE(bytes, unsigned) {
      return new Long(
        (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7],
        (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
        unsigned,
      );
    };

    // Support conversion to/from BigInt where available
    if (typeof BigInt === "function") {
      /**
       * Returns a Long representing the given big integer.
       * @function
       * @param {number} value The big integer value
       * @param {boolean=} unsigned Whether unsigned or not, defaults to signed
       * @returns {!Long} The corresponding Long value
       */
      Long.fromBigInt = function fromBigInt(value, unsigned) {
        var lowBits = Number(BigInt.asIntN(32, value));
        var highBits = Number(BigInt.asIntN(32, value >> BigInt(32)));
        return fromBits(lowBits, highBits, unsigned);
      };

      // Override
      Long.fromValue = function fromValueWithBigInt(value, unsigned) {
        if (typeof value === "bigint") return Long.fromBigInt(value, unsigned);
        return fromValue(value, unsigned);
      };

      /**
       * Converts the Long to its big integer representation.
       * @this {!Long}
       * @returns {bigint}
       */
      LongPrototype.toBigInt = function toBigInt() {
        var lowBigInt = BigInt(this.low >>> 0);
        var highBigInt = BigInt(this.unsigned ? this.high >>> 0 : this.high);
        return (highBigInt << BigInt(32)) | lowBigInt;
      };
    }
    var _default = (_exports.default = Long);
  },
);


/***/ }),

/***/ 25:
/***/ ((__unused_webpack_module, exports) => {

"use strict";


/**
 * A minimal UTF8 implementation for number arrays.
 * @memberof util
 * @namespace
 */
var utf8 = exports,
    replacementChar = "\ufffd",
    strictDecoder;

try {
    strictDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
} catch (err) {
    // "fatal" option is not supported on Node.js compiled without ICU
    strictDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
}

/**
 * Calculates the UTF8 byte length of a string.
 * @param {string} string String
 * @returns {number} Byte length
 */
utf8.length = function utf8_length(string) {
    var len = 0,
        c = 0;
    for (var i = 0; i < string.length; ++i) {
        c = string.charCodeAt(i);
        if (c < 128)
            len += 1;
        else if (c < 2048)
            len += 2;
        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
            ++i;
            len += 4;
        } else
            len += 3;
    }
    return len;
};

function utf8_read_js(buffer, start, end, str) {
    for (var i = start; i < end;) {
        var t = buffer[i++];
        if (t <= 0x7F) {
            str += String.fromCharCode(t);
        } else if (t >= 0xC0 && t < 0xE0) {
            var c2 = (t & 0x1F) << 6 | buffer[i++] & 0x3F;
            str += c2 >= 0x80 ? String.fromCharCode(c2) : replacementChar;
        } else if (t >= 0xE0 && t < 0xF0) {
            var c3 = (t & 0xF) << 12 | (buffer[i++] & 0x3F) << 6 | buffer[i++] & 0x3F;
            str += c3 >= 0x800 ? String.fromCharCode(c3) : replacementChar;
        } else if (t >= 0xF0) {
            var t2 = (t & 7) << 18 | (buffer[i++] & 0x3F) << 12 | (buffer[i++] & 0x3F) << 6 | buffer[i++] & 0x3F;
            if (t2 < 0x10000 || t2 > 0x10FFFF)
                str += replacementChar;
            else {
                t2 -= 0x10000;
                str += String.fromCharCode(0xD800 + (t2 >> 10));
                str += String.fromCharCode(0xDC00 + (t2 & 0x3FF));
            }
        }
    }
    return str;
}

/**
 * Reads UTF8 bytes as a string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} String read
 */
utf8.read = function utf8_read_ascii(buffer, start, end) {
    if (end - start < 1)
        return "";

    var str = "",
        i = start,
        c1, c2, c3, c4, c5, c6, c7, c8;

    for (; i + 7 < end; i += 8) {
        c1 = buffer[i];
        c2 = buffer[i + 1];
        c3 = buffer[i + 2];
        c4 = buffer[i + 3];
        c5 = buffer[i + 4];
        c6 = buffer[i + 5];
        c7 = buffer[i + 6];
        c8 = buffer[i + 7];
        if ((c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 0x80)
            return utf8_read_js(buffer, i, end, str);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
    }

    for (; i < end; ++i) {
        c1 = buffer[i];
        if (c1 & 0x80)
            return utf8_read_js(buffer, i, end, str);
        str += String.fromCharCode(c1);
    }

    return str;
};

function utf8_read_strict(buffer, start, end) {
    var source = start === 0 && end === buffer.length
        ? buffer
        : buffer.subarray
            ? buffer.subarray(start, end)
            : buffer.slice(start, end);
    if (Array.isArray(source))
        source = Uint8Array.from(source);
    return strictDecoder.decode(source);
}

/**
 * Reads UTF8 bytes as a string, rejecting invalid UTF8.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} String read
 */
utf8.readStrict = function utf8_read_strict_ascii(buffer, start, end) {
    if (end - start < 1)
        return "";

    var str = "",
        i = start,
        c1, c2, c3, c4, c5, c6, c7, c8;

    for (; i + 7 < end; i += 8) {
        c1 = buffer[i];
        c2 = buffer[i + 1];
        c3 = buffer[i + 2];
        c4 = buffer[i + 3];
        c5 = buffer[i + 4];
        c6 = buffer[i + 5];
        c7 = buffer[i + 6];
        c8 = buffer[i + 7];
        if ((c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8) & 0x80)
            return str + utf8_read_strict(buffer, i, end);
        str += String.fromCharCode(c1, c2, c3, c4, c5, c6, c7, c8);
    }

    for (; i < end; ++i) {
        c1 = buffer[i];
        if (c1 & 0x80)
            return str + utf8_read_strict(buffer, i, end);
        str += String.fromCharCode(c1);
    }

    return str;
};

/**
 * Writes a string as UTF8 bytes.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Bytes written
 */
utf8.write = function utf8_write(string, buffer, offset) {
    var start = offset,
        c1, // character 1
        c2; // character 2
    for (var i = 0; i < string.length; ++i) {
        c1 = string.charCodeAt(i);
        if (c1 < 128) {
            buffer[offset++] = c1;
        } else if (c1 < 2048) {
            buffer[offset++] = c1 >> 6       | 192;
            buffer[offset++] = c1       & 63 | 128;
        } else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
            ++i;
            buffer[offset++] = c1 >> 18      | 240;
            buffer[offset++] = c1 >> 12 & 63 | 128;
            buffer[offset++] = c1 >> 6  & 63 | 128;
            buffer[offset++] = c1       & 63 | 128;
        } else {
            buffer[offset++] = c1 >> 12      | 224;
            buffer[offset++] = c1 >> 6  & 63 | 128;
            buffer[offset++] = c1       & 63 | 128;
        }
    }
    return offset - start;
};


/***/ }),

/***/ 49:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = BufferReader;

// extends Reader
var Reader = __webpack_require__(688);
BufferReader.prototype = Object.create(Reader.prototype, {
    constructor: {
        value: BufferReader,
        writable: true,
        enumerable: false,
        configurable: true
    }
});

var util = __webpack_require__(499);

/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */
function BufferReader(buffer) {
    Reader.call(this, buffer);

    /**
     * Read buffer.
     * @name BufferReader#buf
     * @type {Buffer}
     */
}

BufferReader._configure = function () {
    /* istanbul ignore else */
    if (util.Buffer)
        BufferReader.prototype._slice = util.Buffer.prototype.slice;
};

/**
 * Returns raw bytes from the backing buffer without advancing the reader.
 * @name BufferReader#raw
 * @function
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Buffer} Raw bytes
 */
BufferReader.prototype.raw = function read_raw_buffer(start, end) {
    if (start === end)
        return util.Buffer.alloc(0);
    return this._slice.call(this.buf, start, end);
};

/**
 * @override
 */
BufferReader.prototype.string = function read_string_buffer() {
    var len = this.uint32(), // modifies pos
        start = this.pos,
        end = this.pos + len;

    /* istanbul ignore if */
    if (end > this.len)
        throw RangeError("index out of range: " + this.pos + " + " + len + " > " + this.len);

    this.pos = end;
    return this.buf.utf8Slice
        ? this.buf.utf8Slice(start, end)
        : this.buf.toString("utf-8", start, end);
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */

BufferReader._configure();


/***/ }),

/***/ 96:
/***/ ((module) => {

"use strict";

module.exports = EventEmitter;

/**
 * Constructs a new event emitter instance.
 * @classdesc A minimal event emitter.
 * @memberof util
 * @constructor
 */
function EventEmitter() {

    /**
     * Registered listeners.
     * @type {Object.<string,*>}
     * @private
     */
    this._listeners = Object.create(null);
}

/**
 * Event listener as used by {@link util.EventEmitter}.
 * @typedef EventEmitterListener
 * @type {function}
 * @param {...*} args Arguments
 * @returns {undefined}
 */

/**
 * Registers an event listener.
 * @param {string} evt Event name
 * @param {EventEmitterListener} fn Listener
 * @param {*} [ctx] Listener context
 * @returns {this} `this`
 */
EventEmitter.prototype.on = function on(evt, fn, ctx) {
    (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn  : fn,
        ctx : ctx || this
    });
    return this;
};

/**
 * Removes an event listener or any matching listeners if arguments are omitted.
 * @param {string} [evt] Event name. Removes all listeners if omitted.
 * @param {EventEmitterListener} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
 * @returns {this} `this`
 */
EventEmitter.prototype.off = function off(evt, fn) {
    if (evt === undefined)
        this._listeners = Object.create(null);
    else {
        if (fn === undefined)
            this._listeners[evt] = [];
        else {
            var listeners = this._listeners[evt];
            if (!listeners)
                return this;
            for (var i = 0; i < listeners.length;)
                if (listeners[i].fn === fn)
                    listeners.splice(i, 1);
                else
                    ++i;
        }
    }
    return this;
};

/**
 * Emits an event by calling its listeners with the specified arguments.
 * @param {string} evt Event name
 * @param {...*} args Arguments
 * @returns {this} `this`
 */
EventEmitter.prototype.emit = function emit(evt) {
    var listeners = this._listeners[evt];
    if (listeners) {
        var args = [],
            i = 1;
        for (; i < arguments.length;)
            args.push(arguments[i++]);
        for (i = 0; i < listeners.length;)
            listeners[i].fn.apply(listeners[i++].ctx, args);
    }
    return this;
};


/***/ }),

/***/ 172:
/***/ ((module) => {

function _OverloadYield(e, d) {
  this.v = e, this.k = d;
}
module.exports = _OverloadYield, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 176:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = LongBits;

var util = __webpack_require__(499);

/**
 * Constructs new long bits.
 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
 * @memberof util
 * @constructor
 * @param {number} lo Low 32 bits, unsigned
 * @param {number} hi High 32 bits, unsigned
 */
function LongBits(lo, hi) {

    // note that the casts below are theoretically unnecessary as of today, but older statically
    // generated converter code might still call the ctor with signed 32bits. kept for compat.

    /**
     * Low bits.
     * @type {number}
     */
    this.lo = lo >>> 0;

    /**
     * High bits.
     * @type {number}
     */
    this.hi = hi >>> 0;
}

/**
 * Zero bits.
 * @memberof util.LongBits
 * @type {util.LongBits}
 */
var zero = LongBits.zero = new LongBits(0, 0);

zero.toNumber = function() { return 0; };
zero.zzEncode = zero.zzDecode = function() { return this; };
zero.length = function() { return 1; };

/**
 * Zero hash.
 * @memberof util.LongBits
 * @type {string}
 */
var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";

/**
 * Constructs new long bits from the specified number.
 * @param {number} value Value
 * @returns {util.LongBits} Instance
 */
LongBits.fromNumber = function fromNumber(value) {
    if (value === 0)
        return zero;
    var sign = value < 0;
    if (sign)
        value = -value;
    var lo = value >>> 0,
        hi = (value - lo) / 4294967296 >>> 0;
    if (sign) {
        hi = ~hi >>> 0;
        lo = ~lo >>> 0;
        if (++lo > 4294967295) {
            lo = 0;
            if (++hi > 4294967295)
                hi = 0;
        }
    }
    return new LongBits(lo, hi);
};

/**
 * Constructs new long bits from a number, long or string.
 * @param {Long|number|string} value Value
 * @returns {util.LongBits} Instance
 */
LongBits.from = function from(value) {
    if (typeof value === "number")
        return LongBits.fromNumber(value);
    if (util.isString(value)) {
        /* istanbul ignore else */
        if (util.Long)
            value = util.Long.fromString(value);
        else
            return LongBits.fromNumber(parseInt(value, 10));
    }
    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
};

/**
 * Converts this long bits to a possibly unsafe JavaScript number.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {number} Possibly unsafe number
 */
LongBits.prototype.toNumber = function toNumber(unsigned) {
    if (!unsigned && this.hi >>> 31) {
        var lo = ~this.lo + 1 >>> 0,
            hi = ~this.hi     >>> 0;
        if (!lo)
            hi = hi + 1 >>> 0;
        return -(lo + hi * 4294967296);
    }
    return this.lo + this.hi * 4294967296;
};

/**
 * Converts this long bits to a long.
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long} Long
 */
LongBits.prototype.toLong = function toLong(unsigned) {
    return util.Long
        ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
        /* istanbul ignore next */
        : { low: this.lo | 0, high: this.hi | 0, unsigned: Boolean(unsigned) };
};

var charCodeAt = String.prototype.charCodeAt;

/**
 * Constructs new long bits from the specified 8 characters long hash.
 * @param {string} hash Hash
 * @returns {util.LongBits} Bits
 */
LongBits.fromHash = function fromHash(hash) {
    if (hash === zeroHash)
        return zero;
    return new LongBits(
        ( charCodeAt.call(hash, 0)
        | charCodeAt.call(hash, 1) << 8
        | charCodeAt.call(hash, 2) << 16
        | charCodeAt.call(hash, 3) << 24) >>> 0
    ,
        ( charCodeAt.call(hash, 4)
        | charCodeAt.call(hash, 5) << 8
        | charCodeAt.call(hash, 6) << 16
        | charCodeAt.call(hash, 7) << 24) >>> 0
    );
};

/**
 * Converts this long bits to a 8 characters long hash.
 * @returns {string} Hash
 */
LongBits.prototype.toHash = function toHash() {
    return String.fromCharCode(
        this.lo        & 255,
        this.lo >>> 8  & 255,
        this.lo >>> 16 & 255,
        this.lo >>> 24      ,
        this.hi        & 255,
        this.hi >>> 8  & 255,
        this.hi >>> 16 & 255,
        this.hi >>> 24
    );
};

/**
 * Zig-zag encodes this long bits.
 * @returns {util.LongBits} `this`
 */
LongBits.prototype.zzEncode = function zzEncode() {
    var mask =   this.hi >> 31;
    this.hi  = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
    this.lo  = ( this.lo << 1                   ^ mask) >>> 0;
    return this;
};

/**
 * Zig-zag decodes this long bits.
 * @returns {util.LongBits} `this`
 */
LongBits.prototype.zzDecode = function zzDecode() {
    var mask = -(this.lo & 1);
    this.lo  = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
    this.hi  = ( this.hi >>> 1                  ^ mask) >>> 0;
    return this;
};

/**
 * Calculates the length of this longbits when encoded as a varint.
 * @returns {number} Length
 */
LongBits.prototype.length = function length() {
    var part0 =  this.lo,
        part1 = (this.lo >>> 28 | this.hi << 4) >>> 0,
        part2 =  this.hi >>> 24;
    return part2 === 0
         ? part1 === 0
           ? part0 < 16384
             ? part0 < 128 ? 1 : 2
             : part0 < 2097152 ? 3 : 4
           : part1 < 16384
             ? part1 < 128 ? 5 : 6
             : part1 < 2097152 ? 7 : 8
         : part2 < 128 ? 9 : 10;
};


/***/ }),

/***/ 209:
/***/ ((__unused_webpack_module, exports) => {

"use strict";


/**
 * A minimal base64 implementation for number arrays.
 * @memberof util
 * @namespace
 */
var base64 = exports;

/**
 * Calculates the byte length of a base64 encoded string.
 * @param {string} string Base64 encoded string
 * @returns {number} Byte length
 */
base64.length = function length(string) {
    var p = string.length;
    if (!p)
        return 0;
    while (p > 0 && string.charAt(p - 1) === "=")
        --p;
    return Math.floor(p * 3 / 4);
};

// Base64 encoding table
var b64 = new Array(64);

// Base64 decoding table
var s64 = new Array(123);

// 65..90, 97..122, 48..57, 43, 47
for (var i = 0; i < 64;)
    s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;

s64[45] = 62; // - -> +
s64[95] = 63; // _ -> /

/**
 * Encodes a buffer to a base64 encoded string.
 * @param {Uint8Array} buffer Source buffer
 * @param {number} start Source start
 * @param {number} end Source end
 * @returns {string} Base64 encoded string
 */
base64.encode = function encode(buffer, start, end) {
    var parts = null,
        chunk = [];
    var i = 0, // output index
        j = 0, // goto index
        t;     // temporary
    while (start < end) {
        var b = buffer[start++];
        switch (j) {
            case 0:
                chunk[i++] = b64[b >> 2];
                t = (b & 3) << 4;
                j = 1;
                break;
            case 1:
                chunk[i++] = b64[t | b >> 4];
                t = (b & 15) << 2;
                j = 2;
                break;
            case 2:
                chunk[i++] = b64[t | b >> 6];
                chunk[i++] = b64[b & 63];
                j = 0;
                break;
        }
        if (i > 8191) {
            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
            i = 0;
        }
    }
    if (j) {
        chunk[i++] = b64[t];
        chunk[i++] = 61;
        if (j === 1)
            chunk[i++] = 61;
    }
    if (parts) {
        if (i)
            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
        return parts.join("");
    }
    return String.fromCharCode.apply(String, chunk.slice(0, i));
};

var invalidEncoding = "invalid encoding";

/**
 * Decodes a base64 encoded string to a buffer.
 * @param {string} string Source string
 * @param {Uint8Array} buffer Destination buffer
 * @param {number} offset Destination offset
 * @returns {number} Number of bytes written
 * @throws {Error} If encoding is invalid
 */
base64.decode = function decode(string, buffer, offset) {
    var start = offset;
    var j = 0, // goto index
        t;     // temporary
    for (var i = 0; i < string.length;) {
        var c = string.charCodeAt(i++);
        if (c === 61 && j > 1)
            break;
        if ((c = s64[c]) === undefined)
            throw Error(invalidEncoding);
        switch (j) {
            case 0:
                t = c;
                j = 1;
                break;
            case 1:
                buffer[offset++] = t << 2 | (c & 48) >> 4;
                t = c;
                j = 2;
                break;
            case 2:
                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
                t = c;
                j = 3;
                break;
            case 3:
                buffer[offset++] = (t & 3) << 6 | c;
                j = 0;
                break;
        }
    }
    if (j === 1)
        throw Error(invalidEncoding);
    return offset - start;
};

var base64Re = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    base64UrlRe = /[-_]/,
    base64UrlNoPaddingRe = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2}(?:==)?|[A-Za-z0-9_-]{3}=?)?$/;

/**
 * Tests if the specified string appears to be base64 encoded.
 * @param {string} string String to test
 * @returns {boolean} `true` if probably base64 encoded, otherwise false
 */
base64.test = function test(string) {
    return base64Re.test(string)
        || base64UrlRe.test(string) && base64UrlNoPaddingRe.test(string);
};


/***/ }),

/***/ 226:
/***/ ((module) => {

"use strict";

module.exports = Object.create(null);

/**
 * Named roots.
 * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
 * Can also be used manually to make roots available across modules.
 * @name roots
 * @type {Object.<string,Root>}
 * @example
 * // pbjs -r myroot -o compiled.js ...
 *
 * // in another module:
 * require("./compiled.js");
 *
 * // in any subsequent module:
 * var root = protobuf.roots["myroot"];
 */


/***/ }),

/***/ 233:
/***/ ((module) => {

"use strict";

module.exports = asPromise;

/**
 * Callback as used by {@link util.asPromise}.
 * @typedef asPromiseCallback
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {...*} params Additional arguments
 * @returns {undefined}
 */

/**
 * Returns a promise from a node-style callback function.
 * @memberof util
 * @param {asPromiseCallback} fn Function to call
 * @param {*} ctx Function context
 * @param {...*} params Function arguments
 * @returns {Promise<*>} Promisified function
 */
function asPromise(fn, ctx/*, varargs */) {
    var params  = new Array(arguments.length - 1),
        offset  = 0,
        index   = 2,
        pending = true;
    while (index < arguments.length)
        params[offset++] = arguments[index++];
    return new Promise(function executor(resolve, reject) {
        params[offset] = function callback(err/*, varargs */) {
            if (pending) {
                pending = false;
                if (err)
                    reject(err);
                else {
                    var params = new Array(arguments.length - 1),
                        offset = 0;
                    while (offset < params.length)
                        params[offset++] = arguments[offset];
                    resolve.apply(null, params);
                }
            }
        };
        try {
            fn.apply(ctx || null, params);
        } catch (err) {
            if (pending) {
                pending = false;
                reject(err);
            }
        }
    });
}


/***/ }),

/***/ 296:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


/**
 * Streaming RPC helpers.
 * @namespace
 */
var rpc = exports;

/**
 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
 * @typedef RPCImpl
 * @type {function}
 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
 * @param {Uint8Array} requestData Request data
 * @param {RPCImplCallback} callback Callback function
 * @returns {undefined}
 * @example
 * function rpcImpl(method, requestData, callback) {
 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
 *         throw Error("no such method");
 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
 *         callback(err, responseData);
 *     });
 * }
 */

/**
 * Node-style callback as used by {@link RPCImpl}.
 * @typedef RPCImplCallback
 * @type {function}
 * @param {Error|null} error Error, if any, otherwise `null`
 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
 * @returns {undefined}
 */

rpc.Service = __webpack_require__(375);


/***/ }),

/***/ 361:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
// minimal library entry point.


module.exports = __webpack_require__(873);


/***/ }),

/***/ 373:
/***/ ((module) => {

function _regeneratorKeys(e) {
  var n = Object(e),
    r = [];
  for (var t in n) r.unshift(t);
  return function e() {
    for (; r.length;) if ((t = r.pop()) in n) return e.value = t, e.done = !1, e;
    return e.done = !0, e;
  };
}
module.exports = _regeneratorKeys, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 375:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = Service;

var util = __webpack_require__(499);

// Extends EventEmitter
Service.prototype = Object.create(util.EventEmitter.prototype, {
    constructor: {
        value: Service,
        writable: true,
        enumerable: false,
        configurable: true
    }
});

/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 *
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {TRes} [response] Response message
 * @returns {undefined}
 */

/**
 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 * @type {{
 *   (request: TReq|Properties<TReq>, callback: rpc.ServiceMethodCallback<TRes>): void;
 *   (request: TReq|Properties<TReq>): Promise<TRes>;
 *   readonly name: string;
 *   readonly path: string;
 *   readonly requestType: string;
 *   readonly responseType: string;
 *   readonly requestStream: true|undefined;
 *   readonly responseStream: true|undefined;
 * }}
 */

/**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */
function Service(rpcImpl, requestDelimited, responseDelimited) {

    if (typeof rpcImpl !== "function")
        throw TypeError("rpcImpl must be a function");

    util.EventEmitter.call(this);

    /**
     * RPC implementation. Becomes `null` once the service is ended.
     * @type {RPCImpl|null}
     */
    this.rpcImpl = rpcImpl;

    /**
     * Whether requests are length-delimited.
     * @type {boolean}
     */
    this.requestDelimited = Boolean(requestDelimited);

    /**
     * Whether responses are length-delimited.
     * @type {boolean}
     */
    this.responseDelimited = Boolean(responseDelimited);
}

/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
 * @param {Constructor<TReq>} requestCtor Request constructor
 * @param {Constructor<TRes>} responseCtor Response constructor
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
 * @returns {undefined}
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 */
Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {

    if (!request)
        throw TypeError("request must be specified");

    var self = this;
    if (!callback)
        return util.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);

    if (!self.rpcImpl) {
        setTimeout(function() { callback(Error("already ended")); }, 0);
        return undefined;
    }

    try {
        return self.rpcImpl(
            method,
            requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
            function rpcCallback(err, response) {

                if (err) {
                    self.emit("error", err, method);
                    return callback(err);
                }

                if (response === null) {
                    self.end(/* endedByRPC */ true);
                    return undefined;
                }

                if (!(response instanceof responseCtor)) {
                    try {
                        response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
                    } catch (err) {
                        self.emit("error", err, method);
                        return callback(err);
                    }
                }

                self.emit("data", response, method);
                return callback(null, response);
            }
        );
    } catch (err) {
        self.emit("error", err, method);
        setTimeout(function() { callback(err); }, 0);
        return undefined;
    }
};

/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */
Service.prototype.end = function end(endedByRPC) {
    if (this.rpcImpl) {
        if (!endedByRPC) // signal end to rpcImpl
            this.rpcImpl(null, null, null);
        this.rpcImpl = null;
        this.emit("end").off();
    }
    return this;
};


/***/ }),

/***/ 378:
/***/ ((module) => {

"use strict";


module.exports = factory(factory);

/**
 * Reads / writes floats / doubles from / to buffers.
 * @name util.float
 * @namespace
 */

/**
 * Writes a 32 bit float to a buffer using little endian byte order.
 * @name util.float.writeFloatLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Writes a 32 bit float to a buffer using big endian byte order.
 * @name util.float.writeFloatBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Reads a 32 bit float from a buffer using little endian byte order.
 * @name util.float.readFloatLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Reads a 32 bit float from a buffer using big endian byte order.
 * @name util.float.readFloatBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Writes a 64 bit double to a buffer using little endian byte order.
 * @name util.float.writeDoubleLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Writes a 64 bit double to a buffer using big endian byte order.
 * @name util.float.writeDoubleBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Reads a 64 bit double from a buffer using little endian byte order.
 * @name util.float.readDoubleLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Reads a 64 bit double from a buffer using big endian byte order.
 * @name util.float.readDoubleBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

// Factory function for the purpose of node-based testing in modified global environments
function factory(exports) {

    // float: typed array
    if (typeof Float32Array !== "undefined") (function() {

        var f32 = new Float32Array([ -0 ]),
            f8b = new Uint8Array(f32.buffer),
            le  = f8b[3] === 128;

        function writeFloat_f32_cpy(val, buf, pos) {
            f32[0] = val;
            buf[pos    ] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
        }

        function writeFloat_f32_rev(val, buf, pos) {
            f32[0] = val;
            buf[pos    ] = f8b[3];
            buf[pos + 1] = f8b[2];
            buf[pos + 2] = f8b[1];
            buf[pos + 3] = f8b[0];
        }

        /* istanbul ignore next */
        exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev;
        /* istanbul ignore next */
        exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;

        function readFloat_f32_cpy(buf, pos) {
            f8b[0] = buf[pos    ];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            return f32[0];
        }

        function readFloat_f32_rev(buf, pos) {
            f8b[3] = buf[pos    ];
            f8b[2] = buf[pos + 1];
            f8b[1] = buf[pos + 2];
            f8b[0] = buf[pos + 3];
            return f32[0];
        }

        /* istanbul ignore next */
        exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev;
        /* istanbul ignore next */
        exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;

    // float: ieee754
    })(); else (function() {

        function writeFloat_ieee754(writeUint, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign)
                val = -val;
            if (val === 0)
                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos);
            else if (isNaN(val))
                writeUint(2143289344, buf, pos);
            else if (val > 3.4028234663852886e+38) // +-Infinity
                writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
            else if (val < 1.1754943508222875e-38) // denormal
                writeUint((sign << 31 | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos);
            else {
                var exponent = Math.floor(Math.log(val) / Math.LN2),
                    mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
                writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
            }
        }

        exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE);
        exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);

        function readFloat_ieee754(readUint, buf, pos) {
            var uint = readUint(buf, pos),
                sign = (uint >> 31) * 2 + 1,
                exponent = uint >>> 23 & 255,
                mantissa = uint & 8388607;
            return exponent === 255
                ? mantissa
                ? NaN
                : sign * Infinity
                : exponent === 0 // denormal
                ? sign * 1.401298464324817e-45 * mantissa
                : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
        }

        exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
        exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);

    })();

    // double: typed array
    if (typeof Float64Array !== "undefined") (function() {

        var f64 = new Float64Array([-0]),
            f8b = new Uint8Array(f64.buffer),
            le  = f8b[7] === 128;

        function writeDouble_f64_cpy(val, buf, pos) {
            f64[0] = val;
            buf[pos    ] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
            buf[pos + 4] = f8b[4];
            buf[pos + 5] = f8b[5];
            buf[pos + 6] = f8b[6];
            buf[pos + 7] = f8b[7];
        }

        function writeDouble_f64_rev(val, buf, pos) {
            f64[0] = val;
            buf[pos    ] = f8b[7];
            buf[pos + 1] = f8b[6];
            buf[pos + 2] = f8b[5];
            buf[pos + 3] = f8b[4];
            buf[pos + 4] = f8b[3];
            buf[pos + 5] = f8b[2];
            buf[pos + 6] = f8b[1];
            buf[pos + 7] = f8b[0];
        }

        /* istanbul ignore next */
        exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev;
        /* istanbul ignore next */
        exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;

        function readDouble_f64_cpy(buf, pos) {
            f8b[0] = buf[pos    ];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            f8b[4] = buf[pos + 4];
            f8b[5] = buf[pos + 5];
            f8b[6] = buf[pos + 6];
            f8b[7] = buf[pos + 7];
            return f64[0];
        }

        function readDouble_f64_rev(buf, pos) {
            f8b[7] = buf[pos    ];
            f8b[6] = buf[pos + 1];
            f8b[5] = buf[pos + 2];
            f8b[4] = buf[pos + 3];
            f8b[3] = buf[pos + 4];
            f8b[2] = buf[pos + 5];
            f8b[1] = buf[pos + 6];
            f8b[0] = buf[pos + 7];
            return f64[0];
        }

        /* istanbul ignore next */
        exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev;
        /* istanbul ignore next */
        exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;

    // double: ieee754
    })(); else (function() {

        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign)
                val = -val;
            if (val === 0) {
                writeUint(0, buf, pos + off0);
                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + off1);
            } else if (isNaN(val)) {
                writeUint(0, buf, pos + off0);
                writeUint(2146959360, buf, pos + off1);
            } else if (val > 1.7976931348623157e+308) { // +-Infinity
                writeUint(0, buf, pos + off0);
                writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
            } else {
                var mantissa;
                if (val < 2.2250738585072014e-308) { // denormal
                    mantissa = val / 5e-324;
                    writeUint(mantissa >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
                } else {
                    var exponent = Math.floor(Math.log(val) / Math.LN2);
                    if (exponent === 1024)
                        exponent = 1023;
                    mantissa = val * Math.pow(2, -exponent);
                    writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
                }
            }
        }

        exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4);
        exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);

        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
            var lo = readUint(buf, pos + off0),
                hi = readUint(buf, pos + off1);
            var sign = (hi >> 31) * 2 + 1,
                exponent = hi >>> 20 & 2047,
                mantissa = 4294967296 * (hi & 1048575) + lo;
            return exponent === 2047
                ? mantissa
                ? NaN
                : sign * Infinity
                : exponent === 0 // denormal
                ? sign * 5e-324 * mantissa
                : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
        }

        exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4);
        exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);

    })();

    return exports;
}

// uint helpers

function writeUintLE(val, buf, pos) {
    buf[pos    ] =  val        & 255;
    buf[pos + 1] =  val >>> 8  & 255;
    buf[pos + 2] =  val >>> 16 & 255;
    buf[pos + 3] =  val >>> 24;
}

function writeUintBE(val, buf, pos) {
    buf[pos    ] =  val >>> 24;
    buf[pos + 1] =  val >>> 16 & 255;
    buf[pos + 2] =  val >>> 8  & 255;
    buf[pos + 3] =  val        & 255;
}

function readUintLE(buf, pos) {
    return (buf[pos    ]
          | buf[pos + 1] << 8
          | buf[pos + 2] << 16
          | buf[pos + 3] << 24) >>> 0;
}

function readUintBE(buf, pos) {
    return (buf[pos    ] << 24
          | buf[pos + 1] << 16
          | buf[pos + 2] << 8
          | buf[pos + 3]) >>> 0;
}


/***/ }),

/***/ 453:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = BufferWriter;

// extends Writer
var Writer = __webpack_require__(804);
BufferWriter.prototype = Object.create(Writer.prototype, {
    constructor: {
        value: BufferWriter,
        writable: true,
        enumerable: false,
        configurable: true
    }
});

var util = __webpack_require__(499);

/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */
function BufferWriter() {
    Writer.call(this);
}

BufferWriter._configure = function () {
    /**
     * Allocates a buffer of the specified size.
     * @function
     * @param {number} size Buffer size
     * @returns {Buffer} Buffer
     */
    BufferWriter.alloc = util._Buffer_allocUnsafe;

    BufferWriter.writeBytesBuffer = util.Buffer && util.Buffer.prototype instanceof Uint8Array && util.Buffer.prototype.set.name === "set"
        ? function writeBytesBuffer_set(val, buf, pos) {
          buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
          // also works for plain array values
        }
        /* istanbul ignore next */
        : function writeBytesBuffer_copy(val, buf, pos) {
          if (val.copy) // Buffer values
            val.copy(buf, pos, 0, val.length);
          else for (var i = 0; i < val.length;) // plain array values
            buf[pos++] = val[i++];
        };
};


/**
 * @override
 */
BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
    if (util.isString(value))
        value = util._Buffer_from(value, "base64");
    var len = value.length >>> 0;
    this.uint32(len);
    if (len)
        this._push(BufferWriter.writeBytesBuffer, len, value);
    return this;
};

/**
 * Writes raw bytes without a tag or length prefix.
 * @name BufferWriter#raw
 * @function
 * @param {Uint8Array} value Raw bytes
 * @returns {BufferWriter} `this`
 */
BufferWriter.prototype.raw = function write_raw_buffer(value) {
    var len = value.length >>> 0;
    return len ? this._push(BufferWriter.writeBytesBuffer, len, value) : this;
};

function writeStringBufferAscii(val, buf, pos) {
    for (var i = 0; i < val.length;)
        buf[pos++] = val.charCodeAt(i++);
}

function writeStringBuffer(val, buf, pos) {
    if (val.length < 40) // plain js is faster for short strings (probably due to redundant assertions)
        util.utf8.write(val, buf, pos);
    else if (buf.utf8Write)
        buf.utf8Write(val, pos);
    else
        buf.write(val, pos);
}

/**
 * @override
 */
BufferWriter.prototype.string = function write_string_buffer(value) {
    var len = util.Buffer.byteLength(value);
    this.uint32(len);
    if (len)
        this._push(len === value.length && len < 40 ? writeStringBufferAscii : writeStringBuffer, len, value);
    return this;
};


/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */

BufferWriter._configure();


/***/ }),

/***/ 499:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/* global globalThis */
var util = exports;

// used to return a Promise where callback is omitted
util.asPromise = __webpack_require__(233);

// converts to / from base64 encoded strings
util.base64 = __webpack_require__(209);

// base class of rpc.Service
util.EventEmitter = __webpack_require__(96);

// float handling accross browsers
util.float = __webpack_require__(378);

// converts to / from utf8 encoded strings
util.utf8 = __webpack_require__(25);

// provides a node-like buffer pool in the browser
util.pool = __webpack_require__(612);

// utility to work with the low and high bits of a 64 bit value
util.LongBits = __webpack_require__(176);

/**
 * Tests if the specified key can affect object prototypes.
 * @memberof util
 * @param {string} key Key to test
 * @returns {boolean} `true` if the key is unsafe
 */
function isUnsafeProperty(key) {
    return key === "__proto__" || key === "prototype" || key === "constructor";
}

util.isUnsafeProperty = isUnsafeProperty;

/**
 * Whether running within node or not.
 * @memberof util
 * @type {boolean}
 */
util.isNode = Boolean(typeof __webpack_require__.g !== "undefined"
                   && __webpack_require__.g
                   && __webpack_require__.g.process
                   && __webpack_require__.g.process.versions
                   && __webpack_require__.g.process.versions.node);

/**
 * Global object reference.
 * @memberof util
 * @type {Object}
 */
util.global = util.isNode && __webpack_require__.g
           || typeof window !== "undefined" && window
           || typeof self   !== "undefined" && self
           || typeof globalThis !== "undefined" && globalThis
           || this; // eslint-disable-line no-invalid-this

/**
 * An immuable empty array.
 * @memberof util
 * @type {Array.<*>}
 * @const
 */
util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes

/**
 * An immutable empty object.
 * @type {Object}
 * @const
 */
util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes

/**
 * Tests if the specified value is an integer.
 * @function
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is an integer
 */
util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
};

/**
 * Tests if the specified value is a string.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a string
 */
util.isString = function isString(value) {
    return typeof value === "string" || value instanceof String;
};

/**
 * Tests if the specified value is a non-null object.
 * @param {*} value Value to test
 * @returns {boolean} `true` if the value is a non-null object
 */
util.isObject = function isObject(value) {
    return value && typeof value === "object";
};

/**
 * Checks if a property on a message is considered to be present.
 * This is an alias of {@link util.isSet}.
 * @function
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */
util.isset =

/**
 * Checks if a property on a message is considered to be present.
 * @param {Object} obj Plain object or message instance
 * @param {string} prop Property name
 * @returns {boolean} `true` if considered to be present, otherwise `false`
 */
util.isSet = function isSet(obj, prop) {
    var value = obj[prop];
    if (value != null && Object.hasOwnProperty.call(obj, prop)) // eslint-disable-line eqeqeq
        return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
    return false;
};

/**
 * Any compatible Buffer instance.
 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
 * @interface Buffer
 * @extends Uint8Array
 */

/**
 * Node's Buffer class if available.
 * @type {Constructor<Buffer>}
 */
util.Buffer = (function() {
    try {
        var Buffer = util.global.Buffer;
        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
    } catch (e) {
        /* istanbul ignore next */
        return null;
    }
})();

// Internal alias of or polyfull for Buffer.from.
util._Buffer_from = null;

// Internal alias of or polyfill for Buffer.allocUnsafe.
util._Buffer_allocUnsafe = null;

/**
 * Creates a new buffer of whatever type supported by the environment.
 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
 * @returns {Uint8Array|Buffer} Buffer
 */
util.newBuffer = function newBuffer(sizeOrArray) {
    /* istanbul ignore next */
    return typeof sizeOrArray === "number"
        ? util.Buffer
            ? util._Buffer_allocUnsafe(sizeOrArray)
            : new util.Array(sizeOrArray)
        : util.Buffer
            ? util._Buffer_from(sizeOrArray)
            : typeof Uint8Array === "undefined"
                ? sizeOrArray
                : new Uint8Array(sizeOrArray);
};

/**
 * Prepends a raw field tag to raw field data.
 * @param {number} id Field id
 * @param {number} wireType Wire type
 * @param {Uint8Array} data Raw field data
 * @returns {Uint8Array|Buffer} Raw field bytes
 * @ignore
 */
util.rawField = function rawField(id, wireType, data) {
    var out = [],
        tag = id << 3 | wireType;
    tag >>>= 0;
    while (tag > 127) {
        out.push(tag & 127 | 128);
        tag >>>= 7;
    }
    out.push(tag);
    for (var i = 0; i < data.length; ++i)
        out.push(data[i]);
    return util.newBuffer(out);
};

/**
 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
 * @type {Constructor<Uint8Array>}
 */
util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */ : Array;

/**
 * Any compatible Long instance.
 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
 * @interface Long
 * @property {number} low Low bits
 * @property {number} high High bits
 * @property {boolean} unsigned Whether unsigned or not
 */

/**
 * Long.js's Long class if available.
 * @type {Constructor<Long>}
 */
util.Long = /* istanbul ignore next */ util.global.dcodeIO && /* istanbul ignore next */ util.global.dcodeIO.Long
         || /* istanbul ignore next */ util.global.Long
         || (function() {
                try {
                    var Long = __webpack_require__(17);
                    return Long && Long.isLong ? Long : null;
                } catch (e) {
                    /* istanbul ignore next */
                    return null;
                }
            })();

/**
 * Regular expression used to verify 2 bit (`bool`) map keys.
 * @type {RegExp}
 * @const
 */
util.key2Re = /^(?:true|false|0|1)$/;

/**
 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
 * @type {RegExp}
 * @const
 */
util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;

/**
 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
 * @type {RegExp}
 * @const
 */
util.key64Re = /^(?:[\x00-\xff]{8}|-?(?:0|[1-9][0-9]*))$/; // eslint-disable-line no-control-regex

/**
 * Converts a number or long to an 8 characters long hash string.
 * @param {Long|number} value Value to convert
 * @returns {string} Hash
 */
util.longToHash = function longToHash(value) {
    return value
        ? util.LongBits.from(value).toHash()
        : util.LongBits.zeroHash;
};

/**
 * Converts an 8 characters long hash string to a long or number.
 * @param {string} hash Hash
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long|number} Original value
 */
util.longFromHash = function longFromHash(hash, unsigned) {
    var bits = util.LongBits.fromHash(hash);
    if (util.Long)
        return util.Long.fromBits(bits.lo, bits.hi, unsigned);
    return bits.toNumber(Boolean(unsigned));
};

/**
 * Converts a 64 bit key to a long or number if it is an 8 characters long hash string.
 * @param {string} key Map key
 * @param {boolean} [unsigned=false] Whether unsigned or not
 * @returns {Long|number|string} Original value
 */
util.longFromKey = function longFromKey(key, unsigned) {
    return util.key64Re.test(key) && !util.key32Re.test(key)
        ? util.longFromHash(key, unsigned)
        : key;
};

/**
 * Converts a boolean key to a boolean value.
 * @param {string} key Map key
 * @returns {boolean} Boolean value
 */
util.boolFromKey = function boolFromKey(key) {
    return key === "true" || key === "1";
};

/**
 * Merges the properties of the source object into the destination object.
 * @memberof util
 * @param {Object.<string,*>} dst Destination object
 * @param {...(Object.<string,*>|boolean)} src Source objects, optionally followed by an `ifNotSet` flag
 * @returns {Object.<string,*>} Destination object
 */
function merge(dst) { // used by converters
    var ifNotSet = typeof arguments[arguments.length - 1] === "boolean",
        limit = ifNotSet ? arguments.length - 1 : arguments.length;
    ifNotSet = ifNotSet && arguments[arguments.length - 1];
    for (var a = 1; a < limit; ++a) {
        var src = arguments[a];
        if (!src)
            continue;
        for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
            if (!isUnsafeProperty(keys[i]) && (!ifNotSet || !Object.prototype.hasOwnProperty.call(dst, keys[i]) || dst[keys[i]] === undefined))
                dst[keys[i]] = src[keys[i]];
    }
    return dst;
}

util.merge = merge;

/**
 * Schema declaration nesting limit.
 * @memberof util
 * @type {number}
 */
util.nestingLimit = 32; // protoc: MaxMessageDeclarationNestingDepth

/**
 * Recursion limit.
 * @memberof util
 * @type {number}
 */
util.recursionLimit = 100; // protoc: CodedInputStream::default_recursion_limit_

/**
 * Makes a property safe for assignment as an own property.
 * @memberof util
 * @param {Object.<string,*>} obj Object
 * @param {string} key Property key
 * @param {boolean} [enumerable=true] Whether the property should be enumerable
 * @returns {undefined}
 */
util.makeProp = function makeProp(obj, key, enumerable) {
    if (Object.prototype.hasOwnProperty.call(obj, key))
        return;
    Object.defineProperty(obj, key, {
        enumerable: enumerable === undefined ? true : enumerable,
        configurable: true,
        writable: true
    });
};

/**
 * Converts the first character of a string to lower case.
 * @param {string} str String to convert
 * @returns {string} Converted string
 */
util.lcFirst = function lcFirst(str) {
    return str.charAt(0).toLowerCase() + str.substring(1);
};

/**
 * Creates a custom error constructor.
 * @memberof util
 * @param {string} name Error name
 * @returns {Constructor<Error>} Custom error constructor
 */
function newError(name) {

    function CustomError(message, properties) {

        if (!(this instanceof CustomError))
            return new CustomError(message, properties);

        // Error.call(this, message);
        // ^ just returns a new error instance because the ctor can be called as a function

        Object.defineProperty(this, "message", { get: function() { return message; } });

        /* istanbul ignore next */
        if (Error.captureStackTrace) // node
            Error.captureStackTrace(this, CustomError);
        else
            Object.defineProperty(this, "stack", { value: new Error().stack || "" });

        if (properties)
            merge(this, properties);
    }

    CustomError.prototype = Object.create(Error.prototype, {
        constructor: {
            value: CustomError,
            writable: true,
            enumerable: false,
            configurable: true,
        },
        name: {
            get: function get() { return name; },
            set: undefined,
            enumerable: false,
            // configurable: false would accurately preserve the behavior of
            // the original, but I'm guessing that was not intentional.
            // For an actual error subclass, this property would
            // be configurable.
            configurable: true,
        },
        toString: {
            value: function value() { return this.name + ": " + this.message; },
            writable: true,
            enumerable: false,
            configurable: true,
        },
    });

    return CustomError;
}

util.newError = newError;

/**
 * Constructs a new protocol error.
 * @classdesc Error subclass indicating a protocol specifc error.
 * @memberof util
 * @extends Error
 * @template T extends Message<T>
 * @constructor
 * @param {string} message Error message
 * @param {Object.<string,*>} [properties] Additional properties
 * @example
 * try {
 *     MyMessage.decode(someBuffer); // throws if required fields are missing
 * } catch (e) {
 *     if (e instanceof ProtocolError && e.instance)
 *         console.log("decoded so far: " + JSON.stringify(e.instance));
 * }
 */
util.ProtocolError = newError("ProtocolError");

/**
 * So far decoded message instance.
 * @name util.ProtocolError#instance
 * @type {Message<T>}
 */

/**
 * A OneOf getter as returned by {@link util.oneOfGetter}.
 * @typedef OneOfGetter
 * @type {function}
 * @returns {string|undefined} Set field name, if any
 */

/**
 * Builds a getter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfGetter} Unbound getter
 */
util.oneOfGetter = function getOneOf(fieldNames) {
    var fieldMap = {};
    for (var i = 0; i < fieldNames.length; ++i)
        fieldMap[fieldNames[i]] = 1;

    /**
     * @returns {string|undefined} Set field name, if any
     * @this Object
     * @ignore
     */
    return function() { // eslint-disable-line consistent-return
        for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
            if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null)
                return keys[i];
    };
};

/**
 * A OneOf setter as returned by {@link util.oneOfSetter}.
 * @typedef OneOfSetter
 * @type {function}
 * @param {string|undefined} value Field name
 * @returns {undefined}
 */

/**
 * Builds a setter for a oneof's present field name.
 * @param {string[]} fieldNames Field names
 * @returns {OneOfSetter} Unbound setter
 */
util.oneOfSetter = function setOneOf(fieldNames) {

    /**
     * @param {string} name Field name
     * @returns {undefined}
     * @this Object
     * @ignore
     */
    return function(name) {
        for (var i = 0; i < fieldNames.length; ++i)
            if (fieldNames[i] !== name)
                delete this[fieldNames[i]];
    };
};

/**
 * Default conversion options used for {@link Message#toJSON} implementations.
 *
 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
 *
 * - Longs become strings
 * - Enums become string keys
 * - Bytes become base64 encoded strings
 * - (Sub-)Messages become plain objects
 * - Maps become plain objects with all string keys
 * - Repeated fields become arrays
 * - NaN and Infinity for float and double fields become strings
 *
 * @type {IConversionOptions}
 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
 */
util.toJSONOptions = {
    longs: String,
    enums: String,
    bytes: String,
    json: true
};

// Sets up buffer utility according to the environment (called in index-minimal)
util._configure = function() {
    var Buffer = util.Buffer;
    /* istanbul ignore if */
    if (!Buffer) {
        util._Buffer_from = util._Buffer_allocUnsafe = null;
        return;
    }
    // because node 4.x buffers are incompatible & immutable
    // see: https://github.com/dcodeIO/protobuf.js/pull/665
    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from ||
        /* istanbul ignore next */
        function Buffer_from(value, encoding) {
            return new Buffer(value, encoding);
        };
    util._Buffer_allocUnsafe = Buffer.allocUnsafe ||
        /* istanbul ignore next */
        function Buffer_allocUnsafe(size) {
            return new Buffer(size);
        };
};


/***/ }),

/***/ 546:
/***/ ((module) => {

function _regeneratorDefine(e, r, n, t) {
  var i = Object.defineProperty;
  try {
    i({}, "", {});
  } catch (e) {
    i = 0;
  }
  module.exports = _regeneratorDefine = function regeneratorDefine(e, r, n, t) {
    function o(r, n) {
      _regeneratorDefine(e, r, function (e) {
        return this._invoke(r, n, e);
      });
    }
    r ? i ? i(e, r, {
      value: n,
      enumerable: !t,
      configurable: !t,
      writable: !t
    }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2));
  }, module.exports.__esModule = true, module.exports["default"] = module.exports, _regeneratorDefine(e, r, n, t);
}
module.exports = _regeneratorDefine, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 579:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var _typeof = (__webpack_require__(738)["default"]);
function _regeneratorValues(e) {
  if (null != e) {
    var t = e["function" == typeof Symbol && Symbol.iterator || "@@iterator"],
      r = 0;
    if (t) return t.call(e);
    if ("function" == typeof e.next) return e;
    if (!isNaN(e.length)) return {
      next: function next() {
        return e && r >= e.length && (e = void 0), {
          value: e && e[r++],
          done: !e
        };
      }
    };
  }
  throw new TypeError(_typeof(e) + " is not iterable");
}
module.exports = _regeneratorValues, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 612:
/***/ ((module) => {

"use strict";

module.exports = pool;

/**
 * An allocator as used by {@link util.pool}.
 * @typedef PoolAllocator
 * @type {function}
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */

/**
 * A slicer as used by {@link util.pool}.
 * @typedef PoolSlicer
 * @type {function}
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Uint8Array} Buffer slice
 * @this Uint8Array
 */

/**
 * A general purpose buffer pool.
 * @memberof util
 * @function
 * @param {PoolAllocator} alloc Allocator
 * @param {PoolSlicer} slice Slicer
 * @param {number} [size=8192] Slab size
 * @returns {PoolAllocator} Pooled allocator
 */
function pool(alloc, slice, size) {
    var SIZE   = size || 8192;
    var MAX    = SIZE >>> 1;
    var slab   = null;
    var offset = SIZE;
    return function pool_alloc(size) {
        if (size < 1 || size > MAX)
            return alloc(size);
        if (offset + size > SIZE) {
            slab = alloc(SIZE);
            offset = 0;
        }
        var buf = slice.call(slab, offset, offset += size);
        if (offset & 7) // align to 32 bit
            offset = (offset | 7) + 1;
        return buf;
    };
}


/***/ }),

/***/ 633:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var OverloadYield = __webpack_require__(172);
var regenerator = __webpack_require__(993);
var regeneratorAsync = __webpack_require__(869);
var regeneratorAsyncGen = __webpack_require__(887);
var regeneratorAsyncIterator = __webpack_require__(791);
var regeneratorKeys = __webpack_require__(373);
var regeneratorValues = __webpack_require__(579);
function _regeneratorRuntime() {
  "use strict";

  var r = regenerator(),
    e = r.m(_regeneratorRuntime),
    t = (Object.getPrototypeOf ? Object.getPrototypeOf(e) : e.__proto__).constructor;
  function n(r) {
    var e = "function" == typeof r && r.constructor;
    return !!e && (e === t || "GeneratorFunction" === (e.displayName || e.name));
  }
  var o = {
    "throw": 1,
    "return": 2,
    "break": 3,
    "continue": 3
  };
  function a(r) {
    var e, t;
    return function (n) {
      e || (e = {
        stop: function stop() {
          return t(n.a, 2);
        },
        "catch": function _catch() {
          return n.v;
        },
        abrupt: function abrupt(r, e) {
          return t(n.a, o[r], e);
        },
        delegateYield: function delegateYield(r, o, a) {
          return e.resultName = o, t(n.d, regeneratorValues(r), a);
        },
        finish: function finish(r) {
          return t(n.f, r);
        }
      }, t = function t(r, _t, o) {
        n.p = e.prev, n.n = e.next;
        try {
          return r(_t, o);
        } finally {
          e.next = n.n;
        }
      }), e.resultName && (e[e.resultName] = n.v, e.resultName = void 0), e.sent = n.v, e.next = n.n;
      try {
        return r.call(this, e);
      } finally {
        n.p = e.prev, n.n = e.next;
      }
    };
  }
  return (module.exports = _regeneratorRuntime = function _regeneratorRuntime() {
    return {
      wrap: function wrap(e, t, n, o) {
        return r.w(a(e), t, n, o && o.reverse());
      },
      isGeneratorFunction: n,
      mark: r.m,
      awrap: function awrap(r, e) {
        return new OverloadYield(r, e);
      },
      AsyncIterator: regeneratorAsyncIterator,
      async: function async(r, e, t, o, u) {
        return (n(e) ? regeneratorAsyncGen : regeneratorAsync)(a(r), e, t, o, u);
      },
      keys: regeneratorKeys,
      values: regeneratorValues
    };
  }, module.exports.__esModule = true, module.exports["default"] = module.exports)();
}
module.exports = _regeneratorRuntime, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 688:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = Reader;

var util      = __webpack_require__(499);

var BufferReader; // cyclic

var LongBits  = util.LongBits,
    utf8      = util.utf8;

/* istanbul ignore next */
function indexOutOfRange(reader, writeLength) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}

/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */
function Reader(buffer) {

    /**
     * Read buffer.
     * @type {Uint8Array}
     */
    this.buf = buffer;

    /**
     * Read buffer position.
     * @type {number}
     */
    this.pos = 0;

    /**
     * Read buffer length.
     * @type {number}
     */
    this.len = buffer.length;

    /**
     * Whether to discard unknown fields while decoding.
     * @type {boolean}
     */
    this.discardUnknown = Reader.discardUnknown;
}

var create_array = typeof Uint8Array !== "undefined"
    ? function create_typed_array(buffer) {
        if (buffer instanceof Uint8Array || Array.isArray(buffer))
            return new Reader(buffer);
        throw Error("illegal buffer");
    }
    /* istanbul ignore next */
    : function create_array(buffer) {
        if (Array.isArray(buffer))
            return new Reader(buffer);
        throw Error("illegal buffer");
    };

var create = function create() {
    return util.Buffer
        ? function create_buffer_setup(buffer) {
            return (Reader.create = function create_buffer(buffer) {
                return util.Buffer.isBuffer(buffer)
                    ? new BufferReader(buffer)
                    /* istanbul ignore next */
                    : create_array(buffer);
            })(buffer);
        }
        /* istanbul ignore next */
        : create_array;
};

/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 * @throws {Error} If `buffer` is not a valid buffer
 */
Reader.create = create();

Reader.prototype._slice = util.Array.prototype.subarray || /* istanbul ignore next */ util.Array.prototype.slice;

/**
 * Returns raw bytes from the backing buffer without advancing the reader.
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Uint8Array} Raw bytes
 */
Reader.prototype.raw = function read_raw(start, end) {
    if (Array.isArray(this.buf)) // plain array
        return this.buf.slice(start, end);

    if (start === end) // fix for IE 10/Win8 and others' subarray returning array of size 1
        return new this.buf.constructor(0);
    return this._slice.call(this.buf, start, end);
};

/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.uint32 = function read_uint32() {
    var buf = this.buf,
        pos = this.pos,
        value = (buf[pos] & 127) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 7) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 14) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 21) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 15) << 28) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }

    for (var i = 0; i < 5; ++i) {
        /* istanbul ignore if */
        if (pos >= this.len) {
            this.pos = pos;
            throw indexOutOfRange(this);
        }
        if (buf[pos++] < 128) {
            this.pos = pos;
            return value;
        }
    }
    /* istanbul ignore next */
    this.pos = pos;
    throw Error("invalid varint encoding");
};

/**
 * Reads a field tag.
 * @function
 * @returns {number} Tag read
 */
Reader.prototype.tag = function read_tag() {
    var buf = this.buf,
        pos = this.pos,
        value = (buf[pos] & 127) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 7) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 14) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 127) << 21) >>> 0;
    if (buf[pos++] < 128) {
        this.pos = pos;
        return value;
    }
    value = (value | (buf[pos] & 15) << 28) >>> 0;
    if (buf[pos] < 128 && (buf[pos] & 112) === 0) {
        this.pos = pos + 1;
        return value;
    }

    this.pos = pos + 1;
    throw Error("invalid tag encoding");
};

/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader.prototype.int32 = function read_int32() {
    return this.uint32() | 0;
};

/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader.prototype.sint32 = function read_sint32() {
    var value = this.uint32();
    return value >>> 1 ^ -(value & 1) | 0;
};

/* eslint-disable no-invalid-this */

function readLongVarint() {
    // tends to deopt with local vars for octet etc.
    var bits = new LongBits(0, 0);
    var i = 0;
    if (this.len - this.pos > 4) { // fast route (lo)
        for (; i < 4; ++i) {
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        // 5th
        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >>  4) >>> 0;
        if (this.buf[this.pos++] < 128)
            return bits;
        i = 0;
    } else {
        for (; i < 4; ++i) {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        throw indexOutOfRange(this);
    }
    if (this.len - this.pos > 4) { // fast route (hi)
        for (; i < 5; ++i) {
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    } else {
        for (; i < 5; ++i) {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    }
    /* istanbul ignore next */
    throw Error("invalid varint encoding");
}

/* eslint-enable no-invalid-this */

/**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */
Reader.prototype.bool = function read_bool() {
    var value = false,
        b;
    for (var i = 0; i < 10; ++i) {
        /* istanbul ignore if */
        if (this.pos >= this.len)
            throw indexOutOfRange(this);
        b = this.buf[this.pos++];
        if (b & 127)
            value = true;
        if (b < 128)
            return value;
    }
    /* istanbul ignore next */
    throw Error("invalid varint encoding");
};

function readFixed32_end(buf, end) { // note that this uses `end`, not `pos`
    return (buf[end - 4]
          | buf[end - 3] << 8
          | buf[end - 2] << 16
          | buf[end - 1] << 24) >>> 0;
}

/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */
Reader.prototype.fixed32 = function read_fixed32() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32_end(this.buf, this.pos += 4);
};

/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */
Reader.prototype.sfixed32 = function read_sfixed32() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32_end(this.buf, this.pos += 4) | 0;
};

/* eslint-disable no-invalid-this */

function readFixed64(/* this: Reader */) {

    /* istanbul ignore if */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 8);

    return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
}

/* eslint-enable no-invalid-this */

/**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.float = function read_float() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    var value = util.float.readFloatLE(this.buf, this.pos);
    this.pos += 4;
    return value;
};

/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */
Reader.prototype.double = function read_double() {

    /* istanbul ignore if */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 4);

    var value = util.float.readDoubleLE(this.buf, this.pos);
    this.pos += 8;
    return value;
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */
Reader.prototype.bytes = function read_bytes() {
    var length = this.uint32(),
        start  = this.pos,
        end    = this.pos + length;

    /* istanbul ignore if */
    if (end > this.len)
        throw indexOutOfRange(this, length);

    this.pos = end;
    return this.raw(start, end);
};

/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */
Reader.prototype.string = function read_string() {
    var length = this.uint32(),
        start  = this.pos,
        end    = this.pos + length;

    /* istanbul ignore if */
    if (end > this.len)
        throw indexOutOfRange(this, length);

    this.pos = end;
    return utf8.read(this.buf, start, end);
};

/**
 * Reads a string preceeded by its byte length as a varint, rejecting invalid UTF8.
 * @returns {string} Value read
 */
Reader.prototype.stringVerify = function read_string_verify() {
    var length = this.uint32(),
        start  = this.pos,
        end    = this.pos + length;

    /* istanbul ignore if */
    if (end > this.len)
        throw indexOutOfRange(this, length);

    this.pos = end;
    return utf8.readStrict(this.buf, start, end);
};

/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */
Reader.prototype.skip = function skip(length) {
    if (typeof length === "number") {
        /* istanbul ignore if */
        if (this.pos + length > this.len)
            throw indexOutOfRange(this, length);
        this.pos += length;
    } else {
        do {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
        } while (this.buf[this.pos++] & 128);
    }
    return this;
};

/**
 * Recursion limit.
 * @type {number}
 */
Reader.recursionLimit = util.recursionLimit;

/**
 * Whether readers discard unknown fields while decoding.
 * @type {boolean}
 */
Reader.discardUnknown = true;

/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @param {number} [depth] Depth of recursion to control nested calls; 0 if omitted
 * @param {number} [fieldNumber] Field number for validating group end tags
 * @returns {Reader} `this`
 */
Reader.prototype.skipType = function(wireType, depth, fieldNumber) {
    if (depth === undefined) depth = 0;
    if (depth > Reader.recursionLimit)
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
            this.skip(this.uint32());
            break;
        case 3:
            while (true) {
                var tag = this.tag();
                var nestedField = tag >>> 3;
                wireType = tag & 7;
                if (!nestedField)
                    throw Error("illegal tag: field number 0");
                if (wireType === 4) {
                    if (fieldNumber !== undefined && nestedField !== fieldNumber)
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
    BufferReader = BufferReader_;
    Reader.create = create();
    BufferReader._configure();

    var fn = util.Long ? "toLong" : /* istanbul ignore next */ "toNumber";
    util.merge(Reader.prototype, {

        int64: function read_int64() {
            return readLongVarint.call(this)[fn](false);
        },

        uint64: function read_uint64() {
            return readLongVarint.call(this)[fn](true);
        },

        sint64: function read_sint64() {
            return readLongVarint.call(this).zzDecode()[fn](false);
        },

        fixed64: function read_fixed64() {
            return readFixed64.call(this)[fn](true);
        },

        sfixed64: function read_sfixed64() {
            return readFixed64.call(this)[fn](false);
        }

    });
};


/***/ }),

/***/ 738:
/***/ ((module) => {

function _typeof(o) {
  "@babel/helpers - typeof";

  return module.exports = _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, module.exports.__esModule = true, module.exports["default"] = module.exports, _typeof(o);
}
module.exports = _typeof, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 756:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

// TODO(Babel 8): Remove this file.

var runtime = __webpack_require__(633)();
module.exports = runtime;

// Copied from https://github.com/facebook/regenerator/blob/main/packages/runtime/runtime.js#L736=
try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}


/***/ }),

/***/ 791:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var OverloadYield = __webpack_require__(172);
var regeneratorDefine = __webpack_require__(546);
function AsyncIterator(t, e) {
  function n(r, o, i, f) {
    try {
      var c = t[r](o),
        u = c.value;
      return u instanceof OverloadYield ? e.resolve(u.v).then(function (t) {
        n("next", t, i, f);
      }, function (t) {
        n("throw", t, i, f);
      }) : e.resolve(u).then(function (t) {
        c.value = t, i(c);
      }, function (t) {
        return n("throw", t, i, f);
      });
    } catch (t) {
      f(t);
    }
  }
  var r;
  this.next || (regeneratorDefine(AsyncIterator.prototype), regeneratorDefine(AsyncIterator.prototype, "function" == typeof Symbol && Symbol.asyncIterator || "@asyncIterator", function () {
    return this;
  })), regeneratorDefine(this, "_invoke", function (t, o, i) {
    function f() {
      return new e(function (e, r) {
        n(t, i, e, r);
      });
    }
    return r = r ? r.then(f, f) : f();
  }, !0);
}
module.exports = AsyncIterator, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 804:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

module.exports = Writer;

var util      = __webpack_require__(499);

var BufferWriter; // cyclic

var LongBits  = util.LongBits,
    base64    = util.base64,
    utf8      = util.utf8;

/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */
function Op(fn, len, val) {

    /**
     * Function to call.
     * @type {function(Uint8Array, number, *)}
     */
    this.fn = fn;

    /**
     * Value byte length.
     * @type {number}
     */
    this.len = len;

    /**
     * Next operation.
     * @type {Writer.Op|undefined}
     */
    this.next = undefined;

    /**
     * Value to write.
     * @type {*}
     */
    this.val = val; // type varies
}

/* istanbul ignore next */
function noop() {} // eslint-disable-line no-empty-function

/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @ignore
 */
function State(writer) {

    /**
     * Current head.
     * @type {Writer.Op}
     */
    this.head = writer.head;

    /**
     * Current tail.
     * @type {Writer.Op}
     */
    this.tail = writer.tail;

    /**
     * Current buffer length.
     * @type {number}
     */
    this.len = writer.len;

    /**
     * Next state.
     * @type {State|null}
     */
    this.next = writer.states;
}

/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */
function Writer() {

    /**
     * Current length.
     * @type {number}
     */
    this.len = 0;

    /**
     * Operations head.
     * @type {Object}
     */
    this.head = new Op(noop, 0, 0);

    /**
     * Operations tail
     * @type {Object}
     */
    this.tail = this.head;

    /**
     * Linked forked states.
     * @type {Object|null}
     */
    this.states = null;

    // When a value is written, the writer calculates its byte length and puts it into a linked
    // list of operations to perform when finish() is called. This both allows us to allocate
    // buffers of the exact required size and reduces the amount of work we have to do compared
    // to first calculating over objects and then encoding over objects. In our case, the encoding
    // part is just a linked list walk calling operations with already prepared values.
}

var create = function create() {
    return util.Buffer
        ? function create_buffer_setup() {
            return (Writer.create = function create_buffer() {
                return new BufferWriter();
            })();
        }
        /* istanbul ignore next */
        : function create_array() {
            return new Writer();
        };
};

/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */
Writer.create = create();

/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */
Writer.alloc = function alloc(size) {
    return new util.Array(size);
};

// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */
if (util.Array !== Array)
    Writer.alloc = util.pool(Writer.alloc, util.Array.prototype.subarray);

/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 * @private
 */
Writer.prototype._push = function push(fn, len, val) {
    this.tail = this.tail.next = new Op(fn, len, val);
    this.len += len;
    return this;
};

function writeByte(val, buf, pos) {
    buf[pos] = val & 255;
}

function writeStringAscii(val, buf, pos) {
    for (var i = 0; i < val.length;)
        buf[pos++] = val.charCodeAt(i++);
}

function writeVarint32(val, buf, pos) {
    while (val > 127) {
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}

/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */
function VarintOp(len, val) {
    this.len = len;
    this.next = undefined;
    this.val = val;
}

VarintOp.prototype = Object.create(Op.prototype);
VarintOp.prototype.fn = writeVarint32;

/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.uint32 = function write_uint32(value) {
    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
    // uint32 is by far the most frequently used operation and benefits significantly from this.
    this.len += (this.tail = this.tail.next = new VarintOp(
        (value = value >>> 0)
                < 128       ? 1
        : value < 16384     ? 2
        : value < 2097152   ? 3
        : value < 268435456 ? 4
        :                     5,
    value)).len;
    return this;
};

/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.int32 = function write_int32(value) {
    return (value |= 0) < 0
        ? this._push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
        : this.uint32(value);
};

/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.sint32 = function write_sint32(value) {
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
};

function writeVarint64(val, buf, pos) {
    var lo = val.lo,
        hi = val.hi;
    while (hi) {
        buf[pos++] = lo & 127 | 128;
        lo = (lo >>> 7 | hi << 25) >>> 0;
        hi >>>= 7;
    }
    while (lo > 127) {
        buf[pos++] = lo & 127 | 128;
        lo = lo >>> 7;
    }
    buf[pos++] = lo;
}

/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.uint64 = function write_uint64(value) {
    var bits = LongBits.from(value);
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.int64 = Writer.prototype.uint64;

/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.sint64 = function write_sint64(value) {
    var bits = LongBits.from(value).zzEncode();
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.bool = function write_bool(value) {
    return this._push(writeByte, 1, value ? 1 : 0);
};

function writeFixed32(val, buf, pos) {
    buf[pos    ] =  val         & 255;
    buf[pos + 1] =  val >>> 8   & 255;
    buf[pos + 2] =  val >>> 16  & 255;
    buf[pos + 3] =  val >>> 24;
}

/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.fixed32 = function write_fixed32(value) {
    return this._push(writeFixed32, 4, value >>> 0);
};

/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.sfixed32 = Writer.prototype.fixed32;

/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.fixed64 = function write_fixed64(value) {
    var bits = LongBits.from(value);
    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
};

/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer.prototype.sfixed64 = Writer.prototype.fixed64;

/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.float = function write_float(value) {
    return this._push(util.float.writeFloatLE, 4, value);
};

/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.double = function write_double(value) {
    return this._push(util.float.writeDoubleLE, 8, value);
};

var writeBytes = util.Array.prototype.set
    ? function writeBytes_set(val, buf, pos) {
        buf.set(val, pos); // also works for plain array values
    }
    /* istanbul ignore next */
    : function writeBytes_for(val, buf, pos) {
        for (var i = 0; i < val.length; ++i)
            buf[pos + i] = val[i];
    };

/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */
Writer.prototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    if (!len)
        return this._push(writeByte, 1, 0);
    if (util.isString(value)) {
        var buf = Writer.alloc(len = base64.length(value));
        base64.decode(value, buf, 0);
        value = buf;
    }
    return this.uint32(len)._push(writeBytes, len, value);
};

/**
 * Writes raw bytes without a tag or length prefix.
 * @param {Uint8Array} value Raw bytes
 * @returns {Writer} `this`
 */
Writer.prototype.raw = function write_raw(value) {
    var len = value.length >>> 0;
    return len ? this._push(writeBytes, len, value) : this;
};

/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */
Writer.prototype.string = function write_string(value) {
    var len = utf8.length(value);
    return len
        ? this.uint32(len)._push(len === value.length ? writeStringAscii : utf8.write, len, value)
        : this._push(writeByte, 1, 0);
};

/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */
Writer.prototype.fork = function fork() {
    this.states = new State(this);
    this.head = this.tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};

/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */
Writer.prototype.reset = function reset() {
    if (this.states) {
        this.head   = this.states.head;
        this.tail   = this.states.tail;
        this.len    = this.states.len;
        this.states = this.states.next;
    } else {
        this.head = this.tail = new Op(noop, 0, 0);
        this.len  = 0;
    }
    return this;
};

/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */
Writer.prototype.ldelim = function ldelim() {
    var head = this.head,
        tail = this.tail,
        len  = this.len;
    this.reset().uint32(len);
    if (len) {
        this.tail.next = head.next; // skip noop
        this.tail = tail;
        this.len += len;
    }
    return this;
};

/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */
Writer.prototype.finish = function finish() {
    return this.finishInto(this.constructor.alloc(this.len), 0);
};

/**
 * Finishes the write operation, writing into the provided buffer.
 * The caller must ensure that `buf` has enough space starting at `offset`
 * to hold {@link Writer#len} bytes.
 * @param {T} buf Target buffer
 * @param {number} [offset=0] Offset to start writing at
 * @returns {T} The provided buffer
 * @template T extends Uint8Array
 */
Writer.prototype.finishInto = function finishInto(buf, offset) {
    if (offset === undefined)
        offset = 0;
    var head = this.head.next,
        pos  = offset;
    while (head) {
        head.fn(head.val, buf, pos);
        pos += head.len;
        head = head.next;
    }
    return buf;
};

Writer._configure = function(BufferWriter_) {
    BufferWriter = BufferWriter_;
    Writer.create = create();
    BufferWriter._configure();
};


/***/ }),

/***/ 869:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var regeneratorAsyncGen = __webpack_require__(887);
function _regeneratorAsync(n, e, r, t, o) {
  var a = regeneratorAsyncGen(n, e, r, t, o);
  return a.next().then(function (n) {
    return n.done ? n.value : a.next();
  });
}
module.exports = _regeneratorAsync, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 873:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";


/**
 * Build type, one of `"full"`, `"light"` or `"minimal"`.
 * @name build
 * @type {string}
 * @const
 */
exports.build = "minimal";

// Serialization
exports.Writer = __webpack_require__(804);
exports.BufferWriter = __webpack_require__(453);
exports.Reader = __webpack_require__(688);
exports.BufferReader = __webpack_require__(49);

// Utility
exports.util = __webpack_require__(499);
exports.rpc = __webpack_require__(296);
exports.roots = __webpack_require__(226);
exports.configure    = configure;

/* istanbul ignore next */
/**
 * Reconfigures the library according to the environment.
 * @returns {undefined}
 */
function configure() {
    exports.util._configure();
    exports.Writer._configure(exports.BufferWriter);
    exports.Reader._configure(exports.BufferReader);
}

// Set up buffer utility according to the environment
configure();


/***/ }),

/***/ 887:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var regenerator = __webpack_require__(993);
var regeneratorAsyncIterator = __webpack_require__(791);
function _regeneratorAsyncGen(r, e, t, o, n) {
  return new regeneratorAsyncIterator(regenerator().w(r, e, t, o), n || Promise);
}
module.exports = _regeneratorAsyncGen, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ }),

/***/ 949:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/


var $protobuf = __webpack_require__(361);

// Common aliases
var $Reader = $protobuf.Reader,
  $Writer = $protobuf.Writer,
  $util = $protobuf.util;
var $Object = $util.global.Object,
  $undefined = $util.global.undefined,
  $Error = $util.global.Error,
  $TypeError = $util.global.TypeError,
  $String = $util.global.String,
  $Number = $util.global.Number,
  $Array = $util.global.Array,
  $Boolean = $util.global.Boolean,
  $parseInt = $util.global.parseInt,
  $BigInt = $util.global.BigInt;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.pubsub = (function () {
  /**
   * Namespace pubsub.
   * @exports pubsub
   * @namespace
   */
  var pubsub = {};

  pubsub.Subscribe = (function () {
    /**
     * Properties of a Subscribe.
     * @typedef {Object} pubsub.Subscribe.$Properties
     * @property {string|null} [topic] Subscribe topic
     * @property {string|null} [peerId] Subscribe peerId
     * @property {number|null} [oldMessageLimit] Subscribe oldMessageLimit
     * @property {string|null} [realtimeOverflow] Subscribe realtimeOverflow
     * @property {number|null} [queueSize] Subscribe queueSize
     * @property {string|null} [requestId] Subscribe requestId
     * @property {number|null} [newMessageLimit] Subscribe newMessageLimit
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a Subscribe.
     * @memberof pubsub
     * @interface ISubscribe
     * @augments pubsub.Subscribe.$Properties
     * @deprecated Use pubsub.Subscribe.$Properties instead.
     */

    /**
     * Shape of a Subscribe.
     * @typedef {pubsub.Subscribe.$Properties} pubsub.Subscribe.$Shape
     */

    /**
     * Constructs a new Subscribe.
     * @memberof pubsub
     * @classdesc Represents a Subscribe.
     * @constructor
     * @param {pubsub.Subscribe.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Subscribe = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Subscribe topic.
     * @member {string} topic
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.topic = "";

    /**
     * Subscribe peerId.
     * @member {string} peerId
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.peerId = "";

    /**
     * Subscribe oldMessageLimit.
     * @member {number} oldMessageLimit
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.oldMessageLimit = 0;

    /**
     * Subscribe realtimeOverflow.
     * @member {string} realtimeOverflow
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.realtimeOverflow = "";

    /**
     * Subscribe queueSize.
     * @member {number} queueSize
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.queueSize = 0;

    /**
     * Subscribe requestId.
     * @member {string} requestId
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.requestId = "";

    /**
     * Subscribe newMessageLimit.
     * @member {number} newMessageLimit
     * @memberof pubsub.Subscribe
     * @instance
     */
    Subscribe.prototype.newMessageLimit = 0;

    /**
     * Creates a new Subscribe instance using the specified properties.
     * @function create
     * @memberof pubsub.Subscribe
     * @static
     * @param {pubsub.Subscribe.$Properties=} [properties] Properties to set
     * @returns {pubsub.Subscribe} Subscribe instance
     * @type {{
     *   (properties: pubsub.Subscribe.$Shape): pubsub.Subscribe & pubsub.Subscribe.$Shape;
     *   (properties?: pubsub.Subscribe.$Properties): pubsub.Subscribe;
     * }}
     */
    Subscribe.create = function (properties) {
      return new Subscribe(properties);
    };

    /**
     * Encodes the specified Subscribe message. Does not implicitly {@link pubsub.Subscribe.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Subscribe
     * @static
     * @param {pubsub.Subscribe.$Properties} message Subscribe message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Subscribe.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic") &&
        message.topic !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.topic);
      if (
        message.peerId != null &&
        $Object.hasOwnProperty.call(message, "peerId") &&
        message.peerId !== ""
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.peerId);
      if (
        message.oldMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "oldMessageLimit") &&
        message.oldMessageLimit !== 0
      )
        writer
          .uint32(/* id 3, wireType 0 =*/ 24)
          .int32(message.oldMessageLimit);
      if (
        message.realtimeOverflow != null &&
        $Object.hasOwnProperty.call(message, "realtimeOverflow") &&
        message.realtimeOverflow !== ""
      )
        writer
          .uint32(/* id 4, wireType 2 =*/ 34)
          .string(message.realtimeOverflow);
      if (
        message.queueSize != null &&
        $Object.hasOwnProperty.call(message, "queueSize") &&
        message.queueSize !== 0
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).int32(message.queueSize);
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 6, wireType 2 =*/ 50).string(message.requestId);
      if (
        message.newMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "newMessageLimit") &&
        message.newMessageLimit !== 0
      )
        writer
          .uint32(/* id 7, wireType 0 =*/ 56)
          .int32(message.newMessageLimit);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Subscribe message, length delimited. Does not implicitly {@link pubsub.Subscribe.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Subscribe
     * @static
     * @param {pubsub.Subscribe.$Properties} message Subscribe message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Subscribe.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a Subscribe message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Subscribe
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Subscribe & pubsub.Subscribe.$Shape} Subscribe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Subscribe.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Subscribe(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.topic = value;
            else delete message.topic;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.peerId = value;
            else delete message.peerId;
            continue;
          }
          case 3: {
            if (wireType !== 0) break;
            if ((value = reader.int32())) message.oldMessageLimit = value;
            else delete message.oldMessageLimit;
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.realtimeOverflow = value;
            else delete message.realtimeOverflow;
            continue;
          }
          case 5: {
            if (wireType !== 0) break;
            if ((value = reader.int32())) message.queueSize = value;
            else delete message.queueSize;
            continue;
          }
          case 6: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
          case 7: {
            if (wireType !== 0) break;
            if ((value = reader.int32())) message.newMessageLimit = value;
            else delete message.newMessageLimit;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a Subscribe message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Subscribe
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Subscribe & pubsub.Subscribe.$Shape} Subscribe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Subscribe.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Subscribe message.
     * @function verify
     * @memberof pubsub.Subscribe
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Subscribe.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (
        message.peerId != null &&
        $Object.hasOwnProperty.call(message, "peerId")
      )
        if (!$util.isString(message.peerId)) return "peerId: string expected";
      if (
        message.oldMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "oldMessageLimit")
      )
        if (!$util.isInteger(message.oldMessageLimit))
          return "oldMessageLimit: integer expected";
      if (
        message.realtimeOverflow != null &&
        $Object.hasOwnProperty.call(message, "realtimeOverflow")
      )
        if (!$util.isString(message.realtimeOverflow))
          return "realtimeOverflow: string expected";
      if (
        message.queueSize != null &&
        $Object.hasOwnProperty.call(message, "queueSize")
      )
        if (!$util.isInteger(message.queueSize))
          return "queueSize: integer expected";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      if (
        message.newMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "newMessageLimit")
      )
        if (!$util.isInteger(message.newMessageLimit))
          return "newMessageLimit: integer expected";
      return null;
    };

    /**
     * Creates a Subscribe message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Subscribe
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Subscribe} Subscribe
     */
    Subscribe.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Subscribe) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Subscribe: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Subscribe();
      if (object.topic != null)
        if (typeof object.topic !== "string" || object.topic.length)
          message.topic = $String(object.topic);
      if (object.peerId != null)
        if (typeof object.peerId !== "string" || object.peerId.length)
          message.peerId = $String(object.peerId);
      if (object.oldMessageLimit != null)
        if ($Number(object.oldMessageLimit) !== 0)
          message.oldMessageLimit = object.oldMessageLimit | 0;
      if (object.realtimeOverflow != null)
        if (
          typeof object.realtimeOverflow !== "string" ||
          object.realtimeOverflow.length
        )
          message.realtimeOverflow = $String(object.realtimeOverflow);
      if (object.queueSize != null)
        if ($Number(object.queueSize) !== 0)
          message.queueSize = object.queueSize | 0;
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      if (object.newMessageLimit != null)
        if ($Number(object.newMessageLimit) !== 0)
          message.newMessageLimit = object.newMessageLimit | 0;
      return message;
    };

    /**
     * Creates a plain object from a Subscribe message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Subscribe
     * @static
     * @param {pubsub.Subscribe} message Subscribe
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Subscribe.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults) {
        object.topic = "";
        object.peerId = "";
        object.oldMessageLimit = 0;
        object.realtimeOverflow = "";
        object.queueSize = 0;
        object.requestId = "";
        object.newMessageLimit = 0;
      }
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        object.topic = message.topic;
      if (
        message.peerId != null &&
        $Object.hasOwnProperty.call(message, "peerId")
      )
        object.peerId = message.peerId;
      if (
        message.oldMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "oldMessageLimit")
      )
        object.oldMessageLimit = message.oldMessageLimit;
      if (
        message.realtimeOverflow != null &&
        $Object.hasOwnProperty.call(message, "realtimeOverflow")
      )
        object.realtimeOverflow = message.realtimeOverflow;
      if (
        message.queueSize != null &&
        $Object.hasOwnProperty.call(message, "queueSize")
      )
        object.queueSize = message.queueSize;
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      if (
        message.newMessageLimit != null &&
        $Object.hasOwnProperty.call(message, "newMessageLimit")
      )
        object.newMessageLimit = message.newMessageLimit;
      return object;
    };

    /**
     * Converts this Subscribe to JSON.
     * @function toJSON
     * @memberof pubsub.Subscribe
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Subscribe.prototype.toJSON = function () {
      return Subscribe.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Subscribe
     * @function getTypeUrl
     * @memberof pubsub.Subscribe
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Subscribe.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Subscribe";
    };

    return Subscribe;
  })();

  pubsub.Unsubscribe = (function () {
    /**
     * Properties of an Unsubscribe.
     * @typedef {Object} pubsub.Unsubscribe.$Properties
     * @property {string|null} [topic] Unsubscribe topic
     * @property {string|null} [requestId] Unsubscribe requestId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of an Unsubscribe.
     * @memberof pubsub
     * @interface IUnsubscribe
     * @augments pubsub.Unsubscribe.$Properties
     * @deprecated Use pubsub.Unsubscribe.$Properties instead.
     */

    /**
     * Shape of an Unsubscribe.
     * @typedef {pubsub.Unsubscribe.$Properties} pubsub.Unsubscribe.$Shape
     */

    /**
     * Constructs a new Unsubscribe.
     * @memberof pubsub
     * @classdesc Represents an Unsubscribe.
     * @constructor
     * @param {pubsub.Unsubscribe.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Unsubscribe = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Unsubscribe topic.
     * @member {string} topic
     * @memberof pubsub.Unsubscribe
     * @instance
     */
    Unsubscribe.prototype.topic = "";

    /**
     * Unsubscribe requestId.
     * @member {string} requestId
     * @memberof pubsub.Unsubscribe
     * @instance
     */
    Unsubscribe.prototype.requestId = "";

    /**
     * Creates a new Unsubscribe instance using the specified properties.
     * @function create
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {pubsub.Unsubscribe.$Properties=} [properties] Properties to set
     * @returns {pubsub.Unsubscribe} Unsubscribe instance
     * @type {{
     *   (properties: pubsub.Unsubscribe.$Shape): pubsub.Unsubscribe & pubsub.Unsubscribe.$Shape;
     *   (properties?: pubsub.Unsubscribe.$Properties): pubsub.Unsubscribe;
     * }}
     */
    Unsubscribe.create = function (properties) {
      return new Unsubscribe(properties);
    };

    /**
     * Encodes the specified Unsubscribe message. Does not implicitly {@link pubsub.Unsubscribe.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {pubsub.Unsubscribe.$Properties} message Unsubscribe message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Unsubscribe.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic") &&
        message.topic !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.topic);
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.requestId);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Unsubscribe message, length delimited. Does not implicitly {@link pubsub.Unsubscribe.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {pubsub.Unsubscribe.$Properties} message Unsubscribe message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Unsubscribe.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes an Unsubscribe message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Unsubscribe & pubsub.Unsubscribe.$Shape} Unsubscribe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Unsubscribe.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Unsubscribe(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.topic = value;
            else delete message.topic;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes an Unsubscribe message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Unsubscribe & pubsub.Unsubscribe.$Shape} Unsubscribe
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Unsubscribe.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Unsubscribe message.
     * @function verify
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Unsubscribe.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      return null;
    };

    /**
     * Creates an Unsubscribe message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Unsubscribe} Unsubscribe
     */
    Unsubscribe.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Unsubscribe) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Unsubscribe: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Unsubscribe();
      if (object.topic != null)
        if (typeof object.topic !== "string" || object.topic.length)
          message.topic = $String(object.topic);
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      return message;
    };

    /**
     * Creates a plain object from an Unsubscribe message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {pubsub.Unsubscribe} message Unsubscribe
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Unsubscribe.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults) {
        object.topic = "";
        object.requestId = "";
      }
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        object.topic = message.topic;
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      return object;
    };

    /**
     * Converts this Unsubscribe to JSON.
     * @function toJSON
     * @memberof pubsub.Unsubscribe
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Unsubscribe.prototype.toJSON = function () {
      return Unsubscribe.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Unsubscribe
     * @function getTypeUrl
     * @memberof pubsub.Unsubscribe
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Unsubscribe.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Unsubscribe";
    };

    return Unsubscribe;
  })();

  pubsub.Publish = (function () {
    /**
     * Properties of a Publish.
     * @typedef {Object} pubsub.Publish.$Properties
     * @property {string|null} [topic] Publish topic
     * @property {Uint8Array|null} [payload] Publish payload
     * @property {string|null} [message] Publish message
     * @property {Array.<string>|null} [sendOnly] Publish sendOnly
     * @property {string|null} [timestamp] Publish timestamp
     * @property {string|null} [senderId] Publish senderId
     * @property {string|null} [senderName] Publish senderName
     * @property {boolean|null} [persist] Publish persist
     * @property {string|null} [messageId] Publish messageId
     * @property {string|null} [requestId] Publish requestId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a Publish.
     * @memberof pubsub
     * @interface IPublish
     * @augments pubsub.Publish.$Properties
     * @deprecated Use pubsub.Publish.$Properties instead.
     */

    /**
     * Shape of a Publish.
     * @typedef {pubsub.Publish.$Properties} pubsub.Publish.$Shape
     */

    /**
     * Constructs a new Publish.
     * @memberof pubsub
     * @classdesc Represents a Publish.
     * @constructor
     * @param {pubsub.Publish.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Publish = function (properties) {
      this.sendOnly = [];
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Publish topic.
     * @member {string} topic
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.topic = "";

    /**
     * Publish payload.
     * @member {Uint8Array} payload
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.payload = $util.newBuffer([]);

    /**
     * Publish message.
     * @member {string} message
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.message = "";

    /**
     * Publish sendOnly.
     * @member {Array.<string>} sendOnly
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.sendOnly = $util.emptyArray;

    /**
     * Publish timestamp.
     * @member {string} timestamp
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.timestamp = "";

    /**
     * Publish senderId.
     * @member {string} senderId
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.senderId = "";

    /**
     * Publish senderName.
     * @member {string} senderName
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.senderName = "";

    /**
     * Publish persist.
     * @member {boolean} persist
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.persist = false;

    /**
     * Publish messageId.
     * @member {string} messageId
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.messageId = "";

    /**
     * Publish requestId.
     * @member {string} requestId
     * @memberof pubsub.Publish
     * @instance
     */
    Publish.prototype.requestId = "";

    /**
     * Creates a new Publish instance using the specified properties.
     * @function create
     * @memberof pubsub.Publish
     * @static
     * @param {pubsub.Publish.$Properties=} [properties] Properties to set
     * @returns {pubsub.Publish} Publish instance
     * @type {{
     *   (properties: pubsub.Publish.$Shape): pubsub.Publish & pubsub.Publish.$Shape;
     *   (properties?: pubsub.Publish.$Properties): pubsub.Publish;
     * }}
     */
    Publish.create = function (properties) {
      return new Publish(properties);
    };

    /**
     * Encodes the specified Publish message. Does not implicitly {@link pubsub.Publish.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Publish
     * @static
     * @param {pubsub.Publish.$Properties} message Publish message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Publish.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic") &&
        message.topic !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.topic);
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload") &&
        message.payload.length
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.payload);
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message") &&
        message.message !== ""
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.message);
      if (message.sendOnly != null && message.sendOnly.length)
        for (var i = 0; i < message.sendOnly.length; ++i)
          writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.sendOnly[i]);
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp") &&
        message.timestamp !== ""
      )
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.timestamp);
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId") &&
        message.senderId !== ""
      )
        writer.uint32(/* id 6, wireType 2 =*/ 50).string(message.senderId);
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName") &&
        message.senderName !== ""
      )
        writer.uint32(/* id 7, wireType 2 =*/ 58).string(message.senderName);
      if (
        message.persist != null &&
        $Object.hasOwnProperty.call(message, "persist") &&
        message.persist !== false
      )
        writer.uint32(/* id 8, wireType 0 =*/ 64).bool(message.persist);
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId") &&
        message.messageId !== ""
      )
        writer.uint32(/* id 9, wireType 2 =*/ 74).string(message.messageId);
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 10, wireType 2 =*/ 82).string(message.requestId);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Publish message, length delimited. Does not implicitly {@link pubsub.Publish.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Publish
     * @static
     * @param {pubsub.Publish.$Properties} message Publish message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Publish.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a Publish message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Publish
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Publish & pubsub.Publish.$Shape} Publish
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Publish.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Publish(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.topic = value;
            else delete message.topic;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if ((value = reader.bytes()).length) message.payload = value;
            else delete message.payload;
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.message = value;
            else delete message.message;
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            if (!(message.sendOnly && message.sendOnly.length))
              message.sendOnly = [];
            message.sendOnly.push(reader.stringVerify());
            continue;
          }
          case 5: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.timestamp = value;
            else delete message.timestamp;
            continue;
          }
          case 6: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.senderId = value;
            else delete message.senderId;
            continue;
          }
          case 7: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.senderName = value;
            else delete message.senderName;
            continue;
          }
          case 8: {
            if (wireType !== 0) break;
            if ((value = reader.bool())) message.persist = value;
            else delete message.persist;
            continue;
          }
          case 9: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.messageId = value;
            else delete message.messageId;
            continue;
          }
          case 10: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a Publish message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Publish
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Publish & pubsub.Publish.$Shape} Publish
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Publish.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Publish message.
     * @function verify
     * @memberof pubsub.Publish
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Publish.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload")
      )
        if (!(
          (message.payload && typeof message.payload.length === "number") ||
          $util.isString(message.payload)
        ))
          return "payload: buffer expected";
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message")
      )
        if (!$util.isString(message.message)) return "message: string expected";
      if (
        message.sendOnly != null &&
        $Object.hasOwnProperty.call(message, "sendOnly")
      ) {
        if (!$Array.isArray(message.sendOnly))
          return "sendOnly: array expected";
        for (var i = 0; i < message.sendOnly.length; ++i)
          if (!$util.isString(message.sendOnly[i]))
            return "sendOnly: string[] expected";
      }
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp")
      )
        if (!$util.isString(message.timestamp))
          return "timestamp: string expected";
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId")
      )
        if (!$util.isString(message.senderId))
          return "senderId: string expected";
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName")
      )
        if (!$util.isString(message.senderName))
          return "senderName: string expected";
      if (
        message.persist != null &&
        $Object.hasOwnProperty.call(message, "persist")
      )
        if (typeof message.persist !== "boolean")
          return "persist: boolean expected";
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        if (!$util.isString(message.messageId))
          return "messageId: string expected";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      return null;
    };

    /**
     * Creates a Publish message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Publish
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Publish} Publish
     */
    Publish.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Publish) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Publish: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Publish();
      if (object.topic != null)
        if (typeof object.topic !== "string" || object.topic.length)
          message.topic = $String(object.topic);
      if (object.payload != null)
        if (object.payload.length)
          if (typeof object.payload === "string")
            $util.base64.decode(
              object.payload,
              (message.payload = $util.newBuffer(
                $util.base64.length(object.payload)
              )),
              0
            );
          else if (object.payload.length >= 0) message.payload = object.payload;
      if (object.message != null)
        if (typeof object.message !== "string" || object.message.length)
          message.message = $String(object.message);
      if (object.sendOnly) {
        if (!$Array.isArray(object.sendOnly))
          throw $TypeError(".pubsub.Publish.sendOnly: array expected");
        message.sendOnly = $Array(object.sendOnly.length);
        for (var i = 0; i < object.sendOnly.length; ++i)
          message.sendOnly[i] = $String(object.sendOnly[i]);
      }
      if (object.timestamp != null)
        if (typeof object.timestamp !== "string" || object.timestamp.length)
          message.timestamp = $String(object.timestamp);
      if (object.senderId != null)
        if (typeof object.senderId !== "string" || object.senderId.length)
          message.senderId = $String(object.senderId);
      if (object.senderName != null)
        if (typeof object.senderName !== "string" || object.senderName.length)
          message.senderName = $String(object.senderName);
      if (object.persist != null)
        if (object.persist) message.persist = $Boolean(object.persist);
      if (object.messageId != null)
        if (typeof object.messageId !== "string" || object.messageId.length)
          message.messageId = $String(object.messageId);
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      return message;
    };

    /**
     * Creates a plain object from a Publish message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Publish
     * @static
     * @param {pubsub.Publish} message Publish
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Publish.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.arrays || options.defaults) object.sendOnly = [];
      if (options.defaults) {
        object.topic = "";
        if (options.bytes === $String) object.payload = "";
        else {
          object.payload = [];
          if (options.bytes !== $Array)
            object.payload = $util.newBuffer(object.payload);
        }
        object.message = "";
        object.timestamp = "";
        object.senderId = "";
        object.senderName = "";
        object.persist = false;
        object.messageId = "";
        object.requestId = "";
      }
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        object.topic = message.topic;
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload")
      )
        object.payload =
          options.bytes === $String
            ? $util.base64.encode(message.payload, 0, message.payload.length)
            : options.bytes === $Array
              ? $Array.prototype.slice.call(message.payload)
              : message.payload;
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message")
      )
        object.message = message.message;
      if (message.sendOnly && message.sendOnly.length) {
        object.sendOnly = $Array(message.sendOnly.length);
        for (var j = 0; j < message.sendOnly.length; ++j)
          object.sendOnly[j] = message.sendOnly[j];
      }
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp")
      )
        object.timestamp = message.timestamp;
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId")
      )
        object.senderId = message.senderId;
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName")
      )
        object.senderName = message.senderName;
      if (
        message.persist != null &&
        $Object.hasOwnProperty.call(message, "persist")
      )
        object.persist = message.persist;
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        object.messageId = message.messageId;
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      return object;
    };

    /**
     * Converts this Publish to JSON.
     * @function toJSON
     * @memberof pubsub.Publish
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Publish.prototype.toJSON = function () {
      return Publish.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Publish
     * @function getTypeUrl
     * @memberof pubsub.Publish
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Publish.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Publish";
    };

    return Publish;
  })();

  pubsub.GetHistory = (function () {
    /**
     * Properties of a GetHistory.
     * @typedef {Object} pubsub.GetHistory.$Properties
     * @property {string|null} [topic] GetHistory topic
     * @property {string|null} [persistMsgId] GetHistory persistMsgId
     * @property {number|null} [batchSize] GetHistory batchSize
     * @property {string|null} [requestId] GetHistory requestId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a GetHistory.
     * @memberof pubsub
     * @interface IGetHistory
     * @augments pubsub.GetHistory.$Properties
     * @deprecated Use pubsub.GetHistory.$Properties instead.
     */

    /**
     * Shape of a GetHistory.
     * @typedef {pubsub.GetHistory.$Properties} pubsub.GetHistory.$Shape
     */

    /**
     * Constructs a new GetHistory.
     * @memberof pubsub
     * @classdesc Represents a GetHistory.
     * @constructor
     * @param {pubsub.GetHistory.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var GetHistory = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * GetHistory topic.
     * @member {string} topic
     * @memberof pubsub.GetHistory
     * @instance
     */
    GetHistory.prototype.topic = "";

    /**
     * GetHistory persistMsgId.
     * @member {string} persistMsgId
     * @memberof pubsub.GetHistory
     * @instance
     */
    GetHistory.prototype.persistMsgId = "";

    /**
     * GetHistory batchSize.
     * @member {number} batchSize
     * @memberof pubsub.GetHistory
     * @instance
     */
    GetHistory.prototype.batchSize = 0;

    /**
     * GetHistory requestId.
     * @member {string} requestId
     * @memberof pubsub.GetHistory
     * @instance
     */
    GetHistory.prototype.requestId = "";

    /**
     * Creates a new GetHistory instance using the specified properties.
     * @function create
     * @memberof pubsub.GetHistory
     * @static
     * @param {pubsub.GetHistory.$Properties=} [properties] Properties to set
     * @returns {pubsub.GetHistory} GetHistory instance
     * @type {{
     *   (properties: pubsub.GetHistory.$Shape): pubsub.GetHistory & pubsub.GetHistory.$Shape;
     *   (properties?: pubsub.GetHistory.$Properties): pubsub.GetHistory;
     * }}
     */
    GetHistory.create = function (properties) {
      return new GetHistory(properties);
    };

    /**
     * Encodes the specified GetHistory message. Does not implicitly {@link pubsub.GetHistory.verify|verify} messages.
     * @function encode
     * @memberof pubsub.GetHistory
     * @static
     * @param {pubsub.GetHistory.$Properties} message GetHistory message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetHistory.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic") &&
        message.topic !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.topic);
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId") &&
        message.persistMsgId !== ""
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).string(message.persistMsgId);
      if (
        message.batchSize != null &&
        $Object.hasOwnProperty.call(message, "batchSize") &&
        message.batchSize !== 0
      )
        writer.uint32(/* id 3, wireType 0 =*/ 24).uint32(message.batchSize);
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.requestId);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified GetHistory message, length delimited. Does not implicitly {@link pubsub.GetHistory.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.GetHistory
     * @static
     * @param {pubsub.GetHistory.$Properties} message GetHistory message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    GetHistory.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a GetHistory message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.GetHistory
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.GetHistory & pubsub.GetHistory.$Shape} GetHistory
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetHistory.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.GetHistory(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.topic = value;
            else delete message.topic;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.persistMsgId = value;
            else delete message.persistMsgId;
            continue;
          }
          case 3: {
            if (wireType !== 0) break;
            if ((value = reader.uint32())) message.batchSize = value;
            else delete message.batchSize;
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a GetHistory message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.GetHistory
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.GetHistory & pubsub.GetHistory.$Shape} GetHistory
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    GetHistory.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a GetHistory message.
     * @function verify
     * @memberof pubsub.GetHistory
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    GetHistory.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId")
      )
        if (!$util.isString(message.persistMsgId))
          return "persistMsgId: string expected";
      if (
        message.batchSize != null &&
        $Object.hasOwnProperty.call(message, "batchSize")
      )
        if (!$util.isInteger(message.batchSize))
          return "batchSize: integer expected";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      return null;
    };

    /**
     * Creates a GetHistory message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.GetHistory
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.GetHistory} GetHistory
     */
    GetHistory.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.GetHistory) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.GetHistory: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.GetHistory();
      if (object.topic != null)
        if (typeof object.topic !== "string" || object.topic.length)
          message.topic = $String(object.topic);
      if (object.persistMsgId != null)
        if (
          typeof object.persistMsgId !== "string" ||
          object.persistMsgId.length
        )
          message.persistMsgId = $String(object.persistMsgId);
      if (object.batchSize != null)
        if ($Number(object.batchSize) !== 0)
          message.batchSize = object.batchSize >>> 0;
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      return message;
    };

    /**
     * Creates a plain object from a GetHistory message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.GetHistory
     * @static
     * @param {pubsub.GetHistory} message GetHistory
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    GetHistory.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults) {
        object.topic = "";
        object.persistMsgId = "";
        object.batchSize = 0;
        object.requestId = "";
      }
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        object.topic = message.topic;
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId")
      )
        object.persistMsgId = message.persistMsgId;
      if (
        message.batchSize != null &&
        $Object.hasOwnProperty.call(message, "batchSize")
      )
        object.batchSize = message.batchSize;
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      return object;
    };

    /**
     * Converts this GetHistory to JSON.
     * @function toJSON
     * @memberof pubsub.GetHistory
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    GetHistory.prototype.toJSON = function () {
      return GetHistory.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for GetHistory
     * @function getTypeUrl
     * @memberof pubsub.GetHistory
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    GetHistory.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.GetHistory";
    };

    return GetHistory;
  })();

  pubsub.Pong = (function () {
    /**
     * Properties of a Pong.
     * @typedef {Object} pubsub.Pong.$Properties
     * @property {number|Long|null} [seq] Pong seq
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a Pong.
     * @memberof pubsub
     * @interface IPong
     * @augments pubsub.Pong.$Properties
     * @deprecated Use pubsub.Pong.$Properties instead.
     */

    /**
     * Shape of a Pong.
     * @typedef {pubsub.Pong.$Properties} pubsub.Pong.$Shape
     */

    /**
     * Constructs a new Pong.
     * @memberof pubsub
     * @classdesc Represents a Pong.
     * @constructor
     * @param {pubsub.Pong.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Pong = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Pong seq.
     * @member {number|Long} seq
     * @memberof pubsub.Pong
     * @instance
     */
    Pong.prototype.seq = $util.Long ? $util.Long.fromBits(0, 0, true) : 0;

    /**
     * Creates a new Pong instance using the specified properties.
     * @function create
     * @memberof pubsub.Pong
     * @static
     * @param {pubsub.Pong.$Properties=} [properties] Properties to set
     * @returns {pubsub.Pong} Pong instance
     * @type {{
     *   (properties: pubsub.Pong.$Shape): pubsub.Pong & pubsub.Pong.$Shape;
     *   (properties?: pubsub.Pong.$Properties): pubsub.Pong;
     * }}
     */
    Pong.create = function (properties) {
      return new Pong(properties);
    };

    /**
     * Encodes the specified Pong message. Does not implicitly {@link pubsub.Pong.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Pong
     * @static
     * @param {pubsub.Pong.$Properties} message Pong message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Pong.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.seq != null &&
        $Object.hasOwnProperty.call(message, "seq") &&
        (typeof message.seq === "object"
          ? message.seq.low || message.seq.high
          : message.seq !== 0)
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint64(message.seq);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Pong message, length delimited. Does not implicitly {@link pubsub.Pong.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Pong
     * @static
     * @param {pubsub.Pong.$Properties} message Pong message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Pong.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a Pong message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Pong
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Pong & pubsub.Pong.$Shape} Pong
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Pong.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Pong(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.seq = value;
            else delete message.seq;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a Pong message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Pong
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Pong & pubsub.Pong.$Shape} Pong
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Pong.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Pong message.
     * @function verify
     * @memberof pubsub.Pong
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Pong.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (message.seq != null && $Object.hasOwnProperty.call(message, "seq"))
        if (
          !$util.isInteger(message.seq) &&
          !(
            message.seq &&
            $util.isInteger(message.seq.low) &&
            $util.isInteger(message.seq.high)
          )
        )
          return "seq: integer|Long expected";
      return null;
    };

    /**
     * Creates a Pong message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Pong
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Pong} Pong
     */
    Pong.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Pong) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Pong: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Pong();
      if (object.seq != null)
        if (
          typeof object.seq === "object"
            ? object.seq.low || object.seq.high
            : $Number(object.seq) !== 0
        )
          if ($util.Long) message.seq = $util.Long.fromValue(object.seq, true);
          else if (typeof object.seq === "string")
            message.seq = $parseInt(object.seq, 10);
          else if (typeof object.seq === "number") message.seq = object.seq;
          else if (typeof object.seq === "object")
            message.seq = new $util.LongBits(
              object.seq.low >>> 0,
              object.seq.high >>> 0
            ).toNumber(true);
      return message;
    };

    /**
     * Creates a plain object from a Pong message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Pong
     * @static
     * @param {pubsub.Pong} message Pong
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Pong.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults)
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.seq =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.seq =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
      if (message.seq != null && $Object.hasOwnProperty.call(message, "seq"))
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.seq =
            typeof message.seq === "number"
              ? $BigInt(message.seq)
              : $util.Long.fromBits(
                  message.seq.low >>> 0,
                  message.seq.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.seq === "number")
          object.seq =
            options.longs === $String ? $String(message.seq) : message.seq;
        else
          object.seq =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.seq)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.seq.low >>> 0,
                    message.seq.high >>> 0
                  ).toNumber(true)
                : message.seq;
      return object;
    };

    /**
     * Converts this Pong to JSON.
     * @function toJSON
     * @memberof pubsub.Pong
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Pong.prototype.toJSON = function () {
      return Pong.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Pong
     * @function getTypeUrl
     * @memberof pubsub.Pong
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Pong.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Pong";
    };

    return Pong;
  })();

  pubsub.ClientMessage = (function () {
    /**
     * Properties of a ClientMessage.
     * @typedef {Object} pubsub.ClientMessage.$Properties
     * @property {pubsub.Subscribe.$Properties|null} [subscribe] ClientMessage subscribe
     * @property {pubsub.Unsubscribe.$Properties|null} [unsubscribe] ClientMessage unsubscribe
     * @property {pubsub.Publish.$Properties|null} [publish] ClientMessage publish
     * @property {pubsub.GetHistory.$Properties|null} [getHistory] ClientMessage getHistory
     * @property {pubsub.Pong.$Properties|null} [pong] ClientMessage pong
     * @property {"subscribe"|"unsubscribe"|"publish"|"getHistory"|"pong"} [kind] ClientMessage kind
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a ClientMessage.
     * @memberof pubsub
     * @interface IClientMessage
     * @augments pubsub.ClientMessage.$Properties
     * @deprecated Use pubsub.ClientMessage.$Properties instead.
     */

    /**
     * Narrowed shape of a ClientMessage.
     * @typedef {{
     *   subscribe?: pubsub.Subscribe.$Shape|null;
     *   unsubscribe?: pubsub.Unsubscribe.$Shape|null;
     *   publish?: pubsub.Publish.$Shape|null;
     *   getHistory?: pubsub.GetHistory.$Shape|null;
     *   pong?: pubsub.Pong.$Shape|null;
     *   $unknowns?: Array.<Uint8Array>;
     * } & (
     *   ({ kind?: undefined; subscribe?: null; unsubscribe?: null; publish?: null; getHistory?: null; pong?: null }|{ kind?: "subscribe"; subscribe: pubsub.Subscribe.$Shape; unsubscribe?: null; publish?: null; getHistory?: null; pong?: null }|{ kind?: "unsubscribe"; subscribe?: null; unsubscribe: pubsub.Unsubscribe.$Shape; publish?: null; getHistory?: null; pong?: null }|{ kind?: "publish"; subscribe?: null; unsubscribe?: null; publish: pubsub.Publish.$Shape; getHistory?: null; pong?: null }|{ kind?: "getHistory"; subscribe?: null; unsubscribe?: null; publish?: null; getHistory: pubsub.GetHistory.$Shape; pong?: null }|{ kind?: "pong"; subscribe?: null; unsubscribe?: null; publish?: null; getHistory?: null; pong: pubsub.Pong.$Shape })
     * )} pubsub.ClientMessage.$Shape
     */

    /**
     * Constructs a new ClientMessage.
     * @memberof pubsub
     * @classdesc Represents a ClientMessage.
     * @constructor
     * @param {pubsub.ClientMessage.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var ClientMessage = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * ClientMessage subscribe.
     * @member {pubsub.Subscribe.$Properties|null|undefined} subscribe
     * @memberof pubsub.ClientMessage
     * @instance
     */
    ClientMessage.prototype.subscribe = null;

    /**
     * ClientMessage unsubscribe.
     * @member {pubsub.Unsubscribe.$Properties|null|undefined} unsubscribe
     * @memberof pubsub.ClientMessage
     * @instance
     */
    ClientMessage.prototype.unsubscribe = null;

    /**
     * ClientMessage publish.
     * @member {pubsub.Publish.$Properties|null|undefined} publish
     * @memberof pubsub.ClientMessage
     * @instance
     */
    ClientMessage.prototype.publish = null;

    /**
     * ClientMessage getHistory.
     * @member {pubsub.GetHistory.$Properties|null|undefined} getHistory
     * @memberof pubsub.ClientMessage
     * @instance
     */
    ClientMessage.prototype.getHistory = null;

    /**
     * ClientMessage pong.
     * @member {pubsub.Pong.$Properties|null|undefined} pong
     * @memberof pubsub.ClientMessage
     * @instance
     */
    ClientMessage.prototype.pong = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * ClientMessage kind.
     * @member {"subscribe"|"unsubscribe"|"publish"|"getHistory"|"pong"|undefined} kind
     * @memberof pubsub.ClientMessage
     * @instance
     */
    $Object.defineProperty(ClientMessage.prototype, "kind", {
      get: $util.oneOfGetter(
        ($oneOfFields = [
          "subscribe",
          "unsubscribe",
          "publish",
          "getHistory",
          "pong",
        ])
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new ClientMessage instance using the specified properties.
     * @function create
     * @memberof pubsub.ClientMessage
     * @static
     * @param {pubsub.ClientMessage.$Properties=} [properties] Properties to set
     * @returns {pubsub.ClientMessage} ClientMessage instance
     * @type {{
     *   (properties: pubsub.ClientMessage.$Shape): pubsub.ClientMessage & pubsub.ClientMessage.$Shape;
     *   (properties?: pubsub.ClientMessage.$Properties): pubsub.ClientMessage;
     * }}
     */
    ClientMessage.create = function (properties) {
      return new ClientMessage(properties);
    };

    /**
     * Encodes the specified ClientMessage message. Does not implicitly {@link pubsub.ClientMessage.verify|verify} messages.
     * @function encode
     * @memberof pubsub.ClientMessage
     * @static
     * @param {pubsub.ClientMessage.$Properties} message ClientMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ClientMessage.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.subscribe != null &&
        $Object.hasOwnProperty.call(message, "subscribe")
      )
        $root.pubsub.Subscribe.encode(
          message.subscribe,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.unsubscribe != null &&
        $Object.hasOwnProperty.call(message, "unsubscribe")
      )
        $root.pubsub.Unsubscribe.encode(
          message.unsubscribe,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.publish != null &&
        $Object.hasOwnProperty.call(message, "publish")
      )
        $root.pubsub.Publish.encode(
          message.publish,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.getHistory != null &&
        $Object.hasOwnProperty.call(message, "getHistory")
      )
        $root.pubsub.GetHistory.encode(
          message.getHistory,
          writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          _depth + 1
        ).ldelim();
      if (message.pong != null && $Object.hasOwnProperty.call(message, "pong"))
        $root.pubsub.Pong.encode(
          message.pong,
          writer.uint32(/* id 5, wireType 2 =*/ 42).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified ClientMessage message, length delimited. Does not implicitly {@link pubsub.ClientMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.ClientMessage
     * @static
     * @param {pubsub.ClientMessage.$Properties} message ClientMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ClientMessage.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a ClientMessage message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.ClientMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.ClientMessage & pubsub.ClientMessage.$Shape} ClientMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ClientMessage.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.ClientMessage();
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            message.subscribe = $root.pubsub.Subscribe.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.subscribe
            );
            message.kind = "subscribe";
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            message.unsubscribe = $root.pubsub.Unsubscribe.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.unsubscribe
            );
            message.kind = "unsubscribe";
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            message.publish = $root.pubsub.Publish.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.publish
            );
            message.kind = "publish";
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            message.getHistory = $root.pubsub.GetHistory.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.getHistory
            );
            message.kind = "getHistory";
            continue;
          }
          case 5: {
            if (wireType !== 2) break;
            message.pong = $root.pubsub.Pong.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.pong
            );
            message.kind = "pong";
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a ClientMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.ClientMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.ClientMessage & pubsub.ClientMessage.$Shape} ClientMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ClientMessage.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ClientMessage message.
     * @function verify
     * @memberof pubsub.ClientMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ClientMessage.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      var properties = {};
      if (
        message.subscribe != null &&
        $Object.hasOwnProperty.call(message, "subscribe")
      ) {
        properties.kind = 1;
        {
          var error = $root.pubsub.Subscribe.verify(
            message.subscribe,
            _depth + 1
          );
          if (error) return "subscribe." + error;
        }
      }
      if (
        message.unsubscribe != null &&
        $Object.hasOwnProperty.call(message, "unsubscribe")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Unsubscribe.verify(
            message.unsubscribe,
            _depth + 1
          );
          if (error) return "unsubscribe." + error;
        }
      }
      if (
        message.publish != null &&
        $Object.hasOwnProperty.call(message, "publish")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Publish.verify(message.publish, _depth + 1);
          if (error) return "publish." + error;
        }
      }
      if (
        message.getHistory != null &&
        $Object.hasOwnProperty.call(message, "getHistory")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.GetHistory.verify(
            message.getHistory,
            _depth + 1
          );
          if (error) return "getHistory." + error;
        }
      }
      if (
        message.pong != null &&
        $Object.hasOwnProperty.call(message, "pong")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Pong.verify(message.pong, _depth + 1);
          if (error) return "pong." + error;
        }
      }
      return null;
    };

    /**
     * Creates a ClientMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.ClientMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.ClientMessage} ClientMessage
     */
    ClientMessage.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.ClientMessage) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.ClientMessage: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.ClientMessage();
      if (object.subscribe != null) {
        if (!$util.isObject(object.subscribe))
          throw $TypeError(".pubsub.ClientMessage.subscribe: object expected");
        message.subscribe = $root.pubsub.Subscribe.fromObject(
          object.subscribe,
          _depth + 1
        );
      }
      if (object.unsubscribe != null) {
        if (!$util.isObject(object.unsubscribe))
          throw $TypeError(
            ".pubsub.ClientMessage.unsubscribe: object expected"
          );
        message.unsubscribe = $root.pubsub.Unsubscribe.fromObject(
          object.unsubscribe,
          _depth + 1
        );
      }
      if (object.publish != null) {
        if (!$util.isObject(object.publish))
          throw $TypeError(".pubsub.ClientMessage.publish: object expected");
        message.publish = $root.pubsub.Publish.fromObject(
          object.publish,
          _depth + 1
        );
      }
      if (object.getHistory != null) {
        if (!$util.isObject(object.getHistory))
          throw $TypeError(".pubsub.ClientMessage.getHistory: object expected");
        message.getHistory = $root.pubsub.GetHistory.fromObject(
          object.getHistory,
          _depth + 1
        );
      }
      if (object.pong != null) {
        if (!$util.isObject(object.pong))
          throw $TypeError(".pubsub.ClientMessage.pong: object expected");
        message.pong = $root.pubsub.Pong.fromObject(object.pong, _depth + 1);
      }
      return message;
    };

    /**
     * Creates a plain object from a ClientMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.ClientMessage
     * @static
     * @param {pubsub.ClientMessage} message ClientMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ClientMessage.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (
        message.subscribe != null &&
        $Object.hasOwnProperty.call(message, "subscribe")
      ) {
        object.subscribe = $root.pubsub.Subscribe.toObject(
          message.subscribe,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "subscribe";
      }
      if (
        message.unsubscribe != null &&
        $Object.hasOwnProperty.call(message, "unsubscribe")
      ) {
        object.unsubscribe = $root.pubsub.Unsubscribe.toObject(
          message.unsubscribe,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "unsubscribe";
      }
      if (
        message.publish != null &&
        $Object.hasOwnProperty.call(message, "publish")
      ) {
        object.publish = $root.pubsub.Publish.toObject(
          message.publish,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "publish";
      }
      if (
        message.getHistory != null &&
        $Object.hasOwnProperty.call(message, "getHistory")
      ) {
        object.getHistory = $root.pubsub.GetHistory.toObject(
          message.getHistory,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "getHistory";
      }
      if (
        message.pong != null &&
        $Object.hasOwnProperty.call(message, "pong")
      ) {
        object.pong = $root.pubsub.Pong.toObject(
          message.pong,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "pong";
      }
      return object;
    };

    /**
     * Converts this ClientMessage to JSON.
     * @function toJSON
     * @memberof pubsub.ClientMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ClientMessage.prototype.toJSON = function () {
      return ClientMessage.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for ClientMessage
     * @function getTypeUrl
     * @memberof pubsub.ClientMessage
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    ClientMessage.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.ClientMessage";
    };

    return ClientMessage;
  })();

  pubsub.ServerMessage = (function () {
    /**
     * Properties of a ServerMessage.
     * @typedef {Object} pubsub.ServerMessage.$Properties
     * @property {string|null} [message] ServerMessage message
     * @property {Uint8Array|null} [payload] ServerMessage payload
     * @property {string|null} [timestamp] ServerMessage timestamp
     * @property {string|null} [senderId] ServerMessage senderId
     * @property {string|null} [senderName] ServerMessage senderName
     * @property {string|null} [persistMsgId] ServerMessage persistMsgId
     * @property {string|null} [messageId] ServerMessage messageId
     * @property {Array.<string>|null} [sendOnly] ServerMessage sendOnly
     * @property {number|Long|null} [seqNum] ServerMessage seqNum
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a ServerMessage.
     * @memberof pubsub
     * @interface IServerMessage
     * @augments pubsub.ServerMessage.$Properties
     * @deprecated Use pubsub.ServerMessage.$Properties instead.
     */

    /**
     * Shape of a ServerMessage.
     * @typedef {pubsub.ServerMessage.$Properties} pubsub.ServerMessage.$Shape
     */

    /**
     * Constructs a new ServerMessage.
     * @memberof pubsub
     * @classdesc Represents a ServerMessage.
     * @constructor
     * @param {pubsub.ServerMessage.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var ServerMessage = function (properties) {
      this.sendOnly = [];
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * ServerMessage message.
     * @member {string} message
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.message = "";

    /**
     * ServerMessage payload.
     * @member {Uint8Array} payload
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.payload = $util.newBuffer([]);

    /**
     * ServerMessage timestamp.
     * @member {string} timestamp
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.timestamp = "";

    /**
     * ServerMessage senderId.
     * @member {string} senderId
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.senderId = "";

    /**
     * ServerMessage senderName.
     * @member {string} senderName
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.senderName = "";

    /**
     * ServerMessage persistMsgId.
     * @member {string} persistMsgId
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.persistMsgId = "";

    /**
     * ServerMessage messageId.
     * @member {string} messageId
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.messageId = "";

    /**
     * ServerMessage sendOnly.
     * @member {Array.<string>} sendOnly
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.sendOnly = $util.emptyArray;

    /**
     * ServerMessage seqNum.
     * @member {number|Long} seqNum
     * @memberof pubsub.ServerMessage
     * @instance
     */
    ServerMessage.prototype.seqNum = $util.Long
      ? $util.Long.fromBits(0, 0, true)
      : 0;

    /**
     * Creates a new ServerMessage instance using the specified properties.
     * @function create
     * @memberof pubsub.ServerMessage
     * @static
     * @param {pubsub.ServerMessage.$Properties=} [properties] Properties to set
     * @returns {pubsub.ServerMessage} ServerMessage instance
     * @type {{
     *   (properties: pubsub.ServerMessage.$Shape): pubsub.ServerMessage & pubsub.ServerMessage.$Shape;
     *   (properties?: pubsub.ServerMessage.$Properties): pubsub.ServerMessage;
     * }}
     */
    ServerMessage.create = function (properties) {
      return new ServerMessage(properties);
    };

    /**
     * Encodes the specified ServerMessage message. Does not implicitly {@link pubsub.ServerMessage.verify|verify} messages.
     * @function encode
     * @memberof pubsub.ServerMessage
     * @static
     * @param {pubsub.ServerMessage.$Properties} message ServerMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerMessage.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message") &&
        message.message !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.message);
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload") &&
        message.payload.length
      )
        writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.payload);
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp") &&
        message.timestamp !== ""
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.timestamp);
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId") &&
        message.senderId !== ""
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.senderId);
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName") &&
        message.senderName !== ""
      )
        writer.uint32(/* id 5, wireType 2 =*/ 42).string(message.senderName);
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId") &&
        message.persistMsgId !== ""
      )
        writer.uint32(/* id 6, wireType 2 =*/ 50).string(message.persistMsgId);
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId") &&
        message.messageId !== ""
      )
        writer.uint32(/* id 7, wireType 2 =*/ 58).string(message.messageId);
      if (message.sendOnly != null && message.sendOnly.length)
        for (var i = 0; i < message.sendOnly.length; ++i)
          writer.uint32(/* id 8, wireType 2 =*/ 66).string(message.sendOnly[i]);
      if (
        message.seqNum != null &&
        $Object.hasOwnProperty.call(message, "seqNum") &&
        (typeof message.seqNum === "object"
          ? message.seqNum.low || message.seqNum.high
          : message.seqNum !== 0)
      )
        writer.uint32(/* id 9, wireType 0 =*/ 72).uint64(message.seqNum);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified ServerMessage message, length delimited. Does not implicitly {@link pubsub.ServerMessage.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.ServerMessage
     * @static
     * @param {pubsub.ServerMessage.$Properties} message ServerMessage message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerMessage.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a ServerMessage message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.ServerMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.ServerMessage & pubsub.ServerMessage.$Shape} ServerMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerMessage.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.ServerMessage(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.message = value;
            else delete message.message;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if ((value = reader.bytes()).length) message.payload = value;
            else delete message.payload;
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.timestamp = value;
            else delete message.timestamp;
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.senderId = value;
            else delete message.senderId;
            continue;
          }
          case 5: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.senderName = value;
            else delete message.senderName;
            continue;
          }
          case 6: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.persistMsgId = value;
            else delete message.persistMsgId;
            continue;
          }
          case 7: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.messageId = value;
            else delete message.messageId;
            continue;
          }
          case 8: {
            if (wireType !== 2) break;
            if (!(message.sendOnly && message.sendOnly.length))
              message.sendOnly = [];
            message.sendOnly.push(reader.stringVerify());
            continue;
          }
          case 9: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.seqNum = value;
            else delete message.seqNum;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a ServerMessage message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.ServerMessage
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.ServerMessage & pubsub.ServerMessage.$Shape} ServerMessage
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerMessage.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ServerMessage message.
     * @function verify
     * @memberof pubsub.ServerMessage
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ServerMessage.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message")
      )
        if (!$util.isString(message.message)) return "message: string expected";
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload")
      )
        if (!(
          (message.payload && typeof message.payload.length === "number") ||
          $util.isString(message.payload)
        ))
          return "payload: buffer expected";
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp")
      )
        if (!$util.isString(message.timestamp))
          return "timestamp: string expected";
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId")
      )
        if (!$util.isString(message.senderId))
          return "senderId: string expected";
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName")
      )
        if (!$util.isString(message.senderName))
          return "senderName: string expected";
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId")
      )
        if (!$util.isString(message.persistMsgId))
          return "persistMsgId: string expected";
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        if (!$util.isString(message.messageId))
          return "messageId: string expected";
      if (
        message.sendOnly != null &&
        $Object.hasOwnProperty.call(message, "sendOnly")
      ) {
        if (!$Array.isArray(message.sendOnly))
          return "sendOnly: array expected";
        for (var i = 0; i < message.sendOnly.length; ++i)
          if (!$util.isString(message.sendOnly[i]))
            return "sendOnly: string[] expected";
      }
      if (
        message.seqNum != null &&
        $Object.hasOwnProperty.call(message, "seqNum")
      )
        if (
          !$util.isInteger(message.seqNum) &&
          !(
            message.seqNum &&
            $util.isInteger(message.seqNum.low) &&
            $util.isInteger(message.seqNum.high)
          )
        )
          return "seqNum: integer|Long expected";
      return null;
    };

    /**
     * Creates a ServerMessage message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.ServerMessage
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.ServerMessage} ServerMessage
     */
    ServerMessage.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.ServerMessage) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.ServerMessage: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.ServerMessage();
      if (object.message != null)
        if (typeof object.message !== "string" || object.message.length)
          message.message = $String(object.message);
      if (object.payload != null)
        if (object.payload.length)
          if (typeof object.payload === "string")
            $util.base64.decode(
              object.payload,
              (message.payload = $util.newBuffer(
                $util.base64.length(object.payload)
              )),
              0
            );
          else if (object.payload.length >= 0) message.payload = object.payload;
      if (object.timestamp != null)
        if (typeof object.timestamp !== "string" || object.timestamp.length)
          message.timestamp = $String(object.timestamp);
      if (object.senderId != null)
        if (typeof object.senderId !== "string" || object.senderId.length)
          message.senderId = $String(object.senderId);
      if (object.senderName != null)
        if (typeof object.senderName !== "string" || object.senderName.length)
          message.senderName = $String(object.senderName);
      if (object.persistMsgId != null)
        if (
          typeof object.persistMsgId !== "string" ||
          object.persistMsgId.length
        )
          message.persistMsgId = $String(object.persistMsgId);
      if (object.messageId != null)
        if (typeof object.messageId !== "string" || object.messageId.length)
          message.messageId = $String(object.messageId);
      if (object.sendOnly) {
        if (!$Array.isArray(object.sendOnly))
          throw $TypeError(".pubsub.ServerMessage.sendOnly: array expected");
        message.sendOnly = $Array(object.sendOnly.length);
        for (var i = 0; i < object.sendOnly.length; ++i)
          message.sendOnly[i] = $String(object.sendOnly[i]);
      }
      if (object.seqNum != null)
        if (
          typeof object.seqNum === "object"
            ? object.seqNum.low || object.seqNum.high
            : $Number(object.seqNum) !== 0
        )
          if ($util.Long)
            message.seqNum = $util.Long.fromValue(object.seqNum, true);
          else if (typeof object.seqNum === "string")
            message.seqNum = $parseInt(object.seqNum, 10);
          else if (typeof object.seqNum === "number")
            message.seqNum = object.seqNum;
          else if (typeof object.seqNum === "object")
            message.seqNum = new $util.LongBits(
              object.seqNum.low >>> 0,
              object.seqNum.high >>> 0
            ).toNumber(true);
      return message;
    };

    /**
     * Creates a plain object from a ServerMessage message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.ServerMessage
     * @static
     * @param {pubsub.ServerMessage} message ServerMessage
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ServerMessage.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.arrays || options.defaults) object.sendOnly = [];
      if (options.defaults) {
        object.message = "";
        if (options.bytes === $String) object.payload = "";
        else {
          object.payload = [];
          if (options.bytes !== $Array)
            object.payload = $util.newBuffer(object.payload);
        }
        object.timestamp = "";
        object.senderId = "";
        object.senderName = "";
        object.persistMsgId = "";
        object.messageId = "";
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.seqNum =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.seqNum =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
      }
      if (
        message.message != null &&
        $Object.hasOwnProperty.call(message, "message")
      )
        object.message = message.message;
      if (
        message.payload != null &&
        $Object.hasOwnProperty.call(message, "payload")
      )
        object.payload =
          options.bytes === $String
            ? $util.base64.encode(message.payload, 0, message.payload.length)
            : options.bytes === $Array
              ? $Array.prototype.slice.call(message.payload)
              : message.payload;
      if (
        message.timestamp != null &&
        $Object.hasOwnProperty.call(message, "timestamp")
      )
        object.timestamp = message.timestamp;
      if (
        message.senderId != null &&
        $Object.hasOwnProperty.call(message, "senderId")
      )
        object.senderId = message.senderId;
      if (
        message.senderName != null &&
        $Object.hasOwnProperty.call(message, "senderName")
      )
        object.senderName = message.senderName;
      if (
        message.persistMsgId != null &&
        $Object.hasOwnProperty.call(message, "persistMsgId")
      )
        object.persistMsgId = message.persistMsgId;
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        object.messageId = message.messageId;
      if (message.sendOnly && message.sendOnly.length) {
        object.sendOnly = $Array(message.sendOnly.length);
        for (var j = 0; j < message.sendOnly.length; ++j)
          object.sendOnly[j] = message.sendOnly[j];
      }
      if (
        message.seqNum != null &&
        $Object.hasOwnProperty.call(message, "seqNum")
      )
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.seqNum =
            typeof message.seqNum === "number"
              ? $BigInt(message.seqNum)
              : $util.Long.fromBits(
                  message.seqNum.low >>> 0,
                  message.seqNum.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.seqNum === "number")
          object.seqNum =
            options.longs === $String
              ? $String(message.seqNum)
              : message.seqNum;
        else
          object.seqNum =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.seqNum)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.seqNum.low >>> 0,
                    message.seqNum.high >>> 0
                  ).toNumber(true)
                : message.seqNum;
      return object;
    };

    /**
     * Converts this ServerMessage to JSON.
     * @function toJSON
     * @memberof pubsub.ServerMessage
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ServerMessage.prototype.toJSON = function () {
      return ServerMessage.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for ServerMessage
     * @function getTypeUrl
     * @memberof pubsub.ServerMessage
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    ServerMessage.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.ServerMessage";
    };

    return ServerMessage;
  })();

  pubsub.ServerBatch = (function () {
    /**
     * Properties of a ServerBatch.
     * @typedef {Object} pubsub.ServerBatch.$Properties
     * @property {string|null} [topic] ServerBatch topic
     * @property {Array.<Uint8Array>|null} [payloads] ServerBatch payloads
     * @property {string|null} [batchType] ServerBatch batchType
     * @property {number|Long|null} [startSeq] ServerBatch startSeq
     * @property {number|Long|null} [endSeq] ServerBatch endSeq
     * @property {boolean|null} [isLast] ServerBatch isLast
     * @property {number|Long|null} [batchSeq] ServerBatch batchSeq
     * @property {string|null} [requestId] ServerBatch requestId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a ServerBatch.
     * @memberof pubsub
     * @interface IServerBatch
     * @augments pubsub.ServerBatch.$Properties
     * @deprecated Use pubsub.ServerBatch.$Properties instead.
     */

    /**
     * Shape of a ServerBatch.
     * @typedef {pubsub.ServerBatch.$Properties} pubsub.ServerBatch.$Shape
     */

    /**
     * Constructs a new ServerBatch.
     * @memberof pubsub
     * @classdesc Represents a ServerBatch.
     * @constructor
     * @param {pubsub.ServerBatch.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var ServerBatch = function (properties) {
      this.payloads = [];
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * ServerBatch topic.
     * @member {string} topic
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.topic = "";

    /**
     * ServerBatch payloads.
     * @member {Array.<Uint8Array>} payloads
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.payloads = $util.emptyArray;

    /**
     * ServerBatch batchType.
     * @member {string} batchType
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.batchType = "";

    /**
     * ServerBatch startSeq.
     * @member {number|Long} startSeq
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.startSeq = $util.Long
      ? $util.Long.fromBits(0, 0, true)
      : 0;

    /**
     * ServerBatch endSeq.
     * @member {number|Long} endSeq
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.endSeq = $util.Long
      ? $util.Long.fromBits(0, 0, true)
      : 0;

    /**
     * ServerBatch isLast.
     * @member {boolean} isLast
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.isLast = false;

    /**
     * ServerBatch batchSeq.
     * @member {number|Long} batchSeq
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.batchSeq = $util.Long
      ? $util.Long.fromBits(0, 0, true)
      : 0;

    /**
     * ServerBatch requestId.
     * @member {string} requestId
     * @memberof pubsub.ServerBatch
     * @instance
     */
    ServerBatch.prototype.requestId = "";

    /**
     * Creates a new ServerBatch instance using the specified properties.
     * @function create
     * @memberof pubsub.ServerBatch
     * @static
     * @param {pubsub.ServerBatch.$Properties=} [properties] Properties to set
     * @returns {pubsub.ServerBatch} ServerBatch instance
     * @type {{
     *   (properties: pubsub.ServerBatch.$Shape): pubsub.ServerBatch & pubsub.ServerBatch.$Shape;
     *   (properties?: pubsub.ServerBatch.$Properties): pubsub.ServerBatch;
     * }}
     */
    ServerBatch.create = function (properties) {
      return new ServerBatch(properties);
    };

    /**
     * Encodes the specified ServerBatch message. Does not implicitly {@link pubsub.ServerBatch.verify|verify} messages.
     * @function encode
     * @memberof pubsub.ServerBatch
     * @static
     * @param {pubsub.ServerBatch.$Properties} message ServerBatch message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerBatch.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic") &&
        message.topic !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.topic);
      if (message.payloads != null && message.payloads.length)
        for (var i = 0; i < message.payloads.length; ++i)
          writer.uint32(/* id 2, wireType 2 =*/ 18).bytes(message.payloads[i]);
      if (
        message.batchType != null &&
        $Object.hasOwnProperty.call(message, "batchType") &&
        message.batchType !== ""
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.batchType);
      if (
        message.startSeq != null &&
        $Object.hasOwnProperty.call(message, "startSeq") &&
        (typeof message.startSeq === "object"
          ? message.startSeq.low || message.startSeq.high
          : message.startSeq !== 0)
      )
        writer.uint32(/* id 4, wireType 0 =*/ 32).uint64(message.startSeq);
      if (
        message.endSeq != null &&
        $Object.hasOwnProperty.call(message, "endSeq") &&
        (typeof message.endSeq === "object"
          ? message.endSeq.low || message.endSeq.high
          : message.endSeq !== 0)
      )
        writer.uint32(/* id 5, wireType 0 =*/ 40).uint64(message.endSeq);
      if (
        message.isLast != null &&
        $Object.hasOwnProperty.call(message, "isLast") &&
        message.isLast !== false
      )
        writer.uint32(/* id 6, wireType 0 =*/ 48).bool(message.isLast);
      if (
        message.batchSeq != null &&
        $Object.hasOwnProperty.call(message, "batchSeq") &&
        (typeof message.batchSeq === "object"
          ? message.batchSeq.low || message.batchSeq.high
          : message.batchSeq !== 0)
      )
        writer.uint32(/* id 7, wireType 0 =*/ 56).uint64(message.batchSeq);
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 8, wireType 2 =*/ 66).string(message.requestId);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified ServerBatch message, length delimited. Does not implicitly {@link pubsub.ServerBatch.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.ServerBatch
     * @static
     * @param {pubsub.ServerBatch.$Properties} message ServerBatch message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerBatch.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a ServerBatch message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.ServerBatch
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.ServerBatch & pubsub.ServerBatch.$Shape} ServerBatch
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerBatch.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.ServerBatch(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.topic = value;
            else delete message.topic;
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            if (!(message.payloads && message.payloads.length))
              message.payloads = [];
            message.payloads.push(reader.bytes());
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.batchType = value;
            else delete message.batchType;
            continue;
          }
          case 4: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.startSeq = value;
            else delete message.startSeq;
            continue;
          }
          case 5: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.endSeq = value;
            else delete message.endSeq;
            continue;
          }
          case 6: {
            if (wireType !== 0) break;
            if ((value = reader.bool())) message.isLast = value;
            else delete message.isLast;
            continue;
          }
          case 7: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.batchSeq = value;
            else delete message.batchSeq;
            continue;
          }
          case 8: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a ServerBatch message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.ServerBatch
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.ServerBatch & pubsub.ServerBatch.$Shape} ServerBatch
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerBatch.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ServerBatch message.
     * @function verify
     * @memberof pubsub.ServerBatch
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ServerBatch.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        if (!$util.isString(message.topic)) return "topic: string expected";
      if (
        message.payloads != null &&
        $Object.hasOwnProperty.call(message, "payloads")
      ) {
        if (!$Array.isArray(message.payloads))
          return "payloads: array expected";
        for (var i = 0; i < message.payloads.length; ++i)
          if (!(
            (message.payloads[i] &&
              typeof message.payloads[i].length === "number") ||
            $util.isString(message.payloads[i])
          ))
            return "payloads: buffer[] expected";
      }
      if (
        message.batchType != null &&
        $Object.hasOwnProperty.call(message, "batchType")
      )
        if (!$util.isString(message.batchType))
          return "batchType: string expected";
      if (
        message.startSeq != null &&
        $Object.hasOwnProperty.call(message, "startSeq")
      )
        if (
          !$util.isInteger(message.startSeq) &&
          !(
            message.startSeq &&
            $util.isInteger(message.startSeq.low) &&
            $util.isInteger(message.startSeq.high)
          )
        )
          return "startSeq: integer|Long expected";
      if (
        message.endSeq != null &&
        $Object.hasOwnProperty.call(message, "endSeq")
      )
        if (
          !$util.isInteger(message.endSeq) &&
          !(
            message.endSeq &&
            $util.isInteger(message.endSeq.low) &&
            $util.isInteger(message.endSeq.high)
          )
        )
          return "endSeq: integer|Long expected";
      if (
        message.isLast != null &&
        $Object.hasOwnProperty.call(message, "isLast")
      )
        if (typeof message.isLast !== "boolean")
          return "isLast: boolean expected";
      if (
        message.batchSeq != null &&
        $Object.hasOwnProperty.call(message, "batchSeq")
      )
        if (
          !$util.isInteger(message.batchSeq) &&
          !(
            message.batchSeq &&
            $util.isInteger(message.batchSeq.low) &&
            $util.isInteger(message.batchSeq.high)
          )
        )
          return "batchSeq: integer|Long expected";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      return null;
    };

    /**
     * Creates a ServerBatch message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.ServerBatch
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.ServerBatch} ServerBatch
     */
    ServerBatch.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.ServerBatch) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.ServerBatch: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.ServerBatch();
      if (object.topic != null)
        if (typeof object.topic !== "string" || object.topic.length)
          message.topic = $String(object.topic);
      if (object.payloads) {
        if (!$Array.isArray(object.payloads))
          throw $TypeError(".pubsub.ServerBatch.payloads: array expected");
        message.payloads = $Array(object.payloads.length);
        for (var i = 0; i < object.payloads.length; ++i)
          if (typeof object.payloads[i] === "string")
            $util.base64.decode(
              object.payloads[i],
              (message.payloads[i] = $util.newBuffer(
                $util.base64.length(object.payloads[i])
              )),
              0
            );
          else if (object.payloads[i].length >= 0)
            message.payloads[i] = object.payloads[i];
      }
      if (object.batchType != null)
        if (typeof object.batchType !== "string" || object.batchType.length)
          message.batchType = $String(object.batchType);
      if (object.startSeq != null)
        if (
          typeof object.startSeq === "object"
            ? object.startSeq.low || object.startSeq.high
            : $Number(object.startSeq) !== 0
        )
          if ($util.Long)
            message.startSeq = $util.Long.fromValue(object.startSeq, true);
          else if (typeof object.startSeq === "string")
            message.startSeq = $parseInt(object.startSeq, 10);
          else if (typeof object.startSeq === "number")
            message.startSeq = object.startSeq;
          else if (typeof object.startSeq === "object")
            message.startSeq = new $util.LongBits(
              object.startSeq.low >>> 0,
              object.startSeq.high >>> 0
            ).toNumber(true);
      if (object.endSeq != null)
        if (
          typeof object.endSeq === "object"
            ? object.endSeq.low || object.endSeq.high
            : $Number(object.endSeq) !== 0
        )
          if ($util.Long)
            message.endSeq = $util.Long.fromValue(object.endSeq, true);
          else if (typeof object.endSeq === "string")
            message.endSeq = $parseInt(object.endSeq, 10);
          else if (typeof object.endSeq === "number")
            message.endSeq = object.endSeq;
          else if (typeof object.endSeq === "object")
            message.endSeq = new $util.LongBits(
              object.endSeq.low >>> 0,
              object.endSeq.high >>> 0
            ).toNumber(true);
      if (object.isLast != null)
        if (object.isLast) message.isLast = $Boolean(object.isLast);
      if (object.batchSeq != null)
        if (
          typeof object.batchSeq === "object"
            ? object.batchSeq.low || object.batchSeq.high
            : $Number(object.batchSeq) !== 0
        )
          if ($util.Long)
            message.batchSeq = $util.Long.fromValue(object.batchSeq, true);
          else if (typeof object.batchSeq === "string")
            message.batchSeq = $parseInt(object.batchSeq, 10);
          else if (typeof object.batchSeq === "number")
            message.batchSeq = object.batchSeq;
          else if (typeof object.batchSeq === "object")
            message.batchSeq = new $util.LongBits(
              object.batchSeq.low >>> 0,
              object.batchSeq.high >>> 0
            ).toNumber(true);
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      return message;
    };

    /**
     * Creates a plain object from a ServerBatch message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.ServerBatch
     * @static
     * @param {pubsub.ServerBatch} message ServerBatch
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ServerBatch.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.arrays || options.defaults) object.payloads = [];
      if (options.defaults) {
        object.topic = "";
        object.batchType = "";
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.startSeq =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.startSeq =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.endSeq =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.endSeq =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
        object.isLast = false;
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.batchSeq =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.batchSeq =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
        object.requestId = "";
      }
      if (
        message.topic != null &&
        $Object.hasOwnProperty.call(message, "topic")
      )
        object.topic = message.topic;
      if (message.payloads && message.payloads.length) {
        object.payloads = $Array(message.payloads.length);
        for (var j = 0; j < message.payloads.length; ++j)
          object.payloads[j] =
            options.bytes === $String
              ? $util.base64.encode(
                  message.payloads[j],
                  0,
                  message.payloads[j].length
                )
              : options.bytes === $Array
                ? $Array.prototype.slice.call(message.payloads[j])
                : message.payloads[j];
      }
      if (
        message.batchType != null &&
        $Object.hasOwnProperty.call(message, "batchType")
      )
        object.batchType = message.batchType;
      if (
        message.startSeq != null &&
        $Object.hasOwnProperty.call(message, "startSeq")
      )
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.startSeq =
            typeof message.startSeq === "number"
              ? $BigInt(message.startSeq)
              : $util.Long.fromBits(
                  message.startSeq.low >>> 0,
                  message.startSeq.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.startSeq === "number")
          object.startSeq =
            options.longs === $String
              ? $String(message.startSeq)
              : message.startSeq;
        else
          object.startSeq =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.startSeq)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.startSeq.low >>> 0,
                    message.startSeq.high >>> 0
                  ).toNumber(true)
                : message.startSeq;
      if (
        message.endSeq != null &&
        $Object.hasOwnProperty.call(message, "endSeq")
      )
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.endSeq =
            typeof message.endSeq === "number"
              ? $BigInt(message.endSeq)
              : $util.Long.fromBits(
                  message.endSeq.low >>> 0,
                  message.endSeq.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.endSeq === "number")
          object.endSeq =
            options.longs === $String
              ? $String(message.endSeq)
              : message.endSeq;
        else
          object.endSeq =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.endSeq)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.endSeq.low >>> 0,
                    message.endSeq.high >>> 0
                  ).toNumber(true)
                : message.endSeq;
      if (
        message.isLast != null &&
        $Object.hasOwnProperty.call(message, "isLast")
      )
        object.isLast = message.isLast;
      if (
        message.batchSeq != null &&
        $Object.hasOwnProperty.call(message, "batchSeq")
      )
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.batchSeq =
            typeof message.batchSeq === "number"
              ? $BigInt(message.batchSeq)
              : $util.Long.fromBits(
                  message.batchSeq.low >>> 0,
                  message.batchSeq.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.batchSeq === "number")
          object.batchSeq =
            options.longs === $String
              ? $String(message.batchSeq)
              : message.batchSeq;
        else
          object.batchSeq =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.batchSeq)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.batchSeq.low >>> 0,
                    message.batchSeq.high >>> 0
                  ).toNumber(true)
                : message.batchSeq;
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      return object;
    };

    /**
     * Converts this ServerBatch to JSON.
     * @function toJSON
     * @memberof pubsub.ServerBatch
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ServerBatch.prototype.toJSON = function () {
      return ServerBatch.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for ServerBatch
     * @function getTypeUrl
     * @memberof pubsub.ServerBatch
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    ServerBatch.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.ServerBatch";
    };

    return ServerBatch;
  })();

  pubsub.ServerEnvelope = (function () {
    /**
     * Properties of a ServerEnvelope.
     * @typedef {Object} pubsub.ServerEnvelope.$Properties
     * @property {pubsub.ServerBatch.$Properties|null} [batch] ServerEnvelope batch
     * @property {pubsub.Ack.$Properties|null} [ack] ServerEnvelope ack
     * @property {pubsub.Welcome.$Properties|null} [welcome] ServerEnvelope welcome
     * @property {pubsub.Ping.$Properties|null} [ping] ServerEnvelope ping
     * @property {"batch"|"ack"|"welcome"|"ping"} [kind] ServerEnvelope kind
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a ServerEnvelope.
     * @memberof pubsub
     * @interface IServerEnvelope
     * @augments pubsub.ServerEnvelope.$Properties
     * @deprecated Use pubsub.ServerEnvelope.$Properties instead.
     */

    /**
     * Narrowed shape of a ServerEnvelope.
     * @typedef {{
     *   batch?: pubsub.ServerBatch.$Shape|null;
     *   ack?: pubsub.Ack.$Shape|null;
     *   welcome?: pubsub.Welcome.$Shape|null;
     *   ping?: pubsub.Ping.$Shape|null;
     *   $unknowns?: Array.<Uint8Array>;
     * } & (
     *   ({ kind?: undefined; batch?: null; ack?: null; welcome?: null; ping?: null }|{ kind?: "batch"; batch: pubsub.ServerBatch.$Shape; ack?: null; welcome?: null; ping?: null }|{ kind?: "ack"; batch?: null; ack: pubsub.Ack.$Shape; welcome?: null; ping?: null }|{ kind?: "welcome"; batch?: null; ack?: null; welcome: pubsub.Welcome.$Shape; ping?: null }|{ kind?: "ping"; batch?: null; ack?: null; welcome?: null; ping: pubsub.Ping.$Shape })
     * )} pubsub.ServerEnvelope.$Shape
     */

    /**
     * Constructs a new ServerEnvelope.
     * @memberof pubsub
     * @classdesc Represents a ServerEnvelope.
     * @constructor
     * @param {pubsub.ServerEnvelope.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var ServerEnvelope = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * ServerEnvelope batch.
     * @member {pubsub.ServerBatch.$Properties|null|undefined} batch
     * @memberof pubsub.ServerEnvelope
     * @instance
     */
    ServerEnvelope.prototype.batch = null;

    /**
     * ServerEnvelope ack.
     * @member {pubsub.Ack.$Properties|null|undefined} ack
     * @memberof pubsub.ServerEnvelope
     * @instance
     */
    ServerEnvelope.prototype.ack = null;

    /**
     * ServerEnvelope welcome.
     * @member {pubsub.Welcome.$Properties|null|undefined} welcome
     * @memberof pubsub.ServerEnvelope
     * @instance
     */
    ServerEnvelope.prototype.welcome = null;

    /**
     * ServerEnvelope ping.
     * @member {pubsub.Ping.$Properties|null|undefined} ping
     * @memberof pubsub.ServerEnvelope
     * @instance
     */
    ServerEnvelope.prototype.ping = null;

    // OneOf field names bound to virtual getters and setters
    var $oneOfFields;

    /**
     * ServerEnvelope kind.
     * @member {"batch"|"ack"|"welcome"|"ping"|undefined} kind
     * @memberof pubsub.ServerEnvelope
     * @instance
     */
    $Object.defineProperty(ServerEnvelope.prototype, "kind", {
      get: $util.oneOfGetter(
        ($oneOfFields = ["batch", "ack", "welcome", "ping"])
      ),
      set: $util.oneOfSetter($oneOfFields),
    });

    /**
     * Creates a new ServerEnvelope instance using the specified properties.
     * @function create
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {pubsub.ServerEnvelope.$Properties=} [properties] Properties to set
     * @returns {pubsub.ServerEnvelope} ServerEnvelope instance
     * @type {{
     *   (properties: pubsub.ServerEnvelope.$Shape): pubsub.ServerEnvelope & pubsub.ServerEnvelope.$Shape;
     *   (properties?: pubsub.ServerEnvelope.$Properties): pubsub.ServerEnvelope;
     * }}
     */
    ServerEnvelope.create = function (properties) {
      return new ServerEnvelope(properties);
    };

    /**
     * Encodes the specified ServerEnvelope message. Does not implicitly {@link pubsub.ServerEnvelope.verify|verify} messages.
     * @function encode
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {pubsub.ServerEnvelope.$Properties} message ServerEnvelope message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerEnvelope.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.batch != null &&
        $Object.hasOwnProperty.call(message, "batch")
      )
        $root.pubsub.ServerBatch.encode(
          message.batch,
          writer.uint32(/* id 1, wireType 2 =*/ 10).fork(),
          _depth + 1
        ).ldelim();
      if (message.ack != null && $Object.hasOwnProperty.call(message, "ack"))
        $root.pubsub.Ack.encode(
          message.ack,
          writer.uint32(/* id 2, wireType 2 =*/ 18).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.welcome != null &&
        $Object.hasOwnProperty.call(message, "welcome")
      )
        $root.pubsub.Welcome.encode(
          message.welcome,
          writer.uint32(/* id 3, wireType 2 =*/ 26).fork(),
          _depth + 1
        ).ldelim();
      if (message.ping != null && $Object.hasOwnProperty.call(message, "ping"))
        $root.pubsub.Ping.encode(
          message.ping,
          writer.uint32(/* id 4, wireType 2 =*/ 34).fork(),
          _depth + 1
        ).ldelim();
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified ServerEnvelope message, length delimited. Does not implicitly {@link pubsub.ServerEnvelope.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {pubsub.ServerEnvelope.$Properties} message ServerEnvelope message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    ServerEnvelope.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a ServerEnvelope message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.ServerEnvelope & pubsub.ServerEnvelope.$Shape} ServerEnvelope
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerEnvelope.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.ServerEnvelope();
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            message.batch = $root.pubsub.ServerBatch.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.batch
            );
            message.kind = "batch";
            continue;
          }
          case 2: {
            if (wireType !== 2) break;
            message.ack = $root.pubsub.Ack.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.ack
            );
            message.kind = "ack";
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            message.welcome = $root.pubsub.Welcome.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.welcome
            );
            message.kind = "welcome";
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            message.ping = $root.pubsub.Ping.decode(
              reader,
              reader.uint32(),
              $undefined,
              _depth + 1,
              message.ping
            );
            message.kind = "ping";
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a ServerEnvelope message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.ServerEnvelope & pubsub.ServerEnvelope.$Shape} ServerEnvelope
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    ServerEnvelope.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a ServerEnvelope message.
     * @function verify
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    ServerEnvelope.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      var properties = {};
      if (
        message.batch != null &&
        $Object.hasOwnProperty.call(message, "batch")
      ) {
        properties.kind = 1;
        {
          var error = $root.pubsub.ServerBatch.verify(
            message.batch,
            _depth + 1
          );
          if (error) return "batch." + error;
        }
      }
      if (message.ack != null && $Object.hasOwnProperty.call(message, "ack")) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Ack.verify(message.ack, _depth + 1);
          if (error) return "ack." + error;
        }
      }
      if (
        message.welcome != null &&
        $Object.hasOwnProperty.call(message, "welcome")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Welcome.verify(message.welcome, _depth + 1);
          if (error) return "welcome." + error;
        }
      }
      if (
        message.ping != null &&
        $Object.hasOwnProperty.call(message, "ping")
      ) {
        if (properties.kind === 1) return "kind: multiple values";
        properties.kind = 1;
        {
          var error = $root.pubsub.Ping.verify(message.ping, _depth + 1);
          if (error) return "ping." + error;
        }
      }
      return null;
    };

    /**
     * Creates a ServerEnvelope message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.ServerEnvelope} ServerEnvelope
     */
    ServerEnvelope.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.ServerEnvelope) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.ServerEnvelope: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.ServerEnvelope();
      if (object.batch != null) {
        if (!$util.isObject(object.batch))
          throw $TypeError(".pubsub.ServerEnvelope.batch: object expected");
        message.batch = $root.pubsub.ServerBatch.fromObject(
          object.batch,
          _depth + 1
        );
      }
      if (object.ack != null) {
        if (!$util.isObject(object.ack))
          throw $TypeError(".pubsub.ServerEnvelope.ack: object expected");
        message.ack = $root.pubsub.Ack.fromObject(object.ack, _depth + 1);
      }
      if (object.welcome != null) {
        if (!$util.isObject(object.welcome))
          throw $TypeError(".pubsub.ServerEnvelope.welcome: object expected");
        message.welcome = $root.pubsub.Welcome.fromObject(
          object.welcome,
          _depth + 1
        );
      }
      if (object.ping != null) {
        if (!$util.isObject(object.ping))
          throw $TypeError(".pubsub.ServerEnvelope.ping: object expected");
        message.ping = $root.pubsub.Ping.fromObject(object.ping, _depth + 1);
      }
      return message;
    };

    /**
     * Creates a plain object from a ServerEnvelope message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {pubsub.ServerEnvelope} message ServerEnvelope
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    ServerEnvelope.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (
        message.batch != null &&
        $Object.hasOwnProperty.call(message, "batch")
      ) {
        object.batch = $root.pubsub.ServerBatch.toObject(
          message.batch,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "batch";
      }
      if (message.ack != null && $Object.hasOwnProperty.call(message, "ack")) {
        object.ack = $root.pubsub.Ack.toObject(
          message.ack,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "ack";
      }
      if (
        message.welcome != null &&
        $Object.hasOwnProperty.call(message, "welcome")
      ) {
        object.welcome = $root.pubsub.Welcome.toObject(
          message.welcome,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "welcome";
      }
      if (
        message.ping != null &&
        $Object.hasOwnProperty.call(message, "ping")
      ) {
        object.ping = $root.pubsub.Ping.toObject(
          message.ping,
          options,
          _depth + 1
        );
        if (options.oneofs) object.kind = "ping";
      }
      return object;
    };

    /**
     * Converts this ServerEnvelope to JSON.
     * @function toJSON
     * @memberof pubsub.ServerEnvelope
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    ServerEnvelope.prototype.toJSON = function () {
      return ServerEnvelope.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for ServerEnvelope
     * @function getTypeUrl
     * @memberof pubsub.ServerEnvelope
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    ServerEnvelope.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.ServerEnvelope";
    };

    return ServerEnvelope;
  })();

  pubsub.Ping = (function () {
    /**
     * Properties of a Ping.
     * @typedef {Object} pubsub.Ping.$Properties
     * @property {number|Long|null} [seq] Ping seq
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a Ping.
     * @memberof pubsub
     * @interface IPing
     * @augments pubsub.Ping.$Properties
     * @deprecated Use pubsub.Ping.$Properties instead.
     */

    /**
     * Shape of a Ping.
     * @typedef {pubsub.Ping.$Properties} pubsub.Ping.$Shape
     */

    /**
     * Constructs a new Ping.
     * @memberof pubsub
     * @classdesc Represents a Ping.
     * @constructor
     * @param {pubsub.Ping.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Ping = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Ping seq.
     * @member {number|Long} seq
     * @memberof pubsub.Ping
     * @instance
     */
    Ping.prototype.seq = $util.Long ? $util.Long.fromBits(0, 0, true) : 0;

    /**
     * Creates a new Ping instance using the specified properties.
     * @function create
     * @memberof pubsub.Ping
     * @static
     * @param {pubsub.Ping.$Properties=} [properties] Properties to set
     * @returns {pubsub.Ping} Ping instance
     * @type {{
     *   (properties: pubsub.Ping.$Shape): pubsub.Ping & pubsub.Ping.$Shape;
     *   (properties?: pubsub.Ping.$Properties): pubsub.Ping;
     * }}
     */
    Ping.create = function (properties) {
      return new Ping(properties);
    };

    /**
     * Encodes the specified Ping message. Does not implicitly {@link pubsub.Ping.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Ping
     * @static
     * @param {pubsub.Ping.$Properties} message Ping message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Ping.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.seq != null &&
        $Object.hasOwnProperty.call(message, "seq") &&
        (typeof message.seq === "object"
          ? message.seq.low || message.seq.high
          : message.seq !== 0)
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint64(message.seq);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Ping message, length delimited. Does not implicitly {@link pubsub.Ping.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Ping
     * @static
     * @param {pubsub.Ping.$Properties} message Ping message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Ping.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a Ping message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Ping
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Ping & pubsub.Ping.$Shape} Ping
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Ping.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Ping(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 0) break;
            if (
              typeof (value = reader.uint64()) === "object"
                ? value.low || value.high
                : value !== 0
            )
              message.seq = value;
            else delete message.seq;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a Ping message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Ping
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Ping & pubsub.Ping.$Shape} Ping
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Ping.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Ping message.
     * @function verify
     * @memberof pubsub.Ping
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Ping.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (message.seq != null && $Object.hasOwnProperty.call(message, "seq"))
        if (
          !$util.isInteger(message.seq) &&
          !(
            message.seq &&
            $util.isInteger(message.seq.low) &&
            $util.isInteger(message.seq.high)
          )
        )
          return "seq: integer|Long expected";
      return null;
    };

    /**
     * Creates a Ping message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Ping
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Ping} Ping
     */
    Ping.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Ping) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Ping: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Ping();
      if (object.seq != null)
        if (
          typeof object.seq === "object"
            ? object.seq.low || object.seq.high
            : $Number(object.seq) !== 0
        )
          if ($util.Long) message.seq = $util.Long.fromValue(object.seq, true);
          else if (typeof object.seq === "string")
            message.seq = $parseInt(object.seq, 10);
          else if (typeof object.seq === "number") message.seq = object.seq;
          else if (typeof object.seq === "object")
            message.seq = new $util.LongBits(
              object.seq.low >>> 0,
              object.seq.high >>> 0
            ).toNumber(true);
      return message;
    };

    /**
     * Creates a plain object from a Ping message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Ping
     * @static
     * @param {pubsub.Ping} message Ping
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Ping.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults)
        if ($util.Long) {
          var long = new $util.Long(0, 0, true);
          object.seq =
            options.longs === $String
              ? long.toString()
              : options.longs === $Number
                ? long.toNumber()
                : typeof $BigInt !== "undefined" && options.longs === $BigInt
                  ? long.toBigInt()
                  : long;
        } else
          object.seq =
            options.longs === $String
              ? "0"
              : typeof $BigInt !== "undefined" && options.longs === $BigInt
                ? $BigInt("0")
                : 0;
      if (message.seq != null && $Object.hasOwnProperty.call(message, "seq"))
        if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
          object.seq =
            typeof message.seq === "number"
              ? $BigInt(message.seq)
              : $util.Long.fromBits(
                  message.seq.low >>> 0,
                  message.seq.high >>> 0,
                  true
                ).toBigInt();
        else if (typeof message.seq === "number")
          object.seq =
            options.longs === $String ? $String(message.seq) : message.seq;
        else
          object.seq =
            options.longs === $String
              ? $util.Long.prototype.toString.call(message.seq)
              : options.longs === $Number
                ? new $util.LongBits(
                    message.seq.low >>> 0,
                    message.seq.high >>> 0
                  ).toNumber(true)
                : message.seq;
      return object;
    };

    /**
     * Converts this Ping to JSON.
     * @function toJSON
     * @memberof pubsub.Ping
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Ping.prototype.toJSON = function () {
      return Ping.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Ping
     * @function getTypeUrl
     * @memberof pubsub.Ping
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Ping.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Ping";
    };

    return Ping;
  })();

  pubsub.Ack = (function () {
    /**
     * Properties of an Ack.
     * @typedef {Object} pubsub.Ack.$Properties
     * @property {string|null} [requestId] Ack requestId
     * @property {boolean|null} [ok] Ack ok
     * @property {string|null} [error] Ack error
     * @property {string|null} [messageId] Ack messageId
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of an Ack.
     * @memberof pubsub
     * @interface IAck
     * @augments pubsub.Ack.$Properties
     * @deprecated Use pubsub.Ack.$Properties instead.
     */

    /**
     * Shape of an Ack.
     * @typedef {pubsub.Ack.$Properties} pubsub.Ack.$Shape
     */

    /**
     * Constructs a new Ack.
     * @memberof pubsub
     * @classdesc Represents an Ack.
     * @constructor
     * @param {pubsub.Ack.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Ack = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Ack requestId.
     * @member {string} requestId
     * @memberof pubsub.Ack
     * @instance
     */
    Ack.prototype.requestId = "";

    /**
     * Ack ok.
     * @member {boolean} ok
     * @memberof pubsub.Ack
     * @instance
     */
    Ack.prototype.ok = false;

    /**
     * Ack error.
     * @member {string} error
     * @memberof pubsub.Ack
     * @instance
     */
    Ack.prototype.error = "";

    /**
     * Ack messageId.
     * @member {string} messageId
     * @memberof pubsub.Ack
     * @instance
     */
    Ack.prototype.messageId = "";

    /**
     * Creates a new Ack instance using the specified properties.
     * @function create
     * @memberof pubsub.Ack
     * @static
     * @param {pubsub.Ack.$Properties=} [properties] Properties to set
     * @returns {pubsub.Ack} Ack instance
     * @type {{
     *   (properties: pubsub.Ack.$Shape): pubsub.Ack & pubsub.Ack.$Shape;
     *   (properties?: pubsub.Ack.$Properties): pubsub.Ack;
     * }}
     */
    Ack.create = function (properties) {
      return new Ack(properties);
    };

    /**
     * Encodes the specified Ack message. Does not implicitly {@link pubsub.Ack.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Ack
     * @static
     * @param {pubsub.Ack.$Properties} message Ack message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Ack.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId") &&
        message.requestId !== ""
      )
        writer.uint32(/* id 1, wireType 2 =*/ 10).string(message.requestId);
      if (
        message.ok != null &&
        $Object.hasOwnProperty.call(message, "ok") &&
        message.ok !== false
      )
        writer.uint32(/* id 2, wireType 0 =*/ 16).bool(message.ok);
      if (
        message.error != null &&
        $Object.hasOwnProperty.call(message, "error") &&
        message.error !== ""
      )
        writer.uint32(/* id 3, wireType 2 =*/ 26).string(message.error);
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId") &&
        message.messageId !== ""
      )
        writer.uint32(/* id 4, wireType 2 =*/ 34).string(message.messageId);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Ack message, length delimited. Does not implicitly {@link pubsub.Ack.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Ack
     * @static
     * @param {pubsub.Ack.$Properties} message Ack message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Ack.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes an Ack message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Ack
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Ack & pubsub.Ack.$Shape} Ack
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Ack.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Ack(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.requestId = value;
            else delete message.requestId;
            continue;
          }
          case 2: {
            if (wireType !== 0) break;
            if ((value = reader.bool())) message.ok = value;
            else delete message.ok;
            continue;
          }
          case 3: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length) message.error = value;
            else delete message.error;
            continue;
          }
          case 4: {
            if (wireType !== 2) break;
            if ((value = reader.stringVerify()).length)
              message.messageId = value;
            else delete message.messageId;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes an Ack message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Ack
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Ack & pubsub.Ack.$Shape} Ack
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Ack.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies an Ack message.
     * @function verify
     * @memberof pubsub.Ack
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Ack.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        if (!$util.isString(message.requestId))
          return "requestId: string expected";
      if (message.ok != null && $Object.hasOwnProperty.call(message, "ok"))
        if (typeof message.ok !== "boolean") return "ok: boolean expected";
      if (
        message.error != null &&
        $Object.hasOwnProperty.call(message, "error")
      )
        if (!$util.isString(message.error)) return "error: string expected";
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        if (!$util.isString(message.messageId))
          return "messageId: string expected";
      return null;
    };

    /**
     * Creates an Ack message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Ack
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Ack} Ack
     */
    Ack.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Ack) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Ack: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Ack();
      if (object.requestId != null)
        if (typeof object.requestId !== "string" || object.requestId.length)
          message.requestId = $String(object.requestId);
      if (object.ok != null) if (object.ok) message.ok = $Boolean(object.ok);
      if (object.error != null)
        if (typeof object.error !== "string" || object.error.length)
          message.error = $String(object.error);
      if (object.messageId != null)
        if (typeof object.messageId !== "string" || object.messageId.length)
          message.messageId = $String(object.messageId);
      return message;
    };

    /**
     * Creates a plain object from an Ack message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Ack
     * @static
     * @param {pubsub.Ack} message Ack
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Ack.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults) {
        object.requestId = "";
        object.ok = false;
        object.error = "";
        object.messageId = "";
      }
      if (
        message.requestId != null &&
        $Object.hasOwnProperty.call(message, "requestId")
      )
        object.requestId = message.requestId;
      if (message.ok != null && $Object.hasOwnProperty.call(message, "ok"))
        object.ok = message.ok;
      if (
        message.error != null &&
        $Object.hasOwnProperty.call(message, "error")
      )
        object.error = message.error;
      if (
        message.messageId != null &&
        $Object.hasOwnProperty.call(message, "messageId")
      )
        object.messageId = message.messageId;
      return object;
    };

    /**
     * Converts this Ack to JSON.
     * @function toJSON
     * @memberof pubsub.Ack
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Ack.prototype.toJSON = function () {
      return Ack.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Ack
     * @function getTypeUrl
     * @memberof pubsub.Ack
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Ack.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Ack";
    };

    return Ack;
  })();

  pubsub.Welcome = (function () {
    /**
     * Properties of a Welcome.
     * @typedef {Object} pubsub.Welcome.$Properties
     * @property {number|null} [pingIntervalMs] Welcome pingIntervalMs
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */

    /**
     * Properties of a Welcome.
     * @memberof pubsub
     * @interface IWelcome
     * @augments pubsub.Welcome.$Properties
     * @deprecated Use pubsub.Welcome.$Properties instead.
     */

    /**
     * Shape of a Welcome.
     * @typedef {pubsub.Welcome.$Properties} pubsub.Welcome.$Shape
     */

    /**
     * Constructs a new Welcome.
     * @memberof pubsub
     * @classdesc Represents a Welcome.
     * @constructor
     * @param {pubsub.Welcome.$Properties=} [properties] Properties to set
     * @property {Array.<Uint8Array>} [$unknowns] Unknown fields preserved while decoding when enabled
     */
    var Welcome = function (properties) {
      if (properties)
        for (var keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
          if (properties[keys[i]] != null && keys[i] !== "__proto__")
            this[keys[i]] = properties[keys[i]];
    };

    /**
     * Welcome pingIntervalMs.
     * @member {number} pingIntervalMs
     * @memberof pubsub.Welcome
     * @instance
     */
    Welcome.prototype.pingIntervalMs = 0;

    /**
     * Creates a new Welcome instance using the specified properties.
     * @function create
     * @memberof pubsub.Welcome
     * @static
     * @param {pubsub.Welcome.$Properties=} [properties] Properties to set
     * @returns {pubsub.Welcome} Welcome instance
     * @type {{
     *   (properties: pubsub.Welcome.$Shape): pubsub.Welcome & pubsub.Welcome.$Shape;
     *   (properties?: pubsub.Welcome.$Properties): pubsub.Welcome;
     * }}
     */
    Welcome.create = function (properties) {
      return new Welcome(properties);
    };

    /**
     * Encodes the specified Welcome message. Does not implicitly {@link pubsub.Welcome.verify|verify} messages.
     * @function encode
     * @memberof pubsub.Welcome
     * @static
     * @param {pubsub.Welcome.$Properties} message Welcome message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Welcome.encode = function (message, writer, _depth) {
      if (!writer) writer = $Writer.create();
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      if (
        message.pingIntervalMs != null &&
        $Object.hasOwnProperty.call(message, "pingIntervalMs") &&
        message.pingIntervalMs !== 0
      )
        writer.uint32(/* id 1, wireType 0 =*/ 8).uint32(message.pingIntervalMs);
      if (
        message.$unknowns != null &&
        $Object.hasOwnProperty.call(message, "$unknowns")
      )
        for (var i = 0; i < message.$unknowns.length; ++i)
          writer.raw(message.$unknowns[i]);
      return writer;
    };

    /**
     * Encodes the specified Welcome message, length delimited. Does not implicitly {@link pubsub.Welcome.verify|verify} messages.
     * @function encodeDelimited
     * @memberof pubsub.Welcome
     * @static
     * @param {pubsub.Welcome.$Properties} message Welcome message or plain object to encode
     * @param {$protobuf.Writer} [writer] Writer to encode to
     * @returns {$protobuf.Writer} Writer
     */
    Welcome.encodeDelimited = function (message, writer) {
      return this.encode(
        message,
        writer && writer.len ? writer.fork() : writer
      ).ldelim();
    };

    /**
     * Decodes a Welcome message from the specified reader or buffer.
     * @function decode
     * @memberof pubsub.Welcome
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @param {number} [length] Message length if known beforehand
     * @returns {pubsub.Welcome & pubsub.Welcome.$Shape} Welcome
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Welcome.decode = function (reader, length, _end, _depth, _target) {
      if (!(reader instanceof $Reader)) reader = $Reader.create(reader);
      if (_depth === $undefined) _depth = 0;
      if (_depth > $Reader.recursionLimit) throw $Error("max depth exceeded");
      var end = length === $undefined ? reader.len : reader.pos + length,
        message = _target || new $root.pubsub.Welcome(),
        value;
      while (reader.pos < end) {
        var start = reader.pos;
        var tag = reader.tag();
        if (tag === _end) {
          _end = $undefined;
          break;
        }
        var wireType = tag & 7;
        switch ((tag >>>= 3)) {
          case 1: {
            if (wireType !== 0) break;
            if ((value = reader.uint32())) message.pingIntervalMs = value;
            else delete message.pingIntervalMs;
            continue;
          }
        }
        reader.skipType(wireType, _depth, tag);
        if (!reader.discardUnknown) {
          $util.makeProp(message, "$unknowns", false);
          (message.$unknowns || (message.$unknowns = [])).push(
            reader.raw(start, reader.pos)
          );
        }
      }
      if (_end !== $undefined) throw $Error("missing end group");
      return message;
    };

    /**
     * Decodes a Welcome message from the specified reader or buffer, length delimited.
     * @function decodeDelimited
     * @memberof pubsub.Welcome
     * @static
     * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
     * @returns {pubsub.Welcome & pubsub.Welcome.$Shape} Welcome
     * @throws {Error} If the payload is not a reader or valid buffer
     * @throws {$protobuf.util.ProtocolError} If required fields are missing
     */
    Welcome.decodeDelimited = function (reader) {
      if (!(reader instanceof $Reader)) reader = new $Reader(reader);
      return this.decode(reader, reader.uint32());
    };

    /**
     * Verifies a Welcome message.
     * @function verify
     * @memberof pubsub.Welcome
     * @static
     * @param {Object.<string,*>} message Plain object to verify
     * @returns {string|null} `null` if valid, otherwise the reason why it is not
     */
    Welcome.verify = function (message, _depth) {
      if (typeof message !== "object" || message === null)
        return "object expected";
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) return "max depth exceeded";
      if (
        message.pingIntervalMs != null &&
        $Object.hasOwnProperty.call(message, "pingIntervalMs")
      )
        if (!$util.isInteger(message.pingIntervalMs))
          return "pingIntervalMs: integer expected";
      return null;
    };

    /**
     * Creates a Welcome message from a plain object. Also converts values to their respective internal types.
     * @function fromObject
     * @memberof pubsub.Welcome
     * @static
     * @param {Object.<string,*>} object Plain object
     * @returns {pubsub.Welcome} Welcome
     */
    Welcome.fromObject = function (object, _depth) {
      if (object instanceof $root.pubsub.Welcome) return object;
      if (!$util.isObject(object))
        throw $TypeError(".pubsub.Welcome: object expected");
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var message = new $root.pubsub.Welcome();
      if (object.pingIntervalMs != null)
        if ($Number(object.pingIntervalMs) !== 0)
          message.pingIntervalMs = object.pingIntervalMs >>> 0;
      return message;
    };

    /**
     * Creates a plain object from a Welcome message. Also converts values to other types if specified.
     * @function toObject
     * @memberof pubsub.Welcome
     * @static
     * @param {pubsub.Welcome} message Welcome
     * @param {$protobuf.IConversionOptions} [options] Conversion options
     * @returns {Object.<string,*>} Plain object
     */
    Welcome.toObject = function (message, options, _depth) {
      if (!options) options = {};
      if (_depth === $undefined) _depth = 0;
      if (_depth > $util.recursionLimit) throw $Error("max depth exceeded");
      var object = {};
      if (options.defaults) object.pingIntervalMs = 0;
      if (
        message.pingIntervalMs != null &&
        $Object.hasOwnProperty.call(message, "pingIntervalMs")
      )
        object.pingIntervalMs = message.pingIntervalMs;
      return object;
    };

    /**
     * Converts this Welcome to JSON.
     * @function toJSON
     * @memberof pubsub.Welcome
     * @instance
     * @returns {Object.<string,*>} JSON object
     */
    Welcome.prototype.toJSON = function () {
      return Welcome.toObject(this, $protobuf.util.toJSONOptions);
    };

    /**
     * Gets the type url for Welcome
     * @function getTypeUrl
     * @memberof pubsub.Welcome
     * @static
     * @param {string} [prefix] Custom type url prefix, defaults to `"type.googleapis.com"`
     * @returns {string} The type url
     */
    Welcome.getTypeUrl = function (prefix) {
      if (prefix === $undefined) prefix = "type.googleapis.com";
      return prefix + "/pubsub.Welcome";
    };

    return Welcome;
  })();

  return pubsub;
})();

module.exports = $root;


/***/ }),

/***/ 993:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var regeneratorDefine = __webpack_require__(546);
function _regenerator() {
  /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */
  var e,
    t,
    r = "function" == typeof Symbol ? Symbol : {},
    n = r.iterator || "@@iterator",
    o = r.toStringTag || "@@toStringTag";
  function i(r, n, o, i) {
    var c = n && n.prototype instanceof Generator ? n : Generator,
      u = Object.create(c.prototype);
    return regeneratorDefine(u, "_invoke", function (r, n, o) {
      var i,
        c,
        u,
        f = 0,
        p = o || [],
        y = !1,
        G = {
          p: 0,
          n: 0,
          v: e,
          a: d,
          f: d.bind(e, 4),
          d: function d(t, r) {
            return i = t, c = 0, u = e, G.n = r, a;
          }
        };
      function d(r, n) {
        for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) {
          var o,
            i = p[t],
            d = G.p,
            l = i[2];
          r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0));
        }
        if (o || r > 1) return a;
        throw y = !0, n;
      }
      return function (o, p, l) {
        if (f > 1) throw TypeError("Generator is already running");
        for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) {
          i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u);
          try {
            if (f = 2, i) {
              if (c || (o = "next"), t = i[o]) {
                if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object");
                if (!t.done) return t;
                u = t.value, c < 2 && (c = 0);
              } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1);
              i = e;
            } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break;
          } catch (t) {
            i = e, c = 1, u = t;
          } finally {
            f = 1;
          }
        }
        return {
          value: t,
          done: y
        };
      };
    }(r, o, i), !0), u;
  }
  var a = {};
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  t = Object.getPrototypeOf;
  var c = [][n] ? t(t([][n]())) : (regeneratorDefine(t = {}, n, function () {
      return this;
    }), t),
    u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c);
  function f(e) {
    return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, regeneratorDefine(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e;
  }
  return GeneratorFunction.prototype = GeneratorFunctionPrototype, regeneratorDefine(u, "constructor", GeneratorFunctionPrototype), regeneratorDefine(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", regeneratorDefine(GeneratorFunctionPrototype, o, "GeneratorFunction"), regeneratorDefine(u), regeneratorDefine(u, o, "Generator"), regeneratorDefine(u, n, function () {
    return this;
  }), regeneratorDefine(u, "toString", function () {
    return "[object Generator]";
  }), (module.exports = _regenerator = function _regenerator() {
    return {
      w: i,
      m: f
    };
  }, module.exports.__esModule = true, module.exports["default"] = module.exports)();
}
module.exports = _regenerator, module.exports.__esModule = true, module.exports["default"] = module.exports;

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";

;// ./node_modules/@babel/runtime/helpers/esm/asyncToGenerator.js
function asyncGeneratorStep(n, t, e, r, o, a, c) {
  try {
    var i = n[a](c),
      u = i.value;
  } catch (n) {
    return void e(n);
  }
  i.done ? t(u) : Promise.resolve(u).then(r, o);
}
function _asyncToGenerator(n) {
  return function () {
    var t = this,
      e = arguments;
    return new Promise(function (r, o) {
      var a = n.apply(t, e);
      function _next(n) {
        asyncGeneratorStep(a, r, o, _next, _throw, "next", n);
      }
      function _throw(n) {
        asyncGeneratorStep(a, r, o, _next, _throw, "throw", n);
      }
      _next(void 0);
    });
  };
}

// EXTERNAL MODULE: ./node_modules/@babel/runtime/regenerator/index.js
var regenerator = __webpack_require__(756);
var regenerator_default = /*#__PURE__*/__webpack_require__.n(regenerator);
;// ./node_modules/@babel/runtime/helpers/esm/arrayWithHoles.js
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}

;// ./node_modules/@babel/runtime/helpers/esm/iterableToArrayLimit.js
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e,
      n,
      i,
      u,
      a = [],
      f = !0,
      o = !1;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t) return;
        f = !1;
      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0);
    } catch (r) {
      o = !0, n = r;
    } finally {
      try {
        if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}

;// ./node_modules/@babel/runtime/helpers/esm/arrayLikeToArray.js
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}

;// ./node_modules/@babel/runtime/helpers/esm/unsupportedIterableToArray.js

function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}

;// ./node_modules/@babel/runtime/helpers/esm/nonIterableRest.js
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

;// ./node_modules/@babel/runtime/helpers/esm/slicedToArray.js




function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}

;// ./node_modules/@babel/runtime/helpers/esm/classCallCheck.js
function _classCallCheck(a, n) {
  if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function");
}

;// ./node_modules/@babel/runtime/helpers/esm/typeof.js
function _typeof(o) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, _typeof(o);
}

;// ./node_modules/@babel/runtime/helpers/esm/toPrimitive.js

function toPrimitive(t, r) {
  if ("object" != _typeof(t) || !t) return t;
  var e = t[Symbol.toPrimitive];
  if (void 0 !== e) {
    var i = e.call(t, r || "default");
    if ("object" != _typeof(i)) return i;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return ("string" === r ? String : Number)(t);
}

;// ./node_modules/@babel/runtime/helpers/esm/toPropertyKey.js


function toPropertyKey(t) {
  var i = toPrimitive(t, "string");
  return "symbol" == _typeof(i) ? i : i + "";
}

;// ./node_modules/@babel/runtime/helpers/esm/createClass.js

function _defineProperties(e, r) {
  for (var t = 0; t < r.length; t++) {
    var o = r[t];
    o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, toPropertyKey(o.key), o);
  }
}
function _createClass(e, r, t) {
  return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", {
    writable: !1
  }), e;
}

;// ./node_modules/@babel/runtime/helpers/esm/assertThisInitialized.js
function _assertThisInitialized(e) {
  if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  return e;
}

;// ./node_modules/@babel/runtime/helpers/esm/possibleConstructorReturn.js


function _possibleConstructorReturn(t, e) {
  if (e && ("object" == _typeof(e) || "function" == typeof e)) return e;
  if (void 0 !== e) throw new TypeError("Derived constructors may only return object or undefined");
  return _assertThisInitialized(t);
}

;// ./node_modules/@babel/runtime/helpers/esm/getPrototypeOf.js
function _getPrototypeOf(t) {
  return _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function (t) {
    return t.__proto__ || Object.getPrototypeOf(t);
  }, _getPrototypeOf(t);
}

;// ./node_modules/@babel/runtime/helpers/esm/setPrototypeOf.js
function _setPrototypeOf(t, e) {
  return _setPrototypeOf = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function (t, e) {
    return t.__proto__ = e, t;
  }, _setPrototypeOf(t, e);
}

;// ./node_modules/@babel/runtime/helpers/esm/inherits.js

function _inherits(t, e) {
  if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function");
  t.prototype = Object.create(e && e.prototype, {
    constructor: {
      value: t,
      writable: !0,
      configurable: !0
    }
  }), Object.defineProperty(t, "prototype", {
    writable: !1
  }), e && _setPrototypeOf(t, e);
}

// EXTERNAL MODULE: ./node_modules/events/events.js
var events = __webpack_require__(7);
// EXTERNAL MODULE: ./src/lib/fastws.pb.js
var fastws_pb = __webpack_require__(949);
var fastws_pb_default = /*#__PURE__*/__webpack_require__.n(fastws_pb);
;// ./src/lib/uuid.js
// UUID generator with a fallback for runtimes without `crypto.randomUUID`
// (Safari < 15.4, insecure contexts, older WebViews). All pubsub correlation
// ids (subscribe/publish request_id, publish message_id) route through here.

function generateRequestId() {
  return "".concat(Date.now().toString(36), "-").concat(Math.random().toString(36).slice(2, 10));
}
;// ./src/lib/pubsubClient.js








function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = pubsubClient_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function pubsubClient_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return pubsubClient_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? pubsubClient_arrayLikeToArray(r, a) : void 0; } }
function pubsubClient_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _callSuper(t, o, e) { return o = _getPrototypeOf(o), _possibleConstructorReturn(t, _isNativeReflectConstruct() ? Reflect.construct(o, e || [], _getPrototypeOf(t).constructor) : o.apply(t, e)); }
function _isNativeReflectConstruct() { try { var t = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {})); } catch (t) {} return (_isNativeReflectConstruct = function _isNativeReflectConstruct() { return !!t; })(); }
// fastws WebSocket client used by the SDK's pubSub feature.
//
// Messages are encoded/decoded with protobufjs against ./fastws.proto;
// the generated static module lives at ./fastws.pb.js. Regenerate it with:
//
//   npm run build:proto




var pubsub = (fastws_pb_default()).pubsub;
var ClientMessage = pubsub.ClientMessage,
  ServerEnvelope = pubsub.ServerEnvelope,
  ServerMessage = pubsub.ServerMessage;
var RECONNECT_BASE_DELAY_MS = 1000;
// Ceiling for the exponential backoff. Without it the delay grows without
// bound: by attempt ~20 it is days, and past attempt 21 it exceeds the 2^31-1
// ms that setTimeout accepts — browsers and Node silently coerce that to 1ms,
// flipping the client from "never retries" into a tight reconnect spin.
var RECONNECT_MAX_DELAY_MS = 30000;
// Fraction of the delay applied as random jitter. Every client dropped by the
// same server restart would otherwise retry in lockstep on identical
// 1s/2s/4s/8s boundaries, re-creating the thundering herd the backoff exists
// to prevent.
var RECONNECT_JITTER_RATIO = 0.25;
var ACK_TIMEOUT_MS = 30000;
var ACK_TIMEOUT_MESSAGE = "operation has timed out";
var DEFAULT_PING_INTERVAL_MS = 30000;
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function encodeClientMessage(payload) {
  var err = ClientMessage.verify(payload);
  if (err) throw new Error("ClientMessage.verify: ".concat(err));
  return ClientMessage.encode(ClientMessage.create(payload)).finish();
}
function buildSubscribe(topic, peerId, oldMessageLimit, realtimeOverflow, maxQueue, requestId, newMessageLimit) {
  return encodeClientMessage({
    subscribe: {
      topic: topic,
      peerId: peerId || "",
      oldMessageLimit: oldMessageLimit !== null && oldMessageLimit !== void 0 ? oldMessageLimit : -1,
      realtimeOverflow: realtimeOverflow || "queue",
      queueSize: maxQueue,
      requestId: requestId,
      newMessageLimit: newMessageLimit || 0
    }
  });
}
function buildUnsubscribe(topic, requestId) {
  return encodeClientMessage({
    unsubscribe: {
      topic: topic,
      requestId: requestId
    }
  });
}
function buildPong(seq) {
  return encodeClientMessage({
    pong: {
      seq: seq || 0
    }
  });
}
function buildPublish(topic) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    message = _ref.message,
    timestamp = _ref.timestamp,
    payload = _ref.payload,
    sendOnly = _ref.sendOnly,
    senderId = _ref.senderId,
    senderName = _ref.senderName,
    persist = _ref.persist,
    messageId = _ref.messageId;
  var requestId = arguments.length > 2 ? arguments[2] : undefined;
  var payloadBytes = payload != null ? textEncoder.encode(JSON.stringify(payload)) : new Uint8Array();
  return encodeClientMessage({
    publish: {
      topic: topic,
      payload: payloadBytes,
      message: message !== null && message !== void 0 ? message : "",
      sendOnly: Array.isArray(sendOnly) ? sendOnly : [],
      timestamp: timestamp !== null && timestamp !== void 0 ? timestamp : "",
      senderId: senderId !== null && senderId !== void 0 ? senderId : "",
      senderName: senderName !== null && senderName !== void 0 ? senderName : "",
      persist: !!persist,
      messageId: messageId !== null && messageId !== void 0 ? messageId : "",
      requestId: requestId
    }
  });
}
function decodeServerBatch(batch, lastSeq) {
  var isHistory = batch.batchType === "old-messages";
  var droppedCount = 0;
  var newLastSeq = lastSeq;
  var messages = (batch.payloads || []).map(function (payloadBytes) {
    var serverMessage = ServerMessage.decode(payloadBytes);
    var parsedPayload = {};
    if (serverMessage.payload && serverMessage.payload.length) {
      var str = textDecoder.decode(serverMessage.payload);
      try {
        parsedPayload = JSON.parse(str);
      } catch (_) {
        parsedPayload = {};
      }
    }
    var seqNum = serverMessage.seqNum ? Number(serverMessage.seqNum) : 0;
    if (!isHistory && Number.isFinite(seqNum) && seqNum > 0) {
      if (newLastSeq !== undefined && seqNum - newLastSeq > 1) {
        droppedCount += seqNum - newLastSeq - 1;
      }
      if (newLastSeq === undefined || seqNum > newLastSeq) {
        newLastSeq = seqNum;
      }
    }
    return {
      message: serverMessage.message,
      payload: parsedPayload,
      timestamp: serverMessage.timestamp,
      senderId: serverMessage.senderId,
      senderName: serverMessage.senderName,
      persistMsgId: serverMessage.persistMsgId || "",
      id: serverMessage.messageId || "",
      sendOnly: serverMessage.sendOnly || [],
      seqNum: seqNum
    };
  });
  return {
    topic: batch.topic,
    isHistory: isHistory,
    isLast: !!batch.isLast,
    requestId: batch.requestId || "",
    messages: messages,
    droppedCount: droppedCount,
    lastSeq: newLastSeq
  };
}
var PubsubClient = /*#__PURE__*/function (_EventEmitter) {
  function PubsubClient() {
    var _this;
    var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      url = _ref2.url,
      peerId = _ref2.peerId;
    _classCallCheck(this, PubsubClient);
    _this = _callSuper(this, PubsubClient);
    _this._url = url;
    _this._peerId = peerId;
    _this._ws = null;
    _this._openPromise = null;
    _this._intentionalClose = false;
    _this._pending = new Map();
    _this._activeReplayByTopic = new Map();
    // Per-subscription params, keyed by requestId — NOT by topic. meeting.js
    // may hold multiple subscribers on the same topic with distinct configs
    // (own requestIds); collapsing them into one entry per topic would silently
    // change subscriber A's config to subscriber B's after a reconnect.
    _this._activeSubscriptions = new Map();
    _this._lastSeqByTopic = new Map();
    _this._reconnectTimer = null;
    _this._pingWatchdogTimer = null;
    _this._pingTimeoutMs = 0;
    _this._lastPingSeq = 0;
    _this._reconnecting = false;
    return _this;
  }
  _inherits(PubsubClient, _EventEmitter);
  return _createClass(PubsubClient, [{
    key: "connect",
    value: function connect() {
      if (this._openPromise) return this._openPromise;
      this._openPromise = this._openSocket();
      return this._openPromise;
    }
  }, {
    key: "_openSocket",
    value: function _openSocket() {
      var _this2 = this;
      return new Promise(function (resolve, reject) {
        var ws = new WebSocket(_this2._url);
        ws.binaryType = "arraybuffer";
        _this2._ws = ws;
        ws.onopen = function () {
          resolve();
        };
        ws.onerror = function () {
          var err = new Error("Operation Timeout");
          _this2.emit("error", err);
          reject(err);
        };
        ws.onclose = function () {
          reject(null);
          _this2._handleClose();
        };
        ws.onmessage = function (messageEvent) {
          var frameBytes = messageEvent.data instanceof Uint8Array ? messageEvent.data : new Uint8Array(messageEvent.data);
          var envelope = ServerEnvelope.decode(frameBytes);
          if (envelope.welcome) {
            _this2._handleWelcome(envelope.welcome);
            return;
          }
          if (envelope.ping) {
            _this2._handlePing(envelope.ping);
            return;
          }
          if (envelope.ack) {
            _this2._handleAck(envelope.ack);
            return;
          }
          if (envelope.batch) {
            _this2._handleBatch(envelope.batch);
          }
        };
      });
    }
  }, {
    key: "_handleClose",
    value: function _handleClose(reason) {
      if (!this._ws) return;
      this._ws = null;
      this._clearPingWatchdog();
      this._pingTimeoutMs = 0;
      this._lastPingSeq = 0;
      var pendingErr = reason instanceof Error ? reason : new Error("Operation Timeout");
      var _iterator = _createForOfIteratorHelper(this._pending),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var _step$value = _slicedToArray(_step.value, 2),
            pending = _step$value[1];
          pending.reject(pendingErr);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      this._pending.clear();
      this._activeReplayByTopic.clear();
      this._lastSeqByTopic.clear();
      this.emit("close");
      if (this._intentionalClose) {
        this._openPromise = null;
        return;
      }

      // A reconnect loop already running will trip its own onclose on each
      // failed attempt; without this guard those onclose events stack up
      // parallel _reconnect loops → exponential fan-out of retries.
      if (this._reconnecting) return;
      this._openPromise = this._reconnect();
    }

    // Capped exponential backoff with jitter. `attempt` is 0-based, so the
    // sequence is ~1s, 2s, 4s, 8s, 16s, then flat at RECONNECT_MAX_DELAY_MS,
    // each spread by +/- RECONNECT_JITTER_RATIO.
  }, {
    key: "_reconnectDelay",
    value: function _reconnectDelay(attempt) {
      var capped = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
      var jitter = capped * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1);
      // Never return < base: a jittered-down first attempt should still wait.
      return Math.max(RECONNECT_BASE_DELAY_MS, Math.round(capped + jitter));
    }
  }, {
    key: "_reconnect",
    value: function () {
      var _reconnect2 = _asyncToGenerator(/*#__PURE__*/regenerator_default().mark(function _callee() {
        var _this3 = this;
        var attempt, _loop, _ret, _this$_ws, _iterator2, _step2, _step2$value, reqId, sub;
        return regenerator_default().wrap(function (_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              this._reconnecting = true;
              _context2.prev = 1;
              attempt = 0;
              _loop = /*#__PURE__*/regenerator_default().mark(function _loop() {
                var delay, _t;
                return regenerator_default().wrap(function (_context) {
                  while (1) switch (_context.prev = _context.next) {
                    case 0:
                      delay = _this3._reconnectDelay(attempt);
                      _context.next = 1;
                      return new Promise(function (r) {
                        _this3._reconnectTimer = setTimeout(r, delay);
                      });
                    case 1:
                      if (!_this3._intentionalClose) {
                        _context.next = 2;
                        break;
                      }
                      return _context.abrupt("return", {
                        v: void 0
                      });
                    case 2:
                      _context.prev = 2;
                      _context.next = 3;
                      return _this3._openSocket();
                    case 3:
                      return _context.abrupt("return", 0);
                    case 4:
                      _context.prev = 4;
                      _t = _context["catch"](2);
                      if (!_this3._intentionalClose) {
                        _context.next = 5;
                        break;
                      }
                      return _context.abrupt("return", {
                        v: void 0
                      });
                    case 5:
                      attempt++;
                    case 6:
                    case "end":
                      return _context.stop();
                  }
                }, _loop, null, [[2, 4]]);
              });
            case 2:
              if (false) // removed by dead control flow
{}
              return _context2.delegateYield(_loop(), "t0", 3);
            case 3:
              _ret = _context2.t0;
              if (!(_ret === 0)) {
                _context2.next = 4;
                break;
              }
              return _context2.abrupt("continue", 6);
            case 4:
              if (!_ret) {
                _context2.next = 5;
                break;
              }
              return _context2.abrupt("return", _ret.v);
            case 5:
              _context2.next = 2;
              break;
            case 6:
              if (!this._intentionalClose) {
                _context2.next = 7;
                break;
              }
              (_this$_ws = this._ws) === null || _this$_ws === void 0 || _this$_ws.close();
              return _context2.abrupt("return");
            case 7:
              // Replay every active subscription (per original requestId) so all
              // configs are preserved — not collapsed onto whichever config was set
              // last for a topic. Force old_message_limit=0: no history replay on
              // reconnect, only clean resume of live delivery.
              _iterator2 = _createForOfIteratorHelper(this._activeSubscriptions);
              try {
                for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                  _step2$value = _slicedToArray(_step2.value, 2), reqId = _step2$value[0], sub = _step2$value[1];
                  this._trackRequest(reqId, "subscribe")["catch"](function () {});
                  this._send(buildSubscribe(sub.topic, this._peerId, 0, sub.realtimeOverflow, sub.maxQueue, reqId, sub.newMessageLimit));
                }
              } catch (err) {
                _iterator2.e(err);
              } finally {
                _iterator2.f();
              }
              this.emit("reconnected");
            case 8:
              _context2.prev = 8;
              this._reconnecting = false;
              return _context2.finish(8);
            case 9:
            case "end":
              return _context2.stop();
          }
        }, _callee, this, [[1,, 8, 9]]);
      }));
      function _reconnect() {
        return _reconnect2.apply(this, arguments);
      }
      return _reconnect;
    }()
  }, {
    key: "_handleWelcome",
    value: function _handleWelcome(welcome) {
      var pingIntervalMs = Number(welcome.pingIntervalMs) || DEFAULT_PING_INTERVAL_MS;
      this._pingTimeoutMs = pingIntervalMs * 2;
      // Arm here instead of on the first Ping: if the server dies between
      // Welcome and its first Ping, waiting for a Ping means the watchdog never
      // arms and the dead socket is never detected.
      this._resetPingWatchdog();
      this.emit("welcome", {
        pingIntervalMs: pingIntervalMs
      });
    }
  }, {
    key: "_handlePing",
    value: function _handlePing(ping) {
      this._lastPingSeq = Number(ping.seq) || 0;
      this._resetPingWatchdog();
      try {
        this._send(buildPong(ping.seq));
      } catch (_) {
        // Socket died between receiving ping and sending pong; the close
        // handler will drive reconnect.
      }
    }
  }, {
    key: "_resetPingWatchdog",
    value: function _resetPingWatchdog() {
      var _this4 = this;
      this._clearPingWatchdog();

      // The server sends Welcome via a non-blocking try_send, so it is silently
      // dropped when the outbound channel is full — exactly the load conditions
      // where reconnect storms hurt most. _handleWelcome then never runs and
      // _pingTimeoutMs is still 0, which would arm a 0ms watchdog: it fires on
      // the next tick, tears down a healthy socket, and loops. Fall back to the
      // protocol default rather than arming a window we don't actually know.
      if (!(this._pingTimeoutMs > 0)) {
        this._pingTimeoutMs = DEFAULT_PING_INTERVAL_MS * 2;
      }
      this._pingWatchdogTimer = setTimeout(function () {
        _this4._pingWatchdogTimer = null;
        var diagnostic = new Error("No server ping for ".concat(_this4._pingTimeoutMs / 1000, "s ") + "(interval=".concat(_this4._pingTimeoutMs / 2000, "s, ") + "last seq=".concat(_this4._lastPingSeq, ")"));
        _this4.emit("error", diagnostic);
        try {
          var _this4$_ws;
          (_this4$_ws = _this4._ws) === null || _this4$_ws === void 0 || _this4$_ws.close();
        } catch (_) {}
        _this4._handleClose(new Error("Operation Timeout"));
      }, this._pingTimeoutMs);
    }
  }, {
    key: "_clearPingWatchdog",
    value: function _clearPingWatchdog() {
      if (this._pingWatchdogTimer) {
        clearTimeout(this._pingWatchdogTimer);
        this._pingWatchdogTimer = null;
      }
    }
  }, {
    key: "_handleAck",
    value: function _handleAck(ack) {
      var requestId = ack.requestId,
        ok = ack.ok,
        error = ack.error,
        messageId = ack.messageId;
      var pending = this._pending.get(requestId);
      if (!pending) return;
      this._pending["delete"](requestId);
      if (!ok) {
        pending.reject(new Error(error || "ack failed"));
        return;
      }
      if (pending.kind === "subscribe") {
        pending.resolve();
      } else {
        pending.resolve({
          requestId: requestId,
          messageId: messageId || ""
        });
      }
    }

    // Resolves a pending Subscribe correlated by `requestId`, if one is still
    // outstanding. Scoped to "subscribe" so a stray requestId collision with an
    // in-flight publish/unsubscribe can never settle the wrong promise.
  }, {
    key: "_resolveSubscribeRequest",
    value: function _resolveSubscribeRequest(requestId) {
      var pending = this._pending.get(requestId);
      if (!pending || pending.kind !== "subscribe") return;
      this._pending["delete"](requestId);
      pending.resolve();
    }
  }, {
    key: "_handleBatch",
    value: function _handleBatch(rawBatch) {
      var batch = decodeServerBatch(rawBatch, this._lastSeqByTopic.get(rawBatch.topic));
      if (batch.isHistory) {
        var queue = this._activeReplayByTopic.get(batch.topic);
        if (batch.requestId) {
          if (!queue) {
            queue = [];
            this._activeReplayByTopic.set(batch.topic, queue);
          }
          if (!queue.includes(batch.requestId)) queue.push(batch.requestId);
        }
        var ownerRequestId = batch.requestId || queue && queue[0] || "";

        // A Subscribe that replays history gets NO Ack — the server lets the
        // first old-messages batch double as the subscribe response and rides
        // the request_id on it (subsequent batches carry an empty one). Settle
        // the pending subscribe here, otherwise it sits in `_pending` until the
        // ACK_TIMEOUT fires and rejects a subscription that actually succeeded.
        // The empty-history cases still Ack normally, so they resolve via
        // _handleAck as before.
        if (batch.requestId) this._resolveSubscribeRequest(batch.requestId);
        this.emit("historyBatch", {
          topic: batch.topic,
          isLast: batch.isLast,
          messages: batch.messages,
          requestId: ownerRequestId
        });
        if (batch.isLast && queue) {
          var idx = queue.indexOf(ownerRequestId);
          if (idx >= 0) queue.splice(idx, 1);
          if (queue.length === 0) this._activeReplayByTopic["delete"](batch.topic);
        }
      } else {
        if (batch.lastSeq !== undefined) {
          this._lastSeqByTopic.set(batch.topic, batch.lastSeq);
        }
        if (batch.droppedCount > 0) {
          this.emit("messageDrop", {
            topic: batch.topic,
            droppedCount: batch.droppedCount
          });
        }
        this.emit("liveBatch", {
          topic: batch.topic,
          isLast: batch.isLast,
          messages: batch.messages
        });
      }
    }
  }, {
    key: "_trackRequest",
    value: function _trackRequest(requestId, kind) {
      var _this5 = this;
      return new Promise(function (_resolve, _reject) {
        var timer = setTimeout(function () {
          if (_this5._pending.has(requestId)) {
            _this5._pending["delete"](requestId);
            _reject(new Error(ACK_TIMEOUT_MESSAGE));
          }
        }, ACK_TIMEOUT_MS);
        _this5._pending.set(requestId, {
          resolve: function resolve(v) {
            clearTimeout(timer);
            _resolve(v);
          },
          reject: function reject(e) {
            clearTimeout(timer);
            _reject(e);
          },
          kind: kind
        });
      });
    }

    // Guards against sending on a socket that opened but is no longer OPEN by
    // the time we get to it — e.g. server closed during the tick between
    // `await this.connect()` resolving and the caller reaching `.send()`.
    // Without this, `_ws.send()` throws a cryptic "Cannot read properties of
    // null (reading 'send')" or "InvalidStateError" instead of a clean error.
  }, {
    key: "_send",
    value: function _send(frameBytes) {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        throw new Error("PubSub is disconnected.");
      }
      this._ws.send(frameBytes);
    }
  }, {
    key: "subscribe",
    value: function () {
      var _subscribe = _asyncToGenerator(/*#__PURE__*/regenerator_default().mark(function _callee2(topic) {
        var _ref3,
          oldMessageLimit,
          realtimeOverflow,
          maxQueue,
          requestId,
          newMessageLimit,
          reqId,
          ackPromise,
          _args3 = arguments,
          _t2;
        return regenerator_default().wrap(function (_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              _ref3 = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : {}, oldMessageLimit = _ref3.oldMessageLimit, realtimeOverflow = _ref3.realtimeOverflow, maxQueue = _ref3.maxQueue, requestId = _ref3.requestId, newMessageLimit = _ref3.newMessageLimit;
              if (!this._intentionalClose) {
                _context3.next = 1;
                break;
              }
              throw new Error("PubSub is not available because the meeting is in disconnected state.");
            case 1:
              _context3.next = 2;
              return this.connect();
            case 2:
              reqId = requestId || generateRequestId();
              ackPromise = this._trackRequest(reqId, "subscribe");
              this._send(buildSubscribe(topic, this._peerId, oldMessageLimit, realtimeOverflow, maxQueue, reqId, newMessageLimit));
              this._activeSubscriptions.set(reqId, {
                topic: topic,
                oldMessageLimit: oldMessageLimit,
                realtimeOverflow: realtimeOverflow,
                maxQueue: maxQueue,
                newMessageLimit: newMessageLimit
              });
              _context3.prev = 3;
              _context3.next = 4;
              return ackPromise;
            case 4:
              return _context3.abrupt("return", _context3.sent);
            case 5:
              _context3.prev = 5;
              _t2 = _context3["catch"](3);
              this._activeSubscriptions["delete"](reqId);
              throw _t2;
            case 6:
            case "end":
              return _context3.stop();
          }
        }, _callee2, this, [[3, 5]]);
      }));
      function subscribe(_x) {
        return _subscribe.apply(this, arguments);
      }
      return subscribe;
    }()
  }, {
    key: "unsubscribe",
    value: function () {
      var _unsubscribe = _asyncToGenerator(/*#__PURE__*/regenerator_default().mark(function _callee3(topic) {
        var _iterator3, _step3, _step3$value, reqId, sub, requestId, ackPromise;
        return regenerator_default().wrap(function (_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              if (!this._intentionalClose) {
                _context4.next = 1;
                break;
              }
              throw new Error("PubSub is not available because the meeting is in disconnected state.");
            case 1:
              // Delete synchronously — if we're mid-reconnect, the replay loop iterates
              // `_activeSubscriptions` after we resume, and this ensures the cancelled
              // topic is skipped instead of being re-subscribed only to be immediately
              // cancelled. A single server Unsubscribe cancels the topic regardless of
              // how many Subscribes were sent for it.
              _iterator3 = _createForOfIteratorHelper(this._activeSubscriptions);
              try {
                for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                  _step3$value = _slicedToArray(_step3.value, 2), reqId = _step3$value[0], sub = _step3$value[1];
                  if (sub.topic === topic) this._activeSubscriptions["delete"](reqId);
                }
              } catch (err) {
                _iterator3.e(err);
              } finally {
                _iterator3.f();
              }
              this._activeReplayByTopic["delete"](topic);
              this._lastSeqByTopic["delete"](topic);
              _context4.next = 2;
              return this.connect();
            case 2:
              requestId = generateRequestId();
              ackPromise = this._trackRequest(requestId, "unsubscribe");
              this._send(buildUnsubscribe(topic, requestId));
              return _context4.abrupt("return", ackPromise);
            case 3:
            case "end":
              return _context4.stop();
          }
        }, _callee3, this);
      }));
      function unsubscribe(_x2) {
        return _unsubscribe.apply(this, arguments);
      }
      return unsubscribe;
    }()
  }, {
    key: "publish",
    value: function () {
      var _publish = _asyncToGenerator(/*#__PURE__*/regenerator_default().mark(function _callee4(topic, fields) {
        var requestId, ackPromise;
        return regenerator_default().wrap(function (_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              if (!this._intentionalClose) {
                _context5.next = 1;
                break;
              }
              throw new Error("PubSub is not available because the meeting is in disconnected state.");
            case 1:
              _context5.next = 2;
              return this.connect();
            case 2:
              requestId = generateRequestId();
              ackPromise = this._trackRequest(requestId, "publish");
              this._send(buildPublish(topic, fields, requestId));
              return _context5.abrupt("return", ackPromise);
            case 3:
            case "end":
              return _context5.stop();
          }
        }, _callee4, this);
      }));
      function publish(_x3, _x4) {
        return _publish.apply(this, arguments);
      }
      return publish;
    }()
  }, {
    key: "close",
    value: function close() {
      this._intentionalClose = true;
      this._clearPingWatchdog();
      if (this._ws && this._ws.readyState <= 1) {
        this._ws.close();
      }
      var closedErr = new Error("Operation Timeout");
      var _iterator4 = _createForOfIteratorHelper(this._pending),
        _step4;
      try {
        for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
          var _step4$value = _slicedToArray(_step4.value, 2),
            pending = _step4$value[1];
          pending.reject(closedErr);
        }
      } catch (err) {
        _iterator4.e(err);
      } finally {
        _iterator4.f();
      }
      this._pending.clear();
      this._activeSubscriptions.clear();
      this._activeReplayByTopic.clear();
      this._lastSeqByTopic.clear();
      this._ws = null;
      this._openPromise = null;
    }
  }]);
}(events.EventEmitter);
;// ./src/lib/worker/pubsubEvents.js
// Single source of truth for the PubsubClient events forwarded out of the
// worker to the main thread (and re-emitted by PubsubWorkerClient when the
// runtime has no Worker support and a PubsubClient is run inline instead).
var FORWARDED_EVENTS = ["liveBatch", "historyBatch", "messageDrop", "error", "welcome", "close"];
;// ./src/lib/worker/pubsub.worker.js


function pubsub_worker_createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = pubsub_worker_unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function pubsub_worker_unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return pubsub_worker_arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? pubsub_worker_arrayLikeToArray(r, a) : void 0; } }
function pubsub_worker_arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
// Web Worker host for the pubSub WebSocket connection.
//
// The real PubsubClient (WebSocket + protobuf encode/decode) runs here, off the
// main thread. The main thread talks to this worker through PubsubWorkerClient
// using a small request/response + event protocol:
//
//   main → worker : { kind, id, data }   (kind: init | subscribe | publish | unsubscribe | close)
//   worker → main : { kind: "rpcResult", id, result }   on success
//                   { kind: "rpcError",  id, error }     on failure
//                   { kind: "event", event, payload }    forwarded PubsubClient events
//
// Only worker-safe APIs are used by PubsubClient (WebSocket, TextEncoder/Decoder,
// crypto.randomUUID, protobufjs), so it can be hosted here unchanged.




// Every server frame already arrives as a batch — we forward "liveBatch" /
// "historyBatch" as-is and let meeting.js fan out per-message. No per-message
// "message" event exists on the client.

var client = null;
function post(message) {
  self.postMessage(message);
}
function forwardEvents(pubsubClient) {
  var _iterator = pubsub_worker_createForOfIteratorHelper(FORWARDED_EVENTS),
    _step;
  try {
    var _loop = function _loop() {
      var event = _step.value;
      pubsubClient.on(event, function (payload) {
        // "error" payloads may be Event/Error objects that don't structured-clone
        // cleanly; reduce them to a plain message string.
        var safePayload = event === "error" ? {
          message: (payload === null || payload === void 0 ? void 0 : payload.message) || String(payload || "error")
        } : payload;
        post({
          kind: "event",
          event: event,
          payload: safePayload
        });
      });
    };
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      _loop();
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
}
self.onmessage = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/regenerator_default().mark(function _callee(_ref) {
    var data, _ref3, kind, id, args, result, _t, _t2;
    return regenerator_default().wrap(function (_context) {
      while (1) switch (_context.prev = _context.next) {
        case 0:
          data = _ref.data;
          _ref3 = data || {}, kind = _ref3.kind, id = _ref3.id, args = _ref3.data;
          _context.prev = 1;
          _t = kind;
          _context.next = _t === "init" ? 2 : _t === "subscribe" ? 3 : _t === "publish" ? 5 : _t === "unsubscribe" ? 7 : _t === "close" ? 9 : 10;
          break;
        case 2:
          client = new PubsubClient(args || {});
          forwardEvents(client);
          result = true;
          return _context.abrupt("continue", 11);
        case 3:
          _context.next = 4;
          return client.subscribe(args.topic, args.options);
        case 4:
          result = _context.sent;
          return _context.abrupt("continue", 11);
        case 5:
          _context.next = 6;
          return client.publish(args.topic, args.fields);
        case 6:
          result = _context.sent;
          return _context.abrupt("continue", 11);
        case 7:
          _context.next = 8;
          return client.unsubscribe(args.topic);
        case 8:
          result = _context.sent;
          return _context.abrupt("continue", 11);
        case 9:
          if (client) client.close();
          client = null;
          result = true;
          return _context.abrupt("continue", 11);
        case 10:
          throw new Error("unknown pubsub worker command: ".concat(kind));
        case 11:
          post({
            kind: "rpcResult",
            id: id,
            result: result
          });
          _context.next = 13;
          break;
        case 12:
          _context.prev = 12;
          _t2 = _context["catch"](1);
          post({
            kind: "rpcError",
            id: id,
            error: (_t2 === null || _t2 === void 0 ? void 0 : _t2.message) || String(_t2)
          });
        case 13:
        case "end":
          return _context.stop();
      }
    }, _callee, null, [[1, 12]]);
  }));
  return function (_x) {
    return _ref2.apply(this, arguments);
  };
}();
})();

/******/ })()
;